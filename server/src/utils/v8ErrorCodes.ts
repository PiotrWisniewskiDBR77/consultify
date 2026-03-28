import type { Response } from 'express';

export const V8_ERROR_CODES = {
  // General
  V8_DISABLED: 'V8_DISABLED',
  V8_ORG_DISABLED: 'V8_ORG_DISABLED',
  V8_MISSING_ORG: 'V8_MISSING_ORG',
  V8_MISSING_ORG_CONTEXT: 'V8_MISSING_ORG_CONTEXT',

  // Validation
  V8_INVALID_INPUT: 'V8_INVALID_INPUT',
  V8_MISSING_PARAM: 'V8_MISSING_PARAM',

  // Service errors
  V8_SERVICE_ERROR: 'V8_SERVICE_ERROR',
  V8_SERVICE_UNAVAILABLE: 'V8_SERVICE_UNAVAILABLE',
  V8_TABLES_NOT_READY: 'V8_TABLES_NOT_READY',

  // Auth
  V8_UNAUTHORIZED: 'V8_UNAUTHORIZED',
  V8_FORBIDDEN: 'V8_FORBIDDEN',

  // Health
  V8_HEALTH_DEGRADED: 'V8_HEALTH_DEGRADED',
  V8_HEALTH_CRITICAL: 'V8_HEALTH_CRITICAL',
} as const;

export type V8ErrorCode = (typeof V8_ERROR_CODES)[keyof typeof V8_ERROR_CODES];

export function v8Error(
  res: Response,
  status: number,
  code: V8ErrorCode,
  message: string,
  details?: unknown
) {
  return res.status(status).json({ error: message, code, ...(details ? { details } : {}) });
}
