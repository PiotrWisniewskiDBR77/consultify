/**
 * AIOperationsModule - AI Operations & Analytics
 *
 * Module 3 of 3: Operations and analytics
 * Tabs: Mission Control | Performance | Costs | SLA | Analytics
 *
 * Responsibilities:
 * - Real-time AI operations monitoring
 * - Performance dashboards
 * - Cost management and budgets
 * - SLA monitoring and compliance
 * - Usage analytics and insights
 */

import { Activity, BarChart2, Braces, DollarSign, List, Radar, Shield } from 'lucide-react';
import React, { useState } from 'react';

import { ChatTracesViewer } from '../../components/Admin/AI/ChatTracesViewer';
import { PromptOsRuntimeSummaryPanel } from './components/AI/PromptOsRuntimeSummaryPanel';
import { UsageAnalyticsDashboard } from './components/AI/UsageAnalyticsDashboard';
import { AICostDashboard } from './components/AICostDashboard';
import { AIMissionControl } from '../../components/Admin/AIMissionControl';
import { AIPerformanceDashboard } from './components/AIPerformanceDashboard';
import { SLADashboard } from './components/SLADashboard';
import { InfoButton } from '../../components/shared/InfoButton';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';

interface AIOperationsModuleProps {
  initialTab?: string;
}

export const AIOperationsModule: React.FC<AIOperationsModuleProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'mission-control');

  const tabs: Tab[] = [
    {
      id: 'mission-control',
      label: 'Mission Control',
      icon: <Radar size={16} />,
      description: 'Real-time AI operations dashboard',
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: <Activity size={16} />,
      description: 'AI performance metrics and trends',
    },
    {
      id: 'costs',
      label: 'Costs',
      icon: <DollarSign size={16} />,
      description: 'Token usage and cost management',
    },
    {
      id: 'sla',
      label: 'SLA',
      icon: <Shield size={16} />,
      description: 'Service level agreements monitoring',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart2 size={16} />,
      description: 'Usage analytics and insights',
    },
    {
      id: 'traces',
      label: 'Traces',
      icon: <List size={16} />,
      description: 'Per-run chat traces & basic evals',
    },
    {
      id: 'prompt-os-runtime',
      label: 'Prompt OS runtime',
      icon: <Braces size={16} />,
      description: 'Read-only V8 Prompt OS runtime summary',
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
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
      case 'costs':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <AICostDashboard />
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
      case 'traces':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ChatTracesViewer />
          </div>
        );
      case 'prompt-os-runtime':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <PromptOsRuntimeSummaryPanel />
          </div>
        );
      default:
        return null;
    }
  };

  // Get card ID based on active tab for contextual help
  const getHelpCardId = () => {
    switch (activeTab) {
      case 'mission-control':
        return 'superadmin-ai-mission-control';
      case 'performance':
        return 'superadmin-ai-performance';
      case 'costs':
        return 'superadmin-ai-costs';
      case 'sla':
        return 'superadmin-ai-sla';
      case 'analytics':
        return 'superadmin-ai-analytics';
      case 'traces':
        return 'superadmin-ai-traces';
      case 'prompt-os-runtime':
        return 'superadmin-ai-operations';
      default:
        return 'superadmin-ai-operations';
    }
  };

  return (
    <TabLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="AI Operations"
      subtitle="Mission control, performance monitoring, costs, SLA, and analytics"
      actions={<InfoButton cardId={getHelpCardId()} />}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default AIOperationsModule;
