/**
 * DECYZJA_WYNIKI_TRZY_POZIOMY (2026-08-30, Piotr) — dev-render prototyp
 * POZIOMU 1: „Rejestr zestawień". Zastępuje treścią to, co dziś robi
 * `results-vnext-kpi-registry.tsx` (płaska lista POJEDYNCZYCH wskaźników,
 * omijająca poziom pośredni) — TEN ekran listuje ZESTAWIENIA OKRESOWE
 * ("KPI procesowe — sierpień 2026"), nie pojedyncze wskaźniki. Klik w
 * wiersz ma prowadzić na poziom 2 (tabela zestawu — `results-vnext-kpi-
 * scorecards`, REALNY `<ResultsKpiScorecardDetailPage>`), NIE prosto na
 * poziom 3 (`results-vnext-kpi-tool`).
 *
 * Ten ekran świadomie NIE mountuje żadnego realnego komponentu produkcyjnego
 * — żaden jeszcze nie istnieje dla tego poziomu (to właśnie luka, którą
 * decyzja właściciela nazywa). Używa tego samego kanonicznego budulca co
 * `results-vnext-kpi-registry.tsx` — `ResultsVNextRegistryShell`, czyli
 * `StandardModuleBar` + `StandardTable` + `StandardPreview` (patrz
 * `ResultsVNextRegistryShell.tsx` nagłówek: "Composes the Triada standard
 * EXACTLY"), z ręcznie skomponowanymi wierszami — dokładnie ten sam wzorzec
 * co `results-vnext-registry-shell.tsx` (P0 smoke tego shella).
 *
 * Cztery z sześciu wierszy MIRRORUJĄ 1:1 dane kart wyników sc-2/sc-3/sc-4 z
 * `results-vnext-kpi-scorecards.tsx` (ten sam rozkład Bezpieczne/Ostrzeżenie/
 * Krytyczne/Brak danych, ten sam właściciel, zbliżona data aktualizacji) —
 * CELOWO, żeby zrzut poziomu 1 obok zrzutu poziomu 2 czytał się jako JEDNA
 * ścieżka (ten sam okres, ta sama karta), a nie dwa niepowiązane ekrany.
 * Tekst podsumowania stanu w kolumnie „Stan wskaźników" używa DOKŁADNIE tego
 * samego formatu co `kpiScorecardPresenters.tsx`'s `distributionProperties`
 * ("Bezpieczne {n} · Ostrzeżenie {n} · Krytyczne {n} · Brak danych {n}") —
 * ta sama fraza, ten sam porządek.
 *
 * URL params:
 *   ?screen=results-zestawienia
 *   &state=ready|loading|empty|error   top-level stan tabeli (default ready)
 *   &filter=all|open|closed            filtr Menu 3 po stanie okresu (default all)
 *   &selected=<id|none>                pre-select wiersza (otwiera StandardPreview);
 *                                       'none' zamyka podgląd (default z1)
 */
import React, { useMemo, useState } from 'react';

import { ResultsVNextRegistryShell, type ResultsVNextTableProps } from '../../src/components/ResultsVNext';
import {
  getResultsDomainTabs,
  getResultsDomainPath,
  isResultsDomain,
} from '../../src/components/ResultsVNext/resultsDomainNavigation';
import type { StandardPreviewProps, StandardRowMenu, TableColumn } from '../../src/components/standard';
import { StatusChip } from '../../src/components/ui/primitives';
import { liczebnik } from '../../src/utils/liczebnik';

// ==========================================================================
// Mock — zestawienia okresowe (poziom 1). itemCount/distribution mirrorują
// sc-2/sc-3/sc-4 z results-vnext-kpi-scorecards.tsx gdzie to naturalne
// (ten sam okres, ta sama karta wyników pod spodem).
// ==========================================================================

type PeriodStatus = 'open' | 'closed';

interface ZestawienieRow {
  id: string;
  name: string;
  period: string;
  periodStatus: PeriodStatus;
  owner: string;
  itemCount: number;
  distribution: { safe: number; warning: number; critical: number; missing: number };
  updatedAt: string; // ISO
  /** Zestawienie poziomu 2, do którego prowadzi klik — dokumentacyjne,
   *  nawigacja między osobnymi ekranami dev-render nie jest tu zdrutowana. */
  scorecardId: string;
}

