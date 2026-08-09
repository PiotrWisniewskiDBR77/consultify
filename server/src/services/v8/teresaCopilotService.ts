/**
 * P08-B — Teresa Copilot Service
 *
 * Runtime logic for the Teresa contextual copilot:
 *   - Proposal lifecycle (create → approve → execute → complete/reject)
 *   - Cross-surface handoff to 5 P0 targets (Radar/Inicjatywy/Kalendarz/Notatki/Wywiady)
 *   - Audit trail for every action
 *   - Voice posture resolution
 *   - Anti-duplicate gate
 *   - Degraded scenario handling
 *
 * Teresa is NOT an autonomous engine. She proposes, the user approves,
 * the target module executes. No silent writes.
 */

import { randomUUID } from 'node:crypto';

import type { OperationContract } from '../../types/operationContract.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { ensureRunForAction, recordAIRunEvent } from '../aiRunLedgerService.js';
import {
  applyWorkbookCommand,
  undoWorkbookCommand,
  WorkbookCommandError,
} from '../workbook/workbookCommandService.js';
import type { WorkbookMutation } from '../workbook/workbookMutationEngine.js';
import {
  buildProposalOperationContract,
  updateOperationContractLinks,
} from './operationContractService.js';
import {
  type ActionEnvelopeState,
  type HandoffTargetModule,
  isValidEnvelopeTransition,
  P08_ACTION_ENVELOPE_STATES,
  P08_COPILOT_CONTRACT,
  P08_DEGRADED_SCENARIOS,
  P08_HANDOFF_TARGET_MODULES,
  resolveVoiceAvailability,
  type TeresaHandoffContext,
  validateHandoffContext,
  validateTargetPayload,
  validateWriteOwnership,
  type VoiceAvailability,
} from './teresaCopilotCanon.js';
import { extractReminder } from './teresaReminderExtraction.js';

const LOG_PREFIX = '[P08-TeresaCopilot]';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProposalRecord {
  id: string;
  organization_id: string;
  user_id: string;
  session_id: string;
  state: ActionEnvelopeState;
  handoff_context: TeresaHandoffContext;
  target_module: HandoffTargetModule;
  target_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  audit_trail: AuditEntry[];
  operation_contract: OperationContract;
}

export interface AuditEntry {
  id: string;
  proposal_id: string;
  action: string;
  actor: string;
  timestamp: string;
  from_state: ActionEnvelopeState | null;
  to_state: ActionEnvelopeState;
  detail: Record<string, unknown> | null;
}

export interface HandoffResult {
  success: boolean;
  proposal_id: string;
  target_module: HandoffTargetModule;
  state: ActionEnvelopeState;
  audit_entry_id: string;
  handoff_result?: Record<string, unknown>;
  degraded?: string;
  error?: string;
}

export interface VoicePostureResult {
  availability: VoiceAvailability;
  fallback_active: boolean;
  recovery_phrase: string | null;
}

export interface TeresaChatProposalEnvelope {
  proposalId: string;
  contractId: string;
  title: string;
  summary: string;
  state: ActionEnvelopeState;
  approvalState: 'awaiting_review' | 'approved' | 'completed' | 'rejected';
  allowedActions: Array<'approve' | 'reject' | 'execute' | 'undo' | 'navigate'>;
  targetModule: HandoffTargetModule;
  targetLabel: string;
  handoffIntent: string;
  previewLines: string[];
  auditCount: number;
  resultRef: string | null;
  degraded: string | null;
  operationContract: OperationContract;
}

export class TeresaCopilotError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = 'TeresaCopilotError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const CHAT_ACTION_KEYWORDS: Array<{
  targetModule: HandoffTargetModule;
  handoffIntent: string;
  patterns: RegExp[];
}> = [
  {
    // #21 „zapamiętaj / przypomnij mi" — sekretarz zapisuje ustalenie do
    // Notatnika (opcjonalny termin ekstrahowany osobno). Wpis PIERWSZY, bo
    // first-match: „przypomnij mi o spotkaniu" ma trafić do Notatnika jako
    // przypomnienie, nie do Kalendarza.
    targetModule: 'notebook',
    handoffIntent: 'remember',
    patterns: [
      /\b(remember\s+that|remind\s*me|don'?t\s+forget|note\s+to\s+self)\b/i,
      /\b(zapami[eę]taj|zapami[eę]tam|przypomnij|przypomnienie|nie\s+zapomnij|zanotuj\s+sobie)\b/i,
    ],
  },
  {
    targetModule: 'calendar',
    handoffIntent: 'schedule',
    patterns: [
      /\b(calendar|meeting|schedule|invite|appointment|book|reserve|slot|availability|free.?busy|reschedul|cancel.?meeting)\b/i,
      /\b(kalendarz|spotkanie|zaplanuj|umów|zaproszenie|zarezerwuj|termin|dostępność|wolny.?termin|odwołaj.?spotkanie|przełóż)\b/i,
    ],
  },
  {
    targetModule: 'notebook',
    handoffIntent: 'draft',
    patterns: [
      /\b(note|notes|notebook|summary|minutes|brief|document|draft|write.?down|capture|jot|memo|record)\b/i,
      /\b(notatk|notebook|podsumowanie|protok[oó]ł|brief|dokument|szkic|zapisz|zanotuj|memo|streszcz)\b/i,
    ],
  },
  {
    targetModule: 'initiatives',
    handoffIntent: 'create',
    patterns: [
      /\b(initiative|roadmap|plan|execution|project|proposal|strategy|goal|objective|milestone|backlog|sprint)\b/i,
      /\b(inicjatyw|roadmap|plan|wdroż|projekt|propozycj|strategi|cel|kamień.?milowy|backlog|sprint)\b/i,
    ],
  },
  {
    targetModule: 'radar',
    handoffIntent: 'triage',
    patterns: [
      /\b(risk|radar|signal|alert|watch|monitor|escalat|warn|threat|blocker|impediment|issue|problem|incident)\b/i,
      /\b(ryzyk|radar|sygnał|alert|monitor|eskaluj|ostrzeż|zagrożen|bloker|przeszkod|problem|incydent)\b/i,
    ],
  },
  {
    targetModule: 'interview',
    handoffIntent: 'open',
    patterns: [
      /\b(insight|insights|interview|findings|generate.?insight|review.?insight|publish.?insight|evidence.?map|completed.?session)\b/i,
      /\b(wywiad|wywiady|wygeneruj.?wnioski|recenzja|recenzuj|opublikuj.?wnioski|mapa.?dowodów|zakończon.?sesj)\b/i,
    ],
  },
  {
    targetModule: 'excele',
    handoffIntent: 'generate',
    patterns: [
      /\b(workbook|excel\s*file|financial.?model|budget.?plan|balance.?sheet|cash.?flow|p\s*&\s*l|profit.?loss|multi.?sheet|xlsx|table|tables|table\s*studio|spreadsheet|grid|canvas\s*table|table\s*in\s*canvas)\b/i,
      /\b(skoroszyt|plik\s*excel|model.?finansowy|plan.?budżet|bilans|przepływy?.?pienięż|rachunek.?zysków|arkusz.?kalkulacyjny|tabel\w*|table\s*studio|siatk\w*|tabel\w*\s*w\s*canvas|canvas\s*tabel\w*|kanwa\s*tabel\w*)\b/i,
    ],
  },
];

const TARGET_LABELS: Partial<Record<HandoffTargetModule, string>> = {
  radar: 'Radar',
  initiatives: 'Initiatives',
  calendar: 'Calendar',
  notebook: 'Notebook',
  interview: 'Interview Insights',
  excele: 'Excele Workbooks',
  documents: 'Document Studio',
};

// ---------------------------------------------------------------------------
// DB schema — auto-create tables on first use
// ---------------------------------------------------------------------------

let tablesEnsured = false;

/** @internal — used by tests to reset the table-ensured cache */
export function _resetTableCache(): void {
  tablesEnsured = false;
}

async function ensureTeresaTables(): Promise<void> {
  if (tablesEnsured) return;
  try {
    await dbRun(
      `CREATE TABLE IF NOT EXISTS teresa_proposals (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'proposal',
        handoff_context_json TEXT NOT NULL DEFAULT '{}',
        target_module TEXT NOT NULL,
        target_payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      [],
      { fallback: false }
    );
    await dbRun(
      `CREATE TABLE IF NOT EXISTS teresa_audit_log (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL DEFAULT 'teresa',
        timestamp TEXT NOT NULL,
        from_state TEXT,
        to_state TEXT,
        detail_json TEXT DEFAULT '{}',
        FOREIGN KEY (proposal_id) REFERENCES teresa_proposals(id)
      )`,
      [],
      { fallback: false }
    );
    await dbRun(
      `CREATE TABLE IF NOT EXISTS teresa_handoff_results (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        target_module TEXT NOT NULL,
        result_ref TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (proposal_id) REFERENCES teresa_proposals(id)
      )`,
      [],
      { fallback: false }
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_teresa_proposals_session
       ON teresa_proposals(organization_id, user_id, session_id)`,
      [],
      { fallback: true }
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_teresa_audit_proposal
       ON teresa_audit_log(proposal_id)`,
      [],
      { fallback: true }
    );
    tablesEnsured = true;
    logger.info(`${LOG_PREFIX} Teresa DB tables ensured`);
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} Table creation failed (may already exist): ${(err as Error).message}`
    );
    tablesEnsured = true;
  }
}

// ---------------------------------------------------------------------------
// DB helpers (table: teresa_proposals, teresa_audit_log)
// ---------------------------------------------------------------------------

interface ProposalRow {
  id: string;
  organization_id: string;
  user_id: string;
  session_id: string;
  state: string;
  handoff_context_json: string;
  target_module: string;
  target_payload_json: string;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  proposal_id: string;
  action: string;
  actor: string;
  timestamp: string;
  from_state: string | null;
  to_state: string;
  detail_json: string | null;
}

function rowToProposal(row: ProposalRow, auditRows: AuditRow[] = []): ProposalRecord {
  const proposal = {
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    session_id: row.session_id,
    state: row.state as ActionEnvelopeState,
    handoff_context: JSON.parse(row.handoff_context_json),
    target_module: row.target_module as HandoffTargetModule,
    target_payload: JSON.parse(row.target_payload_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
    audit_trail: auditRows.map(rowToAuditEntry),
  } satisfies Omit<ProposalRecord, 'operation_contract'>;

  return {
    ...proposal,
    operation_contract: buildTeresaOperationContract(proposal),
  };
}

function rowToAuditEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    proposal_id: row.proposal_id,
    action: row.action,
    actor: row.actor,
    timestamp: row.timestamp,
    from_state: row.from_state as ActionEnvelopeState | null,
    to_state: row.to_state as ActionEnvelopeState,
    detail: row.detail_json ? JSON.parse(row.detail_json) : null,
  };
}

