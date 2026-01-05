/**
 * ConfigurationModule - Platform Configuration
 *
 * Tabs: Settings | White-label | Legal
 */

import { Palette, Scale, Settings } from 'lucide-react';
import React, { useState } from 'react';

import { LegalPanel } from '../../components/SuperAdmin/LegalPanel';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { SystemSettings } from './SystemSettings';
import { WhitelabelStudioView } from './WhitelabelStudioView';

interface ConfigurationModuleProps {
    initialTab?: string;
}

export const ConfigurationModule: React.FC<ConfigurationModuleProps> = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'settings');

    const tabs: Tab[] = [
        { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
        { id: 'whitelabel', label: 'White-label', icon: <Palette size={16} /> },
        { id: 'legal', label: 'Legal', icon: <Scale size={16} /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'settings':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <SystemSettings />
                    </div>
                );
            case 'whitelabel':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <WhitelabelStudioView />
                    </div>
                );
            case 'legal':
                return <LegalPanel />;
            default:
                return null;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title="Configuration"
            subtitle="Platform settings, branding, and legal documents"
        >
            {renderContent()}
        </TabLayout>
    );
};

export default ConfigurationModule;





