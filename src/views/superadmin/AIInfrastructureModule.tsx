/**
 * AIInfrastructureModule - AI Infrastructure & Configuration
 *
 * Module 1 of 3: Infrastructure management
 * Tabs: LLM Config | Tier Assignments | Global Settings | Health Monitoring
 *
 * Responsibilities:
 * - LLM provider configuration (API keys, endpoints)
 * - Model tier assignments (speed, balanced, quality)
 * - Global AI settings (superadmin level)
 * - Health monitoring and alerts
 */

import { Cpu, HeartPulse, Layers, Settings } from 'lucide-react';
import React, { useState } from 'react';

import { ModelTierAssignments } from '../../components/SuperAdmin/ModelTierAssignments';
import { SuperAdminAISettings } from '../../components/SuperAdmin/SuperAdminAISettings';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { LLMHealthPanel } from './components/LLMHealthPanel';
import { LLMManagementView } from './LLMManagementView';

interface AIInfrastructureModuleProps {
  initialTab?: string;
}

export const AIInfrastructureModule: React.FC<AIInfrastructureModuleProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'llm-config');

  const tabs: Tab[] = [
    {
      id: 'llm-config',
      label: 'LLM Providers',
      icon: <Cpu size={16} />,
      description: 'Configure LLM providers and API keys',
    },
    {
      id: 'tier-assignments',
      label: 'Model Tiers',
      icon: <Layers size={16} />,
      description: 'Assign models to performance tiers',
    },
    {
      id: 'settings',
      label: 'Global Settings',
      icon: <Settings size={16} />,
      description: 'System-wide AI configuration',
    },
    {
      id: 'health',
      label: 'Health Monitoring',
      icon: <HeartPulse size={16} />,
      description: 'Monitor provider health and alerts',
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'llm-config':
        return <LLMManagementView />;
      case 'tier-assignments':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ModelTierAssignments />
          </div>
        );
      case 'settings':
        return <SuperAdminAISettings />;
      case 'health':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <LLMHealthPanel />
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
      title="AI Infrastructure"
      subtitle="LLM providers, model tiers, global settings, and health monitoring"
    >
      {renderContent()}
    </TabLayout>
  );
};

export default AIInfrastructureModule;
