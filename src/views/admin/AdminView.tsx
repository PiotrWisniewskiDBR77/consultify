import React from 'react';

export const AdminView: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-navy-900 dark:text-white">Admin</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
        Admin module placeholder view.
      </p>
    </div>
  );
};

export default AdminView;
/**
 * AdminView - main admin entry
 *
 * Provides a stable module shell for admin routes.
 */

import React from 'react';

import AdminSettingsModule from './AdminSettingsModule';

export const AdminView: React.FC = () => <AdminSettingsModule />;

export default AdminView;
