/**
 * RN-G2 §G #12-14 — dev-render host for the REAL ROI Case BUILD phase
 * (`RoiCaseFullTool` -> `RoiCaseModelWorkspace`: Baseline + calculation
 * policy, Assumptions CRUD, Cost lines CRUD, Benefit lines CRUD, Scenarios +
 * overrides, calculation-run triggering).
 *
 * RN-G2 UI OQ-UI-I FIX (`docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md`):
 * this screen previously reassembled the Build Case sub-view from
 * `ResultsVNextRegistryShell` + `roiCaseDetailPresenters.tsx` builder
 * functions and six manually-instantiated form modals, every callback a
 * no-op — a second implementation, not the shipped one. It now mounts the
 * ACTUAL production tree, `RoiCaseFullTool` (the same dispatcher
 * `ResultsRoiHub`'s row-menu "Otwórz pełne narzędzie" renders) with
 * `initialPhase="build"` so it opens directly on
 * `RoiCaseModelWorkspace` — NOT that inner component in isolation, because
 * `RoiCaseFullTool` (owning the Decision/Realize Value/Learn phase chips) is
 * genuinely part of the real component tree a user reaches this screen
 * through. `window.fetch` is stubbed for `/vnext/results/roi*`
 * (`roiCaseDetailApi.ts`/`roiCaseFullToolApi.ts` share `roiApi.ts`'s bare-
 * `fetch` client — see that file's header) with the SAME stateful-mock
 * pattern `results-vnext-roi-full-tool.tsx` established, covering every
 * phase's endpoints so switching Menu 3 phase chips never 404s — but this
 * screen's OWN seed case is seeded for the Build-phase edge cases the
 * full-tool screen's fixture does not exercise: a LOCKED case
 * (`&locked=1`), and a case with no baseline/policy record yet
 * (`&nullBaseline=1`/`&nullPolicy=1`, the real `getRoiBaseline`/
 * `getRoiCalculationPolicy` 404 case). `onBack`/`onPhaseChange` are REAL —
 * `onBack` returns to a lightweight "closed" placeholder (this screen has no
 * registry to return to, unlike `ResultsRoiHub`'s own back target) rather
 * than a no-op, so Esc/focus-return through any of the ~11 forms on this
 * phase is genuinely exercised when clicked through, not structurally
 * unverifiable (OQ-UI-G #2 / OQ-UI-I finding — closed for this screen).
 *
 * URL params:
 *   ?locked=1              force the case into a LOCKED status ('approved')
 *                           instead of 'modeling' — every Add/Edit/Delete
 *                           affordance on every tab must show visible+
 *                           disabled+reason, never hidden
 *   &nullBaseline=1        force `getRoiBaseline` to 404 (no baseline yet)
 *   &nullPolicy=1           force `getRoiCalculationPolicy` to 404 (no policy yet)
 *
 * Golden-flow click chain (see acceptance report for the actual run):
 *   1. Menu2 tab "Baseline i polityka" -> row "Baseline" -> kebab "Edytuj" -> save
 *   2. Menu2 tab "Założenia" -> "Nowe założenie" -> save
 *   3. Menu2 tab "Koszty" -> row click -> preview -> kebab "Usuń" -> confirm
 *   4. Menu2 tab "Korzyści" -> row click -> preview
 *   5. Menu3 chip "Decyzja" -> back to "Build Case" via chip
 *   6. Esc closes the last-opened modal; breadcrumb "Wróć" triggers `onBack`
 */
import React, { useState } from 'react';

import { RoiCaseFullTool } from '../../src/components/ResultsVNext/roi/RoiCaseFullTool';
import type { RoiCaseListItem } from '../../src/components/ResultsVNext/roi/roiApi';

const harnessParams = new URLSearchParams(window.location.search);
const locked = harnessParams.get('locked') === '1';
const nullBaseline = harnessParams.get('nullBaseline') === '1';
const nullPolicy = harnessParams.get('nullPolicy') === '1';

try {
  window.localStorage.setItem('ff.results_vnext_roi_registry', '1');
} catch {
  // no-op — dev-render only
}

