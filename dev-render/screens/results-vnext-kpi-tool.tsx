/**
 * RN-G3 lane — dev-render host for the REAL `<KpiToolPage>` +
 * `<KpiDeviationCaseSubview>` (`src/components/ResultsVNext/kpiTool/*`) — no
 * reimplementation, the production components mounted with `Api.get`/
 * `Api.post`/`Api.put`/`Api.patch` stubbed for `/vnext/results/kpi*`.
 *
 * -- WHY A REAL <MemoryRouter> WITH BOTH ROUTES, NOT TWO SEPARATE SCREENS
 * (per session note OQ-UI-I, `RN_G2_OPEN_QUESTIONS_UI.md`): the KPI registry
 * screen's own history shows a router-context crash was found ONLY because
 * that screen mounts the real component under a real Router — a
 * reimplementation screen would never have caught it. This screen goes
 * further: BOTH the tool and the Deviation Case subview are mounted under
 * ONE `<MemoryRouter>` with the SAME `<Route>` shapes as
 * `src/routes/AppRoutes.tsx` (`ROUTES.RESULTS_KPI.TOOL`/`.DEVIATION_CASE`),
 * plus a real `/results/kpi` landing marker — so clicking "Otwórz sprawę"
 * inside the tool, or the header back-chevron (`onClose`) inside the
 * subview, exercises the REAL `useNavigate()` call this component makes,
 * not a stubbed no-op. (A jsdom+React19+react-router-dom v7 quirk makes
 * live cross-route swaps unreliable under vitest — this harness runs in a
 * real browser via `shot.mjs`/Playwright, where that quirk does not apply;
 * the component test suite instead asserts the exact `navigate()` call —
 * see `tests/components/ResultsVNext/KpiToolPage.test.tsx` file header.)
 *
 * URL params:
 *   ?screen=results-vnext-kpi-tool
 *   &view=tool|case            which route to start on (default tool)
 *   &state=ready|loading|error KPI fetch state (default ready)
 *   &caseState=open|analysis_required|plan_required|plan_submitted|
 *              approved|executing|recovery_observed|verification|closed
 *              (default open) — the mock case's status
 *   &severity=warning|critical (default warning)
 *   &escalated=1                escalation overlay on the mock case
 *   &impacts=0                  suppress the initiative-impact fixture (empty state)
 *   &ff=off                     force the flag OFF (disabled panel)
 */
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { KpiToolPage } from '../../src/components/ResultsVNext/kpiTool/KpiToolPage';
import { KpiDeviationCaseSubview } from '../../src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview';
import { ROUTES } from '../../src/routes/routeConfig';
import { Api } from '../../src/services/api';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
const view = params.get('view') === 'case' ? 'case' : 'tool';
const state = params.get('state') || 'ready';
const caseState = params.get('caseState') || 'open';
const severity = params.get('severity') === 'critical' ? 'critical' : 'warning';
const escalated = params.get('escalated') === '1';
const suppressImpacts = params.get('impacts') === '0';
const flagOff = params.get('ff') === 'off';

if (!flagOff) {
  try {
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
  } catch {
    // no-op — dev-render only
  }
}

const KPI_ID = 'kpi-1';
const CASE_ID = 'case-1';

const KPI = {
  kpiId: KPI_ID,
  organizationId: 'org-dbr77-demo',
  kpiCode: 'OEE-LINIA-PAKOWANIA',
  status: 'active' as const,
  currentDefinitionVersionId: 'ver-1',
  primaryProcessId: 'proc-produkcja-1',
  responsePolicyId: 'policy-1',
  ownerUserId: 'user-piotr-demo',
  rowVersion: 3,
  createdBy: 'user-piotr-demo',
  createdAt: '2026-06-01T08:00:00Z',
  updatedAt: '2026-08-08T10:00:00Z',
};

const MEASUREMENT = {
  measurementId: 'meas-1',
  kpiId: KPI_ID,
  definitionVersionId: 'ver-1',
  organizationId: 'org-dbr77-demo',
  periodStart: '2026-08-01T00:00:00Z',
  periodEnd: '2026-08-07T23:59:59Z',
  actualValue: 74,
  performanceStatus: 'warning' as const,
  dataQualityStatus: 'verified' as const,
  correctionOfMeasurementId: null,
  correctionReason: null,
  source: 'manual',
  evidenceRefs: [],
  notes: null,
  recordedBy: 'user-anna',
  recordedAt: '2026-08-08T09:00:00Z',
};