function mapTeresaStateToAIActionStatus(state: ActionEnvelopeState): string {
  switch (state) {
    case 'approved':
      return 'APPROVED';
    case 'executing':
      return 'EXECUTING';
    case 'completed':
      return 'EXECUTED';
    case 'undone':
      return 'REJECTED';
    case 'rejected':
      return 'REJECTED';
    case 'proposal':
    case 'pending_approval':
    default:
      return 'PENDING';
  }
}

function mapTeresaStateToAIRunStatus(
  state: ActionEnvelopeState
): 'pending_review' | 'approved' | 'executing' | 'audited' | 'rejected' {
  switch (state) {
    case 'approved':
      return 'approved';
    case 'executing':
      return 'executing';
    case 'completed':
      return 'audited';
    case 'undone':
      return 'audited';
    case 'rejected':
      return 'rejected';
    case 'proposal':
    case 'pending_approval':
    default:
      return 'pending_review';
  }
}

function teresaActionType(targetModule: HandoffTargetModule): string {
  return `TERESA_HANDOFF_${String(targetModule || 'unknown').toUpperCase()}`;
}

async function ensureAIActionMirrorSchema(): Promise<void> {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS ai_actions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      organization_id TEXT,
      project_id TEXT,
      action_type TEXT,
      payload TEXT,
      draft_content TEXT,
      required_policy_level TEXT,
      current_policy_level TEXT,
      requires_approval INTEGER DEFAULT 0,
      status TEXT DEFAULT 'PENDING',
      approved_at TIMESTAMP,
      approved_by TEXT,
      executed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    [],
    { fallback: false }
  );
}

function eventTypeForTeresaState(state: ActionEnvelopeState): string {
  switch (state) {
    case 'approved':
      return 'proposal_approved';
    case 'executing':
      return 'execution_started';
    case 'completed':
      return 'execution_succeeded';
    case 'undone':
      return 'execution_undone';
    case 'rejected':
      return 'execution_failed';
    case 'proposal':
    case 'pending_approval':
    default:
      return 'proposal_pending_review';
  }
}

async function mirrorTeresaProposalToAIRun(input: {
  proposalId: string;
  organizationId: string;
  userId: string;
  sessionId: string;
  state: ActionEnvelopeState;
  targetModule: HandoffTargetModule;
  targetPayload: Record<string, unknown>;
  handoffContext: TeresaHandoffContext;
  eventType: string;
  actorUserId?: string | null;
  details?: Record<string, unknown>;
  outputRefs?: unknown[];
  audit?: Record<string, unknown>;
}): Promise<void> {
  try {
    await ensureAIActionMirrorSchema();
    const actionType = teresaActionType(input.targetModule);
    const actionStatus = mapTeresaStateToAIActionStatus(input.state);
    const payload = {
      source: 'teresa_proposal',
      proposalId: input.proposalId,
      targetModule: input.targetModule,
      targetPayload: input.targetPayload,
      trigger: input.handoffContext.user_intent || 'teresa_handoff',
      conversationId: input.handoffContext.runtime_binding?.conversation_id || input.sessionId,
      noSilentExecution: true,
    };
    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM ai_actions WHERE id = ?`,
      [input.proposalId],
      { fallback: false }
    );

    if (existing?.id) {
      await dbRun(
        `UPDATE ai_actions
         SET status = ?, payload = ?, draft_content = ?, approved_at = CASE WHEN ? = 'APPROVED' THEN COALESCE(approved_at, CURRENT_TIMESTAMP) ELSE approved_at END,
             executed_at = CASE WHEN ? = 'EXECUTED' THEN COALESCE(executed_at, CURRENT_TIMESTAMP) ELSE executed_at END
         WHERE id = ?`,
        [
          actionStatus,
          JSON.stringify(payload),
          JSON.stringify(input.targetPayload || {}),
          actionStatus,
          actionStatus,
          input.proposalId,
        ],
        { fallback: false }
      );
    } else {
      await dbRun(
        `INSERT INTO ai_actions
          (id, user_id, organization_id, project_id, action_type, payload, draft_content,
           required_policy_level, current_policy_level, requires_approval, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.proposalId,
          input.userId,
          input.organizationId,
          null,
          actionType,
          JSON.stringify(payload),
          JSON.stringify(input.targetPayload || {}),
          'TEAM',
          'TEAM',
          1,
          actionStatus,
        ],
        { fallback: false }
      );
    }

    const actionRow = {
      id: input.proposalId,
      user_id: input.userId,
      organization_id: input.organizationId,
      project_id: null,
      action_type: actionType,
      payload: JSON.stringify(payload),
      draft_content: JSON.stringify(input.targetPayload || {}),
      status: actionStatus,
      current_policy_level: 'TEAM',
      created_at: null,
      approved_at: actionStatus === 'APPROVED' ? new Date().toISOString() : null,
      executed_at: actionStatus === 'EXECUTED' ? new Date().toISOString() : null,
    };

    await ensureRunForAction(actionRow);
    await recordAIRunEvent({
      action: actionRow,
      eventType: input.eventType,
      status: mapTeresaStateToAIRunStatus(input.state),
      actorUserId: input.actorUserId || input.userId,
      details: {
        source: 'teresa_proposal',
        targetModule: input.targetModule,
        proposalState: input.state,
        ...(input.details || {}),
      },
      outputRefs: input.outputRefs,
      audit: {
        approvalRequired: true,
        noSilentExecution: true,
        approvalSeparation: true,
        teresaProposalId: input.proposalId,
        ...(input.audit || {}),
      },
    });
  } catch (err: any) {
    logger.warn(`${LOG_PREFIX} AIRun mirror skipped: ${err?.message || String(err)}`);
  }
}

export async function repairTeresaAIRunMirrorsForActionCenter(params: {
  organizationId: string;
  userId?: string | null;
  adminView?: boolean;
  limit?: number;
}): Promise<{ scanned: number; repaired: number }> {
  await ensureTeresaTables();
  const filters = ['organization_id = ?'];
  const values: unknown[] = [params.organizationId];
  if (!params.adminView && params.userId) {
    filters.push('user_id = ?');
    values.push(params.userId);
  }
  values.push(Math.min(Math.max(params.limit || 100, 1), 250));

  const rows = await dbAll<ProposalRow>(
    `SELECT * FROM teresa_proposals
     WHERE ${filters.join(' AND ')}
     ORDER BY updated_at DESC
     LIMIT ?`,
    values,
    { fallback: true }
  );

  let repaired = 0;
  for (const row of rows || []) {
    try {
      await mirrorTeresaProposalToAIRun({
        proposalId: row.id,
        organizationId: row.organization_id,
        userId: row.user_id,
        sessionId: row.session_id,
        state: row.state as ActionEnvelopeState,
        targetModule: row.target_module as HandoffTargetModule,
        targetPayload: JSON.parse(row.target_payload_json || '{}'),
        handoffContext: JSON.parse(row.handoff_context_json || '{}'),
        eventType: eventTypeForTeresaState(row.state as ActionEnvelopeState),
        actorUserId: row.user_id,
        details: { source: 'action_center_repair_backfill' },
        audit: {
          repairedForActionCenter: true,
          repairedAt: new Date().toISOString(),
        },
      });
      repaired += 1;
    } catch (err: any) {
      logger.warn(`${LOG_PREFIX} Action Center mirror backfill skipped`, {
        proposalId: row.id,
        error: err?.message || String(err),
      });
    }
  }

  return { scanned: rows?.length || 0, repaired };
}

function trimPreview(value: unknown, max = 180): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function deriveProposalTitle(message: string, targetModule: HandoffTargetModule): string {
  const cleaned = trimPreview(message, 72).replace(/[.!?]+$/g, '');
  if (cleaned) return cleaned;
  return `Open ${TARGET_LABELS[targetModule] ?? targetModule}`;
}

function deriveApprovalState(
  state: ActionEnvelopeState
): TeresaChatProposalEnvelope['approvalState'] {
  if (state === 'approved') return 'approved';
  if (state === 'completed' || state === 'undone') return 'completed';
  if (state === 'rejected') return 'rejected';
  return 'awaiting_review';
}

function deriveAllowedActions(
  proposal: ProposalRecord
): TeresaChatProposalEnvelope['allowedActions'] {
  switch (proposal.state) {
    case 'proposal':
    case 'pending_approval':
      return ['approve', 'reject', 'navigate'];
    case 'approved':
      return ['execute', 'reject', 'navigate'];
    case 'completed': {
      const execution = [...proposal.audit_trail]
        .reverse()
        .find((entry) => entry.action === 'execution_completed');
      const handoff = execution?.detail?.handoff_result;
      const canUndoWorkbook =
        proposal.target_module === 'excele' &&
        !!handoff &&
        typeof handoff === 'object' &&
        (handoff as Record<string, unknown>).mutation_applied === true &&
        Number.isInteger((handoff as Record<string, unknown>).version);
      return canUndoWorkbook ? ['undo', 'navigate'] : ['navigate'];
    }
    case 'executing':
    case 'undone':
    case 'rejected':
      return ['navigate'];
    default:
      return ['navigate'];
  }
}

