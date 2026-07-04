/**
 * RowActionsMenu — Unified "⋮" actions menu for table rows
 *
 * Used across Inbox, Tasks, Decisions, Notifications, Initiatives, Interview
 * to provide consistent row-level actions.
 *
 * AC (A2, A3, A6): Row actions as "⋯" or dropdown; always readable.
 */

import { ChevronDown, ChevronRight, MoreHorizontal, MoreVertical } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface RowAction {
  id: string;
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
  hidden?: boolean;
  description?: string;
  rightLabel?: string;
  /** If true, shows a divider above this action */
  divider?: boolean;
  /** Optional inline sub-menu (e.g. Delay ▸ +1/+3/+7). Clicking the parent
   *  expands these items inline instead of firing onClick. */
  submenu?: RowAction[];
}

export type RowActionSectionKind =
  | 'context'
  | 'open'
  | 'ai'
  | 'convert'
  | 'output'
  | 'manage'
  | 'danger';

export interface RowActionSection {
  id: string;
  label?: string;
  kind?: RowActionSectionKind;
  actions: RowAction[];
}

interface RowActionsMenuProps {
  actions?: RowAction[];
  sections?: RowActionSection[];
  /** Size variant */
  size?: 'sm' | 'md';
  className?: string;
  /** Icon variant: horizontal "⋯" or vertical "⋮" */
  iconVariant?: 'horizontal' | 'vertical';
}

