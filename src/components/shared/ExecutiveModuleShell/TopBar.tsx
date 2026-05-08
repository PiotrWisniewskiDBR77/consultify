/**
 * TopBar — single-row top bar for `ExecutiveModuleShell`
 * (MELS § 2 Zone A · EPIC-T16 D1).
 *
 * Renders three clusters:
 *   * Left: back arrow + breadcrumb + editable title.
 *   * Center: chip strip (functional buttons).
 *   * Right: caller-supplied presence / status / version slot.
 *
 * Constraints (MELS § 2.A):
 *   * No second toolbar below this row.
 *   * DBR77 monochrome — no per-module accent colors except via
 *     `dotTone` on chips.
 *   * Chips overflow into a `…` menu only on viewports < 1280 px (the
 *     menu lives in the parent shell; this component just renders the
 *     visible strip).
 */

import { ArrowLeft, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';

import {
  type TopBarChipDescriptor,
  type TopBarChipDotTone,
  sortChipsByMelsOrder,
} from './ChipDescriptor';

interface TopBarProps {
  moduleLabel: string;
  title: string;
  onTitleChange?: (next: string) => void;
  onBack?: () => void;
  backLabel?: string;
  chips: TopBarChipDescriptor[];
  /** When true, the shell will sort chips by canonical MELS order. */
  respectMelsOrder?: boolean;
  /** Right-cluster slot (presence indicators / version / status dot). */
  presenceSlot?: React.ReactNode;
  /** Optional className for the outer row. */
  className?: string;
  /** Optional `data-testid` override for the row. */
  testId?: string;
}

const DOT_TONE_CLASS: Record<Exclude<TopBarChipDotTone, null>, string> = {
  neutral: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
};

const Chip: React.FC<{ descriptor: TopBarChipDescriptor }> = ({ descriptor }) => {
  const {
    icon: Icon,
    label,
    onClick,
    active,
    disabled,
    dotTone,
    kind = 'standard',
    tooltip,
    testId,
    id,
  } = descriptor;

  const baseClasses =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors flex-shrink-0';

  let stateClasses = '';
  if (kind === 'primary') {
    stateClasses =
      'bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed';
  } else if (active) {
    stateClasses =
      'text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-500/10 hover:bg-primary-100 dark:hover:bg-primary-500/15';
  } else {
    stateClasses =
      'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed';
  }

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`${baseClasses} ${stateClasses}`}
      title={tooltip ?? label}
      aria-label={label}
      aria-pressed={kind === 'toggle' ? Boolean(active) : undefined}
      data-testid={testId ?? `mels-chip-${id}`}
      data-mels-chip={id}
    >
      {Icon ? <Icon size={14} aria-hidden="true" /> : null}
      <span className="hidden md:inline">{label}</span>
      {dotTone ? (
        <span
          aria-hidden="true"
          className={`w-1.5 h-1.5 rounded-full ${DOT_TONE_CLASS[dotTone]}`}
        />
      ) : null}
    </button>
  );
};

export const TopBar: React.FC<TopBarProps> = ({
  moduleLabel,
  title,
  onTitleChange,
  onBack,
  backLabel,
  chips,
  respectMelsOrder = true,
  presenceSlot,
  className,
  testId,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  React.useEffect(() => {
    setDraft(title);
  }, [title]);

  const orderedChips = respectMelsOrder ? sortChipsByMelsOrder(chips) : chips;

  const commit = () => {
    setEditing(false);
    if (draft !== title) onTitleChange?.(draft);
  };

  return (
    <div
      className={
        'h-14 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex items-center px-4 gap-3 flex-shrink-0 ' +
        (className ?? '')
      }
      data-testid={testId ?? 'mels-topbar'}
      role="toolbar"
      aria-label={`${moduleLabel} top bar`}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          title={backLabel ?? 'Back'}
          aria-label={backLabel ?? 'Back'}
          data-testid="mels-topbar-back"
        >
          <ArrowLeft size={18} />
        </button>
      ) : null}

      <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1 text-slate-500 dark:text-slate-400">
        <span className="flex-shrink-0 truncate">{moduleLabel}</span>
        <ChevronRight size={14} className="flex-shrink-0" aria-hidden="true" />
        {editing && onTitleChange ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(title);
                setEditing(false);
              }
            }}
            className="bg-transparent border-b border-primary-500 text-slate-900 dark:text-white text-sm font-medium outline-none min-w-[200px]"
            data-testid="mels-topbar-title-input"
          />
        ) : (
          <button
            type="button"
            onClick={() => onTitleChange && setEditing(true)}
            className={`text-slate-900 dark:text-white font-medium truncate ${
              onTitleChange ? 'hover:text-primary-600 dark:hover:text-primary-400' : ''
            }`}
            data-testid="mels-topbar-title"
            disabled={!onTitleChange}
          >
            {title}
          </button>
        )}
      </div>

      <div
        className="flex items-center gap-1 flex-shrink-0"
        data-testid="mels-topbar-chips"
      >
        {orderedChips.map((chip) => (
          <Chip key={chip.id} descriptor={chip} />
        ))}
      </div>

      {presenceSlot ? (
        <div
          className="flex items-center gap-2 flex-shrink-0 ml-auto pl-2"
          data-testid="mels-topbar-presence"
        >
          {presenceSlot}
        </div>
      ) : null}
    </div>
  );
};

export default TopBar;
