/**
 * Validation Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Higher-order function to validate request body against a Zod schema.
 */

import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import logger from '../utils/Logger.js';

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const readMethod = (req: Request): string =>
  normalizeOptionalString(safeRead(() => req.method, undefined)) || 'UNKNOWN';

const readPath = (req: Request): string =>
  normalizeOptionalString(safeRead(() => req.path, undefined)) ||
  normalizeOptionalString(safeRead(() => req.originalUrl, undefined)) ||
  'unknown';

const readValidationIssues = (result: unknown): unknown[] => {
  const issues = (result as { error?: { issues?: unknown } } | undefined)?.error?.issues;
  return Array.isArray(issues) ? issues : [];
};

const MAX_VALIDATION_FIELD_CHARS = 256;
const MAX_VALIDATION_MESSAGE_CHARS = 2048;
const MAX_VALIDATION_LOG_PREVIEW_CHARS = 8000;
const MAX_VALIDATION_DETAILS_ITEMS = 50;
const truncateValidationString = (value: string, maxChars: number): string =>
  value.length <= maxChars ? value : `${value.slice(0, maxChars)}...`;
const safeJsonPreview = (value: unknown, maxChars: number): string => {
  try {
    const serialized = JSON.stringify(value);
    return truncateValidationString(serialized, maxChars);
  } catch {
    return '[unserializable]';
  }
};

const readValidationErrors = (result: unknown): Array<{ field: string; message: string; code: string }> =>
  readValidationIssues(result).map((rawIssue) => {
    try {
      const issue = rawIssue as { path?: unknown; message?: unknown; code?: unknown };
      const pathValue = issue.path;
      const field = Array.isArray(pathValue)
        ? pathValue.map((segment) => (segment === undefined || segment === null ? '' : String(segment))).join('.')
        : typeof pathValue === 'string'
          ? pathValue
          : '';
      return {
        field: truncateValidationString(field, MAX_VALIDATION_FIELD_CHARS),
        message: truncateValidationString(
          typeof issue.message === 'string' ? issue.message : 'Invalid value',
          MAX_VALIDATION_MESSAGE_CHARS
        ),
        code: typeof issue.code === 'string' ? issue.code : 'custom',
      };
    } catch {
      return {
        field: '',
        message: 'Invalid value',
        code: 'custom',
      };
    }
  });
const isZodSchemaLike = (schema: unknown): schema is z.ZodSchema =>
  Boolean(schema) && typeof (schema as z.ZodSchema).safeParse === 'function';

const respondIfHeadersOpen = (
  req: Request,
  res: Response,
  statusCode: 400 | 500,
  payload: Record<string, unknown>
): boolean => {
  if (safeRead(() => res.headersSent, false)) {
    safeRead(() => {
      logger.warn(
        `[ValidationMiddleware] Skipped ${statusCode} response; headers already sent (${readMethod(req)} ${readPath(req)})`
      );
      return true;
    }, false);
    return false;
  }
  try {
    res.status(statusCode).json(payload);
  } catch (writeErr) {
    safeRead(() => {
      logger.error('[ValidationMiddleware] Failed to serialize/write JSON response', writeErr);
      return true;
    }, false);
    safeRead(() => {
      if (!safeRead(() => res.headersSent, false)) {
        const safePayload: Record<string, unknown> = {
          error: typeof payload.error === 'string' ? payload.error : 'Error',
          details: Array.isArray(payload.details) ? payload.details : [],
        };
        res.status(statusCode).type('application/json').send(JSON.stringify(safePayload));
      }
      return true;
    }, false);
  }
  return true;
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Validate request body against a Zod schema
 * @param schema - The Zod schema to validate against
 * @returns Express middleware
 */
export const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isZodSchemaLike(schema)) {
      safeRead(() => {
        logger.error('[ValidationMiddleware] Invalid schema: expected Zod schema with safeParse');
        return true;
      }, false);
      respondIfHeadersOpen(req, res, 500, { error: 'Internal Server Error during validation' });
      return;
    }
    try {
      const result = schema.safeParse(safeRead(() => req.body, undefined));
      if (!result.success) {
        const errors = readValidationErrors(result);
        const details = errors.slice(0, MAX_VALIDATION_DETAILS_ITEMS);
        const firstError = errors[0];
        const errorMessage = firstError ? firstError.message : 'Validation Error';

        respondIfHeadersOpen(req, res, 400, {
          error: errorMessage,
          details,
        });

        safeRead(() => {
          logger.info(
            `[ValidationMiddleware] Validation failed for ${readMethod(req)} ${readPath(req)}:`,
            safeJsonPreview(details, MAX_VALIDATION_LOG_PREVIEW_CHARS)
          );
          return true;
        }, false);
        return;
      }

      // Replace body with parsed (sanitized/coerced) data
      try {
        req.body = result.data;
      } catch (e) {
        // Fallback for read-only body property
        Object.defineProperty(req, 'body', {
          value: result.data,
          writable: true,
          configurable: true,
        });
      }
      next();
    } catch (error: unknown) {
      safeRead(() => {
        logger.error('Validation Middleware Error:', error);
        return true;
      }, false);
      respondIfHeadersOpen(req, res, 500, { error: 'Internal Server Error during validation' });
    }
  };
};

