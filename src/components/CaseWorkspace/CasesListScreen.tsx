/**
 * Zlecenia — EKRAN LISTOWY (SPEC-L).
 *
 * Kanon (CLAUDE.md reguła #1 + #9): pasek modułu to `StandardModuleBar`,
 * tabela to `StandardTable`, podgląd to `StandardPreview`. Ten plik NIE
 * renderuje własnej tabeli ani własnego menu — deklaruje kolumny i treść,
 * wygląd narzucają komponenty wspólne.
 *
 * Dane: REALNE `/api/v8/case-workspace/cases`. Zero atrap, zero danych
 * zmyślonych. Pięć stanów obsłużonych jawnie: ładowanie · pusty · błąd ·
 * brak dostępu · wynik częściowy.
 *
 * Powrót ze zlecenia: filtr i zakładka żyją w adresie (`?zakladka=&status=&q=`),
 * więc przycisk Wstecz przeglądarki przywraca dokładnie tę listę. Fokus wraca
 * na wiersz, z którego użytkownik wyszedł (`data-zlecenie-wiersz`).
 */

import { ArrowRight, FolderOpen, ListChecks } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { StandardModuleBar } from '@/components/standard/StandardModuleBar';
import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import {
  autonomyPolicyLabel,
  caseProfileLabel,
  caseStatusLabel,
  closureAxisStatusLabel,
  closureTypeLabel,
  governanceTierLabel,
} from '@/utils/enumLabels';

import { listCases, toFailure } from './api';
import type { CaseApiFailure, CaseCoreView } from './types';
import {
  CaseStateBlock,
  formatDateTime,
  MoreTabsMenu,
  relativeDays,
  StatusTag,
  useViewportWidth,
} from './ui';

// Zapamiętane „skąd wyszedłem" — do przywrócenia fokusu po Wstecz. Moduł, nie
// globalny store: dotyczy wyłącznie tej listy i nie ma sensu poza sesją karty.
let lastOpenedCaseId: string | null = null;

export function rememberOpenedCase(caseId: string | null): void {
  lastOpenedCaseId = caseId;
}

type SavedView = 'wszystkie' | 'uwaga' | 'zakonczone';

const SAVED_VIEWS: Array<{ id: SavedView; label: string; description: string }> = [
  {
    id: 'wszystkie',
    label: 'Wszystkie zlecenia',
    description: 'Pełna lista zleceń Twojej organizacji.',
  },
  {
    id: 'uwaga',
    label: 'Wymagają uwagi',
    description: 'Zlecenia zablokowane, nieudane albo z niezatwierdzonym planem.',
  },
  {
    id: 'zakonczone',
    label: 'Zakończone',
    description: 'Zlecenia zamknięte, anulowane lub domknięte częściowo.',
  },
];

/** Osie zamknięcia, które realnie dotyczą zlecenia (bez „nie dotyczy"). */
function closureProgress(item: CaseCoreView): { done: number; total: number } {
  const axes = [item.deliveryStatus, item.decisionStatus, item.implementationStatus, item.outcomeStatus];
  const applicable = axes.filter((axis) => axis !== 'NOT_APPLICABLE');
  const done = applicable.filter((axis) => axis === 'COMPLETED' || axis === 'VALIDATED').length;
  return { done, total: applicable.length };
}

/**
 * „Uwaga" wyprowadzona WYŁĄCZNIE z pól, które lista naprawdę dostaje z API.
 * Backend nie zwraca w liście zleceń ani oczekiwań, ani propozycji do
 * zatwierdzenia, więc UI nie udaje, że je zna — mówi tylko to, co wynika ze
 * statusu zlecenia i osi zamknięcia.
 */
function attentionOf(item: CaseCoreView): { label: string; tone: 'critical' | 'warning' | 'neutral' } {
  if (item.caseStatus === 'BLOCKED') return { label: 'Zablokowane — potrzebna decyzja', tone: 'critical' };
  if (item.caseStatus === 'FAILED') return { label: 'Nieudane — potrzebna reakcja', tone: 'critical' };
  if (item.caseStatus === 'DRAFT') return { label: 'Plan niezatwierdzony', tone: 'warning' };
  return { label: 'Nic nie czeka na Ciebie', tone: 'neutral' };
}

function nextActionOf(item: CaseCoreView): string {
  switch (item.caseStatus) {
    case 'DRAFT':
      return 'Uzgodnij i zatwierdź plan';
    case 'ACTIVE':
      return 'Sprawdź realizację';
    case 'BLOCKED':
      return 'Usuń blokadę';
    case 'FAILED':
      return 'Zdecyduj, czy ponawiamy';
    case 'CLOSED':
      return 'Przejrzyj rezultaty';
    case 'CANCELLED':
      return 'Brak — zlecenie anulowane';
    default:
      return '—';
  }
}

