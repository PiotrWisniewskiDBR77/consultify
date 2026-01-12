import {
    Activity,
    BarChart3,
    Brain,
    ChevronRight,
    Code,
    CreditCard,
    Layers,
    LayoutDashboard,
    LogOut,
    PanelLeftClose,
    Pin,
    Radar,
    Server,
    Settings,
    Shield,
    Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';

// Modular structure with 3 AI modules (Variant A)
export type SuperAdminSection =
    | 'overview'
    | 'customers'
    | 'ai-platform' // Legacy - kept for backward compatibility
    | 'ai-infrastructure' // New: LLM Providers, Tiers, Settings, Health
    | 'ai-development' // New: Prompts, Intelligence, Experiments, Knowledge
    | 'ai-operations' // New: Mission Control, Performance, Costs, SLA, Analytics
    | 'system'
    | 'content'
    | 'revenue'
    | 'security'
    | 'configuration'
    | 'analytics'; // Custom Dashboards, Reports, Metrics, Predictive

// Mapping between sections and AppView
export const sectionToAppView: Record<SuperAdminSection, AppView> = {
    overview: AppView.SUPERADMIN_OVERVIEW,
    customers: AppView.SUPERADMIN_CUSTOMERS,
    'ai-platform': AppView.SUPERADMIN_AI_PLATFORM, // Legacy
    'ai-infrastructure': AppView.SUPERADMIN_AI_INFRASTRUCTURE,
    'ai-development': AppView.SUPERADMIN_AI_DEVELOPMENT,
    'ai-operations': AppView.SUPERADMIN_AI_OPERATIONS,
    system: AppView.SUPERADMIN_SYSTEM,
    content: AppView.SUPERADMIN_CONTENT,
    revenue: AppView.SUPERADMIN_REVENUE,
    security: AppView.SUPERADMIN_SECURITY,
    configuration: AppView.SUPERADMIN_CONFIGURATION,
    analytics: AppView.SUPERADMIN_ANALYTICS,
};

export const appViewToSection: Record<string, SuperAdminSection> = {
    [AppView.SUPERADMIN_OVERVIEW]: 'overview',
    [AppView.SUPERADMIN_CUSTOMERS]: 'customers',
    [AppView.SUPERADMIN_AI_PLATFORM]: 'ai-infrastructure', // Legacy redirects to infrastructure
    [AppView.SUPERADMIN_AI_INFRASTRUCTURE]: 'ai-infrastructure',
    [AppView.SUPERADMIN_AI_DEVELOPMENT]: 'ai-development',
    [AppView.SUPERADMIN_AI_OPERATIONS]: 'ai-operations',
    [AppView.SUPERADMIN_SYSTEM]: 'system',
    [AppView.SUPERADMIN_CONTENT]: 'content',
    [AppView.SUPERADMIN_REVENUE]: 'revenue',
    [AppView.SUPERADMIN_SECURITY]: 'security',
    [AppView.SUPERADMIN_CONFIGURATION]: 'configuration',
    [AppView.SUPERADMIN_ANALYTICS]: 'analytics',
    // Legacy view mappings - redirect to new modules
    [AppView.SUPERADMIN_DASHBOARD]: 'overview',
    [AppView.SUPERADMIN_ORGANIZATIONS]: 'customers',
    [AppView.SUPERADMIN_USERS]: 'customers',
    [AppView.SUPERADMIN_FEEDBACK]: 'customers',
    [AppView.SUPERADMIN_BULK_OPERATIONS]: 'customers',
    [AppView.SUPERADMIN_LLM_MANAGEMENT]: 'ai-infrastructure',
    [AppView.SUPERADMIN_AI_INTELLIGENCE]: 'ai-development',
    [AppView.SUPERADMIN_KNOWLEDGE]: 'ai-development',
    [AppView.SUPERADMIN_BILLING]: 'revenue',
    [AppView.SUPERADMIN_INVOICES]: 'revenue',
    [AppView.SUPERADMIN_SSO]: 'security',
    [AppView.SUPERADMIN_SECURITY_POLICIES]: 'security',
    [AppView.SUPERADMIN_API_MANAGEMENT]: 'security',
    [AppView.SUPERADMIN_COMPLIANCE]: 'security',
    [AppView.SUPERADMIN_SETTINGS]: 'configuration',
    [AppView.SUPERADMIN_WHITELABEL]: 'configuration',
    [AppView.SUPERADMIN_PLAYBOOK_TEMPLATES]: 'content',
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

// Modular menu structure with 3 AI modules (Variant A)
const menuItems: MenuItem[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    // --- separator ---
    { id: 'customers', label: 'Customers', icon: <Users size={20} />, separator: 'before' },
    // --- AI Platform (3 modules) ---
    { id: 'ai-infrastructure', label: 'AI Infrastructure', icon: <Server size={20} />, separator: 'before' },
    { id: 'ai-development', label: 'AI Development', icon: <Code size={20} /> },
    { id: 'ai-operations', label: 'AI Operations', icon: <Radar size={20} /> },
    // --- separator ---
    { id: 'system', label: 'System', icon: <Activity size={20} />, separator: 'before' },
    { id: 'content', label: 'Content', icon: <Layers size={20} /> },
    // --- separator ---
    { id: 'revenue', label: 'Revenue', icon: <CreditCard size={20} />, separator: 'before' },
    { id: 'security', label: 'Security', icon: <Shield size={20} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
    // --- separator ---
    { id: 'configuration', label: 'Configuration', icon: <Settings size={20} />, separator: 'before' },
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
                ? 'bg-gradient-to-r from-red-600/20 to-transparent text-red-600 dark:text-white border-l-2 border-red-500'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
        }`}
        title={!showFull ? item.label : undefined}
    >
        <span
            className={`shrink-0 relative ${activeSection === item.id ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}
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
            <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
        )}

        {showFull && activeSection === item.id && (
            <ChevronRight size={14} className="text-red-500 dark:text-red-400 ml-auto" />
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
                fixed left-0 top-0 h-full bg-white dark:bg-navy-950 border-r border-slate-200 dark:border-white/5 flex flex-col shrink-0 z-50
                transition-all duration-300 ease-in-out shadow-xl
                ${showFull ? 'w-72' : 'w-16'}
            `}
        >
            {/* Header / Brand */}
            <div className="h-16 border-b border-slate-200 dark:border-white/5 flex items-center px-4 gap-3 relative shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shrink-0">
                    <Shield size={18} className="text-white" />
                </div>

                <div
                    className={`overflow-hidden transition-all duration-300 ${showFull ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}
                >
                    <div className="font-bold text-slate-900 dark:text-white text-sm tracking-wide whitespace-nowrap">
                        SUPER ADMIN
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest whitespace-nowrap">
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
                        className="absolute right-2 p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        title={isSidebarCollapsed ? 'Pin Sidebar (Keep Open)' : 'Unpin Sidebar (Collapse)'}
                    >
                        {isSidebarCollapsed ? <Pin size={16} className="rotate-45" /> : <PanelLeftClose size={16} />}
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
                                <div className="mx-3 my-2 border-t border-slate-200 dark:border-white/5" />
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
            <div className="p-3 border-t border-slate-200 dark:border-white/5 shrink-0">
                <div
                    className={`flex items-center gap-3 px-2 py-2 mb-1 overflow-hidden transition-all duration-300 ${showFull ? 'opacity-100' : 'opacity-0 h-0 hidden'}`}
                >
                    <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center shrink-0">
                        <Shield size={16} className="text-red-500 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
                            {currentUserEmail}
                        </div>
                        <div className="text-[10px] text-red-500 dark:text-red-400 uppercase">Super Admin</div>
                    </div>
                </div>
                <button
                    onClick={onLogout}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all group ${!showFull ? 'justify-center' : ''}`}
                    title="Sign Out"
                >
                    <LogOut size={18} className="shrink-0" />
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
