/**
 * P-01 (28.07, zgłoszenie Piotra) — dev-render host dla prawego panelu
 * Deck Buildera (ExecutiveModuleShell → `RightRail`).
 *
 * ★ WAŻNE — ten harness NIE POKAZUJE poprawki wdrożonej w kodzie
 * produkcyjnym. Robotnik zbadał zgłoszenie i ustalił, że jedyne miejsce,
 * w którym da się faktycznie naprawić zachowanie „prawy panel znika do
 * 4-pikselowego paska", to:
 *
 *     src/components/shared/ExecutiveModuleShell/RightRail.tsx (linie 139-160)
 *
 * — czyli PLIK JEST W GRANICACH ZAKAZU tego zgłoszenia („NIE DOTYKAJ
 * .../ExecutiveModuleShell/**" — równolegle trwa tam praca nad menu „Plik").
 * Zgodnie z instrukcją zgłoszenia („jeśli poprawka wymagałaby wejścia w te
 * pliki — ZATRZYMAJ SIĘ i napisz to w raporcie") ROBOTNIK NIE EDYTOWAŁ
 * ŻADNEGO pliku produkcyjnego. Ten harness pokazuje:
 *
 *   Lewa kolumna „DZIŚ (na żywo, zepsute)"  — REALNY import `<RightRail>`
 *     z src/components/shared/ExecutiveModuleShell/RightRail.tsx, z
 *     deskryptorami narzędzi 1:1 jak w Deck Builderze
 *     (`buildDeckBuilderRightRailTools`). Stanowe (useState) — przycisk
 *     „Zwiń / Rozwiń" faktycznie przełącza stan, więc widać żywy błąd:
 *     po zwinięciu zostaje 16px pasek z jedną strzałką, ikony znikają.
 *
 *   Prawa kolumna „PROPOZYCJA (mock, kod NIE wdrożony)" — lokalna kopia
 *     `RightRail` z jedną zmianą: gałąź `collapsed` renderuje TĘ SAMĄ
 *     56px szynę ikon zamiast 16px paska; kliknięcie ikony w stanie
 *     zwiniętym jednocześnie otwiera panel (uchwyt rozwijania „siedzi na
 *     szynie", nie jest osobnym cienkim paskiem). Też stanowe.
 *
 * Precedens (IDEE) — WAŻNA KOREKTA do zgłoszenia: „my o tym rozmawialiśmy
 * przy Ideach" NIE oznacza, że Idee mają OSOBNY, już-poprawny wzorzec do
 * skopiowania. `IdeaCanvasMelsView.tsx` (Mind Map/Process Flow/Whiteboard/
 * Idea Table) montuje DOKŁADNIE TEN SAM `<EditorShell>`/`<RightRail>` co
 * Deck Builder (`DeckBuilderMelsView.tsx`) i Document Studio
 * (`DocumentStudioDocumentPanel.tsx`, moduleKey="document-studio") —
 * jeden współdzielony komponent, jedna wspólna choroba, wszystkie 4
 * miejsca dotknięte identycznie. Rozmowa „przy Ideach" ustaliła WYMAGANIE
 * (ikony mają być zawsze widoczne), ale nigdy nie weszła do kodu
 * `RightRail.tsx` — więc nie ma z czego „ukraść" gotowej, innej
 * implementacji; trzeba naprawić WSPÓLNY plik raz.
 *
 *   ?screen=prawy-panel-szyna-ikon            → light
 *   ?screen=prawy-panel-szyna-ikon&theme=dark → dark
 */
import { Activity, ChevronLeft, ChevronRight, Link2, MessageSquare, LayoutGrid } from 'lucide-react';
import React, { useState } from 'react';

import {
  RightRail,
  type RightRailToolDescriptor,
} from '../../src/components/shared/ExecutiveModuleShell/RightRail';
import { useAppStore } from '../../src/store/useAppStore';

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

// Deskryptory narzędzi 1:1 jak `buildDeckBuilderRightRailTools` (Deck Builder,
// Prezentacje) — patrz src/components/Presentations/DeckBuilder/DeckBuilderMelsRightRail.tsx
function buildDemoTools(): RightRailToolDescriptor[] {
  return [
    { id: 'blocks', label: 'Blocks', icon: LayoutGrid },
    { id: 'comments', label: 'Comments', icon: MessageSquare, badge: 3 },
    { id: 'activity', label: 'Activity', icon: Activity, dotTone: 'info' },
    { id: 'relations', label: 'Relations', icon: Link2 },
  ];
}

const PANEL_LABEL: Record<string, string> = {
  blocks: 'Panel: Blocks (wstawianie sekcji/mediów)',
  comments: 'Panel: Comments (wątki komentarzy slajdu)',
  activity: 'Panel: Activity (log agenta Teresy)',
  relations: 'Panel: Relations (powiązane inicjatywy/insighty)',
};

