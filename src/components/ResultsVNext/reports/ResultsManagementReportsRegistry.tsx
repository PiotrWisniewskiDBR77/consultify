/**
 * ResultsManagementReportsRegistry — zakładka „Raporty zarządcze" w Menu 2
 * modułu Wyniki (DEC-422b/e, 06.09).
 *
 * Słowa właściciela (06.09 16:02–16:10): „Raporty zarządcze przenieś do menu
 * drugiego — we wszystkich miejscach menu drugiego. […] Po otwarciu tabela z
 * raportami. […] Ten wyszukiwak wywalamy, tutaj robimy raporty zarządcze."
 *
 * Ekran jest listowy, więc buduje się WYŁĄCZNIE kanonem: powłoka
 * `ResultsVNextRegistryShell` (StandardModuleBar + StandardTable +
 * StandardPreview) — dokładnie tak, jak stała tu do dziś `Wyszukiwarka`.
 * Dane pochodzą z istniejącego `GET /api/management-reports/history`
 * (ManagementReportRepository.getReports) — zero nowego silnika, zero nowej
 * trasy serwera.
 *
 * „Otwórz" prowadzi do ISTNIEJĄCEGO widoku raportu:
 * `/reports/management?docId=<id>` — deep link, który `ReportsHub.tsx` już
 * obsługuje (useEffect na `docId`). Tamta sekcja pozostaje nietknięta
 * (Fala 2, 3.16).
 *
 * Menu 2 = dropdown statusu (`filterControls`, wzorzec `ResultsRoiHub`),
 * Menu 3 = 3 chipy zakresu (kanon TRIADA §B: ≤3 albo nic).
 */

import { Plus } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { StandardCounterChip, TableColumn, TableRow } from '@/components/standard';
import { SelectField } from '@/components/ui/primitives';
import { ROUTES } from '@/routes/routeConfig';
import type {
  ManagementReportScope,
  ManagementReportStatus,
  ManagementReportType,
} from '@/types';

import {
  getResultsDomainPath,
  getResultsDomainTabs,
  isResultsDomain,
} from '../resultsDomainNavigation';
import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import { fetchManagementReports, type ManagementReportHistoryRow } from './managementReportsApi';
import { ResultsReportGeneratorDrawer, REPORT_TYPE_OPTIONS } from './ResultsReportGeneratorDrawer';

const STATUS_LABELS: Record<ManagementReportStatus, { pl: string; en: string }> = {
  DRAFT: { pl: 'Szkic', en: 'Draft' },
  FINAL: { pl: 'Finalny', en: 'Final' },
  APPROVED: { pl: 'Zatwierdzony', en: 'Approved' },
  ARCHIVED: { pl: 'Zarchiwizowany', en: 'Archived' },
};

const STATUS_ORDER: ManagementReportStatus[] = ['DRAFT', 'FINAL', 'APPROVED', 'ARCHIVED'];

/** Nigdy nie pokazujemy surowego enumu — nieznany kod zostaje widoczny jako on sam. */
export function managementReportStatusLabel(status: string, isPolish: boolean): string {
  const entry = STATUS_LABELS[status as ManagementReportStatus];
  if (!entry) return status;
  return isPolish ? entry.pl : entry.en;
}

export function managementReportTypeLabel(type: string, isPolish: boolean): string {
  const entry = REPORT_TYPE_OPTIONS.find((option) => option.id === (type as ManagementReportType));
  if (!entry) return type;
  return isPolish ? entry.pl : entry.en;
}

/** Źródło = zakres raportu; dla zakresu projektowego nazwa realnego projektu. */
export function managementReportSourceLabel(
  row: Pick<ManagementReportHistoryRow, 'scope' | 'projectName'>,
  isPolish: boolean
): string {
  if (row.scope === 'PROJECT') {
    return row.projectName?.trim() || (isPolish ? 'Projekt' : 'Project');
  }
  if (row.scope === 'PORTFOLIO') return isPolish ? 'Portfel' : 'Portfolio';
  return String(row.scope ?? '—');
}