const ROWS: ZestawienieRow[] = [
  {
    id: 'z1',
    name: 'KPI procesowe — sierpień 2026',
    period: '1–31 sierpnia 2026',
    periodStatus: 'open',
    owner: 'Anna Kowalska',
    itemCount: 10,
    distribution: { safe: 6, warning: 3, critical: 1, missing: 0 },
    updatedAt: '2026-08-28T14:10:00Z',
    scorecardId: 'sc-2',
  },
  {
    id: 'z2',
    name: 'KPI jakości — Q3 2026',
    period: '1 lipca – 30 września 2026',
    periodStatus: 'open',
    owner: 'Anna Kowalska',
    itemCount: 3,
    distribution: { safe: 1, warning: 1, critical: 0, missing: 1 },
    updatedAt: '2026-08-09T09:30:00Z',
    scorecardId: 'sc-2',
  },
  {
    id: 'z3',
    name: 'KPI HR — redukcja kosztów, sierpień 2026',
    period: '1–31 sierpnia 2026',
    periodStatus: 'open',
    owner: 'Marek Zieliński',
    itemCount: 1,
    distribution: { safe: 0, warning: 0, critical: 1, missing: 0 },
    updatedAt: '2026-07-20T09:30:00Z',
    scorecardId: 'sc-3',
  },
  {
    id: 'z4',
    name: 'KPI zamknięcie miesiąca — czerwiec 2026',
    period: '1–30 czerwca 2026',
    periodStatus: 'closed',
    owner: 'Piotr Wiśniewski',
    itemCount: 1,
    distribution: { safe: 0, warning: 0, critical: 0, missing: 1 },
    updatedAt: '2026-06-30T08:00:00Z',
    scorecardId: 'sc-4',
  },
  {
    id: 'z5',
    name: 'KPI procesowe — lipiec 2026',
    period: '1–31 lipca 2026',
    periodStatus: 'closed',
    owner: 'Anna Kowalska',
    itemCount: 9,
    distribution: { safe: 7, warning: 2, critical: 0, missing: 0 },
    updatedAt: '2026-08-01T07:45:00Z',
    scorecardId: 'sc-2',
  },
  {
    id: 'z6',
    name: 'KPI sprzedaży — sierpień 2026',
    period: '1–31 sierpnia 2026',
    periodStatus: 'open',
    owner: 'Tomasz Nowak',
    itemCount: 6,
    distribution: { safe: 4, warning: 1, critical: 0, missing: 1 },
    updatedAt: '2026-08-27T16:20:00Z',
    scorecardId: 'sc-6',
  },
];

const PERIOD_STATUS_LABEL: Record<PeriodStatus, string> = {
  open: 'Otwarty',
  closed: 'Zamknięty',
};
const PERIOD_STATUS_TONE: Record<PeriodStatus, 'success' | 'neutral'> = {
  open: 'success',
  closed: 'neutral',
};

/**
 * Odmiana liczebnika — WSPÓLNA funkcja `liczebnik()` (`src/utils/liczebnik.ts`),
 * nie lokalna kopia. Do 2026-09-02 ten plik miał własną, trzecią implementację
 * tej samej reguły CLDR obok `liczebnik()` i natywnego `_one/_few/_many` i18next.
 */
function pluralizeWskaznik(n: number): string {
  return liczebnik(n, ['wskaźnik', 'wskaźniki', 'wskaźników']);
}

