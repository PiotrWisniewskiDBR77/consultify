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
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-c-surface border-l border-c-border-subtle shadow-2xl z-dropdown flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-c-accent" />
          <h3 className="text-sm font-semibold text-c-text">
            {t('presentations.builder.versionHistory.title', 'Version History')}
          </h3>
        </div>
        <button onClick={onClose} className="text-c-text-secondary hover:text-c-text-secondary">
          <X size={14} />
        </button>
      </div>

      {/* Save status */}
      <div className="px-4 py-2 border-b border-c-border-subtle">
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
            <span className="text-c-text-secondary ml-auto">{formatTimeAgo(lastSavedAt)}</span>
          )}
        </div>
      </div>

      {/* Manual checkpoint */}
      <div className="px-4 py-2 border-b border-c-border-subtle">
        <div className="flex gap-1.5">
          <input
            value={checkpointName}
            onChange={(e) => setCheckpointName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveCheckpoint()}
            placeholder="Name this version..."
            className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised outline-none focus:ring-1 focus:ring-c-focus"
          />
          <button
            onClick={handleSaveCheckpoint}
            disabled={!checkpointName.trim()}
            className="px-2 py-1.5 rounded-lg bg-c-accent-soft0 text-c-text text-xs disabled:opacity-40 hover:bg-c-accent-soft"
          >
            <Save size={12} />
          </button>
        </div>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-c-text-secondary text-xs">
            <Clock size={16} className="mb-2 opacity-40" />
            <p>No versions yet</p>
          </div>
        ) : (
          <div className="px-2 py-2 space-y-1">
            {versions.map((version) => (
              <div
                key={version.id}
                className="relative p-2.5 rounded-lg hover:bg-c-surface-raised group transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center mt-0.5">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        version.type === 'manual'
                          ? 'bg-c-surface'
                          : version.type === 'checkpoint'
                            ? 'bg-blue-500'
                            : 'bg-c-border'
                      }`}
                    />
                    <div className="w-px h-full bg-c-border-subtle mt-1" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-c-text truncate">{version.label}</p>
                      <span
                        className={`text-[8px] px-1 py-0.5 rounded ${
                          version.type === 'manual'
                            ? 'bg-c-accent-soft text-c-accent'
                            : version.type === 'checkpoint'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-c-surface-raised text-c-text-secondary'
                        }`}
                      >
                        {version.type}
                      </span>
                    </div>
                    <p className="text-[10px] text-c-text-secondary mt-0.5">
                      {formatTime(version.timestamp)} · {version.summary}
                    </p>
                  </div>

                  {/* Restore button */}
                  <button
                    onClick={() => handleRestore(version.id)}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all text-xs ${
                      restoreConfirm === version.id
                        ? 'bg-danger-500 text-c-text opacity-100'
                        : 'text-c-text-secondary hover:text-c-accent hover:bg-c-accent-soft'
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
