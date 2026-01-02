/**
 * ContentModule - Content Management
 * 
 * Tabs: Playbooks | Email Templates
 */

import React, { useState } from 'react';
import { Layers, Mail } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { PlaybookTemplatesListView } from './PlaybookTemplatesListView';
import { EmailTemplatesPanel } from '../../components/SuperAdmin/EmailTemplatesPanel';

interface ContentModuleProps {
    initialTab?: string;
}

export const ContentModule: React.FC<ContentModuleProps> = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'playbooks');

    const tabs: Tab[] = [
        { id: 'playbooks', label: 'Playbooks', icon: <Layers size={16} /> },
        { id: 'email-templates', label: 'Email Templates', icon: <Mail size={16} /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'playbooks':
                return <PlaybookTemplatesListView />;
            case 'email-templates':
                return <EmailTemplatesPanel />;
            default:
                return null;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title="Content"
            subtitle="Manage playbooks, templates, and content assets"
        >
            {renderContent()}
        </TabLayout>
    );
};

export default ContentModule;



