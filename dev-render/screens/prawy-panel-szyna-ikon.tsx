/**
 * P-01 (28.07, zgłoszenie Piotra) — dev-render host dla prawego panelu
 * Deck Buildera (ExecutiveModuleShell → `RightRail`).
 *
 * STATUS: NAPRAWIONE w kodzie produkcyjnym —
 * `src/components/shared/ExecutiveModuleShell/RightRail.tsx` — patrz plik,
 * gałąź `collapsed` (usunięty 16px pasek, 56px szyna ikon jest teraz
 * BEZWARUNKOWA). Zakaz edycji `ExecutiveModuleShell/**` został zdjęty przez
 * koordynatora sesji 28.07 (robotnik menu „Plik" oddał gałąź
 * `feat/menu-pliku-dokumentu`, nie dotyka `RightRail.tsx` — brak konfliktu).
 *
 * Ten harness pokazuje PRZED/PO:
 *
 *   Lewa kolumna „PRZED (zamrożona kopia starego zachowania)" — lokalna
 *     kopia DAWNEJ implementacji `RightRail` (ta sprzed naprawy — 16px
 *     pasek z jedną strzałką, bez ikon narzędzi w stanie zwiniętym).
 *     ŚWIADOMIE zamrożona (nie jest importem z src/, bo produkcyjny plik
 *     już nie ma tego kodu) — istnieje WYŁĄCZNIE do porównania wizualnego
 *     z tym, jak wyglądał błąd Piotra.
 *
 *   Prawa kolumna „PO (na żywo, REALNY <RightRail>)" — REALNY import
 *     `<RightRail>` z src/components/shared/ExecutiveModuleShell/RightRail.tsx
 *     (dokładnie ten sam plik, który renderuje dziś Deck Builder/Document
 *     Studio/Tabele/Excel/4 canvasy Idei). Stanowe — przycisk „Zwiń"
 *     faktycznie przełącza stan i pokazuje żywy, naprawiony wynik: po
 *     zwinięciu 56px szyna ikon zostaje, klik ikony rozwija panel.
 *
 * Precedens (IDEE) — korekta ustalona podczas diagnozy: „my o tym
 * rozmawialiśmy przy Ideach" NIE oznaczało gotowego wzorca do skopiowania.
 * `IdeaCanvasMelsView.tsx` (Mind Map/Process Flow/Whiteboard/Idea Table)
 * montuje DOKŁADNIE TEN SAM `<EditorShell>`/`<RightRail>` co Deck Builder,
 * Document Studio i Tabele/Excel — jeden współdzielony komponent, jedna
 * wspólna choroba. Naprawa tego jednego pliku naprawia wszystkie te
 * ekrany naraz (pełna lista plik:linia w raporcie sesji P-01).
 *
 *   ?screen=prawy-panel-szyna-ikon            → light
 *   ?screen=prawy-panel-szyna-ikon&theme=dark → dark
 */
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Link2,
  MessageSquare,
} from 'lucide-react';
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
 * PRZED — ZAMROŻONA kopia implementacji `RightRail` SPRZED naprawy P-01.
 * NIE jest importem z src/ (ten kod już tam nie istnieje po naprawie) —
 * trzymana tu WYŁĄCZNIE do porównania wizualnego z tym, jak wyglądał błąd
 * zgłoszony przez Piotra (16px pasek, brak ikon w stanie zwiniętym).
 * ------------------------------------------------------------------------ */
const ICON_STRIP_WIDTH = 56;

const DOT_TONE_CLASS: Record<string, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-danger-500',
  info: 'bg-sky-500',
};