function formatDate(value: string | null | undefined, isPolish: boolean): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US');
}

export const ResultsManagementReportsRegistry: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const navigate = useNavigate();

  const [rows, setRows] = useState<ManagementReportHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ManagementReportStatus | null>(null);
  const [scopeChip, setScopeChip] = useState<'all' | ManagementReportScope>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchManagementReports({ limit: 100 })
      .then((page) => {
        setRows(page.reports);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'MANAGEMENT_REPORTS_FAILED');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scopedRows = useMemo(
    () => (scopeChip === 'all' ? rows : rows.filter((row) => row.scope === scopeChip)),
    [rows, scopeChip]
  );
  const visibleRows = useMemo(
    () => (statusFilter ? scopedRows.filter((row) => row.status === statusFilter) : scopedRows),
    [scopedRows, statusFilter]
  );

  const statusOptions = useMemo(() => {
    const counts = new Map<string, number>();
    scopedRows.forEach((row) => counts.set(row.status, (counts.get(row.status) ?? 0) + 1));
    return [
      { value: 'all', label: `${isPolish ? 'Wszystkie' : 'All'} (${scopedRows.length})` },
      ...STATUS_ORDER.map((status) => ({
        value: status,
        label: `${managementReportStatusLabel(status, isPolish)} (${counts.get(status) ?? 0})`,
      })),
    ];
  }, [scopedRows, isPolish]);

  const chips: StandardCounterChip[] = useMemo(
    () => [
      { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: rows.length },
      {
        id: 'PORTFOLIO',
        label: isPolish ? 'Portfel' : 'Portfolio',
        count: rows.filter((row) => row.scope === 'PORTFOLIO').length,
      },
      {
        id: 'PROJECT',
        label: isPolish ? 'Projekt' : 'Project',
        count: rows.filter((row) => row.scope === 'PROJECT').length,
      },
    ],
    [rows, isPolish]
  );

  const openReport = useCallback(
    (id: string) => {
      navigate(`${ROUTES.REPORTS.MANAGEMENT}?docId=${encodeURIComponent(id)}`);
    },
    [navigate]
  );

  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'title',
        label: isPolish ? 'Nazwa' : 'Name',
        width: '320px',
        render: (row: TableRow) => (
          <span className="block text-sm font-medium text-c-text">{String(row.title ?? '—')}</span>
        ),
      },
      {
        id: 'reportType',
        label: isPolish ? 'Typ raportu' : 'Report type',
        width: '220px',
        render: (row: TableRow) => managementReportTypeLabel(String(row.reportType ?? ''), isPolish),
      },
      {
        id: 'source',
        label: isPolish ? 'Źródło' : 'Source',
        width: '180px',
        render: (row: TableRow) =>
          managementReportSourceLabel(row as unknown as ManagementReportHistoryRow, isPolish),
      },
      {
        id: 'status',
        label: 'Status',
        width: '140px',
        render: (row: TableRow) => managementReportStatusLabel(String(row.status ?? ''), isPolish),
      },
      {
        id: 'generatedByName',
        label: isPolish ? 'Autor' : 'Author',
        width: '180px',
        render: (row: TableRow) => String(row.generatedByName || '—'),
      },
      {
        id: 'updatedAt',
        label: isPolish ? 'Zaktualizowano' : 'Updated',
        width: '150px',
        render: (row: TableRow) =>
          formatDate(
            (row.updatedAt as string | undefined) ?? (row.createdAt as string | undefined),
            isPolish
          ),
      },
    ],
    [isPolish]
  );

  const selected = visibleRows.find((row) => row.id === selectedId) ?? null;

  const statusFilterControl = (
    <div data-testid="results-reports-status-filter">
      <SelectField
        value={statusFilter ?? 'all'}
        onChange={(value) =>
          setStatusFilter(value === 'all' ? null : (value as ManagementReportStatus))
        }
        options={statusOptions}
        fullWidth={false}
        wrapperClassName="w-auto"
        className="min-w-[13rem]"
        aria-label={isPolish ? 'Filtruj wg statusu' : 'Filter by status'}
      />
    </div>
  );

  return (
    <>
      <ResultsVNextRegistryShell
        domain="kpi"
        moduleBar={{
          tabs: getResultsDomainTabs(),
          activeTab: 'reports',
          onTabChange: (id) => {
            if (id === 'reports' || id === 'legacy' || isResultsDomain(id))
              navigate(getResultsDomainPath(id));
          },
          showTabCounts: false,
          viewModes: ['table'],
          viewMode: 'table',
          filterControls: statusFilterControl,
          chips,
          activeChip: scopeChip,
          onChipChange: (id) => {
            setScopeChip(id === 'all' ? 'all' : (id as ManagementReportScope));
            setSelectedId(null);
          },
          primaryCta: {
            label: isPolish ? 'Nowy raport' : 'New report',
            icon: Plus,
            testId: 'results-reports-new',
            onClick: () => setGeneratorOpen(true),
          },
        }}
        table={{
          columns,
          data: visibleRows as unknown as TableRow[],
          persistKey: 'results-vnext.management-reports-registry',
          loading,
          error,
          onRetry: load,
          empty:
            !loading && !error && visibleRows.length === 0
              ? {
                  title: isPolish ? 'Brak raportów zarządczych' : 'No management reports',
                  description: isPolish
                    ? 'Żaden raport zarządczy nie został jeszcze wygenerowany w tej organizacji. Zacznij od przycisku „Nowy raport”.'
                    : 'No management report has been generated in this organization yet. Start with “New report”.',
                }
              : undefined,
          selectedRowId: selectedId,
          onRowClick: (row) => setSelectedId(String(row.id)),
          rowMenu: (row) => ({
            primary: [
              {
                id: 'open',
                label: isPolish ? 'Otwórz' : 'Open',
                onClick: () => openReport(String(row.id)),
              },
            ],
            universalHandlers: { preview: () => setSelectedId(String(row.id)) },
          }),
        }}
        preview={
          selected
            ? {
                title: selected.title,
                onClose: () => setSelectedId(null),
                meta: {
                  pills: [
                    {
                      label: managementReportStatusLabel(selected.status, isPolish),
                      tone: 'neutral',
                    },
                  ],
                },
                details: {
                  showWordCount: false,
                  propertyLabel: isPolish ? 'Właściwość' : 'Property',
                  valueLabel: isPolish ? 'Wartość' : 'Value',
                  properties: [
                    {
                      id: 'type',
                      label: isPolish ? 'Typ raportu' : 'Report type',
                      value: managementReportTypeLabel(selected.reportType, isPolish),
                    },
                    {
                      id: 'source',
                      label: isPolish ? 'Źródło' : 'Source',
                      value: managementReportSourceLabel(selected, isPolish),
                    },
                    {
                      id: 'author',
                      label: isPolish ? 'Autor' : 'Author',
                      value: selected.generatedByName || '—',
                    },
                    {
                      id: 'updated',
                      label: isPolish ? 'Zaktualizowano' : 'Updated',
                      value: formatDate(selected.updatedAt ?? selected.createdAt, isPolish),
                    },
                  ],
                },
                actions: {
                  informational: [
                    {
                      id: 'open',
                      variant: 'neutral',
                      label: isPolish ? 'Otwórz' : 'Open',
                      onClick: () => openReport(selected.id),
                    },
                  ],
                },
              }
            : null
        }
      />
      <ResultsReportGeneratorDrawer
        open={generatorOpen}
        isPolish={isPolish}
        onClose={() => setGeneratorOpen(false)}
        onGenerated={(reportId) => {
          setGeneratorOpen(false);
          load();
          openReport(reportId);
        }}
      />
    </>
  );
};
