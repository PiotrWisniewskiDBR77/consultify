/**
 * applyProposalPatch — pure, testable application of an AIProposal graph
 * patch to the Process Flow in-memory graph (nodes / edges / lanes).
 *
 * M07 F2 (spec decisions 3 & 4):
 *  - Decision 4: this is the single simulation function used BOTH for the
 *    before/after preview in AIProposalPanel and for the actual acceptance.
 *  - Decision 3 (lane safety): `patch.extensions.processFlow.lanes` is merged
 *    with the existing lanes FIRST (merge by id, append new), then every
 *    `addNodes[].data.laneId` (and lane changes in `updateNodes`) is validated
 *    against the merged set. Unknown laneId → fallback to the first lane and
 *    a structured warning. Zero orphaned lane references.
 *
 * Inputs are never mutated. Warnings are structured (code + ids) so the
 * caller can localize them (PL/EN) for the panel's risk list.
 */
import type { Edge, Node } from 'reactflow';

import type { AIProposal } from '../ideaSelectionTypes';
import { type Lane, LANE_COLORS, LANE_HEIGHT } from './LaneSystem';

export type ProposalPatch = AIProposal['patch'];

export type ApplyPatchWarningCode =
  | 'unknown_lane_fallback'
  | 'duplicate_node_skipped'
  | 'duplicate_edge_skipped'
  | 'dangling_edge_skipped'
  | 'unknown_update_target'
  | 'unknown_move_target';

export interface ApplyPatchWarning {
  code: ApplyPatchWarningCode;
  /** id of the affected node/edge from the patch */
  objectId: string;
  /** extra context, e.g. the unknown laneId or the dangling source→target */
  detail?: string;
}

export interface ApplyPatchResult {
  nodes: Node[];
  edges: Edge[];
  lanes: Lane[];
  addedNodeIds: string[];
  addedEdgeIds: string[];
  warnings: ApplyPatchWarning[];
}

/** Extract `extensions.processFlow.lanes` from a patch (defensively). */
function patchLanesOf(patch: ProposalPatch | null | undefined): unknown[] {
  const pf = (patch?.extensions as Record<string, unknown> | undefined)?.processFlow as
    | Record<string, unknown>
    | undefined;
  return Array.isArray(pf?.lanes) ? (pf.lanes as unknown[]) : [];
}

/**
 * Merge proposed lanes into the existing set: matching ids update
 * label/color in place, unknown ids are appended (color defaulting to the
 * shared swimlane palette). Existing lanes are never dropped.
 */
export function mergeLanes(existing: Lane[], incoming: unknown[]): Lane[] {
  if (!incoming || incoming.length === 0) return existing;
  const merged = existing.map((l) => ({ ...l }));
  const byId = new Map(merged.map((l) => [l.id, l]));
  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const id = String(rec.id ?? '').trim();
    if (!id) continue;
    const label = typeof rec.label === 'string' && rec.label.trim() ? rec.label : undefined;
    const color = typeof rec.color === 'string' && rec.color.trim() ? rec.color : undefined;
    const current = byId.get(id);
    if (current) {
      if (label) current.label = label;
      if (color) current.color = color;
    } else {
      const lane: Lane = {
        id,
        label: label || id,
        color: color || LANE_COLORS[merged.length % LANE_COLORS.length],
      };
      merged.push(lane);
      byId.set(id, lane);
    }
  }
  return merged;
}

