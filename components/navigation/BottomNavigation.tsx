/**
 * BottomNavigation Component
 * 
 * Mobile-only bottom navigation bar with 5 key navigation items.
 * Provides quick access to main app sections on mobile devices.
 */

import React from 'react';
import {
    LayoutDashboard,
    ClipboardCheck,
    Lightbulb,
    Calendar,
    Menu,
    Sparkles,
    Home,
} from 'lucide-react';
import { AppView } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useDeviceType } from '../../hooks/useDeviceType';
import { useTranslation } from 'react-i18next';

interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    view?: AppView;
    action?: 'openSidebar' | 'openChat';
    badge?: number;
}

export const BottomNavigation: React.FC = () => {
    const { t } = useTranslation();
    const { isMobile } = useDeviceType();
    const {
        currentView,
        setCurrentView,
        setIsSidebarOpen,
        toggleChatCollapse,
        isChatCollapsed,
    } = useAppStore();

    // Don't render on non-mobile devices
    if (!isMobile) return null;

    const navItems: NavItem[] = [
        {
            id: 'dashboard',
            label: t('sidebar.dashboard', 'Dashboard'),
            icon: <Home size={22} />,
            view: AppView.DASHBOARD_OVERVIEW,
        },
        {
            id: 'assessment',
            label: t('sidebar.assessment', 'Oceny'),
            icon: <ClipboardCheck size={22} />,
            view: AppView.ASSESSMENT_DRD,
        },
        {
            id: 'initiatives',
            label: t('sidebar.module3_1', 'Inicjatywy'),
            icon: <Lightbulb size={22} />,
            view: AppView.FULL_STEP2_INITIATIVES,
        },
        {
            id: 'ai',
            label: 'AI',
            icon: <Sparkles size={22} />,
            action: 'openChat',
        },
        {
            id: 'more',
            label: t('common.more', 'Więcej'),
            icon: <Menu size={22} />,
            action: 'openSidebar',
        },
    ];

    const handleNavClick = (item: NavItem) => {
        if (item.action === 'openSidebar') {
            setIsSidebarOpen(true);
        } else if (item.action === 'openChat') {
            if (isChatCollapsed) {
                toggleChatCollapse();
            }
        } else if (item.view) {
            setCurrentView(item.view);
        }
    };

    const isActive = (item: NavItem): boolean => {
        if (!item.view) return false;
        
        // Check for assessment views
        if (item.id === 'assessment') {
            return currentView.toString().includes('ASSESSMENT');
        }
        
        // Check for initiative views
        if (item.id === 'initiatives') {
            return currentView === AppView.FULL_STEP2_INITIATIVES;
        }
        
        // Check for dashboard views
        if (item.id === 'dashboard') {
            return currentView === AppView.DASHBOARD_OVERVIEW || 
                   currentView === AppView.USER_DASHBOARD ||
                   currentView === AppView.DASHBOARD;
        }

        return currentView === item.view;
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-pb">
            {/* Background with blur */}
            <div className="absolute inset-0 bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 shadow-2xl shadow-black/10" />
            
            {/* Navigation Items */}
            <div className="relative flex items-stretch justify-around px-2 h-16">
                {navItems.map((item) => {
                    const active = isActive(item);
                    
                    return (
                        <button
                            key={item.id}
                            onClick={() => handleNavClick(item)}
                            className={`
                                flex-1 flex flex-col items-center justify-center gap-0.5 
                                transition-all duration-200 relative touch-target no-select
                                ${active 
                                    ? 'text-purple-600 dark:text-purple-400' 
                                    : 'text-slate-400 dark:text-slate-500 active:text-purple-600 dark:active:text-purple-400'
                                }
                            `}
                        >
                            {/* Active Indicator */}
                            {active && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-purple-600 dark:bg-purple-400 rounded-b-full" />
                            )}
                            
                            {/* Icon Container with pulse effect for AI */}
                            <div className={`
                                relative flex items-center justify-center
                                ${item.id === 'ai' && !isChatCollapsed ? 'animate-pulse' : ''}
                            `}>
                                {item.icon}
                                
                                {/* Badge */}
                                {item.badge && item.badge > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                        {item.badge > 9 ? '9+' : item.badge}
                                    </span>
                                )}
                            </div>
                            
                            {/* Label */}
                            <span className={`text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNavigation;



