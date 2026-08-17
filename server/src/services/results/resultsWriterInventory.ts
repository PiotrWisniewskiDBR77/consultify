/**
 * Results writer inventory — the DENOMINATOR for writer observability.
 *
 * WHY THIS FILE IS THE POINT
 * `results_writer_observations` can only ever answer questions about surfaces
 * that are actually instrumented. Without a stated denominator, "no rows for
 * family X" silently reads as "nobody uses X", which is exactly the false
 * conclusion a cutover decision must not be built on. This module states, in
 * repo-owned form, which Results write surfaces are OBSERVED and which are
 * EXPLICITLY_UNOBSERVED — with a reason and an owner blocker for each gap.
 *
 * SCOPE OF THE CURRENT PACKET, STATED HONESTLY
 * This packet instruments a SUBSET: 20 HTTP write sites out of 216 Results write
 * sites, plus 3 non-HTTP service sites. It is NOT a census of Results writers.
 * The un-instrumented remainder is enumerated below rather than omitted, so the
 * gap is visible instead of implied.
 *
 * THEREFORE — BINDING CONSTRAINT ON HOW THIS LEDGER MAY BE USED
 * The absence of observations for ANY surface listed here as
 * EXPLICITLY_UNOBSERVED is NOT evidence of non-use, and MUST NOT be cited as a
 * zero-writer window, as writer-retirement justification, or as cutover
 * authority. Extending coverage requires an explicit owner-approved allowlist of
 * the additional writer paths; it must not be widened silently.
 *
 * COUNTING CONVENTION — THE DENOMINATOR IS DISCOVERED, NOT HAND-LISTED
 * A "write site" is one `router.post|put|patch|delete(...)` registration in a
 * Results route file. The 216 total is produced by FILESYSTEM DISCOVERY:
 * `__tests__/resultsWriterInventory.denominator.test.ts` walks
 * `server/src/routes`, selects every non-test `.ts` whose path matches
 * result/benefit, counts its write sites, and fails if any writer-bearing file is
 * absent from this inventory (or if a listed file no longer exists). So a new
 * Results router cannot quietly shrink the world this ledger claims to describe.
 *
 * One site can mount several endpoints: `kpi.routes.ts`'s `mountLifecycleRoute`
 * factory is a single site serving activate/suspend/archive, which is why 20
 * observed sites cover 22 endpoints. The same test also counts the real
 * observation call sites per file, so removing an `observeWriter` call without
 * reclassifying its entry fails the gate too.
 */
import type { ResultsWriterFamily } from './resultsWriterObservationService.js';

export type ResultsWriterObservationStatus = 'OBSERVED' | 'EXPLICITLY_UNOBSERVED';

export interface ResultsWriterInventoryEntry {
  /** Route file, relative to `server/src/`, or the service module for non-HTTP writers. */
  source: string;
  /** Mount-qualified route prefix, or `service:` for a non-HTTP writer. */
  mount: string;
  methods: Array<'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'SERVICE'>;
  /** Number of `router.post|put|patch|delete` sites in `source` covered by this entry. */
  writeSites: number;
  /** Endpoints served by those sites (differs from writeSites only where a factory mounts several). */
  endpoints: number;
  family: ResultsWriterFamily | null;
  /** Table written, or the business effect for multi-table writers. */
  effect: string;
  status: ResultsWriterObservationStatus;
  /** Where the observation is emitted (OBSERVED), or why there is none (EXPLICITLY_UNOBSERVED). */
  observationSite: string | null;
  reason: string;
  /** Owner decision blocking instrumentation of this surface, when unobserved. */
  ownerBlocker: string | null;
}

