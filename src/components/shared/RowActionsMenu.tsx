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
  'context' | 'open' | 'ai' | 'convert' | 'output' | 'manage' | 'danger';

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
  /**
   * PPM-mirror (ANEKS #3b — `_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md` #3/#33):
   * "DOKŁADNIE TO SAMO menu ma wyskakiwać pod prawym przyciskiem myszy".
   * When set to a viewport point, this SAME popover (same sections, same
   * repositioning mechanism) opens already-open, anchored at that point
   * instead of the kebab button — independent of the kebab's own open state.
   * The caller (e.g. a table row's onContextMenu) owns this state and must
   * clear it via `onContextMenuClose` to close (backdrop click/Escape/pick
   * all call it). Purely additive: omit both props and behavior is
   * byte-identical to today's kebab-only menu.
   */
  contextMenuAnchor?: { x: number; y: number } | null;
  onContextMenuClose?: () => void;
}

/**
 * Czy pozycja menu to ATRAPA — akcja, która istnieje na ekranie, ale nic nie
 * robi, bo jej po prostu nie zbudowano.
 *
 * Piotr, P-17 (Sejf) i P-18 (Run agent), 2026-07-27: „Ta tabela jest w ogóle
 * wbrew jakimkolwiek standardom" — przy kebabie, w którym 3 z 4 pozycji były
 * martwe. Przegląd 128 zrzutów naliczył takich menu pięć (Sejf 3/4, Run agent
 * Szablony 3/4, Run agent Procesy 2/4, Documents→Sheets 3/7, Interview→
 * Initiatives 3/6), a jako wzorzec wskazał kebab Interview→Templates: dziewięć
 * pozycji, ZERO wyłączonych.
 *
 * Sprawdziłem, zanim to napisałem: „Coming soon (backend)" mówi prawdę —
 * `my_ideas` i siostrzane tabele nie mają nawet kolumny na archiwizację, a
 * `POST /archive` istnieje wyłącznie dla sesji wywiadu i report-buildera.
 * Czyli to nie jest coś, co da się „włączyć" — to funkcja do zbudowania.
 *
 * Dlatego menu jej nie pokazuje. Rozróżnienie jest celowe i przebiega po
 * TREŚCI komunikatu:
 *   - „jeszcze tego nie ma" (Coming soon / Wkrótce)  → ATRAPA, znika z menu;
 *   - „nie wolno, bo…" (`AI-generated — read-only`, `Archive first`,
 *     `Safes are automatic — cannot be deleted`) → ZOSTAJE wyłączone z powodem,
 *     bo uczy użytkownika reguły produktu zamiast go oszukiwać.
 */
const ATRAPA_WZORZEC = /coming soon|wkrótce|wkrotce/i;

export function czyAtrapa(action: Pick<RowAction, 'disabled' | 'description' | 'rightLabel'>) {
  if (!action.disabled) return false;
  return ATRAPA_WZORZEC.test(`${action.description ?? ''} ${action.rightLabel ?? ''}`);
}

export const RowActionsMenu: React.FC<RowActionsMenuProps> = ({
  actions = [],
  sections,
  size = 'sm',
  className = '',
  // App Table Standard (v3): always prefer vertical kebab (⋮)
  iconVariant = 'vertical',
  contextMenuAnchor = null,
  onContextMenuClose,
}) => {
  const [kebabOpen, setKebabOpen] = useState(false);
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

  // Either trigger can drive the SAME popover: kebab click (internal state)
  // or the PPM-mirror context-menu anchor (externally controlled point).
  const isOpen = kebabOpen || !!contextMenuAnchor;

  const closeMenu = useCallback(() => {
    setKebabOpen(false);
    onContextMenuClose?.();
  }, [onContextMenuClose]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setKebabOpen((prev) => !prev);
  }, []);

  // Capture anchor rect on open and keep updated on scroll/resize. In
  // context-menu mode the anchor is the cursor point itself (static viewport
  // coords) — no button to measure/track.
  useEffect(() => {
    if (!isOpen) {
      setAnchorRect(null);
      setPanelPos(null);
      setExpandedId(null);
      return;
    }

    if (contextMenuAnchor) {
      setAnchorRect({
        top: contextMenuAnchor.y,
        bottom: contextMenuAnchor.y,
        left: contextMenuAnchor.x,
        right: contextMenuAnchor.x,
        width: 0,
        height: 0,
      } as DOMRect);
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
  }, [isOpen, contextMenuAnchor]);

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
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closeMenu]);

  const visibleSections = useMemo<RowActionSection[]>(() => {
    if (sections?.length) {
      return sections
        .map((section) => ({
          ...section,
          actions: section.actions.filter((action) => !action.hidden && !czyAtrapa(action)),
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
    default: 'text-slate-700 dark:text-slate-300 hover:bg-state-hover',
    danger: 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20',
    primary:
      'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20',
  };

  return (
    <div className={`inline-block ${className}`}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`${buttonHit} rounded-md text-slate-600 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-state-hover transition-colors`}
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
                closeMenu();
              }}
            />
            <div
              ref={panelRef}
              className="fixed z-context-menu min-w-[160px] rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
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
                      <div className="my-1 border-t border-slate-200 dark:border-navy-700" />
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
                            <div className="my-1 border-t border-slate-200 dark:border-navy-700" />
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
                              closeMenu();
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
                                      closeMenu();
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
