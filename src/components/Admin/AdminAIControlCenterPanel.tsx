import { Brain, Cpu, Shield, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

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

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'settings', label: 'Governance settings' },
  { id: 'operations', label: 'AI operations' },
];

export const AdminAIControlCenterPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('settings');
  const [summary, setSummary] = useState<AiSummaryResponse | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await Api.getAdminAISummary();
        setSummary(result);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load AI summary');
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Shield className="h-4 w-4" />
            Governance level
          </div>
          <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
            {summary?.summary?.governanceSummary?.policyLevel || 'Unknown'}
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Review state: {summary?.summary?.llmPolicy?.review_state || 'n/a'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Cpu className="h-4 w-4" />
            Model posture
          </div>
          <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
            {summary?.summary?.governanceSummary?.modelCount || 0}
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Budget: {summary?.summary?.governanceSummary?.budgetStatus || 'n/a'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Brain className="h-4 w-4" />
            Context controls
          </div>
          <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
            {summary?.summary?.contextPolicy?.defaultSensitivity || 'n/a'}
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            External context{' '}
            {summary?.summary?.contextPolicy?.allowExternalContext ? 'allowed' : 'restricted'}
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
                  ? 'bg-primary-600 text-white'
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
          AI Governance & AI Operations
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Tenant AI policy, risk controls, model posture, and operational AI tooling now live inside
          the primary Admin shell.
        </p>
      </div>

      {activeTab === 'settings' ? <OrgAISettingsView /> : <AIModule initialTab="ai-health" />}
    </div>
  );
};

export default AdminAIControlCenterPanel;
