import type { EffectiveGovernancePolicy } from './postgresGovernancePolicyResolver.js';
export type GovernanceGate =
  | 'DEFINITION'
  | 'ANALYSIS'
  | 'PORTFOLIO'
  | 'SCHEDULE'
  | 'HANDOFF'
  | 'CLOSURE';
type Approval = { actorId: string; roleKey: string; delegatedFrom?: string | null };
export class GovernanceGateError extends Error {}
export function gateRule(policy: EffectiveGovernancePolicy, gate: GovernanceGate) {
  const defaults =
    policy.baseline === 'BASELINE_SMALL'
      ? { quorum: 1, requiredRoles: [] as string[], separation: false, slaHours: 72 }
      : policy.baseline === 'STANDARD'
        ? { quorum: 1, requiredRoles: ['GATE_AUTHORITY'], separation: true, slaHours: 48 }
        : {
            quorum: 2,
            requiredRoles: ['BUSINESS_AUTHORITY', 'DOMAIN_AUTHORITY'],
            separation: true,
            slaHours: 24,
          };
  const gates = (policy.config.gates ?? {}) as Record<string, Partial<typeof defaults>>;
  return { ...defaults, ...(gates[gate] ?? {}) };
}
export function assertGovernanceGate(
  policy: EffectiveGovernancePolicy,
  gate: GovernanceGate,
  input: { policyId: string; policyVersion: number; requesterId: string; approvals: Approval[] }
) {
  if (!policy.config.enforceGateGovernance) return;
  if (input.policyId !== policy.policyId || input.policyVersion !== policy.version)
    throw new GovernanceGateError('Exact governance policy snapshot required');
  const rule = gateRule(policy, gate),
    bindings = (policy.config.roleBindings ?? []) as Array<{
      roleKey: string;
      principalId: string;
      delegates?: Array<{ principalId: string; gates: GovernanceGate[]; expiresAt: string }>;
    }>;
  const valid = input.approvals.filter((a) => {
    const b = bindings.find((x) => x.roleKey === a.roleKey && x.principalId === a.actorId);
    if (b) return true;
    if (!a.delegatedFrom) return false;
    const principal = bindings.find(
      (x) => x.roleKey === a.roleKey && x.principalId === a.delegatedFrom
    );
    return Boolean(
      principal?.delegates?.some(
        (d) =>
          d.principalId === a.actorId &&
          d.gates.includes(gate) &&
          Date.parse(d.expiresAt) > Date.now()
      )
    );
  });
  const unique = [...new Map(valid.map((a) => [a.actorId, a])).values()];
  if (unique.length < rule.quorum) throw new GovernanceGateError('Governance quorum missing');
  for (const role of rule.requiredRoles)
    if (!unique.some((a) => a.roleKey === role))
      throw new GovernanceGateError(`Required governance role missing: ${role}`);
  if (rule.separation && unique.some((a) => a.actorId === input.requesterId))
    throw new GovernanceGateError('Separation of duties violation');
}
