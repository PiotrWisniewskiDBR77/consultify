import type { Request, Response } from 'express';

type RequestWithOrganizationContext = Request & {
  organizationId?: string | null;
  session?: {
    user?: {
      organizationId?: string | null;
      organization_id?: string | null;
    } | null;
  } | null;
  user?: {
    organizationId?: string | null;
    organization_id?: string | null;
  } | null;
};

export const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

export const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

export function resolveRequestOrganizationId(req: RequestWithOrganizationContext): string | null {
  const requestUser =
    safeRead(() => req.user, undefined as RequestWithOrganizationContext['user']) ||
    safeRead(() => req.session?.user, undefined as RequestWithOrganizationContext['user']);
  const organizationId =
    normalizeOptionalString(safeRead(() => req.organizationId, null)) ||
    normalizeOptionalString(safeRead(() => requestUser?.organizationId, null)) ||
    normalizeOptionalString(safeRead(() => requestUser?.organization_id, null));

  return organizationId || null;
}

export function requireRequestOrganizationId(
  req: RequestWithOrganizationContext,
  res: Response
): string | null {
  const organizationId = resolveRequestOrganizationId(req);
  if (organizationId) {
    return organizationId;
  }

  res.status(401).json({ error: 'Unauthorized - no organization' });
  return null;
}
