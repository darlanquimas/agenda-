import path from 'path';
import config from '../config';

/**
 * Logger estruturado com Winston
 * 
 * Implementação condicional: usa Winston em produção, console.log em desenvolvimento
 * para evitar problemas de dependência até a instalação do pacote
 */

interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  http(message: string, meta?: any): void;
}

class ConsoleLogger implements Logger {
  private log(level: string, message: string, meta?: any) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let output = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (meta) {
      if (meta.stack) {
        output += `\n${meta.stack}`;
      } else {
        output += `\n${JSON.stringify(meta, null, 2)}`;
      }
    }
    
    console.log(output);
  }

  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  error(message: string, meta?: any): void {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  debug(message: string, meta?: any): void {
    if (!config.isProduction) {
      this.log('debug', message, meta);
    }
  }

  http(message: string, meta?: any): void {
    if (!config.isProduction) {
      this.log('http', message, meta);
    }
  }
}

/**
 * Função para criar logger Winston (será usado após npm install)
 */
function createWinstonLogger(): Logger {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const winston = require('winston');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const DailyRotateFile = require('winston-daily-rotate-file');

    const logDir = path.join(__dirname, '../../logs');

    const logger = winston.createLogger({
      level: config.isProduction ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      defaultMeta: { service: 'agenda-plus' },
      transports: [
        new DailyRotateFile({
          filename: path.join(logDir, 'application-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          level: 'info',
        }),
        new DailyRotateFile({
          filename: path.join(logDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error',
        }),
      ],
    });

    if (!config.isProduction) {
      logger.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf((info: any) => {
              const { timestamp, level, message, stack, ...meta } = info;
              let log = `[${timestamp}] [${level}] ${message}`;
              
              if (stack) {
                log += `\n${stack}`;
              }
              
              const metaKeys = Object.keys(meta).filter(k => k !== 'service');
              if (metaKeys.length > 0) {
                const metaData: any = {};
                metaKeys.forEach(k => metaData[k] = meta[k]);
                log += `\n${JSON.stringify(metaData, null, 2)}`;
              }
              
              return log;
            })
          ),
        })
      );
    }

    return logger;
  } catch (error) {
    console.warn('[logger] Winston não disponível, usando ConsoleLogger');
    return new ConsoleLogger();
  }
}

const logger = createWinstonLogger();

export default logger;

/**
 * Middleware de logging de requisições HTTP
 */
export function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(message, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    } else if (res.statusCode >= 400) {
      logger.warn(message, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
      });
    } else {
      logger.http(message, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
      });
    }
  });

  next();
}
