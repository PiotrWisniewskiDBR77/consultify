/**
 * DatePicker — custom popover calendar (portal-based, auto-flip).
 *
 * Replaces the inconsistent native <input type="date">. The trigger is a chip
 * showing the formatted date + a calendar icon. The popover is portaled to
 * `document.body` (fixed position, viewport-clamp, auto-flip, outside-click +
 * Escape dismiss) and offers quick shortcuts (Today / Tomorrow / Next week)
 * plus a month grid. Renders identically across browsers.
 *
 * Value contract matches the native date input: an ISO date string
 * (`YYYY-MM-DD`) or '' when unset, so existing wiring stays intact.
 */

import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';

import { useDismiss, usePopoverPosition } from './usePopoverPosition';

const PANEL_WIDTH = 280;

export interface DatePickerProps {
  /** ISO date string `YYYY-MM-DD` or '' when unset. */
  value: string;
  onChange: (value: string) => void;
  /** Minimum selectable ISO date (inclusive). */
  min?: string;
  placeholder?: string;
  disabled?: boolean;
  isPolish?: boolean;
  className?: string;
  'aria-label'?: string;
}

const DAY_LABELS = {
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  pl: ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'],
};

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISO(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const TRIGGER_CLASS =
  'flex h-10 w-full items-center gap-2 rounded-xl border ' +
  'border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] ' +
  'px-3 text-left text-sm transition-colors ' +
  'hover:border-slate-300 dark:hover:border-white/20 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const PANEL_CLASS =
  'fixed z-context-menu rounded-xl border border-slate-200/70 dark:border-white/[0.08] ' +
  'bg-white dark:bg-navy-800 p-3 shadow-[0_8px_30px_rgba(15,23,42,0.18)] focus:outline-none';

const SHORTCUT_CLASS =
  'rounded-full border border-slate-200/70 dark:border-white/[0.08] px-2.5 py-1 ' +
  'text-[11px] text-slate-600 dark:text-slate-300 transition-colors ' +
  'hover:border-primary-400 hover:bg-primary-500/10';

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  min,
  placeholder,
  disabled,
  isPolish,
  className,
  'aria-label': ariaLabel,
}) => {
  const { i18n } = useTranslation();
  const t = i18n.getFixedT(isPolish ? 'pl' : 'en');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => parseISO(value), [value]);
  const minDate = useMemo(() => (min ? parseISO(min) : null), [min]);

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const close = useCallback(() => setOpen(false), []);
  const pos = usePopoverPosition({ open, triggerRef, panelRef, width: PANEL_WIDTH });
  useDismiss(open, close, [triggerRef, panelRef]);

  const locale = isPolish ? 'pl-PL' : 'en-US';

  const formatted = useMemo(() => {
    if (!selected) return null;
    return selected.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [selected, locale]);

  const monthLabel = useMemo(
    () => viewMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
    [viewMonth, locale]
  );

  // Build the calendar grid (Monday-first), padded to full weeks.
  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // 0 = Monday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: Array<Date | null> = [];
    for (let i = 0; i < offset; i += 1) out.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewMonth]);

  const isDisabled = useCallback(
    (d: Date) => (minDate ? startOfDay(d) < startOfDay(minDate) : false),
    [minDate]
  );

  const pick = useCallback(
    (d: Date) => {
      if (isDisabled(d)) return;
      onChange(toISO(d));
      setOpen(false);
    },
    [isDisabled, onChange]
  );

  const shortcut = useCallback(
    (offsetDays: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      pick(startOfDay(d));
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    },
    [pick]
  );

  const dayLabels = isPolish ? DAY_LABELS.pl : DAY_LABELS.en;
  const todayISO = toISO(new Date());

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((p) => !p)}
        className={cn(TRIGGER_CLASS, className)}
      >
        <CalendarIcon size={16} className="shrink-0 text-slate-400" />
        <span className={cn('truncate', !formatted && 'text-slate-400')}>
          {formatted ?? placeholder}
        </span>
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={ariaLabel ?? 'Date picker'}
              tabIndex={-1}
              style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH }}
              className={PANEL_CLASS}
            >
              {/* Shortcuts */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                <button type="button" className={SHORTCUT_CLASS} onClick={() => shortcut(0)}>
                  {t('sharedComponents.datePicker.today')}
                </button>
                <button type="button" className={SHORTCUT_CLASS} onClick={() => shortcut(1)}>
                  {t('sharedComponents.datePicker.tomorrow')}
                </button>
                <button type="button" className={SHORTCUT_CLASS} onClick={() => shortcut(7)}>
                  {t('sharedComponents.datePicker.nextWeek')}
                </button>
              </div>

              {/* Month header */}
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  aria-label={t('sharedComponents.datePicker.previousMonth')}
                  onClick={() =>
                    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
                  }
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium capitalize text-slate-900 dark:text-white">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  aria-label={t('sharedComponents.datePicker.nextMonth')}
                  onClick={() =>
                    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
                  }
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Day-of-week labels */}
              <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] text-slate-400">
                {dayLabels.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((d, i) => {
                  if (!d) return <span key={`pad-${i}`} />;
                  const iso = toISO(d);
                  const isSel = iso === value;
                  const isToday = iso === todayISO;
                  const off = isDisabled(d);
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={off}
                      aria-pressed={isSel}
                      onClick={() => pick(d)}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors',
                        isSel
                          ? 'bg-navy-900 font-semibold text-white dark:bg-white dark:text-navy-950'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]',
                        !isSel && isToday && 'ring-1 ring-inset ring-primary-400',
                        off &&
                          'cursor-not-allowed text-slate-300 hover:bg-transparent dark:text-slate-600'
                      )}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
};

export default DatePicker;
