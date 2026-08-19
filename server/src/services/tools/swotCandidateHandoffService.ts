import { v4 as uuidv4 } from 'uuid';

import { type PgTransactionClient, withPgTransaction } from '../../utils/queryHelpers.js';
import { createCandidateFromSource } from '../initiative/initiativeCandidateService.js';

export class SwotCandidateHandoffError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SwotCandidateHandoffError';
  }
}

type HandoffRow = {
  id: string;
  candidate_id: string;
  recommendation_id: string;
  tool_output_id: string | null;
  tool_output_version: number | null;
  tool_output_content_hash: string | null;
  source_revision: number | null;
  created_at: string | Date;
};

type CandidateRow = {
  id: string;
  title: string;
  rationale: string;
  status: string;
};

type FaultStage = 'candidate-created' | 'receipt-created';
let testFaultInjector: ((stage: FaultStage) => void | Promise<void>) | null = null;

export function setSwotCandidateHandoffFaultInjectorForTests(
  injector: ((stage: FaultStage) => void | Promise<void>) | null
): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Fault injection is test-only');
  testFaultInjector = injector;
}

const APPROVED_SESSION_STATUSES = new Set(['APPROVED', 'FINALIZED']);

type FrozenConclusion = {
  id: string;
  k1Fact?: string;
  k2Meaning?: string;
  k3Actions?: string[];
  k4Effect?: string;
  tradeoff?: { chosen?: string; rejected?: string; why?: string };
};

type FrozenOutputRow = {
  id: string;
  version: number;
  content_hash: string;
  payload_json: unknown;
};

export type SwotCandidateReceipt = {
  lineageState: 'PINNED' | 'HISTORICAL_UNRESOLVED';
  receiptId: string;
  recommendationId: string;
  candidateId: string;
  toolOutputId: string | null;
  toolOutputVersion: number | null;
  toolOutputContentHash: string | null;
  sourceRevision: number | null;
  createdAt: string;
};

function parsePayload(value: unknown): { conclusions?: FrozenConclusion[]; sourceRevision?: number } {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as { conclusions?: FrozenConclusion[]; sourceRevision?: number };
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object'
    ? (value as { conclusions?: FrozenConclusion[]; sourceRevision?: number })
    : {};
}

