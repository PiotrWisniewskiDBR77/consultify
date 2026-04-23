import type { ArtifactOp } from './ArtifactOp.js';

export const SELECTION_SCOPE_KINDS = ['empty', 'whole_artifact', 'nodes', 'range'] as const;
export type SelectionScopeKind = (typeof SELECTION_SCOPE_KINDS)[number];

export type Selection =
  | { readonly kind: 'empty' }
  | { readonly kind: 'nodes'; readonly nodeIds: readonly string[] }
  | {
      readonly kind: 'range';
      readonly nodeIds: readonly string[];
      readonly startNodeId: string;
      readonly endNodeId: string;
    };

export type SelectionContext = {
  readonly artifactId: string;
  readonly selection: Selection;
};

export type ScopeVerdict =
  | { readonly kind: 'whole_artifact' }
  | { readonly kind: 'scoped_to_selection'; readonly nodeIds: readonly string[] }
  | {
      readonly kind: 'rejected';
      readonly reason: string;
      readonly triggeringLexeme: string | null;
      readonly clarificationSeed: string;
    };

export function resolveOpScope(command: string, selection: Selection): ScopeVerdict {
  const text = String(command || '').toLowerCase();
  const usesDemonstrative = /\bthis\b/.test(text);

  if (selection.kind === 'empty') {
    if (usesDemonstrative) {
      return {
        kind: 'rejected',
        reason: 'DEMONSTRATIVE_REQUIRES_SELECTION',
        triggeringLexeme: 'this',
        clarificationSeed: 'Please select the target section and try again.',
      };
    }
    return { kind: 'whole_artifact' };
  }

  if (selection.kind === 'nodes') {
    return { kind: 'scoped_to_selection', nodeIds: selection.nodeIds };
  }

  if (selection.kind === 'range') {
    return { kind: 'scoped_to_selection', nodeIds: selection.nodeIds };
  }

  return { kind: 'whole_artifact' };
}

export function assertOpsWithinSelection(ops: readonly ArtifactOp[], selection: Selection): void {
  if (selection.kind !== 'nodes' && selection.kind !== 'range') return;
  const allowed = new Set(selection.nodeIds.map(String));
  for (const op of ops) {
    if (op.kind === 'replace_text') {
      if (!allowed.has(String(op.nodeId))) {
        throw new Error(`Op nodeId outside selection: ${String(op.nodeId)}`);
      }
    }
  }
}

