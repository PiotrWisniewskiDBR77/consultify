import type { Request, Response } from 'express';

type RequestWithOrganizationContext = Request & {
  organizationId?: string | null;
  user?: {
    organizationId?: string | null;
    organization_id?: string | null;
  } | null;
};

export function resolveRequestOrganizationId(req: RequestWithOrganizationContext): string | null {
  const organizationId = String(
    req.organizationId || req.user?.organizationId || req.user?.organization_id || ''
  ).trim();

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
