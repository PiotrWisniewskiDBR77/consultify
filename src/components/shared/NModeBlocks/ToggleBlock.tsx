/**
 * ToggleBlock
 *
 * N-mode building block for expandable/collapsible content.
 * Default expanded for key content; collapsed for secondary/rare content.
 *
 * Follows DBR77 Visual Language — quiet UI with subtle transitions.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.5
 */

import { ChevronDown } from 'lucide-react';
import React, { useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ToggleBlockProps {
  /** Block heading */
  title: string;
  /** Optional badge/count shown next to title */
  badge?: string | number;
  /** Whether block starts expanded */
  defaultOpen?: boolean;
  /** Controlled open state (overrides internal state) */
  open?: boolean;
  /** Change handler for controlled mode */
  onToggle?: (open: boolean) => void;
  /** Content to display when expanded */
  children: React.ReactNode;
  /** Optional icon before title */
  icon?: React.ReactNode;
  /** Additional CSS classes for the container */
  className?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export const ToggleBlock: React.FC<ToggleBlockProps> = ({
  title,
  badge,
  defaultOpen = true,
  open: controlledOpen,
  onToggle,
  children,
  icon,
  className = '',
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const handleToggle = () => {
    const next = !isOpen;
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
    onToggle?.(next);
  };

  return (
    <div
      className={`rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/40 ${className}`}
    >
      {/* Header (always visible) */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-slate-50/50 dark:hover:bg-navy-800/30 transition-colors rounded-xl"
      >
        {icon && <span className="text-slate-600 dark:text-slate-500 flex-shrink-0">{icon}</span>}
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">
          {title}
        </span>
        {badge !== undefined && badge !== null && (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-navy-600/60">
            {badge}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`text-slate-600 dark:text-slate-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Content (collapsible). `max-h-0 opacity-0` alone (no `hidden`/`inert`)
          keeps the collapsed content mounted for the closing transition, but
          that ALSO leaves every button/input inside it fully present in the
          accessibility tree and hit-testable at 0×0 — automation and screen
          readers can find and target them, e.g. "Add evidence" inside a
          collapsed "Evidence & Sources" block, even though nothing is visibly
          clickable there. `inert` (+ aria-hidden as a fallback for AT that
          predates it) removes the collapsed subtree from focus, hit-testing
          and AT exposure without touching the animation classes below —
          see the 05.09 dyżur note on the reported "collapsed section doesn't
          react to clicks" defect: the section header worked, but a direct,
          role-based click on content that was collapsed-but-still-queryable
          silently targeted an unclickable element instead of failing loudly. */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="px-4 pb-4 pt-1">{children}</div>
      </div>
    </div>
  );
};

export default ToggleBlock;
