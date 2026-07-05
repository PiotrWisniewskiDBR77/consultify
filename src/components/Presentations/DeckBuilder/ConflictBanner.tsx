/**
 * ConflictBanner — P3.1 collaboration conflict resolution.
 *
 * Shown when the deck autosave returns a 409 VERSION_CONFLICT, i.e. another
 * session (collaborator) saved the deck while this session was editing. Rather
 * than silently overwriting the local edits with the server copy, we surface
 * this banner so the user makes an explicit choice:
 *   - "Reload latest" → adopt the server deck (local unsaved edits discarded)
 *   - "Keep my version" → force-save on top (last-write-wins), edits preserved
 *
 * This is intentionally last-write-wins with a visible warning, not a full CRDT
 * merge. It removes the silent data-loss window from the previous auto-refresh.
 */

import { AlertTriangle, RefreshCw, Save } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ConflictBannerProps {
  serverVersion: number | null;
  onReload: () => void;
  onKeepMine: () => void;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({
  serverVersion,
  onReload,
  onKeepMine,
}) => {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      data-testid="deck-conflict-banner"
      className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900"
    >
      <AlertTriangle size={16} className="shrink-0 text-amber-600" />
      <div className="flex-1 min-w-0 text-sm">
        <span className="font-medium">
          {t('presentations.builder.conflict.title', 'This deck was changed in another session')}
        </span>
        {serverVersion != null && (
          <span className="ml-1 text-amber-700">
            {t('presentations.builder.conflict.serverVersion', '(latest is v{{version}})', {
              version: serverVersion,
            })}
          </span>
        )}
        <span className="ml-1 text-amber-700">
          {t(
            'presentations.builder.conflict.help',
            'Reload to get the latest, or keep your version to save over it.'
          )}
        </span>
      </div>
      <button
        type="button"
        data-testid="deck-conflict-reload"
        onClick={onReload}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors"
      >
        <RefreshCw size={13} />
        {t('presentations.builder.conflict.reload', 'Reload latest')}
      </button>
      <button
        type="button"
        data-testid="deck-conflict-keep-mine"
        onClick={onKeepMine}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-800 text-xs font-medium hover:bg-amber-100 transition-colors"
      >
        <Save size={13} />
        {t('presentations.builder.conflict.keepMine', 'Keep my version')}
      </button>
    </div>
  );
};