/** Surfaces this packet instruments. */
export const OBSERVED_WRITERS: ResultsWriterInventoryEntry[] = [
  {
    source: 'routes/benefits.routes.ts',
    mount: '/api/benefits',
    methods: ['POST', 'PUT', 'DELETE'],
    writeSites: 6,
    endpoints: 6,
    family: 'legacy_kpi_crud',
    effect: 'initiative_kpis, kpi_definition_versions, kpi_time_series, kpi_metric_audit_log',
    status: 'OBSERVED',
    observationSite: 'observeWriter() after each successful write (6 call sites)',
    reason:
      'Legacy KPI CRUD + measurement surface with live production UI callers (KPICreateModal, KPITimeSeriesDrawer, KpiSignalSheetView, ResultsHub).',
    ownerBlocker: null,
  },
  {
    source: 'routes/results-kpi-reports.routes.ts',
    mount: '/api/results',
    methods: ['POST'],
    writeSites: 2,
    endpoints: 2,
    family: 'kpi_reports',
    effect: 'results_kpi_report_snapshots + a Report Builder report artifact',
    status: 'OBSERVED',
    observationSite: 'observeWriter() after createSnapshot / refreshSnapshot',
    reason: 'KPI report snapshot create + refresh, both with a live UI caller (ResultsKpiReportsView).',
    ownerBlocker: null,
  },
  {
    source: 'routes/resultsVnext/kpi.routes.ts',
    mount: '/api/vnext/results/kpi',
    methods: ['POST', 'PUT'],
    writeSites: 11,
    endpoints: 13,
    family: 'vnext_kpi',
    effect: 'rvn_kpi_definitions, rvn_kpi_definition_versions, rvn_kpi_measurements, rvn_platform_events',
    status: 'OBSERVED',
    observationSite: 'observeVnextKpiWriter() at 11 sites; the lifecycle factory site covers 3 endpoints',
    reason:
      'The vNext KPI lifecycle/measurement writers — the successor candidate whose real usage the cutover question is about.',
    ownerBlocker: null,
  },
  {
    source: 'routes/v8/results.routes.ts',
    mount: '/api/v8/results',
    methods: ['POST'],
    writeSites: 1,
    endpoints: 1,
    family: 'results_finance',
    effect: 'v8_kpi_finance_reconciliations',
    status: 'OBSERVED',
    observationSite: 'observeWriter() after pullAndReconcileInitiative in POST /reconciliations/pull',
    reason:
      'Results -> Finance reconciliation. Instrumented at the HANDLER, not in the service: healthProbeService calls pullAndReconcileInitiative directly, and probe traffic must not count as real usage.',
    ownerBlocker: null,
  },
  {
    source: 'services/closureDeliveryReceiptService.ts',
    mount: 'service:closureDeliveryReceiptService.deliver#results',
    methods: ['SERVICE'],
    writeSites: 1,
    endpoints: 0,
    family: 'execution_results',
    effect: 'initiative_benefits (via executionResultsBridge.handoffFromClosure)',
    status: 'OBSERVED',
    observationSite: 'observeWriter() after the terminal DELIVERED transaction commits',
    reason:
      'Execution -> Results has no HTTP handler; this is the real business call site. Instrumented here, not in the bridge, because healthProbeService calls the bridge twice per probe run.',
    ownerBlocker: null,
  },
  {
    source: 'services/executionBudgetService.ts',
    mount: 'service:executionBudgetService.{createBudgetEntry,deleteBudgetEntry}',
    methods: ['SERVICE'],
    writeSites: 2,
    endpoints: 0,
    family: 'execution_results',
    effect: 'budget health export into Results (via executionResultsBridge.fireBudgetHealthExport)',
    status: 'OBSERVED',
    observationSite: 'observeWriter() after each fireBudgetHealthExport dispatch',
    reason: 'Second real Execution -> Results business call site, same probe-pollution rationale.',
    ownerBlocker: null,
  },
];

/**
 * Surfaces this packet deliberately does NOT observe. Enumerated so the gap is
 * measurable. Grouped at router granularity: per-endpoint instrumentation of
 * these requires an owner-approved allowlist, which does not exist yet.
 */
