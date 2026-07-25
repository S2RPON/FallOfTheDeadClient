import Fastify from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';

export function createWebSocketServer(app) {
  const wss = new WebSocketServer({ server: app.server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');

    let userId = null;

    try {
      const decoded = app.jwt.decode(token || '');
      if (decoded?.sub) userId = decoded.sub;
    } catch {
      ws.close();
      return;
    }

    if (!userId) {
      ws.close();
      return;
    }

    ws.on('message', (data) => {
      // Future message handling
    });
  });

  return wss;
}
