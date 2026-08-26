/**
 * WatchersSection
 *
 * DEC-104 fix (2026-08-26, Initiatives expert panel): the section registry
 * previously aliased `watchers` to `OverviewSection` ("can be enhanced
 * later") — opening the "Obserwujący" section showed the Overview content
 * under a Watchers label, which is a lie on screen. A real, working
 * watchers feature already existed (GET/POST/DELETE
 * `/initiatives/:id/watchers`, server/src/routes/pmo/initiatives.routes.ts:
 * 3683-3690) — InitiativeDocumentView.tsx already fetches it into
 * `watchers`/`isWatching`/`handleToggleWatch` and exposes all three through
 * InitiativeContext, but nothing in the dynamic (registry-driven) section
 * renderer used it. This component is the minimal real section: the actual
 * watcher list plus a working watch/unwatch toggle, both already backed by
 * real endpoints — no new backend work needed.
 */

import { Eye, EyeOff } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const WatchersSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation();
  const { watchers, users, currentUserId, isWatching, handleToggleWatch, isMutating } =
    useInitiativeContext();

  return (
    <CollapsibleSection
      id="watchers"
      title={t('initiatives.watchers2', 'Obserwatorzy')}
      icon={<Eye size={18} className="text-slate-500 dark:text-slate-400" />}
      iconBg="bg-gradient-to-br from-slate-500/10 to-gray-500/10 dark:from-slate-500/20 dark:to-gray-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        watchers.length > 0 ? (
          <span className="text-xs text-slate-600">{watchers.length}</span>
        ) : undefined
      }
      actions={
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleToggleWatch();
          }}
          disabled={isMutating}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-c-border text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isWatching ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>
            {isWatching
              ? t('initiatives.watchersSection.stopWatching', 'Przestań obserwować')
              : t('initiatives.watchersSection.startWatching', 'Obserwuj')}
          </span>
        </button>
      }
    >
      {watchers.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
          <Eye size={32} className="mx-auto mb-3 text-slate-600 dark:text-slate-400" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {t('initiatives.noWatchersForThisInitiativeYet2', 'Brak obserwatorów dla tej inicjatywy.')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {watchers.map((watcher) => {
            const user = users.find((u) => u.id === watcher.userId);
            const name = watcher.name || user?.firstName || watcher.userId;
            const isMe = watcher.userId === currentUserId;
            return (
              <div
                key={watcher.id}
                className="flex items-center justify-between p-3 rounded-xl border border-c-border-subtle bg-c-surface/70"
              >
                <div>
                  <p className="text-sm font-medium text-c-text">
                    {name}
                    {isMe && (
                      <span className="ml-1.5 text-xs text-c-text-muted">
                        ({t('initiatives.watchersSection.you', 'Ty')})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-c-text-muted">{watcher.email || user?.email || '—'}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
};

export default WatchersSection;
