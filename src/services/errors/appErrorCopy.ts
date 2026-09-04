export type AppErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'DB_ERROR'
  | 'INTERNAL';

export interface AppErrorEnvelope {
  errorCode?: unknown;
  correlationId?: unknown;
  error?: unknown;
  message?: unknown;
}

export interface AppErrorCopy {
  code: AppErrorCode;
  message: string;
  action: string;
  correlationId: string | null;
  correlationLabel: string | null;
}

type TFunc = (key: string, defaultValue?: string) => unknown;

const CODES = new Set<AppErrorCode>([
  'NOT_FOUND',
  'VALIDATION',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CONFLICT',
  'DB_ERROR',
  'INTERNAL',
]);

const SLUG: Record<AppErrorCode, string> = {
  NOT_FOUND: 'notFound',
  VALIDATION: 'validation',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  CONFLICT: 'conflict',
  DB_ERROR: 'dbError',
  INTERNAL: 'internal',
};

const FALLBACK_EN: Record<AppErrorCode, { message: string; action: string }> = {
  NOT_FOUND: {
    message: 'We could not find the requested item.',
    action: 'Check the address or return to the previous view.',
  },
  VALIDATION: {
    message: 'Some of the provided information needs attention.',
    action: 'Review the marked fields and try again.',
  },
  UNAUTHORIZED: {
    message: 'Your session does not allow this action.',
    action: 'Sign in again and retry.',
  },
  FORBIDDEN: {
    message: 'You do not have access to this action.',
    action: 'Ask an administrator for access if you need it.',
  },
  CONFLICT: {
    message: 'The item changed while you were working on it.',
    action: 'Refresh the view, review the latest version, and try again.',
  },
  DB_ERROR: {
    message: 'We could not process the data right now.',
    action: 'Try again in a moment.',
  },
  INTERNAL: {
    message: 'Something went wrong on our side.',
    action: 'Try again. If the problem continues, report it using the identifier below.',
  },
};

function unwrapEnvelope(source: unknown): AppErrorEnvelope {
  if (!source || typeof source !== 'object') return {};
  const root = source as Record<string, unknown>;
  const response = root.response as Record<string, unknown> | undefined;
  const responseData = response?.data;
  if (responseData && typeof responseData === 'object') return responseData as AppErrorEnvelope;
  const data = root.data;
  if (data && typeof data === 'object') return data as AppErrorEnvelope;
  return root;
}

export function readAppErrorCode(source: unknown): AppErrorCode {
  const raw = String(unwrapEnvelope(source).errorCode ?? '')
    .trim()
    .toUpperCase();
  return CODES.has(raw as AppErrorCode) ? (raw as AppErrorCode) : 'INTERNAL';
}

export function readCorrelationId(source: unknown): string | null {
  const value = String(unwrapEnvelope(source).correlationId ?? '').trim();
  return value || null;
}

export function getAppErrorCopy(t: TFunc, source: unknown): AppErrorCopy {
  const envelope = unwrapEnvelope(source);
  const code = readAppErrorCode(source);
  const slug = SLUG[code];
  const fallback = FALLBACK_EN[code];
  const correlationId = readCorrelationId(source);
  const label = String(t('errors.app.reportId', 'Report identifier'));
  const rawCode = String(envelope.errorCode ?? '')
    .trim()
    .toUpperCase();
  const serverMessage = String(envelope.message ?? envelope.error ?? '').trim();
  const message =
    !CODES.has(rawCode as AppErrorCode) && serverMessage
      ? serverMessage
      : String(t(`errors.app.${slug}.message`, fallback.message));

  return {
    code,
    message,
    action: String(t(`errors.app.${slug}.action`, fallback.action)),
    correlationId,
    correlationLabel: correlationId ? `${label}: ${correlationId}` : null,
  };
}

export function getAppErrorLine(t: TFunc, source: unknown): string {
  const copy = getAppErrorCopy(t, source);
  return [copy.message, copy.action, copy.correlationLabel].filter(Boolean).join(' ');
}
