import { describe, expect, it } from 'vitest';

import { hasOrgLevelInterviewAssignPermission } from '../../src/hooks/useInterviewPermissions';

describe('hasOrgLevelInterviewAssignPermission', () => {
  it('treats ADMIN as org-level assign permission', () => {
    expect(hasOrgLevelInterviewAssignPermission('ADMIN')).toBe(true);
  });

  it('treats ADMINISTRATOR as org-level assign permission', () => {
    expect(hasOrgLevelInterviewAssignPermission('ADMINISTRATOR')).toBe(true);
  });

  it('does not grant org-level assign permission to members', () => {
    expect(hasOrgLevelInterviewAssignPermission('MEMBER')).toBe(false);
  });
});
