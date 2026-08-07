import { describe, expect, it } from 'vitest';

import { resolvePresentationTemplateArtifactPosture } from '../v8/artifactRegistryService.js';

describe('presentation template artifact posture', () => {
  it('keeps approved and deprecated templates organization-visible', () => {
    expect(
      resolvePresentationTemplateArtifactPosture({
        is_active: true,
        is_system: false,
        lifecycle_state: 'approved',
      })
    ).toEqual({ lifecycleState: 'approved', isDraft: false, visibilityScope: 'organization' });

    expect(
      resolvePresentationTemplateArtifactPosture({
        is_active: false,
        is_system: false,
        lifecycle_state: 'approved',
      })
    ).toEqual({ lifecycleState: 'deprecated', isDraft: false, visibilityScope: 'organization' });
  });

  it('keeps user drafts private but exposes system drafts only through draft filtering', () => {
    expect(
      resolvePresentationTemplateArtifactPosture({
        is_active: true,
        is_system: false,
        lifecycle_state: 'draft',
      })
    ).toEqual({ lifecycleState: 'draft', isDraft: true, visibilityScope: 'private' });

    expect(
      resolvePresentationTemplateArtifactPosture({
        is_active: true,
        is_system: true,
        lifecycle_state: 'draft',
      })
    ).toEqual({ lifecycleState: 'draft', isDraft: true, visibilityScope: 'organization' });
  });
});
