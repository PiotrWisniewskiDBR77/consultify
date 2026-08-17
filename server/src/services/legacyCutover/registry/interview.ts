/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — INTERVIEW domain, ENTERPRISE surface only.
 *
 * The inventory (`docs/program/evidence/closure/codex/CLAUDE-NEXT-LEGACY-CUTOVER/
 * inventory/INTERVIEW.json`) documents four surfaces sharing the `interview`
 * name: LEGACY (`/api/interview`), ENTERPRISE (`/api/interview-v4`), CANONICAL
 * (`/api/v8/interview`), and one PUBLIC unauthenticated GET. This config
 * covers ONLY the ENTERPRISE mount —
 * `server/src/routes/interview-enterprise.routes.ts`, mounted unconditionally
 * at `/api/interview-v4` (`server/src/Gateway.ts:1326`) — because that is the
 * mount the guard for this config is meant to sit in front of. The LEGACY
 * surface's writers (`/api/interview`) are NOT registered here; see the
 * REPORT (not a config) for INTERVIEW-L* / split-brain findings that need a
 * mount this task does not test.
 *
 * THE HEADLINE FINDING (INTERVIEW-E01): `GET /public/distributions/:token` is
 * registered at `interview-enterprise.routes.ts:23-45`, BEFORE
 * `router.use(verifyToken)` at line 47 — confirmed by reading the file
 * directly, not assumed from the inventory. Its handler,
 * `resolveActiveDistributionByToken` (`interviewEnterpriseService.ts:319-353`),
 * runs `UPDATE interview_distributions SET status=..., opened_at=... WHERE
 * public_token = ? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
 * AND status NOT IN ('expired','revoked')` (lines 324-334) — and, on the
 * expired branch, a second `UPDATE ... SET status='expired' WHERE
 * public_token=? AND ...` (lines 347-351). NEITHER statement carries an
 * `organization_id` predicate anywhere. It is a GET by HTTP method, so the
 * kernel's `READ_METHODS`-based classifier records it as `legacy_read`, not
 * `legacy_uncovered_writer` — that mislabel is a real, load-bearing
 * limitation of method-based classification, not a bug in this config; the
 * `reason` below states plainly that this is an unauthenticated,
 * tenant-unscoped MUTATION reachable by GET. Because the route sits before
 * `verifyToken`, and the guard is mounted in front of the ENTIRE router (so
 * it also covers this pre-auth route), `resolveTenant()` finds nothing on
 * `req` and records `tenant_resolution: 'unresolved'` — this is not a defect
 * to paper over; the test for this writer asserts `unresolved` exactly, and
 * must never pretend a tenant was resolved.
 *
 * Every other writer here (E02-E13) sits AFTER `router.use(verifyToken)`
 * (line 47) and is a genuine, tenant-scoped write with no proven canonical
 * successor (`canonicalSuccessor: null` for all of them per the inventory,
 * re-verified against `interviewEnterpriseService.ts` below) — registered
 * `observed`, matching the lane rule that no writer is retired without a
 * telemetry window this config exists to start.
 */

import type { LegacyCutoverDomainConfig } from '../legacyCutoverKernel.js';