function mapReceipt(row: HandoffRow): SwotCandidateReceipt {
  const pinned = Boolean(
    row.tool_output_id &&
      row.tool_output_version != null &&
      row.tool_output_content_hash &&
      row.source_revision != null
  );
  return {
    lineageState: pinned ? 'PINNED' : 'HISTORICAL_UNRESOLVED',
    receiptId: row.id,
    recommendationId: row.recommendation_id,
    candidateId: row.candidate_id,
    toolOutputId: row.tool_output_id,
    toolOutputVersion: row.tool_output_version == null ? null : Number(row.tool_output_version),
    toolOutputContentHash: row.tool_output_content_hash,
    sourceRevision: row.source_revision == null ? null : Number(row.source_revision),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function candidateDb(tx: PgTransactionClient) {
  return {
    queryOne: async <T>(sql: string, params: unknown[] = []): Promise<T | null> => {
      const result = await tx.query<T>(sql, params);
      return result.rows[0] ?? null;
    },
    queryAll: async <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
      (await tx.query<T>(sql, params)).rows,
    queryRun: async (sql: string, params: unknown[] = []) => {
      const result = await tx.query(sql, params);
      return { changes: result.rowCount };
    },
  };
}

export async function handoffSwotRecommendation(params: {
  organizationId: string;
  toolSessionId: string;
  recommendationId: string;
  actorId: string;
}): Promise<{ created: boolean; candidate: CandidateRow; receipt: SwotCandidateReceipt }> {
  const recommendationId = params.recommendationId.trim();
  if (!recommendationId || recommendationId.length > 160) {
    throw new SwotCandidateHandoffError(
      'INVALID_RECOMMENDATION_ID',
      400,
      'Invalid recommendation id'
    );
  }
  return withPgTransaction(async (tx) => {
    const session = await tx.query<{ id: string; tool_type: string; status: string | null }>(
      `SELECT id, tool_type, status FROM tool_sessions
       WHERE id = ? AND organization_id = ?
       FOR UPDATE`,
      [params.toolSessionId, params.organizationId]
    );
    const source = session.rows[0];
    if (!source) {
      throw new SwotCandidateHandoffError('SWOT_SESSION_NOT_FOUND', 404, 'SWOT session not found');
    }
    const normalizedType = String(source.tool_type || '')
      .trim()
      .toLowerCase();
    if (normalizedType !== 'dynamic-swot') {
      throw new SwotCandidateHandoffError(
        'NOT_SWOT_SESSION',
        409,
        'Tool session is not a SWOT session'
      );
    }

    const normalizedStatus = String(source.status || '')
      .trim()
      .toUpperCase();
    if (!APPROVED_SESSION_STATUSES.has(normalizedStatus)) {
      throw new SwotCandidateHandoffError(
        'SWOT_SESSION_NOT_APPROVED',
        409,
        'SWOT session must be approved before its recommendations can be handed off'
      );
    }

    const outputResult = await tx.query<FrozenOutputRow>(
      `SELECT id, version, content_hash, payload_json FROM tool_outputs
       WHERE organization_id = ? AND tool_session_id = ? AND tool_type = 'dynamic-swot'
         AND status = 'approved'
       ORDER BY version DESC LIMIT 1
       FOR SHARE`,
      [params.organizationId, params.toolSessionId]
    );
    const output = outputResult.rows[0];
    if (!output) {
      throw new SwotCandidateHandoffError(
        'APPROVED_SWOT_OUTPUT_REQUIRED',
        409,
        'An approved frozen SWOT output is required before candidate handoff'
      );
    }
    const payload = parsePayload(output.payload_json);
    const conclusion = (payload.conclusions || []).find((item) => item.id === recommendationId);
    if (!conclusion) {
      throw new SwotCandidateHandoffError(
        'RECOMMENDATION_NOT_IN_FROZEN_OUTPUT',
        409,
        'Selected recommendation does not belong to the approved frozen SWOT output'
      );
    }
    if (!Number.isInteger(payload.sourceRevision) || Number(payload.sourceRevision) < 1) {
      throw new SwotCandidateHandoffError(
        'FROZEN_OUTPUT_SOURCE_REVISION_MISSING',
        409,
        'Frozen SWOT output has no valid source revision'
      );
    }

    // Serialize the same org/session/recommendation command before the
    // read-first idempotency check. The durable UNIQUE index remains the
    // backstop, while this transaction lock makes concurrent double-clicks
    // converge without turning the losing transaction into a 23505/500.
    await tx.query(
      `SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))`,
      [params.organizationId, `${params.toolSessionId}:${recommendationId}`]
    );

    const existing = await tx.query<HandoffRow>(
      `SELECT id, candidate_id, recommendation_id, tool_output_id, tool_output_version,
              tool_output_content_hash, source_revision, created_at
         FROM swot_candidate_handoffs
       WHERE organization_id = ? AND tool_session_id = ? AND recommendation_id = ?`,
      [params.organizationId, params.toolSessionId, recommendationId]
    );
    if (existing.rows[0]) {
      const receipt = existing.rows[0];
      const candidate = await tx.query<CandidateRow>(
        `SELECT id, title, rationale, status FROM initiative_candidates
         WHERE id = ? AND organization_id = ?`,
        [receipt.candidate_id, params.organizationId]
      );
      if (!candidate.rows[0]) {
        throw new SwotCandidateHandoffError(
          'CANDIDATE_HANDOFF_INCONSISTENT',
          500,
          'Candidate handoff receipt points to a missing candidate'
        );
      }
      const mappedReceipt = mapReceipt(receipt);
      if (mappedReceipt.lineageState !== 'PINNED') {
        throw new SwotCandidateHandoffError(
          'CANDIDATE_HANDOFF_LINEAGE_MISSING',
          409,
          'Historical candidate receipt has no frozen output lineage; replay cannot infer it'
        );
      }
      if (
        mappedReceipt.toolOutputId !== output.id ||
        mappedReceipt.toolOutputVersion !== Number(output.version) ||
        mappedReceipt.toolOutputContentHash !== output.content_hash ||
        mappedReceipt.sourceRevision !== Number(payload.sourceRevision)
      ) {
        throw new SwotCandidateHandoffError(
          'CANDIDATE_HANDOFF_OUTPUT_MISMATCH',
          409,
          'Candidate receipt belongs to a different frozen output revision'
        );
      }
      return { created: false, candidate: candidate.rows[0], receipt: mappedReceipt };
    }

    const title =
      conclusion.k3Actions?.filter(Boolean).at(-1)?.trim() ||
      conclusion.tradeoff?.chosen?.trim() ||
      conclusion.k2Meaning?.trim() ||
      recommendationId;
    const rationale = [conclusion.k1Fact, conclusion.k2Meaning, conclusion.k4Effect]
      .filter(Boolean)
      .join('\n\n');
    const sourceId = `${output.id}:${recommendationId}`;
    const candidate = await createCandidateFromSource(candidateDb(tx), {
      organizationId: params.organizationId,
      sourceType: 'swot_recommendation',
      sourceId,
      title,
      rationale,
      createdBy: params.actorId,
    });
    await testFaultInjector?.('candidate-created');
    const receiptId = uuidv4();
    const receipt = await tx.query<HandoffRow>(
      `INSERT INTO swot_candidate_handoffs
         (id, organization_id, tool_session_id, recommendation_id, candidate_id, created_by,
          tool_output_id, tool_output_version, tool_output_content_hash, source_revision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, candidate_id, recommendation_id, tool_output_id, tool_output_version,
                 tool_output_content_hash, source_revision, created_at`,
      [
        receiptId,
        params.organizationId,
        params.toolSessionId,
        recommendationId,
        candidate.id,
        params.actorId,
        output.id,
        output.version,
        output.content_hash,
        payload.sourceRevision,
      ]
    );
    await testFaultInjector?.('receipt-created');
    return {
      created: true,
      candidate: {
        id: candidate.id,
        title: candidate.title,
        rationale: candidate.rationale,
        status: candidate.status,
      },
      receipt: mapReceipt(receipt.rows[0]),
    };
  });
}

export async function listSwotCandidateReceipts(params: {
  organizationId: string;
  toolSessionId: string;
}): Promise<SwotCandidateReceipt[]> {
  return withPgTransaction(async (tx) => {
    const session = await tx.query<{ id: string }>(
      `SELECT id FROM tool_sessions WHERE id = ? AND organization_id = ? AND tool_type = 'dynamic-swot'`,
      [params.toolSessionId, params.organizationId]
    );
    if (!session.rows[0]) {
      throw new SwotCandidateHandoffError('SWOT_SESSION_NOT_FOUND', 404, 'SWOT session not found');
    }
    const result = await tx.query<HandoffRow>(
      `SELECT id, candidate_id, recommendation_id, tool_output_id, tool_output_version,
              tool_output_content_hash, source_revision, created_at
         FROM swot_candidate_handoffs
        WHERE organization_id = ? AND tool_session_id = ?
        ORDER BY created_at, id`,
      [params.organizationId, params.toolSessionId]
    );
    return result.rows.map(mapReceipt);
  });
}
