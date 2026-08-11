import { describe, expect, it } from 'vitest';
import {
  assertGovernanceGate,
  type GovernanceGate,
} from '../../../server/src/domain/initiatives-execution/organizationGovernance';
const gates: GovernanceGate[] = ['DEFINITION', 'ANALYSIS', 'PORTFOLIO', 'SCHEDULE', 'HANDOFF'];
const policy = (baseline: 'BASELINE_SMALL' | 'STANDARD' | 'COMPLEX', roleBindings: any[]) => ({
  policyId: `p-${baseline}`,
  version: 3,
  baseline,
  strictness: baseline === 'BASELINE_SMALL' ? 1 : baseline === 'STANDARD' ? 2 : 3,
  source: 'ORGANIZATION' as const,
  config: { enforceGateGovernance: true, roleBindings },
});
describe('Organization Governance Profiles', () => {
  it.each(gates)(
    '%s applies profile-specific authority/quorum to identical business input',
    (gate) => {
      expect(() =>
        assertGovernanceGate(
          policy('BASELINE_SMALL', [{ roleKey: 'TEAM_LEAD', principalId: 'boss' }]),
          gate,
          {
            policyId: 'p-BASELINE_SMALL',
            policyVersion: 3,
            requesterId: 'boss',
            approvals: [{ actorId: 'boss', roleKey: 'TEAM_LEAD' }],
          }
        )
      ).not.toThrow();
      expect(() =>
        assertGovernanceGate(
          policy('STANDARD', [{ roleKey: 'GATE_AUTHORITY', principalId: 'approver' }]),
          gate,
          {
            policyId: 'p-STANDARD',
            policyVersion: 3,
            requesterId: 'requester',
            approvals: [{ actorId: 'approver', roleKey: 'GATE_AUTHORITY' }],
          }
        )
      ).not.toThrow();
      expect(() =>
        assertGovernanceGate(
          policy('COMPLEX', [
            { roleKey: 'BUSINESS_AUTHORITY', principalId: 'business' },
            { roleKey: 'DOMAIN_AUTHORITY', principalId: 'domain' },
          ]),
          gate,
          {
            policyId: 'p-COMPLEX',
            policyVersion: 3,
            requesterId: 'requester',
            approvals: [
              { actorId: 'business', roleKey: 'BUSINESS_AUTHORITY' },
              { actorId: 'domain', roleKey: 'DOMAIN_AUTHORITY' },
            ],
          }
        )
      ).not.toThrow();
      expect(() =>
        assertGovernanceGate(
          policy('COMPLEX', [{ roleKey: 'ADMIN', principalId: 'admin' }]),
          gate,
          {
            policyId: 'p-COMPLEX',
            policyVersion: 3,
            requesterId: 'requester',
            approvals: [{ actorId: 'admin', roleKey: 'ADMIN' }],
          }
        )
      ).toThrow('quorum');
    }
  );
});
