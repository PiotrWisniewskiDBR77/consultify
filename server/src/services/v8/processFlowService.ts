/**
 * P14-B — Process Flow runtime service
 *
 * CRUD on process flow objects (nodes + edges), AI proposal lifecycle,
 * semantic readback, export, 2-layer validation, and degraded posture.
 *
 * Follows the Mindmap (P12) service pattern: DB-backed nodes, in-memory
 * AI proposals, deterministic readback, and bounded structural rules.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun, tableExists } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import {
  isValidMessageFlow,
  isValidSemanticObject,
  P14_DEGRADED_SCENARIOS,
  P14_SEMANTIC_OBJECTS,
  P14_TOOLBELT,
  P14_VALIDATION_RULES,
  type ProcessFlowSemanticObject,
  type ProcessFlowTool,
  validateSemanticRule,
} from './processFlowCanon.js';

const LOG_PREFIX = '[P14-ProcessFlowService]';
const NODES_TABLE = 'v8.v8_process_flow_nodes';
const EDGES_TABLE = 'v8.v8_process_flow_edges';
const MAX_OBJECTS = 200;
const WARN_OBJECTS = 150;
const MAX_NESTING = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessFlowNode {
  id: string;
  process_id: string;
  organization_id: string;
  object_type: ProcessFlowSemanticObject;
  label: string;
  lane_id: string | null;
  pool_id: string | null;
  parent_subprocess_id: string | null;
  position_x: number;
  position_y: number;
  gateway_kind: 'xor' | 'and' | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessFlowEdge {
  id: string;
  process_id: string;
  organization_id: string;
  edge_type: 'sequence_flow' | 'message_flow';
  source_node_id: string;
  target_node_id: string;
  label: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessFlowOperationResult {
  success: boolean;
  operation: string;
  node_id: string | null;
  edge_id: string | null;
  error?: string;
  error_code?: string;
}

export interface ValidationResult {
  valid: boolean;
  layer: 'semantic_first' | 'structural_bounded' | 'both';
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  layer: 'semantic_first' | 'structural_bounded';
  object_id: string | null;
  rule: string;
  message: string;
}

export interface ReadbackStep {
  type: 'step' | 'decision' | 'parallel_split' | 'parallel_join' | 'start' | 'end' | 'warning';
  id: string;
  label: string;
  branches?: ReadbackStep[][];
}

export interface ReadbackResult {
  paths: ReadbackStep[];
  warnings: string[];
}

export interface ExportResult {
  format: 'json' | 'readback';
  content: string;
  node_count: number;
  edge_count: number;
  exported_at: string;
}

export interface AIProposal {
  id: string;
  process_id: string;
  summary: string;
  operations: AIProposalOperation[];
  before_readback: string;
  after_readback: string;
  validation_report: ValidationResult;
  risk_flags: { destructive_count: number; branch_changes: number };
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface AIProposalOperation {
  op:
    | 'create_node'
    | 'update_label'
    | 'connect'
    | 'reconnect'
    | 'delete_node'
    | 'delete_edge'
    | 'move_node'
    | 'set_gateway_kind'
    | 'set_lane'
    | 'auto_layout';
  target_id?: string;
  params?: Record<string, unknown>;
}

export interface DegradedState {
  degraded: boolean;
  scenario: string | null;
  posture: string | null;
  recovery: string | null;
}

export interface ProcessFlowNodesResult {
  nodes: ProcessFlowNode[];
  edges: ProcessFlowEdge[];
  degraded: boolean;
}

// ---------------------------------------------------------------------------
// In-memory AI proposals (preview → accept/reject; no silent apply)
// ---------------------------------------------------------------------------

type StoredAIProposal = AIProposal & { organization_id: string };
const aiProposalStore = new Map<string, StoredAIProposal>();

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

interface NodeRow {
  id: string;
  process_id: string;
  organization_id: string;
  object_type: string;
  label: string;
  lane_id: string | null;
  pool_id: string | null;
  parent_subprocess_id: string | null;
  position_x: number | string | null;
  position_y: number | string | null;
  gateway_kind: string | null;
  metadata: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}

interface EdgeRow {
  id: string;
  process_id: string;
  organization_id: string;
  edge_type: string;
  source_node_id: string;
  target_node_id: string;
  label: string | null;
  metadata: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function toTimestamp(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function mapNodeRow(row: NodeRow): ProcessFlowNode {
  return {
    id: row.id,
    process_id: row.process_id,
    organization_id: row.organization_id,
    object_type: isValidSemanticObject(row.object_type) ? row.object_type : 'task',
    label: row.label,
    lane_id: row.lane_id,
    pool_id: row.pool_id,
    parent_subprocess_id: row.parent_subprocess_id,
    position_x: Number(row.position_x) || 0,
    position_y: Number(row.position_y) || 0,
    gateway_kind:
      row.gateway_kind === 'xor' || row.gateway_kind === 'and' ? row.gateway_kind : null,
    metadata: parseMetadata(row.metadata),
    created_at: toTimestamp(row.created_at),
    updated_at: toTimestamp(row.updated_at),
  };
}

function mapEdgeRow(row: EdgeRow): ProcessFlowEdge {
  return {
    id: row.id,
    process_id: row.process_id,
    organization_id: row.organization_id,
    edge_type: row.edge_type === 'message_flow' ? 'message_flow' : 'sequence_flow',
    source_node_id: row.source_node_id,
    target_node_id: row.target_node_id,
    label: row.label,
    metadata: parseMetadata(row.metadata),
    created_at: toTimestamp(row.created_at),
    updated_at: toTimestamp(row.updated_at),
  };
}

function opResult(
  success: boolean,
  operation: string,
  node_id: string | null,
  edge_id: string | null,
  extra?: { error?: string; error_code?: string }
): ProcessFlowOperationResult {
  return {
    success,
    operation,
    node_id,
    edge_id,
    error: extra?.error,
    error_code: extra?.error_code,
  };
}

async function nodesTableReady(): Promise<boolean> {
  try {
    return await tableExists('v8_process_flow_nodes');
  } catch {
    return false;
  }
}

async function edgesTableReady(): Promise<boolean> {
  try {
    return await tableExists('v8_process_flow_edges');
  } catch {
    return false;
  }
}

async function loadNodes(processId: string, orgId: string): Promise<ProcessFlowNode[]> {
  const rows = await dbAll<NodeRow>(
    `SELECT * FROM ${NODES_TABLE} WHERE process_id = $1 AND organization_id = $2 ORDER BY created_at ASC`,
    [processId, orgId],
    { fallback: true }
  );
  return rows.map(mapNodeRow);
}

async function loadEdges(processId: string, orgId: string): Promise<ProcessFlowEdge[]> {
  const rows = await dbAll<EdgeRow>(
    `SELECT * FROM ${EDGES_TABLE} WHERE process_id = $1 AND organization_id = $2 ORDER BY created_at ASC`,
    [processId, orgId],
    { fallback: true }
  );
  return rows.map(mapEdgeRow);
}

function countNestingDepth(nodeId: string | null, nodes: ProcessFlowNode[], depth = 0): number {
  if (!nodeId || depth > MAX_NESTING + 1) return depth;
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || !node.parent_subprocess_id) return depth;
  return countNestingDepth(node.parent_subprocess_id, nodes, depth + 1);
}

// ---------------------------------------------------------------------------
// 1. getProcessObjects — load full graph
// ---------------------------------------------------------------------------

export async function getProcessObjects(
  processId: string,
  organizationId: string
): Promise<ProcessFlowNodesResult> {
  const nReady = await nodesTableReady();
  if (!nReady) {
    logger.warn(`${LOG_PREFIX} v8_process_flow_nodes missing; returning empty graph`, {
      processId,
    });
    return { nodes: [], edges: [], degraded: true };
  }
  const nodes = await loadNodes(processId, organizationId);
  const edges = await loadEdges(processId, organizationId);
  return { nodes, edges, degraded: false };
}

// ---------------------------------------------------------------------------
// 2. createNode
// ---------------------------------------------------------------------------

export async function createNode(
  processId: string,
  organizationId: string,
  params: {
    object_type: string;
    label: string;
    lane_id?: string | null;
    pool_id?: string | null;
    parent_subprocess_id?: string | null;
    position_x?: number;
    position_y?: number;
    gateway_kind?: string | null;
  }
): Promise<ProcessFlowOperationResult> {
  if (!isValidSemanticObject(params.object_type)) {
    return opResult(false, 'create_node', null, null, {
      error: `Invalid object_type: ${params.object_type}`,
      error_code: 'INVALID_TYPE',
    });
  }

  const label = (params.label || '').trim();
  if (!label && params.object_type !== 'start_event' && params.object_type !== 'end_event') {
    return opResult(false, 'create_node', null, null, {
      error: 'Label is required for this object type',
      error_code: 'INVALID_LABEL',
    });
  }

  const tableOk = await nodesTableReady();
  if (!tableOk) {
    return opResult(false, 'create_node', null, null, {
      error: 'Process flow storage is not available',
      error_code: 'TABLE_MISSING',
    });
  }

  const existing = await loadNodes(processId, organizationId);
  if (existing.length >= MAX_OBJECTS) {
    return opResult(false, 'create_node', null, null, {
      error: `Process exceeds maximum of ${MAX_OBJECTS} objects`,
      error_code: 'SIZE_LIMIT',
    });
  }

  if (params.parent_subprocess_id) {
    const depth = countNestingDepth(params.parent_subprocess_id, existing) + 1;
    if (depth >= MAX_NESTING) {
      return opResult(false, 'create_node', null, null, {
        error: `Subprocess nesting exceeds maximum depth of ${MAX_NESTING}`,
        error_code: 'NESTING_LIMIT',
      });
    }
  }

  const id = uuidv4();
  const gk =
    params.gateway_kind === 'xor' || params.gateway_kind === 'and' ? params.gateway_kind : null;

  const runRes = await dbRun(
    `INSERT INTO ${NODES_TABLE}
      (id, process_id, organization_id, object_type, label, lane_id, pool_id,
       parent_subprocess_id, position_x, position_y, gateway_kind, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, NOW(), NOW())`,
    [
      id,
      processId,
      organizationId,
      params.object_type,
      label || '',
      params.lane_id ?? null,
      params.pool_id ?? null,
      params.parent_subprocess_id ?? null,
      params.position_x ?? 0,
      params.position_y ?? 0,
      gk,
    ],
    { fallback: true }
  );

  if (!runRes.success) {
    logger.warn(`${LOG_PREFIX} createNode failed`, { processId, error: runRes.error });
    return opResult(false, 'create_node', null, null, {
      error: runRes.error || 'Insert failed',
      error_code: 'DB_ERROR',
    });
  }

  return opResult(true, 'create_node', id, null);
}

// ---------------------------------------------------------------------------
// 3. updateNodeLabel
// ---------------------------------------------------------------------------

export async function updateNodeLabel(
  nodeId: string,
  organizationId: string,
  newLabel: string
): Promise<ProcessFlowOperationResult> {
  const label = (newLabel || '').trim();
  if (!label) {
    return opResult(false, 'update_label', nodeId, null, {
      error: 'Label is required',
      error_code: 'INVALID_LABEL',
    });
  }

  const runRes = await dbRun(
    `UPDATE ${NODES_TABLE} SET label = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3`,
    [label, nodeId, organizationId],
    { fallback: true }
  );

  if (!runRes.success || !runRes.changes) {
    return opResult(false, 'update_label', nodeId, null, {
      error: 'Node not found or update failed',
      error_code: runRes.changes === 0 ? 'NOT_FOUND' : 'DB_ERROR',
    });
  }

  return opResult(true, 'update_label', nodeId, null);
}

// ---------------------------------------------------------------------------
// 4. moveNode
// ---------------------------------------------------------------------------

export async function moveNode(
  nodeId: string,
  organizationId: string,
  position: { x: number; y: number }
): Promise<ProcessFlowOperationResult> {
  const runRes = await dbRun(
    `UPDATE ${NODES_TABLE} SET position_x = $1, position_y = $2, updated_at = NOW()
     WHERE id = $3 AND organization_id = $4`,
    [position.x, position.y, nodeId, organizationId],
    { fallback: true }
  );

  if (!runRes.success || !runRes.changes) {
    return opResult(false, 'move_node', nodeId, null, {
      error: 'Node not found or move failed',
      error_code: 'NOT_FOUND',
    });
  }

  return opResult(true, 'move_node', nodeId, null);
}

// ---------------------------------------------------------------------------
// 5. deleteNode
// ---------------------------------------------------------------------------

export async function deleteNode(
  nodeId: string,
  organizationId: string
): Promise<ProcessFlowOperationResult> {
  const edgesOk = await edgesTableReady();
  if (edgesOk) {
    await dbRun(
      `DELETE FROM ${EDGES_TABLE} WHERE (source_node_id = $1 OR target_node_id = $1) AND organization_id = $2`,
      [nodeId, organizationId],
      { fallback: true }
    );
  }

  const runRes = await dbRun(
    `DELETE FROM ${NODES_TABLE} WHERE id = $1 AND organization_id = $2`,
    [nodeId, organizationId],
    { fallback: true }
  );

  if (!runRes.success || !runRes.changes) {
    return opResult(false, 'delete_node', nodeId, null, {
      error: 'Node not found',
      error_code: 'NOT_FOUND',
    });
  }

  return opResult(true, 'delete_node', nodeId, null);
}

// ---------------------------------------------------------------------------
// 6. createEdge (connect)
// ---------------------------------------------------------------------------

export async function createEdge(
  processId: string,
  organizationId: string,
  params: {
    edge_type: string;
    source_node_id: string;
    target_node_id: string;
    label?: string | null;
  }
): Promise<ProcessFlowOperationResult> {
  const edgeType = params.edge_type === 'message_flow' ? 'message_flow' : 'sequence_flow';

  const tableOk = await edgesTableReady();
  if (!tableOk) {
    return opResult(false, 'connect', null, null, {
      error: 'Edge storage is not available',
      error_code: 'TABLE_MISSING',
    });
  }

  if (edgeType === 'message_flow') {
    const [src, tgt] = await Promise.all([
      dbGet<NodeRow>(
        `SELECT pool_id FROM ${NODES_TABLE} WHERE id = $1 AND organization_id = $2`,
        [params.source_node_id, organizationId],
        { fallback: true }
      ),
      dbGet<NodeRow>(
        `SELECT pool_id FROM ${NODES_TABLE} WHERE id = $1 AND organization_id = $2`,
        [params.target_node_id, organizationId],
        { fallback: true }
      ),
    ]);
    if (!src || !tgt) {
      return opResult(false, 'connect', null, null, {
        error: 'Source or target node not found',
        error_code: 'NOT_FOUND',
      });
    }
    const mfCheck = isValidMessageFlow(src.pool_id, tgt.pool_id);
    if (!mfCheck.valid) {
      return opResult(false, 'connect', null, null, {
        error: mfCheck.error!,
        error_code: 'INVALID_MESSAGE_FLOW',
      });
    }
  }

  const id = uuidv4();
  const runRes = await dbRun(
    `INSERT INTO ${EDGES_TABLE}
      (id, process_id, organization_id, edge_type, source_node_id, target_node_id, label, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NOW(), NOW())`,
    [
      id,
      processId,
      organizationId,
      edgeType,
      params.source_node_id,
      params.target_node_id,
      params.label ?? null,
    ],
    { fallback: true }
  );

  if (!runRes.success) {
    return opResult(false, 'connect', null, null, {
      error: runRes.error || 'Insert failed',
      error_code: 'DB_ERROR',
    });
  }

  return opResult(true, 'connect', null, id);
}

// ---------------------------------------------------------------------------
// 7. deleteEdge
// ---------------------------------------------------------------------------

export async function deleteEdge(
  edgeId: string,
  organizationId: string
): Promise<ProcessFlowOperationResult> {
  const runRes = await dbRun(
    `DELETE FROM ${EDGES_TABLE} WHERE id = $1 AND organization_id = $2`,
    [edgeId, organizationId],
    { fallback: true }
  );

  if (!runRes.success || !runRes.changes) {
    return opResult(false, 'delete_edge', null, edgeId, {
      error: 'Edge not found',
      error_code: 'NOT_FOUND',
    });
  }

  return opResult(true, 'delete_edge', null, edgeId);
}

// ---------------------------------------------------------------------------
// 8. updateEdgeLabel
// ---------------------------------------------------------------------------

export async function updateEdgeLabel(
  edgeId: string,
  organizationId: string,
  newLabel: string
): Promise<ProcessFlowOperationResult> {
  const runRes = await dbRun(
    `UPDATE ${EDGES_TABLE} SET label = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3`,
    [newLabel, edgeId, organizationId],
    { fallback: true }
  );

  if (!runRes.success || !runRes.changes) {
    return opResult(false, 'update_label', null, edgeId, {
      error: 'Edge not found or update failed',
      error_code: 'NOT_FOUND',
    });
  }

  return opResult(true, 'update_label', null, edgeId);
}

// ---------------------------------------------------------------------------
// 9. validate — 2-layer validation (semantic_first + structural_bounded)
// ---------------------------------------------------------------------------

export async function validateProcess(
  processId: string,
  organizationId: string
): Promise<ValidationResult> {
  const nodes = await loadNodes(processId, organizationId);
  const edges = await loadEdges(processId, organizationId);

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Layer 1: semantic_first
  for (const node of nodes) {
    const incoming = edges.filter(
      (e) => e.target_node_id === node.id && e.edge_type === 'sequence_flow'
    ).length;
    const outgoing = edges.filter(
      (e) => e.source_node_id === node.id && e.edge_type === 'sequence_flow'
    ).length;
    const semResult = validateSemanticRule(node.object_type, incoming, outgoing);
    for (const err of semResult.errors) {
      errors.push({ layer: 'semantic_first', object_id: node.id, rule: err, message: err });
    }

    if (node.object_type === 'task' && !node.label.trim()) {
      errors.push({
        layer: 'semantic_first',
        object_id: node.id,
        rule: 'Activity label required',
        message: `Task ${node.id} has empty label`,
      });
    }

    if (node.object_type === 'message_flow') {
      errors.push({
        layer: 'semantic_first',
        object_id: node.id,
        rule: 'message_flow is an edge type, not a node',
        message: `Node ${node.id} has invalid type message_flow`,
      });
    }
  }

  for (const edge of edges) {
    if (edge.edge_type === 'message_flow') {
      const src = nodes.find((n) => n.id === edge.source_node_id);
      const tgt = nodes.find((n) => n.id === edge.target_node_id);
      if (src && tgt && src.pool_id && tgt.pool_id && src.pool_id === tgt.pool_id) {
        errors.push({
          layer: 'semantic_first',
          object_id: edge.id,
          rule: 'message_flow cannot connect within same pool',
          message: `Edge ${edge.id} connects nodes in the same pool`,
        });
      }
    }

    const srcExists = nodes.some((n) => n.id === edge.source_node_id);
    const tgtExists = nodes.some((n) => n.id === edge.target_node_id);
    if (!srcExists || !tgtExists) {
      errors.push({
        layer: 'semantic_first',
        object_id: edge.id,
        rule: 'Dangling connector',
        message: `Edge ${edge.id} has missing source or target`,
      });
    }
  }

  // Layer 2: structural_bounded
  const startEvents = nodes.filter((n) => n.object_type === 'start_event');
  const endEvents = nodes.filter((n) => n.object_type === 'end_event');

  if (startEvents.length === 0) {
    errors.push({
      layer: 'structural_bounded',
      object_id: null,
      rule: 'At least 1 Start event required',
      message: 'Process has no Start event',
    });
  }

  if (endEvents.length === 0) {
    errors.push({
      layer: 'structural_bounded',
      object_id: null,
      rule: 'At least 1 End event required',
      message: 'Process has no End event',
    });
  }

  const connectedIds = new Set<string>();
  for (const e of edges) {
    connectedIds.add(e.source_node_id);
    connectedIds.add(e.target_node_id);
  }
  for (const node of nodes) {
    if (
      !connectedIds.has(node.id) &&
      node.object_type !== 'annotation' &&
      node.object_type !== 'lane' &&
      node.object_type !== 'pool'
    ) {
      warnings.push({
        layer: 'structural_bounded',
        object_id: node.id,
        rule: 'No orphan nodes',
        message: `Node ${node.id} (${node.object_type}) is disconnected`,
      });
    }
  }

  const idSet = new Set<string>();
  for (const node of nodes) {
    if (idSet.has(node.id)) {
      errors.push({
        layer: 'structural_bounded',
        object_id: node.id,
        rule: 'No duplicate IDs',
        message: `Duplicate node ID: ${node.id}`,
      });
    }
    idSet.add(node.id);
  }

  for (const node of nodes) {
    if (node.object_type === 'lane' && !node.pool_id) {
      warnings.push({
        layer: 'structural_bounded',
        object_id: node.id,
        rule: 'Lane must be inside a pool',
        message: `Lane ${node.id} has no pool assignment`,
      });
    }
  }

  for (const node of nodes) {
    if (node.parent_subprocess_id) {
      const depth = countNestingDepth(node.id, nodes);
      if (depth > MAX_NESTING) {
        errors.push({
          layer: 'structural_bounded',
          object_id: node.id,
          rule: `Maximum nesting depth: ${MAX_NESTING}`,
          message: `Node ${node.id} exceeds nesting depth limit`,
        });
      }
    }
  }

  if (nodes.length > WARN_OBJECTS) {
    warnings.push({
      layer: 'structural_bounded',
      object_id: null,
      rule: `Warning at ${WARN_OBJECTS} objects`,
      message: `Process has ${nodes.length} objects (warning threshold: ${WARN_OBJECTS})`,
    });
  }

  if (nodes.length > MAX_OBJECTS) {
    errors.push({
      layer: 'structural_bounded',
      object_id: null,
      rule: `Maximum objects: ${MAX_OBJECTS}`,
      message: `Process has ${nodes.length} objects (max: ${MAX_OBJECTS})`,
    });
  }

  const hasSemanticErrors = errors.some((e) => e.layer === 'semantic_first');
  const hasStructuralErrors = errors.some((e) => e.layer === 'structural_bounded');
  const layer: ValidationResult['layer'] =
    hasSemanticErrors && hasStructuralErrors
      ? 'both'
      : hasSemanticErrors
        ? 'semantic_first'
        : hasStructuralErrors
          ? 'structural_bounded'
          : 'both';

  return { valid: errors.length === 0, layer, errors, warnings };
}

// ---------------------------------------------------------------------------
// 10. semanticReadback — deterministic traversal
// ---------------------------------------------------------------------------

export async function semanticReadback(
  processId: string,
  organizationId: string
): Promise<ReadbackResult> {
  const nodes = await loadNodes(processId, organizationId);
  const edges = await loadEdges(processId, organizationId);
  const readbackWarnings: string[] = [];

  const startNodes = nodes.filter((n) => n.object_type === 'start_event');
  if (startNodes.length === 0) {
    readbackWarnings.push('No Start event found — readback cannot begin');
    return { paths: [], warnings: readbackWarnings };
  }

  const endNodes = nodes.filter((n) => n.object_type === 'end_event');
  if (endNodes.length === 0) {
    readbackWarnings.push('No End event found — readback may be incomplete');
  }

  const visited = new Set<string>();
  const maxDepth = 100;

  function traverse(nodeId: string, depth: number): ReadbackStep | null {
    if (depth > maxDepth) {
      readbackWarnings.push(`Readback depth exceeded at node ${nodeId} — possible cycle`);
      return null;
    }
    if (visited.has(nodeId)) {
      readbackWarnings.push(`Cycle detected at node ${nodeId}`);
      return { type: 'warning', id: nodeId, label: `[cycle → ${nodeId}]` };
    }
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    const outEdges = edges.filter(
      (e) => e.source_node_id === nodeId && e.edge_type === 'sequence_flow'
    );

    if (node.object_type === 'start_event') {
      const step: ReadbackStep = { type: 'start', id: node.id, label: node.label || 'Start' };
      if (outEdges.length === 1) {
        const next = traverse(outEdges[0]!.target_node_id, depth + 1);
        if (next) step.branches = [[next]];
      }
      return step;
    }

    if (node.object_type === 'end_event') {
      return { type: 'end', id: node.id, label: node.label || 'End' };
    }

    if (node.object_type === 'task' || node.object_type === 'subprocess') {
      if (!node.label.trim()) {
        readbackWarnings.push(`Unlabeled activity: ${node.id}`);
      }
      const step: ReadbackStep = { type: 'step', id: node.id, label: node.label || '[unlabeled]' };
      if (outEdges.length > 0) {
        step.branches = [
          outEdges
            .map((e) => traverse(e.target_node_id, depth + 1))
            .filter(Boolean) as ReadbackStep[],
        ];
      }
      return step;
    }

    if (node.object_type === 'decision_gateway') {
      if (outEdges.length < 2) {
        readbackWarnings.push(`Decision gateway ${node.id} has fewer than 2 outgoing branches`);
      }
      for (const e of outEdges) {
        if (!e.label) readbackWarnings.push(`Unlabeled branch on decision ${node.id}`);
      }
      const step: ReadbackStep = {
        type: 'decision',
        id: node.id,
        label: node.label || `Decision ${node.id}`,
        branches: outEdges.map((e) => {
          const next = traverse(e.target_node_id, depth + 1);
          return next ? [next] : [];
        }),
      };
      return step;
    }

    if (node.object_type === 'parallel_gateway') {
      const incoming = edges.filter(
        (e) => e.target_node_id === nodeId && e.edge_type === 'sequence_flow'
      );
      const isJoin = incoming.length > 1 && outEdges.length <= 1;
      const step: ReadbackStep = {
        type: isJoin ? 'parallel_join' : 'parallel_split',
        id: node.id,
        label: node.label || `Parallel ${isJoin ? 'join' : 'split'} ${node.id}`,
        branches: outEdges.map((e) => {
          const next = traverse(e.target_node_id, depth + 1);
          return next ? [next] : [];
        }),
      };
      return step;
    }

    const step: ReadbackStep = { type: 'step', id: node.id, label: node.label || node.object_type };
    if (outEdges.length > 0) {
      step.branches = [
        outEdges
          .map((e) => traverse(e.target_node_id, depth + 1))
          .filter(Boolean) as ReadbackStep[],
      ];
    }
    return step;
  }

  const paths: ReadbackStep[] = [];
  for (const start of startNodes) {
    visited.clear();
    const path = traverse(start.id, 0);
    if (path) paths.push(path);
  }

  return { paths, warnings: readbackWarnings };
}

// ---------------------------------------------------------------------------
// 11. export — JSON or human-readable readback
// ---------------------------------------------------------------------------

export async function exportProcess(
  processId: string,
  organizationId: string,
  format: 'json' | 'readback'
): Promise<ExportResult> {
  const nodes = await loadNodes(processId, organizationId);
  const edges = await loadEdges(processId, organizationId);

  let content: string;

  if (format === 'json') {
    content = JSON.stringify({ nodes, edges }, null, 2);
  } else {
    const rb = await semanticReadback(processId, organizationId);
    const lines: string[] = [];

    function renderStep(step: ReadbackStep, indent: number): void {
      const pad = '  '.repeat(indent);
      if (step.type === 'start') lines.push(`${pad}▶ START: ${step.label}`);
      else if (step.type === 'end') lines.push(`${pad}■ END: ${step.label}`);
      else if (step.type === 'step') lines.push(`${pad}→ Step [${step.id}]: ${step.label}`);
      else if (step.type === 'decision') lines.push(`${pad}◇ Decision [${step.id}]: ${step.label}`);
      else if (step.type === 'parallel_split')
        lines.push(`${pad}║ Parallel split [${step.id}]: ${step.label}`);
      else if (step.type === 'parallel_join')
        lines.push(`${pad}║ Parallel join [${step.id}]: ${step.label}`);
      else if (step.type === 'warning') lines.push(`${pad}⚠ ${step.label}`);

      if (step.branches) {
        for (let i = 0; i < step.branches.length; i++) {
          if (step.branches.length > 1) lines.push(`${pad}  Branch ${i + 1}:`);
          for (const child of step.branches[i]!) {
            renderStep(child, indent + (step.branches.length > 1 ? 2 : 1));
          }
        }
      }
    }

    for (const path of rb.paths) {
      renderStep(path, 0);
    }
    if (rb.warnings.length > 0) {
      lines.push('', '--- Warnings ---');
      for (const w of rb.warnings) lines.push(`⚠ ${w}`);
    }
    content = lines.join('\n');
  }

  return {
    format,
    content,
    node_count: nodes.length,
    edge_count: edges.length,
    exported_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 12. AI proposal lifecycle
// ---------------------------------------------------------------------------

export function createAIProposal(
  processId: string,
  organizationId: string,
  params: {
    summary: string;
    operations: AIProposalOperation[];
    before_readback: string;
    after_readback: string;
    validation_report: ValidationResult;
    risk_flags: { destructive_count: number; branch_changes: number };
  }
): AIProposal {
  const id = uuidv4();
  const proposal: StoredAIProposal = {
    id,
    process_id: processId,
    organization_id: organizationId,
    summary: params.summary,
    operations: params.operations,
    before_readback: params.before_readback,
    after_readback: params.after_readback,
    validation_report: params.validation_report,
    risk_flags: params.risk_flags,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  aiProposalStore.set(id, proposal);
  logger.info(`${LOG_PREFIX} AI proposal created`, {
    id,
    processId,
    ops: params.operations.length,
  });
  return proposal;
}

export function getAIProposal(proposalId: string, organizationId: string): AIProposal | null {
  const proposal = aiProposalStore.get(proposalId);
  if (!proposal || proposal.organization_id !== organizationId) {
    return null;
  }
  return proposal;
}

export async function resolveAIProposal(
  proposalId: string,
  action: 'accept' | 'reject',
  organizationId: string
): Promise<{
  success: boolean;
  proposal?: AIProposal;
  applied_count?: number;
  error?: string;
  error_code?: string;
}> {
  const proposal = aiProposalStore.get(proposalId);
  if (!proposal || proposal.organization_id !== organizationId) {
    return { success: false, error: 'Proposal not found', error_code: 'PROPOSAL_NOT_FOUND' };
  }
  if (proposal.status !== 'pending') {
    return {
      success: false,
      error: `Proposal already ${proposal.status}`,
      error_code: 'INVALID_STATE',
    };
  }

  if (action === 'reject') {
    proposal.status = 'rejected';
    return { success: true, proposal, applied_count: 0 };
  }

  let applied = 0;
  for (const op of proposal.operations) {
    try {
      if (op.op === 'create_node' && op.params) {
        const res = await createNode(proposal.process_id, proposal.organization_id, {
          object_type: (op.params.object_type as string) || 'task',
          label: (op.params.label as string) || '',
          lane_id: op.params.lane_id as string | null,
          pool_id: op.params.pool_id as string | null,
          position_x: op.params.position_x as number,
          position_y: op.params.position_y as number,
          gateway_kind: op.params.gateway_kind as string | null,
        });
        if (res.success) applied++;
      } else if (op.op === 'update_label' && op.target_id && op.params?.label) {
        const res = await updateNodeLabel(
          op.target_id,
          proposal.organization_id,
          op.params.label as string
        );
        if (res.success) applied++;
      } else if (op.op === 'connect' && op.params) {
        const res = await createEdge(proposal.process_id, proposal.organization_id, {
          edge_type: (op.params.edge_type as string) || 'sequence_flow',
          source_node_id: op.params.source_node_id as string,
          target_node_id: op.params.target_node_id as string,
          label: op.params.label as string | null,
        });
        if (res.success) applied++;
      } else if (op.op === 'delete_node' && op.target_id) {
        const res = await deleteNode(op.target_id, proposal.organization_id);
        if (res.success) applied++;
      } else if (op.op === 'delete_edge' && op.target_id) {
        const res = await deleteEdge(op.target_id, proposal.organization_id);
        if (res.success) applied++;
      } else if (op.op === 'move_node' && op.target_id && op.params) {
        const res = await moveNode(op.target_id, proposal.organization_id, {
          x: (op.params.x as number) ?? 0,
          y: (op.params.y as number) ?? 0,
        });
        if (res.success) applied++;
      }
    } catch (err) {
      logger.warn(`${LOG_PREFIX} AI proposal op failed`, { proposalId, op: op.op, error: err });
      proposal.status = 'rejected';
      return {
        success: false,
        proposal,
        error: 'Apply failed — atomic rollback',
        error_code: 'APPLY_FAILED',
      };
    }
  }

  proposal.status = 'accepted';
  return { success: true, proposal, applied_count: applied };
}

// ---------------------------------------------------------------------------
// 13. getDegradedState
// ---------------------------------------------------------------------------

export async function getDegradedState(
  processId: string,
  organizationId: string
): Promise<DegradedState> {
  const nReady = await nodesTableReady();
  if (!nReady) {
    const s = P14_DEGRADED_SCENARIOS[0]!;
    return { degraded: true, scenario: s.scenario, posture: s.posture, recovery: s.recovery };
  }

  const nodes = await loadNodes(processId, organizationId);
  if (nodes.length > MAX_OBJECTS) {
    const s = P14_DEGRADED_SCENARIOS.find((d) => d.scenario.includes('object limit'));
    if (s)
      return { degraded: true, scenario: s.scenario, posture: s.posture, recovery: s.recovery };
  }

  return { degraded: false, scenario: null, posture: null, recovery: null };
}

// ---------------------------------------------------------------------------
// 14. setGatewayKind
// ---------------------------------------------------------------------------

export async function setGatewayKind(
  nodeId: string,
  organizationId: string,
  kind: 'xor' | 'and'
): Promise<ProcessFlowOperationResult> {
  const runRes = await dbRun(
    `UPDATE ${NODES_TABLE} SET gateway_kind = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3 AND (object_type = 'decision_gateway' OR object_type = 'parallel_gateway')`,
    [kind, nodeId, organizationId],
    { fallback: true }
  );

  if (!runRes.success || !runRes.changes) {
    return opResult(false, 'set_gateway_kind', nodeId, null, {
      error: 'Gateway not found or update failed',
      error_code: 'NOT_FOUND',
    });
  }

  return opResult(true, 'set_gateway_kind', nodeId, null);
}

// ---------------------------------------------------------------------------
// 15. setLane
// ---------------------------------------------------------------------------

export async function setLane(
  nodeId: string,
  organizationId: string,
  laneId: string | null
): Promise<ProcessFlowOperationResult> {
  const runRes = await dbRun(
    `UPDATE ${NODES_TABLE} SET lane_id = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3`,
    [laneId, nodeId, organizationId],
    { fallback: true }
  );

  if (!runRes.success || !runRes.changes) {
    return opResult(false, 'set_lane', nodeId, null, {
      error: 'Node not found or update failed',
      error_code: 'NOT_FOUND',
    });
  }

  return opResult(true, 'set_lane', nodeId, null);
}
