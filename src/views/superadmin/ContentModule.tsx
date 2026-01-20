/**
 * ContentModule - Content Management
 *
 * Tabs: Playbooks | Email Templates
 */

import { Layers, Mail } from 'lucide-react';
import React, { useState } from 'react';

import { InfoButton } from '../../components/shared/InfoButton';
import { EmailTemplatesPanel } from '../../components/SuperAdmin/EmailTemplatesPanel';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { PlaybookTemplatesListView } from './PlaybookTemplatesListView';

interface ContentModuleProps {
  initialTab?: string;
}

export const ContentModule: React.FC<ContentModuleProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'playbooks');

  const tabs: Tab[] = [
    { id: 'playbooks', label: 'Playbooks', icon: <Layers size={16} /> },
    { id: 'email-templates', label: 'Email Templates', icon: <Mail size={16} /> },
  ];

  const getCardId = () => {
    switch (activeTab) {
      case 'playbooks':
        return 'superadmin-playbooks';
      case 'email-templates':
        return 'superadmin-email-templates';
      default:
        return 'superadmin-playbooks';
    }
  };

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
      actions={<InfoButton cardId={getCardId()} size="sm" />}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default ContentModule;
