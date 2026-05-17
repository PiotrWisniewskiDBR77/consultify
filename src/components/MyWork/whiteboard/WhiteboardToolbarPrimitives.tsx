import { ChevronDown } from 'lucide-react';
import React from 'react';

import { FOCUS_RING } from '../canvas/motionTokens';

export const ToolbarBtn: React.FC<{
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
        ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20'
        : active
          ? 'bg-primary-500/10 text-primary-700 dark:text-primary-300'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
    }`}
    title={label}
  >
    <Icon size={14} />
    {label && <span className="hidden sm:inline">{label}</span>}
  </button>
);

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number }>;
  swatch?: string;
  onClick: () => void;
}

export const ToolbarDropdown: React.FC<{
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  disabled?: boolean;
  items: DropdownItem[];
  onMainClick: () => void;
}> = ({ icon: Icon, label, disabled, items, onMainClick }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

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
          onClick={() => setOpen(!open)}
          disabled={disabled}
          className="inline-flex items-center rounded-r-lg px-0.5 py-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={`${label} options`}
        >
          <ChevronDown size={10} />
        </button>
      </div>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-navy-950/95 border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-lg dark:shadow-[0_0_20px_rgba(0,0,0,0.4)] py-1 min-w-[140px]"
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
        </div>
      )}
    </div>
  );
};