const DEVIATION_CASE = {
  caseId: CASE_ID,
  organizationId: 'org-dbr77-demo',
  kpiId: KPI_ID,
  triggerMeasurementId: MEASUREMENT.measurementId,
  severity,
  status: caseState,
  escalated,
  escalatedAt: escalated ? '2026-08-09T00:00:00Z' : null,
  escalatedReason: escalated ? 'Powtarzający się problem, wymaga uwagi zarządu.' : null,
  escalatedBy: escalated ? 'user-piotr-demo' : null,
  ownerUserId: 'user-piotr-demo',
  managerUserId: 'user-marek',
  detectedAt: '2026-08-08T09:05:00Z',
  responseDueAt: '2026-08-10T09:05:00Z',
  rootCauseSummary: ['plan_required', 'plan_submitted', 'approved', 'executing', 'recovery_observed', 'verification', 'closed'].includes(caseState)
    ? 'Awaria czujnika prędkości linii spowodowała błędne odczyty OEE.'
    : null,
  rootCauseCategory: ['plan_required', 'plan_submitted', 'approved', 'executing', 'recovery_observed', 'verification', 'closed'].includes(caseState)
    ? 'sprzet'
    : null,
  recurrenceFlag: false,
  expectedRecoveryDate: null,
  expectedRecoveryValue: null,
  planSubmittedBy: ['plan_submitted', 'approved', 'executing', 'recovery_observed', 'verification', 'closed'].includes(caseState) ? 'user-anna' : null,
  planSubmittedAt: ['plan_submitted', 'approved', 'executing', 'recovery_observed', 'verification', 'closed'].includes(caseState) ? '2026-08-09T10:00:00Z' : null,
  planApprovedBy: ['approved', 'executing', 'recovery_observed', 'verification', 'closed'].includes(caseState) ? 'user-marek' : null,
  planApprovedAt: ['approved', 'executing', 'recovery_observed', 'verification', 'closed'].includes(caseState) ? '2026-08-09T14:00:00Z' : null,
  recoveryObservedBy: ['recovery_observed', 'verification', 'closed'].includes(caseState) ? 'user-piotr-demo' : null,
  recoveryObservedAt: ['recovery_observed', 'verification', 'closed'].includes(caseState) ? '2026-08-10T08:00:00Z' : null,
  recoveryObservationMeasurementId: ['recovery_observed', 'verification', 'closed'].includes(caseState) ? MEASUREMENT.measurementId : null,
  closedAt: caseState === 'closed' ? '2026-08-11T08:00:00Z' : null,
  closedBy: caseState === 'closed' ? 'user-anna' : null,
  closeEffectivenessVerificationId: caseState === 'closed' ? 'verif-1' : null,
  reopenedFromCaseId: null,
  rowVersion: 5,
  createdBy: 'system',
  createdAt: '2026-08-08T09:05:00Z',
  updatedAt: '2026-08-10T08:00:00Z',
};

const INITIATIVE_IMPACTS = suppressImpacts
  ? []
  : [
      {
        impactId: 'impact-1',
        organizationId: 'org-dbr77-demo',
        kpiId: KPI_ID,
        initiativeId: 'init-linia-modernizacja',
        definitionVersionIdAtCommitment: 'ver-1',
        status: 'committed' as const,
        expectedContributionValue: 8,
        expectedContributionDirection: 'increase' as const,
        targetCompletionDate: '2026-12-01',
        proposedBy: 'user-anna',
        proposedAt: '2026-07-01T00:00:00Z',
        baselineMeasurementId: MEASUREMENT.measurementId,
        baselineValueAtCommitment: 70,
        baselinePeriodEnd: MEASUREMENT.periodEnd,
        committedBy: 'user-piotr-demo',
        committedAt: '2026-07-05T00:00:00Z',
        reviewedAttributionValue: null,
        reviewedAttributionMeasurementId: null,
        reviewRationale: null,
        reviewedBy: null,
        reviewedAt: null,
        supersededByImpactId: null,
        supersededAt: null,
        rowVersion: 2,
        createdBy: 'user-anna',
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-05T00:00:00Z',
      },
    ];

