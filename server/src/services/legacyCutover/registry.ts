/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — the writer registry.
 *
 * One place that answers, for every inventoried legacy writer: what is its
 * canonical successor, what state is it in, and why. The report in
 * `docs/program/evidence/closure/codex/CLAUDE-NEXT-LEGACY-CUTOVER/` is generated
 * from this file plus the runtime telemetry, so a writer cannot appear in the
 * report without appearing here, and cannot be silently disabled without a
 * `reason` that a reviewer can check against `file:line` evidence.
 *
 * STATE MEANINGS (see `legacyCutoverKernel.ts`):
 *   disabled      — refuses today (410, or 409 for an unmigrated record).
 *   protected     — reachable; successor proven; retirement awaits authorization.
 *   observed      — reachable; recorded only; no successor proof.
 *   owner-blocked — retiring it needs an integrator-owned file or an owner call.
 *
 * NOTHING is promoted to `disabled` on the strength of a ripgrep for callers.
 * Promotion requires: a successor handler in code, a parity proof, a backfilled
 * identity (or the 409 path), tenant-scoped telemetry, and a rehearsed rollback.
 */

import type { LegacyCutoverDomainConfig } from './legacyCutoverKernel.js';

/**
 * FINANCE. Ported from `financeLegacyCutover.ts` (FIN-MVP-CUTOVER-001, tranche
 * 1/30) without widening the retirement: exactly the same single writer refuses,
 * and it refuses through the same `FINANCE_LEGACY_WRITER_DISABLED` contract.
 * What changes is only the observation: tenant-scoped, idempotent, and now able
 * to distinguish a migrated record (410) from a stranded one (409).
 */
export const FINANCE_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'finance',
  rollbackEnv: 'FINANCE_LEGACY_WRITER_ROLLBACK_ENABLED',
  rollbackWritersEnv: 'FINANCE_LEGACY_ROLLBACK_WRITERS',
  disabledCode: 'FINANCE_LEGACY_WRITER_DISABLED',
  unmappedCode: 'FINANCE_LEGACY_IDENTITY_UNMAPPED',
  idBridge: '/api/v8/finance-v2/artifacts/resolve-legacy/financial_models/:legacyId',
  writers: [
    {
      writerId: 'FIN-W01',
      method: 'POST',
      path: /^\/models\/[^/]+\/approve\/?$/,
      state: 'disabled',
      successor: '/api/v8/finance-v2/models/:artifactId/approve',
      legacyTable: 'financial_models',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Canonical approval preserves the frozen response contract; proven by FIN-MVP-CUTOVER-001 tranche 1/30.',
    },
  ],
};

/**
 * PARTNERS. Ported from `partnerLegacyCutover.ts` (PRT-MVP-LEGACY-CUTOVER-001).
 * All sixteen inventoried writers now refuse, with the same
 * `PARTNER_LEGACY_WRITER_DISABLED` code and the same successors. Partners has no
 * canonical alias registry, so every rule resolves `not_applicable` and the 409
 * branch is unreachable here — behaviour is byte-identical to before, while the
 * observation gains the tenant column and the idempotency the old
 * `partner_legacy_usage_events` table never had.
 */
