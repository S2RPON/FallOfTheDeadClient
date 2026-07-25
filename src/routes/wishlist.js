import { z } from 'zod';
import { getPool } from '../db/client.js';

const wishlistRoutes = async (app) => {
  app.get('/count', async (request) => {
    const pool = getPool();
    const result = await pool.query('SELECT COUNT(*) AS count FROM wishlists');
    
    return { count: parseInt(result.rows[0].count, 10), weeklyCount: 110 };
  });

  app.get('/stats', async (request) => {
    const pool = getPool();

    const today = await pool.query(
      'SELECT COUNT(*) AS count FROM wishlists WHERE DATE(created_at) = CURRENT_DATE'
    );

    const weekResult = await pool.query(
      "SELECT COUNT(*) AS count FROM wishlists WHERE created_at > NOW() - INTERVAL '7 days'"
    );

    const monthResult = await pool.query(
      "SELECT COUNT(*) AS count FROM wishlists WHERE created_at > NOW() - INTERVAL '30 days'"
    );

    return {
      dailyGrowth: parseInt(today.rows[0].count, 10),
      weeklyGrowth: parseInt(weekResult.rows[0].count, 10),
      monthlyGrowth: parseInt(monthResult.rows[0].count, 10)
    };
  });

  app.get('/status', { preHandler: [app.authenticate] }, async (request) => {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id FROM wishlists WHERE user_id = $1 LIMIT 1',
      [request.user.sub]
    );

    return { success: true, wishlisted: result.rowCount > 0 };
  });

  app.post('/add', { preHandler: [app.authenticate] }, async (request, reply) => {
    const pool = getPool();
    const existing = await pool.query('SELECT id FROM wishlists WHERE user_id = $1 LIMIT 1', [request.user.sub]);
    if (existing.rowCount > 0) {
      const count = await pool.query('SELECT COUNT(*) AS count FROM wishlists');
      return { success: true, wishlisted: true, count: parseInt(count.rows[0].count, 10) };
    }

    await pool.query(
      'INSERT INTO wishlists (user_id, created_at) VALUES ($1, NOW())',
      [request.user.sub]
    );

    const count = await pool.query('SELECT COUNT(*) AS count FROM wishlists');
    return reply.send({ success: true, wishlisted: true, count: parseInt(count.rows[0].count, 10) });
  });

  app.delete('/remove', { preHandler: [app.authenticate] }, async (request, reply) => {
    const pool = getPool();
    await pool.query('DELETE FROM wishlists WHERE user_id = $1', [request.user.sub]);
    const count = await pool.query('SELECT COUNT(*) AS count FROM wishlists');
    return reply.send({ success: true, wishlisted: false, count: parseInt(count.rows[0].count, 10) });
  });
};

export default wishlistRoutes;
