import React, { useState } from 'react';
import {
    LayoutDashboard,
    Building2,
    Users,
    Brain,
    BookOpen,
    Settings,
    Shield,
    FileText,
    LogOut,
    ChevronRight,
    UserPlus,
    CreditCard,
    TrendingUp,
    Pin,
    PanelLeftClose
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export type SuperAdminSection =
    | 'overview'
    | 'organizations'
    | 'users'
    | 'access-requests'
    | 'llm'
    | 'knowledge'
    | 'plans'
    | 'token-billing'
    | 'revenue'
    | 'settings'
    | 'analytics'
    | 'audit';

interface SuperAdminSidebarProps {
    activeSection: SuperAdminSection;
    onSectionChange: (section: SuperAdminSection) => void;
    onLogout: () => void;
    currentUserEmail: string;
}

const menuItems: { id: SuperAdminSection; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'System Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'organizations', label: 'Organizations', icon: <Building2 size={20} /> },
    { id: 'users', label: 'All Users', icon: <Users size={20} /> },
    { id: 'access-requests', label: 'Access Requests', icon: <UserPlus size={20} /> },
    { id: 'plans', label: 'Subscription Plans', icon: <CreditCard size={20} /> },
    { id: 'token-billing', label: 'Token Billing', icon: <CreditCard size={20} /> },
    { id: 'revenue', label: 'Revenue', icon: <TrendingUp size={20} /> },
    { id: 'llm', label: 'LLM Providers', icon: <Brain size={20} /> },
    { id: 'knowledge', label: 'Knowledge Base', icon: <BookOpen size={20} /> },
    { id: 'settings', label: 'System Settings', icon: <Settings size={20} /> },
    { id: 'analytics', label: 'AI Analytics', icon: <LayoutDashboard size={20} /> },
    { id: 'audit', label: 'Audit Logs', icon: <FileText size={20} /> },
];

export const SuperAdminSidebar: React.FC<SuperAdminSidebarProps> = ({
    activeSection,
    onSectionChange,
    onLogout,
    currentUserEmail
}) => {
    const { isSidebarCollapsed, toggleSidebarCollapse } = useAppStore();
    const [isHovered, setIsHovered] = useState(false);

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
                {showFull && (
                    <div className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold px-3 mb-3 fade-in">
                        Management
                    </div>
                )}
                <ul className="space-y-1">
                    {menuItems.map((item) => (
                        <li key={item.id}>
                            <button
                                onClick={() => onSectionChange(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${activeSection === item.id
                                    ? 'bg-gradient-to-r from-red-600/20 to-transparent text-white border-l-2 border-red-500'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    }`}
                                title={!showFull ? item.label : undefined}
                            >
                                <span className={`shrink-0 ${activeSection === item.id ? 'text-red-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                                    {item.icon}
                                </span>

                                <span className={`flex-1 text-left text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${showFull ? 'w-auto opacity-100' : 'w-0 opacity-0'
                                    }`}>
                                    {item.label}
                                </span>

                                {showFull && activeSection === item.id && (
                                    <ChevronRight size={14} className="text-red-400 ml-auto" />
                                )}
                            </button>
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