export const PARTNERS_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'partners',
  rollbackEnv: 'PARTNER_LEGACY_ROLLBACK_ENABLED',
  rollbackWritersEnv: 'PARTNER_LEGACY_ROLLBACK_WRITERS',
  disabledCode: 'PARTNER_LEGACY_WRITER_DISABLED',
  unmappedCode: 'PARTNER_LEGACY_IDENTITY_UNMAPPED',
  writers: [
    {
      writerId: 'PRT-W01',
      method: 'POST',
      path: /^\/payouts\/request\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/payouts/request',
      reason: 'V8 payout request is the canonical owner (PRT-MVP-LEGACY-CUTOVER-001).',
    },
    {
      writerId: 'PRT-W02',
      method: 'POST',
      path: /^\/campaign-links\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/campaign-links',
      reason: 'V8 campaign-link creation is the canonical owner.',
    },
    {
      writerId: 'PRT-W03',
      method: 'DELETE',
      path: /^\/campaign-links\/[^/]+\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/campaign-links/:linkId',
      reason: 'V8 campaign-link deletion is the canonical owner.',
    },
    {
      writerId: 'PRT-W04',
      method: 'PUT',
      path: /^\/organization\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/organization',
      reason: 'V8 partner organization update is the canonical owner.',
    },
    {
      writerId: 'PRT-W05',
      method: 'PUT',
      path: /^\/organization\/specializations\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/organization/specializations',
      reason: 'V8 specializations update is the canonical owner.',
    },
    {
      writerId: 'PRT-W06',
      method: 'PUT',
      path: /^\/organization\/regions\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/organization/regions',
      reason: 'V8 regions update is the canonical owner.',
    },
    {
      writerId: 'PRT-W07',
      method: 'PUT',
      path: /^\/organization\/listing\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/organization/listing',
      reason: 'V8 listing update is the canonical owner.',
    },
    {
      writerId: 'PRT-W08',
      method: 'PUT',
      path: /^\/payout-settings\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/payout-settings',
      reason: 'V8 payout settings update is the canonical owner.',
    },

    // --- successors completed after the original eight -------------------
    // W09 and W13-W15 now have transactional V8 commands. W10-W12 and W16
    // preserve their approved no-write 503 contract behind explicit V8 routes.
    {
      writerId: 'PRT-W09',
      method: 'POST',
      path: /^\/connect\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/connect',
      reason: 'V8 self-connect is the canonical transactional owner.',
    },
    {
      writerId: 'PRT-W10',
      method: 'POST',
      path: /^\/clients\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/clients',
      reason: 'V8 preserves the authorized no-write 503 client-creation contract.',
    },
    {
      writerId: 'PRT-W11',
      method: 'POST',
      path: /^\/employees\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/employees',
      reason: 'V8 preserves the authorized no-write 503 employee-creation contract.',
    },
    {
      writerId: 'PRT-W12',
      method: 'POST',
      path: /^\/access-links\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/access-links',
      reason: 'V8 preserves the authorized no-write 503 access-link contract.',
    },
    {
      writerId: 'PRT-W13',
      method: 'POST',
      path: /^\/certifications\/[^/]+\/modules\/[^/]+\/progress\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/certifications/:certId/modules/:moduleId/progress',
      reason: 'V8 certification progress command is the canonical transactional owner.',
    },
    {
      writerId: 'PRT-W14',
      method: 'POST',
      path: /^\/certifications\/[^/]+\/exam\/start\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/certifications/:certId/exam/start',
      reason: 'V8 certification exam-start command is the canonical transactional owner.',
    },
    {
      writerId: 'PRT-W15',
      method: 'POST',
      path: /^\/certifications\/[^/]+\/exam\/submit\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/certifications/:certId/exam/submit',
      reason: 'V8 certification exam-submit command is the canonical transactional owner.',
    },
    {
      writerId: 'PRT-W16',
      method: 'POST',
      path: /^\/licenses\/order\/?$/,
      state: 'disabled',
      successor: '/api/v8/partner/licenses/order',
      reason: 'V8 preserves the authorized no-write 503 license-order contract.',
    },
  ],
};

/**
 * FINANCE, SECOND DOOR — `/api/financial-modeling`.
 *
 * THE FINDING THIS EXISTS FOR: `POST /api/v8/finance/models/:id/approve` was
 * retired by FIN-MVP-CUTOVER-001 and answers 410. The very same write —
 * literally the same `approveModel()` in `financialModelingService.ts` — is also
 * reachable at `POST /api/financial-modeling/models/:id/approve`
 * (`server/src/routes/financial-modeling.routes.ts:538`, mounted at
 * `server/src/Gateway.ts:1348` behind `verifyToken` and a no-op `betaGate`),
 * where nothing guarded it at all. Two live UI surfaces call that second door
 * DIRECTLY, with no V8 attempt first:
 *   `src/components/Economics/hooks/useFinanceRowActions.ts:45`
 *   `src/components/Economics/FinancePreviewPanel.tsx:73`
 * So the writer was never retired — only one of its two doors was.
 *
 * FIN-W02 is therefore `protected`, NOT `disabled`: the successor is proven (it
 * is FIN-W01's), but two live clients still use this door, and the lane rule is
 * that no writer is disabled without usage evidence. Mounting the guard here
 * closes the measurement gap immediately — the traffic becomes visible per
 * tenant — while leaving behaviour unchanged. Retiring FIN-W02 is the first
 * item of the onward plan, not something to do blind.
 *
 * (Checked, and worth recording: the client fallback predicate
 * `shouldFallbackToLegacyFinance` — `src/services/api/v8/finance.ts:3-6` —
 * matches only 400/404/405/501, so neither FIN-W01's 410 nor the kernel's new
 * 409 causes a client to silently re-route to this door.)
 */
export const FINANCE_MODELING_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'finance',
  rollbackEnv: 'FINANCE_LEGACY_WRITER_ROLLBACK_ENABLED',
  rollbackWritersEnv: 'FINANCE_LEGACY_ROLLBACK_WRITERS',
  disabledCode: 'FINANCE_LEGACY_WRITER_DISABLED',
  unmappedCode: 'FINANCE_LEGACY_IDENTITY_UNMAPPED',
  idBridge: '/api/v8/finance-v2/artifacts/resolve-legacy/financial_models/:legacyId',
  writers: [
    {
      writerId: 'FIN-W02',
      method: 'POST',
      path: /^\/models\/[^/]+\/approve\/?$/,
      state: 'disabled',
      successor: '/api/v8/finance-v2/models/:artifactId/approve',
      legacyTable: 'financial_models',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Same approveModel() write as FIN-W01. Both live UI callers now resolve the legacy model alias and use the canonical finance-v2 approval route, so this second door is retired with writer-scoped rollback.',
    },
  ],
};

export const CUTOVER_REGISTRY: Record<string, LegacyCutoverDomainConfig> = {
  finance: FINANCE_CUTOVER,
  'finance-modeling': FINANCE_MODELING_CUTOVER,
  partners: PARTNERS_CUTOVER,
};
