/**
 * NotebookVersionHistory — lists snapshots of a notebook page, shows a simple
 * text diff against the current content, and restores a chosen version.
 *
 * Talks to Agent-5 backend at `/api/v8/notebook/pages/:id/versions` (and
 * `.../:vid/restore`). All fetches are wrapped in try/catch and degrade to an
 * inline message (the versions table may not be migrated yet → 503).
 *
 * Integration: render in the notebook right-rail / overflow menu (see SLOT
 * comments in NotebookContent owned by Agent 4). On successful restore, call
 * `onRestored(restoredContent)` so the host can reload the editor.
 */
import { Clock, History, Loader2, RotateCcw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface NotebookVersion {
  id: string;
  pageId: string;
  title: string;
  contentJson: unknown;
  contentText: string | null;
  createdAt: string | null;
  createdBy: string | null;
}

interface RestoreResult {
  pageId: string;
  restoredFrom: string;
  backupVersionId: string;
  title: string;
  contentJson: unknown;
  contentText: string | null;
}

interface NotebookVersionHistoryProps {
  pageId: string;
  /** Current editor content, used for the diff preview against a version. */
  currentText?: string | null;
  isPolish?: boolean;
  className?: string;
  onRestored?: (result: RestoreResult) => void;
}

const authHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') || '' : '';
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Minimal line-level diff: classify each line as added / removed / unchanged. */
function lineDiff(
  oldText: string,
  newText: string
): Array<{ type: 'add' | 'del' | 'same'; text: string }> {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const bSet = new Set(b);
  const aSet = new Set(a);
  const out: Array<{ type: 'add' | 'del' | 'same'; text: string }> = [];
  // Removed lines (in current, not in version) then added (in version, not current).
  for (const line of a) if (!bSet.has(line)) out.push({ type: 'del', text: line });
  for (const line of b) out.push({ type: aSet.has(line) ? 'same' : 'add', text: line });
  return out;
}

export const NotebookVersionHistory: React.FC<NotebookVersionHistoryProps> = ({
  pageId,
  currentText = '',
  isPolish = false,
  className = '',
  onRestored,
}) => {
  const [versions, setVersions] = useState<NotebookVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const t = useMemo(
    () => ({
      title: isPolish ? 'Historia wersji' : 'Version history',
      empty: isPolish ? 'Brak zapisanych wersji.' : 'No saved versions yet.',
      unavailable: isPolish
        ? 'Historia wersji jest niedostępna (migracja w toku).'
        : 'Version history is unavailable (migration pending).',
      failed: isPolish ? 'Nie udało się wczytać wersji.' : 'Could not load versions.',
      restore: isPolish ? 'Przywróć' : 'Restore',
      restored: isPolish ? 'Przywrócono wersję.' : 'Version restored.',
      diff: isPolish ? 'Różnice vs aktualna' : 'Diff vs current',
      by: isPolish ? 'przez' : 'by',
    }),
    [isPolish]
  );

  const load = useCallback(async () => {
    if (!pageId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v8/notebook/pages/${encodeURIComponent(pageId)}/versions`, {
        headers: { ...authHeaders() },
      });
      if (res.status === 503) {
        setError(t.unavailable);
        setVersions([]);
        return;
      }
      if (!res.ok) {
        setError(t.failed);
        setVersions([]);
        return;
      }
      const json = await res.json().catch(() => ({}));
      const rows: NotebookVersion[] = Array.isArray(json?.data) ? json.data : [];
      setVersions(rows);
    } catch {
      setError(t.failed);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [pageId, t.failed, t.unavailable]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRestore = useCallback(
    async (vid: string) => {
      setRestoringId(vid);
      try {
        const res = await fetch(
          `/api/v8/notebook/pages/${encodeURIComponent(pageId)}/versions/${encodeURIComponent(
            vid
          )}/restore`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() } }
        );
        if (!res.ok) {
          setError(t.failed);
          return;
        }
        const json = await res.json().catch(() => ({}));
        const result: RestoreResult | undefined = json?.data;
        if (result) onRestored?.(result);
        await load();
      } catch {
        setError(t.failed);
      } finally {
        setRestoringId(null);
      }
    },
    [pageId, load, onRestored, t.failed]
  );

  const formatTime = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
  };

  const selected = versions.find((v) => v.id === selectedId) || null;
  const diff = selected
    ? lineDiff(String(currentText || ''), String(selected.contentText || ''))
    : [];

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-c-text-secondary">
        <History className="h-4 w-4 text-c-text-muted" />
        <span>{t.title}</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-c-text-muted" />}
      </div>

      {error && (
        <p className="rounded-lg bg-c-warning/8 px-3 py-2 text-[12px] text-c-warning">{error}</p>
      )}

      {!loading && !error && versions.length === 0 && (
        <p className="px-1 text-[12px] text-c-text-muted">{t.empty}</p>
      )}

      <ul className="flex flex-col gap-1">
        {versions.map((v) => (
          <li
            key={v.id}
            className={`rounded-lg border px-3 py-2 transition-colors ${
              selectedId === v.id
                ? 'border-c-info/30 bg-c-info/10'
                : 'border-c-border-subtle hover:bg-c-surface-raised'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => setSelectedId((id) => (id === v.id ? null : v.id))}
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-c-text-muted" />
                <span className="truncate text-[12px] text-c-text-secondary">
                  {formatTime(v.createdAt)}
                  {v.createdBy ? ` • ${t.by} ${v.createdBy.slice(0, 8)}` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleRestore(v.id)}
                disabled={restoringId !== null}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-c-info transition-colors hover:bg-c-info/10 disabled:opacity-50"
              >
                {restoringId === v.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                {t.restore}
              </button>
            </div>

            {selectedId === v.id && (
              <div className="mt-2 border-t border-c-border-subtle pt-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {t.diff}
                </p>
                <pre className="max-h-48 overflow-auto rounded bg-c-surface-raised p-2 text-[11px] leading-snug">
                  {diff.length === 0 ? (
                    <span className="text-c-text-muted">—</span>
                  ) : (
                    diff.map((d, i) => (
                      <div
                        key={i}
                        className={
                          d.type === 'add'
                            ? 'text-c-success'
                            : d.type === 'del'
                              ? 'text-c-danger line-through'
                              : 'text-c-text-muted'
                        }
                      >
                        {d.type === 'add' ? '+ ' : d.type === 'del' ? '- ' : '  '}
                        {d.text || ' '}
                      </div>
                    ))
                  )}
                </pre>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NotebookVersionHistory;
