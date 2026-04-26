import { Menu, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { AdminMembersRolesPanel } from '../../components/Admin/AdminMembersRolesPanel';
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

interface AdminSettingsModuleProps {
  initialTab?: AdminSettingsSection;
  currentUser: User;
}

const PRIMARY_SECTIONS: AdminSettingsSection[] = ['people'];

const SECTION_META: Record<AdminSettingsSection, { title: string; subtitle: string }> = {
  people: {
    title: 'Team & Access',
    subtitle: 'Membership operations, role changes, ownership transfer, and team invite codes.',
  },
};

const SECTION_ALIASES: Record<string, AdminSettingsSection> = {
  overview: 'people',
  members: 'people',
  team: 'people',
  users: 'people',
  people: 'people',
  access: 'people',
  security: 'people',
  billing: 'people',
  ai: 'people',
  integrations: 'people',
  audit: 'people',
  operations: 'people',
  workspace: 'people',
  organization: 'people',
  feedback: 'people',
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
    switch (resolvedState.section) {
      case 'people':
        return <AdminMembersRolesPanel />;
      default:
        return <AdminMembersRolesPanel />;
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
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{meta.title}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{meta.subtitle}</p>
            </div>
            {content}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default AdminSettingsModule;
