/**
 * ideaClusterService — V4-IDEA-05
 *
 * Materializes AI cluster assignments into first-class graph nodes (kind: 'cluster')
 * and creates outcome nodes (kind: 'outcome') that can be converted to real entities.
 */

import { v4 as uuidv4 } from 'uuid';
import type { CanonicalNode, CanonicalEdge } from '../validators/ideaWorkspaceGraph.validators.js';

export interface ClusterNode extends CanonicalNode {
  kind: 'cluster';
}

export interface OutcomeNode extends CanonicalNode {
  kind: 'outcome';
}

export type OutcomeType = 'task' | 'decision' | 'initiative' | 'insight';

export interface ClusterAssignment {
  id: string;
  name: string;
  nodeIds: string[];
  color?: string;
}

export function materializeClusters(
  existingNodes: CanonicalNode[],
  clusterAssignments: ClusterAssignment[]
): { clusterNodes: ClusterNode[]; edges: CanonicalEdge[] } {
  const clusterNodes: ClusterNode[] = [];
  const edges: CanonicalEdge[] = [];
  const existingNodeIds = new Set(existingNodes.map((n) => n.id));

  for (const assignment of clusterAssignments) {
    const clusterId = assignment.id || uuidv4();
    const validMembers = assignment.nodeIds.filter((nid) => existingNodeIds.has(nid));
    if (validMembers.length === 0) continue;

    const memberPositions = existingNodes
      .filter((n) => validMembers.includes(n.id))
      .map((n) => n.position)
      .filter(Boolean) as { x: number; y: number }[];

    const centroid = memberPositions.length > 0
      ? {
          x: memberPositions.reduce((s, p) => s + p.x, 0) / memberPositions.length,
          y: memberPositions.reduce((s, p) => s + p.y, 0) / memberPositions.length - 80,
        }
      : undefined;

    const clusterNode: ClusterNode = {
      id: clusterId,
      kind: 'cluster',
      label: assignment.name,
      ...(centroid && { position: centroid }),
      metadata: {
        memberNodeIds: validMembers,
        ...(assignment.color && { color: assignment.color }),
      },
    };
    clusterNodes.push(clusterNode);

    for (const memberId of validMembers) {
      edges.push({
        id: `e-${memberId}-${clusterId}`,
        fromNodeId: memberId,
        toNodeId: clusterId,
        relationType: 'supports',
        label: 'member',
      });
    }
  }

  return { clusterNodes, edges };
}

export function createOutcomeFromCluster(
  clusterId: string,
  outcomeType: OutcomeType,
  label: string,
  clusterNode?: CanonicalNode
): OutcomeNode {
  const outcomeId = uuidv4();

  let position: { x: number; y: number } | undefined;
  if (clusterNode?.position) {
    position = {
      x: clusterNode.position.x + 200,
      y: clusterNode.position.y,
    };
  }

  return {
    id: outcomeId,
    kind: 'outcome',
    label,
    ...(position && { position }),
    metadata: {
      clusterId,
      outcomeType,
    },
  };
}
