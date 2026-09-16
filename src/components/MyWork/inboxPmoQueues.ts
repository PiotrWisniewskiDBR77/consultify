import type { InboxItem } from './InboxContent';
import type { TransitionProposal } from '@/services/initiativeTransitionInboxApi';
import type {
  PendingAnalysisDecisionReadModel,
  PendingDefinitionDecisionReadModel,
} from '@/services/initiatives-execution/runtimeApi';

export type InboxPmoQueue = 'review' | 'discuss' | 'approve' | 'blocked' | 'overdue';

function pendingGateDecisionInboxItem(
  decision: PendingDefinitionDecisionReadModel | PendingAnalysisDecisionReadModel,
  copy: { title: string; reason: string; description: string }
): InboxItem {
  return {
    id: decision.decisionId,
    type: 'review_request',
    section: 'assigned_tasks',
    title: copy.title,
    description: copy.description,
    source: { type: 'system' },
    receivedAt: decision.requestedAt,
    dueDate: decision.dueAt,
    urgency: 'normal',
    triaged: false,
    itemStatus: 'open',
    reason: copy.reason,
    isActionable: true,
    itemType: 'review',
    sourceEntityType: 'initiative_stage',
    initiativeId: decision.initiativeId,
    _key: `decision:${decision.decisionId}`,
  };
}

export const definitionDecisionInboxItem = (
  decision: PendingDefinitionDecisionReadModel,
  copy: { title: string; reason: string; description: string }
): InboxItem => pendingGateDecisionInboxItem(decision, copy);

export const analysisDecisionInboxItem = (
  decision: PendingAnalysisDecisionReadModel,
  copy: { title: string; reason: string; description: string }
): InboxItem => pendingGateDecisionInboxItem(decision, copy);

type ActorScopedDecision = {
  decisionId: string;
  initiativeId: string;
  requestedAt?: string;
  dueAt?: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function actorScopedDecisionList(body: unknown): ActorScopedDecision[] {
  const root = record(body);
  const raw = Array.isArray(body) ? body : Array.isArray(root?.decisions) ? root.decisions : [];
  return raw.flatMap((value) => {
    const entry = record(value);
    const decisionId = String(entry?.decisionId ?? '').trim();
    const initiativeId = String(entry?.initiativeId ?? '').trim();
    if (!decisionId || !initiativeId) return [];
    return [
      {
        decisionId,
        initiativeId,
        requestedAt: typeof entry?.requestedAt === 'string' ? entry.requestedAt : undefined,
        dueAt: typeof entry?.dueAt === 'string' ? entry.dueAt : undefined,
      },
    ];
  });
}

export function actorScopedDecisionInboxItem(
  decision: ActorScopedDecision,
  copy: { title: string; reason: string; description: string }
): InboxItem {
  return {
    id: decision.decisionId,
    type: 'decision_request',
    section: 'approvals_gates',
    title: copy.title,
    description: copy.description,
    source: { type: 'system' },
    receivedAt: decision.requestedAt || new Date(0).toISOString(),
    dueDate: decision.dueAt,
    urgency: 'normal',
    triaged: false,
    itemStatus: 'open',
    reason: copy.reason,
    isActionable: true,
    itemType: 'approval',
    sourceEntityType: 'initiative_stage',
    initiativeId: decision.initiativeId,
    _key: `decision:${decision.decisionId}`,
  };
}

export function acceptanceDecisionInboxItems(
  body: unknown,
  copy: { title: string; reason: string; description: string }
): InboxItem[] {
  const root = record(body);
  const delivery = Array.isArray(root?.delivery) ? root.delivery : [];
  const results = Array.isArray(root?.results) ? root.results : [];
  return [...delivery, ...results].flatMap((value) => {
    const entry = record(value);
    const decisionId = String(entry?.decisionId ?? entry?.resultsCaseId ?? '').trim();
    const initiativeId = String(entry?.initiativeId ?? '').trim();
    if (!decisionId || !initiativeId) return [];
    return [actorScopedDecisionInboxItem({ decisionId, initiativeId }, copy)];
  });
}

export function transitionProposalInboxItem(
  proposal: TransitionProposal,
  copy: { title: string; reason: string }
): InboxItem {
  return {
    id: proposal.proposalVersionId,
    type: 'decision_request',
    section: 'approvals_gates',
    title: proposal.initiativeName || copy.title,
    description: `${proposal.fromStatus} → ${proposal.toStatus}`,
    source: { type: 'system' },
    receivedAt: proposal.createdAt,
    dueDate: proposal.expiresAt,
    urgency: 'normal',
    triaged: false,
    itemStatus: 'open',
    reason: proposal.reason || copy.reason,
    isActionable: proposal.viewerIsReviewer,
    itemType: 'approval',
    sourceEntityType: 'initiative_stage',
    initiativeId: proposal.initiativeId,
    _key: `decision:${proposal.proposalVersionId}`,
  };
}

export function inboxPmoQueue(item: InboxItem, now: Date = new Date()): InboxPmoQueue | null {
  if (item.sourceEntityType !== 'initiative_stage' || !item.initiativeId) return null;
  const dueRaw = item.sla?.dueAt || item.dueDate;
  const due = dueRaw ? new Date(dueRaw).getTime() : Number.NaN;
  if (item.sla?.isBreached || (Number.isFinite(due) && due < now.getTime())) return 'overdue';
  if (item.section === 'blocked_escalations') return 'blocked';
  if (item.section === 'approvals_gates' || item.type === 'decision_request') return 'approve';
  if (item.section === 'decisions_required' || item.type === 'mention') return 'discuss';
  return 'review';
}
