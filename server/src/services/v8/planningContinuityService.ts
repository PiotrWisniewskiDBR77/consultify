/**
 * V8 Planning/Approval Continuity Service
 *
 * WP-W3-LIFECYCLE-02: Manages initiative decomposition (WBS), material change
 * detection, cross-initiative dependencies, and decision chains.
 * All queries enforce organization-level isolation.
 *
 * Decisions implemented:
 *   W3-4 — WBS depth (4-level max: initiative → workstream_phase → task → subtask)
 *   W3-5 — Material change threshold (dimension-based materiality)
 *   W3-6 — Cross-initiative dependency model
 *   W3-7 — Decision chain model (sequential | parallel | delegated)
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  InitiativeDecomposition,
  MaterialChangeCheck,
  CrossInitiativeDependency,
  DecisionChain,
  DecisionChainEntry,
  RecordDecompositionParams,
  CheckMaterialChangeParams,
  CreateCrossInitiativeDependencyParams,
  CreateDecisionChainParams,
  WBSLevel,
  CrossDependencyStatus,
} from '../../types/planningContinuity.js';
import {
  RecordDecompositionParamsSchema,
  CheckMaterialChangeParamsSchema,
  CreateCrossInitiativeDependencyParamsSchema,
  CreateDecisionChainParamsSchema,
  WBS_DEPTH_MAP,
  WBS_MAX_DEPTH,
  HIGH_IMPACT_DIMENSIONS,
  MATERIALITY_MIN_DIMENSIONS,
} from '../../types/planningContinuity.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:PlanningContinuity]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

// ==========================================
// ROW TYPES
// ==========================================

interface DecompositionRow {
  decomposition_id: string;
  organization_id: string;
  initiative_id: string;
  parent_id: string | null;
  wbs_level: string;
  object_type: string;
  object_id: string;
  approval_inherited: number;
  created_at: string;
  updated_at: string;
  metadata: string;
}

interface CrossDependencyRow {
  dependency_id: string;
  organization_id: string;
  source_initiative_id: string;
  target_initiative_id: string;
  dependency_type: string;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  metadata: string;
}

interface DecisionChainRow {
  chain_id: string;
  organization_id: string;
  initiative_id: string;
  chain_type: string;
  decisions: string;
  status: string;
  created_at: string;
  updated_at: string;
  metadata: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToDecomposition(row: DecompositionRow): InitiativeDecomposition {
  return {
    decompositionId: row.decomposition_id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    parentId: row.parent_id || null,
    wbsLevel: row.wbs_level as WBSLevel,
    objectType: row.object_type as InitiativeDecomposition['objectType'],
    objectId: row.object_id,
    approvalInherited: row.approval_inherited === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: safeJsonParse(row.metadata, {}),
  };
}

function rowToCrossDependency(row: CrossDependencyRow): CrossInitiativeDependency {
  return {
    dependencyId: row.dependency_id,
    organizationId: row.organization_id,
    sourceInitiativeId: row.source_initiative_id,
    targetInitiativeId: row.target_initiative_id,
    dependencyType: row.dependency_type as CrossInitiativeDependency['dependencyType'],
    status: row.status as CrossInitiativeDependency['status'],
    description: row.description || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: safeJsonParse(row.metadata, {}),
  };
}

function rowToDecisionChain(row: DecisionChainRow): DecisionChain {
  return {
    chainId: row.chain_id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    chainType: row.chain_type as DecisionChain['chainType'],
    decisions: safeJsonParse<DecisionChainEntry[]>(row.decisions, []),
    status: row.status as DecisionChain['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: safeJsonParse(row.metadata, {}),
  };
}

// ==========================================
// DECOMPOSITION (Decision W3-4)
// ==========================================

/**
 * Record a WBS decomposition entry.
 * Validates max depth (4 levels) by computing ancestry depth from parentId.
 */
