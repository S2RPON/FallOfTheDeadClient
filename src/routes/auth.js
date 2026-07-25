import { z } from 'zod';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { getPool, query } from '../db/client.js';
import { createAccessToken, createRefreshToken, hashToken } from '../services/tokens.js';
import { sendVerificationEmail } from '../services/email.js';

const RegisterSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(64),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

const LoginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1)
});

const VerifyEmailSchema = z.object({
  token: z.string().min(1)
});

const ResendVerificationSchema = z.object({
  email: z.string().email()
});

const authRoutes = async (app) => {
  app.post('/register', async (request, reply) => {
    const parse = RegisterSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ message: 'Invalid input', errors: parse.error.flatten() });
    }

    const { username, displayName, email, password } = parse.data;
    const pool = getPool();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (existing.rowCount > 0) {
      return reply.status(409).send({ message: 'Username or email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const userId = uuidv4();

    await pool.query(
      `INSERT INTO users (id, username, display_name, email, password_hash, email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, username, displayName, email, passwordHash, verificationToken, verificationExpires]
    );

    let emailSent = false;
    try {
      await sendVerificationEmail({ email, displayName, token: verificationToken });
      emailSent = true;
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError.message);
    }

    return reply.status(201).send({ message: 'Verification email sent', email, verificationToken: emailSent ? undefined : verificationToken });
  });

  app.post('/login', async (request, reply) => {
    const parse = LoginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ message: 'Invalid input', errors: parse.error.flatten() });
    }

    const { emailOrUsername, password } = parse.data;
    const pool = getPool();

    const result = await pool.query(
      `SELECT id, username, display_name, email, email_verified, password_hash, status, last_active_at
       FROM users WHERE email = $1 OR username = $1 LIMIT 1`,
      [emailOrUsername]
    );

    const user = result.rows[0];
    if (!user) {
      return reply.status(401).send({ message: 'Invalid email or password.' });
    }

    if (user.status !== 'active') {
      return reply.status(403).send({ message: 'Account is suspended or banned.' });
    }

    if (!user.email_verified) {
      return reply.status(403).send({
        message: 'Your email has not been verified yet.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ message: 'Invalid email or password.' });
    }

    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);

    const accessToken = createAccessToken({ sub: user.id, username: user.username, email: user.email });
    const refreshToken = createRefreshToken({ sub: user.id });

    await pool.query(
      `INSERT INTO sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, hashToken(refreshToken), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]
    );

    return reply.send({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        emailVerified: user.email_verified,
        status: user.status,
        lastActiveAt: user.last_active_at
      }
    });
  });

  app.post('/verify-email', async (request, reply) => {
    const parse = VerifyEmailSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ message: 'Invalid input' });
    }

    const { token } = parse.data;
    const pool = getPool();

    const result = await pool.query(
      `SELECT id FROM users WHERE email_verification_token = $1 AND email_verification_expires > NOW() AND email_verified = false LIMIT 1`,
      [token]
    );

    if (result.rowCount === 0) {
      return reply.status(400).send({ message: 'Invalid or expired verification token.' });
    }

    await pool.query(
      `UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1`,
      [result.rows[0].id]
    );

    return reply.send({ message: 'Email verified successfully.' });
  });

  app.post('/resend-verification', async (request, reply) => {
    const parse = ResendVerificationSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ message: 'Invalid input' });
    }

    const { email } = parse.data;
    const pool = getPool();

    const userResult = await pool.query(`SELECT id, email_verified FROM users WHERE email = $1 LIMIT 1`, [email]);
    if (userResult.rowCount === 0) {
      return reply.status(404).send({ message: 'User not found.' });
    }

    const user = userResult.rows[0];
    if (user.email_verified) {
      return reply.status(400).send({ message: 'Email already verified.' });
    }

    const cooldownResult = await pool.query(
      `SELECT last_sent_at, attempts FROM email_resend_cooldowns WHERE user_id = $1 LIMIT 1`,
      [user.id]
    );

    if (cooldownResult.rowCount > 0) {
      const cooldown = cooldownResult.rows[0];
      const lastSent = new Date(cooldown.last_sent_at);
      const diffSeconds = (Date.now() - lastSent.getTime()) / 1000;
      if (diffSeconds < 60) {
        return reply.status(429).send({ message: `Please wait ${Math.ceil(60 - diffSeconds)} seconds before resending.` });
      }
    }

    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await pool.query(
      `UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3`,
      [verificationToken, verificationExpires, user.id]
    );

    let emailSent = false;
    try {
      await sendVerificationEmail({ email, displayName: email, token: verificationToken });
      emailSent = true;
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError.message);
    }

    await pool.query(
      `INSERT INTO email_resend_cooldowns (user_id, last_sent_at, attempts) VALUES ($1, NOW(), 1)
       ON CONFLICT (user_id) DO UPDATE SET last_sent_at = NOW(), attempts = email_resend_cooldowns.attempts + 1`,
      [user.id]
    );

    return reply.send({ message: 'Verification email sent.', verificationToken: emailSent ? undefined : verificationToken });
  });

  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body || {};
    if (!refreshToken) {
      return reply.status(401).send({ message: 'Refresh token required.' });
    }

    const pool = getPool();
    const tokenHash = hashToken(refreshToken);
    const result = await pool.query(
      `SELECT sessions.user_id, users.username, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.refresh_token = $1 AND sessions.expires_at > NOW() LIMIT 1`,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      return reply.status(401).send({ message: 'Invalid refresh token.' });
    }

    const session = result.rows[0];
    const accessToken = createAccessToken({ sub: session.user_id, username: session.username, email: session.email });

    return reply.send({ accessToken });
  });

  app.post('/logout', async (request, reply) => {
    const { refreshToken } = request.body || {};
    if (refreshToken) {
      const pool = getPool();
      await pool.query('DELETE FROM sessions WHERE refresh_token = $1', [hashToken(refreshToken)]);
    }
    return reply.send({ message: 'Logged out.' });
  });
};

export default authRoutes;
