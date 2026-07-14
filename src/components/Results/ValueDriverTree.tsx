/**
 * ValueDriverTree — M15/W2 task 2.3.
 * Interactive driver-tree viz: objective → driver → KPI → initiative.
 * CSS-only tree (no react-flow dep). Each node shows value + confidence.
 * Behind flag resultsFeatureFlags('valueDriverTree').
 */
import { ChevronDown, ChevronRight, GitBranch, TrendingUp } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

interface DriverNode {
  id: string;
  label: string;
  type: 'objective' | 'driver' | 'kpi' | 'initiative';
  value?: number;
  target?: number;
  confidence?: number;
  rolledUpValue?: number;
  children?: string[];
}

interface DriverEdge {
  from: string;
  to: string;
  weight?: number;
}

interface TreeStats {
  totalNodes: number;
  objectiveCount: number;
  kpiCount: number;
  initiativeCount: number;
  coveredValue: number;
}

interface ApiResponse {
  nodes: DriverNode[];
  edges: DriverEdge[];
  stats: TreeStats;
}

const NODE_COLORS: Record<DriverNode['type'], string> = {
  objective:
    'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-800 dark:text-indigo-200',
  driver:
    'bg-sky-100 dark:bg-sky-900/30 border-sky-300 dark:border-sky-600 text-sky-800 dark:text-sky-200',
  kpi: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-600 text-emerald-800 dark:text-emerald-200',
  initiative:
    'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-200',
};

const NODE_ICONS: Record<DriverNode['type'], React.ReactNode> = {
  objective: <TrendingUp size={12} />,
  driver: <GitBranch size={12} />,
  kpi: <TrendingUp size={12} />,
  initiative: <ChevronRight size={12} />,
};

function fmtVal(v: number | undefined): string {
  if (v == null) return '–';
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
}

interface TreeNodeProps {
  node: DriverNode;
  children: DriverNode[];
  depth: number;
  allNodes: Map<string, DriverNode>;
  adjacency: Map<string, string[]>;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, children, depth, allNodes, adjacency }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const { t } = useTranslation();
  const typeLabel = t(`results.driverTree.type.${node.type}`, node.type);

  return (
    <div className="flex flex-col" style={{ paddingLeft: depth > 0 ? '20px' : '0' }}>
      <div className="flex items-start gap-1 mb-1">
        {depth > 0 && (
          <div className="flex flex-col items-center mr-1 mt-2">
            <div className="w-px h-3 bg-slate-300 dark:bg-slate-600" />
            <div className="w-4 h-px bg-slate-300 dark:bg-slate-600" />
          </div>
        )}
        <div
          className={`group flex items-start gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer max-w-xs ${NODE_COLORS[node.type]}`}
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="mt-0.5 shrink-0 opacity-60">{NODE_ICONS[node.type]}</div>
          <div className="min-w-0">
            <div className="font-medium text-xs opacity-60 uppercase tracking-wide">
              {typeLabel}
            </div>
            <div className="font-semibold truncate max-w-[180px]" title={node.label}>
              {node.label}
            </div>
            {(node.rolledUpValue != null || node.value != null) && (
              <div className="text-xs opacity-75 mt-0.5">
                {node.rolledUpValue != null ? fmtVal(node.rolledUpValue) : fmtVal(node.value)}
                {node.target != null && (
                  <span className="opacity-60"> / {fmtVal(node.target)}</span>
                )}
              </div>
            )}
            {node.confidence != null && (
              <div className="text-xs mt-0.5 opacity-60">
                {Math.round(node.confidence * 100)}% confidence
              </div>
            )}
          </div>
          {children.length > 0 && (
            <div className="mt-1 shrink-0 opacity-60">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
          )}
        </div>
      </div>

      {expanded && children.length > 0 && (
        <div className="ml-5 border-l-2 border-slate-200 dark:border-slate-700 pl-2">
          {children.map((child) => {
            const grandChildren = (adjacency.get(child.id) || [])
              .map((cid) => allNodes.get(cid))
              .filter(Boolean) as DriverNode[];
            return (
              <TreeNode
                key={child.id}
                node={child}
                children={grandChildren}
                depth={depth + 1}
                allNodes={allNodes}
                adjacency={adjacency}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

interface Props {
  projectId?: string;
}

const ValueDriverTree: React.FC<Props> = ({ projectId = 'all' }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Api.get(`/results-driver-tree/${projectId}/driver-tree`)
      .then((res: any) => {
        const payload = res?.data ?? res;
        setData(payload);
        setError(null);
      })
      .catch(() => setError(t('results.driverTree.error', 'Failed to load the tree.')))
      .finally(() => setLoading(false));
  }, [projectId, t]);

  const { roots, allNodes, adjacency } = useMemo(() => {
    if (!data) return { roots: [], allNodes: new Map(), adjacency: new Map() };

    const nodeMap = new Map<string, DriverNode>();
    for (const n of data.nodes) nodeMap.set(n.id, n);

    const adj = new Map<string, string[]>();
    const hasParent = new Set<string>();
    for (const e of data.edges) {
      if (!adj.has(e.from)) adj.set(e.from, []);
      adj.get(e.from)!.push(e.to);
      hasParent.add(e.to);
    }

    const rootNodes = data.nodes.filter((n) => !hasParent.has(n.id));
    return { roots: rootNodes, allNodes: nodeMap, adjacency: adj };
  }, [data]);

  if (loading) {
    return (
      <div
        data-testid="value-driver-tree-loading"
        className="flex items-center justify-center py-8 text-slate-400 text-sm"
      >
        <GitBranch size={16} className="mr-2 animate-pulse" />
        {t('common.loading', 'Loading...')}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div data-testid="value-driver-tree-error" className="py-4 text-sm text-slate-400">
        {error || t('results.driverTree.noData', 'No value tree data.')}
      </div>
    );
  }

  return (
    <div data-testid="value-driver-tree" className="space-y-4">
      {/* Stats strip */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: t('results.driverTree.stats.kpis', 'KPI'), value: data.stats.kpiCount },
          {
            label: t('results.driverTree.stats.initiatives', 'Initiatives'),
            value: data.stats.initiativeCount,
          },
          { label: t('results.driverTree.stats.nodes', 'Nodes'), value: data.stats.totalNodes },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] px-3 py-2"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
            <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(['objective', 'driver', 'kpi', 'initiative'] as const).map((type) => (
          <div
            key={type}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 border text-xs ${NODE_COLORS[type]}`}
          >
            {NODE_ICONS[type]}
            <span>{t(`results.driverTree.type.${type}`, type)}</span>
          </div>
        ))}
      </div>

      {/* Tree */}
      {roots.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-400">
          {t(
            'results.driverTree.noLinks',
            'No KPI–initiative links. Link KPIs to initiatives in the KPI tab.'
          )}
        </div>
      ) : (
        <div className="space-y-3 overflow-auto">
          {roots.map((root) => {
            const children = (adjacency.get(root.id) || [])
              .map((cid) => allNodes.get(cid))
              .filter(Boolean) as DriverNode[];
            return (
              <TreeNode
                key={root.id}
                node={root}
                children={children}
                depth={0}
                allNodes={allNodes}
                adjacency={adjacency}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ValueDriverTree;
