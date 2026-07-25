import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getPool } from '../db/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const translations = new Map([
  ['en', JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'translations', 'en.json'), 'utf8'))]
]);

const i18nRoutes = async (app) => {
  app.get('/locales/:lang', async (request, reply) => {
    const { lang } = request.params;
    const data = translations.get(lang) || translations.get('en') || {};
    return reply.send({ lang, translations: data });
  });

  app.get('/me/language', { preHandler: [app.authenticate] }, async (request, reply) => {
    const pool = getPool();
    const result = await pool.query(`SELECT language FROM users WHERE id = $1 LIMIT 1`, [request.user.sub]);
    const user = result.rows[0];
    return reply.send({ language: user?.language || 'en' });
  });

  app.patch('/me/language', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { language } = request.body || {};
    const pool = getPool();
    await pool.query(`UPDATE users SET language = $1, updated_at = NOW() WHERE id = $2`, [language, request.user.sub]);
    return reply.send({ language });
  });
};

export default i18nRoutes;
