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
import { createPortal } from 'react-dom';

import { usePortalSlot } from '@/hooks/usePortalSlot';
import { IDEA_MENU1_TOOL_SLOT_ID } from '@/utils/ideaTableGuidedBarFlag';

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
  /**
   * Optional identity adornment rendered BETWEEN the breadcrumb chevron and the
   * title (e.g. a per-tool type icon). ADDITIVE — omit for the default row.
   */
  titleIconSlot?: React.ReactNode;
  /**
   * Optional slot rendered right AFTER the title, before the command cluster
   * (e.g. a lifecycle stage chip + quiet save indicator). ADDITIVE — omit for
   * the default row.
   */
  titleTrailingSlot?: React.ReactNode;
  /**
   * Optional prominent action rendered in the right command cluster alongside
   * the primary chips (e.g. a "Convert ▾" dropdown the flat chip contract can't
   * express). ADDITIVE — omit for the default row.
   */
  primaryActionSlot?: React.ReactNode;
  /**
   * 2026-07-28 (U3, odbiór "menu pliku") — rendered FIRST inside the chip
   * cluster, ahead of every chip (including the highlighted `kind:'primary'`
   * one) — e.g. a "Plik ▾" dropdown that must be leftmost, Word-convention
   * style. Deliberately lives INSIDE the same flex row as the chips (not a
   * separate `titleTrailingSlot` sibling) so it shares that row's existing
   * width budget instead of adding a whole extra flex item + gap on top of
   * an already chip-heavy bar — see U5 in the same odbiór (title truncation
   * got WORSE when this used to live in a separate sibling slot). ADDITIVE
   * — omit for the default row.
   */
  leadingActionSlot?: React.ReactNode;
  /** Right-cluster slot (presence indicators / version / status dot). */
  presenceSlot?: React.ReactNode;
  /** Optional className for the outer row. */
  className?: string;
  /** Optional `data-testid` override for the row. */
  testId?: string;
  /**
   * SCALENIE W JEDNĄ LINIĘ (opcjonalne, ADDITIVE — pomiń dla domyślnego rzędu).
   *
   * Gdy podane `id` istnieje w DOM, TopBar NIE renderuje własnego rzędu: cały
   * klaster poleceń (`titleTrailingSlot` · chipy · `⋯` · `primaryActionSlot` ·
   * `presenceSlot`) idzie `createPortal`-em do tego węzła, a tożsamość
   * (strzałka wstecz + breadcrumb + tytuł) znika — bo host, który wystawił
   * slot, niesie ją już we własnym rzędzie (rząd pilli otwartych dokumentów).
   *
   * Gdy `id` nie jest podane ALBO węzła nie ma w DOM — render bez zmian
   * (pełny rząd z tożsamością). To bezpiecznik: brak celu portalu nigdy nie
   * może zabrać użytkownikowi nawigacji w górę.
   */
  mergeSlotId?: string;
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
    danger,
  } = descriptor;

  // Overflow menu item — full-width row in the `⋯` dropdown, label always
  // shown. Adopts the Notebook overflow pattern: danger is the ONLY red
  // (destructive) tone; all other rows stay monochrome-chrome.
  if (menuItem) {
    const menuStateClasses = danger
      ? 'text-c-danger hover:bg-c-danger/10'
      : 'text-c-text-secondary hover:bg-c-surface-raised';
    return (
      <button
        type="button"
        role="menuitem"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${menuStateClasses}`}
        title={tooltip ?? label}
        aria-label={label}
        aria-pressed={kind === 'toggle' ? Boolean(active) : undefined}
        data-testid={testId ?? `mels-chip-${id}`}
        data-mels-chip={id}
      >
        {Icon ? (
          <Icon
            size={14}
            aria-hidden="true"
            className={`flex-shrink-0 ${danger ? '' : 'text-c-text-muted'}`}
          />
        ) : null}
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
    // Active/toggle state — neutral blue focus accent (NEVER crimson;
    // `primary-*` in tailwind = crimson #85182F, reserved for destructive semantics).
    stateClasses = 'text-c-focus-solid bg-c-focus/10 hover:bg-c-focus/15';
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
 * Group overflow chips into semantic sections (Notebook overflow pattern).
 * Chips are bucketed by `overflowSection` (order of first appearance),
 * with the unlabelled (undefined) section kept first so the default
 * leading actions stay on top. Order within each section is preserved.
 */
interface OverflowSection {
  key: string;
  heading?: string;
  chips: TopBarChipDescriptor[];
}

function groupOverflowSections(chips: TopBarChipDescriptor[]): OverflowSection[] {
  const sections: OverflowSection[] = [];
  const byKey = new Map<string, OverflowSection>();
  chips.forEach((chip) => {
    const heading = chip.overflowSection;
    const key = heading ?? '__default__';
    let section = byKey.get(key);
    if (!section) {
      section = { key, heading, chips: [] };
      byKey.set(key, section);
      sections.push(section);
    }
    section.chips.push(chip);
  });
  return sections;
}

/**
 * Overflow `⋯` menu — folds rare/advanced chips behind a single button
 * per editor-shell-canon § 2 STREFA GÓRNA. Portaled visually via a
 * `z-dropdown`-tokened panel (canon § 3 z-index scale).
 *
 * Layout follows the Notebook overflow pattern (`NotebookHamburgerMenu`):
 * chips are grouped into semantic sections by `overflowSection`, each
 * section separated by a divider and (when named) an uppercase heading;
 * the sole destructive `danger` chip renders in red.
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

  const sections = groupOverflowSections(chips);

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
          className="absolute right-0 top-full mt-1 z-dropdown min-w-[200px] rounded-token-md border border-c-border-subtle bg-c-surface p-1 shadow-lg"
          data-testid="mels-topbar-overflow-menu"
          onClick={() => setOpen(false)}
        >
          {sections.map((section, sIdx) => (
            <React.Fragment key={section.key}>
              {sIdx > 0 ? (
                <div className="my-1 border-t border-c-border-subtle" aria-hidden="true" />
              ) : null}
              {section.heading ? (
                <div className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {section.heading}
                </div>
              ) : null}
              {section.chips.map((chip) => (
                <Chip key={chip.id} descriptor={chip} menuItem />
              ))}
            </React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/**
 * Slot narzędzia w rzędzie poleceń — miejsce TUŻ PRZED chipami drugorzędnymi
 * (czyli przed „Teresą"), do którego aktywne narzędzie może zaportalować JEDNĄ
 * własną akcję. Powstał na zgłoszenie właściciela „może save koło teresa"
 * (Tabela Idei, 2026-07-28) i jest celowo pusty oraz `display: contents`:
 * bez dzieci nie tworzy pudełka, więc nie łapie `gap` rodzica i NIE zmienia
 * wyglądu Menu 1 w żadnym module. Portaluje do niego tylko narzędzie z włączoną
 * flagą `ff_ideaTableGuidedBar` — przy fladze OFF slot zostaje pusty.
 */
const ToolActionSlot: React.FC = () => (
  <div id={IDEA_MENU1_TOOL_SLOT_ID} data-testid={IDEA_MENU1_TOOL_SLOT_ID} style={{ display: 'contents' }} />
);

export const TopBar: React.FC<TopBarProps> = ({
  moduleLabel,
  title,
  onTitleChange,
  onBack,
  backLabel,
  chips,
  respectMelsOrder = true,
  titleIconSlot,
  titleTrailingSlot,
  primaryActionSlot,
  leadingActionSlot,
  presenceSlot,
  className,
  testId,
  mergeSlotId,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const mergeSlotNode = usePortalSlot(mergeSlotId);

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

  const commit = (nextTitle = draft) => {
    setEditing(false);
    if (nextTitle !== title) onTitleChange?.(nextTitle);
  };

  // ── Scalenie w jedną linię: klaster poleceń portalem do rzędu hosta ────────
  // Kolejność 1:1 ze zgłoszeniem właściciela: Etap · Zapisano · Teresa · ⋯ ·
  // Konwertuj. ZERO pionowego separatora i zero obwódki — właściciel wprost
  // prosił o zdjęcie „zbędnej ramki po prawej stronie" wokół tej grupy.
  if (mergeSlotId && mergeSlotNode) {
    return createPortal(
      <div
        className="flex items-center gap-1.5 min-w-0"
        data-testid="mels-topbar-merged"
        role="toolbar"
        aria-label={`${moduleLabel} top bar`}
      >
        {presenceSlot ? (
          <div className="flex items-center gap-2 flex-shrink-0" data-testid="mels-topbar-presence">
            {presenceSlot}
          </div>
        ) : null}
        {titleTrailingSlot ? (
          <div
            className="flex items-center gap-2 flex-shrink-0"
            data-testid="mels-topbar-title-trailing"
          >
            {titleTrailingSlot}
          </div>
        ) : null}
        <div className="flex items-center gap-1 flex-shrink-0" data-testid="mels-topbar-chips">
          <ToolActionSlot />
          {secondaryChips.map((chip) => (
            <Chip key={chip.id} descriptor={chip} />
          ))}
          <OverflowMenu chips={overflowChips} />
          {primaryChips.map((chip) => (
            <Chip key={chip.id} descriptor={chip} />
          ))}
          {primaryActionSlot}
        </div>
      </div>,
      mergeSlotNode
    );
  }

  return (
    <div
      className={
        'h-14 border-b border-c-border-subtle bg-c-surface flex items-center px-4 gap-3 flex-shrink-0 relative z-sticky ' +
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
          // 2026-07-28 (odbiór "menu pliku", N19): the back control used to be
          // icon-only — its meaning only surfaced on hover (`title`), which is
          // exactly why owners couldn't find "simple navigation" out of a
          // screen. A visible text label next to the arrow (same
          // `hidden md:inline` pattern the chip strip already uses) makes the
          // control's actual behaviour legible at a glance instead of a guess.
          className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          title={backLabel ?? 'Back'}
          aria-label={backLabel ?? 'Back'}
          data-testid="mels-topbar-back"
        >
          <ArrowLeft size={18} className="flex-shrink-0" aria-hidden="true" />
          {backLabel ? <span className="hidden md:inline whitespace-nowrap">{backLabel}</span> : null}
        </button>
      ) : null}

      <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1 text-slate-500 dark:text-slate-400">
        <span className="flex-shrink-0 truncate">{moduleLabel}</span>
        <ChevronRight size={14} className="flex-shrink-0" aria-hidden="true" />
        {titleIconSlot}
        {editing && onTitleChange ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(event) => commit(event.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(e.currentTarget.value);
              if (e.key === 'Escape') {
                setDraft(title);
                setEditing(false);
              }
            }}
            className="bg-transparent border-b border-c-focus-solid text-slate-900 dark:text-white text-sm font-medium outline-none min-w-[200px]"
            data-testid="mels-topbar-title-input"
          />
        ) : (
          // 2026-07-28 (U5, odbiór "menu pliku") — this button used to have no
          // explicit width share: as the ONLY sibling here without
          // `flex-shrink-0`, it should have absorbed all of the row's
          // remaining space, but the observed result ("Audyt p…" with a
          // visibly empty bar at 1280px) means it wasn't reliably getting it.
          // `flex-1 min-w-0` makes it claim the row's leftover width
          // explicitly instead of relying on default flex-item sizing, so it
          // only truncates when space is truly short. Native `title` restores
          // the full string on hover (was missing entirely before).
          <button
            type="button"
            onClick={() => onTitleChange && setEditing(true)}
            title={title}
            className={`min-w-0 flex-1 truncate text-left text-slate-900 dark:text-white font-medium ${
              onTitleChange ? 'hover:text-c-focus-solid' : ''
            }`}
            data-testid="mels-topbar-title"
            disabled={!onTitleChange}
          >
            {title}
          </button>
        )}
      </div>

      {titleTrailingSlot ? (
        <div
          className="flex items-center gap-2 flex-shrink-0"
          data-testid="mels-topbar-title-trailing"
        >
          {titleTrailingSlot}
        </div>
      ) : null}

      <div className="flex items-center gap-1 flex-shrink-0" data-testid="mels-topbar-chips">
        <ToolActionSlot />
        {leadingActionSlot ? (
          <>
            {leadingActionSlot}
            {secondaryChips.length > 0 ||
            overflowChips.length > 0 ||
            primaryChips.length > 0 ||
            primaryActionSlot ? (
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-slate-200 dark:bg-navy-700" />
            ) : null}
          </>
        ) : null}
        {secondaryChips.map((chip) => (
          <Chip key={chip.id} descriptor={chip} />
        ))}
        <OverflowMenu chips={overflowChips} />
        {primaryChips.length > 0 || primaryActionSlot ? (
          <>
            {secondaryChips.length > 0 || overflowChips.length > 0 ? (
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-slate-200 dark:bg-navy-700" />
            ) : null}
            {primaryChips.map((chip) => (
              <Chip key={chip.id} descriptor={chip} />
            ))}
            {primaryActionSlot}
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
