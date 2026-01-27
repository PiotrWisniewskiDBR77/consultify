/**
 * AdminView - main admin entry
 *
 * Provides a stable module shell for admin routes.
 */
import React from 'react';

import type { AppView, User } from '@/types';

import AdminSettingsModule from './AdminSettingsModule';

interface AdminViewProps {
  currentUser: User;
  onNavigate?: (view: AppView) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser }) => {
  return <AdminSettingsModule currentUser={currentUser} />;
};

export default AdminView;
