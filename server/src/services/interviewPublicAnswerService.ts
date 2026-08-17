/**
 * Package A — public, token-bound respondent writes for interview distributions.
 *
 * WHY THIS SERVICE EXISTS
 * -----------------------
 * `interview-enterprise.routes.ts` exposes exactly one route before
 * `router.use(verifyToken)`: a READ (`GET /public/distributions/:token`). There
 * was no public write anywhere, so an external respondent holding a valid invite
 * had no way to submit an answer — the "invite → response" half of the interview
 * chain was structurally unreachable, not merely unimplemented.
 *
 * DESIGN CONSTRAINTS THIS FILE HONOURS
 * ------------------------------------
 * 1. **No second writer.** Answers keep living in `interview_questions`, written
 *    with the same CAS predicate the authenticated writer uses
 *    (`InterviewController.updateQuestion`). This service is an additional,
 *    narrower DOOR onto the canonical table, not a parallel store.
 * 2. **Tenant identity never comes from the request.** `organization_id` and
 *    `session_id` are read from the distribution row the token resolves to. A
 *    respondent cannot name a tenant, and cannot reach a question outside the
 *    session their invite is bound to.
 * 3. **CAS is mandatory here, unlike the authenticated path.** An authenticated
 *    editor may omit `expectedUpdatedAt` and last-write-wins; an anonymous
 *    respondent may not, because there is no accountable actor to attribute a
 *    silent overwrite to. Missing precondition → 428, stale → 409.
 * 4. **Idempotency is enforced by the database.** Respondents submit from phones
 *    on unreliable networks; a retry must not become a second answer. The key is
 *    stored with a fingerprint of the semantic payload, so the same key with a
 *    DIFFERENT payload is a reported collision rather than a replayed success.
 * 5. **No PII beyond what the public GET already exposes.** The receipt records
 *    the distribution id and timestamps — never IP, user agent or free identity.
 */
import { createHash, randomUUID } from 'node:crypto';

import logger from '../utils/Logger.js';
import { type PgTransactionClient, withPgTransaction } from '../utils/queryHelpers.js';

/** Statuses in which a session no longer accepts respondent input. */
const LOCKED_SESSION_STATUSES = new Set(['completed', 'archived', 'cancelled', 'closed', 'locked']);

export type PublicAnswerFailure =
  /** `expectedUpdatedAt` was not supplied — mandatory on the public path. */
  | 'PRECONDITION_REQUIRED'
  /** Supplied `expectedUpdatedAt` no longer matches the stored row. */
  | 'STALE_VERSION'
  /** Question does not exist, or is outside the session this token is bound to. */
  | 'QUESTION_NOT_FOUND'
  /** The interview session is closed to further respondent input. */
  | 'SESSION_LOCKED'
  /**
   * The respondent already submitted this invite. Completion is their terminal
   * act; allowing writes afterwards would let a submitted response be mutated
   * with no accountable actor behind the change.
   */
  | 'DISTRIBUTION_COMPLETED'
  /** Same idempotency key, different payload. */
  | 'IDEMPOTENCY_PAYLOAD_MISMATCH';

export interface PublicAnswerInput {
  /** Resolved from the public token by the caller — never from the request body. */
  distributionId: string;
  answerText?: string | null;
  contextNote?: string | null;
  /** Mandatory CAS token: the `updated_at` the respondent last saw. */
  expectedUpdatedAt?: string | null;
  /** Mandatory idempotency key, scoped to (distribution, question). */
  idempotencyKey: string;
  questionId: string;
}

export type PublicAnswerResult =
  | { ok: true; updatedAt: string; replayed: boolean }
  | { ok: false; code: PublicAnswerFailure };

interface DistributionScope {
  distributionStatus: string;
  organizationId: string;
  sessionId: string;
  sessionStatus: string | null;
}

export interface PublicInterviewQuestionSnapshot {
  answerText: string | null;
  contextNote: string | null;
  id: string;
  isRequired: boolean;
  questionText: string;
  updatedAt: string;
}