function extractResultRef(detail: Record<string, unknown> | null | undefined): string | null {
  if (!detail || typeof detail !== 'object') return null;
  const handoff = detail.handoff_result;
  if (!handoff || typeof handoff !== 'object') return null;
  const keys = ['signal_id', 'initiative_ref', 'calendar_ref', 'note_ref', 'insight_ref'];
  for (const key of keys) {
    const value = (handoff as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function buildPreviewLines(
  proposal: ProposalRecord | Omit<ProposalRecord, 'operation_contract'>,
  execution?: HandoffResult | null
): string[] {
  const lines: string[] = [];
  const payload = proposal.target_payload || {};
  const target = proposal.target_module;

  if (target === 'initiatives') {
    const seed = (payload.initiative_seed || {}) as Record<string, unknown>;
    lines.push(trimPreview(seed.problem_statement || proposal.handoff_context.user_intent, 120));
    lines.push(trimPreview(seed.proposed_outcome || 'Draft initiative prepared for review', 120));
  } else if (target === 'notebook') {
    const notebook = (payload.notebook_handoff_context || {}) as Record<string, unknown>;
    lines.push(trimPreview(notebook.title || proposal.handoff_context.user_intent, 120));
    lines.push(
      trimPreview(notebook.body_preview || 'Draft note will be prepared after approval', 120)
    );
    const reminder = (notebook.reminder || null) as { dueAt?: string; term?: string } | null;
    if (reminder && (reminder.dueAt || reminder.term)) {
      const when = reminder.dueAt
        ? new Date(reminder.dueAt).toLocaleDateString('pl-PL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : reminder.term;
      lines.push(
        trimPreview(`Przypomnienie: ${reminder.term ? `${reminder.term} · ` : ''}${when}`, 120)
      );
    }
  } else if (target === 'calendar') {
    const calendar = (payload.calendar_intent || {}) as Record<string, unknown>;
    lines.push(trimPreview(calendar.what || proposal.handoff_context.user_intent, 120));
    lines.push(trimPreview(calendar.when || 'Scheduling slot will be confirmed on execute', 120));
  } else if (target === 'interview') {
    const interviewCtx = (payload.interview_handoff_context || {}) as Record<string, unknown>;
    lines.push(trimPreview(interviewCtx.title || proposal.handoff_context.user_intent, 120));
    lines.push(trimPreview(interviewCtx.action || 'Open Interview Insights module', 120));
  } else {
    lines.push(trimPreview(payload.why_now || proposal.handoff_context.user_intent, 120));
    lines.push(
      trimPreview(payload.next_action_safe_fallback || 'Escalate through Teresa handoff', 120)
    );
  }

  if (execution?.success) {
    const ref = extractResultRef({ handoff_result: execution });
    if (ref) lines.push(trimPreview(ref, 120));
  }

  return lines.filter(Boolean).slice(0, 3);
}

function mapEnvelopeStateToOperationStage(state: ActionEnvelopeState): OperationContract['stage'] {
  switch (state) {
    case 'proposal':
      return 'proposal_ready';
    case 'pending_approval':
      return 'pending_review';
    case 'approved':
      return 'approved';
    case 'executing':
      return 'executing';
    case 'completed':
      return 'completed';
    case 'undone':
      return 'completed';
    case 'rejected':
      return 'rejected';
    default:
      return 'proposal_ready';
  }
}

function buildTeresaOperationContract(
  proposal: Omit<ProposalRecord, 'operation_contract'>,
  execution?: HandoffResult | null
): OperationContract {
  const runtimeBinding = proposal.handoff_context.runtime_binding || {};
  const latestAudit = proposal.audit_trail[proposal.audit_trail.length - 1] || null;
  const targetPayload = (proposal.target_payload || {}) as Record<string, unknown>;
  const existingId = proposal.handoff_context.operation_contract_ref || null;
  const baseContract = buildProposalOperationContract({
    contractId: existingId || proposal.id,
    kind: 'teresa_handoff',
    stage: mapEnvelopeStateToOperationStage(proposal.state),
    createdAt: proposal.created_at,
    updatedAt: proposal.updated_at,
    organizationId: proposal.organization_id,
    userId: proposal.user_id,
    sessionId: proposal.session_id,
    conversationId:
      typeof runtimeBinding.conversation_id === 'string' ? runtimeBinding.conversation_id : null,
    contextSnapshotId:
      typeof runtimeBinding.context_snapshot_id === 'string'
        ? runtimeBinding.context_snapshot_id
        : null,
    executionRunId:
      typeof runtimeBinding.execution_run_id === 'string' ? runtimeBinding.execution_run_id : null,
    artifactRunId:
      typeof runtimeBinding.artifact_run_id === 'string' ? runtimeBinding.artifact_run_id : null,
    toolInvocationId:
      typeof runtimeBinding.tool_invocation_id === 'string'
        ? runtimeBinding.tool_invocation_id
        : null,
    teresaProposalId: proposal.id,
    targetModule: proposal.target_module,
    title: deriveProposalTitle(proposal.handoff_context.user_intent, proposal.target_module),
    summary: trimPreview(
      proposal.handoff_context.proposed_next_action?.handoff_intent ||
        proposal.handoff_context.user_intent,
      160
    ),
    intent: proposal.handoff_context.user_intent,
    previewLines: buildPreviewLines(proposal, execution),
  });

  const resultRef = extractResultRef(latestAudit?.detail) || execution?.audit_entry_id || null;
  if (!resultRef) return baseContract;

  return updateOperationContractLinks(baseContract, {
    artifactId:
      typeof targetPayload.artifact_id === 'string'
        ? targetPayload.artifact_id
        : baseContract.links.artifactId,
  });
}

export function toChatProposalEnvelope(
  proposal: ProposalRecord,
  execution?: HandoffResult | null
): TeresaChatProposalEnvelope {
  const latestAudit = proposal.audit_trail[proposal.audit_trail.length - 1] || null;
  const operationContract = buildTeresaOperationContract(proposal, execution);
  return {
    proposalId: proposal.id,
    contractId: P08_COPILOT_CONTRACT,
    title: deriveProposalTitle(proposal.handoff_context.user_intent, proposal.target_module),
    summary: trimPreview(
      proposal.handoff_context.proposed_next_action?.handoff_intent ||
        proposal.handoff_context.user_intent,
      160
    ),
    state: proposal.state,
    approvalState: deriveApprovalState(proposal.state),
    allowedActions: deriveAllowedActions(proposal),
    targetModule: proposal.target_module,
    targetLabel: TARGET_LABELS[proposal.target_module] ?? proposal.target_module,
    handoffIntent: String(proposal.handoff_context.proposed_next_action?.handoff_intent || 'open'),
    previewLines: buildPreviewLines(proposal, execution),
    auditCount: proposal.audit_trail.length,
    resultRef: extractResultRef(latestAudit?.detail) || execution?.audit_entry_id || null,
    degraded: execution?.degraded || null,
    operationContract,
  };
}

function inferTargetModuleFromChatRegex(
  message: string,
  context: Record<string, unknown>
): { targetModule: HandoffTargetModule; handoffIntent: string } | null {
  const text = String(message || '').trim();
  if (!text) return null;

  // Strong disambiguation: explicit table/spreadsheet requests should route
  // to the Excele lane even when the sentence also mentions "risk".
  if (
    /\b(table|tables|table\s*studio|spreadsheet|excel|xlsx|grid|canvas\s*table|table\s*in\s*canvas)\b/i.test(
      text
    ) ||
    /\b(tabel\w*|table\s*studio|arkusz\w*|siatk\w*|excel|xlsx|tabel\w*\s*w\s*canvas|canvas\s*tabel\w*|kanwa\s*tabel\w*)\b/i.test(
      text
    )
  ) {
    return { targetModule: 'excele', handoffIntent: 'generate' };
  }

  if (
    /\b(document|document studio|docx|section|paragraph)\b/i.test(text) ||
    /\b(dokument\w*|sekcj\w*|akapit\w*)\b/i.test(text)
  ) {
    return { targetModule: 'documents', handoffIntent: 'append' };
  }

  for (const candidate of CHAT_ACTION_KEYWORDS) {
    if (candidate.patterns.some((pattern) => pattern.test(text))) {
      return {
        targetModule: candidate.targetModule,
        handoffIntent: candidate.handoffIntent,
      };
    }
  }

  const moduleHint = String(
    (context.screenContext as Record<string, unknown> | undefined)?.moduleId ||
      (context.workspaceContext as Record<string, unknown> | undefined)?.type ||
      ''
  ).toLowerCase();

  if (moduleHint.includes('initiative'))
    return { targetModule: 'initiatives', handoffIntent: 'open' };
  if (moduleHint.includes('notebook') || moduleHint.includes('note'))
    return { targetModule: 'notebook', handoffIntent: 'draft' };
  if (moduleHint.includes('calendar'))
    return { targetModule: 'calendar', handoffIntent: 'schedule' };
  if (moduleHint.includes('radar') || moduleHint.includes('signal'))
    return { targetModule: 'radar', handoffIntent: 'triage' };
  if (moduleHint.includes('interview') || moduleHint.includes('insight'))
    return { targetModule: 'interview', handoffIntent: 'open' };
  if (
    moduleHint.includes('excele') ||
    moduleHint.includes('spreadsheet') ||
    moduleHint.includes('workbook')
  )
    return { targetModule: 'excele', handoffIntent: 'generate' };
  if (moduleHint.includes('document') || moduleHint.includes('doc-studio'))
    return { targetModule: 'documents', handoffIntent: 'append' };

  return null;
}

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for Teresa, an internal copilot.
Given a user message, determine if it contains an actionable intent for one of these modules:
- radar: risk signals, alerts, threats, blockers, escalations, incidents
- initiatives: projects, plans, roadmaps, strategies, goals, sprints, milestones
- calendar: meetings, scheduling, appointments, availability, deadlines
- notebook: notes, summaries, minutes, drafts, memos, documentation
- interview: insights from interviews, generate insights, review insights, findings, evidence map, completed sessions
- excele: spreadsheets, tables, Table Studio tables, workbooks, Excel files, financial models, budgets, P&L, balance sheets, cash flow forecasts, multi-sheet calculations, xlsx generation
- documents: edits to an opened Document Studio document, its selected text, block, or section

Respond ONLY with valid JSON: {"module":"radar"|"initiatives"|"calendar"|"notebook"|"interview"|"excele"|"documents"|null,"intent":"string describing the action"}
If the message is conversational or has no actionable intent, respond: {"module":null,"intent":"none"}`;

async function inferTargetModuleWithLLM(
  message: string
): Promise<{ targetModule: HandoffTargetModule; handoffIntent: string } | null> {
  try {
    const { llmService } = await import(/* @vite-ignore */ '../ai/llmService.js');
    const result = await (llmService as any).call({
      messages: [{ role: 'user', content: message }],
      systemPrompt: INTENT_SYSTEM_PROMPT,
      temperature: 0,
      maxTokens: 80,
      modelId: 'fast',
    });

    const text = String(result?.text || result?.content || '').trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    if (!parsed.module || parsed.module === 'null') return null;

    const mod = String(parsed.module).toLowerCase() as HandoffTargetModule;
    if (!P08_HANDOFF_TARGET_MODULES.includes(mod)) return null;

    return {
      targetModule: mod,
      handoffIntent: String(parsed.intent || 'open'),
    };
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} LLM intent detection failed, falling back to regex: ${(err as Error).message}`
    );
    return null;
  }
}

async function inferTargetModuleFromChat(
  message: string,
  context: Record<string, unknown>
): Promise<{ targetModule: HandoffTargetModule; handoffIntent: string } | null> {
  // Fast path: regex check first (instant, no network)
  const regexResult = inferTargetModuleFromChatRegex(message, context);
  if (regexResult) return regexResult;

  // Slow path: LLM classification for ambiguous messages
  const llmResult = await inferTargetModuleWithLLM(message);
  if (llmResult) return llmResult;

  return null;
}

function buildBoundedContextPack(
  context: Record<string, unknown>
): Array<{ ref: string; type: string }> {
  const pack: Array<{ ref: string; type: string }> = [];
  const workspaceContext = (context.workspaceContext || {}) as Record<string, unknown>;
  const screenContext = (context.screenContext || {}) as Record<string, unknown>;

  const candidates: Array<[unknown, string]> = [
    [workspaceContext.entityId, String(workspaceContext.type || 'workspace')],
    [workspaceContext.projectId, 'project'],
    [screenContext.entityId, String(screenContext.entityType || 'screen')],
    [screenContext.currentScreen, 'screen'],
  ];

  for (const [ref, type] of candidates) {
    if (typeof ref === 'string' && ref.trim().length > 0) {
      pack.push({ ref: ref.trim(), type: type || 'context' });
    }
  }

  return pack.slice(0, 5);
}

interface WorkbookChatContext {
  workbook_id: string;
  version_id: number | null;
  active_sheet_index: number | null;
  active_sheet_name: string | null;
  classification: string | null;
  selection: Record<string, unknown> | null;
}

interface WorkbookMutationProposal {
  command_id: string;
  operations: WorkbookMutation[];
}

/** Parse only an explicit fenced mutation diff; prose and loose JSON stay non-executable. */
function extractWorkbookMutationProposal(
  assistantMessage: string
): WorkbookMutationProposal | null {
  if (!assistantMessage || assistantMessage.length > 100_000) return null;
  const fencedBlocks = assistantMessage.matchAll(/```(?:json|workbook-mutation)\s*([\s\S]*?)```/gi);
  for (const match of fencedBlocks) {
    try {
      const parsed = JSON.parse(match[1]) as Record<string, unknown>;
      const candidate =
        parsed.workbook_mutation &&
        typeof parsed.workbook_mutation === 'object' &&
        !Array.isArray(parsed.workbook_mutation)
          ? (parsed.workbook_mutation as Record<string, unknown>)
          : parsed;
      if (!Array.isArray(candidate.operations) || candidate.operations.length === 0) continue;
      if (candidate.operations.length > 500) continue;
      if (candidate.operations.some((operation) => !operation || typeof operation !== 'object')) {
        continue;
      }
      return {
        command_id:
          typeof candidate.command_id === 'string' && candidate.command_id.trim()
            ? candidate.command_id.trim()
            : 'teresa.workbook.applyProposal',
        operations: candidate.operations as WorkbookMutation[],
      };
    } catch {
      // A malformed block cannot become a write. A later valid block may still be used.
    }
  }
  return null;
}

function extractWorkbookChatContext(context: Record<string, unknown>): WorkbookChatContext | null {
  const workspace = (context.workspaceContext || {}) as Record<string, unknown>;
  const screen = (context.screenContext || {}) as Record<string, unknown>;
  const workspaceData = (workspace.entityData || {}) as Record<string, unknown>;
  const screenData = (screen.page || {}) as Record<string, unknown>;
  const data = Object.keys(workspaceData).length > 0 ? workspaceData : screenData;
  const artifactType = String(data.artifactType || '').toLowerCase();
  const workspaceType = String(workspace.type || screen.selectedObjectType || '').toLowerCase();
  const workbookId = String(
    data.workbookId || workspace.entityId || screen.selectedObjectId || ''
  ).trim();

  if (!workbookId || (artifactType !== 'spreadsheet' && workspaceType !== 'workbook')) {
    return null;
  }

  const versionValue = Number(data.versionId);
  const sheetIndexValue = Number(data.activeSheetIndex);
  const rawSelection = data.selection;
  const selection =
    rawSelection && typeof rawSelection === 'object' && !Array.isArray(rawSelection)
      ? (rawSelection as Record<string, unknown>)
      : null;

  return {
    workbook_id: workbookId,
    version_id: Number.isInteger(versionValue) && versionValue >= 0 ? versionValue : null,
    active_sheet_index:
      Number.isInteger(sheetIndexValue) && sheetIndexValue >= 0 ? sheetIndexValue : null,
    active_sheet_name:
      typeof data.activeSheetName === 'string' && data.activeSheetName.trim()
        ? data.activeSheetName.trim()
        : null,
    classification:
      typeof data.classification === 'string' && data.classification.trim()
        ? data.classification.trim()
        : null,
    selection,
  };
}

/**
 * Prompt contract for the global Teresa surface when an opened workbook is in scope.
 * The model may describe any analysis in normal prose, but a state-changing proposal
 * becomes executable only through the fenced, separately validated mutation block.
 */
export function buildWorkbookMutationPromptHint(context: Record<string, unknown>): string {
  const workbook = extractWorkbookChatContext(context);
  if (!workbook) return '';

  const selectionAddress =
    workbook.selection && typeof workbook.selection.address === 'string'
      ? workbook.selection.address.trim()
      : '';
  return [
    '## OPEN WORKBOOK — GOVERNED MUTATION CONTRACT',
    `Workbook: ${workbook.workbook_id}; immutable base version: ${workbook.version_id ?? 'UNKNOWN'}.`,
    workbook.active_sheet_name
      ? `Active sheet: ${workbook.active_sheet_name} (index ${workbook.active_sheet_index ?? 'UNKNOWN'}).`
      : '',
    selectionAddress ? `Explicit user selection: ${selectionAddress}.` : '',
    'For analysis, explanation, or questions, answer normally and DO NOT emit a mutation block.',
    'If and only if the user explicitly requests a workbook change and the supplied context contains every required coordinate or stable sheet id, provide a short human summary followed by exactly one fenced `workbook-mutation` JSON block.',
    'The block shape is: {"command_id":"teresa.workbook.applyProposal","operations":[...]}.',
    'Allowed operation types: setCell, clearCell, addSheet, renameSheet, duplicateSheet, deleteSheet, reorderSheet, setSheetHidden, insertRows, deleteRows, insertColumns, deleteColumns, setCellStyle.',
    'Use zero-based sheetIndex, rowIndex, startRow/endRow and startColumn/endColumn; use the real columnKey or stable sheetId from context. Never invent workbook ids, sheet ids, coordinates, source values, formulas, or evidence.',
    'If required coordinates, ids, permissions, or values are missing, explain what is missing and DO NOT emit the block.',
    'Never claim the mutation was applied. It remains a proposal until the user approves and explicitly executes it; the server will revalidate version, permissions, operation schema, and atomicity.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildTargetPayloadForChat(params: {
  targetModule: HandoffTargetModule;
  userMessage: string;
  assistantMessage: string;
  context: Record<string, unknown>;
}): Record<string, unknown> {
  const { targetModule, userMessage, assistantMessage, context } = params;
  const preview = trimPreview(assistantMessage || userMessage, 220);
  const title = deriveProposalTitle(userMessage, targetModule);

  if (targetModule === 'initiatives') {
    return {
      initiative_seed: {
        problem_statement: trimPreview(userMessage, 180),
        proposed_outcome: trimPreview(
          assistantMessage || 'Prepare initiative draft for review',
          180
        ),
        assumptions: ['Confirm scope with user before module write'],
        risks: ['Proposal may need additional business context'],
        next_steps: ['Review proposal', 'Approve to open initiative lane'],
        time_window: 'next-available',
      },
      proposal_only: true,
    };
  }

  if (targetModule === 'calendar') {
    return {
      calendar_intent: {
        what: title,
        when: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timezone: 'Europe/Warsaw',
      },
      permission_gradient_expectation: 'write',
      conflict_safe_write_posture: 'if_match_etag',
      recovery_steps: ['Confirm attendees and time slot before final write'],
    };
  }

  if (targetModule === 'notebook') {
    // #21: jeśli użytkownik powiedział „przypomnij mi …", wyliczamy termin i
    // dokładamy go do notatki (persist w capture_metadata.reminder — bez migracji).
    const reminder = extractReminder(userMessage);
    return {
      notebook_handoff_context: {
        title,
        body_preview: preview,
        source: 'teresa',
        ...(reminder.dueAt || reminder.term
          ? { reminder: { dueAt: reminder.dueAt, term: reminder.term } }
          : {}),
      },
      provenance_markers: { source: 'teresa', user_edit: false, ai_transform: true },
      evidence_pointers: ['chat:teresa'],
    };
  }

  if (targetModule === 'interview') {
    return {
      interview_handoff_context: {
        action: 'generate_insight',
        title: title || 'Interview insight from Teresa',
      },
      evidence_pointers: ['chat:teresa'],
    };
  }

  if (targetModule === 'excele') {
    const workbookContext = extractWorkbookChatContext(context);
    const workbookMutation = extractWorkbookMutationProposal(assistantMessage);
    const selectionAddress =
      workbookContext?.selection && typeof workbookContext.selection.address === 'string'
        ? workbookContext.selection.address.trim()
        : '';
    return {
      prompt: trimPreview(userMessage || assistantMessage || title, 220),
      why_now: trimPreview(userMessage, 160),
      time_window: 'next-available',
      evidence_pointers: [
        'chat:teresa',
        ...(workbookContext ? [`workbook:${workbookContext.workbook_id}`] : []),
        ...(selectionAddress ? [`selection:${selectionAddress}`] : []),
      ],
      proposal_only: true,
      requires_structured_mutation: true,
      ...(workbookContext ? { workbook_context: workbookContext } : {}),
      ...(workbookMutation ? { workbook_mutation: workbookMutation } : {}),
      next_action_safe_fallback:
        'Apply an approved, version-checked workbook command; never fabricate a workbook reference',
    };
  }

  if (targetModule === 'documents') {
    const workspace = (context.workspaceContext || {}) as Record<string, unknown>;
    const entityData = (workspace.entityData || {}) as Record<string, unknown>;
    const selection = (entityData.selection || {}) as Record<string, unknown>;
    const artifactId = String(entityData.artifactId || workspace.entityId || '').trim();
    const sectionId = String(selection.sectionId || entityData.activeSectionId || '').trim();
    const blockId = String(selection.blockId || entityData.activeBlockId || '').trim();
    const scope = blockId && sectionId ? 'local' : sectionId ? 'section' : 'global';
    return {
      artifact_id: artifactId,
      instruction: trimPreview(userMessage, 500),
      document_context: {
        version_id: entityData.versionId ?? null,
        classification: entityData.classification ?? null,
        lifecycle: entityData.lifecycle ?? null,
        scope,
        ...(sectionId ? { section_id: sectionId } : {}),
        ...(blockId ? { block_id: blockId } : {}),
      },
      proposal_only: true,
    };
  }

  return {
    why_now: trimPreview(userMessage, 160),
    time_window: 'next-available',
    triggered_rules: ['teresa_chat_signal'],
    evidence_pointers: ['chat:teresa'],
    uncertainty_boundary: {
      missing_inputs: [],
      conflicts: [],
      what_would_change_next_action: [],
    },
    next_action_safe_fallback: 'Capture as notebook draft if triage cannot proceed',
  };
}

export async function createChatProposal(params: {
  organizationId: string;
  userId: string;
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
  context?: Record<string, unknown>;
  citations?: unknown[];
}): Promise<TeresaChatProposalEnvelope | null> {
  const { organizationId, userId, sessionId, userMessage, assistantMessage } = params;
  const context = (params.context || {}) as Record<string, unknown>;
  const intent = await inferTargetModuleFromChat(userMessage, context);
  if (!intent) return null;
  const contextSnapshotId =
    typeof context.contextSnapshotId === 'string'
      ? context.contextSnapshotId
      : typeof context.snapshotId === 'string'
        ? context.snapshotId
        : null;

  const handoffContext: TeresaHandoffContext = {
    origin: 'teresa',
    user_intent: trimPreview(userMessage, 240),
    active_surface: trimPreview(
      (context.screenContext as Record<string, unknown> | undefined)?.currentScreen ||
        (context.workspaceContext as Record<string, unknown> | undefined)?.type ||
        'chat/full',
      80
    ),
    org_context_ref: `org:${organizationId}`,
    operation_contract_ref: null,
    runtime_binding: {
      conversation_id: sessionId,
      session_id: sessionId,
      context_snapshot_id: contextSnapshotId,
    },
    bounded_context_pack: buildBoundedContextPack(context),
    constraints: ['proposal_first', 'no_silent_writes'],
    assumptions: [],
    uncertainty_boundary: {
      missing_inputs: [],
      conflicts: [],
      what_would_change_next_action: [],
    },
    evidence_pointers: Array.isArray(params.citations)
      ? params.citations.slice(0, 3).map((item, index) => {
          const citation = item as Record<string, unknown>;
          return String(citation?.id || citation?.reference || citation?.title || `cit-${index}`);
        })
      : [],
    proposed_next_action: {
      target_module: intent.targetModule,
      handoff_intent: intent.handoffIntent as 'open' | 'create' | 'append',
      requires_approval: true,
    },
    audit_stub: {
      actor: 'teresa:copilot',
      timestamp: new Date().toISOString(),
    },
  };

  const proposal = await createProposal({
    organizationId,
    userId,
    sessionId,
    handoffContext,
    targetModule: intent.targetModule,
    targetPayload: buildTargetPayloadForChat({
      targetModule: intent.targetModule,
      userMessage,
      assistantMessage,
      context,
    }),
  });

  return toChatProposalEnvelope(proposal, null);
}

// ---------------------------------------------------------------------------
// Anti-duplicate: check for active proposals in same session
// ---------------------------------------------------------------------------

async function getActiveProposalForSession(
  organizationId: string,
  userId: string,
  sessionId: string
): Promise<ProposalRow | null> {
  await ensureTeresaTables();
  const row = await dbGet<ProposalRow>(
    `SELECT * FROM teresa_proposals
     WHERE organization_id = ? AND user_id = ? AND session_id = ?
       AND state NOT IN ('completed', 'rejected')
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, userId, sessionId],
    { fallback: true }
  );
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Core: createProposal
// ---------------------------------------------------------------------------

export async function createProposal(params: {
  organizationId: string;
  userId: string;
  sessionId: string;
  handoffContext: TeresaHandoffContext;
  targetModule: HandoffTargetModule;
  targetPayload: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<ProposalRecord> {
  await ensureTeresaTables();

  const {
    organizationId,
    userId,
    sessionId,
    handoffContext,
    targetModule,
    targetPayload,
    idempotencyKey,
  } = params;

  // Idempotency: if caller provides a key, return existing proposal instead of creating duplicate
  if (idempotencyKey) {
    const existing = await dbGet<ProposalRow>(
      `SELECT * FROM teresa_proposals
       WHERE organization_id = ? AND user_id = ? AND session_id = ?
         AND target_module = ? AND id = ?`,
      [organizationId, userId, sessionId, targetModule, idempotencyKey],
      { fallback: true }
    );
    if (existing) {
      logger.info(`${LOG_PREFIX} Idempotent hit: returning existing proposal ${existing.id}`);
      const auditRows = await loadAuditEntries(existing.id);
      return rowToProposal(existing, auditRows);
    }
  }

  // Validate target module
  if (!P08_HANDOFF_TARGET_MODULES.includes(targetModule)) {
    throw new TeresaCopilotError(
      `Invalid target module: ${targetModule}`,
      'P08_INVALID_TARGET_MODULE'
    );
  }

  // Validate common handoff context
  const ctxValidation = validateHandoffContext(
    handoffContext as unknown as Record<string, unknown>
  );
  if (!ctxValidation.valid) {
    throw new TeresaCopilotError(
      `Missing handoff context fields: ${ctxValidation.missing.join(', ')}`,
      'P08_INVALID_HANDOFF_CONTEXT'
    );
  }

  // Validate target-specific payload
  const targetValidation = validateTargetPayload(targetModule, targetPayload);
  if (!targetValidation.valid) {
    throw new TeresaCopilotError(
      `Missing target payload fields for ${targetModule}: ${targetValidation.missing.join(', ')}`,
      'P08_INVALID_TARGET_PAYLOAD'
    );
  }

  // Validate write ownership: Teresa initiates, module writes
  const writeCheck = validateWriteOwnership(
    handoffContext.audit_stub.actor,
    `${targetModule}_service`
  );
  if (!writeCheck.valid) {
    throw new TeresaCopilotError(
      writeCheck.reason ?? 'Write ownership violation',
      'P08_WRITE_OWNERSHIP_VIOLATION'
    );
  }

  // Anti-duplicate: cancel any active proposal in same session
  const existing = await getActiveProposalForSession(organizationId, userId, sessionId);
  if (existing) {
    logger.info(`${LOG_PREFIX} Cancelling existing proposal ${existing.id} (anti-duplicate)`);
    const now = new Date().toISOString();
    await dbRun(
      `UPDATE teresa_proposals SET state = 'rejected', updated_at = ? WHERE id = ?`,
      [now, existing.id],
      { fallback: true }
    );
    await writeAuditEntry({
      proposalId: existing.id,
      action: 'auto_cancel_duplicate',
      actor: 'teresa:system',
      fromState: existing.state as ActionEnvelopeState,
      toState: 'rejected',
      detail: { reason: 'new_proposal_supersedes', new_session: sessionId },
    });
  }

  const proposalId = idempotencyKey ?? randomUUID();
  const now = new Date().toISOString();
  const persistedHandoffContext: TeresaHandoffContext = {
    ...handoffContext,
    operation_contract_ref: handoffContext.operation_contract_ref || proposalId,
    runtime_binding: {
      conversation_id: handoffContext.runtime_binding?.conversation_id || sessionId,
      session_id: handoffContext.runtime_binding?.session_id || sessionId,
      context_snapshot_id: handoffContext.runtime_binding?.context_snapshot_id || null,
      execution_run_id: handoffContext.runtime_binding?.execution_run_id || null,
      artifact_run_id: handoffContext.runtime_binding?.artifact_run_id || null,
      tool_invocation_id: handoffContext.runtime_binding?.tool_invocation_id || null,
    },
  };

  await dbRun(
    `INSERT INTO teresa_proposals
       (id, organization_id, user_id, session_id, state, handoff_context_json, target_module, target_payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'proposal', ?, ?, ?, ?, ?)`,
    [
      proposalId,
      organizationId,
      userId,
      sessionId,
      JSON.stringify(persistedHandoffContext),
      targetModule,
      JSON.stringify(targetPayload),
      now,
      now,
    ],
    { fallback: true }
  );

  const auditEntry = await writeAuditEntry({
    proposalId,
    action: 'proposal_created',
    actor: persistedHandoffContext.audit_stub.actor,
    fromState: null,
    toState: 'proposal',
    detail: { target_module: targetModule, user_intent: persistedHandoffContext.user_intent },
  });
  await mirrorTeresaProposalToAIRun({
    proposalId,
    organizationId,
    userId,
    sessionId,
    state: 'proposal',
    targetModule,
    targetPayload,
    handoffContext: persistedHandoffContext,
    eventType: 'proposal_pending_review',
    actorUserId: userId,
    details: { auditEntryId: auditEntry.id },
  });

  logger.info(`${LOG_PREFIX} Proposal created: ${proposalId} → ${targetModule}`);

  const proposalWithoutContract = {
    id: proposalId,
    organization_id: organizationId,
    user_id: userId,
    session_id: sessionId,
    state: 'proposal' as const,
    handoff_context: handoffContext,
    target_module: targetModule,
    target_payload: targetPayload,
    created_at: now,
    updated_at: now,
    audit_trail: [auditEntry],
  };

  return {
    ...proposalWithoutContract,
    operation_contract: buildTeresaOperationContract(proposalWithoutContract),
  };
}

// ---------------------------------------------------------------------------
// Core: approveProposal
// ---------------------------------------------------------------------------

export async function approveProposal(params: {
  proposalId: string;
  organizationId: string;
  userId: string;
}): Promise<ProposalRecord> {
  await ensureTeresaTables();
  const { proposalId, organizationId, userId } = params;

  const row = await dbGet<ProposalRow>(
    `SELECT * FROM teresa_proposals WHERE id = ? AND organization_id = ?`,
    [proposalId, organizationId],
    { fallback: true }
  );

  if (!row) {
    throw new TeresaCopilotError('Proposal not found', 'P08_PROPOSAL_NOT_FOUND', 404);
  }

  // Transition: proposal → pending_approval
  const currentState = row.state as ActionEnvelopeState;
  if (currentState !== 'proposal' && currentState !== 'pending_approval') {
    throw new TeresaCopilotError(
      `Cannot approve proposal in state: ${currentState}`,
      'P08_INVALID_STATE_TRANSITION'
    );
  }

  // Move to pending_approval first (if still in proposal)
  if (currentState === 'proposal') {
    if (!isValidEnvelopeTransition('proposal', 'pending_approval')) {
      throw new TeresaCopilotError(
        'Invalid transition: proposal → pending_approval',
        'P08_INVALID_STATE_TRANSITION'
      );
    }
    await transitionState(proposalId, 'pending_approval');
    await writeAuditEntry({
      proposalId,
      action: 'submitted_for_approval',
      actor: `user:${userId}`,
      fromState: 'proposal',
      toState: 'pending_approval',
      detail: null,
    });
  }

  // Move to approved
  if (!isValidEnvelopeTransition('pending_approval', 'approved')) {
    throw new TeresaCopilotError(
      'Invalid transition: pending_approval → approved',
      'P08_INVALID_STATE_TRANSITION'
    );
  }
  await transitionState(proposalId, 'approved');
  const auditEntry = await writeAuditEntry({
    proposalId,
    action: 'approved',
    actor: `user:${userId}`,
    fromState: 'pending_approval',
    toState: 'approved',
    detail: null,
  });
  logger.info(`${LOG_PREFIX} Proposal approved: ${proposalId}`);

  const updatedRow = await dbGet<ProposalRow>(
    `SELECT * FROM teresa_proposals WHERE id = ?`,
    [proposalId],
    { fallback: true }
  );
  const auditRows = await loadAuditEntries(proposalId);
  await mirrorTeresaProposalToAIRun({
    proposalId,
    organizationId,
    userId: row.user_id,
    sessionId: row.session_id,
    state: 'approved',
    targetModule: row.target_module as HandoffTargetModule,
    targetPayload: JSON.parse(row.target_payload_json || '{}'),
    handoffContext: JSON.parse(row.handoff_context_json || '{}'),
    eventType: 'proposal_approved',
    actorUserId: userId,
    details: { auditEntryId: auditEntry.id },
    audit: { approvedBy: userId, approvedAt: new Date().toISOString() },
  });
  return rowToProposal(updatedRow!, auditRows);
}

// ---------------------------------------------------------------------------
// Core: rejectProposal
// ---------------------------------------------------------------------------

export async function rejectProposal(params: {
  proposalId: string;
  organizationId: string;
  userId: string;
  reason?: string;
}): Promise<ProposalRecord> {
  await ensureTeresaTables();
  const { proposalId, organizationId, userId, reason } = params;

  const row = await dbGet<ProposalRow>(
    `SELECT * FROM teresa_proposals WHERE id = ? AND organization_id = ?`,
    [proposalId, organizationId],
    { fallback: true }
  );

  if (!row) {
    throw new TeresaCopilotError('Proposal not found', 'P08_PROPOSAL_NOT_FOUND', 404);
  }

  const currentState = row.state as ActionEnvelopeState;
  if (!isValidEnvelopeTransition(currentState, 'rejected')) {
    throw new TeresaCopilotError(
      `Cannot reject proposal in state: ${currentState}`,
      'P08_INVALID_STATE_TRANSITION'
    );
  }

  await transitionState(proposalId, 'rejected');
  const auditEntry = await writeAuditEntry({
    proposalId,
    action: 'rejected',
    actor: `user:${userId}`,
    fromState: currentState,
    toState: 'rejected',
    detail: reason ? { reason } : null,
  });
  logger.info(`${LOG_PREFIX} Proposal rejected: ${proposalId}`);

  const updatedRow = await dbGet<ProposalRow>(
    `SELECT * FROM teresa_proposals WHERE id = ?`,
    [proposalId],
    { fallback: true }
  );
  const auditRows = await loadAuditEntries(proposalId);
  await mirrorTeresaProposalToAIRun({
    proposalId,
    organizationId,
    userId: row.user_id,
    sessionId: row.session_id,
    state: 'rejected',
    targetModule: row.target_module as HandoffTargetModule,
    targetPayload: JSON.parse(row.target_payload_json || '{}'),
    handoffContext: JSON.parse(row.handoff_context_json || '{}'),
    eventType: 'proposal_rejected',
    actorUserId: userId,
    details: { auditEntryId: auditEntry.id, reason: reason || null, sideEffectsApplied: false },
    audit: { rejectedBy: userId, rejectedAt: new Date().toISOString() },
  });
  return rowToProposal(updatedRow!, auditRows);
}

// ---------------------------------------------------------------------------
// Core: executeProposal (approved → executing → completed)
// ---------------------------------------------------------------------------

export async function executeProposal(params: {
  proposalId: string;
  organizationId: string;
  userId: string;
}): Promise<HandoffResult> {
  await ensureTeresaTables();
  const { proposalId, organizationId, userId } = params;

  const row = await dbGet<ProposalRow>(
    `SELECT * FROM teresa_proposals WHERE id = ? AND organization_id = ?`,
    [proposalId, organizationId],
    { fallback: true }
  );

  if (!row) {
    throw new TeresaCopilotError('Proposal not found', 'P08_PROPOSAL_NOT_FOUND', 404);
  }

  const currentState = row.state as ActionEnvelopeState;
  if (currentState !== 'approved') {
    throw new TeresaCopilotError(
      `Cannot execute proposal in state: ${currentState}. Must be approved first.`,
      'P08_INVALID_STATE_TRANSITION'
    );
  }

  // Transition to executing
  await transitionState(proposalId, 'executing');
  const executionStartAudit = await writeAuditEntry({
    proposalId,
    action: 'execution_started',
    actor: `user:${userId}`,
    fromState: 'approved',
    toState: 'executing',
    detail: null,
  });
  const handoffContext = JSON.parse(row.handoff_context_json || '{}');
  const targetPayload = JSON.parse(row.target_payload_json || '{}');
  await mirrorTeresaProposalToAIRun({
    proposalId,
    organizationId,
    userId: row.user_id,
    sessionId: row.session_id,
    state: 'executing',
    targetModule: row.target_module as HandoffTargetModule,
    targetPayload,
    handoffContext,
    eventType: 'execution_started',
    actorUserId: userId,
    details: { auditEntryId: executionStartAudit.id, explicitExecute: true },
    audit: { executedBy: userId, executionStartedAt: new Date().toISOString() },
  });

  const targetModule = row.target_module as HandoffTargetModule;

  // Attempt handoff execution — module-owned writes
  try {
    const handoffResult = await performHandoff({
      proposalId,
      organizationId,
      userId,
      targetModule,
      handoffContext,
      targetPayload,
    });

    // Transition to completed
    await transitionState(proposalId, 'completed');
    const auditEntry = await writeAuditEntry({
      proposalId,
      action: 'execution_completed',
      actor: `${targetModule}_service`,
      fromState: 'executing',
      toState: 'completed',
      detail: { handoff_result: handoffResult },
    });
    await mirrorTeresaProposalToAIRun({
      proposalId,
      organizationId,
      userId: row.user_id,
      sessionId: row.session_id,
      state: 'completed',
      targetModule,
      targetPayload,
      handoffContext,
      eventType: 'execution_succeeded',
      actorUserId: userId,
      details: { auditEntryId: auditEntry.id, handoffResult },
      outputRefs: [{ type: targetModule, id: auditEntry.id }],
      audit: {
        executedBy: userId,
        executedAt: new Date().toISOString(),
        result: handoffResult,
        rollbackStatus: 'rollback_unavailable',
      },
    });

    logger.info(`${LOG_PREFIX} Proposal executed: ${proposalId} → ${targetModule}`);

    return {
      success: true,
      proposal_id: proposalId,
      target_module: targetModule,
      state: 'completed',
      audit_entry_id: auditEntry.id,
      handoff_result: handoffResult,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Execution failed for ${proposalId}: ${errorMsg}`);

    // Check if we can write audit — truth-preserving failure
    try {
      await transitionState(proposalId, 'rejected');
      const failureAudit = await writeAuditEntry({
        proposalId,
        action: 'execution_failed',
        actor: 'teresa:system',
        fromState: 'executing',
        toState: 'rejected',
        detail: { error: errorMsg, degraded_scenario: 'D05' },
      });
      await mirrorTeresaProposalToAIRun({
        proposalId,
        organizationId,
        userId: row.user_id,
        sessionId: row.session_id,
        state: 'rejected',
        targetModule,
        targetPayload,
        handoffContext,
        eventType: 'execution_failed',
        actorUserId: userId,
        details: { auditEntryId: failureAudit.id, error: errorMsg },
        audit: { failedAt: new Date().toISOString(), error: errorMsg },
      });
    } catch (auditErr) {
      logger.error(
        `${LOG_PREFIX} CRITICAL: Audit write failed for ${proposalId} — degraded(audit_unavailable)`
      );
      return {
        success: false,
        proposal_id: proposalId,
        target_module: targetModule,
        state: 'executing',
        audit_entry_id: '',
        degraded: 'audit_unavailable',
        error: errorMsg,
      };
    }

    return {
      success: false,
      proposal_id: proposalId,
      target_module: targetModule,
      state: 'rejected',
      audit_entry_id: '',
      error: errorMsg,
      degraded: 'tool_unavailable',
    };
  }
}

