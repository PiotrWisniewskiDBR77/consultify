/**
 * RN-G2 P1 — dev-render host for the REAL `<ResultsKpiRegistryPage>`
 * (`src/components/ResultsVNext/ResultsKpiRegistryPage.tsx`) — no
 * reimplementation, the production component mounted with `Api.get`/
 * `Api.post` stubbed for `/vnext/results/kpi*` (pattern: patch `Api.get`
 * METHODS, not `window.fetch` — MEMORY "Gen.Deck/Gen.Excel nadganianie").
 *
 * Five mock KPIs cover every lifecycle status (draft/pending_approval/
 * active/suspended/archived), an owned-vs-not-owned split (My/Org tabs), a
 * null owner (honest "—"), and both a measured (`kpi-1`/`kpi-4`, real
 * `actualValue`) and never-measured (`kpi-2`/`kpi-3`/`kpi-5`, honest `null`
 * — never a fabricated 0) row so `HonestValueCell` renders both branches.
 *
 * -- RN-G2 §G #7 (2026-08-10) FIX: this screen was DEAD on every render
 * (blank page, hard error, not merely a cosmetic console warning — see the
 * smoke screenshot at
 * `docs/qa/screens/rn-g2-kpi-measurements-2026-08-10/00-smoke-registry-unchanged.png`
 * taken BEFORE this fix) — `ResultsKpiRegistryPage.tsx`'s "Scorecards" tab
 * (RN-G2 P1 #8) added an unconditional `useNavigate()` call, and this
 * screen never mounted a Router ancestor. `results-vnext-kpi-scorecards.tsx`
 * (the sibling screen added in that same package) worked around this by
 * NOT mounting the real page — this screen instead fixes the actual gap
 * with a `MemoryRouter`, the same precedent already used by
 * `idea-table.tsx`/`assessment-initiatives-table.tsx`/etc., so the REAL
 * production component keeps being what's mounted here (the harness's own
 * stated doctrine, see above) rather than adding a second bespoke
 * reimplementation to keep in sync.
 *
 * URL params:
 *   ?screen=results-vnext-kpi-registry
 *   &state=ready|loading|empty|error      (default ready) — top-level KPI list
 *   &measState=ready|loading|empty|error  (default ready) — INDEPENDENT of
 *                                          `state`, see const doc above; only
 *                                          affects the measurements sub-view
 *                                          reached by clicking a row then
 *                                          "Otwórz pomiary"
 *   &kpiId=<id>                        deep-link smoke: 'kpi-1' resolves,
 *                                       anything else 404s -> forbidden state
 *   &ff=off                            force the flag OFF (disabled panel)
 *
 * RN-G5 (2026-08-12) — create/edit/submit/approve/reject mocks, mirroring
 * the real routes' contract (`kpi.routes.ts`/`kpiDefinitionCommands.ts`):
 * every GET response below is STILL the bare `rvn_kpi_definitions` row
 * (kpiCode/status/owner only, no name/geometry — see the real
 * `kpiRepository.ts`'s `getKpi`/`listKpis`, bare `SELECT kd.*`) — the mock
 * deliberately does NOT enrich GET with version data the real backend can't
 * produce; only the five WRITE endpoints' responses carry the version, same
 * as production. A floating "Przełącz aktora" button (bottom-right, harness
 * chrome only — not part of any production component) swaps
 * `useAppStore`'s `currentUser` between two fixed identities WITHOUT
 * unmounting the page, so a create->edit->submit->approve click-through can
 * demonstrate the self-approval denial (same actor tries to approve their
 * own submission -> 403) and then a second actor approving successfully —
 * both against the SAME in-memory `knownVersions` the production component
 * holds, exactly like two different real logged-in sessions would use two
 * different JWTs against the same server-held CAS state.
 */
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ResultsKpiRegistryPage } from '../../src/components/ResultsVNext/ResultsKpiRegistryPage';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const ACTOR_PIOTR = {
  id: 'user-piotr-demo',
  firstName: 'Piotr',
  lastName: 'Wiśniewski',
  email: 'piotr.wisniewski@dbr77.com',
  companyName: 'DBR77 Sp. z o.o.',
  role: 'ADMIN',
  status: 'active',
  isAuthenticated: true,
  accessLevel: 'full',
  preferredLanguage: 'pl',
  organizationId: 'org-dbr77-demo',
  organizationName: 'DBR77 Sp. z o.o.',
  isDemo: true,
} as any;

const ACTOR_ANNA = {
  ...ACTOR_PIOTR,
  id: 'user-anna',
  firstName: 'Anna',
  lastName: 'Kowalska',
  email: 'anna.kowalska@dbr77.com',
} as any;

function currentActorId(): string {
  return useAppStore.getState().currentUser?.id ?? 'user-piotr-demo';
}

const params = new URLSearchParams(window.location.search);
const state = params.get('state') || 'ready';
// RN-G2 §G #7 — INDEPENDENT of `state` above (which already gates the
// top-level KPI list): the measurements panel is only reachable by clicking
// INTO a KPI row first, so tying its own ready/loading/empty/error to the
// SAME `state` param would make it impossible to screenshot e.g. "list ready,
// measurements loading" via a `--click` chain (an error/loading top-level
// list blocks the click before the panel is ever reached).
const measState = params.get('measState') || 'ready';
const flagOff = params.get('ff') === 'off';

