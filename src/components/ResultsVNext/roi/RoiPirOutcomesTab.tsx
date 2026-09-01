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
import type { RoiCardModeProps } from './RoiCaseCardSections';
import { buildRoiPirOutcomesColumns, buildRoiPirOutcomesPreview } from './roiPirOutcomesPresenters';

function withId(row: RoiOrgPirOutcomeCaseRow): TableRow {
  return { ...row, id: row.caseId };
}

export interface RoiPirOutcomesTabProps {
  isPolish: boolean;
  /**
   * JEDNA KARTA N (2026-08-30) — gdy podane, tabela pokazuje WYŁĄCZNIE tę
   * jedną sprawę. Właściciel odrzucił ten ekran jako osobny byt („to jest
   * kolejna N-karta w jednym ROI-u"), więc karta sprawy montuje ten sam
   * komponent jako swój podwidok „Wynik PIR".
   *
   * ★ UWAGA O MECHANICE (zgłoszone, nie ukryte): endpoint
   * `GET /vnext/results/roi/org/pir-outcomes` jest ORGANIZACYJNY — zwraca
   * wszystkie sprawy w łańcuchu zarządzania i NIE MA odpowiednika per
   * sprawa. Filtrujemy więc jego odpowiedź po stronie klienta zamiast
   * udawać, że istnieje trasa `/cases/:caseId/pir-outcome`. Rejestr
   * organizacyjny (`ResultsRoiPirOutcomesPage`) zostaje nietknięty — jest
   * listą wielu spraw, a nie kartą jednej.
   */
  onlyCaseId?: string;
  /** Tryb karty — rząd zakładek sekcji zamiast własnej, jednoelementowej zakładki. */
  cardMode?: RoiCardModeProps;
}

export const RoiPirOutcomesTab: React.FC<RoiPirOutcomesTabProps> = ({
  isPolish,
  onlyCaseId,
  cardMode,
}) => {
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

  const visibleRows = onlyCaseId
    ? (rows ?? []).filter((r) => r.caseId === onlyCaseId)
    : (rows ?? []);
  const tableRows: TableRow[] = visibleRows.map(withId);
  const selectedRow = visibleRows.find((r) => r.caseId === selectedCaseId) ?? null;

  return (
    <div className="h-full" data-testid="results-vnext-roi-pir-outcomes-tab">
      <ResultsVNextRegistryShell
        domain="roi"
        moduleBar={{
          tabs: cardMode
            ? cardMode.tabs
            : [{ id: 'pir-outcomes', label: isPolish ? 'Wyniki PIR' : 'PIR outcomes' }],
          activeTab: cardMode ? cardMode.activeTab : 'pir-outcomes',
          onTabChange: cardMode ? cardMode.onTabChange : () => undefined,
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
                  title: onlyCaseId
                    ? isPolish
                      ? 'Ta sprawa nie ma jeszcze wyniku PIR'
                      : 'This case has no PIR outcome yet'
                    : isPolish
                      ? 'Brak spraw z wynikiem PIR'
                      : 'No cases with a PIR outcome',
                  description: onlyCaseId
                    ? isPolish
                      ? 'Wynik pojawi się, gdy sprawa wejdzie w przegląd po inwestycji albo zostanie zamknięta.'
                      : 'The outcome appears once the case enters post-investment review or is closed.'
                    : isPolish
                      ? 'Żadna sprawa w Twoim łańcuchu zarządzania nie jest obecnie w przeglądzie po inwestycji ani zamknięta.'
                      : 'No case in your management chain is currently in post-investment review or closed.',
                }
              : undefined,
          selectedRowId: selectedCaseId,
          onRowClick: (row) => setSelectedCaseId(String(row.caseId)),
          defaultSort: { columnId: 'finalizedAt', direction: 'desc' },
        }}
        preview={
          selectedRow
            ? buildRoiPirOutcomesPreview(selectedRow, isPolish, () => setSelectedCaseId(null))
            : null
        }
      />
    </div>
  );
};

export default RoiPirOutcomesTab;
