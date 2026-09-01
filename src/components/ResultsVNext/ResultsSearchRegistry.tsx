import { Search } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { TableColumn } from '@/components/standard';
import { Input } from '@/components/ui/primitives';

import { OKR_SET_STATUS_LABELS } from './okr/okrRegistryMappers';
import {
  getResultsDomainPath,
  getResultsDomainTabs,
  isResultsDomain,
} from './resultsDomainNavigation';
import { type ResultsSearchHit, searchResults } from './resultsSearchApi';
import { ResultsVNextRegistryShell } from './ResultsVNextRegistryShell';
import { ROI_STATUS_LABELS } from './roi/roiRegistryMappers';

const KIND_LABEL: Record<ResultsSearchHit['kind'], string> = {
  kpi: 'KPI',
  okr_set: 'OKR',
  roi_case: 'ROI',
};

// Bramka parytetu jezykowego (2026-08-30): przed ta zmiana `row.status`
// (surowy string z serwera, np. "active"/"modeling") renderowal sie 1:1 —
// angielski technicz enum w polskim interfejsie (zrzut
// results-vnext-search-registry, zapytanie "linia"). Ten widok laczy trzy
// domeny (KPI/OKR/ROI), kazda ma wlasny, juz przetlumaczony slownik statusow
// gdzie indziej w pakiecie — tu tylko dysponujemy po `row.kind`, zeby uzyc
// tego samego slownika, nie wymyslac czwartego. KPI nie eksportuje swojej
// (malej, 5-stanowej) mapy z `ResultsKpiRegistryPage.tsx`, wiec kopia lokalna
// — zrodlo: `KPI_STATUSES` w `kpiApi.ts`.
const KPI_SEARCH_STATUS_LABELS: Record<string, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  pending_approval: { pl: 'Do zatwierdzenia', en: 'Pending approval' },
  active: { pl: 'Aktywny', en: 'Active' },
  suspended: { pl: 'Zawieszony', en: 'Suspended' },
  archived: { pl: 'Zarchiwizowany', en: 'Archived' },
};

function searchHitStatusLabel(row: ResultsSearchHit, isPolish: boolean): string {
  const table: Record<string, { pl: string; en: string }> =
    row.kind === 'kpi'
      ? KPI_SEARCH_STATUS_LABELS
      : row.kind === 'roi_case'
        ? ROI_STATUS_LABELS
        : OKR_SET_STATUS_LABELS;
  const entry = table[row.status];
  // Nieznany/niedopasowany status nigdy nie znika po cichu — surowa wartosc
  // zostaje widoczna (lepsze niz pusty ekran), po prostu bez tlumaczenia.
  if (!entry) return row.status;
  return isPolish ? entry.pl : entry.en;
}

const MATCHED_FIELD_LABEL: Record<ResultsSearchHit['matchedField'], { pl: string; en: string }> = {
  title: { pl: 'Nazwa', en: 'Title' },
  code: { pl: 'Kod', en: 'Code' },
  description: { pl: 'Opis', en: 'Description' },
};

function matchedFieldLabel(field: ResultsSearchHit['matchedField'], isPolish: boolean): string {
  return isPolish ? MATCHED_FIELD_LABEL[field].pl : MATCHED_FIELD_LABEL[field].en;
}

