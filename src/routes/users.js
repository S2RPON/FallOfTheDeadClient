import { z } from 'zod';
import { getPool } from '../db/client.js';

const SearchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const usersRoutes = async (app) => {
  app.get('/search', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parse = SearchSchema.safeParse(request.query);
    if (!parse.success) {
      return reply.status(400).send({ message: 'Invalid query', errors: parse.error.flatten() });
    }

    const { q, limit } = parse.data;
    const pool = getPool();
    const currentUserId = request.user.sub;

    const like = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;

    const result = await pool.query(
      `
      SELECT u.id, u.username, u.display_name, u.email, u.last_active_at,
             EXISTS (SELECT 1 FROM friendships f WHERE f.requester_id = u.id AND f.addressee_id = $1 AND f.status = 'pending') AS pending_sent,
             EXISTS (SELECT 1 FROM friendships f WHERE f.requester_id = $1 AND f.addressee_id = u.id AND f.status = 'pending') AS pending_received,
             EXISTS (SELECT 1 FROM friendships f WHERE ((f.requester_id = $1 AND f.addressee_id = u.id) OR (f.requester_id = u.id AND f.addressee_id = $1)) AND f.status = 'accepted') AS is_friend,
             EXISTS (SELECT 1 FROM friendships f WHERE f.requester_id = $1 AND f.addressee_id = u.id AND f.blocked = true) AS blocked_them,
             EXISTS (SELECT 1 FROM friendships f WHERE f.requester_id = u.id AND f.addressee_id = $1 AND f.blocked = true) AS blocked_by
      FROM users u
      WHERE (u.username ILIKE $2 OR u.display_name ILIKE $2 OR u.email ILIKE $2)
        AND u.id <> $1
        AND u.status = 'active'
        AND u.email_verified = true
        AND NOT EXISTS (SELECT 1 FROM friendships f WHERE ((f.requester_id = $1 AND f.addressee_id = u.id) OR (f.requester_id = u.id AND f.addressee_id = $1)) AND f.status = 'accepted')
      ORDER BY u.last_active_at DESC
      LIMIT $3
      `,
      [currentUserId, like, limit]
    );

    const users = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      email: row.email,
      lastActiveAt: row.last_active_at,
      online: new Date(row.last_active_at).getTime() > Date.now() - 5 * 60 * 1000,
      pendingSent: row.pending_sent,
      pendingReceived: row.pending_received,
      isFriend: row.is_friend,
      blockedThem: row.blocked_them,
      blockedBy: row.blocked_by
    }));

    return reply.send({ users });
  });

  app.get('/suggestions', { preHandler: [app.authenticate] }, async (request, reply) => {
    const pool = getPool();
    const currentUserId = request.user.sub;
    const limit = 20;

    const result = await pool.query(
      `
      WITH mutual AS (
        SELECT f2.addressee_id AS id
        FROM friendships f1
        JOIN friendships f2 ON f2.requester_id = f1.addressee_id AND f2.status = 'accepted'
        WHERE f1.requester_id = $1 AND f1.status = 'accepted'
          AND f2.addressee_id <> $1
          AND NOT EXISTS (SELECT 1 FROM friendships f WHERE ((f.requester_id = $1 AND f.addressee_id = f2.addressee_id) OR (f.requester_id = f2.addressee_id AND f.addressee_id = $1)))
      ),
      recent AS (
        SELECT id FROM users
        WHERE id <> $1
          AND status = 'active'
          AND email_verified = true
          AND NOT EXISTS (SELECT 1 FROM friendships f WHERE ((f.requester_id = $1 AND f.addressee_id = users.id) OR (f.requester_id = users.id AND f.addressee_id = $1)))
        ORDER BY created_at DESC
        LIMIT $2
      )
      SELECT u.id, u.username, u.display_name, u.email, u.last_active_at
      FROM users u
      WHERE u.id IN (SELECT id FROM mutual UNION SELECT id FROM recent)
      LIMIT $2
      `,
      [currentUserId, limit]
    );

    const users = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      email: row.email,
      lastActiveAt: row.last_active_at,
      online: new Date(row.last_active_at).getTime() > Date.now() - 5 * 60 * 1000
    }));

    return reply.send({ users });
  });

  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, username, display_name, email, email_verified, status, last_active_at, created_at FROM users WHERE id = $1 LIMIT 1`,
      [request.user.sub]
    );
    const user = result.rows[0];
    if (!user) {
      throw new Error('User not found');
    }
    return reply.send({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email,
      emailVerified: user.email_verified,
      status: user.status,
      lastActiveAt: user.last_active_at,
      createdAt: user.created_at
    });
  });

  app.patch('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body || {};
    const pool = getPool();
    const updates = [];
    const values = [];
    let idx = 1;

    if (typeof body.displayName === 'string') {
      updates.push(`display_name = $${idx++}`);
      values.push(body.displayName);
    }
    if (typeof body.language === 'string') {
      updates.push(`language = $${idx++}`);
      values.push(body.language);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ message: 'No valid fields to update.' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(request.user.sub);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, username, display_name, email, email_verified`,
      values
    );

    return reply.send({ user: result.rows[0] });
  });
};

export default usersRoutes;