/**
 * Reads the respondent-visible question snapshot for an already token-resolved
 * distribution. The distribution row is resolved again inside the pinned
 * transaction so a revoke/expiry racing the route-level lookup fails closed.
 */
export async function readPublicQuestionSnapshot(
  distributionId: string
): Promise<PublicInterviewQuestionSnapshot[] | null> {
  return withPgTransaction(async (tx) => {
    const scope = await loadScope(tx, distributionId);
    if (!scope) return null;

    const result = await tx.query<{
      answer_text: string | null;
      context_note: string | null;
      id: string;
      is_required: boolean | number | null;
      question_text: string;
      updated_at: Date;
    }>(
      `SELECT id, question_text, is_required, answer_text, context_note, updated_at
         FROM interview_questions
        WHERE organization_id = CAST(? AS text)
          AND session_id = CAST(? AS text)
        ORDER BY sort_order ASC NULLS LAST, id ASC`,
      [scope.organizationId, scope.sessionId]
    );

    return result.rows.map((row) => ({
      answerText: row.answer_text,
      contextNote: row.context_note,
      id: row.id,
      isRequired: Boolean(row.is_required),
      questionText: row.question_text,
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
  });
}

/**
 * Canonical fingerprint of the semantic payload. Key order is fixed here rather
 * than relying on object literal order so the same answer always hashes the
 * same, in any caller.
 */
function fingerprint(input: PublicAnswerInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        answerText: input.answerText ?? null,
        contextNote: input.contextNote ?? null,
        questionId: input.questionId,
      })
    )
    .digest('hex');
}

/**
 * Resolves the tenant and session a token's distribution belongs to. Read inside
 * the transaction so a concurrent revoke cannot slip between scope resolution
 * and the write.
 */
