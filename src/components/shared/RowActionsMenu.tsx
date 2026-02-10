/**
 * RowActionsMenu — Unified "⋯" actions menu for table rows
 *
 * Used across Inbox, Tasks, Decisions, Notifications, Initiatives, Interview
 * to provide consistent row-level actions.
 *
 * AC (A2, A3, A6): Row actions as "⋯" or dropdown; always readable.
 */

import { MoreHorizontal } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface RowAction {
  id: string;
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
  /** If true, shows a divider above this action */
  divider?: boolean;
}

interface RowActionsMenuProps {
  actions: RowAction[];
  /** Size variant */
  size?: 'sm' | 'md';
  className?: string;
}

export const RowActionsMenu: React.FC<RowActionsMenuProps> = ({
  actions,
  size = 'sm',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const visibleActions = actions.filter((a) => !a.disabled);
  if (visibleActions.length === 0) return null;

  const iconSize = size === 'sm' ? 14 : 16;
  const buttonPadding = size === 'sm' ? 'p-1' : 'p-1.5';

  const variantStyles: Record<string, string> = {
    default: 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700',
    danger: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
    primary:
      'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20',
  };

  return (
    <div ref={menuRef} className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`${buttonPadding} rounded-md text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors`}
        title="Actions"
        aria-label="Row actions"
        aria-expanded={isOpen}
      >
        <MoreHorizontal size={iconSize} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
          role="menu"
        >
          {visibleActions.map((action) => {
            const Icon = action.icon;
            return (
              <React.Fragment key={action.id}>
                {action.divider && (
                  <div className="my-1 border-t border-slate-200 dark:border-navy-700" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors ${variantStyles[action.variant || 'default']}`}
                  role="menuitem"
                >
                  {Icon && <Icon size={14} />}
                  {action.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RowActionsMenu;
