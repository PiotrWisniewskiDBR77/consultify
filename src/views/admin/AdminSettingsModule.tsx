import { Menu, MoveRight, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { AdminAuditLogPanel } from '../../components/Admin/AdminAuditLogPanel';
import { AdminCollaborationControlsPanel } from '../../components/Admin/AdminCollaborationControlsPanel';
import { AdminMembersRolesPanel } from '../../components/Admin/AdminMembersRolesPanel';
import { AdminSecurityPolicyPanel } from '../../components/Admin/AdminSecurityPolicyPanel';
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
  'members',
  'security',
  'collaboration',
  'integrations',
  'audit',
];

const LEGACY_HANDOFFS: Record<
  string,
  { title: string; description: string; targetPath: string; targetLabel: string }
> = {
  organization: {
    title: 'Organization identity moved out of Admin',
    description:
      'Company profile, branding, and strategic identity belong to Organization, not the primary P32 cockpit.',
    targetPath: ROUTES.ORGANIZATION.PROFILE,
    targetLabel: 'Open Organization profile',
  },
  branding: {
    title: 'Branding moved out of Admin',
    description: 'Branding and trust posture are owned by Organization.',
    targetPath: ROUTES.ORGANIZATION.BRANDING,
    targetLabel: 'Open Branding',
  },
  billing: {
    title: 'Billing moved out of primary Admin cockpit',
    description: 'Billing stays outside the canonical five-branch P32 cockpit.',
    targetPath: ROUTES.ORGANIZATION.BILLING,
    targetLabel: 'Open Billing',
  },
  payment: {
    title: 'Payment moved out of primary Admin cockpit',
    description: 'Billing and payment settings live outside the canonical P32 cockpit.',
    targetPath: ROUTES.ORGANIZATION.BILLING,
    targetLabel: 'Open Billing',
  },
  tax: {
    title: 'Tax moved out of primary Admin cockpit',
    description: 'Billing and tax configuration live outside the canonical P32 cockpit.',
    targetPath: ROUTES.ORGANIZATION.BILLING,
    targetLabel: 'Open Billing',
  },
  alerts: {
    title: 'Usage alerts moved out of primary Admin cockpit',
    description: 'Billing alerts are not part of the canonical five-branch Admin cockpit.',
    targetPath: ROUTES.ORGANIZATION.BILLING,
    targetLabel: 'Open Billing',
  },
  governance: {
    title: 'Governance was consolidated into Security Policy',
    description: 'Security policy is the canonical tenant policy surface for P32.',
    targetPath: ROUTES.ADMIN.SECURITY,
    targetLabel: 'Open Security Policy',
  },
  api: {
    title: 'API management moved out of primary Admin cockpit',
    description: 'The canonical P32 integrations leaf is Integrations & Sync.',
    targetPath: ROUTES.ADMIN.INTEGRATIONS,
    targetLabel: 'Open Integrations & Sync',
  },
  feedback: {
    title: 'Feedback is outside the primary P32 cockpit',
    description: 'The canonical admin cockpit is limited to five branches only.',
    targetPath: ROUTES.ADMIN.ROOT,
    targetLabel: 'Open Admin cockpit',
  },
  'sync-hub': {
    title: 'Sync Hub was merged into Integrations & Sync',
    description: 'Integrations health and remediation stay in one canonical leaf.',
    targetPath: ROUTES.ADMIN.INTEGRATIONS,
    targetLabel: 'Open Integrations & Sync',
  },
};

const SECTION_META: Record<AdminSettingsSection, { title: string; subtitle: string }> = {
  members: {
    title: 'Members & Roles',
    subtitle: 'Membership operations, role changes, ownership transfer, and explicit denial guidance.',
  },
  security: {
    title: 'Security Policy',
    subtitle: 'Tenant-level MFA, SSO, session timeout, and password policy.',
  },
  collaboration: {
    title: 'Collaboration Controls',
    subtitle: 'Guest access, external sharing, and tool approval policy.',
  },
  integrations: {
    title: 'Integrations & Sync',
    subtitle: 'Connector health, remediation, and ownership-aware sync operations.',
  },
  audit: {
    title: 'Audit Log',
    subtitle: 'Admin events emitted by P32 write surfaces.',
  },
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

  if (candidate && LEGACY_HANDOFFS[candidate]) {
    return { section: 'members', legacyKey: candidate };
  }

  return { section: initialTab && PRIMARY_SECTIONS.includes(initialTab) ? initialTab : 'members' };
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

export const AdminSettingsModule: React.FC<AdminSettingsModuleProps> = ({ initialTab, currentUser }) => {
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
      case 'members':
        return <AdminMembersRolesPanel />;
      case 'security':
        return <AdminSecurityPolicyPanel />;
      case 'collaboration':
        return <AdminCollaborationControlsPanel />;
      case 'integrations':
        return <UnifiedSyncHub />;
      case 'audit':
        return <AdminAuditLogPanel />;
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
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{meta.title}</h1>
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