export const UNOBSERVED_WRITERS: ResultsWriterInventoryEntry[] = [
  {
    source: 'routes/benefits.routes.ts',
    mount: '/api/benefits',
    methods: ['POST', 'PUT', 'DELETE'],
    writeSites: 15,
    endpoints: 15,
    family: null,
    effect:
      'kpi_deviation_cases + actions (6 sites), kpi-mappings (2), ROI assumptions/realized (2), attribution snapshot (1), financial statement-lines and kpi-mappings (3), iris asset search (1)',
    status: 'EXPLICITLY_UNOBSERVED',
    observationSite: null,
    reason:
      'Same router as an observed family, but different writer families (deviation, attribution, financial mapping, ROI) that this packet was not scoped to enumerate or classify.',
    ownerBlocker:
      'Needs an owner-approved allowlist of these paths plus a decision on which writer_family each belongs to (the CHECK constraint has no value for deviation/attribution/financial-mapping today).',
  },
  {
    source: 'routes/benefitsRegister.routes.ts',
    mount: '/api/benefits-register',
    methods: ['POST'],
    writeSites: 3,
    endpoints: 3,
    family: null,
    effect: 'initiative_benefits (benefit create, closure handoff, promote-to-KPI)',
    status: 'EXPLICITLY_UNOBSERVED',
    observationSite: null,
    reason:
      'A SECOND Execution -> Results write path, distinct from the instrumented service call sites. Its handoff goes through BenefitsRegisterService.handoffFromClosure, which the code documents as deprecated relative to the bridge.',
    ownerBlocker:
      'Owner must decide whether this deprecated path is retained (then instrument it) or retired; instrumenting a path slated for removal would create a misleading denominator.',
  },
  {
    source: 'routes/v8/results.routes.ts',
    mount: '/api/v8/results',
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    writeSites: 44,
    endpoints: 44,
    family: null,
    effect:
      'v8 deviation cases/actions, recovery cards and experiments, report snapshots, scorecards, KPI definition and measurement writers',
    status: 'EXPLICITLY_UNOBSERVED',
    observationSite: null,
    reason:
      'The largest single Results write surface. Only the Finance reconciliation endpoint was in this packet scope; the other 44 sites span several families that were never enumerated here.',
    ownerBlocker:
      'Needs an owner-approved allowlist. This is the biggest reason no zero-writer claim can be made from this ledger today.',
  },
  {
    source: 'routes/results-enterprise.routes.ts',
    mount: '/api/results-v4',
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    writeSites: 11,
    endpoints: 11,
    family: null,
    effect: 'enterprise Results runtime (scheduling, wallboards, connectors)',
    status: 'EXPLICITLY_UNOBSERVED',
    observationSite: null,
    reason: 'Separate enterprise Results router, outside this packet scope.',
    ownerBlocker: 'Needs an owner-approved allowlist and a family classification.',
  },
  {
    source: 'routes/resultsStrategic.routes.ts',
    mount: '/api/results-strategic',
    methods: ['POST', 'PUT', 'DELETE'],
    writeSites: 9,
    endpoints: 9,
    family: null,
    effect: 'BSC / benefit-dependency-network / narrative writers',
    status: 'EXPLICITLY_UNOBSERVED',
    observationSite: null,
    reason: 'Separate strategic Results router, outside this packet scope.',
    ownerBlocker: 'Needs an owner-approved allowlist and a family classification.',
  },
  {
    source: 'routes/resultsVnext/kpiDeviation.routes.ts',
    mount: '/api/vnext/results/kpi/deviation-cases',
    methods: ['POST', 'PUT', 'PATCH'],
    writeSites: 11,
    endpoints: 11,
    family: null,
    effect: 'rvn_kpi_deviation_cases and related command writers',
    status: 'EXPLICITLY_UNOBSERVED',
    observationSite: null,
    reason:
      'vNext deviation-case writers. In scope for the cutover question but not for this packet, which was scoped to the KPI lifecycle/measurement router only.',
    ownerBlocker:
      'Needs an owner-approved allowlist; likely also a new writer_family value, since these are not KPI definition writers.',
  },
  {
    source: 'routes/resultsVnext/kpiScorecard.routes.ts',
    mount: '/api/vnext/results/kpi/scorecards',
    methods: ['POST', 'PATCH', 'DELETE'],
    writeSites: 7,
    endpoints: 7,
    family: null,
    effect: 'rvn_kpi_scorecards, scorecard items and snapshots',
    status: 'EXPLICITLY_UNOBSERVED',
    observationSite: null,
    reason: 'vNext scorecard writers, outside this packet scope.',
    ownerBlocker: 'Needs an owner-approved allowlist and a family classification.',
  },
  {
    source: 'routes/resultsVnext/kpiPerspectives.routes.ts',
    mount: '/api/vnext/results/kpi (+ /api/vnext/results/initiatives)',
    methods: ['POST'],
    writeSites: 4,
    endpoints: 4,
    family: null,
    effect: 'rvn_kpi_initiative_impacts and perspective writers',
    status: 'EXPLICITLY_UNOBSERVED',
    observationSite: null,
    reason: 'vNext perspectives / initiative-impact writers, outside this packet scope.',
    ownerBlocker: 'Needs an owner-approved allowlist and a family classification.',
  },
  {
    source: 'routes/resultsVnext/roi.routes.ts',
    mount: '/api/vnext/results/roi',
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    writeSites: 49,
    endpoints: 49,
    family: null,
    effect: 'rvn_roi_cases, economic models, forecast/actual, PIR snapshots, finance links',
    status: 'EXPLICITLY_UNOBSERVED',
    observationSite: null,
    reason:
      'The entire vNext ROI domain. This packet covered KPI only; ROI has its own cutover question and its own owner decision.',
    ownerBlocker: 'Needs an owner-approved allowlist. No ROI usage conclusion may be drawn from this ledger.',
  },
  {
    source: 'routes/resultsVnext/okr.routes.ts',
    mount: '/api/vnext/results/okr',
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    writeSites: 43,
    endpoints: 43,
    family: null,
    effect: 'rvn_okr / okr_vnext sets, objectives, key results, cycles, programs',
    status: 'EXPLICITLY_UNOBSERVED',
    observationSite: null,
    reason:
      'The entire vNext OKR domain. This packet covered KPI only; OKR has its own cutover question and its own owner decision.',
    ownerBlocker: 'Needs an owner-approved allowlist. No OKR usage conclusion may be drawn from this ledger.',
  },
];

