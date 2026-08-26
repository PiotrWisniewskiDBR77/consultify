/**
 * KnowledgeGraphExplorer — V4-ORG-05..09 frontend.
 *
 * Interactive graph explorer using React Flow + dagre for auto-layout.
 * Connects to /api/knowledge-graph/* via Api.kg* methods.
 */
import 'reactflow/dist/style.css';

import dagre from 'dagre';
import {
  AlertTriangle,
  ChevronRight,
  Eye,
  GitBranch,
  Loader2,
  Network,
  RefreshCw,
  Search,
  Shield,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  useEdgesState,
  useNodesState,
} from 'reactflow';

import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';

interface KGEntity {
  id: string;
  canonical_name: string;
  entity_type: string;
  confidence: number;
  pii_flag?: boolean;
  redacted?: boolean;
  source_artifact_type?: string;
  source_artifact_id?: string;
  mention_count?: number;
}

interface KGRelation {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  confidence: number;
}

interface KGStats {
  totalEntities: number;
  totalRelations: number;
  entityTypes: Record<string, number>;
  avgConfidence: number;
  staleEntities: number;
  redactedEntities: number;
}

interface KGProvenance {
  sourceArtifacts: { type: string; id: string; title?: string }[];
  relatedRelations: KGRelation[];
  whyExplainer: string;
}

const ENTITY_COLORS: Record<string, string> = {
  person: '#6366f1',
  organization: '#0ea5e9',
  concept: '#6366f1',
  technology: '#10b981',
  location: '#f59e0b',
  process: '#ec4899',
  metric: '#3b82f6',
  default: '#64748b',
};

function getEntityColor(type: string): string {
  return ENTITY_COLORS[type.toLowerCase()] || ENTITY_COLORS.default;
}

function layoutGraph(
  entities: KGEntity[],
  relations: KGRelation[]
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120 });

  entities.forEach((e) => g.setNode(e.id, { width: 180, height: 60 }));
  relations.forEach((r) => g.setEdge(r.source_entity_id, r.target_entity_id));

  dagre.layout(g);

  const nodes: Node[] = entities.map((e) => {
    const pos = g.node(e.id);
    return {
      id: e.id,
      position: { x: (pos?.x ?? 0) - 90, y: (pos?.y ?? 0) - 30 },
      data: {
        label: e.canonical_name,
        entityType: e.entity_type,
        confidence: e.confidence,
        pii: e.pii_flag,
        redacted: e.redacted,
      },
      style: {
        background: `${getEntityColor(e.entity_type)}15`,
        border: `1.5px solid ${getEntityColor(e.entity_type)}60`,
        borderRadius: 12,
        padding: '8px 12px',
        fontSize: 11,
        fontWeight: 600,
        color: getEntityColor(e.entity_type),
        width: 180,
      },
    };
  });

  const edges: Edge[] = relations.map((r) => ({
    id: r.id,
    source: r.source_entity_id,
    target: r.target_entity_id,
    label: r.relation_type.replace(/_/g, ' '),
    style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    labelStyle: { fontSize: 9, fill: '#94a3b8' },
    animated: r.confidence < 0.5,
  }));

  return { nodes, edges };
}

