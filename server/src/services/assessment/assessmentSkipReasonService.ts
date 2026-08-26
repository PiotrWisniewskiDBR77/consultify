import { genId } from '../../method-core/db.js';
import * as DbPromise from '../../utils/DbPromise.js';
import { getAreaById, getAxisForArea } from '../../data/drdStructure.js';

export const ASSESSMENT_SKIP_REASON_CODES = [
  'poza_modelem_operacyjnym',
  'poza_zakresem_zlecenia',
  'odroczone_do_kolejnej_rewizji',
  'zastapione_innym_rozwiazaniem',
] as const;

export type AssessmentSkipReasonCode = (typeof ASSESSMENT_SKIP_REASON_CODES)[number];

export interface AssessmentSkipReason {
  readonly id: string;
  readonly organizationId: string;
  readonly sessionId: string;
  readonly unitId: string;
  readonly questionId: string;
  readonly level: number;
  readonly skipCode: AssessmentSkipReasonCode;
  readonly recordedByUserId: string;
  readonly recordedAt: string;
  readonly supersedesId: string | null;
  readonly idempotencyKey: string;
}

interface SkipReasonRow {
  id: string;
  organization_id: string;
  session_id: string;
  unit_id: string;
  question_id: string;
  level: number;
  skip_code: AssessmentSkipReasonCode;
  recorded_by_user_id: string;
  recorded_at: string;
  supersedes_id: string | null;
  idempotency_key: string;
}

export class AssessmentSkipReasonError extends Error {
  constructor(
    readonly code:
      | 'SKIP_CODE_NOT_IN_DICTIONARY'
      | 'SESSION_NOT_FOUND'
      | 'INVALID_UNIT_OR_LEVEL'
      | 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
    readonly status: 400 | 404 | 409
  ) {
    super(code);
  }
}

function mapRow(row: SkipReasonRow): AssessmentSkipReason {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sessionId: row.session_id,
    unitId: row.unit_id,
    questionId: row.question_id,
    level: Number(row.level),
    skipCode: row.skip_code,
    recordedByUserId: row.recorded_by_user_id,
    recordedAt: new Date(row.recorded_at).toISOString(),
    supersedesId: row.supersedes_id,
    idempotencyKey: row.idempotency_key,
  };
}

export function isAssessmentSkipReasonCode(value: unknown): value is AssessmentSkipReasonCode {
  return (
    typeof value === 'string' &&
    ASSESSMENT_SKIP_REASON_CODES.includes(value as AssessmentSkipReasonCode)
  );
}

export class AssessmentSkipReasonService {
  async record(input: {
    organizationId: string;
    sessionId: string;
    unitId: string;
    questionId: string;
    level: number;
    skipCode: unknown;
    actorUserId: string;
    idempotencyKey: string;
  }): Promise<{ skipReason: AssessmentSkipReason; replayed: boolean }> {
    if (!isAssessmentSkipReasonCode(input.skipCode)) {
      throw new AssessmentSkipReasonError('SKIP_CODE_NOT_IN_DICTIONARY', 400);
    }
    const area = getAreaById(input.unitId);
    const axis = getAxisForArea(input.unitId);
    if (!area || !axis || !Number.isInteger(input.level) || input.level > axis.levelCount) {
      throw new AssessmentSkipReasonError('INVALID_UNIT_OR_LEVEL', 400);
    }

    const session = await DbPromise.get<{ id: string }>(
      `SELECT id FROM method_sessions WHERE id = ? AND organization_id = ?`,
      [input.sessionId, input.organizationId],
      { fallback: false }
    );
    if (!session) throw new AssessmentSkipReasonError('SESSION_NOT_FOUND', 404);

    const previous = await DbPromise.get<{ id: string }>(
      `SELECT id FROM assessment_skip_reasons
       WHERE organization_id = ? AND session_id = ? AND unit_id = ? AND question_id = ?
       ORDER BY recorded_at DESC, id DESC LIMIT 1`,
      [input.organizationId, input.sessionId, input.unitId, input.questionId],
      { fallback: false }
    );

    const id = genId('asm-skip');
    const insert = await DbPromise.run(
      `INSERT INTO assessment_skip_reasons
       (id, organization_id, session_id, unit_id, question_id, level, skip_code,
        recorded_by_user_id, supersedes_id, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (organization_id, idempotency_key) DO NOTHING`,
      [
        id,
        input.organizationId,
        input.sessionId,
        input.unitId,
        input.questionId,
        input.level,
        input.skipCode,
        input.actorUserId,
        previous?.id ?? null,
        input.idempotencyKey,
      ],
      { fallback: false }
    );

    const recorded = await DbPromise.get<SkipReasonRow>(
      `SELECT * FROM assessment_skip_reasons
       WHERE organization_id = ? AND idempotency_key = ?`,
      [input.organizationId, input.idempotencyKey],
      { fallback: false }
    );
    if (!recorded) throw new Error('ASSESSMENT_SKIP_REASON_WRITE_NOT_PERSISTED');
    const replayed = insert.changes === 0;
    if (
      replayed &&
      (recorded.session_id !== input.sessionId ||
        recorded.unit_id !== input.unitId ||
        recorded.question_id !== input.questionId ||
        Number(recorded.level) !== input.level ||
        recorded.skip_code !== input.skipCode)
    ) {
      throw new AssessmentSkipReasonError('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH', 409);
    }
    return { skipReason: mapRow(recorded), replayed };
  }

  async listActive(
    organizationId: string,
    sessionId: string,
    unitId?: string
  ): Promise<AssessmentSkipReason[]> {
    const session = await DbPromise.get<{ id: string }>(
      `SELECT id FROM method_sessions WHERE id = ? AND organization_id = ?`,
      [sessionId, organizationId],
      { fallback: false }
    );
    if (!session) throw new AssessmentSkipReasonError('SESSION_NOT_FOUND', 404);

    const params: unknown[] = [organizationId, sessionId];
    const unitPredicate = unitId ? ' AND unit_id = ?' : '';
    if (unitId) params.push(unitId);
    const rows = await DbPromise.all<SkipReasonRow>(
      `SELECT DISTINCT ON (unit_id, question_id) *
       FROM assessment_skip_reasons
       WHERE organization_id = ? AND session_id = ?${unitPredicate}
       ORDER BY unit_id, question_id, recorded_at DESC, id DESC`,
      params,
      { fallback: false }
    );
    return rows.map(mapRow);
  }
}

export const assessmentSkipReasonService = new AssessmentSkipReasonService();
