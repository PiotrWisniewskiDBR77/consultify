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
  <div className="min-w-[108px] whitespace-nowrap text-right tabular-nums">
    <div className="whitespace-nowrap text-[10px] text-c-text-muted">CEL&nbsp; {target}</div>
    <div
      className={`whitespace-nowrap ${tone === 'bad' ? 'font-semibold text-c-danger' : tone === 'warn' ? 'font-semibold text-c-warning' : 'font-medium text-c-text'}`}
    >
      Rezultat&nbsp; {actual}
    </div>
  </div>
);

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

const col = (
  id: string,
  label: string,
  width = '140px',
  render?: (row: any) => React.ReactNode,
  defaultVisible = true
): TableColumn => ({
  id,
  label,
  width,
  defaultVisible,
  render:
    render ||
    ((r: any) => (
      <span className="whitespace-nowrap text-sm text-c-text-secondary">{r[id] ?? ''}</span>
    )),
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
    persistKey={`p7k.prototype.1b.${key}`}
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
  col(`period-${index + 1}`, `${label} 2026`, '132px', (row) => {
    if (row.group) return null;
    if (index === 6) return row.jul;
    if (index === 7) return row.aug;
    if (index === 8) return row.sep;
    return (
      <Pair
        target={index < 8 ? (row.id === 'k3' ? '76%' : '11 400') : '—'}
        actual={index < 8 ? (row.id === 'k3' ? '77%' : '11 520') : '—'}
      />
    );
  })
);

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
  <div className="grid grid-cols-[178px_minmax(0,1fr)_300px] gap-4">
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
      }
      for (let i = 1; i < cells.length; i += 1) cells[i]!.style.display = 'none';
    });
    const scroller = document.querySelector<HTMLElement>('[data-p7k-kpi-periods] .overflow-x-auto');
    if (scroller) {
      scroller.scrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth - 330);
      document
        .querySelectorAll<HTMLElement>('[data-p7k-kpi-periods] tr.p7k-group-row td:first-child > *')
        .forEach((content) => {
          content.style.transform = `translateX(${scroller.scrollLeft}px)`;
          content.style.width = `${scroller.clientWidth - 32}px`;
        });
    }
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
            col('name', 'NAZWA RAPORTU', '260px'),
            col('scope', 'ZAKRES'),
            col('period', 'OKRES'),
            col('count', 'MIERNIKI', '90px'),
            col('state', 'STAN · norma / ostrz. / kryt. / brak', '220px'),
            col('actions', 'OTWARTE DZIAŁANIA'),
            col('owner', 'PRZYGOTOWAŁ'),
            col('updated', 'AKTUALIZACJA'),
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
        <div
          data-p7k-kpi-periods
          className="[&_table]:!min-w-[3000px] [&_th]:whitespace-normal [&_th]:leading-tight [&_td]:whitespace-nowrap [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-20 [&_th:first-child]:bg-c-surface [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-10 [&_td:first-child]:bg-c-surface [&_th:nth-last-child(2)]:sticky [&_th:nth-last-child(2)]:right-[44px] [&_th:nth-last-child(2)]:z-20 [&_th:nth-last-child(2)]:bg-c-surface [&_td:nth-last-child(2)]:sticky [&_td:nth-last-child(2)]:right-[44px] [&_td:nth-last-child(2)]:z-10 [&_td:nth-last-child(2)]:bg-c-surface [&_th:nth-last-child(3)]:sticky [&_th:nth-last-child(3)]:right-[234px] [&_th:nth-last-child(3)]:z-20 [&_th:nth-last-child(3)]:bg-c-surface [&_td:nth-last-child(3)]:sticky [&_td:nth-last-child(3)]:right-[234px] [&_td:nth-last-child(3)]:z-10 [&_td:nth-last-child(3)]:bg-c-surface"
        >
          {table(
            kpiItems,
            [
              col('name', 'MIERNIK', '260px', (r) =>
                r.group ? (
                  <span className="flex items-center gap-3">
                    <b>{r.name}</b>
                    <span className="text-xs font-normal text-c-text-secondary">
                      {r.groupOwner}
                    </span>
                  </span>
                ) : (
                  <b className="whitespace-nowrap">{r.name}</b>
                )
              ),
              col('contract', 'KIERUNEK / JEDNOSTKA', '170px'),
              col('cadence', 'CZĘSTOTLIWOŚĆ', '150px'),
              col('type', 'TYP', '140px'),
              col('owner', 'ODPOWIEDZIALNY', '170px'),
              col('benchmark', 'BENCHMARK', '130px'),
              col('limit', 'LIMIT %', '100px'),
              ...periodColumns,
              col('ytd', 'YTD', '190px', (r) => r.ytd),
              col('state', 'STAN', '190px', (r) => r.state),
            ],
            view,
            (r) => ((r as any).group ? 'p7k-group-row bg-c-surface-raised font-semibold' : ''),
            3000
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
            <div className="[&_th_span]:!whitespace-normal [&_th_span]:!overflow-visible [&_th_span]:!text-clip [&_th_span]:break-all [&_th]:leading-tight [&_td]:leading-tight [&_td>div]:line-clamp-2">
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
                  col('month', 'MIESIĄC', '95px'),
                  col('goal', 'CEL OSIĄGNIĘTY', '110px'),
                  col('problem', 'PROBLEM', '145px', (r) => <div>{r.problem}</div>),
                  col('action', 'DZIAŁANIE', '150px', (r) => <div>{r.action}</div>),
                  col('owner', 'ODPOWIEDZIALNY', '120px'),
                  col('due', 'TERMIN', '95px'),
                  col('state', 'STATUS', '110px', (r) => status(r.state, 'bad')),
                  col('cause', 'GŁÓWNA PRZYCZYNA', '180px', undefined, false),
                  col('required', 'DZIAŁANIA?', '120px', undefined, false),
                  col('comment', 'KOMENTARZ', '180px', undefined, false),
                ],
                'kpi-actions',
                undefined,
                830,
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
            col('name', 'NAZWA', '250px'),
            col('scope', 'ZAKRES'),
            col('cycle', 'CYKL'),
            col('objectives', 'CELE'),
            col('results', 'REZULTATY'),
            col('state', 'STAN · droga / zagroż. / kryt. / brak', '230px'),
            col('owners', 'WŁAŚCICIELE'),
            col('checkin', 'OSTATNI CHECK-IN'),
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
        <div className="[&_table]:!min-w-[1700px] [&_th_span]:!whitespace-normal [&_th_span]:!overflow-visible [&_th_span]:!text-clip [&_th]:leading-tight">
          {table(
            okrItems,
            [
              col('objective', 'CEL', '250px', (r) =>
                r.group ? (
                  <span className="flex items-center gap-3">
                    <b>{r.result}</b>
                    <span className="text-xs font-normal text-c-text-secondary">
                      {r.groupOwner}
                    </span>
                  </span>
                ) : (
                  <div>
                    <b>{r.objective}</b>
                    <div className="text-[10px] text-c-text-muted">{r.ambition}</div>
                  </div>
                )
              ),
              col('result', 'KLUCZOWY REZULTAT', '280px'),
              col('owner', 'WŁAŚCICIEL', '150px'),
              col('team', 'ZESPÓŁ', '130px'),
              col('values', 'START / CEL / BIEŻĄCA', '180px'),
              col('progress', 'POSTĘP', '100px'),
              col('confidence', 'PEWNOŚĆ', '120px'),
              col('deadline', 'TERMIN', '130px'),
              col('checkin', 'OSTATNI CHECK-IN', '170px'),
              col('state', 'STAN', '160px', (r) => r.state),
            ],
            view,
            (r) => ((r as any).group ? 'p7k-group-row bg-c-surface-raised font-semibold' : ''),
            1700
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
        <div className="[&_th]:whitespace-normal [&_th]:leading-tight [&_td]:whitespace-nowrap">
          {table(
            roiRows,
            [
              col('name', 'NAZWA', '240px'),
              col('subject', 'PRZEDMIOT', '130px'),
              col('option', 'WARIANT', '180px'),
              col('capex', 'CAPEX', '140px'),
              col('benefit', 'ROCZNA KORZYŚĆ', '165px'),
              col('roi', 'ROI', '120px'),
              col('payback', 'PAYBACK', '120px'),
              col('recommendation', 'REKOMENDACJA', '170px', (r) => status(r.recommendation)),
              col('phase', 'FAZA', '120px'),
              col('npv', 'NPV', '130px', undefined, false),
              col('irr', 'IRR', '100px', undefined, false),
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
