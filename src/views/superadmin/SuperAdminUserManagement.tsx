import React from 'react';

import { InfoButton } from '../../components/shared/InfoButton';
import { UserManagementCore } from '../../components/shared/UserManagementCore';

interface SuperAdminUserManagementProps {
  organizations?: Array<{ id: string; name: string; status: string }>;
  selectedOrganizationId?: string;
  onSelectedOrganizationChange?: (organizationId: string) => void;
}

export const SuperAdminUserManagement: React.FC<SuperAdminUserManagementProps> = ({
  organizations = [],
  selectedOrganizationId = '',
  onSelectedOrganizationChange,
}) => {
  const selectedOrganization = organizations.find(
    (organization) => organization.id === selectedOrganizationId
  );

  return (
    <div className="p-8 overflow-y-auto relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            {selectedOrganization
              ? `Manage users in ${selectedOrganization.name}`
              : 'Manage all platform users across organizations'}
          </p>
        </div>
        <InfoButton
          cardId="superadmin-users"
          position="header-inline"
          size="md"
          showLabel
          label="Help"
        />
      </div>

      <UserManagementCore
        mode="platform"
        organizations={organizations}
        selectedOrganizationId={selectedOrganizationId}
        onSelectedOrganizationChange={onSelectedOrganizationChange}
        showInvite={true}
        showMove={true}
        showImpersonate={true}
        showBlock={true}
        showRoleManagement={true}
        showLicenseManagement={true}
      />
    </div>
  );
};

export default SuperAdminUserManagement;
