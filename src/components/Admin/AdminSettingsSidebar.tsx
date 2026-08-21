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
  const { t, i18n } = useTranslation();
  const language = i18n?.resolvedLanguage || i18n?.language || 'pl';
  const isPolish = language.toLowerCase().startsWith('pl');
  return (
    <DomainNavigation
      title={isPolish ? 'PANEL ADMINISTRATORA' : 'ADMIN PANEL'}
      description={
        isPolish
          ? 'Dostęp, polityki organizacji, dowody i bezpieczne operacje'
          : 'Access, organization policies, evidence, and safe operations'
      }
      navigationLabel={t(
        'admin.shell.navigation',
        isPolish ? 'Nawigacja panelu administratora' : 'Admin Panel navigation'
      )}
      modules={getAdminDomains(language).map((domain) =>
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
      backLabel={t('common.back', isPolish ? 'Wróć' : 'Back')}
      className={className}
    />
  );
};

export default AdminSettingsSidebar;
