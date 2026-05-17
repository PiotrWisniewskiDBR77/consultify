import { describe, expect, it } from 'vitest';

import {
  isPresentationActionAllowedByConfidentiality,
  normalizePresentationRole,
  resolvePresentationDeckConfidentiality,
} from '../presentationConfidentialityPolicyService.js';

describe('presentationConfidentialityPolicyService', () => {
  it('normalizes role aliases', () => {
    expect(normalizePresentationRole('team_member')).toBe('USER');
    expect(normalizePresentationRole('manager')).toBe('PROJECT_MANAGER');
    expect(normalizePresentationRole('super_admin')).toBe('SUPERADMIN');
  });

  it('resolves deck confidentiality from column and meta fallback', () => {
    expect(resolvePresentationDeckConfidentiality({ confidentiality: 'public' })).toBe('public');
    expect(
      resolvePresentationDeckConfidentiality({
        deck_json: '{"meta":{"confidentiality":"confidential"}}',
      })
    ).toBe('confidential');
    expect(resolvePresentationDeckConfidentiality({})).toBe('internal');
  });

  it('blocks confidential export for non-privileged roles', () => {
    expect(
      isPresentationActionAllowedByConfidentiality({
        action: 'export',
        role: 'viewer',
        confidentiality: 'confidential',
      })
    ).toBe(false);
    expect(
      isPresentationActionAllowedByConfidentiality({
        action: 'export',
        role: 'admin',
        confidentiality: 'confidential',
      })
    ).toBe(true);
  });

  it('blocks share of non-public decks for project manager', () => {
    expect(
      isPresentationActionAllowedByConfidentiality({
        action: 'share',
        role: 'project_manager',
        confidentiality: 'internal',
      })
    ).toBe(false);
    expect(
      isPresentationActionAllowedByConfidentiality({
        action: 'share',
        role: 'owner',
        confidentiality: 'internal',
      })
    ).toBe(true);
  });
});
