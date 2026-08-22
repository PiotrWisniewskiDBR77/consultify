/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — FINANCE-STATEMENTS, a full unguarded duplicate
 * of `/api/v8/finance/statements/*`.
 *
 * THE FINDING THIS EXISTS FOR (docs/program/evidence/closure/codex/
 * CLAUDE-NEXT-LEGACY-CUTOVER/inventory/FINANCE.md, risk #2): `finance-statements.routes.ts`
 * (mounted at `/api/finance-statements`, `server/src/Gateway.ts:1343-1349`, behind
 * `gatewayVerifyToken` + `highRiskSurfaceGuard({categories:['upload','export']})` +
 * a `deprecationHeader('/api/v8/finance')` header only — no cutover mechanism at
 * all) imports the same `financialStatementService.ts` functions as
 * `v8/finance.routes.ts` and writes the exact same `financial_statements` /
 * `financial_statement_values` / `financial_statement_packs` rows. The v8 mount
 * passes through `financeLegacyCutoverGuard`, but that guard only fail-closes one
 * writer (model approval) — it never covered statement writes either. So neither
 * door was ever actually protected for this legacy table family; this file closes
 * the measurement gap on the unguarded one.
 *
 * SUCCESSOR: none proven. `POST /api/v8/finance/statements/upload-and-analyze`
 * writes the SAME `financial_statements` row shape — it is a sibling legacy path,
 * not a canonical migration target (confirmed by inventory finding #2 and by
 * `legacyIdBridgeService.ts`'s `LEGACY_FINANCE_TABLES`, which does not include
 * `financial_statements` as a table with a canonical counterpart — only
 * `financial_statement_packs`, `financial_analyses`, `financial_models` and
 * `valuations` are bridged via `finance_artifact_aliases`). Every `successor` field
 * below is therefore `null` per the lane's hard rule: a successor may only be
 * named when the inventory PROVES an equivalent canonical write, and none does
 * here — every "candidate successor" turned out on inspection to be either the
 * same legacy table under a different door, or unverified.
 *
 * IDENTITY BRIDGE: only the four `packs/*` writers (FS-W09/W10/W11/W12, plus the
 * dual-purpose FS-W13 delete) carry `legacyTable: 'financial_statement_packs'` —
 * that is the one table this family touches which the bridge actually knows.
 * The plain-statement writers (FS-W01…W08) carry no `legacyTable`: attaching one
 * that the bridge has never aliased would produce a permanent, meaningless
 * `not_migrated` result rather than an honest `not_applicable`.
 *
 * All writers are `observed`: reachable exactly as before, now durably recorded
 * per tenant. Nothing here is disabled — this lane has no telemetry window yet
 * for any of these fifteen doors.
 */

import type { LegacyCutoverDomainConfig } from '../legacyCutoverKernel.js';

export const FINANCE_STATEMENTS_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'finance',
  rollbackEnv: 'FINANCE_LEGACY_WRITER_ROLLBACK_ENABLED',
  rollbackWritersEnv: 'FINANCE_LEGACY_ROLLBACK_WRITERS',
  disabledCode: 'FINANCE_LEGACY_WRITER_DISABLED',
  unmappedCode: 'FINANCE_LEGACY_IDENTITY_UNMAPPED',
  idBridge: '/api/v8/finance-v2/artifacts/resolve-legacy/financial_statement_packs/:legacyId',
  writers: [
    {
      writerId: 'FS-W01',
      method: 'POST',
      path: /^\/upload\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'financial_statements',
      reason:
        'Creates a new financial_statements row (finance-statements.routes.ts:500, createStatement/finalizeIdempotentUpload in financialStatementService.ts:9047,8936). No mount-level guard existed before this registration; no proven canonical successor (statement-family rows are not one of the four bridged legacy tables).',
    },
    {
      writerId: 'FS-W02',
      method: 'POST',
      path: /^\/upload-and-analyze\/?$/,
      state: 'disabled',
      successor: '/api/v8/finance/statements/upload-and-analyze',
      legacyTable: 'financial_statements',
      reason:
        'The mounted Import Wizard now calls only the independently mounted, tenant-context V8 ingest route with the same stable Idempotency-Key. Its legacy fallback was removed, so the unguarded duplicate write door is retired fail-closed with writer-scoped rollback.',
    },
    {
      writerId: 'FS-W03',
      method: 'POST',
      path: /^\/[^/]+\/detect\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Updates statement type/metadata on an existing financial_statements row addressed by :id (finance-statements.routes.ts:1725, getStatementOrFail + updateStatementMetadata in financialStatementService.ts:8190). Not registered against the bridge: financial_statements is not one of the four legacy tables it knows.',
    },
    {
      writerId: 'FS-W04',
      method: 'POST',
      path: /^\/[^/]+\/extract\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Writes financial_statement_extracted_sections and financial_statement_candidate_rows for the statement addressed by :id (finance-statements.routes.ts:1866). No cutover guard existed on this router; no proven canonical successor.',
    },
    {
      writerId: 'FS-W05',
      method: 'POST',
      path: /^\/[^/]+\/map\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Writes financial_statement_mapping_candidates and financial_statement_line_aliases for the statement addressed by :id (finance-statements.routes.ts:2075, autoMapLines in financialStatementService.ts:5049). No proven successor.',
    },
    {
      writerId: 'FS-W06',
      method: 'PUT',
      path: /^\/[^/]+\/values\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Writes financial_statement_values via saveStatementValuesFlow for the statement addressed by :id (finance-statements.routes.ts:2281, financialStatementService.ts:9120 saveStatementValues). No proven successor.',
    },
    {
      writerId: 'FS-W07',
      method: 'POST',
      path: /^\/[^/]+\/validate\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Deletes and re-inserts financial_statement_validations for the statement addressed by :id (finance-statements.routes.ts:2307, financialStatementService.ts:7919-7990). No equivalent explicit /validate step confirmed in finance-v2; no proven successor.',
    },
    {
      writerId: 'FS-W08',
      method: 'POST',
      path: /^\/[^/]+\/confirm\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Confirms a statement: writes financial_statements, financial_statement_versions and financial_statement_value_versions for the record addressed by :id (finance-statements.routes.ts:2440, financialStatementService.ts:9237,9245,9268 confirmStatement/snapshotCanonicalStatementVersion). No proven successor.',
    },
    {
      writerId: 'FS-W09',
      method: 'POST',
      path: /^\/packs\/[^/]+\/recompute\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'financial_statement_packs',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Recomputes a financial_statement_packs row addressed by :id (finance-statements.routes.ts:2679, recomputeStatementPackForOrganization -> financialStatementPackService.ts:695). financial_statement_packs is one of the four legacy tables the canonical identity bridge knows, so legacyTable is set here. No proven successor.',
    },
    {
      writerId: 'FS-W10',
      method: 'POST',
      path: /^\/packs\/[^/]+\/report-section\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Reads the financial_statement_packs row addressed by :id but writes a NEW report/snapshot record via ReportBuilderService.createReport and ReportContract.createSnapshot (finance-statements.routes.ts:2701, financeReportSectionService.ts:1500-1552) — the mutated rows are report tables, not financial_statement_packs itself, so legacyTable is left unset (the write target is not one legacy record with a stable id in the packs table).',
    },
    {
      writerId: 'FS-W11',
      method: 'POST',
      path: /^\/packs\/[^/]+\/statements\/[^/]+\/assign\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'financial_statement_packs',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Assigns a financial_statements row to a financial_statement_packs row, mutating both (finance-statements.routes.ts:2924, assignStatementToExistingPack -> financialStatementPackService.ts:855 -> assignStatementToPack + recomputeStatementPack). legacyId is the pack id (the bridge-known table); the statement id is a second, unmapped parameter. No proven successor.',
    },
    {
      writerId: 'FS-W12',
      method: 'DELETE',
      path: /^\/packs\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'financial_statement_packs',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Deletes a financial_statement_packs row and its financial_statement_validations (finance-statements.routes.ts:2951, financialStatementPackService.ts:421,427). No proven successor; irreversible delete with zero protection before this registration.',
    },
    {
      writerId: 'FS-W13',
      method: 'DELETE',
      path: /^\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'financial_statement_packs',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[1] || ''),
      reason:
        'Dual-purpose delete: the handler first checks whether :id is a financial_statement_packs row (and cascades to its child financial_statements + 7 dependent tables), otherwise falls back to treating :id as an individual financial_statements row (finance-statements.routes.ts:3310-3400, inline SQL, no shared service function — the inventory pointer to financialStatementService.ts:8644/8647 was a different function, compensateAbandonedStatement, not this handler). legacyTable is set to financial_statement_packs as the more common case; when :id is actually a statement id the bridge lookup will honestly resolve not_migrated rather than false-positively match. No proven successor.',
    },
    {
      writerId: 'FS-W14',
      method: 'POST',
      path: /^\/ratios\/growth\/?$/,
      state: 'observed',
      effect: 'read-only',
      successor: null,
      reason:
        'Verified NO database write: computeGrowthRatios (finance-statements.routes.ts:3403, ratioAnalysisService.ts:1028) only reads financial_statement_values/financial_statement_lines and returns a computed ratio list. Registered for completeness because it is a POST route on this router; the reason records that it performs no mutation despite the verb.',
    },
    {
      writerId: 'FS-W15',
      method: 'PUT',
      path: /^\/benchmarks\/?$/,
      state: 'observed',
      successor: null,
      reason:
        'Upserts an organization-scoped financial_ratio_benchmarks row keyed by (organization_id, ratio_code, industry, period_year) — a collection-level write, not addressed by a path id (finance-statements.routes.ts:3431, upsertBenchmark -> ratioAnalysisService.ts:1150). No legacyTable/legacyId: no single legacy record identity in the path.',
    },
  ],
};

export default FINANCE_STATEMENTS_CUTOVER;
