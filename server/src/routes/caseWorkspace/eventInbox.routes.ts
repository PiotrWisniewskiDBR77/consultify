/**
 * Case Workspace HTTP routes — AUTHENTICATED EXTERNAL EVENT INGRESS (CW-T-B).
 *
 * POST /:source/deliveries
 *
 * Backs `eventInboxService.receiveExternalEvent` (server/src/services/
 * caseWorkspace/eventInboxService.ts), whose four-gate trust boundary this
 * route is the ONLY production entry point into. Before this file existed,
 * `receiveExternalEvent` had zero production callers and there was no HTTP
 * path an external system (DocuSign, an approval webhook, any
 * EXTERNAL_CALLBACK sender) could use to satisfy a Wait — see that file's own
 * header comment ("THE TRUST BOUNDARY, IN ORDER").
 *
 * ===========================================================================
 * WHY THIS FILE IS NOT MOUNTED THROUGH caseWorkspace/index.ts
 * ===========================================================================
 * Every other router in this directory is composed into caseWorkspace/
 * index.ts, which is mounted under `v8Router` AFTER `v8Router.use
 * (attachV8Context)` (server/src/routes/v8/index.ts:83/100). attachV8Context
 * DENIES with 403 (V8_MISSING_ORG_CONTEXT / V8_MISSING_USER_CONTEXT) any
 * request that does not already carry an authenticated first-party JWT
 * (server/src/middleware/v8Auth.middleware.ts:153-187). An external event
 * sender has no such JWT — it authenticates with the HMAC signature this
 * route verifies via the service, which is a DIFFERENT trust mechanism than
 * "is this one of our logged-in users". Mounting this router under
 * caseWorkspace/index.ts would therefore reproduce the exact bug this packet
 * fixes: a 403 before the handler ever runs, for every legitimate external
 * caller. The precedent for a public, HMAC-authenticated, JWT-free webhook
 * already exists in this codebase at
 * server/src/routes/webhooks/v8-sync-inbound.routes.ts ("mounted outside the
 * V8 auth middleware chain so that external providers … can deliver events
 * without a JWT") and at server/src/routes/webhooks/sellix.routes.ts. This
 * file follows that precedent, not the caseWorkspace/index.ts one.
 *
 * See this packet's report for the EXACT mount line the session coordinator
 * needs to add (in Gateway.ts, alongside sellixInboundWebhookRoutes /
 * v8SyncInboundWebhookRoutes — NOT in caseWorkspace/index.ts).
 *
 * ===========================================================================
 * REQUEST CONTRACT
 * ===========================================================================
 * POST /:source/deliveries
 * {
 *   "eventId": "vendor-event-123",           // sender's id; dedup key half
 *   "eventType": "vendor.signature.completed",
 *   "organizationId": "org-...",             // tenant the sender CLAIMS
 *   "projectId": "proj-...",                 // optional
 *   "correlationKey": "corrkey-...",          // echoes case_workspace_waits
 *   "caseId": "case-...",                    // optional, disambiguates
 *   "runId": "run-...",                      // optional
 *   "nodeRunId": "cwnode-...",                // optional
 *   "payload": {
 *     "deliveredAt": "2026-08-10T12:00:00.000Z",  // REQUIRED — see below
 *     ... sender-defined fields ...
 *   },
 *   "signature": "<hex hmac-sha256>"          // eventInboxService.
 *                                              // computeInboxSignature(secret,
 *                                              // payload) — over `payload`
 *                                              // ONLY, canonical-JSON, as the
 *                                              // service itself verifies.
 * }
 *
 * `:source` in the path IS the allowlist: it must name a channel a prior
 * `registerInboxChannel()` call (bootstrapped below, from
 * CASE_WORKSPACE_INBOX_CHANNELS_JSON) put in the service's in-memory
 * registry. Anything else is CHANNEL_UNKNOWN — unauthenticated, no DB row,
 * exactly like an unrecognized signature (see eventInboxService.ts's own
 * "step 1 is the single exception" reasoning).
 *
 * `payload.deliveredAt` IS THE TIMESTAMP-TOLERANCE + REPLAY MECHANISM. It is
 * required by every channel this file bootstraps (via
 * `isDeliveredAtWithinTolerance` wired into `validatePayload`) precisely
 * because it lives INSIDE `payload` and is therefore covered by the same HMAC
 * as the rest of the body: a party without the channel secret cannot move it
 * forward, and a genuinely captured (payload, signature) pair becomes
 * unusable outside the tolerance window even under a different `eventId` (see
 * eventInboxService.ts's own comment on this — dedup alone only stops a
 * literal eventId replay, not an eventId SWAP of a captured payload).
 * `computeInboxSignature`'s signed scope was NOT widened to also cover
 * `eventId`/`source`/`correlationKey` — that function's 2-argument shape is a
 * frozen contract other test suites outside this packet's allowlist already
 * depend on (see eventInboxService.ts's own note at
 * `isDeliveredAtWithinTolerance`). This is a KNOWN, DOCUMENTED residual: an
 * attacker who captures one (payload, signature) pair in flight could, within
 * the tolerance window, mint additional distinct inbox rows under new
 * eventIds. Bounded damage even so — every one of them targets the SAME
 * correlationKey, and only the FIRST to arrive can move the wait out of
 * ACTIVE; every later one is durably rejected as WAIT_NOT_ACTIVE. Closing it
 * fully needs the signed envelope to widen, which is a breaking change to
 * `computeInboxSignature`'s contract and is out of this packet's allowlist —
 * flagged, not silently left unmentioned.
 *
 * ===========================================================================
 * RESPONSE CONTRACT — ZERO 500s FOR ANY KNOWN OUTCOME
 * ===========================================================================
 *   200 { received: true, outcome: 'applied',   inboxRecordId, waitId }
 *   200 { received: true, outcome: 'duplicate', inboxRecordId, firstReceivedAt }
 *       (200, not 409: a webhook sender's retry loop must see success on a
 *       redelivery or it will retry forever — this IS "duplicate delivery
 *       produces one effect" made visible over HTTP.)
 *   401 { error: { code: 'UNAUTHENTICATED' } }
 *       (SIGNATURE_INVALID and CHANNEL_UNKNOWN collapse to the SAME body —
 *       distinguishing them over HTTP would let a prober tell "wrong secret"
 *       from "channel does not exist", an information leak this route must
 *       not have. The real code is still warn-logged server-side by the
 *       service and is exactly what an unauthenticated caller does NOT get: a
 *       durable, readable row.)
 *   422 { error: { code: <InboxRejectionCode> } }
 *       (TENANT_MISMATCH / CORRELATION_UNKNOWN / CORRELATION_AMBIGUOUS /
 *       PAYLOAD_INVALID / WAIT_NOT_ACTIVE / WAIT_TYPE_MISMATCH — every one of
 *       these DID get a durable REJECTED row; the code is what an operator
 *       reconciling a failed integration needs, and none of them reveal
 *       anything the sender did not already claim in its own request.)
 *   400 { error: { code: 'VALIDATION_ERROR', ... } }  — malformed request shape.
 *   413 { error: { code: <inbox_redacted_payload_too_large-derived> } }
 *       — oversized payload (service-enforced ceiling).
 *   500 — reserved for genuine infrastructure failure only (DB unreachable
 *       mid-transaction, etc.), never for a rejection this service knows how
 *       to name.
 */

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import logger from '../../utils/Logger.js';
import { AppError } from '../../utils/ErrorHandler.js';
import * as eventInboxService from '../../services/caseWorkspace/eventInboxService.js';
import { classifyDomainCode } from './_shared/errors.js';
import { parseBody, parseParams } from './_shared/validate.js';

