import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db/client.js';

const RequestFriendSchema = z.object({ addresseeId: z.string().uuid() });
const RespondSchema = z.object({ userId: z.string().uuid() });
const RemoveFriendSchema = z.object({ friendId: z.string().uuid() });

const friendsRoutes = async (app) => {
  app.post('/request', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parse = RequestFriendSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ message: 'Invalid input', errors: parse.error.flatten() });

    const requesterId = request.user.sub;
    const addresseeId = parse.data.addresseeId;

    if (requesterId === addresseeId) {
      return reply.status(400).send({ message: 'Cannot friend yourself.' });
    }

    const pool = getPool();
    const existing = await pool.query(
      `SELECT id, status, blocked FROM friendships WHERE requester_id = $1 AND addressee_id = $2 OR requester_id = $2 AND addressee_id = $1`,
      [requesterId, addresseeId]
    );

    if (existing.rowCount > 0) {
      const rel = existing.rows[0];
      if (rel.status === 'accepted') {
        return reply.status(409).send({ message: 'Already friends.' });
      }
      if (rel.blocked) {
        return reply.status(403).send({ message: 'Relationship is blocked.' });
      }
      return reply.status(409).send({ message: 'Friend request already exists.' });
    }

    const friendshipId = uuidv4();
    await pool.query(
      `INSERT INTO friendships (id, requester_id, addressee_id, status) VALUES ($1, $2, $3, 'pending')`,
      [friendshipId, requesterId, addresseeId]
    );

    return reply.status(201).send({ friendshipId, status: 'pending' });
  });

  app.post('/accept', async (request, reply) => {
    const parse = RespondSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ message: 'Invalid input' });
    const pool = getPool();
    const result = await pool.query(
      `UPDATE friendships SET status = 'accepted', updated_at = NOW() WHERE addressee_id = $1 AND requester_id = $2 AND status = 'pending' RETURNING id`,
      [request.user.sub, parse.data.userId]
    );
    if (result.rowCount === 0) return reply.status(404).send({ message: 'Request not found.' });
    return reply.send({ status: 'accepted' });
  });

  app.post('/decline', async (request, reply) => {
    const parse = RespondSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ message: 'Invalid input' });
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM friendships WHERE addressee_id = $1 AND requester_id = $2 AND status = 'pending' RETURNING id`,
      [request.user.sub, parse.data.userId]
    );
    if (result.rowCount === 0) return reply.status(404).send({ message: 'Request not found.' });
    return reply.send({ status: 'declined' });
  });

  app.post('/cancel', async (request, reply) => {
    const parse = RespondSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ message: 'Invalid input' });
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM friendships WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending' RETURNING id`,
      [request.user.sub, parse.data.userId]
    );
    if (result.rowCount === 0) return reply.status(404).send({ message: 'Request not found.' });
    return reply.send({ status: 'cancelled' });
  });

  app.post('/remove', async (request, reply) => {
    const parse = RemoveFriendSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ message: 'Invalid input' });
    const pool = getPool();
    await pool.query(
      `DELETE FROM friendships WHERE id = $1 AND ((requester_id = $2 AND addressee_id = $3) OR (requester_id = $3 AND addressee_id = $2))`,
      [parse.data.friendId, request.user.sub, parse.data.friendId]
    );
    return reply.send({ status: 'removed' });
  });

  app.post('/block', async (request, reply) => {
    const parse = RespondSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ message: 'Invalid input' });
    const pool = getPool();
    await pool.query(
      `INSERT INTO friendships (requester_id, addressee_id, status, blocked) VALUES ($1, $2, 'blocked', true)
       ON CONFLICT (requester_id, addressee_id) DO UPDATE SET status = 'blocked', blocked = true, updated_at = NOW()`,
      [request.user.sub, parse.data.userId]
    );
    return reply.send({ status: 'blocked' });
  });

  app.post('/unblock', async (request, reply) => {
    const parse = RespondSchema.safeParse(request.body);
    if (!parse.success) return reply.status(400).send({ message: 'Invalid input' });
    const pool = getPool();
    await pool.query(`DELETE FROM friendships WHERE requester_id = $1 AND addressee_id = $2 AND blocked = true`, [
      request.user.sub,
      parse.data.userId,
    ]);
    return reply.send({ status: 'unblocked' });
  });

  app.get('/list', { preHandler: [app.authenticate] }, async (request, reply) => {
    const pool = getPool();
    const result = await pool.query(
      `
      SELECT u.id, u.username, u.display_name, u.email, u.last_active_at
      FROM friendships f
      JOIN users u ON (u.id = f.requester_id OR u.id = f.addressee_id) AND u.id <> $1
      WHERE f.status = 'accepted' AND (f.requester_id = $1 OR f.addressee_id = $1)
      `,
      [request.user.sub]
    );
    return reply.send({ friends: result.rows });
  });

  app.get('/requests', { preHandler: [app.authenticate] }, async (request, reply) => {
    const pool = getPool();
    const result = await pool.query(
      `
      SELECT f.id, u.id AS userId, u.username, u.display_name, u.email, u.last_active_at, f.created_at
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
      `,
      [request.user.sub]
    );
    return reply.send({ requests: result.rows });
  });

  app.get('/requests/sent', { preHandler: [app.authenticate] }, async (request, reply) => {
    const pool = getPool();
    const result = await pool.query(
      `
      SELECT f.id, u.id AS userId, u.username, u.display_name, u.email, u.last_active_at, f.created_at
      FROM friendships f
      JOIN users u ON u.id = f.addressee_id
      WHERE f.requester_id = $1 AND f.status = 'pending'
      `,
      [request.user.sub]
    );
    return reply.send({ requests: result.rows });
  });

  app.get('/blocks', { preHandler: [app.authenticate] }, async (request, reply) => {
    const pool = getPool();
    const result = await pool.query(
      `
      SELECT u.id AS userId, u.username, u.display_name, u.email, f.updated_at
      FROM friendships f
      JOIN users u ON u.id = f.addressee_id
      WHERE f.requester_id = $1 AND f.blocked = true
      `,
      [request.user.sub]
    );
    return reply.send({ blocks: result.rows });
  });
};

export default friendsRoutes;
