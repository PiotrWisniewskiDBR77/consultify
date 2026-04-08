/**
 * P08-B — Teresa Copilot Service
 *
 * Runtime logic for the Teresa contextual copilot:
 *   - Proposal lifecycle (create → approve → execute → complete/reject)
 *   - Cross-surface handoff to 4 P0 targets (Radar/Inicjatywy/Kalendarz/Notatki)
 *   - Audit trail for every action
 *   - Voice posture resolution
 *   - Anti-duplicate gate
 *   - Degraded scenario handling
 *
 * Teresa is NOT an autonomous engine. She proposes, the user approves,
 * the target module executes. No silent writes.
 */

import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
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
  allowedActions: Array<'approve' | 'reject' | 'execute' | 'navigate'>;
  targetModule: HandoffTargetModule;
  targetLabel: string;
  handoffIntent: string;
  previewLines: string[];
  auditCount: number;
  resultRef: string | null;
  degraded: string | null;
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
    targetModule: 'calendar',
    handoffIntent: 'schedule',
    patterns: [
      /\b(calendar|meeting|schedule|invite|appointment)\b/i,
      /\b(kalendarz|spotkanie|zaplanuj|umów|zaproszenie)\b/i,
    ],
  },
  {
    targetModule: 'notebook',
    handoffIntent: 'draft',
    patterns: [
      /\b(note|notes|notebook|summary|minutes|brief)\b/i,
      /\b(notatk|notebook|podsumowanie|protok[oó]ł|brief)\b/i,
    ],
  },
  {
    targetModule: 'initiatives',
    handoffIntent: 'create',
    patterns: [
      /\b(initiative|roadmap|plan|execution|project)\b/i,
      /\b(inicjatyw|roadmap|plan|wdroż|projekt)\b/i,
    ],
  },
  {
    targetModule: 'radar',
    handoffIntent: 'triage',
    patterns: [/\b(risk|radar|signal|alert|watch)\b/i, /\b(ryzyk|radar|sygnał|alert|monitor)\b/i],
  },
];

const TARGET_LABELS: Record<HandoffTargetModule, string> = {
  radar: 'Radar',
  initiatives: 'Initiatives',
  calendar: 'Calendar',
  notebook: 'Notebook',
};

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
  return {
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
  return `Open ${TARGET_LABELS[targetModule]}`;
}

function deriveApprovalState(
  state: ActionEnvelopeState
): TeresaChatProposalEnvelope['approvalState'] {
  if (state === 'approved') return 'approved';
  if (state === 'completed') return 'completed';
  if (state === 'rejected') return 'rejected';
  return 'awaiting_review';
}

