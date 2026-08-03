/**
 * RightRail — module-tools strip + side panel for
 * `ExecutiveModuleShell` (MELS § 2 Zone D · EPIC-T16 D1).
 *
 * The right rail is a 56 px icon strip; clicking an icon expands a
 * side-panel that shares the rail's coordinate space. Only the PANEL
 * collapses — the icon strip never does.
 *
 * Constraints (MELS § 2.D):
 *   * Right rail is the ONLY place for module tool buttons.
 *   * AI buttons that would otherwise live in Menu 3 land here too
 *     (the rule's intent — no AI buttons floating in canvas — is
 *     preserved; see `.cursor/rules/ai-actions-menu3.mdc`).
 *   * `collapsed` closes the open PANEL only — the 56 px icon strip
 *     (tools + the expand/collapse handle) always stays in the DOM and
 *     stays clickable. Before P-01 (2026-07-28, zgłoszenie Piotra),
 *     `collapsed` rendered a 16 px sliver with no tool icons — the user
 *     could not find a click target to re-open the panel ("nie jestem w
 *     stanie złapać tego przycisku"). The same shared component backs
 *     Deck Builder, Document Studio, Tabele/Excel and all four Ideas
 *     canvases, so this fix applies everywhere at once — see call sites
 *     listed in git history / session report for P-01.
 *   * `collapsible` (added by the panel-6-sekcji Idea work, merged on top
 *     of P-01 2026-07-28): controls ONLY whether the collapse toggle
 *     button is rendered / whether `collapsed` can hide the side PANEL.
 *     It must NEVER reintroduce the 16 px icon-less sliver P-01 removed —
 *     the icon strip stays unconditional regardless of `collapsible`.
 */

import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import { RailResizeHandle } from './RailResizeHandle';

export interface RightRailToolDescriptor {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  /**
   * Why the tool is unavailable here. Shown as the tooltip instead of `label`
   * when `disabled`. Required by the shared action-state standard: a disabled
   * surface must say WHY, never fail silently.
   */
  disabledReason?: string;
  /** Optional `data-testid` override. */
  testId?: string;
  /** Optional badge string ("3", "•") rendered top-right. */
  badge?: string | number;
  /** Optional dot tone (semantic accent). */
  dotTone?: 'success' | 'warning' | 'danger' | 'info' | null;
}

interface RightRailProps {
  tools: RightRailToolDescriptor[];
  /** Currently active tool id (null = no panel open). */
  activeToolId: string | null;
  /** Called when the user clicks a tool icon. */
  onSelectTool: (id: string | null) => void;
  /** Active panel content (null when no tool selected). */
  panelContent?: React.ReactNode;
  /** Width of the open panel in px (clamped by `useRailState`). */
  panelWidth: number;
  /**
   * Whether the side PANEL is collapsed/closed. The 56 px icon strip
   * (tools + expand/collapse handle) is always rendered regardless of
   * this flag — see file header note (P-01, 2026-07-28).
   */
  collapsed: boolean;
  onToggleCollapse: () => void;
  collapseLabel?: string;
  /**
   * Czy pasek ikon wolno schować do 16-pikselowego słupka. Domyślnie TAK
   * (dzisiejsze zachowanie każdego modułu — Wordy / Tabele / Prezentacje /
   * Document Studio / Deck Builder).
   *
   * `false` = pasek ikon jest ZAWSZE widoczny: znika chevron zwijania, a stan
   * `collapsed` przestaje mieć skutek. Decyzja właściciela dla Idei (2026-07-28):
   * „nie ma sensu zwijać bardziej — niech ciągle będzie i przyzwyczaja, że tu są
   * ikony". Podawane wyłącznie przez powłokę Idei za flagą `ff_ideaPanel6Sections`,
   * więc pozostałe moduły zachowują się bez zmian.
   */
  collapsible?: boolean;
  /**
   * Optional resize handler. When supplied AND the panel is open, a
   * drag handle is rendered on the panel's left edge. Caller forwards
   * the next width to `useRailState.setRightWidth` (clamping there).
   */
  onResize?: (nextWidth: number) => void;
  testId?: string;
}

const ICON_STRIP_WIDTH = 56;

const DOT_TONE_CLASS: Record<NonNullable<RightRailToolDescriptor['dotTone']>, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-danger-500',
  info: 'bg-sky-500',
};

