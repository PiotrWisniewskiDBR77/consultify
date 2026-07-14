/**
 * AIDevelopmentModule - AI Development & Testing
 *
 * Module 2 of 3: Development and testing tools
 * Tabs: Prompt Library | AI Intelligence | Experiments | Knowledge Base
 *
 * Responsibilities:
 * - Prompt management and versioning
 * - AI intelligence configuration
 * - A/B testing experiments
 * - Knowledge base administration
 */

import { BookOpen, FileText, FlaskConical, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

import { ABTestingDashboard } from './components/ABTestingDashboard';
import { PromptManagementUI } from './components/PromptManagementUI';
import { InfoButton } from '../../components/shared/InfoButton';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { AdminKnowledgeView } from './components/AdminKnowledgeView';
import { AIIntelligenceView } from './AIIntelligenceView';

interface AIDevelopmentModuleProps {
  initialTab?: string;
}

export const AIDevelopmentModule: React.FC<AIDevelopmentModuleProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'prompts');

  const tabs: Tab[] = [
    {
      id: 'prompts',
      label: 'Prompt Library',
      icon: <FileText size={16} />,
      description: 'Manage and version control prompts',
    },
    {
      id: 'intelligence',
      label: 'AI Intelligence',
      icon: <Sparkles size={16} />,
      description: 'Configure AI intelligence systems',
    },
    {
      id: 'experiments',
      label: 'Experiments',
      icon: <FlaskConical size={16} />,
      description: 'A/B testing and experiments',
    },
    {
      id: 'knowledge',
      label: 'Knowledge Base',
      icon: <BookOpen size={16} />,
      description: 'Manage AI knowledge sources',
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'prompts':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <PromptManagementUI />
          </div>
        );
      case 'intelligence':
        return <AIIntelligenceView />;
      case 'experiments':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ABTestingDashboard />
          </div>
        );
      case 'knowledge':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <AdminKnowledgeView />
          </div>
        );
      default:
        return null;
    }
  };

  // Map tab IDs to help card IDs
  const getHelpCardId = () => {
    switch (activeTab) {
      case 'prompts':
        return 'superadmin-prompt-library';
      case 'intelligence':
        return 'superadmin-ai-intelligence';
      case 'experiments':
        return 'superadmin-ai-experiments';
      case 'knowledge':
        return 'superadmin-ai-knowledge-base';
      default:
        return 'superadmin-ai-development';
    }
  };

  return (
    <div className="relative h-full">
      <InfoButton cardId={getHelpCardId()} position="top-right" />
      <TabLayout
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title="AI Development"
        subtitle="Prompt library, intelligence configuration, experiments, and knowledge base"
      >
        {renderContent()}
      </TabLayout>
    </div>
  );
};

export default AIDevelopmentModule;
