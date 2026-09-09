import React from 'react';
import { useTranslation } from 'react-i18next';

import DomainNavigation from '../settings/shared/DomainNavigation';
import { type AdminLocation, getAdminDomains } from './adminNavigation';

export type { AdminDomain, AdminLocation, AdminScreen } from './adminNavigation';
export type AdminSettingsSection =
  | 'people'
  | 'billing'
  | 'ai'
  | 'security'
  | 'audit'
  | 'command'
  | 'health';

interface AdminSettingsSidebarProps {
  activeLocation: AdminLocation;
  onLocationChange: (location: AdminLocation) => void;
  className?: string;
  onBack?: () => void;
  canAccessPlatformOperations?: boolean;
}

export const AdminSettingsSidebar: React.FC<AdminSettingsSidebarProps> = ({
  activeLocation,
  onLocationChange,
  className,
  onBack,
  canAccessPlatformOperations = false,
}) => {
  const { t } = useTranslation();
  return (
    <DomainNavigation
      title={t('admin.shell.title', 'ADMIN PANEL')}
      description={t(
        'admin.shell.description',
        'Access, organization policies, evidence, and safe operations'
      )}
      navigationLabel={t('admin.shell.navigation', 'Admin Panel navigation')}
      modules={getAdminDomains(t).map((domain) =>
        domain.id === 'health' && !canAccessPlatformOperations
          ? {
              ...domain,
              children: domain.children.filter((screen) => screen.id !== 'platform-operations'),
            }
          : domain
      )}
      activeModule={activeLocation.domain}
      activeChild={activeLocation.screen}
      onChildChange={(domain, screen) => onLocationChange({ domain, screen })}
      onBack={onBack}
      backLabel={t('common.back', 'Back')}
      className={className}
    />
  );
};

export default AdminSettingsSidebar;
