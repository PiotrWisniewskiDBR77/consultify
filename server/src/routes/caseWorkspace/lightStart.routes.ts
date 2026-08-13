/**
 * Case Workspace HTTP routes — lightOneClickService
 * (server/src/services/caseWorkspace/lightOneClickService.ts).
 *
 * NOT YET MOUNTED — see this directory's `index.ts` (koordynator-owned, out
 * of this packet's allowlist). Mounting line for the coordinator:
 *
 *   import lightStartRoutes from './lightStart.routes.js';
 *   ...
 *   router.use(lightStartRoutes);   // any position before `intakeRoutes`,
 *                                   // per index.ts's own header: ordering
 *                                   // is not load-bearing among routers that
 *                                   // each own their full path.
 *
 * ONE route: POST /cases/:caseId/light-start — "Zatwierdź i rozpocznij" for
 * a LIGHT Case. Always responds 200: the service's own discriminated
 * `outcome` ('started' | 'already_started' | 'refused') is the caller-facing
 * decision, not an HTTP status — a `refused` result is a well-formed, typed
 * answer ("here is the exact reason a Run did not start"), never an error
 * the client must catch. Genuine failures (missing/inaccessible Case, wrong
 * profile, wrong Case status, actor identity problems) still throw and are
 * funneled through `caseWorkspaceHandler`/`toCaseWorkspaceAppError` exactly
 * like every other case-workspace route.
 *
 * `Idempotency-Key` is read and threaded into the correlation id only for
 * log/trace continuity with the rest of this directory's convention
 * (api.ts's own header: "wysyłamy go mimo to, żeby korelacja istniała w
 * logu") — it is NOT what makes this route safe to retry or double-click.
 * `lightOneClickService.ts`'s own header explains what does (a per-case
 * mutex plus a completion marker keyed on caseId alone), so this route
 * accepts the header but never threads it into the service as a dedup key.
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/lightOneClickService.js';
import { requireCaseAccessForActor } from './_shared/access.js';
import { caseWorkspaceHandler, readIdempotencyKeyHeader } from './_shared/handler.js';
import { parseParams } from './_shared/validate.js';

const router = Router();

const caseIdParams = z.object({ caseId: z.string().trim().min(1) });

router.post(
  '/cases/:caseId/light-start',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    await requireCaseAccessForActor(actor, params.caseId);

    // Log-only continuity (see header) — does not affect idempotency.
    const idempotencyKey = readIdempotencyKeyHeader(req);
    void idempotencyKey;

    const result = await svc.startLightOneClick({
      caseId: params.caseId,
      actorUserId: actor.actorUserId,
      correlationId: actor.correlationId,
    });

    res.status(200).json({ data: result });
  })
);

export default router;
