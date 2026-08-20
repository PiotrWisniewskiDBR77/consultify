import type { FederatedActionEntry } from '../../shared/contracts/federatedActionManifest';
import { IDEA_ACTION_REGISTRY } from './ideaActionRegistry';
import { CHAT_ACTION_DEFINITIONS } from '@/types/domain/chatActions';

export function adaptIdeaActions(): FederatedActionEntry[] {
  return IDEA_ACTION_REGISTRY.map((action) => ({
    actionId: `${action.id}@1`, version: 1, module: 'IDEA',
    surface: action.ownerSurface ?? action.surfaces[0] ?? 'registry',
    mountedMutationId: action.mutates ? action.id : null,
    effect: action.destructive ? 'DESTRUCTIVE_MUTATION' : action.mutates ? 'REVERSIBLE_MUTATION' : 'READ',
    roles: [action.permission?.requiredRole ?? 'AUTHENTICATED'], tenantScope: 'ORGANIZATION',
    preview: action.requiresPreview ? 'REQUIRED' : 'NOT_REQUIRED',
    confirm: action.teresa.confirmBeforeRun ? 'REQUIRED' : 'NOT_REQUIRED',
    idempotency: action.mutates ? 'idea-action-runtime-correlation' : null,
    receipt: action.mutates ? 'ActionResult.confirmed' : null,
    auditEvent: action.mutates ? action.analyticsEvent ?? `idea.action.${action.id}` : null,
    compensation: action.undo ? `${action.undo.kind}:${action.undo.evidence}` : 'read-only',
    uiExecutor: action.source,
    teresaExecutor: `runIdeaAction:${action.id}`,
    mvpDisposition: 'SUPPORTED',
  }));
}

const CHAT_MUTATIONS = new Set(['CREATE_TASK', 'CREATE_DECISION', 'CREATE_INITIATIVE', 'ASSIGN_INTERVIEW', 'RECORD_KPI']);
export function adaptChatActions(): FederatedActionEntry[] {
  return CHAT_ACTION_DEFINITIONS.map((action) => {
    const mutates = CHAT_MUTATIONS.has(action.type);
    return {
      actionId: `chat.${action.type.toLowerCase()}@1`, version: 1, module: 'CHAT', surface: 'chat-action-registry',
      mountedMutationId: mutates ? `chat:${action.type}` : null,
      effect: mutates ? 'PROPOSAL' : 'READ', roles: ['CAPABILITY_CHECKED'], tenantScope: 'ORGANIZATION',
      preview: mutates ? 'REQUIRED' : 'NOT_REQUIRED', confirm: mutates ? 'REQUIRED' : 'NOT_REQUIRED',
      idempotency: mutates ? 'proposal-id' : null, receipt: mutates ? 'proposal-receipt' : null,
      auditEvent: mutates ? 'chat.action.proposed' : null, compensation: mutates ? 'reject-proposal-before-write' : 'read-only',
      uiExecutor: `chatActionRegistry:${action.type}`, teresaExecutor: `chatActionRegistry:${action.type}`,
      mvpDisposition: 'SUPPORTED',
    };
  });
}