// ---------------------------------------------------------------------------
// Core: undoProposal (completed XLSX mutation → undone)
// ---------------------------------------------------------------------------

export async function undoProposal(params: {
  proposalId: string;
  organizationId: string;
  userId: string;
}): Promise<HandoffResult> {
  await ensureTeresaTables();
  const { proposalId, organizationId, userId } = params;
  const row = await dbGet<ProposalRow>(
    `SELECT * FROM teresa_proposals WHERE id = ? AND organization_id = ?`,
    [proposalId, organizationId],
    { fallback: true }
  );
  if (!row) {
    throw new TeresaCopilotError('Proposal not found', 'P08_PROPOSAL_NOT_FOUND', 404);
  }
  if (row.state !== 'completed') {
    throw new TeresaCopilotError(
      `Cannot undo proposal in state: ${row.state}. Must be completed first.`,
      'P08_INVALID_STATE_TRANSITION'
    );
  }
  if (row.target_module !== 'excele') {
    throw new TeresaCopilotError(
      'Undo is currently supported only for applied workbook mutations.',
      'P08_UNDO_UNSUPPORTED_TARGET'
    );
  }

  const executionAudit = await dbGet<AuditRow>(
    `SELECT * FROM teresa_audit_log
     WHERE proposal_id = ? AND action = 'execution_completed'
     ORDER BY timestamp DESC LIMIT 1`,
    [proposalId],
    { fallback: true }
  );
  const detail = executionAudit?.detail_json
    ? (JSON.parse(executionAudit.detail_json) as Record<string, unknown>)
    : null;
  const handoffResult = detail?.handoff_result as Record<string, unknown> | undefined;
  const workbookId = handoffResult?.workbook_ref;
  const commandVersion = handoffResult?.version;
  if (
    handoffResult?.mutation_applied !== true ||
    typeof workbookId !== 'string' ||
    !workbookId ||
    !Number.isInteger(commandVersion) ||
    Number(commandVersion) < 1
  ) {
    throw new TeresaCopilotError(
      'The proposal has no reversible workbook mutation.',
      'P08_UNDO_NOT_AVAILABLE',
      409
    );
  }

  try {
    const undoResult = await undoWorkbookCommand({
      workbookId,
      organizationId,
      userId,
      commandVersion: Number(commandVersion),
      baseVersion: Number(commandVersion),
      idempotencyKey: `teresa:undo:${proposalId}`,
    });
    await transitionState(proposalId, 'undone');
    const auditEntry = await writeAuditEntry({
      proposalId,
      action: 'execution_undone',
      actor: `user:${userId}`,
      fromState: 'completed',
      toState: 'undone',
      detail: {
        execution_audit_entry_id: executionAudit?.id ?? null,
        original_workbook_version: commandVersion,
        undo_result: undoResult,
      },
    });
    const targetPayload = JSON.parse(row.target_payload_json || '{}');
    const handoffContext = JSON.parse(row.handoff_context_json || '{}');
    await mirrorTeresaProposalToAIRun({
      proposalId,
      organizationId,
      userId: row.user_id,
      sessionId: row.session_id,
      state: 'undone',
      targetModule: 'excele',
      targetPayload,
      handoffContext,
      eventType: 'execution_undone',
      actorUserId: userId,
      details: { auditEntryId: auditEntry.id, undoResult },
      outputRefs: [{ type: 'excele', id: workbookId }],
      audit: {
        undoneBy: userId,
        undoneAt: new Date().toISOString(),
        rollbackStatus: 'rolled_back',
        result: undoResult,
      },
    });
    return {
      success: true,
      proposal_id: proposalId,
      target_module: 'excele',
      state: 'undone',
      audit_entry_id: auditEntry.id,
      handoff_result: {
        handoff: 'excele',
        workbook_ref: workbookId,
        mutation_undone: true,
        command_version: commandVersion,
        version: undoResult.version,
        duplicate: undoResult.duplicate,
      },
    };
  } catch (error) {
    if (error instanceof WorkbookCommandError) {
      throw new TeresaCopilotError(error.message, error.code, error.statusCode);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Core: getProposal + getProposalHistory
// ---------------------------------------------------------------------------

export async function getProposal(
  proposalId: string,
  organizationId: string
): Promise<ProposalRecord | null> {
  await ensureTeresaTables();
  const row = await dbGet<ProposalRow>(
    `SELECT * FROM teresa_proposals WHERE id = ? AND organization_id = ?`,
    [proposalId, organizationId],
    { fallback: true }
  );
  if (!row) return null;
  const auditRows = await loadAuditEntries(proposalId);
  return rowToProposal(row, auditRows);
}

export async function getProposalHistory(
  organizationId: string,
  userId: string,
  limit = 20
): Promise<ProposalRecord[]> {
  await ensureTeresaTables();
  const rows = await dbAll<ProposalRow>(
    `SELECT * FROM teresa_proposals
     WHERE organization_id = ? AND user_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [organizationId, userId, limit],
    { fallback: true }
  );
  const results: ProposalRecord[] = [];
  for (const row of rows) {
    const auditRows = await loadAuditEntries(row.id);
    results.push(rowToProposal(row, auditRows));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Core: getAuditTrail
// ---------------------------------------------------------------------------

export async function getAuditTrail(
  proposalId: string,
  organizationId: string
): Promise<AuditEntry[]> {
  const row = await dbGet<ProposalRow>(
    `SELECT id FROM teresa_proposals WHERE id = ? AND organization_id = ?`,
    [proposalId, organizationId],
    { fallback: true }
  );
  if (!row) {
    throw new TeresaCopilotError('Proposal not found', 'P08_PROPOSAL_NOT_FOUND', 404);
  }
  const auditRows = await loadAuditEntries(proposalId);
  return auditRows.map(rowToAuditEntry);
}

// ---------------------------------------------------------------------------
// Core: resolveVoicePosture
// ---------------------------------------------------------------------------

export function resolveVoicePosture(conditions: {
  micPermission: boolean;
  networkStable: boolean;
  runtimeReady: boolean;
}): VoicePostureResult {
  const availability = resolveVoiceAvailability(conditions);
  const fallback_active = availability !== 'available';
  let recovery_phrase: string | null = null;

  if (availability === 'unavailable') {
    recovery_phrase = 'Przechodzę na tekst, bo voice jest niestabilny. Oto proposal.';
  } else if (availability === 'degraded') {
    recovery_phrase = 'Powtórz proszę ostatnią instrukcję';
  }

  return { availability, fallback_active, recovery_phrase };
}

// ---------------------------------------------------------------------------
// Core: getDegradedScenario
// ---------------------------------------------------------------------------

export function getDegradedScenario(scenarioId: string) {
  return P08_DEGRADED_SCENARIOS.find((s) => s.id === scenarioId) ?? null;
}

export function getAllDegradedScenarios() {
  return P08_DEGRADED_SCENARIOS;
}

// ---------------------------------------------------------------------------
// Internal: performHandoff (delegates to target module service)
// ---------------------------------------------------------------------------

async function performHandoff(params: {
  proposalId: string;
  organizationId: string;
  userId: string;
  targetModule: HandoffTargetModule;
  handoffContext: TeresaHandoffContext;
  targetPayload: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const { proposalId, organizationId, userId, targetModule, handoffContext, targetPayload } =
    params;

  // Each target module has its own write lane.
  // Teresa initiates, module writes — per P08_WRITE_OWNERSHIP.
  switch (targetModule) {
    case 'radar':
      return handleRadarHandoff(proposalId, organizationId, handoffContext, targetPayload);
    case 'initiatives':
      return handleInitiativesHandoff(proposalId, organizationId, handoffContext, targetPayload);
    case 'calendar':
      return handleCalendarHandoff(
        proposalId,
        organizationId,
        handoffContext,
        targetPayload,
        userId
      );
    case 'notebook':
      return handleNotebookHandoff(proposalId, organizationId, handoffContext, targetPayload);
    case 'interview':
      return handleInterviewHandoff(proposalId, organizationId, handoffContext, targetPayload);
    case 'excele':
      return handleExceleHandoff(proposalId, organizationId, userId, handoffContext, targetPayload);
    case 'documents':
      return handleDocumentsHandoff(
        proposalId,
        organizationId,
        userId,
        handoffContext,
        targetPayload
      );
    default:
      throw new TeresaCopilotError(`Unknown target module: ${targetModule}`, 'P08_UNKNOWN_TARGET');
  }
}

// Opaque dynamic import — prevents Vite/bundler from resolving at build time.
// These services may or may not exist; failure is handled gracefully.
async function tryImport(specifier: string): Promise<Record<string, any> | null> {
  try {
    return await import(/* @vite-ignore */ specifier);
  } catch {
    return null;
  }
}

async function handleRadarHandoff(
  proposalId: string,
  organizationId: string,
  context: TeresaHandoffContext,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const fallbackRef = randomUUID();
  let realSignalId: string | null = null;

  const radarMod = await tryImport('./radarTriageService.js');
  if (radarMod) {
    try {
      const fn = radarMod.createSignal ?? radarMod.default?.createSignal;
      const result = await fn?.({
        organizationId,
        why_now: payload.why_now,
        evidence_pointers: payload.evidence_pointers,
        user_intent: context.user_intent,
        source: 'teresa',
        proposalId,
      });
      realSignalId = result?.id || result?.signalId || null;
    } catch {
      logger.warn(`${LOG_PREFIX} Radar service call failed, using fallback ref`);
    }
  }

  const ref = realSignalId || fallbackRef;
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'radar', ?, ?)`,
    [randomUUID(), proposalId, organizationId, ref, new Date().toISOString()],
    { fallback: true }
  );
  return {
    handoff: 'radar',
    signal_id: ref,
    real_entity: Boolean(realSignalId),
    why_now: payload.why_now,
    user_intent: context.user_intent,
  };
}

async function handleInitiativesHandoff(
  proposalId: string,
  organizationId: string,
  context: TeresaHandoffContext,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const fallbackRef = randomUUID();
  let realInitRef: string | null = null;

  const initMod = await tryImport('../initiativeGenerationService.js');
  if (initMod) {
    try {
      const create =
        initMod.createInitiative ?? initMod.default?.createInitiative ?? initMod.default?.create;
      const seed = (payload.initiative_seed || {}) as Record<string, unknown>;
      const result = await create?.({
        organizationId,
        title: seed.problem_statement || context.user_intent,
        description: seed.proposed_outcome || '',
        source: 'teresa',
        proposalId,
      });
      realInitRef = result?.id || result?.initiativeId || null;
    } catch {
      logger.warn(`${LOG_PREFIX} Initiatives service call failed, using fallback ref`);
    }
  }

  const ref = realInitRef || fallbackRef;
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'initiatives', ?, ?)`,
    [randomUUID(), proposalId, organizationId, ref, new Date().toISOString()],
    { fallback: true }
  );
  return {
    handoff: 'initiatives',
    initiative_ref: ref,
    real_entity: Boolean(realInitRef),
    proposal_only: !realInitRef,
    user_intent: context.user_intent,
  };
}

async function handleCalendarHandoff(
  proposalId: string,
  organizationId: string,
  context: TeresaHandoffContext,
  payload: Record<string, unknown>,
  userId?: string
): Promise<Record<string, unknown>> {
  const fallbackRef = randomUUID();
  let realCalRef: string | null = null;

  // Teresa last-mile (backlog #4): wire directly to the real meetings write path
  // (`meetingService.createMeeting`) instead of a non-existent `calendarInteropService.createEvent`.
  const calMod = await tryImport('../meetingService.js');
  if (calMod) {
    try {
      const create = calMod.createMeeting ?? calMod.default?.createMeeting;
      const intent = (payload.calendar_intent || {}) as Record<string, unknown>;
      const whenRaw = intent.when ? String(intent.when) : '';
      const parsed = new Date(whenRaw);
      const startAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
      const result = await create?.({
        organizationId,
        createdBy: userId || 'teresa',
        title: String(intent.what || context.user_intent || 'Teresa meeting').slice(0, 300),
        startAt,
        endAt: startAt,
        attendees: [],
        agenda: [],
        decisions: [],
      });
      realCalRef = result?.id || result?.eventId || null;
    } catch {
      logger.warn(`${LOG_PREFIX} Calendar/meeting service call failed, using fallback ref`);
    }
  }

  const ref = realCalRef || fallbackRef;
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'calendar', ?, ?)`,
    [randomUUID(), proposalId, organizationId, ref, new Date().toISOString()],
    { fallback: true }
  );
  return {
    handoff: 'calendar',
    calendar_ref: ref,
    real_entity: Boolean(realCalRef),
    calendar_intent: payload.calendar_intent,
    user_intent: context.user_intent,
  };
}

async function handleNotebookHandoff(
  proposalId: string,
  organizationId: string,
  context: TeresaHandoffContext,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const fallbackRef = randomUUID();
  let realNoteId: string | null = null;

  const noteMod = await tryImport('../notebookService.js');
  if (noteMod) {
    try {
      const create = noteMod.createNote ?? noteMod.default?.createNote ?? noteMod.default?.create;
      const nbCtx = (payload.notebook_handoff_context || {}) as Record<string, unknown>;
      const reminder = (nbCtx.reminder || null) as { dueAt?: string; term?: string } | null;
      const result = await create?.({
        organizationId,
        title: nbCtx.title || 'Teresa handoff note',
        body: nbCtx.body_preview || '',
        source: 'teresa',
        proposalId,
        // #21: termin przypomnienia ląduje w capture_metadata.reminder (bez migracji).
        ...(reminder && (reminder.dueAt || reminder.term) ? { reminder } : {}),
      });
      realNoteId = result?.id || result?.noteId || null;
    } catch {
      logger.warn(`${LOG_PREFIX} Notebook service call failed, using fallback ref`);
    }
  }

  const ref = realNoteId || fallbackRef;
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'notebook', ?, ?)`,
    [randomUUID(), proposalId, organizationId, ref, new Date().toISOString()],
    { fallback: true }
  );
  return {
    handoff: 'notebook',
    note_ref: ref,
    real_entity: Boolean(realNoteId),
    notebook_context: payload.notebook_handoff_context,
    user_intent: context.user_intent,
  };
}

async function handleInterviewHandoff(
  proposalId: string,
  organizationId: string,
  context: TeresaHandoffContext,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const fallbackRef = randomUUID();
  let realInsightRef: string | null = null;

  const interviewMod = await tryImport('./interviewInsightService.js');
  if (interviewMod) {
    try {
      const fn =
        interviewMod.generateInsight ??
        interviewMod.default?.generateInsight ??
        interviewMod.createInsight ??
        interviewMod.default?.createInsight;
      const interviewCtx = (payload.interview_handoff_context || {}) as Record<string, unknown>;
      const result = await fn?.({
        organizationId,
        action: interviewCtx.action || 'generate_insight',
        session_ids: interviewCtx.session_ids,
        title: interviewCtx.title || context.user_intent,
        source: 'teresa',
        proposalId,
      });
      realInsightRef = result?.id || result?.insightId || null;
    } catch {
      logger.warn(`${LOG_PREFIX} Interview service call failed, using fallback ref`);
    }
  }

  const ref = realInsightRef || fallbackRef;
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'interview', ?, ?)`,
    [randomUUID(), proposalId, organizationId, ref, new Date().toISOString()],
    { fallback: true }
  );
  return {
    handoff: 'interview',
    insight_ref: ref,
    real_entity: Boolean(realInsightRef),
    interview_context: payload.interview_handoff_context,
    user_intent: context.user_intent,
  };
}

