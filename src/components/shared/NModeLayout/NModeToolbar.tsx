/**
 * NModeToolbar
 *
 * Unified 9-slot toolbar for artifact detail views (Insights, Initiatives).
 * Designed for the sticky toolbar segment of NModeShell.
 *
 * Slot layout (left → right):
 *   [sectionsDropdown] [newButton] [exportDropdown]  |  [activeSectionLabel]  |  [aiSectionButton]  ··  [fork] [present]  ··  [aiArtifactButton] [overflow "…"]
 *
 * Overflow (SPEC-N §2.4 / DOKTRYNA_GESTOSCI §1): akcje drugorzedne przekazuje
 * sie propem `overflowActions` — komponent sam renderuje trigger "…" i menu.
 * Karta NIE pisze wlasnego "…"; przy >5 widocznych slotach bez tego propa
 * leci dev-warn.
 *
 * Color system:
 *   Ghost     = border-slate-200 text-slate-600 hover:bg-slate-50
 *   Subtle    = bg-slate-100 text-slate-700 hover:bg-slate-200
 *   AI split  = bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100
 *   AI solid  = bg-teal-600 text-white hover:bg-teal-700
 *   Icon-only = text-slate-500 hover:bg-slate-100 rounded-lg
 *
 * @see docs/ui-standards/03-modules/BLOCK_TYPES_CANON.md §Toolbar Standard
 */

import type { LucideIcon } from 'lucide-react';
import { GitFork, Monitor, MoreHorizontal } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Akcja drugorzedna toolbara — pozycja menu "...".
 *
 * Ksztalt celowo identyczny z `ActionButton` z PreviewActionBar.tsx (pola
 * label/icon/onClick/disabled), zeby autor karty przenoszacy akcje z paska
 * bocznego do toolbara nie musial ich przepisywac. `icon` jest `LucideIcon`
 * (nie ReactNode jak w slotach powyzej), bo menu samo nadaje rozmiar 14px —
 * tak samo jak w PreviewActionBar.
 */
export interface NModeToolbarAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}

export interface NModeToolbarProps {
  /** Left group: section navigation dropdown (pass pre-built ReactNode) */
  sectionsDropdown?: React.ReactNode;
  /** Left group: "New" button for adding items in the active section */
  newButton?: React.ReactNode;
  /** Left group: export destination dropdown */
  exportDropdown?: React.ReactNode;
  /** Center: label for the currently active section (plain text) */
  activeSectionLabel?: string;
  /** Center-right: context AI action for the active section (ReactNode button) */
  aiSectionButton?: React.ReactNode;
  /** Right group: fork handler — creates new artifact linked to this one */
  onFork?: () => void;
  /** Right group: present mode handler — enters fullscreen presentation */
  onPresent?: () => void;
  /** Right group: whole-artifact AI consultant button */
  aiArtifactButton?: React.ReactNode;
  /** Language switch (passed from i18n context by parent) */
  isPolish?: boolean;
  /**
   * Akcje drugorzedne — chowane pod trigger "..." zamiast psuc gestosc toolbara.
   *
   * KANON: SPEC-N §2.4 (jedna droga budowy toolbara) + DOKTRYNA_GESTOSCI §1
   * (max 5 widocznych akcji, 6+ → obowiazkowy overflow).
   *
   * Powod istnienia: Initiative ma dzis 9 GRUP kontrolek w toolbarze,
   * Notification 7 przyciskow plasko bez zadnego overflow. Bez tego propa kazda
   * karta pisze wlasne "..." recznie — dokladnie to stalo sie DWA RAZY w jeden
   * wieczor 2026-07-21, zanim ta sama zdolnosc trafila do PreviewActionBar.
   * Dolacz akcje tutaj, komponent renderuje trigger + menu za Ciebie.
   *
   * Renderowane jako ikona-only przycisk doklejony na KONCU paska (za prawa
   * grupa; gdy prawej grupy nie ma — jako samodzielny element po spacerze).
   */
  overflowActions?: NModeToolbarAction[];
  /** aria-label triggera overflow. Domyslnie angielski (icon-only, jak reszta ikon-buttonow w repo) — podaj przetlumaczony string, jesli ekran tego wymaga. */
  overflowLabel?: string;
  /**
   * Nadpisanie liczby widocznych akcji na potrzeby ostrzezenia dev (§2.4).
   *
   * Sloty toolbara przyjmuja `React.ReactNode`, wiec komponent nie widzi ile
   * przyciskow siedzi w srodku — np. `sectionsDropdown` moze byc jedna grupa
   * z czterema kontrolkami. Karta, ktora upycha grupy w sloty, podaje tu
   * realna liczbe, zeby licznik nie klamal w dol. Bez tego propa liczymy
   * konserwatywnie: jeden slot = jedna akcja.
   */
  visibleActionCount?: number;
}

