/**
 * AIPlatformModule - AI Platform Management
 *
 * Tabs: LLM Config | Intelligence | Prompts Admin | Experiments | Mission Control | Knowledge | Costs | Health
 */

import {
  Activity,
  BarChart2,
  BookOpen,
  Cpu,
  DollarSign,
  FileText,
  FlaskConical,
  HeartPulse,
  Layers,
  Radar,
  Settings,
  Shield,
  Sparkles,
} from 'lucide-react';
import React, { useState } from 'react';

import { ABTestingDashboard } from './components/ABTestingDashboard';
import { UsageAnalyticsDashboard } from './components/AI/UsageAnalyticsDashboard';
import { AICostDashboard } from './components/AICostDashboard';
import { AIMissionControl } from '../../components/Admin/AIMissionControl';
import { AIPerformanceDashboard } from './components/AIPerformanceDashboard';
import { LLMHealthPanel } from './components/LLMHealthPanel';
import { PromptManagementUI } from './components/PromptManagementUI';
import { SLADashboard } from './components/SLADashboard';
import { ModelTierAssignments } from '../../components/SuperAdmin/ModelTierAssignments';
import { SuperAdminAISettings } from '../../components/SuperAdmin/SuperAdminAISettings';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { AdminKnowledgeView } from './components/AdminKnowledgeView';
import { AIIntelligenceView } from './AIIntelligenceView';
import { AIUseCaseControlPlane } from './AIPlatformModule/Executive/AIUseCaseControlPlane';
import { LLMManagementView } from './LLMManagementView';

interface AIPlatformModuleProps {
  initialTab?: string;
}

export const AIPlatformModule: React.FC<AIPlatformModuleProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'llm-config');

  const tabs: Tab[] = [
    { id: 'operating-system', label: 'Operating System', icon: <Sparkles size={16} /> },
    { id: 'llm-config', label: 'LLM Config', icon: <Cpu size={16} /> },
    { id: 'tier-assignments', label: 'Tier Assignments', icon: <Layers size={16} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
    { id: 'intelligence', label: 'Intelligence', icon: <Sparkles size={16} /> },
    { id: 'prompts-admin', label: 'Prompts Admin', icon: <FileText size={16} /> },
    { id: 'experiments', label: 'Experiments', icon: <FlaskConical size={16} /> },
    { id: 'mission-control', label: 'Mission Control', icon: <Radar size={16} /> },
    { id: 'performance', label: 'Performance', icon: <Activity size={16} /> },
    { id: 'knowledge', label: 'Knowledge', icon: <BookOpen size={16} /> },
    { id: 'costs', label: 'Costs', icon: <DollarSign size={16} /> },
    { id: 'health', label: 'Health', icon: <HeartPulse size={16} /> },
    { id: 'sla', label: 'SLA', icon: <Shield size={16} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart2 size={16} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'operating-system':
        return <AIUseCaseControlPlane />;
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
      case 'intelligence':
        return <AIIntelligenceView />;
      case 'prompts-admin':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <PromptManagementUI />
          </div>
        );
      case 'experiments':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ABTestingDashboard />
          </div>
        );
      case 'mission-control':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <AIMissionControl />
          </div>
        );
      case 'performance':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <AIPerformanceDashboard />
          </div>
        );
      case 'knowledge':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <AdminKnowledgeView />
          </div>
        );
      case 'costs':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <AICostDashboard />
          </div>
        );
      case 'health':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <LLMHealthPanel />
          </div>
        );
      case 'sla':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <SLADashboard />
          </div>
        );
      case 'analytics':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <UsageAnalyticsDashboard />
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
      title="AI Platform"
      subtitle="LLM configuration, prompts, experiments, intelligence, and monitoring"
    >
      {renderContent()}
    </TabLayout>
  );
};

export default AIPlatformModule;
