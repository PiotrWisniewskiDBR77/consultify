import type { FederatedActionEntry } from '../../../../shared/contracts/federatedActionManifest.js';
import { TERESA_CAPABILITY_REGISTRY } from './teresaCapabilities.js';
import type { ExecutionActionPolicy } from '../executionActionRegistryService.js';

export function adaptDynamicSwotActions(): FederatedActionEntry[] {
  return Object.values(TERESA_CAPABILITY_REGISTRY).map(({ definition, handler }) => ({
    actionId: `dynamic-swot.${definition.id}@1`, version: 1, module: 'DYNAMIC_SWOT', surface: 'dynamic-swot-teresa-kernel',
    mountedMutationId: handler && definition.producesProposal ? `dynamic-swot:${definition.id}` : null,
    effect: definition.producesProposal ? 'PROPOSAL' : 'READ', roles: [...definition.allowedRoles], tenantScope: 'ORGANIZATION',
    preview: definition.producesProposal ? 'REQUIRED' : 'NOT_REQUIRED',
    confirm: definition.producesProposal ? 'REQUIRED' : 'NOT_REQUIRED',
    idempotency: handler && definition.producesProposal ? 'teresa-proposal-id' : null,
    receipt: handler && definition.producesProposal ? 'teresa-settle-receipt' : null,
    auditEvent: handler && definition.producesProposal ? 'teresa.proposal.settled' : null,
    compensation: definition.producesProposal ? 'reject-proposal-before-write' : 'read-only',
    uiExecutor: handler ? `teresaKernel:${definition.id}` : null,
    teresaExecutor: handler ? `teresaKernel:${definition.id}` : null,
    mvpDisposition: handler ? 'SUPPORTED' : 'NOT_SUPPORTED_IN_MVP',
  }));
}

export function adaptExecutionActions(policies: readonly ExecutionActionPolicy[]): FederatedActionEntry[] {
  return policies.map((policy) => ({
    actionId: `${policy.actionId}@1`, version: 1,
    module: policy.targetType.startsWith('case') ? 'CASE_WORKSPACE' : 'EXECUTION',
    surface: 'execution-action-registry', mountedMutationId: policy.actionId,
    effect: policy.destructive ? 'DESTRUCTIVE_MUTATION' : 'REVERSIBLE_MUTATION',
    roles: [policy.minimumRole], tenantScope: 'ORGANIZATION', preview: 'REQUIRED', confirm: 'REQUIRED',
    idempotency: 'requestId', receipt: 'execution_action_audit', auditEvent: 'execution_action_audit',
    compensation: policy.destructive ? 'explicit-irreversible-boundary' : 'domain-compensating-command',
    uiExecutor: `executeGovernedExecutionAction:${policy.actionId}`,
    teresaExecutor: `executeGovernedExecutionAction:${policy.actionId}`,
    mvpDisposition: policy.runtimeState === 'IMPLEMENTED' ? 'SUPPORTED' : 'NOT_SUPPORTED_IN_MVP',
  }));
}
