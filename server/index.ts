import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config';
import { loginLimiter, bookingLimiter, apiLimiter } from './middleware/rateLimit';
import resolveTenant from './middleware/resolveTenant';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json({ limit: config.jsonBodyLimit }));
app.disable('x-powered-by');

app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/booking/:tenantSlug', (req, _res, next) => {
  if (req.method === 'POST' && req.path === '/') return bookingLimiter(req, _res, next);
  next();
});

app.use('/api/auth', require('./routes/auth').default);
app.use('/api/clients', require('./routes/clients').default);
app.use('/api/appointments', require('./routes/appointments').default);
app.use('/api/dashboard', require('./routes/dashboard').default);
app.use('/api/professionals', require('./routes/professionals').default);
app.use('/api/specialties', require('./routes/specialties').default);
app.use('/api/services', require('./routes/services').default);
app.use('/api/users', require('./routes/users').default);
app.use('/api/platform', require('./routes/platform').default);
app.use('/api/booking/:tenantSlug', resolveTenant, require('./routes/booking').default);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const server = app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
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
