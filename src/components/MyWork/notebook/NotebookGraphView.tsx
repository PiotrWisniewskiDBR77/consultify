/**
 * NotebookGraphView — a react-flow graph of a notebook page's connections:
 * its topics (`/api/v8/notebook/pages/:id/topics`) and its backlinks
 * (existing `/api/my-work/link-graph/backlinks`).
 *
 * The center node is the current page; topic nodes fan out to the left,
 * backlink (referencing entity) nodes to the right. Both fetches are in
 * try/catch — if a fetch fails, the graph still renders with whatever it
 * could load (or an empty-state).
 *
 * #18 fixes (connection graph was "dziwny" — audit findings):
 *  - Topics used to call `/notebook/topics?pageId=` — that route ignores
 *    `pageId` and lists ALL org topics, so every note's graph fanned out
 *    the entire organization's topic list. Now calls the real page-scoped
 *    route (`/notebook/pages/:id/topics`, added alongside this fix).
 *  - Backlinks used to query `type=note`, which never matches a real
 *    `link_graph_edges.target_type` (notes use 'notebook_page'/'notebook'),
 *    so the right-hand fan was silently always empty. Now queries both.
 *  - Backlink nodes used to show a raw id prefix ("task: a1b2c3d4"). Now
 *    resolved to real titles via the same `notebookResolveEmbedChips` path
 *    NotebookBacklinksBar already uses.
 *  - Node colors were hardcoded light-mode hex with no dark variant, so the
 *    graph clashed against the dark theme. Now driven by the `--c-*` CSS
 *    custom properties (see src/index.css), which already flip per theme.
 *  - Dropped the MiniMap: production mounts this at a fixed w-72 (288px)
 *    panel (see NotebookContent), where react-flow's default minimap covers
 *    a large chunk of the already-small canvas and can overlap nodes. A
 *    handful of topic/backlink nodes doesn't need a minimap to navigate.
 *
 * Integration: render in the notebook right-rail / "connections" tab (see SLOT
 * comments in NotebookContent owned by Agent 4). Wrap is self-contained
 * (ReactFlowProvider included).
 */
import 'reactflow/dist/style.css';

import { Loader2, Network } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  ReactFlowProvider,
} from 'reactflow';

import { Api } from '@/services/api';

interface TopicLite {
  id: string;
  name: string;
  pageCount?: number;
}

interface BacklinkLite {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
}

interface NotebookGraphViewProps {
  pageId: string;
  pageTitle?: string | null;
  isPolish?: boolean;
  className?: string;
  height?: number | string;
}

const authHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') || '' : '';
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function fetchTopics(pageId: string): Promise<TopicLite[]> {
  try {
    // #18 — page-scoped topics (was calling the org-wide list with an ignored
    // pageId query param; see route registerNotebookTopicsRoutes GET /pages/:id/topics).
    const res = await fetch(`/api/v8/notebook/pages/${encodeURIComponent(pageId)}/topics`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => ({}));
    const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    return rows
      .map((r: any) => ({
        id: String(r?.id ?? r?.topicId ?? ''),
        name: String(r?.name ?? r?.title ?? r?.label ?? 'Topic'),
        pageCount: Number(r?.pageCount ?? r?.noteCount ?? 0) || undefined,
      }))
      .filter((t: TopicLite) => t.id);
  } catch {
    return [];
  }
}

