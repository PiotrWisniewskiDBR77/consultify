/**
 * T063 — OrganizationView — Unified Organization workspace
 * Context (business): Profile / Goals / Challenges / Strategy
 * Administration (operational): Members / Billing / Limits / Domains / Branding
 * T064: Megatrends redirected to canonical Tools → Strategy route.
 */

import { Menu, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { KnowledgeGraphExplorer } from '../components/Organization/KnowledgeGraphExplorer';
import OrganizationSidebar, {
  type OrganizationSection,
} from '../components/Organization/OrganizationSidebar';
import { OrgContextSummaryBanner } from '../components/Organization/OrgContextSummaryBanner';
import {
  ORGANIZATION_ADMIN_HANDOFFS,
  type OrganizationSurface,
  organizationSectionRoute,
} from '../domain/organization/organizationOwnerRegistry';
import { useOrgContextSync } from '../hooks/useOrgContextSync';
import { ROUTES } from '../routes/routeConfig';
import { trackFunnelEvent } from '../services/funnelAnalytics';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';
import { ChallengeMapModule } from './ContextBuilder/modules/ChallengeMapModule';
import { GoalsExpectationsModule } from './ContextBuilder/modules/GoalsExpectationsModule';
import { OrganizationProfileModule } from './ContextBuilder/modules/OrganizationProfileModule';
import { StrategicSynthesisModule } from './ContextBuilder/modules/StrategicSynthesisModule';

const ADMIN_SECTIONS: OrganizationSection[] = [
  'members',
  'competencies',
  'billing',
  'limits',
  'domains',
  'branding',
];

const ADMIN_REDIRECTS: Partial<Record<OrganizationSection, string>> =
  ORGANIZATION_ADMIN_HANDOFFS;

const sectionMeta: Record<
  OrganizationSection,
  { titleKey: string; title: string; subtitleKey: string; subtitle: string }
> = {
  profile: {
    titleKey: 'organization.sections.profile.title',
    title: 'Company Profile',
    subtitleKey: 'organization.sections.profile.subtitle',
    subtitle: 'Company snapshot, operating model, and key facts',
  },
  goals: {
    titleKey: 'organization.sections.goals.title',
    title: 'Goals & Expectations',
    subtitleKey: 'organization.sections.goals.subtitle',
    subtitle: 'Strategic intent, target metrics, scope and expectations',
  },
  challenges: {
    titleKey: 'organization.sections.challenges.title',
    title: 'Challenges',
    subtitleKey: 'organization.sections.challenges.subtitle',
    subtitle: 'Challenge map, evidence and root causes',
  },
  megatrends: {
    titleKey: 'organization.sections.megatrends.title',
    title: 'Megatrends',
    subtitleKey: 'organization.sections.megatrends.subtitle',
    subtitle: 'Redirected to Discovery Tools → Strategic Megatrends',
  },
  strategy: {
    titleKey: 'organization.sections.strategy.title',
    title: 'Strategic Synthesis',
    subtitleKey: 'organization.sections.strategy.subtitle',
    subtitle: 'Synthesis, scenarios and executive summary',
  },
  members: {
    titleKey: 'organization.sections.members.title',
    title: 'Members & Roles',
    subtitleKey: 'organization.sections.members.subtitle',
    subtitle: 'Manage team members, invitations and access roles',
  },
  competencies: {
    titleKey: 'competency.catalog.title',
    title: 'Competency Catalog',
    subtitleKey: 'competency.catalog.subtitle',
    subtitle: 'Define competency taxonomy, categories and skill levels',
  },
  billing: {
    titleKey: 'organization.sections.billing.title',
    title: 'Billing & Tokens',
    subtitleKey: 'organization.sections.billing.subtitle',
    subtitle: 'Subscription status, token balance and usage',
  },
  limits: {
    titleKey: 'organization.sections.limits.title',
    title: 'Limits & Usage',
    subtitleKey: 'organization.sections.limits.subtitle',
    subtitle: 'Plan limits, quotas and current usage',
  },
  domains: {
    titleKey: 'organization.sections.domains.title',
    title: 'Domains',
    subtitleKey: 'organization.sections.domains.subtitle',
    subtitle: 'Custom domain setup and verification',
  },
  branding: {
    titleKey: 'organization.sections.branding.title',
    title: 'Branding & Regional',
    subtitleKey: 'organization.sections.branding.subtitle',
    subtitle: 'Logo, colors, timezone, language and currency',
  },
  'knowledge-graph': {
    titleKey: 'organization.sections.knowledgeGraph.title',
    title: 'Knowledge Graph',
    subtitleKey: 'organization.sections.knowledgeGraph.subtitle',
    subtitle: 'Explore entities, relations, provenance and governance',
  },
};

export const OrganizationView: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { setCurrentView, currentOrganization, currentUser } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useOrgContextSync(!!currentUser?.isAuthenticated);

  useEffect(() => {
    const path = location.pathname.replace(/\/+$/, '');
    if (path === `${ROUTES.ORGANIZATION.ROOT}/megatrends`) {
      trackFunnelEvent('megatrends_redirect_used', { fromRoute: '/organization/megatrends' });
      navigate(ROUTES.DISCOVERY_TOOLS.STRATEGIC_MEGATRENDS, { replace: true });
      return;
    }
    const section =
      path.replace(`${ROUTES.ORGANIZATION.ROOT}/`, '').replace(/^\/+|\/+$/g, '') || 'profile';
    const adminRedirect = ADMIN_REDIRECTS[section as OrganizationSection];
    if (adminRedirect) {
      trackFunnelEvent('org_workspace_admin_handoff', {
        section,
        target: adminRedirect,
        via: 'url',
      });
      navigate(adminRedirect, { replace: true });
    }
  }, [location.pathname, navigate]);

  const activeSection = useMemo(() => {
    const pathSection =
      location.pathname.replace(`${ROUTES.ORGANIZATION.ROOT}/`, '').replace(/^\/+|\/+$/g, '') ||
      'profile';
    const allowed = Object.keys(sectionMeta) as OrganizationSection[];
    return (
      allowed.includes(pathSection as OrganizationSection) ? pathSection : 'profile'
    ) as OrganizationSection;
  }, [location.pathname]);

  const handleSectionChange = useCallback(
    (section: OrganizationSection) => {
      const adminRedirect = ADMIN_REDIRECTS[section];
      if (adminRedirect) {
        navigate(adminRedirect);
        setSidebarOpen(false);
        trackFunnelEvent('org_workspace_admin_handoff', { section, target: adminRedirect });
        return;
      }
      navigate(organizationSectionRoute(section as OrganizationSurface));
      setSidebarOpen(false);
      trackFunnelEvent('org_workspace_opened', { section });
    },
    [navigate]
  );

  const handleBackToDashboard = useCallback(() => {
    setCurrentView(AppView.AI_CHAT);
    navigate(ROUTES.AI_CHAT);
  }, [navigate, setCurrentView]);

  const currentMeta = useMemo(() => {
    const meta = sectionMeta[activeSection];
    return { title: t(meta.titleKey, meta.title), subtitle: t(meta.subtitleKey, meta.subtitle) };
  }, [activeSection, t]);

  const isOrgAdmin = ['admin', 'owner', 'superadmin'].includes(
    (currentUser?.role || '').toLowerCase()
  );

  const renderContent = useCallback(() => {
    if (ADMIN_SECTIONS.includes(activeSection)) {
      // M23 L-04 (P1 security): view-level role gate for admin sections.
      // Defense-in-depth layer 2 — even if the URL-redirect useEffect above has not
      // yet fired (first render) or is bypassed, a non-admin member must never see
      // admin data. Explicit <Navigate replace> instead of a bare `null` so the
      // protection is intentional, testable and never a silent blank screen.
      if (!isOrgAdmin) {
        return <Navigate to={ROUTES.AI_CHAT} replace />;
      }
      // Every administration section is a handoff to the canonical Admin module.
      // Redirect immediately so the legacy panel cannot briefly mount, fetch and
      // show a false load-error toast before the URL effect completes.
      return <Navigate to={ADMIN_REDIRECTS[activeSection] as string} replace />;
    }
    switch (activeSection) {
      case 'goals':
        return <GoalsExpectationsModule />;
      case 'challenges':
        return <ChallengeMapModule />;
      case 'strategy':
        return <StrategicSynthesisModule />;
      case 'knowledge-graph':
        return <KnowledgeGraphExplorer />;
      default:
        return <OrganizationProfileModule />;
    }
  }, [activeSection, isOrgAdmin]);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-50 dark:bg-navy-950">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close organization navigation"
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="hidden lg:block">
        <OrganizationSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          onBack={handleBackToDashboard}
        />
      </div>
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <OrganizationSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          onBack={handleBackToDashboard}
          className="h-full bg-white dark:bg-navy-900"
        />
      </div>
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 z-10 bg-slate-50/90 dark:bg-navy-950/90 backdrop-blur-sm border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-3 px-4 lg:px-6 py-4">
            <button
              type="button"
              className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {currentMeta.title}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {currentMeta.subtitle}
              </p>
            </div>
            {sidebarOpen && (
              <button
                type="button"
                className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500"
                aria-label="Close navigation"
                onClick={() => setSidebarOpen(false)}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        <div className="px-4 lg:px-6 pb-0">
          <OrgContextSummaryBanner
            organizationId={currentOrganization?.id}
            isAdmin={ADMIN_SECTIONS.includes(activeSection)}
            className="mb-4"
          />
        </div>
        <div className="px-4 lg:px-6 pb-6 pt-0">{renderContent()}</div>
      </div>
    </div>
  );
};

export default OrganizationView;
