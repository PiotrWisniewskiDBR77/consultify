/**
 * ModuleHeaderBar — canon Menu 1 of a MODULE (TABLE_AND_PREVIEW_CANON §15.2,
 * ARTIFACT_ANATOMY_STANDARD §5). This is the thin bar ABOVE a module's list:
 *
 *   [ Module title ]  ................................  [ 🔍 ]  [ ONE primary ]
 *
 * The API enforces the standard by construction — there is literally NO prop
 * for "extra buttons". A module header may carry exactly:
 *   - title  (module name, 15px semibold c-text, left)
 *   - an optional search-toggle icon slot
 *   - exactly ONE primary CTA (the `primaryAction` slot, right)
 * Filters, tabs, view-modes, bulk actions live in Menu 2 / Menu 3, NOT here.
 * If an adopter needs another button, that is a signal to fix the layout, not
 * to widen this API (CANON §1: screens compose approved components).
 *
 * @example
 *   <ModuleHeaderBar
 *     title={t('tools.title', { defaultValue: 'Tools' })}
 *     onSearchToggle={() => setSearchOpen(o => !o)}
 *     primaryAction={<button className="...">Add</button>}
 *   />
 */

import React from 'react';
import { Search } from 'lucide-react';

export interface ModuleHeaderBarProps {
  /** Module name. Rendered 15px semibold `c-text`, left-aligned. */
  title: React.ReactNode;
  /**
   * The single primary CTA (e.g. "Add", "New session"). Pass a rendered button.
   * There is intentionally no slot for a second action.
   */
  primaryAction?: React.ReactNode;
  /**
   * When provided, renders a ghost search-toggle icon before the primary CTA.
   * (Search field itself lives in Menu 2 per §15.2 — this is only the toggle.)
   */
  onSearchToggle?: () => void;
  /** Accessible label for the search toggle. */
  searchLabel?: string;
  /** Extra classes on the bar root. */
  className?: string;
}

/**
 * The module-level identity/action bar. Deliberately minimal: one title, one
 * optional search toggle, one primary. See file header for the rationale.
 */
export const ModuleHeaderBar: React.FC<ModuleHeaderBarProps> = ({
  title,
  primaryAction,
  onSearchToggle,
  searchLabel = 'Search',
  className = '',
}) => {
  return (
    <div
      className={`flex h-12 items-center justify-between gap-3 border-b border-c-border-subtle bg-c-surface px-4 ${className}`.trim()}
    >
      <h1 className="min-w-0 truncate text-[15px] font-semibold leading-none text-c-text">
        {title}
      </h1>
      <div className="flex shrink-0 items-center gap-2">
        {onSearchToggle && (
          <button
            type="button"
            onClick={onSearchToggle}
            aria-label={searchLabel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {primaryAction}
      </div>
    </div>
  );
};

export default ModuleHeaderBar;
