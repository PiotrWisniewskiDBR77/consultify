/**
 * RowActionsMenu — Unified "⋮" actions menu for table rows
 *
 * Used across Inbox, Tasks, Decisions, Notifications, Initiatives, Interview
 * to provide consistent row-level actions.
 *
 * AC (A2, A3, A6): Row actions as "⋯" or dropdown; always readable.
 */

import { MoreHorizontal, MoreVertical } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  /** Icon variant: horizontal "⋯" or vertical "⋮" */
  iconVariant?: 'horizontal' | 'vertical';
}

export const RowActionsMenu: React.FC<RowActionsMenuProps> = ({
  actions,
  size = 'sm',
  className = '',
  // App Table Standard (v3): always prefer vertical kebab (⋮)
  iconVariant = 'vertical',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(
    null
  );

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  // Capture anchor rect on open and keep updated on scroll/resize.
  useEffect(() => {
    if (!isOpen) {
      setAnchorRect(null);
      setPanelPos(null);
      return;
    }

    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect() || null;
      setAnchorRect(rect);
    };
    update();

    window.addEventListener('resize', update);
    // Capture scroll from any scroll container
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen]);

  // Position panel (fixed) so it won't be clipped by overflow containers.
  useLayoutEffect(() => {
    if (!isOpen) return;
    if (!anchorRect) return;
    const panel = panelRef.current;
    if (!panel) return;

    const margin = 8;
    const gap = 6; // matches mt-1 (~4px) + a bit of breathing room
    const panelWidth = panel.offsetWidth || 160;
    const panelHeight = panel.offsetHeight || 200;

    const canOpenDown = anchorRect.bottom + gap + panelHeight <= window.innerHeight - margin;
    const canOpenUp = anchorRect.top - gap - panelHeight >= margin;
    const placement: 'top' | 'bottom' = !canOpenDown && canOpenUp ? 'top' : 'bottom';

    const top =
      placement === 'bottom'
        ? Math.min(window.innerHeight - margin - panelHeight, anchorRect.bottom + gap)
        : Math.max(margin, anchorRect.top - gap - panelHeight);

    const desiredLeft = anchorRect.right - panelWidth;
    const left = Math.max(margin, Math.min(desiredLeft, window.innerWidth - margin - panelWidth));

    setPanelPos({ top, left, placement });
  }, [isOpen, anchorRect]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const visibleActions = useMemo(() => actions.filter((a) => !a.disabled), [actions]);
  if (visibleActions.length === 0) return null;

  const iconSize = size === 'sm' ? 14 : 16;
  const buttonPadding = size === 'sm' ? 'p-1' : 'p-1.5';
  const MenuIcon = iconVariant === 'vertical' ? MoreVertical : MoreHorizontal;

  const variantStyles: Record<string, string> = {
    default: 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700',
    danger: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
    primary:
      'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20',
  };

  return (
    <div className={`inline-block ${className}`}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`${buttonPadding} rounded-md text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors`}
        title="Actions"
        aria-label="Row actions"
        aria-expanded={isOpen}
      >
        <MenuIcon size={iconSize} />
      </button>

      {isOpen &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
              }}
            />
            <div
              ref={panelRef}
              className="fixed z-[9999] min-w-[160px] rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
              role="menu"
              style={
                panelPos
                  ? { top: panelPos.top, left: panelPos.left, transformOrigin: panelPos.placement === 'top' ? 'bottom right' : 'top right' }
                  : { top: -9999, left: -9999 }
              }
              onClick={(e) => {
                // Prevent row click/selection from firing behind the menu.
                e.stopPropagation();
              }}
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
          </>,
          document.body
        )}
    </div>
  );
};

export default RowActionsMenu;
