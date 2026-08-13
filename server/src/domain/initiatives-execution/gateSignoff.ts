import { createHash } from 'node:crypto';

import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import { assertGovernanceGate, gateRule, type GovernanceGate } from './organizationGovernance.js';
import type { EffectiveGovernancePolicy } from './postgresGovernancePolicyResolver.js';
export interface GateSignoff {
  signoffId: string;
  gate: GovernanceGate;
  decisionId: string;
  initiativeId: string;
  policyId: string;
  policyVersion: number;
  signerId: string;
  roleKey: string;
  outcome: 'APPROVE' | 'REJECT' | 'ABSTAIN';
  delegationProof: { delegatedFrom: string; delegationRef: string; version: number } | null;
  rationale: string;
  signedAt: string;
}
export interface GateQuorum {
  quorumId: string;
  gate: GovernanceGate;
  decisionId: string;
  initiativeId: string;
  requesterId: string;
  policyId: string;
  policyVersion: number;
  status: 'COLLECTING' | 'SATISFIED' | 'REJECTED';
  signoffs: GateSignoff[];
  receiptId: string | null;
  updatedAt: string;
}
export function gateSignoffId(
  gate: GovernanceGate,
  decisionId: string,
  signerId: string,
  roleKey: string
) {
  return createHash('sha256')
    .update(`${gate}\0${decisionId}\0${signerId}\0${roleKey}`)
    .digest('hex');
}
export async function submitGateSignoff(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    expectedQuorumVersion: number;
    gate: GovernanceGate;
    decisionId: string;
    initiativeId: string;
    requesterId: string;
    roleKey: string;
    outcome: 'APPROVE' | 'REJECT' | 'ABSTAIN';
    delegationProof: GateSignoff['delegationProof'];
    rationale: string;
    policy: EffectiveGovernancePolicy;
  }>
): Promise<MaterialCommandResult<GateSignoff>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    if (
      envelope.aggregateId !== gateSignoffId(p.gate, p.decisionId, envelope.actorId, p.roleKey) ||
      p.policy.policyId !== envelope.policyId ||
      p.policy.version !== envelope.policyVersion
    )
      throw new MaterialCommandValidationError(
        'Exact signoff identity and policy snapshot required'
      );
    const bindings = (p.policy.config.roleBindings ?? []) as Array<{
      roleKey: string;
      principalId: string;
      delegates?: Array<{
        principalId: string;
        gates: GovernanceGate[];
        expiresAt: string;
        delegationRef?: string;
        version?: number;
      }>;
    }>;
    const direct = bindings.some(
      (b) => b.roleKey === p.roleKey && b.principalId === envelope.actorId
    );
    let delegated = false;
    if (p.delegationProof) {
      const principal = bindings.find(
        (b) => b.roleKey === p.roleKey && b.principalId === p.delegationProof!.delegatedFrom
      );
      delegated = Boolean(
        principal?.delegates?.some(
          (d) =>
            d.principalId === envelope.actorId &&
            d.gates.includes(p.gate) &&
            Date.parse(d.expiresAt) > Date.now() &&
            d.delegationRef === p.delegationProof!.delegationRef &&
            d.version === p.delegationProof!.version
        )
      );
    }
    const requiredRoles = gateRule(p.policy, p.gate).requiredRoles;
    if ((!direct && !delegated) || (requiredRoles.length > 0 && !requiredRoles.includes(p.roleKey)))
      throw new MaterialCommandValidationError(
        'Authorized signer role or exact delegation proof required'
      );
    const now = new Date().toISOString(),
      signoff: GateSignoff = {
        signoffId: envelope.aggregateId,
        gate: p.gate,
        decisionId: p.decisionId,
        initiativeId: p.initiativeId,
        policyId: p.policy.policyId,
        policyVersion: p.policy.version,
        signerId: envelope.actorId,
        roleKey: p.roleKey,
        outcome: p.outcome,
        delegationProof: p.delegationProof,
        rationale: p.rationale,
        signedAt: now,
      };
    const quorumId = `${p.gate}:${p.decisionId}`,
      stored = await tx.getRelatedAggregateForUpdate<GateQuorum>(
        envelope.organizationId,
        'gate_quorum',
        quorumId
      );
    if ((stored?.version ?? 0) !== p.expectedQuorumVersion)
      throw new MaterialCommandValidationError('Exact Gate Quorum version required');
    const signoffs = [...(stored?.payload.signoffs ?? []), signoff];
    let status: GateQuorum['status'] = 'COLLECTING',
      receiptId: string | null = null;
    if (signoffs.some((s) => s.outcome === 'REJECT')) status = 'REJECTED';
    else {
      try {
        assertGovernanceGate(p.policy, p.gate, {
          policyId: p.policy.policyId,
          policyVersion: p.policy.version,
          requesterId: p.requesterId,
          approvals: signoffs
            .filter((s) => s.outcome === 'APPROVE')
            .map((s) => ({
              actorId: s.signerId,
              roleKey: s.roleKey,
              delegatedFrom: s.delegationProof?.delegatedFrom,
            })),
        });
        status = 'SATISFIED';
        receiptId = createHash('sha256')
          .update(
            `${quorumId}\0${p.policy.policyId}\0${p.policy.version}\0${signoffs
              .map((s) => s.signoffId)
              .sort()
              .join(',')}`
          )
          .digest('hex');
      } catch {
        status = 'COLLECTING';
      }
    }
    const quorum: GateQuorum = {
      quorumId,
      gate: p.gate,
      decisionId: p.decisionId,
      initiativeId: p.initiativeId,
      requesterId: p.requesterId,
      policyId: p.policy.policyId,
      policyVersion: p.policy.version,
      status,
      signoffs,
      receiptId,
      updatedAt: now,
    };
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'gate_quorum',
      quorumId,
      stored?.version ?? 0,
      (stored?.version ?? 0) + 1,
      quorum
    );
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `GATE_SIGNOFF:${envelope.aggregateId}`,
      sourceType: 'gate_signoff',
      sourceId: envelope.aggregateId,
      sourceVersion: 1,
      targetType: 'gate_quorum',
      targetId: quorumId,
      payload: { roleKey: p.roleKey, outcome: p.outcome },
    });
    return {
      mutation: signoff,
      response: signoff,
      eventType: 'gate.signoff-recorded',
      eventPayload: { signoff, quorum },
      auditPayload: { signoff, quorum },
    };
  });
}
export async function assertGateQuorumReceipt(
  tx: MaterialCommandTransaction,
  organizationId: string,
  input: {
    required?: boolean;
    gate: GovernanceGate;
    decisionId: string;
    policyId: string;
    policyVersion: number;
    quorumRef?: { quorumId: string; version: number; receiptId: string };
  }
) {
  if (!input.required) return;
  if (!input.quorumRef)
    throw new MaterialCommandValidationError('Persisted Gate Quorum receipt required');
  const q = await tx.getRelatedAggregateForUpdate<GateQuorum>(
    organizationId,
    'gate_quorum',
    input.quorumRef.quorumId
  );
  if (
    !q ||
    q.version !== input.quorumRef.version ||
    q.payload.status !== 'SATISFIED' ||
    q.payload.receiptId !== input.quorumRef.receiptId ||
    q.payload.gate !== input.gate ||
    q.payload.decisionId !== input.decisionId ||
    q.payload.policyId !== input.policyId ||
    q.payload.policyVersion !== input.policyVersion
  )
    throw new MaterialCommandValidationError('Exact satisfied Gate Quorum receipt required');
}
