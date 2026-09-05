import {
  BarChart3,
  Calculator,
  CheckSquare2,
  ClipboardList,
  FileText,
  Gauge,
  History,
  MoreVertical,
  Plus,
  Settings2,
  Sparkles,
  Target,
} from 'lucide-react';
import React, { useEffect } from 'react';

import {
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '../../src/components/standard/ArtifactRightPanel';
import {
  StandardModuleBar,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../../src/components/standard';

type View = 'kpi-l1' | 'kpi-l2' | 'kpi-l3' | 'okr-l1' | 'okr-l2' | 'okr-l3' | 'roi-l1' | 'roi-l2';
const view = (new URLSearchParams(window.location.search).get('view') || 'kpi-l1') as View;

const domain = view.split('-')[0];

const status = (
  label: string,
  tone: 'ok' | 'warn' | 'bad' | 'neutral' = 'neutral',
  action = false
) => (
  <span
    title={action ? `${label} · działanie otwarte` : label}
    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone === 'bad' ? 'border-c-danger/40 bg-c-danger/10 text-c-danger' : tone === 'warn' ? 'border-c-warning/40 bg-c-warning/10 text-c-warning' : tone === 'ok' ? 'border-c-success/40 text-c-success' : 'border-c-border-subtle text-c-text-secondary'}`}
  >
    {label}
    {action ? <ClipboardList size={12} aria-label="Otwarta karta działania" /> : null}
  </span>
);

const Pair = ({
  target,
  actual,
  tone = 'neutral',
}: {
  target: string;
  actual: string;
  tone?: 'neutral' | 'warn' | 'bad';
}) => (
  /**
   * K10 — para CEL / Rezultat musi zmiescic sie w 108 px tresci kolumny okresu.
   *
   * DEFEKT 1b i pierwszego podejscia 1c: `min-w-[108px]` rozpychalo komorke, a
   * caly napis „Rezultat  11 620" w 14 px polgrubym ma 120–124 px (zmierzone) —
   * czyli o 12–16 px wiecej, niz kolumna moze dac. `FilterableTable` przy
   * tabeli szerszej niz obszar schodzi do PODLOG (`text` = 140 px) i wiecej
   * kolumnie dac nie mozna, wiec to TRESC musi sie zmiescic.
   *
   * ROZWIAZANIE: etykiety `CEL` i `Rezultat` sa opisami (10 px, wyciszone),
   * wartosc rezultatu zostaje duza i czytelna (14 px). Zmierzone: 105 px.
   * Kolejnosc „CEL nad Rezultatem" — zgodnie z SSOT i akceptem 1b.
   */
  <div
    title={`CEL ${target} · Rezultat ${actual}`}
    className="w-full overflow-hidden whitespace-nowrap text-right tabular-nums"
  >
    <div className="flex items-baseline justify-end gap-1.5 whitespace-nowrap text-[10px] text-c-text-muted">
      <span>CEL</span>
      <span>{target}</span>
    </div>
    <div className="flex items-baseline justify-end gap-1.5 whitespace-nowrap">
      <span className="text-[10px] text-c-text-muted">Rezultat</span>
      <span
        className={`text-sm ${tone === 'bad' ? 'font-semibold text-c-danger' : tone === 'warn' ? 'font-semibold text-c-warning' : 'font-medium text-c-text'}`}
      >
        {actual}
      </span>
    </div>
  </div>
);

/**
 * K-1d — kolumna STAN w L1 (KPI/OKR raporty).
 *
 * DEFEKT werdyktu 1c: nagłówek „STAN · N / O / K / B" jest skrót-kodem —
 * czytelny tylko po odgadnięciu, co znaczą litery. Naprawa: nagłówek samo
 * „STAN", a cztery liczby (w normie/ostrzeżenie/krytyczne/brak) dostają
 * kolorowe kropki zamiast liter, plus pełny opis w `title` (dymek).
 *
 * Format wejściowy z danych: `"93 / 21 / 8 / 16"` (kolejność zawsze
 * N/O/K/B). Wyjście: `● 93 · ● 21 · ● 8 · ● 16` z kropką koloru
 * `c-success`/`c-warning`/`c-danger`/`c-text-muted` przed każdą liczbą.
 */
const StateCounts = ({ value }: { value: string }) => {
  const [ok = '—', warn = '—', bad = '—', missing = '—'] = value.split('/').map((p) => p.trim());
  const dotClass = (tone: 'ok' | 'warn' | 'bad' | 'muted') =>
    `inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
      tone === 'ok'
        ? 'bg-c-success'
        : tone === 'warn'
          ? 'bg-c-warning'
          : tone === 'bad'
            ? 'bg-c-danger'
            : 'bg-c-text-muted'
    }`;
  return (
    <span
      title={`w normie ${ok} · ostrzeżenie ${warn} · krytyczne ${bad} · brak ${missing}`}
      className="inline-flex items-center whitespace-nowrap text-xs tabular-nums text-c-text-secondary"
    >
      <i aria-hidden="true" className={`${dotClass('ok')} mr-1`} />
      {ok}
      <span aria-hidden="true" className="mx-1 text-c-text-muted">
        ·
      </span>
      <i aria-hidden="true" className={`${dotClass('warn')} mr-1`} />
      {warn}
      <span aria-hidden="true" className="mx-1 text-c-text-muted">
        ·
      </span>
      <i aria-hidden="true" className={`${dotClass('bad')} mr-1`} />
      {bad}
      <span aria-hidden="true" className="mx-1 text-c-text-muted">
        ·
      </span>
      <i aria-hidden="true" className={dotClass('muted')} />
      <span className="ml-1">{missing}</span>
    </span>
  );
};

const reportsKpi = [
  {
    id: '1',
    name: 'Plant Balanced Scorecard — Zakład DBR77',
    scope: 'Zakład Tychy',
    period: '2026 · edycja 03',
    count: 138,
    state: '93 / 21 / 8 / 16',
    actions: 8,
    owner: 'Anna Kowalska',
    updated: '05.09.2026',
  },
  {
    id: '2',
    name: 'KPI produkcji — Q3 2026',
    scope: 'Produkcja',
    period: 'Q3 2026',
    count: 24,
    state: '17 / 4 / 2 / 1',
    actions: 2,
    owner: 'Marek Zieliński',
    updated: '04.09.2026',
  },
  {
    id: '3',
    name: 'KPI jakości — sierpień',
    scope: 'Jakość',
    period: 'VIII 2026',
    count: 18,
    state: '13 / 3 / 1 / 1',
    actions: 1,
    owner: 'Joanna Lis',
    updated: '03.09.2026',
  },
];
const reportsOkr = [
  {
    id: '1',
    name: 'OKR zakładu — Q4 2026',
    scope: 'Zakład DBR77',
    cycle: 'Q4 2026',
    objectives: 4,
    results: 11,
    state: '7 / 3 / 1 / —',
    owners: 7,
    checkin: '04.09.2026',
  },
  {
    id: '2',
    name: 'OKR automatyzacji — Q4 2026',
    scope: 'Program automatyzacji',
    cycle: 'Q4 2026',
    objectives: 3,
    results: 8,
    state: '6 / 2 / — / —',
    owners: 5,
    checkin: '03.09.2026',
  },
  {
    id: '3',
    name: 'OKR sprzedaży — H2 2026',
    scope: 'Sprzedaż',
    cycle: 'H2 2026',
    objectives: 3,
    results: 9,
    state: '5 / 2 / 1 / 1',
    owners: 6,
    checkin: '01.09.2026',
  },
];
const roiRows = [
  {
    id: '1',
    name: 'Robotyzacja gniazda spawalniczego',
    subject: 'Robotyzacja',
    option: '2 · pełna automatyzacja',
    capex: '1 000 000 zł',
    benefit: '400 000 zł',
    roi: 'ROI 5Y 100%',
    payback: '2,5 roku',
    npv: '516 315 zł',
    irr: '28,7%',
    recommendation: 'CONDITIONAL GO',
    phase: 'Wyliczenia',
    owner: 'Piotr Wiśniewski',
  },
  {
    id: '2',
    name: 'System wizyjny kontroli jakości',
    subject: 'IT / jakość',
    option: '1 · modernizacja',
    capex: '620 000 zł',
    benefit: '238 000 zł',
    roi: 'ROI 3Y 15%',
    payback: '2,6 roku',
    npv: '—',
    irr: '—',
    recommendation: 'GO',
    phase: 'Założenia',
    owner: 'Joanna Lis',
  },
  {
    id: '3',
    name: 'Automatyzacja magazynu WIP',
    subject: 'Magazyn',
    option: '3 · RaaS',
    capex: '—',
    benefit: '—',
    roi: '—',
    payback: '—',
    npv: '—',
    irr: '—',
    recommendation: '—',
    phase: 'Założenia',
    owner: 'Marek Zieliński',
  },
];

/**
 * KOREKTA 1c — K11 / K12 / K13.
 *
 * DEFEKT 1b: `col()` renderowało KAŻDĄ wartość jako `<span whitespace-nowrap>`
 * bez `overflow`, więc tekst dłuższy niż kolumna wychodził poza własną komórkę
 * i kładł się na sąsiedniej („…z 42 do 28 min" na „Marek Zieliński",
 * „spawalniczego" na „Robotyzacja"). Własny `render` omija przy okazji warstwę
 * `CELL_TEXT_CLAMP_CLASS` + `OverflowTooltip`, którą `FilterableTable` zakłada
 * gołemu tekstowi — czyli prototyp sam sobie wyłączył mechanikę wspólną.
 *
 * NAPRAWA: komórka NIGDY nie wylewa się poza swój boks.
 *   · domyślnie jedna linia + `truncate` (nowrap + overflow-hidden + wielokropek),
 *   · `wrap: true` → dwie linie (`line-clamp-2`) dla treści opisowych (K11/K12),
 *   · pełna treść ZAWSZE w `title` (wymóg pomiaru 1c: zero uciętych bez dymka).
 * `dataType` steruje podłogą szerokości w mechanice P2 (`FilterableTable`
 * `COLUMN_MIN_WIDTH_BY_DATA_TYPE`) — dzięki temu kolumny liczbowe/statusowe nie
 * zjadają budżetu 140 px przeznaczonego dla kolumn tekstowych.
 */
const col = (
  id: string,
  label: string,
  width = '140px',
  render?: (row: any) => React.ReactNode,
  defaultVisible = true,
  opts: { wrap?: boolean; dataType?: TableColumn['dataType'] } = {}
): TableColumn => ({
  id,
  label,
  width,
  defaultVisible,
  ...(opts.dataType ? { dataType: opts.dataType } : {}),
  render:
    render ||
    ((r: any) => {
      const value = r[id];
      if (value === undefined || value === null || value === '')
        return <span className="text-sm text-c-text-muted">—</span>;
      return (
        <span
          title={String(value)}
          /* UWAGA: przy `wrap` NIE dokladamy `block` — `line-clamp-2` ustawia
             `display: -webkit-box`, a `block` z tej samej warstwy Tailwinda
             wygrywa kolejnoscia w arkuszu i klamra przestaje dzialac (wiersz
             puchl do trzech linii, zmierzone 76 px zamiast 56 px). */
          className={`text-sm text-c-text-secondary ${
            opts.wrap ? 'line-clamp-2 break-normal' : 'block truncate'
          }`}
        >
          {String(value)}
        </span>
      );
    }),
});
const table = (
  data: any[],
  columns: TableColumn[],
  key: string,
  rowClassName?: (row: TableRow) => string,
  minTableWidth: number | 'columns' = 'columns',
  showRowMenu = true
) => (
  <StandardTable
    data={data}
    columns={columns}
    persistKey={`p7k.prototype.1c.${key}`}
    minTableWidth={minTableWidth}
    density="compact"
    rowClassName={rowClassName}
    rowMenu={
      showRowMenu
        ? () => ({ primary: [{ id: 'open', label: 'Otwórz', onClick: () => {} }] })
        : undefined
    }
  />
);

/** Kolejnosc kluczy danych na wierszu, wyrownana z etykietami miesiecy ponizej
 *  (STY..WRZ = index 0..8); PAZ/LIS/GRU (9..11) nie maja jeszcze danych. */
const periodKeys = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'jul', 'aug', 'sep'];

const periodColumns = [
  'STY',
  'LUT',
  'MAR',
  'KWI',
  'MAJ',
  'CZE',
  'LIP',
  'SIE',
  'WRZ',
  'PAŹ',
  'LIS',
  'GRU',
].map((label, index) =>
  /* 136 px = zmierzona treść „Rezultat  11 520" (103 px) + `px-4` z obu stron
     (32 px) + 1 px zapasu; nagłówek „STY 2026" ma podłogę 91 px — mieści się. */
  col(
    `period-${index + 1}`,
    `${label} 2026`,
    '136px',
    (row) => {
    if (row.group) return null;
    /**
     * K-1d: STY–CZE renderowały tą samą pare CEL 11 400 / Rezultat 11 520
     * (albo 76%/77% dla OEE) w KAŻDYM miesiacu i dla KAZDEGO wiersza —
     * dane probne wygladaly na atrape. Kazdy wiersz (`k1`/`k2`/`k3`) ma
     * teraz WLASNE pole na kazdy miesiac (`sty`..`sep`), z rosnacym trendem
     * sprzedazy (k1/k2) i OEE w widelkach 74-78% (k3); LIP/SIE/WRZ zostaja
     * bez zmian (juz byly zroznicowane w 1c).
     */
    const key = periodKeys[index];
    return key && row[key] !== undefined ? row[key] : <Pair target="—" actual="—" />;
    },
    true,
    /* SWIADOMIE `text` (podloga 140 px), nie `number` (90 px).
       Pomiar 1c: `FilterableTable` przycina `minTableWidth` do szerokosci
       kontenera (`effectiveMinTableWidth = min(minTableWidth, viewport)`), wiec
       przy 22 kolumnach tabela ZAWSZE wchodzi w galaz „nawet podlogi sie nie
       mieszcza” i kazda kolumna dostaje swoja PODLOGE. Przy `number` (90 px)
       zostawalo 58 px na tresc i „Rezultat 11 520” (103 px) wychodzilo poza
       komorke. Podloga `text` = 140 px daje 108 px — tresc miesci sie co do
       piksela, a poziome przewijanie miesiecy (SSOT) bierze sie wlasnie z tego,
       ze suma podlog jest szersza niz obszar. */
    {}
  )
);

/**
 * Suma zadeklarowanych szerokości KPI L2 + 80 px strukturalnej kolumny akcji
 * (`ROW_ACTIONS_COLUMN_WIDTH`). Podana jako `minTableWidth`, żeby
 * `columnFit` nie skalował kolumn — skalowanie rozjeżdżało szerokości
 * nagłówka i wierszy (defekt K10).
 * 220 + 178 + 140 + 140 + 144 + 110 + 92 + 12x136 + 136 + 132 + 80 = 3004.
 */
const KPI_L2_TABLE_WIDTH = 3155;

const kpiItems = [
  {
    id: 'group-sales',
    group: true,
    name: 'SPRZEDAŻ',
    groupOwner: 'właściciel nadrzędny: Dyrektor Sprzedaży',
    area: 'Sprzedaż',
  },
  {
    id: 'k1',
    area: 'Sprzedaż',
    name: 'Wielkość sprzedaży netto',
    contract: '↑ min. · LC/1000',
    cadence: 'Miesiąc',
    type: 'Rozliczeniowy',
    owner: 'Tomasz Nowak',
    benchmark: '12 400',
    limit: '5%',
    sty: <Pair target="11 200" actual="11 050" />,
    lut: <Pair target="11 300" actual="11 260" />,
    mar: <Pair target="11 400" actual="11 480" />,
    kwi: <Pair target="11 600" actual="11 690" />,
    maj: <Pair target="11 800" actual="11 750" tone="warn" />,
    cze: <Pair target="11 900" actual="12 050" />,
    jul: <Pair target="12 000" actual="12 180" />,
    aug: <Pair target="12 400" actual="11 620" tone="bad" />,
    sep: <Pair target="12 800" actual="—" />,
    ytd: <Pair target="98 200" actual="94 810" tone="warn" />,
    state: status('Krytyczne', 'bad', true),
  },
  {
    id: 'k2',
    area: 'Sprzedaż',
    name: 'Poziom przyjętych zamówień',
    contract: '↑ min. · LC/1000',
    cadence: 'Miesiąc',
    type: 'Rozliczeniowy',
    owner: 'Ewa Maj',
    benchmark: '10 900',
    limit: '4%',
    sty: <Pair target="9 800" actual="9 900" />,
    lut: <Pair target="9 950" actual="10 050" />,
    mar: <Pair target="10 100" actual="10 200" />,
    kwi: <Pair target="10 250" actual="10 340" />,
    maj: <Pair target="10 400" actual="10 460" />,
    cze: <Pair target="10 450" actual="10 600" />,
    jul: <Pair target="10 500" actual="10 720" />,
    aug: <Pair target="10 900" actual="10 540" tone="warn" />,
    sep: <Pair target="11 100" actual="—" />,
    ytd: <Pair target="86 000" actual="85 440" />,
    state: status('Ostrzeżenie', 'warn'),
  },
  {
    id: 'group-production',
    group: true,
    name: 'PRODUKCJA',
    groupOwner: 'właściciel nadrzędny: Dyrektor Operacyjny',
    area: 'Produkcja',
  },
  {
    id: 'k3',
    area: 'Produkcja',
    name: 'OEE linii montażowej',
    contract: '↑ min. · %',
    cadence: 'Miesiąc',
    type: 'Rozliczeniowy',
    owner: 'Marek Zieliński',
    benchmark: '78%',
    limit: '3%',
    sty: <Pair target="74%" actual="75%" />,
    lut: <Pair target="75%" actual="75%" />,
    mar: <Pair target="75%" actual="76%" />,
    kwi: <Pair target="76%" actual="76%" />,
    maj: <Pair target="76%" actual="77%" />,
    cze: <Pair target="77%" actual="78%" />,
    jul: <Pair target="76%" actual="77%" />,
    aug: <Pair target="78%" actual="79%" />,
    sep: <Pair target="79%" actual="—" />,
    ytd: <Pair target="76%" actual="77%" />,
    state: status('W normie', 'ok'),
  },
];

const okrItems = [
  {
    id: 'theme1',
    group: true,
    result: 'EFEKTYWNOŚĆ OPERACYJNA',
    groupOwner: 'właściciel nadrzędny: Dyrektor Operacyjny',
  },
  {
    id: 'kr1',
    objective: 'Skrócić przezbrojenia bez utraty jakości',
    ambition: 'Zobowiązanie',
    result: 'Skrócić średni czas przezbrojenia z 42 do 28 min',
    owner: 'Marek Zieliński',
    team: 'Produkcja L3',
    values: '42 / 28 / 31 min',
    progress: '79%',
    confidence: 'Średnia',
    deadline: '30.11.2026',
    checkin: '04.09.2026',
    state: status('Zagrożony', 'warn'),
  },
  {
    id: 'kr2',
    objective: 'Skrócić przezbrojenia bez utraty jakości',
    ambition: 'Zobowiązanie',
    result: 'Utrzymać FPY podczas zmian na poziomie min. 98%',
    owner: 'Joanna Lis',
    team: 'Jakość',
    values: '97,2 / 98 / 96,8%',
    progress: '—',
    confidence: 'Niska',
    deadline: '30.11.2026',
    checkin: '03.09.2026',
    state: status('Krytyczne', 'bad', true),
  },
  {
    id: 'theme2',
    group: true,
    result: 'WZROST PRZYCHODÓW',
    groupOwner: 'właściciel nadrzędny: Dyrektor Sprzedaży',
  },
  {
    id: 'kr3',
    objective: 'Uruchomić sprzedaż nowej usługi',
    ambition: 'Aspiracja',
    result: 'Pozyskać 12 klientów pilotażowych',
    owner: 'Ewa Maj',
    team: 'Sprzedaż',
    values: '0 / 12 / 9',
    progress: '75%',
    confidence: 'Wysoka',
    deadline: '15.12.2026',
    checkin: '05.09.2026',
    state: status('Na dobrej drodze', 'ok'),
  },
];

function Frame({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: string;
}) {
  const tabs = [
    { id: 'kpi', label: 'KPI', icon: <Gauge size={15} /> },
    { id: 'okr', label: 'OKR', icon: <Target size={15} /> },
    { id: 'roi', label: 'ROI', icon: <Calculator size={15} /> },
  ];
  return (
    <div className="min-h-screen bg-c-app text-c-text">
      <header className="border-b border-c-border bg-c-surface px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-c-text-muted">Wyniki › {domain.toUpperCase()}</div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-xs text-c-text-secondary">{subtitle}</p>
          </div>
          <button aria-label="Więcej" className="p-2">
            <MoreVertical size={18} />
          </button>
        </div>
      </header>
      <StandardModuleBar
        tabs={tabs}
        activeTab={domain}
        onTabChange={() => {}}
        onSearch={() => {}}
        viewModes={['table', 'grid']}
        viewMode="table"
        onViewModeChange={() => {}}
        primaryCta={action ? { label: action, icon: Plus, onClick: () => {} } : undefined}
        chips={
          view === 'okr-l2'
            ? [
                { id: 'owners', label: 'Właściciel: wszyscy' },
                { id: 'all', label: 'Wszystkie' },
                { id: 'risk', label: 'Zagrożone' },
                { id: 'missing', label: 'Bez check-inu' },
              ]
            : undefined
        }
        activeChip={view === 'okr-l2' ? 'owners' : undefined}
        onChipChange={() => {}}
      />
      <main className="p-4">{children}</main>
    </div>
  );
}

const panelSections: ArtifactRightPanelSection[] = [
  {
    id: 'actions',
    label: 'Akcje',
    defaultOpen: true,
    children: (
      <button className="w-full rounded-lg border border-c-border px-3 py-2 text-left text-xs">
        Otwórz kartę działania
      </button>
    ),
  },
  {
    id: 'properties',
    label: 'Właściwości',
    defaultOpen: true,
    children: (
      <p className="text-xs text-c-text-secondary">
        Właściciel · Tomasz Nowak
        <br />
        Cykl · Miesięczny
      </p>
    ),
  },
  {
    id: 'relations',
    label: 'Powiązania',
    defaultOpen: false,
    children: <p className="text-xs text-c-text-secondary">Plant Balanced Scorecard</p>,
  },
  {
    id: 'evidence',
    label: 'Źródła i założenia',
    defaultOpen: false,
    children: <p className="text-xs text-c-text-secondary">Arkusz wyników DBR77</p>,
  },
  {
    id: 'comments',
    label: 'Komentarze',
    defaultOpen: false,
    children: <p className="text-xs text-c-text-secondary">Brak komentarzy.</p>,
  },
  {
    id: 'history',
    label: 'Historia',
    defaultOpen: false,
    children: <p className="text-xs text-c-text-secondary">Aktualizacja 05.09.2026</p>,
  },
];
const navIcons = [BarChart3, Settings2, Gauge, ClipboardList, CheckSquare2, FileText, History];
const CardShell = ({
  sections,
  active,
  children,
}: {
  sections: string[];
  active: string;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-[150px_minmax(0,1fr)_270px] gap-4">
    <nav aria-label="Sekcje karty" className="rounded-xl border border-c-border bg-c-surface p-2">
      {sections.map((s, i) => {
        const Icon = navIcons[i % navIcons.length]!;
        return (
          <div
            key={s}
            className={`flex items-center gap-2 border-l-2 px-3 py-2 text-sm ${s === active ? 'border-l-c-danger bg-c-surface-raised font-medium text-c-text' : 'border-l-transparent text-c-text-secondary'}`}
          >
            <Icon size={14} />
            {s}
          </div>
        );
      })}
    </nav>
    <section className="min-w-0 space-y-4">{children}</section>
    <aside
      aria-label="Panel artefaktu"
      className="self-start overflow-hidden rounded-2xl border border-c-border-subtle bg-c-surface"
    >
      <div className="grid grid-cols-2 border-b border-c-border-subtle p-1">
        <button className="rounded-lg bg-c-surface-raised px-2 py-2 text-xs font-semibold">
          Szczegóły
        </button>
        <button className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-c-text-secondary">
          <Sparkles size={13} />
          Teresa
        </button>
      </div>
      <ArtifactRightPanel
        renderAs="div"
        width="100%"
        className="border-0"
        sections={panelSections}
      />
    </aside>
  </div>
);
const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-c-border bg-c-surface p-4">
    <h2 className="mb-3 text-sm font-semibold">{title}</h2>
    {children}
  </div>
);

function Content() {
  useEffect(() => {
    document.querySelectorAll<HTMLTableRowElement>('tr.p7k-group-row').forEach((row) => {
      const cells = row.querySelectorAll<HTMLTableCellElement>('td');
      if (cells[0]) {
        cells[0].colSpan = cells.length;
        cells[0].style.position = 'sticky';
        cells[0].style.left = '0';
        cells[0].style.zIndex = '30';
        /* Przypieta komorka MUSI byc nieprzezroczysta (K10) — tlo grupy siedzi
           na `tr`, a `td` dziedziczy przezroczystosc i przepuszcza spod siebie
           przewijana tresc. */
        cells[0].style.background = 'var(--c-surface-raised)';
      }
      for (let i = 1; i < cells.length; i += 1) cells[i]!.style.display = 'none';
    });
    /**
     * ── K10 · przypięte kolumny z REALNYCH szerokości ─────────────────────
     *
     * DEFEKT 1b: offsety `right` przypiętych kolumn były wpisane na sztywno
     * (STAN `right-44`, YTD `right-234`) i zakładały, że kolumna akcji ma 44 px,
     * a YTD/STAN po 190 px. W rzeczywistości kolumna akcji ma 80 px
     * (`ROW_ACTIONS_COLUMN_WIDTH`, klasa `w-20`), a `columnFit` skalował YTD/STAN
     * do ~139 px. Efekt na zrzucie: między YTD a STAN zostawało 51 px okna, przez
     * które przebijała przewijana kolumna GRU („CEL —"), a YTD nachodziło na
     * sąsiada. Offsety liczymy więc PO renderze, z `getBoundingClientRect()`.
     */
    const host = document.querySelector<HTMLElement>('[data-p7k-kpi-periods]');
    const scroller = host?.querySelector<HTMLElement>('.overflow-x-auto');
    if (!host || !scroller) return undefined;
    const headRow = host.querySelector<HTMLTableRowElement>('thead tr');
    const headCells = [...(headRow?.children ?? [])] as HTMLElement[];
    const widthOf = (el?: HTMLElement) => (el ? el.getBoundingClientRect().width : 0);
    const actionsWidth = widthOf(headCells[headCells.length - 1]);
    const stanWidth = widthOf(headCells[headCells.length - 2]);
    host.querySelectorAll<HTMLTableRowElement>('tr').forEach((row) => {
      if (row.classList.contains('p7k-group-row')) return;
      const cells = [...row.children] as HTMLElement[];
      const stan = cells[cells.length - 2];
      const ytd = cells[cells.length - 3];
      if (stan) stan.style.right = `${Math.round(actionsWidth)}px`;
      if (ytd) ytd.style.right = `${Math.round(actionsWidth + stanWidth)}px`;
    });

    // Wiersz grupy (colSpan) jedzie z przewijaniem, żeby nazwa grupy była
    // zawsze widoczna obok przypiętej kolumny MIERNIK.
    const syncGroupRows = () => {
      host
        .querySelectorAll<HTMLElement>('tr.p7k-group-row td:first-child > *')
        .forEach((content) => {
          content.style.transform = `translateX(${scroller.scrollLeft}px)`;
          content.style.width = `${scroller.clientWidth - 32}px`;
        });
    };

    /**
     * Domyślnie widok stoi na WRZ 2026 (bieżący miesiąc, SSOT). `?scroll=start`
     * daje drugi zrzut od STY 2026 — dowód, że przypięcie działa na obu
     * krańcach przewijania (wymóg 1c).
     */
    const atStart = new URLSearchParams(window.location.search).get('scroll') === 'start';
    const pinnedLeft = Math.round(widthOf(headCells[0]));
    const wrzHeader = headCells.find((cell) => cell.textContent?.trim().startsWith('WRZ'));
    const styHeader = headCells.find((cell) => cell.textContent?.trim().startsWith('STY'));
    /**
     * PRZYCIAGANIE DO KRAWEDZI KOLUMNY. Samo `offsetLeft - pinnedLeft` bywa
     * przyciete przez maksymalne przewiniecie i wtedy spod przypietej kolumny
     * MIERNIK wystaje OGON sasiedniej kolumny („…2026" bez nazwy miesiaca).
     * Wybieramy najdalsza krawedz kolumny, ktora jeszcze miesci sie w zakresie
     * przewijania — pierwszy przewijany miesiac zaczyna sie wtedy dokladnie za
     * kolumna przypieta.
     */
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    /* `?scroll=start` = POCZATEK ROKU, czyli STY 2026 tuz za kolumna przypieta
       (a nie `scrollLeft = 0`, przy ktorym widac same kolumny kontraktu i ani
       jednego miesiaca). */
    const cel = atStart ? styHeader : wrzHeader;
    const chciane = cel ? Math.max(0, cel.offsetLeft - pinnedLeft) : 0;
    const krawedzie = headCells
      .map((cell) => cell.offsetLeft - pinnedLeft)
      .filter((offset) => offset >= 0 && offset <= Math.min(chciane, maxScroll));
    scroller.scrollLeft = cel ? Math.max(0, ...krawedzie) : 0;
    syncGroupRows();
    scroller.addEventListener('scroll', syncGroupRows);
    return () => scroller.removeEventListener('scroll', syncGroupRows);
  }, []);
  if (view === 'kpi-l1')
    return (
      <Frame
        title="Raporty KPI"
        subtitle="Proces · zestawienia okresowe zakładów, projektów i działów"
        action="Nowy raport"
      >
        {table(
          reportsKpi,
          [
            /**
             * K-1d: naglowek „STAN · norma / ostrz. / kryt. / brak" (a wczesniej
             * skrot-kod „STAN · N / O / K / B") mial podloge 268 px i sam jeden
             * wypychal tabele poza obszar 1374 px: ostatnia kolumna chowala sie
             * pod przypieta kolumna akcji („AKTUALIZACJA" -> „AKTU…",
             * „05.09.2026" -> „05.0"). Naprawa: naglowek samo „STAN", cztery
             * liczby z kolorowymi kropkami w komorce (`StateCounts`), pelne
             * znaczenie w `title` komorki — zero skrotow tekstowych.
             */
            col('name', 'NAZWA RAPORTU', '320px'),
            col('scope', 'ZAKRES', '130px', undefined, true, { dataType: 'status' }),
            col('period', 'OKRES', '145px', undefined, true, { dataType: 'number' }),
            col('count', 'MIERNIKI', '90px', undefined, true, { dataType: 'number' }),
            col('state', 'STAN', '148px', (r) => <StateCounts value={r.state} />, true, {
              dataType: 'number',
            }),
            col('actions', 'OTWARTE DZIAŁANIA', '168px', undefined, true, {
              dataType: 'number',
            }),
            col('owner', 'PRZYGOTOWAŁ', '140px', undefined, true, { dataType: 'number' }),
            col('updated', 'AKTUALIZACJA', '150px', undefined, true, { dataType: 'date' }),
          ],
          view
        )}
      </Frame>
    );
  if (view === 'kpi-l2')
    return (
      <Frame
        title="Plant Balanced Scorecard — Zakład DBR77"
        subtitle="Zakład Tychy · 2026 · edycja 03 · rewizja 05.09.2026 · przygotowała Anna Kowalska"
        action="Dodaj miernik"
      >
        {/* K10 — przypięte kolumny.
            · `thead` dostaje NIEPRZEZROCZYSTE tło tokenem (`bg-c-surface-raised`,
              bez `backdrop-blur`), więc przypięte komórki nagłówka mają dokładnie
              ten sam kolor co reszta nagłówka i nic spod nich nie przebija;
            · komórki danych przypięte na `bg-c-surface` (kolor karty),
              wiersz grupy zostaje na `bg-c-surface-raised`;
            · OFFSETY `right` nie są już wpisane na sztywno (44/234 px — to była
              przyczyna nakładania: `columnFit` skalował kolumny i realna
              szerokość STAN/YTD przestawała się zgadzać). Liczy je `useEffect`
              z realnych `getBoundingClientRect()` po renderze. */}
        <div
          data-p7k-kpi-periods
          className="[&_thead]:!bg-c-surface-raised [&_thead]:!backdrop-blur-none [&_thead_th:last-child]:!bg-c-surface-raised [&_th]:whitespace-normal [&_th]:leading-tight [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-20 [&_th:first-child]:bg-c-surface-raised [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-10 [&_td:first-child]:bg-c-surface [&_tr.p7k-group-row_td:first-child]:!bg-c-surface-raised [&_th:nth-last-child(2)]:sticky [&_th:nth-last-child(2)]:z-20 [&_th:nth-last-child(2)]:bg-c-surface-raised [&_td:nth-last-child(2)]:sticky [&_td:nth-last-child(2)]:z-10 [&_td:nth-last-child(2)]:bg-c-surface [&_th:nth-last-child(3)]:sticky [&_th:nth-last-child(3)]:z-20 [&_th:nth-last-child(3)]:bg-c-surface-raised [&_td:nth-last-child(3)]:sticky [&_td:nth-last-child(3)]:z-10 [&_td:nth-last-child(3)]:bg-c-surface"
        >
          {table(
            kpiItems,
            [
              /**
               * MIERNIK = 324 px. Dwa powody, oba z pomiaru:
               *  · tresc: „Poziom przyjetych zamowien" POLGRUBYM ma 225 px
               *    (nie 188 — tamto byl pomiar zwyklej grubosci) + `px-4`x2 = 257;
               *  · GEOMETRIA ZAMROZONYCH KOLUMN: obszar przewijany to
               *    1374 (obszar tabeli na 1440) − 324 (MIERNIK) − 350 (YTD 140
               *    + STAN 130 + akcje 80) = 700 px = DOKLADNIE piec kolumn
               *    miesiecznych po 140 px. Bez tego jeden z konców przewijania
               *    zawsze wypada w POLOWIE miesiaca i albo spod MIERNIK wystaje
               *    ogon kolumny („…2026" bez nazwy), albo YTD przykrywa polowe
               *    GRU („GRU 202"). To bylo widac na zrzucie 1c/proba 1.
               * Kolumna pierwotna (`name`) jako jedyna zachowuje zadeklarowana
               * szerokosc takze w galezi podlog `columnFit`, wiec 324 px jest realne.
               */
              col('name', 'MIERNIK', '324px', (r) =>
                r.group ? (
                  <span className="flex items-center gap-3">
                    <b>{r.name}</b>
                    <span className="text-xs font-normal text-c-text-secondary">
                      {r.groupOwner}
                    </span>
                  </span>
                ) : (
                  <b className="block truncate" title={r.name}>
                    {r.name}
                  </b>
                )
              ),
              col('contract', 'KIERUNEK / JEDNOSTKA', '178px'),
              /* podłoga typu `text` = 140 px, więc 138 i tak zostałoby podniesione */
              col('cadence', 'CZĘSTOTLIWOŚĆ', '140px'),
              col('type', 'TYP', '140px'),
              col('owner', 'ODPOWIEDZIALNY', '144px'),
              col('benchmark', 'BENCHMARK', '110px', undefined, true, { dataType: 'number' }),
              col('limit', 'LIMIT %', '92px', undefined, true, { dataType: 'number' }),
              ...periodColumns,
              /* jak kolumny okresow: podloga `text` 140 px, bo tresc „Rezultat 94 810” ma 103 px */
              col('ytd', 'YTD', '140px', (r) => r.ytd),
              col('state', 'STAN', '132px', (r) => r.state, true, { dataType: 'status' }),
            ],
            view,
            (r) => ((r as any).group ? 'p7k-group-row bg-c-surface-raised font-semibold' : ''),
            /* Suma zadeklarowanych szerokości + 80 px kolumny akcji. Podana
               DOKŁADNIE, żeby `columnFit` nie skalował (skalowanie = rozjazd
               szerokości nagłówka i wierszy, czyli defekt K10). */
            KPI_L2_TABLE_WIDTH
          )}
        </div>
      </Frame>
    );
  if (view === 'kpi-l3')
    return (
      <Frame
        title="Wielkość sprzedaży netto"
        subtitle="Wyniki › KPI › Plant Balanced Scorecard — Zakład DBR77 › Wielkość sprzedaży netto · Krytyczne"
      >
        <CardShell
          sections={[
            'Wyniki',
            'Kontrakt',
            'Pomiary',
            'Odchylenia',
            'Działania',
            'Raporty',
            'Historia',
          ]}
          active="Odchylenia"
        >
          <Block title="Wyniki · sierpień 2026">
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div>
                CEL
                <br />
                <b className="whitespace-nowrap">12 400</b>
              </div>
              <div>
                Rezultat
                <br />
                <b className="whitespace-nowrap text-c-danger">11 620</b>
              </div>
              <div>
                Odchylenie
                <br />
                <b className="whitespace-nowrap text-c-danger">−6,3%</b>
              </div>
              <div>
                YTD
                <br />
                <b className="whitespace-nowrap">94 810 / 98 200</b>
              </div>
            </div>
          </Block>
          <Block title="Kontrakt miernika">
            <p className="text-xs text-c-text-secondary">
              Sprzedaż · ↑ min. · LC/1000 · miesiąc · rozliczeniowy · Tomasz Nowak · benchmark 12
              400 · limit 5%.
            </p>
          </Block>
          <Block title="Odchylenia i karty działania">
            {/* K13 — zdjęty `[&_th_span]:break-all`: to on łamał nagłówki
                w ŚRODKU wyrazu („OSIĄGNI ĘTY", „ODPOWIEDZIA LNY"). Nagłówki
                łamią się teraz wyłącznie na spacji (`break-normal` z warstwy
                `CELL_TEXT_CLAMP_CLASS` + `hyphens-none`), a szerokości kolumn
                pochodzą z pomiaru treści, więc daty, nazwiska i miesiące nie są
                ucinane. Tabela na całą szerokość karty (`-mx-4`) — inaczej
                siedem kolumn nie mieści się w 830 px bez ścisku. */}
            <div className="-mx-4 [&_th]:leading-tight [&_th]:hyphens-none [&_td]:leading-tight">
              {table(
                [
                  {
                    id: 'a1',
                    month: 'Sierpień 2026',
                    goal: 'Nie',
                    required: 'Tak',
                    problem: 'Sprzedaż krajowa poniżej planu',
                    cause: 'Opóźnienie dwóch uruchomień',
                    action: 'Plan odbiorów i wsparcie wdrożeń',
                    owner: 'Tomasz Nowak',
                    due: '18.09.2026',
                    comment: 'Powiązano z planem sprzedaży',
                    state: 'OTWARTY',
                  },
                ],
                [
                  /* Szerokości = zmierzona treść + `px-4`×2:
                     „Sierpień 2026" 91+32=123 · „Tomasz Nowak" 98+32=130
                     („ODPOWIEDZIALNY" ma podłogę nagłówka 144) ·
                     „18.09.2026" 73+32=105. Opisy zawijane do 2 linii. */
                  col('month', 'MIESIĄC', '124px', undefined, true, { dataType: 'date' }),
                  col('goal', 'CEL OSIĄGNIĘTY', '133px', undefined, true, { dataType: 'number' }),
                  col('problem', 'PROBLEM', '150px', undefined, true, { wrap: true }),
                  col('action', 'DZIAŁANIE', '150px', undefined, true, { wrap: true }),
                  /* `text` (podloga 140), nie `owner` (150) — tresc „Tomasz Nowak"
                     ma 130 px z paddingiem, a naglowek 144 px. */
                  col('owner', 'ODPOWIEDZIALNY', '144px', undefined, true),
                  col('due', 'TERMIN', '110px', undefined, true, { dataType: 'date' }),
                  /* 106 px: pill „OTWARTY” ma 73 px razem z obwodka + `px-4`x2 */
                  col('state', 'STATUS', '106px', (r) => status(r.state, 'bad'), true, {
                    dataType: 'number',
                  }),
                  col('cause', 'GŁÓWNA PRZYCZYNA', '180px', undefined, false, { wrap: true }),
                  col('required', 'DZIAŁANIA?', '120px', undefined, false, { dataType: 'number' }),
                  col('comment', 'KOMENTARZ', '180px', undefined, false, { wrap: true }),
                ],
                'kpi-actions',
                undefined,
                /* 124+133+150+150+144+110+106 = 917 przy obszarze 922 px
                   (karta na calej szerokosci przez `-mx-4`, lewa nawigacja 150,
                   prawy panel 270). Bez kolumny akcji (`showRowMenu=false`),
                   wiec tyle wynosi cala tabela — zero skalowania, zero uciec. */
                917,
                false
              )}
            </div>
          </Block>
        </CardShell>
      </Frame>
    );
  if (view === 'okr-l1')
    return (
      <Frame title="Raporty OKR" subtitle="Człowiek · zakres i cykl" action="Nowy raport">
        {table(
          reportsOkr,
          [
            /* Szerokosci z pomiaru: „Program automatyzacji" ma 149 px + `px-4`x2. */
            col('name', 'NAZWA', '250px'),
            col('scope', 'ZAKRES', '181px'),
            col('cycle', 'CYKL', '110px', undefined, true, { dataType: 'number' }),
            col('objectives', 'CELE', '90px', undefined, true, { dataType: 'number' }),
            col('results', 'REZULTATY', '105px', undefined, true, { dataType: 'number' }),
            /* K-1d: naglowek byl skrot-kodem „STAN · D / Z / K / B" — patrz
               komentarz przy analogicznej kolumnie w KPI L1. */
            col('state', 'STAN', '148px', (r) => <StateCounts value={r.state} />, true, {
              dataType: 'number',
            }),
            col('owners', 'WŁAŚCICIELE', '118px', undefined, true, { dataType: 'number' }),
            col('checkin', 'OSTATNI CHECK-IN', '148px', undefined, true, { dataType: 'date' }),
          ],
          view
        )}
      </Frame>
    );
  if (view === 'okr-l2')
    return (
      <Frame
        title="OKR zakładu — Q4 2026"
        subtitle="Zakład DBR77 · Q4 2026 · mierzalna zmiana operacyjna"
        action="Dodaj cel"
      >
        {/* K11 — zero nakładania. Zdjęte hacki `[&_th_span]:!overflow-visible`
            (to one pozwalały nagłówkom wyjść poza własną komórkę) i `!min-w-[1700px]`
            (tabela szersza niż obszar → `columnFit` ściskał kolumny i tekst
            wychodził na sąsiada). Zamiast tego: szerokości z POMIARU treści,
            teksty opisowe zawijane do 2 linii, a ZESPÓŁ i OSTATNI CHECK-IN
            schowane domyślnie w pstryczku kolumn — tak samo jak K4/K7 rozwiązały
            ten sam konflikt w ROI L1 i KPI L3. */}
        <div className="[&_th]:leading-tight">
          {table(
            okrItems,
            [
              col(
                'objective',
                'CEL',
                '210px',
                (r) =>
                  r.group ? (
                    <span className="flex items-center gap-3">
                      <b>{r.result}</b>
                      <span className="text-xs font-normal text-c-text-secondary">
                        {r.groupOwner}
                      </span>
                    </span>
                  ) : (
                    <div className="min-w-0">
                      <b className="line-clamp-2 break-normal" title={r.objective}>
                        {r.objective}
                      </b>
                      <div className="truncate text-[10px] text-c-text-muted">{r.ambition}</div>
                    </div>
                  ),
                true,
                { dataType: 'text' }
              ),
              col('result', 'KLUCZOWY REZULTAT', '270px', undefined, true, { wrap: true }),
              col('owner', 'WŁAŚCICIEL', '150px', undefined, true, { dataType: 'owner' }),
              col('values', 'START / CEL / BIEŻĄCA', '170px', undefined, true, {
                dataType: 'number',
              }),
              col('progress', 'POSTĘP', '100px', undefined, true, { dataType: 'number' }),
              col('confidence', 'PEWNOŚĆ', '130px', undefined, true, { dataType: 'status' }),
              col('deadline', 'TERMIN', '110px', undefined, true, { dataType: 'date' }),
              col('state', 'STAN', '140px', (r) => r.state, true, { dataType: 'status' }),
              col('team', 'ZESPÓŁ', '140px', undefined, false),
              col('checkin', 'OSTATNI CHECK-IN', '150px', undefined, false, { dataType: 'date' }),
            ],
            view,
            (r) => ((r as any).group ? 'p7k-group-row bg-c-surface-raised font-semibold' : '')
          )}
        </div>
      </Frame>
    );
  if (view === 'okr-l3')
    return (
      <Frame
        title="Skrócić przezbrojenia bez utraty jakości"
        subtitle="Wyniki › OKR › OKR zakładu — Q4 2026 › Skrócić przezbrojenia"
      >
        <CardShell
          sections={['Cel', 'Kluczowe rezultaty', 'Check-iny', 'Powiązania', 'Refleksja']}
          active="Kluczowe rezultaty"
        >
          <Block title="Cel">
            <p className="text-sm">Skrócić przezbrojenia bez utraty jakości</p>
            <p className="mt-1 text-xs text-c-text-secondary">
              Właściciel: Marek Zieliński · Zakład DBR77 · Q4 2026 · Zobowiązanie · pewność średnia
            </p>
          </Block>
          <Block title="Kluczowe rezultaty">
            <div className="space-y-3">
              {okrItems
                .filter((r) => !r.group && r.objective?.startsWith('Skrócić'))
                .map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-lg border border-c-border border-l-4 p-3 ${r.id === 'kr2' ? 'border-l-c-danger' : 'border-l-c-warning'}`}
                  >
                    <div className="flex justify-between">
                      <b className="text-sm">{r.result}</b>
                      {r.state}
                    </div>
                    <div className="mt-2 text-xs text-c-text-secondary">
                      {r.owner} · {r.team} · termin {r.deadline} · START / CEL / BIEŻĄCA: {r.values}{' '}
                      · postęp {r.progress} · pewność {r.confidence}
                    </div>
                    <button className="mt-3 rounded-lg border border-c-border px-3 py-1 text-xs">
                      Check-in
                    </button>
                  </div>
                ))}
            </div>
          </Block>
        </CardShell>
      </Frame>
    );
  if (view === 'roi-l1')
    return (
      <Frame
        title="Analizy ROI"
        subtitle="Inwestycje · ekonomika, ryzyko i rekomendacja"
        action="Nowa analiza"
      >
        {/* K12 — zdjęte `[&_td]:whitespace-nowrap`: to ono kazało każdej komórce
            zostać w jednej linii BEZ przycięcia, więc „Robotyzacja gniazda
            spawalniczego" kładło się na kolumnie PRZEDMIOT. NAZWA zawija do
            2 linii (opcja dopuszczona w K12), reszta ma szerokość z pomiaru. */}
        <div className="[&_th]:leading-tight">
          {table(
            roiRows,
            [
              col('name', 'NAZWA', '220px', undefined, true, { wrap: true }),
              col('subject', 'PRZEDMIOT', '130px', undefined, true, { dataType: 'status' }),
              col('option', 'WARIANT', '140px', undefined, true, { wrap: true }),
              col('capex', 'CAPEX', '116px', undefined, true, { dataType: 'number' }),
              col('benefit', 'ROCZNA KORZYŚĆ', '146px', undefined, true, { dataType: 'number' }),
              col('roi', 'ROI', '118px', undefined, true, { dataType: 'number' }),
              col('payback', 'PAYBACK', '96px', undefined, true, { dataType: 'number' }),
              col('recommendation', 'REKOMENDACJA', '172px', (r) => status(r.recommendation), true, {
                dataType: 'status',
              }),
              col('phase', 'FAZA', '130px', undefined, true, { dataType: 'status' }),
              col('npv', 'NPV', '130px', undefined, false, { dataType: 'number' }),
              col('irr', 'IRR', '100px', undefined, false, { dataType: 'number' }),
            ],
            view
          )}
        </div>
      </Frame>
    );
  return (
    <Frame
      title="Robotyzacja gniazda spawalniczego"
      subtitle="Wyniki › ROI › Robotyzacja gniazda spawalniczego · wariant 2 · 5 lat · CONDITIONAL GO"
    >
      <CardShell sections={['Założenia', 'Wyliczenia', 'Realizacja']} active="Realizacja">
        <Block title="Założenia">
          <p className="text-xs text-c-text-secondary">
            Problem: niestabilna wydajność i brak operatorów · BAU: 10 dodatkowych FTE w 2 lata ·
            CAPEX 1 000 000 zł z contingency 10% · ΔNWC 80 000 zł · korzyści Hard/Avoided oddzielnie
            · OEE 62→72% → przepustowość → marża → cash flow.
          </p>
        </Block>
        <Block title="Wyliczenia">
          <div className="grid grid-cols-5 gap-3 text-xs">
            <div>
              ROI 5Y
              <br />
              <b>100%</b>
            </div>
            <div>
              PP
              <br />
              <b>2,5 roku</b>
            </div>
            <div>
              NPV
              <br />
              <b>516 315 zł</b>
            </div>
            <div>
              IRR
              <br />
              <b>28,7%</b>
            </div>
            <div>
              PI / BCR
              <br />
              <b>1,52 / 1,39</b>
            </div>
          </div>
          <p className="mt-3 text-xs text-c-text-secondary">
            Scenariusze: Conservative / Base / Upside · wrażliwość ±20% · rekomendacja CONDITIONAL
            GO.
          </p>
        </Block>
        <Block title="Realizacja · przegląd po 6 miesiącach">
          {table(
            [
              {
                id: 'r1',
                metric: 'CAPEX',
                expected: '1 000 000 zł',
                actual: '1 080 000 zł',
                variance: '+80 000 zł',
              },
              { id: 'r2', metric: 'Output', expected: '+15%', actual: '+11%', variance: '−4 pp' },
              {
                id: 'r3',
                metric: 'FTE saving',
                expected: '10 FTE',
                actual: '7 FTE',
                variance: '−3 FTE',
              },
              {
                id: 'r4',
                metric: 'Roczna korzyść',
                expected: '400 000 zł',
                actual: '312 000 zł',
                variance: '−88 000 zł',
              },
              {
                id: 'r5',
                metric: 'Payback',
                expected: '2,5 roku',
                actual: '3,46 roku',
                variance: '+0,96 roku',
              },
            ],
            [
              col('metric', 'KPI / KORZYŚĆ', '180px'),
              col('expected', 'EXPECTED'),
              col('actual', 'ACTUAL'),
              col('variance', 'WARIANCJA', '160px', (r) => (
                <span className="font-semibold text-c-danger">{r.variance}</span>
              )),
            ],
            'roi-pir'
          )}
        </Block>
        <Block title="Prawdziwość założeń i ROI po realizacji">
          <p className="text-xs text-c-text-secondary">
            Popyt: potwierdzone · redukcja FTE: częściowo potwierdzona — przesunięto 7 z 10 etatów ·
            ramp-up: obalone — trwał 14 zamiast 8 tygodni. ROI po realizacji 5Y: 44% · NPV: 118 400
            zł · rekomendacja: korekta planu korzyści.
          </p>
        </Block>
      </CardShell>
    </Frame>
  );
}

export default Content;
