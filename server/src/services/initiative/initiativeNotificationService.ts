/**
 * Initiative notification emitters (M13 Depth · Seria R · R4 / M13d).
 *
 * Thin, FAIL-SAFE wrappers over the existing notificationService.send() — they
 * fan one notification per resolved recipient for the four initiative events
 * (status change, assignment, due-date breach, blocker). Channels/email are
 * left to the notification service's per-user preferences (reuse, not reinvent).
 *
 * Recipients are passed in (resolved by the caller via the existing
 * getInitiativeNotificationRecipients helper) so this module stays decoupled
 * and unit-testable. Every emitter swallows errors: a notification must NEVER
 * break the action that triggered it.
 */
import Logger from '../../utils/Logger.js';
import { send } from '../notificationService.js';

const LOG = '[initiative:notify]';

function linkFor(initiativeId: string): string {
  return `/workspace/initiatives?initiative=${encodeURIComponent(initiativeId)}`;
}

interface EmitBase {
  organizationId: string;
  type: string;
  title: string;
  body: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  entityId: string;
  actorId?: string | null;
}

async function emit(
  recipientUserIds: Array<string | null | undefined>,
  base: EmitBase
): Promise<void> {
  const ids = Array.from(new Set((recipientUserIds || []).filter(Boolean).map((v) => String(v))));
  for (const userId of ids) {
    try {
      await send({
        userId,
        organizationId: base.organizationId,
        type: base.type,
        title: base.title,
        body: base.body,
        severity: base.severity || 'INFO',
        entityType: 'initiative',
        entityId: base.entityId,
        actionUrl: linkFor(base.entityId),
        actorId: base.actorId || undefined,
        isActionable: true,
      });
    } catch (e: any) {
      Logger.warn(`${LOG} send failed for user ${userId}:`, e?.message);
    }
  }
}

export async function notifyStatusChange(
  organizationId: string,
  initiativeId: string,
  fromStatus: string,
  toStatus: string,
  recipientUserIds: Array<string | null | undefined>,
  opts?: { actorId?: string | null }
): Promise<void> {
  await emit(recipientUserIds, {
    organizationId,
    type: 'initiative_status_change',
    title: `Initiative status: ${fromStatus} → ${toStatus}`,
    body: `An initiative moved from ${fromStatus} to ${toStatus}.`,
    severity: 'INFO',
    entityId: initiativeId,
    actorId: opts?.actorId,
  });
}

export async function notifyAssignment(
  organizationId: string,
  initiativeId: string,
  assigneeUserId: string,
  role: string,
  opts?: { actorId?: string | null }
): Promise<void> {
  await emit([assigneeUserId], {
    organizationId,
    type: 'initiative_assignment',
    title: `You were assigned: ${role}`,
    body: `You have been assigned as ${role} on an initiative.`,
    severity: 'INFO',
    entityId: initiativeId,
    actorId: opts?.actorId,
  });
}

export async function notifyDueBreach(
  organizationId: string,
  initiativeId: string,
  itemTitle: string,
  dueDate: string,
  recipientUserIds: Array<string | null | undefined>
): Promise<void> {
  await emit(recipientUserIds, {
    organizationId,
    type: 'initiative_due_breach',
    title: `Overdue: ${itemTitle}`,
    body: `"${itemTitle}" passed its due date (${dueDate}).`,
    severity: 'WARNING',
    entityId: initiativeId,
  });
}

export async function notifyBlocker(
  organizationId: string,
  initiativeId: string,
  reason: string,
  recipientUserIds: Array<string | null | undefined>,
  opts?: { actorId?: string | null }
): Promise<void> {
  await emit(recipientUserIds, {
    organizationId,
    type: 'initiative_blocked',
    title: 'Initiative blocked',
    body: reason ? `Blocked: ${reason}` : 'An initiative was marked as blocked.',
    severity: 'CRITICAL',
    entityId: initiativeId,
    actorId: opts?.actorId,
  });
}
