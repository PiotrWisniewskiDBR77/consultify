/**
 * WorkbookVersionHistoryModal — MAT-006 (2026-08-02).
 *
 * Functional proof surface for the workbook lifecycle (versions/checkpoint/
 * restore) inside the ACTIVE Excele/Table Studio UI — per the MAT-006 brief,
 * this is deliberately NOT a redesign or a new list-screen (no StandardTable,
 * no own menu/kebab chrome — full visual standard is a separate Visual QA
 * pass). It is a minimal overlay: version list + a restore action with an
 * explicit confirmation step, and a visible conflict/error state on 409.
 *
 * Opened from `ExceleRightPanel`'s "Akcje" section (see `onOpenVersionHistory`
 * wiring in `ExceleView.tsx`). Tokens are `c-*` only (CLAUDE.md UI pkt 6).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

interface VersionRow {
  id: string;
  version: number;
  sheet_count: number;
  created_by: string;
  created_at: string;
}

export interface WorkbookVersionHistoryModalProps {
  workbookId: string;
  onClose: () => void;
  /** Called after a successful restore — caller decides how to refresh (this
   * component performs a hard reload itself to satisfy the golden-flow
   * "hard reload shows restored state" proof directly, but still calls this
   * so a caller can e.g. log/telemetry before the reload fires). */
  onRestored?: (newVersion: number) => void;
}

type LoadState = 'loading' | 'ready' | 'error';
type RestoreState =
  | { status: 'idle' }
  | { status: 'confirming'; versionId: string; version: number }
  | { status: 'restoring' }
  | { status: 'conflict'; serverVersion: number }
  | { status: 'error'; message: string };

export const WorkbookVersionHistoryModal: React.FC<WorkbookVersionHistoryModalProps> = ({
  workbookId,
  onClose,
  onRestored,
}) => {
  const { t } = useTranslation();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [restoreState, setRestoreState] = useState<RestoreState>({ status: 'idle' });

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const res = await Api.getWorkbookVersions(workbookId);
      setVersions(res.data || []);
      setCurrentVersion(res.currentVersion ?? 1);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [workbookId]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestRestore = useCallback((versionId: string, version: number) => {
    setRestoreState({ status: 'confirming', versionId, version });
  }, []);

  const cancelRestore = useCallback(() => setRestoreState({ status: 'idle' }), []);

  const confirmRestore = useCallback(async () => {
    if (restoreState.status !== 'confirming') return;
    const { versionId } = restoreState;
    setRestoreState({ status: 'restoring' });
    try {
      const res = await Api.restoreWorkbookVersion(workbookId, versionId, currentVersion);
      onRestored?.(res.version);
      // Hard reload — the golden-flow proof this UI exists for is literally
      // "hard reload shows the restored state" (MAT-006 spec step 10); this
      // also sidesteps any risk of client-side preview state drifting from
      // the just-restored server truth.
      window.location.reload();
    } catch (err: any) {
      const status = Number(err?.status);
      if (status === 409) {
        const serverVersion = Number(err?.data?.serverVersion) || currentVersion;
        setRestoreState({ status: 'conflict', serverVersion });
      } else {
        setRestoreState({
          status: 'error',
          message: err?.message || t('excele.versionHistory.restoreFailed', 'Restore failed'),
        });
      }
    }
  }, [restoreState, workbookId, currentVersion, onRestored, t]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('excele.versionHistory.title', 'Historia wersji')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-c-border-subtle bg-c-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-c-text">
            {t('excele.versionHistory.title', 'Historia wersji')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-c-text-muted hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] rounded"
            aria-label={t('common.close', 'Zamknij')}
          >
            {'✕'}
          </button>
        </div>

        {loadState === 'loading' && (
          <p className="text-xs text-c-text-muted">
            {t('excele.versionHistory.loading', 'Ładowanie...')}
          </p>
        )}
        {loadState === 'error' && (
          <p className="text-xs text-c-danger">
            {t('excele.versionHistory.loadFailed', 'Nie udało się wczytać historii wersji.')}
          </p>
        )}
        {loadState === 'ready' && versions.length === 0 && (
          <p className="text-xs text-c-text-muted">
            {t(
              'excele.versionHistory.empty',
              'Brak zapisanej historii — edytuj komórkę, aby utworzyć pierwszą wersję.'
            )}
          </p>
        )}

        {loadState === 'ready' && versions.length > 0 && (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto" data-testid="workbook-version-list">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-c-border-subtle px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-c-text">
                    {t('excele.versionHistory.version', 'Wersja')} {v.version}
                  </div>
                  <div className="truncate text-c-text-muted">
                    {new Date(v.created_at).toLocaleString()} &middot; {v.sheet_count}{' '}
                    {t('excele.versionHistory.sheets', 'arkusz(e)')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => requestRestore(v.id, v.version)}
                  disabled={restoreState.status === 'restoring'}
                  className="shrink-0 rounded-md border border-c-border-subtle px-2 py-1 text-xs font-medium text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] disabled:opacity-50"
                >
                  {t('excele.versionHistory.restore', 'Przywróć')}
                </button>
              </li>
            ))}
          </ul>
        )}

        {restoreState.status === 'confirming' && (
          <div className="mt-3 rounded-lg border border-c-border-subtle bg-c-surface-raised p-3 text-xs">
            <p className="mb-2 text-c-text">
              {t(
                'excele.versionHistory.confirmMessage',
                'Przywrócić wersję {{version}}? Bieżący stan zostanie zachowany w historii jako nowa wersja.',
                { version: restoreState.version }
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelRestore}
                className="rounded-md px-2 py-1 text-c-text-muted hover:text-c-text"
              >
                {t('common.cancel', 'Anuluj')}
              </button>
              <button
                type="button"
                onClick={() => void confirmRestore()}
                className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 font-medium text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                data-testid="workbook-restore-confirm"
              >
                {t('excele.versionHistory.confirmAction', 'Przywróć')}
              </button>
            </div>
          </div>
        )}

        {restoreState.status === 'restoring' && (
          <p className="mt-3 text-xs text-c-text-muted">
            {t('excele.versionHistory.restoring', 'Przywracanie...')}
          </p>
        )}

        {restoreState.status === 'conflict' && (
          <div
            className="mt-3 rounded-lg border border-c-danger/30 bg-c-danger/5 p-3 text-xs text-c-danger"
            data-testid="workbook-restore-conflict"
          >
            {t(
              'excele.versionHistory.conflict',
              'Konflikt wersji: skoroszyt zmienił się w międzyczasie (bieżąca wersja: {{version}}). Odśwież i spróbuj ponownie.',
              { version: restoreState.serverVersion }
            )}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRestoreState({ status: 'idle' });
                  void load();
                }}
                className="rounded-md border border-c-border-subtle px-2 py-1 font-medium text-c-text hover:bg-c-surface-raised"
              >
                {t('excele.versionHistory.refresh', 'Odśwież')}
              </button>
            </div>
          </div>
        )}

        {restoreState.status === 'error' && (
          <div className="mt-3 rounded-lg border border-c-danger/30 bg-c-danger/5 p-3 text-xs text-c-danger">
            {restoreState.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkbookVersionHistoryModal;
