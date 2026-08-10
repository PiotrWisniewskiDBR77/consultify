/**
 * SnapshotHistory — Visual timeline for map version history.
 * Supports diff preview, inline label editing, auto-snapshot, and preview-on-hover.
 */
import { Check, Clock, Pencil, RotateCcw, Save, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import { Api } from '@/services/api';

export interface MapSnapshot {
  id: string;
  timestamp: number;
  label: string;
  nodeCount: number;
  edgeCount: number;
  nodes: any[];
  edges: any[];
  // Tool-specific state captured at snapshot time. Absent on snapshots taken
  // before extension-capture landed → restore falls back to preserving live
  // extensions. Works uniformly for every canvas tool (mindmap/whiteboard/
  // process_flow/table) since they share one per-idea graph.
  extensions?: Record<string, unknown>;
}

interface SnapshotHistoryProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  currentNodes: any[];
  currentEdges: any[];
  // Live tool-specific state (graphRuntime.graph.extensions). Captured into new
  // snapshots so restore rolls back the whole tool, not just shared nodes/edges.
  currentExtensions?: Record<string, unknown>;
  onRestore: (nodes: any[], edges: any[], extensions?: Record<string, unknown>) => void;
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
  return h < 1 ? 'bg-c-success' : h < 24 ? 'bg-c-warning' : 'bg-c-surface-raised';
}

const DiffBadge: React.FC<{ diff: SnapshotDiff; pl: boolean }> = ({ diff, pl }) => {
  const items: [number, string, string][] = [
    [diff.addedNodes, '+', pl ? 'węzłów' : 'nodes'],
    [-diff.removedNodes, '-', pl ? 'węzłów' : 'nodes'],
    [diff.addedEdges, '+', pl ? 'krawędzi' : 'edges'],
    [-diff.removedEdges, '-', pl ? 'krawędzi' : 'edges'],
  ];
  const colors = [
    'bg-c-surface-raised dark:bg-c-surface-raised text-c-success dark:text-c-success',
    'bg-c-surface-raised dark:bg-c-surface-raised text-c-danger dark:text-c-danger',
    'bg-c-surface-raised dark:bg-c-surface-raised text-c-info dark:text-c-info',
    'bg-c-surface-raised dark:bg-c-surface-raised text-c-warning dark:text-c-warning',
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
  currentExtensions,
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
              ...(currentExtensions ? { extensions: currentExtensions } : {}),
            });
            if (r?.snapshot)
              setSnapshots((p) => [
                {
                  ...r.snapshot,
                  nodes: currentNodes,
                  edges: currentEdges,
                  extensions: currentExtensions,
                },
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
              extensions: currentExtensions,
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
    currentExtensions,
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
          ...(currentExtensions ? { extensions: currentExtensions } : {}),
        });
        if (r?.snapshot)
          setSnapshots((p) => [
            {
              ...r.snapshot,
              nodes: currentNodes,
              edges: currentEdges,
              extensions: currentExtensions,
            },
            ...p,
          ]);
      } else {
        const s: MapSnapshot = {
          id: `snap-${Date.now()}`,
          timestamp: Date.now(),
          label: l,
          nodeCount: currentNodes.length,
          edgeCount: currentEdges.length,
          nodes: currentNodes,
          edges: currentEdges,
          extensions: currentExtensions,
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
  }, [currentEdges, currentNodes, currentExtensions, ideaId, label, backend]);

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
      onRestore(s.nodes, s.edges, s.extensions);
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
  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="snapshot-history-modal-heading"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-c-warning" />
            <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="snapshot-history-modal-heading">
              {t('Historia wersji', 'Version History')}
            </h3>
            {!backend && (
              <span className="text-[9px] rounded bg-c-surface-raised px-1.5 py-0.5 text-c-warning dark:bg-c-surface dark:text-c-warning">
                {t('tryb lokalny', 'local mode')}
              </span>
            )}
            {previewing && (
              <span className="text-[9px] rounded bg-c-surface-raised px-1.5 py-0.5 text-c-info dark:bg-c-surface dark:text-c-info">
                {t('podgląd', 'preview')}
              </span>
            )}
          </div>
          <button
            onClick={close}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
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
                className="flex-1 rounded border border-c-border-subtle px-2 py-1.5 text-xs outline-none focus:border-c-warning dark:border-c-border-subtle dark:bg-c-surface dark:text-c-text"
              />
              <button
                onClick={save}
                disabled={!label.trim() || saving}
                className="rounded bg-c-warning px-3 py-1.5 text-xs font-bold text-c-text hover:bg-c-warning disabled:opacity-40"
              >
                <Save size={12} />
              </button>
              <button
                onClick={() => {
                  setShowInput(false);
                  setLabel('');
                }}
                className="rounded px-2 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface"
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
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-c-surface-raised transition-all mb-3"
            >
              <Save size={14} className="text-c-warning" />
              <span className="text-[11px] font-bold text-c-warning dark:text-c-warning">
                {t('Zapisz aktualny stan', 'Save current state')}
              </span>
            </button>
          )}
          {sorted.length === 0 ? (
            <div className="text-center py-8 text-[11px] text-c-text-secondary">
              {t('Brak zapisanych snapshotów', 'No snapshots saved yet')}
            </div>
          ) : (
            <div className="relative pl-5">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-c-surface-raised dark:bg-c-surface" />
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
                      className={`absolute -left-5 top-3 w-3 h-3 rounded-full border-2 border-c-border-subtle dark:border-c-border-subtle ${dotColor(snap.timestamp)} ${hov ? 'ring-2 ring-c-warning' : ''}`}
                    />
                    <div
                      className={`p-3 rounded-xl border transition-all ${hov ? 'bg-c-surface-raised dark:bg-c-surface border-c-warning dark:border-c-warning' : 'bg-c-surface-raised dark:bg-c-surface border-c-border-subtle dark:border-c-border-subtle'}`}
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
                            className="flex-1 min-w-0 rounded border border-c-warning px-1.5 py-0.5 text-[11px] font-medium outline-none dark:bg-c-surface dark:text-c-text"
                          />
                        ) : (
                          <span
                            className="flex-1 min-w-0 truncate text-[11px] font-medium text-c-text-secondary dark:text-c-text cursor-pointer hover:text-c-warning dark:hover:text-c-warning"
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
                            className="p-0.5 text-c-success hover:text-c-success"
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
                            className="p-0.5 text-c-text-secondary hover:text-c-warning"
                          >
                            <Pencil size={10} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[9px] text-c-text-secondary">
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
                        <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-c-border-subtle dark:border-c-border-subtle">
                          <button
                            onClick={() => restore(snap)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-c-warning hover:bg-c-surface-raised transition-colors"
                          >
                            <RotateCcw size={10} />
                            {t('Przywróć', 'Restore')}
                          </button>
                          <button
                            onClick={() => del(snap.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-c-text-secondary hover:text-c-danger hover:bg-c-surface-raised transition-colors"
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
