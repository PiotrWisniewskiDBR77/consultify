import { ChevronDown, Cpu, CreditCard, Languages, LogOut, Monitor, Moon, Sun, UserCircle } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface UserProfileMenuProps {
    className?: string;
    showName?: boolean;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({ className = '', showName = true }) => {
    const { currentUser, setCurrentView, logout, theme, toggleTheme } = useAppStore();

    const { t, i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleNavigate = (view: AppView) => {
        setCurrentView(view);
        setIsOpen(false);
    };

    const handleLogout = () => {
        logout();
        setIsOpen(false);
        setCurrentView(AppView.WELCOME);
    };

    if (!currentUser) return null;

    return (
        <div className={`relative ${className}`} ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg p-1 transition-colors cursor-pointer text-left focus:outline-none"
            >
                {showName && (
                    <div className="text-right hidden md:block">
                        <div className="text-xs font-semibold text-navy-900 dark:text-white">
                            {currentUser.firstName} {currentUser.lastName}
                        </div>
                        <div className="text-[10px] text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                            {currentUser.companyName || currentUser.role}
                        </div>
                    </div>
                )}

                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-white/10 flex items-center justify-center relative">
                    {currentUser.avatarUrl ? (
                        <img
                            src={currentUser.avatarUrl}
                            alt="Profile"
                            className="w-full h-full rounded-full object-cover"
                        />
                    ) : (
                        <UserCircle size={20} className="text-slate-400" />
                    )}
                </div>
            </button>

            {/* Profile Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                    {/* Header with User Info */}
                    <div className="px-4 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-slate-500 overflow-hidden shrink-0 border border-slate-200 dark:border-white/10">
                                {currentUser.avatarUrl ? (
                                    <img
                                        src={currentUser.avatarUrl}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <UserCircle size={24} />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-navy-900 dark:text-white truncate">
                                    {currentUser.firstName} {currentUser.lastName}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate mb-1">
                                    {currentUser.email}
                                </div>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 capitalize border border-purple-200 dark:border-purple-500/20">
                                    {currentUser.role?.toLowerCase()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Settings Section */}
                    <div className="p-2 border-b border-slate-100 dark:border-white/5">
                        <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            {t('settings.menu.preferences', 'Preferences')}
                        </div>

                        {/* Theme Toggle */}
                        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <Sun size={16} className="hidden dark:block" />
                                <Moon size={16} className="dark:hidden" />
                                <span>{t('settings.menu.theme', 'Theme')}</span>
                            </div>
                            <div className="flex bg-slate-100 dark:bg-navy-950 rounded-lg p-1 border border-slate-200 dark:border-white/10">
                                {(['light', 'system', 'dark'] as const).map((tMode) => (
                                    <button
                                        key={tMode}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleTheme(tMode);
                                        }}
                                        className={`p-1.5 rounded-md transition-all ${
                                            theme === tMode
                                                ? 'bg-white dark:bg-navy-800 shadow-sm text-purple-600 dark:text-purple-400'
                                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                        title={tMode.charAt(0).toUpperCase() + tMode.slice(1)}
                                    >
                                        {tMode === 'light' && <Sun size={14} />}
                                        {tMode === 'dark' && <Moon size={14} />}
                                        {tMode === 'system' && <Monitor size={14} />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Language Toggle */}
                        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <Languages size={16} />
                                <span>{t('settings.menu.language', 'Language')}</span>
                            </div>
                            <div className="flex gap-1">
                                {['en', 'pl'].map((lang) => (
                                    <button
                                        key={lang}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            i18n.changeLanguage(lang);
                                        }}
                                        className={`text-[10px] px-2 py-1 rounded border transition-colors font-medium uppercase min-w-[32px] ${
                                            i18n.language?.startsWith(lang)
                                                ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-500/30 dark:text-purple-300'
                                                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5 dark:text-slate-400'
                                        }`}
                                    >
                                        {lang}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <div className="p-2 space-y-0.5">
                        <button
                            onClick={() => handleNavigate(AppView.SETTINGS_PROFILE)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 rounded-lg transition-colors"
                        >
                            <UserCircle size={16} />
                            {t('settings.menu.myProfile', 'My Profile')}
                        </button>
                        <button
                            onClick={() => handleNavigate(AppView.SETTINGS_BILLING)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 rounded-lg transition-colors"
                        >
                            <CreditCard size={16} />
                            {t('settings.menu.billing', 'Billing & Plans')}
                        </button>
                        <button
                            onClick={() => handleNavigate(AppView.SETTINGS_AI)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 rounded-lg transition-colors"
                        >
                            <Cpu size={16} />
                            {t('settings.menu.aiConfig', 'AI Configuration')}
                        </button>

                        <div className="my-1 border-t border-slate-100 dark:border-white/5 opacity-50"></div>

                        <button
                            onClick={handleLogout}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 rounded-lg transition-colors"
                        >
                            <LogOut size={16} />
                            {t('sidebar.logOut', 'Log Out')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
