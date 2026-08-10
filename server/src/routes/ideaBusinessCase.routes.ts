/**
 * Idea Business Case routes — Program D / epic E08.
 *
 * GET /api/idea-business-case/:ideaId  → IdeaBusinessCaseRow | null
 * PUT /api/idea-business-case/:ideaId  → upsert (shallow per-section merge)
 *
 * Org-scoped: `:ideaId` must exist in `my_ideas` under the caller's
 * organization (same existence check `GET /my-ideas/:id/map` uses in
 * my-work.routes.ts) — a caller cannot attach a business case to an idea it
 * cannot already see, and cannot silently create one against a foreign-org
 * idea id. `idea_business_cases` itself is then org-scoped the same way
 * `artifact_evidence` is (RES-011 pattern): a case already existing under a
 * different organization for this idea id is rejected, not overwritten.
 *
 * Table `idea_business_cases` comes from
 * `server/migrations/20260810_idea_business_case.sql`, which is ★ NOT
 * applied to any database by this change — `requireTables` below returns a
 * clean 503 until that migration is actually run, never a crash.
 */
import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { requireTables, requireUser } from './my-work/_helpers.js';
import ideaBusinessCaseService, {
  IdeaBusinessCaseForeignOrgError,
} from '../services/ideaBusinessCaseService.js';
import { getDatabase } from '../database/Database.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(verifyToken);

// Loose on purpose: section content shapes are large and owned by the client
// type (`src/types/ideaBusinessCase.ts`); the server's job is persistence,
// not re-validating fourteen nested schemas. Each entry must at least be a
// plain object with a `content` key, matching `UpsertIdeaBusinessCaseBody`.
const SectionPatchSchema = z.record(
  z.string(),
  z.object({
    content: z.unknown(),
    lineage: z.array(z.record(z.string(), z.unknown())).optional(),
    claims: z.array(z.record(z.string(), z.unknown())).optional(),
  })
);

const UpsertBodySchema = z.object({
  sections: SectionPatchSchema,
});

async function assertIdeaInOrg(ideaId: string, organizationId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.query<{ id: string }>(
    `SELECT id FROM my_ideas WHERE id = ? AND organization_id = ? LIMIT 1`,
    [ideaId, organizationId]
  );
  return Boolean(result.rows?.[0]);
}

/**
 * GET /api/idea-business-case/:ideaId
 * Returns `{ businessCase: null }` when the idea has no case yet — a valid,
 * common state (this feature ships behind a default-OFF flag; most ideas
 * will have none), never a 404.
 */
router.get(
  '/:ideaId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;
    const ideaId = String(req.params.ideaId || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Missing ideaId' });

    if (!(await requireTables(res, ['my_ideas', 'idea_business_cases']))) return;

    if (!(await assertIdeaInOrg(ideaId, orgId))) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    const businessCase = await ideaBusinessCaseService.getBusinessCase(ideaId, orgId);
    res.json({ businessCase });
  })
);

/**
 * PUT /api/idea-business-case/:ideaId
 * Shallow per-section upsert — body's `sections` keys REPLACE the matching
 * section in storage, keys omitted from the body are left untouched (see
 * ideaBusinessCaseService.upsertBusinessCase).
 */
router.put(
  '/:ideaId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId, userId } = identity;
    const ideaId = String(req.params.ideaId || '').trim();
    if (!ideaId) return res.status(400).json({ error: 'Missing ideaId' });

    if (!(await requireTables(res, ['my_ideas', 'idea_business_cases']))) return;

    if (!(await assertIdeaInOrg(ideaId, orgId))) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    const bodyResult = UpsertBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res
        .status(400)
        .json({ error: 'Invalid business case body', details: bodyResult.error.flatten() });
      return;
    }

    let businessCase;
    try {
      businessCase = await ideaBusinessCaseService.upsertBusinessCase({
        ideaId,
        organizationId: orgId,
        sections: bodyResult.data.sections,
        updatedBy: userId ?? null,
      });
    } catch (error) {
      if (error instanceof IdeaBusinessCaseForeignOrgError) {
        res.status(404).json({ error: 'Idea not found' });
        return;
      }
      throw error;
    }
    res.json({ businessCase });
  })
);

export default router;