const router = Router();

// ---------------------------------------------------------------------------
// Channel bootstrap — the allowlist of sources/channels this ingress accepts.
// ---------------------------------------------------------------------------
//
// DELIBERATELY env-driven, not hardcoded and not a DB table: same reasoning
// as eventInboxService.ts's own `channels` registry comment — a channel
// secret is a live credential. Format (CASE_WORKSPACE_INBOX_CHANNELS_JSON):
//
//   [{"source":"docusign-webhook","secret":"...","principal":"docusign",
//     "allowedEventTypes":["vendor.signature.completed"],
//     "allowedWaitTypes":["EXTERNAL_CALLBACK"]}]
//
// Unset/unparsable -> zero channels registered -> every delivery is
// CHANNEL_UNKNOWN (fails closed, never fails open). Tests do NOT rely on this
// env bootstrap; they call eventInboxService.registerInboxChannel /
// clearInboxChannels directly, the same way eventInboxService.pg.test.ts
// already does, and this module's own bootstrap runs at most once at import
// time against whatever CASE_WORKSPACE_INBOX_CHANNELS_JSON happens to be in
// that process's env (typically unset in tests).
interface EnvChannelConfig {
  source: string;
  secret: string;
  principal?: string;
  allowedEventTypes?: string[];
  allowedWaitTypes?: string[];
}

