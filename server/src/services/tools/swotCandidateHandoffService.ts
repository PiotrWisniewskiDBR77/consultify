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
  title: string;
  rationale: string;
  actorId: string;
}): Promise<{ created: boolean; candidate: CandidateRow; receiptId: string; createdAt: string }> {
  const recommendationId = params.recommendationId.trim();
  const title = params.title.trim();
  if (!/^rec-[1-9][0-9]*$/.test(recommendationId)) {
    throw new SwotCandidateHandoffError(
      'INVALID_RECOMMENDATION_ID',
      400,
      'Invalid recommendation id'
    );
  }
  if (!title) {
    throw new SwotCandidateHandoffError('TITLE_REQUIRED', 400, 'Candidate title is required');
  }

  return withPgTransaction(async (tx) => {
    const session = await tx.query<{ id: string; tool_type: string }>(
      `SELECT id, tool_type FROM tool_sessions
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

    const existing = await tx.query<HandoffRow>(
      `SELECT id, candidate_id, created_at FROM swot_candidate_handoffs
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
      return {
        created: false,
        candidate: candidate.rows[0],
        receiptId: receipt.id,
        createdAt: new Date(receipt.created_at).toISOString(),
      };
    }

    const sourceId = `${params.toolSessionId}:${recommendationId}`;
    const candidate = await createCandidateFromSource(candidateDb(tx), {
      organizationId: params.organizationId,
      sourceType: 'swot_recommendation',
      sourceId,
      title,
      rationale: params.rationale || '',
      createdBy: params.actorId,
    });
    await testFaultInjector?.('candidate-created');
    const receiptId = uuidv4();
    const receipt = await tx.query<HandoffRow>(
      `INSERT INTO swot_candidate_handoffs
         (id, organization_id, tool_session_id, recommendation_id, candidate_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING id, candidate_id, created_at`,
      [
        receiptId,
        params.organizationId,
        params.toolSessionId,
        recommendationId,
        candidate.id,
        params.actorId,
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
      receiptId,
      createdAt: new Date(receipt.rows[0].created_at).toISOString(),
    };
  });
}
