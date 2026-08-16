import { Menu, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { AdminAIControlCenterPanel } from '../../components/Admin/AdminAIControlCenterPanel';
import { AdminAuditLogPanel } from '../../components/Admin/AdminAuditLogPanel';
import { AdminBillingFinOpsPanel } from '../../components/Admin/AdminBillingFinOpsPanel';
import { AdminCommandCenterPanel } from '../../components/Admin/AdminCommandCenterPanel';
import { AdminHealthPanel } from '../../components/Admin/AdminHealthPanel';
import { AdminMembersRolesPanel } from '../../components/Admin/AdminMembersRolesPanel';
import { AdminSecurityIdentityPanel } from '../../components/Admin/AdminSecurityIdentityPanel';
import {
  AdminSettingsSection,
  AdminSettingsSidebar,
} from '../../components/Admin/AdminSettingsSidebar';
import { Button } from '../../components/ui/primitives/Button';
import { ScrollArea } from '../../components/ui/scroll-area';
import { cn } from '../../lib/utils';
import { ROUTES } from '../../routes/routeConfig';
import { useAppStore } from '../../store/useAppStore';
import { AppView, User } from '../../types';
import { isCommandCenterEnabled } from '../../utils/commandCenterFlag';

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

export const AdminSettingsModule: React.FC<AdminSettingsModuleProps> = ({
  initialTab,
  currentUser,
}) => {
  const { t } = useTranslation();
  const { setCurrentView } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const rawResolvedState = useMemo(
    () => resolveAdminState(location.pathname, location.search, initialTab),
    [initialTab, location.pathname, location.search]
  );

  // Flaga OFF → sekcja 'command' nie istnieje dla tego org-admina; bezpośrednie
  // wejście /admin/command przekierowuje na 'people' (plan §3, F-CC1 odbiór).
  const commandCenterEnabled = isCommandCenterEnabled();
  const resolvedState = useMemo(() => {
    if (rawResolvedState.section === 'command' && !commandCenterEnabled) {
      return { section: 'people' as AdminSettingsSection };
    }
    return rawResolvedState;
  }, [rawResolvedState, commandCenterEnabled]);

  useEffect(() => {
    if (rawResolvedState.section === 'command' && !commandCenterEnabled) {
      navigate('/admin/people', { replace: true });
    }
  }, [rawResolvedState.section, commandCenterEnabled, navigate]);

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

  const handleSectionChange = useCallback(
    (section: AdminSettingsSection) => {
      navigate(`/admin/${section}`);
      setSidebarOpen(false);
    },
    [navigate]
  );

  const handleBackToDashboard = useCallback(() => {
    setCurrentView(AppView.AI_CHAT);
    navigate(ROUTES.AI_CHAT);
  }, [navigate, setCurrentView]);

  const content = useMemo(() => {
    switch (resolvedState.section) {
      case 'people':
        return <AdminMembersRolesPanel />;
      case 'billing':
        return <AdminBillingFinOpsPanel />;
      case 'ai':
        return <AdminAIControlCenterPanel />;
      case 'security':
        return <AdminSecurityIdentityPanel />;
      case 'audit':
        return <AdminAuditLogPanel />;
      case 'command':
        return <AdminCommandCenterPanel onSectionChange={handleSectionChange} />;
      case 'health':
        return <AdminHealthPanel />;
      default:
        return <AdminMembersRolesPanel />;
    }
  }, [resolvedState, handleSectionChange]);

  const meta = SECTION_META[resolvedState.section];
  void currentUser;

  return (
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
          'fixed inset-y-0 left-0 z-40 w-[300px] transform transition-transform duration-300 ease-in-out lg:static lg:transform-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <AdminSettingsSidebar
          activeSection={resolvedState.section}
          onSectionChange={handleSectionChange}
          onBack={handleBackToDashboard}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-navy-900">
        <div className="flex items-center border-b border-slate-200 px-4 py-2 lg:hidden dark:border-white/10">
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={t('admin.shell.toggleNavigation', 'Toggle admin navigation')}
            aria-expanded={sidebarOpen}
            aria-controls="admin-settings-navigation"
            className="p-2 text-slate-600 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-3 lg:p-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                {t(meta.titleKey, { defaultValue: meta.titleDefault })}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t(meta.subtitleKey, { defaultValue: meta.subtitleDefault })}
              </p>
            </div>
            {content}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default AdminSettingsModule;
