import { Loader2, Save } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { InlineTable } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';

import type { CanvasToolType } from './IdeaCanvasToolSelector';

type IdeaMapNode = {
  id: string;
  type?: string;
  data?: Record<string, any>;
  position?: { x: number; y: number };
};

type IdeaMapEdge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, any>;
};

interface IdeaTableToolProps {
  open: boolean;
  ideaId: string;
  locked?: boolean;
  refreshToken?: number;
  onSaved?: () => void;
}

export const IdeaTableTool: React.FC<IdeaTableToolProps> = ({
  open,
  ideaId,
  locked = false,
  refreshToken,
  onSaved,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes] = useState<IdeaMapNode[]>([]);
  const [edges, setEdges] = useState<IdeaMapEdge[]>([]);
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});

  const didPersistPreferredRef = useRef(false);

  const hydrate = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await Api.getMyIdeaMap(ideaId, { language: i18n.language });
      const map = res?.map || {};
      const nextNodes = Array.isArray(map.nodes) ? (map.nodes as any[]) : [];
      const nextEdges = Array.isArray(map.edges) ? (map.edges as any[]) : [];
      const nextExtensions =
        map?.extensions && typeof map.extensions === 'object' && !Array.isArray(map.extensions)
          ? (map.extensions as Record<string, unknown>)
          : {};

      setNodes(
        nextNodes
          .map((n: any) => ({
            id: String(n?.id || ''),
            type: n?.type ? String(n.type) : undefined,
            data: n?.data && typeof n.data === 'object' ? n.data : {},
            position: n?.position || undefined,
          }))
          .filter((n: any) => n.id)
      );
      setEdges(
        nextEdges
          .map((e: any) => ({
            id: String(e?.id || ''),
            source: String(e?.source || ''),
            target: String(e?.target || ''),
            type: e?.type ? String(e.type) : undefined,
            data: e?.data && typeof e.data === 'object' ? e.data : {},
          }))
          .filter((e: any) => e.id && e.source && e.target)
      );
      setExtensions(nextExtensions);

      // Persist preferred tool (best-effort) so reopening workspace respects Table view.
      if (!didPersistPreferredRef.current) {
        didPersistPreferredRef.current = true;
        const preferred = map?.preferredTool ? String(map.preferredTool) : null;
        if (preferred !== 'table') {
          Api.saveMyIdeaMap(ideaId, {
            nodes: nextNodes as any,
            edges: nextEdges as any,
            preferredTool: 'table',
            extensions: nextExtensions,
          }).catch(() => undefined);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się wczytać mapy' : 'Failed to load map'));
      setNodes([]);
      setEdges([]);
      setExtensions({});
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, isPl, open]);

  useEffect(() => {
    if (!open) return;
    didPersistPreferredRef.current = false;
    hydrate();
  }, [hydrate, open, refreshToken]);

  const nodeRows = useMemo(() => {
    const visible = (nodes || []).filter((n) => String(n?.type || '') !== 'frame');
    // Stable order: root first, then branches, then others
    const score = (n: IdeaMapNode) => {
      if (n.id === 'root') return 0;
      if (String(n.type) === 'branch') return 1;
      return 2;
    };
    return visible.sort((a, b) => score(a) - score(b));
  }, [nodes]);

  const handleChangeLabel = (id: string, next: string) => {
    setNodes((prev) =>
      (prev || []).map((n) => {
        if (n.id !== id) return n;
        return { ...n, data: { ...(n.data || {}), label: next } };
      })
    );
  };

  const handleSave = useCallback(async () => {
    if (locked) return;
    setSaving(true);
    try {
      await Api.saveMyIdeaMap(ideaId, {
        nodes: nodes as any,
        edges: edges as any,
        preferredTool: 'table' as CanvasToolType,
        extensions,
      });
      toast.success(isPl ? 'Zapisano' : 'Saved', { duration: 900 });
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się zapisać' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }, [edges, extensions, ideaId, isPl, locked, nodes, onSaved]);

  if (!open) return null;

  return (
    <div className="w-full h-full p-4 md:p-6 overflow-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {isPl ? 'Tabela mapy' : 'Map table'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {isPl ? 'Edycja etykiet węzłów (label)' : 'Edit node labels'}
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || locked}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
            saving || loading || locked
              ? 'bg-slate-200/60 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
              : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
          }`}
          title={locked ? (isPl ? 'Tryb tylko do odczytu' : 'Read-only') : isPl ? 'Zapisz' : 'Save'}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? (isPl ? 'Zapisuję…' : 'Saving…') : isPl ? 'Zapisz' : 'Save'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="animate-spin mr-2" size={18} />
          {isPl ? 'Wczytuję…' : 'Loading…'}
        </div>
      ) : (
        <div className="space-y-4">
          <InlineTable
            caption={isPl ? 'Węzły' : 'Nodes'}
            data={nodeRows}
            rowKey={(r) => r.id}
            compact
            striped
            emptyMessage={isPl ? 'Brak węzłów.' : 'No nodes.'}
            columns={[
              {
                key: 'type',
                header: isPl ? 'Typ' : 'Type',
                width: 'w-28',
                render: (row) => (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {row.type || 'node'}
                  </span>
                ),
              },
              {
                key: 'label',
                header: isPl ? 'Etykieta (label)' : 'Label',
                render: (row) => (
                  <input
                    value={String(row?.data?.label || '')}
                    onChange={(e) => handleChangeLabel(row.id, e.target.value)}
                    disabled={locked}
                    className="w-full rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.08] px-2 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500/30"
                    placeholder={isPl ? '—' : '—'}
                  />
                ),
              },
              {
                key: 'meta',
                header: isPl ? 'Meta' : 'Meta',
                width: 'w-40',
                render: (row) => (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {row?.data?.branchKey ? `branch:${row.data.branchKey}` : row.id}
                  </span>
                ),
              },
            ]}
          />

          <InlineTable
            caption={isPl ? 'Połączenia' : 'Edges'}
            data={edges}
            rowKey={(r) => r.id}
            compact
            striped
            emptyMessage={isPl ? 'Brak połączeń.' : 'No edges.'}
            columns={[
              {
                key: 'source',
                header: isPl ? 'Źródło' : 'Source',
                render: (row) => (
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">{row.source}</span>
                ),
              },
              {
                key: 'target',
                header: isPl ? 'Cel' : 'Target',
                render: (row) => (
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">{row.target}</span>
                ),
              },
              {
                key: 'kind',
                header: isPl ? 'Kind' : 'Kind',
                width: 'w-28',
                render: (row) => (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {row?.data?.kind ? String(row.data.kind) : row.type || 'edge'}
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default IdeaTableTool;

