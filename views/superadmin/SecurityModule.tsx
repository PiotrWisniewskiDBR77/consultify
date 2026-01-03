/**
 * SecurityModule - Security & Compliance
 * 
 * Enterprise Security Features:
 * - SSO (Google, Azure AD, SAML)
 * - SCIM 2.0 Provisioning
 * - Security Policies
 * - API Keys Management
 * - Custom Roles (RBAC)
 * - AI Budget Controls
 * - Compliance Center
 * - Advanced IAM (Admin Sessions, Audit Logs, Permissions, Workflows)
 */

import React, { useState } from 'react';
import { Key, ShieldCheck, KeyRound, FileCheck, Users, DollarSign, Shield, Link2, UserCog, History, GitBranch, AlertTriangle } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { SSOConfigurationView } from './SSOConfigurationView';
import { SecurityPoliciesView } from './SecurityPoliciesView';
import { APIManagementView } from './APIManagementView';
import { ComplianceCenterView } from './ComplianceCenterView';
import SCIMProvisioningView from './SCIMProvisioningView';
import CustomRolesBuilder from './CustomRolesBuilder';
import AIBudgetsView from './AIBudgetsView';
// Advanced IAM Module
import AdminSessionsView from './iam/AdminSessionsView';
import AdminAuditLogsView from './iam/AdminAuditLogsView';
import PermissionsMatrixView from './iam/PermissionsMatrixView';
import ApprovalWorkflowsView from './iam/ApprovalWorkflowsView';

interface SecurityModuleProps {
    initialTab?: string;
}

export const SecurityModule: React.FC<SecurityModuleProps> = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'sso');

    const tabs: Tab[] = [
        { id: 'sso', label: 'SSO', icon: <Key size={16} /> },
        { id: 'scim', label: 'SCIM', icon: <Link2 size={16} /> },
        { id: 'roles', label: 'Roles', icon: <Shield size={16} /> },
        { id: 'permissions', label: 'Permissions', icon: <KeyRound size={16} /> },
        { id: 'policies', label: 'Policies', icon: <ShieldCheck size={16} /> },
        { id: 'api-keys', label: 'API Keys', icon: <KeyRound size={16} /> },
        { id: 'sessions', label: 'Admin Sessions', icon: <UserCog size={16} /> },
        { id: 'audit', label: 'Audit Logs', icon: <History size={16} /> },
        { id: 'workflows', label: 'Workflows', icon: <GitBranch size={16} /> },
        { id: 'ai-budgets', label: 'AI Budgets', icon: <DollarSign size={16} /> },
        { id: 'compliance', label: 'Compliance', icon: <FileCheck size={16} /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'sso':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <SSOConfigurationView />
                    </div>
                );
            case 'scim':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <SCIMProvisioningView />
                    </div>
                );
            case 'roles':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <CustomRolesBuilder />
                    </div>
                );
            case 'permissions':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <PermissionsMatrixView />
                    </div>
                );
            case 'policies':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <SecurityPoliciesView />
                    </div>
                );
            case 'api-keys':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <APIManagementView />
                    </div>
                );
            case 'sessions':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AdminSessionsView />
                    </div>
                );
            case 'audit':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AdminAuditLogsView />
                    </div>
                );
            case 'workflows':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <ApprovalWorkflowsView />
                    </div>
                );
            case 'ai-budgets':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AIBudgetsView />
                    </div>
                );
            case 'compliance':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <ComplianceCenterView />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title="Security"
            subtitle="Enterprise security, access control, and compliance"
        >
            {renderContent()}
        </TabLayout>
    );
};

export default SecurityModule;



