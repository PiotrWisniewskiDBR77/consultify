import { createHash, randomUUID } from 'node:crypto';

import { z } from 'zod';

import * as queryHelpers from '../../utils/queryHelpers.js';
import {
  deriveInterviewAnswerApprovalProgress,
  type InterviewAnswerApprovalDecision,
  type InterviewAnswerApprovalStage,
  isInterviewAnswerApprovalEnvironmentEnabled,
  type ResolvedInterviewAnswerApprovalPolicy,
  resolveInterviewAnswerApprovalPolicy,
} from './interviewAnswerApprovalPolicy.js';

type JsonObject = Record<string, unknown>;

export type InterviewAnswerDecisionCommandType = 'submit' | 'decide';

export interface InterviewAnswerRevisionRef {
  questionId: string;
  expectedAnswerUpdatedAt: string;
}

interface InterviewAnswerDecisionCommandBase {
  organizationId: string;
  assignmentId: string;
  sessionId: string;
  submissionId: string;
  clientRequestId: string;
  actor: { type: 'ai' | 'human' | 'system'; id: string };
  metadata?: {
    modelId?: string;
    modelVersion?: string;
    providerId?: string;
    promptVersion?: string;
    score?: number;
  };
}

export type ApplyInterviewAnswerDecisionCommandInput =
  | (InterviewAnswerDecisionCommandBase & {
      commandType: 'submit';
    })
  | (InterviewAnswerDecisionCommandBase & {
      commandType: 'decide';
      answers: readonly InterviewAnswerRevisionRef[];
      stage: InterviewAnswerApprovalStage;
      decision: InterviewAnswerApprovalDecision;
      reason?: string | null;
    });

export interface InterviewAnswerDecisionReceipt {
  id: string;
  questionId: string;
  ordinal: number;
  eventType:
    | 'submitted'
    | 'ai_approved'
    | 'ai_sent_back'
    | 'manager_approved'
    | 'manager_sent_back';
  stage: InterviewAnswerApprovalStage | null;
  decision: InterviewAnswerApprovalDecision | null;
  answerUpdatedAt: string;
  answerDigest: string;
}

export interface ApplyInterviewAnswerDecisionCommandResponse {
  commandId: string;
  assignmentId: string;
  sessionId: string;
  submissionId: string;
  policyMode: 'ai' | 'manager' | 'two_stage';
  policyVersion: number;
  status: 'applied';
  observedAt: string;
  decisions: InterviewAnswerDecisionReceipt[];
  idempotentReplay: boolean;
}

export interface InterviewAnswerApprovalProjection {
  questionId: string;
  submissionId: string;
  answerUpdatedAt: string;
  answerDigest: string;
  policyMode: 'ai' | 'manager' | 'two_stage';
  policyVersion: number;
  status: 'pending' | 'stages_complete' | 'sent_back';
  nextStage: InterviewAnswerApprovalStage | null;
  latestDecision: InterviewAnswerApprovalDecision | null;
  reason: string | null;
  decidedAt: string | null;
  actor: { type: 'ai' | 'human' | 'system'; id: string } | null;
}

export class InterviewAnswerDecisionCommandError extends Error {
  constructor(
    public readonly code:
      | 'COMMAND_INVALID'
      | 'FEATURE_DISABLED'
      | 'IDEMPOTENCY_CONFLICT'
      | 'ASSIGNMENT_NOT_FOUND'
      | 'ASSIGNMENT_STATE_INVALID'
      | 'ANSWER_REVISION_CONFLICT'
      | 'POLICY_UNSUPPORTED'
      | 'SUBMISSION_CONFLICT'
      | 'SUBMISSION_NOT_FOUND'
      | 'SUBMISSION_SENT_BACK'
      | 'STAGE_NOT_ALLOWED'
      | 'STAGE_ORDER_INVALID',
    message: string
  ) {
    super(message);
    this.name = 'InterviewAnswerDecisionCommandError';
  }
}

interface CommandRow {
  request_fingerprint: string;
  response_json: unknown;
}

interface QuestionRow extends JsonObject {
  id: string;
  updated_at: unknown;
}

interface EvidenceRow extends JsonObject {
  id: string;
  question_id: string;
}

interface LockedAssignmentRow {
  id: string;
  session_id: string | null;
  status: string;
  template_id: string;
  template_version: number | string;
}

interface ExistingDecisionRow {
  id: string;
  assignment_id: string;
  question_id: string;
  submission_id: string;
  answer_updated_at: unknown;
  answer_digest: string;
  ordinal: number | string;
  event_type: string;
  stage: InterviewAnswerApprovalStage | null;
  decision: InterviewAnswerApprovalDecision | null;
  policy_mode: 'ai' | 'manager' | 'two_stage';
  policy_version: number | string;
  policy_snapshot_json: unknown;
  reason?: string | null;
  actor_type?: 'ai' | 'human' | 'system';
  actor_id?: string;
  created_at?: unknown;
  assignment_sequence?: number | string;
}

