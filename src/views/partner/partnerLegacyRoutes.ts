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

/**
 * D8 retirement ledger for the seven former marketing tabs under `/partner`.
 * `null` is intentional and fail-closed: no public equivalent exists, so the
 * content stays in source but is not mounted in the operational dashboard.
 */
export const PARTNER_MARKETING_RETIREMENT_TARGETS: Readonly<
  Partial<Record<PartnerSection, string | null>>
> = Object.freeze({
  dashboard: ROUTES.BECOME_PARTNER,
  metrics: null,
  earnings: ROUTES.PARTNER.PRICING,
  'company-info': ROUTES.PARTNER.PUBLIC_APPLY,
  'learning-path': null,
  documentation: ROUTES.BECOME_PARTNER,
  templates: ROUTES.BECOME_PARTNER,
});

export function getLegacyPartnerSection(pathname: string): PartnerSection | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const match = LEGACY_PARTNER_PATH_TO_SECTION.find(({ path }) => normalized === path);
  return match?.section ?? null;
}