export const KnowledgeGraphExplorer: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<KGStats | null>(null);
  const [entities, setEntities] = useState<KGEntity[]>([]);
  const [relations, setRelations] = useState<KGRelation[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<KGEntity | null>(null);
  const [provenance, setProvenance] = useState<KGProvenance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const loadStats = useCallback(async () => {
    try {
      const data = await Api.kgGetStats();
      setStats(data);
    } catch {
      /* stats are optional */
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedEntity(null);
    setProvenance(null);
    try {
      const results: KGEntity[] = await Api.kgSearchEntities({ q: query.trim(), limit: 50 });
      setEntities(results);

      const allRelations: KGRelation[] = [];
      const seen = new Set<string>();
      for (const e of results.slice(0, 20)) {
        try {
          const rels: KGRelation[] = await Api.kgGetEntityRelations(e.id, { limit: 10 });
          for (const r of rels) {
            if (!seen.has(r.id)) {
              seen.add(r.id);
              allRelations.push(r);
            }
          }
        } catch {
          /* skip individual failures */
        }
      }
      setRelations(allRelations);

      const { nodes: n, edges: e } = layoutGraph(results, allRelations);
      setNodes(n);
      setEdges(e);
    } catch (err: any) {
      setError(err?.message || 'Failed to search knowledge graph');
    } finally {
      setLoading(false);
    }
  }, [query, setNodes, setEdges]);

  const handleTraverse = useCallback(
    async (entityId: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await Api.kgTraverse({
          startEntityId: entityId,
          maxDepth: 3,
          limit: 50,
        });
        const traversedEntities: KGEntity[] = result.entities || [];
        const traversedRelations: KGRelation[] = result.relations || [];
        setEntities(traversedEntities);
        setRelations(traversedRelations);

        const { nodes: n, edges: e } = layoutGraph(traversedEntities, traversedRelations);
        setNodes(n);
        setEdges(e);
      } catch (err: any) {
        setError(err?.message || 'Traversal failed');
      } finally {
        setLoading(false);
      }
    },
    [setNodes, setEdges]
  );

  const handleNodeClick = useCallback(
    async (_: any, node: Node) => {
      const entity = entities.find((e) => e.id === node.id);
      if (!entity) return;
      setSelectedEntity(entity);
      try {
        const prov = await Api.kgGetProvenance(entity.id);
        setProvenance(prov);
      } catch {
        setProvenance(null);
      }
    },
    [entities]
  );

  const entityTypeBreakdown = useMemo(() => {
    if (!stats?.entityTypes) return [];
    return Object.entries(stats.entityTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [stats]);

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] gap-4">
      {/* Stats strip */}
      {stats && (
        <div className="flex items-center gap-4 flex-wrap">
          {[
            {
              label: t('organization.knowledgeGraph.stats.entities', 'Entities'),
              value: stats.totalEntities,
            },
            {
              label: t('organization.knowledgeGraph.stats.relations', 'Relations'),
              value: stats.totalRelations,
            },
            {
              label: t('organization.knowledgeGraph.stats.avgConfidence', 'Avg confidence'),
              value: `${(stats.avgConfidence * 100).toFixed(0)}%`,
            },
            {
              label: t('organization.knowledgeGraph.stats.stale', 'Stale'),
              value: stats.staleEntities,
            },
            {
              label: t('organization.knowledgeGraph.stats.redacted', 'Redacted'),
              value: stats.redactedEntities,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-navy-900/50 border border-slate-200/60 dark:border-navy-700/60"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {s.label}
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-white">{s.value}</span>
            </div>
          ))}
          {entityTypeBreakdown.map(([type, count]) => (
            <div
              key={type}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium"
              style={{
                background: `${getEntityColor(type)}15`,
                color: getEntityColor(type),
              }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: getEntityColor(type) }} />
              {type} ({count})
            </div>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t(
              'organization.knowledgeGraph.searchPlaceholder',
              'Search knowledge graph entities...'
            )}
            className="w-full h-9 pl-9 pr-3 rounded-xl text-xs bg-white dark:bg-navy-900/50 border border-slate-200/60 dark:border-navy-700/60 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[var(--c-focus)]"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="h-9 px-4 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-40 transition-colors flex items-center gap-1.5"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {t('organization.knowledgeGraph.search', 'Search')}
        </button>
        <button
          onClick={loadStats}
          className="h-9 px-3 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          title={t('organization.knowledgeGraph.refreshStats', 'Refresh stats')}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 text-xs">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Main content: graph + detail panel */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Graph */}
        <div className="flex-1 rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900/30 overflow-hidden">
          {entities.length === 0 ? (
            stats && stats.totalEntities === 0 ? (
              // P2-2: onboarding empty state for a fresh org with no graph yet.
              <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-3">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-crimson-50 text-crimson-600 dark:bg-crimson-950/40 dark:text-crimson-400">
                  <Network size={32} />
                </span>
                <p className="text-base font-semibold text-slate-800 dark:text-white">
                  {t('organization.knowledgeGraph.emptyOrg.title', 'Your knowledge graph is empty')}
                </p>
                <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
                  {t(
                    'organization.knowledgeGraph.emptyOrg.description',
                    'Your knowledge graph will fill as Teresa processes interviews, documents, and organization context.'
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.ORGANIZATION.PROFILE)}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-crimson-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-crimson-700"
                >
                  {t(
                    'organization.knowledgeGraph.emptyOrg.setupProfile',
                    'Set up your org profile'
                  )}
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
                <Network size={48} className="opacity-30" />
                <p className="text-sm font-medium">
                  {t(
                    'organization.knowledgeGraph.emptySearch.title',
                    'Search entities to explore the knowledge graph'
                  )}
                </p>
                <p className="text-xs opacity-60">
                  {t(
                    'organization.knowledgeGraph.emptySearch.hint',
                    'Click a node to see details and provenance'
                  )}
                </p>
              </div>
            )
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              fitView
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(n: any) => getEntityColor(n.data?.entityType || 'default')}
                maskColor="rgba(0,0,0,0.08)"
              />
            </ReactFlow>
          )}
        </div>

        {/* Detail panel */}
        {selectedEntity && (
          <div className="w-80 shrink-0 rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900/30 overflow-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/40 dark:border-navy-700/40">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: getEntityColor(selectedEntity.entity_type) }}
                />
                <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
                  {selectedEntity.canonical_name}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedEntity(null);
                  setProvenance(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                <X size={12} className="text-slate-600" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Properties */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {t('organization.knowledgeGraph.properties', 'Properties')}
                </h4>
                {[
                  {
                    k: t('organization.knowledgeGraph.type', 'Type'),
                    v: selectedEntity.entity_type,
                  },
                  {
                    k: t('organization.knowledgeGraph.confidence', 'Confidence'),
                    v: `${(selectedEntity.confidence * 100).toFixed(0)}%`,
                  },
                  {
                    k: t('organization.knowledgeGraph.mentions', 'Mentions'),
                    v: selectedEntity.mention_count ?? '—',
                  },
                ].map((p) => (
                  <div key={p.k} className="flex justify-between text-xs">
                    <span className="text-slate-500">{p.k}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{p.v}</span>
                  </div>
                ))}
                {selectedEntity.pii_flag && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600">
                    <Shield size={12} />
                    PII
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleTraverse(selectedEntity.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                >
                  <GitBranch size={12} />
                  {t('organization.knowledgeGraph.traverse', 'Traverse')}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const prov = await Api.kgGetProvenance(selectedEntity.id);
                      setProvenance(prov);
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                >
                  <Eye size={12} />
                  {t('organization.knowledgeGraph.provenance', 'Provenance')}
                </button>
              </div>

              {/* Provenance */}
              {provenance && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {t('organization.knowledgeGraph.provenance', 'Provenance')}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {provenance.whyExplainer}
                  </p>
                  {provenance.sourceArtifacts.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold uppercase text-slate-600">
                        {t('organization.knowledgeGraph.sources', 'Sources')}
                      </span>
                      {provenance.sourceArtifacts.map((sa, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 text-[10px] text-slate-500"
                        >
                          <ChevronRight size={10} />
                          <span className="font-medium">{sa.type}</span>
                          {sa.title && <span className="truncate">— {sa.title}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraphExplorer;
