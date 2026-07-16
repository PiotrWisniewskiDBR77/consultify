/**
 * M16 advanced suite (wire-c) — Driver Tree panel.
 *
 * Consumes POST /api/v8/finance-planning/driver-tree/{evaluate,chart}
 * (server: driverTreeService — see finance-planning.routes.ts §5). The user
 * edits a small flat list of driver nodes (input leaves + formula nodes with
 * operands/op), hits "Evaluate", and the panel:
 *   1. calls /driver-tree/evaluate to get the computed value per node id, then
 *   2. calls /driver-tree/chart (passing those values) to get the recursive
 *      tree shape, rendered as an indented list (no chart primitive for
 *      arbitrary-depth trees exists yet in charts/ — a bespoke recursive
 *      renderer is the pragmatic choice here).
 *
 * A tree-cycle (DRIVER_TREE_CYCLE) is a distinct, actionable error state.
 * Fail-soft otherwise: a request error degrades to a quiet inline notice.
 * Behind flag `m16AdvancedSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type DriverChartNode,
  type DriverNodeInput,
  type DriverOp,
  postDriverTreeChart,
  postDriverTreeEvaluate,
} from '@/services/api/v8/financePlanning';

interface NodeRow {
  id: string;
  label: string;
  kind: 'input' | 'formula';
  value: string;
  operandsRaw: string;
  op: DriverOp;
}

const DEFAULT_ROWS: NodeRow[] = [
  { id: 'customers', label: 'Customers', kind: 'input', value: '1000', operandsRaw: '', op: '+' },
  { id: 'arpu', label: 'ARPU', kind: 'input', value: '120', operandsRaw: '', op: '+' },
  {
    id: 'revenue',
    label: 'Revenue',
    kind: 'formula',
    value: '0',
    operandsRaw: 'customers,arpu',
    op: '*',
  },
];

const OPS: DriverOp[] = ['+', '-', '*', '/', 'sum', 'product'];

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(v);
};

export interface DriverTreePanelProps {
  fetcher?: {
    evaluate?: typeof postDriverTreeEvaluate;
    chart?: typeof postDriverTreeChart;
  };
}

/** Recursive indented render of the driver-tree chart shape. */
const TreeNode: React.FC<{ node: DriverChartNode; depth: number }> = ({ node, depth }) => (
  <div
    className="border-l border-c-border-subtle pl-3"
    style={{ marginLeft: depth > 0 ? 8 : 0 }}
    data-testid={`tree-node-${node.id}`}
  >
    <div className="flex flex-wrap items-baseline gap-2 py-1">
      <span className="text-sm font-medium text-c-text">{node.label}</span>
      {node.op && (
        <span className="rounded bg-c-surface-raised px-1.5 py-0.5 text-[10px] font-semibold uppercase text-c-text-muted">
          {node.op}
        </span>
      )}
      <span className="font-mono text-sm tabular-nums text-c-text-secondary">
        {fmt(node.value)}
      </span>
      {node.formula && (
        <span className="text-[11px] text-c-text-muted">{node.formula}</span>
      )}
    </div>
    {node.children.length > 0 && (
      <div className="space-y-0.5">
        {node.children.map((child) => (
          <TreeNode key={child.id} node={child} depth={depth + 1} />
        ))}
      </div>
    )}
  </div>
);