function deriveAllowedActions(
  state: ActionEnvelopeState
): TeresaChatProposalEnvelope['allowedActions'] {
  switch (state) {
    case 'proposal':
    case 'pending_approval':
      return ['approve', 'reject', 'navigate'];
    case 'approved':
      return ['execute', 'reject', 'navigate'];
    case 'executing':
    case 'completed':
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
  const keys = ['signal_id', 'initiative_ref', 'calendar_ref', 'note_ref'];
  for (const key of keys) {
    const value = (handoff as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function buildPreviewLines(proposal: ProposalRecord, execution?: HandoffResult | null): string[] {
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
  } else if (target === 'calendar') {
    const calendar = (payload.calendar_intent || {}) as Record<string, unknown>;
    lines.push(trimPreview(calendar.what || proposal.handoff_context.user_intent, 120));
    lines.push(trimPreview(calendar.when || 'Scheduling slot will be confirmed on execute', 120));
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

export function toChatProposalEnvelope(
  proposal: ProposalRecord,
  execution?: HandoffResult | null
): TeresaChatProposalEnvelope {
  const latestAudit = proposal.audit_trail[proposal.audit_trail.length - 1] || null;
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
    allowedActions: deriveAllowedActions(proposal.state),
    targetModule: proposal.target_module,
    targetLabel: TARGET_LABELS[proposal.target_module],
    handoffIntent: String(proposal.handoff_context.proposed_next_action?.handoff_intent || 'open'),
    previewLines: buildPreviewLines(proposal, execution),
    auditCount: proposal.audit_trail.length,
    resultRef: extractResultRef(latestAudit?.detail) || execution?.audit_entry_id || null,
    degraded: execution?.degraded || null,
  };
}

function inferTargetModuleFromChat(
  message: string,
  context: Record<string, unknown>
): { targetModule: HandoffTargetModule; handoffIntent: string } | null {
  const text = String(message || '').trim();
  if (!text) return null;

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

function buildTargetPayloadForChat(params: {
  targetModule: HandoffTargetModule;
  userMessage: string;
  assistantMessage: string;
}): Record<string, unknown> {
  const { targetModule, userMessage, assistantMessage } = params;
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
    return {
      notebook_handoff_context: {
        title,
        body_preview: preview,
        source: 'teresa',
      },
      provenance_markers: { source: 'teresa', user_edit: false, ai_transform: true },
      evidence_pointers: ['chat:teresa'],
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
  const intent = inferTargetModuleFromChat(userMessage, context);
  if (!intent) return null;

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
      handoff_intent: intent.handoffIntent,
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

  await dbRun(
    `INSERT INTO teresa_proposals
       (id, organization_id, user_id, session_id, state, handoff_context_json, target_module, target_payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'proposal', ?, ?, ?, ?, ?)`,
    [
      proposalId,
      organizationId,
      userId,
      sessionId,
      JSON.stringify(handoffContext),
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
    actor: handoffContext.audit_stub.actor,
    fromState: null,
    toState: 'proposal',
    detail: { target_module: targetModule, user_intent: handoffContext.user_intent },
  });

  logger.info(`${LOG_PREFIX} Proposal created: ${proposalId} → ${targetModule}`);

  return {
    id: proposalId,
    organization_id: organizationId,
    user_id: userId,
    session_id: sessionId,
    state: 'proposal',
    handoff_context: handoffContext,
    target_module: targetModule,
    target_payload: targetPayload,
    created_at: now,
    updated_at: now,
    audit_trail: [auditEntry],
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
  await writeAuditEntry({
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
  await writeAuditEntry({
    proposalId,
    action: 'execution_started',
    actor: `user:${userId}`,
    fromState: 'approved',
    toState: 'executing',
    detail: null,
  });

  const targetModule = row.target_module as HandoffTargetModule;

  // Attempt handoff execution — module-owned writes
  try {
    const handoffResult = await performHandoff({
      proposalId,
      organizationId,
      userId,
      targetModule,
      handoffContext: JSON.parse(row.handoff_context_json),
      targetPayload: JSON.parse(row.target_payload_json),
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

    logger.info(`${LOG_PREFIX} Proposal executed: ${proposalId} → ${targetModule}`);

    return {
      success: true,
      proposal_id: proposalId,
      target_module: targetModule,
      state: 'completed',
      audit_entry_id: auditEntry.id,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`${LOG_PREFIX} Execution failed for ${proposalId}: ${errorMsg}`);

    // Check if we can write audit — truth-preserving failure
    try {
      await transitionState(proposalId, 'rejected');
      await writeAuditEntry({
        proposalId,
        action: 'execution_failed',
        actor: 'teresa:system',
        fromState: 'executing',
        toState: 'rejected',
        detail: { error: errorMsg, degraded_scenario: 'D05' },
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
// Core: getProposal + getProposalHistory
// ---------------------------------------------------------------------------

export async function getProposal(
  proposalId: string,
  organizationId: string
): Promise<ProposalRecord | null> {
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
  const { proposalId, organizationId, targetModule, handoffContext, targetPayload } = params;

  // Each target module has its own write lane.
  // Teresa initiates, module writes — per P08_WRITE_OWNERSHIP.
  switch (targetModule) {
    case 'radar':
      return handleRadarHandoff(proposalId, organizationId, handoffContext, targetPayload);
    case 'initiatives':
      return handleInitiativesHandoff(proposalId, organizationId, handoffContext, targetPayload);
    case 'calendar':
      return handleCalendarHandoff(proposalId, organizationId, handoffContext, targetPayload);
    case 'notebook':
      return handleNotebookHandoff(proposalId, organizationId, handoffContext, targetPayload);
    default:
      throw new TeresaCopilotError(`Unknown target module: ${targetModule}`, 'P08_UNKNOWN_TARGET');
  }
}

async function handleRadarHandoff(
  proposalId: string,
  organizationId: string,
  context: TeresaHandoffContext,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const signalId = randomUUID();
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'radar', ?, ?)`,
    [randomUUID(), proposalId, organizationId, signalId, new Date().toISOString()],
    { fallback: true }
  );
  return {
    handoff: 'radar',
    signal_id: signalId,
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
  const initiativeRef = randomUUID();
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'initiatives', ?, ?)`,
    [randomUUID(), proposalId, organizationId, initiativeRef, new Date().toISOString()],
    { fallback: true }
  );
  return {
    handoff: 'initiatives',
    initiative_ref: initiativeRef,
    proposal_only: true,
    user_intent: context.user_intent,
  };
}

async function handleCalendarHandoff(
  proposalId: string,
  organizationId: string,
  context: TeresaHandoffContext,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const calendarRef = randomUUID();
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'calendar', ?, ?)`,
    [randomUUID(), proposalId, organizationId, calendarRef, new Date().toISOString()],
    { fallback: true }
  );
  return {
    handoff: 'calendar',
    calendar_ref: calendarRef,
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
  const noteRef = randomUUID();
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'notebook', ?, ?)`,
    [randomUUID(), proposalId, organizationId, noteRef, new Date().toISOString()],
    { fallback: true }
  );
  return {
    handoff: 'notebook',
    note_ref: noteRef,
    notebook_context: payload.notebook_handoff_context,
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
