import { v4 as uuidv4 } from 'uuid';
import type { IDatabase } from '../../database/IDatabase.js';

export type RecoveryExperimentVerdict = 'SUPPORTED' | 'NOT_SUPPORTED' | 'INCONCLUSIVE';
export type RecoveryExperimentDecision = 'CONTINUE' | 'REVISE' | 'ESCALATE' | 'CLOSE';

export interface RecoveryExperimentDTO {
  id: string;
  recoveryCardId: string;
  version: number;
  intervention: string;
  comparison: string | null;
  baseline: string;
  measurementWindow: string;
  successCriterion: string;
  ownerUserId: string;
  remeasureAt: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy: string | null;
  approvedAt: string | null;
  verdict: RecoveryExperimentVerdict | null;
  verdictEvidence: string | null;
  decision: RecoveryExperimentDecision | null;
  createdBy: string;
  createdAt: string;
}

type Row = {
  id: string;
  recovery_card_id: string;
  version: number;
  intervention: string;
  comparison: string | null;
  baseline: string;
  measurement_window: string;
  success_criterion: string;
  owner_user_id: string;
  remeasure_at: string;
  approval_status: RecoveryExperimentDTO['approvalStatus'];
  approved_by: string | null;
  approved_at: string | null;
  verdict: RecoveryExperimentVerdict | null;
  verdict_evidence: string | null;
  decision: RecoveryExperimentDecision | null;
  created_by: string;
  created_at: string;
};

