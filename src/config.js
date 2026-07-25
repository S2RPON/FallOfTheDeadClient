import 'dotenv/config';
export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/fotd',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'change-me-access',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || '7d',
  frontendOrigin: process.env.FRONTEND_ORIGIN || '*',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || 'false') === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || 'Fall Of The Dead Support <FallOfTheDeadSupport@gmail.com>',
  defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en'
};
