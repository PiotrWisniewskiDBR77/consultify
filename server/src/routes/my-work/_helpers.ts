import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getTableColumns } from '../../utils/dbSchema.js';

export const requireUser = (
  req: AuthRequest,
  res: Response
): { userId: string; orgId: string } | null => {
  let userId: unknown;
  try {
    userId = (req as any).userId;
  } catch {
    userId = undefined;
  }
  if (!userId) {
    try {
      userId = req.user?.id;
    } catch {
      userId = undefined;
    }
  }

  let orgId: unknown;
  try {
    orgId = (req as any).organizationId;
  } catch {
    orgId = undefined;
  }
  if (!orgId) {
    try {
      orgId = req.user?.organizationId;
    } catch {
      orgId = undefined;
    }
  }
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { userId: String(userId), orgId: String(orgId) };
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