export const ResultsSearchRegistry: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ResultsSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopeCompleteness, setScopeCompleteness] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [unavailableKinds, setUnavailableKinds] = useState<ResultsSearchHit['kind'][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setRows([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    searchResults(query)
      .then((result) => {
        if (cancelled) return;
        setRows(result.results);
        setScopeCompleteness(result.scopeCompleteness);
        setUnavailableKinds(result.unavailableKinds);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'SEARCH_FAILED');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'title',
        label: isPolish ? 'Wynik' : 'Result',
        width: '360px',
        render: (row: ResultsSearchHit) => (
          <span className="block">
            <span className="block text-sm font-medium text-c-text">{row.title}</span>
            {row.subtitle ? (
              <span className="block text-xs text-c-text-muted">{row.subtitle}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'kind',
        label: isPolish ? 'Domena' : 'Domain',
        width: '100px',
        render: (row: ResultsSearchHit) => KIND_LABEL[row.kind],
      },
      {
        id: 'status',
        label: 'Status',
        width: '150px',
        render: (row: ResultsSearchHit) => searchHitStatusLabel(row, isPolish),
      },
      {
        id: 'matchedField',
        label: isPolish ? 'Dopasowane pole' : 'Matched field',
        width: '150px',
        render: (row: ResultsSearchHit) => matchedFieldLabel(row.matchedField, isPolish),
      },
      {
        id: 'updatedAt',
        label: isPolish ? 'Zaktualizowano' : 'Updated',
        width: '150px',
        render: (row: ResultsSearchHit) =>
          new Date(row.updatedAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US'),
      },
    ],
    [isPolish]
  );

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const shortQuery = query.length < 2;
  return (
    <ResultsVNextRegistryShell
      domain="kpi"
      moduleBar={{
        tabs: getResultsDomainTabs(),
        activeTab: 'search',
        onTabChange: (id) => {
          if (id === 'search' || isResultsDomain(id)) navigate(getResultsDomainPath(id));
        },
        showTabCounts: false,
        viewModes: ['table'],
        viewMode: 'table',
        primaryCtaContent: (
          <div className="relative w-80">
            <Search
              className="absolute left-3 top-2.5 h-4 w-4 text-c-text-muted"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isPolish ? 'Szukaj KPI, OKR lub ROI' : 'Search KPI, OKR or ROI'}
              aria-label={isPolish ? 'Szukaj w Wynikach' : 'Search Results'}
              className="pl-9 focus-visible:ring-c-focus"
            />
          </div>
        ),
      }}
      table={{
        columns,
        data: rows.map((row) => ({ ...row, id: row.id })),
        persistKey: 'results-vnext.search-registry',
        loading,
        error,
        empty:
          !loading && !error && rows.length === 0
            ? {
                title: shortQuery
                  ? isPolish
                    ? 'Wpisz co najmniej 2 znaki'
                    : 'Enter at least 2 characters'
                  : isPolish
                    ? 'Brak wyników'
                    : 'No results',
                description: shortQuery
                  ? isPolish
                    ? 'Wyszukiwanie rozpocznie się po wpisaniu drugiego znaku.'
                    : 'Search starts after the second character.'
                  : isPolish
                    ? 'Nie znaleziono widocznych rekordów.'
                    : 'No visible records matched.',
              }
            : undefined,
        selectedRowId: selectedId,
        onRowClick: (row) => setSelectedId(String(row.id)),
        rowMenu: (row) => ({
          primary: [
            {
              id: 'open',
              label: isPolish ? 'Otwórz' : 'Open',
              onClick: () => navigate((row as unknown as ResultsSearchHit).href),
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
                pills: [{ label: KIND_LABEL[selected.kind], tone: 'neutral' }],
                recommendation:
                  scopeCompleteness === 'PARTIAL' || unavailableKinds.length
                    ? isPolish
                      ? 'Wyniki są częściowe; część domen jest niedostępna.'
                      : 'Results are partial; some domains are unavailable.'
                    : undefined,
              },
              details: {
                showWordCount: false,
                propertyLabel: isPolish ? 'Właściwość' : 'Property',
                valueLabel: isPolish ? 'Wartość' : 'Value',
                properties: [
                  {
                    id: 'status',
                    label: 'Status',
                    value: searchHitStatusLabel(selected, isPolish),
                  },
                  {
                    id: 'matched',
                    label: isPolish ? 'Dopasowane pole' : 'Matched field',
                    value: matchedFieldLabel(selected.matchedField, isPolish),
                  },
                  {
                    id: 'updated',
                    label: isPolish ? 'Zaktualizowano' : 'Updated',
                    value: new Date(selected.updatedAt).toLocaleDateString(
                      isPolish ? 'pl-PL' : 'en-US'
                    ),
                  },
                ],
              },
              actions: {
                informational: [
                  {
                    id: 'open',
                    variant: 'neutral',
                    label: isPolish ? 'Otwórz' : 'Open',
                    onClick: () => navigate(selected.href),
                  },
                ],
              },
            }
          : null
      }
    />
  );
};
