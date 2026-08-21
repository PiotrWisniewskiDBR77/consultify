import { Menu, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { AdminAIControlCenterPanel } from '../../components/Admin/AdminAIControlCenterPanel';
import { AdminAuditLogPanel } from '../../components/Admin/AdminAuditLogPanel';
import { AdminBillingFinOpsPanel } from '../../components/Admin/AdminBillingFinOpsPanel';
import { AdminCapabilityState } from '../../components/Admin/AdminCapabilityState';
import { AdminCommandCenterPanel } from '../../components/Admin/AdminCommandCenterPanel';
import { AdminHealthPanel } from '../../components/Admin/AdminHealthPanel';
import { AdminMembersRolesPanel } from '../../components/Admin/AdminMembersRolesPanel';
import {
  ADMIN_DEFAULTS,
  ADMIN_DOMAINS,
  type AdminDomain,
  type AdminScreen,
  getAdminDomains,
} from '../../components/Admin/adminNavigation';
import { AdminSecurityIdentityPanel } from '../../components/Admin/AdminSecurityIdentityPanel';
import {
  type AdminLocation,
  AdminSettingsSection,
  AdminSettingsSidebar,
} from '../../components/Admin/AdminSettingsSidebar';
import { SettingsHeaderActionsProvider } from '../../components/settings/SettingsHeaderActions';
import DomainScreenHeader from '../../components/settings/shared/DomainScreenHeader';
import { Button } from '../../components/ui/primitives/Button';
import { ScrollArea } from '../../components/ui/scroll-area';
import { cn } from '../../lib/utils';
import { ROUTES } from '../../routes/routeConfig';
import { useAppStore } from '../../store/useAppStore';
import { AppView, User } from '../../types';

interface AdminSettingsModuleProps {
  initialTab?: AdminSettingsSection;
  currentUser: User;
}

const PRIMARY_SECTIONS: AdminSettingsSection[] = [
  'people',
  'billing',
  'ai',
  'security',
  'audit',
  'command',
  'health',
];

// Fail closed until the backend exposes a verified Platform Operator capability.
const CAN_ACCESS_PLATFORM_OPERATIONS = false;

const SECTION_META: Record<
  AdminSettingsSection,
  { titleKey: string; titleDefault: string; subtitleKey: string; subtitleDefault: string }
> = {
  people: {
    titleKey: 'admin.section.people.title',
    titleDefault: 'Team & Access',
    subtitleKey: 'admin.section.people.subtitle',
    subtitleDefault:
      'Membership operations, role changes, ownership transfer, and team invite codes.',
  },
  billing: {
    titleKey: 'admin.section.billing.title',
    titleDefault: 'Billing & Plans',
    subtitleKey: 'admin.section.billing.subtitle',
    subtitleDefault:
      'Assign plans, credit and storage limits, seats, and expiry; manage invoices and budgets.',
  },
  ai: {
    titleKey: 'admin.section.ai.title',
    titleDefault: 'AI Controls',
    subtitleKey: 'admin.section.ai.subtitle',
    subtitleDefault: 'AI governance policy, model posture, context controls, and AI operations.',
  },
  security: {
    titleKey: 'admin.section.security.title',
    titleDefault: 'Security & Identity',
    subtitleKey: 'admin.section.security.subtitle',
    subtitleDefault:
      'Authentication policy, collaboration controls, API access, delegated IAM, and SCIM lifecycle.',
  },
  audit: {
    titleKey: 'admin.section.audit.title',
    titleDefault: 'Audit Log',
    subtitleKey: 'admin.section.audit.subtitle',
    subtitleDefault: 'High-risk admin events, risk posture, and compliance evidence.',
  },
  command: {
    titleKey: 'admin.section.command.title',
    titleDefault: 'Command Center',
    subtitleKey: 'admin.section.command.subtitle',
    subtitleDefault:
      'Trust & control posture — SOC2 audit export, DLP, data residency, retention, and org AI policy.',
  },
  health: {
    titleKey: 'admin.section.health.title',
    titleDefault: 'Health',
    subtitleKey: 'admin.section.health.subtitle',
    subtitleDefault:
      'Proof-of-life probes — round-trips against our own API and DB across critical flows.',
  },
};

const SECTION_ALIASES: Record<string, AdminSettingsSection> = {
  overview: 'people',
  members: 'people',
  team: 'people',
  users: 'people',
  people: 'people',
  access: 'people',
  workspace: 'people',
  organization: 'people',
  feedback: 'people',
  billing: 'billing',
  plans: 'billing',
  finops: 'billing',
  ai: 'ai',
  'ai-controls': 'ai',
  governance: 'ai',
  security: 'security',
  identity: 'security',
  scim: 'security',
  iam: 'security',
  integrations: 'security',
  audit: 'audit',
  'audit-log': 'audit',
  compliance: 'audit',
  command: 'command',
  'command-center': 'command',
  'trust-control': 'command',
  posture: 'command',
  health: 'health',
  probes: 'health',
  diagnostics: 'health',
};

function resolveAdminState(
  pathname: string,
  search: string,
  initialTab?: AdminSettingsSection
): { section: AdminSettingsSection } {
  const pathSegment = pathname.replace(/^\/admin\/?/, '').split('/')[0];
  const tabParam = new URLSearchParams(search).get('tab') || '';
  const candidate = pathSegment || tabParam || initialTab || 'people';

  if (PRIMARY_SECTIONS.includes(candidate as AdminSettingsSection)) {
    return { section: candidate as AdminSettingsSection };
  }

  if (candidate && SECTION_ALIASES[candidate]) {
    return { section: SECTION_ALIASES[candidate] };
  }

  return { section: initialTab && PRIMARY_SECTIONS.includes(initialTab) ? initialTab : 'people' };
}

const LEGACY_DOMAIN: Record<AdminSettingsSection, AdminDomain> = {
  people: 'team',
  billing: 'billing',
  ai: 'ai',
  security: 'security',
  audit: 'audit',
  command: 'command',
  health: 'health',
};

const DOMAIN_LEGACY: Record<AdminDomain, AdminSettingsSection> = {
  team: 'people',
  billing: 'billing',
  ai: 'ai',
  security: 'security',
  audit: 'audit',
  command: 'command',
  health: 'health',
};

function resolveAdminLocation(
  pathname: string,
  search: string,
  initialTab?: AdminSettingsSection
): AdminLocation {
  const segments = pathname
    .replace(/^\/admin\/?/, '')
    .split('/')
    .filter(Boolean);
  if (segments.length >= 2) {
    const [domain, screen] = segments as [AdminDomain, AdminScreen];
    const match = ADMIN_DOMAINS.find((item) => item.id === domain);
    if (match?.children.some((child) => child.id === screen)) return { domain, screen };
  }
  const legacy = resolveAdminState(pathname, search, initialTab).section;
  const domain = LEGACY_DOMAIN[legacy];
  return { domain, screen: ADMIN_DEFAULTS[domain] };
}

export const AdminSettingsModule: React.FC<AdminSettingsModuleProps> = ({ initialTab }) => {
  const [headerActionsTarget, setHeaderActionsTarget] = useState<HTMLDivElement | null>(null);
  const { t, i18n } = useTranslation();
  const { setCurrentView } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const rawResolvedLocation = useMemo(
    () => resolveAdminLocation(location.pathname, location.search, initialTab),
    [initialTab, location.pathname, location.search]
  );

  const resolvedLocation = rawResolvedLocation;
  // No backend capability contract currently proves Platform Operator access.
  // Fail closed for navigation, deep links, and data fetching.

  useEffect(() => {
    const canonical = `/admin/${resolvedLocation.domain}/${resolvedLocation.screen}`;
    const currentPath = location.pathname.replace(/\/+$/, '') || '/admin';
    if (currentPath !== canonical) navigate(canonical, { replace: true });
  }, [location.pathname, navigate, resolvedLocation.domain, resolvedLocation.screen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSidebarOpen(false);
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [sidebarOpen]);

  const handleLocationChange = useCallback(
    (next: AdminLocation) => {
      navigate(`/admin/${next.domain}/${next.screen}`);
      setSidebarOpen(false);
    },
    [navigate]
  );

  const handleBackToDashboard = useCallback(() => {
    setCurrentView(AppView.AI_CHAT);
    navigate(ROUTES.AI_CHAT);
  }, [navigate, setCurrentView]);

  const content = useMemo(() => {
    const domainConfig = getAdminDomains(i18n?.resolvedLanguage || i18n?.language || 'pl').find(
      (domain) => domain.id === resolvedLocation.domain
    );
    const childConfig = domainConfig?.children.find(
      (screen) => screen.id === resolvedLocation.screen
    );
    if (resolvedLocation.screen === 'platform-operations' && !CAN_ACCESS_PLATFORM_OPERATIONS) {
      return (
        <section
          role="alert"
          className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6"
        >
          <h2 className="text-base font-semibold text-[var(--c-text)]">UNAUTHORIZED</h2>
          <p className="mt-2 text-sm text-[var(--c-text-secondary)]">
            {i18n.language?.toLowerCase().startsWith('pl')
              ? 'Operacje platformowe nie należą do administracji klienta i wymagają jawnej capability operatora platformy.'
              : 'Platform operations are outside customer administration and require an explicit Platform Operator capability.'}
          </p>
        </section>
      );
    }
    const connected =
      resolvedLocation.screen === ADMIN_DEFAULTS[resolvedLocation.domain] ||
      (resolvedLocation.domain === 'team' &&
        ['members', 'invitations', 'ownership'].includes(resolvedLocation.screen)) ||
      (resolvedLocation.domain === 'billing' &&
        ['plan-limits', 'usage-costs', 'payment-methods', 'invoices', 'budgets-alerts'].includes(
          resolvedLocation.screen
        ));
    if (!connected) {
      return (
        <AdminCapabilityState
          title={childConfig?.label || resolvedLocation.screen}
          domain={domainConfig?.label || resolvedLocation.domain}
        />
      );
    }
    switch (resolvedLocation.domain) {
      case 'team':
        return (
          <AdminMembersRolesPanel
            screen={resolvedLocation.screen as 'members' | 'invitations' | 'ownership'}
          />
        );
      case 'billing':
        return (
          <AdminBillingFinOpsPanel
            screen={
              (
                {
                  overview: 'summary',
                  'plan-limits': 'plan',
                  'usage-costs': 'summary',
                  'payment-methods': 'payments',
                  invoices: 'invoices',
                  'budgets-alerts': 'controls',
                } as const
              )[
                resolvedLocation.screen as
                  | 'overview'
                  | 'plan-limits'
                  | 'usage-costs'
                  | 'payment-methods'
                  | 'invoices'
                  | 'budgets-alerts'
              ]
            }
          />
        );
      case 'ai':
        return <AdminAIControlCenterPanel />;
      case 'security':
        return <AdminSecurityIdentityPanel />;
      case 'audit':
        return <AdminAuditLogPanel />;
      case 'command':
        return (
          <AdminCommandCenterPanel
            aggregationOnly
            onSectionChange={(section) =>
              handleLocationChange({
                domain: LEGACY_DOMAIN[section],
                screen: ADMIN_DEFAULTS[LEGACY_DOMAIN[section]],
              })
            }
          />
        );
      case 'health':
        return <AdminHealthPanel canRunDiagnostics={CAN_ACCESS_PLATFORM_OPERATIONS} />;
      default:
        return <AdminMembersRolesPanel />;
    }
  }, [
    resolvedLocation.domain,
    resolvedLocation.screen,
    handleLocationChange,
    i18n?.language,
    i18n?.resolvedLanguage,
  ]);

  const legacySection = DOMAIN_LEGACY[resolvedLocation.domain];
  const meta = SECTION_META[legacySection];
  const screenLabel = getAdminDomains(i18n?.resolvedLanguage || i18n?.language || 'pl')
    .find((domain) => domain.id === resolvedLocation.domain)
    ?.children.find((screen) => screen.id === resolvedLocation.screen)?.label;

  return (
    <SettingsHeaderActionsProvider value={headerActionsTarget}>
      <div className="relative flex h-full bg-slate-50 dark:bg-navy-950">
        {sidebarOpen && (
          <button
            type="button"
            aria-label={t('admin.shell.closeNavigation', 'Close admin navigation')}
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          id="admin-settings-navigation"
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-[280px] transform transition-transform duration-300 ease-in-out lg:static lg:transform-none',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          <AdminSettingsSidebar
            activeLocation={resolvedLocation}
            onLocationChange={handleLocationChange}
            onBack={handleBackToDashboard}
            canAccessPlatformOperations={CAN_ACCESS_PLATFORM_OPERATIONS}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-navy-900">
          <DomainScreenHeader
            breadcrumbs={[
              { label: t('admin.shell.breadcrumb'), onClick: handleBackToDashboard },
              { label: t(meta.titleKey, { defaultValue: meta.titleDefault }) },
              { label: screenLabel || resolvedLocation.screen },
            ]}
            title={screenLabel || resolvedLocation.screen}
            subtitle={t(meta.subtitleKey, { defaultValue: meta.subtitleDefault })}
            actionsRef={setHeaderActionsTarget}
            menuControl={
              <Button
                ref={menuButtonRef}
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen((prev) => !prev)}
                aria-label={t('admin.shell.toggleNavigation', 'Toggle admin navigation')}
                aria-expanded={sidebarOpen}
                aria-controls="admin-settings-navigation"
                className="p-2 text-[var(--c-text-secondary)] hover:text-[var(--c-text)] lg:hidden"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            }
          />

          <ScrollArea className="flex-1">
            <div className="admin-domain-content mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-5 lg:p-6">
              {content}
            </div>
          </ScrollArea>
        </div>
      </div>
    </SettingsHeaderActionsProvider>
  );
};

export default AdminSettingsModule;
