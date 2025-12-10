import React from 'react';
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
    TrendingUp
} from 'lucide-react';

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

const menuItems: { id: SuperAdminSection; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'overview', label: 'System Overview', icon: <LayoutDashboard size={20} />, description: 'Dashboard & Stats' },
    { id: 'organizations', label: 'Organizations', icon: <Building2 size={20} />, description: 'Manage companies' },
    { id: 'users', label: 'All Users', icon: <Users size={20} />, description: 'System-wide users' },
    { id: 'access-requests', label: 'Access Requests', icon: <UserPlus size={20} />, description: 'Approve new users' },
    { id: 'plans', label: 'Subscription Plans', icon: <CreditCard size={20} />, description: 'Pricing tiers' },
    { id: 'token-billing', label: 'Token Billing', icon: <CreditCard size={20} />, description: 'Margins & Packages' },
    { id: 'revenue', label: 'Revenue', icon: <TrendingUp size={20} />, description: 'MRR & Analytics' },
    { id: 'llm', label: 'LLM Providers', icon: <Brain size={20} />, description: 'AI model config' },
    { id: 'knowledge', label: 'Knowledge Base', icon: <BookOpen size={20} />, description: 'RAG documents' },
    { id: 'settings', label: 'System Settings', icon: <Settings size={20} />, description: 'Global config' },
    { id: 'analytics', label: 'AI Analytics', icon: <LayoutDashboard size={20} />, description: 'Usage & Costs' },
    { id: 'audit', label: 'Audit Logs', icon: <FileText size={20} />, description: 'Activity history' },
];

export const SuperAdminSidebar: React.FC<SuperAdminSidebarProps> = ({
    activeSection,
    onSectionChange,
    onLogout,
    currentUserEmail
}) => {
    return (
        <aside className="w-72 h-full bg-navy-950 border-r border-white/5 flex flex-col shrink-0">
            {/* Logo / Brand */}
            <div className="h-16 border-b border-white/5 flex items-center px-6 gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg">
                    <Shield size={20} className="text-white" />
                </div>
                <div>
                    <div className="font-bold text-white text-sm tracking-wide">SUPER ADMIN</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest">Console</div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 overflow-y-auto">
                <div className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold px-3 mb-3">
                    Management
                </div>
                <ul className="space-y-1">
                    {menuItems.map((item) => (
                        <li key={item.id}>
                            <button
                                onClick={() => onSectionChange(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeSection === item.id
                                    ? 'bg-gradient-to-r from-red-600/20 to-transparent text-white border-l-2 border-red-500'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <span className={activeSection === item.id ? 'text-red-400' : 'text-slate-500 group-hover:text-slate-300'}>
                                    {item.icon}
                                </span>
                                <div className="flex-1 text-left">
                                    <div className="text-sm font-medium">{item.label}</div>
                                    <div className="text-[10px] text-slate-600">{item.description}</div>
                                </div>
                                {activeSection === item.id && (
                                    <ChevronRight size={14} className="text-red-400" />
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* User / Logout Section */}
            <div className="p-4 border-t border-white/5">
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center">
                        <Shield size={16} className="text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">{currentUserEmail}</div>
                        <div className="text-[10px] text-red-400 uppercase">Super Admin</div>
                    </div>
                </div>
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
                >
                    <LogOut size={18} />
                    <span className="text-sm">Sign Out</span>
                </button>
            </div>
        </aside>
    );
};
