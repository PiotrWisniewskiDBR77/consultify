/**
 * AIModule - AI & LLM Management
 *
 * Tabs: LLM Config | AI Health | Help Analytics | Token Management
 */

import { Blocks, Coins, Cpu, Gauge, HeartPulse, HelpCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { ChatV10RuntimesPanel } from '../../components/Admin/ChatV10RuntimesPanel';
import { AIMissionControl } from '../../components/Admin/AIMissionControl';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { AdminLLMView } from './AdminLLMView';
import { HelpAnalyticsDashboard } from './HelpAnalyticsDashboard';
import { OnboardingKpiDashboardView } from './OnboardingKpiDashboardView';
import { TokenBillingManagementView } from './TokenBillingManagementView';

interface AIModuleProps {
  initialTab?: string;
}

export const AIModule: React.FC<AIModuleProps> = ({ initialTab }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const queryTab = new URLSearchParams(location.search).get('tab') || undefined;
  const [activeTab, setActiveTab] = useState(queryTab || initialTab || 'llm-config');

  useEffect(() => {
    if (queryTab) {
      setActiveTab(queryTab);
      return;
    }
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab, queryTab]);

  const tabs: Tab[] = [
    {
      id: 'llm-config',
      label: t('admin.tabs.llmConfig', 'LLM Config'),
      icon: <Cpu size={16} />,
    },
    {
      id: 'chat-v10',
      label: t('admin.tabs.chatV10', 'Chat V10'),
      icon: <Blocks size={16} />,
    },
    {
      id: 'onboarding-kpis',
      label: t('admin.tabs.onboardingKpis', 'Onboarding KPI'),
      icon: <Gauge size={16} />,
    },
    {
      id: 'ai-health',
      label: t('admin.tabs.aiHealth', 'AI Health'),
      icon: <HeartPulse size={16} />,
    },
    {
      id: 'help-analytics',
      label: t('admin.tabs.helpAnalytics', 'Help Analytics'),
      icon: <HelpCircle size={16} />,
    },
    {
      id: 'token-management',
      label: t('admin.tabs.tokenManagement', 'Tokens'),
      icon: <Coins size={16} />,
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'llm-config':
        return <AdminLLMView />;
      case 'chat-v10':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ChatV10RuntimesPanel />
          </div>
        );
      case 'onboarding-kpis':
        return (
          <div className="overflow-y-auto h-full">
            <OnboardingKpiDashboardView />
          </div>
        );
      case 'ai-health':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <AIMissionControl />
          </div>
        );
      case 'help-analytics':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <HelpAnalyticsDashboard />
          </div>
        );
      case 'token-management':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <TokenBillingManagementView />
          </div>
        );
      default:
        return <AdminLLMView />;
    }
  };

  return (
    <TabLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title={t('admin.modules.ai', 'AI')}
      subtitle={t(
        'admin.modules.aiDesc',
        'LLM configuration, health monitoring, and token management'
      )}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default AIModule;