export const DriverTreePanel: React.FC<DriverTreePanelProps> = ({ fetcher }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<NodeRow[]>(DEFAULT_ROWS);

  const [tree, setTree] = useState<DriverChartNode | null>(null);
  const [values, setValues] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRow = useCallback((id: string, patch: Partial<NodeRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        id: `node${prev.length + 1}`,
        label: `Node ${prev.length + 1}`,
        kind: 'input',
        value: '0',
        operandsRaw: '',
        op: '+',
      },
    ]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }, []);

  const run = useCallback(async () => {
    if (rows.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const nodes: DriverNodeInput[] = rows.map((r) => ({
        id: r.id,
        label: r.label,
        kind: r.kind,
        ...(r.kind === 'input' ? { value: Number(r.value) || 0 } : {}),
        ...(r.kind === 'formula'
          ? {
              operands: r.operandsRaw
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              op: r.op,
            }
          : {}),
      }));

      const evaluate = fetcher?.evaluate ?? postDriverTreeEvaluate;
      const chart = fetcher?.chart ?? postDriverTreeChart;

      const evalRes = await evaluate(nodes);
      setValues(evalRes.values);
      const chartRes = await chart(nodes, evalRes.values);
      setTree(chartRes.root);
    } catch (err: any) {
      setTree(null);
      setValues(null);
      const code = err?.data?.code;
      if (code === 'DRIVER_TREE_CYCLE') {
        setError(
          t('finance.m16c.driverTree.errorCycle', 'The driver tree contains a cycle.')
        );
      } else {
        setError(
          err?.message
            ? String(err.message)
            : t('finance.m16c.driverTree.errorGeneric', 'Driver tree evaluation failed.')
        );
      }
    } finally {
      setLoading(false);
    }
  }, [rows, fetcher, t]);

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="driver-tree-panel"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('finance.m16c.driverTree.title', 'Driver tree — decomposition & propagation')}
          </h3>
          <p className="mt-0.5 text-xs text-c-text-secondary">
            {t(
              'finance.m16c.driverTree.subtitle',
              'Break an outcome into its operational drivers and evaluate the tree.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || rows.length === 0}
          data-testid="driver-tree-run"
          className="shrink-0 rounded-xl border border-c-border bg-c-surface-raised px-3.5 py-2 text-sm font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {loading
            ? t('finance.m16c.driverTree.running', 'Evaluating…')
            : t('finance.m16c.driverTree.run', 'Evaluate tree')}
        </button>
      </div>

      {/* Node rows */}
      <div className="mb-4 space-y-2" data-testid="driver-tree-nodes">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-c-border-subtle p-2"
            data-testid={`driver-tree-row-${row.id}`}
          >
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16c.driverTree.nodeId', 'Id')}</span>
              <input
                type="text"
                value={row.id}
                onChange={(e) => updateRow(row.id, { id: e.target.value })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16c.driverTree.nodeLabel', 'Label')}</span>
              <input
                type="text"
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
                className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16c.driverTree.nodeKind', 'Kind')}</span>
              <select
                value={row.kind}
                onChange={(e) =>
                  updateRow(row.id, { kind: e.target.value as 'input' | 'formula' })
                }
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              >
                <option value="input">{t('finance.m16c.driverTree.kindInput', 'input')}</option>
                <option value="formula">
                  {t('finance.m16c.driverTree.kindFormula', 'formula')}
                </option>
              </select>
            </label>
            {row.kind === 'input' ? (
              <label className="flex flex-col text-[11px] text-c-text-muted">
                <span className="mb-0.5">{t('finance.m16c.driverTree.nodeValue', 'Value')}</span>
                <input
                  type="number"
                  value={row.value}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })}
                  className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                />
              </label>
            ) : (
              <>
                <label className="flex flex-col text-[11px] text-c-text-muted">
                  <span className="mb-0.5">
                    {t('finance.m16c.driverTree.operands', 'Operands (ids, comma)')}
                  </span>
                  <input
                    type="text"
                    value={row.operandsRaw}
                    onChange={(e) => updateRow(row.id, { operandsRaw: e.target.value })}
                    className="w-40 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                  />
                </label>
                <label className="flex flex-col text-[11px] text-c-text-muted">
                  <span className="mb-0.5">{t('finance.m16c.driverTree.op', 'Op')}</span>
                  <select
                    value={row.op}
                    onChange={(e) => updateRow(row.id, { op: e.target.value as DriverOp })}
                    className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                  >
                    {OPS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="text-c-text-muted hover:text-c-danger"
                aria-label={`Remove ${row.label}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="rounded border border-dashed border-c-border px-2 py-1 text-xs text-c-text-secondary hover:border-c-focus hover:text-c-text"
        >
          {t('finance.m16c.driverTree.addNode', '+ node')}
        </button>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          data-testid="driver-tree-error"
        >
          {error}
        </div>
      )}

      {!error && !tree && !loading && (
        <p className="text-sm text-c-text-secondary" data-testid="driver-tree-empty">
          {t('finance.m16c.driverTree.empty', 'Set the driver nodes, then evaluate the tree.')}
        </p>
      )}

      {!error && tree && (
        <div data-testid="driver-tree-result">
          <TreeNode node={tree} depth={0} />
          {values && (
            <p className="mt-2 text-[11px] text-c-text-muted" data-testid="driver-tree-order-note">
              {String(
                t('finance.m16c.driverTree.nodesEvaluated', '{{count}} nodes evaluated', {
                  count: Object.keys(values).length,
                } as any)
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverTreePanel;
