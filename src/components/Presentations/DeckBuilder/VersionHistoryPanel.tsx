/**
 * VersionHistoryPanel — sidebar panel showing version timeline with restore actions.
 * Highlights auto-saves, checkpoints, and manual saves with diff summaries.
 */

import { Check, Clock, RotateCcw, Save, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { VersionSnapshot } from './useVersionHistory';

interface VersionHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  versions: VersionSnapshot[];
  onRestore: (versionId: string) => void;
  onSaveCheckpoint: (label: string) => void;
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  isOpen,
  onClose,
  versions,
  onRestore,
  onSaveCheckpoint,
  hasUnsavedChanges,
  lastSavedAt,
}) => {
  const { t } = useTranslation();
  const [checkpointName, setCheckpointName] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveCheckpoint = () => {
    if (checkpointName.trim()) {
      onSaveCheckpoint(checkpointName.trim());
      setCheckpointName('');
    }
  };

  const handleRestore = (versionId: string) => {
    if (restoreConfirm === versionId) {
      onRestore(versionId);
      setRestoreConfirm(null);
    } else {
      setRestoreConfirm(versionId);
      setTimeout(() => setRestoreConfirm(null), 3000);
    }
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 shadow-2xl z-dropdown flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-800">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-primary-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-white">
            {t('presentations.builder.versionHistory.title', 'Version History')}
          </h3>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>

      {/* Save status */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-navy-800">
        <div className="flex items-center gap-2 text-[10px]">
          {hasUnsavedChanges ? (
            <span className="flex items-center gap-1 text-amber-500">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Unsaved changes
            </span>
          ) : (
            <span className="flex items-center gap-1 text-green-500">
              <Check size={10} />
              All changes saved
            </span>
          )}
          {lastSavedAt && (
            <span className="text-slate-600 ml-auto">{formatTimeAgo(lastSavedAt)}</span>
          )}
        </div>
      </div>

      {/* Manual checkpoint */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-navy-800">
        <div className="flex gap-1.5">
          <input
            value={checkpointName}
            onChange={(e) => setCheckpointName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveCheckpoint()}
            placeholder="Name this version..."
            className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 outline-none focus:ring-1 focus:ring-primary-400"
          />
          <button
            onClick={handleSaveCheckpoint}
            disabled={!checkpointName.trim()}
            className="px-2 py-1.5 rounded-lg bg-primary-500 text-white text-xs disabled:opacity-40 hover:bg-primary-600"
          >
            <Save size={12} />
          </button>
        </div>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-xs">
            <Clock size={16} className="mb-2 opacity-40" />
            <p>No versions yet</p>
          </div>
        ) : (
          <div className="px-2 py-2 space-y-1">
            {versions.map((version) => (
              <div
                key={version.id}
                className="relative p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800/50 group transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center mt-0.5">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        version.type === 'manual'
                          ? 'bg-navy-900'
                          : version.type === 'checkpoint'
                            ? 'bg-blue-500'
                            : 'bg-slate-300'
                      }`}
                    />
                    <div className="w-px h-full bg-slate-200 dark:bg-navy-700 mt-1" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                        {version.label}
                      </p>
                      <span
                        className={`text-[8px] px-1 py-0.5 rounded ${
                          version.type === 'manual'
                            ? 'bg-primary-100 text-primary-600'
                            : version.type === 'checkpoint'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {version.type}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {formatTime(version.timestamp)} · {version.summary}
                    </p>
                  </div>

                  {/* Restore button */}
                  <button
                    onClick={() => handleRestore(version.id)}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all text-xs ${
                      restoreConfirm === version.id
                        ? 'bg-danger-500 text-white opacity-100'
                        : 'text-slate-600 hover:text-primary-500 hover:bg-primary-50'
                    }`}
                    title={restoreConfirm === version.id ? 'Click again to confirm' : 'Restore'}
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
