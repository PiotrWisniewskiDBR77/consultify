import React, { useState } from 'react';
import { User, Language } from '../types';
import { useTranslation } from 'react-i18next';
import { UserCircle, CreditCard, Cpu, Bell, Link as LinkIcon, Globe } from 'lucide-react';
import { BillingSettings } from '../components/settings/BillingSettings';
import { AISettings } from '../components/settings/AISettings';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { NotificationSettings } from '../components/settings/NotificationSettings';
import { IntegrationSettings } from '../components/settings/IntegrationSettings';
import { RegionalSettings } from '../components/settings/RegionalSettings';

interface SettingsViewProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
    theme: 'light' | 'dark' | 'system';
    toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, onUpdateUser, theme, toggleTheme }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'PROFILE' | 'BILLING' | 'AI' | 'NOTIFICATIONS' | 'INTEGRATIONS' | 'REGIONAL'>('PROFILE');

    return (
        <div className="flex h-full bg-slate-50 dark:bg-navy-950 transition-colors duration-300">
            {/* Settings Navigation */}
            <div className="w-64 border-r border-slate-200 dark:border-white/5 bg-white dark:bg-navy-900 p-6 flex flex-col gap-1 transition-colors duration-300">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-3">{t('settings.menu.header')}</h2>

                <button
                    onClick={() => setActiveTab('PROFILE')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'PROFILE' ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    <UserCircle size={18} />
                    {t('settings.menu.myProfile')}
                </button>
                <button
                    onClick={() => setActiveTab('BILLING')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'BILLING' ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    <CreditCard size={18} />
                    {t('settings.menu.billing')}
                </button>

                <button
                    onClick={() => setActiveTab('AI')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'AI' ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    <Cpu size={18} />
                    {t('settings.menu.aiConfig')}
                </button>

                <button
                    onClick={() => setActiveTab('NOTIFICATIONS')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'NOTIFICATIONS' ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    <Bell size={18} />
                    {t('settings.menu.notifications')}
                </button>

                <button
                    onClick={() => setActiveTab('INTEGRATIONS')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'INTEGRATIONS' ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    <LinkIcon size={18} />
                    {t('settings.menu.integrations')}
                </button>

                <button
                    onClick={() => setActiveTab('REGIONAL')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'REGIONAL' ? 'bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                    <Globe size={18} />
                    {t('settings.menu.regionalization')}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-6 lg:p-8">
                {activeTab === 'PROFILE' && (
                    <ProfileSettings
                        currentUser={currentUser}
                        onUpdateUser={onUpdateUser}
                        theme={theme}
                        toggleTheme={toggleTheme}
                    />
                )}
                {activeTab === 'BILLING' && <BillingSettings currentUser={currentUser} />}
                {activeTab === 'AI' && <AISettings currentUser={currentUser} onUpdateUser={onUpdateUser} />}
                {activeTab === 'NOTIFICATIONS' && <NotificationSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />}
                {activeTab === 'INTEGRATIONS' && <IntegrationSettings currentUser={currentUser} />}
                {activeTab === 'REGIONAL' && <RegionalSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />}
            </div>
        </div>
    );
};
