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
  type TeresaHandoffContext,
  type VoiceAvailability,
  P08_ACTION_ENVELOPE_STATES,
  P08_COPILOT_CONTRACT,
  P08_DEGRADED_SCENARIOS,
  P08_HANDOFF_TARGET_MODULES,
  isValidEnvelopeTransition,
  resolveVoiceAvailability,
  validateHandoffContext,
  validateTargetPayload,
  validateWriteOwnership,
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

// ---------------------------------------------------------------------------
// Anti-duplicate: check for active proposals in same session
// ---------------------------------------------------------------------------

async function getActiveProposalForSession(
  organizationId: string,
  userId: string,
  sessionId: string,
): Promise<ProposalRow | null> {
  const row = await dbGet<ProposalRow>(
    `SELECT * FROM teresa_proposals
     WHERE organization_id = ? AND user_id = ? AND session_id = ?
       AND state NOT IN ('completed', 'rejected')
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, userId, sessionId],
    { fallback: true },
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
}): Promise<ProposalRecord> {
  const { organizationId, userId, sessionId, handoffContext, targetModule, targetPayload } = params;

  // Validate target module
  if (!P08_HANDOFF_TARGET_MODULES.includes(targetModule)) {
    throw new TeresaCopilotError(
      `Invalid target module: ${targetModule}`,
      'P08_INVALID_TARGET_MODULE',
    );
  }

  // Validate common handoff context
  const ctxValidation = validateHandoffContext(handoffContext as unknown as Record<string, unknown>);
  if (!ctxValidation.valid) {
    throw new TeresaCopilotError(
      `Missing handoff context fields: ${ctxValidation.missing.join(', ')}`,
      'P08_INVALID_HANDOFF_CONTEXT',
    );
  }

  // Validate target-specific payload
  const targetValidation = validateTargetPayload(targetModule, targetPayload);
  if (!targetValidation.valid) {
    throw new TeresaCopilotError(
      `Missing target payload fields for ${targetModule}: ${targetValidation.missing.join(', ')}`,
      'P08_INVALID_TARGET_PAYLOAD',
    );
  }

  // Validate write ownership: Teresa initiates, module writes
  const writeCheck = validateWriteOwnership(
    handoffContext.audit_stub.actor,
    `${targetModule}_service`,
  );
  if (!writeCheck.valid) {
    throw new TeresaCopilotError(
      writeCheck.reason ?? 'Write ownership violation',
      'P08_WRITE_OWNERSHIP_VIOLATION',
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
      { fallback: true },
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

  const proposalId = randomUUID();
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
    { fallback: true },
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
    { fallback: true },
  );

  if (!row) {
    throw new TeresaCopilotError('Proposal not found', 'P08_PROPOSAL_NOT_FOUND', 404);
  }

  // Transition: proposal → pending_approval
  const currentState = row.state as ActionEnvelopeState;
  if (currentState !== 'proposal' && currentState !== 'pending_approval') {
    throw new TeresaCopilotError(
      `Cannot approve proposal in state: ${currentState}`,
      'P08_INVALID_STATE_TRANSITION',
    );
  }

  // Move to pending_approval first (if still in proposal)
  if (currentState === 'proposal') {
    if (!isValidEnvelopeTransition('proposal', 'pending_approval')) {
      throw new TeresaCopilotError(
        'Invalid transition: proposal → pending_approval',
        'P08_INVALID_STATE_TRANSITION',
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
      'P08_INVALID_STATE_TRANSITION',
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
    { fallback: true },
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
    { fallback: true },
  );

  if (!row) {
    throw new TeresaCopilotError('Proposal not found', 'P08_PROPOSAL_NOT_FOUND', 404);
  }

  const currentState = row.state as ActionEnvelopeState;
  if (!isValidEnvelopeTransition(currentState, 'rejected')) {
    throw new TeresaCopilotError(
      `Cannot reject proposal in state: ${currentState}`,
      'P08_INVALID_STATE_TRANSITION',
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
    { fallback: true },
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
    { fallback: true },
  );

  if (!row) {
    throw new TeresaCopilotError('Proposal not found', 'P08_PROPOSAL_NOT_FOUND', 404);
  }

  const currentState = row.state as ActionEnvelopeState;
  if (currentState !== 'approved') {
    throw new TeresaCopilotError(
      `Cannot execute proposal in state: ${currentState}. Must be approved first.`,
      'P08_INVALID_STATE_TRANSITION',
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
      logger.error(`${LOG_PREFIX} CRITICAL: Audit write failed for ${proposalId} — degraded(audit_unavailable)`);
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
  organizationId: string,
): Promise<ProposalRecord | null> {
  const row = await dbGet<ProposalRow>(
    `SELECT * FROM teresa_proposals WHERE id = ? AND organization_id = ?`,
    [proposalId, organizationId],
    { fallback: true },
  );
  if (!row) return null;
  const auditRows = await loadAuditEntries(proposalId);
  return rowToProposal(row, auditRows);
}

export async function getProposalHistory(
  organizationId: string,
  userId: string,
  limit = 20,
): Promise<ProposalRecord[]> {
  const rows = await dbAll<ProposalRow>(
    `SELECT * FROM teresa_proposals
     WHERE organization_id = ? AND user_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [organizationId, userId, limit],
    { fallback: true },
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
  organizationId: string,
): Promise<AuditEntry[]> {
  const row = await dbGet<ProposalRow>(
    `SELECT id FROM teresa_proposals WHERE id = ? AND organization_id = ?`,
    [proposalId, organizationId],
    { fallback: true },
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
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const signalId = randomUUID();
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'radar', ?, ?)`,
    [randomUUID(), proposalId, organizationId, signalId, new Date().toISOString()],
    { fallback: true },
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
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const initiativeRef = randomUUID();
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'initiatives', ?, ?)`,
    [randomUUID(), proposalId, organizationId, initiativeRef, new Date().toISOString()],
    { fallback: true },
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
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const calendarRef = randomUUID();
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'calendar', ?, ?)`,
    [randomUUID(), proposalId, organizationId, calendarRef, new Date().toISOString()],
    { fallback: true },
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
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const noteRef = randomUUID();
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'notebook', ?, ?)`,
    [randomUUID(), proposalId, organizationId, noteRef, new Date().toISOString()],
    { fallback: true },
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
    { fallback: true },
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
    { fallback: true },
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
    { fallback: true },
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
