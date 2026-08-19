import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import { type PgTransactionClient, withPgTransaction } from '../utils/queryHelpers.js';
import { createCandidateFromSource } from './initiative/initiativeCandidateService.js';

export class IdeaProcessFlowCandidateHandoffError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'IdeaProcessFlowCandidateHandoffError';
  }
}

type IdeaRow = { id: string; title: string; user_id: string };
type MapRow = {
  id: string;
  idea_id: string;
  organization_id: string;
  version: number;
  preferred_tool: string | null;
  nodes_json: string;
  edges_json: string;
  extensions_json: string | null;
};
type CandidateRow = { id: string; title: string; rationale: string; status: string };
type ReceiptRow = {
  receipt_id: string;
  map_id: string;
  map_version: number;
  projection_hash: string;
  projection_json: Record<string, unknown>;
  candidate_id: string;
  approved_at: string | Date;
};

type FaultStage = 'candidate-created' | 'receipt-created';
let faultInjector: ((stage: FaultStage) => void | Promise<void>) | null = null;
export function setIdeaProcessFlowHandoffFaultInjectorForTests(
  injector: ((stage: FaultStage) => void | Promise<void>) | null
): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Fault injection is test-only');
  faultInjector = injector;
}

function candidateDb(tx: PgTransactionClient) {
  return {
    queryOne: async <T>(sql: string, params: unknown[] = []): Promise<T | null> =>
      (await tx.query<T>(sql, params)).rows[0] ?? null,
    queryAll: async <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
      (await tx.query<T>(sql, params)).rows,
    queryRun: async (sql: string, params: unknown[] = []) => ({
      changes: (await tx.query(sql, params)).rowCount,
    }),
  };
}

function strictJson(value: string | null, field: string): any {
  try {
    return JSON.parse(String(value));
  } catch {
    throw new IdeaProcessFlowCandidateHandoffError(
      'INVALID_PROCESS_FLOW',
      409,
      `${field} is malformed`
    );
  }
}

function stable(value: any): any {
  if (Array.isArray(value)) {
    const values = value.map(stable);
    return values.every((item) => item && typeof item === 'object' && typeof item.id === 'string')
      ? values.sort((left, right) => left.id.localeCompare(right.id))
      : values;
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stable(value[key])])
  );
}

function processFlowIdentityProjection(projection: Record<string, unknown>): Record<string, unknown> {
  const identity = structuredClone(projection) as any;
  if (identity?.processFlow?.viewState && typeof identity.processFlow.viewState === 'object') {
    delete identity.processFlow.viewState.viewport;
    if (Object.keys(identity.processFlow.viewState).length === 0) {
      delete identity.processFlow.viewState;
    }
  }
  return stable(identity);
}

export function projectProcessFlowSnapshot(row: MapRow): {
  projection: Record<string, unknown>;
  hash: string;
  nodeCount: number;
  edgeCount: number;
} {
  const nodes = strictJson(row.nodes_json, 'nodes_json');
  const edges = strictJson(row.edges_json, 'edges_json');
  const extensions = strictJson(row.extensions_json, 'extensions_json');
  if (
    !Array.isArray(nodes) ||
    !nodes.every(
      (node) => node && typeof node === 'object' && typeof node.id === 'string' && node.id.trim()
    ) ||
    !Array.isArray(edges) ||
    !edges.every(
      (edge) =>
        edge &&
        typeof edge === 'object' &&
        typeof edge.id === 'string' &&
        edge.id.trim() &&
        typeof edge.source === 'string' &&
        edge.source.trim() &&
        typeof edge.target === 'string' &&
        edge.target.trim()
    ) ||
    !extensions ||
    typeof extensions !== 'object' ||
    Array.isArray(extensions) ||
    !extensions.processFlow ||
    typeof extensions.processFlow !== 'object' ||
    Array.isArray(extensions.processFlow)
  ) {
    throw new IdeaProcessFlowCandidateHandoffError(
      'INVALID_PROCESS_FLOW',
      409,
      'Process Flow graph is invalid'
    );
  }
  if (!nodes.length) {
    throw new IdeaProcessFlowCandidateHandoffError(
      'EMPTY_PROCESS_FLOW',
      409,
      'Process Flow has no nodes'
    );
  }
  const projection = stable({
    schemaVersion: 1,
    ideaTitle: '',
    nodes,
    edges,
    processFlow: extensions?.processFlow ?? {},
  });
  const hash = createHash('sha256')
    .update(JSON.stringify(processFlowIdentityProjection(projection)))
    .digest('hex');
  return { projection, hash, nodeCount: nodes.length, edgeCount: edges.length };
}

function normalizeIdeaTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, ' ');
  if (!title) {
    throw new IdeaProcessFlowCandidateHandoffError(
      'IDEA_TITLE_REQUIRED',
      409,
      'Idea title is required'
    );
  }
  return title;
}

