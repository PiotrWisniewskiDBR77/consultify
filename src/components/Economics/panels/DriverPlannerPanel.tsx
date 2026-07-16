/**
 * M16/5.3 + 5.4 — Driver Planner panel (driver-based planning + what-if).
 *
 * Driver-based planning UI: shows a value-driver tree (e.g. SaaS
 * Przychód = Klienci × ARPU), lets the user edit leaf-driver values via sliders,
 * and recomputes the result in real-time, fully client-side — no backend call is
 * needed for the what-if (a simple recursive eval of the tree). When sensitivity
 * data is available it also renders a TornadoChart, and an optional scenario fan
 * (base / optimistic / conservative).
 *
 * Additive + fail-soft: missing/invalid input degrades to a quiet empty state and
 * never throws. Real-data-only: with no `driverTree` supplied the panel renders
 * an empty state prompting model selection — never a synthetic demo tree („Dane
 * demo = twarz produktu", zakaz syntetycznego fallbacku na produkcji).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TornadoChart } from '@/components/Economics/charts';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type DriverOp = 'add' | 'subtract' | 'multiply' | 'divide';

export interface DriverNode {
  /** Stable id (used as React key + slider target). */
  id: string;
  /** Human label (e.g. „Przychód", „Klienci", „ARPU"). */
  label: string;
  /**
   * Leaf value. Present on leaves (no children). For branches it is derived from
   * children via `op` and ignored if children exist.
   */
  value?: number;
  /** Operator used to combine children. Defaults to `multiply`. */
  op?: DriverOp;
  /** Child drivers. A node with children is a branch (computed). */
  children?: DriverNode[];
  /** Optional unit suffix for display (np. „zł", „szt."). */
  unit?: string;
  /** Min/max/step for the leaf slider; sensible defaults derived if absent. */
  min?: number;
  max?: number;
  step?: number;
  /** Scenario multipliers for the fan (e.g. { optimistic: 1.2, conservative: 0.8 }). */
  scenario?: { optimistic?: number; conservative?: number };
}

