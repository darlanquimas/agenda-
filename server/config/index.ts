import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 16) {
  console.error('[config] JWT_SECRET deve ser definido com pelo menos 16 caracteres');
  process.exit(1);
}
if (isProduction && jwtSecret.length < 32) {
  console.error('[config] JWT_SECRET deve ter pelo menos 32 caracteres em production');
  process.exit(1);
}

const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction,
  port: Number(process.env.PORT) || 3001,
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  jwtSecret,
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as string,
  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? '100kb',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMaxLogin: Number(process.env.RATE_LIMIT_MAX_LOGIN) || 20,
  rateLimitMaxBooking: Number(process.env.RATE_LIMIT_MAX_BOOKING) || 30,
  rateLimitMaxApi: Number(process.env.RATE_LIMIT_MAX_API) || 500,
};

export default config;
