import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getTableColumns } from '../../utils/dbSchema.js';

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

export const requireUser = (
  req: AuthRequest,
  res: Response
): { userId: string; orgId: string } | null => {
  const userId =
    normalizeOptionalString(safeRead(() => (req as any).userId, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => req.user?.id, undefined as unknown));
  const orgId =
    normalizeOptionalString(safeRead(() => (req as any).organizationId, undefined as unknown)) ||
    normalizeOptionalString(safeRead(() => req.user?.organizationId, undefined as unknown)) ||
    normalizeOptionalString(
      safeRead(() => (req.user as { organization_id?: string } | undefined)?.organization_id, undefined)
    );
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { userId, orgId };
};

export const requireTables = async (res: Response, tables: string[]): Promise<boolean> => {
  const isTestGateway =
    process.env.NODE_ENV === 'test' ||
    process.env.E2E_MODE === 'true' ||
    process.env.ENABLE_TEST_GATEWAY === 'true';
  const mockDbEnabled =
    process.env.MOCK_DB === 'true' ||
    (process.env.NODE_ENV === 'test' &&
      process.env.RUN_DB_TESTS !== '1' &&
      process.env.MOCK_DB !== 'false');

  if (isTestGateway && mockDbEnabled) {
    return true;
  }

  for (const t of tables) {
    const cols = await getTableColumns(t);
    if (!cols || cols.size === 0) {
      res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
      return false;
    }
  }
  return true;
};