const LegacyToolIcon: React.FC<{
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
      data-testid={`legacy-right-rail-tool-${id}`}
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

/** Zamrożona kopia RightRail SPRZED P-01 — gałąź `collapsed` = 16px pasek. */
const LegacyBrokenRightRail: React.FC<{
  tools: RightRailToolDescriptor[];
  activeToolId: string | null;
  onSelectTool: (id: string | null) => void;
  panelContent?: React.ReactNode;
  panelWidth: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
}> = ({
  tools,
  activeToolId,
  onSelectTool,
  panelContent,
  panelWidth,
  collapsed,
  onToggleCollapse,
}) => {
  const activeTool = activeToolId ? (tools.find((t) => t.id === activeToolId) ?? null) : null;
  const showPanel = !collapsed && Boolean(activeTool) && Boolean(panelContent);

  if (collapsed) {
    return (
      <aside
        className="flex-shrink-0 border-l border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex flex-col items-center py-2 transition-[width] duration-150"
        style={{ width: 16 }}
        data-testid="legacy-right-rail"
        data-collapsed="true"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800"
          title="Rozwiń prawy panel"
          aria-label="Rozwiń prawy panel"
          aria-expanded={false}
          data-testid="legacy-right-rail-toggle"
        >
          <ChevronLeft size={14} />
        </button>
      </aside>
    );
  }

  const containerWidth = ICON_STRIP_WIDTH + (showPanel ? panelWidth : 0);

  return (
    <aside
      className="flex-shrink-0 border-l border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex h-full transition-[width] duration-150"
      style={{ width: containerWidth }}
      data-testid="legacy-right-rail"
      data-collapsed="false"
    >
      {showPanel ? (
        <div
          className="relative border-r border-slate-200 dark:border-navy-700 overflow-hidden flex flex-col"
          style={{ width: panelWidth }}
          data-testid="legacy-right-rail-panel"
        >
          {panelContent}
        </div>
      ) : null}
      <div
        className="flex flex-col items-center py-2 gap-1"
        style={{ width: ICON_STRIP_WIDTH }}
        data-testid="legacy-right-rail-strip"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 mb-1"
          title="Zwiń prawy panel"
          aria-label="Zwiń prawy panel"
          aria-expanded
          data-testid="legacy-right-rail-toggle"
        >
          <ChevronRight size={14} />
        </button>
        {tools.map((tool) => (
          <LegacyToolIcon
            key={tool.id}
            tool={tool}
            active={tool.id === activeToolId}
            onClick={() => onSelectTool(tool.id === activeToolId ? null : tool.id)}
          />
        ))}
      </div>
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

  // Kolumna PRZED — zamrożona kopia starego (zepsutego) zachowania, stanowe.
  const [legacyCollapsed, setLegacyCollapsed] = useState(false);
  const [legacyActiveId, setLegacyActiveId] = useState<string | null>('blocks');

  // Kolumna PO — REALNY <RightRail> z src/ (naprawiony), stanowe.
  const [fixedCollapsed, setFixedCollapsed] = useState(false);
  const [fixedActiveId, setFixedActiveId] = useState<string | null>('blocks');

  return (
    <div className="h-screen w-screen flex flex-col bg-c-surface" data-testid="p01-harness-root">
      <div className="px-4 py-3 border-b border-c-border-subtle">
        <h1 className="text-base font-semibold text-c-text">
          P-01 — Prawy panel Deck Builder: NAPRAWIONE (szyna ikon vs stary pasek 16px)
        </h1>
        <p className="text-xs text-c-text-muted mt-1 max-w-3xl">
          Lewa kolumna = zamrożona kopia STAREGO zachowania (kod już nie istnieje w src/, trzymany
          tu tylko do porównania — tak wyglądał błąd Piotra). Prawa kolumna = REALNY, na żywo
          zaimportowany <code>src/components/shared/ExecutiveModuleShell/RightRail.tsx</code> —
          dokładnie ten plik, który dziś renderuje Deck Builder/Document Studio/Tabele/Excel/Idee.
          Kliknij „Zwiń" po obu stronach, żeby zobaczyć różnicę.
        </p>
      </div>
      <div className="flex-1 min-h-0 flex divide-x divide-c-border-subtle">
        <ColumnFrame
          title="PRZED (zamrożona kopia starego zachowania)"
          note={`collapsed=${legacyCollapsed ? 'true' : 'false'} — tak wyglądał błąd Piotra`}
        >
          <div className="flex-1 min-w-0 flex flex-col items-start justify-start p-4 gap-2">
            <button
              type="button"
              onClick={() => setLegacyCollapsed((v) => !v)}
              className="px-3 py-1.5 rounded-md border border-c-border-subtle text-xs font-medium text-c-text bg-c-surface hover:bg-c-surface-raised"
              data-testid="legacy-external-toggle"
            >
              {legacyCollapsed ? 'Rozwiń (spoza panelu)' : 'Zwiń (spoza panelu)'}
            </button>
            <p className="text-[11px] text-c-text-muted">
              (przycisk pomocniczy do testu — w starej wersji jedyny sposób zwinięcia to strzałka na
              samej szynie, ta sama, która potem znikała)
            </p>
          </div>
          <LegacyBrokenRightRail
            tools={tools}
            activeToolId={legacyActiveId}
            onSelectTool={setLegacyActiveId}
            panelContent={legacyActiveId ? <DemoPanelContent toolId={legacyActiveId} /> : undefined}
            panelWidth={320}
            collapsed={legacyCollapsed}
            onToggleCollapse={() => setLegacyCollapsed((v) => !v)}
          />
        </ColumnFrame>

        <ColumnFrame
          title="PO (na żywo, REALNY <RightRail> naprawiony)"
          note={`collapsed=${fixedCollapsed ? 'true' : 'false'} — szyna ikon ZAWSZE widoczna, uchwyt na szynie`}
        >
          <div className="flex-1 min-w-0 flex flex-col items-start justify-start p-4 gap-2">
            <button
              type="button"
              onClick={() => setFixedCollapsed((v) => !v)}
              className="px-3 py-1.5 rounded-md border border-c-border-subtle text-xs font-medium text-c-text bg-c-surface hover:bg-c-surface-raised"
              data-testid="fixed-external-toggle"
            >
              {fixedCollapsed ? 'Rozwiń (spoza panelu)' : 'Zwiń (spoza panelu)'}
            </button>
          </div>
          <RightRail
            tools={tools}
            activeToolId={fixedActiveId}
            onSelectTool={setFixedActiveId}
            panelContent={fixedActiveId ? <DemoPanelContent toolId={fixedActiveId} /> : undefined}
            panelWidth={320}
            collapsed={fixedCollapsed}
            onToggleCollapse={() => setFixedCollapsed((v) => !v)}
            collapseLabel={fixedCollapsed ? 'Rozwiń prawy panel' : 'Zwiń prawy panel'}
          />
        </ColumnFrame>
      </div>
    </div>
  );
}

export default PrawyPanelSzynaIkonScreen;