/** Base classes shared by all toolbar buttons */
const BASE =
  'inline-flex items-center gap-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50';

/** Ghost button — text only, border on hover */
export const ToolbarGhostButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }
> = ({ icon, children, className = '', ...rest }) => (
  <button
    className={`${BASE} px-2.5 py-1.5 border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-400 dark:hover:border-navy-600 dark:hover:bg-navy-800/50 ${className}`}
    {...rest}
  >
    {icon && <span className="shrink-0">{icon}</span>}
    {children}
  </button>
);

/** Subtle button — filled slate background */
export const ToolbarSubtleButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }
> = ({ icon, children, className = '', ...rest }) => (
  <button
    className={`${BASE} px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-navy-700 ${className}`}
    {...rest}
  >
    {icon && <span className="shrink-0">{icon}</span>}
    {children}
  </button>
);

/** AI split button — teal border, used for section-level AI */
export const ToolbarAISplitButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }
> = ({ icon, children, className = '', ...rest }) => (
  <button
    className={`${BASE} px-2.5 py-1.5 bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/20 dark:border-teal-700/40 dark:text-teal-300 dark:hover:bg-teal-900/40 ${className}`}
    {...rest}
  >
    {icon && <span className="shrink-0">{icon}</span>}
    {children}
  </button>
);

/** AI solid button — teal filled, used for artifact-level AI consultant */
export const ToolbarAISolidButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }
> = ({ icon, children, className = '', ...rest }) => (
  <button
    className={`${BASE} px-3 py-1.5 bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 shadow-sm ${className}`}
    {...rest}
  >
    {icon && <span className="shrink-0">{icon}</span>}
    {children}
  </button>
);

/** Icon-only ghost button */
export const ToolbarIconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ReactNode; tooltip?: string }
> = ({ icon, tooltip, className = '', ...rest }) => (
  <button
    title={tooltip}
    className={`${BASE} p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800/60 ${className}`}
    {...rest}
  >
    {icon}
  </button>
);

/** Divider between toolbar groups */
const Divider: React.FC = () => (
  <div className="h-4 w-px bg-slate-200 dark:bg-navy-700 mx-1 shrink-0" />
);

/**
 * Trigger "..." + menu akcji drugorzednych (SPEC-N §2.4).
 *
 * Ksztalt menu 1:1 z OverflowTrigger z PreviewActionBar.tsx (te same wymiary,
 * ta sama kolejnosc, ten sam backdrop zamykajacy, ten sam domyslny aria-label).
 * Roznica: klasy sa na tokenach `c-*`, bo to NOWY kod powloki — reszta tego
 * pliku stoi na starych `slate-*`/`teal-*` i nie jest tu ruszana (§2.4 mowi
 * o zdolnosci, nie o re-skinie).
 */
const OverflowTrigger: React.FC<{
  actions: NModeToolbarAction[];
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}> = ({ actions, label, open, onToggle, onClose }) => (
  <div className="relative shrink-0">
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      className={`${BASE} p-1.5 text-c-text-muted hover:bg-state-hover focus-visible:ring-c-focus`}
    >
      <MoreHorizontal size={14} />
    </button>
    {open ? (
      <>
        <div className="fixed inset-0 z-dropdown" onClick={onClose} />
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-overlay w-52 rounded-xl border border-c-border-subtle bg-c-surface-raised shadow-xl overflow-hidden"
        >
          {actions.map((btn, i) => {
            const Icon = btn.icon;
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => {
                  btn.onClick();
                  onClose();
                }}
                disabled={btn.disabled}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-c-surface text-c-text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {Icon ? <Icon size={14} /> : null}
                {btn.label}
              </button>
            );
          })}
        </div>
      </>
    ) : null}
  </div>
);

