/**
 * ResultsRoiHub — RN-G2 P2, the real "/results/roi" screen: ROI Case
 * registry list + preview (RN_G2_UI_SCOPE.md §G #11), built on the P0 shared
 * shell (`ResultsVNextRegistryShell`). Deliberately NOT the full 15-sub-
 * resource ROI Case tool (create/baseline/assumptions/cost+benefit lines/
 * scenarios/lifecycle transitions/forecast/actuals/variances/PIR/finance
 * links — §G #12-21) — those are later packages.
 *
 * Two Menu 2 tabs, both real backend data, no fabricated rows:
 *  - "All cases"           → `GET /cases` (§C `roi.routes.ts`), the actual
 *                             registry. NPV/IRR are NOT columns here — the
 *                             list endpoint does not return them (only
 *                             `rvn_roi_cases` fields, see `roiRepository.ts`
 *                             `listRoiCases` — bare `SELECT rc.*`), and
 *                             fetching them per-row would mean an N+1 calc-
 *                             run request per visible row. They ARE shown in
 *                             the PREVIEW, lazily fetched for the one
 *                             selected case only.
 *  - "Benefits realization" → `GET /org/benefits-realization` (§C
 *                             `roiPerspectives.routes.ts`), a manager-chain-
 *                             scoped rollup that DOES carry two honest-
 *                             missing numeric amounts + a derived percentage
 *                             per row already — the cheap, real source of a
 *                             table-level HonestValueCell showcase.
 *
 * Menu 3 chips on "All cases" bucket the real 13-state machine into 4 groups
 * (`ROI_STATUS_BUCKET` in `roiRegistryMappers.ts`) — counts always shown,
 * including 0, computed from the currently loaded page.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { StandardCounterChip, StandardModuleTab, TableRow } from '@/components/standard';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import {
  getLatestRoiCalculationRun,
  listOrgRoiBenefitsRealization,
  listRoiCases,
  type RoiCalculationRunSummary,
  type RoiCaseListItem,
  type RoiOrgBenefitsRealizationRow,
} from './roiApi';
import {
  ROI_STATUS_BUCKET,
  ROI_STATUS_BUCKET_LABEL,
  type RoiStatusBucket,
} from './roiRegistryMappers';
import {
  buildRoiBenefitsRealizationColumns,
  buildRoiBenefitsRealizationPreview,
  buildRoiCaseColumns,
  buildRoiCasePreview,
  buildRoiCaseRowMenu,
  type RoiBenefitsRealizationRowVm,
} from './roiRegistryPresenters';

type RoiTab = 'all' | 'benefits';
const ROI_CASES_FETCH_LIMIT = 200;

function withId<T extends { caseId: string }>(row: T): T & { id: string } {
  return { ...row, id: row.caseId };
}

export const ResultsRoiHub: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [tab, setTab] = useState<RoiTab>('all');
  const [chip, setChip] = useState<'all' | RoiStatusBucket>('all');

  // "All cases" tab state
  const [cases, setCases] = useState<RoiCaseListItem[] | null>(null);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [calculationRun, setCalculationRun] = useState<RoiCalculationRunSummary | null | undefined>(undefined);

  // "Benefits realization" tab state
  const [benefitsRows, setBenefitsRows] = useState<RoiOrgBenefitsRealizationRow[] | null>(null);
  const [benefitsError, setBenefitsError] = useState<string | null>(null);
  const [benefitsLoading, setBenefitsLoading] = useState(false);
  const [selectedBenefitsCaseId, setSelectedBenefitsCaseId] = useState<string | null>(null);

  const loadCases = useCallback(() => {
    setCasesLoading(true);
    setCasesError(null);
    listRoiCases({ limit: ROI_CASES_FETCH_LIMIT })
      .then((rows) => setCases(rows))
      .catch((err) =>
        setCasesError(err instanceof Error ? err.message : String(err))
      )
      .finally(() => setCasesLoading(false));
  }, []);

  const loadBenefits = useCallback(() => {
    setBenefitsLoading(true);
    setBenefitsError(null);
    listOrgRoiBenefitsRealization()
      .then((res) => setBenefitsRows(res.cases))
      .catch((err) =>
        setBenefitsError(err instanceof Error ? err.message : String(err))
      )
      .finally(() => setBenefitsLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'all' && cases === null && !casesLoading) loadCases();
    if (tab === 'benefits' && benefitsRows === null && !benefitsLoading) loadBenefits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Lazy per-case calculation-run fetch for the "All cases" preview — only
  // ever ONE in-flight request (the selected row), never N per visible row.
  useEffect(() => {
    if (!selectedCaseId) {
      setCalculationRun(undefined);
      return;
    }
    let cancelled = false;
    setCalculationRun(undefined);
    getLatestRoiCalculationRun(selectedCaseId)
      .then((run) => {
        if (!cancelled) setCalculationRun(run);
      })
      .catch(() => {
        if (!cancelled) setCalculationRun(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCaseId]);

  const bucketCounts = useMemo(() => {
    const counts: Record<RoiStatusBucket, number> = {
      in_progress: 0,
      in_review: 0,
      active: 0,
      closed_out: 0,
    };
    for (const c of cases ?? []) counts[ROI_STATUS_BUCKET[c.status]] += 1;
    return counts;
  }, [cases]);

  const filteredCases = useMemo(() => {
    if (!cases) return [];
    if (chip === 'all') return cases;
    return cases.filter((c) => ROI_STATUS_BUCKET[c.status] === chip);
  }, [cases, chip]);

  const selectedCase = useMemo(
    () => (cases ?? []).find((c) => c.caseId === selectedCaseId) ?? null,
    [cases, selectedCaseId]
  );
  const selectedBenefitsRow = useMemo(
    () => (benefitsRows ?? []).find((r) => r.caseId === selectedBenefitsCaseId) ?? null,
    [benefitsRows, selectedBenefitsCaseId]
  );

  const tabs: StandardModuleTab[] = [
    { id: 'all', label: isPolish ? 'Wszystkie sprawy' : 'All cases' },
    { id: 'benefits', label: isPolish ? 'Realizacja korzyści' : 'Benefits realization' },
  ];

  const chips: StandardCounterChip[] = [
    { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: cases?.length ?? 0 },
    {
      id: 'in_progress',
      label: isPolish ? ROI_STATUS_BUCKET_LABEL.in_progress.pl : ROI_STATUS_BUCKET_LABEL.in_progress.en,
      count: bucketCounts.in_progress,
    },
    {
      id: 'in_review',
      label: isPolish ? ROI_STATUS_BUCKET_LABEL.in_review.pl : ROI_STATUS_BUCKET_LABEL.in_review.en,
      count: bucketCounts.in_review,
    },
    {
      id: 'active',
      label: isPolish ? ROI_STATUS_BUCKET_LABEL.active.pl : ROI_STATUS_BUCKET_LABEL.active.en,
      count: bucketCounts.active,
    },
    {
      id: 'closed_out',
      label: isPolish ? ROI_STATUS_BUCKET_LABEL.closed_out.pl : ROI_STATUS_BUCKET_LABEL.closed_out.en,
      count: bucketCounts.closed_out,
    },
  ];

  if (tab === 'benefits') {
    const rows: TableRow[] = (benefitsRows ?? []).map(withId);
    return (
      <ResultsVNextRegistryShell
        domain="roi"
        moduleBar={{
          tabs,
          activeTab: tab,
          onTabChange: (id) => setTab(id as RoiTab),
          showTabCounts: false,
          viewModes: ['table'],
          viewMode: 'table',
        }}
        table={{
          columns: buildRoiBenefitsRealizationColumns(isPolish),
          data: rows,
          persistKey: 'results-vnext.roi-registry.benefits',
          loading: benefitsLoading,
          error: benefitsError,
          onRetry: loadBenefits,
          empty:
            !benefitsLoading && !benefitsError && rows.length === 0
              ? {
                  title: isPolish ? 'Brak spraw w realizacji' : 'No cases in realization',
                  description: isPolish
                    ? 'Żadna sprawa w Twoim łańcuchu zarządzania nie jest obecnie w fazie śledzenia/realizacji.'
                    : 'No case in your management chain is currently tracking or realizing benefits.',
                }
              : undefined,
          selectedRowId: selectedBenefitsCaseId,
          // `row` is `TableRow` (`{id: string; [key: string]: any}`) — `caseId`
          // reads through the index signature, no cast needed/possible (the
          // shapes don't sufficiently overlap for a direct `as`).
          onRowClick: (row) => setSelectedBenefitsCaseId(String(row.caseId)),
          defaultSort: { columnId: 'realizationPct', direction: 'desc' },
        }}
        preview={
          selectedBenefitsRow
            ? buildRoiBenefitsRealizationPreview(
                selectedBenefitsRow as RoiBenefitsRealizationRowVm,
                isPolish,
                () => setSelectedBenefitsCaseId(null)
              )
            : null
        }
      />
    );
  }

  const rows: TableRow[] = filteredCases.map(withId);

  return (
    <ResultsVNextRegistryShell
      domain="roi"
      moduleBar={{
        tabs,
        activeTab: tab,
        onTabChange: (id) => setTab(id as RoiTab),
        showTabCounts: false,
        viewModes: ['table'],
        viewMode: 'table',
        chips,
        activeChip: chip,
        onChipChange: (id) => setChip(id as 'all' | RoiStatusBucket),
      }}
      table={{
        columns: buildRoiCaseColumns(isPolish),
        data: rows,
        persistKey: 'results-vnext.roi-registry',
        loading: casesLoading,
        error: casesError,
        onRetry: loadCases,
        empty:
          !casesLoading && !casesError && rows.length === 0
            ? {
                title: isPolish ? 'Brak spraw ROI' : 'No ROI cases yet',
                description:
                  chip === 'all'
                    ? isPolish
                      ? 'W tej organizacji nie utworzono jeszcze żadnej sprawy ROI.'
                      : 'No ROI case has been created in this organization yet.'
                    : isPolish
                      ? 'Żadna sprawa nie pasuje do tego filtra.'
                      : 'No case matches this filter.',
              }
            : undefined,
        selectedRowId: selectedCaseId,
        onRowClick: (row) => setSelectedCaseId(String(row.caseId)),
        rowMenu: (row) =>
          buildRoiCaseRowMenu(row as unknown as RoiCaseListItem, isPolish, {
            onPreview: (r) => setSelectedCaseId(r.caseId),
          }),
        defaultSort: { columnId: 'updatedAt', direction: 'desc' },
      }}
      preview={
        selectedCase
          ? buildRoiCasePreview(selectedCase, {
              isPolish,
              onClose: () => setSelectedCaseId(null),
              calculationRun,
            })
          : null
      }
    />
  );
};

export default ResultsRoiHub;
