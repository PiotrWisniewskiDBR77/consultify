/**
 * RN-G2 P2/G2-create — visual QA harness for the ROI registry
 * (`ResultsRoiHub` / `roiRegistryPresenters.tsx`) PLUS the quick-create
 * modal (`RoiCaseCreateModal`) and the 7-transition dialog
 * (`RoiTransitionDialog`). Mounts the REAL `ResultsVNextRegistryShell` fed
 * by the REAL presenter functions (`buildRoiCaseColumns`/
 * `buildRoiCaseRowMenu`/`buildRoiCasePreview`/
 * `buildRoiBenefitsRealizationColumns`/`buildRoiBenefitsRealizationPreview`)
 * and the REAL `RoiCaseCreateModal`/`RoiTransitionDialog` components fed by
 * mock initiatives/case data — NOT `ResultsRoiHub` itself, which does live
 * `fetch()` calls with no backend available in this harness (same reason
 * the P0 `results-vnext-registry-shell.tsx` screen mounts the shell
 * directly rather than a data-fetching page).
 *
 * URL params:
 *   ?tab=all|benefits             which Menu 2 tab (default all)
 *   &state=ready|loading|empty|error   top-level StandardTable state (default ready)
 *   &selected=<caseId|none>       pre-select a row (default: first row); 'none' closes preview
 *   &calc=loading|ready           force the "All cases" preview's lazy calc-run fetch to stay
 *                                  in-flight (shows the "Wczytywanie…/Loading…" honest-missing
 *                                  interim state) vs resolved (default ready)
 *   &create=open|saving|error|conflict   opens `RoiCaseCreateModal` in the given state
 *   &transition=<akcja>           opens `RoiTransitionDialog` for the given transition id
 *                                  (approve|reject|request_changes|reopen_for_revision|
 *                                  cancel|start_pir|close) against the row picked by
 *                                  `&selected=` (default: first row)
 *   &transitionState=idle|saving|error|conflict   the transition dialog's write state
 *                                  (default idle)
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ResultsVNextRegistryShell } from '../../src/components/ResultsVNext/ResultsVNextRegistryShell';
import { RoiCaseCreateModal, type RoiCaseCreateInitiativeOption } from '../../src/components/ResultsVNext/roi/RoiCaseCreateModal';
import { RoiTransitionDialog } from '../../src/components/ResultsVNext/roi/RoiTransitionDialog';
import type { RoiCalculationRunSummary, RoiCaseListItem, RoiOrgBenefitsRealizationRow } from '../../src/components/ResultsVNext/roi/roiApi';
import {
  buildRoiBenefitsRealizationColumns,
  buildRoiBenefitsRealizationPreview,
  buildRoiCaseColumns,
  buildRoiCasePreview,
  buildRoiCaseRowMenu,
  type RoiBenefitsRealizationRowVm,
} from '../../src/components/ResultsVNext/roi/roiRegistryPresenters';
import { ROI_TRANSITIONS, type RoiTransitionId } from '../../src/components/ResultsVNext/roi/roiRegistryMappers';
import type { StandardCounterChip, TableRow } from '../../src/components/standard';

// ── Mock "All cases" data — one representative case per bucket, spanning the
//    honest-missing domain (null / not_calculable / real) for NPV/IRR/payback.
const MOCK_CASES: RoiCaseListItem[] = [
  {
    caseId: 'roi-case-1',
    organizationId: 'org-1',
    initiativeId: 'init-101',
    title: 'Automatyzacja linii pakowania',
    ownerUserId: 'user-anna-kowalska',
    status: 'modeling',
    currency: 'PLN',
    granularity: 'monthly',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    nextActionType: 'complete_economic_model',
    nextActionDueAt: '2026-08-20',
    nextReviewAt: null,
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    archivedAt: null,
    rowVersion: 3,
    createdAt: '2026-07-01T09:00:00Z',
    updatedAt: '2026-08-07T10:00:00Z',
  },
  {
    caseId: 'roi-case-2',
    organizationId: 'org-1',
    initiativeId: 'init-102',
    title: 'Migracja legacy MES',
    ownerUserId: 'user-tomasz-nowak',
    status: 'submitted_for_approval',
    currency: 'PLN',
    granularity: 'monthly',
    analysisStart: '2026-02-01',
    analysisEnd: '2027-01-31',
    nextActionType: 'review_decision',
    nextActionDueAt: '2026-08-15',
    nextReviewAt: null,
    submittedAt: '2026-08-02T12:00:00Z',
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    archivedAt: null,
    rowVersion: 5,
    createdAt: '2026-06-15T09:00:00Z',
    updatedAt: '2026-08-02T12:00:00Z',
  },
  {
    caseId: 'roi-case-3',
    organizationId: 'org-1',
    initiativeId: 'init-103',
    title: 'Program szkoleń Lean (zero cost basis)',
    ownerUserId: 'user-piotr-wisniewski',
    status: 'approved',
    currency: 'PLN',
    granularity: 'annual',
    analysisStart: '2026-01-01',
    analysisEnd: '2028-12-31',
    nextActionType: 'start_tracking',
    nextActionDueAt: null,
    nextReviewAt: null,
    submittedAt: '2026-07-10T09:00:00Z',
    approvedAt: '2026-07-20T09:00:00Z',
    rejectedAt: null,
    rejectionReason: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    archivedAt: null,
    rowVersion: 8,
    createdAt: '2026-05-01T09:00:00Z',
    updatedAt: '2026-07-20T09:00:00Z',
  },
  {
    caseId: 'roi-case-4',
    organizationId: 'org-1',
    initiativeId: 'init-104',
    title: 'Rollup finansowy — jedno źródło',
    ownerUserId: 'user-anna-kowalska',
    status: 'tracking',
    currency: 'PLN',
    granularity: 'monthly',
    analysisStart: '2025-09-01',
    analysisEnd: '2026-08-31',
    nextActionType: 'record_actual',
    nextActionDueAt: '2026-08-31',
    nextReviewAt: '2026-09-01',
    submittedAt: '2025-08-01T09:00:00Z',
    approvedAt: '2025-08-15T09:00:00Z',
    rejectedAt: null,
    rejectionReason: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    archivedAt: null,
    rowVersion: 22,
    createdAt: '2025-07-01T09:00:00Z',
    updatedAt: '2026-08-05T09:00:00Z',
  },
  {
    caseId: 'roi-case-5',
    organizationId: 'org-1',
    initiativeId: 'init-105',
    title: 'Wdrożenie robotyzacji magazynu (odrzucone)',
    ownerUserId: 'user-tomasz-nowak',
    status: 'rejected',
    currency: 'PLN',
    granularity: 'monthly',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    nextActionType: null,
    nextActionDueAt: null,
    nextReviewAt: null,
    submittedAt: '2026-06-01T09:00:00Z',
    approvedAt: null,
    rejectedAt: '2026-06-10T09:00:00Z',
    rejectionReason: 'Założenia bazowe niespójne z audytem finansowym Q2.',
    changesRequestedAt: null,
    changesRequestedReason: null,
    archivedAt: null,
    rowVersion: 6,
    createdAt: '2026-05-10T09:00:00Z',
    updatedAt: '2026-06-10T09:00:00Z',
  },
  {
    caseId: 'roi-case-6',
    organizationId: 'org-1',
    initiativeId: 'init-106',
    title: 'Cyfryzacja obiegu dokumentów (szkic)',
    ownerUserId: 'user-piotr-wisniewski',
    status: 'draft',
    currency: 'EUR',
    granularity: 'monthly',
    analysisStart: null,
    analysisEnd: null,
    nextActionType: 'set_baseline',
    nextActionDueAt: null,
    nextReviewAt: null,
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    archivedAt: null,
    rowVersion: 1,
    createdAt: '2026-08-01T09:00:00Z',
    updatedAt: '2026-08-01T09:00:00Z',
  },
];

// ── Mock calculation runs, keyed by caseId — spans the honest-missing domain:
//    roi-case-1 → no run yet (null)
//    roi-case-2 → completed, all real values
//    roi-case-3 → completed, but irrStatus !== 'computed' (not_calculable IRR, real NPV)
//    roi-case-4 → failed run (not_calculable everywhere)
const MOCK_RUNS: Record<string, RoiCalculationRunSummary | null> = {
  'roi-case-1': null,
  'roi-case-2': {
    runId: 'run-2',
    caseId: 'roi-case-2',
    status: 'completed',
    scenarioId: null,
    totalCosts: 420000,
    totalFinancialBenefits: 980000,
    simpleRoi: 133.3,
    npv: 512000,
    irrPct: 34.2,
    irrStatus: 'computed',
    paybackPeriods: 14,
    discountedPaybackPeriods: 16,
    benefitCostRatio: 2.33,
    warnings: [],
    completedAt: '2026-08-02T11:00:00Z',
    createdAt: '2026-08-02T11:00:00Z',
  },
  'roi-case-3': {
    runId: 'run-3',
    caseId: 'roi-case-3',
    status: 'completed',
    scenarioId: null,
    totalCosts: 0,
    totalFinancialBenefits: 210000,
    simpleRoi: null,
    npv: 198000,
    irrPct: null,
    irrStatus: 'no_sign_change',
    paybackPeriods: 0,
    discountedPaybackPeriods: 0,
    benefitCostRatio: null,
    warnings: ['Zero-cost basis — cost line total is 0'],
    completedAt: '2026-07-19T11:00:00Z',
    createdAt: '2026-07-19T11:00:00Z',
  },
  'roi-case-4': {
    runId: 'run-4',
    caseId: 'roi-case-4',
    status: 'failed',
    scenarioId: null,
    totalCosts: null,
    totalFinancialBenefits: null,
    simpleRoi: null,
    npv: null,
    irrPct: null,
    irrStatus: 'not_applicable',
    paybackPeriods: null,
    discountedPaybackPeriods: null,
    benefitCostRatio: null,
    warnings: ['Mixed-currency benefit lines could not be resolved'],
    completedAt: '2026-08-04T09:00:00Z',
    createdAt: '2026-08-04T09:00:00Z',
  },
};

// ── Mock "Benefits realization" org-perspective rows — plain nullable
//    amounts, no currency (matches the real endpoint's actual column set).
const MOCK_BENEFITS_ROWS: RoiOrgBenefitsRealizationRow[] = [
  {
    caseId: 'roi-case-4',
    initiativeId: 'init-104',
    title: 'Rollup finansowy — jedno źródło',
    status: 'tracking',
    approvedFinancialBenefits: 140000,
    actualFinancialBenefits: 98000,
    benefitsRealizationPct: 70,
  },
  {
    caseId: 'roi-case-7',
    initiativeId: 'init-107',
    title: 'Optymalizacja logistyki dostaw',
    status: 'benefits_realization',
    approvedFinancialBenefits: 260000,
    actualFinancialBenefits: null,
    benefitsRealizationPct: null,
  },
  {
    caseId: 'roi-case-8',
    initiativeId: 'init-108',
    title: 'Konsolidacja centrów danych (zero denominator)',
    status: 'tracking',
    approvedFinancialBenefits: 0,
    actualFinancialBenefits: 12000,
    benefitsRealizationPct: null,
  },
];

// ── Mock initiatives — the create modal's `initiativeId` picker. Titles
//    deliberately overlap with `MOCK_CASES[*].initiativeId` (init-101..106)
//    plus two extra WITHOUT an existing ROI case yet (init-201/202), so a
//    QA reviewer can see the picker is a real, independent initiative list,
//    not derived from the case rows already on screen.
const MOCK_INITIATIVES: RoiCaseCreateInitiativeOption[] = [
  { id: 'init-101', title: 'Automatyzacja linii pakowania' },
  { id: 'init-102', title: 'Migracja legacy MES' },
  { id: 'init-103', title: 'Program szkoleń Lean' },
  { id: 'init-104', title: 'Rollup finansowy — jedno źródło' },
  { id: 'init-105', title: 'Wdrożenie robotyzacji magazynu' },
  { id: 'init-106', title: 'Cyfryzacja obiegu dokumentów' },
  { id: 'init-201', title: 'Konsolidacja dostawców logistycznych' },
  { id: 'init-202', title: 'Modernizacja floty serwisowej' },
];

const MOCK_CURRENT_USER_ID = 'user-anna-kowalska';

function withId<T extends { caseId: string }>(row: T): T & { id: string } {
  return { ...row, id: row.caseId };
}

const params = new URLSearchParams(window.location.search);
const initialTab = (params.get('tab') as 'all' | 'benefits') || 'all';
const state = params.get('state') || 'ready';
const calcState = params.get('calc') || 'ready';
const initialSelected = params.get('selected');
const createParam = params.get('create') as 'open' | 'saving' | 'error' | 'conflict' | null;
const transitionParam = params.get('transition') as RoiTransitionId | null;
const transitionStateParam = (params.get('transitionState') as 'idle' | 'saving' | 'error' | 'conflict' | null) ?? 'idle';

const ResultsVNextRoiRegistryScreen: React.FC = () => {
  const [tab, setTab] = useState<'all' | 'benefits'>(initialTab);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(
    initialSelected === 'none' ? null : (initialSelected ?? MOCK_CASES[0]?.caseId ?? null)
  );
  const [selectedBenefitsCaseId, setSelectedBenefitsCaseId] = useState<string | null>(
    initialSelected === 'none' ? null : (initialSelected ?? MOCK_BENEFITS_ROWS[0]?.caseId ?? null)
  );

  // Mirrors the REAL `ResultsRoiHub.tsx` (L66-67): `isPolish` follows the
  // harness's `&lang=` param via i18n, not a hardcoded constant — otherwise
  // `&lang=en` silently has no effect on this screen's copy (RN-G2 P2 QA
  // 2026-08-10 fix).
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const selectedCase = useMemo(
    () => MOCK_CASES.find((c) => c.caseId === selectedCaseId) ?? null,
    [selectedCaseId]
  );
  const selectedBenefitsRow = useMemo(
    () => MOCK_BENEFITS_ROWS.find((r) => r.caseId === selectedBenefitsCaseId) ?? null,
    [selectedBenefitsCaseId]
  );

  // Mirrors `ResultsRoiHub.tsx` L160-187 EXACTLY — tabs/chips/empty/error
  // copy must localize via `isPolish` here too, or `&lang=en` QA runs give a
  // false negative (harness shows Polish chrome the real Hub never would).
  const tabs = [
    { id: 'all', label: isPolish ? 'Wszystkie sprawy' : 'All cases' },
    { id: 'benefits', label: isPolish ? 'Realizacja korzyści' : 'Benefits realization' },
  ];

  const chips: StandardCounterChip[] = [
    { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: MOCK_CASES.length },
    { id: 'in_progress', label: isPolish ? 'W toku' : 'In progress', count: MOCK_CASES.filter((c) => ['not_started', 'draft', 'modeling', 'ready_for_review', 'changes_requested'].includes(c.status)).length },
    { id: 'in_review', label: isPolish ? 'Do akceptacji' : 'In review', count: MOCK_CASES.filter((c) => c.status === 'submitted_for_approval').length },
    { id: 'active', label: isPolish ? 'Aktywne' : 'Active', count: MOCK_CASES.filter((c) => ['approved', 'tracking', 'benefits_realization', 'post_investment_review_due', 'post_investment_review'].includes(c.status)).length },
    { id: 'closed_out', label: isPolish ? 'Zamknięte / odrzucone' : 'Closed / rejected', count: MOCK_CASES.filter((c) => ['closed', 'cancelled', 'rejected'].includes(c.status)).length },
  ];

  if (tab === 'benefits') {
    const rows: TableRow[] = state === 'empty' ? [] : MOCK_BENEFITS_ROWS.map(withId);
    return (
      <div className="h-screen bg-c-bg text-c-text">
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            tabs,
            activeTab: 'benefits',
            onTabChange: (id) => setTab(id as 'all' | 'benefits'),
            showTabCounts: false,
            viewModes: ['table'],
            viewMode: 'table',
          }}
          table={{
            columns: buildRoiBenefitsRealizationColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.roi-registry.benefits',
            loading: state === 'loading',
            error:
              state === 'error'
                ? isPolish
                  ? 'Nie udało się wczytać realizacji korzyści — usługa zwróciła 503.'
                  : 'Failed to load benefits realization — the service returned 503.'
                : null,
            onRetry: () => {},
            empty:
              state === 'empty'
                ? {
                    title: isPolish ? 'Brak spraw w realizacji' : 'No cases in realization',
                    description: isPolish
                      ? 'Żadna sprawa nie jest obecnie śledzona.'
                      : 'No case is currently being tracked.',
                  }
                : undefined,
            selectedRowId: selectedBenefitsCaseId,
            onRowClick: (row) => setSelectedBenefitsCaseId(String(row.caseId)),
          }}
          preview={
            state === 'ready' && selectedBenefitsRow
              ? buildRoiBenefitsRealizationPreview(
                  selectedBenefitsRow as RoiBenefitsRealizationRowVm,
                  isPolish,
                  () => setSelectedBenefitsCaseId(null)
                )
              : null
          }
        />
      </div>
    );
  }

  const rows: TableRow[] = state === 'empty' ? [] : MOCK_CASES.map(withId);
  const calculationRun =
    calcState === 'loading' ? undefined : selectedCaseId ? (MOCK_RUNS[selectedCaseId] ?? null) : undefined;

  // ── Quick-create modal — state driven entirely by `&create=` so a single
  //    load renders one static, screenshot-able state (no click simulation
  //    needed for these 4 snapshots).
  const createOpen = createParam !== null;
  const createBusy = createParam === 'saving';
  const createErrorMessage =
    createParam === 'error'
      ? isPolish
        ? 'Nazwa sprawy jest wymagana.'
        : 'Case title is required.'
      : createParam === 'conflict'
        ? isPolish
          ? 'Sprawa została zmieniona przez kogoś innego w międzyczasie.'
          : 'The case was modified by someone else in the meantime.'
        : null;

  // ── Transition dialog — `&transition=<id>` opens it against the row
  //    picked by `&selected=` (falls back to the first mock case), state
  //    driven by `&transitionState=`.
  const transitionRow = selectedCase ?? MOCK_CASES[0] ?? null;
  const transitionOpen = transitionParam !== null && !!transitionRow;
  const transitionBusy = transitionStateParam === 'saving';
  const transitionErrorMessage =
    transitionStateParam === 'error'
      ? isPolish
        ? 'Powód jest wymagany dla tego przejścia.'
        : 'A reason is required for this transition.'
      : transitionStateParam === 'conflict'
        ? isPolish
          ? 'Sprawa została zmieniona przez kogoś innego w międzyczasie.'
          : 'The case was modified by someone else in the meantime.'
        : null;

  return (
    <div className="h-screen bg-c-bg text-c-text">
      <ResultsVNextRegistryShell
        domain="roi"
        moduleBar={{
          tabs,
          activeTab: 'all',
          onTabChange: (id) => setTab(id as 'all' | 'benefits'),
          showTabCounts: false,
          viewModes: ['table'],
          viewMode: 'table',
          chips,
          activeChip: 'all',
          onChipChange: () => {},
          primaryCta: {
            label: isPolish ? 'Nowa sprawa ROI' : 'New ROI case',
            onClick: () => {},
            testId: 'roi-registry-create-cta',
          },
        }}
        table={{
          columns: buildRoiCaseColumns(isPolish),
          data: rows,
          persistKey: 'results-vnext.roi-registry',
          loading: state === 'loading',
          error:
            state === 'error'
              ? isPolish
                ? 'Nie udało się wczytać rejestru ROI — usługa zwróciła 503.'
                : 'Failed to load the ROI registry — the service returned 503.'
              : null,
          onRetry: () => {},
          empty:
            state === 'empty'
              ? {
                  title: isPolish ? 'Brak spraw ROI' : 'No ROI cases yet',
                  description: isPolish
                    ? 'W tej organizacji nie utworzono jeszcze żadnej sprawy ROI.'
                    : 'No ROI case has been created in this organization yet.',
                }
              : undefined,
          selectedRowId: selectedCaseId,
          onRowClick: (row) => setSelectedCaseId(String(row.caseId)),
          rowMenu: (row) =>
            buildRoiCaseRowMenu(row as unknown as RoiCaseListItem, isPolish, {
              onPreview: (r) => setSelectedCaseId(r.caseId),
              onTransition: () => {},
            }),
          defaultSort: { columnId: 'updatedAt', direction: 'desc' },
        }}
        preview={
          state === 'ready' && selectedCase
            ? buildRoiCasePreview(selectedCase, {
                isPolish,
                onClose: () => setSelectedCaseId(null),
                calculationRun,
              })
            : null
        }
      />
      <RoiCaseCreateModal
        open={createOpen}
        onClose={() => {}}
        onSubmit={() => {}}
        isPolish={isPolish}
        initiatives={MOCK_INITIATIVES}
        currentUserId={MOCK_CURRENT_USER_ID}
        busy={createBusy}
        errorMessage={createErrorMessage}
        isConflict={createParam === 'conflict'}
      />
      {transitionRow ? (
        <RoiTransitionDialog
          open={transitionOpen}
          transitionId={transitionParam && ROI_TRANSITIONS[transitionParam] ? transitionParam : null}
          caseTitle={transitionRow.title}
          isPolish={isPolish}
          onClose={() => {}}
          onSubmit={() => {}}
          busy={transitionBusy}
          errorMessage={transitionErrorMessage}
          isConflict={transitionStateParam === 'conflict'}
        />
      ) : null}
    </div>
  );
};

export default ResultsVNextRoiRegistryScreen;
