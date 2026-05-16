import { describe, expect, it } from 'vitest';

import { hasPresentationCapability } from '../presentationAccessPolicyService.js';

describe('presentationAccessPolicyService', () => {
  it('allows admin-level capabilities for ADMIN role', () => {
    expect(hasPresentationCapability('ADMIN', 'presentation_approve')).toBe(true);
    expect(hasPresentationCapability('ADMIN', 'brand_change')).toBe(true);
  });

  it('blocks approval and brand changes for team member roles', () => {
    expect(hasPresentationCapability('TEAM_MEMBER', 'presentation_approve')).toBe(false);
    expect(hasPresentationCapability('TEAM_MEMBER', 'brand_change')).toBe(false);
    expect(hasPresentationCapability('TEAM_MEMBER', 'presentation_edit')).toBe(true);
  });

  it('keeps viewer export-only access', () => {
    expect(hasPresentationCapability('viewer', 'presentation_export')).toBe(true);
    expect(hasPresentationCapability('viewer', 'presentation_create')).toBe(false);
    expect(hasPresentationCapability('viewer', 'presentation_share')).toBe(false);
  });
});
