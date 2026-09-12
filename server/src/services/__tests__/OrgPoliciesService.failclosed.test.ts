/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { OrgPoliciesError, requireNoLegalHoldInTransaction } from '../OrgPoliciesService.js';

describe('CODEX6 E4 legal-hold reads fail closed', () => {
  it('maps a policy read failure to a controlled service-unavailable error', async () => {
    const client = {
      query: async () => { throw new Error('synthetic policy read failure'); },
    } as any;
    await expect(requireNoLegalHoldInTransaction(client, 'org-test', 'ORG_DELETION')).rejects.toEqual(
      expect.objectContaining<Partial<OrgPoliciesError>>({ code: 'POLICY_READ_FAILED', statusCode: 503 })
    );
  });
});
