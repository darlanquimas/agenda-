import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Converte string de tempo JWT (ex: "15m", "7d", "8h") em milissegundos
 */
function parseJwtTime(timeStr: string): number {
  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // padrão 15 minutos
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 16) {
  console.error('[config] JWT_SECRET deve ser definido com pelo menos 16 caracteres');
  process.exit(1);
}
if (isProduction && jwtSecret.length < 32) {
  console.error('[config] JWT_SECRET deve ter pelo menos 32 caracteres em production');
  process.exit(1);
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '15m';
const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction,
  port: Number(process.env.PORT) || 3009,
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:8075',
  
  // JWT Configuration
  jwtSecret,
  jwtExpiresIn: jwtExpiresIn as string,
  jwtRefreshExpiresIn: jwtRefreshExpiresIn as string,
  jwtExpiresInMs: parseJwtTime(jwtExpiresIn),
  jwtRefreshExpiresInMs: parseJwtTime(jwtRefreshExpiresIn),
  
  // Cookie Configuration
  cookieSecret: process.env.COOKIE_SECRET || jwtSecret,
  cookieSecure: isProduction,
  cookieSameSite: (process.env.COOKIE_SAME_SITE ?? 'strict') as 'strict' | 'lax' | 'none',
  cookieDomain: process.env.COOKIE_DOMAIN,
  
  // Security Configuration
  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? '100kb',
  enableCsrf: process.env.ENABLE_CSRF !== 'false',
  enable2FA: process.env.ENABLE_2FA !== 'false',
  
  // Rate Limiting
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMaxLogin: Number(process.env.RATE_LIMIT_MAX_LOGIN) || 20,
  rateLimitMaxBooking: Number(process.env.RATE_LIMIT_MAX_BOOKING) || 30,
  rateLimitMaxApi: Number(process.env.RATE_LIMIT_MAX_API) || 500,
  
  // Account Security
  maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS) || 5,
  lockoutDurationMinutes: Number(process.env.LOCKOUT_DURATION_MINUTES) || 30,
  passwordMinLength: Number(process.env.PASSWORD_MIN_LENGTH) || 12,
  
  // Logging
  logLevel: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  logDir: process.env.LOG_DIR ?? 'logs',
  
  // Evolution API Configuration
  evolutionApiUrl: process.env.EVOLUTION_API_URL ?? '',
  evolutionApiKey: process.env.EVOLUTION_API_KEY ?? '',
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL ?? `http://localhost:${Number(process.env.PORT) || 3009}`,
  
  // Webhook Security
  webhookSecret: process.env.WEBHOOK_SECRET ?? '',
  
  // Token Configuration
  confirmationTokenExpirationHours: Number(process.env.CONFIRMATION_TOKEN_EXPIRATION_HOURS) || 48,
};

export default config;