function statusTone(status: CaseCoreView['caseStatus']): 'critical' | 'warning' | 'success' | 'info' | 'neutral' {
  if (status === 'BLOCKED' || status === 'FAILED') return 'critical';
  if (status === 'DRAFT') return 'warning';
  if (status === 'CLOSED') return 'success';
  if (status === 'ACTIVE') return 'info';
  return 'neutral';
}

export const CasesListScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewportWidth = useViewportWidth();
  const isNarrow = viewportWidth < 768;

  const savedView = (searchParams.get('widok') as SavedView | null) ?? 'wszystkie';
  const statusChip = searchParams.get('status');
  const query = searchParams.get('q') ?? '';

  const [items, setItems] = useState<CaseCoreView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<CaseApiFailure | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const focusRestoredRef = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailure(null);
    listCases()
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((error) => {
        setFailure(toFailure(error));
        setItems(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Powrót ze zlecenia (Wstecz): filtr wraca sam z adresu, a fokus stawiamy na
  // wierszu, z którego użytkownik wyszedł. Bez tego czytnik ekranu i klawiatura
  // lądują na początku strony i użytkownik gubi miejsce w liście.
  useEffect(() => {
    if (!items || focusRestoredRef.current || !lastOpenedCaseId) return;
    const node = document.querySelector<HTMLElement>(
      `[data-zlecenie-wiersz="${CSS.escape(lastOpenedCaseId)}"]`
    );
    if (node) {
      focusRestoredRef.current = true;
      setSelectedId(lastOpenedCaseId);
      node.focus();
      node.scrollIntoView({ block: 'center' });
    }
  }, [items]);

  /*
   * ★ PĘTLA RENDEROWANIA — wykryta na REALNYM zrzucie, nie w testach.
   *
   * `ModuleNavBar` (pod `StandardModuleBar`) woła `onSearch` z WNĘTRZA
   * `useEffect` z zależnościami `[debouncedSearchQuery, onSearch]`
   * (`src/components/shared/ModuleHub/ModuleNavBar.tsx:198`). Jeżeli `onSearch`
   * dostaje nową tożsamość przy każdym renderze, efekt odpala się przy każdym
   * renderze → `setSearchParams` → nawigacja `replace` → render → efekt…
   * = „Maximum update depth exceeded" i moduł miele w kółko.
   *
   * Dlatego OBA warunki muszą być spełnione i oba są tu wymuszone:
   *  1. `setParam` używa formy funkcyjnej `setSearchParams`, więc NIE zależy od
   *     `searchParams` i jego tożsamość się nie zmienia;
   *  2. wywołanie jest pomijane, gdy adres i tak by się nie zmienił — inaczej
   *     pierwsze (puste) wyszukiwanie samo z siebie robiłoby nawigację.
   */
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const prev = searchParamsRef.current;
      const next = new URLSearchParams(prev);
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      // Nawigacja TYLKO gdy adres realnie się zmienia — `setSearchParams`
      // nawiguje bezwarunkowo, a nawigacja „w to samo miejsce" wystarczy, żeby
      // pętla z komentarza wyżej wróciła.
      if (next.toString() === prev.toString()) return;
      setSearchParams(next, { replace: true });
    },
    [setSearchParams]
  );

  // Stabilna tożsamość — patrz komentarz wyżej. Bez tego pętla wraca.
  const handleSearch = useCallback((value: string) => setParam('q', value), [setParam]);

  const bySavedView = useMemo(() => {
    const all = items ?? [];
    if (savedView === 'uwaga') {
      return all.filter((item) => ['BLOCKED', 'FAILED', 'DRAFT'].includes(item.caseStatus));
    }
    if (savedView === 'zakonczone') {
      return all.filter((item) => ['CLOSED', 'CANCELLED'].includes(item.caseStatus));
    }
    return all;
  }, [items, savedView]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { wszystkie: bySavedView.length };
    for (const item of bySavedView) {
      counts[item.caseStatus] = (counts[item.caseStatus] ?? 0) + 1;
    }
    return counts;
  }, [bySavedView]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return bySavedView.filter((item) => {
      if (statusChip && statusChip !== 'wszystkie' && item.caseStatus !== statusChip) return false;
      if (!needle) return true;
      const haystack = [item.projectName, item.projectDescription, item.caseId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [bySavedView, statusChip, query]);

  const rows = useMemo(
    () =>
      visible.map((item) => {
        const progress = closureProgress(item);
        const attention = attentionOf(item);
        return {
          id: item.caseId,
          nazwa: item.projectName || 'Zlecenie bez nazwy',
          rezultat: item.projectDescription || '',
          rodzaj: caseProfileLabel(item.caseProfile, true),
          status: caseStatusLabel(item.caseStatus, true),
          uwaga: attention.label,
          uwagaTone: attention.tone,
          postep: progress.total ? `${progress.done} z ${progress.total}` : 'nie dotyczy',
          nastepna: nextActionOf(item),
          aktywnosc: item.updatedAt,
          statusTone: statusTone(item.caseStatus),
          raw: item,
        };
      }),
    [visible]
  );

  const openCase = useCallback(
    (caseId: string) => {
      rememberOpenedCase(caseId);
      navigate(`/zlecenia/${encodeURIComponent(caseId)}?zakladka=plan&widok-planu=prosty`);
    },
    [navigate]
  );

  /**
   * Kolumny na TELEFON — jedna kolumna, w niej to, po co użytkownik tu przyszedł:
   * nazwa, status, uwaga i następna akcja.
   *
   * ★ ZE ZRZUTU 375 px: przy pełnym zestawie kolumn telefon pokazywał wyłącznie
   * nazwę zlecenia — status i „następna akcja" zostawały za poziomym
   * przewijaniem WEWNĄTRZ tabeli. Strona się nie przewijała (warunek #4 spełniony),
   * ale treść była nieosiągalna bez szukania. Kolumn nie chowa tu żaden własny
   * komponent — moduł po prostu DEKLARUJE inny zestaw kolumn, a `StandardTable`
   * dalej rządzi wyglądem (kanon: moduł deklaruje treść, komponent narzuca formę).
   */
  const mobileColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'nazwa',
        label: 'Zlecenie',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            data-zlecenie-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 space-y-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <div className="text-sm font-medium leading-snug text-c-text">{String(row.nazwa)}</div>
            <div className="flex flex-wrap items-center gap-1">
              <StatusTag tone={row.statusTone as 'critical'}>{String(row.status)}</StatusTag>
              {row.uwagaTone !== 'neutral' ? (
                <StatusTag tone={row.uwagaTone as 'critical'}>{String(row.uwaga)}</StatusTag>
              ) : null}
            </div>
            <div className="text-xs text-c-text-muted">
              Następna akcja: {String(row.nastepna)} · {relativeDays(String(row.aktywnosc))}
            </div>
          </div>
        ),
      },
    ],
    []
  );

  const desktopColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'nazwa',
        label: 'Zlecenie i oczekiwany rezultat',
        width: '300px',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            // Kotwica dla przywrócenia fokusu po „Wstecz" (warunek właściciela).
            // `tabIndex={-1}` — element nie wchodzi do kolejności Tab, ale można
            // mu programowo oddać fokus, gdy użytkownik wraca do listy.
            data-zlecenie-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded"
          >
            <div className="truncate text-sm font-medium text-c-text">{String(row.nazwa)}</div>
            {row.rezultat ? (
              <div className="truncate text-xs text-c-text-muted">{String(row.rezultat)}</div>
            ) : (
              <div className="text-xs text-c-text-muted">Oczekiwany rezultat nieopisany</div>
            )}
          </div>
        ),
      },
      {
        id: 'rodzaj',
        label: 'Rodzaj',
        width: '130px',
        sortable: true,
        filterable: true,
      },
      {
        id: 'status',
        label: 'Status',
        width: '130px',
        sortable: true,
        filterable: true,
        render: (row: Record<string, unknown>) => (
          <StatusTag tone={row.statusTone as 'critical'}>{String(row.status)}</StatusTag>
        ),
      },
      {
        id: 'uwaga',
        label: 'Uwaga',
        width: '190px',
        render: (row: Record<string, unknown>) =>
          row.uwagaTone === 'neutral' ? (
            <span className="text-sm text-c-text-muted">{String(row.uwaga)}</span>
          ) : (
            <StatusTag tone={row.uwagaTone as 'critical'}>{String(row.uwaga)}</StatusTag>
          ),
      },
      {
        id: 'postep',
        label: 'Postęp rezultatu',
        width: '120px',
        align: 'right',
      },
      {
        id: 'nastepna',
        label: 'Następna akcja',
        width: '170px',
      },
      {
        id: 'aktywnosc',
        label: 'Ostatnia aktywność',
        width: '140px',
        sortable: true,
        sortAccessor: (row: Record<string, unknown>) => String(row.aktywnosc ?? ''),
        render: (row: Record<string, unknown>) => (
          <span className="text-sm text-c-text-secondary" title={formatDateTime(String(row.aktywnosc))}>
            {relativeDays(String(row.aktywnosc))}
          </span>
        ),
      },
    ],
    []
  );

  const columns = isNarrow ? mobileColumns : desktopColumns;

  const selected = useMemo(
    () => visible.find((item) => item.caseId === selectedId) ?? null,
    [visible, selectedId]
  );

  // WARUNEK WŁAŚCICIELA: na wąskim ekranie ukryte zakładki idą do jawnego,
  // opisanego „Więcej" obsługiwanego klawiaturą — nie do poziomego przesuwania
  // paska i nie pod nagi chevron.
  // Na wąskim ekranie w pasku zostaje AKTYWNY widok, a reszta idzie do „Więcej".
  // (Pierwsza wersja zostawiała w pasku zawsze „Wszystkie zlecenia" — test
  // klawiaturowy pokazał, że po wyborze „Zakończone" pasek nadal podświetlał
  // „Wszystkie", czyli użytkownik nie miał POTWIERDZENIA, co wybrał.)
  const visibleViews = isNarrow ? SAVED_VIEWS.filter((view) => view.id === savedView) : SAVED_VIEWS;
  const hiddenViews = isNarrow ? SAVED_VIEWS.filter((view) => view.id !== savedView) : [];

  const statusChips = useMemo(
    () => [
      { id: 'wszystkie', label: 'Wszystkie', count: statusCounts.wszystkie ?? 0 },
      { id: 'ACTIVE', label: caseStatusLabel('ACTIVE', true), count: statusCounts.ACTIVE ?? 0 },
      { id: 'BLOCKED', label: caseStatusLabel('BLOCKED', true), count: statusCounts.BLOCKED ?? 0 },
      { id: 'DRAFT', label: caseStatusLabel('DRAFT', true), count: statusCounts.DRAFT ?? 0 },
      { id: 'CLOSED', label: caseStatusLabel('CLOSED', true), count: statusCounts.CLOSED ?? 0 },
    ],
    [statusCounts]
  );

  const stateBlock = (
    <CaseStateBlock
      loading={loading}
      failure={failure}
      onRetry={load}
      empty={
        items && items.length === 0
          ? {
              title: 'Nie masz jeszcze żadnych zleceń',
              description:
                'Zlecenie powstaje z projektu — gdy pierwsze ruszy, pojawi się tutaj razem z planem, realizacją i rezultatami.',
            }
          : items && visible.length === 0
            ? {
                title: 'Żadne zlecenie nie pasuje do filtrów',
                description: 'Zmień zakładkę, status albo wyczyść wyszukiwanie.',
              }
            : null
      }
    />
  );

  return (
    <div className="h-full min-w-0" data-testid="zlecenia-lista">
      <StandardModuleBar
        tabs={visibleViews.map((view) => ({ id: view.id, label: view.label }))}
        activeTab={visibleViews.some((v) => v.id === savedView) ? savedView : visibleViews[0]?.id}
        onTabChange={(id) => setParam('widok', id)}
        onSearch={handleSearch}
        searchValue={query}
        viewModes={['table']}
        filterControls={
          hiddenViews.length ? (
            <MoreTabsMenu
              items={hiddenViews}
              activeId={savedView}
              onSelect={(id) => setParam('widok', id)}
              label="Więcej"
              ariaLabel="Więcej widoków listy zleceń"
            />
          ) : undefined
        }
        chips={statusChips}
        activeChip={statusChip ?? 'wszystkie'}
        onChipChange={(id) => setParam('status', id === 'wszystkie' ? null : id)}
      >
        <div className="mx-auto min-w-0 max-w-[1400px] px-3 py-4 sm:px-6 sm:py-6">
          {stateBlock ? (
            <div className="rounded-xl border border-c-border bg-c-surface">{stateBlock}</div>
          ) : null}
          {!loading && !failure && visible.length > 0 ? (
            <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-c-border bg-c-surface lg:h-[calc(100vh-260px)] lg:min-h-[420px] lg:flex-row">
              <div className="min-w-0 flex-1 overflow-auto p-2 sm:pl-4 sm:pr-1.5 sm:pt-3">
                <StandardTable
                  columns={columns}
                  data={rows}
                  selectedRowId={selectedId}
                  onRowClick={(row) => setSelectedId(String(row.id))}
                  onRowDoubleClick={(row) => openCase(String(row.id))}
                  rowDescription={() => null}
                  defaultSort={{ columnId: 'aktywnosc', direction: 'desc' }}
                  // Osobny klucz na telefon — inny zestaw kolumn nie może
                  // dziedziczyć zapamiętanego układu z widoku szerokiego.
                  persistKey={isNarrow ? 'caseWorkspace.cases.list.mobile' : 'caseWorkspace.cases.list'}
                  density="compact"
                  empty={{
                    icon: FolderOpen,
                    title: 'Brak zleceń w tym widoku',
                    description: 'Zmień zakładkę albo wyczyść filtry.',
                  }}
                  rowMenu={(row) => ({
                    primary: [
                      {
                        id: 'otworz',
                        label: 'Otwórz zlecenie',
                        icon: ArrowRight,
                        onClick: () => openCase(String(row.id)),
                      },
                    ],
                    universalHandlers: {
                      preview: () => setSelectedId(String(row.id)),
                    },
                  })}
                />
              </div>
              {selected ? (
                <aside className="w-full shrink-0 border-t border-c-border bg-c-surface-raised p-3 lg:w-[400px] lg:border-l lg:border-t-0">
                  <StandardPreview
                    title={selected.projectName || 'Zlecenie bez nazwy'}
                    onClose={() => setSelectedId(null)}
                    onOpenFull={() => openCase(selected.caseId)}
                    openLabel="Otwórz zlecenie"
                    meta={{
                      pills: [
                        { label: caseStatusLabel(selected.caseStatus, true), tone: 'info' },
                        { label: caseProfileLabel(selected.caseProfile, true), tone: 'neutral' },
                      ],
                      trailing: (
                        <span className="text-xs text-c-text-muted">
                          {relativeDays(selected.updatedAt)}
                        </span>
                      ),
                      recommendation: nextActionOf(selected),
                    }}
                    details={{
                      text: selected.projectDescription || 'Oczekiwany rezultat nie został opisany.',
                      showWordCount: false,
                      propertyLabel: 'Właściwość',
                      valueLabel: 'Wartość',
                      properties: [
                        {
                          id: 'zamkniecie',
                          label: 'Umówiony sposób zamknięcia',
                          value: closureTypeLabel(selected.contractedClosureType, true),
                        },
                        {
                          id: 'nadzor',
                          label: 'Nadzór',
                          value: governanceTierLabel(selected.governanceTier, true),
                        },
                        {
                          id: 'samodzielnosc',
                          label: 'Samodzielność systemu',
                          value: autonomyPolicyLabel(selected.autonomyPolicy, true),
                        },
                        {
                          id: 'dostarczenie',
                          label: 'Dostarczenie',
                          value: closureAxisStatusLabel(selected.deliveryStatus, true),
                        },
                        {
                          id: 'decyzja',
                          label: 'Decyzja',
                          value: closureAxisStatusLabel(selected.decisionStatus, true),
                        },
                        {
                          id: 'wdrozenie',
                          label: 'Wdrożenie',
                          value: closureAxisStatusLabel(selected.implementationStatus, true),
                        },
                        {
                          id: 'efekt',
                          label: 'Efekt',
                          value: closureAxisStatusLabel(selected.outcomeStatus, true),
                        },
                        { id: 'zmiana', label: 'Ostatnia zmiana', value: formatDateTime(selected.updatedAt) },
                      ],
                    }}
                    whatsNext={{
                      label: 'Co dalej',
                      note: 'Otwiera zlecenie na wybranej zakładce.',
                      items: [
                        {
                          id: 'plan',
                          label: 'Plan',
                          icon: ListChecks,
                          onClick: () => {
                            rememberOpenedCase(selected.caseId);
                            navigate(
                              `/zlecenia/${encodeURIComponent(selected.caseId)}?zakladka=plan&widok-planu=prosty`
                            );
                          },
                        },
                        {
                          id: 'realizacja',
                          label: 'Realizacja',
                          onClick: () => {
                            rememberOpenedCase(selected.caseId);
                            navigate(
                              `/zlecenia/${encodeURIComponent(selected.caseId)}?zakladka=realizacja`
                            );
                          },
                        },
                        {
                          id: 'rezultaty',
                          label: 'Rezultaty',
                          onClick: () => {
                            rememberOpenedCase(selected.caseId);
                            navigate(
                              `/zlecenia/${encodeURIComponent(selected.caseId)}?zakladka=rezultaty`
                            );
                          },
                        },
                      ],
                    }}
                  />
                </aside>
              ) : null}
            </div>
          ) : null}
        </div>
      </StandardModuleBar>
    </div>
  );
};

export default CasesListScreen;
