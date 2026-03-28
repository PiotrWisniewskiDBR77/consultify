/**
 * Table Platform error handling utilities.
 * Provides consistent error types and response formatting.
 */
import logger from '../../utils/Logger.js';

export class TablePlatformError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, statusCode = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = 'TablePlatformError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotFoundError extends TablePlatformError {
  constructor(entityType: string, entityId: string) {
    super(`${entityType} not found: ${entityId}`, 'NOT_FOUND', 404, { entityType, entityId });
  }
}

export class ValidationError extends TablePlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class PermissionError extends TablePlatformError {
  constructor(message = 'Permission denied') {
    super(message, 'PERMISSION_DENIED', 403);
  }
}

export class ConflictError extends TablePlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
  }
}

export class RateLimitError extends TablePlatformError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT', 429);
  }
}

/**
 * Express error handler for table platform routes.
 * Converts TablePlatformError instances to proper HTTP responses.
 */
export function handleRouteError(
  e: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } },
  context: string
): void {
  if (e instanceof TablePlatformError) {
    logger.warn(`[TablePlatform] ${context}`, {
      code: e.code,
      message: e.message,
      details: e.details,
    });
    res.status(e.statusCode).json({
      error: e.message,
      code: e.code,
      details: e.details,
    });
    return;
  }

  const err = e instanceof Error ? e : new Error(String(e));
  logger.error(`[TablePlatform] ${context} unexpected error`, {
    error: err.message,
    stack: err.stack,
  });
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}

/**
 * Validate UUID format.
 */
export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Validate required string parameter.
 */
export function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${name} is required and must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Validate required UUID parameter.
 */
export function requireUUID(value: unknown, name: string): string {
  const str = requireString(value, name);
  if (!isValidUUID(str)) {
    throw new ValidationError(`${name} must be a valid UUID`, { value: str });
  }
  return str;
}

export default {
  TablePlatformError,
  NotFoundError,
  ValidationError,
  PermissionError,
  ConflictError,
  RateLimitError,
  handleRouteError,
  isValidUUID,
  requireString,
  requireUUID,
};
