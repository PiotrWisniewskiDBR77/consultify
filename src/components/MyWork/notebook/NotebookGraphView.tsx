/**
 * NotebookGraphView — a react-flow graph of a notebook page's connections:
 * its topics (Agent 1 `/api/v8/notebook/topics`) and its backlinks
 * (existing `/api/my-work/link-graph/backlinks`).
 *
 * The center node is the current page; topic nodes fan out to the left,
 * backlink (referencing entity) nodes to the right. Both fetches are in
 * try/catch — if Agent 1's topics endpoint isn't live yet, the graph still
 * renders with whatever it could load (or an empty-state).
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
  MiniMap,
  type Node,
  ReactFlowProvider,
} from 'reactflow';

interface TopicLite {
  id: string;
  name: string;
  pageCount?: number;
}

interface BacklinkLite {
  id: string;
  sourceType: string;
  sourceId: string;
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
    // Agent 1 contract (assumed): page-scoped topics. Fall back to org topics list.
    const res = await fetch(`/api/v8/notebook/topics?pageId=${encodeURIComponent(pageId)}`, {
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

async function fetchBacklinks(pageId: string): Promise<BacklinkLite[]> {
  try {
    const res = await fetch(
      `/api/my-work/link-graph/backlinks?type=note&id=${encodeURIComponent(pageId)}&limit=50`,
      { headers: { ...authHeaders() } }
    );
    if (!res.ok) return [];
    const json = await res.json().catch(() => ({}));
    const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    return rows
      .map((r: any) => ({
        id: String(r?.id ?? `${r?.sourceType}-${r?.sourceId}`),
        sourceType: String(r?.sourceType ?? 'ref'),
        sourceId: String(r?.sourceId ?? ''),
      }))
      .filter((b: BacklinkLite) => b.sourceId);
  } catch {
    return [];
  }
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
          background: '#1d4ed8',
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
          background: '#eef2ff',
          color: '#3730a3',
          border: '1px solid #c7d2fe',
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
        data: { label: `${bl.sourceType}: ${bl.sourceId.slice(0, 8)}` },
        style: {
          background: '#f1f5f9',
          color: '#334155',
          border: '1px solid #e2e8f0',
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
        className="overflow-hidden rounded-xl border border-c-border bg-slate-50/40 dark:border-c-border-subtle dark:bg-white/[0.02]"
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
              <MiniMap pannable zoomable />
            </ReactFlow>
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
};

export default NotebookGraphView;
