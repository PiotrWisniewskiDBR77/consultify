import React, { useEffect } from 'react';
import { User, AppView } from '../types';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { BillingSettings } from '../components/settings/BillingSettings';
import { AISettings } from '../components/settings/AISettings';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { SecuritySettings } from '../components/settings/SecuritySettings';
import { NotificationSettings } from '../components/settings/NotificationSettings';
import { IntegrationSettings } from '../components/settings/IntegrationSettings';
import { RegionalSettings } from '../components/settings/RegionalSettings';
import { LegalSettings } from '../components/settings/LegalSettings';
import { OrganizationSettings } from '../components/settings/OrganizationSettings';
import { WorkPreferencesSettings } from '../components/settings/WorkPreferencesSettings';
import { DashboardPreferencesSettings } from '../components/settings/DashboardPreferencesSettings';
import { AccessibilitySettings } from '../components/settings/AccessibilitySettings';
import { PrivacySettings } from '../components/settings/PrivacySettings';
import { useAppStore } from '../store/useAppStore';

interface SettingsViewProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
    theme: 'light' | 'dark' | 'system';
    toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, onUpdateUser, theme, toggleTheme }) => {
    const { t } = useTranslation();
    const { currentView, setCurrentView } = useAppStore();
    
    // Initialize to profile if not a settings view
    useEffect(() => {
        if (!currentView.startsWith('SETTINGS_')) {
            setCurrentView(AppView.SETTINGS_PROFILE);
        }
    }, []);

    // Render content based on currentView
    const renderContent = () => {
        switch (currentView) {
            case AppView.SETTINGS_PROFILE:
                return (
                    <ProfileSettings
                        currentUser={currentUser}
                        onUpdateUser={onUpdateUser}
                        theme={theme}
                        toggleTheme={toggleTheme}
                    />
                );
            case AppView.SETTINGS_SECURITY:
                return <SecuritySettings currentUser={currentUser} />;
            case AppView.SETTINGS_ORGANIZATION:
                return <OrganizationSettings currentUser={currentUser} />;
            case AppView.SETTINGS_BILLING:
                return <BillingSettings currentUser={currentUser} />;
            case AppView.SETTINGS_AI:
                return <AISettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case AppView.SETTINGS_NOTIFICATIONS:
                return <NotificationSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case AppView.SETTINGS_INTEGRATIONS:
                return <IntegrationSettings currentUser={currentUser} />;
            case AppView.SETTINGS_REGIONALIZATION:
                return <RegionalSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case AppView.SETTINGS_LEGAL:
                return <LegalSettings currentUser={currentUser} />;
            case AppView.SETTINGS_WORK_PREFERENCES:
                return <WorkPreferencesSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case AppView.SETTINGS_DASHBOARD_PREFERENCES:
                return <DashboardPreferencesSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case AppView.SETTINGS_ACCESSIBILITY:
                return <AccessibilitySettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case AppView.SETTINGS_PRIVACY:
                return <PrivacySettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            default:
                return (
                    <ProfileSettings
                        currentUser={currentUser}
                        onUpdateUser={onUpdateUser}
                        theme={theme}
                        toggleTheme={toggleTheme}
                    />
                );
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 transition-colors duration-300">
            {/* Settings Header */}
            <div className="h-14 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-navy-950 flex items-center justify-between px-6 shrink-0">
                <div>
                    <h1 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Settings className="text-purple-500" size={18} />
                        {t('settings.menu.header', 'Settings')}
                    </h1>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-6 lg:p-8">
                {renderContent()}
            </div>
        </div>
    );
};
