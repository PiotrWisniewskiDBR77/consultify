/**
 * SectionSidebar — grouped, adaptive navigation for an artifact's sections.
 *
 * Solves two owner asks:
 *  - too many flat items (#22: "po lewej mnóstwo punktów… ograniczyć") →
 *    sections are organized into named groups (e.g. INSIGHT / BETWEEN THE LINES
 *    / EVIDENCE / DELIVERABLES / AUDIT).
 *  - "show only sections that actually have value" (#22) → a section with
 *    `hasData === false` is hidden unless it's `alwaysShow` or the user flips
 *    "Show all sections".
 *
 * In N-mode this is the left nav (click selects the active section). In C-mode
 * the same model drives a table-of-contents (click scrolls to the section).
 */

import { ChevronDown, type LucideIcon } from 'lucide-react';
import React, { useMemo, useState } from 'react';

export interface SidebarSection {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Count badge (e.g. number of items). */
  count?: number;
  /** Whether the section currently has meaningful content. */
  hasData?: boolean;
  /** Always render even when empty (e.g. Executive Summary, Next Actions). */
  alwaysShow?: boolean;
}

export interface SidebarGroup {
  id: string;
  label: string;
  sections: SidebarSection[];
}

export interface SectionSidebarProps {
  groups: SidebarGroup[];
  activeSectionId?: string;
  onSelect: (sectionId: string) => void;
  /** When true, empty sections are shown too (overrides hide-empty). */
  showAll?: boolean;
  onToggleShowAll?: (next: boolean) => void;
  isPolish?: boolean;
  className?: string;
}

const isVisible = (s: SidebarSection, showAll: boolean) =>
  showAll || s.alwaysShow || s.hasData !== false;

export const SectionSidebar: React.FC<SectionSidebarProps> = ({
  groups,
  activeSectionId,
  onSelect,
  showAll = false,
  onToggleShowAll,
  isPolish = false,
  className = '',
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const visibleGroups = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, sections: g.sections.filter((s) => isVisible(s, showAll)) }))
        .filter((g) => g.sections.length > 0),
    [groups, showAll]
  );

  const hiddenCount = useMemo(
    () => groups.reduce((acc, g) => acc + g.sections.filter((s) => !isVisible(s, false)).length, 0),
    [groups]
  );

  return (
    <nav
      className={`flex flex-col gap-3 ${className}`}
      aria-label={isPolish ? 'Sekcje' : 'Sections'}
    >
      {visibleGroups.map((group) => {
        const isCollapsed = collapsed[group.id];
        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))}
              className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <ChevronDown
                size={11}
                className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
              />
              {group.label}
            </button>
            {!isCollapsed && (
              <div className="mt-0.5 space-y-0.5">
                {group.sections.map((s) => {
                  const active = s.id === activeSectionId;
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelect(s.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                        active
                          ? 'bg-primary-500/10 font-medium text-primary-700 dark:text-primary-300'
                          : 'text-slate-600 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      {Icon && <Icon size={14} className="shrink-0 opacity-80" />}
                      <span className="min-w-0 flex-1 truncate">{s.label}</span>
                      {typeof s.count === 'number' && s.count > 0 && (
                        <span className="shrink-0 rounded-full bg-slate-200/70 px-1.5 text-[10px] font-medium text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                          {s.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {onToggleShowAll && (hiddenCount > 0 || showAll) && (
        <button
          type="button"
          onClick={() => onToggleShowAll(!showAll)}
          className="mt-1 px-2.5 py-1 text-left text-[11px] text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
        >
          {showAll
            ? isPolish
              ? 'Ukryj puste sekcje'
              : 'Hide empty sections'
            : isPolish
              ? `Pokaż wszystkie sekcje (${hiddenCount})`
              : `Show all sections (${hiddenCount})`}
        </button>
      )}
    </nav>
  );
};

export default SectionSidebar;