export async function recordDecomposition(
  params: RecordDecompositionParams,
): Promise<InitiativeDecomposition> {
  const validated = RecordDecompositionParamsSchema.parse(params);

  const requestedDepth = WBS_DEPTH_MAP[validated.wbsLevel];
  if (requestedDepth > WBS_MAX_DEPTH) {
    throw new Error(
      `WBS depth violation: level '${validated.wbsLevel}' (depth ${requestedDepth}) ` +
      `exceeds maximum allowed depth of ${WBS_MAX_DEPTH}`,
    );
  }

  if (validated.parentId) {
    const parentRow = await dbGet<DecompositionRow>(
      `SELECT * FROM v8_initiative_decompositions
       WHERE decomposition_id = ? AND organization_id = ?`,
      [validated.parentId, validated.organizationId],
    );

    if (!parentRow) {
      throw new Error(
        `Parent decomposition ${validated.parentId} not found in organization ${validated.organizationId}`,
      );
    }

    const parentDepth = WBS_DEPTH_MAP[parentRow.wbs_level as WBSLevel];
    if (requestedDepth <= parentDepth) {
      throw new Error(
        `WBS hierarchy violation: child level '${validated.wbsLevel}' (depth ${requestedDepth}) ` +
        `must be deeper than parent level '${parentRow.wbs_level}' (depth ${parentDepth})`,
      );
    }
  }

  const decompositionId = uuidv4();
  const now = new Date().toISOString();

  const entry: InitiativeDecomposition = {
    decompositionId,
    organizationId: validated.organizationId,
    initiativeId: validated.initiativeId,
    parentId: validated.parentId ?? null,
    wbsLevel: validated.wbsLevel,
    objectType: validated.objectType,
    objectId: validated.objectId,
    approvalInherited: validated.approvalInherited,
    createdAt: now,
    updatedAt: now,
    metadata: validated.metadata,
  };

  await dbRun(
    `INSERT INTO v8_initiative_decompositions (
      decomposition_id, organization_id, initiative_id, parent_id,
      wbs_level, object_type, object_id, approval_inherited,
      created_at, updated_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.decompositionId,
      entry.organizationId,
      entry.initiativeId,
      entry.parentId,
      entry.wbsLevel,
      entry.objectType,
      entry.objectId,
      entry.approvalInherited ? 1 : 0,
      entry.createdAt,
      entry.updatedAt,
      JSON.stringify(entry.metadata),
    ],
  );

  logger.info(
    `${LOG_PREFIX} Recorded decomposition ${decompositionId} ` +
    `[${entry.wbsLevel}/${entry.objectType}] for initiative ${entry.initiativeId}`,
  );

  return entry;
}

/**
 * Get the full decomposition tree for an initiative, ordered by WBS depth.
 */
export async function getDecompositionTree(
  initiativeId: string,
  orgId: string,
): Promise<InitiativeDecomposition[]> {
  const rows = await dbAll<DecompositionRow>(
    `SELECT * FROM v8_initiative_decompositions
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY
       CASE wbs_level
         WHEN 'initiative' THEN 1
         WHEN 'workstream_phase' THEN 2
         WHEN 'task' THEN 3
         WHEN 'subtask' THEN 4
       END ASC,
       created_at ASC`,
    [initiativeId, orgId],
    { fallback: true },
  );

  return (rows || []).map(rowToDecomposition);
}

/**
 * Get a single decomposition entry by ID with org isolation.
 */
export async function getDecomposition(
  decompositionId: string,
  orgId: string,
): Promise<InitiativeDecomposition | null> {
  const row = await dbGet<DecompositionRow>(
    `SELECT * FROM v8_initiative_decompositions
     WHERE decomposition_id = ? AND organization_id = ?`,
    [decompositionId, orgId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToDecomposition(row);
}

// ==========================================
// MATERIAL CHANGE DETECTION (Decision W3-5)
// ==========================================

/**
 * Evaluate whether a change is material based on affected dimensions.
 *
 * A change is material if:
 * - It affects at least MATERIALITY_MIN_DIMENSIONS dimensions, OR
 * - It affects any HIGH_IMPACT_DIMENSIONS (scope, timeline, critical_path, cost)
 *
 * Material changes require change management.
 */
export function checkMaterialChange(
  params: CheckMaterialChangeParams,
): MaterialChangeCheck {
  const validated = CheckMaterialChangeParamsSchema.parse(params);

  const dimensions = validated.affectedDimensions;
  const hasHighImpact = dimensions.some((d) => HIGH_IMPACT_DIMENSIONS.has(d));
  const meetsThreshold = dimensions.length >= MATERIALITY_MIN_DIMENSIONS;

  const isMaterial = hasHighImpact || meetsThreshold;

  return {
    isMaterial,
    affectedDimensions: dimensions,
    requiresChangeManagement: isMaterial,
    summary: validated.summary ?? null,
  };
}

// ==========================================
// CROSS-INITIATIVE DEPENDENCIES (Decision W3-6)
// ==========================================

/**
 * Create a cross-initiative dependency link.
 * Validates that source and target are different initiatives.
 */
export async function createCrossInitiativeDependency(
  params: CreateCrossInitiativeDependencyParams,
): Promise<CrossInitiativeDependency> {
  const validated = CreateCrossInitiativeDependencyParamsSchema.parse(params);

  if (validated.sourceInitiativeId === validated.targetInitiativeId) {
    throw new Error(
      'Cross-initiative dependency requires different source and target initiatives',
    );
  }

  const dependencyId = uuidv4();
  const now = new Date().toISOString();

  const dep: CrossInitiativeDependency = {
    dependencyId,
    organizationId: validated.organizationId,
    sourceInitiativeId: validated.sourceInitiativeId,
    targetInitiativeId: validated.targetInitiativeId,
    dependencyType: validated.dependencyType,
    status: 'active',
    description: validated.description ?? null,
    createdAt: now,
    updatedAt: now,
    metadata: validated.metadata,
  };

  await dbRun(
    `INSERT INTO v8_cross_initiative_dependencies (
      dependency_id, organization_id, source_initiative_id, target_initiative_id,
      dependency_type, status, description, created_at, updated_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dep.dependencyId,
      dep.organizationId,
      dep.sourceInitiativeId,
      dep.targetInitiativeId,
      dep.dependencyType,
      dep.status,
      dep.description,
      dep.createdAt,
      dep.updatedAt,
      JSON.stringify(dep.metadata),
    ],
  );

  logger.info(
    `${LOG_PREFIX} Created cross-initiative dependency ${dependencyId}: ` +
    `${dep.sourceInitiativeId} → ${dep.targetInitiativeId} (${dep.dependencyType})`,
  );

  return dep;
}

