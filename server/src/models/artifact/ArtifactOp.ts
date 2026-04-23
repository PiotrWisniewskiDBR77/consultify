import type { NodeId } from './ArtifactCanonicalContent.js';

export type CellId = string & { readonly __brand: 'CellId' };
export type ChartId = string & { readonly __brand: 'ChartId' };

export function unsafeCellId(value: string): CellId {
  return String(value) as CellId;
}

export function unsafeChartId(value: string): ChartId {
  return String(value) as ChartId;
}

export type ArtifactOp =
  | { readonly kind: 'json_patch'; readonly path: string; readonly before?: unknown; readonly after: unknown }
  | { readonly kind: 'replace_text'; readonly nodeId: string | NodeId; readonly before: string; readonly after: string }
  | { readonly kind: 'move_block'; readonly nodeId: string | NodeId; readonly parentId: string; readonly fromIndex: number; readonly toIndex: number }
  | { readonly kind: 'update_cell_formula'; readonly cellId: string | CellId; readonly before: string; readonly after: string; readonly dependencies: readonly string[] }
  | {
      readonly kind: 'update_chart_binding';
      readonly chartId: string | ChartId;
      readonly before: { readonly sheetId: string; readonly start: string; readonly end: string };
      readonly after: { readonly sheetId: string; readonly start: string; readonly end: string };
    };

export function assertArtifactOp(op: unknown): asserts op is ArtifactOp {
  if (!op || typeof op !== 'object') throw new Error('Artifact op must be an object');
  const kind = (op as any).kind;
  if (typeof kind !== 'string') throw new Error('Artifact op kind missing');
}

export function reverseArtifactOps(ops: readonly ArtifactOp[]): ArtifactOp[] {
  return ops.map((op) => {
    if (op.kind === 'replace_text') {
      return { ...op, before: op.after, after: op.before };
    }
    if (op.kind === 'json_patch') {
      return { ...op, before: op.after, after: op.before };
    }
    return op;
  });
}

