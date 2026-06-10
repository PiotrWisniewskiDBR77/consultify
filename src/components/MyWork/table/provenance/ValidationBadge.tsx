/**
 * ValidationBadge — Validation status chip for a table record (Block B / T9).
 *
 * Tri-state chip: `unverified` (neutral) · `verified` (emerald) · `flagged`
 * (amber). Clicking the chip opens a small menu with allowed transitions
 * (fetched lazily from the backend on first open). The component is
 * controlled — it surfaces transitions through `onChange` and lets the
 * parent (typically `<ProvenanceCell>`) decide when to call the API.
 *
 * Admin-only transitions are surfaced when `isSuperAdmin = true`. The
 * service-side guard is always authoritative; this prop just toggles the
 * affordance.
 */

import { CheckCircle2, ChevronDown, Circle, Flag } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ValidationStatus } from '@/services/api/recordProvenance.api';

export interface ValidationBadgeProps {
  status: ValidationStatus | null | undefined;
  /** Transitions the user can pick. When undefined the chip is read-only. */
  allowed?: ValidationStatus[];
  /** Caller supplies async handler; we only fire after the user picks. */
  onChange?: (next: ValidationStatus) => Promise<void> | void;
  /** Toggles admin-only `*→unverified` affordance. */
  isSuperAdmin?: boolean;
  /** Disables the menu (e.g. while a request is in flight). */
  disabled?: boolean;
  testId?: string;
}

const STYLES: Record<
  ValidationStatus,
  {
    bg: string;
    fg: string;
    border: string;
    icon: React.ReactNode;
    labelEn: string;
    labelPl: string;
  }
> = {
  unverified: {
    bg: '#f1f5f9',
    fg: '#475569',
    border: '#cbd5e1',
    icon: <Circle size={11} />,
    labelEn: 'Unverified',
    labelPl: 'Niezweryfikowany',
  },
  verified: {
    bg: '#dcfce7',
    fg: '#166534',
    border: '#86efac',
    icon: <CheckCircle2 size={11} />,
    labelEn: 'Verified',
    labelPl: 'Zweryfikowany',
  },
  flagged: {
    bg: '#fef3c7',
    fg: '#92400e',
    border: '#fcd34d',
    icon: <Flag size={11} />,
    labelEn: 'Flagged',
    labelPl: 'Oznaczony',
  },
};

function labelFor(status: ValidationStatus, isPl: boolean): string {
  return isPl ? STYLES[status].labelPl : STYLES[status].labelEn;
}

export const ValidationBadge: React.FC<ValidationBadgeProps> = ({
  status,
  allowed,
  onChange,
  isSuperAdmin = false,
  disabled = false,
  testId = 'provenance-validation-badge',
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const effectiveStatus: ValidationStatus = status ?? 'unverified';
  const palette = STYLES[effectiveStatus];
  const label = labelFor(effectiveStatus, isPl ?? false);
  const interactive = !disabled && !!onChange;

  const visibleAllowed = (allowed ?? []).filter((next) => {
    if (next === effectiveStatus) return false;
    // The *→unverified transitions require super-admin server-side; hide
    // them client-side too unless the caller flagged the actor as admin.
    if (next === 'unverified' && !isSuperAdmin) return false;
    return true;
  });

  const showCaret = interactive && visibleAllowed.length > 0;

  const handlePick = async (next: ValidationStatus): Promise<void> => {
    setOpen(false);
    if (!onChange || next === effectiveStatus) return;
    await onChange(next);
  };

  return (
    <div ref={ref} className="relative inline-flex" data-testid={testId}>
      <button
        type="button"
        disabled={!interactive || !showCaret}
        onClick={() => showCaret && setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:cursor-default"
        style={{
          backgroundColor: palette.bg,
          color: palette.fg,
          borderColor: palette.border,
        }}
        aria-haspopup={showCaret ? 'menu' : undefined}
        aria-expanded={showCaret ? open : undefined}
        aria-label={`${isPl ? 'Status walidacji' : 'Validation status'}: ${label}`}
        title={
          isPl
            ? 'Status walidacji rekordu (zmieniany ręcznie przez recenzenta).'
            : 'Validation status — set manually by a human reviewer.'
        }
      >
        <span aria-hidden style={{ color: palette.fg }}>
          {palette.icon}
        </span>
        <span>{label}</span>
        {showCaret && <ChevronDown size={10} aria-hidden />}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-lg p-1"
          data-testid={`${testId}-menu`}
        >
          {visibleAllowed.map((next) => (
            <button
              key={next}
              role="menuitem"
              type="button"
              onClick={() => {
                void handlePick(next);
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded text-[12px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800"
              data-testid={`${testId}-menu-${next}`}
            >
              <span aria-hidden style={{ color: STYLES[next].fg }}>
                {STYLES[next].icon}
              </span>
              <span>{labelFor(next, isPl ?? false)}</span>
              {next === 'unverified' && (
                <span
                  className="ml-auto text-[9px] uppercase tracking-wider text-slate-600"
                  aria-hidden
                >
                  {isPl ? 'admin' : 'admin'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ValidationBadge;
