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
 * URL params:
 *   ?screen=results-vnext-kpi-registry
 *   &state=ready|loading|empty|error   (default ready)
 *   &kpiId=<id>                        deep-link smoke: 'kpi-1' resolves,
 *                                       anything else 404s -> forbidden state
 *   &ff=off                            force the flag OFF (disabled panel)
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ResultsKpiRegistryPage } from '../../src/components/ResultsVNext/ResultsKpiRegistryPage';
import { Api } from '../../src/services/api';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
const state = params.get('state') || 'ready';
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

const MOCK_MEASUREMENTS: Record<string, unknown[]> = {
  'kpi-1': [
    {
      measurementId: 'meas-1',
      kpiId: 'kpi-1',
      definitionVersionId: 'ver-1',
      organizationId: 'org-dbr77-demo',
      periodStart: '2026-08-01T00:00:00Z',
      periodEnd: '2026-08-07T23:59:59Z',
      actualValue: 74,
      performanceStatus: 'warning',
      dataQualityStatus: 'verified',
      correctionOfMeasurementId: null,
      correctionReason: null,
      source: 'manual',
      evidenceRefs: [],
      notes: null,
      recordedBy: 'user-piotr-demo',
      recordedAt: '2026-08-08T09:00:00Z',
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

const realGet = Api.get.bind(Api);
const realPost = Api.post.bind(Api);

Api.get = (async (url: string) => {
  if (url.startsWith('/vnext/results/kpi/') && url.includes('/measurements')) {
    const kpiId = url.split('/vnext/results/kpi/')[1]?.split('/')[0];
    if (state === 'error') {
      const err: any = new Error('Upstream KPI service returned a 503.');
      err.status = 503;
      throw err;
    }
    return { measurements: MOCK_MEASUREMENTS[kpiId ?? ''] ?? [] };
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

Api.post = (async (url: string, data: any) => {
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
  return realPost(url, data);
}) as typeof Api.post;

// sticky-defect1a (2026-08-11): `ResultsKpiRegistryPage` calls `useNavigate()`
// internally, which throws outside a Router context — this screen never had
// one (pre-existing gap, reproduced identically on unmodified HEAD via
// `git stash`, unrelated to the FilterableTable sticky-column fix). Wrapping
// only HERE (harness-only file) so the P2 regression screenshot can actually
// render the page instead of the React error boundary.
const ResultsVNextKpiRegistryScreen: React.FC = () => (
  <div className="h-screen bg-c-bg text-c-text">
    <MemoryRouter>
      <ResultsKpiRegistryPage />
    </MemoryRouter>
  </div>
);

export default ResultsVNextKpiRegistryScreen;
