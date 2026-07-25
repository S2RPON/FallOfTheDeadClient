import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function createAccessToken(payload) {
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.accessTokenTtl });
}

export function createRefreshToken(payload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.refreshTokenTtl });
}

export function hashToken(token) {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return String(hash);
}