async function lockedSource(tx: PgTransactionClient, organizationId: string, ideaId: string) {
  const idea = (
    await tx.query<IdeaRow>(
      `SELECT id,title,user_id FROM my_ideas WHERE id=? AND organization_id=? FOR UPDATE`,
      [ideaId, organizationId]
    )
  ).rows[0];
  if (!idea)
    throw new IdeaProcessFlowCandidateHandoffError('IDEA_NOT_FOUND', 404, 'Idea not found');
  const map = (
    await tx.query<MapRow>(
      `SELECT id,idea_id,organization_id,version,preferred_tool,nodes_json,edges_json,extensions_json
       FROM my_idea_maps
      WHERE idea_id=? AND organization_id=? AND is_canonical=TRUE
      FOR UPDATE`,
      [ideaId, organizationId]
    )
  ).rows[0];
  if (!map)
    throw new IdeaProcessFlowCandidateHandoffError(
      'PROCESS_FLOW_NOT_FOUND',
      404,
      'Canonical map not found'
    );
  if (String(map.preferred_tool || '') !== 'process_flow') {
    throw new IdeaProcessFlowCandidateHandoffError(
      'NOT_PROCESS_FLOW',
      409,
      'Canonical map is not a Process Flow'
    );
  }
  const projected = projectProcessFlowSnapshot(map);
  projected.projection.ideaTitle = normalizeIdeaTitle(idea.title);
  projected.hash = createHash('sha256')
    .update(JSON.stringify(processFlowIdentityProjection(projected.projection)))
    .digest('hex');
  return { idea, map, projected };
}

export async function previewIdeaProcessFlowCandidate(params: {
  organizationId: string;
  ideaId: string;
}) {
  return withPgTransaction(async (tx) => {
    const source = await lockedSource(tx, params.organizationId, params.ideaId);
    return {
      ideaId: source.idea.id,
      mapId: source.map.id,
      mapVersion: Number(source.map.version),
      projectionHash: source.projected.hash,
      nodeCount: source.projected.nodeCount,
      edgeCount: source.projected.edgeCount,
      title: `Transform process: ${String(source.projected.projection.ideaTitle)}`,
      projection: source.projected.projection,
    };
  });
}

export async function approveIdeaProcessFlowCandidate(params: {
  organizationId: string;
  ideaId: string;
  actorId: string;
  expectedMapVersion: number;
  expectedProjectionHash: string;
}) {
  return withPgTransaction(async (tx) => {
    const source = await lockedSource(tx, params.organizationId, params.ideaId);
    if (source.projected.hash !== params.expectedProjectionHash) {
      throw new IdeaProcessFlowCandidateHandoffError(
        'PROCESS_FLOW_CHANGED',
        409,
        'Process Flow changed; review the current preview'
      );
    }
    const existing = (
      await tx.query<ReceiptRow>(
        `SELECT receipt_id,map_id,map_version,projection_hash,projection_json,candidate_id,approved_at
         FROM idea_process_flow_candidate_handoffs
        WHERE organization_id=? AND map_id=? AND projection_hash=?`,
        [params.organizationId, source.map.id, source.projected.hash]
      )
    ).rows[0];
    if (existing) {
      const candidate = (
        await tx.query<CandidateRow>(
          `SELECT id,title,rationale,status FROM initiative_candidates WHERE id=? AND organization_id=?`,
          [existing.candidate_id, params.organizationId]
        )
      ).rows[0];
      if (!candidate)
        throw new IdeaProcessFlowCandidateHandoffError(
          'HANDOFF_INCONSISTENT',
          500,
          'Handoff candidate is missing'
        );
      return { created: false, receipt: existing, candidate };
    }
    const candidate = await createCandidateFromSource(candidateDb(tx), {
      organizationId: params.organizationId,
      sourceType: 'idea_process_flow_snapshot',
      sourceId: `${source.map.id}:${source.projected.hash}`,
      title: `Transform process: ${String(source.projected.projection.ideaTitle)}`,
      rationale: `Approved canonical Process Flow; ${source.projected.nodeCount} nodes, ${source.projected.edgeCount} edges; sha256 ${source.projected.hash}.`,
      createdBy: params.actorId,
    });
    await faultInjector?.('candidate-created');
    const receipt = (
      await tx.query<ReceiptRow>(
        `INSERT INTO idea_process_flow_candidate_handoffs
        (receipt_id,organization_id,idea_id,map_id,map_version,projection_hash,projection_json,candidate_id,approved_by)
       VALUES (?,?,?,?,?,?,?::jsonb,?,?)
       RETURNING receipt_id,map_id,map_version,projection_hash,projection_json,candidate_id,approved_at`,
        [
          uuidv4(),
          params.organizationId,
          source.idea.id,
          source.map.id,
          source.map.version,
          source.projected.hash,
          JSON.stringify(source.projected.projection),
          candidate.id,
          params.actorId,
        ]
      )
    ).rows[0];
    await faultInjector?.('receipt-created');
    return { created: true, receipt, candidate };
  });
}

export async function readIdeaProcessFlowCandidate(params: {
  organizationId: string;
  ideaId: string;
}) {
  return withPgTransaction(async (tx) => {
    const row = (
      await tx.query<ReceiptRow & CandidateRow>(
        `SELECT h.receipt_id,h.map_id,h.map_version,h.projection_hash,h.projection_json,h.candidate_id,h.approved_at,
              c.id,c.title,c.rationale,c.status
         FROM idea_process_flow_candidate_handoffs h
         JOIN initiative_candidates c ON c.id=h.candidate_id AND c.organization_id=h.organization_id
        WHERE h.organization_id=? AND h.idea_id=?
        ORDER BY h.map_version DESC,h.approved_at DESC LIMIT 1`,
        [params.organizationId, params.ideaId]
      )
    ).rows[0];
    if (!row)
      throw new IdeaProcessFlowCandidateHandoffError(
        'HANDOFF_NOT_FOUND',
        404,
        'Candidate handoff not found'
      );
    return row;
  });
}
