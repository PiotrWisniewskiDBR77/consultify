/**
 * T063 — OrganizationView — Unified Organization workspace
 * Context (business): Profile / Goals / Challenges / Strategy
 * Administration (operational): Members / Billing / Limits / Domains / Branding
 * T064: Megatrends redirected to canonical Tools → Strategy route.
 */

import { Menu, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import OrganizationDirectionConstraintsScreen from '../components/Organization/redesign/OrganizationDirectionConstraintsScreen';
import OrganizationGoalsMetricsScreen from '../components/Organization/redesign/OrganizationGoalsMetricsScreen';
import OrganizationIdentityOperatingScreen from '../components/Organization/redesign/OrganizationIdentityOperatingScreen';
import OrganizationScopeCollaborationScreen from '../components/Organization/redesign/OrganizationScopeCollaborationScreen';
import {
  getOrganizationRedesignModules,
  ORGANIZATION_REDESIGN_MODULES,
  resolveRedesignScreen,
} from '../components/Organization/redesign/organizationRedesignNav';
import OrganizationScreenShell from '../components/Organization/redesign/OrganizationScreenShell';
import { SettingsHeaderActionsProvider } from '../components/settings/SettingsHeaderActions';
import DomainScreenHeader from '../components/settings/shared/DomainScreenHeader';
import { useOrgContextSync } from '../hooks/useOrgContextSync';
import { ROUTES } from '../routes/routeConfig';
import { trackFunnelEvent } from '../services/funnelAnalytics';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';
import { isOrgRedesignV1Enabled } from '../utils/orgRedesignFlag';
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

function resolveOrganizationLocation(
  pathname: string,
  redesign = false
): OrganizationLocation {
  const modules = redesign ? ORGANIZATION_REDESIGN_MODULES : ORGANIZATION_MODULES;
  const segments = pathname
    .replace(/^\/organization\/?/, '')
    .split('/')
    .filter(Boolean);
  if (!segments.length) return LEGACY_LOCATIONS.profile;
  if (segments.length === 1 && LEGACY_LOCATIONS[segments[0]]) {
    const legacy = LEGACY_LOCATIONS[segments[0]];
    return redesign ? { ...legacy, screen: resolveRedesignScreen(legacy.screen) } : legacy;
  }
  if (segments[0] === 'readiness') return { module: 'readiness', screen: 'summary' };
  const [module, rawScreen] = segments as [OrganizationModule, OrganizationScreen];
  // Pod flagą ON ekran wchłonięty (np. `operating-model`) prowadzi do ekranu,
  // który przejął jego treść — stare linki zostają żywe, bez migracji.
  const screen = redesign ? resolveRedesignScreen(rawScreen) : rawScreen;
  const match = modules.find((item) => item.id === module);
  if (match?.children.some((child) => child.id === screen)) return { module, screen };
  return redesign
    ? { module: 'profile', screen: resolveRedesignScreen(LEGACY_LOCATIONS.profile.screen) }
    : LEGACY_LOCATIONS.profile;
}

export const OrganizationView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [headerActionsTarget, setHeaderActionsTarget] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { setCurrentView, currentOrganization, currentUser } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const contextSync = useOrgContextSync(!!currentUser?.isAuthenticated);
  // Flaga czytana RAZ na mount — przełączenie IA w trakcie sesji nawigacyjnej
  // dałoby niespójny stan trasy. OFF ⇒ ta ścieżka jest bajt w bajt jak dotąd.
  const [redesignEnabled] = useState(() => isOrgRedesignV1Enabled());

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
    () => resolveOrganizationLocation(location.pathname, redesignEnabled),
    [location.pathname, redesignEnabled]
  );

  useEffect(() => {
    const section = location.pathname.replace(`${ROUTES.ORGANIZATION.ROOT}/`, '').split('/')[0];
    if (section === 'megatrends' || ADMIN_REDIRECTS[section]) return;
    const canonical = `${ROUTES.ORGANIZATION.ROOT}/${activeLocation.module}/${activeLocation.screen}`;
    const currentPath = location.pathname.replace(/\/+$/, '') || ROUTES.ORGANIZATION.ROOT;
    if (currentPath !== canonical) navigate(canonical, { replace: true });
  }, [activeLocation.module, activeLocation.screen, location.pathname, navigate]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSidebarOpen(false);
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

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
    const localized = redesignEnabled
      ? getOrganizationRedesignModules(language)
      : getOrganizationModules(language);
    const module = localized.find((item) => item.id === activeLocation.module);
    const screen = module?.children.find((item) => item.id === activeLocation.screen);
    const isPolish = language.toLowerCase().startsWith('pl');
    return {
      title: screen?.label || SCREEN_META[activeLocation.screen].title,
      moduleLabel: module?.label || activeLocation.module,
      subtitle: `${module?.label || ''} · ${
        isPolish
          ? 'Fakty, decyzje i stan tego obszaru'
          : 'Facts, decisions, and status for this area'
      }`,
    };
  }, [activeLocation, i18n?.language, i18n?.resolvedLanguage, redesignEnabled]);

  // Pod flagą OFF przekazujemy `undefined` — sidebar zachowuje kanoniczne 21 ekranów.
  const redesignModules = useMemo(
    () =>
      redesignEnabled
        ? getOrganizationRedesignModules(i18n?.resolvedLanguage || i18n?.language || 'pl')
        : undefined,
    [i18n?.language, i18n?.resolvedLanguage, redesignEnabled]
  );

  const isOrgAdmin = ['admin', 'owner', 'superadmin'].includes(
    (currentUser?.role || '').toLowerCase()
  );

  const renderLegacyContent = useCallback(() => {
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
          <OrganizationDecisionQualityPanel
            screen={activeLocation.screen}
            title={currentMeta.title}
          />
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

  /**
   * Redesign v1 (flaga OFF domyślnie):
   *  - „Tożsamość i model działania" = nowy, skonsolidowany ekran na szkielecie,
   *  - pozostałych 10 ekranów = DOTYCHCZASOWE komponenty w nowym szkielecie
   *    (bez scalania treści — to etap B).
   */
  const renderContent = useCallback(() => {
    if (!redesignEnabled) return renderLegacyContent();

    if (activeLocation.module === 'profile' && activeLocation.screen === 'identity-scale') {
      return (
        <OrganizationIdentityOperatingScreen>
          {(args) => (
            <OrganizationScreenShell
              sections={args.sections}
              activeSection={args.activeSection}
              onSectionChange={args.onSectionChange}
              chips={args.chips}
              activeChip={args.activeChip}
              onChipChange={args.onChipChange}
              searchValue={args.searchValue}
              onSearch={args.onSearch}
              primaryCta={args.primaryCta}
              statePanel={args.statePanel}
            >
              {args.content}
            </OrganizationScreenShell>
          )}
        </OrganizationIdentityOperatingScreen>
      );
    }

    if (activeLocation.module === 'profile' && activeLocation.screen === 'position-direction') {
      return (
        <OrganizationDirectionConstraintsScreen>
          {(args) => (
            <OrganizationScreenShell
              sections={args.sections}
              activeSection={args.activeSection}
              onSectionChange={args.onSectionChange}
              chips={args.chips}
              activeChip={args.activeChip}
              onChipChange={args.onChipChange}
              searchValue={args.searchValue}
              onSearch={args.onSearch}
              statePanel={args.statePanel}
            >
              {args.content}
            </OrganizationScreenShell>
          )}
        </OrganizationDirectionConstraintsScreen>
      );
    }

    if (activeLocation.module === 'goals' && activeLocation.screen === 'strategic-intent') {
      return (
        <OrganizationGoalsMetricsScreen>
          {(args) => (
            <OrganizationScreenShell
              sections={args.sections}
              activeSection={args.activeSection}
              onSectionChange={args.onSectionChange}
              chips={args.chips}
              activeChip={args.activeChip}
              onChipChange={args.onChipChange}
              statePanel={args.statePanel}
            >
              {args.content}
            </OrganizationScreenShell>
          )}
        </OrganizationGoalsMetricsScreen>
      );
    }

    if (activeLocation.module === 'goals' && activeLocation.screen === 'stakeholder-expectations') {
      return (
        <OrganizationScopeCollaborationScreen>
          {(args) => (
            <OrganizationScreenShell
              sections={args.sections}
              activeSection={args.activeSection}
              onSectionChange={args.onSectionChange}
              chips={args.chips}
              activeChip={args.activeChip}
              onChipChange={args.onChipChange}
              statePanel={args.statePanel}
            >
              {args.content}
            </OrganizationScreenShell>
          )}
        </OrganizationScopeCollaborationScreen>
      );
    }

    return <OrganizationScreenShell>{renderLegacyContent()}</OrganizationScreenShell>;
  }, [activeLocation.module, activeLocation.screen, redesignEnabled, renderLegacyContent]);

  return (
    <SettingsHeaderActionsProvider value={headerActionsTarget}>
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
            modules={redesignModules}
          />
        </div>
        <div
          id="organization-navigation"
          className={`fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <OrganizationSidebar
            activeLocation={activeLocation}
            onLocationChange={handleSectionChange}
            onBack={handleBackToDashboard}
            className="h-full bg-white dark:bg-navy-900"
            modules={redesignModules}
          />
        </div>
        <div className="flex-1 overflow-auto">
          <DomainScreenHeader
            breadcrumbs={[
              { label: t('organization.shell.breadcrumb'), onClick: handleBackToDashboard },
              { label: currentMeta.moduleLabel },
              { label: currentMeta.title },
            ]}
            title={currentMeta.title}
            subtitle={currentMeta.subtitle}
            // Pod flagą ON zostaje sam breadcrumb (prototyp) — H1 dublował
            // ostatni okruszek. OFF: nagłówek bez zmian.
            hideTitle={redesignEnabled}
            actionsRef={setHeaderActionsTarget}
            menuControl={
              <button
                ref={menuButtonRef}
                type="button"
                className="rounded-lg p-2 text-[var(--c-text-secondary)] hover:bg-[var(--c-surface-hover)] lg:hidden"
                aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
                aria-expanded={sidebarOpen}
                aria-controls="organization-navigation"
                onClick={() => setSidebarOpen((open) => !open)}
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            }
          />
          <div className="mx-auto w-full max-w-[1280px] px-4 pb-0 sm:px-5 lg:px-6">
            {contextSync.isUnsynced && (
              <div
                role="status"
                className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
              >
                {contextSync.isSyncing
                  ? t('organization.sync.saving', 'Saving organization context…')
                  : t(
                      'organization.sync.unsynced',
                      'Changes are stored locally but have not been confirmed by the server.'
                    )}
                {contextSync.error ? ` ${contextSync.error}` : ''}
              </div>
            )}
            {/* §5.2 konsolidacji: pod flagą ON baner Teresy znika z KAŻDEGO
                ekranu — jego treść (liczba twierdzeń, ostatnia aktualizacja)
                mieszka w prawym panelu stanu. */}
            {!redesignEnabled && (
              <OrgContextSummaryBanner
                organizationId={currentOrganization?.id}
                isAdmin={false}
                className="mb-4"
              />
            )}
          </div>
          <div className="organization-domain-content mx-auto w-full max-w-[1280px] px-4 pb-6 pt-0 sm:px-5 lg:px-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </SettingsHeaderActionsProvider>
  );
};

export default OrganizationView;
