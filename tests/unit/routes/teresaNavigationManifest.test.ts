import { describe, expect, it } from 'vitest';

import { TERESA_NAVIGATION_MANIFEST as frontendManifest } from '../../../src/routes/routeConfig';
import { TERESA_NAVIGATION_MANIFEST as serverManifest } from '../../../server/src/sharedRuntime/routes/teresaNavigationManifest';

describe('P-T13 Teresa navigation manifest mirror', () => {
  it('keeps the backend mirror identical to routeConfig source of truth', () => {
    expect(serverManifest).toEqual(frontendManifest);
  });
});

