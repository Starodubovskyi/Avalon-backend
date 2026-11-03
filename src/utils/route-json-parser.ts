import { json, NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * JSON body parser with its own size limit, to be mounted on one route prefix
 * BEFORE Nest registers its default parser (i.e. before `app.listen()`).
 * The default parser then skips the already-parsed body (`req._body`), while
 * every other route keeps the default 100 KB limit.
 *
 * The returned middleware must not be named `jsonParser`: Nest does not
 * register its global JSON parser when a middleware with that name is
 * already mounted, which would leave every other route without JSON parsing.
 */
export function routeJsonParser(limit: string): RequestHandler {
  const parse = json({ limit });
  return function routeJsonBodyParser(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    parse(req, res, next);
  };
}
