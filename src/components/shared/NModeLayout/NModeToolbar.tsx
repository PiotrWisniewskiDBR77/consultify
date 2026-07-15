/**
 * NModeToolbar
 *
 * Unified 9-slot toolbar for artifact detail views (Insights, Initiatives).
 * Designed for the sticky toolbar segment of NModeShell.
 *
 * Slot layout (left → right):
 *   [sectionsDropdown] [newButton] [exportDropdown]  |  [activeSectionLabel]  |  [aiSectionButton]  ··  [fork] [present]  ··  [aiArtifactButton]
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

import { GitFork, Monitor } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

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
}) => {
  const { i18n } = useTranslation();
  const pl = isPolish ?? i18n.language === 'pl';
  const t = i18n.getFixedT(pl ? 'pl' : 'en');

  const hasLeft = sectionsDropdown || newButton || exportDropdown;
  const hasCenter = activeSectionLabel || aiSectionButton;
  const hasRight = onFork || onPresent || aiArtifactButton;

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
      {hasRight && (
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
        </div>
      )}
    </div>
  );
};

export default NModeToolbar;
