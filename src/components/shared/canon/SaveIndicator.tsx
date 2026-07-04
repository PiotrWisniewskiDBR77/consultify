/**
 * SaveIndicator — canon save-state marker, SEPARATE from lifecycle status
 * (ARTIFACT_ANATOMY_STANDARD §6.3, §9.2 ⑫, §18.1: "wskaźnik zapisu (osobno od
 * lifecycle)"). Lifecycle (Draft/Approved) says WHAT the artifact is; the save
 * indicator says whether the current edit reached the server. They must never
 * be conflated into one badge — this component owns only the latter.
 *
 * Carries its own copy, so it translates via t() (common.saved / common.saving).
 *
 * @example
 *   <SaveIndicator state="saved" />
 *   <SaveIndicator state="saving" />
 *   <SaveIndicator state="error" />
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, CloudOff } from 'lucide-react';

export type SaveState = 'saved' | 'saving' | 'error' | 'idle';

export interface SaveIndicatorProps {
  /** Current save state. `idle` renders nothing. */
  state: SaveState;
  /** Extra classes on the root. */
  className?: string;
}

/**
 * Small, quiet save-state marker. Icon + one word. Never uses crimson; the
 * error tone is `c-danger` (a real failure signal), not the brand accent.
 */
export const SaveIndicator: React.FC<SaveIndicatorProps> = ({ state, className = '' }) => {
  const { t } = useTranslation();

  if (state === 'idle') return null;

  if (state === 'saving') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] text-c-text-muted ${className}`.trim()}
        aria-live="polite"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        {t('common.saving', { defaultValue: 'Saving…' })}
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] text-c-danger ${className}`.trim()}
        aria-live="polite"
      >
        <CloudOff className="h-3 w-3" aria-hidden="true" />
        {t('common.saveFailed', { defaultValue: 'Save failed' })}
      </span>
    );
  }

  // saved
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] text-c-text-muted ${className}`.trim()}
      aria-live="polite"
    >
      <Check className="h-3 w-3 text-c-success" aria-hidden="true" />
      {t('common.saved', { defaultValue: 'Saved' })}
    </span>
  );
};

export default SaveIndicator;