const realGet = Api.get.bind(Api);
const realPost = Api.post.bind(Api);
const realPut = Api.put.bind(Api);
const realPatch = Api.patch.bind(Api);

let mutableCase = { ...DEVIATION_CASE };
let mutableKpi = { ...KPI };

Api.get = (async (url: string) => {
  if (url.startsWith(`/vnext/results/kpi/${KPI_ID}/measurements`)) {
    return { measurements: [MEASUREMENT] };
  }
  if (url.startsWith(`/vnext/results/kpi/${KPI_ID}/initiative-impacts`)) {
    return { impacts: INITIATIVE_IMPACTS };
  }
  if (url.startsWith('/vnext/results/kpi/deviation-cases/')) {
    const caseId = url.split('/vnext/results/kpi/deviation-cases/')[1]?.split('?')[0];
    if (caseId !== CASE_ID) {
      const err: any = new Error('Deviation case not found');
      err.status = 404;
      throw err;
    }
    return { case: mutableCase };
  }
  if (url.startsWith('/vnext/results/kpi/deviation-cases')) {
    return { cases: [mutableCase] };
  }
  if (url.startsWith(`/vnext/results/kpi/${KPI_ID}`)) {
    if (state === 'loading') return new Promise(() => {});
    if (state === 'error') {
      const err: any = new Error('Upstream KPI service returned a 503.');
      err.status = 503;
      throw err;
    }
    return { kpi: mutableKpi };
  }
  return realGet(url);
}) as typeof Api.get;

function bump(caseUpdate: Partial<typeof DEVIATION_CASE>) {
  mutableCase = { ...mutableCase, ...caseUpdate, rowVersion: mutableCase.rowVersion + 1, updatedAt: new Date().toISOString() };
  return mutableCase;
}

