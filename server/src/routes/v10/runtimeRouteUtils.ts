import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';

export type RuntimeScope = {
  tenantId: string;
  userId: string;
  userRole: string | null;
};

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

export function runtimeMeta(contract: string) {
  return { version: 'v10' as const, contract };
}

export function scopeFromAuthRequest(req: AuthRequest): RuntimeScope {
  const requestUser = safeRead(() => req?.user, undefined as AuthRequest['user']);
  const tenantId =
    normalizeOptionalString(safeRead(() => requestUser?.organizationId, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => req?.organizationId, undefined as unknown)) ||
    '';
  const userId =
    normalizeOptionalString(safeRead(() => requestUser?.id, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => req?.userId, undefined as unknown)) ||
    '';
  const userRole =
    normalizeOptionalString(safeRead(() => requestUser?.role, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => req?.userRole, undefined as unknown)) ||
    null;

  return {
    tenantId,
    userId,
    userRole,
  };
}

export function withRuntimeScope<T extends Record<string, unknown>>(
  req: AuthRequest
): T & { scope: RuntimeScope } {
  const body = req.body && typeof req.body === 'object' ? (req.body as T) : ({} as T);
  return {
    ...body,
    scope: scopeFromAuthRequest(req),
  };
}

export async function respondWithData(
  res: Response,
  contract: string,
  operation: () => unknown | Promise<unknown>,
  status = 200
): Promise<void> {
  const data = await operation();
  res.status(status).json({ data, meta: runtimeMeta(contract) });
}
