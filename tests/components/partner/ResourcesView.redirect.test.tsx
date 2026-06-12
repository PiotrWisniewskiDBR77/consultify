/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { ROUTES } from '../../../src/routes/routeConfig';
import { getLegacyPartnerSection } from '../../../src/views/partner/partnerLegacyRoutes';

// The standalone ResourcesView surface was consolidated into PartnerPortalView
// during partner production-hardening (commit 8404b892f6). The deprecated
// /partner/resources route no longer renders its own view; PartnerPortalView now
// resolves the legacy path to its canonical `documentation` section via
// getLegacyPartnerSection. This test pins that surviving
// deprecated-path -> tab contract.
describe('Partner resources redirect contract', () => {
  it('resolves the deprecated resources route to the canonical documentation section', () => {
    expect(getLegacyPartnerSection(ROUTES.PARTNER.RESOURCES)).toBe('documentation');
  });

  it('tolerates a trailing slash on the deprecated resources route', () => {
    expect(getLegacyPartnerSection(`${ROUTES.PARTNER.RESOURCES}/`)).toBe('documentation');
  });
});