/**
 * Get all cross-initiative dependencies for an initiative (as source or target).
 */
export async function getCrossInitiativeDependencies(
  initiativeId: string,
  orgId: string,
): Promise<CrossInitiativeDependency[]> {
  const rows = await dbAll<CrossDependencyRow>(
    `SELECT * FROM v8_cross_initiative_dependencies
     WHERE organization_id = ?
       AND (source_initiative_id = ? OR target_initiative_id = ?)
     ORDER BY created_at ASC`,
    [orgId, initiativeId, initiativeId],
    { fallback: true },
  );

  return (rows || []).map(rowToCrossDependency);
}

/**
 * Update the status of a cross-initiative dependency.
 */
export async function updateCrossInitiativeDependencyStatus(
  dependencyId: string,
  orgId: string,
  status: CrossDependencyStatus,
): Promise<CrossInitiativeDependency> {
  const row = await dbGet<CrossDependencyRow>(
    `SELECT * FROM v8_cross_initiative_dependencies
     WHERE dependency_id = ? AND organization_id = ?`,
    [dependencyId, orgId],
  );

  if (!row) {
    throw new Error(
      `Cross-initiative dependency ${dependencyId} not found in organization ${orgId}`,
    );
  }

  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_cross_initiative_dependencies
     SET status = ?, updated_at = ?
     WHERE dependency_id = ? AND organization_id = ?`,
    [status, now, dependencyId, orgId],
  );

  logger.info(`${LOG_PREFIX} Dependency ${dependencyId} status → ${status}`);

  return {
    ...rowToCrossDependency(row),
    status,
    updatedAt: now,
  };
}

// ==========================================
// DECISION CHAINS (Decision W3-7)
// ==========================================

/**
 * Create a lightweight decision chain.
 * All decisions start as 'pending'.
 */
export async function createDecisionChain(
  params: CreateDecisionChainParams,
): Promise<DecisionChain> {
  const validated = CreateDecisionChainParamsSchema.parse(params);

  const chainId = uuidv4();
  const now = new Date().toISOString();

  const decisions: DecisionChainEntry[] = validated.decisions.map((d) => ({
    decisionId: d.decisionId,
    order: d.order,
    status: 'pending' as const,
    decidedBy: null,
    decidedAt: null,
  }));

  const chain: DecisionChain = {
    chainId,
    organizationId: validated.organizationId,
    initiativeId: validated.initiativeId,
    chainType: validated.chainType,
    decisions,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    metadata: validated.metadata,
  };

  await dbRun(
    `INSERT INTO v8_decision_chains (
      chain_id, organization_id, initiative_id, chain_type,
      decisions, status, created_at, updated_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chain.chainId,
      chain.organizationId,
      chain.initiativeId,
      chain.chainType,
      JSON.stringify(chain.decisions),
      chain.status,
      chain.createdAt,
      chain.updatedAt,
      JSON.stringify(chain.metadata),
    ],
  );

  logger.info(
    `${LOG_PREFIX} Created decision chain ${chainId} (${chain.chainType}) ` +
    `with ${decisions.length} decisions for initiative ${chain.initiativeId}`,
  );

  return chain;
}

/**
 * Get a decision chain by ID with org isolation.
 */