const DemoPanelContent: React.FC<{ toolId: string }> = ({ toolId }) => (
  <div className="p-4 text-sm text-c-text-secondary">
    <p className="font-semibold text-c-text mb-2">{PANEL_LABEL[toolId] ?? toolId}</p>
    <p>Treść panelu (mock) — w produkcji renderuje ją Deck Builder per aktywne narzędzie.</p>
  </div>
);

/* ------------------------------------------------------------------------ *
 * PROPOZYCJA — lokalna kopia RightRail z jedną zmianą w gałęzi `collapsed`.
 * NIE jest importem z src/ — to świadomie osobna kopia w harnessie, żeby
 * NIE dotykać pliku produkcyjnego objętego zakazem tego zgłoszenia.
 * ------------------------------------------------------------------------ */
const ICON_STRIP_WIDTH = 56;

const DOT_TONE_CLASS: Record<string, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-danger-500',
  info: 'bg-sky-500',
};

const ProposedToolIcon: React.FC<{
  tool: RightRailToolDescriptor;
  active: boolean;
  onClick: () => void;
}> = ({ tool, active, onClick }) => {
  const { icon: Icon, label, disabled, badge, dotTone, id } = tool;
  const baseClasses =
    'relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors';
  const stateClasses = active
    ? 'bg-c-focus/10 text-c-focus-solid'
    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 hover:text-slate-700 dark:hover:text-slate-200';
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`${baseClasses} ${stateClasses} disabled:opacity-40 disabled:cursor-not-allowed`}
      data-testid={`proposed-right-rail-tool-${id}`}
    >
      <Icon size={16} aria-hidden="true" />
      {dotTone ? (
        <span
          aria-hidden="true"
          className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${DOT_TONE_CLASS[dotTone]}`}
        />
      ) : null}
      {badge !== undefined && badge !== null ? (
        <span
          className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 text-[10px] leading-4 font-medium text-white bg-danger-500 rounded-full text-center"
          aria-hidden="true"
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
};

const ProposedRightRail: React.FC<{
  tools: RightRailToolDescriptor[];
  activeToolId: string | null;
  onSelectTool: (id: string | null) => void;
  panelContent?: React.ReactNode;
  panelWidth: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
}> = ({ tools, activeToolId, onSelectTool, panelContent, panelWidth, collapsed, onToggleCollapse }) => {
  const activeTool = activeToolId ? (tools.find((t) => t.id === activeToolId) ?? null) : null;
  const showPanel = !collapsed && Boolean(activeTool) && Boolean(panelContent);

  // JEDYNA ISTOTNA ZMIANA vs oryginał: gałąź `collapsed` renderuje TĘ SAMĄ
  // 56px szynę ikon (nie 16px pasek). Uchwyt zwijania/rozwijania jest
  // PIERWSZYM elementem szyny — zawsze w tym samym, wygodnym polu 40x40.
  // Kliknięcie ikony narzędzia w stanie zwiniętym wybiera narzędzie I
  // rozwija panel jednym gestem (bez potrzeby trafiania osobno w uchwyt).
  const iconStrip = (
    <div
      className="flex flex-col items-center py-2 gap-1"
      style={{ width: ICON_STRIP_WIDTH }}
      data-testid="proposed-right-rail-strip"
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 mb-1"
        title={collapsed ? 'Rozwiń prawy panel' : 'Zwiń prawy panel'}
        aria-label={collapsed ? 'Rozwiń prawy panel' : 'Zwiń prawy panel'}
        aria-expanded={!collapsed}
        data-testid="proposed-right-rail-toggle"
      >
        {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
      {tools.map((tool) => (
        <ProposedToolIcon
          key={tool.id}
          tool={tool}
          active={tool.id === activeToolId}
          onClick={() => {
            const nextId = tool.id === activeToolId && !collapsed ? null : tool.id;
            onSelectTool(nextId);
            if (collapsed && nextId) onToggleCollapse();
          }}
        />
      ))}
    </div>
  );

  const containerWidth = ICON_STRIP_WIDTH + (showPanel ? panelWidth : 0);

  return (
    <aside
      className="flex-shrink-0 border-l border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex h-full transition-[width] duration-150"
      style={{ width: containerWidth }}
      data-testid="proposed-right-rail"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      {showPanel ? (
        <div
          className="relative border-r border-slate-200 dark:border-navy-700 overflow-hidden flex flex-col"
          style={{ width: panelWidth }}
          data-testid="proposed-right-rail-panel"
        >
          {panelContent}
        </div>
      ) : null}
      {iconStrip}
    </aside>
  );
};

/* ------------------------------------------------------------------------ */

const ColumnFrame: React.FC<{ title: string; note: string; children: React.ReactNode }> = ({
  title,
  note,
  children,
}) => (
  <div className="flex-1 min-w-0 flex flex-col">
    <div className="px-4 py-3 border-b border-c-border-subtle">
      <h2 className="text-sm font-semibold text-c-text">{title}</h2>
      <p className="text-xs text-c-text-muted mt-0.5">{note}</p>
    </div>
    <div className="flex-1 min-h-0 flex bg-slate-50 dark:bg-navy-950 relative">{children}</div>
  </div>
);

export function PrawyPanelSzynaIkonScreen(): React.ReactElement {
  const tools = buildDemoTools();

  // Kolumna DZIŚ — realny <RightRail>, stanowe.
  const [todayCollapsed, setTodayCollapsed] = useState(false);
  const [todayActiveId, setTodayActiveId] = useState<string | null>('blocks');

  // Kolumna PROPOZYCJA — mock <ProposedRightRail>, stanowe.
  const [proposedCollapsed, setProposedCollapsed] = useState(false);
  const [proposedActiveId, setProposedActiveId] = useState<string | null>('blocks');

  return (
    <div className="h-screen w-screen flex flex-col bg-c-surface" data-testid="p01-harness-root">
      <div className="px-4 py-3 border-b border-c-border-subtle">
        <h1 className="text-base font-semibold text-c-text">
          P-01 — Prawy panel Deck Builder: szyna ikon vs pasek 16px
        </h1>
        <p className="text-xs text-c-text-muted mt-1 max-w-3xl">
          Lewa kolumna = REALNY komponent produkcyjny (
          <code>src/components/shared/ExecutiveModuleShell/RightRail.tsx</code>), dziś zepsuty —
          kliknij „Zwiń", żeby zobaczyć błąd Piotra (16px pasek, brak ikon). Prawa kolumna = mock
          proponowanej naprawy (kod NIE wdrożony — plik jest poza granicami tego zgłoszenia,
          równolegle trwa tam praca nad menu „Plik"). Kliknij „Zwiń" po prawej, żeby zobaczyć że
          szyna 5(4) ikon zostaje zawsze widoczna.
        </p>
      </div>
      <div className="flex-1 min-h-0 flex divide-x divide-c-border-subtle">
        <ColumnFrame
          title="DZIŚ (na żywo, zepsute)"
          note={`collapsed=${todayCollapsed ? 'true' : 'false'} — stan zapisywany jak dziś (localStorage mels.rail.*)`}
        >
          <div className="flex-1 min-w-0 flex flex-col items-start justify-start p-4 gap-2">
            <button
              type="button"
              onClick={() => setTodayCollapsed((v) => !v)}
              className="px-3 py-1.5 rounded-md border border-c-border-subtle text-xs font-medium text-c-text bg-c-surface hover:bg-c-surface-raised"
              data-testid="today-external-toggle"
            >
              {todayCollapsed ? 'Rozwiń (spoza panelu)' : 'Zwiń (spoza panelu)'}
            </button>
            <p className="text-[11px] text-c-text-muted">
              (przycisk pomocniczy do testu — w produkcji jedyny sposób zwinięcia to strzałka na
              samej szynie, ta sama, która potem znika)
            </p>
          </div>
          <RightRail
            tools={tools}
            activeToolId={todayActiveId}
            onSelectTool={setTodayActiveId}
            panelContent={
              todayActiveId ? <DemoPanelContent toolId={todayActiveId} /> : undefined
            }
            panelWidth={320}
            collapsed={todayCollapsed}
            onToggleCollapse={() => setTodayCollapsed((v) => !v)}
            collapseLabel={todayCollapsed ? 'Rozwiń prawy panel' : 'Zwiń prawy panel'}
          />
        </ColumnFrame>

        <ColumnFrame
          title="PROPOZYCJA (mock, kod NIE wdrożony)"
          note={`collapsed=${proposedCollapsed ? 'true' : 'false'} — szyna ikon ZAWSZE widoczna, uchwyt na szynie`}
        >
          <div className="flex-1 min-w-0 flex flex-col items-start justify-start p-4 gap-2">
            <button
              type="button"
              onClick={() => setProposedCollapsed((v) => !v)}
              className="px-3 py-1.5 rounded-md border border-c-border-subtle text-xs font-medium text-c-text bg-c-surface hover:bg-c-surface-raised"
              data-testid="proposed-external-toggle"
            >
              {proposedCollapsed ? 'Rozwiń (spoza panelu)' : 'Zwiń (spoza panelu)'}
            </button>
          </div>
          <ProposedRightRail
            tools={tools}
            activeToolId={proposedActiveId}
            onSelectTool={setProposedActiveId}
            panelContent={
              proposedActiveId ? <DemoPanelContent toolId={proposedActiveId} /> : undefined
            }
            panelWidth={320}
            collapsed={proposedCollapsed}
            onToggleCollapse={() => setProposedCollapsed((v) => !v)}
          />
        </ColumnFrame>
      </div>
    </div>
  );
}

export default PrawyPanelSzynaIkonScreen;
