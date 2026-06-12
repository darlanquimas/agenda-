import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config';
import { loginLimiter, bookingLimiter, apiLimiter, twoFactorLimiter } from './middleware/rateLimit';
import resolveTenant from './middleware/resolveTenant';
import { sanitizeMiddleware } from './middleware/sanitize';
import { requestLogger } from './lib/logger';
import logger from './lib/logger';
import appointmentReminderService from './services/appointmentReminderService';

const app = express();

// Helmet com CSP customizada
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: config.isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({ 
  origin: config.clientUrl,
  credentials: true,
  exposedHeaders: ['X-CSRF-Token'],
}));

// Cookie parser (será instalado via npm)
try {
  const cookieParser = require('cookie-parser');
  app.use(cookieParser(config.cookieSecret));
} catch (error) {
  logger.warn('cookie-parser não instalado - cookies desabilitados temporariamente');
}

app.use(express.json({ limit: config.jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.jsonBodyLimit }));
app.disable('x-powered-by');

// Sanitização XSS
app.use(sanitizeMiddleware);

// Logging de requisições
app.use(requestLogger);

app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/two-factor/verify', twoFactorLimiter);
app.use('/api/two-factor/enable', twoFactorLimiter);
app.use('/api/booking/:tenantSlug', (req, _res, next) => {
  if (req.method === 'POST' && req.path === '/') return bookingLimiter(req, _res, next);
  next();
});

// Webhook do WhatsApp (sem autenticação)
app.use('/webhook/whatsapp', require('./routes/whatsapp-webhook').default);

app.use('/api/auth', require('./routes/auth').default);
app.use('/api/auth', require('./routes/refresh').default);
app.use('/api/two-factor', require('./routes/two-factor').default);
app.use('/api/clients', require('./routes/clients').default);
app.use('/api/appointments', require('./routes/appointments').default);
app.use('/api/dashboard', require('./routes/dashboard').default);
app.use('/api/professionals', require('./routes/professionals').default);
app.use('/api/specialties', require('./routes/specialties').default);
app.use('/api/services', require('./routes/services').default);
app.use('/api/users', require('./routes/users').default);
app.use('/api/platform', require('./routes/platform').default);
app.use('/api/whatsapp', require('./routes/whatsapp').default);
app.use('/api/whatsapp-config', require('./routes/whatsapp-config').default);
app.use('/api/booking/:tenantSlug', resolveTenant, require('./routes/booking').default);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.status >= 400 && err.status < 500) {
    logger.warn(`Erro ${err.status}: ${err.message}`);
    return res.status(err.status).json({ error: err.message });
  }
  
  logger.error('Erro interno do servidor', {
    error: err.message,
    stack: err.stack,
    url: _req.url,
    method: _req.method,
  });
  
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const server = app.listen(config.port, () => {
  logger.info(`🚀 Server running on http://localhost:${config.port}`);
  logger.info(`📝 Environment: ${config.nodeEnv}`);
  logger.info(`🔒 Security features: ${config.enable2FA ? '2FA ✓' : '2FA ✗'} | ${config.enableCsrf ? 'CSRF ✓' : 'CSRF ✗'}`);
  
  // Iniciar serviço de lembretes automáticos
  appointmentReminderService.start();
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Porta ${config.port} já está em uso.`);
    process.exit(1);
  }
  throw err;
});

function gracefulShutdown(signal: string) {
  const finish = () => {
    if (signal === 'SIGUSR2') process.kill(process.pid, 'SIGUSR2');
    else process.exit(0);
  };
  if (!server.listening) return finish();
  server.close(finish);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGUSR2', () => gracefulShutdown('SIGUSR2'));
