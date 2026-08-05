/**
 * SecurityPrivacyModule - Enterprise Security & Privacy Settings
 *
 * Complete security management following HubSpot/ClickUp standards:
 *
 * Tabs:
 * 1. Dashboard - Security overview and score
 * 2. MFA - Two-factor authentication
 * 3. Trusted Devices - Device management
 * 4. Sessions - Active sessions
 * 5. Security Events - Audit log
 * 6. Data Controls - GDPR controls
 * 7. Privacy - Visibility settings
 */

import {
  Activity,
  Database,
  EyeOff,
  Fingerprint,
  History,
  Key,
  LayoutDashboard,
  Monitor,
  Shield,
  Smartphone,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MFASetup } from '../../components/Profile/MFASetup';
import { ActiveSessionsSettings } from '../../components/settings/ActiveSessionsSettings';
import { DataControlsSettings } from '../../components/settings/DataControlsSettings';
import { PrivacySettings } from '../../components/settings/PrivacySettings';
// Import all settings components
import { SecurityDashboard } from '../../components/settings/SecurityDashboard';
import { SecurityEventsSettings } from '../../components/settings/SecurityEventsSettings';
import { TrustedDevicesSettings } from '../../components/settings/TrustedDevicesSettings';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { User } from '../../types';
import { isMfaMvpEnabled } from '../../utils/mfaMvpFlag';

interface SecurityPrivacyModuleProps {
  initialTab?: string;
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

export const SecurityPrivacyModule: React.FC<SecurityPrivacyModuleProps> = ({
  initialTab,
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const mfaMvpEnabled = isMfaMvpEnabled();
  const [activeTab, setActiveTab] = useState(
    initialTab === 'mfa' && !mfaMvpEnabled ? 'dashboard' : initialTab || 'dashboard'
  );

  // Update active tab when initialTab prop changes
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      queueMicrotask(() =>
        setActiveTab(initialTab === 'mfa' && !mfaMvpEnabled ? 'dashboard' : initialTab)
      );
    }
  }, [initialTab, activeTab, mfaMvpEnabled]);

  const tabs: Tab[] = [
    {
      id: 'dashboard',
      label: t('settings.tabs.dashboard', 'Dashboard'),
      icon: <LayoutDashboard size={16} />,
    },
    ...(mfaMvpEnabled
      ? [
          {
            id: 'mfa',
            label: t('settings.tabs.mfa', 'MFA'),
            icon: <Fingerprint size={16} />,
          },
        ]
      : []),
    {
      id: 'devices',
      label: t('settings.tabs.devices', 'Trusted Devices'),
      icon: <Smartphone size={16} />,
    },
    {
      id: 'sessions',
      label: t('settings.tabs.sessions', 'Sessions'),
      icon: <Monitor size={16} />,
    },
    {
      id: 'events',
      label: t('settings.tabs.events', 'Security Events'),
      icon: <Activity size={16} />,
    },
    {
      id: 'data',
      label: t('settings.tabs.dataControls', 'Data Controls'),
      icon: <Database size={16} />,
    },
    {
      id: 'privacy',
      label: t('settings.tabs.privacy', 'Privacy'),
      icon: <EyeOff size={16} />,
    },
  ];

  const handleMFAUpdate = () => {
    // Refresh user data after MFA changes
    onUpdateUser({ mfaEnabled: !currentUser.mfaEnabled });
  };

  const handleNavigateToTab = (tabId: string) => {
    setActiveTab(tabId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <SecurityDashboard currentUser={currentUser} onNavigateToTab={handleNavigateToTab} />
        );

      case 'mfa':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <MFASetup isEnabled={currentUser?.mfaEnabled || false} onUpdate={handleMFAUpdate} />
          </div>
        );

      case 'devices':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <TrustedDevicesSettings currentUser={currentUser} />
          </div>
        );

      case 'sessions':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ActiveSessionsSettings />
          </div>
        );

      case 'events':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <SecurityEventsSettings currentUser={currentUser} />
          </div>
        );

      case 'data':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <DataControlsSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
          </div>
        );

      case 'privacy':
        return <PrivacySettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;

      default:
        return (
          <SecurityDashboard currentUser={currentUser} onNavigateToTab={handleNavigateToTab} />
        );
    }
  };

  return (
    <TabLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title={t('settings.modules.security', 'Security & Privacy')}
      subtitle={t('settings.modules.securityDesc', 'Manage your security settings and data')}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default SecurityPrivacyModule;