async function handleExceleHandoff(
  proposalId: string,
  organizationId: string,
  userId: string,
  context: TeresaHandoffContext,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const workbookContext = payload.workbook_context as Record<string, unknown> | undefined;
  const workbookId =
    workbookContext && typeof workbookContext.workbook_id === 'string'
      ? workbookContext.workbook_id.trim()
      : '';

  if (!workbookId) {
    throw new TeresaCopilotError(
      'Workbook write is unavailable without a real, versioned workbook context',
      'P08_EXCELE_WRITE_UNAVAILABLE',
      409
    );
  }

  const version = Number(workbookContext?.version_id);
  if (!Number.isInteger(version) || version < 0) {
    throw new TeresaCopilotError(
      'Workbook write requires an immutable base version',
      'P08_EXCELE_VERSION_REQUIRED',
      409
    );
  }

  const mutation = payload.workbook_mutation;
  if (!mutation || typeof mutation !== 'object' || Array.isArray(mutation)) {
    throw new TeresaCopilotError(
      'Workbook proposal must contain a structured mutation diff before execution',
      'P08_EXCELE_STRUCTURED_MUTATION_REQUIRED',
      409
    );
  }
  const mutationPayload = mutation as Record<string, unknown>;
  if (!Array.isArray(mutationPayload.operations) || mutationPayload.operations.length === 0) {
    throw new TeresaCopilotError(
      'Workbook proposal contains no executable operations',
      'P08_EXCELE_STRUCTURED_MUTATION_REQUIRED',
      409
    );
  }

  let commandResult;
  try {
    commandResult = await applyWorkbookCommand({
      workbookId,
      organizationId,
      userId,
      commandId:
        typeof mutationPayload.command_id === 'string' && mutationPayload.command_id.trim()
          ? mutationPayload.command_id.trim()
          : 'teresa.workbook.applyProposal',
      baseVersion: version,
      idempotencyKey: `teresa:${proposalId}`,
      operations: mutationPayload.operations as WorkbookMutation[],
    });
  } catch (error) {
    if (error instanceof WorkbookCommandError) {
      throw new TeresaCopilotError(error.message, `P08_EXCELE_${error.code}`, error.statusCode);
    }
    throw error;
  }

  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'excele', ?, ?)`,
    [randomUUID(), proposalId, organizationId, workbookId, new Date().toISOString()],
    { fallback: true }
  );
  return {
    handoff: 'excele',
    workbook_ref: workbookId,
    real_entity: true,
    proposal_only: false,
    mutation_applied: true,
    version: commandResult.version,
    operation_count: commandResult.operationCount,
    duplicate: commandResult.duplicate,
    workbook_context: workbookContext,
    navigate_to: `/excele?artifactId=${encodeURIComponent(workbookId)}`,
    user_intent: context.user_intent,
    prompt_hint: payload.prompt || context.user_intent,
  };
}

async function handleDocumentsHandoff(
  proposalId: string,
  organizationId: string,
  userId: string,
  context: TeresaHandoffContext,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const artifactId = typeof payload.artifact_id === 'string' ? payload.artifact_id.trim() : '';
  const instruction = typeof payload.instruction === 'string' ? payload.instruction.trim() : '';
  const documentContext =
    payload.document_context && typeof payload.document_context === 'object'
      ? (payload.document_context as Record<string, unknown>)
      : {};
  const scope = String(documentContext.scope || 'global');

  if (!artifactId) {
    throw new TeresaCopilotError(
      'Document write is unavailable without an opened artifact context',
      'P08_DOCUMENT_ARTIFACT_REQUIRED',
      409
    );
  }
  if (!instruction) {
    throw new TeresaCopilotError(
      'Document proposal requires an explicit instruction',
      'P08_DOCUMENT_INSTRUCTION_REQUIRED',
      409
    );
  }

  const documentMod = await tryImport('../documentStudio/documentStudioService.js');
  if (!documentMod) {
    throw new TeresaCopilotError(
      'Document Studio writer is unavailable',
      'P08_DOCUMENT_WRITE_UNAVAILABLE',
      503
    );
  }

  let domainProposal: { proposalId?: string };
  if (scope === 'local') {
    const sectionId = String(documentContext.section_id || '').trim();
    const blockId = String(documentContext.block_id || '').trim();
    if (!sectionId || !blockId) {
      throw new TeresaCopilotError(
        'A local document edit requires stable section and block identifiers',
        'P08_DOCUMENT_SELECTION_REQUIRED',
        409
      );
    }
    domainProposal = await documentMod.createLocalEditProposal({
      artifactId,
      organizationId,
      userId,
      input: { scope: 'local', sectionId, blockId, instruction },
      useLlm: true,
    });
  } else if (scope === 'section') {
    const sectionId = String(documentContext.section_id || '').trim();
    if (!sectionId) {
      throw new TeresaCopilotError(
        'A section document edit requires a stable section identifier',
        'P08_DOCUMENT_SELECTION_REQUIRED',
        409
      );
    }
    domainProposal = await documentMod.createSectionEditProposal({
      artifactId,
      organizationId,
      userId,
      sectionId,
      instruction,
      useLlm: true,
    });
  } else if (scope === 'global') {
    domainProposal = await documentMod.createGlobalEditProposal({
      artifactId,
      organizationId,
      userId,
      instruction,
      useLlm: true,
    });
  } else {
    throw new TeresaCopilotError(
      `Unsupported document selection scope: ${scope}`,
      'P08_DOCUMENT_SCOPE_UNSUPPORTED',
      409
    );
  }

  if (!domainProposal?.proposalId) {
    throw new TeresaCopilotError(
      'Document Studio did not return a durable proposal',
      'P08_DOCUMENT_PROPOSAL_FAILED',
      502
    );
  }

  const approval = await documentMod.approveEditProposal({
    artifactId,
    organizationId,
    userId,
    proposalId: domainProposal.proposalId,
  });

  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'documents', ?, ?)`,
    [randomUUID(), proposalId, organizationId, artifactId, new Date().toISOString()],
    { fallback: true }
  );
  return {
    handoff: 'documents',
    artifact_ref: artifactId,
    domain_proposal_ref: domainProposal.proposalId,
    real_entity: true,
    proposal_only: false,
    mutation_applied: true,
    scope,
    version_after: approval?.proposal?.versionAfterId ?? null,
    navigate_to: `/document-studio/${encodeURIComponent(artifactId)}`,
    user_intent: context.user_intent,
  };
}