function formatDatePl(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pl-PL', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Ten sam format co `kpiScorecardPresenters.tsx`'s `distributionProperties`
 * ("Bezpieczne {n} · Ostrzeżenie {n} · Krytyczne {n} · Brak danych {n}") —
 * celowo identyczny, żeby poziom 1 i poziom 2 czytały się jako ta sama miara. */
function DistributionText({ d }: { d: ZestawienieRow['distribution'] }) {
  return (
    <span className="text-sm tabular-nums text-c-text">
      Bezpieczne {d.safe} · Ostrzeżenie {d.warning} · Krytyczne {d.critical} · Brak danych {d.missing}
    </span>
  );
}

function buildColumns(): TableColumn[] {
  return [
    {
      id: 'name',
      label: 'Nazwa zestawienia',
      width: '200px',
      sortable: true,
      render: (row: ZestawienieRow) => (
        <span className="text-sm font-medium text-c-text">{row.name}</span>
      ),
    },
    {
      // Uwaga: `name` ma zablokowane `minWidth:200/maxWidth:520` (FilterableTable
      // traktuje id `name`/`title` specjalnie) — 200px to dolna granica.
      // Okres rozliczeniowy + stan okresu w JEDNEJ kolumnie (zamiast dwóch) —
      // patrz komentarz przy `persistKey`: przy 7 osobnych kolumnach + otwarty
      // StandardPreview tabela realnie dostaje ~981px na 1440px viewport
      // (`div.overflow-x-auto` zmierzone w harnessie), a 7 kolumn żądało
      // 1400px — reszta ucinała się POZA widocznym scrollem (wyglądało jak
      // ucięty tekst "ST"/"Be"/"Br", nie było literą). Realny
      // `ResultsKpiRegistryPage.tsx` mieści się w 870px na 5 kolumnach — ten
      // ekran trzyma się tego samego budżetu.
      id: 'period',
      label: 'Okres',
      width: '160px',
      filterable: true,
      filterOptions: [
        { value: 'open', label: PERIOD_STATUS_LABEL.open },
        { value: 'closed', label: PERIOD_STATUS_LABEL.closed },
      ],
      render: (row: ZestawienieRow) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-c-text-secondary">{row.period}</span>
          <StatusChip label={PERIOD_STATUS_LABEL[row.periodStatus]} tone={PERIOD_STATUS_TONE[row.periodStatus]} />
        </div>
      ),
    },
    {
      id: 'owner',
      label: 'Właściciel',
      width: '120px',
      render: (row: ZestawienieRow) => (
        <span className="text-sm text-c-text-secondary">{row.owner}</span>
      ),
    },
    {
      // 2026-09-02 (rodzina ucięć): 90 px to MNIEJ niż podłoga czytelności
      // `FIT_MIN_COLUMN_WIDTH` (112 px) z FilterableTable — po odjęciu `px-4`
      // zostawało ~58 px, a odmieniony wyraz („wskaźniki", „wskaźników") ma ~65 px,
      // więc komórka rozrywała go w połowie („3 wskaźnik / i"). Budżet odzyskany
      // z kolumn `owner` i `updatedAt` (po -10 px), żeby suma nie przekroczyła
      // realnego obszaru tabeli z otwartym podglądem (~981 px).
      id: 'itemCount',
      label: 'Wskaźniki',
      width: '120px',
      align: 'right',
      sortable: true,
      render: (row: ZestawienieRow) => (
        <span className="text-sm tabular-nums text-c-text">
          {row.itemCount} {pluralizeWskaznik(row.itemCount)}
        </span>
      ),
    },
    {
      id: 'distribution',
      label: 'Stan wskaźników',
      width: '170px',
      render: (row: ZestawienieRow) => <DistributionText d={row.distribution} />,
    },
    {
      id: 'updatedAt',
      label: 'Zaktualizowano',
      width: '120px',
      sortable: true,
      render: (row: ZestawienieRow) => (
        // axe `color-contrast`: c-text-muted measures ~4.76:1 on plain
        // c-surface but drops to 4.02:1 once the row is selected
        // (bg-state-selected tints the background darker) — below 4.5:1.
        // c-text-secondary clears 6.4:1 on that tint and still reads as
        // the muted/secondary column next to the primary cells.
        <span className="text-sm text-c-text-secondary">{formatDatePl(row.updatedAt)}</span>
      ),
    },
  ];
}

function buildRowMenu(row: ZestawienieRow): StandardRowMenu {
  return {
    primary: [
      {
        id: 'open',
        label: 'Otwórz tabelę zestawu',
        // Poziom 1 -> poziom 2: w produkcie nawiguje do
        // `ROUTES.RESULTS_KPI.SCORECARD` (results-vnext-kpi-scorecards.tsx,
        // scorecardId=row.scorecardId). Ten prototyp poziomu 1 nie drutuje
        // realnej nawigacji między osobnymi ekranami harnessu.
        onClick: () => {},
      },
    ],
    universalHandlers: {
      preview: () => {},
    },
  };
}

function buildPreview(row: ZestawienieRow, onClose: () => void): StandardPreviewProps {
  return {
    title: row.name,
    onClose,
    onOpenFull: () => {},
    meta: {
      pills: [
        { label: PERIOD_STATUS_LABEL[row.periodStatus], tone: PERIOD_STATUS_TONE[row.periodStatus] },
        { label: row.period, tone: 'neutral' },
      ],
      trailing: (
        <span className="text-[11px] font-semibold text-c-text-secondary">
          {formatDatePl(row.updatedAt)}
        </span>
      ),
    },
    details: {
      showWordCount: false,
      properties: [
        { id: 'period', label: 'Okres rozliczeniowy', value: row.period },
        { id: 'owner', label: 'Właściciel', value: row.owner },
        {
          id: 'itemCount',
          label: 'Wskaźniki w zestawie',
          value: `${row.itemCount} ${pluralizeWskaznik(row.itemCount)}`,
        },
        { id: 'distribution', label: 'Stan wskaźników', value: <DistributionText d={row.distribution} /> },
      ],
    },
    ai: {
      hints: [],
      disabled: true,
      disabledTooltip: 'Wkrótce',
    },
    relations: [],
    actions: {
      resolutions: [
        { id: 'open-set', variant: 'positive', label: 'Otwórz tabelę zestawu', onClick: () => {} },
      ],
    },
  };
}

