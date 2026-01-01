import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Building2,
    Users,
    Brain,
    BookOpen,
    Settings,
    Shield,
    LogOut,
    ChevronRight,
    CreditCard,
    Pin,
    PanelLeftClose,
    Key,
    KeyRound,
    Palette,
    ShieldCheck,
    FileCheck,
    Receipt,
    Lock,
    Upload,
    Layers,
    MessageSquareWarning,
    Cpu,
    Sparkles
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { AppView } from '../types';

// Legacy type for backward compatibility - maps to AppView
export type SuperAdminSection =
    | 'dashboard'
    | 'organizations'
    | 'users'
    | 'billing'
    | 'ai-config'
    | 'llm-management'
    | 'ai-intelligence'
    | 'knowledge'
    | 'settings'
    // Enterprise sections
    | 'sso'
    | 'security-policies'
    | 'api-management'
    | 'whitelabel'
    | 'compliance'
    | 'invoices'
    | 'feedback'
    | 'playbooks'
    | 'bulk-operations';

// Mapping between legacy sections and AppView
export const sectionToAppView: Record<SuperAdminSection, AppView> = {
    'dashboard': AppView.SUPERADMIN_DASHBOARD,
    'organizations': AppView.SUPERADMIN_ORGANIZATIONS,
    'users': AppView.SUPERADMIN_USERS,
    'billing': AppView.SUPERADMIN_BILLING,
    'ai-config': AppView.SUPERADMIN_AI_CONFIG,
    'llm-management': AppView.SUPERADMIN_LLM_MANAGEMENT,
    'ai-intelligence': AppView.SUPERADMIN_AI_INTELLIGENCE,
    'knowledge': AppView.SUPERADMIN_KNOWLEDGE,
    'settings': AppView.SUPERADMIN_SETTINGS,
    // Enterprise mappings
    'sso': AppView.SUPERADMIN_SSO,
    'security-policies': AppView.SUPERADMIN_SECURITY_POLICIES,
    'api-management': AppView.SUPERADMIN_API_MANAGEMENT,
    'whitelabel': AppView.SUPERADMIN_WHITELABEL,
    'compliance': AppView.SUPERADMIN_COMPLIANCE,
    'invoices': AppView.SUPERADMIN_INVOICES,
    'feedback': AppView.SUPERADMIN_FEEDBACK,
    'playbooks': AppView.SUPERADMIN_PLAYBOOK_TEMPLATES,
    'bulk-operations': AppView.SUPERADMIN_BULK_OPERATIONS,
};

export const appViewToSection: Record<string, SuperAdminSection> = {
    [AppView.SUPERADMIN_DASHBOARD]: 'dashboard',
    [AppView.SUPERADMIN_ORGANIZATIONS]: 'organizations',
    [AppView.SUPERADMIN_USERS]: 'users',
    [AppView.SUPERADMIN_BILLING]: 'billing',
    [AppView.SUPERADMIN_AI_CONFIG]: 'ai-config',
    [AppView.SUPERADMIN_LLM_MANAGEMENT]: 'llm-management',
    [AppView.SUPERADMIN_AI_INTELLIGENCE]: 'ai-intelligence',
    [AppView.SUPERADMIN_KNOWLEDGE]: 'knowledge',
    [AppView.SUPERADMIN_SETTINGS]: 'settings',
    // Enterprise mappings
    [AppView.SUPERADMIN_SSO]: 'sso',
    [AppView.SUPERADMIN_SECURITY_POLICIES]: 'security-policies',
    [AppView.SUPERADMIN_API_MANAGEMENT]: 'api-management',
    [AppView.SUPERADMIN_WHITELABEL]: 'whitelabel',
    [AppView.SUPERADMIN_COMPLIANCE]: 'compliance',
    [AppView.SUPERADMIN_INVOICES]: 'invoices',
    [AppView.SUPERADMIN_FEEDBACK]: 'feedback',
    [AppView.SUPERADMIN_PLAYBOOK_TEMPLATES]: 'playbooks',
    [AppView.SUPERADMIN_BULK_OPERATIONS]: 'bulk-operations',
};

interface SuperAdminSidebarProps {
    activeSection: SuperAdminSection;
    onSectionChange: (section: SuperAdminSection) => void;
    onLogout: () => void;
    currentUserEmail: string;
}

