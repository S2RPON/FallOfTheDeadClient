import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import redis from '@fastify/redis';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import friendsRoutes from './routes/friends.js';
import i18nRoutes from './routes/i18n.js';
import wishlistRoutes from './routes/wishlist.js';
import { createWebSocketServer } from './services/websocket.js';

const app = Fastify({ logger: true });

await app.register(helmet);
await app.register(cors, {
  origin: [config.frontendOrigin, 'null'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
});
await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
await app.register(multipart);
await app.register(jwt, { secret: config.jwtAccessSecret, sign: { expiresIn: config.accessTokenTtl } });
await app.register(redis, { url: config.redisUrl });
await app.register(websocket);

app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ message: 'Unauthorized' });
  }
});

app.register(authRoutes, { prefix: '/api/auth' });
app.register(usersRoutes, { prefix: '/api/users' });
app.register(friendsRoutes, { prefix: '/api/friends' });
app.register(i18nRoutes, { prefix: '/api/i18n' });
app.register(wishlistRoutes, { prefix: '/api/wishlist' });

app.get('/health', async () => ({ status: 'ok' }));

createWebSocketServer(app);

const start = async () => {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Server listening on ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
