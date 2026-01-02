/**
 * SecurityModule - Security & Compliance
 * 
 * Tabs: SSO | Policies | API Keys | Compliance
 */

import React, { useState } from 'react';
import { Key, ShieldCheck, KeyRound, FileCheck } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { SSOConfigurationView } from './SSOConfigurationView';
import { SecurityPoliciesView } from './SecurityPoliciesView';
import { APIManagementView } from './APIManagementView';
import { ComplianceCenterView } from './ComplianceCenterView';

interface SecurityModuleProps {
    initialTab?: string;
}

export const SecurityModule: React.FC<SecurityModuleProps> = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'sso');

    const tabs: Tab[] = [
        { id: 'sso', label: 'SSO', icon: <Key size={16} /> },
        { id: 'policies', label: 'Policies', icon: <ShieldCheck size={16} /> },
        { id: 'api-keys', label: 'API Keys', icon: <KeyRound size={16} /> },
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
            subtitle="Authentication, access control, and compliance"
        >
            {renderContent()}
        </TabLayout>
    );
};

export default SecurityModule;



