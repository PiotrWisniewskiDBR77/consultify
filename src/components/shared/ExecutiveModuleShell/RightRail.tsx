/**
 * RightRail — module-tools strip + side panel for
 * `ExecutiveModuleShell` (MELS § 2 Zone D · EPIC-T16 D1).
 *
 * The right rail is a 56 px icon strip; clicking an icon expands a
 * side-panel that shares the rail's coordinate space. Only ONE panel
 * is visible at a time (mutually exclusive with the icon strip — the
 * panel replaces it but keeps the dismiss chevron).
 *
 * Constraints (MELS § 2.D):
 *   * Right rail is the ONLY place for module tool buttons.
 *   * AI buttons that would otherwise live in Menu 3 land here too
 *     (the rule's intent — no AI buttons floating in canvas — is
 *     preserved; see `.cursor/rules/ai-actions-menu3.mdc`).
 *   * Collapsible to a 0 px sliver via the chevron at the top.
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
  /** Whether the rail is fully collapsed (0 px sliver). */
  collapsed: boolean;
  onToggleCollapse: () => void;
  collapseLabel?: string;
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
  testId,
}) => {
  const activeTool = activeToolId ? (tools.find((t) => t.id === activeToolId) ?? null) : null;
  const showPanel = !collapsed && Boolean(activeTool) && Boolean(panelContent);

  if (collapsed) {
    return (
      <aside
        className="flex-shrink-0 border-l border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex flex-col items-center py-2 transition-[width] duration-150"
        style={{ width: 16 }}
        data-testid={testId ?? 'mels-right-rail'}
        data-collapsed="true"
        aria-expanded="false"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800"
          title={collapseLabel ?? 'Expand right rail'}
          aria-label={collapseLabel ?? 'Expand right rail'}
          aria-pressed={collapsed}
          data-testid="mels-right-rail-toggle"
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
      data-testid={testId ?? 'mels-right-rail'}
      data-collapsed="false"
      aria-expanded="true"
    >
      {showPanel ? (
        <div
          className="relative border-r border-slate-200 dark:border-navy-700 overflow-hidden flex flex-col"
          style={{ width: panelWidth }}
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
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 mb-1"
          title={collapseLabel ?? 'Collapse right rail'}
          aria-label={collapseLabel ?? 'Collapse right rail'}
          aria-pressed={collapsed}
          data-testid="mels-right-rail-toggle"
        >
          <ChevronRight size={14} />
        </button>
        {tools.map((tool) => (
          <ToolIcon
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

export default RightRail;
