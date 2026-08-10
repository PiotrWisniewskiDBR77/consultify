/**
 * RN-G2 §G #12-14 — visual QA harness for the ROI Case MODEL SETUP pod-widok
 * (`RoiCaseModelWorkspace` / `roiCaseDetailPresenters.tsx`): Baseline +
 * calculation policy (2-row settings table), Assumptions CRUD, Cost lines
 * CRUD, Benefit lines CRUD.
 *
 * Mounts the REAL `ResultsVNextRegistryShell` fed by the REAL presenter
 * functions (`buildRoiSettings*`/`buildRoiAssumption*`/`buildRoiCostLine*`/
 * `buildRoiBenefitLine*`) and the REAL six form/dialog components
 * (`RoiBaselineEditModal`/`RoiCalculationPolicyEditModal`/
 * `RoiAssumptionFormModal`/`RoiCostLineFormModal`/`RoiBenefitLineFormModal`/
 * `RoiRemoveLineItemDialog`) fed by mock data — NOT `RoiCaseModelWorkspace`
 * itself, which does live `fetch()` calls with no backend available in this
 * harness (same reason `results-vnext-roi-registry.tsx` mounts pieces
 * rather than the live-fetching `ResultsRoiHub`).
 *
 * URL params:
 *   ?tab=settings|assumptions|cost-lines|benefit-lines   (default settings)
 *   &state=ready|loading|empty|error       per-tab StandardTable state
 *   &selected=<id|none>                    pre-select a row (default: first row)
 *   &locked=1                              force the case into a LOCKED status
 *                                           ('approved') instead of 'modeling'
 *                                           — every Add/Edit/Delete affordance
 *                                           on every tab must show visible+
 *                                           disabled+reason, never hidden
 *   &nullBaseline=1 / &nullPolicy=1        force the "no settings record"
 *                                           edge case (`getRoiBaseline`/
 *                                           `getRoiCalculationPolicy` 404)
 *   &editBaseline=1 / &editPolicy=1        open the respective edit modal
 *   &assumptionForm=create|edit            open the assumption form
 *   &costLineForm=create|edit              open the cost line form
 *   &benefitLineForm=create|edit           open the benefit line form
 *   &removeAssumption=1 / &removeCostLine=1 / &removeBenefitLine=1
 *                                           open the remove-confirmation dialog
 *   &formState=idle|saving|error|conflict  write state for whichever modal is open
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ResultsVNextRegistryShell } from '../../src/components/ResultsVNext/ResultsVNextRegistryShell';
import type { RoiCaseListItem } from '../../src/components/ResultsVNext/roi/roiApi';
import type {
  RoiAssumption,
  RoiBaseline,
  RoiBenefitLine,
  RoiCalculationPolicy,
  RoiCostLine,
} from '../../src/components/ResultsVNext/roi/roiCaseDetailApi';
import {
  buildRoiAssumptionColumns,
  buildRoiAssumptionPreview,
  buildRoiBenefitLineColumns,
  buildRoiBenefitLinePreview,
  buildRoiCostLineColumns,
  buildRoiCostLinePreview,
  buildRoiSettingsColumns,
  buildRoiSettingsPreview,
  buildRoiSettingsRowMenu,
  buildRoiSettingsRows,
  type RoiSettingsRowVm,
} from '../../src/components/ResultsVNext/roi/roiCaseDetailPresenters';
import { RoiBaselineEditModal } from '../../src/components/ResultsVNext/roi/RoiBaselineEditModal';
import { RoiCalculationPolicyEditModal } from '../../src/components/ResultsVNext/roi/RoiCalculationPolicyEditModal';
import { RoiAssumptionFormModal } from '../../src/components/ResultsVNext/roi/RoiAssumptionFormModal';
import { RoiCostLineFormModal } from '../../src/components/ResultsVNext/roi/RoiCostLineFormModal';
import { RoiBenefitLineFormModal } from '../../src/components/ResultsVNext/roi/RoiBenefitLineFormModal';
import { RoiRemoveLineItemDialog } from '../../src/components/ResultsVNext/roi/RoiRemoveLineItemDialog';
import type { StandardModuleTab, TableRow } from '../../src/components/standard';

type ModelTab = 'settings' | 'assumptions' | 'cost-lines' | 'benefit-lines';

function withId<T extends object>(row: T, idField: keyof T): T & { id: string } {
  return { ...row, id: String(row[idField]) };
}

// ── Mock case — status switches via &locked=1 to exercise the SAME
//    NON_EDITABLE_STATUSES lock every sub-resource here shares with the
//    registry (roiRegistryMappers.ts ROI_LOCK_INFO).
const params = new URLSearchParams(window.location.search);
const locked = params.get('locked') === '1';
const MOCK_CASE: RoiCaseListItem = {
  caseId: 'roi-case-model-1',
  organizationId: 'org-1',
  initiativeId: 'init-101',
  title: 'Automatyzacja linii pakowania',
  ownerUserId: 'user-anna-kowalska',
  status: locked ? 'approved' : 'modeling',
  currency: 'PLN',
  granularity: 'monthly',
  analysisStart: '2026-01-01',
  analysisEnd: '2026-12-31',
  nextActionType: null,
  nextActionDueAt: null,
  nextReviewAt: null,
  submittedAt: locked ? '2026-07-10T09:00:00Z' : null,
  approvedAt: locked ? '2026-07-20T09:00:00Z' : null,
  rejectedAt: null,
  rejectionReason: null,
  changesRequestedAt: null,
  changesRequestedReason: null,
  archivedAt: null,
  rowVersion: 4,
  createdAt: '2026-06-01T09:00:00Z',
  updatedAt: '2026-08-07T10:00:00Z',
};

const MOCK_BASELINE: RoiBaseline = {
  baselineId: 'baseline-1',
  caseId: MOCK_CASE.caseId,
  organizationId: 'org-1',
  baselinePeriodStart: '2025-01-01',
  baselinePeriodEnd: '2025-12-31',
  currentMeasuredValue: 42000,
  currentMeasuredUnit: 'szt./mies.',
  currentMeasuredAsOf: '2025-12-31',
  bauProjectionMethod: 'growth_rate',
  bauGrowthRatePct: 2.5,
  bauReferenceValue: 43050,
  interventionComparisonNotes: 'Porównanie do linii B przed modernizacją.',
  source: 'Raport produkcyjny Q4 2025',
  confidence: 'high',
  ownerUserId: 'user-anna-kowalska',
  frozenAt: locked ? '2026-07-20T09:00:00Z' : null,
  frozenBy: locked ? 'user-piotr-wisniewski' : null,
  rowVersion: 3,
  createdBy: 'user-anna-kowalska',
  createdAt: '2026-06-01T09:05:00Z',
  updatedAt: '2026-07-15T11:00:00Z',
};

const MOCK_POLICY: RoiCalculationPolicy = {
  policyRowId: 'policy-1',
  caseId: MOCK_CASE.caseId,
  organizationId: 'org-1',
  discountRatePct: 8,
  taxTreatment: 'pre_tax',
  inflationRatePct: 3.2,
  roundingPolicy: 'half_up_2dp',
  requiredMetrics: ['npv', 'irr', 'payback'],
  notes: 'Polityka standardowa dla programu automatyzacji.',
  confidence: 'medium',
  ownerUserId: 'user-anna-kowalska',
  frozenAt: locked ? '2026-07-20T09:00:00Z' : null,
  frozenBy: locked ? 'user-piotr-wisniewski' : null,
  rowVersion: 2,
  createdBy: 'user-anna-kowalska',
  createdAt: '2026-06-01T09:05:00Z',
  updatedAt: '2026-07-10T09:00:00Z',
};

// ── Mock assumptions — spans the honest-missing domain (null vs real).
const MOCK_ASSUMPTIONS: RoiAssumption[] = [
  {
    assumptionId: 'assumption-1',
    caseId: MOCK_CASE.caseId,
    organizationId: 'org-1',
    category: 'Wydajność',
    label: 'Wzrost przepustowości linii',
    unit: 'szt./h',
    baseValue: 120,
    downsideValue: 95,
    upsideValue: 150,
    confidence: 'high',
    evidenceRef: 'DOC-2026-041',
    source: 'Pilot 2026-05',
    ownerUserId: 'user-anna-kowalska',
    sensitivityRank: 1,
    notes: 'Zweryfikowane na pilotażu 6-tygodniowym.',
    deletedAt: null,
    deletedBy: null,
    frozenAt: null,
    frozenBy: null,
    rowVersion: 2,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-06-02T09:00:00Z',
    updatedAt: '2026-07-01T09:00:00Z',
  },
  {
    assumptionId: 'assumption-2',
    caseId: MOCK_CASE.caseId,
    organizationId: 'org-1',
    category: 'Ryzyko',
    label: 'Adopcja operatorów (jeszcze nieoszacowana)',
    unit: '%',
    baseValue: null,
    downsideValue: null,
    upsideValue: null,
    confidence: null,
    evidenceRef: null,
    source: null,
    ownerUserId: null,
    sensitivityRank: null,
    notes: null,
    deletedAt: null,
    deletedBy: null,
    frozenAt: null,
    frozenBy: null,
    rowVersion: 1,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2026-08-01T09:00:00Z',
    updatedAt: '2026-08-01T09:00:00Z',
  },
];

// ── Mock cost lines.
const MOCK_COST_LINES: RoiCostLine[] = [
  {
    costLineId: 'cost-1',
    caseId: MOCK_CASE.caseId,
    organizationId: 'org-1',
    category: 'CAPEX',
    label: 'Zakup robotów pakujących',
    description: 'Dwie jednostki + integracja.',
    amount: 480000,
    currency: 'PLN',
    timingType: 'one_time',
    oneTimePeriodDate: '2026-02-01',
    recurrenceStartDate: null,
    recurrenceEndDate: null,
    recurrenceCadence: null,
    confidence: 'high',
    source: 'Oferta dostawcy #4471',
    ownerUserId: 'user-anna-kowalska',
    deletedAt: null,
    deletedBy: null,
    frozenAt: null,
    frozenBy: null,
    rowVersion: 2,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-06-05T09:00:00Z',
    updatedAt: '2026-07-01T09:00:00Z',
  },
  {
    costLineId: 'cost-2',
    caseId: MOCK_CASE.caseId,
    organizationId: 'org-1',
    category: 'OPEX',
    label: 'Konserwacja roczna',
    description: null,
    amount: 24000,
    currency: 'PLN',
    timingType: 'recurring',
    oneTimePeriodDate: null,
    recurrenceStartDate: '2026-03-01',
    recurrenceEndDate: '2028-12-31',
    recurrenceCadence: 'annual',
    confidence: 'medium',
    source: null,
    ownerUserId: null,
    deletedAt: null,
    deletedBy: null,
    frozenAt: null,
    frozenBy: null,
    rowVersion: 1,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2026-07-01T09:00:00Z',
    updatedAt: '2026-07-01T09:00:00Z',
  },
];

// ── Mock benefit lines — includes a NON-financial one (amount stays null,
//    HonestValueCell "—", never a fabricated 0).
const MOCK_BENEFIT_LINES: RoiBenefitLine[] = [
  {
    benefitLineId: 'benefit-1',
    caseId: MOCK_CASE.caseId,
    organizationId: 'org-1',
    category: 'Oszczędność pracy',
    label: 'Redukcja nadgodzin',
    description: 'Mniej nadgodzin na linii pakowania.',
    isFinancial: true,
    amount: 96000,
    currency: 'PLN',
    timingType: 'recurring',
    oneTimePeriodDate: null,
    recurrenceStartDate: '2026-03-01',
    recurrenceEndDate: null,
    recurrenceCadence: 'monthly',
    rampPeriods: 3,
    doubleCountingGroup: null,
    doubleCountingResolutionNote: null,
    confidence: 'high',
    source: 'Model HR',
    ownerUserId: 'user-anna-kowalska',
    deletedAt: null,
    deletedBy: null,
    frozenAt: null,
    frozenBy: null,
    rowVersion: 3,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-06-05T09:00:00Z',
    updatedAt: '2026-07-10T09:00:00Z',
  },
  {
    benefitLineId: 'benefit-2',
    caseId: MOCK_CASE.caseId,
    organizationId: 'org-1',
    category: 'Jakość',
    label: 'Poprawa satysfakcji operatorów',
    description: 'Korzyść niefinansowa — mierzona ankietą, nie kwotą.',
    isFinancial: false,
    amount: null,
    currency: null,
    timingType: 'one_time',
    oneTimePeriodDate: '2026-09-01',
    recurrenceStartDate: null,
    recurrenceEndDate: null,
    recurrenceCadence: null,
    rampPeriods: null,
    doubleCountingGroup: null,
    doubleCountingResolutionNote: null,
    confidence: 'low',
    source: null,
    ownerUserId: null,
    deletedAt: null,
    deletedBy: null,
    frozenAt: null,
    frozenBy: null,
    rowVersion: 1,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2026-08-01T09:00:00Z',
    updatedAt: '2026-08-01T09:00:00Z',
  },
];

const initialTab = (params.get('tab') as ModelTab) || 'settings';
const state = params.get('state') || 'ready';
const initialSelected = params.get('selected');
const nullBaseline = params.get('nullBaseline') === '1';
const nullPolicy = params.get('nullPolicy') === '1';
const editBaselineParam = params.get('editBaseline') === '1';
const editPolicyParam = params.get('editPolicy') === '1';
const assumptionFormParam = params.get('assumptionForm') as 'create' | 'edit' | null;
const costLineFormParam = params.get('costLineForm') as 'create' | 'edit' | null;
const benefitLineFormParam = params.get('benefitLineForm') as 'create' | 'edit' | null;
const removeAssumptionParam = params.get('removeAssumption') === '1';
const removeCostLineParam = params.get('removeCostLine') === '1';
const removeBenefitLineParam = params.get('removeBenefitLine') === '1';
const formStateParam = (params.get('formState') as 'idle' | 'saving' | 'error' | 'conflict' | null) ?? 'idle';

const ResultsVNextRoiModelScreen: React.FC = () => {
  const [tab, setTab] = useState<ModelTab>(initialTab);
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [selectedSettingsId, setSelectedSettingsId] = useState<'baseline' | 'calculation-policy' | null>(
    initialSelected === 'none' ? null : ((initialSelected as 'baseline' | 'calculation-policy' | null) ?? 'baseline')
  );
  const [selectedAssumptionId, setSelectedAssumptionId] = useState<string | null>(
    initialSelected === 'none' ? null : (initialSelected ?? MOCK_ASSUMPTIONS[0]?.assumptionId ?? null)
  );
  const [selectedCostLineId, setSelectedCostLineId] = useState<string | null>(
    initialSelected === 'none' ? null : (initialSelected ?? MOCK_COST_LINES[0]?.costLineId ?? null)
  );
  const [selectedBenefitLineId, setSelectedBenefitLineId] = useState<string | null>(
    initialSelected === 'none' ? null : (initialSelected ?? MOCK_BENEFIT_LINES[0]?.benefitLineId ?? null)
  );

  const busy = formStateParam === 'saving';
  const errorMessage =
    formStateParam === 'error'
      ? isPolish
        ? 'Pole jest wymagane.'
        : 'A field is required.'
      : formStateParam === 'conflict'
        ? isPolish
          ? 'Rekord został zmieniony przez kogoś innego w międzyczasie.'
          : 'The record was modified by someone else in the meantime.'
        : null;

  const baseline = nullBaseline ? null : MOCK_BASELINE;
  const policy = nullPolicy ? null : MOCK_POLICY;

  const tabs: StandardModuleTab[] = [
    { id: 'settings', label: isPolish ? 'Baseline i polityka' : 'Baseline & policy' },
    { id: 'assumptions', label: isPolish ? 'Założenia' : 'Assumptions' },
    { id: 'cost-lines', label: isPolish ? 'Koszty' : 'Cost lines' },
    { id: 'benefit-lines', label: isPolish ? 'Korzyści' : 'Benefit lines' },
  ];
  const breadcrumbs = [
    { label: isPolish ? 'Rejestr ROI' : 'ROI registry', onClick: () => {} },
    { label: MOCK_CASE.title },
  ];
  const lockedReason = isPolish
    ? 'Sprawa zaakceptowana — baseline i model ekonomiczny są zamrożone (migawka akceptacji).'
    : 'Approved case — baseline and economic model are frozen (approval snapshot taken).';

  const addCta = (label: string) => ({ label, onClick: () => {}, locked, lockedReason });

  if (tab === 'assumptions') {
    const rows: TableRow[] = state === 'empty' ? [] : MOCK_ASSUMPTIONS.map((a) => withId(a, 'assumptionId'));
    const selected = MOCK_ASSUMPTIONS.find((a) => a.assumptionId === selectedAssumptionId) ?? null;
    return (
      <div className="h-screen bg-c-bg text-c-text">
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            breadcrumbs,
            tabs,
            activeTab: 'assumptions',
            onTabChange: (id) => setTab(id as ModelTab),
            showTabCounts: false,
            viewModes: ['table'],
            viewMode: 'table',
            primaryCta: addCta(isPolish ? 'Nowe założenie' : 'New assumption'),
          }}
          table={{
            columns: buildRoiAssumptionColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.roi-model.assumptions',
            loading: state === 'loading',
            error: state === 'error' ? (isPolish ? 'Nie udało się wczytać założeń.' : 'Failed to load assumptions.') : null,
            onRetry: () => {},
            empty: state === 'empty' ? { title: isPolish ? 'Brak założeń' : 'No assumptions yet', description: '' } : undefined,
            selectedRowId: selectedAssumptionId,
            onRowClick: (row) => setSelectedAssumptionId(String(row.assumptionId)),
            rowMenu: (row) => {
              const a = row as unknown as RoiAssumption;
              return {
                primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => setSelectedAssumptionId(a.assumptionId) }],
                universalHandlers: { preview: () => setSelectedAssumptionId(a.assumptionId), editNote: locked ? lockedReason : undefined },
                destructive: locked ? { note: lockedReason } : { onClick: () => {} },
              };
            },
          }}
          preview={state === 'ready' && selected ? buildRoiAssumptionPreview(selected, MOCK_CASE.status, isPolish, () => setSelectedAssumptionId(null)) : null}
        />
        <RoiAssumptionFormModal
          open={assumptionFormParam !== null}
          mode={assumptionFormParam ?? 'create'}
          assumption={assumptionFormParam === 'edit' ? selected : null}
          onClose={() => {}}
          onSubmit={() => {}}
          isPolish={isPolish}
          busy={busy}
          errorMessage={errorMessage}
          isConflict={formStateParam === 'conflict'}
        />
        <RoiRemoveLineItemDialog
          open={removeAssumptionParam}
          itemLabel={selected?.label ?? ''}
          isPolish={isPolish}
          onClose={() => {}}
          onSubmit={() => {}}
          busy={busy}
          errorMessage={errorMessage}
          isConflict={formStateParam === 'conflict'}
        />
      </div>
    );
  }

  if (tab === 'cost-lines') {
    const rows: TableRow[] = state === 'empty' ? [] : MOCK_COST_LINES.map((c) => withId(c, 'costLineId'));
    const selected = MOCK_COST_LINES.find((c) => c.costLineId === selectedCostLineId) ?? null;
    return (
      <div className="h-screen bg-c-bg text-c-text">
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            breadcrumbs,
            tabs,
            activeTab: 'cost-lines',
            onTabChange: (id) => setTab(id as ModelTab),
            showTabCounts: false,
            viewModes: ['table'],
            viewMode: 'table',
            primaryCta: addCta(isPolish ? 'Nowa pozycja kosztowa' : 'New cost line'),
          }}
          table={{
            columns: buildRoiCostLineColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.roi-model.cost-lines',
            loading: state === 'loading',
            error: state === 'error' ? (isPolish ? 'Nie udało się wczytać kosztów.' : 'Failed to load cost lines.') : null,
            onRetry: () => {},
            empty: state === 'empty' ? { title: isPolish ? 'Brak pozycji kosztowych' : 'No cost lines yet', description: '' } : undefined,
            selectedRowId: selectedCostLineId,
            onRowClick: (row) => setSelectedCostLineId(String(row.costLineId)),
            rowMenu: (row) => {
              const c = row as unknown as RoiCostLine;
              return {
                primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => setSelectedCostLineId(c.costLineId) }],
                universalHandlers: { preview: () => setSelectedCostLineId(c.costLineId), editNote: locked ? lockedReason : undefined },
                destructive: locked ? { note: lockedReason } : { onClick: () => {} },
              };
            },
          }}
          preview={state === 'ready' && selected ? buildRoiCostLinePreview(selected, MOCK_CASE.status, isPolish, () => setSelectedCostLineId(null)) : null}
        />
        <RoiCostLineFormModal
          open={costLineFormParam !== null}
          mode={costLineFormParam ?? 'create'}
          costLine={costLineFormParam === 'edit' ? selected : null}
          defaultCurrency={MOCK_CASE.currency}
          onClose={() => {}}
          onSubmit={() => {}}
          isPolish={isPolish}
          busy={busy}
          errorMessage={errorMessage}
          isConflict={formStateParam === 'conflict'}
        />
        <RoiRemoveLineItemDialog
          open={removeCostLineParam}
          itemLabel={selected?.label ?? ''}
          isPolish={isPolish}
          onClose={() => {}}
          onSubmit={() => {}}
          busy={busy}
          errorMessage={errorMessage}
          isConflict={formStateParam === 'conflict'}
        />
      </div>
    );
  }

  if (tab === 'benefit-lines') {
    const rows: TableRow[] = state === 'empty' ? [] : MOCK_BENEFIT_LINES.map((b) => withId(b, 'benefitLineId'));
    const selected = MOCK_BENEFIT_LINES.find((b) => b.benefitLineId === selectedBenefitLineId) ?? null;
    return (
      <div className="h-screen bg-c-bg text-c-text">
        <ResultsVNextRegistryShell
          domain="roi"
          moduleBar={{
            breadcrumbs,
            tabs,
            activeTab: 'benefit-lines',
            onTabChange: (id) => setTab(id as ModelTab),
            showTabCounts: false,
            viewModes: ['table'],
            viewMode: 'table',
            primaryCta: addCta(isPolish ? 'Nowa pozycja korzyści' : 'New benefit line'),
          }}
          table={{
            columns: buildRoiBenefitLineColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.roi-model.benefit-lines',
            loading: state === 'loading',
            error: state === 'error' ? (isPolish ? 'Nie udało się wczytać korzyści.' : 'Failed to load benefit lines.') : null,
            onRetry: () => {},
            empty: state === 'empty' ? { title: isPolish ? 'Brak pozycji korzyści' : 'No benefit lines yet', description: '' } : undefined,
            selectedRowId: selectedBenefitLineId,
            onRowClick: (row) => setSelectedBenefitLineId(String(row.benefitLineId)),
            rowMenu: (row) => {
              const b = row as unknown as RoiBenefitLine;
              return {
                primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => setSelectedBenefitLineId(b.benefitLineId) }],
                universalHandlers: { preview: () => setSelectedBenefitLineId(b.benefitLineId), editNote: locked ? lockedReason : undefined },
                destructive: locked ? { note: lockedReason } : { onClick: () => {} },
              };
            },
          }}
          preview={state === 'ready' && selected ? buildRoiBenefitLinePreview(selected, MOCK_CASE.status, isPolish, () => setSelectedBenefitLineId(null)) : null}
        />
        <RoiBenefitLineFormModal
          open={benefitLineFormParam !== null}
          mode={benefitLineFormParam ?? 'create'}
          benefitLine={benefitLineFormParam === 'edit' ? selected : null}
          defaultCurrency={MOCK_CASE.currency}
          onClose={() => {}}
          onSubmit={() => {}}
          isPolish={isPolish}
          busy={busy}
          errorMessage={errorMessage}
          isConflict={formStateParam === 'conflict'}
        />
        <RoiRemoveLineItemDialog
          open={removeBenefitLineParam}
          itemLabel={selected?.label ?? ''}
          isPolish={isPolish}
          onClose={() => {}}
          onSubmit={() => {}}
          busy={busy}
          errorMessage={errorMessage}
          isConflict={formStateParam === 'conflict'}
        />
      </div>
    );
  }

  // ── "settings" (default) — Baseline + Calculation policy 2-row table.
  const settingsRows: TableRow[] =
    state === 'empty' ? [] : buildRoiSettingsRows(baseline, policy).map((r) => withId(r, 'id'));
  const selected = settingsRows.find((r) => r.id === selectedSettingsId) as unknown as RoiSettingsRowVm | undefined;

  return (
    <div className="h-screen bg-c-bg text-c-text">
      <ResultsVNextRegistryShell
        domain="roi"
        moduleBar={{
          breadcrumbs,
          tabs,
          activeTab: 'settings',
          onTabChange: (id) => setTab(id as ModelTab),
          showTabCounts: false,
          viewModes: ['table'],
          viewMode: 'table',
        }}
        table={{
          columns: buildRoiSettingsColumns(isPolish),
          data: settingsRows,
          persistKey: 'results-vnext.roi-model.settings',
          loading: state === 'loading',
          error: state === 'error' ? (isPolish ? 'Nie udało się wczytać ustawień.' : 'Failed to load settings.') : null,
          onRetry: () => {},
          selectedRowId: selectedSettingsId,
          onRowClick: (row) => setSelectedSettingsId(row.id as 'baseline' | 'calculation-policy'),
          rowMenu: (row) =>
            buildRoiSettingsRowMenu(row as unknown as RoiSettingsRowVm, MOCK_CASE.status, isPolish, {
              onEdit: () => {},
              onPreview: (r) => setSelectedSettingsId(r.id),
            }),
        }}
        preview={state === 'ready' && selected ? buildRoiSettingsPreview(selected, MOCK_CASE.status, isPolish, () => setSelectedSettingsId(null)) : null}
      />
      <RoiBaselineEditModal
        open={editBaselineParam}
        baseline={baseline}
        onClose={() => {}}
        onSubmit={() => {}}
        isPolish={isPolish}
        busy={busy}
        errorMessage={errorMessage}
        isConflict={formStateParam === 'conflict'}
      />
      <RoiCalculationPolicyEditModal
        open={editPolicyParam}
        policy={policy}
        onClose={() => {}}
        onSubmit={() => {}}
        isPolish={isPolish}
        busy={busy}
        errorMessage={errorMessage}
        isConflict={formStateParam === 'conflict'}
      />
    </div>
  );
};

export default ResultsVNextRoiModelScreen;
