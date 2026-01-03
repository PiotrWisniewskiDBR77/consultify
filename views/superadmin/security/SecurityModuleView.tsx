/**
 * Security Module View
 * Manages IP whitelisting, device management, MFA, password policies, and security events
 */

import React, { useState, useEffect } from 'react';
import { Shield, Key, Smartphone, Lock, AlertTriangle } from 'lucide-react';
import { TabLayout, Tab } from '../../../components/SuperAdmin/TabLayout';
import { Api } from '../../../services/api';
import { IPWhitelistView } from './IPWhitelistView';
import { DeviceManagementView } from './DeviceManagementView';
import { MFAView } from './MFAView';
import { PasswordPolicyView } from './PasswordPolicyView';
import { SecurityEventsView } from './SecurityEventsView';

export const SecurityModuleView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('ip-whitelist');

    const tabs: Tab[] = [
        { id: 'ip-whitelist', label: 'IP Whitelist', icon: <Shield size={16} /> },
        { id: 'devices', label: 'Devices', icon: <Smartphone size={16} /> },
        { id: 'mfa', label: 'MFA', icon: <Key size={16} /> },
        { id: 'password-policy', label: 'Password Policy', icon: <Lock size={16} /> },
        { id: 'security-events', label: 'Security Events', icon: <AlertTriangle size={16} /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'ip-whitelist':
                return <IPWhitelistView />;
            case 'devices':
                return <DeviceManagementView />;
            case 'mfa':
                return <MFAView />;
            case 'password-policy':
                return <PasswordPolicyView />;
            case 'security-events':
                return <SecurityEventsView />;
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
            subtitle="Manage security settings, IP whitelisting, devices, MFA, and monitor security events"
        >
            {renderContent()}
        </TabLayout>
    );
};

