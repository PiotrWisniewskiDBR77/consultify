import { describe, expect, it } from 'vitest';

import { deriveArtifactVisibilityScope } from '../v8/artifactRegistryService.js';

describe('artifactRegistryService.deriveArtifactVisibilityScope', () => {
  it('keeps private visibility for presentation with owner', () => {
    const scope = deriveArtifactVisibilityScope({
      outputType: 'presentation',
      ownerUserId: 'user_1',
    });
    expect(scope).toBe('private');
  });

  it('keeps private visibility for presentation without owner by default', () => {
    const scope = deriveArtifactVisibilityScope({
      outputType: 'presentation',
      ownerUserId: null,
    });
    expect(scope).toBe('private');
  });
});
