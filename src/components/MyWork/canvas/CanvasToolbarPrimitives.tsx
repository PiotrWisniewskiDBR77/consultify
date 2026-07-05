/**
 * CanvasToolbarPrimitives — shared toolbar button components for all Ideas canvas tools.
 *
 * Moved from whiteboard/WhiteboardToolbarPrimitives.tsx (P4 unification).
 * Import from here; the whiteboard file now re-exports for backwards compat.
 */
import { ChevronDown } from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';

import { FOCUS_RING } from './motionTokens';

export const CanvasToolbarBtn: React.FC<{
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  ariaLabel?: string;
  ariaPressed?: boolean;
}> = ({ icon: Icon, label, onClick, disabled, danger, active, ariaLabel, ariaPressed }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel || label}
    aria-pressed={ariaPressed ?? (active || undefined)}
    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40 shrink-0 ${FOCUS_RING} ${
      danger
        ? 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20'
        : active
          ? 'bg-slate-200 dark:bg-navy-700 text-slate-900 dark:text-slate-100'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
    }`}
    title={label}
  >
    <Icon size={14} />
    {label && <span className="hidden sm:inline">{label}</span>}
  </button>
);

export interface CanvasDropdownItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number }>;
  swatch?: string;
  onClick: () => void;
}

export const CanvasToolbarDropdown: React.FC<{
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  disabled?: boolean;
  items: CanvasDropdownItem[];
  onMainClick: () => void;
}> = ({ icon: Icon, label, disabled, items, onMainClick }) => {
  const [open, setOpen] = React.useState(false);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // The menu is rendered through a portal (position: fixed) so it escapes any
  // ancestor that clips overflow — the toolbar container uses `overflow-x-auto`,
  // which CSS promotes to `overflow-y: auto`, and an in-flow `absolute top-full`
  // popover would be clipped flush with the short toolbar and become unclickable.
  const positionMenu = React.useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 4, left: rect.left });
  }, []);

  const toggleOpen = React.useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) positionMenu();
      return next;
    });
  }, [positionMenu]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const reposition = () => positionMenu();
    document.addEventListener('mousedown', handler);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, positionMenu]);

  return (
    <div ref={ref} className="relative shrink-0">
      <div className="flex items-center" role="group">
        <button
          type="button"
          onClick={onMainClick}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-l-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
          aria-label={label}
          title={label}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
        <button
          type="button"
          onClick={toggleOpen}
          disabled={disabled}
          className="inline-flex items-center rounded-r-lg px-0.5 py-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={`${label} options`}
        >
          <ChevronDown size={10} />
        </button>
      </div>
      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1000] bg-white dark:bg-navy-950/95 border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-lg dark:shadow-[0_0_20px_rgba(0,0,0,0.4)] py-1 min-w-[140px] max-h-[70vh] overflow-y-auto"
            style={{ top: coords.top, left: coords.left }}
            role="menu"
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              >
                {item.swatch && (
                  <span
                    className="w-4 h-4 rounded border border-slate-200 dark:border-navy-600 shrink-0"
                    style={{ backgroundColor: item.swatch }}
                  />
                )}
                {item.icon && <item.icon size={12} />}
                {item.label && <span>{item.label}</span>}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