// ==========================================================================
// In-memory, STATEFUL mock DB — one seeded case, Build-phase edge cases
// driven by URL params (see file header). Router mirrors
// `results-vnext-roi-full-tool.tsx`'s (proven, comprehensive) mock so every
// Menu 3 phase chip resolves instead of 404ing mid-QA-click.
// ==========================================================================

const ORG_ID = 'org-dbr77-demo';
const USER_ID = 'user-piotr-demo';
const CASE_ID = 'case-model-1';
let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

const roiCase = {
  caseId: CASE_ID,
  organizationId: ORG_ID,
  initiativeId: 'init-automatyzacja-1',
  title: 'Automatyzacja linii pakowania',
  ownerUserId: USER_ID,
  status: (locked ? 'approved' : 'modeling') as string,
  currency: 'PLN',
  granularity: 'monthly',
  analysisStart: '2026-01-01',
  analysisEnd: '2026-12-31',
  nextActionType: null as string | null,
  nextActionDueAt: null as string | null,
  nextReviewAt: null as string | null,
  submittedAt: locked ? '2026-07-10T09:00:00Z' : (null as string | null),
  approvedAt: locked ? '2026-07-20T09:00:00Z' : (null as string | null),
  rejectedAt: null as string | null,
  rejectionReason: null as string | null,
  changesRequestedAt: null as string | null,
  changesRequestedReason: null as string | null,
  archivedAt: null as string | null,
  rowVersion: 4,
  createdAt: '2026-06-01T08:00:00Z',
  updatedAt: '2026-08-07T10:00:00Z',
};

