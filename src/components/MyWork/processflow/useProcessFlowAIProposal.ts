/**
 * useProcessFlowAIProposal — real AI proposal lifecycle for Process Flow.
 *
 * M07 F2: replaces the dead V8 `/api/v8/process-flow/:id/ai-proposals` +
 * `/resolve` round-trips with the REAL blob backend
 * (`POST /api/my-work/my-ideas/:id/ai-generate` via the existing
 * `generateAIProposal` client — spec: do not write a new fetcher).
 *
 * Spec decisions implemented here:
 *  - Decision 2: generator selection is automatic — `node_expand` with
 *    `selection.primaryId` when exactly one node is selected, otherwise
 *    `flow_generator` with the user prompt as `seedText`.
 *  - Decision 4: before/after preview is computed client-side from the F1
 *    tools (`validateFlow`, `generateReadback`) against a simulation produced
 *    by the pure `applyProposalPatch` util.
 *  - Decision 5: acceptance re-applies the patch against the CURRENT graph
 *    and hands the result to the host via `onApply` (host does pushUndo +
 *    setNodes/setEdges/setLanes; autosave queues via useIdeaMapSync).
 *    Rejection mutates nothing. Proposal statuses live only in local state —
 *    there is no `/resolve` backend anymore.
 */
import { useCallback, useState } from 'react';
import type { Edge, Node } from 'reactflow';

import i18n from '@/i18n';
import { generateAIProposal } from '@/services/ideaAIGenerator';

import type { ProcessFlowSemanticKit } from '../canvas/canvasOsContract';
import type { AIProposal as BatchProposal } from '../ideaSelectionTypes';
import {
  type ApplyPatchResult,
  type ApplyPatchWarning,
  applyProposalPatch,
  type ProposalPatch,
} from './applyProposalPatch';
import { generateReadback, readbackToText } from './generateReadback';
import type { Lane } from './useProcessFlowNodes';
import { validateFlow } from './validateFlow';

/**
 * `isPl` is threaded explicitly through this hook's opts (not read from
 * global i18next state), so `tr()` forces the i18next `lng` per-call to stay
 * behaviorally identical to the old inline ternaries.
 */
function tr(
  isPl: boolean,
  key: string,
  defaultValue: string,
  vars?: Record<string, unknown>
): string {
  return i18n.t(`processFlow.aiProposal.${key}`, defaultValue, {
    lng: isPl ? 'pl' : 'en',
    ...vars,
  });
}

export interface AIProposalOp {
  action: 'create' | 'delete' | 'connect' | 'move' | 'update_label';
  target_id?: string;
  params?: Record<string, unknown>;
}

/**
 * View-model consumed by AIProposalPanel. Field names kept from the F0 panel
 * contract (summary, operations, risk_flags, validation_before/after,
 * readback_before/after) so the panel and its tests stay stable; new
 * optional fields carry the real patch.
 */
export interface AIProposal {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  prompt: string;
  summary: string;
  operations: AIProposalOp[];
  risk_flags: string[];
  validation_before: { valid: boolean; issue_count: number };
  validation_after: { valid: boolean; issue_count: number };
  readback_before: string;
  readback_after: string;
  created_at: string;
  confidence?: number;
  generatorType?: 'flow_generator' | 'node_expand';
  /** Raw patch from the backend proposal — re-applied on accept. */
  patch?: ProposalPatch;
  /** Ghost nodes for the on-canvas preview (decision 6). */
  previewNodes?: Node[];
}

export interface UseProcessFlowAIProposalOpts {
  ideaId: string | null;
  nodes: Node[];
  edges: Edge[];
  lanes: Lane[];
  semanticKit: ProcessFlowSemanticKit;
  isPl: boolean;
  language?: string;
  selectedNodeIds?: string[];
  /** Host applies the accepted simulation to canvas state (decision 5). */
  onApply?: (result: ApplyPatchResult) => void;
}

function localizeWarning(w: ApplyPatchWarning, isPl: boolean): string {
  switch (w.code) {
    case 'unknown_lane_fallback':
      return tr(
        isPl,
        'warning.unknownLaneFallback',
        'Unknown lane "{{detail}}" — node "{{objectId}}" assigned to the first lane',
        { detail: w.detail, objectId: w.objectId }
      );
    case 'duplicate_node_skipped':
      return tr(
        isPl,
        'warning.duplicateNodeSkipped',
        'Node "{{objectId}}" already exists — skipped',
        {
          objectId: w.objectId,
        }
      );
    case 'duplicate_edge_skipped':
      return tr(
        isPl,
        'warning.duplicateEdgeSkipped',
        'Edge "{{objectId}}" already exists — skipped',
        {
          objectId: w.objectId,
        }
      );
    case 'dangling_edge_skipped':
      return tr(
        isPl,
        'warning.danglingEdgeSkipped',
        'Edge "{{objectId}}" ({{detail}}) references a missing node — skipped',
        { objectId: w.objectId, detail: w.detail }
      );
    case 'unknown_update_target':
      return tr(
        isPl,
        'warning.unknownUpdateTarget',
        'Update for "{{objectId}}" skipped — node does not exist',
        {
          objectId: w.objectId,
        }
      );
    case 'unknown_move_target':
      return tr(
        isPl,
        'warning.unknownMoveTarget',
        'Move for "{{objectId}}" skipped — node does not exist',
        {
          objectId: w.objectId,
        }
      );
    default:
      return w.code;
  }
}

