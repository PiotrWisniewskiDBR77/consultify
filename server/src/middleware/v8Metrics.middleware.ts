import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';
import { recordV8Request } from '../utils/v8MetricsStore.js';

export const v8MetricsMiddleware = (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const isError = res.statusCode >= 400;
    recordV8Request(duration, isError);
  });
  next();
};
