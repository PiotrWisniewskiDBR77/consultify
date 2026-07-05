import {
  Brain,
  ChevronRight,
  Layers,
  LogOut,
  PanelLeftClose,
  Pin,
  Server,
  Shield,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

// Unified AI Platform structure (6 tabs with sub-tabs)
export type SuperAdminSection = 'customers' | 'ai-platform' | 'system' | 'content' | 'security';

// Mapping between sections and AppView
export const sectionToAppView: Record<SuperAdminSection, AppView> = {
  customers: AppView.SUPERADMIN_CUSTOMERS,
  'ai-platform': AppView.SUPERADMIN_AI_PLATFORM,
  system: AppView.SUPERADMIN_SYSTEM,
  content: AppView.SUPERADMIN_CONTENT,
  security: AppView.SUPERADMIN_SECURITY,
};

export const appViewToSection: Record<string, SuperAdminSection> = {
  [AppView.SUPERADMIN_OVERVIEW]: 'customers',
  [AppView.SUPERADMIN_CUSTOMERS]: 'customers',
  [AppView.SUPERADMIN_AI_PLATFORM]: 'ai-platform',
  [AppView.SUPERADMIN_AI_INFRASTRUCTURE]: 'ai-platform',
  [AppView.SUPERADMIN_AI_DEVELOPMENT]: 'ai-platform',
  [AppView.SUPERADMIN_AI_OPERATIONS]: 'ai-platform',
  [AppView.SUPERADMIN_SYSTEM]: 'system',
  [AppView.SUPERADMIN_CONTENT]: 'content',
  [AppView.SUPERADMIN_SECURITY]: 'security',
  [AppView.SUPERADMIN_REVENUE]: 'customers',
  [AppView.SUPERADMIN_CONFIGURATION]: 'system',
  [AppView.SUPERADMIN_ANALYTICS]: 'system',
  [AppView.SUPERADMIN_VIRTUAL_WORKERS]: 'ai-platform',
  [AppView.SUPERADMIN_DASHBOARD]: 'customers',
  [AppView.SUPERADMIN_ORGANIZATIONS]: 'customers',
  [AppView.SUPERADMIN_USERS]: 'customers',
  [AppView.SUPERADMIN_COMMUNICATION]: 'customers',
  [AppView.SUPERADMIN_FEEDBACK]: 'customers',
  [AppView.SUPERADMIN_BULK_OPERATIONS]: 'customers',
  [AppView.SUPERADMIN_LLM_MANAGEMENT]: 'ai-platform',
  [AppView.SUPERADMIN_AI_CONFIG]: 'ai-platform',
  [AppView.SUPERADMIN_AI_INTELLIGENCE]: 'ai-platform',
  [AppView.SUPERADMIN_KNOWLEDGE]: 'ai-platform',
  [AppView.SUPERADMIN_BILLING]: 'customers',
  [AppView.SUPERADMIN_INVOICES]: 'customers',
  [AppView.SUPERADMIN_SSO]: 'security',
  [AppView.SUPERADMIN_SECURITY_POLICIES]: 'security',
  [AppView.SUPERADMIN_API_MANAGEMENT]: 'system',
  [AppView.SUPERADMIN_COMPLIANCE]: 'content',
  [AppView.SUPERADMIN_SETTINGS]: 'system',
  [AppView.SUPERADMIN_WHITELABEL]: 'system',
  [AppView.SUPERADMIN_PLAYBOOK_TEMPLATES]: 'customers',
  [AppView.SUPERADMIN_PLAYBOOK_EDITOR]: 'customers',
};

interface SuperAdminSidebarProps {
  activeSection: SuperAdminSection;
  onSectionChange: (section: SuperAdminSection) => void;
  onLogout: () => void;
  currentUserEmail: string;
}

interface MenuItem {
  id: SuperAdminSection;
  label: string;
  icon: React.ReactNode;
  separator?: 'before';
}

const menuItems: MenuItem[] = [
  { id: 'customers', label: 'Tenant & User Ops', icon: <Users size={20} />, separator: 'before' },
  { id: 'ai-platform', label: 'AI Operations', icon: <Brain size={20} />, separator: 'before' },
  { id: 'system', label: 'Connector Ops', icon: <Server size={20} />, separator: 'before' },
  {
    id: 'content',
    label: 'Governance & Compliance',
    icon: <Layers size={20} />,
    separator: 'before',
  },
  { id: 'security', label: 'Platform Security', icon: <Shield size={20} /> },
];

// Reusable menu button component
const MenuButton: React.FC<{
  item: MenuItem;
  activeSection: SuperAdminSection;
  showFull: boolean;
  onSectionChange: (section: SuperAdminSection) => void;
  badge?: number;
}> = ({ item, activeSection, showFull, onSectionChange, badge }) => (
  <button
    onClick={() => onSectionChange(item.id)}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
      activeSection === item.id
        ? 'bg-gradient-to-r from-danger-600/20 to-transparent text-danger-600 dark:text-white border-l-2 border-danger-500'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
    }`}
    title={!showFull ? item.label : undefined}
  >
    <span
      className={`shrink-0 relative ${activeSection === item.id ? 'text-danger-500 dark:text-danger-400' : 'text-slate-600 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}
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
      {item.label}
    </span>

    {/* Badge for expanded state */}
    {showFull && badge && badge > 0 && (
      <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
        {badge}
      </span>
    )}

    {showFull && activeSection === item.id && (
      <ChevronRight size={14} className="text-danger-500 dark:text-danger-400 ml-auto" />
    )}
  </button>
);

export const SuperAdminSidebar: React.FC<SuperAdminSidebarProps> = ({
  activeSection,
  onSectionChange,
  onLogout,
  currentUserEmail,
}) => {
  const { isSidebarCollapsed, toggleSidebarCollapse } = useAppStore();
  const [isHovered, setIsHovered] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Fetch pending requests count for badge on Customers
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const requests = await Api.getAccessRequests();
        const pending = requests.filter((r: any) => r.status === 'pending').length;
        setPendingRequestsCount(pending);
      } catch (err) {
        console.warn('[SuperAdminSidebar] Failed to fetch pending access requests badge', err);
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
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-danger-600 to-danger-700 flex items-center justify-center shadow-lg shrink-0">
          <Shield size={16} className="text-white" />
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ${showFull ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}
        >
          <div className="font-bold text-slate-900 dark:text-white text-sm tracking-wide whitespace-nowrap">
            SUPER ADMIN
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">
            Console
          </div>
        </div>

        {/* Pin/Unpin Button */}
        {showFull && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSidebarCollapse();
              setIsHovered(false);
            }}
            className="absolute right-2 p-1.5 text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            title={isSidebarCollapsed ? 'Pin Sidebar (Keep Open)' : 'Unpin Sidebar (Collapse)'}
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
                badge={item.id === 'customers' ? pendingRequestsCount : undefined}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* User / Logout Section */}
      <div className="p-3 border-t border-slate-200 dark:border-navy-700 shrink-0">
        <div
          className={`flex items-center gap-3 px-2 py-2 mb-1 overflow-hidden transition-all duration-300 ${showFull ? 'opacity-100' : 'opacity-0 h-0 hidden'}`}
        >
          <div className="w-8 h-8 rounded-full bg-danger-600/20 flex items-center justify-center shrink-0">
            <Shield size={16} className="text-danger-500 dark:text-danger-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
              {currentUserEmail}
            </div>
            <div className="text-[10px] text-danger-500 dark:text-danger-400 uppercase">
              Super Admin
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-danger-50 dark:hover:bg-danger-500/10 hover:text-danger-600 dark:hover:text-danger-400 transition-all group ${!showFull ? 'justify-center' : ''}`}
          title="Sign Out"
        >
          <LogOut size={16} className="shrink-0" />
          <span
            className={`text-sm whitespace-nowrap transition-all duration-300 ${showFull ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}
          >
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
};
