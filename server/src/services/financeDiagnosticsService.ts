import { randomUUID } from 'crypto';

import logger from '../utils/Logger.js';

type FinanceDiagnosticLevel = 'info' | 'warn' | 'error';

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function sanitizeValue(value: unknown, depth: number = 0): unknown {
  if (depth > 3) return '[MaxDepth]';
  if (value == null) return value;
  if (typeof value === 'string') return truncate(value.replace(/\s+/g, ' ').trim(), 240);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncate(value.message || String(value), 240),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 20);
    return Object.fromEntries(entries.map(([key, item]) => [key, sanitizeValue(item, depth + 1)]));
  }
  return String(value);
}

function emit(level: FinanceDiagnosticLevel, message: string, meta: Record<string, unknown>): void {
  if (level === 'error') {
    logger.error(message, meta);
    return;
  }
  if (level === 'warn') {
    logger.warn(message, meta);
    return;
  }
  logger.info(message, meta);
}

export function getFinanceTraceId(existingId?: unknown): string {
  const raw = typeof existingId === 'string' ? existingId.trim() : '';
  return raw || randomUUID();
}

export function summarizeTextPayload(text: string): Record<string, unknown> {
  const raw = String(text || '');
  const nullByteCount = (raw.match(/\0/g) || []).length;
  return {
    length: raw.length,
    nullByteCount,
    startsWithPdfHeader: raw.startsWith('%PDF-'),
    preview: truncate(raw.replace(/\s+/g, ' ').trim(), 160),
  };
}

export function logFinanceEvent(
  eventName: string,
  meta: Record<string, unknown> = {},
  level: FinanceDiagnosticLevel = 'info'
): void {
  emit(level, `[FinanceDiag] ${eventName}`, sanitizeValue(meta) as Record<string, unknown>);
}

export function logFinanceError(
  eventName: string,
  error: unknown,
  meta: Record<string, unknown> = {}
): void {
  emit(
    'error',
    `[FinanceDiag] ${eventName}`,
    sanitizeValue({
      ...meta,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { message: String(error) },
    }) as Record<string, unknown>
  );
}