const params = new URLSearchParams(window.location.search);
const state = params.get('state') || 'ready';
const periodFilterParam = params.get('filter');
const initialFilter: 'all' | PeriodStatus =
  periodFilterParam === 'open' || periodFilterParam === 'closed' ? periodFilterParam : 'all';
const initialSelectedParam = params.get('selected');

const ResultsZestawieniaScreen: React.FC = () => {
  const [filter, setFilter] = useState<'all' | PeriodStatus>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedParam === 'none' ? null : (initialSelectedParam ?? ROWS[0]?.id ?? null)
  );

  const visibleRows = useMemo(
    () => (filter === 'all' ? ROWS : ROWS.filter((r) => r.periodStatus === filter)),
    [filter]
  );
  const selectedRow = visibleRows.find((r) => r.id === selectedId) ?? null;
  const columns = useMemo(() => buildColumns(), []);

  const table: ResultsVNextTableProps = {
    columns,
    data:
      state === 'empty'
        ? []
        : (visibleRows as unknown as Array<Record<string, unknown> & { id: string }>),
    // Klucz MUSI być inny niż `results-vnext.kpi-registry` (realny
    // <ResultsKpiRegistryPage>) — ten sam klucz koliduje z jego zapisanym w
    // localStorage stanem szerokości kolumn (patrz `ResultsVNextRegistryShell
    // .tsx` nagłówek, "collision trap"): pierwsza wersja tego ekranu użyła
    // tego samego klucza i kolumny renderowały się uciete do kilku pikseli —
    // dokładnie ten defekt, który ten prototyp ma wykryć, nie powielić.
    persistKey: 'results-vnext.kpi-zestawienia-registry',
    loading: state === 'loading',
    error: state === 'error' ? 'Nie udało się wczytać rejestru zestawień — usługa zwróciła błąd 503.' : null,
    onRetry: () => {},
    empty:
      state === 'empty'
        ? {
            title: 'Brak zestawień',
            description: 'Utwórz pierwsze zestawienie okresowe, aby zacząć śledzić wskaźniki.',
            actionLabel: 'Nowe zestawienie',
            onAction: () => {},
          }
        : undefined,
    selectedRowId: selectedId,
    onRowClick: (row) => setSelectedId(String((row as unknown as ZestawienieRow).id)),
    rowMenu: (row) => buildRowMenu(row as unknown as ZestawienieRow),
    defaultSort: { columnId: 'updatedAt', direction: 'desc' },
  };

  return (
    <div className="h-screen bg-c-bg text-c-text">
      <ResultsVNextRegistryShell
        domain="kpi"
        moduleBar={{
          tabs: getResultsDomainTabs(),
          activeTab: 'kpi',
          onTabChange: (id) => {
            if (id === 'search' || isResultsDomain(id)) {
              // W produkcie: navigate(getResultsDomainPath(id)) — patrz
              // `ResultsKpiRegistryPage.tsx`. Odwołanie zachowane tu tylko
              // po to, żeby `getResultsDomainPath`/`isResultsDomain` nie
              // wyglądały na martwy import.
              void getResultsDomainPath(id);
            }
          },
          showTabCounts: false,
          viewModes: ['table'],
          viewMode: 'table',
          chips: [
            { id: 'all', label: 'Wszystkie', count: ROWS.length },
            { id: 'open', label: 'Otwarte', count: ROWS.filter((r) => r.periodStatus === 'open').length },
            { id: 'closed', label: 'Zamknięte', count: ROWS.filter((r) => r.periodStatus === 'closed').length },
          ],
          activeChip: filter,
          onChipChange: (id) => setFilter(id === 'open' || id === 'closed' ? id : 'all'),
          primaryCta: {
            label: 'Nowe zestawienie',
            onClick: () => {},
            testId: 'kpi-zestawienia-create-cta',
          },
        }}
        table={table}
        preview={state === 'ready' && selectedRow ? buildPreview(selectedRow, () => setSelectedId(null)) : null}
        forbidden={null}
        onForbiddenBack={() => {}}
      />
    </div>
  );
};

export default ResultsZestawieniaScreen;
