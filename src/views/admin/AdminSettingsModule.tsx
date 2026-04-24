import { Menu, MoveRight, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { AdminAIControlCenterPanel } from '../../components/Admin/AdminAIControlCenterPanel';
import { AdminAuditLogPanel } from '../../components/Admin/AdminAuditLogPanel';
import { AdminBillingFinOpsPanel } from '../../components/Admin/AdminBillingFinOpsPanel';
import { AdminEnterpriseOverviewPanel } from '../../components/Admin/AdminEnterpriseOverviewPanel';
import { AdminMembersRolesPanel } from '../../components/Admin/AdminMembersRolesPanel';
import { AdminOrganizationOperationsPanel } from '../../components/Admin/AdminOrganizationOperationsPanel';
import { AdminSecurityIdentityPanel } from '../../components/Admin/AdminSecurityIdentityPanel';
import {
  AdminSettingsSection,
  AdminSettingsSidebar,
} from '../../components/Admin/AdminSettingsSidebar';
import { UnifiedSyncHub } from '../../components/Admin/UnifiedSyncHub';
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
  'overview',
  'people',
  'security',
  'billing',
  'ai',
  'integrations',
  'audit',
  'operations',
];

const LEGACY_HANDOFFS: Record<
  string,
  { title: string; description: string; targetPath: string; targetLabel: string }
> = {
  organization: {
    title: 'Deep organization profile stays available outside Admin',
    description:
      'P32 now owns tenant operations, but the business profile workspace remains available for deeper organizational context editing.',
    targetPath: ROUTES.ORGANIZATION.PROFILE,
    targetLabel: 'Open Organization profile',
  },
  feedback: {
    title: 'Feedback is outside the tenant admin command center',
    description:
      'Operational tenant administration is handled in P32, while feedback remains a separate product workflow.',
    targetPath: ROUTES.ADMIN.OVERVIEW,
    targetLabel: 'Open Admin overview',
  },
};

const SECTION_META: Record<AdminSettingsSection, { title: string; subtitle: string }> = {
  overview: {
    title: 'Overview',
    subtitle:
      'Enterprise command center for tenant posture across people, security, billing, AI, and risk.',
  },
  people: {
    title: 'People & Access',
    subtitle:
      'Membership operations, role changes, ownership transfer, and tenant access governance.',
  },
  security: {
    title: 'Security & Identity',
    subtitle:
      'Tenant-level MFA, SSO, collaboration controls, API access, and delegated IAM posture.',
  },
  billing: {
    title: 'Billing, Limits & FinOps',
    subtitle: 'Plans, commercial posture, quota usage, and spend controls for the tenant.',
  },
  ai: {
    title: 'AI Governance & Operations',
    subtitle: 'Model policy, AI settings, health posture, and token economy in one place.',
  },
  integrations: {
    title: 'Integrations & Sync',
    subtitle: 'Connector health, remediation, and ownership-aware sync operations.',
  },
  audit: {
    title: 'Audit, Compliance & Risk',
    subtitle: 'Admin events, risk visibility, and evidence posture for high-risk actions.',
  },
  operations: {
    title: 'Organization Operations',
    subtitle: 'Domains, branding, competencies, and tenant operational surfaces managed from P32.',
  },
};

const SECTION_ALIASES: Record<string, AdminSettingsSection> = {
  members: 'people',
  team: 'people',
  users: 'people',
  workspace: 'operations',
  organization: 'operations',
  branding: 'operations',
  domains: 'operations',
  competencies: 'operations',
  governance: 'security',
  collaboration: 'security',
  api: 'security',
  billing: 'billing',
  payment: 'billing',
  tax: 'billing',
  alerts: 'billing',
  ai: 'ai',
  llm: 'ai',
  'token-management': 'ai',
  'sync-hub': 'integrations',
  compliance: 'audit',
};

function resolveAdminState(
  pathname: string,
  search: string,
  initialTab?: AdminSettingsSection
): { section: AdminSettingsSection; legacyKey?: string } {
  const pathSegment = pathname.replace(/^\/admin\/?/, '').split('/')[0];
  const tabParam = new URLSearchParams(search).get('tab') || '';
  const candidate = pathSegment || tabParam || initialTab || 'members';

  if (PRIMARY_SECTIONS.includes(candidate as AdminSettingsSection)) {
    return { section: candidate as AdminSettingsSection };
  }

  if (candidate && SECTION_ALIASES[candidate]) {
    return { section: SECTION_ALIASES[candidate] };
  }

  if (candidate && LEGACY_HANDOFFS[candidate]) {
    return { section: 'overview', legacyKey: candidate };
  }

  return { section: initialTab && PRIMARY_SECTIONS.includes(initialTab) ? initialTab : 'overview' };
}

const LegacyAdminHandoffPanel: React.FC<{
  title: string;
  description: string;
  targetPath: string;
  targetLabel: string;
}> = ({ title, description, targetPath, targetLabel }) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{description}</p>
      <button
        onClick={() => navigate(targetPath)}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
      >
        {targetLabel}
        <MoveRight className="h-4 w-4" />
      </button>
    </div>
  );
};

export const AdminSettingsModule: React.FC<AdminSettingsModuleProps> = ({
  initialTab,
  currentUser,
}) => {
  const { setCurrentView } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const resolvedState = useMemo(
    () => resolveAdminState(location.pathname, location.search, initialTab),
    [initialTab, location.pathname, location.search]
  );

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
    if (resolvedState.legacyKey) {
      return <LegacyAdminHandoffPanel {...LEGACY_HANDOFFS[resolvedState.legacyKey]} />;
    }

    switch (resolvedState.section) {
      case 'overview':
        return <AdminEnterpriseOverviewPanel />;
      case 'people':
        return <AdminMembersRolesPanel />;
      case 'security':
        return <AdminSecurityIdentityPanel />;
      case 'billing':
        return <AdminBillingFinOpsPanel />;
      case 'ai':
        return <AdminAIControlCenterPanel />;
      case 'integrations':
        return <UnifiedSyncHub />;
      case 'audit':
        return <AdminAuditLogPanel />;
      case 'operations':
        return <AdminOrganizationOperationsPanel />;
      default:
        return null;
    }
  }, [resolvedState]);

  const meta = SECTION_META[resolvedState.section];
  void currentUser;

  return (
    <div className="relative flex h-full bg-slate-50 dark:bg-navy-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
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
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-2 text-slate-600 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-3 lg:p-4">
            {!resolvedState.legacyKey && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {meta.title}
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{meta.subtitle}</p>
              </div>
            )}
            {content}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default AdminSettingsModule;
