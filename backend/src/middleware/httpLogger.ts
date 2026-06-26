import { Request, Response, NextFunction } from 'express';
import { logHttp } from '../utils/logger';

export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    logHttp(req.method, req.originalUrl, res.statusCode, Date.now() - start);
  });
  next();
}
