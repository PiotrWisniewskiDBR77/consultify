/**
 * SnapshotManager — Create, list, restore, and delete base snapshots.
 *
 * Provides a full CRUD panel for snapshot management with confirmation
 * dialogs for destructive operations.
 */
import { Archive, Camera, Clock, Database, Loader2, RotateCcw, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ────────────────────────────────────────────────────────────────────

interface SnapshotSummary {
  id: string;
  name: string;
  createdAt: string;
  recordCount: number;
}

interface SnapshotManagerProps {
  open: boolean;
  onClose: () => void;
  baseId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

const SnapshotRow = React.memo(function SnapshotRow({
  snapshot,
  isPl,
  onRestore,
  onDelete,
  restoring,
}: {
  snapshot: SnapshotSummary;
  isPl: boolean;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  restoring: string | null;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-200 dark:border-white/[0.04] last:border-0 group">
      <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center flex-shrink-0">
        <Archive size={14} className="text-primary-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
          {snapshot.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-600 dark:text-slate-500">
          <span className="flex items-center gap-0.5">
            <Clock size={9} />
            {formatDate(snapshot.createdAt)}
          </span>
          <span className="flex items-center gap-0.5">
            <Database size={9} />
            {snapshot.recordCount} {isPl ? 'rekordów' : 'records'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onRestore(snapshot.id)}
          disabled={restoring === snapshot.id}
          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
          title={isPl ? 'Przywróć' : 'Restore'}
        >
          {restoring === snapshot.id ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RotateCcw size={12} />
          )}
        </button>
        <button
          onClick={() => onDelete(snapshot.id)}
          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
          title={isPl ? 'Usuń' : 'Delete'}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
});

// ── Main Component ───────────────────────────────────────────────────────────

export const SnapshotManager: React.FC<SnapshotManagerProps> = ({ open, onClose, baseId }) => {
  const { i18n } = useTranslation();
  const isPl = !!i18n.language?.startsWith('pl');

  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [snapshotName, setSnapshotName] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    if (!baseId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bases/${baseId}/snapshots`);
      if (!res.ok) throw new Error('Failed to fetch snapshots');
      const data: SnapshotSummary[] = await res.json();
      setSnapshots(data);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [baseId]);

  useEffect(() => {
    if (open && baseId) fetchSnapshots();
  }, [open, baseId]);

  const handleCreate = useCallback(async () => {
    if (!baseId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/bases/${baseId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: snapshotName.trim() || undefined }),
      });
      if (!res.ok) throw new Error('Failed to create snapshot');
      setSnapshotName('');
      setShowCreateInput(false);
      await fetchSnapshots();
    } catch {
      // Silently handle
    } finally {
      setCreating(false);
    }
  }, [baseId, snapshotName, fetchSnapshots]);

  const handleRestore = useCallback(
    async (snapshotId: string) => {
      setRestoring(snapshotId);
      setConfirmRestore(null);
      try {
        const res = await fetch(`/api/bases/${baseId}/snapshots/${snapshotId}/restore`, {
          method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to restore snapshot');
        await fetchSnapshots();
      } catch {
        // Silently handle
      } finally {
        setRestoring(null);
      }
    },
    [baseId, fetchSnapshots]
  );

  const handleDelete = useCallback(
    async (snapshotId: string) => {
      try {
        const res = await fetch(`/api/bases/${baseId}/snapshots/${snapshotId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete snapshot');
        setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      } catch {
        // Silently handle
      }
    },
    [baseId]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 w-[420px] max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-navy-700/60">
          <Camera size={16} className="text-primary-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex-1">
            {isPl ? 'Migawki' : 'Snapshots'}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Create */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.04]">
          {showCreateInput ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder={isPl ? 'Nazwa migawki…' : 'Snapshot name…'}
                className="flex-1 h-8 px-3 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 outline-none focus:ring-2 focus:ring-primary-500/30 text-slate-700 dark:text-slate-200"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setShowCreateInput(false);
                }}
              />
              <button
                onClick={handleCreate}
                disabled={creating}
                className="h-8 px-3 rounded-lg text-xs font-semibold bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-40 flex items-center gap-1"
              >
                {creating ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                {isPl ? 'Utwórz' : 'Create'}
              </button>
              <button
                onClick={() => setShowCreateInput(false)}
                className="p-1.5 rounded text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateInput(true)}
              className="w-full py-2 rounded-lg text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-500/5 hover:bg-primary-500/10 transition-colors flex items-center justify-center gap-1.5"
            >
              <Camera size={13} />
              {isPl ? 'Utwórz migawkę' : 'Create snapshot'}
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-slate-600" />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600 dark:text-slate-500 px-4 text-center">
              <Archive size={24} className="mb-2 opacity-40" />
              <span className="text-xs">{isPl ? 'Brak migawek' : 'No snapshots yet'}</span>
              <span className="text-[10px] mt-1">
                {isPl
                  ? 'Utwórz migawkę, aby zachować aktualny stan danych'
                  : 'Create a snapshot to preserve the current data state'}
              </span>
            </div>
          ) : (
            snapshots.map((snap) => (
              <SnapshotRow
                key={snap.id}
                snapshot={snap}
                isPl={isPl}
                onRestore={(id) => setConfirmRestore(id)}
                onDelete={handleDelete}
                restoring={restoring}
              />
            ))
          )}
        </div>

        {/* Restore confirmation dialog */}
        {confirmRestore && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-2xl">
            <div className="bg-white dark:bg-navy-900 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700 p-4 w-72">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
                {isPl ? 'Przywrócić migawkę?' : 'Restore snapshot?'}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                {isPl
                  ? 'Obecne dane zostaną zastąpione danymi z migawki. Tej operacji nie można cofnąć.'
                  : 'Current data will be replaced with snapshot data. This action cannot be undone.'}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmRestore(null)}
                  className="px-3 py-1.5 text-xs rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800"
                >
                  {isPl ? 'Anuluj' : 'Cancel'}
                </button>
                <button
                  onClick={() => handleRestore(confirmRestore)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-rose-500 text-white hover:bg-rose-600 font-semibold flex items-center gap-1"
                >
                  <RotateCcw size={11} />
                  {isPl ? 'Przywróć' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SnapshotManager;