async function loadScope(
  tx: PgTransactionClient,
  distributionId: string
): Promise<DistributionScope | null> {
  const result = await tx.query<{
    organization_id: string;
    session_id: string;
    session_status: string | null;
    status: string;
  }>(
    `SELECT d.organization_id, d.session_id, d.status, s.status AS session_status
       FROM interview_distributions d
       LEFT JOIN interview_sessions s
              ON s.id = d.session_id AND s.organization_id = d.organization_id
      WHERE d.id = CAST(? AS text)
        AND d.revoked_at IS NULL
        AND d.expires_at > CURRENT_TIMESTAMP
        AND d.status NOT IN ('expired', 'revoked')
      FOR UPDATE OF d`,
    [distributionId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    distributionStatus: row.status,
    organizationId: row.organization_id,
    sessionId: row.session_id,
    sessionStatus: row.session_status,
  };
}

/**
 * Writes one respondent answer through the public token path.
 *
 * The whole operation — scope resolution, idempotency check, CAS update and
 * receipt insert — runs in ONE pinned transaction. `queryOne`/`queryRun` cannot
 * be composed into a transaction in this codebase (they take a different pooled
 * connection per call), which is why `withPgTransaction` is mandatory here.
 */
export async function savePublicAnswer(input: PublicAnswerInput): Promise<PublicAnswerResult> {
  if (!input.expectedUpdatedAt || !String(input.expectedUpdatedAt).trim()) {
    return { ok: false, code: 'PRECONDITION_REQUIRED' };
  }
  if (!input.idempotencyKey || !String(input.idempotencyKey).trim()) {
    return { ok: false, code: 'PRECONDITION_REQUIRED' };
  }

  const payloadFingerprint = fingerprint(input);

  return withPgTransaction<PublicAnswerResult>(async (tx): Promise<PublicAnswerResult> => {
    const scope = await loadScope(tx, input.distributionId);
    // A revoked or expired invite is indistinguishable from a nonexistent one.
    if (!scope) return { ok: false, code: 'QUESTION_NOT_FOUND' };

    if (LOCKED_SESSION_STATUSES.has(String(scope.sessionStatus ?? '').toLowerCase())) {
      return { ok: false, code: 'SESSION_LOCKED' };
    }

    // Submission is terminal for the respondent. Checked here rather than in the
    // token resolver because the resolver is shared with the public READ, which
    // must keep working after submission so the respondent can still see what
    // they sent.
    if (String(scope.distributionStatus).toLowerCase() === 'completed') {
      return { ok: false, code: 'DISTRIBUTION_COMPLETED' };
    }

    // ---- Idempotency: replay or collision, decided before any write. ----
    const existing = await tx.query<{ request_fingerprint: string; resulting_updated_at: Date }>(
      `SELECT request_fingerprint, resulting_updated_at
         FROM interview_public_answer_receipts
        WHERE organization_id = ? AND distribution_id = ? AND question_id = ? AND idempotency_key = ?`,
      [scope.organizationId, input.distributionId, input.questionId, input.idempotencyKey]
    );
    const priorReceipt = existing.rows[0];
    if (priorReceipt) {
      if (priorReceipt.request_fingerprint !== payloadFingerprint) {
        return { ok: false, code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' };
      }
      return {
        ok: true,
        replayed: true,
        updatedAt: new Date(priorReceipt.resulting_updated_at).toISOString(),
      };
    }

    // ---- CAS update on the canonical answer table. ----
    // Millisecond truncation mirrors `InterviewController.updateQuestion`:
    // JSON timestamps carry milliseconds while PostgreSQL retains microseconds,
    // so an untruncated comparison rejects a legitimate first edit as stale.
    const nowIso = new Date().toISOString();
    // Every placeholder carries an explicit CAST. Without it PostgreSQL has
    // nothing to infer a type from in `$n IS NOT NULL` / `trim($n)` and fails
    // the whole statement with 42P18 "could not determine data type of
    // parameter" — which surfaces as an opaque 500, not a validation error.
    const updated = await tx.query<{ updated_at: Date }>(
      `UPDATE interview_questions
          SET answer_text = COALESCE(CAST(? AS text), answer_text),
              context_note = COALESCE(CAST(? AS text), context_note),
              status = CASE WHEN COALESCE(length(trim(CAST(? AS text))), 0) > 0
                            THEN 'answered' ELSE status END,
              answered_at = CASE WHEN CAST(? AS text) IS NOT NULL
                                 THEN CAST(? AS timestamptz) ELSE answered_at END,
              answered_via_distribution_id = CAST(? AS text),
              updated_at = CAST(? AS timestamptz)
        WHERE id = CAST(? AS text)
          AND organization_id = CAST(? AS text)
          AND session_id = CAST(? AS text)
          AND date_trunc('milliseconds', updated_at)
              = date_trunc('milliseconds', CAST(? AS timestamptz))
        RETURNING updated_at`,
      [
        input.answerText ?? null,
        input.contextNote ?? null,
        input.answerText ?? null,
        input.answerText ?? null,
        nowIso,
        input.distributionId,
        nowIso,
        input.questionId,
        scope.organizationId,
        scope.sessionId,
        input.expectedUpdatedAt,
      ]
    );

    if (updated.rowCount === 0) {
      // Distinguish "wrong question / wrong session / wrong tenant" from
      // "right question, stale precondition" WITHOUT leaking which: the
      // existence probe is scoped to this token's session, so a question in
      // another session or tenant is reported exactly like a nonexistent one.
      const scoped = await tx.query(
        `SELECT 1 FROM interview_questions
          WHERE id = CAST(? AS text)
            AND organization_id = CAST(? AS text)
            AND session_id = CAST(? AS text)`,
        [input.questionId, scope.organizationId, scope.sessionId]
      );
      return { ok: false, code: scoped.rowCount === 0 ? 'QUESTION_NOT_FOUND' : 'STALE_VERSION' };
    }

    const resultingUpdatedAt = updated.rows[0].updated_at;

    // ---- Receipt, in the same transaction as the write it attests to. ----
    // A forced failure here rolls the answer back too, so there is never a
    // recorded answer without its receipt, nor a receipt without its answer.
    await tx.query(
      `INSERT INTO interview_public_answer_receipts
         (id, organization_id, distribution_id, session_id, question_id,
          idempotency_key, request_fingerprint, resulting_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        scope.organizationId,
        input.distributionId,
        scope.sessionId,
        input.questionId,
        input.idempotencyKey,
        payloadFingerprint,
        resultingUpdatedAt,
      ]
    );

    // Move the invite out of 'opened' on first real answer. Conditional so a
    // later answer never regresses a 'completed' invite.
    await tx.query(
      `UPDATE interview_distributions
          SET status = CASE WHEN status IN ('pending','sent','opened') THEN 'started' ELSE status END,
              started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
        WHERE id = ?`,
      [input.distributionId]
    );

    return { ok: true, replayed: false, updatedAt: new Date(resultingUpdatedAt).toISOString() };
  }).catch((error: unknown) => {
    // The UNIQUE index is the real enforcement point: two concurrent requests
    // can both pass the SELECT above and race to INSERT. The loser gets 23505
    // and is reported as a replay of the winner's write, which is exactly what
    // an idempotent retry means.
    const code = (error as { code?: string })?.code;
    if (code === '23505') {
      logger.info('[interviewPublicAnswer] idempotency race resolved by unique index', {
        distributionId: input.distributionId,
        questionId: input.questionId,
      });
      return replayFromReceipt(input, payloadFingerprint);
    }
    throw error;
  });
}

/** Reads back the winner's receipt after a unique-index race. */
async function replayFromReceipt(
  input: PublicAnswerInput,
  payloadFingerprint: string
): Promise<PublicAnswerResult> {
  return withPgTransaction<PublicAnswerResult>(async (tx): Promise<PublicAnswerResult> => {
    const row = await tx.query<{ request_fingerprint: string; resulting_updated_at: Date }>(
      `SELECT request_fingerprint, resulting_updated_at
         FROM interview_public_answer_receipts
        WHERE distribution_id = ? AND question_id = ? AND idempotency_key = ?`,
      [input.distributionId, input.questionId, input.idempotencyKey]
    );
    const receipt = row.rows[0];
    if (!receipt) return { ok: false, code: 'STALE_VERSION' };
    if (receipt.request_fingerprint !== payloadFingerprint) {
      return { ok: false, code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' };
    }
    return {
      ok: true,
      replayed: true,
      updatedAt: new Date(receipt.resulting_updated_at).toISOString(),
    };
  });
}

/** HTTP status for each failure, kept next to the codes so they cannot drift. */
export const PUBLIC_ANSWER_STATUS: Record<PublicAnswerFailure, number> = {
  DISTRIBUTION_COMPLETED: 409,
  IDEMPOTENCY_PAYLOAD_MISMATCH: 409,
  PRECONDITION_REQUIRED: 428,
  QUESTION_NOT_FOUND: 404,
  SESSION_LOCKED: 409,
  STALE_VERSION: 409,
};

/**
 * Marks an invite complete. Atomic `UPDATE … WHERE status NOT IN (terminal)`
 * so N concurrent submissions produce exactly one transition; everyone else
 * reads back the already-completed row.
 */
export async function completeDistributionByToken(
  distributionId: string
): Promise<{ completed: boolean; alreadyComplete: boolean }> {
  return withPgTransaction(async (tx) => {
    const claimed = await tx.query(
      `UPDATE interview_distributions
          SET status = 'completed', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
        WHERE id = ?
          AND revoked_at IS NULL
          AND status NOT IN ('completed', 'expired', 'revoked')
        RETURNING id`,
      [distributionId]
    );
    if (claimed.rowCount > 0) return { completed: true, alreadyComplete: false };

    const current = await tx.query<{ status: string }>(
      `SELECT status FROM interview_distributions WHERE id = ?`,
      [distributionId]
    );
    const status = current.rows[0]?.status;
    return { completed: status === 'completed', alreadyComplete: status === 'completed' };
  });
}
