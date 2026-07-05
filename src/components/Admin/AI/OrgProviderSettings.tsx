/**
 * OrgProviderSettings - Organization Admin UI for Provider Selection
 *
 * Features:
 * - Enable/disable LLM providers for the organization
 * - View available models per tier
 * - Preview which models users can access
 */

import {
  AlertTriangle,
  Brain,
  CheckCircle,
  Crown,
  Eye,
  EyeOff,
  Info,
  RefreshCw,
  Server,
  ToggleLeft,
  ToggleRight,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { LoadingState } from '@/components/ui/primitives';

interface Provider {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  is_active: boolean;
  health_status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  is_enabled_for_org: boolean;
  custom_priority?: number;
}

interface AvailableModels {
  [tier: string]: {
    id: string;
    name: string;
    provider: string;
    model_id: string;
    health_status: string;
  }[];
}

const TIER_CONFIG = {
  BUDGET: {
    icon: Zap,
    color: 'emerald',
    description: 'Cost-effective, fast responses',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
  },
  STANDARD: {
    icon: Server,
    color: 'blue',
    description: 'Balanced performance',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-400',
  },
  PREMIUM: {
    icon: Crown,
    color: 'violet',
    description: 'High-quality output',
    bgClass: 'bg-primary-500/10',
    textClass: 'text-primary-400',
  },
  REASONING: {
    icon: Brain,
    color: 'amber',
    description: 'Deep analysis',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
  },
};

interface OrgProviderSettingsProps {
  organizationId: string;
}

export const OrgProviderSettings: React.FC<OrgProviderSettingsProps> = ({ organizationId }) => {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [availableModels, setAvailableModels] = useState<AvailableModels>({});
  const [showDisabled, setShowDisabled] = useState(false);
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) {
      loadData();
    }
  }, [organizationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [providersRes, modelsRes] = await Promise.all([
        fetch(`/api/llm/org/${organizationId}/providers`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch(`/api/llm/org/${organizationId}/available-models`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
      ]);

      if (providersRes.ok) {
        const data = await providersRes.json();
        setProviders(data.providers || []);
      }

      if (modelsRes.ok) {
        const data = await modelsRes.json();
        setAvailableModels(data.tiers || {});
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Failed to load provider settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleProvider = async (providerId: string, currentEnabled: boolean) => {
    setSavingProvider(providerId);

    // Optimistic update
    setProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, is_enabled_for_org: !currentEnabled } : p))
    );

    try {
      const res = await fetch(`/api/llm/org/${organizationId}/providers/${providerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ isEnabled: !currentEnabled }),
      });

      if (!res.ok) throw new Error('Failed to update');

      // Reload available models after change
      const modelsRes = await fetch(`/api/llm/org/${organizationId}/available-models`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (modelsRes.ok) {
        const data = await modelsRes.json();
        setAvailableModels(data.tiers || {});
      }

      toast.success(`Provider ${!currentEnabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      // Revert on error
      setProviders((prev) =>
        prev.map((p) => (p.id === providerId ? { ...p, is_enabled_for_org: currentEnabled } : p))
      );
      toast.error('Failed to update provider');
    } finally {
      setSavingProvider(null);
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={14} className="text-emerald-400" />;
      case 'degraded':
        return <AlertTriangle size={14} className="text-amber-400" />;
      case 'unhealthy':
        return <XCircle size={14} className="text-danger-400" />;
      default:
        return <Server size={14} className="text-slate-600 dark:text-slate-500" />;
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  const enabledProviders = providers.filter((p) => p.is_enabled_for_org);
  const disabledProviders = providers.filter((p) => !p.is_enabled_for_org);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-c-text">LLM Provider Settings</h3>
          <p className="text-sm text-slate-600 dark:text-slate-500">
            Enable or disable AI providers for your organization. Only enabled providers will be
            available to users.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-500 hover:text-white transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-400 mt-0.5" />
          <div>
            <h4 className="text-blue-300 font-medium">How Provider Selection Works</h4>
            <p className="text-sm text-slate-600 dark:text-slate-500 mt-1">
              When you disable a provider, its models will no longer be available in any tier. The
              system will automatically use remaining enabled providers with round-robin selection.
            </p>
          </div>
        </div>
      </div>

      {/* Enabled Providers */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-6">
        <h4 className="text-c-text font-medium mb-4 flex items-center gap-2">
          <CheckCircle size={18} className="text-emerald-400" />
          Enabled Providers ({enabledProviders.length})
        </h4>

        {enabledProviders.length > 0 ? (
          <div className="space-y-2">
            {enabledProviders.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  {getHealthIcon(provider.health_status)}
                  <div>
                    <div className="text-c-text font-medium">{provider.name}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-500">
                      {provider.provider} • {provider.model_id}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleProvider(provider.id, true)}
                  disabled={savingProvider === provider.id}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 hover:bg-danger-500/20 text-emerald-400 hover:text-danger-400 rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingProvider === provider.id ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <ToggleRight size={20} />
                  )}
                  Enabled
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            No providers enabled. Enable providers below to allow AI usage.
          </div>
        )}
      </div>

      {/* Disabled Providers */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-6">
        <button
          onClick={() => setShowDisabled(!showDisabled)}
          className="w-full flex items-center justify-between text-left"
        >
          <h4 className="text-c-text font-medium flex items-center gap-2">
            {showDisabled ? <Eye size={18} /> : <EyeOff size={18} />}
            Disabled Providers ({disabledProviders.length})
          </h4>
          <span className="text-slate-600 dark:text-slate-500 text-sm">
            {showDisabled ? 'Hide' : 'Show'}
          </span>
        </button>

        {showDisabled && disabledProviders.length > 0 && (
          <div className="space-y-2 mt-4">
            {disabledProviders.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/300/5 border border-slate-500/20 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  {getHealthIcon(provider.health_status)}
                  <div>
                    <div className="text-slate-600 font-medium">{provider.name}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {provider.provider} • {provider.model_id}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleProvider(provider.id, false)}
                  disabled={savingProvider === provider.id}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-navy-800/300/20 hover:bg-emerald-500/20 text-slate-600 dark:text-slate-500 hover:text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingProvider === provider.id ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <ToggleLeft size={20} />
                  )}
                  Disabled
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Models Preview */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-6">
        <h4 className="text-c-text font-medium mb-4">Available Models per Tier</h4>
        <p className="text-sm text-slate-600 dark:text-slate-500 mb-4">
          These are the models currently available to your users based on enabled providers.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(TIER_CONFIG).map(([tier, config]) => {
            const TierIcon = config.icon;
            const models = availableModels[tier] || [];

            return (
              <div key={tier} className={`${config.bgClass} border border-white/10 rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  <TierIcon size={18} className={config.textClass} />
                  <span className={`font-medium ${config.textClass}`}>{tier}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ({models.length} models)
                  </span>
                </div>

                {models.length > 0 ? (
                  <div className="space-y-1">
                    {models.map((model, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {getHealthIcon(model.health_status)}
                        <span className="text-slate-600">{model.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    No models available
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrgProviderSettings;
