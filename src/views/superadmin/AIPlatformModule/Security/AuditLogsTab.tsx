/**
 * AuditLogsTab - Security > Audit Logs
 * AI-specific audit logs - wrapper for AdminAuditLogsView
 */

import React from 'react';

import AdminAuditLogsView from '../../iam/AdminAuditLogsView';

export const AuditLogsTab: React.FC = () => {
  return <AdminAuditLogsView />;
};

export default AuditLogsTab;
