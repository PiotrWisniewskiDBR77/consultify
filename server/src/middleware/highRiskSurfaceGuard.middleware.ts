import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { ORG_TYPES } from '../services/access/AccessTypes.js';
import { get as dbGet } from '../utils/DbPromise.js';

type HighRiskCategory =
  | 'invite'
  | 'upload'
  | 'export'
  | 'public_share'
  | 'ai_memory'
  | 'autopilot';

type AccessScope = 'DEMO' | 'TRIAL_ENTRY' | 'TRIAL' | 'PAID' | 'UNKNOWN';

interface GuardOptions {
  categories?: HighRiskCategory[];
}

interface OrganizationRow {
  organization_type?: string | null;
}

interface UserRow {
  user_status?: string | null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MAX_PATH_CHARS = 8192;
const MAX_ID_CHARS = 256;

const FLAG_BY_CATEGORY: Record<HighRiskCategory, string> = {
  invite: 'TRIAL_INVITES_ENABLED',
  upload: 'TRIAL_UPLOAD_ENABLED',
  export: 'TRIAL_EXPORT_ENABLED',
  public_share: 'PUBLIC_SHARE_ENABLED',
  ai_memory: 'TRIAL_AI_MEMORY_ENABLED',
  autopilot: 'AI_AUTOPILOT_ENABLED',
};

const ERROR_CODE_BY_CATEGORY: Record<HighRiskCategory, string> = {
  invite: 'TRIAL_INVITES_DISABLED',
  upload: 'TRIAL_UPLOAD_DISABLED',
  export: 'TRIAL_EXPORT_DISABLED',
  public_share: 'PUBLIC_SHARE_DISABLED',
  ai_memory: 'TRIAL_AI_MEMORY_DISABLED',
  autopilot: 'AI_AUTOPILOT_DISABLED',
};

function normalizeId(value: unknown): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > MAX_ID_CHARS) return '';
  return normalized;
}

function normalizeMethod(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function normalizePath(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > MAX_PATH_CHARS) return '';
  const withoutQuery = raw.split('?')[0]?.split('#')[0] || '';
  const normalized = withoutQuery.replace(/\/{2,}/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function isFlagEnabled(flagName: string): boolean {
  return String(process.env[flagName] || '').trim().toLowerCase() === 'true';
}

function getRequestPath(req: Request): string {
  return (
    normalizePath((req as Request & { originalUrl?: string }).originalUrl) ||
    normalizePath(req.url) ||
    normalizePath(`${req.baseUrl || ''}${req.path || ''}`) ||
    normalizePath(req.path)
  );
}

function getUserId(req: Request): string {
  return normalizeId((req as any).user?.id || (req as any).userId);
}

function getOrganizationId(req: Request): string {
  return normalizeId(
    (req as any).organizationId ||
      (req as any).user?.organizationId ||
      (req as any).user?.organization_id
  );
}

function classifyRequest(req: Request): HighRiskCategory | null {
  const method = normalizeMethod(req.method);
  const path = getRequestPath(req).toLowerCase();
  const isWrite = WRITE_METHODS.has(method);
  const isSafe = SAFE_METHODS.has(method);

  if (!path) return null;

  if (isWrite && (/\/invite(?:\/|$)/.test(path) || path.includes('/invitations'))) {
    return 'invite';
  }

  if (
    isWrite &&
    (path.includes('/upload') ||
      path.includes('/import') ||
      path.includes('/ingestion') ||
      path.includes('/media-ingestion') ||
      path.includes('/report-import'))
  ) {
    return 'upload';
  }

  if (
    path.includes('/export') ||
    path.includes('/exports') ||
    path.includes('/download') ||
    path.includes('/data-export')
  ) {
    return 'export';
  }

  if (path.includes('/share-links') || (isWrite && /\/share(?:\/|$)/.test(path))) {
    return 'public_share';
  }

  if (!isSafe && (path.includes('/ai-memory') || path.includes('/ai/memory'))) {
    return 'ai_memory';
  }

  if (!isSafe && (path.includes('/ai-operator') || path.includes('/autopilot'))) {
    return 'autopilot';
  }

  return null;
}

async function resolveAccessScope(req: Request): Promise<AccessScope> {
  if ((req as any).demo?.enabled === true || (req as any).user?.isDemo === true) {
    return 'DEMO';
  }

  const userId = getUserId(req);
  if (userId) {
    const user = await dbGet<UserRow>(
      `SELECT user_status FROM users WHERE id = ? LIMIT 1`,
      [userId],
      { fallback: false }
    );
    if (String(user?.user_status || '').trim().toUpperCase() === 'TRIAL_ENTRY') {
      return 'TRIAL_ENTRY';
    }
  }

  const organizationId = getOrganizationId(req);
  if (!organizationId) return 'UNKNOWN';

  const org = await dbGet<OrganizationRow>(
    `SELECT organization_type FROM organizations WHERE id = ? LIMIT 1`,
    [organizationId],
    { fallback: false }
  );
  const orgType = String(org?.organization_type || '').trim().toUpperCase();
  if (orgType === ORG_TYPES.PAID) return 'PAID';
  if (orgType === ORG_TYPES.DEMO) return 'DEMO';
  if (orgType === ORG_TYPES.TRIAL) return 'TRIAL';
  return 'UNKNOWN';
}

function shouldBlock(category: HighRiskCategory, scope: AccessScope): boolean {
  if (scope === 'PAID') return false;
  if (scope === 'DEMO' || scope === 'TRIAL_ENTRY' || scope === 'UNKNOWN') return true;
  return !isFlagEnabled(FLAG_BY_CATEGORY[category]);
}

function blockedResponse(category: HighRiskCategory, scope: AccessScope): Record<string, unknown> {
  const isCreateOrgCta = scope === 'TRIAL_ENTRY' || scope === 'UNKNOWN';
  return {
    error: ERROR_CODE_BY_CATEGORY[category],
    code: ERROR_CODE_BY_CATEGORY[category],
    message:
      scope === 'DEMO'
        ? 'Ta funkcja jest wyłączona w trybie demo.'
        : 'Ta funkcja jest czasowo wyłączona dla triala.',
    messageEn:
      scope === 'DEMO'
        ? 'This feature is disabled in demo mode.'
        : 'This feature is temporarily disabled for trial.',
    cta: isCreateOrgCta
      ? { label: 'Załóż organizację', path: '/trial/create-org' }
      : { label: 'Skontaktuj się z zespołem', path: '/contact' },
  };
}

export function highRiskSurfaceGuard(options: GuardOptions = {}): RequestHandler {
  const allowedCategories = new Set(options.categories || Object.keys(FLAG_BY_CATEGORY));

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = classifyRequest(req);
      if (!category || !allowedCategories.has(category)) {
        next();
        return;
      }

      const scope = await resolveAccessScope(req);
      if (!shouldBlock(category, scope)) {
        next();
        return;
      }

      res.status(403).json(blockedResponse(category, scope));
    } catch (error) {
      next(error);
    }
  };
}
