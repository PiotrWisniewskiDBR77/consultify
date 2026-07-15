/**
 * DataLineageView — SVG-based directed graph showing data flow:
 * Source nodes → Table nodes → Model nodes → Output (Consultify modules).
 */
import {
  Activity,
  Database,
  DollarSign,
  FileSpreadsheet,
  Layers,
  Rocket,
  Target,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';
import * as Api from '@/services/api/tablePlatform.api';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface LineageNode {
  id: string;
  label: string;
  type: 'source' | 'table' | 'model' | 'output';
  meta?: string;
  column: number;
  row: number;
}

interface LineageEdge {
  from: string;
  to: string;
  label?: string;
}

/* ------------------------------------------------------------------ */
/* Layout constants                                                    */
/* ------------------------------------------------------------------ */

const COL_WIDTH = 220;
const ROW_HEIGHT = 70;
const NODE_W = 180;
const NODE_H = 48;
const PADDING_X = 40;
const PADDING_Y = 40;

const NODE_STYLES: Record<
  string,
  {
    fill: string;
    stroke: string;
    textColor: string;
    icon: React.FC<{ size?: number; className?: string }>;
  }
> = {
  // Categorical node types drawn from the identity palette (c-tag-*).
  // fill = color-mix tint, stroke/text = solid token. Theme-aware CSS vars.
  source: {
    fill: 'color-mix(in srgb, var(--c-tag-1) 14%, transparent)',
    stroke: 'var(--c-tag-1)',
    textColor: 'var(--c-tag-1)',
    icon: FileSpreadsheet,
  },
  table: {
    fill: 'color-mix(in srgb, var(--c-tag-6) 14%, transparent)',
    stroke: 'var(--c-tag-6)',
    textColor: 'var(--c-tag-6)',
    icon: Database,
  },
  model: {
    fill: 'color-mix(in srgb, var(--c-tag-3) 14%, transparent)',
    stroke: 'var(--c-tag-3)',
    textColor: 'var(--c-tag-3)',
    icon: Layers,
  },
  output: {
    fill: 'color-mix(in srgb, var(--c-tag-9) 14%, transparent)',
    stroke: 'var(--c-tag-9)',
    textColor: 'var(--c-tag-9)',
    icon: Target,
  },
};

/* ------------------------------------------------------------------ */
/* SVG Node                                                            */
/* ------------------------------------------------------------------ */

function SvgNode({
  node,
  onSelect,
  selected,
}: {
  node: LineageNode;
  onSelect: (n: LineageNode) => void;
  selected: boolean;
}) {
  const x = PADDING_X + node.column * COL_WIDTH;
  const y = PADDING_Y + node.row * ROW_HEIGHT;
  const style = NODE_STYLES[node.type] ?? NODE_STYLES.source;

  return (
    <g onClick={() => onSelect(node)} className="cursor-pointer" role="button" tabIndex={0}>
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={10}
        ry={10}
        fill={style.fill}
        stroke={selected ? 'var(--c-focus-solid)' : style.stroke}
        strokeWidth={selected ? 2 : 1.5}
        className="transition-all"
      />
      <text
        x={x + 12}
        y={y + 20}
        fontSize={11}
        fontWeight={600}
        fill={style.textColor}
        className="select-none"
      >
        {node.label.length > 22 ? node.label.slice(0, 20) + '…' : node.label}
      </text>
      {node.meta && (
        <text x={x + 12} y={y + 35} fontSize={9} fill="var(--c-text-muted)" className="select-none">
          {node.meta}
        </text>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* SVG Edge (arrow)                                                    */
/* ------------------------------------------------------------------ */

function SvgEdge({
  from,
  to,
  label,
  nodes,
}: {
  from: string;
  to: string;
  label?: string;
  nodes: LineageNode[];
}) {
  const fromNode = nodes.find((n) => n.id === from);
  const toNode = nodes.find((n) => n.id === to);
  if (!fromNode || !toNode) return null;

  const x1 = PADDING_X + fromNode.column * COL_WIDTH + NODE_W;
  const y1 = PADDING_Y + fromNode.row * ROW_HEIGHT + NODE_H / 2;
  const x2 = PADDING_X + toNode.column * COL_WIDTH;
  const y2 = PADDING_Y + toNode.row * ROW_HEIGHT + NODE_H / 2;

  const midX = (x1 + x2) / 2;

  return (
    <g>
      <path
        d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
        fill="none"
        stroke="var(--c-border)"
        strokeWidth={1.5}
        markerEnd="url(#arrowhead)"
      />
      {label && (
        <text
          x={midX}
          y={Math.min(y1, y2) - 4}
          fontSize={9}
          fill="var(--c-text-muted)"
          textAnchor="middle"
          className="select-none"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

interface DataLineageViewProps {
  baseId: string;
  tables: { id: string; name: string }[];
  onClose?: () => void;
}

export const DataLineageView: React.FC<DataLineageViewProps> = ({ baseId, tables, onClose }) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await Api.listGovernedModels(baseId);
        const detailed = await Promise.all(
          list.map(async (m: any) => {
            try {
              return await Api.getGovernedModel(m.model_id);
            } catch {
              return m;
            }
          })
        );
        if (!cancelled) setModels(detailed);
      } catch {
        /* ignore */
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [baseId]);

  const { nodes, edges, svgWidth, svgHeight } = useMemo(() => {
    const ns: LineageNode[] = [];
    const es: LineageEdge[] = [];

    // Column 0: Sources (connectors, imports, forms — represented generically)
    const sourceIds = new Set<string>();
    ns.push({
      id: 'src-import',
      label: t('myWorkTable.dataLineageView.csvSheetsImport'),
      type: 'source',
      meta: 'connector',
      column: 0,
      row: 0,
    });
    ns.push({
      id: 'src-form',
      label: t('myWorkTable.dataLineageView.forms'),
      type: 'source',
      meta: 'form input',
      column: 0,
      row: 1,
    });
    ns.push({
      id: 'src-manual',
      label: t('myWorkTable.dataLineageView.manualEntry'),
      type: 'source',
      meta: 'manual',
      column: 0,
      row: 2,
    });
    sourceIds.add('src-import');
    sourceIds.add('src-form');
    sourceIds.add('src-manual');

    // Column 1: Tables
    tables.forEach((t, i) => {
      ns.push({
        id: `tbl-${t.id}`,
        label: t.name,
        type: 'table',
        meta: `table`,
        column: 1,
        row: i,
      });
      es.push({ from: 'src-import', to: `tbl-${t.id}` });
      if (i % 2 === 0) es.push({ from: 'src-form', to: `tbl-${t.id}` });
      if (i % 3 === 0) es.push({ from: 'src-manual', to: `tbl-${t.id}` });
    });

    // Column 2: Models
    models.forEach((m: any, i: number) => {
      const mid = `model-${m.model_id}`;
      const kpiCount = m.kpis?.length ?? 0;
      ns.push({
        id: mid,
        label: m.name,
        type: 'model',
        meta: `${kpiCount} KPIs`,
        column: 2,
        row: i,
      });

      (m.sources ?? []).forEach((s: any) => {
        const tblNodeId = `tbl-${s.table_id}`;
        if (ns.find((n) => n.id === tblNodeId)) {
          es.push({ from: tblNodeId, to: mid, label: s.trusted ? '✓' : '' });
        }
      });
    });

    // Column 3: Output modules
    const outputModules = [
      { id: 'out-results', label: t('myWorkTable.dataLineageView.results'), meta: 'module' },
      { id: 'out-finance', label: t('myWorkTable.dataLineageView.finance'), meta: 'module' },
      { id: 'out-execution', label: t('myWorkTable.dataLineageView.execution'), meta: 'module' },
      {
        id: 'out-initiatives',
        label: t('myWorkTable.dataLineageView.initiatives'),
        meta: 'module',
      },
    ];
    outputModules.forEach((o, i) => {
      ns.push({ id: o.id, label: o.label, type: 'output', meta: o.meta, column: 3, row: i });
    });

    models.forEach((m: any) => {
      const mid = `model-${m.model_id}`;
      es.push({ from: mid, to: 'out-results' });
      es.push({ from: mid, to: 'out-finance' });
    });

    const maxRow = Math.max(...ns.map((n) => n.row), 0);
    const maxCol = Math.max(...ns.map((n) => n.column), 0);

    return {
      nodes: ns,
      edges: es,
      svgWidth: PADDING_X * 2 + (maxCol + 1) * COL_WIDTH,
      svgHeight: PADDING_Y * 2 + (maxRow + 1) * ROW_HEIGHT,
    };
  }, [tables, models, isPl]);

  if (loading) {
    return <LoadingState variant="spinner" className="py-16" />;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-c-text">
            {t('myWorkTable.dataLineageView.dataLineage')}
          </h2>
          <p className="text-xs text-c-text-muted mt-0.5">
            {t('myWorkTable.dataLineageView.visualizeDataFlowFromSources')}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-c-surface-raised">
            <X size={16} className="text-c-text-secondary" />
          </button>
        )}
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-0" style={{ paddingLeft: PADDING_X }}>
        {[
          t('myWorkTable.dataLineageView.sources'),
          t('myWorkTable.dataLineageView.tables'),
          t('myWorkTable.dataLineageView.models'),
          t('myWorkTable.dataLineageView.modules'),
        ].map((lbl, i) => (
          <div
            key={i}
            className="text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider"
            style={{ width: COL_WIDTH }}
          >
            {lbl}
          </div>
        ))}
      </div>

      {/* SVG Canvas */}
      <div className="overflow-x-auto rounded-xl border border-c-border-subtle bg-c-bg">
        <svg
          width={svgWidth}
          height={Math.max(svgHeight, 300)}
          viewBox={`0 0 ${svgWidth} ${Math.max(svgHeight, 300)}`}
          className="w-full"
          style={{ minHeight: 300 }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="var(--c-border)" />
            </marker>
          </defs>

          {/* Edges first (behind nodes) */}
          {edges.map((e, i) => (
            <SvgEdge key={i} from={e.from} to={e.to} label={e.label} nodes={nodes} />
          ))}

          {/* Nodes */}
          {nodes.map((n) => (
            <SvgNode
              key={n.id}
              node={n}
              onSelect={setSelectedNode}
              selected={selectedNode?.id === n.id}
            />
          ))}
        </svg>
      </div>

      {/* Detail panel for selected node */}
      {selectedNode && (
        <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-c-text">{selectedNode.label}</h4>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded hover:bg-c-surface-raised"
            >
              <X size={14} className="text-c-text-secondary" />
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs text-c-text-muted">
            <span className="capitalize">
              {t('myWorkTable.dataLineageView.type')}: {selectedNode.type}
            </span>
            {selectedNode.meta && <span>{selectedNode.meta}</span>}
          </div>
          <div className="mt-2 text-xs text-c-text-muted">
            <span className="font-medium">{t('myWorkTable.dataLineageView.connections')}:</span>{' '}
            {edges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).length}{' '}
            {t('myWorkTable.dataLineageView.edges')}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataLineageView;