const ToolIcon: React.FC<{
  tool: RightRailToolDescriptor;
  active: boolean;
  onClick: () => void;
}> = ({ tool, active, onClick }) => {
  const { icon: Icon, label, disabled, disabledReason, badge, dotTone, id, testId } = tool;
  const tooltip = disabled && disabledReason ? `${label} — ${disabledReason}` : label;

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
      title={tooltip}
      aria-label={tooltip}
      aria-pressed={active}
      className={`${baseClasses} ${stateClasses} disabled:opacity-40 disabled:cursor-not-allowed`}
      data-testid={testId ?? `mels-right-rail-tool-${id}`}
      data-mels-tool={id}
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

export const RightRail: React.FC<RightRailProps> = ({
  tools,
  activeToolId,
  onSelectTool,
  panelContent,
  panelWidth,
  collapsed,
  onToggleCollapse,
  collapseLabel,
  onResize,
  collapsible = true,
  testId,
}) => {
  const activeTool = activeToolId ? (tools.find((t) => t.id === activeToolId) ?? null) : null;
  // Gdy zwijanie jest wyłączone, zapamiętany stan `collapsed` (localStorage
  // `useRailState`) nie może schować paska — inaczej użytkownik, który kiedyś
  // go zwinął, dostałby pusty słupek bez przycisku rozwijania.
  const zwiniety = collapsible && collapsed;
  const showPanel = !zwiniety && Boolean(activeTool) && Boolean(panelContent);
  // `aria-expanded` opisuje PRZYCISK sterujacy, nie region — na <aside> (rola
  // complementary) jest niedozwolone i axe raportuje to jako critical.
  const panelDomId = 'mels-right-rail-panel';

  // P-01 (2026-07-28): NIGDY nie renderujemy 16px słupka bez ikon — to był
  // pierwotny bug (użytkownik nie mógł złapać przycisku rozwijania). Pasek
  // ikon 56px jest bezwarunkowy dla WSZYSTKICH modułów; `collapsible`/`zwiniety`
  // (patrz niżej) sterują wyłącznie widocznością przycisku zwijania i panelu
  // bocznego, nigdy całego paska ikon.
  const containerWidth = ICON_STRIP_WIDTH + (showPanel ? panelWidth : 0);

  // P-01 (2026-07-28): the icon strip is UNCONDITIONAL — `collapsed` only
  // decides whether the side panel is shown next to it. Clicking a tool
  // icon while collapsed both selects the tool AND re-opens the panel
  // (one gesture — the user should never have to hunt for a second,
  // separate handle to "expand" before the tool becomes clickable).
  return (
    <aside
      className="flex-shrink-0 border-l border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex h-full transition-[width] duration-150"
      style={{ width: containerWidth }}
      data-testid={testId ?? 'mels-right-rail'}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      {showPanel ? (
        <div
          className="relative border-r border-slate-200 dark:border-navy-700 overflow-hidden flex flex-col"
          style={{ width: panelWidth }}
          id={panelDomId}
          data-testid="mels-right-rail-panel"
          data-mels-panel-of={activeTool?.id ?? ''}
        >
          {onResize ? (
            <RailResizeHandle side="right" currentWidth={panelWidth} onResize={onResize} />
          ) : null}
          {panelContent}
        </div>
      ) : null}

      <div
        className="flex flex-col items-center py-2 gap-1"
        style={{ width: ICON_STRIP_WIDTH }}
        data-testid="mels-right-rail-strip"
      >
        {collapsible ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 mb-1"
            title={
              collapsed
                ? (collapseLabel ?? 'Expand right rail')
                : (collapseLabel ?? 'Collapse right rail')
            }
            aria-label={
              collapsed
                ? (collapseLabel ?? 'Expand right rail')
                : (collapseLabel ?? 'Collapse right rail')
            }
            aria-expanded={!collapsed}
            aria-controls={showPanel ? panelDomId : undefined}
            data-testid="mels-right-rail-toggle"
          >
            {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : null}
        {tools.map((tool) => (
          <ToolIcon
            key={tool.id}
            tool={tool}
            active={!collapsed && tool.id === activeToolId}
            onClick={() => {
              const opening = collapsed || tool.id !== activeToolId;
              onSelectTool(opening ? tool.id : null);
              if (opening && collapsed) onToggleCollapse();
            }}
          />
        ))}
      </div>
    </aside>
  );
};

export default RightRail;
