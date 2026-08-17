/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — AUDITS domain.
 *
 * Two unrelated legacy write surfaces live in this domain's inventory
 * (`docs/program/evidence/closure/codex/CLAUDE-NEXT-LEGACY-CUTOVER/inventory/AUDITS.json`),
 * re-verified against this baseline's actual route/service files below —
 * the inventory is a lead, not proof:
 *
 *  1. THE ALREADY-RETIRED CRUD TRIO on `audit_programs`
 *     (`server/src/routes/audit-programs.routes.ts`, mounted unconditionally
 *     at `/api/audit` — `server/src/Gateway.ts:1317`). AUD-MVP-OWNER-001
 *     (2026-08-16) already retired this router's entire write surface — POST
 *     `/programs` (`audit-programs.routes.ts:129-130`), PATCH `/programs/:id`
 *     (`:174-175`), DELETE `/programs/:id` (`:274-275`), and POST
 *     `/programs/:id/generate-surveys` (`:240-241`) — through its OWN
 *     kill-switch, `isLegacyProgramWriteEnabled()`
 *     (`server/src/services/auditProgramService.ts:152-154`, env
 *     `AUDIT_PROGRAM_LEGACY_WRITES_ENABLED`, default/unset = `false` =
 *     disabled). Each handler's first line is
 *     `if (!isLegacyProgramWriteEnabled()) return sendLegacyWriteDisabled(res)`,
 *     which answers 410 `AUDIT_PROGRAM_LEGACY_WRITE_DISABLED` — confirmed by
 *     reading the route file directly, not assumed from the inventory.
 *     Registered here as `disabled` ONLY to bring an already-retired writer
 *     into the shared cutover report; this kernel is not the mechanism that
 *     retired it. Consequently this kernel's own `rollbackEnv` /
 *     `rollbackWritersEnv` are NOT the operative rollback lever for these
 *     four writers — flipping them would only stop THIS guard's own refusal,
 *     while the route's own `isLegacyProgramWriteEnabled()` check (which
 *     this guard sits in front of) still governs what actually happens if a
 *     request ever reaches the handler. The real, tested rollback lever is
 *     the domain's own `AUDIT_PROGRAM_LEGACY_WRITES_ENABLED=true`. Each
 *     writer's `reason` repeats this so it cannot be missed in the report.
 *
 *  2. THE NEVER-RETIRED `audits` TABLE
 *     (`server/src/routes/audit.routes.ts`, POST `/` at `:34`, PUT `/:id` at
 *     `:52-53`, writing table `audits` — INSERT at `:44`, UPDATE at `:75`).
 *     No kernel/canonical writer targets `audits` anywhere in `server/src`
 *     (grep negative); the kernel's nearest concept, `audit_programs`, has a
 *     materially different shape (pack/criteria/lifecycle vs.
 *     name/type/status/score/auditor/scheduled_date), so rule 3 forbids
 *     calling it a successor. Mounted via
 *     `mountStub('/api/audit', auditRoutes, 'auditRoutes')`
 *     (`server/src/Gateway.ts:1332`); `'auditRoutes'` is confirmed NOT a
 *     member of `STUB_NAMES_WITH_LIVE_UI_ON_DEMO`
 *     (`Gateway.ts:470-483`), so in production without
 *     `ENABLE_STUB_ROUTES=true` this router is not mounted at all — a
 *     request falls through to Express's generic 404, not an honest
 *     410/501. Registered `observed`, `successor: null`.
 *
 * `audit-events.routes.ts` (`/api/audit/events`, GET-only, table
 * `audit_events` — artifact-studio activity trail) and `auditLog.routes.ts`
 * (`/api/audit-logs`, table `audit_log` + `organization_context_*` —
 * DLP/data-residency/lineage trail) are a different domain with zero table
 * overlap with the audit-engagement tables above, and are deliberately NOT
 * registered here (per the brief that scoped this file).
 */

import type { LegacyCutoverDomainConfig } from '../legacyCutoverKernel.js';

