import { PartnerSection } from '../../components/Partner/PartnerSidebar';
import { ROUTES } from '../../routes/routeConfig';

/**
 * Canonical mapping from deprecated standalone partner routes to the
 * consolidated PartnerPortalView sections.
 *
 * Several partner surfaces (Dashboard, Clients, Commission, Directory,
 * Resources) used to be rendered by their own views — some of them thin
 * <Navigate> redirect shims. During partner production-hardening they were
 * consolidated into PartnerPortalView, which resolves the legacy paths to the
 * right in-portal tab. This module is the single source of truth for that
 * deprecated-path -> section contract.
 */
export const LEGACY_PARTNER_PATH_TO_SECTION: Array<{ path: string; section: PartnerSection }> = [
  { path: ROUTES.PARTNER.DASHBOARD, section: 'dashboard' },
  { path: ROUTES.PARTNER.CLIENTS, section: 'client-access' },
  { path: ROUTES.PARTNER.COMMISSION, section: 'earnings' },
  { path: ROUTES.PARTNER.DIRECTORY, section: 'public-listing' },
  { path: ROUTES.PARTNER.RESOURCES, section: 'documentation' },
];

export function getLegacyPartnerSection(pathname: string): PartnerSection | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const match = LEGACY_PARTNER_PATH_TO_SECTION.find(({ path }) => normalized === path);
  return match?.section ?? null;
}
