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
 * Scorecard writers W33/W35/W36, deviation command writers
 * W19/W20/W21/W22/W24, and the legacy ROI plan/actual writers W48/W49 are
 * retired slices. Their historical readers and the unmapped W23 resolve
 * command stay mounted; mapped mutation work is owned by the canonical vNext
 * tools.
 * Every other writer remains protected/observed until its own caller and
 * identity migration are proven.
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
      state: 'disabled',
      successor: '/api/vnext/results/kpi',
      legacyTable: 'initiative_kpis',
      reason:
        'Retired after every mounted Results create caller moved to the canonical KPI registry. Canonical POST /api/vnext/results/kpi owns governed definition creation.',
    },
    {
      writerId: 'RESULTS-W02',
      method: 'PUT',
      path: /^\/kpis\/[^/]+\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/:kpiId/draft',
      legacyTable: 'initiative_kpis',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Retired after mounted editing moved to the canonical definition lifecycle. Canonical draft edit must be submitted and independently approved before it becomes active; direct in-place legacy mutation is no longer offered.',
    },
    {
      writerId: 'RESULTS-W03',
      method: 'DELETE',
      path: /^\/kpis\/[^/]+\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/:kpiId/archive',
      legacyTable: 'initiative_kpis',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Retired after every mounted Results archive/delete caller moved to the canonical KPI registry. Canonical POST /api/vnext/results/kpi/:kpiId/archive owns governed archival.',
    },
    {
      writerId: 'RESULTS-W04',
      method: 'POST',
      path: /^\/kpis\/[^/]+\/time-series\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/:kpiId/measurements',
      legacyTable: 'kpi_time_series',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Retired after mounted recording moved to canonical measurements. recordMeasurement evaluates the immutable definition version and atomically opens/escalates rvn_kpi_deviation_cases in the same pinned transaction.',
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
        "INSERT initiative_kpis via createKpiDefinition (results.routes.ts:4212) plus UPDATE initiative_benefits SET status='promoted' (results.routes.ts:4227-4232), from results.routes.ts:4143-4239. No route under /api/vnext/results/roi or /kpi composes the combined benefit-promote-to-KPI operation against rvn_roi_benefit_lines + rvn_kpi_definitions together, so successor is null even though the KPI half alone has a sibling (RESULTS-W01).",
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
        "UPDATE initiative_benefits SET status='dismissed', results.routes.ts:4245-4280. No rvn_roi_* route dismisses a benefit line; initiative_benefits has no confirmed canonical successor anywhere in this baseline.",
    },
    {
      writerId: 'RESULTS-W17',
      method: 'POST',
      path: /^\/kpi-mappings\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/initiatives/initiative-impacts',
      legacyTable: 'initiative_kpi_mappings',
      reason:
        'Retired after every mounted Results mapping caller moved to the canonical KPI registry/tool. Canonical POST /initiative-impacts owns governed initiative impact proposals.',
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
      state: 'disabled',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/acknowledge',
      legacyTable: 'kpi_deviation_cases',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Retired after its mounted caller became read-only for acknowledgement. Canonical POST .../acknowledge owns acknowledgement writes in rvn_kpi_deviation_cases.',
    },
    {
      writerId: 'RESULTS-W20',
      method: 'PUT',
      path: /^\/deviation-cases\/[^/]+\/rca\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/root-cause',
      legacyTable: 'kpi_deviation_cases',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Retired after its mounted caller became read-only for RCA persistence. Canonical PUT .../root-cause owns root-cause writes in rvn_kpi_deviation_cases.',
    },
    {
      writerId: 'RESULTS-W21',
      method: 'POST',
      path: /^\/deviation-cases\/[^/]+\/actions\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/corrective-actions',
      legacyTable: 'kpi_deviation_actions',
      reason:
        'Retired after its mounted caller became read-only for action creation. Canonical POST .../corrective-actions owns action creation.',
    },
    {
      writerId: 'RESULTS-W22',
      method: 'PUT',
      path: /^\/deviation-cases\/[^/]+\/actions\/[^/]+\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/corrective-actions/:actionId',
      legacyTable: 'kpi_deviation_actions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[4] || ''),
      reason:
        'Retired after its mounted caller became read-only for action updates. Canonical PATCH .../corrective-actions/:actionId owns action updates.',
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
      state: 'disabled',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/close',
      legacyTable: 'kpi_deviation_cases',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Retired after its mounted caller became read-only for closure. Canonical POST .../close owns governed closure writes.',
    },
    {
      writerId: 'RESULTS-W25',
      method: 'POST',
      path: /^\/deviation-cases\/[^/]+\/recovery-card\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/deviation-cases/:caseId/recovery-card',
      legacyTable: 'kpi_recovery_cards',
      reason:
        'Retired after mounted create moved to the canonical deviation-case-owned recovery-card command with current authorization, durable idempotency, event/outbox atomicity and exact cold readback.',
    },
    {
      writerId: 'RESULTS-W26',
      method: 'PUT',
      path: /^\/recovery-cards\/[^/]+\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/recovery-cards/:cardId',
      legacyTable: 'kpi_recovery_cards',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Retired after mounted edit moved to the canonical recovery-card CAS command with current authorization, durable idempotency, event/outbox atomicity and exact cold readback.',
    },
    {
      writerId: 'RESULTS-W27',
      method: 'POST',
      path: /^\/recovery-cards\/[^/]+\/actions\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/recovery-cards/:cardId/actions',
      legacyTable: 'kpi_recovery_actions',
      reason:
        'Retired after the mounted Recovery Card caller moved to the canonical action create command with tenant authorization, durable idempotency and cold readback.',
    },
    {
      writerId: 'RESULTS-W28',
      method: 'PUT',
      path: /^\/recovery-cards\/[^/]+\/actions\/[^/]+\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/recovery-cards/:cardId/actions/:actionId',
      legacyTable: 'kpi_recovery_actions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[4] || ''),
      reason:
        'Retired after the mounted caller moved to canonical action CAS updates.',
    },
    {
      writerId: 'RESULTS-W29',
      method: 'POST',
      path: /^\/recovery-cards\/[^/]+\/actions\/[^/]+\/link-task\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/recovery-cards/:cardId/actions/:actionId/link-task',
      legacyTable: 'kpi_recovery_actions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[4] || ''),
      reason:
        'Retired after task creation and canonical action linking moved into one pinned transaction with CAS and durable idempotency.',
    },
    {
      writerId: 'RESULTS-W30',
      method: 'POST',
      path: /^\/recovery-cards\/[^/]+\/checkpoints\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/recovery-cards/:cardId/checkpoints',
      legacyTable: 'kpi_recovery_checkpoints',
      reason:
        'Retired after the mounted caller moved to canonical idempotent checkpoint creation.',
    },
    {
      writerId: 'RESULTS-W31',
      method: 'PUT',
      path: /^\/recovery-cards\/[^/]+\/checkpoints\/[^/]+\/resolve\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/recovery-cards/:cardId/checkpoints/:checkpointId',
      legacyTable: 'kpi_recovery_checkpoints',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[4] || ''),
      reason:
        'Retired after the mounted caller moved to canonical checkpoint CAS resolution with exact KPI measurement ownership checks.',
    },
    {
      writerId: 'RESULTS-W32',
      method: 'POST',
      path: /^\/recovery-cards\/[^/]+\/close\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/recovery-cards/:cardId/close',
      legacyTable: 'kpi_recovery_cards',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Retired after mounted close moved to the canonical recovery-card command. The existing evidence/fresh-measurement/threshold state machine now runs inside the same pinned event transaction with durable replay and exact cold readback.',
    },
    {
      writerId: 'RESULTS-W33',
      method: 'POST',
      path: /^\/scorecards\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/scorecards',
      legacyTable: 'kpi_scorecards',
      reason:
        'Retired after the only live UI caller moved to createKpiScorecard. Canonical POST /api/vnext/results/kpi/scorecards writes rvn_kpi_scorecards with tenant scoping, idempotency and row-version state.',
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
      state: 'disabled',
      successor: '/api/vnext/results/kpi/scorecards/:scorecardId/items',
      legacyTable: 'kpi_scorecard_items',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[2] || ''),
      reason:
        'Retired after the only live UI caller moved to addKpiScorecardItem. Canonical POST .../items writes rvn_kpi_scorecard_items using the server-returned scorecard rowVersion.',
    },
    {
      writerId: 'RESULTS-W36',
      method: 'DELETE',
      path: /^\/scorecards\/[^/]+\/kpis\/[^/]+\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/kpi/scorecards/:scorecardId/items/:itemId',
      legacyTable: 'kpi_scorecard_items',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[4] || ''),
      reason:
        'Retired after the only live UI caller moved from legacy kpiId deletion to canonical itemId deletion. Canonical DELETE .../items/:itemId removes rvn_kpi_scorecard_items using the server-returned scorecard rowVersion.',
    },
    {
      writerId: 'RESULTS-W48',
      method: 'PUT',
      path: /^\/roi\/initiative\/[^/]+\/assumptions\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/roi/cases/:caseId/assumptions',
      legacyTable: 'roi_assumptions',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[3] || ''),
      reason:
        'Retired after every mounted legacy drawer became archive-read-only and points users to the full canonical ROI Case tool. Canonical POST /api/vnext/results/roi/cases/:caseId/assumptions owns assumption writes with case identity, CAS, idempotency and audit reason; the legacy initiative aggregate is not mechanically translated into a canonical case.',
    },
    {
      writerId: 'RESULTS-W49',
      method: 'POST',
      path: /^\/roi\/initiative\/[^/]+\/realized\/?$/,
      state: 'disabled',
      successor: '/api/vnext/results/roi/cases/:caseId/actuals',
      legacyTable: 'roi_realized_values',
      legacyIdFromPath: (path) => decodeURIComponent(path.split('/')[3] || ''),
      reason:
        'Retired after every mounted legacy drawer became archive-read-only and points users to the full canonical ROI Case tool. Canonical POST /api/vnext/results/roi/cases/:caseId/actuals owns actual-entry writes with case/line identity, CAS, idempotency and evidence. The legacy initiative writer remains readable historically but cannot accept new mutations.',
    },
  ],
};

/** Machine-readable denominator used by cutover gates and status tooling. */
export const RESULTS_LEGACY_CUTOVER_DENOMINATOR = Object.freeze({
  totalDoors: RESULTS_CUTOVER.writers.length,
  retiredDoors: RESULTS_CUTOVER.writers
    .filter((writer) => writer.state === 'disabled')
    .map((writer) => writer.writerId),
  openDoors: RESULTS_CUTOVER.writers
    .filter((writer) => writer.state !== 'disabled')
    .map((writer) => writer.writerId),
  successorBackedDoors: RESULTS_CUTOVER.writers
    .filter((writer) => writer.successor !== null)
    .map((writer) => writer.writerId),
  unmappedDoors: RESULTS_CUTOVER.writers
    .filter((writer) => writer.successor === null)
    .map((writer) => writer.writerId),
});
