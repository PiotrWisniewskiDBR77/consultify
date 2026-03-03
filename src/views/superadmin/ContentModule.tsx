/**
 * ContentModule - Content Management
 *
 * Tabs: Playbooks | Email Templates
 */

import { Layers, Mail, Megaphone } from 'lucide-react';
import React, { useState } from 'react';

import { InfoButton } from '../../components/shared/InfoButton';
import { PartnerOutreachPanel } from '../../components/SuperAdmin/PartnerOutreachPanel';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { EmailTemplatesView } from './EmailTemplatesView';
import { PlaybookTemplatesListView } from './PlaybookTemplatesListView';

interface ContentModuleProps {
  initialTab?: string;
}

export const ContentModule: React.FC<ContentModuleProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'playbooks');

  const tabs: Tab[] = [
    { id: 'playbooks', label: 'Playbooks', icon: <Layers size={16} /> },
    { id: 'email-templates', label: 'Email Templates', icon: <Mail size={16} /> },
    { id: 'partner-outreach', label: 'Partner Outreach', icon: <Megaphone size={16} /> },
  ];

  const getCardId = () => {
    switch (activeTab) {
      case 'playbooks':
        return 'superadmin-content-playbooks';
      case 'email-templates':
        return 'superadmin-content-email-templates';
      case 'partner-outreach':
        return 'superadmin-content-partner-outreach';
      default:
        return 'superadmin-content-playbooks';
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'playbooks':
        return <PlaybookTemplatesListView />;
      case 'email-templates':
        return <EmailTemplatesView />;
      case 'partner-outreach':
        return <PartnerOutreachPanel />;
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
