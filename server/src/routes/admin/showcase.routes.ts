/**
 * Showcase Admin Routes (SR-1 part 2 — Wpis 32 / Wpis 40).
 *
 * POST /api/admin/showcase/roll — SUPERADMIN-only manual trigger of the showcase
 * date-roll: the exact `rollShowcaseDates` the nightly job runs (Wpis 31), exposed
 * so an operator can roll the demo/showcase orgs on demand and read the run proof.
 *
 * Auth (Wpis 32: "SUPERADMIN, dodatkowo tylko konta serwisowe (DEC-579)"): DEC-579
 * service accounts are dedicated *platform* principals that hold the SUPERADMIN role
 * and authenticate with a standard JWT (see E2E1_SERVICE_ACCOUNTS_N1 RAPORT — the
 * per-org `tp_sa_` self-service tokens are NOT platform credentials and are rejected
 * here on purpose: any org OWNER could otherwise self-grant a platform-wide roll).
 * `verifySuperAdmin` re-verifies the JWT and re-reads the role from the database as
 * the source of truth, so it admits exactly SUPERADMIN principals (human or DEC-579
 * service account) and answers 403 for every other role — no separate token path.
 *
 * Flag gate (Wpis 32: "409 gdy flaga ENABLE_SHOWCASE_DATE_ROLL OFF"): the roll is a
 * no-op feature unless the deployment opted in, so an OFF flag answers 409 rather
 * than silently returning an empty result.
 *
 * Response (Wpis 32: "odpowiedź = ShowcaseRollResult[]"): the bare per-org array.
 */
import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../../middleware/superAdmin.middleware.js';
import {
  isShowcaseDateRollEnabled,
  parseShowcaseOrgIds,
} from '../../services/showcase/showcaseDateRollScheduler.js';
import { rollShowcaseDates } from '../../services/showcase/showcaseDateRollService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const router = Router();

/** Hard cap on a single manual roll request (defense against an unbounded body). */
const MAX_ORG_IDS_PER_REQUEST = 500;
/** Org IDs are opaque tenant keys; reject control/whitespace noise. */
const ORG_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

router.use(verifyToken);

/**
 * Normalize the optional `orgIds` body field.
 *  - undefined  → null (caller falls back to the configured SHOWCASE_ORG_IDS)
 *  - a valid array → de-duped, pattern-checked, capped list
 *  - any other shape → [] (caller answers 400)
 */
function normalizeOrgIds(raw: unknown): string[] | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const entry of raw.slice(0, MAX_ORG_IDS_PER_REQUEST)) {
    if (typeof entry !== 'string') return [];
    const id = entry.trim();
    if (!ORG_ID_PATTERN.test(id)) return [];
    seen.add(id);
  }
  return Array.from(seen);
}

router.post(
  '/roll',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res) => {
    // 409 BEFORE any work when the feature flag is off (Wpis 32). Auth (403) has
    // already run as route middleware, so role is checked before the flag.
    if (!isShowcaseDateRollEnabled(process.env)) {
      return res.status(409).json({
        success: false,
        code: 'SHOWCASE_ROLL_DISABLED',
        guidance: 'Set ENABLE_SHOWCASE_DATE_ROLL to a truthy value to allow manual rolls.',
      });
    }

    const body = (req.body ?? {}) as { orgIds?: unknown; dryRun?: unknown };
    const dryRun = body.dryRun === true;

    let orgIds: string[];
    if (body.orgIds === undefined) {
      // No explicit targets → the configured showcase list (same source the
      // nightly job uses).
      orgIds = parseShowcaseOrgIds(process.env.SHOWCASE_ORG_IDS);
    } else {
      const normalized = normalizeOrgIds(body.orgIds);
      if (normalized === null || normalized.length === 0) {
        return res.status(400).json({
          success: false,
          code: 'SHOWCASE_ORG_IDS_INVALID',
          guidance: 'orgIds must be a non-empty array of organization IDs.',
        });
      }
      orgIds = normalized;
    }

    if (orgIds.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'SHOWCASE_NO_ORGS',
        guidance: 'Pass orgIds in the body or configure SHOWCASE_ORG_IDS.',
      });
    }

    const actorId = String(req.user?.id || '');
    logger.info(
      `[ShowcaseRollRoute] manual roll by ${actorId || 'unknown'} for ${orgIds.length} org(s), dryRun=${dryRun}`
    );

    const results = await rollShowcaseDates({ today: new Date(), orgIds, dryRun });
    // Wpis 32: the response body IS the ShowcaseRollResult[] array.
    return res.json(results);
  })
);

export default router;