Api.post = (async (url: string, data: any) => {
  const lifecycleMatch = url.match(/\/vnext\/results\/kpi\/([^/]+)\/(activate|suspend|archive)$/);
  if (lifecycleMatch) {
    const [, kpiId, action] = lifecycleMatch;
    if (kpiId === KPI_ID) {
      mutableKpi = {
        ...mutableKpi,
        status: action === 'activate' ? 'active' : action === 'suspend' ? 'suspended' : 'archived',
        rowVersion: mutableKpi.rowVersion + 1,
      };
    }
    return { outcome: 'applied', kpi: mutableKpi };
  }
  if (url.endsWith('/acknowledge')) return { outcome: 'applied', eventId: 'evt-1', resultingVersion: mutableCase.rowVersion + 1, case: bump({ status: 'analysis_required' }) };
  if (url.endsWith('/corrective-actions')) {
    return {
      outcome: 'applied',
      eventId: 'evt-2',
      resultingVersion: 1,
      action: {
        actionId: 'action-1',
        deviationCaseId: CASE_ID,
        organizationId: 'org-dbr77-demo',
        title: data?.title ?? 'Działanie',
        description: data?.description ?? null,
        ownerUserId: data?.ownerUserId ?? 'user-piotr-demo',
        dueDate: data?.dueDate ?? null,
        status: 'planned',
        expectedEffect: data?.expectedEffect ?? null,
        actualEffect: null,
        rowVersion: 1,
        createdBy: 'user-piotr-demo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }
  if (url.endsWith('/plan/submit')) return { outcome: 'applied', eventId: 'evt-3', resultingVersion: mutableCase.rowVersion + 1, case: bump({ status: 'plan_submitted', planSubmittedBy: 'user-anna', planSubmittedAt: new Date().toISOString() }) };
  if (url.endsWith('/plan/approve')) return { outcome: 'applied', eventId: 'evt-4', resultingVersion: mutableCase.rowVersion + 1, case: bump({ status: 'approved', planApprovedBy: 'user-marek', planApprovedAt: new Date().toISOString() }) };
  if (url.endsWith('/recovery-observation')) return { outcome: 'applied', eventId: 'evt-5', resultingVersion: mutableCase.rowVersion + 1, case: bump({ status: 'recovery_observed', recoveryObservedBy: 'user-piotr-demo', recoveryObservedAt: new Date().toISOString() }) };
  if (url.endsWith('/effectiveness-verifications')) {
    return {
      outcome: 'applied',
      eventId: 'evt-6',
      resultingVersion: mutableCase.rowVersion + 1,
      case: bump({ status: 'verification' }),
      verification: {
        verificationId: 'verif-1',
        deviationCaseId: CASE_ID,
        verificationWindowStart: data?.verificationWindowStart,
        verificationWindowEnd: data?.verificationWindowEnd,
        status: data?.outcome ?? 'effective',
        rationale: data?.rationale ?? null,
        verifiedBy: 'user-piotr-demo',
        verifiedAt: new Date().toISOString(),
      },
    };
  }
  if (url.endsWith('/close')) return { outcome: 'applied', eventId: 'evt-7', resultingVersion: mutableCase.rowVersion + 1, case: bump({ status: 'closed', closedAt: new Date().toISOString(), closedBy: 'user-anna' }) };
  if (url.endsWith('/escalate')) return { outcome: 'applied', eventId: 'evt-8', resultingVersion: mutableCase.rowVersion + 1, case: bump({ escalated: true, escalatedAt: new Date().toISOString(), escalatedReason: data?.escalatedReason ?? null }) };
  if (url.endsWith('/deescalate')) return { outcome: 'applied', eventId: 'evt-9', resultingVersion: mutableCase.rowVersion + 1, case: bump({ escalated: false }) };
  if (url.endsWith('/reopen')) {
    const reopened = { ...mutableCase, caseId: 'case-1-reopened', status: 'open', reopenedFromCaseId: CASE_ID, rowVersion: 1, closedAt: null, closedBy: null };
    return { outcome: 'applied', eventId: 'evt-10', resultingVersion: 1, case: reopened };
  }
  if (url === '/vnext/results/kpi/initiative-impacts') {
    return { outcome: 'applied', eventId: 'evt-11', resultingVersion: 1, impact: { ...INITIATIVE_IMPACTS[0], impactId: 'impact-new', status: 'proposed' } };
  }
  if (url.match(/\/initiative-impacts\/[^/]+\/commit$/)) {
    return { outcome: 'applied', eventId: 'evt-12', resultingVersion: 3, impact: { ...INITIATIVE_IMPACTS[0], status: 'committed' } };
  }
  if (url.match(/\/initiative-impacts\/[^/]+\/review$/)) {
    return { outcome: 'applied', eventId: 'evt-13', resultingVersion: 3, impact: { ...INITIATIVE_IMPACTS[0], status: 'committed', reviewedAttributionValue: data?.reviewedAttributionValue ?? 9 } };
  }
  return realPost(url, data);
}) as typeof Api.post;

Api.put = (async (url: string, data: any) => {
  if (url.endsWith('/root-cause')) {
    return {
      outcome: 'applied',
      eventId: 'evt-rc',
      resultingVersion: mutableCase.rowVersion + 1,
      case: bump({
        status: 'plan_required',
        rootCauseSummary: data?.rootCauseSummary ?? null,
        rootCauseCategory: data?.rootCauseCategory ?? null,
      }),
    };
  }
  return realPut(url, data);
}) as typeof Api.put;

Api.patch = (async (url: string, data: any) => {
  if (url.includes('/corrective-actions/')) {
    return {
      outcome: 'applied',
      eventId: 'evt-patch',
      resultingVersion: 2,
      action: { actionId: 'action-1', status: data?.status ?? 'active', rowVersion: 2 },
      caseAutoTransitionedToExecuting: data?.status === 'active' && mutableCase.status === 'approved',
    };
  }
  return realPatch(url, data);
}) as typeof Api.patch;

const initialPath =
  view === 'case'
    ? ROUTES.RESULTS_KPI.DEVIATION_CASE.replace(':kpiId', KPI_ID).replace(':caseId', CASE_ID)
    : ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', KPI_ID);

export default function ResultsVNextKpiToolScreen() {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <div className="h-screen w-screen">
        <Routes>
          <Route path={ROUTES.RESULTS_KPI.ROOT} element={<div data-testid="dev-render-back-to-registry" className="p-6 text-c-text">Powrót do rejestru KPI (dev-render marker)</div>} />
          <Route path={ROUTES.RESULTS_KPI.TOOL} element={<KpiToolPage />} />
          <Route path={ROUTES.RESULTS_KPI.DEVIATION_CASE} element={<KpiDeviationCaseSubview />} />
        </Routes>
      </div>
    </MemoryRouter>
  );
}
