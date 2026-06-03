import { RequestHandler } from 'express';

type PublicHandler = RequestHandler & { _public?: boolean };

export function markPublic(...handlers: RequestHandler[]): PublicHandler[] {
  return handlers.map((h) => {
    const ph = h as PublicHandler;
    ph._public = true;
    return ph;
  });
}
