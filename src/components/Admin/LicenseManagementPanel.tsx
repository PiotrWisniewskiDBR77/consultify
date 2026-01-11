/**
 * LicenseManagementPanel - Manage user licenses
 */

import React from 'react';

interface LicenseManagementPanelProps {
  organizationId?: string;
  onLicenseChange?: () => void;
}

export const LicenseManagementPanel: React.FC<LicenseManagementPanelProps> = ({
  organizationId,
  onLicenseChange,
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">License Management</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Manage licenses for your organization.
      </p>
    </div>
  );
};

export default LicenseManagementPanel;
