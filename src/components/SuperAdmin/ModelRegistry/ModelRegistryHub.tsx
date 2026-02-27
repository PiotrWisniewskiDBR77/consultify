import {
  Clock,
  Database,
  DollarSign,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../../services/funnelAnalytics';
import { ModelAuditLog } from './ModelAuditLog';
import { ModelCatalogTable } from './ModelCatalogTable';
import { PricingPanel } from './PricingPanel';
import { PurposeAssignmentsEditor } from './PurposeAssignmentsEditor';

type RegistryTab = 'catalog' | 'text_llm' | 'image_model' | 'business_model' | 'pricing' | 'audit';

interface TabConfig {
  id: RegistryTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { id: 'catalog', label: 'Catalog', icon: <Database size={16} /> },
  { id: 'text_llm', label: 'TEXT_LLM', icon: <MessageSquare size={16} /> },
  { id: 'image_model', label: 'IMAGE_MODEL', icon: <ImageIcon size={16} /> },
  { id: 'business_model', label: 'BUSINESS_MODEL', icon: <Sparkles size={16} /> },
  { id: 'pricing', label: 'Pricing', icon: <DollarSign size={16} /> },
  { id: 'audit', label: 'Audit Log', icon: <Clock size={16} /> },
];

export const ModelRegistryHub: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<RegistryTab>('catalog');

  const handleTabChange = (tab: RegistryTab) => {
    setActiveTab(tab);
    trackFunnelEvent('model_registry_viewed' as any, { tab });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'catalog':
        return <ModelCatalogTable />;
      case 'text_llm':
        return <PurposeAssignmentsEditor kind="TEXT_LLM" />;
      case 'image_model':
        return <PurposeAssignmentsEditor kind="IMAGE_MODEL" />;
      case 'business_model':
        return <PurposeAssignmentsEditor kind="BUSINESS_MODEL" />;
      case 'pricing':
        return <PricingPanel />;
      case 'audit':
        return <ModelAuditLog />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950 overflow-hidden">
      {/* Tab bar */}
      <div className="shrink-0 px-6 py-2 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-800 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap
              rounded-lg transition-all duration-200
              ${
                activeTab === tab.id
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-navy-800 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/50'
              }
            `}
          >
            <span className={activeTab === tab.id ? 'text-indigo-500' : ''}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">{renderContent()}</div>
    </div>
  );
};

export default ModelRegistryHub;