export const AUDITS_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'audits',
  rollbackEnv: 'AUDITS_LEGACY_WRITER_ROLLBACK_ENABLED',
  rollbackWritersEnv: 'AUDITS_LEGACY_ROLLBACK_WRITERS',
  disabledCode: 'AUDITS_LEGACY_WRITER_DISABLED',
  unmappedCode: 'AUDITS_LEGACY_IDENTITY_UNMAPPED',
  // No idBridge: `audits` has no entry in canonicalIdentityBridge.ts's
  // DOMAIN_IDENTITY_REGISTRIES, so every legacyTable/legacyId pair below
  // resolves `not_applicable` (never a fabricated `resolved`).
  writers: [
    {
      writerId: 'AUDITS-W03',
      method: 'POST',
      path: /^\/programs\/?$/,
      state: 'disabled',
      successor: '/api/audits/programs',
      legacyTable: 'audit_programs',
      enforcedBy: 'domain',
      enforcedByEnv: 'AUDIT_PROGRAM_LEGACY_WRITES_ENABLED',
      reason:
        "Already retired by AUD-MVP-OWNER-001: audit-programs.routes.ts:130 returns 410 AUDIT_PROGRAM_LEGACY_WRITE_DISABLED via sendLegacyWriteDisabled(), gated by isLegacyProgramWriteEnabled() (auditProgramService.ts:152-154, env AUDIT_PROGRAM_LEGACY_WRITES_ENABLED, default/unset=false). The canonical successor POST /api/audits/programs (server/src/routes/audits/programs.routes.ts:64-82) is proven and live. This kernel's rollbackEnv/rollbackWritersEnv are NOT the operative rollback lever here — restoring legacy writes requires flipping the domain's own AUDIT_PROGRAM_LEGACY_WRITES_ENABLED=true, which the handler checks itself before this guard is ever reached in production wiring. Registered `disabled` only so this already-retired writer appears in the shared cutover report.",
    },
    {
      writerId: 'AUDITS-W04',
      method: 'PATCH',
      path: /^\/programs\/[^/]+\/?$/,
      state: 'disabled',
      successor: '/api/audits/programs/:id',
      legacyTable: 'audit_programs',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      enforcedBy: 'domain',
      enforcedByEnv: 'AUDIT_PROGRAM_LEGACY_WRITES_ENABLED',
      reason:
        "Same kill-switch as AUDITS-W03, guard at audit-programs.routes.ts:174-175. Canonical successor PATCH /api/audits/programs/:id (audits/programs.routes.ts:84-97) is proven. Rollback lever is the domain's AUDIT_PROGRAM_LEGACY_WRITES_ENABLED env var, not this kernel's.",
    },
    {
      writerId: 'AUDITS-W05',
      method: 'DELETE',
      path: /^\/programs\/[^/]+\/?$/,
      state: 'disabled',
      successor: '/api/audits/programs/:id',
      legacyTable: 'audit_programs',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      enforcedBy: 'domain',
      enforcedByEnv: 'AUDIT_PROGRAM_LEGACY_WRITES_ENABLED',
      reason:
        "Same kill-switch as AUDITS-W03, guard at audit-programs.routes.ts:274-275. Canonical successor DELETE /api/audits/programs/:id (audits/programs.routes.ts:99-107) is proven. Rollback lever is the domain's AUDIT_PROGRAM_LEGACY_WRITES_ENABLED env var, not this kernel's.",
    },
    {
      writerId: 'AUDITS-W06',
      method: 'POST',
      path: /^\/programs\/[^/]+\/generate-surveys\/?$/,
      state: 'disabled',
      successor: null,
      legacyTable: 'audit_programs',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      enforcedBy: 'domain',
      enforcedByEnv: 'AUDIT_PROGRAM_LEGACY_WRITES_ENABLED',
      reason:
        "Same kill-switch as AUDITS-W03, guard at audit-programs.routes.ts:240-241. Unlike the CRUD trio, this writer's successor is null: no kernel service composes the template x assignee survey fan-out (grep of services/audits/*.ts for InterviewAssignmentService usage is negative), so the retirement of the identity-write half does not carry a proven successor for the fan-out half. Rollback lever is the domain's AUDIT_PROGRAM_LEGACY_WRITES_ENABLED env var, not this kernel's.",
    },
    {
      writerId: 'AUDITS-W01',
      method: 'POST',
      path: /^\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'audits',
      reason:
        "INSERT INTO audits (audit.routes.ts:44, inside POST / at :34). No kernel/canonical writer targets table `audits` anywhere in server/src (grep negative); audit_programs has a materially different shape (pack/criteria/lifecycle vs. name/type/status/score), so rule 3 forbids calling it a successor. Reachability itself is also gated: mountStub('/api/audit', auditRoutes, 'auditRoutes') at Gateway.ts:1332, and 'auditRoutes' is confirmed absent from STUB_NAMES_WITH_LIVE_UI_ON_DEMO (Gateway.ts:470-483) — in production without ENABLE_STUB_ROUTES=true this router is not mounted at all (silent 404), so today's real-world reachability is dev/test only. Zero POST client callers found (grep negative).",
    },
    {
      writerId: 'AUDITS-W02',
      method: 'PUT',
      path: /^\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'audits',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[1] || ''),
      reason:
        'UPDATE audits (audit.routes.ts:75, inside PUT /:id at :52-53). Same no-successor and same-mount-gating situation as AUDITS-W01. Zero PUT client callers found (grep negative); the one GET reader in the frontend (AuditHistoryView.tsx:151) expects an {events:[...]} activity-log shape that this router does not produce (a bare array of `audits` rows), so it is a likely-dead/broken reader, not evidence of live traffic through this writer.',
    },
  ],
};
