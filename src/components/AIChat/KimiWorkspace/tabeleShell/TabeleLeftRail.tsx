/**
 * TabeleLeftRail — outline / item-list content for the Tabele lane
 * left rail (EPIC-T16 D3).
 *
 * Composes:
 *   * Sort/filter/search slot (rendered above the outline when non-empty).
 *   * Outline list — Foundation Block sections (Cover / KPI / Schema /
 *     Records / Relations / Rationale) by default. Caller may pass a
 *     custom list.
 *   * Bottom slot — Teresa AI / assistant placeholder (caller-supplied).
 *
 * The component is presentational: the actual rail chrome (collapse
 * toggle, width, persistence) is owned by `<LeftRail>` from the shell.
 *
 * Constraints (MELS § 2.B):
 *   * Single vertical scroll axis.
 *   * Items must be keyboard-navigable (semantic <button>).
 */

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  FileText,
  GitBranch,
  ListChecks,
  ScrollText,
  Sparkles,
  Tag,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type TabeleSectionId =
  | 'cover'
  | 'kpi'
  | 'schema'
  | 'records'
  | 'relations'
  | 'rationale'
  | string;

export interface TabeleOutlineItem {
  id: TabeleSectionId;
  label: string;
  icon?: LucideIcon;
  /** Optional badge / counter ("23", "P1"). */
  badge?: string | number;
  /** Optional tone for badge dot or count colour. */
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  /** When true, the row is greyed out. */
  disabled?: boolean;
}

interface TabeleLeftRailProps {
  /** Caller-supplied outline. Defaults to Foundation Block sections. */
  items?: TabeleOutlineItem[];
  /** Currently selected section id. */
  activeItemId?: TabeleSectionId | null;
  onSelect?: (id: TabeleSectionId) => void;
  /** Slot rendered above the outline (search input + sort/filter controls). */
  toolsSlot?: React.ReactNode;
  /** Optional empty-state message. */
  emptyLabel?: string;
  /** Optional `data-testid` override. */
  testId?: string;
}

const DEFAULT_OUTLINE: TabeleOutlineItem[] = [
  { id: 'cover', label: 'Cover', icon: FileText },
  { id: 'kpi', label: 'KPI', icon: ListChecks },
  { id: 'schema', label: 'Schema', icon: Tag },
  { id: 'records', label: 'Records', icon: ScrollText },
  { id: 'relations', label: 'Relations', icon: GitBranch },
  { id: 'rationale', label: 'Rationale', icon: Sparkles },
];

const DEFAULT_OUTLINE_LABEL_KEY: Record<string, string> = {
  cover: 'kimi.tabeleShell.leftRail.cover',
  kpi: 'kimi.tabeleShell.leftRail.kpi',
  schema: 'kimi.tabeleShell.leftRail.schema',
  records: 'kimi.tabeleShell.leftRail.records',
  relations: 'kimi.tabeleShell.leftRail.relations',
  rationale: 'kimi.tabeleShell.leftRail.rationale',
};

const TONE_DOT: Record<NonNullable<TabeleOutlineItem['tone']>, string> = {
  neutral: 'bg-c-text-muted',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-danger-500',
  info: 'bg-sky-500',
};

export const TabeleLeftRail: React.FC<TabeleLeftRailProps> = ({
  items,
  activeItemId,
  onSelect,
  toolsSlot,
  emptyLabel,
  testId,
}) => {
  const { t } = useTranslation();
  const outline = items ?? DEFAULT_OUTLINE;
  const empty = outline.length === 0;

  return (
    <div className="flex flex-col h-full text-sm" data-testid={testId ?? 'tabele-left-rail'}>
      {toolsSlot ? (
        <div className="px-3 pt-2 pb-2 flex-shrink-0" data-testid="tabele-left-rail-tools">
          {toolsSlot}
        </div>
      ) : null}

      <ul
        className="flex-1 overflow-y-auto py-1"
        role="listbox"
        aria-label={t('kimi.tabeleShell.leftRail.ariaLabel', 'Tabele outline')}
      >
        {empty ? (
          <li className="px-3 py-6 text-c-text-secondary text-xs italic flex items-center gap-2">
            <AlertTriangle size={14} />
            {emptyLabel ?? t('kimi.tabeleShell.leftRail.empty', 'No sections to display.')}
          </li>
        ) : (
          outline.map((item) => {
            const Icon = item.icon ?? FileText;
            const active = item.id === activeItemId;
            const label = DEFAULT_OUTLINE_LABEL_KEY[item.id]
              ? t(DEFAULT_OUTLINE_LABEL_KEY[item.id], item.label)
              : item.label;
            return (
              <li key={item.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => !item.disabled && onSelect?.(item.id)}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                    active
                      ? 'bg-c-accent-soft text-c-accent'
                      : 'text-c-text hover:bg-c-surface-raised'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  data-testid={`tabele-outline-${item.id}`}
                  data-active={active ? 'true' : 'false'}
                >
                  <Icon size={14} aria-hidden="true" className="flex-shrink-0" />
                  <span className="truncate flex-1">{label}</span>
                  {item.badge !== undefined && item.badge !== null ? (
                    <span
                      className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-md ${
                        item.tone && item.tone !== 'neutral'
                          ? `${TONE_DOT[item.tone]} text-c-text`
                          : 'bg-c-surface-raised text-c-text-secondary'
                      }`}
                      aria-label={t('kimi.tabeleShell.leftRail.countAriaLabel', {
                        defaultValue: '{{label}} count',
                        label,
                      })}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
};

export default TabeleLeftRail;

export const TABELE_DEFAULT_OUTLINE = DEFAULT_OUTLINE;
