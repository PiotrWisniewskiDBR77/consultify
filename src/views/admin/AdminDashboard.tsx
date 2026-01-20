/**
 * AdminDashboard - summary overview panel
 */

import React from 'react';

import { Project, User } from '../../types';

interface AdminDashboardProps {
  users: User[];
  projects: Project[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ users, projects }) => {
  return (
    <div className="p-6 space-y-4">
      <div className="text-lg font-semibold text-navy-900 dark:text-white">Admin Overview</div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Users</div>
          <div className="text-2xl font-semibold text-navy-900 dark:text-white">
            {users.length.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Projects</div>
          <div className="text-2xl font-semibold text-navy-900 dark:text-white">
            {projects.length.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
