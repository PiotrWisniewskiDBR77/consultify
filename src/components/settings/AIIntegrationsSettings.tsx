/**
 * AIIntegrationsSettings - AI Provider Integration Management
 *
 * Manages integrations with AI providers: Google AI Studio, OpenAI, Anthropic, etc.
 * Features: API key management, token usage tracking, cost monitoring, rate limits
 */

import {
  AlertCircle,
  BarChart3,
  Brain,
  CheckCircle,
  Copy,
  DollarSign,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface AIProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  website: string;
  apiKey?: string;
  isConnected: boolean;
  usage?: {
    tokens: number;
    requests: number;
    cost: number;
    period: string;
  };
  limits?: {
    rateLimit: string;
    quota: string;
    remaining: string;
  };
}

interface AIIntegrationsSettingsProps {
  className?: string;
  currentUser?: any; // User type
}

const AI_PROVIDERS: Omit<AIProvider, 'apiKey' | 'isConnected' | 'usage' | 'limits'>[] = [
  {
    id: 'google_ai',
    name: 'Google AI Studio',
    icon: '🤖',
    description: 'Access Gemini models, custom models, and AI capabilities',
    website: 'https://aistudio.google.com',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🧠',
    description: 'GPT-4, GPT-3.5, embeddings, and fine-tuning',
    website: 'https://platform.openai.com',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: '💡',
    description: 'Claude API with long context and advanced reasoning',
    website: 'https://www.anthropic.com',
  },
  {
    id: 'custom',
    name: 'Custom AI Endpoint',
    icon: '⚙️',
    description: 'Connect to your own AI model endpoint',
    website: '',
  },
];