// Reusable menu button component
const MenuButton: React.FC<{
    item: MenuItem;
    activeSection: SuperAdminSection;
    showFull: boolean;
    onSectionChange: (section: SuperAdminSection) => void;
    pendingRequestsCount: number;
}> = ({ item, activeSection, showFull, onSectionChange, pendingRequestsCount }) => (
    <button
        onClick={() => onSectionChange(item.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${activeSection === item.id
            ? 'bg-gradient-to-r from-red-600/20 to-transparent text-white border-l-2 border-red-500'
            : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
        title={!showFull ? item.label : undefined}
    >
        <span className={`shrink-0 relative ${activeSection === item.id ? 'text-red-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
            {item.icon}
            {/* Pending requests badge for Organizations */}
            {item.id === 'organizations' && pendingRequestsCount > 0 && !showFull && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                    {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                </span>
            )}
        </span>

        <span className={`flex-1 text-left text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${showFull ? 'w-auto opacity-100' : 'w-0 opacity-0'
            }`}>
            {item.label}
        </span>

        {/* Pending requests badge (expanded) */}
        {showFull && item.id === 'organizations' && pendingRequestsCount > 0 && (
            <span className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingRequestsCount}
            </span>
        )}

        {showFull && activeSection === item.id && (
            <ChevronRight size={14} className="text-red-400 ml-auto" />
        )}
    </button>
);

interface MenuItem {
    id: SuperAdminSection;
    viewId: AppView;
    label: string;
    icon: React.ReactNode;
    highlight?: boolean;
    category?: 'core' | 'security' | 'enterprise' | 'system';
}

const menuItems: MenuItem[] = [
    // Core Management
    { id: 'dashboard', viewId: AppView.SUPERADMIN_DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={20} />, category: 'core' },
    { id: 'organizations', viewId: AppView.SUPERADMIN_ORGANIZATIONS, label: 'Organizations', icon: <Building2 size={20} />, category: 'core' },
    { id: 'users', viewId: AppView.SUPERADMIN_USERS, label: 'Users', icon: <Users size={20} />, category: 'core' },
    { id: 'playbooks', viewId: AppView.SUPERADMIN_PLAYBOOK_TEMPLATES, label: 'Playbook Templates', icon: <Layers size={20} />, category: 'core' },

    // Security & Access

    { id: 'sso', viewId: AppView.SUPERADMIN_SSO, label: 'SSO Configuration', icon: <Key size={20} />, category: 'security' },
    { id: 'security-policies', viewId: AppView.SUPERADMIN_SECURITY_POLICIES, label: 'Security Policies', icon: <ShieldCheck size={20} />, category: 'security' },
    { id: 'api-management', viewId: AppView.SUPERADMIN_API_MANAGEMENT, label: 'API Management', icon: <KeyRound size={20} />, category: 'security' },

    // Enterprise Features
    { id: 'billing', viewId: AppView.SUPERADMIN_BILLING, label: 'Billing Center', icon: <CreditCard size={20} />, highlight: true, category: 'enterprise' },
    { id: 'invoices', viewId: AppView.SUPERADMIN_INVOICES, label: 'Invoices', icon: <Receipt size={20} />, category: 'enterprise' },
    { id: 'whitelabel', viewId: AppView.SUPERADMIN_WHITELABEL, label: 'White-label Studio', icon: <Palette size={20} />, category: 'enterprise' },
    { id: 'compliance', viewId: AppView.SUPERADMIN_COMPLIANCE, label: 'Compliance Center', icon: <FileCheck size={20} />, category: 'enterprise' },
    { id: 'feedback', viewId: AppView.SUPERADMIN_FEEDBACK, label: 'User Feedback', icon: <MessageSquareWarning size={20} />, category: 'core' },
    { id: 'bulk-operations', viewId: AppView.SUPERADMIN_BULK_OPERATIONS, label: 'Bulk Operations', icon: <Upload size={20} />, category: 'enterprise' },

    // System - AI & LLM (Two distinct modules)
    { id: 'llm-management', viewId: AppView.SUPERADMIN_LLM_MANAGEMENT, label: 'LLM Management', icon: <Cpu size={20} />, category: 'system' },
    { id: 'ai-intelligence', viewId: AppView.SUPERADMIN_AI_INTELLIGENCE, label: 'AI Intelligence', icon: <Sparkles size={20} />, highlight: true, category: 'system' },
    { id: 'knowledge', viewId: AppView.SUPERADMIN_KNOWLEDGE, label: 'Knowledge Base', icon: <BookOpen size={20} />, category: 'system' },
    { id: 'settings', viewId: AppView.SUPERADMIN_SETTINGS, label: 'Settings', icon: <Settings size={20} />, category: 'system' },
];

export const SuperAdminSidebar: React.FC<SuperAdminSidebarProps> = ({
    activeSection,
    onSectionChange,
    onLogout,
    currentUserEmail
}) => {
    const { isSidebarCollapsed, toggleSidebarCollapse } = useAppStore();
    const [isHovered, setIsHovered] = useState(false);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

    // Fetch pending requests count for badge
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
        // Refresh every 60 seconds
        const interval = setInterval(fetchPendingCount, 60000);
        return () => clearInterval(interval);
    }, []);

    // "Show Full" if Pinned (not collapsed) OR Hovered
    // If isSidebarCollapsed is true (unpinned), we only show full on hover.
    const showFull = !isSidebarCollapsed || isHovered;

    return (
        <aside
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`
                fixed left-0 top-0 h-full bg-navy-950 border-r border-white/5 flex flex-col shrink-0 z-50
                transition-all duration-300 ease-in-out shadow-xl
                ${showFull ? 'w-72' : 'w-16'}
            `}
        >
            {/* Header / Brand */}
            <div className="h-16 border-b border-white/5 flex items-center px-4 gap-3 relative shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shrink-0">
                    <Shield size={18} className="text-white" />
                </div>

                <div className={`overflow-hidden transition-all duration-300 ${showFull ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
                    <div className="font-bold text-white text-sm tracking-wide whitespace-nowrap">SUPER ADMIN</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest whitespace-nowrap">Console</div>
                </div>

                {/* Pin/Unpin Button - Visible only when expanded (showFull) */}
                {showFull && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent drag/other
                            toggleSidebarCollapse();
                            setIsHovered(false);
                        }}
                        className="absolute right-2 p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title={isSidebarCollapsed ? "Pin Sidebar (Keep Open)" : "Unpin Sidebar (Collapse)"}
                    >
                        {isSidebarCollapsed ? <Pin size={16} className="rotate-45" /> : <PanelLeftClose size={16} />}
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {/* Core Management */}
                {showFull && (
                    <div className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold px-3 mb-2 mt-2 fade-in">
                        Management
                    </div>
                )}
                <ul className="space-y-1">
                    {menuItems.filter(item => item.category === 'core').map((item) => (
                        <li key={item.id}>
                            <MenuButton item={item} activeSection={activeSection} showFull={showFull} onSectionChange={onSectionChange} pendingRequestsCount={pendingRequestsCount} />
                        </li>
                    ))}
                </ul>

                {/* Security & Access */}
                {showFull && (
                    <div className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold px-3 mb-2 mt-4 fade-in">
                        Security & Access
                    </div>
                )}
                <ul className="space-y-1 mt-1">
                    {menuItems.filter(item => item.category === 'security').map((item) => (
                        <li key={item.id}>
                            <MenuButton item={item} activeSection={activeSection} showFull={showFull} onSectionChange={onSectionChange} pendingRequestsCount={0} />
                        </li>
                    ))}
                </ul>

                {/* Enterprise Features */}
                {showFull && (
                    <div className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold px-3 mb-2 mt-4 fade-in">
                        Enterprise
                    </div>
                )}
                <ul className="space-y-1 mt-1">
                    {menuItems.filter(item => item.category === 'enterprise').map((item) => (
                        <li key={item.id}>
                            <MenuButton item={item} activeSection={activeSection} showFull={showFull} onSectionChange={onSectionChange} pendingRequestsCount={0} />
                        </li>
                    ))}
                </ul>

                {/* System */}
                {showFull && (
                    <div className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold px-3 mb-2 mt-4 fade-in">
                        System
                    </div>
                )}
                <ul className="space-y-1 mt-1">
                    {menuItems.filter(item => item.category === 'system').map((item) => (
                        <li key={item.id}>
                            <MenuButton item={item} activeSection={activeSection} showFull={showFull} onSectionChange={onSectionChange} pendingRequestsCount={0} />
                        </li>
                    ))}
                </ul>
            </nav>

            {/* User / Logout Section */}
            <div className="p-3 border-t border-white/5 shrink-0">
                <div className={`flex items-center gap-3 px-2 py-2 mb-1 overflow-hidden transition-all duration-300 ${showFull ? 'opacity-100' : 'opacity-0 h-0 hidden'}`}>
                    <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center shrink-0">
                        <Shield size={16} className="text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">{currentUserEmail}</div>
                        <div className="text-[10px] text-red-400 uppercase">Super Admin</div>
                    </div>
                </div>
                <button
                    onClick={onLogout}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all group ${!showFull ? 'justify-center' : ''}`}
                    title="Sign Out"
                >
                    <LogOut size={18} className="shrink-0" />
                    <span className={`text-sm whitespace-nowrap transition-all duration-300 ${showFull ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}>
                        Sign Out
                    </span>
                </button>
            </div>
        </aside>
    );
};
