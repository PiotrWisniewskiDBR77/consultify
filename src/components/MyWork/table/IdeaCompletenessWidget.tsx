/**
 * IdeaCompletenessWidget — Small widget showing idea workspace completeness.
 * Coverage, node/edge counts, branch depth, conversion readiness.
 */
import { BarChart3, CheckCircle2, GitBranch, Layers, Target } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { TableEdge, TableNode } from './tableTypes';

interface IdeaCompletenessWidgetProps {
  nodes: TableNode[];
  edges: TableEdge[];
  title: string;
  seedText: string;
}

interface MetricItem {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelEn: string;
  labelPl: string;
  value: string | number;
  color: string;
}

export const IdeaCompletenessWidget: React.FC<IdeaCompletenessWidgetProps> = ({
  nodes,
  edges,
  title,
  seedText,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const metrics = useMemo(() => {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const branchNodes = nodes.filter((n) => n.type === 'branch');
    const ideaNodes = nodes.filter((n) => n.type === 'idea' || !n.type);

    const hasTitle = title.trim().length > 3;
    const hasDescription = seedText.trim().length > 20;
    const hasNodes = nodeCount >= 3;
    const hasEdges = edgeCount >= 2;
    const hasBranches = branchNodes.length >= 2;
    const hasData = ideaNodes.some((n) => {
      const data = n.data || {};
      return Object.keys(data).filter((k) => k !== 'label' && data[k]).length >= 2;
    });

    const checks = [hasTitle, hasDescription, hasNodes, hasEdges, hasBranches, hasData];
    const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    const readiness =
      completeness >= 80
        ? isPl
          ? 'Gotowe'
          : 'Ready'
        : completeness >= 50
          ? isPl
            ? 'W trakcie'
            : 'In progress'
          : isPl
            ? 'Początek'
            : 'Starting';

    const readinessColor =
      completeness >= 80
        ? 'text-emerald-600 dark:text-emerald-400'
        : completeness >= 50
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-c-text-muted';

    const items: MetricItem[] = [
      {
        icon: Layers,
        labelEn: 'Nodes',
        labelPl: 'Węzły',
        value: nodeCount,
        color: 'text-blue-500',
      },
      {
        icon: GitBranch,
        labelEn: 'Edges',
        labelPl: 'Połączenia',
        value: edgeCount,
        color: 'text-c-accent',
      },
      {
        icon: Target,
        labelEn: 'Branches',
        labelPl: 'Gałęzie',
        value: branchNodes.length,
        color: 'text-indigo-500',
      },
      {
        icon: BarChart3,
        labelEn: 'Completeness',
        labelPl: 'Kompletność',
        value: `${completeness}%`,
        color:
          completeness >= 80
            ? 'text-emerald-500'
            : completeness >= 50
              ? 'text-amber-500'
              : 'text-danger-500',
      },
    ];

    return { items, completeness, readiness, readinessColor };
  }, [edges, isPl, nodes, seedText, title]);

  return (
    <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
          {isPl ? 'Kompletność pomysłu' : 'Idea Completeness'}
        </span>
        <span className={`text-[10px] font-bold ${metrics.readinessColor}`}>
          {metrics.readiness}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-c-border-subtle overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${
            metrics.completeness >= 80
              ? 'bg-emerald-500'
              : metrics.completeness >= 50
                ? 'bg-amber-500'
                : 'bg-danger-400'
          }`}
          style={{ width: `${metrics.completeness}%` }}
        />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        {metrics.items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.labelEn} className="flex items-center gap-2">
              <Icon size={12} className={item.color} />
              <div>
                <div className="text-[10px] text-c-text-muted">
                  {isPl ? item.labelPl : item.labelEn}
                </div>
                <div className="text-xs font-bold text-c-text tabular-nums">
                  {item.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Conversion readiness */}
      {metrics.completeness >= 60 && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 rounded-lg px-2 py-1.5">
          <CheckCircle2 size={12} />
          {isPl
            ? 'Pomysł jest gotowy do konwersji na inicjatywę'
            : 'Idea is ready for conversion to initiative'}
        </div>
      )}
    </div>
  );
};

export default IdeaCompletenessWidget;
