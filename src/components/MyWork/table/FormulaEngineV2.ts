/**
 * FormulaEngineV2 — Extended formula evaluation with cross-row references,
 * rollups from relations, and conditional expressions.
 *
 * Syntax:
 *   =SUM(children.effort)         — aggregate child nodes
 *   =AVG(related.rating)          — aggregate related nodes via edges
 *   =IF(status="Done", 10, 0)     — conditional
 *   =CONCAT(label, " - ", type)   — string concat
 *   =COUNT(children)              — count children
 *   =SCORE(impact*0.4 + effort*0.3) — weighted formula
 *   Standard: +, -, *, /, field references
 *
 * R5 / W2: the cross-row aggregates (`children.`/`related.`) and the
 * legacy `IF(field="x", ...)` / `CONCAT(...)` shorthands remain a thin layer
 * ABOVE the shared AST core (`formulaEngineCore`). Aggregates are resolved to
 * numeric literals first, then the remaining single-row expression is parsed
 * and evaluated by the one shared engine — no more `new Function`.
 */
import {
  evaluateFormula as evaluateAst,
  parseFormula,
  FormulaError,
} from './formulaEngineCore';
import type { TableEdge, TableNode } from './tableTypes';

interface FormulaContext {
  node: TableNode;
  allNodes: TableNode[];
  edges: TableEdge[];
}

type AggFn = 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT';

function getRelatedNodes(ctx: FormulaContext): TableNode[] {
  const relatedIds = new Set<string>();
  for (const e of ctx.edges) {
    if (e.source === ctx.node.id) relatedIds.add(e.target);
    if (e.target === ctx.node.id) relatedIds.add(e.source);
  }
  return ctx.allNodes.filter((n) => relatedIds.has(n.id));
}

function getChildNodes(ctx: FormulaContext): TableNode[] {
  const childIds: string[] = ctx.node.data?.children || [];
  return childIds.map((id) => ctx.allNodes.find((n) => n.id === id)).filter(Boolean) as TableNode[];
}

function aggregateField(nodes: TableNode[], field: string, fn: AggFn): number {
  if (fn === 'COUNT') return nodes.length;
  const vals = nodes.map((n) => Number(n.data?.[field]) || 0);
  if (vals.length === 0) return 0;
  switch (fn) {
    case 'SUM': return vals.reduce((a, b) => a + b, 0);
    case 'AVG': return vals.reduce((a, b) => a + b, 0) / vals.length;
    case 'MIN': return Math.min(...vals);
    case 'MAX': return Math.max(...vals);
    default: return 0;
  }
}

function resolveFieldValue(node: TableNode, field: string): number | string {
  const val = node.data?.[field];
  if (val == null) return 0;
  const num = Number(val);
  return isNaN(num) ? String(val) : num;
}

/**
 * Evaluate a single-row expression through the shared AST core.
 * `node.data` is the record; bare identifiers resolve by name.
 */
function evalWithCore(expr: string, ctx: FormulaContext): unknown {
  const ast = parseFormula(expr);
  const record = (ctx.node.data ?? {}) as Record<string, unknown>;
  return evaluateAst(ast, record, new Map());
}

export function evaluateFormulaV2(formula: string, ctx: FormulaContext): string | number {
  const expr = formula.startsWith('=') ? formula.slice(1).trim() : formula.trim();

  // IF(condition, trueVal, falseVal) — legacy shorthand `field="literal"`.
  const ifMatch = expr.match(/^IF\((.+?)="(.+?)",\s*(.+?),\s*(.+?)\)$/i);
  if (ifMatch) {
    const [, field, expected, trueVal, falseVal] = ifMatch;
    const actual = String(ctx.node.data?.[field.trim()] || '');
    const result = actual === expected ? trueVal.trim() : falseVal.trim();
    const num = Number(result);
    return isNaN(num) ? result : num;
  }

  // CONCAT(field1, "sep", field2, ...)
  const concatMatch = expr.match(/^CONCAT\((.+)\)$/i);
  if (concatMatch) {
    const parts = concatMatch[1].split(',').map((p) => {
      const trimmed = p.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
      return String(resolveFieldValue(ctx.node, trimmed));
    });
    return parts.join('');
  }

  // Aggregate: SUM/AVG/MIN/MAX/COUNT(children.field) or (related.field).
  // Cross-row roll-up resolved here (the core is single-row only).
  const aggMatch = expr.match(/^(SUM|AVG|MIN|MAX|COUNT)\((children|related)(?:\.(\w+))?\)$/i);
  if (aggMatch) {
    const fn = aggMatch[1].toUpperCase() as AggFn;
    const source = aggMatch[2].toLowerCase();
    const field = aggMatch[3] || '';
    const targetNodes = source === 'children' ? getChildNodes(ctx) : getRelatedNodes(ctx);
    return Math.round(aggregateField(targetNodes, field, fn) * 100) / 100;
  }

  // SCORE(expression) — evaluate arithmetic with field references via core.
  const scoreMatch = expr.match(/^SCORE\((.+)\)$/i);
  if (scoreMatch) {
    return evaluateArithmetic(scoreMatch[1], ctx);
  }

  // Plain arithmetic: field1 * 0.4 + field2 * 0.6
  if (/[+\-*/]/.test(expr)) {
    return evaluateArithmetic(expr, ctx);
  }

  // Simple field reference
  const val = resolveFieldValue(ctx.node, expr);
  return val;
}

function evaluateArithmetic(expr: string, ctx: FormulaContext): number {
  try {
    const result = evalWithCore(expr, ctx);
    return typeof result === 'number' && isFinite(result)
      ? Math.round(result * 100) / 100
      : 0;
  } catch (e) {
    if (e instanceof FormulaError) return 0;
    return 0;
  }
}

/**
 * Batch-evaluate all formula columns for all nodes.
 * Returns a map: nodeId -> { colKey -> computed value }
 */
export function batchEvaluateFormulas(
  nodes: TableNode[],
  edges: TableEdge[],
  formulaColumns: { key: string; formula: string }[]
): Map<string, Record<string, string | number>> {
  const results = new Map<string, Record<string, string | number>>();

  for (const node of nodes) {
    const ctx: FormulaContext = { node, allNodes: nodes, edges };
    const computed: Record<string, string | number> = {};
    for (const col of formulaColumns) {
      computed[col.key] = evaluateFormulaV2(col.formula, ctx);
    }
    results.set(node.id, computed);
  }

  return results;
}
