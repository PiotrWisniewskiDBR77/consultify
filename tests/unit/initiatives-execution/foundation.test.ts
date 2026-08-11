import { describe, expect, it } from 'vitest';

import {
  canTransitionLifecycle,
  INITIATIVE_LIFECYCLE,
  INITIATIVE_LIFECYCLE_TRANSITIONS,
  resolveGovernancePolicy,
  validateMaterialCommandMetadata,
  type GovernancePolicyRef,
} from '@/contracts/initiatives-execution/foundation';

const baseline: GovernancePolicyRef = {
  policyId: 'product-standard',
  version: 1,
  baseline: 'STANDARD',
  strictness: 20,
  source: 'PRODUCT_BASELINE',
};

describe('Initiatives + Execution foundation contract', () => {
  it('defines exactly twelve lifecycle states and only adjacent normal transitions', () => {
    expect(INITIATIVE_LIFECYCLE).toHaveLength(12);
    for (let index = 0; index < INITIATIVE_LIFECYCLE.length - 1; index += 1) {
      const current = INITIATIVE_LIFECYCLE[index];
      const next = INITIATIVE_LIFECYCLE[index + 1];
      expect(canTransitionLifecycle(current, next)).toBe(true);
      expect(INITIATIVE_LIFECYCLE_TRANSITIONS[current]).toEqual([next]);
    }
    expect(INITIATIVE_LIFECYCLE_TRANSITIONS.ARCHIVED).toEqual([]);
    expect(canTransitionLifecycle('REGISTERED_DRAFT', 'APPROVED_BACKLOG')).toBe(false);
  });

  it('resolves Initiative over project over organization over product policy', () => {
    const organization: GovernancePolicyRef = {
      ...baseline,
      policyId: 'org-standard',
      version: 3,
      source: 'ORGANIZATION',
    };
    const project: GovernancePolicyRef = {
      ...baseline,
      policyId: 'project-industrial',
      version: 2,
      strictness: 30,
      source: 'PROJECT',
    };

    expect(
      resolveGovernancePolicy({ productBaseline: baseline, organizationDefault: organization }).effective
        ?.policyId
    ).toBe('org-standard');
    expect(
      resolveGovernancePolicy({
        productBaseline: baseline,
        organizationDefault: organization,
        projectOverride: project,
      }).effective?.policyId
    ).toBe('project-industrial');
  });

  it('blocks an unapproved downgrade and permits the same downgrade with a Decision reference', () => {
    const project: GovernancePolicyRef = {
      ...baseline,
      policyId: 'project-complex',
      baseline: 'COMPLEX',
      strictness: 30,
      source: 'PROJECT',
    };
    const initiative: GovernancePolicyRef = {
      ...baseline,
      policyId: 'initiative-lite',
      baseline: 'LITE',
      strictness: 10,
      source: 'INITIATIVE',
    };

    expect(
      resolveGovernancePolicy({
        productBaseline: baseline,
        projectOverride: project,
        initiativeOverride: initiative,
      })
    ).toMatchObject({ status: 'BLOCKED', effective: null });

    expect(
      resolveGovernancePolicy({
        productBaseline: baseline,
        projectOverride: project,
        initiativeOverride: initiative,
        downgradeDecisionId: 'decision-1',
      })
    ).toMatchObject({ status: 'RESOLVED', effective: initiative });
  });

  it('requires human confirmation when evidence recommends stricter governance', () => {
    expect(
      resolveGovernancePolicy({ productBaseline: baseline, recommendedMinimumStrictness: 30 })
    ).toMatchObject({ status: 'HUMAN_CONFIRMATION_REQUIRED', effective: null });
  });

  it('rejects material commands without concurrency, idempotency and policy metadata', () => {
    expect(
      validateMaterialCommandMetadata({
        organizationId: '',
        actorId: 'actor',
        clientRequestId: '',
        correlationId: 'corr',
        expectedVersion: -1,
        policyId: 'standard',
        policyVersion: 0,
      })
    ).toEqual([
      'organizationId is required',
      'clientRequestId is required',
      'expectedVersion must be a non-negative integer',
      'policyVersion must be a positive integer',
    ]);
  });
});