export const NModeToolbar: React.FC<NModeToolbarProps> = ({
  sectionsDropdown,
  newButton,
  exportDropdown,
  activeSectionLabel,
  aiSectionButton,
  onFork,
  onPresent,
  aiArtifactButton,
  isPolish,
  overflowActions,
  overflowLabel = 'More actions',
  visibleActionCount,
}) => {
  const { i18n } = useTranslation();
  const pl = isPolish ?? i18n.language === 'pl';
  const t = i18n.getFixedT(pl ? 'pl' : 'en');
  const [overflowOpen, setOverflowOpen] = useState(false);

  const hasLeft = sectionsDropdown || newButton || exportDropdown;
  const hasCenter = activeSectionLabel || aiSectionButton;
  const hasRight = onFork || onPresent || aiArtifactButton;

  // DOKTRYNA_GESTOSCI §1 / SPEC-N §2.4: >5 widocznych akcji wymaga overflow.
  // Ostrzezenie w konsoli dev, nie blokada — wyjatek moze byc uzasadniony, ale
  // autor ekranu ma o nim wiedziec w momencie budowy, nie na odbiorze zrzutu.
  // Liczymy sloty (activeSectionLabel to etykieta, nie akcja — pomijamy);
  // karta z grupami w slotach podaje realna liczbe w `visibleActionCount`.
  if (process.env.NODE_ENV !== 'production') {
    const slotow = [
      sectionsDropdown,
      newButton,
      exportDropdown,
      aiSectionButton,
      onFork,
      onPresent,
      aiArtifactButton,
    ].filter(Boolean).length;
    const widocznych = visibleActionCount ?? slotow;
    if (widocznych > 5 && !overflowActions?.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[NModeToolbar] ${widocznych} widocznych akcji (limit: 5, DOKTRYNA_GESTOSCI §1 / SPEC-N §2.4). ` +
          `Przenies nadmiarowe do propa "overflowActions" zamiast pisac wlasny przycisk "...".`
      );
    }
  }

  const overflowProps = overflowActions?.length
    ? {
        actions: overflowActions,
        label: overflowLabel,
        open: overflowOpen,
        onToggle: () => setOverflowOpen((v) => !v),
        onClose: () => setOverflowOpen(false),
      }
    : null;

  return (
    <div className="flex items-center gap-1 min-h-[36px] flex-wrap">
      {/* ── Left group ──────────────────────────────────────────── */}
      {hasLeft && (
        <div className="flex items-center gap-1">
          {sectionsDropdown}
          {newButton}
          {exportDropdown}
        </div>
      )}

      {/* ── Center: active section label ────────────────────────── */}
      {hasCenter && (
        <>
          {hasLeft && <Divider />}
          <div className="flex items-center gap-1.5">
            {activeSectionLabel && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 px-1">
                {activeSectionLabel}
              </span>
            )}
            {aiSectionButton}
          </div>
        </>
      )}

      {/* ── Spacer ──────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Right group ─────────────────────────────────────────── */}
      {/* Prawa grupa renderuje sie takze wtedy, gdy sa SAME overflowActions —
          trigger "..." musi miec gdzie usiasc (SPEC-N §2.4). */}
      {(hasRight || overflowProps) && (
        <div className="flex items-center gap-1">
          {onFork && (
            <ToolbarIconButton
              icon={<GitFork size={14} />}
              tooltip={t('sharedComponents.nModeToolbar.fork')}
              onClick={onFork}
            />
          )}
          {onPresent && (
            <ToolbarIconButton
              icon={<Monitor size={14} />}
              tooltip={t('sharedComponents.nModeToolbar.present')}
              onClick={onPresent}
            />
          )}
          {(onFork || onPresent) && aiArtifactButton && <Divider />}
          {aiArtifactButton}
          {overflowProps ? <OverflowTrigger {...overflowProps} /> : null}
        </div>
      )}
    </div>
  );
};

export default NModeToolbar;