export const AIIntegrationsSettings: React.FC<AIIntegrationsSettingsProps> = ({
  className = '',
  currentUser,
}) => {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKeyModal, setShowKeyModal] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState('');
  const [showKey, setShowKey] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      // Mock data - replace with actual API call
      const mockProviders: AIProvider[] = AI_PROVIDERS.map((p) => ({
        ...p,
        isConnected: false,
        usage: undefined,
        limits: undefined,
      }));
      setProviders(mockProviders);
    } catch (error) {
      console.error('Failed to fetch AI providers:', error);
      toast.error(t('settings.ai.integrations.fetchError', 'Failed to load AI integrations'));
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (providerId: string) => {
    setShowKeyModal(providerId);
    setNewApiKey('');
  };

  const handleSaveKey = async (providerId: string) => {
    if (!newApiKey.trim()) {
      toast.error(t('settings.ai.integrations.keyRequired', 'API key is required'));
      return;
    }

    try {
      // Mock save - replace with actual API call
      setProviders((prev) =>
        prev.map((p) => (p.id === providerId ? { ...p, apiKey: newApiKey, isConnected: true } : p))
      );
      toast.success(t('settings.ai.integrations.connected', 'AI provider connected successfully'));
      setShowKeyModal(null);
      setNewApiKey('');
    } catch (error) {
      toast.error(t('settings.ai.integrations.connectError', 'Failed to connect AI provider'));
    }
  };

  const handleDisconnect = async (providerId: string) => {
    if (!confirm(t('settings.ai.integrations.disconnectConfirm', 'Disconnect this AI provider?'))) {
      return;
    }

    try {
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? { ...p, apiKey: undefined, isConnected: false, usage: undefined, limits: undefined }
            : p
        )
      );
      toast.success(t('settings.ai.integrations.disconnected', 'AI provider disconnected'));
    } catch (error) {
      toast.error(t('settings.ai.integrations.disconnectError', 'Failed to disconnect'));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('common.copied', 'Copied to clipboard'));
  };

  const formatUsage = (usage: AIProvider['usage']) => {
    if (!usage) return null;
    return {
      tokens: usage.tokens.toLocaleString(),
      requests: usage.requests.toLocaleString(),
      cost: `$${usage.cost.toFixed(2)}`,
    };
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-48 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Brain size={20} />
            {t('settings.ai.integrations.title', 'AI Integrations')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'settings.ai.integrations.description',
              'Connect AI providers to enhance your workflows with advanced AI capabilities'
            )}
          </p>
        </div>
        <button
          onClick={fetchProviders}
          className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          title={t('common.refresh', 'Refresh')}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <p className="text-sm text-blue-900 dark:text-blue-300 font-medium">
              {t('settings.ai.integrations.infoTitle', 'Secure API Key Storage')}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
              {t(
                'settings.ai.integrations.infoDesc',
                'Your API keys are encrypted and stored securely. We never expose your keys in logs or error messages.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((provider) => {
          const usage = formatUsage(provider.usage);
          const isConnected = provider.isConnected;

          return (
            <div
              key={provider.id}
              className={`p-6 rounded-xl border transition-all ${
                isConnected
                  ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30'
                  : 'bg-slate-50 dark:bg-navy-800/50 border-slate-200 dark:border-navy-700'
              }`}
            >
              {/* Provider Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`text-3xl ${isConnected ? 'opacity-100' : 'opacity-60'}`}>
                    {provider.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      {provider.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {provider.description}
                    </p>
                  </div>
                </div>
                {isConnected && (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                    <CheckCircle size={12} />
                    {t('common.connected', 'Connected')}
                  </span>
                )}
              </div>

              {/* Usage Stats */}
              {isConnected && usage && (
                <div className="mb-4 p-3 bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('settings.ai.integrations.usage', 'Usage')} (
                      {provider.usage?.period || 'This month'})
                    </span>
                    <BarChart3 size={14} className="text-slate-400 dark:text-slate-500" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('settings.ai.integrations.tokens', 'Tokens')}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {usage.tokens}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('settings.ai.integrations.requests', 'Requests')}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {usage.requests}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('settings.ai.integrations.cost', 'Cost')}
                      </p>
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {usage.cost}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* API Key Display */}
              {isConnected && provider.apiKey && (
                <div className="mb-4 p-3 bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {t('settings.ai.integrations.apiKey', 'API Key')}
                      </p>
                      <code className="text-xs font-mono text-slate-700 dark:text-slate-300">
                        {showKey === provider.id
                          ? provider.apiKey
                          : `${provider.apiKey.substring(0, 8)}${'•'.repeat(20)}`}
                      </code>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowKey(showKey === provider.id ? null : provider.id)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-navy-700 rounded text-slate-400 dark:text-slate-500"
                      >
                        {showKey === provider.id ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(provider.apiKey || '')}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-navy-700 rounded text-slate-400 dark:text-slate-500"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Rate Limits */}
              {isConnected && provider.limits && (
                <div className="mb-4 p-3 bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('settings.ai.integrations.limits', 'Rate Limits')}
                    </span>
                    <Zap size={14} className="text-slate-400 dark:text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t('settings.ai.integrations.rateLimit', 'Rate Limit')}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {provider.limits.rateLimit}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t('settings.ai.integrations.quota', 'Quota')}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {provider.limits.quota}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t('settings.ai.integrations.remaining', 'Remaining')}
                      </span>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {provider.limits.remaining}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                {provider.website && (
                  <a
                    href={provider.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-brand border border-slate-200 dark:border-navy-700 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                  >
                    <ExternalLink size={12} />
                    {t('settings.ai.integrations.website', 'Website')}
                  </a>
                )}
                {isConnected ? (
                  <>
                    <button
                      onClick={() => {
                        /* Open settings */
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-brand border border-slate-200 dark:border-navy-700 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                    >
                      <Settings size={12} />
                      {t('common.settings', 'Settings')}
                    </button>
                    <button
                      onClick={() => handleDisconnect(provider.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={12} />
                      {t('common.disconnect', 'Disconnect')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(provider.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-dark rounded-lg transition-colors"
                  >
                    <Key size={12} />
                    {t('settings.ai.integrations.connect', 'Connect')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-navy-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">
              {t('settings.ai.integrations.connectProvider', 'Connect {{provider}}', {
                provider: providers.find((p) => p.id === showKeyModal)?.name,
              })}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('settings.ai.integrations.apiKey', 'API Key')}
                </label>
                <input
                  type="password"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder={t('settings.ai.integrations.keyPlaceholder', 'Enter your API key')}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-slate-900 dark:text-white"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t(
                    'settings.ai.integrations.keyHint',
                    'Your API key will be encrypted and stored securely'
                  )}
                </p>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => {
                    setShowKeyModal(null);
                    setNewApiKey('');
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg font-medium"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => handleSaveKey(showKeyModal)}
                  disabled={!newApiKey.trim()}
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 font-medium"
                >
                  {t('common.save', 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIIntegrationsSettings;
