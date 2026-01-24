/**
 * AuditLogsTab - Security > Audit Logs
 * AI-specific audit logs - wrapper for AdminAuditLogsView
 */

import React from 'react';

import AdminAuditLogsView from '../../iam/AdminAuditLogsView';

export const AuditLogsTab: React.FC = () => {
  // TODO: Add AI-specific filter in the future
  return <AdminAuditLogsView />;
};

export default AuditLogsTab;
