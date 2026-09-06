import { describe, expect, it } from 'vitest';
import { applyAcceptedPlanProposal } from '../planProposalReview';

describe('P11 — zatwierdzenie propozycji planu', () => {
  const before = [{ initiativeId: 'i1', target: '2026-09-01' }];
  const changes = [{ initiativeId: 'i1', after: { initiativeId: 'i1', target: '2026-10-01' } }];

  it('nie zmienia planu przed statusem ACCEPTED', () => {
    expect(applyAcceptedPlanProposal(before, changes, 'PENDING_REVIEW')).toBe(before);
  });

  it('stosuje propozycję dopiero po statusie ACCEPTED', () => {
    expect(applyAcceptedPlanProposal(before, changes, 'ACCEPTED')[0].target).toBe('2026-10-01');
  });
});