interface DatabaseError {
  code?: unknown;
  constraint?: unknown;
}

function objectOrNull(value: unknown): JsonObject | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonObject;
}

function parseObject(value: unknown): JsonObject | null {
  if (typeof value !== 'string') return objectOrNull(value);
  try {
    return objectOrNull(JSON.parse(value));
  } catch {
    return null;
  }
}

function stableValue(value: unknown): unknown {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (Array.isArray(value)) return value.map(stableValue);
  const object = objectOrNull(value);
  if (!object) return value;
  return Object.fromEntries(
    Object.keys(object)
      .sort()
      .map((key) => [key, stableValue(object[key])])
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function answerSnapshot(
  row: QuestionRow,
  assignment: LockedAssignmentRow,
  evidenceRows: readonly EvidenceRow[]
): JsonObject {
  let answerPayload: JsonObject = {};
  if (
    row.answer_payload !== null &&
    row.answer_payload !== undefined &&
    row.answer_payload !== ''
  ) {
    const parsed = parseObject(row.answer_payload);
    if (!parsed) {
      throw new InterviewAnswerDecisionCommandError(
        'COMMAND_INVALID',
        `Answer payload is invalid for question ${row.id}`
      );
    }
    answerPayload = parsed;
  }
  return {
    schemaVersion: 1,
    questionId: row.id,
    sessionId: row.session_id,
    templateId: assignment.template_id,
    templateVersion: Number(assignment.template_version),
    isRequired: Number(row.is_required) === 1,
    questionText: row.question_text,
    answerType: row.answer_type,
    answerText: row.answer_text,
    answerMode: row.answer_mode,
    answerPayload,
    contextNote: row.context_note,
    voiceTranscript: row.voice_transcript,
    voiceTranscriptStatus: row.voice_transcript_status,
    voiceAudioEvidenceId: row.voice_audio_evidence_id,
    answerKnowledgeDocId: row.answer_knowledge_doc_id,
    contextNoteKnowledgeDocId: row.context_note_knowledge_doc_id,
    status: row.status,
    confidenceScore: row.confidence_score,
    answeredBy: row.answered_by,
    answeredAt: row.answered_at,
    updatedAt: row.updated_at,
    evidence: evidenceRows
      .filter((evidence) => evidence.question_id === row.id)
      .map((evidence) => ({
        id: evidence.id,
        questionId: evidence.question_id,
        evidenceType: evidence.evidence_type,
        evidenceRole: evidence.evidence_role,
        title: evidence.title,
        description: evidence.description,
        fileName: evidence.file_name,
        fileSize: evidence.file_size,
        fileType: evidence.file_type,
        url: evidence.url,
        transcriptText: evidence.transcript_text,
        ingestToKnowledge: evidence.ingest_to_knowledge,
        knowledgeDocumentId: evidence.knowledge_document_id,
        uploadedBy: evidence.uploaded_by,
        createdAt: evidence.created_at,
      }))
      .sort((left, right) => String(left.id).localeCompare(String(right.id))),
  };
}

function frozenPolicyDocument(policy: {
  enabled: boolean;
  mode: 'ai' | 'manager' | 'two_stage';
  configuredVersion: number | null;
}): JsonObject {
  return {
    interview: {
      answerApproval: {
        version: policy.configuredVersion ?? 1,
        enabled: policy.enabled,
        mode: policy.mode,
      },
    },
  };
}

function isCommandRequestRace(error: unknown): boolean {
  const candidate = objectOrNull(error) as DatabaseError | null;
  return (
    candidate?.code === '23505' &&
    candidate.constraint === 'uq_interview_answer_decision_commands_request'
  );
}

function isSubmissionRace(error: unknown): boolean {
  const candidate = objectOrNull(error) as DatabaseError | null;
  return (
    candidate?.code === '23505' &&
    candidate.constraint === 'uq_interview_answer_decision_commands_submission'
  );
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function instant(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (!nonBlank(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function commandFingerprint(input: ApplyInterviewAnswerDecisionCommandInput): string {
  return digest({
    organizationId: input.organizationId,
    assignmentId: input.assignmentId,
    sessionId: input.sessionId,
    submissionId: input.submissionId,
    commandType: input.commandType,
    answers:
      input.commandType === 'decide'
        ? [...input.answers]
            .map((answer) => ({
              questionId: answer.questionId,
              expectedAnswerUpdatedAt: instant(answer.expectedAnswerUpdatedAt),
            }))
            .sort((left, right) => {
              if (left.questionId < right.questionId) return -1;
              if (left.questionId > right.questionId) return 1;
              return 0;
            })
        : null,
    actor: input.actor,
    stage: input.commandType === 'decide' ? input.stage : null,
    decision: input.commandType === 'decide' ? input.decision : null,
    reason: input.commandType === 'decide' ? input.reason?.trim() || null : null,
    metadata: stableValue(input.metadata ?? {}),
  });
}

const replaySchema = z
  .object({
    commandId: z.string().min(1),
    assignmentId: z.string().min(1),
    sessionId: z.string().min(1),
    submissionId: z.string().min(1),
    policyMode: z.enum(['ai', 'manager', 'two_stage']),
    policyVersion: z.number().int().positive(),
    status: z.literal('applied'),
    observedAt: z.string().datetime(),
    decisions: z.array(
      z
        .object({
          id: z.string().min(1),
          questionId: z.string().min(1),
          ordinal: z.number().int().positive(),
          eventType: z.enum([
            'submitted',
            'ai_approved',
            'ai_sent_back',
            'manager_approved',
            'manager_sent_back',
          ]),
          stage: z.enum(['ai', 'manager']).nullable(),
          decision: z.enum(['approved', 'sent_back']).nullable(),
          answerUpdatedAt: z.string().datetime(),
          answerDigest: z.string().regex(/^[0-9a-f]{64}$/),
        })
        .strict()
    ),
    idempotentReplay: z.boolean(),
  })
  .strict();

function parseReplay(row: CommandRow): ApplyInterviewAnswerDecisionCommandResponse {
  let payload: unknown = row.response_json;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      throw new InterviewAnswerDecisionCommandError(
        'COMMAND_INVALID',
        'Stored Interview answer command response is invalid'
      );
    }
  }
  const parsed = replaySchema.safeParse(payload);
  if (!parsed.success) {
    throw new InterviewAnswerDecisionCommandError(
      'COMMAND_INVALID',
      'Stored Interview answer command response is invalid'
    );
  }
  return {
    ...parsed.data,
    idempotentReplay: true,
  };
}

function assertCommandShape(input: ApplyInterviewAnswerDecisionCommandInput): void {
  if (
    !nonBlank(input.organizationId) ||
    !nonBlank(input.assignmentId) ||
    !nonBlank(input.sessionId) ||
    !nonBlank(input.submissionId) ||
    !nonBlank(input.clientRequestId) ||
    !nonBlank(input.actor?.id) ||
    (input.commandType === 'decide' && input.answers.length === 0)
  ) {
    throw new InterviewAnswerDecisionCommandError(
      'COMMAND_INVALID',
      'Command identity is required'
    );
  }
  if (
    Object.entries(input.metadata ?? {}).some(([key, value]) => {
      if (!['modelId', 'modelVersion', 'providerId', 'promptVersion', 'score'].includes(key))
        return true;
      if (key === 'score') return typeof value !== 'number' || !Number.isFinite(value);
      return typeof value !== 'string' || value.length === 0 || value.length > 200;
    })
  ) {
    throw new InterviewAnswerDecisionCommandError(
      'COMMAND_INVALID',
      'Decision provenance metadata is invalid'
    );
  }
  if (input.commandType === 'submit') {
    if (input.actor.type !== 'human') {
      throw new InterviewAnswerDecisionCommandError(
        'COMMAND_INVALID',
        'Interview answer submission requires a human respondent actor'
      );
    }
    return;
  }
  if (input.stage === 'manager' && input.actor.type !== 'human') {
    throw new InterviewAnswerDecisionCommandError(
      'COMMAND_INVALID',
      'Manager answer decisions require a human actor'
    );
  }
  if (
    input.stage === 'ai' &&
    (input.actor.type !== 'ai' ||
      !nonBlank(input.metadata?.modelId) ||
      !nonBlank(input.metadata?.providerId) ||
      !nonBlank(input.metadata?.promptVersion))
  ) {
    throw new InterviewAnswerDecisionCommandError(
      'COMMAND_INVALID',
      'AI answer decisions require an AI actor and model and prompt provenance'
    );
  }
  const ids = input.answers.map((answer) => answer.questionId);
  if (ids.some((id) => !nonBlank(id)) || new Set(ids).size !== ids.length) {
    throw new InterviewAnswerDecisionCommandError(
      'COMMAND_INVALID',
      'Answer question identities must be non-empty and unique'
    );
  }
  if (input.decision === 'sent_back' && !nonBlank(input.reason)) {
    throw new InterviewAnswerDecisionCommandError(
      'COMMAND_INVALID',
      'Send-back reason is required'
    );
  }
  if ((input.reason?.length ?? 0) > 2000) {
    throw new InterviewAnswerDecisionCommandError('COMMAND_INVALID', 'Decision reason is invalid');
  }
}

function eventTypeFor(
  input: ApplyInterviewAnswerDecisionCommandInput
): InterviewAnswerDecisionReceipt['eventType'] {
  if (input.commandType === 'submit') return 'submitted';
  return `${input.stage}_${input.decision}` as InterviewAnswerDecisionReceipt['eventType'];
}

export async function applyInterviewAnswerDecisionCommand(
  input: ApplyInterviewAnswerDecisionCommandInput
): Promise<ApplyInterviewAnswerDecisionCommandResponse> {
  if (!isInterviewAnswerApprovalEnvironmentEnabled()) {
    throw new InterviewAnswerDecisionCommandError(
      'FEATURE_DISABLED',
      'Interview answer approval is disabled'
    );
  }
  assertCommandShape(input);
  const fingerprint = commandFingerprint(input);
  try {
    return await queryHelpers.withPgTransaction(async () => {
      const lockedAssignment = await queryHelpers.queryOne<LockedAssignmentRow>(
        `SELECT id, session_id, status, template_id, template_version
       FROM interview_assignments
       WHERE organization_id = ? AND id = ?
       FOR UPDATE`,
        [input.organizationId, input.assignmentId]
      );
      if (!lockedAssignment || lockedAssignment.session_id !== input.sessionId) {
        throw new InterviewAnswerDecisionCommandError(
          'ASSIGNMENT_NOT_FOUND',
          'Interview assignment was not found in this organization'
        );
      }
      const lockedReplay = await queryHelpers.queryOne<CommandRow>(
        `SELECT request_fingerprint, response_json
       FROM interview_answer_decision_commands
       WHERE organization_id = ? AND client_request_id = ?`,
        [input.organizationId, input.clientRequestId]
      );
      if (lockedReplay) {
        if (lockedReplay.request_fingerprint !== fingerprint) {
          throw new InterviewAnswerDecisionCommandError(
            'IDEMPOTENCY_CONFLICT',
            'Client request ID was already used with another payload'
          );
        }
        return parseReplay(lockedReplay);
      }
      const assignmentStatus = String(lockedAssignment.status || '').toLowerCase();
      const stateAllowed =
        input.commandType === 'submit'
          ? assignmentStatus === 'in_progress' || assignmentStatus === 'sent_back'
          : assignmentStatus === 'submitted';
      if (!stateAllowed) {
        throw new InterviewAnswerDecisionCommandError(
          'ASSIGNMENT_STATE_INVALID',
          'Interview assignment is not in a state that allows this command'
        );
      }

      const requestedAnswers = input.commandType === 'decide' ? input.answers : null;
      const placeholders = requestedAnswers?.map(() => '?').join(', ');
      const questionRows = await queryHelpers.queryAll<QuestionRow>(
        `SELECT id, session_id, question_text, answer_type, answer_text,
              answer_mode, answer_payload, context_note, voice_transcript,
              voice_transcript_status, voice_audio_evidence_id,
              answer_knowledge_doc_id, context_note_knowledge_doc_id, status,
              confidence_score, answered_by, answered_at, updated_at, is_required
       FROM interview_questions
       WHERE organization_id = ? AND session_id = ?
         ${
           requestedAnswers
             ? `AND id IN (${placeholders})`
             : "AND (is_required = 1 OR (status = 'answered' AND TRIM(COALESCE(answer_text, '')) <> ''))"
         }
       ORDER BY id
       FOR UPDATE`,
        [
          input.organizationId,
          input.sessionId,
          ...(requestedAnswers?.map((answer) => answer.questionId) ?? []),
        ]
      );
      if (questionRows.length === 0) {
        throw new InterviewAnswerDecisionCommandError(
          'COMMAND_INVALID',
          'The assignment has no submitted answer denominator'
        );
      }
      if (
        input.commandType === 'submit' &&
        questionRows.some(
          (row) =>
            Number(row.is_required) === 1 &&
            (String(row.status).toLowerCase() !== 'answered' || !nonBlank(row.answer_text))
        )
      ) {
        throw new InterviewAnswerDecisionCommandError(
          'COMMAND_INVALID',
          'Every required question must have a canonical answered revision before submission'
        );
      }
      const evidenceRows = await queryHelpers.queryAll<EvidenceRow>(
        `SELECT id, question_id, evidence_type, evidence_role, title, description,
                file_name, file_size, file_type, url, transcript_text,
                ingest_to_knowledge, knowledge_document_id, uploaded_by, created_at
         FROM interview_evidence
         WHERE organization_id = ? AND session_id = ?
           AND question_id IN (${questionRows.map(() => '?').join(', ')})
           AND COALESCE(evidence_role, 'supporting') NOT IN
             ('answer_text', 'voice_transcript', 'context_note')
         ORDER BY question_id, created_at, id`,
        [input.organizationId, input.sessionId, ...questionRows.map((row) => row.id)]
      );
      const expectedByQuestion = new Map(
        requestedAnswers?.map((answer) => [
          answer.questionId,
          instant(answer.expectedAnswerUpdatedAt),
        ]) ?? []
      );
      if (
        requestedAnswers &&
        (questionRows.length !== requestedAnswers.length ||
          questionRows.some(
            (row) =>
              !expectedByQuestion.get(row.id) ||
              instant(row.updated_at) !== expectedByQuestion.get(row.id)
          ))
      ) {
        throw new InterviewAnswerDecisionCommandError(
          'ANSWER_REVISION_CONFLICT',
          'One or more answer revisions changed before the command was applied'
        );
      }

      const existingDecisions = await queryHelpers.queryAll<ExistingDecisionRow>(
        `SELECT id, assignment_id, question_id, submission_id, answer_updated_at, answer_digest,
                ordinal, event_type, stage, decision, policy_mode,
                policy_version, policy_snapshot_json
       FROM interview_answer_decisions
       WHERE organization_id = ? AND submission_id = ?
       ORDER BY ordinal, id`,
        [input.organizationId, input.submissionId]
      );
      if (existingDecisions.some((row) => row.assignment_id !== input.assignmentId)) {
        throw new InterviewAnswerDecisionCommandError(
          'SUBMISSION_CONFLICT',
          'Submission identity belongs to another Interview assignment'
        );
      }
      if (input.commandType === 'submit' && existingDecisions.length > 0) {
        throw new InterviewAnswerDecisionCommandError(
          'SUBMISSION_CONFLICT',
          'Submission identity has already been used'
        );
      }
      let commandQuestionRows = questionRows;
      if (input.commandType === 'submit' && assignmentStatus === 'sent_back') {
        const priorRows = await queryHelpers.queryAll<ExistingDecisionRow>(
          `SELECT d.id, d.assignment_id, d.question_id, d.submission_id,
                  d.answer_updated_at, d.answer_digest, d.ordinal, d.event_type,
                  d.stage, d.decision, d.policy_mode, d.policy_version,
                  d.policy_snapshot_json, c.assignment_sequence
           FROM interview_answer_decisions d
           JOIN interview_answer_decision_commands c
             ON c.organization_id = d.organization_id AND c.id = d.command_id
           WHERE d.organization_id = ? AND d.assignment_id = ?
           ORDER BY c.assignment_sequence, d.ordinal, d.id`,
          [input.organizationId, input.assignmentId]
        );
        commandQuestionRows = questionRows.filter((row) => {
          const submitted = priorRows
            .filter(
              (candidate) =>
                candidate.question_id === row.id && candidate.event_type === 'submitted'
            )
            .sort(
              (left, right) =>
                Number(left.assignment_sequence) - Number(right.assignment_sequence) ||
                Number(left.ordinal) - Number(right.ordinal) ||
                left.id.localeCompare(right.id)
            )
            .at(-1);
          if (!submitted) return false;
          const revisionRows = priorRows.filter(
            (candidate) =>
              candidate.question_id === row.id &&
              candidate.submission_id === submitted.submission_id
          );
          const wasSentBack = revisionRows.some((candidate) => candidate.decision === 'sent_back');
          if (!wasSentBack) return false;
          const currentDigest = digest(answerSnapshot(row, lockedAssignment, evidenceRows));
          if (currentDigest === submitted.answer_digest) {
            throw new InterviewAnswerDecisionCommandError(
              'SUBMISSION_SENT_BACK',
              `Question ${row.id} must be edited before resubmission`
            );
          }
          return true;
        });
        if (commandQuestionRows.length === 0) {
          throw new InterviewAnswerDecisionCommandError(
            'SUBMISSION_SENT_BACK',
            'No returned answer has a changed revision to resubmit'
          );
        }
      }
      let policy: ResolvedInterviewAnswerApprovalPolicy;
      if (input.commandType === 'submit') {
        const organizationPolicy = await queryHelpers.queryOne<{ policy: unknown }>(
          `SELECT policy FROM organization_ai_policy WHERE organization_id = ?`,
          [input.organizationId]
        );
        policy = resolveInterviewAnswerApprovalPolicy(organizationPolicy?.policy);
        if (
          policy.compatibility === 'invalid_version' ||
          policy.compatibility === 'unsupported_future_version'
        ) {
          throw new InterviewAnswerDecisionCommandError(
            'POLICY_UNSUPPORTED',
            'Interview answer approval policy version is not supported'
          );
        }
        if (!policy.enabled) {
          throw new InterviewAnswerDecisionCommandError(
            'FEATURE_DISABLED',
            'Interview answer approval is disabled for this organization'
          );
        }
      } else {
        let frozenPolicyJson: string | null = null;
        let frozenPolicy: ReturnType<typeof resolveInterviewAnswerApprovalPolicy> | null = null;
        const snapshotByQuestion = new Map(
          questionRows.map((row) => {
            const snapshot = answerSnapshot(row, lockedAssignment, evidenceRows);
            return [
              row.id,
              {
                updatedAt: instant(row.updated_at),
                digest: digest(snapshot),
              },
            ];
          })
        );
        for (const answer of input.answers) {
          const submitted = existingDecisions.find(
            (row) => row.question_id === answer.questionId && row.event_type === 'submitted'
          );
          if (!submitted || submitted.assignment_id !== input.assignmentId) {
            throw new InterviewAnswerDecisionCommandError(
              'SUBMISSION_NOT_FOUND',
              `No submitted receipt exists for question ${answer.questionId}`
            );
          }
          const current = snapshotByQuestion.get(answer.questionId);
          if (
            !current?.updatedAt ||
            instant(submitted.answer_updated_at) !== current.updatedAt ||
            submitted.answer_digest !== current.digest
          ) {
            throw new InterviewAnswerDecisionCommandError(
              'ANSWER_REVISION_CONFLICT',
              `Submitted answer revision no longer matches question ${answer.questionId}`
            );
          }
          const policyJson = stableJson(parseObject(submitted.policy_snapshot_json));
          const candidatePolicy = resolveInterviewAnswerApprovalPolicy(
            submitted.policy_snapshot_json
          );
          if (
            candidatePolicy.compatibility !== 'supported' ||
            !candidatePolicy.enabled ||
            candidatePolicy.mode !== submitted.policy_mode ||
            candidatePolicy.configuredVersion !== Number(submitted.policy_version)
          ) {
            throw new InterviewAnswerDecisionCommandError(
              'POLICY_UNSUPPORTED',
              'Submitted answer policy snapshot is invalid'
            );
          }
          if (frozenPolicyJson !== null && frozenPolicyJson !== policyJson) {
            throw new InterviewAnswerDecisionCommandError(
              'POLICY_UNSUPPORTED',
              'Decision command mixes incompatible frozen policies'
            );
          }
          frozenPolicyJson = policyJson;
          frozenPolicy = candidatePolicy;
          if (
            existingDecisions.some(
              (row) => row.question_id === answer.questionId && row.decision === 'sent_back'
            )
          ) {
            throw new InterviewAnswerDecisionCommandError(
              'SUBMISSION_SENT_BACK',
              `Question ${answer.questionId} must be edited and resubmitted`
            );
          }
          const progress = deriveInterviewAnswerApprovalProgress(
            candidatePolicy,
            existingDecisions
              .filter(
                (
                  row
                ): row is ExistingDecisionRow & {
                  stage: InterviewAnswerApprovalStage;
                  decision: InterviewAnswerApprovalDecision;
                } => row.question_id === answer.questionId && Boolean(row.stage && row.decision)
              )
              .map((row) => ({
                receiptId: row.id,
                ordinal: Number(row.ordinal),
                stage: row.stage,
                decision: row.decision,
              }))
          );
          if (progress.nextStage !== input.stage) {
            throw new InterviewAnswerDecisionCommandError(
              'STAGE_ORDER_INVALID',
              `Decision does not match the next required policy stage for question ${answer.questionId}`
            );
          }
        }
        if (!frozenPolicy) {
          throw new InterviewAnswerDecisionCommandError(
            'SUBMISSION_NOT_FOUND',
            'No frozen answer policy was found'
          );
        }
        policy = frozenPolicy;
      }
      if (
        policy.compatibility === 'invalid_version' ||
        policy.compatibility === 'unsupported_future_version'
      ) {
        throw new InterviewAnswerDecisionCommandError(
          'POLICY_UNSUPPORTED',
          'Interview answer approval policy version is not supported'
        );
      }
      if (input.commandType === 'decide' && !policy.stages.includes(input.stage)) {
        throw new InterviewAnswerDecisionCommandError(
          'STAGE_NOT_ALLOWED',
          'Decision stage is not allowed by the frozen policy'
        );
      }

      const observedAt = new Date().toISOString();
      const commandId = randomUUID();
      const sequenceRow = await queryHelpers.queryOne<{ max_sequence: number | string | null }>(
        `SELECT MAX(assignment_sequence) AS max_sequence
         FROM interview_answer_decision_commands
         WHERE organization_id = ? AND assignment_id = ?`,
        [input.organizationId, input.assignmentId]
      );
      const assignmentSequence = Number(sequenceRow?.max_sequence ?? 0) + 1;
      const firstOrdinal =
        existingDecisions.reduce((max, row) => Math.max(max, Number(row.ordinal) || 0), 0) + 1;
      const eventType = eventTypeFor(input);
      const receipts = commandQuestionRows.map((row, index): InterviewAnswerDecisionReceipt => {
        const answerUpdatedAt = instant(row.updated_at);
        if (!answerUpdatedAt) {
          throw new InterviewAnswerDecisionCommandError(
            'ANSWER_REVISION_CONFLICT',
            'Answer revision timestamp is invalid'
          );
        }
        const snapshot = answerSnapshot(row, lockedAssignment, evidenceRows);
        return {
          id: randomUUID(),
          questionId: row.id,
          ordinal: firstOrdinal + index,
          eventType,
          stage: input.commandType === 'decide' ? (input.stage ?? null) : null,
          decision: input.commandType === 'decide' ? (input.decision ?? null) : null,
          answerUpdatedAt,
          answerDigest: digest(snapshot),
        };
      });
      const answerManifestDigest = digest(
        receipts.map(({ questionId, answerUpdatedAt, answerDigest }) => ({
          questionId,
          answerUpdatedAt,
          answerDigest,
        }))
      );
      const response: ApplyInterviewAnswerDecisionCommandResponse = {
        commandId,
        assignmentId: input.assignmentId,
        sessionId: input.sessionId,
        submissionId: input.submissionId,
        policyMode: policy.mode,
        policyVersion: policy.configuredVersion ?? 1,
        status: 'applied',
        observedAt,
        decisions: receipts,
        idempotentReplay: false,
      };

      await queryHelpers.queryRun(
        `INSERT INTO interview_answer_decision_commands
        (organization_id, id, assignment_id, assignment_sequence, session_id, submission_id, command_type,
         client_request_id, request_fingerprint, expected_answer_count,
         answer_manifest_digest, status, response_json, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'applied', ?::jsonb, ?, ?)`,
        [
          input.organizationId,
          commandId,
          input.assignmentId,
          assignmentSequence,
          input.sessionId,
          input.submissionId,
          input.commandType,
          input.clientRequestId,
          fingerprint,
          receipts.length,
          answerManifestDigest,
          JSON.stringify(response),
          observedAt,
          observedAt,
        ]
      );

      for (const [index, receipt] of receipts.entries()) {
        const row = commandQuestionRows[index];
        if (!row) {
          throw new InterviewAnswerDecisionCommandError(
            'ANSWER_REVISION_CONFLICT',
            'Answer snapshot is missing'
          );
        }
        await queryHelpers.queryRun(
          `INSERT INTO interview_answer_decisions
          (organization_id, id, command_id, assignment_id, session_id,
           question_id, submission_id, answer_updated_at, answer_digest,
           answer_snapshot_json, ordinal, event_type, stage, decision, reason,
           policy_mode, policy_version, policy_snapshot_json, actor_type,
           actor_id, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?::jsonb, ?)`,
          [
            input.organizationId,
            receipt.id,
            commandId,
            input.assignmentId,
            input.sessionId,
            receipt.questionId,
            input.submissionId,
            receipt.answerUpdatedAt,
            receipt.answerDigest,
            JSON.stringify(stableValue(answerSnapshot(row, lockedAssignment, evidenceRows))),
            receipt.ordinal,
            receipt.eventType,
            receipt.stage,
            receipt.decision,
            input.commandType === 'decide' ? input.reason?.trim() || null : null,
            policy.mode,
            policy.configuredVersion ?? 1,
            JSON.stringify(frozenPolicyDocument(policy)),
            input.actor.type,
            input.actor.id,
            JSON.stringify(stableValue(input.metadata ?? {})),
            observedAt,
          ]
        );
      }
      return response;
    });
  } catch (error) {
    if (isSubmissionRace(error)) {
      throw new InterviewAnswerDecisionCommandError(
        'SUBMISSION_CONFLICT',
        'Submission identity was concurrently used'
      );
    }
    if (!isCommandRequestRace(error)) throw error;
    const winner = await queryHelpers.queryOne<CommandRow>(
      `SELECT request_fingerprint, response_json
       FROM interview_answer_decision_commands
       WHERE organization_id = ? AND client_request_id = ?`,
      [input.organizationId, input.clientRequestId]
    );
    if (winner?.request_fingerprint === fingerprint) return parseReplay(winner);
    throw new InterviewAnswerDecisionCommandError(
      'IDEMPOTENCY_CONFLICT',
      'Client request ID was concurrently used with another payload'
    );
  }
}

/**
 * Returns the current per-question approval projection without exposing the
 * immutable answer snapshot. Callers must apply the existing Interview
 * assignment review-access and anonymity rules before returning this data.
 */
export async function readInterviewAnswerApprovalProjection(input: {
  organizationId: string;
  assignmentId: string;
}): Promise<InterviewAnswerApprovalProjection[]> {
  if (!isInterviewAnswerApprovalEnvironmentEnabled()) return [];
  if (!nonBlank(input.organizationId) || !nonBlank(input.assignmentId)) {
    throw new InterviewAnswerDecisionCommandError(
      'COMMAND_INVALID',
      'Organization and assignment identity are required'
    );
  }
  const assignment = await queryHelpers.queryOne<{ id: string }>(
    `SELECT id FROM interview_assignments WHERE organization_id = ? AND id = ?`,
    [input.organizationId, input.assignmentId]
  );
  if (!assignment) {
    throw new InterviewAnswerDecisionCommandError(
      'ASSIGNMENT_NOT_FOUND',
      'Interview assignment was not found in this organization'
    );
  }
  const rows = await queryHelpers.queryAll<ExistingDecisionRow & { submission_id: string }>(
    `SELECT d.id, d.assignment_id, d.question_id, d.submission_id, d.answer_updated_at,
            d.answer_digest, d.ordinal, d.event_type, d.stage, d.decision, d.reason,
            d.policy_mode, d.policy_version, d.policy_snapshot_json, d.actor_type,
            d.actor_id, d.created_at, c.assignment_sequence
     FROM interview_answer_decisions d
     JOIN interview_answer_decision_commands c
       ON c.organization_id = d.organization_id AND c.id = d.command_id
     WHERE d.organization_id = ? AND d.assignment_id = ?
     ORDER BY d.question_id, c.assignment_sequence, d.ordinal, d.id`,
    [input.organizationId, input.assignmentId]
  );
  const byQuestion = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byQuestion.get(row.question_id) ?? [];
    list.push(row);
    byQuestion.set(row.question_id, list);
  }
  const projection: InterviewAnswerApprovalProjection[] = [];
  for (const [questionId, questionRows] of [...byQuestion.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const latestSubmitted = [...questionRows]
      .filter((row) => row.event_type === 'submitted')
      .sort((left, right) => {
        const sequence = Number(left.assignment_sequence) - Number(right.assignment_sequence);
        return sequence || left.id.localeCompare(right.id);
      })
      .at(-1);
    if (!latestSubmitted) continue;
    const policy = resolveInterviewAnswerApprovalPolicy(latestSubmitted.policy_snapshot_json);
    if (
      policy.compatibility !== 'supported' ||
      !policy.enabled ||
      policy.mode !== latestSubmitted.policy_mode ||
      policy.configuredVersion !== Number(latestSubmitted.policy_version)
    ) {
      throw new InterviewAnswerDecisionCommandError(
        'POLICY_UNSUPPORTED',
        'Submitted answer policy snapshot is invalid'
      );
    }
    const currentRows = questionRows.filter(
      (row) => row.submission_id === latestSubmitted.submission_id
    );
    const decisions = currentRows
      .filter(
        (
          row
        ): row is typeof row & {
          stage: InterviewAnswerApprovalStage;
          decision: InterviewAnswerApprovalDecision;
        } => Boolean(row.stage && row.decision)
      )
      .map((row) => ({
        receiptId: row.id,
        ordinal: Number(row.ordinal),
        stage: row.stage,
        decision: row.decision,
      }));
    const progress = deriveInterviewAnswerApprovalProgress(policy, decisions);
    const latestDecisionRow = [...currentRows]
      .filter((row) => row.stage && row.decision)
      .sort(
        (left, right) =>
          Number(left.ordinal) - Number(right.ordinal) || left.id.localeCompare(right.id)
      )
      .at(-1);
    const answerUpdatedAt = instant(latestSubmitted.answer_updated_at);
    if (!answerUpdatedAt) {
      throw new InterviewAnswerDecisionCommandError(
        'ANSWER_REVISION_CONFLICT',
        'Submitted answer revision timestamp is invalid'
      );
    }
    projection.push({
      questionId,
      submissionId: latestSubmitted.submission_id,
      answerUpdatedAt,
      answerDigest: latestSubmitted.answer_digest,
      policyMode: policy.mode,
      policyVersion: policy.configuredVersion ?? 1,
      status: progress.status,
      nextStage: progress.nextStage,
      latestDecision: latestDecisionRow?.decision ?? null,
      reason: latestDecisionRow?.reason ?? null,
      decidedAt: instant(latestDecisionRow?.created_at) ?? null,
      actor:
        latestDecisionRow?.actor_type && nonBlank(latestDecisionRow.actor_id)
          ? { type: latestDecisionRow.actor_type, id: latestDecisionRow.actor_id }
          : null,
    });
  }
  return projection;
}
