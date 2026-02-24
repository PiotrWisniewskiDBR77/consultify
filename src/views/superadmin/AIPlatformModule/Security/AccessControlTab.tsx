/**
 * AccessControlTab - Security > Access Control
 * RBAC for AI features
 *
 * NOTE:
 * The previous version used hardcoded mock roles/permissions.
 * We now reuse the existing SuperAdmin Permissions Matrix view which is DB-backed.
 */

import React from 'react';

import PermissionsMatrixView from '../../iam/PermissionsMatrixView';

export const AccessControlTab: React.FC = () => {
  return <PermissionsMatrixView />;
};

export default AccessControlTab;
