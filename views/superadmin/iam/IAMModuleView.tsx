/**
 * IAM Module View
 * 
 * Advanced Identity & Access Management module for SuperAdmin
 * Features: Admin Sessions, Audit Logs, Permissions Matrix, Approval Workflows, Security Incidents, Threat Intelligence, DLP
 */

import React, { useState } from 'react';
import { TabLayout, Tab } from '../../../components/SuperAdmin/TabLayout';
import { Users, Shield, Key, GitBranch, AlertTriangle, Globe, FileText, Loader2 } from 'lucide-react';
import AdminSessionsView from './AdminSessionsView';
import AdminAuditLogsView from './AdminAuditLogsView';
import PermissionsMatrixView from './PermissionsMatrixView';
import ApprovalWorkflowsView from './ApprovalWorkflowsView';
import SecurityIncidentsView from './SecurityIncidentsView';
import ThreatIntelligenceView from './ThreatIntelligenceView';
import DLPView from './DLPView';

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
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
        >
            <div className="flex-1 overflow-auto p-6">
                {renderContent()}
            </div>
        </TabLayout>
    );
};

export default IAMModuleView;