/** Flatten a graph patch into the panel's operation list. */
export function patchToOperations(patch: ProposalPatch | undefined): AIProposalOp[] {
  if (!patch) return [];
  const ops: AIProposalOp[] = [];
  for (const n of patch.addNodes || []) {
    ops.push({ action: 'create', target_id: n.id, params: { label: n.label } });
  }
  for (const e of patch.addEdges || []) {
    ops.push({
      action: 'connect',
      target_id: e.id,
      params: { source: e.source, target: e.target, ...(e.label ? { label: e.label } : {}) },
    });
  }
  for (const id of patch.removeNodeIds || []) {
    ops.push({ action: 'delete', target_id: id });
  }
  for (const id of patch.removeEdgeIds || []) {
    ops.push({ action: 'delete', target_id: id });
  }
  for (const u of patch.updateNodes || []) {
    ops.push({
      action: 'update_label',
      target_id: u.id,
      params: typeof u.data?.label === 'string' ? { label: u.data.label } : undefined,
    });
  }
  for (const m of patch.moveNodes || []) {
    ops.push({ action: 'move', target_id: m.nodeId });
  }
  return ops;
}

function toPreviewGhosts(sim: ApplyPatchResult): Node[] {
  const added = new Set(sim.addedNodeIds);
  return sim.nodes
    .filter((n) => added.has(String(n.id)))
    .map((n) => ({
      ...n,
      id: `proposal-ghost-${n.id}`,
      data: { ...n.data, _isGhost: true, locked: true },
    }));
}

export function useProcessFlowAIProposal({
  ideaId,
  nodes,
  edges,
  lanes,
  semanticKit,
  isPl,
  language,
  selectedNodeIds,
  onApply,
}: UseProcessFlowAIProposalOpts) {
  const [activeProposal, setActiveProposal] = useState<AIProposal | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProposal = useCallback(
    async (prompt: string) => {
      if (!ideaId || !prompt.trim()) return;
      setIsGenerating(true);
      setError(null);
      setActiveProposal(null);
      try {
        // Decision 2: automatic generator selection — no dropdown.
        const singleSelection =
          Array.isArray(selectedNodeIds) && selectedNodeIds.length === 1
            ? selectedNodeIds[0]
            : null;
        const generatorType = singleSelection ? 'node_expand' : 'flow_generator';

        const batch = await generateAIProposal({
          ideaId,
          generatorType,
          tool: 'process_flow',
          context: {
            seedText: prompt,
            title: '',
            existingNodes: nodes.map((n) => ({
              id: n.id,
              data: {
                label: n.data?.label,
                shape: n.data?.shape,
                laneId: n.data?.laneId,
              },
            })),
            existingEdges: edges.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              label: (e.data?.label ?? e.label) || undefined,
            })),
            existingLanes: lanes,
            language: language || (isPl ? 'pl' : 'en'),
            ...(singleSelection
              ? {
                  selection: {
                    type: 'node',
                    count: 1,
                    ids: [singleSelection],
                    primaryId: singleSelection,
                  },
                }
              : {}),
          },
        });

        const proposal: BatchProposal | undefined = (batch?.proposals || []).find(
          (p) => p?.type === 'graph_patch' && p.patch && p.status !== 'rejected'
        );
        if (!proposal) {
          setError(
            tr(
              isPl,
              'errorNoProposal',
              'AI returned no change proposal for this process. Refine the prompt and try again.'
            )
          );
          return;
        }

        // Decision 4: simulate with the same pure function used on accept.
        const sim = applyProposalPatch(nodes, edges, lanes, proposal.patch);
        const validationBefore = validateFlow(nodes, edges, semanticKit);
        const validationAfter = validateFlow(sim.nodes, sim.edges, semanticKit);
        const readbackBefore = readbackToText(generateReadback(nodes, edges, lanes, isPl), isPl);
        const readbackAfter = readbackToText(
          generateReadback(sim.nodes, sim.edges, sim.lanes, isPl),
          isPl
        );

        setActiveProposal({
          id: proposal.id,
          status: 'pending',
          prompt,
          summary:
            proposal.rationale ||
            proposal.resultSummary ||
            tr(isPl, 'defaultSummary', 'Proposed process changes'),
          operations: patchToOperations(proposal.patch),
          risk_flags: sim.warnings.map((w) => localizeWarning(w, isPl)),
          validation_before: {
            valid: validationBefore.valid,
            issue_count: validationBefore.issues.length,
          },
          validation_after: {
            valid: validationAfter.valid,
            issue_count: validationAfter.issues.length,
          },
          readback_before: readbackBefore,
          readback_after: readbackAfter,
          created_at: new Date().toISOString(),
          confidence: proposal.confidence,
          generatorType,
          patch: proposal.patch,
          previewNodes: toPreviewGhosts(sim),
        });
      } catch (err: unknown) {
        const message = err instanceof Error && err.message ? err.message : null;
        setError(
          message ||
            tr(isPl, 'errorGenerate', 'Failed to generate the AI proposal. Please try again.')
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [edges, ideaId, isPl, lanes, language, nodes, selectedNodeIds, semanticKit]
  );

  /**
   * Decision 5: local-only resolution (no dead `/resolve` call). Accept
   * re-applies the patch against the CURRENT graph (the canvas may have
   * changed since the preview) and hands the result to the host.
   */
  const resolveProposal = useCallback(
    (action: 'accept' | 'reject') => {
      if (!activeProposal || activeProposal.status !== 'pending') return;
      if (action === 'accept') {
        const result = applyProposalPatch(nodes, edges, lanes, activeProposal.patch);
        onApply?.(result);
      }
      setActiveProposal(null);
    },
    [activeProposal, edges, lanes, nodes, onApply]
  );

  const dismiss = useCallback(() => {
    setActiveProposal(null);
    setError(null);
  }, []);

  return { activeProposal, isGenerating, error, createProposal, resolveProposal, dismiss };
}
