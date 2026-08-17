/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — RESULTS domain (`/api/v8/results`, router
 * `server/src/routes/v8/results.routes.ts`).
 *
 * WHY THIS EXISTS: RESULTS has no cutover guard of any kind today — unlike
 * Finance and Partners, no `resultsLegacyCutover.ts` ever existed, so this is
 * the first observation this router has ever had. `initiative_kpis` and
 * `kpi_time_series` are written from FIVE independent live surfaces with no
 * guard anywhere; this config covers the THREE of those five that are
 * reachable through this router (RESULTS-W01/W02/W03 for `initiative_kpis`,
 * RESULTS-W04 for `kpi_time_series`). The other two — `POST /api/benefits/kpis*`
 * (benefits.routes.ts, the frontend's own documented fallback) and
 * `POST /api/pmo/initiatives/:id/apply-template` (denylisted file) — are on
 * other mounts and are NOT registered here; see the integrator report.
 *
 * Every id below is copied from `docs/program/evidence/closure/codex/
 * CLAUDE-NEXT-LEGACY-CUTOVER/inventory/RESULTS.json`, then re-verified against
 * this baseline's actual route file, service file and successor route file —
 * the inventory is a lead, not proof. Two corrections were found in that
 * verification and are noted on RESULTS-W29 and RESULTS-W49/RESULTS-W60-shaped
 * successor paths below (the inventory named a successor path,
 * `/cases/:caseId/actual-entries`, that does not exist; the real route is
 * `/cases/:caseId/actuals`, confirmed at
 * `server/src/routes/resultsVnext/roi.routes.ts:2283-2284`).
 *
 * NOTHING here is `disabled` — the lane rule (see kernel doc) is that no
 * writer is retired without a telemetry window, and mounting this guard is
 * what starts that window. `no-successor` findings from the inventory are
 * registered as `observed` with `successor: null`, per the brief.
 */

import type { LegacyCutoverDomainConfig } from '../legacyCutoverKernel.js';

export const RESULTS_CUTOVER: LegacyCutoverDomainConfig = {
  domain: 'results',
  rollbackEnv: 'RESULTS_LEGACY_WRITER_ROLLBACK_ENABLED',
  rollbackWritersEnv: 'RESULTS_LEGACY_ROLLBACK_WRITERS',
  disabledCode: 'RESULTS_LEGACY_WRITER_DISABLED',
  unmappedCode: 'RESULTS_LEGACY_IDENTITY_UNMAPPED',
  // No idBridge: `results` has no entry in canonicalIdentityBridge.ts's
  // DOMAIN_IDENTITY_REGISTRIES, so every legacyTable/legacyId pair below
  // resolves `not_applicable` (never a fabricated `resolved`), not a bridge
  // endpoint that does not exist.
  writers: [
    {
      writerId: 'RESULTS-W01',
      method: 'POST',
      path: /^\/kpis\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/kpi',
      legacyTable: 'initiative_kpis',
      reason:
        'INSERT INTO initiative_kpis via createKpiDefinition (server/src/services/results/kpiDefinitionService.ts:344), called from server/src/routes/v8/results.routes.ts:757-836. Canonical POST /api/vnext/results/kpi (server/src/routes/resultsVnext/kpi.routes.ts:299) writes rvn_kpi_definitions/rvn_kpi_definition_versions and is live; kept protected (not disabled) because no telemetry window has run yet.',
    },
    {
      writerId: 'RESULTS-W02',
      method: 'PUT',
      path: /^\/kpis\/[^/]+\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/kpi/:kpiId/draft',
      legacyTable: 'initiative_kpis',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'UPDATE initiative_kpis via updateKpiDefinition (kpiDefinitionService.ts:441,498), called from results.routes.ts:843-1016. Canonical PUT /api/vnext/results/kpi/:kpiId/draft (resultsVnext/kpi.routes.ts:438) writes rvn_kpi_definition_versions but is a draft/submit/approve flow, not a direct in-place edit — semantically narrower, so retirement is not a mechanical redirect even once telemetry is clean.',
    },
    {
      writerId: 'RESULTS-W03',
      method: 'DELETE',
      path: /^\/kpis\/[^/]+\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/kpi/:kpiId/archive',
      legacyTable: 'initiative_kpis',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Soft-archive UPDATE initiative_kpis via archiveKpiDefinition (kpiDefinitionService.ts:575) plus DELETE FROM initiative_kpi_mappings, both from results.routes.ts:1022-1074. Canonical POST /api/vnext/results/kpi/:kpiId/archive (resultsVnext/kpi.routes.ts, mountLifecycleRoute at line 729) exists and archives the rvn_kpi_definitions row.',
    },
    {
      writerId: 'RESULTS-W04',
      method: 'POST',
      path: /^\/kpis\/[^/]+\/time-series\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/kpi/:kpiId/measurements',
      legacyTable: 'kpi_time_series',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'INSERT ... kpi_time_series ON CONFLICT DO UPDATE via recordKpiMeasurement (server/src/services/results/kpiMeasurementWriterService.ts:243) plus UPDATE initiative_kpis.current_value (same file:281), from results.routes.ts:2605-2686. A THIRD table (kpi_deviation_cases) is also upserted as a side effect by kpiDeviationService.ts:282 (handleTimeSeriesRecorded) and has no canonical equivalent traced anywhere — protected on the strength of the primary rvn_kpi_measurements successor (resultsVnext/kpi.routes.ts:737), but the deviation-case side effect is a real coverage gap this guard cannot close.',
    },
    {
      writerId: 'RESULTS-W05',
      method: 'POST',
      path: /^\/benefits\/[^/]+\/promote\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'initiative_benefits',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'INSERT initiative_kpis via createKpiDefinition (results.routes.ts:4212) plus UPDATE initiative_benefits SET status=\'promoted\' (results.routes.ts:4227-4232), from results.routes.ts:4143-4239. No route under /api/vnext/results/roi or /kpi composes the combined benefit-promote-to-KPI operation against rvn_roi_benefit_lines + rvn_kpi_definitions together, so successor is null even though the KPI half alone has a sibling (RESULTS-W01).',
    },
    {
      writerId: 'RESULTS-W06',
      method: 'POST',
      path: /^\/benefits\/[^/]+\/dismiss\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'initiative_benefits',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'UPDATE initiative_benefits SET status=\'dismissed\', results.routes.ts:4245-4280. No rvn_roi_* route dismisses a benefit line; initiative_benefits has no confirmed canonical successor anywhere in this baseline.',
    },
    {
      writerId: 'RESULTS-W17',
      method: 'POST',
      path: /^\/kpi-mappings\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/initiatives/initiative-impacts',
      legacyTable: 'initiative_kpi_mappings',
      reason:
        'INSERT INTO initiative_kpi_mappings, results.routes.ts:1080-1158 (INSERT confirmed at line 1130). Canonical POST /initiative-impacts (server/src/routes/resultsVnext/kpiPerspectives.routes.ts:296-297, mounted at /api/vnext/results/initiatives per server/src/Gateway.ts:1214) calls proposeInitiativeKpiImpact and writes rvn_kpi_initiative_impacts (server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.ts:233).',
    },
    {
      writerId: 'RESULTS-W18',
      method: 'DELETE',
      path: /^\/kpi-mappings\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'initiative_kpi_mappings',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Hard DELETE FROM initiative_kpi_mappings, results.routes.ts:1160-1188 (DELETE confirmed at line ~1172). The canonical side only has supersedeInitiativeKpiImpact — a soft supersede (server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.ts:707,717,737) — no canonical hard delete exists, so this is a real, not a naming, gap.',
    },
    {
      writerId: 'RESULTS-W19',
      method: 'POST',
      path: /^\/deviation-cases\/[^/]+\/acknowledge\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/acknowledge',
      legacyTable: 'kpi_deviation_cases',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'UPDATE kpi_deviation_cases, results.routes.ts:1188-1240. Canonical POST .../deviation-cases/:caseId/acknowledge (server/src/routes/resultsVnext/kpiDeviation.routes.ts:334-366, mounted at /api/vnext/results/kpi/deviation-cases) writes rvn_kpi_deviation_cases 1:1.',
    },
    {
      writerId: 'RESULTS-W20',
      method: 'PUT',
      path: /^\/deviation-cases\/[^/]+\/rca\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/root-cause',
      legacyTable: 'kpi_deviation_cases',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'UPDATE kpi_deviation_cases, results.routes.ts:1241-1305. Canonical PUT .../root-cause (kpiDeviation.routes.ts:372-409) writes rvn_kpi_deviation_cases 1:1.',
    },
    {
      writerId: 'RESULTS-W21',
      method: 'POST',
      path: /^\/deviation-cases\/[^/]+\/actions\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/corrective-actions',
      legacyTable: 'kpi_deviation_actions',
      reason:
        'INSERT INTO kpi_deviation_actions, results.routes.ts:1419-1479. Canonical POST .../corrective-actions (kpiDeviation.routes.ts:415-451) writes rvn_kpi_corrective_actions 1:1.',
    },
    {
      writerId: 'RESULTS-W22',
      method: 'PUT',
      path: /^\/deviation-cases\/[^/]+\/actions\/[^/]+\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/corrective-actions/:actionId',
      legacyTable: 'kpi_deviation_actions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[4] || ''),
      reason:
        'UPDATE kpi_deviation_actions, results.routes.ts:1480-1569. Canonical PATCH .../corrective-actions/:actionId (kpiDeviation.routes.ts:492-539) writes rvn_kpi_corrective_actions 1:1.',
    },
    {
      writerId: 'RESULTS-W23',
      method: 'POST',
      path: /^\/deviation-cases\/[^/]+\/resolve\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'kpi_deviation_cases',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'UPDATE kpi_deviation_cases, results.routes.ts:1570-1622. The closest canonical route is .../effectiveness-verifications (kpiDeviation.routes.ts:667-705), which is not a 1:1 status-resolve transition — not a confirmed successor.',
    },
    {
      writerId: 'RESULTS-W24',
      method: 'POST',
      path: /^\/deviation-cases\/[^/]+\/close\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/close',
      legacyTable: 'kpi_deviation_cases',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'UPDATE kpi_deviation_cases (two statements), results.routes.ts:1623-1757. Canonical POST .../close (kpiDeviation.routes.ts:742-774) writes rvn_kpi_deviation_cases 1:1.',
    },
    {
      writerId: 'RESULTS-W25',
      method: 'POST',
      path: /^\/deviation-cases\/[^/]+\/recovery-card\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'kpi_recovery_cards',
      reason:
        'INSERT INTO kpi_recovery_cards via ensureRecoveryCardForCase (server/src/services/results/kpiRecoveryCardService.ts:439), from results.routes.ts:1792-1863. Closest canonical route is POST .../recovery-observation (kpiDeviation.routes.ts:628-661, confirmed a single observation record) — narrower than a full multi-action/checkpoint recovery card, not equivalent. Recovery cards are one of the two writer families the inventory found with zero canonical successor anywhere.',
    },
    {
      writerId: 'RESULTS-W26',
      method: 'PUT',
      path: /^\/recovery-cards\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'kpi_recovery_cards',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'UPDATE kpi_recovery_cards, kpiRecoveryCardService.ts:877, from results.routes.ts:1864-1946. No card-level update endpoint exists in any resultsVnext/kpi* router.',
    },
    {
      writerId: 'RESULTS-W27',
      method: 'POST',
      path: /^\/recovery-cards\/[^/]+\/actions\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'kpi_recovery_actions',
      reason:
        'INSERT INTO kpi_recovery_actions, kpiRecoveryCardService.ts:541,578, from results.routes.ts:1947-1995. No canonical recovery-action sub-resource exists.',
    },
    {
      writerId: 'RESULTS-W28',
      method: 'PUT',
      path: /^\/recovery-cards\/[^/]+\/actions\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'kpi_recovery_actions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[4] || ''),
      reason:
        'UPDATE kpi_recovery_actions, kpiRecoveryCardService.ts:636,685, from results.routes.ts:1996-2069. No canonical recovery-action sub-resource exists (same gap as RESULTS-W27).',
    },
    {
      writerId: 'RESULTS-W29',
      method: 'POST',
      path: /^\/recovery-cards\/[^/]+\/actions\/[^/]+\/link-task\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'kpi_recovery_actions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[4] || ''),
      reason:
        'INSERT INTO tasks (results.routes.ts:2113) plus a linkRecoveryActionTask update on kpi_recovery_actions (results.routes.ts:2144-2149), from results.routes.ts:2070-2178. CORRECTION vs the inventory: the JOIN and update target kpi_recovery_actions, not kpi_deviation_actions as RESULTS.json states (verified at results.routes.ts:2094, "FROM kpi_recovery_actions a"). No canonical task-linking route for recovery actions exists.',
    },
    {
      writerId: 'RESULTS-W30',
      method: 'POST',
      path: /^\/recovery-cards\/[^/]+\/checkpoints\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'kpi_recovery_checkpoints',
      reason:
        'INSERT INTO kpi_recovery_checkpoints, kpiRecoveryCardService.ts:1072, from results.routes.ts:2179-2213. No canonical checkpoint sub-resource exists.',
    },
    {
      writerId: 'RESULTS-W31',
      method: 'PUT',
      path: /^\/recovery-cards\/[^/]+\/checkpoints\/[^/]+\/resolve\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'kpi_recovery_checkpoints',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[4] || ''),
      reason:
        'UPDATE kpi_recovery_checkpoints, kpiRecoveryCardService.ts:1119, from results.routes.ts:2214-2253. Same gap as RESULTS-W30.',
    },
    {
      writerId: 'RESULTS-W32',
      method: 'POST',
      path: /^\/recovery-cards\/[^/]+\/close\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'kpi_recovery_cards',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'UPDATE kpi_recovery_cards (two statements), kpiRecoveryCardService.ts:938,1003, from results.routes.ts:2254-2321. No canonical recovery-card close route exists — recovery cards appear to be an intentionally legacy-only concept versus deviation cases/scorecards, which have full vNext parity.',
    },
    {
      writerId: 'RESULTS-W33',
      method: 'POST',
      path: /^\/scorecards\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/kpi/scorecards',
      legacyTable: 'kpi_scorecards',
      reason:
        'INSERT INTO kpi_scorecards, server/src/services/results/kpiScorecardService.ts:226, from results.routes.ts:421-442. Canonical POST /api/vnext/results/kpi/scorecards (server/src/routes/resultsVnext/kpiScorecard.routes.ts:332) writes rvn_kpi_scorecards.',
    },
    {
      writerId: 'RESULTS-W34',
      method: 'PUT',
      path: /^\/scorecards\/[^/]+\/?$/,
      state: 'observed',
      successor: null,
      legacyTable: 'kpi_scorecards',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'UPDATE kpi_scorecards, kpiScorecardService.ts:283, from results.routes.ts:445-472. kpiScorecard.routes.ts only exposes /:scorecardId/items and /:scorecardId/items/reorder (verified: no generic PUT /:scorecardId route exists in that file) — no metadata-update successor.',
    },
    {
      writerId: 'RESULTS-W35',
      method: 'POST',
      path: /^\/scorecards\/[^/]+\/kpis\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/kpi/scorecards/:scorecardId/items',
      legacyTable: 'kpi_scorecard_items',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'UPSERT INTO kpi_scorecard_items, kpiScorecardService.ts:329, from results.routes.ts:475-502. Canonical POST .../items (kpiScorecard.routes.ts:476) writes rvn_kpi_scorecard_items.',
    },
    {
      writerId: 'RESULTS-W36',
      method: 'DELETE',
      path: /^\/scorecards\/[^/]+\/kpis\/[^/]+\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/kpi/scorecards/:scorecardId/items/:itemId',
      legacyTable: 'kpi_scorecard_items',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[4] || ''),
      reason:
        'DELETE FROM kpi_scorecard_items, kpiScorecardService.ts:343, from results.routes.ts:505-520. Canonical DELETE .../items/:itemId (kpiScorecard.routes.ts:519) removes the rvn_kpi_scorecard_items row.',
    },
    {
      writerId: 'RESULTS-W48',
      method: 'PUT',
      path: /^\/roi\/initiative\/[^/]+\/assumptions\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/roi/cases/:caseId/assumptions',
      legacyTable: 'roi_assumptions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[3] || ''),
      reason:
        'INSERT ... ON CONFLICT(initiative_id) DO UPDATE against roi_assumptions, results.routes.ts:3055-3134 (upsert at 3097-3107). Canonical POST /api/vnext/results/roi/cases/:caseId/assumptions (server/src/routes/resultsVnext/roi.routes.ts:937-938) writes rvn_roi_assumptions. roi_assumptions is not one of the append-only-protected tables, so the upsert here is not a governance violation.',
    },
    {
      writerId: 'RESULTS-W49',
      method: 'POST',
      path: /^\/roi\/initiative\/[^/]+\/realized\/?$/,
      state: 'protected',
      successor: '/api/vnext/results/roi/cases/:caseId/actuals',
      legacyTable: 'roi_realized_values',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[3] || ''),
      reason:
        'Pure INSERT into roi_realized_values (no UPDATE/DELETE), results.routes.ts:3141-3202 (insert at 3183-3194) — append-only respected, consistent with the DB-level deny-UPDATE/DELETE trigger on this table (server/migrations/20260809_finance_v3_e007_03_legacy_actual_protection.sql). CORRECTION vs the inventory: RESULTS.json names the successor path as ".../actual-entries", which does not exist in this baseline; the real route is POST /api/vnext/results/roi/cases/:caseId/actuals (verified at server/src/routes/resultsVnext/roi.routes.ts:2283-2284, calling recordActualEntry which writes rvn_roi_actual_entries per server/src/services/resultsVnext/roi/roiActualEntryCommands.ts:272).',
    },
  ],
};
