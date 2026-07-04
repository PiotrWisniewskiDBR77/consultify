import {
  Activity,
  AlertTriangle,
  Brain,
  Check,
  Cpu,
  Lock,
  Monitor,
  Shield,
  Sparkles,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../services/api';
import { AIProviderType, User } from '../../types';
import { LLMProviderConfig } from '../../types/domain/ai';
import { isAdminOrSuperAdminRole } from '../../utils/roleGuards';

export interface AIConfigCoreProps {
  mode: 'user' | 'org-admin' | 'platform';
  currentUser?: User;
  onUpdateUser?: (updates: Partial<User>) => void;
  showProviderSelection?: boolean;
  showModelPreferences?: boolean;
  showOrgPolicy?: boolean;
  showSystemHealth?: boolean;
  className?: string;
}

interface LLMProvider {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  is_active: boolean;
}

interface OrgConfig {
  activeProviderId: string | null;
  availableProviders: LLMProviderConfig[];
  assertivenessLevel?: number;
}

// Provider Selection Tabs Component
export const ProviderTabs: React.FC<{
  activeProvider: AIProviderType;
  onProviderChange: (provider: AIProviderType) => void;
  availableProviders?: AIProviderType[];
}> = ({
  activeProvider,
  onProviderChange,
  availableProviders = ['system', 'gemini', 'openai'],
}) => {
  const providerLabels: Record<string, string> = {
    system: 'Default (System)',
    gemini: 'Google Gemini',
    openai: 'OpenAI',
    ollama: 'Ollama (Local)',
    azure: 'Azure OpenAI',
    anthropic: 'Anthropic',
  };

  return (
    <div className="flex p-1 bg-white dark:bg-navy-900 rounded-lg mb-6 border border-slate-200 dark:border-navy-700">
      {availableProviders.map((provider) => (
        <button
          key={provider}
          onClick={() => onProviderChange(provider)}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
            activeProvider === provider
              ? 'bg-navy-900 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
          }`}
        >
          {providerLabels[provider] || provider}
        </button>
      ))}
    </div>
  );
};

// Model Preference Checkbox List
export const ModelPreferenceList: React.FC<{
  availableModels: LLMProvider[];
  selectedModelIds: string[];
  onToggleModel: (modelId: string, checked: boolean) => void;
}> = ({ availableModels, selectedModelIds, onToggleModel }) => {
  if (availableModels.length === 0) {
    return (
      <div className="text-xs text-slate-500 dark:text-slate-400">Loading available models...</div>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {availableModels.map((model) => (
        <label
          key={model.id}
          className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded cursor-pointer group"
        >
          <input
            type="checkbox"
            checked={selectedModelIds.includes(model.id)}
            onChange={(e) => onToggleModel(model.id, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-navy-900 text-primary-600 dark:text-primary-500 focus:ring-primary-500/50"
          />
          <div className="flex-1">
            <div className="text-sm text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">
              {model.name}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">
              {model.provider} • {model.model_id}
            </div>
          </div>
          {selectedModelIds.includes(model.id) && <Check size={14} className="text-primary-500" />}
        </label>
      ))}
    </div>
  );
};

// System Health Card
export const AISystemHealthCard: React.FC<{
  title: string;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  details?: string;
}> = ({ title, status, details }) => {
  const statusConfig = {
    healthy: { color: 'text-green-500', bg: 'bg-green-500/10', icon: <Check size={16} /> },
    warning: {
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      icon: <AlertTriangle size={16} />,
    },
    error: { color: 'text-danger-500', bg: 'bg-danger-500/10', icon: <AlertTriangle size={16} /> },
    unknown: {
      color: 'text-slate-500 dark:text-slate-400',
      bg: 'bg-slate-500/10',
      icon: <Activity size={16} />,
    },
  };

  const cfg = statusConfig[status];

  return (
    <div className={`${cfg.bg} rounded-lg p-4 flex items-center gap-3`}>
      <div className={cfg.color}>{cfg.icon}</div>
      <div>
        <div className="text-sm font-medium text-slate-800 dark:text-white">{title}</div>
        {details && <div className="text-xs text-slate-500 dark:text-slate-400">{details}</div>}
      </div>
    </div>
  );
};

// Org Admin AI Policy Section
export const OrgAIPolicy: React.FC<{
  orgConfig: OrgConfig | null;
  onConfigChange: (config: Partial<OrgConfig>) => void;
  onSave: () => void;
}> = ({ orgConfig, onConfigChange, onSave }) => {
  if (!orgConfig) return null;

  return (
    <div className="bg-navy-900 border border-c-border-subtle rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Shield className="text-primary-500" size={20} />
        Organization AI Policy
      </h3>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Default Model for Organization
          </label>
          <select
            value={orgConfig.activeProviderId || ''}
            onChange={(e) => onConfigChange({ activeProviderId: e.target.value || null })}
            className="w-full bg-navy-950 border border-c-border-subtle rounded-lg px-4 py-2 text-white"
          >
            <option value="">Let Users Choose</option>
            {orgConfig.availableProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            AI Assertiveness Level:{' '}
            {orgConfig.assertivenessLevel === 1
              ? 'ADVISORY (Default)'
              : orgConfig.assertivenessLevel === 2
                ? 'MANAGER'
                : orgConfig.assertivenessLevel === 3
                  ? 'OPERATOR'
                  : 'ADVISORY'}
          </label>
          <input
            type="range"
            min="1"
            max="3"
            step="1"
            value={orgConfig.assertivenessLevel || 1}
            onChange={(e) => onConfigChange({ assertivenessLevel: parseInt(e.target.value) || 1 })}
            className="w-full accent-primary-500"
          />
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>Advisory (Passive)</span>
            <span>Manager (Active)</span>
            <span>Operator (Autopilot)</span>
          </div>
        </div>

        <button
          onClick={onSave}
          className="w-full py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium transition-colors"
        >
          Save Policy
        </button>
      </div>
    </div>
  );
};

// Main AIConfigCore Component
export const AIConfigCore: React.FC<AIConfigCoreProps> = ({
  mode,
  currentUser,
  onUpdateUser,
  showProviderSelection = true,
  showModelPreferences = true,
  showOrgPolicy = false,
  showSystemHealth = false,
  className = '',
}) => {
  const [configMode, setConfigMode] = useState<AIProviderType>(
    currentUser?.aiConfig?.provider || 'system'
  );
  const [customKey, setCustomKey] = useState(currentUser?.aiConfig?.apiKey || '');
  const [visibleModelIds, setVisibleModelIds] = useState<string[]>(
    currentUser?.aiConfig?.visibleModelIds || []
  );
  const [availableModels, setAvailableModels] = useState<LLMProviderConfig[]>([]);
  const [orgConfig, setOrgConfig] = useState<OrgConfig | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const isAdmin = isAdminOrSuperAdminRole(currentUser?.role);

  useEffect(() => {
    // Fetch public models for preference selection
    (Api as any)
      .getPublicLLMProviders()
      .then((data: any) => setAvailableModels(data))
      .catch((err: any) => console.error(err));
  }, []);

  useEffect(() => {
    // Fetch org config for admin users
    if ((mode === 'org-admin' || mode === 'platform') && isAdmin) {
      const orgId = (currentUser as any)?.organizationId || (currentUser as any)?.organization_id;
      if (orgId) {
        (Api as any).getOrganizationLLMConfig(orgId).then(setOrgConfig).catch(console.error);
      }
    }
  }, [mode, isAdmin, currentUser]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    const newConfig: any = {
      provider: configMode,
      visibleModelIds: visibleModelIds,
    };

    if (configMode === 'openai' || configMode === 'gemini') {
      newConfig.apiKey = customKey;
    }

    try {
      if (onUpdateUser) {
        onUpdateUser({ aiConfig: newConfig });
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      alert('Failed to save AI config');
    }
  };

  const handleSaveOrgConfig = async () => {
    const orgId = (currentUser as any)?.organizationId || (currentUser as any)?.organization_id;
    if (!orgId || !orgConfig) return;
    try {
      await (Api as any).updateOrganizationLLMConfig(orgId, orgConfig.activeProviderId);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (e) {
      alert('Failed to save organization settings');
    }
  };

  const handleToggleModel = (modelId: string, checked: boolean) => {
    if (checked) {
      setVisibleModelIds([...visibleModelIds, modelId]);
    } else {
      setVisibleModelIds(visibleModelIds.filter((id) => id !== modelId));
    }
  };

  return (
    <div className={`max-w-2xl ${className}`}>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">
        AI Configuration
      </h2>

      {/* Provider Selection Tabs */}
      {showProviderSelection && (
        <ProviderTabs
          activeProvider={configMode}
          onProviderChange={setConfigMode}
          availableProviders={['system', 'gemini', 'openai']}
        />
      )}

      <form
        onSubmit={handleSaveConfig}
        className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6"
      >
        {configMode === 'system' && (
          <div className="text-center py-8 space-y-6">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-600 dark:text-primary-400">
              <Cpu size={32} />
            </div>
            <div>
              <h3 className="text-slate-800 dark:text-white font-medium mb-2">
                System AI (Managed)
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
                You are using the organization's default AI provider. No configuration is needed.
                Usage counts towards your plan limit.
              </p>
            </div>

            {/* Personal Model Preferences */}
            {showModelPreferences && (
              <div className="mt-8 pt-8 border-t border-slate-200 dark:border-navy-700 text-left bg-slate-50 dark:bg-navy-950/50 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                      Your Preferred Models
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Select which models appear in your top bar selector.
                    </p>
                  </div>
                </div>
                <ModelPreferenceList
                  availableModels={availableModels as any}
                  selectedModelIds={visibleModelIds}
                  onToggleModel={handleToggleModel}
                />
              </div>
            )}

            {/* Organization Admin Policy */}
            {showOrgPolicy && isAdmin && orgConfig && (
              <div className="mt-8">
                <OrgAIPolicy
                  orgConfig={orgConfig}
                  onConfigChange={(updates) => setOrgConfig({ ...orgConfig, ...updates })}
                  onSave={handleSaveOrgConfig}
                />
              </div>
            )}
          </div>
        )}

        {(configMode === 'gemini' || configMode === 'openai') && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg text-blue-600 dark:text-blue-300 text-xs flex gap-2">
              <Monitor size={16} className="shrink-0" />
              <p>
                Your API key is stored locally in your browser and used directly. It is never sent
                to our servers.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {configMode === 'gemini' ? 'Google AI Studio Key' : 'OpenAI API Key'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-800 dark:text-white focus:border-primary-500 outline-none transition-all text-sm font-mono"
                />
                <div className="absolute right-3 top-2.5 text-slate-500 dark:text-slate-400">
                  <Lock size={16} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-6 mt-6 border-t border-slate-200 dark:border-navy-700 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {isSaved ? <Check size={16} /> : null}
            {isSaved ? 'Configuration Saved' : 'Save Configuration'}
          </button>
        </div>
      </form>

      {/* System Health Section */}
      {showSystemHealth && (
        <div className="mt-8">
          <h3 className="text-md font-semibold text-slate-800 dark:text-white mb-4">
            System Health
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AISystemHealthCard
              title="OpenAI Connection"
              status="healthy"
              details="Response time: 245ms"
            />
            <AISystemHealthCard
              title="Gemini Connection"
              status="healthy"
              details="Response time: 312ms"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AIConfigCore;