export interface DriverPlannerPanelProps {
  /** Root of the driver tree. If omitted, a default SaaS example is used. */
  driverTree?: DriverNode;
  /** Override formatting of computed/numeric values. */
  formatValue?: (value: number) => string;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

const isFiniteNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

const APPLY: Record<DriverOp, (acc: number, v: number, i: number) => number> = {
  add: (acc, v) => acc + v,
  subtract: (acc, v, i) => (i === 0 ? v : acc - v),
  multiply: (acc, v) => acc * v,
  divide: (acc, v, i) => (i === 0 ? v : v === 0 ? acc : acc / v),
};

/** Collect all leaf nodes (no children) of a tree, in stable order. */
export function collectLeaves(node: DriverNode | undefined): DriverNode[] {
  if (!node) return [];
  if (!node.children || node.children.length === 0) return [node];
  return node.children.flatMap((c) => collectLeaves(c));
}

/**
 * Evaluate a driver tree given a map of leaf-id → override value. Branches combine
 * children with their `op` (default multiply). Returns `null` if the result is not
 * a finite number (fail-soft — caller shows empty state).
 */
export function evalTree(
  node: DriverNode | undefined,
  overrides: Record<string, number> = {}
): number | null {
  if (!node) return null;
  if (!node.children || node.children.length === 0) {
    const v = node.id in overrides ? overrides[node.id] : node.value;
    return isFiniteNum(v) ? v : null;
  }
  const op = node.op ?? 'multiply';
  const init = op === 'add' || op === 'subtract' ? 0 : op === 'multiply' ? 1 : 0;
  let acc = init;
  for (let i = 0; i < node.children.length; i++) {
    const childVal = evalTree(node.children[i], overrides);
    if (childVal === null) return null;
    acc = APPLY[op](acc, childVal, i);
  }
  return isFiniteNum(acc) ? acc : null;
}

const defaultFormat = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} mld`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} mln`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)} tys.`;
  return value.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
};

const OP_SYMBOL: Record<DriverOp, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
};

// ---------------------------------------------------------------------------
// DriverTree viz (inline — the shared charts module has no DriverTree primitive)
// ---------------------------------------------------------------------------

interface DriverTreeVizProps {
  node: DriverNode;
  overrides: Record<string, number>;
  formatValue: (v: number) => string;
  depth?: number;
}

const DriverTreeViz: React.FC<DriverTreeVizProps> = ({
  node,
  overrides,
  formatValue,
  depth = 0,
}) => {
  const computed = evalTree(node, overrides);
  const hasChildren = !!node.children && node.children.length > 0;
  const op = node.op ?? 'multiply';

  return (
    <div className="min-w-0">
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
          hasChildren
            ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-900/60 dark:bg-indigo-950/40'
            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
        }`}
        data-testid="driver-tree-node"
        data-driver-id={node.id}
      >
        <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {node.label}
        </span>
        <span className="ml-auto shrink-0 font-mono text-sm tabular-nums text-slate-900 dark:text-slate-50">
          {computed === null ? '—' : formatValue(computed)}
          {node.unit ? <span className="ml-1 text-xs text-slate-400">{node.unit}</span> : null}
        </span>
      </div>

      {hasChildren && (
        <div
          className="mt-2 flex flex-wrap items-stretch gap-2 pl-4"
          style={{ marginLeft: depth ? 8 : 0 }}
        >
          {node.children!.map((child, i) => (
            <React.Fragment key={child.id}>
              {i > 0 && (
                <div
                  className="flex select-none items-center px-1 text-base font-semibold text-indigo-400"
                  aria-hidden
                >
                  {OP_SYMBOL[op]}
                </div>
              )}
              <DriverTreeViz
                node={child}
                overrides={overrides}
                formatValue={formatValue}
                depth={depth + 1}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scenario fan (base / optimistic / conservative)
// ---------------------------------------------------------------------------

interface ScenarioFanProps {
  base: number | null;
  optimistic: number | null;
  conservative: number | null;
  formatValue: (v: number) => string;
}

const ScenarioFan: React.FC<ScenarioFanProps> = ({
  base,
  optimistic,
  conservative,
  formatValue,
}) => {
  if (base === null) return null;
  const rows: Array<{ key: string; label: string; value: number | null; cls: string }> = [
    {
      key: 'optimistic',
      label: 'Optymistyczny',
      value: optimistic,
      cls: 'text-emerald-700 dark:text-emerald-400',
    },
    { key: 'base', label: 'Bazowy', value: base, cls: 'text-slate-700 dark:text-slate-200' },
    {
      key: 'conservative',
      label: 'Konserwatywny',
      value: conservative,
      cls: 'text-amber-700 dark:text-amber-400',
    },
  ];
  return (
    <div data-testid="scenario-fan" className="grid grid-cols-3 gap-2">
      {rows.map((r) => (
        <div
          key={r.key}
          data-testid={`scenario-${r.key}`}
          className="rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {r.label}
          </div>
          <div className={`mt-1 font-mono text-sm font-semibold tabular-nums ${r.cls}`}>
            {r.value === null ? '—' : formatValue(r.value)}
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export const DriverPlannerPanel: React.FC<DriverPlannerPanelProps> = ({
  driverTree,
  formatValue = defaultFormat,
}) => {
  const { t } = useTranslation();
  // Real-data-only: no synthetic SaaS fallback tree. `tree` is DEFINITELY the
  // caller's real tree here — the no-tree case short-circuits to an empty state
  // below before any of the derived hooks run against a fabricated shape.
  const tree = driverTree;
  const leaves = useMemo(() => collectLeaves(tree), [tree]);

  // Per-leaf override state, seeded from the tree's leaf values.
  const seed = useMemo(() => {
    const m: Record<string, number> = {};
    for (const leaf of leaves) {
      if (isFiniteNum(leaf.value)) m[leaf.id] = leaf.value;
    }
    return m;
  }, [leaves]);

  const [overrides, setOverrides] = useState<Record<string, number>>(seed);

  // Re-seed when the tree (and thus its leaves) changes.
  useEffect(() => {
    setOverrides(seed);
  }, [seed]);

  const baseResult = useMemo(() => evalTree(tree, seed), [tree, seed]);
  const whatIfResult = useMemo(() => evalTree(tree, overrides), [tree, overrides]);

  // Scenario fan — only when at least one leaf declares scenario multipliers.
  const hasScenarios = useMemo(
    () => leaves.some((l) => l.scenario?.optimistic || l.scenario?.conservative),
    [leaves]
  );
  const { optimistic, conservative } = useMemo(() => {
    if (!hasScenarios) return { optimistic: null, conservative: null };
    const opt: Record<string, number> = { ...overrides };
    const con: Record<string, number> = { ...overrides };
    for (const leaf of leaves) {
      const cur = overrides[leaf.id];
      if (!isFiniteNum(cur)) continue;
      if (leaf.scenario?.optimistic) opt[leaf.id] = cur * leaf.scenario.optimistic;
      if (leaf.scenario?.conservative) con[leaf.id] = cur * leaf.scenario.conservative;
    }
    return { optimistic: evalTree(tree, opt), conservative: evalTree(tree, con) };
  }, [hasScenarios, leaves, overrides, tree]);

  // Tornado sensitivity — derived from each leaf's [min, max] swing about base.
  const tornadoBars = useMemo(() => {
    if (baseResult === null) return [];
    const bars = leaves
      .map((leaf) => {
        const cur = overrides[leaf.id];
        if (!isFiniteNum(cur)) return null;
        const lo = isFiniteNum(leaf.min) ? leaf.min : cur * 0.8;
        const hi = isFiniteNum(leaf.max) ? leaf.max : cur * 1.2;
        const low = evalTree(tree, { ...overrides, [leaf.id]: lo });
        const high = evalTree(tree, { ...overrides, [leaf.id]: hi });
        if (low === null || high === null || low === high) return null;
        return { label: leaf.label, low, high };
      })
      .filter((b): b is { label: string; low: number; high: number } => b !== null);
    return bars;
  }, [baseResult, leaves, overrides, tree]);

  const delta = baseResult !== null && whatIfResult !== null ? whatIfResult - baseResult : null;
  const isEmpty = leaves.length === 0 || baseResult === null;

  const setLeaf = (id: string, raw: number): void => {
    if (!Number.isFinite(raw)) return;
    setOverrides((prev) => ({ ...prev, [id]: raw }));
  };
  const reset = (): void => setOverrides(seed);

  // Empty state — no real driver tree supplied (no financial model selected /
  // previewed). We prompt model selection rather than showing a demo tree.
  if (!tree) {
    return (
      // c-* tokeny (dark-safe) — wzór empty-state paneli M16.
      <div
        data-testid="driver-planner-panel"
        className="rounded-xl border border-c-border bg-c-surface p-4"
      >
        <h3 className="mb-2 text-sm font-semibold text-c-text">
          {t('finance.driverPlanner.title', 'Driver-based planning + what-if')}
        </h3>
        <div
          className="rounded-lg border border-dashed border-c-border bg-c-surface-raised p-4 text-center"
          data-testid="driver-planner-empty"
        >
          <p className="text-sm font-medium text-c-text-secondary">
            {t('finance.driverPlanner.empty.title', 'Select a financial model')}
          </p>
          <p className="mt-1 text-xs text-c-text-muted">
            {t(
              'finance.driverPlanner.empty.body',
              'The driver tree decomposes a selected model’s forecast (EBIT = Revenue − COGS − Opex − Depreciation). Pick a model from the list to plan and run what-if on its real figures.'
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="driver-planner-panel"
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t('finance.driverPlanner.title', 'Driver-based planning + what-if')}
        </h3>
        {!isEmpty && (
          <button
            type="button"
            onClick={reset}
            data-testid="driver-reset"
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {t('finance.driverPlanner.reset', 'Reset')}
          </button>
        )}
      </div>

      {isEmpty ? (
        <p className="text-sm text-slate-500" data-testid="driver-planner-empty-leaves">
          {t(
            'finance.driverPlanner.emptyLeaves',
            'No driver values — this model’s forecast has no usable driver lines.'
          )}
        </p>
      ) : (
        <div className="space-y-5">
          {/* Driver tree */}
          <div data-testid="driver-tree-viz">
            <DriverTreeViz node={tree} overrides={overrides} formatValue={formatValue} />
          </div>

          {/* What-if result */}
          <div
            data-testid="whatif-result"
            className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/40"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-indigo-500">
                Wynik what-if
              </span>
              <span
                className="font-mono text-lg font-semibold tabular-nums text-indigo-900 dark:text-indigo-100"
                data-testid="whatif-value"
              >
                {whatIfResult === null ? '—' : formatValue(whatIfResult)}
                {tree.unit ? (
                  <span className="ml-1 text-xs text-indigo-400">{tree.unit}</span>
                ) : null}
              </span>
            </div>
            {delta !== null && (
              <div
                className={`mt-1 text-right font-mono text-xs tabular-nums ${
                  delta > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : delta < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-400'
                }`}
                data-testid="whatif-delta"
              >
                {delta > 0 ? '+' : ''}
                {formatValue(delta)} vs. baza
              </div>
            )}
          </div>

          {/* Leaf-driver sliders */}
          <div className="space-y-3" data-testid="driver-sliders">
            {leaves.map((leaf) => {
              const cur = overrides[leaf.id];
              if (!isFiniteNum(cur)) return null;
              const min = isFiniteNum(leaf.min) ? leaf.min : 0;
              const max = isFiniteNum(leaf.max) ? leaf.max : Math.max(cur * 2, cur + 1);
              const step = isFiniteNum(leaf.step) ? leaf.step : Math.max((max - min) / 100, 1);
              return (
                <div key={leaf.id} data-testid={`driver-slider-${leaf.id}`}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <label
                      htmlFor={`driver-input-${leaf.id}`}
                      className="font-medium text-slate-600 dark:text-slate-300"
                    >
                      {leaf.label}
                      {leaf.unit ? (
                        <span className="ml-1 text-slate-400">({leaf.unit})</span>
                      ) : null}
                    </label>
                    <input
                      id={`driver-input-${leaf.id}`}
                      type="number"
                      value={cur}
                      aria-label={leaf.label}
                      onChange={(e) => setLeaf(leaf.id, Number(e.target.value))}
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-right font-mono text-xs tabular-nums dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={Math.min(Math.max(cur, min), max)}
                    aria-label={`${leaf.label} suwak`}
                    onChange={(e) => setLeaf(leaf.id, Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              );
            })}
          </div>

          {/* Scenario fan */}
          {hasScenarios && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Scenariusze
              </h4>
              <ScenarioFan
                base={whatIfResult}
                optimistic={optimistic}
                conservative={conservative}
                formatValue={formatValue}
              />
            </div>
          )}

          {/* Tornado sensitivity */}
          {tornadoBars.length > 0 && baseResult !== null && (
            <div className="space-y-2" data-testid="driver-tornado">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Wrażliwość (tornado)
              </h4>
              <TornadoChart bars={tornadoBars} base={baseResult} formatValue={formatValue} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverPlannerPanel;
