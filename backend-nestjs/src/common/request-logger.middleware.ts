import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Logs one line per request when the response finishes:
 * `GET /api/v1/health 200 12ms`.
 *
 * Only method, path (no query string), status and duration are logged. Never
 * headers or bodies: they carry `x-admin-key` and admin data (CLAUDE.md rule 5).
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    const path = req.originalUrl.split('?')[0];
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const line = `${req.method} ${path} ${res.statusCode} ${ms.toFixed(0)}ms`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });
    next();
  }
}
