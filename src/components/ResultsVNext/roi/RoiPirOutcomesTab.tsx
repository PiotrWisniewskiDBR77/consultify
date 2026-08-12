/**
 * RoiPirOutcomesTab — RN-G5 §G #11: the second `GET
 * /api/vnext/results/roi/org/pir-outcomes` (org PIR-outcomes) perspective
 * `ResultsRoiHub.tsx`'s own header names as a Menu 2 tab it does NOT yet
 * have. Same shape as that hub's existing "Realizacja korzyści" (Benefits
 * realization) tab — task brief: "Pierwsza zakładka działa i jest wzorcem —
 * powiel jej sposób, nie wymyślaj nowego."
 *
 * -- ★ INTEGRATION NOTE (this package cannot edit `ResultsRoiHub.tsx` — see
 * task brief allowlist): this component is SELF-CONTAINED (owns its own
 * fetch/loading/error/selection state, exactly like
 * `../kpiScorecards/ResultsKpiScorecardDetailPage.tsx`'s "Pozycje"/"Migawki
 * przeglądu" tabs do) so it can be dropped in as a THIRD Menu 2 tab with a
 * one-line change once the hub is next touched by its owning workstream:
 * add `{ id: 'pir-outcomes', label: ... }` to `ResultsRoiHub.tsx`'s `tabs`
 * array (`ResultsRoiHub.tsx` L374-377) and `if (tab === 'pir-outcomes')
 * return <RoiPirOutcomesTab isPolish={isPolish} />;` alongside the existing
 * `if (tab === 'benefits')` branch (`ResultsRoiHub.tsx` L420). See
 * `RN_G5_SCOPEGAP_DESIGN.md` §3 for the full ready-to-paste diff.
 *
 * Until that wiring lands, this component is ALSO mounted as its own
 * directly-reachable route (`ROUTES.RESULTS_ROI.PIR_OUTCOMES`,
 * `/results/roi/pir-outcomes`) via `ResultsRoiPirOutcomesPage.tsx` — a real
 * production surface today, not an orphaned component with zero callers.
 */
import React, { useCallback, useEffect, useState } from 'react';

import type { TableRow } from '@/components/standard';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import { listOrgRoiPirOutcomes, type RoiOrgPirOutcomeCaseRow } from './roiApi';
import { buildRoiPirOutcomesColumns, buildRoiPirOutcomesPreview } from './roiPirOutcomesPresenters';

function withId(row: RoiOrgPirOutcomeCaseRow): TableRow {
  return { ...row, id: row.caseId };
}

export interface RoiPirOutcomesTabProps {
  isPolish: boolean;
}

export const RoiPirOutcomesTab: React.FC<RoiPirOutcomesTabProps> = ({ isPolish }) => {
  const [rows, setRows] = useState<RoiOrgPirOutcomeCaseRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listOrgRoiPirOutcomes()
      .then((outcomes) => setRows(outcomes.cases))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (rows === null && !loading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tableRows: TableRow[] = (rows ?? []).map(withId);
  const selectedRow = (rows ?? []).find((r) => r.caseId === selectedCaseId) ?? null;

  return (
    <div className="h-full" data-testid="results-vnext-roi-pir-outcomes-tab">
      <ResultsVNextRegistryShell
        domain="roi"
        moduleBar={{
          tabs: [{ id: 'pir-outcomes', label: isPolish ? 'Wyniki PIR' : 'PIR outcomes' }],
          activeTab: 'pir-outcomes',
          onTabChange: () => undefined,
          showTabCounts: false,
          viewModes: ['table'],
          viewMode: 'table',
        }}
        table={{
          columns: buildRoiPirOutcomesColumns(isPolish),
          data: tableRows,
          persistKey: 'results-vnext.roi-registry.pir-outcomes',
          loading,
          error,
          onRetry: load,
          empty:
            !loading && !error && tableRows.length === 0
              ? {
                  title: isPolish ? 'Brak spraw z wynikiem PIR' : 'No cases with a PIR outcome',
                  description: isPolish
                    ? 'Żadna sprawa w Twoim łańcuchu zarządzania nie jest obecnie w przeglądzie po inwestycji ani zamknięta.'
                    : 'No case in your management chain is currently in post-investment review or closed.',
                }
              : undefined,
          selectedRowId: selectedCaseId,
          onRowClick: (row) => setSelectedCaseId(String(row.caseId)),
          defaultSort: { columnId: 'finalizedAt', direction: 'desc' },
        }}
        preview={
          selectedRow ? buildRoiPirOutcomesPreview(selectedRow, isPolish, () => setSelectedCaseId(null)) : null
        }
      />
    </div>
  );
};

export default RoiPirOutcomesTab;
