/**
 * AdminView - main admin entry
 *
 * Provides a stable module shell for admin routes.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { DesktopOnlyGuard } from '@/components/shared/DesktopOnlyGuard';
import type { AppView, User } from '@/types';

import AdminSettingsModule from './AdminSettingsModule';

interface AdminViewProps {
  currentUser: User;
  onNavigate?: (view: AppView) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  return (
    <DesktopOnlyGuard moduleName={t('admin.shell.moduleName', 'Admin Panel')}>
      <AdminSettingsModule currentUser={currentUser} />
    </DesktopOnlyGuard>
  );
};

export default AdminView;