/**
 * Validate request query parameters against a Zod schema
 * @param schema - The Zod schema to validate against
 * @returns Express middleware
 */
export const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isZodSchemaLike(schema)) {
      safeRead(() => {
        logger.error('[ValidationMiddleware] Invalid schema: expected Zod schema with safeParse');
        return true;
      }, false);
      respondIfHeadersOpen(req, res, 500, { error: 'Internal Server Error during validation' });
      return;
    }
    try {
      const result = schema.safeParse(safeRead(() => req.query, undefined));
      if (!result.success) {
        const errors = readValidationErrors(result);
        const details = errors.slice(0, MAX_VALIDATION_DETAILS_ITEMS);

        const firstError = errors[0];
        const errorMessage = firstError ? firstError.message : 'Validation Error';

        respondIfHeadersOpen(req, res, 400, {
          error: errorMessage,
          details,
        });
        safeRead(() => {
          logger.info(
            `[ValidationMiddleware] Validation failed for ${readMethod(req)} ${readPath(req)} (query):`,
            safeJsonPreview(details, MAX_VALIDATION_LOG_PREVIEW_CHARS)
          );
          return true;
        }, false);
        return;
      }

      try {
        req.query = result.data as unknown as typeof req.query;
      } catch (e) {
        // Fallback for cases where req.query has only a getter (e.g. some test environments)
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
        });
      }
      next();
    } catch (error: unknown) {
      safeRead(() => {
        logger.error('Validation Middleware Error:', error);
        return true;
      }, false);
      respondIfHeadersOpen(req, res, 500, { error: 'Internal Server Error during validation' });
    }
  };
};

/**
 * Validate request path parameters against a Zod schema
 * @param schema - The Zod schema to validate against
 * @returns Express middleware
 */
export const validateParams = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isZodSchemaLike(schema)) {
      safeRead(() => {
        logger.error('[ValidationMiddleware] Invalid schema: expected Zod schema with safeParse');
        return true;
      }, false);
      respondIfHeadersOpen(req, res, 500, { error: 'Internal Server Error during validation' });
      return;
    }
    try {
      const result = schema.safeParse(safeRead(() => req.params, undefined));
      if (!result.success) {
        const errors = readValidationErrors(result);
        const details = errors.slice(0, MAX_VALIDATION_DETAILS_ITEMS);

        const firstError = errors[0];
        const errorMessage = firstError ? firstError.message : 'Validation Error';

        respondIfHeadersOpen(req, res, 400, {
          error: errorMessage,
          details,
        });
        safeRead(() => {
          logger.info(
            `[ValidationMiddleware] Validation failed for ${readMethod(req)} ${readPath(req)} (params):`,
            safeJsonPreview(details, MAX_VALIDATION_LOG_PREVIEW_CHARS)
          );
          return true;
        }, false);
        return;
      }

      try {
        req.params = result.data as unknown as typeof req.params;
      } catch (e) {
        // Fallback for cases where req.params has only a getter
        Object.defineProperty(req, 'params', {
          value: result.data,
          writable: true,
          configurable: true,
        });
      }
      next();
    } catch (error: unknown) {
      safeRead(() => {
        logger.error('Validation Middleware Error:', error);
        return true;
      }, false);
      respondIfHeadersOpen(req, res, 500, { error: 'Internal Server Error during validation' });
    }
  };
};
