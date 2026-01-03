/**
 * WatchingTab - Manage watched objects
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Trash2, FileText, Target, FolderOpen } from 'lucide-react';
import type { Watcher } from '../../../hooks/useUserNotificationPreferences';

interface WatchingTabProps {
    watchers: Watcher[];
    onAddWatcher: (type: string, id: string, notifyOn?: string) => Promise<void>;
    onRemoveWatcher: (type: string, id: string) => Promise<void>;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
    task: FileText,
    initiative: Target,
    project: FolderOpen
};

const TYPE_LABELS: Record<string, string> = {
    task: 'Task',
    initiative: 'Initiative',
    project: 'Project'
};

const WatchingTab: React.FC<WatchingTabProps> = ({
    watchers,
    onAddWatcher,
    onRemoveWatcher
}) => {
    const { t } = useTranslation();

    // Group watchers by type
    const grouped = watchers.reduce((acc, watcher) => {
        const type = watcher.objectType;
        if (!acc[type]) acc[type] = [];
        acc[type].push(watcher);
        return acc;
    }, {} as Record<string, Watcher[]>);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <Eye size={20} />
                    {t('settings.notifications.watchingTitle', 'Watching')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('settings.notifications.watchingDesc', 'Objects you\'re following for updates.')}
                </p>
            </div>

            {watchers.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
                    <Eye size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">
                        {t('settings.notifications.noWatchers', 'You\'re not watching anything yet.')}
                    </p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        {t('settings.notifications.noWatchersHint', 'Click the eye icon on tasks, initiatives, or projects to start watching them.')}
                    </p>
                </div>
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
                                                <Icon size={16} className="text-slate-400" />
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
                                                className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
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








