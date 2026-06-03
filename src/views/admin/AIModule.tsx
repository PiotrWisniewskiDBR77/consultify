/**
 * AIModule - AI & LLM Management
 *
 * Tabs: LLM Config | AI Health | Access & Limits | Policy & Governance |
 *       Models & Providers | Features & Privacy | Audit & Compliance |
 *       Help Analytics | Token Management
 */

import {
  Coins,
  Cpu,
  FileSearch,
  HeartPulse,
  HelpCircle,
  ServerCog,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AccessLimitsTab,
  AuditComplianceTab,
  FeaturesPrivacyTab,
  ModelsProvidersTab,
  PolicyGovernanceTab,
} from '../../components/Admin/AI';
import { AIMissionControl } from '../../components/Admin/AIMissionControl';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { useAppStore } from '../../store/useAppStore';
import { AdminLLMView } from './AdminLLMView';
import { HelpAnalyticsDashboard } from './HelpAnalyticsDashboard';
import { TokenBillingManagementView } from './TokenBillingManagementView';

interface AIModuleProps {
  initialTab?: string;
}

export const AIModule: React.FC<AIModuleProps> = ({ initialTab }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab || 'llm-config');
  const organizationId = useAppStore(
    (s) => s.currentOrganization?.id || (s.currentUser as any)?.organizationId || ''
  );

  const tabs: Tab[] = [
    {
      id: 'llm-config',
      label: t('admin.tabs.llmConfig', 'LLM Config'),
      icon: <Cpu size={16} />,
    },
    {
      id: 'access-limits',
      label: t('admin.tabs.accessLimits', 'Access & Limits'),
      icon: <UserCog size={16} />,
    },
    {
      id: 'policy-governance',
      label: t('admin.tabs.policyGovernance', 'Policy & Governance'),
      icon: <ShieldCheck size={16} />,
    },
    {
      id: 'models-providers',
      label: t('admin.tabs.modelsProviders', 'Models & Providers'),
      icon: <ServerCog size={16} />,
    },
    {
      id: 'features-privacy',
      label: t('admin.tabs.featuresPrivacy', 'Features & Privacy'),
      icon: <SlidersHorizontal size={16} />,
    },
    {
      id: 'audit-compliance',
      label: t('admin.tabs.auditCompliance', 'Audit & Compliance'),
      icon: <FileSearch size={16} />,
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
      case 'access-limits':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <AccessLimitsTab />
          </div>
        );
      case 'policy-governance':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <PolicyGovernanceTab />
          </div>
        );
      case 'models-providers':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ModelsProvidersTab organizationId={organizationId} />
          </div>
        );
      case 'features-privacy':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <FeaturesPrivacyTab />
          </div>
        );
      case 'audit-compliance':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <AuditComplianceTab />
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
        'LLM configuration, access governance, model providers, and token management'
      )}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default AIModule;
