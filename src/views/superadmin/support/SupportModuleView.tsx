/**
 * Support Module View
 * Manages support tickets and customer success
 */

import { Activity, FileText, HeadphonesIcon, Heart } from 'lucide-react';
import React, { useState } from 'react';

import { InfoButton } from '../../../components/shared/InfoButton';
import { Tab, TabLayout } from '../../../components/SuperAdmin/TabLayout';
import { useHelpSidePanel } from '../../../contexts/HelpContext';
import { CustomerHealthView } from './CustomerHealthView';
import { CustomerSuccessNotesView } from './CustomerSuccessNotesView';
import { SupportTicketsView } from './SupportTicketsView';

export const SupportModuleView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('tickets');
  const { setHelpDocumentIdOverride } = useHelpSidePanel();

  React.useEffect(() => {
    const mapping: Record<string, string> = {
      tickets: 'superadmin_support_tickets',
      'cs-notes': 'superadmin_support_cs_notes',
      health: 'superadmin_support_health',
    };
    setHelpDocumentIdOverride(mapping[activeTab] || 'superadmin_support');
    return () => setHelpDocumentIdOverride(null);
  }, [activeTab, setHelpDocumentIdOverride]);

  const infoCardId =
    activeTab === 'tickets'
      ? 'superadmin-support-tickets'
      : activeTab === 'cs-notes'
        ? 'superadmin-support-cs-notes'
        : activeTab === 'health'
          ? 'superadmin-support-health'
          : 'superadmin-support';

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
    <div className="h-full relative">
      <InfoButton cardId={infoCardId} position="top-right" />
      <TabLayout
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title="Support & Customer Success"
        subtitle="Manage support tickets, customer success notes, and health checks"
      >
        {renderContent()}
      </TabLayout>
    </div>
  );
};