async function fetchBacklinkRefs(
  pageId: string
): Promise<Array<{ sourceType: string; sourceId: string }>> {
  try {
    // #18 — a note's incoming edges land under target_type 'notebook_page' or
    // 'notebook' (see link_graph_edges usage in notebookConversionService /
    // notebookSearchService), never 'note'. Query both, same as
    // NotebookBacklinksBar's "Mentioned in" strip.
    const [a, b] = await Promise.all([
      fetch(
        `/api/my-work/link-graph/backlinks?type=notebook_page&id=${encodeURIComponent(pageId)}&limit=50`,
        { headers: { ...authHeaders() } }
      ),
      fetch(
        `/api/my-work/link-graph/backlinks?type=notebook&id=${encodeURIComponent(pageId)}&limit=50`,
        { headers: { ...authHeaders() } }
      ),
    ]);
    const parse = async (res: Response) => {
      if (!res.ok) return [];
      const json = await res.json().catch(() => ({}));
      return Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    };
    const rows = [...(await parse(a)), ...(await parse(b))]
      .map((r: any) => ({
        sourceType: String(r?.sourceType ?? 'ref'),
        sourceId: String(r?.sourceId ?? ''),
      }))
      .filter((b: { sourceId: string }) => b.sourceId);

    // De-dupe (a source can appear via both queries).
    const seen = new Set<string>();
    return rows.filter((r) => {
      const k = `${r.sourceType}:${r.sourceId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  } catch {
    return [];
  }
}

async function fetchBacklinks(pageId: string): Promise<BacklinkLite[]> {
  const refs = await fetchBacklinkRefs(pageId);
  if (refs.length === 0) return [];

  // #18 — resolve real titles instead of showing a raw id prefix, same path
  // NotebookBacklinksBar already uses.
  let titleByKey = new Map<string, string>();
  try {
    const resolved = await Api.notebookResolveEmbedChips(
      refs.slice(0, 20).map((r) => ({ type: r.sourceType, id: r.sourceId }))
    );
    titleByKey = new Map(
      (resolved?.chips || []).map((c) => [`${c.artifactType}:${c.artifactId}`, c.title || ''])
    );
  } catch {
    // Degraded: fall back to id-based labels below.
  }

  return refs.map((r) => ({
    id: `${r.sourceType}-${r.sourceId}`,
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    title: titleByKey.get(`${r.sourceType}:${r.sourceId}`) || `${r.sourceType} ${r.sourceId.slice(0, 6)}`,
  }));
}

export const NotebookGraphView: React.FC<NotebookGraphViewProps> = ({
  pageId,
  pageTitle = '',
  isPolish = false,
  className = '',
  height = 360,
}) => {
  const [topics, setTopics] = useState<TopicLite[]>([]);
  const [backlinks, setBacklinks] = useState<BacklinkLite[]>([]);
  const [loading, setLoading] = useState(false);

  const t = useMemo(
    () => ({
      title: isPolish ? 'Graf powiązań' : 'Connection graph',
      empty: isPolish
        ? 'Brak tematów ani powiązań dla tej notatki.'
        : 'No topics or backlinks for this note yet.',
      topics: isPolish ? 'Tematy' : 'Topics',
      backlinks: isPolish ? 'Powiązania' : 'Backlinks',
    }),
    [isPolish]
  );

  useEffect(() => {
    if (!pageId) return;
    let cancelled = false;
    setLoading(true);
    void Promise.all([fetchTopics(pageId), fetchBacklinks(pageId)]).then(([tp, bl]) => {
      if (cancelled) return;
      setTopics(tp);
      setBacklinks(bl);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    const centerLabel = String(pageTitle || '').trim() || (isPolish ? 'Notatka' : 'Note');
    const nodes: Node[] = [
      {
        id: 'center',
        position: { x: 0, y: 0 },
        data: { label: centerLabel },
        style: {
          background: 'var(--c-info)',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontWeight: 600,
          fontSize: 13,
          padding: 10,
          width: 180,
        },
      },
    ];
    const edges: Edge[] = [];

    const stepY = 80;
    topics.forEach((topic, i) => {
      const id = `topic-${topic.id}`;
      const offset = (i - (topics.length - 1) / 2) * stepY;
      nodes.push({
        id,
        position: { x: -300, y: offset },
        data: {
          label: topic.pageCount ? `${topic.name} (${topic.pageCount})` : topic.name,
        },
        style: {
          background: 'color-mix(in srgb, var(--c-info) 10%, var(--c-surface))',
          color: 'var(--c-text)',
          border: '1px solid var(--c-border)',
          borderRadius: 10,
          fontSize: 12,
          padding: 8,
          width: 160,
        },
      });
      edges.push({ id: `e-${id}`, source: id, target: 'center', animated: false });
    });

    backlinks.forEach((bl, i) => {
      const id = `bl-${bl.id}`;
      const offset = (i - (backlinks.length - 1) / 2) * stepY;
      nodes.push({
        id,
        position: { x: 300, y: offset },
        data: { label: bl.title },
        style: {
          background: 'var(--c-surface-raised)',
          color: 'var(--c-text-secondary)',
          border: '1px solid var(--c-border)',
          borderRadius: 10,
          fontSize: 12,
          padding: 8,
          width: 160,
        },
      });
      edges.push({ id: `e-${id}`, source: 'center', target: id, animated: false });
    });

    return { nodes, edges };
  }, [topics, backlinks, pageTitle, isPolish]);

  const isEmpty = topics.length === 0 && backlinks.length === 0;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-c-text">
        <Network className="h-4 w-4 text-c-text-muted" />
        <span>{t.title}</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-c-text-muted" />}
        {!loading && (
          <span className="text-[11px] font-normal text-c-text-muted">
            {topics.length} {t.topics.toLowerCase()} • {backlinks.length}{' '}
            {t.backlinks.toLowerCase()}
          </span>
        )}
      </div>

      <div
        className="overflow-hidden rounded-xl border border-c-border-subtle bg-c-surface-raised/40 dark:border-white/10 dark:bg-white/[0.02]"
        style={{ height }}
      >
        {!loading && isEmpty ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-c-text-muted">
            {t.empty}
          </div>
        ) : (
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              proOptions={{ hideAttribution: true }}
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable
            >
              <Background gap={16} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
};

export default NotebookGraphView;
