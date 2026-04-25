export interface NormalizedApiError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

const GENERIC_INTERNAL_ERROR = 'Something went wrong. Please try again.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const cleanMessage = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '[object Object]') return null;
  if (trimmed === 'INTERNAL_ERROR') return GENERIC_INTERNAL_ERROR;
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return null;
  return trimmed;
};

const formatValidationEntry = (value: unknown): string | null => {
  const direct = cleanMessage(value);
  if (direct) return direct;

  if (isRecord(value)) {
    return (
      cleanMessage(value.message) ||
      cleanMessage(value.error) ||
      cleanMessage(value.reason) ||
      cleanMessage(value.description)
    );
  }

  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim();
  return stringValue && stringValue !== '[object Object]' ? stringValue : null;
};

const flattenValidationDetails = (details: unknown): string | null => {
  if (Array.isArray(details)) {
    const messages = details
      .map(formatValidationEntry)
      .filter((entry): entry is string => Boolean(entry));
    return messages.length > 0 ? messages.join(', ') : null;
  }

  if (!isRecord(details)) return null;

  const fieldMessages = Object.entries(details).flatMap(([field, value]) => {
    if (Array.isArray(value)) {
      return value
        .map(formatValidationEntry)
        .filter((entry): entry is string => Boolean(entry))
        .map((entry) => `${field}: ${entry}`);
    }

    const formatted = formatValidationEntry(value);
    return formatted ? [`${field}: ${formatted}`] : [];
  });

  return fieldMessages.length > 0 ? fieldMessages.join(', ') : null;
};

export function normalizeApiError(input: unknown, fallback = 'Request failed'): NormalizedApiError {
  if (input instanceof Error) {
    const message = cleanMessage(input.message) || fallback;
    const maybeAny = input as any;
    return {
      message,
      code: typeof maybeAny.code === 'string' ? maybeAny.code : undefined,
      status: typeof maybeAny.status === 'number' ? maybeAny.status : undefined,
      details: maybeAny.data ?? maybeAny.details,
    };
  }

  if (typeof input === 'string') {
    return { message: cleanMessage(input) || fallback };
  }

  if (!isRecord(input)) {
    return { message: fallback };
  }

  const code =
    typeof input.code === 'string'
      ? input.code
      : typeof input.errorCode === 'string'
        ? input.errorCode
        : undefined;
  const status = typeof input.status === 'number' ? input.status : undefined;
  const details = input.details ?? input.errors ?? input.fieldErrors;
  const validationMessage = flattenValidationDetails(details);
  const directMessage =
    cleanMessage(input.message) ||
    cleanMessage(input.error) ||
    cleanMessage(input.title) ||
    validationMessage;

  if (directMessage) {
    return { message: directMessage, code, status, details };
  }

  if (isRecord(input.error)) {
    const nested = normalizeApiError(input.error, fallback);
    return {
      message: nested.message,
      code: nested.code || code,
      status: nested.status || status,
      details: nested.details || details,
    };
  }

  if (isRecord(input.message)) {
    const nested = normalizeApiError(input.message, fallback);
    return {
      message: nested.message,
      code: nested.code || code,
      status: nested.status || status,
      details: nested.details || details,
    };
  }

  if (code === 'INTERNAL_ERROR') {
    return { message: GENERIC_INTERNAL_ERROR, code, status, details };
  }

  return { message: fallback, code, status, details };
}

export function normalizeApiErrorMessage(input: unknown, fallback = 'Request failed'): string {
  return normalizeApiError(input, fallback).message;
}

export function createApiError(input: unknown, fallback = 'Request failed'): Error {
  const normalized = normalizeApiError(input, fallback);
  const error = new Error(normalized.message) as Error & {
    code?: string;
    status?: number;
    details?: unknown;
    data?: unknown;
  };
  error.code = normalized.code;
  error.status = normalized.status;
  error.details = normalized.details;
  error.data = input;
  return error;
}
