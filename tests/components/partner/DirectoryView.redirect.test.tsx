/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { ROUTES } from '../../../src/routes/routeConfig';
import { getLegacyPartnerSection } from '../../../src/views/partner/partnerLegacyRoutes';

// The standalone DirectoryView redirect shim was consolidated into
// PartnerPortalView during partner production-hardening (commit 8404b892f6).
// The deprecated /partner/directory surface no longer renders its own <Navigate>
// shim; PartnerPortalView now resolves the legacy path to its canonical
// `public-listing` section via getLegacyPartnerSection. This test pins that
// surviving deprecated-path -> tab contract.
describe('Partner directory redirect contract', () => {
  it('resolves the deprecated directory route to the canonical public-listing section', () => {
    expect(getLegacyPartnerSection(ROUTES.PARTNER.DIRECTORY)).toBe('public-listing');
  });

  it('tolerates a trailing slash on the deprecated directory route', () => {
    expect(getLegacyPartnerSection(`${ROUTES.PARTNER.DIRECTORY}/`)).toBe('public-listing');
  });
});
