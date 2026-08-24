import { Brain, Cpu, Shield, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { cn } from '../../utils/cn';
import { AIModule } from '../../views/admin/AIModule';
import { OrgAISettingsView } from '../../views/admin/OrgAISettingsView';

type AiSummaryResponse = {
  summary?: {
    governanceSummary?: {
      policyLevel?: string;
      modelCount?: number;
      budgetStatus?: string;
    };
    llmPolicy?: { review_state?: string; mode?: string };
    contextPolicy?: { allowExternalContext?: boolean; defaultSensitivity?: string };
  };
};

type TabId = 'settings' | 'operations';

interface AdminAIControlCenterPanelProps {
  // Admin komplet 55, Fala 1 — AIModule (rendered under the "operations" tab)
  // has 9 tabs of its own (llm-config, access-limits, policy-governance,
  // models-providers, features-privacy, audit-compliance, ai-health,
  // help-analytics, token-management). AdminSettingsModule passes one of
  // those ids for its WIRE_ONLY AI screens (models-providers,
  // ai-limits-budgets, data-privacy, ai-operations, ai-audit); when set, the
  // panel opens straight into "AI operations" on that tab instead of
  // defaulting to "Governance settings".
  initialAiModuleTab?: string;
}

export const AdminAIControlCenterPanel: React.FC<AdminAIControlCenterPanelProps> = ({
  initialAiModuleTab,
}) => {
  const { t } = useTranslation();
  const tabs: Array<{ id: TabId; label: string }> = [
    {
      id: 'settings',
      label: t('admin.aiControlCenter.panel.tabs.settings', 'Governance settings'),
    },
    { id: 'operations', label: t('admin.aiControlCenter.panel.tabs.operations', 'AI operations') },
  ];
  const [activeTab, setActiveTab] = useState<TabId>(initialAiModuleTab ? 'operations' : 'settings');
  const [summary, setSummary] = useState<AiSummaryResponse | null>(null);

  useEffect(() => {
    if (initialAiModuleTab) setActiveTab('operations');
  }, [initialAiModuleTab]);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await Api.getAdminAISummary();
        setSummary(result);
      } catch (error: any) {
        toast.error(
          error?.message ||
            t('admin.aiControlCenter.panel.errors.loadSummary', 'Failed to load AI summary')
        );
      }
    };

    void load();
  }, [t]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Shield className="h-4 w-4" />
            {t('admin.aiControlCenter.panel.governanceLevel', 'Governance level')}
          </div>
          <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
            {summary?.summary?.governanceSummary?.policyLevel ||
              t('admin.aiControlCenter.panel.unknown', 'Unknown')}
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {t('admin.aiControlCenter.panel.reviewState', 'Review state: {{state}}', {
              state:
                summary?.summary?.llmPolicy?.review_state ||
                t('admin.aiControlCenter.panel.notAvailable', 'n/a'),
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Cpu className="h-4 w-4" />
            {t('admin.aiControlCenter.panel.modelPosture', 'Model posture')}
          </div>
          <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
            {summary?.summary?.governanceSummary?.modelCount || 0}
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {t('admin.aiControlCenter.panel.budget', 'Budget: {{status}}', {
              status:
                summary?.summary?.governanceSummary?.budgetStatus ||
                t('admin.aiControlCenter.panel.notAvailable', 'n/a'),
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Brain className="h-4 w-4" />
            {t('admin.aiControlCenter.panel.contextControls', 'Context controls')}
          </div>
          <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
            {summary?.summary?.contextPolicy?.defaultSensitivity ||
              t('admin.aiControlCenter.panel.notAvailable', 'n/a')}
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {summary?.summary?.contextPolicy?.allowExternalContext
              ? t('admin.aiControlCenter.panel.externalContextAllowed', 'External context allowed')
              : t(
                  'admin.aiControlCenter.panel.externalContextRestricted',
                  'External context restricted'
                )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition',
                activeTab === tab.id
                  ? 'bg-c-text text-c-bg'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Sparkles className="h-5 w-5 text-primary-500" />
          {t('admin.aiControlCenter.panel.title', 'AI Governance & AI Operations')}
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {t(
            'admin.aiControlCenter.panel.description',
            'Tenant AI policy, risk controls, model posture, and operational AI tooling now live inside the primary Admin shell.'
          )}
        </p>
      </div>

      {activeTab === 'settings' ? (
        <OrgAISettingsView />
      ) : (
        <AIModule initialTab={initialAiModuleTab || 'ai-health'} />
      )}
    </div>
  );
};

export default AdminAIControlCenterPanel;
