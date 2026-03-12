/**
 * SnapshotHistory — Time travel through map versions.
 * Primary storage: backend API. Falls back to localStorage when API unavailable.
 */
import { Calendar, Clock, RotateCcw, Save, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

export interface MapSnapshot {
  id: string;
  timestamp: number;
  label: string;
  nodeCount: number;
  edgeCount: number;
  nodes: any[];
  edges: any[];
}

interface SnapshotHistoryProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  currentNodes: any[];
  currentEdges: any[];
  onRestore: (nodes: any[], edges: any[]) => void;
  onPreview?: (nodes: any[], edges: any[]) => void;
}

const STORAGE_KEY_PREFIX = 'mm-snapshots-';
const MAX_LOCAL_SNAPSHOTS = 20;

function getStorageKey(ideaId: string) {
  return `${STORAGE_KEY_PREFIX}${ideaId}`;
}

function loadLocalSnapshots(ideaId: string): MapSnapshot[] {
  try {
    const raw = localStorage.getItem(getStorageKey(ideaId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSnapshots(ideaId: string, snapshots: MapSnapshot[]) {
  try {
    localStorage.setItem(getStorageKey(ideaId), JSON.stringify(snapshots.slice(-MAX_LOCAL_SNAPSHOTS)));
  } catch { /* storage full */ }
}

export const SnapshotHistory: React.FC<SnapshotHistoryProps> = ({
  open,
  onClose,
  ideaId,
  currentNodes,
  currentEdges,
  onRestore,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [snapshots, setSnapshots] = useState<MapSnapshot[]>([]);
  const [useBackend, setUseBackend] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await Api.getMyIdeaMapSnapshots(ideaId);
        if (!cancelled && Array.isArray(data?.snapshots)) {
          setSnapshots(data.snapshots);
          setUseBackend(true);
          return;
        }
      } catch { /* API unavailable */ }

      if (!cancelled) {
        setSnapshots(loadLocalSnapshots(ideaId));
        setUseBackend(false);
      }
    })();

    return () => { cancelled = true; };
  }, [ideaId, open]);

  const handleSaveSnapshot = useCallback(async () => {
    const label = snapshotLabel.trim();
    if (!label) return;
    setSaving(true);

    try {
      if (useBackend) {
        const res = await Api.createMyIdeaMapSnapshot(ideaId, {
          label,
          nodes: currentNodes,
          edges: currentEdges,
        });
        if (res?.snapshot) {
          setSnapshots((prev) => [
            { ...res.snapshot, nodes: currentNodes, edges: currentEdges },
            ...prev,
          ]);
        }
      } else {
        const snapshot: MapSnapshot = {
          id: `snap-${Date.now()}`,
          timestamp: Date.now(),
          label,
          nodeCount: currentNodes.length,
          edgeCount: currentEdges.length,
          nodes: currentNodes,
          edges: currentEdges,
        };
        const updated = [...snapshots, snapshot];
        setSnapshots(updated);
        saveLocalSnapshots(ideaId, updated);
      }
      toast.success(isPl ? 'Snapshot zapisany' : 'Snapshot saved', { duration: 1000 });
      setSnapshotLabel('');
      setShowLabelInput(false);
    } catch {
      toast.error(isPl ? 'Błąd zapisu' : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [currentEdges, currentNodes, ideaId, isPl, snapshotLabel, snapshots, useBackend]);

  const handleRestore = useCallback(
    (snapshot: MapSnapshot) => {
      const confirmed = window.confirm(
        isPl
          ? `Przywrócić "${snapshot.label}"? Obecna mapa zostanie zastąpiona.`
          : `Restore "${snapshot.label}"? Current map will be replaced.`
      );
      if (!confirmed) return;
      onRestore(snapshot.nodes, snapshot.edges);
      toast.success(isPl ? 'Przywrócono snapshot' : 'Snapshot restored', { duration: 1200 });
      onClose();
    },
    [isPl, onClose, onRestore]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        if (useBackend) {
          await Api.deleteMyIdeaMapSnapshot(ideaId, id);
        }
      } catch { /* ignore */ }
      const updated = snapshots.filter((s) => s.id !== id);
      setSnapshots(updated);
      if (!useBackend) saveLocalSnapshots(ideaId, updated);
    },
    [ideaId, snapshots, useBackend]
  );

  const formatTime = useCallback((ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {isPl ? 'Historia snapshotów' : 'Snapshot History'}
            </h3>
            {!useBackend && (
              <span className="text-[9px] rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {isPl ? 'tryb lokalny' : 'local mode'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3 max-h-[50vh] overflow-y-auto">
          {showLabelInput ? (
            <div className="mb-3 flex items-center gap-2">
              <input
                autoFocus
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveSnapshot();
                  if (e.key === 'Escape') { setShowLabelInput(false); setSnapshotLabel(''); }
                }}
                placeholder={isPl ? 'Nazwa snapshotu...' : 'Snapshot name...'}
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-amber-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
              />
              <button
                onClick={handleSaveSnapshot}
                disabled={!snapshotLabel.trim() || saving}
                className="rounded bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-40"
              >
                <Save size={12} />
              </button>
              <button
                onClick={() => { setShowLabelInput(false); setSnapshotLabel(''); }}
                className="rounded px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setSnapshotLabel(isPl ? `Wersja ${snapshots.length + 1}` : `Version ${snapshots.length + 1}`);
                setShowLabelInput(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/8 hover:from-amber-500/15 hover:to-orange-500/12 transition-all mb-3"
            >
              <Save size={14} className="text-amber-600" />
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                {isPl ? 'Zapisz aktualny stan' : 'Save current state'}
              </span>
            </button>
          )}

          {snapshots.length === 0 ? (
            <div className="text-center py-8 text-[11px] text-slate-400">
              {isPl ? 'Brak zapisanych snapshotów' : 'No snapshots saved yet'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...snapshots].reverse().map((snap) => (
                <div
                  key={snap.id}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50/50 dark:bg-navy-950/20 border border-slate-200/30 dark:border-navy-700/30 hover:bg-slate-100/60 dark:hover:bg-navy-950/30 transition-colors"
                >
                  <Calendar size={12} className="text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                      {snap.label}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      {formatTime(snap.timestamp)} · {snap.nodeCount} nodes · {snap.edgeCount} edges
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestore(snap)}
                    className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"
                    title={isPl ? 'Przywróć' : 'Restore'}
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(snap.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title={isPl ? 'Usuń' : 'Delete'}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SnapshotHistory;
