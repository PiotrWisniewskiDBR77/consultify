/**
 * ActionToolbar — canonical action bar for a heavy-artifact detail view.
 *
 * Replaces the "rainbow toolbar" (owner #26: 7 buttons in 5 different colors,
 * no hierarchy). The canon: ONE primary action + a few uniform secondary
 * dropdowns (Export / Convert / AI). Everything else collapses into a dropdown.
 *
 *   [ Primary ]   [ Export ▾ ] [ Convert ▾ ] [ ✨ AI ▾ ]
 *
 * - Primary = the main state action (e.g. "Submit for Information" / "Mark
 *   Complete") — solid/gradient.
 * - Secondary groups = uniform outline dropdowns. Pass an `AIAssist` (level
 *   "tool") as the AI group so regenerate/improve live in one place (#23/#26).
 */

import { ChevronDown, type LucideIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export interface ToolbarMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface ToolbarGroup {
  id: string;
  label: string;
  icon?: LucideIcon;
  items: ToolbarMenuItem[];
}

export interface ActionToolbarProps {
  /** The single primary action. Omit for read-only artifacts. */
  primary?: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    disabled?: boolean;
  };
  /** Secondary dropdown groups (Export / Convert / …). */
  groups?: ToolbarGroup[];
  /** A pre-built control rendered at the far right (e.g. <AIAssist level="tool">). */
  aiSlot?: React.ReactNode;
  className?: string;
}

const Dropdown: React.FC<{ group: ToolbarGroup }> = ({ group }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Icon = group.icon;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!group.items.length) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white/70 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.07]"
      >
        {Icon && <Icon size={14} />}
        <span>{group.label}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-xl dark:border-white/[0.08] dark:bg-navy-900"
        >
          <div className="max-h-[320px] overflow-y-auto p-1">
            {group.items.map((item) => {
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors disabled:opacity-40 ${
                    item.danger
                      ? 'text-rose-600 hover:bg-rose-500/10 dark:text-rose-300'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {ItemIcon && <ItemIcon size={13} className="shrink-0" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  primary,
  groups = [],
  aiSlot,
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {primary && (
        <button
          type="button"
          onClick={primary.onClick}
          disabled={primary.disabled}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {primary.icon && <primary.icon size={14} />}
          <span>{primary.label}</span>
        </button>
      )}

      {(groups.length > 0 || aiSlot) && primary && (
        <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-white/[0.08]" aria-hidden />
      )}

      {groups.map((group) => (
        <Dropdown key={group.id} group={group} />
      ))}

      {aiSlot && (
        <>
          <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-white/[0.08]" aria-hidden />
          {aiSlot}
        </>
      )}
    </div>
  );
};

export default ActionToolbar;
