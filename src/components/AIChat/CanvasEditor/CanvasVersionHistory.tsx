import { RefreshCw, RotateCcw, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasVersionSummary } from '@/types/canvasWorkspace';

import { CanvasMarkdownRenderer } from '../CanvasMarkdownRenderer';

/**
 * B1 — Canvas version history popover. Lists draft snapshots (newest first,
 * backend caps at 50), previews a selected version read-only and restores it
 * after an inline confirm. Restore itself reuses the panel's existing
 * `restoreVersion` path (server writes a `restore_version` snapshot first, so
 * history is never destroyed).
 */

function formatRelativeTime(iso: string, t: (key: string, fallback: string) => string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return iso;
  const deltaMs = Date.now() - timestamp;
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return t('canvas.versionHistory.justNow', 'just now');
  if (minutes < 60) return `${minutes} ${t('canvas.versionHistory.minutesAgo', 'min ago')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${t('canvas.versionHistory.hoursAgo', 'h ago')}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${t('canvas.versionHistory.daysAgo', 'd ago')}`;
  return new Date(timestamp).toLocaleDateString();
}

interface CanvasVersionHistoryProps {
  versions: CanvasVersionSummary[];
  isLoading: boolean;
  onClose: () => void;
  onRestore: (version: CanvasVersionSummary) => Promise<void> | void;
}

export function CanvasVersionHistory({
  versions,
  isLoading,
  onClose,
  onRestore,
}: CanvasVersionHistoryProps) {
  const { t } = useTranslation();
  const [previewVersionId, setPreviewVersionId] = React.useState<string | null>(null);
  const [confirmingVersionId, setConfirmingVersionId] = React.useState<string | null>(null);
  const [restoringVersionId, setRestoringVersionId] = React.useState<string | null>(null);

  const previewVersion = versions.find((version) => version.id === previewVersionId) || null;

  const runRestore = async (version: CanvasVersionSummary) => {
    setRestoringVersionId(version.id);
    try {
      await onRestore(version);
      setConfirmingVersionId(null);
      setPreviewVersionId(null);
    } finally {
      setRestoringVersionId(null);
    }
  };

  return (
    <div
      className="absolute right-0 z-20 mt-2 flex max-h-[70vh] w-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-xs shadow-xl dark:border-white/10 dark:bg-navy-800"
      data-testid="canvas-version-history"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-white/10">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          {t('canvas.versionHistory.title', 'Version history')}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('canvas.versionHistory.closeAria', 'Close version history')}
          title={t('canvas.versionHistory.close', 'Close')}
          className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <X size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto p-2">
        {isLoading ? (
          <div className="flex items-center gap-2 px-2 py-3 text-slate-500 dark:text-slate-400">
            <RefreshCw size={12} className="animate-spin" />
            {t('canvas.versionHistory.loading', 'Loading versions...')}
          </div>
        ) : versions.length === 0 ? (
          <div className="px-2 py-3 text-slate-500 dark:text-slate-400">
            {t('canvas.versionHistory.empty', 'No versions.')}
          </div>
        ) : (
          versions.map((version) => {
            const isPreviewed = version.id === previewVersionId;
            const isConfirming = version.id === confirmingVersionId;
            const isRestoring = version.id === restoringVersionId;
            return (
              <div
                key={version.id}
                className={`rounded-xl p-2 transition-colors ${
                  isPreviewed
                    ? 'bg-slate-100 ring-1 ring-c-focus dark:bg-white/10'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.06] dark:hover:bg-white/10'
                }`}
                data-testid="canvas-version-history-item"
              >
                <button
                  type="button"
                  onClick={() => setPreviewVersionId(isPreviewed ? null : version.id)}
                  className="w-full text-left"
                  title={new Date(version.createdAt).toLocaleString()}
                >
                  <div className="font-semibold text-slate-700 dark:text-slate-100">
                    {version.operationType}
                  </div>
                  <div className="mt-0.5 text-slate-500 dark:text-slate-300">
                    {formatRelativeTime(version.createdAt, t)}
                    {version.summary ? ` · ${version.summary}` : ''}
                  </div>
                </button>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {isConfirming ? (
                    <>
                      <span className="font-semibold text-slate-700 dark:text-slate-100">
                        {t('canvas.versionHistory.confirmRestore', 'Restore this version?')}
                      </span>
                      <button
                        type="button"
                        disabled={isRestoring}
                        onClick={() => void runRestore(version)}
                        className="inline-flex items-center gap-1 rounded-full bg-c-text px-2 py-0.5 font-semibold text-c-bg hover:bg-c-text-secondary disabled:opacity-50"
                        data-testid="canvas-version-restore-confirm"
                      >
                        {isRestoring ? (
                          <RefreshCw size={11} className="animate-spin" />
                        ) : (
                          <RotateCcw size={11} />
                        )}
                        {isRestoring
                          ? t('canvas.versionHistory.restoring', 'Restoring...')
                          : t('canvas.versionHistory.confirmYes', 'Yes, restore')}
                      </button>
                      <button
                        type="button"
                        disabled={isRestoring}
                        onClick={() => setConfirmingVersionId(null)}
                        className="rounded-full px-2 py-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white"
                      >
                        {t('canvas.versionHistory.cancel', 'Cancel')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingVersionId(version.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 hover:text-slate-950 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
                      data-testid="canvas-version-restore"
                    >
                      <RotateCcw size={11} />
                      {t('canvas.versionHistory.restore', 'Restore')}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {previewVersion ? (
        <div
          className="max-h-[36vh] shrink-0 overflow-auto border-t border-slate-200 p-3 dark:border-white/10"
          data-testid="canvas-version-preview"
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {t('canvas.versionHistory.preview', 'Preview')} ·{' '}
            {formatRelativeTime(previewVersion.createdAt, t)}
          </div>
          <CanvasMarkdownRenderer text={previewVersion.contentMd} />
        </div>
      ) : null}
    </div>
  );
}
