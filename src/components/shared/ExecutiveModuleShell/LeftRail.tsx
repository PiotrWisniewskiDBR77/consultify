/**
 * LeftRail — outline / item-list rail for `ExecutiveModuleShell`
 * (MELS § 2 Zone B · EPIC-T16 D1).
 *
 * The shell owns the rail's chrome (collapse toggle, optional sort/filter
 * slot, optional Teresa AI bottom slot); the caller supplies the actual
 * list content as `children`. This keeps the shell module-agnostic.
 *
 * Constraints (MELS § 2.B):
 *   * Width is user-resizable 200..480 px (clamped by `useRailState`).
 *   * Collapse toggle is mandatory — every executive module surfaces it.
 *   * Single vertical scroll axis.
 *   * Teresa AI panel anchored to bottom (~128 px) when supplied.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import { RailResizeHandle } from './RailResizeHandle';

interface LeftRailProps {
  /** Caller-supplied list / outline content. */
  children: React.ReactNode;
  /** Optional content slot rendered above the list (sort/filter/search). */
  toolsSlot?: React.ReactNode;
  /** Optional bottom-anchored Teresa AI / assistant slot. */
  bottomSlot?: React.ReactNode;
  /** Width in px (already clamped by `useRailState`). */
  width: number;
  /** Whether the rail is currently collapsed. */
  collapsed: boolean;
  /** Toggle handler. */
  onToggleCollapse: () => void;
  /** Optional title shown at the top of the rail. */
  title?: string;
  /** Localized label for the collapse toggle's aria-label. */
  toggleLabel?: string;
  /**
   * Optional resize handler. When supplied, a drag handle is rendered
   * on the right edge of the rail; the caller is expected to forward
   * the next width to `useRailState.setLeftWidth` (clamping owned
   * there).
   */
  onResize?: (nextWidth: number) => void;
  /** Optional `data-testid` for the rail container. */
  testId?: string;
}

const COLLAPSED_WIDTH = 48;

export const LeftRail: React.FC<LeftRailProps> = ({
  children,
  toolsSlot,
  bottomSlot,
  width,
  collapsed,
  onToggleCollapse,
  title,
  toggleLabel,
  onResize,
  testId,
}) => {
  const effectiveWidth = collapsed ? COLLAPSED_WIDTH : width;

  return (
    <aside
      className="relative hidden sm:flex flex-shrink-0 border-r border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40 flex-col h-full overflow-hidden transition-[width] duration-150"
      style={{ width: effectiveWidth }}
      data-testid={testId ?? 'mels-left-rail'}
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-expanded={!collapsed}
      aria-label={title ?? 'Outline'}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-navy-700 flex-shrink-0 h-10">
        {!collapsed && title ? (
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 truncate">
            {title}
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          title={toggleLabel ?? (collapsed ? 'Expand left rail' : 'Collapse left rail')}
          aria-label={toggleLabel ?? (collapsed ? 'Expand left rail' : 'Collapse left rail')}
          aria-pressed={collapsed}
          data-testid="mels-left-rail-toggle"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {!collapsed && toolsSlot ? (
        <div
          className="px-3 py-2 border-b border-slate-200 dark:border-navy-700 flex-shrink-0"
          data-testid="mels-left-rail-tools"
        >
          {toolsSlot}
        </div>
      ) : null}

      <div
        className={`flex-1 overflow-y-auto ${collapsed ? 'invisible pointer-events-none' : ''}`}
        data-testid="mels-left-rail-list"
      >
        {children}
      </div>

      {!collapsed && bottomSlot ? (
        <div
          className="border-t border-slate-200 dark:border-navy-700 flex-shrink-0 px-3 py-2 bg-white/50 dark:bg-navy-900/40"
          data-testid="mels-left-rail-bottom"
          style={{ minHeight: 96, maxHeight: 192 }}
        >
          {bottomSlot}
        </div>
      ) : null}

      {!collapsed && onResize ? (
        <RailResizeHandle side="left" currentWidth={width} onResize={onResize} />
      ) : null}
    </aside>
  );
};

export default LeftRail;
