import { beforeEach, describe, expect, it } from 'vitest';

import { createAIProposal, resolveAIProposal } from '../mindmapService.js';

describe('mindmap AI proposals tenancy', () => {
  const ORG_A = 'org-a';
  const ORG_B = 'org-b';
  const MINDMAP_ID = 'mindmap-1';

  beforeEach(async () => {
    const seed = await createAIProposal(MINDMAP_ID, ORG_A, {
      mindmap_id: MINDMAP_ID,
      summary: 'seed',
      plan: 'seed',
      operations: [],
      diff_summary: { added: 0, renamed: 0, moved: 0, deleted: 0, destructive: false },
    });
    await resolveAIProposal(seed.id, 'reject', ORG_A);
  });

  it('returns PROPOSAL_NOT_FOUND when resolving proposal from another organization', async () => {
    const proposal = await createAIProposal(MINDMAP_ID, ORG_A, {
      mindmap_id: MINDMAP_ID,
      summary: 'cross-tenant test',
      plan: 'none',
      operations: [],
      diff_summary: { added: 0, renamed: 0, moved: 0, deleted: 0, destructive: false },
    });

    const result = await resolveAIProposal(proposal.id, 'accept', ORG_B);
    expect(result.success).toBe(false);
    expect(result.error_code).toBe('PROPOSAL_NOT_FOUND');
  });

  it('still resolves proposal for the same organization', async () => {
    const proposal = await createAIProposal(MINDMAP_ID, ORG_A, {
      mindmap_id: MINDMAP_ID,
      summary: 'same-tenant test',
      plan: 'none',
      operations: [],
      diff_summary: { added: 0, renamed: 0, moved: 0, deleted: 0, destructive: false },
    });

    const result = await resolveAIProposal(proposal.id, 'reject', ORG_A);
    expect(result.success).toBe(true);
    expect(result.proposal?.status).toBe('rejected');
  });
});
