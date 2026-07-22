/**
 * IdeaConvertMenu — the single Menu-1 primary "Konwertuj ▾" dropdown for the
 * Ideas EditorShell (Z7). Rendered by `IdeaMapWorkspace` as the shell's
 * `primaryActionSlot`.
 *
 * PRESENTATIONAL — it owns only its open/close state; conversion is the host's
 * real `handleConvert(target)` (the same mechanic the Convert panel uses). The
 * four surfaced targets are driven by the SSOT registry
 * (`ideaConvertTargets.ts`): Inicjatywa / Taski / Raport are `live`; Analiza is
 * `soon` → rendered DISABLED with an honest "wkrótce" hint (never hidden).
 *
 * CRIMSON-SAFE: the trigger is the sole primary CTA styled `bg-c-text
 * text-c-surface`; focus ring is `c-focus`; no crimson tokens.
 */

import { ChevronDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { getConvertTargetMeta, type IdeaConvertTarget } from './ideaConvertTargets';

/** Ordered targets surfaced in the quick dropdown (§Z7 anatomy). */
const QUICK_CONVERT_TARGETS: IdeaConvertTarget[] = [
  'initiative',
  'task_set',
  'report',
  'analysis',
];

export interface IdeaConvertMenuProps {
  onConvert: (target: IdeaConvertTarget) => void;
  isPolish: boolean;
  /** Disables the whole control (e.g. empty canvas). */
  disabled?: boolean;
}

export const IdeaConvertMenu: React.FC<IdeaConvertMenuProps> = ({
  onConvert,
  isPolish,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const soon = isPolish ? 'Wkrótce' : 'Coming soon';

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-c-text text-c-surface hover:bg-c-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
        title={isPolish ? 'Konwertuj ideę' : 'Convert idea'}
        data-testid="idea-menu1-convert"
      >
        <span>{isPolish ? 'Konwertuj' : 'Convert'}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-dropdown min-w-[220px] rounded-token-md border border-c-border-subtle bg-c-surface p-1 shadow-lg"
          data-testid="idea-menu1-convert-menu"
        >
          {QUICK_CONVERT_TARGETS.map((target) => {
            const meta = getConvertTargetMeta(target);
            if (!meta) return null;
            const isSoon = meta.status === 'soon';
            const label = isPolish ? meta.labelPl : meta.labelEn;
            const desc = isPolish ? meta.descPl : meta.descEn;
            return (
              <button
                key={target}
                type="button"
                role="menuitem"
                disabled={isSoon}
                onClick={() => {
                  if (isSoon) return;
                  setOpen(false);
                  onConvert(target);
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title={isSoon ? soon : desc}
                data-testid={`idea-convert-target-${target}`}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium text-c-text">{label}</span>
                  {isSoon ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                      {soon}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-c-text-muted">{desc}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default IdeaConvertMenu;
