import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';

export type RuntimeScope = {
  tenantId: string;
  userId: string;
  userRole: string | null;
};

export function runtimeMeta(contract: string) {
  return { version: 'v10' as const, contract };
}

export function scopeFromAuthRequest(req: AuthRequest): RuntimeScope {
  return {
    tenantId: String(req?.user?.organizationId || req?.organizationId || '').trim(),
    userId: String(req?.user?.id || req?.userId || '').trim(),
    userRole: req?.user?.role
      ? String(req.user.role).trim()
      : req?.userRole
        ? String(req.userRole).trim()
        : null,
  };
}

export function withRuntimeScope<T extends Record<string, unknown>>(req: AuthRequest): T & { scope: RuntimeScope } {
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
