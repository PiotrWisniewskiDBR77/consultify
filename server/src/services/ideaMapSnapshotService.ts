/**
 * Idea Map Snapshot Service — shared write-path for map version snapshots.
 *
 * Extracted from POST /api/my-work/my-ideas/:id/map/snapshots
 * (server/src/routes/my-work.routes.ts) so the SnapshotHistory endpoint and
 * the auto-snapshot cron (server/src/jobs/ideaMapAutoSnapshotJob.ts) share a
 * single INSERT into the canonical `my_idea_map_snapshots` table.
 *
 * Auto snapshots are distinguished from manual ones purely by the label
 * prefix `auto:` — the table has no dedicated flag column and retention must
 * never delete manual snapshots.
 */

import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../utils/queryHelpers.js';

export const AUTO_SNAPSHOT_LABEL_PREFIX = 'auto:';

/** True when a snapshot label marks a cron-created auto snapshot. */
export function isAutoSnapshotLabel(label: unknown): boolean {
  return (
    typeof label === 'string' && label.trim().toLowerCase().startsWith(AUTO_SNAPSHOT_LABEL_PREFIX)
  );
}

export interface CreateSnapshotInput {
  ideaId: string;
  userId: string;
  organizationId: string;
  label: string;
  nodes: unknown[];
  edges: unknown[];
  // Tool-specific state (extensions.processFlow.lanes, extensions.whiteboard.*,
  // extensions.table.*). Captured so restore rolls back the WHOLE tool, not just
  // the shared nodes/edges. Optional + backward compatible: pre-existing snapshots
  // (and callers that omit it) simply store no extensions, and restore falls back
  // to preserving the live extensions via deep-merge.
  extensions?: Record<string, unknown> | null;
}

export interface CreatedSnapshot {
  id: string;
  label: string;
  nodeCount: number;
  edgeCount: number;
  timestamp: number;
}

/**
 * Insert one snapshot row. Same SQL the manual endpoint always used
 * (including the `datetime('now')` timestamp idiom handled by the DB adapter).
 */
export async function createIdeaMapSnapshot(input: CreateSnapshotInput): Promise<CreatedSnapshot> {
  const id = uuidv4();
  const nodes = Array.isArray(input.nodes) ? input.nodes : [];
  const edges = Array.isArray(input.edges) ? input.edges : [];
  const hasExtensions =
    input.extensions && typeof input.extensions === 'object' && !Array.isArray(input.extensions);
  const dataJson = JSON.stringify(
    hasExtensions ? { nodes, edges, extensions: input.extensions } : { nodes, edges }
  );

  await queryHelpers.run(
    `INSERT INTO my_idea_map_snapshots (id, idea_id, user_id, organization_id, label, node_count, edge_count, data_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      id,
      input.ideaId,
      input.userId,
      input.organizationId,
      input.label,
      nodes.length,
      edges.length,
      dataJson,
    ]
  );

  return {
    id,
    label: input.label,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    timestamp: Date.now(),
  };
}

export default { createIdeaMapSnapshot, isAutoSnapshotLabel, AUTO_SNAPSHOT_LABEL_PREFIX };
