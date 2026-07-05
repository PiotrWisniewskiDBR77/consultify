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
 *   * Command-row hierarchy (editor-shell-canon § 2 STREFA GÓRNA):
 *     chips are partitioned into three tiers by `resolveChipGroup` —
 *     `primary` (prominent, always visible) · `secondary` (ghost,
 *     grouped) · `overflow` (folded behind a `⋯` menu). No flat row of
 *     equal-weight buttons.
 */

import { ArrowLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import {
  resolveChipGroup,
  sortChipsByMelsOrder,
  type TopBarChipDescriptor,
  type TopBarChipDotTone,
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
  danger: 'bg-danger-500',
  info: 'bg-sky-500',
};

const Chip: React.FC<{ descriptor: TopBarChipDescriptor; menuItem?: boolean }> = ({
  descriptor,
  menuItem = false,
}) => {
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

  // Overflow menu item — full-width row in the `⋯` dropdown, label always shown.
  if (menuItem) {
    return (
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-sm text-left text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title={tooltip ?? label}
        aria-label={label}
        aria-pressed={kind === 'toggle' ? Boolean(active) : undefined}
        data-testid={testId ?? `mels-chip-${id}`}
        data-mels-chip={id}
      >
        {Icon ? <Icon size={14} aria-hidden="true" className="flex-shrink-0" /> : null}
        <span className="flex-1 truncate">{label}</span>
        {dotTone ? (
          <span
            aria-hidden="true"
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_TONE_CLASS[dotTone]}`}
          />
        ) : null}
      </button>
    );
  }

  const baseClasses =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors flex-shrink-0';

  let stateClasses = '';
  if (kind === 'primary') {
    // Primary tier — prominent accent button (only 1-4 per module).
    stateClasses =
      'bg-c-text text-c-bg hover:bg-c-text-secondary disabled:opacity-50 disabled:cursor-not-allowed';
  } else if (active) {
    stateClasses =
      'text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-500/10 hover:bg-primary-100 dark:hover:bg-primary-500/15';
  } else {
    // Secondary tier — ghost button, lower visual weight.
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

/**
 * Overflow `⋯` menu — folds rare/advanced chips behind a single button
 * per editor-shell-canon § 2 STREFA GÓRNA. Portaled visually via a
 * `z-dropdown`-tokened panel (canon § 3 z-index scale).
 */
const OverflowMenu: React.FC<{ chips: TopBarChipDescriptor[] }> = ({ chips }) => {
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

  if (chips.length === 0) return null;

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
        title="More actions"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="mels-topbar-overflow"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-dropdown min-w-[200px] rounded-token-md border border-c-border bg-c-surface p-1 shadow-lg"
          data-testid="mels-topbar-overflow-menu"
          onClick={() => setOpen(false)}
        >
          {chips.map((chip) => (
            <Chip key={chip.id} descriptor={chip} menuItem />
          ))}
        </div>
      ) : null}
    </div>
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

  // Command-row hierarchy (editor-shell-canon § 2 STREFA GÓRNA): partition
  // into three tiers. Secondary sits left of primary; overflow folds into
  // the `⋯` menu. Order within each tier is preserved from `orderedChips`.
  const secondaryChips = orderedChips.filter((c) => resolveChipGroup(c) === 'secondary');
  const primaryChips = orderedChips.filter((c) => resolveChipGroup(c) === 'primary');
  const overflowChips = orderedChips.filter((c) => resolveChipGroup(c) === 'overflow');

  const commit = () => {
    setEditing(false);
    if (draft !== title) onTitleChange?.(draft);
  };

  return (
    <div
      className={
        'h-14 border-b border-c-border bg-c-surface flex items-center px-4 gap-3 flex-shrink-0 relative z-sticky ' +
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

      <div className="flex items-center gap-1 flex-shrink-0" data-testid="mels-topbar-chips">
        {secondaryChips.map((chip) => (
          <Chip key={chip.id} descriptor={chip} />
        ))}
        <OverflowMenu chips={overflowChips} />
        {primaryChips.length > 0 ? (
          <>
            {secondaryChips.length > 0 || overflowChips.length > 0 ? (
              <span
                aria-hidden="true"
                className="mx-1 h-5 w-px bg-slate-200 dark:bg-navy-700"
              />
            ) : null}
            {primaryChips.map((chip) => (
              <Chip key={chip.id} descriptor={chip} />
            ))}
          </>
        ) : null}
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
