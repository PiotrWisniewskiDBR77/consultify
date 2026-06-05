/**
 * AIAssist — the canonical AI-support control, at three granularities
 * (owner principle, master plan §6 — AI is a copilot, not autopilot):
 *
 *   level="tool"     whole artifact (toolbar)     e.g. "Regenerate insight"
 *   level="section"  one card/section (header)    e.g. "Regenerate this section"
 *   level="field"    one field/column/cell        e.g. "Suggest a value"
 *
 * Today every section hand-rolls its own AI buttons + duplicates the
 * `canUseAi` gate, toast, disabled and spinner logic (see InitiativeDocumentView
 * ~line 8290+). This primitive centralizes all of that so the behavior is
 * identical everywhere and wiring is a clean swap.
 *
 * Contract matches the existing pattern: a `canUseAi` boolean (from backend
 * capabilities), per-action `running` state, and an `onRun` handler. With one
 * action it renders a single button; with several it renders a dropdown.
 */

import { ChevronDown, Loader2, type LucideIcon, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

import type { AIAssistLevel } from './types';

export interface AIAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  onRun: () => void;
  /** True while this action's request is in flight (shows a spinner). */
  running?: boolean;
  /** Render in a destructive tone (e.g. "Regenerate — replaces content"). */
  danger?: boolean;
}

export interface AIAssistProps {
  level: AIAssistLevel;
  actions: AIAction[];
  /** Backend-owned: when false the control is disabled and explains why. */
  canUseAi: boolean;
  /** Tooltip + toast shown when the user activates a disabled control. */
  disabledReason?: string;
  /** Label for the trigger when collapsed (defaults to "AI"). */
  triggerLabel?: string;
  isPolish?: boolean;
  className?: string;
}

const SIZE: Record<AIAssistLevel, { btn: string; icon: number; gap: string }> = {
  tool: { btn: 'h-8 px-3 text-xs rounded-lg', icon: 14, gap: 'gap-1.5' },
  section: { btn: 'h-7 px-2.5 text-[11px] rounded-full', icon: 13, gap: 'gap-1.5' },
  field: { btn: 'h-6 w-6 rounded-md justify-center', icon: 12, gap: '' },
};

const baseTrigger =
  'inline-flex items-center font-medium border transition-colors disabled:opacity-50 disabled:pointer-events-none';
const enabledTone =
  'border-primary-400/50 bg-white/70 text-primary-600 hover:bg-primary-500/10 dark:border-primary-500/30 dark:bg-white/[0.04] dark:text-primary-300 dark:hover:bg-primary-400/10';

export const AIAssist: React.FC<AIAssistProps> = ({
  level,
  actions,
  canUseAi,
  disabledReason,
  triggerLabel = 'AI',
  isPolish = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const size = SIZE[level];

  const defaultReason = isPolish
    ? 'AI jest niedostępne — brak uprawnień edycji w tym kontekście.'
    : 'AI is unavailable — you have no edit permissions in this context.';
  const reason = disabledReason || defaultReason;

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

  const guard = useCallback(
    (fn: () => void) => {
      if (!canUseAi) {
        toast.error(reason);
        return;
      }
      fn();
    },
    [canUseAi, reason]
  );

  if (actions.length === 0) return null;

  const anyRunning = actions.some((a) => a.running);

  // Single action → single button (no dropdown).
  if (actions.length === 1) {
    const a = actions[0];
    const Icon = a.icon || Sparkles;
    return (
      <button
        type="button"
        onClick={() => guard(a.onRun)}
        disabled={!canUseAi || a.running}
        title={!canUseAi ? reason : a.label}
        aria-label={a.label}
        className={`${baseTrigger} ${size.btn} ${size.gap} ${enabledTone} ${className}`}
      >
        {a.running ? (
          <Loader2 size={size.icon} className="animate-spin" />
        ) : (
          <Icon size={size.icon} />
        )}
        {level !== 'field' && (
          <span>{a.running ? (isPolish ? 'Pracuję…' : 'Working…') : a.label}</span>
        )}
      </button>
    );
  }

  // Multiple actions → dropdown.
  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => (canUseAi ? setOpen((o) => !o) : toast.error(reason))}
        disabled={!canUseAi}
        title={!canUseAi ? reason : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${baseTrigger} ${size.btn} ${size.gap} ${enabledTone}`}
      >
        {anyRunning ? (
          <Loader2 size={size.icon} className="animate-spin" />
        ) : (
          <Sparkles size={size.icon} />
        )}
        {level !== 'field' && <span>{triggerLabel}</span>}
        {level !== 'field' && (
          <ChevronDown
            size={size.icon - 2}
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-xl dark:border-white/[0.08] dark:bg-navy-900"
        >
          <div className="max-h-[280px] overflow-y-auto p-1">
            {actions.map((a) => {
              const Icon = a.icon || Sparkles;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    guard(a.onRun);
                  }}
                  disabled={a.running}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors disabled:opacity-50 ${
                    a.danger
                      ? 'text-rose-600 hover:bg-rose-500/10 dark:text-rose-300'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {a.running ? (
                    <Loader2 size={13} className="shrink-0 animate-spin" />
                  ) : (
                    <Icon size={13} className="shrink-0" />
                  )}
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssist;
