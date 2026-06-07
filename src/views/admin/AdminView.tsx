/**
 * AdminView - main admin entry
 *
 * Provides a stable module shell for admin routes.
 */
import React from 'react';

import { DesktopOnlyGuard } from '@/components/shared/DesktopOnlyGuard';
import type { AppView, User } from '@/types';

import AdminSettingsModule from './AdminSettingsModule';

interface AdminViewProps {
  currentUser: User;
  onNavigate?: (view: AppView) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser }) => {
  return (
    <DesktopOnlyGuard moduleName="Panel administratora">
      <AdminSettingsModule currentUser={currentUser} />
    </DesktopOnlyGuard>
  );
};

export default AdminView;