const dto = (row: Row): RecoveryExperimentDTO => ({
  id: row.id,
  recoveryCardId: row.recovery_card_id,
  version: Number(row.version),
  intervention: row.intervention,
  comparison: row.comparison,
  baseline: row.baseline,
  measurementWindow: row.measurement_window,
  successCriterion: row.success_criterion,
  ownerUserId: row.owner_user_id,
  remeasureAt: row.remeasure_at,
  approvalStatus: row.approval_status,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  verdict: row.verdict,
  verdictEvidence: row.verdict_evidence,
  decision: row.decision,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

export class RecoveryExperimentError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function ownCard(db: IDatabase, orgId: string, cardId: string) {
  const card = await db.get<{ id: string; kpi_id: string }>(
    'SELECT id,kpi_id FROM kpi_recovery_cards WHERE id=? AND organization_id=?',
    [cardId, orgId]
  );
  if (!card)
    throw new RecoveryExperimentError(
      'RESULTS_RECOVERY_CARD_NOT_FOUND',
      404,
      'Recovery card not found'
    );
  return card;
}

export async function listRecoveryExperiments(db: IDatabase, orgId: string, cardId: string) {
  await ownCard(db, orgId, cardId);
  return (
    await db.all<Row>(
      'SELECT * FROM kpi_recovery_experiments WHERE recovery_card_id=? AND organization_id=? ORDER BY version DESC',
      [cardId, orgId]
    )
  ).map(dto);
}

export async function createRecoveryExperiment(input: {
  db: IDatabase;
  orgId: string;
  cardId: string;
  actorUserId: string;
  idempotencyKey: string;
  intervention: string;
  comparison?: string | null;
  baseline: string;
  measurementWindow: string;
  successCriterion: string;
  ownerUserId: string;
  remeasureAt: string;
}) {
  await ownCard(input.db, input.orgId, input.cardId);
  if (!(
    input.idempotencyKey &&
    input.intervention &&
    input.baseline &&
    input.measurementWindow &&
    input.successCriterion &&
    input.ownerUserId &&
    input.remeasureAt
  ))
    throw new RecoveryExperimentError(
      'RESULTS_RECOVERY_EXPERIMENT_FIELDS_REQUIRED',
      400,
      'Complete experiment definition is required'
    );
  if (!(new Date(input.remeasureAt).getTime() > Date.now()))
    throw new RecoveryExperimentError(
      'RESULTS_RECOVERY_REMEASURE_AT_INVALID',
      400,
      'remeasureAt must be in the future'
    );
  const existing = await input.db.get<Row>(
    'SELECT * FROM kpi_recovery_experiments WHERE organization_id=? AND recovery_card_id=? AND idempotency_key=?',
    [input.orgId, input.cardId, input.idempotencyKey]
  );
  if (existing) return dto(existing);
  const allocated = await input.db.get<{ experiment_version: number }>(
    'UPDATE kpi_recovery_cards SET experiment_version=experiment_version+1 WHERE id=? AND organization_id=? RETURNING experiment_version',
    [input.cardId, input.orgId]
  );
  const id = uuidv4();
  await input.db.run(
    `INSERT INTO kpi_recovery_experiments (id,organization_id,recovery_card_id,version,intervention,comparison,baseline,measurement_window,success_criterion,owner_user_id,remeasure_at,idempotency_key,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (organization_id,recovery_card_id,idempotency_key) DO NOTHING`,
    [
      id,
      input.orgId,
      input.cardId,
      Number(allocated?.experiment_version),
      input.intervention,
      input.comparison || null,
      input.baseline,
      input.measurementWindow,
      input.successCriterion,
      input.ownerUserId,
      input.remeasureAt,
      input.idempotencyKey,
      input.actorUserId,
    ]
  );
  const row = await input.db.get<Row>(
    'SELECT * FROM kpi_recovery_experiments WHERE organization_id=? AND recovery_card_id=? AND idempotency_key=?',
    [input.orgId, input.cardId, input.idempotencyKey]
  );
  return dto(row!);
}

export async function approveRecoveryExperiment(
  db: IDatabase,
  orgId: string,
  cardId: string,
  experimentId: string,
  actorUserId: string,
  approved: boolean
) {
  await ownCard(db, orgId, cardId);
  const result = await db.run(
    `UPDATE kpi_recovery_experiments SET approval_status=?,approved_by=?,approved_at=now() WHERE id=? AND recovery_card_id=? AND organization_id=? AND owner_user_id=? AND approval_status='PENDING'`,
    [approved ? 'APPROVED' : 'REJECTED', actorUserId, experimentId, cardId, orgId, actorUserId]
  );
  if (!result.changes)
    throw new RecoveryExperimentError(
      'RESULTS_RECOVERY_EXPERIMENT_CONFLICT',
      409,
      'Experiment is missing, already reviewed, or the actor is not its KPI owner'
    );
  return dto(
    (await db.get<Row>('SELECT * FROM kpi_recovery_experiments WHERE id=? AND organization_id=?', [
      experimentId,
      orgId,
    ]))!
  );
}

export async function decideRecoveryExperiment(
  db: IDatabase,
  orgId: string,
  cardId: string,
  experimentId: string,
  actorUserId: string,
  verdict: RecoveryExperimentVerdict,
  evidence: string,
  decision: RecoveryExperimentDecision
) {
  await ownCard(db, orgId, cardId);
  if (!['SUPPORTED', 'NOT_SUPPORTED', 'INCONCLUSIVE'].includes(verdict))
    throw new RecoveryExperimentError(
      'RESULTS_RECOVERY_EXPERIMENT_VERDICT_INVALID',
      400,
      'Unknown experiment verdict'
    );
  if (!['CONTINUE', 'REVISE', 'ESCALATE', 'CLOSE'].includes(decision))
    throw new RecoveryExperimentError(
      'RESULTS_RECOVERY_EXPERIMENT_DECISION_INVALID',
      400,
      'Unknown recovery decision'
    );
  if (!evidence.trim())
    throw new RecoveryExperimentError(
      'RESULTS_RECOVERY_EXPERIMENT_EVIDENCE_REQUIRED',
      400,
      'Verdict evidence is required'
    );
  const result = await db.run(
    `UPDATE kpi_recovery_experiments SET verdict=?,verdict_evidence=?,decision=?,decided_by=?,decided_at=now() WHERE id=? AND recovery_card_id=? AND organization_id=? AND approval_status='APPROVED' AND verdict IS NULL AND remeasure_at<=now()`,
    [verdict, evidence.trim(), decision, actorUserId, experimentId, cardId, orgId]
  );
  if (!result.changes)
    throw new RecoveryExperimentError(
      'RESULTS_RECOVERY_EXPERIMENT_NOT_DUE',
      409,
      'Approved experiment is not due or already assessed'
    );
  return dto(
    (await db.get<Row>('SELECT * FROM kpi_recovery_experiments WHERE id=? AND organization_id=?', [
      experimentId,
      orgId,
    ]))!
  );
}

export async function confirmRecoveryCause(input: {
  db: IDatabase;
  orgId: string;
  cardId: string;
  actorUserId: string;
  cause: string;
  evidence: string;
  idempotencyKey: string;
}) {
  await ownCard(input.db, input.orgId, input.cardId);
  if (!input.cause.trim() || !input.evidence.trim() || !input.idempotencyKey)
    throw new RecoveryExperimentError(
      'RESULTS_RECOVERY_CAUSE_EVIDENCE_REQUIRED',
      400,
      'Human cause and evidence decision are required'
    );
  const existing = await input.db.get<{ id: string }>(
    'SELECT id FROM kpi_recovery_cause_decisions WHERE organization_id=? AND recovery_card_id=? AND idempotency_key=?',
    [input.orgId, input.cardId, input.idempotencyKey]
  );
  if (existing) return { id: existing.id, confirmedCause: input.cause };
  const id = uuidv4();
  await input.db.run(
    'INSERT INTO kpi_recovery_cause_decisions (id,organization_id,recovery_card_id,cause,evidence,decided_by,idempotency_key) VALUES (?,?,?,?,?,?,?)',
    [
      id,
      input.orgId,
      input.cardId,
      input.cause.trim(),
      input.evidence.trim(),
      input.actorUserId,
      input.idempotencyKey,
    ]
  );
  await input.db.run(
    'UPDATE kpi_recovery_cards SET confirmed_cause=?,updated_by=?,updated_at=now(),version=version+1 WHERE id=? AND organization_id=?',
    [input.cause.trim(), input.actorUserId, input.cardId, input.orgId]
  );
  return { id, confirmedCause: input.cause.trim() };
}

/** Restart/concurrency-safe due sweep. Claim and audit receipt are one SQL statement. */
export async function processDueRecoveryExperiments(db: IDatabase, limit = 100) {
  return db.all<{ id: string; organization_id: string; recovery_card_id: string }>(
    `WITH due AS (
       SELECT id FROM kpi_recovery_experiments
        WHERE approval_status='APPROVED' AND verdict IS NULL
          AND remeasure_at<=now() AND due_notified_at IS NULL
        ORDER BY remeasure_at FOR UPDATE SKIP LOCKED LIMIT ?
     ), claimed AS (
       UPDATE kpi_recovery_experiments ex SET due_notified_at=now()
        FROM due WHERE ex.id=due.id
       RETURNING ex.id,ex.organization_id,ex.recovery_card_id,ex.owner_user_id
     ), receipts AS (
       INSERT INTO kpi_metric_audit_log
         (id,organization_id,kpi_id,section,event_type,source,actor_user_id,summary,before_json,after_json)
       SELECT gen_random_uuid()::text,c.organization_id,c.kpi_id,'recovery_experiment',
              'recovery_experiment_remeasurement_due','results_runtime',claimed.owner_user_id,
              'Recovery experiment '||claimed.id||' is due for owner remeasurement',
              '{}'::jsonb,jsonb_build_object('experimentId',claimed.id,'recoveryCardId',claimed.recovery_card_id)
         FROM claimed JOIN kpi_recovery_cards c ON c.id=claimed.recovery_card_id
       RETURNING id
     ) SELECT id,organization_id,recovery_card_id FROM claimed`,
    [Math.max(1, Math.min(limit, 500))]
  );
}
