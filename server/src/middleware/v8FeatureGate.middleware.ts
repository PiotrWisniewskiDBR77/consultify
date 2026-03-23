import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.middleware.js';

export const v8FeatureGate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const v8Enabled = process.env.ENABLE_V8_GLOBAL === 'true';
  if (!v8Enabled) {
    res.status(404).json({
      error: 'V8 features not available',
      code: 'V8_DISABLED',
    });
    return;
  }
  next();
};

export default v8FeatureGate;