let baseline: any = nullBaseline ? null : {
  baselineId: 'bl-model-1', caseId: CASE_ID, organizationId: ORG_ID,
  baselinePeriodStart: '2025-01-01', baselinePeriodEnd: '2025-12-31',
  currentMeasuredValue: 42000, currentMeasuredUnit: 'szt./mies.', currentMeasuredAsOf: '2025-12-31',
  bauProjectionMethod: 'growth_rate', bauGrowthRatePct: 2.5, bauReferenceValue: 43050,
  interventionComparisonNotes: 'Porównanie do linii B przed modernizacją.',
  source: 'Raport produkcyjny Q4 2025', confidence: 'high', ownerUserId: USER_ID,
  frozenAt: locked ? '2026-07-20T09:00:00Z' : null, frozenBy: locked ? USER_ID : null,
  rowVersion: 3, createdBy: USER_ID, createdAt: '2026-06-01T09:05:00Z', updatedAt: '2026-07-15T11:00:00Z',
};
let policy: any = nullPolicy ? null : {
  policyRowId: 'pol-model-1', caseId: CASE_ID, organizationId: ORG_ID,
  discountRatePct: 8, taxTreatment: 'pre_tax', inflationRatePct: 3.2, roundingPolicy: 'half_up_2dp',
  requiredMetrics: ['npv', 'irr', 'payback'], notes: 'Polityka standardowa dla programu automatyzacji.',
  confidence: 'medium', ownerUserId: USER_ID,
  frozenAt: locked ? '2026-07-20T09:00:00Z' : null, frozenBy: locked ? USER_ID : null,
  rowVersion: 2, createdBy: USER_ID, createdAt: '2026-06-01T09:05:00Z', updatedAt: '2026-07-10T09:00:00Z',
};
const assumptions: any[] = [
  { assumptionId: 'as-model-1', caseId: CASE_ID, organizationId: ORG_ID, category: 'Wydajność', label: 'Wzrost przepustowości linii', unit: 'szt./h', baseValue: 120, downsideValue: 95, upsideValue: 150, confidence: 'high', evidenceRef: 'DOC-2026-041', source: 'Pilot 2026-05', ownerUserId: USER_ID, sensitivityRank: 1, notes: 'Zweryfikowane na pilotażu 6-tygodniowym.', deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 2, createdBy: USER_ID, createdAt: '2026-06-02T09:00:00Z', updatedAt: '2026-07-01T09:00:00Z' },
  { assumptionId: 'as-model-2', caseId: CASE_ID, organizationId: ORG_ID, category: 'Ryzyko', label: 'Adopcja operatorów (jeszcze nieoszacowana)', unit: '%', baseValue: null, downsideValue: null, upsideValue: null, confidence: null, evidenceRef: null, source: null, ownerUserId: null, sensitivityRank: null, notes: null, deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 1, createdBy: 'user-tomasz-nowak', createdAt: '2026-08-01T09:00:00Z', updatedAt: '2026-08-01T09:00:00Z' },
];
const costLines: any[] = [
  { costLineId: 'cl-model-1', caseId: CASE_ID, organizationId: ORG_ID, category: 'CAPEX', label: 'Zakup robotów pakujących', description: 'Dwie jednostki + integracja.', amount: 480000, currency: 'PLN', timingType: 'one_time', oneTimePeriodDate: '2026-02-01', recurrenceStartDate: null, recurrenceEndDate: null, recurrenceCadence: null, confidence: 'high', source: 'Oferta dostawcy #4471', ownerUserId: USER_ID, deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 2, createdBy: USER_ID, createdAt: '2026-06-05T09:00:00Z', updatedAt: '2026-07-01T09:00:00Z' },
];
const benefitLines: any[] = [
  { benefitLineId: 'bn-model-1', caseId: CASE_ID, organizationId: ORG_ID, category: 'Oszczędność pracy', label: 'Redukcja nadgodzin', description: 'Mniej nadgodzin na linii pakowania.', isFinancial: true, amount: 96000, currency: 'PLN', timingType: 'recurring', oneTimePeriodDate: null, recurrenceStartDate: '2026-03-01', recurrenceEndDate: null, recurrenceCadence: 'monthly', rampPeriods: 3, doubleCountingGroup: null, doubleCountingResolutionNote: null, confidence: 'high', source: 'Model HR', ownerUserId: USER_ID, deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 3, createdBy: USER_ID, createdAt: '2026-06-05T09:00:00Z', updatedAt: '2026-07-10T09:00:00Z' },
  { benefitLineId: 'bn-model-2', caseId: CASE_ID, organizationId: ORG_ID, category: 'Jakość', label: 'Poprawa satysfakcji operatorów', description: 'Korzyść niefinansowa — mierzona ankietą, nie kwotą.', isFinancial: false, amount: null, currency: null, timingType: 'one_time', oneTimePeriodDate: '2026-09-01', recurrenceStartDate: null, recurrenceEndDate: null, recurrenceCadence: null, rampPeriods: null, doubleCountingGroup: null, doubleCountingResolutionNote: null, confidence: 'low', source: null, ownerUserId: null, deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 1, createdBy: 'user-tomasz-nowak', createdAt: '2026-08-01T09:00:00Z', updatedAt: '2026-08-01T09:00:00Z' },
];
const evidenceLinks: Record<string, any[]> = { 'bn-model-1': [] };
const scenarios: any[] = [
  { scenarioId: 'sc-model-1', caseId: CASE_ID, organizationId: ORG_ID, scenarioType: 'downside', label: 'Opóźnione wdrożenie', description: 'Start przesunięty o kwartał', deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 1, createdBy: USER_ID, createdAt: '2026-06-05T08:00:00Z', updatedAt: '2026-06-05T08:00:00Z' },
];
const calcRuns: any[] = [
  { runId: 'run-model-1', caseId: CASE_ID, organizationId: ORG_ID, scenarioId: null, status: 'completed', totalCosts: 480000, totalFinancialBenefits: 96000, simpleRoi: -80, npv: -350000, irrPct: null, irrStatus: 'no_sign_change', paybackPeriods: null, discountedPaybackPeriods: null, benefitCostRatio: 0.2, inputHash: 'hash-model-1', hasUnresolvedDoubleCounting: false, hasMixedCurrencyFailure: false, validationFindings: [], warnings: [], initiatedBy: USER_ID, startedAt: '2026-08-01T09:00:00Z', completedAt: '2026-08-01T09:00:05Z', createdAt: '2026-08-01T09:00:05Z' },
];
const approvalSnapshots: any[] = [];
const forecastVersions: any[] = [];
const actualEntries: any[] = [];
const actualSnapshots: any[] = [];
const variances: any[] = [];
const varianceCauses: Record<string, any[]> = {};
const pirs: any[] = [];
const financeLinks: any[] = [];
const financeReconciliations: any[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function errorResponse(message: string, status: number, code?: string): Response {
  return jsonResponse({ error: message, code }, status);
}

const g = window as unknown as { __RVN_ROI_MODEL_FETCH__?: boolean };
if (!g.__RVN_ROI_MODEL_FETCH__) {
  g.__RVN_ROI_MODEL_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (rawUrl.includes('/locales/')) return realFetch(input as RequestInfo, init);
    const m = rawUrl.match(/\/vnext\/results\/roi(\/.*)?$/);
    if (!m) return realFetch(input as RequestInfo, init);

    const method = (init?.method ?? 'GET').toUpperCase();
    const [path] = (m[1] ?? '/').split('?');
    const body: any = init?.body ? JSON.parse(String(init.body)) : {};
    const seg = path.split('/').filter(Boolean);

    const bump = () => { roiCase.rowVersion += 1; roiCase.updatedAt = new Date().toISOString(); };

    if (path === '/org/benefits-realization') {
      return jsonResponse({ attention: { cases: [], portfolioTotals: { totalApprovedFinancialBenefits: 0, totalActualFinancialBenefits: 0, caseCountWithActual: 0, caseCountTotal: 0 } } });
    }
    if (path === '/org/pir-outcomes') return jsonResponse({ pirOutcomes: [] });

    if (path === '/cases' && method === 'GET') return jsonResponse({ cases: [roiCase] });
    if (seg[0] === 'cases' && seg.length === 2 && method === 'GET') {
      if (seg[1] !== CASE_ID) return errorResponse('ROI case not found', 404, 'NOT_FOUND');
      return jsonResponse({ case: roiCase });
    }

    const transitionMatch = seg[0] === 'cases' && seg[2] === 'transitions';
    if (transitionMatch && method === 'POST') {
      return jsonResponse({ outcome: 'applied', case: roiCase });
    }

    if (seg[2] === 'baseline') {
      if (method === 'GET') return baseline ? jsonResponse({ baseline }) : errorResponse('No baseline set for this case', 404, 'NOT_FOUND');
      if (method === 'PUT') {
        baseline = { ...(baseline ?? {}), ...body, baselineId: baseline?.baselineId ?? nextId('bl'), caseId: CASE_ID, organizationId: ORG_ID, rowVersion: (baseline?.rowVersion ?? 0) + 1, createdBy: USER_ID, createdAt: baseline?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
        return jsonResponse({ outcome: 'applied', baseline });
      }
    }
    if (seg[2] === 'calculation-policy') {
      if (method === 'GET') return policy ? jsonResponse({ calculationPolicy: policy }) : errorResponse('No calculation policy set for this case', 404, 'NOT_FOUND');
      if (method === 'PUT') {
        policy = { ...(policy ?? {}), ...body, policyRowId: policy?.policyRowId ?? nextId('pol'), caseId: CASE_ID, organizationId: ORG_ID, rowVersion: (policy?.rowVersion ?? 0) + 1, createdBy: USER_ID, createdAt: policy?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
        return jsonResponse({ outcome: 'applied', calculationPolicy: policy });
      }
    }

    function crud(resourceSeg: string, list: any[], idField: string, envelopeKey: string) {
      if (seg[2] !== resourceSeg) return null;
      if (seg.length === 3 && method === 'GET') return jsonResponse({ [`${envelopeKey}s`]: list });
      if (seg.length === 3 && method === 'POST') {
        const created = { ...body, [idField]: nextId(resourceSeg), caseId: CASE_ID, organizationId: ORG_ID, deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 1, createdBy: USER_ID, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        list.push(created);
        return jsonResponse({ outcome: 'applied', [envelopeKey]: created }, 201);
      }
      if (seg.length === 4 && method === 'PATCH') {
        const row = list.find((r) => r[idField] === seg[3]);
        if (!row) return errorResponse('Not found', 404, 'NOT_FOUND');
        Object.assign(row, body, { rowVersion: row.rowVersion + 1, updatedAt: new Date().toISOString() });
        return jsonResponse({ outcome: 'applied', [envelopeKey]: row });
      }
      if (seg.length === 4 && method === 'DELETE') {
        const row = list.find((r) => r[idField] === seg[3]);
        if (!row) return errorResponse('Not found', 404, 'NOT_FOUND');
        row.deletedAt = new Date().toISOString();
        return jsonResponse({ outcome: 'applied', [envelopeKey]: row });
      }
      return undefined;
    }
    const assumptionsResp = crud('assumptions', assumptions, 'assumptionId', 'assumption');
    if (assumptionsResp) return assumptionsResp;
    const costResp = crud('cost-lines', costLines, 'costLineId', 'costLine');
    if (costResp) return costResp;
    const benefitResp = crud('benefit-lines', benefitLines, 'benefitLineId', 'benefitLine');
    if (benefitResp) return benefitResp;

    if (seg[2] === 'benefit-lines' && seg[4] === 'kpi-evidence-links') {
      const benefitLineId = seg[3];
      const links = (evidenceLinks[benefitLineId] ??= []);
      if (seg.length === 5 && method === 'GET') return jsonResponse({ links });
      if (seg.length === 5 && method === 'POST') {
        const created = { linkId: nextId('link'), benefitLineId, caseId: CASE_ID, organizationId: ORG_ID, kpiId: body.kpiId, pinnedKpiDefinitionVersionId: body.pinnedKpiDefinitionVersionId, expectedUnit: body.expectedUnit ?? null, purpose: body.purpose, linkedBy: USER_ID, linkedAt: new Date().toISOString(), freshnessCheckedAt: null, disputeStatus: 'none', notes: body.notes ?? null, rowVersion: 1, createdBy: USER_ID, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        links.push(created);
        return jsonResponse({ outcome: 'applied', link: created }, 201);
      }
      if (seg.length === 6 && method === 'DELETE') {
        const idx = links.findIndex((l) => l.linkId === seg[5]);
        if (idx >= 0) links.splice(idx, 1);
        return jsonResponse({ outcome: 'applied', linkId: seg[5] });
      }
    }

    if (seg[2] === 'scenarios') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ scenarios });
      if (seg.length === 3 && method === 'POST') {
        const created = { scenarioId: nextId('sc'), caseId: CASE_ID, organizationId: ORG_ID, scenarioType: body.scenarioType, label: body.label, description: body.description ?? null, deletedAt: null, deletedBy: null, frozenAt: null, frozenBy: null, rowVersion: 1, createdBy: USER_ID, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        scenarios.push(created);
        return jsonResponse({ outcome: 'applied', scenario: created }, 201);
      }
      if (seg.length === 4 && method === 'PATCH') {
        const s = scenarios.find((x) => x.scenarioId === seg[3]);
        if (!s) return errorResponse('Not found', 404, 'NOT_FOUND');
        Object.assign(s, { label: body.label ?? s.label, description: body.description ?? s.description, rowVersion: s.rowVersion + 1, updatedAt: new Date().toISOString() });
        return jsonResponse({ outcome: 'applied', scenario: s });
      }
      if (seg.length === 4 && method === 'DELETE') {
        const s = scenarios.find((x) => x.scenarioId === seg[3]);
        if (s) s.deletedAt = new Date().toISOString();
        return jsonResponse({ outcome: 'applied', scenario: s });
      }
      if (seg.length === 5 && seg[4] === 'overrides' && method === 'POST') {
        const created = { overrideId: nextId('ov'), scenarioId: seg[3], organizationId: ORG_ID, targetType: body.targetType, targetId: body.targetId, overrideValue: body.overrideValue ?? null, overrideAmount: body.overrideAmount ?? null, note: body.note ?? null, createdBy: USER_ID, createdAt: new Date().toISOString() };
        return jsonResponse({ outcome: 'applied', override: created }, 201);
      }
      if (seg.length === 6 && seg[4] === 'overrides' && method === 'DELETE') {
        return jsonResponse({ outcome: 'applied', overrideId: seg[5] });
      }
    }

    if (seg[2] === 'calculation-runs') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ runs: calcRuns });
      if (seg.length === 3 && method === 'POST') {
        const created = { ...calcRuns[0], runId: nextId('run'), scenarioId: body.scenarioId ?? null, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() };
        calcRuns.unshift(created);
        return jsonResponse({ outcome: 'applied', run: created }, 201);
      }
      if (seg.length === 4 && method === 'GET') {
        const run = calcRuns.find((r) => r.runId === seg[3]);
        return run ? jsonResponse({ run }) : errorResponse('Not found', 404, 'NOT_FOUND');
      }
    }

    if (seg[2] === 'approval-snapshots') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ snapshots: approvalSnapshots });
      if (seg.length === 4 && method === 'GET') {
        const s = approvalSnapshots.find((x) => x.snapshotId === seg[3]);
        return s ? jsonResponse({ snapshot: s }) : errorResponse('Not found', 404, 'NOT_FOUND');
      }
    }
    if (seg[2] === 'forecast-versions') {
      if (seg.length === 3 && method === 'GET') return jsonResponse({ forecastVersions });
      if (seg.length === 4 && method === 'GET') {
        const f = forecastVersions.find((x) => x.forecastVersionId === seg[3]);
        return f ? jsonResponse({ forecastVersion: f }) : errorResponse('Not found', 404, 'NOT_FOUND');
      }
    }
    if (seg[2] === 'compare' && method === 'GET') {
      return jsonResponse({ compare: { caseId: CASE_ID, metrics: {} } });
    }
    if (seg[2] === 'actuals' && seg.length === 3 && method === 'GET') return jsonResponse({ entries: actualEntries });
    if (seg[2] === 'actual-snapshots' && seg.length === 3 && method === 'GET') return jsonResponse({ actualSnapshots });
    if (seg[2] === 'variances' && seg.length === 3 && method === 'GET') return jsonResponse({ variances });
    if (seg[2] === 'benefits-realization' && method === 'GET') {
      return jsonResponse({ benefitsRealization: { caseId: CASE_ID, approvedFinancialBenefits: null, actualFinancialBenefits: null, benefitsRealizationPct: null } });
    }
    if (seg[2] === 'post-investment-reviews' && seg.length === 3 && method === 'GET') return jsonResponse({ postInvestmentReviews: pirs });
    if (seg[2] === 'finance-links' && seg.length === 3 && method === 'GET') return jsonResponse({ financeLinks });
    if (seg[2] === 'finance-reconciliations' && seg.length === 3 && method === 'GET') return jsonResponse({ financeReconciliations });
    if (seg[2] === 'finance-projections' && method === 'GET') return jsonResponse({ financeProjections: [] });
    void bump;
    void varianceCauses;

    return errorResponse(`dev-render ROI model mock: unmatched ${method} ${path}`, 404, 'MOCK_UNMATCHED');
  };
}

const ResultsVNextRoiModelScreen: React.FC = () => {
  const [closed, setClosed] = useState(false);
  const isPolish = true;

  if (closed) {
    return (
      <div className="h-screen bg-c-bg text-c-text flex items-center justify-center">
        <p className="text-sm text-c-text-secondary">
          {isPolish
            ? 'Wrócono z pełnego narzędzia ROI (onBack). Ten harness nie ma rejestru do pokazania — zobacz results-vnext-roi-registry.'
            : 'Returned from the ROI full tool (onBack). This harness has no registry to show — see results-vnext-roi-registry.'}
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-c-bg text-c-text">
      <RoiCaseFullTool
        roiCase={roiCase as unknown as RoiCaseListItem}
        isPolish={isPolish}
        onBack={() => setClosed(true)}
        initialPhase="build"
      />
    </div>
  );
};

export default ResultsVNextRoiModelScreen;