export const RESULTS_WRITER_INVENTORY: ResultsWriterInventoryEntry[] = [
  ...OBSERVED_WRITERS,
  ...UNOBSERVED_WRITERS,
];

const sum = (entries: ResultsWriterInventoryEntry[], key: 'writeSites' | 'endpoints'): number =>
  entries.reduce((total, entry) => total + entry[key], 0);

/**
 * The denominator, in one place. `observedHttpWriteSites` out of
 * `totalHttpWriteSites` is the honest coverage ratio of this packet.
 */
export const RESULTS_WRITER_DENOMINATOR = {
  /** All `router.post|put|patch|delete` sites across the Results route files. */
  get totalHttpWriteSites(): number {
    return sum(
      RESULTS_WRITER_INVENTORY.filter((e) => e.source.startsWith('routes/')),
      'writeSites'
    );
  },
  get observedHttpWriteSites(): number {
    return sum(
      OBSERVED_WRITERS.filter((e) => e.source.startsWith('routes/')),
      'writeSites'
    );
  },
  get unobservedHttpWriteSites(): number {
    return sum(
      UNOBSERVED_WRITERS.filter((e) => e.source.startsWith('routes/')),
      'writeSites'
    );
  },
  /** Non-HTTP (service-level) observation sites, e.g. Execution -> Results. */
  get observedServiceWriteSites(): number {
    return sum(
      OBSERVED_WRITERS.filter((e) => e.source.startsWith('services/')),
      'writeSites'
    );
  },
  get observedEndpoints(): number {
    return sum(OBSERVED_WRITERS, 'endpoints');
  },
} as const;

/**
 * Single sentence every consumer of this ledger must respect. Kept as an
 * exported constant so a report or dashboard can quote it verbatim instead of
 * paraphrasing the limitation away.
 */
export const RESULTS_WRITER_OBSERVABILITY_CAVEAT =
  'Invocation telemetry over an enumerated subset of Results writers, recorded best-effort. ' +
  'Presence of an observation proves a writer ran; absence proves nothing. ' +
  'Not durable proof, not a zero-writer window, not cutover authority.';
