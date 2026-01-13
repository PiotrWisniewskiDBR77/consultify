/**
 * IAM Module View
 *
 * Advanced Identity & Access Management module for SuperAdmin
 * Features: Admin Sessions, Audit Logs, Permissions Matrix, Approval Workflows, Security Incidents, Threat Intelligence, DLP
 */

import {
  AlertTriangle,
  FileText,
  GitBranch,
  Globe,
  Key,
  Loader2,
  Shield,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';

import { Tab, TabLayout } from '../../../components/SuperAdmin/TabLayout';
import AdminAuditLogsView from './AdminAuditLogsView';
import AdminSessionsView from './AdminSessionsView';
import ApprovalWorkflowsView from './ApprovalWorkflowsView';
import DLPView from './DLPView';
import PermissionsMatrixView from './PermissionsMatrixView';
import SecurityIncidentsView from './SecurityIncidentsView';
import ThreatIntelligenceView from './ThreatIntelligenceView';

const tabs: Tab[] = [
  { id: 'sessions', label: 'Admin Sessions', icon: <Users size={16} /> },
  { id: 'audit', label: 'Audit Logs', icon: <Shield size={16} /> },
  { id: 'permissions', label: 'Permissions', icon: <Key size={16} /> },
  { id: 'workflows', label: 'Approval Workflows', icon: <GitBranch size={16} /> },
  { id: 'incidents', label: 'Security Incidents', icon: <AlertTriangle size={16} /> },
  { id: 'threats', label: 'Threat Intelligence', icon: <Globe size={16} /> },
  { id: 'dlp', label: 'DLP', icon: <FileText size={16} /> },
];

const IAMModuleView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('sessions');

  const renderContent = () => {
    switch (activeTab) {
      case 'sessions':
        return <AdminSessionsView />;
      case 'audit':
        return <AdminAuditLogsView />;
      case 'permissions':
        return <PermissionsMatrixView />;
      case 'workflows':
        return <ApprovalWorkflowsView />;
      case 'incidents':
        return <SecurityIncidentsView />;
      case 'threats':
        return <ThreatIntelligenceView />;
      case 'dlp':
        return <DLPView />;
      default:
        return <AdminSessionsView />;
    }
  };

  return (
    <TabLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="flex-1 overflow-auto p-6">{renderContent()}</div>
    </TabLayout>
  );
};

export default IAMModuleView;
