/**
 * WatchingTab - Manage watched objects
 */

import { Eye, FileText, FolderOpen, Target, Trash2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed';

import type { Watcher } from '../../../hooks/useUserNotificationPreferences';

interface WatchingTabProps {
  watchers: Watcher[];
  onAddWatcher: (type: string, id: string, notifyOn?: string) => Promise<void>;
  onRemoveWatcher: (type: string, id: string) => Promise<void>;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  task: FileText,
  initiative: Target,
  project: FolderOpen,
};

const TYPE_LABELS: Record<string, string> = {
  task: 'Task',
  initiative: 'Initiative',
  project: 'Project',
};

const WatchingTab: React.FC<WatchingTabProps> = ({ watchers, onAddWatcher, onRemoveWatcher }) => {
  const { t } = useTranslation();

  // Group watchers by type
  const grouped = watchers.reduce(
    (acc, watcher) => {
      const type = watcher.objectType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(watcher);
      return acc;
    },
    {} as Record<string, Watcher[]>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <Eye size={20} />
          {t('settings.notifications.watchingTitle', 'Watching')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('settings.notifications.watchingDesc', "Objects you're following for updates.")}
        </p>
      </div>

      {watchers.length === 0 ? (
        <EmptyState
          icon={<Eye />}
          title={t('settings.notifications.noWatchers', "You're not watching anything yet.")}
          description={t(
            'settings.notifications.noWatchersHint',
            'Click the eye icon on tasks, initiatives, or projects to start watching them.'
          )}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = TYPE_ICONS[type] || Eye;
            const label = TYPE_LABELS[type] || type;

            return (
              <div key={type} className="space-y-2">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Icon size={16} />
                  {label}s ({items.length})
                </h4>

                <div className="space-y-2">
                  {items.map((watcher) => (
                    <div
                      key={watcher.id}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-800/50 rounded-lg group"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} className="text-slate-600 dark:text-slate-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {watcher.objectId}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Notify: {watcher.notifyOn}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => onRemoveWatcher(watcher.objectType, watcher.objectId)}
                        className="p-2 text-slate-600 dark:text-slate-500 hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-all"
                        title={t('settings.notifications.unwatch', 'Stop watching')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WatchingTab;