export const INTERVIEW_ENTERPRISE_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'interview',
  rollbackEnv: 'INTERVIEW_LEGACY_WRITER_ROLLBACK_ENABLED',
  rollbackWritersEnv: 'INTERVIEW_LEGACY_ROLLBACK_WRITERS',
  disabledCode: 'INTERVIEW_LEGACY_WRITER_DISABLED',
  unmappedCode: 'INTERVIEW_LEGACY_IDENTITY_UNMAPPED',
  // No idBridge: `interview` has no entry in canonicalIdentityBridge.ts's
  // DOMAIN_IDENTITY_REGISTRIES, so every legacyTable/legacyId pair below
  // resolves `not_applicable` (never a fabricated `resolved`).
  writers: [
    {
      writerId: 'INTERVIEW-E01',
      method: 'GET',
      path: /^\/public\/distributions\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'interview_distributions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[3] || ''),
      reason:
        "UNAUTHENTICATED, CROSS-TENANT MUTATION reachable by GET. Registered before router.use(verifyToken) (interview-enterprise.routes.ts:23-45 vs. verifyToken at :47), so no session/JWT of any kind is required — only possession of a 64-hex public_token. resolveActiveDistributionByToken (interviewEnterpriseService.ts:319-353) UPDATEs interview_distributions (status/opened_at, or status='expired') with NO organization_id predicate in either WHERE clause (lines 328-331, 349). No client caller found in src/ (grep negative) but the route is live and mutates on every valid token. Because it precedes verifyToken, this guard — mounted in front of the whole router — records tenant_resolution='unresolved' for it: that is the honest outcome, not an approximation, since no tenant can be read off the request. It is recorded as access_kind='legacy_read' (the kernel classifies by HTTP method, and this is a GET) despite being a write — a known, load-bearing limitation of method-based classification that this reason exists to flag, not hide. No successor exists for this capability-token model.",
    },
    {
      writerId: 'INTERVIEW-E02',
      method: 'POST',
      path: /^\/sessions\/[^/]+\/segments\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'interview_respondent_segments',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'INSERT INTO interview_respondent_segments (interviewEnterpriseService.ts:153-157, inside createSegment at :147), from interview-enterprise.routes.ts:68-89 (behind verifyToken at :47). No canonical successor: interview_respondent_segments is one of the 8 ENTERPRISE-only tables with no CANONICAL (/api/v8/interview) counterpart (grep negative). A client wrapper exists in src/services/api.ts but no UI component calls it.',
    },
    {
      writerId: 'INTERVIEW-E03',
      method: 'POST',
      path: /^\/sessions\/[^/]+\/quotas\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'interview_quotas',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'INSERT INTO interview_quotas (interviewEnterpriseService.ts:188-191, inside createQuota at :182), from interview-enterprise.routes.ts:104-125 (behind verifyToken). ENTERPRISE-only table, no canonical successor. Same unused-client-wrapper pattern as INTERVIEW-E02.',
    },
    {
      writerId: 'INTERVIEW-E04',
      method: 'POST',
      path: /^\/sessions\/[^/]+\/distributions\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'interview_distributions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'INSERT INTO interview_distributions (interviewEnterpriseService.ts:242-257, inside createDistribution at :215), from interview-enterprise.routes.ts:141-165 (behind verifyToken). Mints the public_token that INTERVIEW-E01 later consumes unauthenticated. ENTERPRISE-only table, no canonical successor.',
    },
    {
      writerId: 'INTERVIEW-E05',
      method: 'POST',
      path: /^\/distributions\/[^/]+\/send\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'interview_distributions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        "UPDATE interview_distributions SET status='sent',sent_at=... (interviewEnterpriseService.ts:300-303, inside updateDistributionStatus called from markDistributionSent at :307-309), from interview-enterprise.routes.ts:193-208 (behind verifyToken). Tenant-scoped (WHERE id=? AND organization_id=?, unlike INTERVIEW-E01). No canonical successor.",
    },
    {
      writerId: 'INTERVIEW-E06',
      method: 'POST',
      path: /^\/distributions\/[^/]+\/revoke\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'interview_distributions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        "UPDATE interview_distributions SET revoked_at=...,status='revoked' WHERE id=? AND organization_id=? AND revoked_at IS NULL (interviewEnterpriseService.ts:356-361, inside revokeDistribution), from interview-enterprise.routes.ts:210-226 (behind verifyToken). No api.ts wrapper exists — zero client wiring of any kind. No canonical successor.",
    },
    {
      writerId: 'INTERVIEW-E07',
      method: 'POST',
      path: /^\/sessions\/[^/]+\/reminder-schedules\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'interview_reminder_schedules',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'INSERT INTO interview_reminder_schedules (interviewEnterpriseService.ts:371-373, inside createReminderSchedule at :365), from interview-enterprise.routes.ts:228-250 (behind verifyToken). ENTERPRISE-only table, no canonical successor.',
    },
    {
      writerId: 'INTERVIEW-E08',
      method: 'POST',
      path: /^\/sessions\/[^/]+\/diagnostics\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'interview_diagnostics_snapshots',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'INSERT INTO interview_diagnostics_snapshots (interviewEnterpriseService.ts:458-470, inside createDiagnosticsSnapshot at :447), from interview-enterprise.routes.ts:275-297 (behind verifyToken). ENTERPRISE-only table, no canonical successor.',
    },
    {
      writerId: 'INTERVIEW-E09',
      method: 'POST',
      path: /^\/sessions\/[^/]+\/findings\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'interview_findings',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'INSERT INTO interview_findings (interviewEnterpriseService.ts:525-542, inside createFinding at :511), from interview-enterprise.routes.ts:318-343 (behind verifyToken). interview_findings is a DIFFERENT table from the CANONICAL surface\'s interview_insight_findings — two differently-named, differently-owned "finding" tables coexist with no cross-link, so no successor is claimed.',
    },
    {
      writerId: 'INTERVIEW-E10',
      method: 'POST',
      path: /^\/findings\/[^/]+\/promote\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'interview_findings',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'UPDATE interview_findings via promoteFindingToInitiative (interviewEnterpriseService.ts:578-581, inside :573-583), from interview-enterprise.routes.ts:360-382 (behind verifyToken). Writes the caller-supplied initiativeId as a plain string with no FK/join check against initiatives or initiative_candidates. No canonical successor.',
    },
    {
      writerId: 'INTERVIEW-E11',
      method: 'PATCH',
      path: /^\/findings\/[^/]+\/status\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'interview_findings',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'UPDATE interview_findings via updateFindingStatus (interviewEnterpriseService.ts:586-589, inside :585-591), from interview-enterprise.routes.ts:384-408 (behind verifyToken). No api.ts wrapper — zero client wiring. No canonical successor.',
    },
    {
      writerId: 'INTERVIEW-E12',
      method: 'POST',
      path: /^\/context\/versions\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'organization_context_versions',
      reason:
        'INSERT INTO organization_context_versions (interviewEnterpriseService.ts:683-697, inside createContextVersion at :664), from interview-enterprise.routes.ts:446-476 (behind verifyToken). ENTERPRISE-only table, structurally distinct from the CANONICAL context-document ingestion model (knowledge_docs/knowledge_chunks) — not proven equivalent, so no successor is claimed.',
    },
    {
      writerId: 'INTERVIEW-E13',
      method: 'POST',
      path: /^\/context\/versions\/[^/]+\/sign-off\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'organization_context_versions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[3] || ''),
      reason:
        'UPDATE organization_context_versions via signOffContextVersion (interviewEnterpriseService.ts:735-738, inside :730-740), from interview-enterprise.routes.ts:506-522 (behind verifyToken). Same no-successor situation as INTERVIEW-E12.',
    },
  ],
};
