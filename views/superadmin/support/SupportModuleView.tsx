/**
 * Support Module View
 * Manages support tickets and customer success
 */

import React, { useState } from 'react';
import { HeadphonesIcon, FileText, Heart, Activity } from 'lucide-react';
import { TabLayout, Tab } from '../../../components/SuperAdmin/TabLayout';
import { SupportTicketsView } from './SupportTicketsView';
import { CustomerSuccessNotesView } from './CustomerSuccessNotesView';
import { CustomerHealthView } from './CustomerHealthView';

export const SupportModuleView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('tickets');

    const tabs: Tab[] = [
        { id: 'tickets', label: 'Support Tickets', icon: <HeadphonesIcon size={16} /> },
        { id: 'cs-notes', label: 'CS Notes', icon: <FileText size={16} /> },
        { id: 'health', label: 'Customer Health', icon: <Activity size={16} /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'tickets':
                return <SupportTicketsView />;
            case 'cs-notes':
                return <CustomerSuccessNotesView />;
            case 'health':
                return <CustomerHealthView />;
            default:
                return null;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title="Support & Customer Success"
            subtitle="Manage support tickets, customer success notes, and health checks"
        >
            {renderContent()}
        </TabLayout>
    );
};

