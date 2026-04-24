/**
 * P12 §2.3 — Mindmap runtime service
 *
 * CRUD on mindmap nodes, AI proposal lifecycle, export, validation, and degraded posture.
 */

import { v4 as uuidv4 } from 'uuid';

import {
  all as dbAll,
  get as dbGet,
  run as dbRun,
  tableExists,
  transaction as dbTransaction,
} from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import {
  exportToMarkdown,
  type MindmapExportFormat,
  type MindmapNodeKind,
  type MindmapNodeOperation,
  P12_ACCEPTANCE_CHECKLIST,
  P12_AI_COBUILDING_RULES,
  P12_CALM_LOOP_RULES,
  P12_DEGRADED_SCENARIOS,
  P12_EXPORT_FORMATS,
  P12_EXPORT_RULES,
  P12_NODE_KINDS,
  P12_NODE_OPERATIONS,
  P12_UNDO_REDO_RULES,
  resolveDeleteAnchor,
  wouldCreateCycle,
} from './mindmapCanon.js';

const LOG_PREFIX = '[P12-MindmapService]';
const NODES_TABLE = 'v8.v8_mindmap_nodes';
const MAX_NODES = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MindmapNode {
  id: string;
  mindmap_id: string;
  organization_id: string;
  parent_id: string | null;
  label: string;
  kind: MindmapNodeKind;
  position_index: number;
  collapsed: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface MindmapOperationResult {
  success: boolean;
  operation: MindmapNodeOperation;
  node_id: string | null;
  anchor_id: string | null;
  error?: string;
  error_code?: string;
}

export interface MindmapAIProposal {
  id: string;
  mindmap_id: string;
  summary: string;
  plan: string;
  operations: Array<{
    op: MindmapNodeOperation;
    target_id?: string;
    parent_id?: string;
    label?: string;
    kind?: MindmapNodeKind;
  }>;
  diff_summary: {
    added: number;
    renamed: number;
    moved: number;
    deleted: number;
    destructive: boolean;
  };
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface MindmapExportResult {
  format: MindmapExportFormat;
  content: string;
  node_count: number;
  exported_at: string;
}

export interface MindmapNodesResult {
  nodes: MindmapNode[];
  degraded: boolean;
}

export interface ResolveAIProposalResult {
  success: boolean;
  proposal?: MindmapAIProposal;
  error?: string;
  error_code?: string;
  applied_count?: number;
}

type StoredAIProposal = MindmapAIProposal & { organization_id: string };

interface MindmapNodeRow {
  id: string;
  mindmap_id: string;
  organization_id: string;
  parent_id: string | null;
  label: string;
  kind: string;
  position_index: number;
  collapsed: boolean | number | string | null;
  metadata: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}

// ---------------------------------------------------------------------------
// In-memory AI proposals (preview → accept/reject; no silent apply)
// ---------------------------------------------------------------------------

const aiProposalStore = new Map<string, StoredAIProposal>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMindmapNodeKind(value: unknown): value is MindmapNodeKind {
  return typeof value === 'string' && (P12_NODE_KINDS as readonly string[]).includes(value);
}

function normalizeKind(kind?: MindmapNodeKind | string): MindmapNodeKind {
  if (isMindmapNodeKind(kind)) return kind;
  return 'topic';
}

function toBoolCollapsed(value: MindmapNodeRow['collapsed']): boolean {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  return false;
}

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

function mapRow(row: MindmapNodeRow): MindmapNode {
  return {
    id: row.id,
    mindmap_id: row.mindmap_id,
    organization_id: row.organization_id,
    parent_id: row.parent_id,
    label: row.label,
    kind: normalizeKind(row.kind),
    position_index: Number(row.position_index) || 0,
    collapsed: toBoolCollapsed(row.collapsed),
    metadata: parseMetadata(row.metadata),
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

function parentMapFromNodes(nodes: MindmapNode[]): Map<string, string | null> {
  const m = new Map<string, string | null>();
  for (const n of nodes) m.set(n.id, n.parent_id);
  return m;
}

function getRootId(nodes: MindmapNode[]): string | null {
  const roots = nodes.filter((n) => n.parent_id === null);
  return roots.length > 0 ? roots[0]!.id : null;
}

async function mindmapTableReady(): Promise<boolean> {
  try {
    return await tableExists('v8_mindmap_nodes');
  } catch {
    return false;
  }
}

async function loadNodes(mindmapId: string, organizationId: string): Promise<MindmapNode[]> {
  const rows = await dbAll<MindmapNodeRow>(
    `SELECT id, mindmap_id, organization_id, parent_id, label, kind, position_index, collapsed, metadata, created_at, updated_at
     FROM ${NODES_TABLE}
     WHERE mindmap_id = $1 AND organization_id = $2
     ORDER BY parent_id NULLS FIRST, position_index ASC, id ASC`,
    [mindmapId, organizationId],
    { fallback: true }
  );
  return rows.map(mapRow);
}

async function nextPositionIndex(
  mindmapId: string,
  organizationId: string,
  parentId: string | null
): Promise<number> {
  const row = await dbGet<{ mx: number | null }>(
    `SELECT MAX(position_index) AS mx FROM ${NODES_TABLE}
     WHERE mindmap_id = $1 AND organization_id = $2 AND parent_id IS NOT DISTINCT FROM $3`,
    [mindmapId, organizationId, parentId],
    { fallback: true }
  );
  const mx = row?.mx != null ? Number(row.mx) : -1;
  return mx + 1;
}

function opResult(
  success: boolean,
  operation: MindmapNodeOperation,
  node_id: string | null,
  anchor_id: string | null,
  extra?: { error?: string; error_code?: string }
): MindmapOperationResult {
  return {
    success,
    operation,
    node_id,
    anchor_id,
    error: extra?.error,
    error_code: extra?.error_code,
  };
}

// ---------------------------------------------------------------------------
// 1. getNodes
// ---------------------------------------------------------------------------

export async function getNodes(
  mindmapId: string,
  organizationId: string
): Promise<MindmapNodesResult> {
  const exists = await mindmapTableReady();
  if (!exists) {
    logger.warn(`${LOG_PREFIX} v8_mindmap_nodes missing; returning empty graph`, {
      mindmapId,
      organizationId,
    });
    return { nodes: [], degraded: true };
  }
  const nodes = await loadNodes(mindmapId, organizationId);
  return { nodes, degraded: false };
}

// ---------------------------------------------------------------------------
// 2. createNode
// ---------------------------------------------------------------------------

export async function createNode(
  mindmapId: string,
  organizationId: string,
  params: { parent_id?: string | null; label: string; kind?: MindmapNodeKind }
): Promise<MindmapOperationResult> {
  const label = (params.label || '').trim();
  if (!label) {
    return opResult(false, 'add_child', null, null, {
      error: 'Label is required',
      error_code: 'INVALID_LABEL',
    });
  }

  const tableOk = await mindmapTableReady();
  if (!tableOk) {
    return opResult(false, 'add_child', null, null, {
      error: 'Mindmap storage is not available',
      error_code: 'TABLE_MISSING',
    });
  }

  const existing = await loadNodes(mindmapId, organizationId);
  if (existing.length >= MAX_NODES) {
    return opResult(false, 'add_child', null, null, {
      error: `Mindmap exceeds maximum of ${MAX_NODES} nodes`,
      error_code: 'SIZE_LIMIT',
    });
  }

  const kind = normalizeKind(params.kind);
  const parentId = params.parent_id === undefined ? null : params.parent_id;
  if (parentId === null) {
    if (existing.length > 0) {
      return opResult(false, 'create_root', null, null, {
        error: 'Root exists; specify parent_id for new nodes',
        error_code: 'ROOT_EXISTS',
      });
    }
  } else {
    const parent = existing.find((n) => n.id === parentId);
    if (!parent) {
      return opResult(false, 'add_child', null, null, {
        error: 'Parent node not found',
        error_code: 'PARENT_NOT_FOUND',
      });
    }
  }

  const id = uuidv4();
  const pos =
    parentId === null && existing.length === 0
      ? 0
      : await nextPositionIndex(mindmapId, organizationId, parentId);

  const runRes = await dbRun(
    `INSERT INTO ${NODES_TABLE}
      (id, mindmap_id, organization_id, parent_id, label, kind, position_index, collapsed, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, NOW(), NOW())`,
    [id, mindmapId, organizationId, parentId, label, kind, pos, false],
    { fallback: true }
  );

  if (!runRes.success) {
    logger.warn(`${LOG_PREFIX} createNode failed`, {
      mindmapId,
      organizationId,
      error: runRes.error,
    });
    return opResult(false, parentId === null ? 'create_root' : 'add_child', null, null, {
      error: runRes.error || 'Insert failed',
      error_code: 'DB_ERROR',
    });
  }

  const operation: MindmapNodeOperation = parentId === null ? 'create_root' : 'add_child';
  return opResult(true, operation, id, id);
}

// ---------------------------------------------------------------------------
// 3. renameNode
// ---------------------------------------------------------------------------

export async function renameNode(
  nodeId: string,
  organizationId: string,
  newLabel: string
): Promise<MindmapOperationResult> {
  const label = (newLabel || '').trim();
  if (!label) {
    return opResult(false, 'rename', nodeId, null, {
      error: 'Label is required',
      error_code: 'INVALID_LABEL',
    });
  }

  const node = await dbGet<{ mindmap_id: string }>(
    `SELECT mindmap_id FROM ${NODES_TABLE} WHERE id = $1 AND organization_id = $2`,
    [nodeId, organizationId],
    { fallback: true }
  );
  if (!node) {
    return opResult(false, 'rename', null, null, {
      error: 'Node not found',
      error_code: 'NOT_FOUND',
    });
  }

  const runRes = await dbRun(
    `UPDATE ${NODES_TABLE} SET label = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3`,
    [label, nodeId, organizationId],
    { fallback: true }
  );

  if (!runRes.success || !runRes.changes) {
    return opResult(false, 'rename', nodeId, null, {
      error: runRes.error || 'Rename failed',
      error_code: 'DB_ERROR',
    });
  }

  return opResult(true, 'rename', nodeId, nodeId);
}

// ---------------------------------------------------------------------------
// 4. moveNode
// ---------------------------------------------------------------------------

export async function moveNode(
  nodeId: string,
  organizationId: string,
  newParentId: string | null
): Promise<MindmapOperationResult> {
  const tableOk = await mindmapTableReady();
  if (!tableOk) {
    return opResult(false, 'move', nodeId, null, {
      error: 'Mindmap storage is not available',
      error_code: 'TABLE_MISSING',
    });
  }

  const self = await dbGet<MindmapNodeRow>(
    `SELECT * FROM ${NODES_TABLE} WHERE id = $1 AND organization_id = $2`,
    [nodeId, organizationId],
    { fallback: true }
  );
  if (!self) {
    return opResult(false, 'move', null, null, {
      error: 'Node not found',
      error_code: 'NOT_FOUND',
    });
  }

  const mindmapId = self.mindmap_id;
  const nodes = await loadNodes(mindmapId, organizationId);
  const rootId = getRootId(nodes);
  const resolvedParentId = newParentId ?? rootId;
  if (!resolvedParentId) {
    return opResult(false, 'move', nodeId, nodeId, {
      error: 'No root exists; cannot resolve null parent',
      error_code: 'PARENT_NOT_FOUND',
    });
  }

  const parentRow = await dbGet<MindmapNodeRow>(
    `SELECT * FROM ${NODES_TABLE} WHERE id = $1 AND organization_id = $2 AND mindmap_id = $3`,
    [resolvedParentId, organizationId, mindmapId],
    { fallback: true }
  );
  if (!parentRow) {
    return opResult(false, 'move', nodeId, null, {
      error: 'New parent not found',
      error_code: 'PARENT_NOT_FOUND',
    });
  }

  const parentMap = parentMapFromNodes(nodes);
  if (wouldCreateCycle(nodeId, resolvedParentId, parentMap)) {
    return opResult(false, 'move', nodeId, nodeId, {
      error: 'Reparent would create a cycle',
      error_code: 'CYCLE_DETECTED',
    });
  }

  const runRes = await dbRun(
    `UPDATE ${NODES_TABLE} SET parent_id = $1, updated_at = NOW()
     WHERE id = $2 AND organization_id = $3 AND mindmap_id = $4`,
    [resolvedParentId, nodeId, organizationId, mindmapId],
    { fallback: true }
  );

  if (!runRes.success || !runRes.changes) {
    return opResult(false, 'move', nodeId, nodeId, {
      error: runRes.error || 'Move failed',
      error_code: 'DB_ERROR',
    });
  }

  return opResult(true, 'move', nodeId, nodeId);
}

// ---------------------------------------------------------------------------
// 5. deleteNode
// ---------------------------------------------------------------------------

export async function deleteNode(
  nodeId: string,
  organizationId: string
): Promise<MindmapOperationResult> {
  const row = await dbGet<MindmapNodeRow>(
    `SELECT * FROM ${NODES_TABLE} WHERE id = $1 AND organization_id = $2`,
    [nodeId, organizationId],
    { fallback: true }
  );
  if (!row) {
    return opResult(false, 'delete', null, null, {
      error: 'Node not found',
      error_code: 'NOT_FOUND',
    });
  }

  const mindmapId = row.mindmap_id;
  const nodesBefore = await loadNodes(mindmapId, organizationId);
  const deleted = nodesBefore.find((n) => n.id === nodeId);
  if (!deleted) {
    return opResult(false, 'delete', null, null, {
      error: 'Node not found',
      error_code: 'NOT_FOUND',
    });
  }

  const parentId = deleted.parent_id;
  const siblingIds = nodesBefore
    .filter((n) => n.parent_id === parentId && n.id !== nodeId)
    .map((n) => n.id);
  const rootId = getRootId(nodesBefore);

  const anchor = resolveDeleteAnchor(nodeId, parentId, siblingIds, rootId);

  const runRes = await dbRun(
    `WITH RECURSIVE sub AS (
       SELECT id FROM ${NODES_TABLE} WHERE id = $1 AND organization_id = $2 AND mindmap_id = $3
       UNION ALL
       SELECT n.id FROM ${NODES_TABLE} n INNER JOIN sub ON n.parent_id = sub.id
     )
     DELETE FROM ${NODES_TABLE} WHERE id IN (SELECT id FROM sub)`,
    [nodeId, organizationId, mindmapId],
    { fallback: true }
  );

  if (!runRes.success) {
    return opResult(false, 'delete', nodeId, anchor, {
      error: runRes.error || 'Delete failed',
      error_code: 'DB_ERROR',
    });
  }

  return opResult(true, 'delete', nodeId, anchor);
}

// ---------------------------------------------------------------------------
// 6. toggleCollapse
// ---------------------------------------------------------------------------

export async function toggleCollapse(
  nodeId: string,
  organizationId: string
): Promise<MindmapOperationResult> {
  const row = await dbGet<MindmapNodeRow>(
    `SELECT collapsed, mindmap_id FROM ${NODES_TABLE} WHERE id = $1 AND organization_id = $2`,
    [nodeId, organizationId],
    { fallback: true }
  );
  if (!row) {
    return opResult(false, 'collapse', null, null, {
      error: 'Node not found',
      error_code: 'NOT_FOUND',
    });
  }

  const wasCollapsed = toBoolCollapsed(row.collapsed);
  const next = !wasCollapsed;
  const runRes = await dbRun(
    `UPDATE ${NODES_TABLE} SET collapsed = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3`,
    [next, nodeId, organizationId],
    { fallback: true }
  );

  if (!runRes.success || !runRes.changes) {
    return opResult(false, wasCollapsed ? 'expand' : 'collapse', nodeId, nodeId, {
      error: runRes.error || 'Update failed',
      error_code: 'DB_ERROR',
    });
  }

  const operation: MindmapNodeOperation = next ? 'collapse' : 'expand';
  return opResult(true, operation, nodeId, nodeId);
}

// ---------------------------------------------------------------------------
// 7. exportMindmap
// ---------------------------------------------------------------------------

export async function exportMindmap(
  mindmapId: string,
  organizationId: string,
  format: MindmapExportFormat
): Promise<MindmapExportResult> {
  const { nodes, degraded } = await getNodes(mindmapId, organizationId);
  const exported_at = new Date().toISOString();

  if (degraded && nodes.length === 0) {
    logger.warn(`${LOG_PREFIX} exportMindmap degraded (no table or empty)`, { mindmapId });
  }

  if (format === 'markdown') {
    const content = exportToMarkdown(
      nodes.map((n) => ({ id: n.id, label: n.label, parentId: n.parent_id }))
    );
    return { format, content, node_count: nodes.length, exported_at };
  }

  if (format === 'json') {
    const payload = nodes.map((n) => ({
      id: n.id,
      mindmap_id: n.mindmap_id,
      organization_id: n.organization_id,
      parent_id: n.parent_id,
      label: n.label,
      kind: n.kind,
      position_index: n.position_index,
      collapsed: n.collapsed,
      metadata: n.metadata,
      created_at: n.created_at,
      updated_at: n.updated_at,
    }));
    const content = JSON.stringify(payload, null, 2);
    return { format, content, node_count: nodes.length, exported_at };
  }

  const _exhaustive: never = format;
  return _exhaustive;
}

// ---------------------------------------------------------------------------
// 8–9. AI proposals
// ---------------------------------------------------------------------------

export async function createAIProposal(
  mindmapId: string,
  organizationId: string,
  proposal: Omit<MindmapAIProposal, 'id' | 'status' | 'created_at'>
): Promise<MindmapAIProposal> {
  if (proposal.mindmap_id !== mindmapId) {
    logger.warn(`${LOG_PREFIX} createAIProposal mindmap_id mismatch; coercing to arg`, {
      mindmapId,
      proposalMindmap: proposal.mindmap_id,
    });
  }

  const id = uuidv4();
  const created_at = new Date().toISOString();
  const full: MindmapAIProposal = {
    ...proposal,
    mindmap_id: mindmapId,
    id,
    status: 'pending',
    created_at,
  };

  const stored: StoredAIProposal = { ...full, organization_id: organizationId };
  aiProposalStore.set(id, stored);
  logger.info(`${LOG_PREFIX} AI proposal created`, { id, mindmapId, organizationId });
  return full;
}

async function buildProposalTransactionStatements(
  proposal: StoredAIProposal
): Promise<{ sql: string; params: unknown[] }[]> {
  const { mindmap_id: mindmapId, organization_id: organizationId, operations } = proposal;
  const stmts: { sql: string; params: unknown[] }[] = [];

  for (const step of operations) {
    switch (step.op) {
      case 'create_root': {
        const label = (step.label || '').trim() || 'Root';
        const kind = normalizeKind(step.kind);
        const id = uuidv4();
        stmts.push({
          sql: `INSERT INTO ${NODES_TABLE}
            (id, mindmap_id, organization_id, parent_id, label, kind, position_index, collapsed, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, NULL, $4, $5, 0, false, NULL::jsonb, NOW(), NOW())`,
          params: [id, mindmapId, organizationId, label, kind],
        });
        break;
      }
      case 'add_child': {
        const label = (step.label || '').trim() || 'Node';
        const kind = normalizeKind(step.kind);
        const parentId = step.parent_id ?? null;
        if (!parentId) {
          throw new Error('add_child requires parent_id');
        }
        const id = uuidv4();
        stmts.push({
          sql: `INSERT INTO ${NODES_TABLE}
            (id, mindmap_id, organization_id, parent_id, label, kind, position_index, collapsed, metadata, created_at, updated_at)
           VALUES (
             $1, $2, $3, $4, $5, $6,
             (SELECT COALESCE(MAX(position_index), -1) + 1 FROM ${NODES_TABLE} mn
              WHERE mn.mindmap_id = $2 AND mn.organization_id = $3 AND mn.parent_id = $4),
             false, NULL::jsonb, NOW(), NOW()
           )`,
          params: [id, mindmapId, organizationId, parentId, label, kind],
        });
        break;
      }
      case 'add_sibling': {
        const targetId = step.target_id;
        if (!targetId) throw new Error('add_sibling requires target_id');
        const row = await dbGet<{ parent_id: string | null; mindmap_id: string }>(
          `SELECT parent_id, mindmap_id FROM ${NODES_TABLE} WHERE id = $1 AND organization_id = $2`,
          [targetId, organizationId],
          { fallback: true }
        );
        if (!row || row.mindmap_id !== mindmapId) {
          throw new Error('add_sibling target not found');
        }
        const label = (step.label || '').trim() || 'Node';
        const kind = normalizeKind(step.kind);
        const id = uuidv4();
        const parentId = row.parent_id;
        stmts.push({
          sql: `INSERT INTO ${NODES_TABLE}
            (id, mindmap_id, organization_id, parent_id, label, kind, position_index, collapsed, metadata, created_at, updated_at)
           VALUES (
             $1, $2, $3, $4, $5, $6,
             (SELECT COALESCE(MAX(position_index), -1) + 1 FROM ${NODES_TABLE} mn
              WHERE mn.mindmap_id = $2 AND mn.organization_id = $3 AND mn.parent_id IS NOT DISTINCT FROM $4),
             false, NULL::jsonb, NOW(), NOW()
           )`,
          params: [id, mindmapId, organizationId, parentId, label, kind],
        });
        break;
      }
      case 'rename': {
        const targetId = step.target_id;
        if (!targetId) throw new Error('rename requires target_id');
        const label = (step.label || '').trim();
        if (!label) throw new Error('rename requires label');
        stmts.push({
          sql: `UPDATE ${NODES_TABLE} SET label = $1, updated_at = NOW()
                WHERE id = $2 AND organization_id = $3 AND mindmap_id = $4`,
          params: [label, targetId, organizationId, mindmapId],
        });
        break;
      }
      case 'move': {
        const targetId = step.target_id;
        if (!targetId) throw new Error('move requires target_id');
        const nodes = await loadNodes(mindmapId, organizationId);
        const resolvedParent =
          step.parent_id !== undefined && step.parent_id !== null
            ? step.parent_id
            : getRootId(nodes);
        if (!resolvedParent) throw new Error('move requires parent_id or an existing root');
        const parentMap = parentMapFromNodes(nodes);
        if (wouldCreateCycle(targetId, resolvedParent, parentMap)) {
          throw new Error('move would create a cycle');
        }
        stmts.push({
          sql: `UPDATE ${NODES_TABLE} SET parent_id = $1, updated_at = NOW()
                WHERE id = $2 AND organization_id = $3 AND mindmap_id = $4`,
          params: [resolvedParent, targetId, organizationId, mindmapId],
        });
        break;
      }
      case 'delete': {
        const targetId = step.target_id;
        if (!targetId) throw new Error('delete requires target_id');
        stmts.push({
          sql: `WITH RECURSIVE sub AS (
             SELECT id FROM ${NODES_TABLE} WHERE id = $1 AND organization_id = $2 AND mindmap_id = $3
             UNION ALL
             SELECT n.id FROM ${NODES_TABLE} n INNER JOIN sub ON n.parent_id = sub.id
           )
           DELETE FROM ${NODES_TABLE} WHERE id IN (SELECT id FROM sub)`,
          params: [targetId, organizationId, mindmapId],
        });
        break;
      }
      case 'collapse': {
        const targetId = step.target_id;
        if (!targetId) throw new Error('collapse requires target_id');
        stmts.push({
          sql: `UPDATE ${NODES_TABLE} SET collapsed = true, updated_at = NOW()
                WHERE id = $1 AND organization_id = $2 AND mindmap_id = $3`,
          params: [targetId, organizationId, mindmapId],
        });
        break;
      }
      case 'expand': {
        const targetId = step.target_id;
        if (!targetId) throw new Error('expand requires target_id');
        stmts.push({
          sql: `UPDATE ${NODES_TABLE} SET collapsed = false, updated_at = NOW()
                WHERE id = $1 AND organization_id = $2 AND mindmap_id = $3`,
          params: [targetId, organizationId, mindmapId],
        });
        break;
      }
      default:
        throw new Error(`Unsupported proposal operation: ${String(step.op)}`);
    }
  }

  return stmts;
}

export async function resolveAIProposal(
  proposalId: string,
  action: 'accept' | 'reject'
): Promise<ResolveAIProposalResult> {
  const stored = aiProposalStore.get(proposalId);
  if (!stored) {
    return { success: false, error: 'Proposal not found', error_code: 'PROPOSAL_NOT_FOUND' };
  }
  if (stored.status !== 'pending') {
    return { success: false, error: 'Proposal already resolved', error_code: 'INVALID_STATE' };
  }

  if (action === 'reject') {
    const updated: MindmapAIProposal = { ...stored, status: 'rejected' };
    aiProposalStore.set(proposalId, { ...stored, status: 'rejected' });
    return { success: true, proposal: updated, applied_count: 0 };
  }

  const tableOk = await mindmapTableReady();
  if (!tableOk) {
    return {
      success: false,
      error: 'Mindmap storage is not available',
      error_code: 'TABLE_MISSING',
    };
  }

  const { nodes } = await getNodes(stored.mindmap_id, stored.organization_id);
  if (
    nodes.length +
      stored.operations.filter(
        (o) => o.op === 'create_root' || o.op === 'add_child' || o.op === 'add_sibling'
      ).length >
    MAX_NODES
  ) {
    return {
      success: false,
      error: `Applying proposal would exceed ${MAX_NODES} nodes`,
      error_code: 'SIZE_LIMIT',
    };
  }

  let statements: { sql: string; params: unknown[] }[];
  try {
    statements = await buildProposalTransactionStatements(stored);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn(`${LOG_PREFIX} proposal build failed`, { proposalId, msg });
    return { success: false, error: msg, error_code: 'VALIDATION_FAILED' };
  }

  const trx = await dbTransaction(statements);
  if (!trx.success) {
    logger.warn(`${LOG_PREFIX} proposal transaction failed`, {
      proposalId,
      error: trx.error,
    });
    return {
      success: false,
      error: trx.error || 'Transaction failed',
      error_code: 'DB_ERROR',
    };
  }

  const failed = trx.results.find((r) => !r.success);
  if (failed) {
    return {
      success: false,
      error: failed.error || 'Statement failed',
      error_code: 'DB_ERROR',
    };
  }

  const accepted: MindmapAIProposal = { ...stored, status: 'accepted' };
  aiProposalStore.set(proposalId, { ...stored, status: 'accepted' });
  logger.info(`${LOG_PREFIX} AI proposal accepted`, {
    proposalId,
    ops: statements.length,
  });

  return {
    success: true,
    proposal: accepted,
    applied_count: statements.length,
  };
}

// ---------------------------------------------------------------------------
// 10. validateOperation
// ---------------------------------------------------------------------------

export async function validateOperation(
  operation: MindmapNodeOperation,
  nodeId: string,
  mindmapId: string,
  organizationId: string,
  params?: Record<string, unknown>
): Promise<{ valid: boolean; reason?: string }> {
  const tableOk = await mindmapTableReady();
  if (!tableOk) {
    return { valid: false, reason: 'Mindmap storage is not available' };
  }

  const nodes = await loadNodes(mindmapId, organizationId);
  const parentMap = parentMapFromNodes(nodes);

  switch (operation) {
    case 'create_root': {
      if (nodes.length > 0) {
        return { valid: false, reason: P12_CALM_LOOP_RULES.rootConstraint };
      }
      return { valid: true };
    }
    case 'add_child': {
      const pid = params?.parent_id != null ? String(params.parent_id) : null;
      if (!pid) return { valid: false, reason: 'add_child requires parent_id' };
      const parent = nodes.find((n) => n.id === pid);
      if (!parent) return { valid: false, reason: 'Parent node not found' };
      if (nodes.length >= MAX_NODES) {
        return { valid: false, reason: 'Graph exceeds size limit (>500 nodes)' };
      }
      return { valid: true };
    }
    case 'add_sibling': {
      if (!nodeId) return { valid: false, reason: 'add_sibling requires target node id' };
      const target = nodes.find((n) => n.id === nodeId);
      if (!target) return { valid: false, reason: 'Target node not found' };
      if (nodes.length >= MAX_NODES) {
        return { valid: false, reason: 'Graph exceeds size limit (>500 nodes)' };
      }
      return { valid: true };
    }
    case 'rename':
    case 'collapse':
    case 'expand': {
      if (!nodeId) return { valid: false, reason: 'Node id required' };
      const n = nodes.find((x) => x.id === nodeId);
      if (!n) return { valid: false, reason: 'Node not found' };
      return { valid: true };
    }
    case 'move': {
      if (!nodeId) return { valid: false, reason: 'Node id required' };
      const self = nodes.find((n) => n.id === nodeId);
      if (!self) return { valid: false, reason: 'Node not found' };
      const rawNp = params?.newParentId;
      const np = rawNp === undefined || rawNp === null ? getRootId(nodes) : String(rawNp);
      if (!np) return { valid: false, reason: 'move requires newParentId or an existing root' };
      const parent = nodes.find((n) => n.id === np);
      if (!parent) return { valid: false, reason: 'New parent not found' };
      if (wouldCreateCycle(nodeId, np, parentMap)) {
        return { valid: false, reason: 'Reparent would create a cycle' };
      }
      return { valid: true };
    }
    case 'delete': {
      if (!nodeId) return { valid: false, reason: 'Node id required' };
      const n = nodes.find((x) => x.id === nodeId);
      if (!n) return { valid: false, reason: 'Node not found' };
      return { valid: true };
    }
  }
}

// ---------------------------------------------------------------------------
// 11. getDegradedState
// ---------------------------------------------------------------------------

export async function getDegradedState(
  mindmapId: string,
  organizationId: string
): Promise<{ degraded: boolean; scenarios: string[] }> {
  const scenarios: string[] = [];

  const exists = await mindmapTableReady();
  if (!exists) {
    scenarios.push(P12_DEGRADED_SCENARIOS[0]!.scenario);
    return { degraded: true, scenarios };
  }

  const { nodes } = await getNodes(mindmapId, organizationId);
  if (nodes.length > MAX_NODES) {
    scenarios.push(P12_DEGRADED_SCENARIOS[7]!.scenario);
  }

  return { degraded: scenarios.length > 0, scenarios };
}

// ---------------------------------------------------------------------------
// 12. Health (runtime posture for a mindmap)
// ---------------------------------------------------------------------------

export async function getHealth(
  mindmapId: string,
  organizationId: string
): Promise<{
  degraded: boolean;
  scenarios: string[];
  node_count: number;
  table_available: boolean;
}> {
  const tableOk = await mindmapTableReady();
  const { nodes, degraded: loadDegraded } = await getNodes(mindmapId, organizationId);
  const { degraded: stateDegraded, scenarios } = await getDegradedState(mindmapId, organizationId);
  return {
    degraded: loadDegraded || stateDegraded,
    scenarios,
    node_count: nodes.length,
    table_available: tableOk,
  };
}

// ---------------------------------------------------------------------------
// 13. getContract
// ---------------------------------------------------------------------------

export function getContract(): {
  nodeOperations: typeof P12_NODE_OPERATIONS;
  nodeKinds: typeof P12_NODE_KINDS;
  calmLoopRules: typeof P12_CALM_LOOP_RULES;
  exportFormats: typeof P12_EXPORT_FORMATS;
  exportRules: typeof P12_EXPORT_RULES;
  aiCoBuildingRules: typeof P12_AI_COBUILDING_RULES;
  undoRedoRules: typeof P12_UNDO_REDO_RULES;
  degradedScenarios: typeof P12_DEGRADED_SCENARIOS;
  acceptanceChecklist: typeof P12_ACCEPTANCE_CHECKLIST;
} {
  return {
    nodeOperations: P12_NODE_OPERATIONS,
    nodeKinds: P12_NODE_KINDS,
    calmLoopRules: P12_CALM_LOOP_RULES,
    exportFormats: P12_EXPORT_FORMATS,
    exportRules: P12_EXPORT_RULES,
    aiCoBuildingRules: P12_AI_COBUILDING_RULES,
    undoRedoRules: P12_UNDO_REDO_RULES,
    degradedScenarios: P12_DEGRADED_SCENARIOS,
    acceptanceChecklist: P12_ACCEPTANCE_CHECKLIST,
  };
}
