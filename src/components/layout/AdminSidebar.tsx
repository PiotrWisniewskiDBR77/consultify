/**
 * AdminSidebar Component
 *
 * 8-module navigation for Admin Panel following SuperAdmin pattern.
 * Modules: Overview | Organization | Team | Workspace | AI | Billing | Security | Feedback
 */

import {
  ArrowLeft,
  Brain,
  Building2,
  ChevronRight,
  CreditCard,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  Pin,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

// 8-module structure for Admin (matching AdminView)
// Main modules for sidebar navigation
export type AdminSection =
  // Main modules (for sidebar)
  | 'overview'
  | 'organization'
  | 'team'
  | 'workspace'
  | 'ai'
  | 'billing'
  | 'security'
  | 'feedback'
  // Detailed sections (for TabLayout within modules)
  | 'dashboard'
  | 'metrics'
  | 'analytics'
  | 'profile'
  | 'branding'
  | 'ownership'
  | 'regional'
  | 'fiscal-year'
  | 'data-hosting'
  | 'approved-domains'
  | 'users'
  | 'groups'
  | 'invitations'
  | 'roles'
  | 'consultants'
  | 'org-chart'
  | 'projects'
  | 'knowledge'
  | 'playbooks'
  | 'bulk-ops'
  | 'custom-statuses'
  | 'ai-models'
  | 'ai-health'
  | 'ai-policy'
  | 'ai-access'
  | 'ai-features'
  | 'ai-audit'
  | 'usage'
  | 'plan'
  | 'payment'
  | 'invoices'
  | 'alerts'
  | 'billing-settings'
  | 'cost-allocation'
  | 'seats'
  | 'security-settings'
  | 'authentication'
  | 'api-keys'
  | 'audit-log'
  | 'data-management'
  | 'gdpr'
  | 'cookie-settings'
  | 'data-requests'
  | 'compliance-overview';

// Mapping between sections and AppView (only main sections need AppView)
export const adminSectionToAppView: Partial<Record<AdminSection, AppView>> = {
  overview: AppView.ADMIN_OVERVIEW,
  organization: AppView.ADMIN_ORGANIZATION,
  team: AppView.ADMIN_TEAM,
  workspace: AppView.ADMIN_WORKSPACE,
  ai: AppView.ADMIN_AI,
  billing: AppView.ADMIN_BILLING,
  security: AppView.ADMIN_SECURITY,
  feedback: AppView.ADMIN_FEEDBACK,
};

export const appViewToAdminSection: Record<string, AdminSection> = {
  [AppView.ADMIN_OVERVIEW]: 'overview',
  [AppView.ADMIN_ORGANIZATION]: 'organization',
  [AppView.ADMIN_TEAM]: 'team',
  [AppView.ADMIN_WORKSPACE]: 'workspace',
  [AppView.ADMIN_AI]: 'ai',
  [AppView.ADMIN_BILLING]: 'billing',
  [AppView.ADMIN_SECURITY]: 'security',
  [AppView.ADMIN_FEEDBACK]: 'feedback',
  [AppView.ADMIN_SETTINGS]: 'security', // Legacy redirect
  // Legacy view mappings - redirect to new modules
  [AppView.ADMIN_DASHBOARD]: 'overview',
  [AppView.ADMIN_METRICS]: 'overview',
  [AppView.ADMIN_ANALYTICS]: 'overview',
  [AppView.ADMIN_ORGANIZATION_SETTINGS]: 'organization',
  [AppView.ADMIN_USERS]: 'team',
  [AppView.ADMIN_INVITATIONS]: 'team',
  [AppView.ADMIN_WORK_MODE]: 'team',
  [AppView.ADMIN_SETTINGS_CONSULTANTS]: 'team',
  [AppView.ADMIN_PROJECTS]: 'workspace',
  [AppView.ADMIN_KNOWLEDGE]: 'workspace',
  [AppView.ADMIN_PLAYBOOK_RUNS]: 'workspace',
  [AppView.ADMIN_BULK_OPERATIONS]: 'workspace',
  [AppView.ADMIN_LLM]: 'ai',
  [AppView.ADMIN_AI_HEALTH]: 'ai',
  [AppView.HELP_ANALYTICS]: 'ai',
  [AppView.ADMIN_TOKEN_MANAGEMENT]: 'ai',
  [AppView.ADMIN_BILLING_MANAGEMENT]: 'billing',
};

interface AdminSidebarProps {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  onBackToApp: () => void;
  currentUserEmail: string;
  companyName?: string;
}

interface MenuItem {
  id: AdminSection;
  labelKey: string;
  icon: React.ReactNode;
  separator?: 'before';
}

// 8-module menu structure (matching AdminView)
const menuItems: MenuItem[] = [
  { id: 'overview', labelKey: 'admin.modules.overview', icon: <LayoutDashboard size={20} /> },
  {
    id: 'organization',
    labelKey: 'admin.modules.organization',
    icon: <Building2 size={20} />,
    separator: 'before',
  },
  { id: 'team', labelKey: 'admin.modules.team', icon: <Users size={20} /> },
  { id: 'workspace', labelKey: 'admin.modules.workspace', icon: <FolderOpen size={20} /> },
  { id: 'ai', labelKey: 'admin.modules.ai', icon: <Brain size={20} />, separator: 'before' },
  { id: 'billing', labelKey: 'admin.modules.billing', icon: <CreditCard size={20} /> },
  {
    id: 'security',
    labelKey: 'admin.modules.security',
    icon: <Shield size={20} />,
    separator: 'before',
  },
  { id: 'feedback', labelKey: 'admin.modules.feedback', icon: <MessageSquare size={20} /> },
];

// Reusable menu button component

const MenuButton: React.FC<{
  item: MenuItem;
  activeSection: AdminSection;
  showFull: boolean;
  onSectionChange: (section: AdminSection) => void;
  badge?: number;
  t: (key: string, options?: any) => any;
}> = ({ item, activeSection, showFull, onSectionChange, badge, t }) => {
  const label = t(item.labelKey, item.id.charAt(0).toUpperCase() + item.id.slice(1));

  return (
    <button
      onClick={() => onSectionChange(item.id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
        activeSection === item.id
          ? 'bg-gradient-to-r from-primary-600/20 to-transparent text-primary-600 dark:text-white border-l-2 border-primary-500'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
      }`}
      title={!showFull ? label : undefined}
    >
      <span
        className={`shrink-0 relative ${activeSection === item.id ? 'text-primary-500 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}
      >
        {item.icon}
        {/* Badge for collapsed state */}
        {badge && badge > 0 && !showFull && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>

      <span
        className={`flex-1 text-left text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
          showFull ? 'w-auto opacity-100' : 'w-0 opacity-0'
        }`}
      >
        {label}
      </span>

      {/* Badge for expanded state */}
      {showFull && badge && badge > 0 && (
        <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}

      {showFull && activeSection === item.id && (
        <ChevronRight size={14} className="text-primary-500 dark:text-primary-400 ml-auto" />
      )}
    </button>
  );
};

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeSection,
  onSectionChange,
  onBackToApp,
  currentUserEmail,
  companyName,
}) => {
  const { t } = useTranslation();
  const { isSidebarCollapsed, toggleSidebarCollapse } = useAppStore();
  const [isHovered, setIsHovered] = useState(false);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  // Fetch pending invitations count for badge on Team
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const invitations = await Api.getInvitations();
        const pending = invitations.filter((inv: any) => inv.status === 'pending').length;
        setPendingInvitesCount(pending);
      } catch (err) {
        // Silently fail - badge is optional
      }
    };
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Show full if pinned (not collapsed) OR hovered
  const showFull = !isSidebarCollapsed || isHovered;

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
                fixed left-0 top-0 h-full bg-white dark:bg-navy-950 border-r border-slate-200 dark:border-navy-700 flex flex-col shrink-0 z-50
                transition-all duration-300 ease-in-out shadow-xl
                ${showFull ? 'w-72' : 'w-16'}
            `}
    >
      {/* Header / Brand */}
      <div className="h-16 border-b border-slate-200 dark:border-navy-700 flex items-center px-4 gap-3 relative shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center shadow-lg shrink-0">
          <Shield size={18} className="text-white" />
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ${showFull ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}
        >
          <div className="font-bold text-slate-900 dark:text-white text-sm tracking-wide whitespace-nowrap">
            {t('admin.title', 'ADMIN')}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap truncate max-w-[140px]">
            {companyName || t('admin.panel', 'Panel')}
          </div>
        </div>

        {/* Pin/Unpin Button */}
        {showFull && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSidebarCollapse?.();
              setIsHovered(false);
            }}
            className="absolute right-2 p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            title={
              isSidebarCollapsed
                ? t('sidebar.pin', 'Pin Sidebar')
                : t('sidebar.unpin', 'Unpin Sidebar')
            }
          >
            {isSidebarCollapsed ? (
              <Pin size={16} className="rotate-45" />
            ) : (
              <PanelLeftClose size={16} />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              {/* Minimal separator - just a thin line */}
              {item.separator === 'before' && (
                <div className="mx-3 my-2 border-t border-slate-200 dark:border-navy-700" />
              )}
              <MenuButton
                item={item}
                activeSection={activeSection}
                showFull={showFull}
                onSectionChange={onSectionChange}
                badge={item.id === 'team' ? pendingInvitesCount : undefined}
                t={t}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* User / Back Section */}
      <div className="p-3 border-t border-slate-200 dark:border-navy-700 shrink-0">
        <div
          className={`flex items-center gap-3 px-2 py-2 mb-1 overflow-hidden transition-all duration-300 ${showFull ? 'opacity-100' : 'opacity-0 h-0 hidden'}`}
        >
          <div className="w-8 h-8 rounded-full bg-primary-600/20 flex items-center justify-center shrink-0">
            <Shield size={16} className="text-primary-500 dark:text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
              {currentUserEmail}
            </div>
            <div className="text-[10px] text-primary-500 dark:text-primary-400 uppercase">
              {t('admin.role', 'Admin')}
            </div>
          </div>
        </div>

        {/* Back to App Button */}
        <button
          onClick={onBackToApp}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 hover:text-primary-600 dark:hover:text-primary-400 transition-all group ${!showFull ? 'justify-center' : ''}`}
          title={t('admin.backToApp', 'Back to App')}
        >
          <ArrowLeft size={18} className="shrink-0" />
          <span
            className={`text-sm whitespace-nowrap transition-all duration-300 ${showFull ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}
          >
            {t('admin.backToApp', 'Back to App')}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