export function applyProposalPatch(
  nodes: Node[],
  edges: Edge[],
  lanes: Lane[],
  patch: ProposalPatch | null | undefined
): ApplyPatchResult {
  const warnings: ApplyPatchWarning[] = [];
  const addedNodeIds: string[] = [];
  const addedEdgeIds: string[] = [];

  // Decision 3: merge lanes BEFORE any node work so laneId validation sees
  // the final lane set.
  const mergedLanes = mergeLanes(lanes, patchLanesOf(patch));

  let nextNodes: Node[] = [...nodes];
  let nextEdges: Edge[] = [...edges];

  if (!patch) {
    return {
      nodes: nextNodes,
      edges: nextEdges,
      lanes: mergedLanes,
      addedNodeIds,
      addedEdgeIds,
      warnings,
    };
  }

  const laneIds = new Set(mergedLanes.map((l) => l.id));
  const fallbackLane = mergedLanes[0];

  const resolveLaneId = (requested: unknown, objectId: string): string | undefined => {
    const laneId = typeof requested === 'string' && requested.trim() ? requested : '';
    if (laneId && laneIds.has(laneId)) return laneId;
    if (laneId) {
      warnings.push({ code: 'unknown_lane_fallback', objectId, detail: laneId });
    }
    return fallbackLane?.id;
  };

  // ── removes first (so re-adding an id in the same patch behaves sanely) ──
  if (patch.removeNodeIds?.length) {
    const removeSet = new Set(patch.removeNodeIds.map(String));
    nextNodes = nextNodes.filter((n) => !removeSet.has(String(n.id)));
    nextEdges = nextEdges.filter(
      (e) => !removeSet.has(String(e.source)) && !removeSet.has(String(e.target))
    );
  }
  if (patch.removeEdgeIds?.length) {
    const removeSet = new Set(patch.removeEdgeIds.map(String));
    nextEdges = nextEdges.filter((e) => !removeSet.has(String(e.id)));
  }

  const nodeIds = new Set(nextNodes.map((n) => String(n.id)));

  // ── addNodes (idempotent by id) ──────────────────────────────────────────
  for (const raw of patch.addNodes || []) {
    if (!raw?.id) continue;
    const id = String(raw.id);
    if (nodeIds.has(id)) {
      warnings.push({ code: 'duplicate_node_skipped', objectId: id });
      continue;
    }
    const data =
      raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
        ? { ...(raw.data as Record<string, unknown>) }
        : {};
    const laneId = resolveLaneId(data.laneId, id);
    const lane = mergedLanes.find((l) => l.id === laneId);
    const laneIndex = Math.max(
      0,
      mergedLanes.findIndex((l) => l.id === laneId)
    );
    const countInLane = nextNodes.filter((n) => n.data?.laneId === laneId).length;
    const node: Node = {
      id,
      type: typeof raw.type === 'string' && raw.type ? raw.type : 'flowNode',
      position:
        raw.position && typeof raw.position.x === 'number' && typeof raw.position.y === 'number'
          ? { ...raw.position }
          : { x: 100 + countInLane * 200, y: 60 + laneIndex * LANE_HEIGHT },
      data: {
        ...data,
        label: raw.label || (data.label as string | undefined) || id,
        shape: (data.shape as string | undefined) || 'action',
        laneId,
        laneColor: lane?.color,
      },
    };
    nextNodes = [...nextNodes, node];
    nodeIds.add(id);
    addedNodeIds.push(id);
  }

  // ── addEdges (idempotent by id, no dangling references) ─────────────────
  const edgeIds = new Set(nextEdges.map((e) => String(e.id)));
  for (const raw of patch.addEdges || []) {
    if (!raw?.id || !raw.source || !raw.target) continue;
    const id = String(raw.id);
    if (edgeIds.has(id)) {
      warnings.push({ code: 'duplicate_edge_skipped', objectId: id });
      continue;
    }
    if (!nodeIds.has(String(raw.source)) || !nodeIds.has(String(raw.target))) {
      warnings.push({
        code: 'dangling_edge_skipped',
        objectId: id,
        detail: `${raw.source} → ${raw.target}`,
      });
      continue;
    }
    const data =
      raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
        ? { ...(raw.data as Record<string, unknown>) }
        : {};
    const edge: Edge = {
      id,
      source: String(raw.source),
      target: String(raw.target),
      type: 'flowEdge',
      ...(raw.label ? { label: raw.label } : {}),
      data: raw.label ? { ...data, label: raw.label } : data,
    };
    nextEdges = [...nextEdges, edge];
    edgeIds.add(id);
    addedEdgeIds.push(id);
  }

  // ── updateNodes (merge into data; lane changes are validated too) ───────
  for (const upd of patch.updateNodes || []) {
    if (!upd?.id) continue;
    const id = String(upd.id);
    if (!nodeIds.has(id)) {
      warnings.push({ code: 'unknown_update_target', objectId: id });
      continue;
    }
    const updData =
      upd.data && typeof upd.data === 'object' && !Array.isArray(upd.data)
        ? { ...(upd.data as Record<string, unknown>) }
        : {};
    if ('laneId' in updData) {
      const laneId = resolveLaneId(updData.laneId, id);
      updData.laneId = laneId;
      updData.laneColor = mergedLanes.find((l) => l.id === laneId)?.color;
    }
    nextNodes = nextNodes.map((n) =>
      String(n.id) === id ? { ...n, data: { ...n.data, ...updData } } : n
    );
  }

  // ── moveNodes ────────────────────────────────────────────────────────────
  for (const mv of patch.moveNodes || []) {
    if (!mv?.nodeId) continue;
    const id = String(mv.nodeId);
    if (!nodeIds.has(id)) {
      warnings.push({ code: 'unknown_move_target', objectId: id });
      continue;
    }
    if (!mv.position || typeof mv.position.x !== 'number' || typeof mv.position.y !== 'number') {
      continue;
    }
    nextNodes = nextNodes.map((n) =>
      String(n.id) === id ? { ...n, position: { ...mv.position! } } : n
    );
  }

  return {
    nodes: nextNodes,
    edges: nextEdges,
    lanes: mergedLanes,
    addedNodeIds,
    addedEdgeIds,
    warnings,
  };
}
