import express, { RequestHandler, Request, Response, NextFunction } from 'express';
import auth from '../middleware/auth';

type PublicHandler = RequestHandler & { _public?: boolean };

function isPublicRoute(handlers: PublicHandler[]): boolean {
  return handlers.some((h) => typeof h === 'function' && h._public === true);
}

function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createRouter() {
  const router = express.Router();
  const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;

  methods.forEach((method) => {
    const original = (router[method] as Function).bind(router);
    (router as any)[method] = (path: string, ...handlers: RequestHandler[]) => {
      const flat = handlers.flat() as PublicHandler[];
      const wrapped = flat.map(asyncHandler);
      const stack = isPublicRoute(flat) ? wrapped : [asyncHandler(auth), ...wrapped];
      return original(path, ...stack);
    };
  });

  return router;
}
