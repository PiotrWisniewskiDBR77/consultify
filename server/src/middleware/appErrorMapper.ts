import { randomUUID } from 'node:crypto';

import type { Request } from 'express';

import { AppError } from '../utils/ErrorHandler.js';
import logger from '../utils/Logger.js';

export type AppErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'DB_ERROR'
  | 'INTERNAL';

export interface AppErrorResponse {
  error: string;
  errorCode: AppErrorCode | string;
  correlationId: string;
  debug?: string;
}

const MESSAGES: Record<'pl' | 'en', Record<AppErrorCode, string>> = {
  pl: {
    NOT_FOUND: 'Nie znaleziono zasobu.',
    VALIDATION: 'Nieprawidlowe dane wejsciowe.',
    UNAUTHORIZED: 'Wymagane jest zalogowanie.',
    FORBIDDEN: 'Brak uprawnien do tej operacji.',
    CONFLICT: 'Operacja jest w konflikcie z aktualnym stanem.',
    DB_ERROR: 'Nie udalo sie przetworzyc danych.',
    INTERNAL: 'Wystapil nieoczekiwany blad.',
  },
  en: {
    NOT_FOUND: 'Resource not found.',
    VALIDATION: 'The provided data is invalid.',
    UNAUTHORIZED: 'Authentication is required.',
    FORBIDDEN: 'You do not have permission to perform this operation.',
    CONFLICT: 'The operation conflicts with the current state.',
    DB_ERROR: 'The data could not be processed.',
    INTERNAL: 'An unexpected error occurred.',
  },
};

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = Number((error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { status?: unknown }).status);
  return Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : undefined;
}

function codeOf(error: unknown): string {
  return error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : '';
}

function classify(error: unknown): AppErrorCode {
  const status = statusOf(error);
  const code = codeOf(error).toUpperCase();
  if (status === 404 || code.includes('NOT_FOUND')) return 'NOT_FOUND';
  if (status === 401 || code.includes('UNAUTHORIZED')) return 'UNAUTHORIZED';
  if (status === 403 || code.includes('FORBIDDEN')) return 'FORBIDDEN';
  if (status === 409 || code.includes('CONFLICT') || code === '23505') return 'CONFLICT';
  if (status === 400 || status === 422 || /VALID|BAD_REQUEST|ZOD/.test(code)) return 'VALIDATION';
  if (/^(?:22|23|25|40|42|53|57|58|XX)/.test(code) || code.includes('DATABASE')) return 'DB_ERROR';
  return 'INTERNAL';
}

function rawMessage(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);
}

function correlationId(req: Request): string {
  const candidate = (req as Request & { correlationId?: unknown }).correlationId ?? req.get?.('X-Correlation-ID');
  return typeof candidate === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate)
    ? candidate
    : randomUUID();
}

export function mapAppErrorResponse(error: unknown, req: Request): AppErrorResponse {
  const id = correlationId(req);
  const raw = rawMessage(error);
  const mappedCode = classify(error);
  const language = /^pl(?:-|,|$)/i.test(req.get?.('Accept-Language') ?? '') ? 'pl' : 'en';
  const operational = error instanceof AppError && error.isOperational;
  const publicCode = operational && codeOf(error) ? codeOf(error) : mappedCode;
  const message = operational ? raw : MESSAGES[language][mappedCode];

  logger.error('[AppErrorMapper] route error', {
    correlationId: id,
    errorCode: publicCode,
    message: raw,
    stack: error instanceof Error ? error.stack : undefined,
    method: req.method,
    path: req.path,
  });

  return {
    error: message,
    errorCode: publicCode,
    correlationId: id,
    ...(process.env.NODE_ENV === 'development' ? { debug: raw } : {}),
  };
}