if (!flagOff) {
  try {
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
  } catch {
    // no-op — dev-render only
  }
}

interface MockKpi {
  kpiId: string;
  organizationId: string;
  kpiCode: string;
  status: 'draft' | 'pending_approval' | 'active' | 'suspended' | 'archived';
  currentDefinitionVersionId: string | null;
  primaryProcessId: string | null;
  responsePolicyId: string | null;
  ownerUserId: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const MOCK_KPIS: MockKpi[] = [
  {
    kpiId: 'kpi-1',
    organizationId: 'org-dbr77-demo',
    kpiCode: 'OEE-LINIA-PAKOWANIA',
    status: 'active',
    currentDefinitionVersionId: 'ver-1',
    primaryProcessId: 'proc-produkcja-1',
    responsePolicyId: null,
    ownerUserId: 'user-piotr-demo',
    rowVersion: 3,
    createdBy: 'user-piotr-demo',
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-08-08T10:00:00Z',
  },
  {
    kpiId: 'kpi-2',
    organizationId: 'org-dbr77-demo',
    kpiCode: 'AUDYT-DOSTAWCY-POKRYCIE',
    status: 'draft',
    currentDefinitionVersionId: 'ver-2',
    primaryProcessId: null,
    responsePolicyId: null,
    ownerUserId: 'user-anna',
    rowVersion: 1,
    createdBy: 'user-anna',
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z',
  },
  {
    kpiId: 'kpi-3',
    organizationId: 'org-dbr77-demo',
    kpiCode: 'KOSZT-PRACY-REDUKCJA',
    status: 'suspended',
    currentDefinitionVersionId: 'ver-3',
    primaryProcessId: 'proc-hr-1',
    responsePolicyId: null,
    ownerUserId: 'user-marek',
    rowVersion: 5,
    createdBy: 'user-marek',
    createdAt: '2026-05-12T08:00:00Z',
    updatedAt: '2026-08-05T09:30:00Z',
  },
  {
    kpiId: 'kpi-4',
    organizationId: 'org-dbr77-demo',
    kpiCode: 'CYKL-ZAMKNIECIA-MIESIACA',
    status: 'archived',
    currentDefinitionVersionId: 'ver-4',
    primaryProcessId: 'proc-finanse-1',
    responsePolicyId: null,
    ownerUserId: 'user-piotr-demo',
    rowVersion: 8,
    createdBy: 'user-piotr-demo',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-07-30T08:00:00Z',
  },
  {
    kpiId: 'kpi-5',
    organizationId: 'org-dbr77-demo',
    kpiCode: 'ZGLOSZENIA-DO-ZATWIERDZENIA',
    status: 'pending_approval',
    currentDefinitionVersionId: 'ver-5',
    primaryProcessId: null,
    responsePolicyId: null,
    ownerUserId: null,
    rowVersion: 1,
    createdBy: 'user-anna',
    createdAt: '2026-08-06T08:00:00Z',
    updatedAt: '2026-08-06T08:00:00Z',
  },
];

// RN-G5 (2026-08-12) — definition-version fixtures, one per MOCK_KPIS row's
// `currentDefinitionVersionId`. NEVER returned by any GET mock below (see
// file header) — only readable through the write-endpoint mocks, exactly
// mirroring the real backend gap `kpiApi.ts`'s RN-G5 note documents.
interface MockKpiDefinitionVersion {
  definitionVersionId: string;
  kpiId: string;
  organizationId: string;
  versionNumber: number;
  name: string;
  description: string | null;
  unit: string | null;
  targetGeometry: 'threshold_min' | 'threshold_max' | 'range' | 'exact' | 'binary' | 'custom';
  targetValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  warningLow: number | null;
  warningHigh: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  binarySuccessValue: number | null;
  formulaText: string | null;
  approvalStatus: 'draft' | 'submitted' | 'approved' | 'rejected';
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  rowVersion: number;
}

const MOCK_KPI_VERSIONS: Record<string, MockKpiDefinitionVersion> = {
  'ver-1': {
    definitionVersionId: 'ver-1', kpiId: 'kpi-1', organizationId: 'org-dbr77-demo', versionNumber: 1,
    name: 'OEE linii pakowania', description: 'Całkowita efektywność wyposażenia dla linii L3.', unit: '%',
    targetGeometry: 'threshold_min', targetValue: 85, targetMin: null, targetMax: null,
    warningLow: 75, warningHigh: null, criticalLow: 60, criticalHigh: null, binarySuccessValue: null, formulaText: null,
    approvalStatus: 'approved', effectiveFrom: '2026-06-01T08:00:00Z', effectiveTo: null,
    createdBy: 'user-piotr-demo', createdAt: '2026-06-01T08:00:00Z', updatedAt: '2026-06-01T09:00:00Z',
    submittedBy: 'user-piotr-demo', submittedAt: '2026-06-01T08:30:00Z',
    approvedBy: 'user-anna', approvedAt: '2026-06-01T09:00:00Z',
    rejectedBy: null, rejectedAt: null, rejectionReason: null, rowVersion: 3,
  },
  'ver-2': {
    definitionVersionId: 'ver-2', kpiId: 'kpi-2', organizationId: 'org-dbr77-demo', versionNumber: 1,
    name: 'Pokrycie audytów dostawców', description: null, unit: '%',
    targetGeometry: 'threshold_min', targetValue: 90, targetMin: null, targetMax: null,
    warningLow: 75, warningHigh: null, criticalLow: null, criticalHigh: null, binarySuccessValue: null, formulaText: null,
    approvalStatus: 'draft', effectiveFrom: null, effectiveTo: null,
    createdBy: 'user-anna', createdAt: '2026-08-01T08:00:00Z', updatedAt: '2026-08-01T08:00:00Z',
    submittedBy: null, submittedAt: null, approvedBy: null, approvedAt: null,
    rejectedBy: null, rejectedAt: null, rejectionReason: null, rowVersion: 1,
  },
  'ver-3': {
    definitionVersionId: 'ver-3', kpiId: 'kpi-3', organizationId: 'org-dbr77-demo', versionNumber: 1,
    name: 'Redukcja kosztów pracy', description: null, unit: 'PLN',
    targetGeometry: 'threshold_max', targetValue: 500000, targetMin: null, targetMax: null,
    warningLow: null, warningHigh: 550000, criticalLow: null, criticalHigh: 600000, binarySuccessValue: null, formulaText: null,
    approvalStatus: 'approved', effectiveFrom: '2026-05-12T08:00:00Z', effectiveTo: null,
    createdBy: 'user-marek', createdAt: '2026-05-12T08:00:00Z', updatedAt: '2026-05-12T09:00:00Z',
    submittedBy: 'user-marek', submittedAt: '2026-05-12T08:30:00Z',
    approvedBy: 'user-piotr-demo', approvedAt: '2026-05-12T09:00:00Z',
    rejectedBy: null, rejectedAt: null, rejectionReason: null, rowVersion: 3,
  },
  'ver-4': {
    definitionVersionId: 'ver-4', kpiId: 'kpi-4', organizationId: 'org-dbr77-demo', versionNumber: 1,
    name: 'Cykl zamknięcia miesiąca', description: null, unit: 'dni',
    targetGeometry: 'threshold_max', targetValue: 5, targetMin: null, targetMax: null,
    warningLow: null, warningHigh: 7, criticalLow: null, criticalHigh: 10, binarySuccessValue: null, formulaText: null,
    approvalStatus: 'approved', effectiveFrom: '2026-01-10T08:00:00Z', effectiveTo: null,
    createdBy: 'user-piotr-demo', createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-01-10T09:00:00Z',
    submittedBy: 'user-piotr-demo', submittedAt: '2026-01-10T08:30:00Z',
    approvedBy: 'user-anna', approvedAt: '2026-01-10T09:00:00Z',
    rejectedBy: null, rejectedAt: null, rejectionReason: null, rowVersion: 3,
  },
  'ver-5': {
    definitionVersionId: 'ver-5', kpiId: 'kpi-5', organizationId: 'org-dbr77-demo', versionNumber: 1,
    name: 'Zgłoszenia do zatwierdzenia', description: null, unit: 'szt.',
    targetGeometry: 'exact', targetValue: 0, targetMin: null, targetMax: null,
    warningLow: 0, warningHigh: 2, criticalLow: null, criticalHigh: 5, binarySuccessValue: null, formulaText: null,
    approvalStatus: 'submitted', effectiveFrom: null, effectiveTo: null,
    createdBy: 'user-anna', createdAt: '2026-08-06T08:00:00Z', updatedAt: '2026-08-06T08:00:00Z',
    submittedBy: 'user-anna', submittedAt: '2026-08-06T08:00:00Z',
    approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null, rejectionReason: null, rowVersion: 1,
  },
};

let mockKpiSeq = 0;
function nextMockKpiId(): string {
  mockKpiSeq += 1;
  return `kpi-new-${mockKpiSeq}`;
}
let mockVersionSeq = 0;
function nextMockVersionId(): string {
  mockVersionSeq += 1;
  return `ver-new-${mockVersionSeq}`;
}

interface MockMeasurement {
  measurementId: string;
  kpiId: string;
  definitionVersionId: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  actualValue: number | null;
  performanceStatus: 'on_target' | 'warning' | 'critical' | 'neutral';
  dataQualityStatus: 'unverified' | 'verified' | 'disputed' | 'estimated';
  correctionOfMeasurementId: string | null;
  correctionReason: string | null;
  source: string;
  evidenceRefs: unknown[];
  notes: string | null;
  recordedBy: string;
  recordedAt: string;
}

// RN-G2 §G #7 — richer fixtures for kpi-1 covering the full QA matrix in one
// KPI: a corrected chain (meas-1a -> 1b -> verified 1c), a real ZERO value
// disputed (meas-1d -> 1e), and a MISSING (null) value never corrected
// (meas-1f) — adjacent to the zero-value row once sorted by period desc, so
// a single "Bieżące" screenshot proves 0 vs null render differently
// (`docs/qa/screens/rn-g2-kpi-measurements-2026-08-10/`).
const MOCK_MEASUREMENTS: Record<string, MockMeasurement[]> = {
  'kpi-1': [
    {
      measurementId: 'meas-1a',
      kpiId: 'kpi-1',
      definitionVersionId: 'ver-1',
      organizationId: 'org-dbr77-demo',
      periodStart: '2026-08-01T00:00:00Z',
      periodEnd: '2026-08-07T23:59:59Z',
      actualValue: 74,
      performanceStatus: 'warning',
      dataQualityStatus: 'unverified',
      correctionOfMeasurementId: null,
      correctionReason: null,
      source: 'manual',
      evidenceRefs: [],
      notes: null,
      recordedBy: 'user-anna',
      recordedAt: '2026-08-08T09:00:00Z',
    },
    {
      measurementId: 'meas-1b',
      kpiId: 'kpi-1',
      definitionVersionId: 'ver-1',
      organizationId: 'org-dbr77-demo',
      periodStart: '2026-08-01T00:00:00Z',
      periodEnd: '2026-08-07T23:59:59Z',
      actualValue: 70,
      performanceStatus: 'warning',
      dataQualityStatus: 'unverified',
      correctionOfMeasurementId: 'meas-1a',
      correctionReason: 'Poprawiono błąd odczytu licznika linii pakowania.',
      source: 'manual',
      evidenceRefs: [],
      notes: null,
      recordedBy: 'user-piotr-demo',
      recordedAt: '2026-08-08T14:30:00Z',
    },
    {
      measurementId: 'meas-1c',
      kpiId: 'kpi-1',
      definitionVersionId: 'ver-1',
      organizationId: 'org-dbr77-demo',
      periodStart: '2026-08-01T00:00:00Z',
      periodEnd: '2026-08-07T23:59:59Z',
      actualValue: 70,
      performanceStatus: 'warning',
      dataQualityStatus: 'verified',
      correctionOfMeasurementId: 'meas-1b',
      correctionReason: null,
      source: 'manual',
      evidenceRefs: [],
      notes: 'Potwierdzone na podstawie raportu zmianowego.',
      recordedBy: 'user-piotr-demo',
      recordedAt: '2026-08-09T08:00:00Z',
    },
    {
      measurementId: 'meas-1d',
      kpiId: 'kpi-1',
      definitionVersionId: 'ver-1',
      organizationId: 'org-dbr77-demo',
      periodStart: '2026-07-25T00:00:00Z',
      periodEnd: '2026-07-31T23:59:59Z',
      actualValue: 0,
      performanceStatus: 'critical',
      dataQualityStatus: 'unverified',
      correctionOfMeasurementId: null,
      correctionReason: null,
      source: 'connector-erp',
      evidenceRefs: [],
      notes: null,
      recordedBy: 'user-marek',
      recordedAt: '2026-08-01T07:00:00Z',
    },
    {
      measurementId: 'meas-1e',
      kpiId: 'kpi-1',
      definitionVersionId: 'ver-1',
      organizationId: 'org-dbr77-demo',
      periodStart: '2026-07-25T00:00:00Z',
      periodEnd: '2026-07-31T23:59:59Z',
      actualValue: 0,
      performanceStatus: 'critical',
      dataQualityStatus: 'disputed',
      correctionOfMeasurementId: 'meas-1d',
      correctionReason: 'Zero wygląda jak błąd integracji ERP, nie realny wynik — do wyjaśnienia z IT.',
      source: 'connector-erp',
      evidenceRefs: [],
      notes: null,
      recordedBy: 'user-piotr-demo',
      recordedAt: '2026-08-01T10:00:00Z',
    },
    {
      measurementId: 'meas-1f',
      kpiId: 'kpi-1',
      definitionVersionId: 'ver-1',
      organizationId: 'org-dbr77-demo',
      periodStart: '2026-07-18T00:00:00Z',
      periodEnd: '2026-07-24T23:59:59Z',
      actualValue: null,
      performanceStatus: 'neutral',
      dataQualityStatus: 'unverified',
      correctionOfMeasurementId: null,
      correctionReason: null,
      source: 'manual',
      evidenceRefs: [],
      notes: 'Brak dostępu do licznika w tym tygodniu — awaria czujnika.',
      recordedBy: 'user-anna',
      recordedAt: '2026-07-25T08:00:00Z',
    },
  ],
  'kpi-2': [],
  'kpi-3': [],
  'kpi-4': [
    {
      measurementId: 'meas-4',
      kpiId: 'kpi-4',
      definitionVersionId: 'ver-4',
      organizationId: 'org-dbr77-demo',
      periodStart: '2026-07-01T00:00:00Z',
      periodEnd: '2026-07-31T23:59:59Z',
      actualValue: 5,
      performanceStatus: 'on_target',
      dataQualityStatus: 'verified',
      correctionOfMeasurementId: null,
      correctionReason: null,
      source: 'manual',
      evidenceRefs: [],
      notes: null,
      recordedBy: 'user-piotr-demo',
      recordedAt: '2026-07-30T08:00:00Z',
    },
  ],
  'kpi-5': [],
};

let mockMeasurementSeq = 0;
function nextMockMeasurementId(): string {
  mockMeasurementSeq += 1;
  return `meas-new-${mockMeasurementSeq}`;
}

/** Mirrors `kpiRepository.ts`'s `listMeasurements` "current" rule: a row is
 * current when NO other row's `correctionOfMeasurementId` points at it. */
function filterCurrent(rows: MockMeasurement[]): MockMeasurement[] {
  const superseded = new Set(rows.map((r) => r.correctionOfMeasurementId).filter(Boolean));
  return rows.filter((r) => !superseded.has(r.measurementId));
}

const realGet = Api.get.bind(Api);
const realPost = Api.post.bind(Api);
const realPut = Api.put.bind(Api);

Api.get = (async (url: string) => {
  if (url.startsWith('/vnext/results/kpi/') && url.includes('/measurements')) {
    const [pathPart, queryPart] = url.split('?');
    const kpiId = pathPart.split('/vnext/results/kpi/')[1]?.split('/')[0];
    if (measState === 'error') {
      const err: any = new Error('Upstream KPI measurements service returned a 503.');
      err.status = 503;
      throw err;
    }
    if (measState === 'loading') return new Promise(() => {}); // never resolves
    const includeSuperseded = new URLSearchParams(queryPart ?? '').get('includeSuperseded') === 'true';
    const all = measState === 'empty' ? [] : (MOCK_MEASUREMENTS[kpiId ?? ''] ?? []);
    const rows = includeSuperseded ? all : filterCurrent(all);
    // Mirrors the real repository's ORDER BY period_start DESC, recorded_at DESC.
    const sorted = [...rows].sort(
      (a, b) => b.periodStart.localeCompare(a.periodStart) || b.recordedAt.localeCompare(a.recordedAt)
    );
    return { measurements: sorted };
  }
  // RN-G2 §G #7 (2026-08-10) FIX: `/scorecards*` is a real, more-specific
  // sub-path (`ResultsKpiRegistryPage.tsx`'s "Karty wyników" tab calls
  // `kpiScorecardApi.ts`'s `listKpiScorecards` -> `GET
  // /vnext/results/kpi/scorecards`) — the generic single-KPI branch right
  // below would otherwise treat the literal string "scorecards" as a
  // `:kpiId`, 404 with a misleading "KPI not found", and mask this screen's
  // OWN "Karty wyników" tab (a real, pre-existing gap in this specific mock,
  // never visible before because the router-context crash this same fix
  // pass addresses happened first on every tab switch — see the file header
  // FIX note). Full Scorecards fixtures are a different package's mock
  // (`results-vnext-kpi-scorecards.tsx`) — stubbing a real, honest EMPTY
  // list here (not fabricated data) is the minimal, in-scope fix so this
  // screen's own Scorecards tab renders its genuine "no scorecards yet"
  // empty state instead of erroring. Mirrors the real router's own
  // mount-order rule (`kpi.routes.ts` header: "kpi/scorecards before bare
  // kpi").
  if (url.startsWith('/vnext/results/kpi/scorecards')) {
    return { scorecards: [] };
  }
  if (url.startsWith('/vnext/results/kpi/')) {
    const kpiId = url.split('/vnext/results/kpi/')[1]?.split('?')[0];
    const found = MOCK_KPIS.find((k) => k.kpiId === kpiId);
    if (!found) {
      const err: any = new Error('KPI not found');
      err.status = 404;
      throw err;
    }
    return { kpi: found };
  }
  if (url.startsWith('/vnext/results/kpi')) {
    if (state === 'loading') return new Promise(() => {}); // never resolves
    if (state === 'error') {
      const err: any = new Error('Upstream KPI service returned a 503.');
      err.status = 503;
      throw err;
    }
    if (state === 'empty') return { kpis: [] };
    return { kpis: MOCK_KPIS };
  }
  return realGet(url);
}) as typeof Api.get;

function versionToDto(v: MockKpiDefinitionVersion) {
  return { ...v };
}

Api.post = (async (url: string, data: any) => {
  // RN-G5 (2026-08-12) — POST /vnext/results/kpi (createKpiDraft). Mirrors
  // `kpiDefinitionCommands.ts`'s `createKpiDraft`: creates BOTH the KPI root
  // row (status 'draft') and its version-1 row (approvalStatus 'draft') in
  // one shot, `createdBy`/`submittedBy` etc. resolved from the CURRENT actor
  // (`currentActorId()`), never client-supplied — same as the real route
  // reading `auth.userId`.
  if (url === '/vnext/results/kpi') {
    const kpiId = nextMockKpiId();
    const versionId = nextMockVersionId();
    const now = new Date().toISOString();
    const actor = currentActorId();
    const kpi: MockKpi = {
      kpiId,
      organizationId: 'org-dbr77-demo',
      kpiCode: data.kpiCode,
      status: 'draft',
      currentDefinitionVersionId: versionId,
      primaryProcessId: null,
      responsePolicyId: null,
      ownerUserId: actor,
      rowVersion: 1,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };
    const version: MockKpiDefinitionVersion = {
      definitionVersionId: versionId,
      kpiId,
      organizationId: 'org-dbr77-demo',
      versionNumber: 1,
      name: data.name,
      description: data.description ?? null,
      unit: data.unit ?? null,
      targetGeometry: data.targetGeometry,
      targetValue: data.targetValue ?? null,
      targetMin: data.targetMin ?? null,
      targetMax: data.targetMax ?? null,
      warningLow: data.warningLow ?? null,
      warningHigh: data.warningHigh ?? null,
      criticalLow: data.criticalLow ?? null,
      criticalHigh: data.criticalHigh ?? null,
      binarySuccessValue: data.binarySuccessValue ?? null,
      formulaText: data.formulaText ?? null,
      approvalStatus: 'draft',
      effectiveFrom: null,
      effectiveTo: null,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
      submittedBy: null,
      submittedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      rowVersion: 1,
    };
    MOCK_KPIS.unshift(kpi);
    MOCK_KPI_VERSIONS[versionId] = version;
    MOCK_MEASUREMENTS[kpiId] = [];
    return { outcome: 'applied', eventId: `evt-${kpiId}`, resultingVersion: 1, kpi, definitionVersion: versionToDto(version) };
  }

  // RN-G5 — POST /vnext/results/kpi/:kpiId/submit (submitKpiDefinition).
  const submitMatch = url.match(/\/vnext\/results\/kpi\/([^/]+)\/submit$/);
  if (submitMatch) {
    const [, kpiId] = submitMatch;
    const kpi = MOCK_KPIS.find((k) => k.kpiId === kpiId);
    const version = kpi?.currentDefinitionVersionId ? MOCK_KPI_VERSIONS[kpi.currentDefinitionVersionId] : undefined;
    if (!kpi || !version) {
      const err: any = new Error('KPI not found');
      err.status = 404;
      throw err;
    }
    if (version.approvalStatus !== 'draft') {
      const err: any = new Error(`Definition version ${version.definitionVersionId} is "${version.approvalStatus}" — only a draft may be submitted`);
      err.status = 409;
      err.data = { code: 'NOT_A_DRAFT' };
      throw err;
    }
    if (data.expectedVersion !== version.rowVersion) {
      const err: any = new Error(`Version conflict: expected ${data.expectedVersion}, current ${version.rowVersion}`);
      err.status = 409;
      err.data = { code: 'VERSION_CONFLICT', currentVersion: version.rowVersion, expectedVersion: data.expectedVersion };
      throw err;
    }
    version.approvalStatus = 'submitted';
    version.submittedBy = currentActorId();
    version.submittedAt = new Date().toISOString();
    version.rowVersion += 1;
    version.updatedAt = version.submittedAt;
    if (kpi.status === 'draft') kpi.status = 'pending_approval';
    kpi.updatedAt = version.updatedAt;
    return { outcome: 'applied', eventId: `evt-${version.definitionVersionId}-submit`, resultingVersion: version.rowVersion, definitionVersion: versionToDto(version) };
  }

  // RN-G5 — POST .../definition-versions/:versionId/approve — self-approval
  // denial FIRST, before the state-transition check, mirroring
  // `approveDefinitionVersion`'s own doc comment.
  const approveMatch = url.match(/\/vnext\/results\/kpi\/([^/]+)\/definition-versions\/([^/]+)\/approve$/);
  if (approveMatch) {
    const [, kpiId, versionId] = approveMatch;
    const version = MOCK_KPI_VERSIONS[versionId];
    if (!version || version.kpiId !== kpiId) {
      const err: any = new Error('Definition version not found for this KPI');
      err.status = 404;
      throw err;
    }
    const actor = currentActorId();
    if (version.submittedBy === actor) {
      const err: any = new Error(`User ${actor} may not approve definition version ${versionId}: matches its own submitted_by`);
      err.status = 403;
      err.data = { code: 'SELF_APPROVAL_DENIED', definitionVersionId: versionId, approverId: actor, reasonField: 'submitted_by' };
      throw err;
    }
    if (version.createdBy === actor) {
      const err: any = new Error(`User ${actor} may not approve definition version ${versionId}: matches its own created_by`);
      err.status = 403;
      err.data = { code: 'SELF_APPROVAL_DENIED', definitionVersionId: versionId, approverId: actor, reasonField: 'created_by' };
      throw err;
    }
    if (version.approvalStatus !== 'submitted') {
      const err: any = new Error(`Definition version ${versionId} is "${version.approvalStatus}" — only a submitted version may be approved`);
      err.status = 409;
      err.data = { code: 'NOT_SUBMITTED' };
      throw err;
    }
    if (data.expectedVersion !== version.rowVersion) {
      const err: any = new Error(`Version conflict: expected ${data.expectedVersion}, current ${version.rowVersion}`);
      err.status = 409;
      err.data = { code: 'VERSION_CONFLICT', currentVersion: version.rowVersion, expectedVersion: data.expectedVersion };
      throw err;
    }
    version.approvalStatus = 'approved';
    version.approvedBy = actor;
    version.approvedAt = new Date().toISOString();
    version.effectiveFrom = version.effectiveFrom ?? version.approvedAt;
    version.rowVersion += 1;
    version.updatedAt = version.approvedAt;
    return { outcome: 'applied', eventId: `evt-${versionId}-approve`, resultingVersion: version.rowVersion, definitionVersion: versionToDto(version) };
  }

  // RN-G5 — POST .../definition-versions/:versionId/reject.
  const rejectMatch = url.match(/\/vnext\/results\/kpi\/([^/]+)\/definition-versions\/([^/]+)\/reject$/);
  if (rejectMatch) {
    const [, kpiId, versionId] = rejectMatch;
    const version = MOCK_KPI_VERSIONS[versionId];
    const kpi = MOCK_KPIS.find((k) => k.kpiId === kpiId);
    if (!version || version.kpiId !== kpiId || !kpi) {
      const err: any = new Error('Definition version not found for this KPI');
      err.status = 404;
      throw err;
    }
    if (version.approvalStatus !== 'submitted') {
      const err: any = new Error(`Definition version ${versionId} is "${version.approvalStatus}" — only a submitted version may be rejected`);
      err.status = 409;
      err.data = { code: 'NOT_SUBMITTED' };
      throw err;
    }
    if (data.expectedVersion !== version.rowVersion) {
      const err: any = new Error(`Version conflict: expected ${data.expectedVersion}, current ${version.rowVersion}`);
      err.status = 409;
      err.data = { code: 'VERSION_CONFLICT', currentVersion: version.rowVersion, expectedVersion: data.expectedVersion };
      throw err;
    }
    version.approvalStatus = 'rejected';
    version.rejectedBy = currentActorId();
    version.rejectedAt = new Date().toISOString();
    version.rejectionReason = data.rejectionReason;
    version.rowVersion += 1;
    version.updatedAt = version.rejectedAt;
    if (kpi.status === 'pending_approval') kpi.status = 'draft';
    kpi.updatedAt = version.updatedAt;
    return { outcome: 'applied', eventId: `evt-${versionId}-reject`, resultingVersion: version.rowVersion, definitionVersion: versionToDto(version) };
  }

  const lifecycleMatch = url.match(/\/vnext\/results\/kpi\/([^/]+)\/(activate|suspend|archive)$/);
  if (lifecycleMatch) {
    const [, kpiId, action] = lifecycleMatch;
    const target = MOCK_KPIS.find((k) => k.kpiId === kpiId);
    if (target) {
      target.status = action === 'activate' ? 'active' : action === 'suspend' ? 'suspended' : 'archived';
      target.rowVersion += 1;
      target.updatedAt = new Date().toISOString();
    }
    return { outcome: 'applied', kpi: target };
  }

  // RN-G2 §G #7 — measurements write mocks. Mirrors the real route/command
  // shapes (`kpi.routes.ts`/`kpiMeasurementCommands.ts`): record INSERTs a
  // fresh row; correct/verify/dispute INSERT a NEW row referencing the
  // original via `correctionOfMeasurementId`, never mutate it.
  const recordMatch = url.match(/\/vnext\/results\/kpi\/([^/]+)\/measurements$/);
  if (recordMatch) {
    const [, kpiId] = recordMatch;
    const kpi = MOCK_KPIS.find((k) => k.kpiId === kpiId);
    if (!kpi) {
      const err: any = new Error('KPI not found');
      err.status = 404;
      throw err;
    }
    if (!kpi.currentDefinitionVersionId) {
      const err: any = new Error(`KPI ${kpiId} has no current definition version to measure against`);
      err.status = 409;
      err.data = { code: 'NO_CURRENT_VERSION' };
      throw err;
    }
    const list = (MOCK_MEASUREMENTS[kpiId] ??= []);
    const created: MockMeasurement = {
      measurementId: nextMockMeasurementId(),
      kpiId,
      definitionVersionId: kpi.currentDefinitionVersionId,
      organizationId: 'org-dbr77-demo',
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      actualValue: data.actualValue ?? null,
      // Mock harness never evaluates target geometry (that's server-side,
      // deliberately out of scope for a dev-render fixture) — 'neutral' is
      // the real evaluator's own degrade-when-unknown value, not a guess.
      performanceStatus: 'neutral',
      dataQualityStatus: 'unverified',
      correctionOfMeasurementId: null,
      correctionReason: null,
      source: data.source,
      evidenceRefs: [],
      notes: data.notes ?? null,
      recordedBy: 'user-piotr-demo',
      recordedAt: new Date().toISOString(),
    };
    list.push(created);
    return { outcome: 'applied', eventId: `evt-${created.measurementId}`, resultingVersion: 1, measurement: created };
  }

  const supersedeMatch = url.match(
    /\/vnext\/results\/kpi\/([^/]+)\/measurements\/([^/]+)\/(corrections|verify|dispute)$/
  );
  if (supersedeMatch) {
    const [, kpiId, measurementId, kind] = supersedeMatch;
    const list = MOCK_MEASUREMENTS[kpiId] ?? [];
    const original = list.find((m) => m.measurementId === measurementId);
    if (!original) {
      const err: any = new Error(`Measurement ${measurementId} not found in organization org-dbr77-demo`);
      err.status = 404;
      err.data = { code: 'MEASUREMENT_NOT_FOUND' };
      throw err;
    }
    const superseding: MockMeasurement = {
      ...original,
      measurementId: nextMockMeasurementId(),
      correctionOfMeasurementId: original.measurementId,
      recordedBy: 'user-piotr-demo',
      recordedAt: new Date().toISOString(),
      actualValue: kind === 'corrections' ? (data.actualValue ?? null) : original.actualValue,
      correctionReason: kind === 'corrections' ? data.correctionReason : kind === 'dispute' ? data.disputeReason : (data.notes ?? null),
      dataQualityStatus: kind === 'verify' ? 'verified' : kind === 'dispute' ? 'disputed' : original.dataQualityStatus,
    };
    list.push(superseding);
    return {
      outcome: 'applied',
      eventId: `evt-${superseding.measurementId}`,
      resultingVersion: 1,
      original,
      measurement: superseding,
    };
  }

  return realPost(url, data);
}) as typeof Api.post;

// RN-G5 — PUT /vnext/results/kpi/:kpiId/draft (editKpiDraft). Mirrors
// `editDraft`'s own guard: only a 'draft'-approvalStatus version may be
// edited (409 NOT_A_DRAFT otherwise — e.g. after a reject, see
// `kpiDefinitionCommands.ts`'s comment on why there is no amend/re-draft
// command in this package's scope).
Api.put = (async (url: string, data: any) => {
  const draftMatch = url.match(/\/vnext\/results\/kpi\/([^/]+)\/draft$/);
  if (draftMatch) {
    const [, kpiId] = draftMatch;
    const kpi = MOCK_KPIS.find((k) => k.kpiId === kpiId);
    const version = kpi?.currentDefinitionVersionId ? MOCK_KPI_VERSIONS[kpi.currentDefinitionVersionId] : undefined;
    if (!kpi || !version) {
      const err: any = new Error('KPI not found');
      err.status = 404;
      throw err;
    }
    if (version.approvalStatus !== 'draft') {
      const err: any = new Error(`Definition version ${version.definitionVersionId} is "${version.approvalStatus}" — only a draft may be edited`);
      err.status = 409;
      err.data = { code: 'NOT_A_DRAFT' };
      throw err;
    }
    if (data.expectedVersion !== version.rowVersion) {
      const err: any = new Error(`Version conflict: expected ${data.expectedVersion}, current ${version.rowVersion}`);
      err.status = 409;
      err.data = { code: 'VERSION_CONFLICT', currentVersion: version.rowVersion, expectedVersion: data.expectedVersion };
      throw err;
    }
    if (data.name !== undefined) version.name = data.name;
    if (data.description !== undefined) version.description = data.description;
    if (data.unit !== undefined) version.unit = data.unit;
    if (data.targetGeometry !== undefined) version.targetGeometry = data.targetGeometry;
    if (data.targetValue !== undefined) version.targetValue = data.targetValue;
    if (data.targetMin !== undefined) version.targetMin = data.targetMin;
    if (data.targetMax !== undefined) version.targetMax = data.targetMax;
    if (data.warningLow !== undefined) version.warningLow = data.warningLow;
    if (data.warningHigh !== undefined) version.warningHigh = data.warningHigh;
    if (data.criticalLow !== undefined) version.criticalLow = data.criticalLow;
    if (data.criticalHigh !== undefined) version.criticalHigh = data.criticalHigh;
    if (data.binarySuccessValue !== undefined) version.binarySuccessValue = data.binarySuccessValue;
    if (data.formulaText !== undefined) version.formulaText = data.formulaText;
    version.rowVersion += 1;
    version.updatedAt = new Date().toISOString();
    return { outcome: 'applied', eventId: `evt-${version.definitionVersionId}-edit`, resultingVersion: version.rowVersion, definitionVersion: versionToDto(version) };
  }
  return realPut(url, data);
}) as typeof Api.put;

// sticky-defect1a (2026-08-11): `ResultsKpiRegistryPage` calls `useNavigate()`
// internally, which throws outside a Router context — this screen never had
// one (pre-existing gap, reproduced identically on unmodified HEAD via
// `git stash`, unrelated to the FilterableTable sticky-column fix). Wrapping
// only HERE (harness-only file) so the P2 regression screenshot can actually
// render the page instead of the React error boundary.
//
// RN-G5 — "Przełącz aktora" floating button (harness chrome only, see file
// header) swaps `useAppStore`'s `currentUser` between Piotr/Anna WITHOUT
// unmounting `ResultsKpiRegistryPage`, so its `knownVersions` in-memory
// cache survives the swap — the only way to demo a create->submit->approve
// click-through with a REAL second actor in a single-tab harness (see file
// header note for why this is a legitimate simulation, not a shortcut
// around the self-approval rule).
const ResultsVNextKpiRegistryScreen: React.FC = () => {
  const [actor, setActor] = useState<'piotr' | 'anna'>('piotr');
  return (
    <div className="h-screen bg-c-bg text-c-text relative">
      <MemoryRouter initialEntries={['/results/kpi']}>
        <ResultsKpiRegistryPage />
      </MemoryRouter>
      <button
        type="button"
        data-testid="harness-actor-switch"
        onClick={() => {
          const next = actor === 'piotr' ? 'anna' : 'piotr';
          useAppStore.setState({ currentUser: next === 'piotr' ? ACTOR_PIOTR : ACTOR_ANNA } as any);
          setActor(next);
        }}
        className="fixed bottom-3 right-3 z-[9999] rounded-full border border-c-border bg-c-surface-raised px-3 py-1.5 text-[11px] font-semibold text-c-text shadow-lg"
      >
        Aktor: {actor === 'piotr' ? 'Piotr' : 'Anna'} (kliknij, aby przełączyć)
      </button>
    </div>
  );
};

export default ResultsVNextKpiRegistryScreen;