export async function getDecisionChain(
  chainId: string,
  orgId: string,
): Promise<DecisionChain | null> {
  const row = await dbGet<DecisionChainRow>(
    `SELECT * FROM v8_decision_chains
     WHERE chain_id = ? AND organization_id = ?`,
    [chainId, orgId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToDecisionChain(row);
}

/**
 * Get all decision chains for an initiative.
 */
export async function getDecisionChainsByInitiative(
  initiativeId: string,
  orgId: string,
): Promise<DecisionChain[]> {
  const rows = await dbAll<DecisionChainRow>(
    `SELECT * FROM v8_decision_chains
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [initiativeId, orgId],
    { fallback: true },
  );

  return (rows || []).map(rowToDecisionChain);
}

// ==========================================
// WBS TREE, COMPLETENESS, CRITICAL PATH, PENDING DECISIONS (Wave 11)
// ==========================================

const NON_LEAF_WBS_LEVELS: ReadonlySet<WBSLevel> = new Set([
  'initiative',
  'workstream_phase',
  'task',
]);

export interface WBSCompletenessGap {
  nodeId: string;
  level: WBSLevel;
  reason: string;
}

export interface WBSCompletenessResult {
  complete: boolean;
  gaps: WBSCompletenessGap[];
}

/**
 * Full WBS decomposition tree for an initiative (all levels).
 * Alias of getDecompositionTree with (initiativeId, organizationId) parameter order.
 */
export async function getWBSByInitiative(
  initiativeId: string,
  organizationId: string,
): Promise<InitiativeDecomposition[]> {
  return getDecompositionTree(initiativeId, organizationId);
}

/**
 * Detect structural gaps: non-leaf WBS nodes (initiative, workstream_phase, task)
 * that have no child decompositions.
 */
export async function validateWBSCompleteness(
  initiativeId: string,
  organizationId: string,
): Promise<WBSCompletenessResult> {
  const nodes = await getDecompositionTree(initiativeId, organizationId);
  const byParent = new Map<string | null, InitiativeDecomposition[]>();

  for (const n of nodes) {
    const key = n.parentId;
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  }

  const gaps: WBSCompletenessGap[] = [];

  for (const node of nodes) {
    if (!NON_LEAF_WBS_LEVELS.has(node.wbsLevel)) {
      continue;
    }
    const children = byParent.get(node.decompositionId) ?? [];
    if (children.length === 0) {
      gaps.push({
        nodeId: node.decompositionId,
        level: node.wbsLevel,
        reason: 'non_leaf_without_children',
      });
    }
  }

  return {
    complete: gaps.length === 0,
    gaps,
  };
}

/**
 * Longest root-to-leaf chain in the WBS tree (proxy critical path when no explicit
 * task dependency graph exists in v8 schema).
 */
export async function getCriticalPath(
  initiativeId: string,
  organizationId: string,
): Promise<InitiativeDecomposition[]> {
  const nodes = await getDecompositionTree(initiativeId, organizationId);
  if (nodes.length === 0) {
    return [];
  }

  const byParent = new Map<string | null, InitiativeDecomposition[]>();
  for (const n of nodes) {
    const key = n.parentId;
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  }

  const memo = new Map<string, InitiativeDecomposition[]>();

  function longestFrom(node: InitiativeDecomposition): InitiativeDecomposition[] {
    const cached = memo.get(node.decompositionId);
    if (cached) {
      return cached;
    }
    const children = byParent.get(node.decompositionId) ?? [];
    if (children.length === 0) {
      const path = [node];
      memo.set(node.decompositionId, path);
      return path;
    }
    let best: InitiativeDecomposition[] = [node];
    for (const child of children) {
      const sub = longestFrom(child);
      const candidate = [node, ...sub];
      if (candidate.length > best.length) {
        best = candidate;
      } else if (candidate.length === best.length && best.length > 1) {
        const bestTip = best[best.length - 1]!.decompositionId;
        const candTip = candidate[candidate.length - 1]!.decompositionId;
        if (candTip.localeCompare(bestTip) < 0) {
          best = candidate;
        }
      }
    }
    memo.set(node.decompositionId, best);
    return best;
  }

  const idSet = new Set(nodes.map((n) => n.decompositionId));
  const roots = nodes.filter((n) => n.parentId === null || !idSet.has(n.parentId));
  const startNodes = roots.length > 0 ? roots : nodes;

  let bestPath: InitiativeDecomposition[] = [];
  for (const root of startNodes) {
    const path = longestFrom(root);
    if (path.length > bestPath.length) {
      bestPath = path;
    } else if (path.length === bestPath.length && path.length > 0 && bestPath.length > 0) {
      const bestTip = bestPath[bestPath.length - 1]!.decompositionId;
      const candTip = path[path.length - 1]!.decompositionId;
      if (candTip.localeCompare(bestTip) < 0) {
        bestPath = path;
      }
    }
  }

  return bestPath;
}

/**
 * Decision chains in the organization that still have at least one pending decision.
 */
export async function getPendingDecisions(organizationId: string): Promise<DecisionChain[]> {
  const rows = await dbAll<DecisionChainRow>(
    `SELECT * FROM v8_decision_chains
     WHERE organization_id = ?
     ORDER BY updated_at DESC`,
    [organizationId],
    { fallback: true },
  );

  const chains = (rows || []).map(rowToDecisionChain);
  return chains.filter((c) => c.decisions.some((d) => d.status === 'pending'));
}
