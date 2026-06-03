/**
 * SnapshotHistory — Visual timeline for map version history.
 * Supports diff preview, inline label editing, auto-snapshot, and preview-on-hover.
 */
import { Check, Clock, Pencil, RotateCcw, Save, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  autoSnapshotThreshold?: number;
}

interface SnapshotDiff {
  addedNodes: number;
  removedNodes: number;
  addedEdges: number;
  removedEdges: number;
}

const STORAGE_PREFIX = 'mm-snapshots-';
const MAX_LOCAL = 20;
const AUTO_COOLDOWN = 5 * 60 * 1000;

function loadLocal(ideaId: string): MapSnapshot[] {
  try {
    const r = localStorage.getItem(`${STORAGE_PREFIX}${ideaId}`);
    return r ? JSON.parse(r) : [];
  } catch {
    return [];
  }
}
function saveLocal(ideaId: string, s: MapSnapshot[]) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${ideaId}`, JSON.stringify(s.slice(-MAX_LOCAL)));
  } catch {
    /* full */
  }
}

function diffSnap(a: MapSnapshot, b: MapSnapshot): SnapshotDiff {
  const an = new Set(a.nodes.map((n: any) => n.id)),
    bn = new Set(b.nodes.map((n: any) => n.id));
  const ae = new Set(a.edges.map((e: any) => e.id)),
    be = new Set(b.edges.map((e: any) => e.id));
  return {
    addedNodes: [...an].filter((id) => !bn.has(id)).length,
    removedNodes: [...bn].filter((id) => !an.has(id)).length,
    addedEdges: [...ae].filter((id) => !be.has(id)).length,
    removedEdges: [...be].filter((id) => !ae.has(id)).length,
  };
}

function relTime(ts: number, pl: boolean): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return pl ? 'przed chwilą' : 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return pl ? `${m} min temu` : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return pl ? `${h} godz. temu` : `${h}h ago`;
  return pl ? `${Math.floor(h / 24)} dn. temu` : `${Math.floor(h / 24)}d ago`;
}

function dotColor(ts: number) {
  const h = (Date.now() - ts) / 3_600_000;
  return h < 1 ? 'bg-emerald-400' : h < 24 ? 'bg-amber-400' : 'bg-slate-400';
}

const DiffBadge: React.FC<{ diff: SnapshotDiff; pl: boolean }> = ({ diff, pl }) => {
  const items: [number, string, string][] = [
    [diff.addedNodes, '+', pl ? 'węzłów' : 'nodes'],
    [-diff.removedNodes, '-', pl ? 'węzłów' : 'nodes'],
    [diff.addedEdges, '+', pl ? 'krawędzi' : 'edges'],
    [-diff.removedEdges, '-', pl ? 'krawędzi' : 'edges'],
  ];
  const colors = [
    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  ];
  const visible = items
    .map((it, i) => ({ val: Math.abs(it[0]), sign: it[1], label: it[2], cls: colors[i] }))
    .filter((x) => x.val > 0);
  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {visible.map((v, i) => (
        <span key={i} className={`text-[8px] rounded-full px-1.5 py-0.5 ${v.cls}`}>
          {v.sign}
          {v.val} {v.label}
        </span>
      ))}
    </div>
  );
};

export const SnapshotHistory: React.FC<SnapshotHistoryProps> = ({
  open,
  onClose,
  ideaId,
  currentNodes,
  currentEdges,
  onRestore,
  onPreview,
  autoSnapshotThreshold = 10,
}) => {
  const { i18n } = useTranslation();
  const pl = !!i18n.language?.startsWith('pl');
  const t = (a: string, b: string) => (pl ? a : b);

  const [snapshots, setSnapshots] = useState<MapSnapshot[]>([]);
  const [backend, setBackend] = useState(true);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [hovId, setHovId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [previewing, setPreviewing] = useState(false);

  const autoRef = useRef(0);
  const countRef = useRef(currentNodes.length);
  const beforeRef = useRef<{ nodes: any[]; edges: any[] } | null>(null);

  useEffect(() => {
    if (!open || !ideaId) return;
    const delta = Math.abs(currentNodes.length - countRef.current);
    if (delta >= autoSnapshotThreshold && Date.now() - autoRef.current > AUTO_COOLDOWN) {
      autoRef.current = Date.now();
      countRef.current = currentNodes.length;
      const lbl = t(
        `Auto-zapis (${currentNodes.length} węzłów)`,
        `Auto-save (${currentNodes.length} nodes)`
      );
      (async () => {
        try {
          if (backend) {
            const r = await Api.createMyIdeaMapSnapshot(ideaId, {
              label: lbl,
              nodes: currentNodes,
              edges: currentEdges,
            });
            if (r?.snapshot)
              setSnapshots((p) => [
                { ...r.snapshot, nodes: currentNodes, edges: currentEdges },
                ...p,
              ]);
          } else {
            const s: MapSnapshot = {
              id: `snap-${Date.now()}`,
              timestamp: Date.now(),
              label: lbl,
              nodeCount: currentNodes.length,
              edgeCount: currentEdges.length,
              nodes: currentNodes,
              edges: currentEdges,
            };
            setSnapshots((p) => {
              const u = [s, ...p];
              saveLocal(ideaId, u);
              return u;
            });
          }
        } catch {
          /* silent */
        }
      })();
    }
  }, [
    currentNodes.length,
    autoSnapshotThreshold,
    ideaId,
    open,
    backend,
    currentNodes,
    currentEdges,
  ]);

  useEffect(() => {
    if (!open) return;
    let c = false;
    (async () => {
      try {
        const d = await Api.getMyIdeaMapSnapshots(ideaId);
        if (!c && Array.isArray(d?.snapshots)) {
          setSnapshots(d.snapshots);
          setBackend(true);
          return;
        }
      } catch {
        /* unavailable */
      }
      if (!c) {
        setSnapshots(loadLocal(ideaId));
        setBackend(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [ideaId, open]);

  const save = useCallback(async () => {
    const l = label.trim();
    if (!l) return;
    setSaving(true);
    try {
      if (backend) {
        const r = await Api.createMyIdeaMapSnapshot(ideaId, {
          label: l,
          nodes: currentNodes,
          edges: currentEdges,
        });
        if (r?.snapshot)
          setSnapshots((p) => [{ ...r.snapshot, nodes: currentNodes, edges: currentEdges }, ...p]);
      } else {
        const s: MapSnapshot = {
          id: `snap-${Date.now()}`,
          timestamp: Date.now(),
          label: l,
          nodeCount: currentNodes.length,
          edgeCount: currentEdges.length,
          nodes: currentNodes,
          edges: currentEdges,
        };
        setSnapshots((p) => {
          const u = [s, ...p];
          saveLocal(ideaId, u);
          return u;
        });
      }
      toast.success(t('Snapshot zapisany', 'Snapshot saved'), { duration: 1000 });
      setLabel('');
      setShowInput(false);
    } catch {
      toast.error(t('Błąd zapisu', 'Save failed'));
    } finally {
      setSaving(false);
    }
  }, [currentEdges, currentNodes, ideaId, label, backend]);

  const restore = useCallback(
    (s: MapSnapshot) => {
      if (
        !window.confirm(
          t(
            `Przywrócić "${s.label}"? Obecna mapa zostanie zastąpiona.`,
            `Restore "${s.label}"? Current map will be replaced.`
          )
        )
      )
        return;
      if (previewing) {
        beforeRef.current = null;
        setPreviewing(false);
      }
      onRestore(s.nodes, s.edges);
      toast.success(t('Przywrócono snapshot', 'Snapshot restored'), { duration: 1200 });
      onClose();
    },
    [onClose, onRestore, previewing]
  );

  const del = useCallback(
    async (id: string) => {
      try {
        if (backend) await Api.deleteMyIdeaMapSnapshot(ideaId, id);
      } catch {
        /* ignore */
      }
      setSnapshots((p) => {
        const u = p.filter((s) => s.id !== id);
        if (!backend) saveLocal(ideaId, u);
        return u;
      });
    },
    [ideaId, backend]
  );

  const preview = useCallback(
    (s: MapSnapshot) => {
      if (!onPreview) return;
      if (!beforeRef.current) beforeRef.current = { nodes: currentNodes, edges: currentEdges };
      onPreview(s.nodes, s.edges);
      setPreviewing(true);
    },
    [currentNodes, currentEdges, onPreview]
  );

  const cancelPreview = useCallback(() => {
    if (beforeRef.current && onPreview) onPreview(beforeRef.current.nodes, beforeRef.current.edges);
    beforeRef.current = null;
    setPreviewing(false);
  }, [onPreview]);

  const close = useCallback(() => {
    if (previewing) cancelPreview();
    onClose();
  }, [onClose, previewing, cancelPreview]);

  const saveLabel = useCallback(
    (id: string, v: string) => {
      const tr = v.trim();
      if (!tr) {
        setEditId(null);
        return;
      }
      setSnapshots((p) => {
        const u = p.map((s) => (s.id === id ? { ...s, label: tr } : s));
        if (!backend) saveLocal(ideaId, u);
        return u;
      });
      setEditId(null);
    },
    [ideaId, backend]
  );

  const sorted = [...snapshots].sort((a, b) => b.timestamp - a.timestamp);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {t('Historia wersji', 'Version History')}
            </h3>
            {!backend && (
              <span className="text-[9px] rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {t('tryb lokalny', 'local mode')}
              </span>
            )}
            {previewing && (
              <span className="text-[9px] rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {t('podgląd', 'preview')}
              </span>
            )}
          </div>
          <button
            onClick={close}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-3 max-h-[50vh] overflow-y-auto">
          {showInput ? (
            <div className="mb-3 flex items-center gap-2">
              <input
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') {
                    setShowInput(false);
                    setLabel('');
                  }
                }}
                placeholder={t('Nazwa snapshotu...', 'Snapshot name...')}
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-amber-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
              />
              <button
                onClick={save}
                disabled={!label.trim() || saving}
                className="rounded bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-40"
              >
                <Save size={12} />
              </button>
              <button
                onClick={() => {
                  setShowInput(false);
                  setLabel('');
                }}
                className="rounded px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setLabel(t(`Wersja ${snapshots.length + 1}`, `Version ${snapshots.length + 1}`));
                setShowInput(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-500/8 hover:from-amber-500/15 hover:to-amber-500/12 transition-all mb-3"
            >
              <Save size={14} className="text-amber-600" />
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                {t('Zapisz aktualny stan', 'Save current state')}
              </span>
            </button>
          )}
          {sorted.length === 0 ? (
            <div className="text-center py-8 text-[11px] text-slate-600">
              {t('Brak zapisanych snapshotów', 'No snapshots saved yet')}
            </div>
          ) : (
            <div className="relative pl-5">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200 dark:bg-navy-700" />
              {sorted.map((snap, idx) => {
                const prev = idx < sorted.length - 1 ? sorted[idx + 1] : null;
                const diff = prev ? diffSnap(snap, prev) : null;
                const hov = hovId === snap.id;
                const editing = editId === snap.id;
                return (
                  <div
                    key={snap.id}
                    className="relative mb-3 last:mb-0"
                    onMouseEnter={() => {
                      setHovId(snap.id);
                      if (onPreview) preview(snap);
                    }}
                    onMouseLeave={() => {
                      setHovId(null);
                      if (previewing) cancelPreview();
                    }}
                  >
                    <div
                      className={`absolute -left-5 top-3 w-3 h-3 rounded-full border-2 border-white dark:border-navy-900 ${dotColor(snap.timestamp)} ${hov ? 'ring-2 ring-amber-300/50' : ''}`}
                    />
                    <div
                      className={`p-3 rounded-xl border transition-all ${hov ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-700/30' : 'bg-slate-50/50 dark:bg-navy-950/20 border-slate-200/30 dark:border-navy-700/30'}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {editing ? (
                          <input
                            autoFocus
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveLabel(snap.id, editLabel);
                              if (e.key === 'Escape') setEditId(null);
                            }}
                            onBlur={() => saveLabel(snap.id, editLabel)}
                            className="flex-1 min-w-0 rounded border border-amber-400 px-1.5 py-0.5 text-[11px] font-medium outline-none dark:bg-navy-800 dark:text-white"
                          />
                        ) : (
                          <span
                            className="flex-1 min-w-0 truncate text-[11px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:text-amber-600 dark:hover:text-amber-400"
                            onClick={() => {
                              setEditId(snap.id);
                              setEditLabel(snap.label);
                            }}
                            title={t('Kliknij aby edytować', 'Click to edit')}
                          >
                            {snap.label}
                          </span>
                        )}
                        {editing && (
                          <button
                            onClick={() => saveLabel(snap.id, editLabel)}
                            className="p-0.5 text-emerald-500 hover:text-emerald-600"
                          >
                            <Check size={10} />
                          </button>
                        )}
                        {!editing && hov && (
                          <button
                            onClick={() => {
                              setEditId(snap.id);
                              setEditLabel(snap.label);
                            }}
                            className="p-0.5 text-slate-600 hover:text-amber-500"
                          >
                            <Pencil size={10} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-600">
                        <span>{relTime(snap.timestamp, pl)}</span>
                        <span>·</span>
                        <span>
                          {snap.nodeCount} {t('węzłów', 'nodes')}
                        </span>
                        <span>·</span>
                        <span>
                          {snap.edgeCount} {t('krawędzi', 'edges')}
                        </span>
                      </div>
                      {diff && <DiffBadge diff={diff} pl={pl} />}
                      {hov && (
                        <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-slate-200/30 dark:border-navy-700/30">
                          <button
                            onClick={() => restore(snap)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-amber-600 hover:bg-amber-500/10 transition-colors"
                          >
                            <RotateCcw size={10} />
                            {t('Przywróć', 'Restore')}
                          </button>
                          <button
                            onClick={() => del(snap.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 size={10} />
                            {t('Usuń', 'Delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SnapshotHistory;
