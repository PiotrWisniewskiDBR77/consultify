/**
 * T063 — OrganizationView — Unified Organization workspace
 * Context (business): Profile / Goals / Challenges / Strategy
 * Administration (operational): Members / Billing / Limits / Domains / Branding
 * T064: Megatrends redirected to canonical Tools → Strategy route.
 */

import { ChevronRight, Menu, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { GovernedContextWorkspace } from '../components/Organization/GovernedContextWorkspace';
import { KnowledgeGraphExplorer } from '../components/Organization/KnowledgeGraphExplorer';
import {
  OrganizationDecisionQualityPanel,
  OrganizationFilesBoundary,
} from '../components/Organization/OrganizationDecisionQualityPanel';
import OrganizationSidebar, {
  getOrganizationModules,
  ORGANIZATION_MODULES,
  type OrganizationLocation,
  type OrganizationModule,
  type OrganizationScreen,
} from '../components/Organization/OrganizationSidebar';
import { OrgContextSummaryBanner } from '../components/Organization/OrgContextSummaryBanner';
import { useOrgContextSync } from '../hooks/useOrgContextSync';
import { ROUTES } from '../routes/routeConfig';
import { trackFunnelEvent } from '../services/funnelAnalytics';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';
import { ChallengeMapModule, type ChallengeTab } from './ContextBuilder/modules/ChallengeMapModule';
import {
  GoalsExpectationsModule,
  type GoalsTab,
} from './ContextBuilder/modules/GoalsExpectationsModule';
import { OrganizationProfileModule } from './ContextBuilder/modules/OrganizationProfileModule';
import {
  StrategicSynthesisModule,
  type SynthesisTab,
} from './ContextBuilder/modules/StrategicSynthesisModule';

const ADMIN_REDIRECTS: Record<string, string> = {
  members: ROUTES.ADMIN.PEOPLE,
  competencies: ROUTES.ADMIN.OPERATIONS,
  billing: ROUTES.ADMIN.BILLING,
  limits: ROUTES.ADMIN.BILLING,
  domains: ROUTES.ADMIN.OPERATIONS,
  branding: ROUTES.ADMIN.OPERATIONS,
};

const LEGACY_LOCATIONS: Record<string, OrganizationLocation> = {
  profile: { module: 'profile', screen: 'identity-scale' },
  goals: { module: 'goals', screen: 'strategic-intent' },
  challenges: { module: 'challenges', screen: 'declared-challenges' },
  strategy: { module: 'strategy', screen: 'risks-opportunities' },
  'knowledge-graph': { module: 'sources', screen: 'knowledge-graph' },
  'context-governance': { module: 'readiness', screen: 'versions-publication' },
};

const SCREEN_META: Record<OrganizationScreen, { title: string; subtitle: string }> =
  Object.fromEntries(
    ORGANIZATION_MODULES.flatMap((module) =>
      module.children.map((child) => [
        child.id,
        {
          title: child.label,
          subtitle: `Ekran modułu ${module.label}`,
        },
      ])
    )
  ) as Record<OrganizationScreen, { title: string; subtitle: string }>;

function resolveOrganizationLocation(pathname: string): OrganizationLocation {
  const segments = pathname
    .replace(/^\/organization\/?/, '')
    .split('/')
    .filter(Boolean);
  if (!segments.length) return LEGACY_LOCATIONS.profile;
  if (segments.length === 1 && LEGACY_LOCATIONS[segments[0]]) return LEGACY_LOCATIONS[segments[0]];
  const [module, screen] = segments as [OrganizationModule, OrganizationScreen];
  const match = ORGANIZATION_MODULES.find((item) => item.id === module);
  if (match?.children.some((child) => child.id === screen)) return { module, screen };
  return LEGACY_LOCATIONS.profile;
}

export const OrganizationView: React.FC = () => {
  const { t, i18n } = useTranslation();
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
    const section = path.replace(`${ROUTES.ORGANIZATION.ROOT}/`, '').split('/')[0] || 'profile';
    const adminRedirect = ADMIN_REDIRECTS[section];
    if (adminRedirect) {
      trackFunnelEvent('org_workspace_admin_handoff', {
        section,
        target: adminRedirect,
        via: 'url',
      });
      navigate(adminRedirect, { replace: true });
    }
  }, [location.pathname, navigate]);

  const activeLocation = useMemo(
    () => resolveOrganizationLocation(location.pathname),
    [location.pathname]
  );

  const handleSectionChange = useCallback(
    (next: OrganizationLocation) => {
      navigate(`${ROUTES.ORGANIZATION.ROOT}/${next.module}/${next.screen}`);
      setSidebarOpen(false);
      trackFunnelEvent('org_workspace_opened', { ...next });
    },
    [navigate]
  );

  const handleBackToDashboard = useCallback(() => {
    setCurrentView(AppView.AI_CHAT);
    navigate(ROUTES.AI_CHAT);
  }, [navigate, setCurrentView]);

  const currentMeta = useMemo(() => {
    const language = i18n?.resolvedLanguage || i18n?.language || 'pl';
    const localized = getOrganizationModules(language);
    const module = localized.find((item) => item.id === activeLocation.module);
    const screen = module?.children.find((item) => item.id === activeLocation.screen);
    const isPolish = language.toLowerCase().startsWith('pl');
    return {
      title: screen?.label || SCREEN_META[activeLocation.screen].title,
      subtitle: `${module?.label || ''} · ${
        isPolish
          ? 'Fakty, decyzje i stan tego obszaru'
          : 'Facts, decisions, and status for this area'
      }`,
    };
  }, [activeLocation, i18n?.language, i18n?.resolvedLanguage]);

  const isOrgAdmin = ['admin', 'owner', 'superadmin'].includes(
    (currentUser?.role || '').toLowerCase()
  );

  const renderContent = useCallback(() => {
    switch (activeLocation.module) {
      case 'goals':
        return (
          <GoalsExpectationsModule
            screen={
              (
                {
                  'strategic-intent': 'intent',
                  'success-metrics': 'metrics',
                  'scope-boundaries': 'scope',
                  'stakeholder-expectations': 'expectations',
                } as Record<string, GoalsTab>
              )[
                activeLocation.screen as
                  | 'strategic-intent'
                  | 'success-metrics'
                  | 'scope-boundaries'
                  | 'stakeholder-expectations'
              ]
            }
          />
        );
      case 'challenges':
        return (
          <ChallengeMapModule
            screen={
              (
                {
                  'declared-challenges': 'challenges',
                  'root-causes': 'rootcause',
                  'goal-blockers': 'blockers',
                  evidence: 'evidence',
                } as Record<string, ChallengeTab>
              )[
                activeLocation.screen as
                  | 'declared-challenges'
                  | 'root-causes'
                  | 'goal-blockers'
                  | 'evidence'
              ]
            }
          />
        );
      case 'strategy':
        return (
          <StrategicSynthesisModule
            screen={
              (
                {
                  'risks-opportunities': 'risks',
                  scenarios: 'scenarios',
                  recommendation: 'strengths',
                  'executive-brief': 'summary',
                } as Record<string, SynthesisTab>
              )[
                activeLocation.screen as
                  | 'risks-opportunities'
                  | 'scenarios'
                  | 'recommendation'
                  | 'executive-brief'
              ]
            }
          />
        );
      case 'sources':
        if (activeLocation.screen === 'knowledge-graph') return <KnowledgeGraphExplorer />;
        if (activeLocation.screen === 'files') return <OrganizationFilesBoundary />;
        return <GovernedContextWorkspace isAdmin={isOrgAdmin} />;
      case 'readiness':
        return activeLocation.screen === 'versions-publication' ? (
          <GovernedContextWorkspace isAdmin={isOrgAdmin} />
        ) : (
          <OrganizationDecisionQualityPanel screen={currentMeta.title} />
        );
      default:
        return (
          <OrganizationProfileModule
            screen={
              activeLocation.screen as
                | 'identity-scale'
                | 'operating-model'
                | 'position-direction'
                | 'technology-culture-constraints'
            }
          />
        );
    }
  }, [activeLocation, currentMeta.title, isOrgAdmin]);

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
          activeLocation={activeLocation}
          onLocationChange={handleSectionChange}
          onBack={handleBackToDashboard}
        />
      </div>
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <OrganizationSidebar
          activeLocation={activeLocation}
          onLocationChange={handleSectionChange}
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
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span>{t('organization.shell.breadcrumb')}</span>
                <ChevronRight size={12} />
                <span className="text-slate-700 dark:text-slate-200">{currentMeta.title}</span>
              </div>
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
            isAdmin={false}
            className="mb-4"
          />
        </div>
        <div className="px-4 lg:px-6 pb-6 pt-0">{renderContent()}</div>
      </div>
    </div>
  );
};

export default OrganizationView;
