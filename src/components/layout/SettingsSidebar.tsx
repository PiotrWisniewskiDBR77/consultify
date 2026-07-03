/**
 * SettingsSidebar Component
 *
 * 6-module navigation for User Settings following SuperAdmin pattern.
 * Modules: Profile | AI Preferences | Notifications | Security | Integrations | Appearance
 */

import {
  ArrowLeft,
  Bell,
  Brain,
  ChevronRight,
  Link,
  Palette,
  PanelLeftClose,
  Pin,
  Settings,
  Shield,
  UserCircle,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

// 6-module structure for Settings
export type SettingsSection =
  | 'profile'
  | 'ai-preferences'
  | 'notifications'
  | 'security'
  | 'integrations'
  | 'appearance';

// Mapping between sections and AppView
export const settingsSectionToAppView: Record<SettingsSection, AppView> = {
  profile: AppView.SETTINGS_PROFILE_MODULE,
  'ai-preferences': AppView.SETTINGS_AI_MODULE,
  notifications: AppView.SETTINGS_NOTIFICATIONS_MODULE,
  security: AppView.SETTINGS_SECURITY_MODULE,
  integrations: AppView.SETTINGS_INTEGRATIONS_MODULE,
  appearance: AppView.SETTINGS_APPEARANCE_MODULE,
};

export const appViewToSettingsSection: Record<string, SettingsSection> = {
  [AppView.SETTINGS_PROFILE_MODULE]: 'profile',
  [AppView.SETTINGS_AI_MODULE]: 'ai-preferences',
  [AppView.SETTINGS_NOTIFICATIONS_MODULE]: 'notifications',
  [AppView.SETTINGS_SECURITY_MODULE]: 'security',
  [AppView.SETTINGS_INTEGRATIONS_MODULE]: 'integrations',
  [AppView.SETTINGS_APPEARANCE_MODULE]: 'appearance',
  // Legacy view mappings - redirect to new modules
  [AppView.SETTINGS_PROFILE]: 'profile',
  [AppView.SETTINGS_AI]: 'ai-preferences',
  [AppView.SETTINGS_NOTIFICATIONS]: 'notifications',
  [AppView.SETTINGS_SECURITY]: 'security',
  [AppView.SETTINGS_PRIVACY]: 'security',
  [AppView.SETTINGS_INTEGRATIONS]: 'integrations',
  [AppView.SETTINGS_REGIONALIZATION]: 'appearance',
  [AppView.SETTINGS_ACCESSIBILITY]: 'appearance',
  [AppView.SETTINGS_WORK_PREFERENCES]: 'appearance',
  [AppView.SETTINGS_DASHBOARD_PREFERENCES]: 'appearance',
  [AppView.SETTINGS_BILLING]: 'profile',
};

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onBackToApp: () => void;
  currentUserName?: string;
  currentUserEmail?: string;
}

interface MenuItem {
  id: SettingsSection;
  labelKey: string;
  icon: React.ReactNode;
  separator?: 'before';
}

// 6-module menu structure
const menuItems: MenuItem[] = [
  { id: 'profile', labelKey: 'settings.modules.profile', icon: <UserCircle size={20} /> },
  {
    id: 'ai-preferences',
    labelKey: 'settings.modules.aiPreferences',
    icon: <Brain size={20} />,
    separator: 'before',
  },
  { id: 'notifications', labelKey: 'settings.modules.notifications', icon: <Bell size={20} /> },
  {
    id: 'security',
    labelKey: 'settings.modules.security',
    icon: <Shield size={20} />,
    separator: 'before',
  },
  { id: 'integrations', labelKey: 'settings.modules.integrations', icon: <Link size={20} /> },
  {
    id: 'appearance',
    labelKey: 'settings.modules.appearance',
    icon: <Palette size={20} />,
    separator: 'before',
  },
];

// Reusable menu button component
const MenuButton: React.FC<{
  item: MenuItem;
  activeSection: SettingsSection;
  showFull: boolean;
  onSectionChange: (section: SettingsSection) => void;
  t: any;
}> = ({ item, activeSection, showFull, onSectionChange, t }) => {
  const label = t(
    item.labelKey,
    item.id.charAt(0).toUpperCase() + item.id.slice(1).replace('-', ' ')
  );

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
        className={`shrink-0 ${activeSection === item.id ? 'text-primary-500 dark:text-primary-400' : 'text-slate-600 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}
      >
        {item.icon}
      </span>

      <span
        className={`flex-1 text-left text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
          showFull ? 'w-auto opacity-100' : 'w-0 opacity-0'
        }`}
      >
        {label}
      </span>

      {showFull && activeSection === item.id && (
        <ChevronRight size={14} className="text-primary-500 dark:text-primary-400 ml-auto" />
      )}
    </button>
  );
};

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeSection,
  onSectionChange,
  onBackToApp,
  currentUserName,
  currentUserEmail,
}) => {
  const { t } = useTranslation();
  const { isSidebarCollapsed, toggleSidebarCollapse } = useAppStore();
  const [isHovered, setIsHovered] = useState(false);

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
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 dark:from-primary-600 dark:to-primary-700 flex items-center justify-center shadow-lg shrink-0">
          <Settings size={16} className="text-white" />
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ${showFull ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}
        >
          <div className="font-bold text-slate-900 dark:text-white text-sm tracking-wide whitespace-nowrap">
            {t('settings.title', 'SETTINGS')}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">
            {t('settings.subtitle', 'Preferences')}
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
            <UserCircle size={16} className="text-primary-500 dark:text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
              {currentUserName || currentUserEmail || t('settings.user', 'User')}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {currentUserEmail}
            </div>
          </div>
        </div>
        <button
          onClick={onBackToApp}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 hover:text-primary-600 dark:hover:text-primary-400 transition-all group ${!showFull ? 'justify-center' : ''}`}
          title={t('settings.backToApp', 'Back to App')}
        >
          <ArrowLeft size={16} className="shrink-0" />
          <span
            className={`text-sm whitespace-nowrap transition-all duration-300 ${showFull ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}
          >
            {t('settings.backToApp', 'Back to App')}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default SettingsSidebar;