// ---------------------------------------------------------------------------
// Internal: state transitions + audit
// ---------------------------------------------------------------------------

async function transitionState(proposalId: string, newState: ActionEnvelopeState): Promise<void> {
  await dbRun(
    `UPDATE teresa_proposals SET state = ?, updated_at = ? WHERE id = ?`,
    [newState, new Date().toISOString(), proposalId],
    { fallback: true }
  );
}

async function writeAuditEntry(params: {
  proposalId: string;
  action: string;
  actor: string;
  fromState: ActionEnvelopeState | null;
  toState: ActionEnvelopeState;
  detail: Record<string, unknown> | null;
}): Promise<AuditEntry> {
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  await dbRun(
    `INSERT INTO teresa_audit_log (id, proposal_id, action, actor, timestamp, from_state, to_state, detail_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.proposalId,
      params.action,
      params.actor,
      timestamp,
      params.fromState,
      params.toState,
      params.detail ? JSON.stringify(params.detail) : null,
    ],
    { fallback: true }
  );

  return {
    id,
    proposal_id: params.proposalId,
    action: params.action,
    actor: params.actor,
    timestamp,
    from_state: params.fromState,
    to_state: params.toState,
    detail: params.detail,
  };
}

async function loadAuditEntries(proposalId: string): Promise<AuditRow[]> {
  return dbAll<AuditRow>(
    `SELECT * FROM teresa_audit_log WHERE proposal_id = ? ORDER BY timestamp ASC`,
    [proposalId],
    { fallback: true }
  );
}

// ---------------------------------------------------------------------------
// Proactive suggestions: interview sessions without insights (L6.4)
// ---------------------------------------------------------------------------

export interface ProactiveSuggestion {
  id: string;
  targetModule: HandoffTargetModule;
  label: string;
  labelPl: string;
  handoffIntent: string;
  context: Record<string, unknown>;
}

export async function getProactiveSuggestions(
  organizationId: string
): Promise<ProactiveSuggestion[]> {
  const suggestions: ProactiveSuggestion[] = [];

  try {
    const interviewMod = await tryImport('./interviewInsightService.js');
    if (interviewMod) {
      const fn =
        interviewMod.getCompletedSessionsWithoutInsights ??
        interviewMod.default?.getCompletedSessionsWithoutInsights;
      if (fn) {
        const result = await fn({ organizationId });
        const count =
          typeof result === 'number' ? result : Array.isArray(result) ? result.length : 0;
        if (count > 0) {
          suggestions.push({
            id: `proactive-interview-insights-${organizationId}`,
            targetModule: 'interview',
            label: `Generate insights from ${count} completed session${count === 1 ? '' : 's'}`,
            labelPl: `Wygeneruj wnioski z ${count} zakończon${count === 1 ? 'ej sesji' : 'ych sesji'}`,
            handoffIntent: 'generate_insight',
            context: { completedSessionCount: count },
          });
        }
      }
    }
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} Proactive interview suggestion check failed: ${(err as Error).message}`
    );
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Contract metadata
// ---------------------------------------------------------------------------

export function getContractMetadata() {
  return {
    contract_id: P08_COPILOT_CONTRACT,
    handoff_targets: P08_HANDOFF_TARGET_MODULES,
    envelope_states: [...P08_ACTION_ENVELOPE_STATES],
    degraded_scenarios_count: P08_DEGRADED_SCENARIOS.length,
  };
}
