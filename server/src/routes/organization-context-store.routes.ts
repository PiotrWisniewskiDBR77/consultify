/**
 * W11 — per-org context store (Goals / Challenges / Strategy).
 * Replaces the localStorage-backed useContextBuilderStore on the frontend.
 * Profile reads retain the legacy column for compatibility, but this route
 * never writes it. /api/organization-profiles/:orgId is the sole profile writer.
 *
 * GET  /api/organization-context-store   → returns stored blob (200) or empty defaults (200)
 * PUT  /api/organization-context-store   → upserts the blob (200)
 */
import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import Logger from '../utils/Logger.js';

const router = Router();
router.use(verifyToken);

const EMPTY_CONTEXT = {
  goals: {},
  challenges: {},
  synthesis: {},
  companyProfile: {},
};

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const rows = await dbAll<{
      goals_json: string;
      challenges_json: string;
      synthesis_json: string;
      company_profile_json: string;
    }>(
      'SELECT goals_json, challenges_json, synthesis_json, company_profile_json FROM organization_context_store WHERE organization_id = $1',
      [orgId],
      { fallback: true }
    );

    if (!rows.length) {
      res.json(EMPTY_CONTEXT);
      return;
    }

    const row = rows[0];
    res.json({
      goals: parseJsonField(row.goals_json),
      challenges: parseJsonField(row.challenges_json),
      synthesis: parseJsonField(row.synthesis_json),
      companyProfile: parseJsonField(row.company_profile_json),
    });
  } catch (err: any) {
    Logger.error('[org-context-store] GET failed', { orgId, err: err?.message });
    res.status(500).json({ error: 'Failed to load org context' });
  }
});

router.put('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const orgId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { goals, challenges, synthesis } = req.body ?? {};

  try {
    await dbRun(
      `INSERT INTO organization_context_store
           (organization_id, goals_json, challenges_json, synthesis_json, company_profile_json, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, '{}', CURRENT_TIMESTAMP, $5)
         ON CONFLICT (organization_id) DO UPDATE SET
           goals_json           = EXCLUDED.goals_json,
           challenges_json      = EXCLUDED.challenges_json,
           synthesis_json       = EXCLUDED.synthesis_json,
           updated_at           = EXCLUDED.updated_at,
           updated_by           = EXCLUDED.updated_by`,
      [
        orgId,
        JSON.stringify(goals ?? {}),
        JSON.stringify(challenges ?? {}),
        JSON.stringify(synthesis ?? {}),
        userId ?? null,
      ],
      { fallback: true }
    );

    res.json({ ok: true });
  } catch (err: any) {
    Logger.error('[org-context-store] PUT failed', { orgId, err: err?.message });
    res.status(500).json({ error: 'Failed to save org context' });
  }
});

function parseJsonField(raw: string | object | null): unknown {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default router;