function loadChannelConfigsFromEnv(): EnvChannelConfig[] {
  const raw = process.env.CASE_WORKSPACE_INBOX_CHANNELS_JSON;
  if (!raw || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    logger.error(
      `[eventInboxRoutes] CASE_WORKSPACE_INBOX_CHANNELS_JSON is not valid JSON — zero channels registered (fail closed): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return [];
  }
  if (!Array.isArray(parsed)) {
    logger.error('[eventInboxRoutes] CASE_WORKSPACE_INBOX_CHANNELS_JSON must be a JSON array — zero channels registered.');
    return [];
  }
  return parsed.filter((entry): entry is EnvChannelConfig => {
    return (
      !!entry &&
      typeof entry === 'object' &&
      typeof (entry as EnvChannelConfig).source === 'string' &&
      (entry as EnvChannelConfig).source.trim().length > 0 &&
      typeof (entry as EnvChannelConfig).secret === 'string' &&
      (entry as EnvChannelConfig).secret.trim().length > 0
    );
  });
}

/**
 * Idempotent: safe to call more than once (a later call simply overwrites the
 * same `source` key in the service's Map — see registerInboxChannel).
 * Exported for the coordinator's mount site to call explicitly if it prefers
 * an on-demand bootstrap over import-time side effects; import already
 * triggers it once below.
 */
export function bootstrapChannelsFromEnv(): number {
  const configs = loadChannelConfigsFromEnv();
  for (const cfg of configs) {
    eventInboxService.registerInboxChannel({
      source: cfg.source,
      secret: cfg.secret,
      principal: cfg.principal ?? `webhook:${cfg.source}`,
      allowedEventTypes: cfg.allowedEventTypes,
      allowedWaitTypes: cfg.allowedWaitTypes,
      // Every env-bootstrapped channel gets the timestamp-tolerance gate.
      // Direct registerInboxChannel() callers (tests, or a future channel
      // with its own bespoke validator) can opt out by registering their own
      // validatePayload instead — this bootstrap path is not the only way to
      // register a channel, just the production one.
      validatePayload: (payload) =>
        eventInboxService.isDeliveredAtWithinTolerance((payload as Record<string, unknown>).deliveredAt),
    });
  }
  if (configs.length > 0) {
    logger.info(`[eventInboxRoutes] bootstrapped ${configs.length} inbound event channel(s) from env.`);
  }
  return configs.length;
}

bootstrapChannelsFromEnv();

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const paramsSchema = z.object({ source: z.string().trim().min(1).max(200) });

const bodySchema = z.object({
  eventId: z.string().trim().min(1).max(500),
  eventType: z.string().trim().min(1).max(200),
  organizationId: z.string().trim().min(1).max(256),
  projectId: z.string().trim().min(1).nullable().optional(),
  correlationKey: z.string().trim().min(1).max(500),
  caseId: z.string().trim().min(1).nullable().optional(),
  runId: z.string().trim().min(1).nullable().optional(),
  nodeRunId: z.string().trim().min(1).nullable().optional(),
  // Intentionally `z.record(z.unknown())` rather than a fixed shape: `payload`
  // is sender-defined domain content. The ONE thing this route requires of
  // it — `deliveredAt` — is enforced by the channel's validatePayload inside
  // the service (gate 3, PAYLOAD_INVALID, DURABLY recorded), not here, so a
  // malformed/missing deliveredAt gets the correct rejection CODE instead of
  // a generic 400 that would look like a transport error to the sender.
  payload: z.record(z.string(), z.unknown()),
  signature: z.string().trim().min(1).max(500),
});

// ---------------------------------------------------------------------------
// Outcome -> HTTP mapping. See this file's header comment for the contract.
// ---------------------------------------------------------------------------

function respondForResult(res: Response, result: eventInboxService.ReceiveExternalEventResult): void {
  switch (result.outcome) {
    case 'applied':
      res.status(200).json({
        received: true,
        outcome: 'applied',
        inboxRecordId: result.inboxRecordId,
        waitId: result.waitId,
      });
      return;
    case 'duplicate':
      res.status(200).json({
        received: true,
        outcome: 'duplicate',
        inboxRecordId: result.inboxRecordId,
        firstReceivedAt: result.firstReceivedAt,
      });
      return;
    case 'rejected':
      res.status(422).json({
        received: true,
        outcome: 'rejected',
        inboxRecordId: result.inboxRecordId,
        error: { code: result.rejectionCode },
      });
      return;
    case 'unauthenticated':
      // Same generic body for SIGNATURE_INVALID and CHANNEL_UNKNOWN — see
      // this file's header comment on why the two must not be
      // distinguishable to the caller.
      res.status(401).json({ received: false, error: { code: 'UNAUTHENTICATED' } });
      return;
    default: {
      const exhaustiveCheck: never = result;
      throw new Error(`eventInboxRoutes: unhandled receiveExternalEvent outcome: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

/**
 * Every throw from the service that reaches here is a `snake_case` reason
 * string (`inbox_*_required`, `inbox_redacted_payload_too_large`, …) — never
 * a raw stack trace or SQL text. `classifyDomainCode` (this directory's own
 * shared funnel, read-only imported here — NOT the actor-requiring
 * `caseWorkspaceHandler`) maps it to a stable non-500 status the same way
 * every other case-workspace route already does. Anything that does NOT
 * match that shape is a genuine unexpected failure and is the only path that
 * reaches 500.
 */
function respondForThrown(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof Error && /^[a-z][a-z0-9_]*(:.*)?$/.test(err.message)) {
    const { status, code } = classifyDomainCode(err.message);
    res.status(status).json({ error: { code: code.toUpperCase() } });
    return;
  }
  logger.error(`[eventInboxRoutes] unexpected failure: ${err instanceof Error ? err.stack : String(err)}`);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
}

// ---------------------------------------------------------------------------
// POST /:source/deliveries
// ---------------------------------------------------------------------------

router.post('/:source/deliveries', (req: Request, res: Response, _next: NextFunction): void => {
  Promise.resolve()
    .then(async () => {
      const params = parseParams(paramsSchema, req.params);
      const body = parseBody(bodySchema, req.body);

      const result = await eventInboxService.receiveExternalEvent({
        eventId: body.eventId,
        source: params.source,
        eventType: body.eventType,
        organizationId: body.organizationId,
        projectId: body.projectId ?? null,
        correlationKey: body.correlationKey,
        caseId: body.caseId ?? null,
        runId: body.runId ?? null,
        nodeRunId: body.nodeRunId ?? null,
        payload: body.payload,
        signature: body.signature,
      });

      respondForResult(res, result);
    })
    .catch((err) => respondForThrown(res, err));
});

export default router;