export const RowActionsMenu: React.FC<RowActionsMenuProps> = ({
  actions = [],
  sections,
  size = 'sm',
  className = '',
  // App Table Standard (v3): always prefer vertical kebab (⋮)
  iconVariant = 'vertical',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    right: number;
    maxWidth: number;
    placement: 'top' | 'bottom';
  } | null>(null);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  // Capture anchor rect on open and keep updated on scroll/resize.
  useEffect(() => {
    if (!isOpen) {
      setAnchorRect(null);
      setPanelPos(null);
      setExpandedId(null);
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
  // Right-anchored to the button's right edge via CSS `right` — robust to panel width
  // (no width measurement, which mis-fired on first paint and detached the menu). A
  // ResizeObserver re-runs once the panel settles, so height-based flip is also correct.
  useLayoutEffect(() => {
    if (!isOpen) return;
    if (!anchorRect) return;
    const panel = panelRef.current;
    if (!panel) return;

    const margin = 8;
    const gap = 6; // matches mt-1 (~4px) + a bit of breathing room

    const reposition = () => {
      const p = panelRef.current;
      if (!p) return;
      const panelHeight = p.offsetHeight || 200;

      const canOpenDown = anchorRect.bottom + gap + panelHeight <= window.innerHeight - margin;
      const canOpenUp = anchorRect.top - gap - panelHeight >= margin;
      const placement: 'top' | 'bottom' = !canOpenDown && canOpenUp ? 'top' : 'bottom';

      const top =
        placement === 'bottom'
          ? Math.min(window.innerHeight - margin - panelHeight, anchorRect.bottom + gap)
          : Math.max(margin, anchorRect.top - gap - panelHeight);

      // Anchor the panel's RIGHT edge to the button's right edge. The panel grows leftward,
      // so its width never affects horizontal placement. Clamp width so it can't overflow left.
      const right = Math.max(margin, Math.round(window.innerWidth - anchorRect.right));
      const maxWidth = Math.max(160, Math.round(anchorRect.right - margin));

      setPanelPos({ top, right, maxWidth, placement });
    };

    reposition();
    const ro = new ResizeObserver(reposition);
    ro.observe(panel);
    return () => ro.disconnect();
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

  const visibleSections = useMemo<RowActionSection[]>(() => {
    if (sections?.length) {
      return sections
        .map((section) => ({
          ...section,
          actions: section.actions.filter((action) => !action.hidden),
        }))
        .filter((section) => section.actions.length > 0);
    }

    const legacyActions = actions.filter((action) => !action.disabled && !action.hidden);
    return legacyActions.length
      ? [
          {
            id: 'legacy',
            actions: legacyActions,
          },
        ]
      : [];
  }, [actions, sections]);

  if (visibleSections.length === 0) return null;

  const iconSize = size === 'sm' ? 14 : 16;
  // canon §19.1 — kebab hit = h-8 w-8 (32px), ikona wycentrowana.
  const buttonHit = 'h-8 w-8 inline-flex items-center justify-center';
  const MenuIcon = iconVariant === 'vertical' ? MoreVertical : MoreHorizontal;

  const variantStyles: Record<string, string> = {
    default: 'text-c-text dark:text-c-text hover:bg-slate-100 dark:hover:bg-white/[0.06]',
    danger: 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20',
    // primary (non-destructive highlight) = neutral/info, NOT crimson.
    primary:
      'text-c-info dark:text-c-info hover:bg-slate-100 dark:hover:bg-white/[0.06]',
  };

  return (
    <div className={`inline-block ${className}`}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`${buttonHit} rounded-md text-slate-600 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors`}
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
              className="fixed inset-0 z-context-menu"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
              }}
            />
            <div
              ref={panelRef}
              className="fixed z-context-menu min-w-[160px] rounded-lg border border-slate-200 dark:border-c-border bg-white dark:bg-c-surface-raised shadow-2xl py-1 animate-in fade-in-0 zoom-in-95"
              role="menu"
              style={
                panelPos
                  ? {
                      top: panelPos.top,
                      right: panelPos.right,
                      maxWidth: panelPos.maxWidth,
                      transformOrigin: panelPos.placement === 'top' ? 'bottom right' : 'top right',
                    }
                  : { top: -9999, right: -9999 }
              }
              onClick={(e) => {
                // Prevent row click/selection from firing behind the menu.
                e.stopPropagation();
              }}
            >
              {visibleSections.map((section, sectionIndex) => {
                return (
                  <React.Fragment key={section.id}>
                    {sectionIndex > 0 && (
                      <div className="my-1 border-t border-slate-200 dark:border-c-border-subtle" />
                    )}
                    {section.label ? (
                      <div className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                        {section.label}
                      </div>
                    ) : null}
                    {section.actions.map((action) => {
                      const Icon = action.icon;
                      const hasSub = !!action.submenu?.length;
                      const expanded = expandedId === action.id;
                      return (
                        <React.Fragment key={action.id}>
                          {action.divider && (
                            <div className="my-1 border-t border-slate-200 dark:border-c-border-subtle" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (action.disabled) return;
                              if (hasSub) {
                                setExpandedId((prev) => (prev === action.id ? null : action.id));
                                return;
                              }
                              action.onClick();
                              setIsOpen(false);
                            }}
                            disabled={action.disabled}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${variantStyles[action.variant || 'default']}`}
                            role="menuitem"
                            aria-expanded={hasSub ? expanded : undefined}
                            title={action.description}
                          >
                            {Icon && <Icon size={14} className="shrink-0" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{action.label}</span>
                              {action.description ? (
                                <span className="mt-0.5 block truncate text-[10px] font-normal text-slate-600 dark:text-slate-500">
                                  {action.description}
                                </span>
                              ) : null}
                            </span>
                            {action.rightLabel ? (
                              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                                {action.rightLabel}
                              </span>
                            ) : null}
                            {hasSub ? (
                              expanded ? (
                                <ChevronDown size={14} className="shrink-0 opacity-60" />
                              ) : (
                                <ChevronRight size={14} className="shrink-0 opacity-60" />
                              )
                            ) : null}
                          </button>
                          {hasSub && expanded
                            ? action.submenu!.map((sub) => {
                                const SubIcon = sub.icon;
                                return (
                                  <button
                                    key={sub.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (sub.disabled) return;
                                      sub.onClick();
                                      setIsOpen(false);
                                    }}
                                    disabled={sub.disabled}
                                    className={`w-full flex items-center gap-2 py-1.5 pl-8 pr-3 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${variantStyles[sub.variant || 'default']}`}
                                    role="menuitem"
                                  >
                                    {SubIcon && <SubIcon size={14} className="shrink-0" />}
                                    <span className="min-w-0 flex-1 truncate">{sub.label}</span>
                                  </button>
                                );
                              })
                            : null}
                        </React.Fragment>
                      );
                    })}
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
