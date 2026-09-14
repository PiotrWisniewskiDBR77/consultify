import { describe, expect, it } from 'vitest';

import { isEligibleWorkReportApprover } from '../InitiativeWorkReportView';

describe('work report approver eligibility', () => {
  it('allows only another active admin, owner or superadmin', () => {
    expect(
      isEligibleWorkReportApprover(
        { userId: 'admin-1', role: 'admin', status: 'active' },
        'owner-1'
      )
    ).toBe(true);
    expect(
      isEligibleWorkReportApprover(
        { user_id: 'owner-2', role: 'owner', status: 'active' },
        'owner-1'
      )
    ).toBe(true);
    expect(
      isEligibleWorkReportApprover(
        { userId: 'super-1', role: 'SUPER_ADMIN', status: 'active' },
        'owner-1'
      )
    ).toBe(true);
    expect(
      isEligibleWorkReportApprover(
        { userId: 'member-1', role: 'member', status: 'active' },
        'owner-1'
      )
    ).toBe(false);
    expect(
      isEligibleWorkReportApprover(
        { userId: 'admin-2', role: 'admin', status: 'suspended' },
        'owner-1'
      )
    ).toBe(false);
    expect(
      isEligibleWorkReportApprover(
        { userId: 'owner-1', role: 'admin', status: 'active' },
        'owner-1'
      )
    ).toBe(false);
  });
});
