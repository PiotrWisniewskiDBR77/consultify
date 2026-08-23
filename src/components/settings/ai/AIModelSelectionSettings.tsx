/**
 * AIModelSelectionSettings - AI Model Selection & Configuration
 *
 * Features:
 * - Choose AI model (GPT-4, Claude, Gemini)
 * - Model per use case (chat, code, analysis)
 * - Temperature/creativity slider
 * - Max tokens per request
 * - Cost tracking per model
 */
import {
  BarChart3,
  Bot,
  Brain,
  CheckCircle,
  Clock,
  Code,
  DollarSign,
  FileSearch,
  Info,
  Loader2,
  MessageSquare,
  Save,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';
import TeresaMark from '../../shared/TeresaMark';

interface AIModelSelectionSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  icon: string;
  description: string;
  capabilities: string[];
  maxTokens: number;
  costPer1kTokens: number;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'standard' | 'high' | 'premium';
}

interface ModelSettings {
  defaultModel: string;
  chatModel: string;
  codeModel: string;
  analysisModel: string;
  documentModel: string;
  temperature: number;
  maxTokens: number;
  streamResponse: boolean;
}

const availableModels: AIModel[] = [
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    icon: '🤖',
    description: 'Most capable model with broad knowledge',
    capabilities: ['chat', 'code', 'analysis', 'document'],
    maxTokens: 128000,
    costPer1kTokens: 0.01,
    speed: 'medium',
    quality: 'premium',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    icon: '⚡',
    description: 'Fast multimodal model with vision',
    capabilities: ['chat', 'code', 'analysis', 'document'],
    maxTokens: 128000,
    costPer1kTokens: 0.005,
    speed: 'fast',
    quality: 'premium',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    icon: '💨',
    description: 'Fast and cost-effective',
    capabilities: ['chat', 'code'],
    maxTokens: 16385,
    costPer1kTokens: 0.0005,
    speed: 'fast',
    quality: 'standard',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    icon: '🎭',
    description: 'Best for complex reasoning and analysis',
    capabilities: ['chat', 'code', 'analysis', 'document'],
    maxTokens: 200000,
    costPer1kTokens: 0.015,
    speed: 'medium',
    quality: 'premium',
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    icon: '📜',
    description: 'Balanced performance and speed',
    capabilities: ['chat', 'code', 'analysis', 'document'],
    maxTokens: 200000,
    costPer1kTokens: 0.003,
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    icon: '💎',
    description: "Google's advanced multimodal AI",
    capabilities: ['chat', 'code', 'analysis'],
    maxTokens: 32000,
    costPer1kTokens: 0.001,
    speed: 'fast',
    quality: 'high',
  },
];

const useCases = [
  {
    id: 'chat',
    label: 'Chat / Conversation',
    icon: MessageSquare,
    description: 'General Q&A and discussions',
  },
  { id: 'code', label: 'Code Generation', icon: Code, description: 'Writing and reviewing code' },
  {
    id: 'analysis',
    label: 'Analysis & Reasoning',
    icon: BarChart3,
    description: 'Data analysis and complex tasks',
  },
  {
    id: 'document',
    label: 'Document Processing',
    icon: FileSearch,
    description: 'Summarization and extraction',
  },
];

export const AIModelSelectionSettings: React.FC<AIModelSelectionSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ModelSettings>({
    defaultModel: 'gpt-4-turbo',
    chatModel: 'gpt-4-turbo',
    codeModel: 'claude-3-sonnet',
    analysisModel: 'claude-3-opus',
    documentModel: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    streamResponse: true,
  });
  const [costEstimate, setCostEstimate] = useState({ monthly: 0, daily: 0 });
  const [activeTab, setActiveTab] = useState<'models' | 'usecases' | 'advanced'>('models');

  useEffect(() => {
    loadSettings();
  }, [currentUser.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await Api.get('/api/user/ai-preferences/models');
      if (response.success && response.data) {
        setSettings({ ...settings, ...response.data });
        setCostEstimate(response.data.costEstimate || { monthly: 0, daily: 0 });
      }
    } catch (error) {
      console.error('Error loading AI model settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.put('/api/user/ai-preferences/models', settings);
      toast.success(t('settings.ai.modelsSaved', 'AI model settings saved'));
    } catch (error) {
      toast.error(t('settings.ai.modelsError', 'Failed to save AI model settings'));
    } finally {
      setSaving(false);
    }
  };

  const getSelectedModel = (modelId: string) => availableModels.find((m) => m.id === modelId);

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <TeresaMark size={28} className="text-c-accent" />
            {t('settings.ai.models.title', 'AI Model Selection')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.ai.models.description',
              'Choose and configure AI models for different use cases'
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Changes
        </button>
      </div>

      {/* Cost Estimate Card */}
      <div className="bg-gradient-to-r from-c-accent-soft to-c-accent-soft border border-c-accent dark:border-c-accent rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign size={20} className="text-c-accent" />
            <div>
              <p className="font-medium text-c-text">Estimated Monthly Cost</p>
              <p className="text-sm text-c-text-muted">Based on average usage patterns</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-c-accent">${costEstimate.monthly.toFixed(2)}</p>
            <p className="text-sm text-c-text-muted">${costEstimate.daily.toFixed(2)}/day</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-c-border-subtle dark:border-navy-700 pb-4">
        {[
          { id: 'models', label: 'Default Model', icon: Bot },
          { id: 'usecases', label: 'By Use Case', icon: Zap },
          { id: 'advanced', label: 'Advanced', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-navy-900 text-white'
                  : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Default Model Tab */}
      {activeTab === 'models' && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-c-text">Select Default AI Model</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableModels.map((model) => (
              <button
                key={model.id}
                onClick={() => setSettings({ ...settings, defaultModel: model.id })}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  settings.defaultModel === model.id
                    ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                    : 'border-c-border-subtle dark:border-navy-700 hover:border-c-accent'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{model.icon}</span>
                    <div>
                      <p className="font-semibold text-c-text">{model.name}</p>
                      <p className="text-xs text-c-text-muted">{model.provider}</p>
                    </div>
                  </div>
                  {settings.defaultModel === model.id && (
                    <CheckCircle size={20} className="text-c-accent" />
                  )}
                </div>
                <p className="text-sm text-c-text-secondary mt-2">{model.description}</p>
                <div className="flex items-center gap-4 mt-3 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded ${
                      model.speed === 'fast'
                        ? 'bg-green-100 text-green-700'
                        : model.speed === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-danger-100 text-danger-700'
                    }`}
                  >
                    <Clock size={10} className="inline mr-1" />
                    {model.speed}
                  </span>
                  <span className="text-c-text-muted">${model.costPer1kTokens}/1K tokens</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Use Cases Tab */}
      {activeTab === 'usecases' && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-c-text">Model per Use Case</h3>
          <p className="text-sm text-c-text-muted">Select different models for specific tasks</p>

          {useCases.map((useCase) => {
            const Icon = useCase.icon;
            const settingKey = `${useCase.id}Model` as keyof ModelSettings;

            return (
              <div key={useCase.id} className="p-4 bg-c-surface-raised rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-c-surface rounded-lg">
                    <Icon size={18} className="text-c-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-c-text">{useCase.label}</p>
                    <p className="text-sm text-c-text-muted">{useCase.description}</p>
                  </div>
                </div>
                <select
                  value={settings[settingKey] as string}
                  onChange={(e) => setSettings({ ...settings, [settingKey]: e.target.value })}
                  className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
                >
                  <option value="">Use Default Model</option>
                  {availableModels
                    .filter((m) => m.capabilities.includes(useCase.id))
                    .map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.icon} {model.name} ({model.provider})
                      </option>
                    ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {/* Advanced Tab */}
      {activeTab === 'advanced' && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-c-text">Advanced Settings</h3>

          {/* Temperature Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-c-text">Temperature / Creativity</label>
                <p className="text-sm text-c-text-muted">
                  Higher = more creative, Lower = more focused
                </p>
              </div>
              <span className="text-lg font-mono text-c-accent">
                {settings.temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(e) =>
                setSettings({ ...settings, temperature: parseFloat(e.target.value) })
              }
              className="w-full h-2 bg-c-surface-raised rounded-lg appearance-none cursor-pointer accent-c-accent"
            />
            <div className="flex justify-between text-xs text-c-text-muted">
              <span>Precise</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-c-text">Max Response Tokens</label>
                <p className="text-sm text-c-text-muted">Maximum length of AI responses</p>
              </div>
              <span className="text-lg font-mono text-c-accent">
                {settings.maxTokens.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="256"
              max="16384"
              step="256"
              value={settings.maxTokens}
              onChange={(e) => setSettings({ ...settings, maxTokens: parseInt(e.target.value) })}
              className="w-full h-2 bg-c-surface-raised rounded-lg appearance-none cursor-pointer accent-c-accent"
            />
            <div className="flex justify-between text-xs text-c-text-muted">
              <span>Short (256)</span>
              <span>Medium (4K)</span>
              <span>Long (16K)</span>
            </div>
          </div>

          {/* Stream Response */}
          <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
            <div>
              <label className="font-medium text-c-text">Stream Responses</label>
              <p className="text-sm text-c-text-muted">Show responses as they're generated</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, streamResponse: !settings.streamResponse })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.streamResponse ? 'bg-navy-900' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
                  settings.streamResponse ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Model Selection Tips</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Use GPT-4 Turbo or Claude 3 Opus for complex reasoning tasks</li>
              <li>Use GPT-3.5 or Gemini Pro for quick, simple queries to save costs</li>
              <li>Lower temperature (0.3-0.5) for factual/analytical tasks</li>
              <li>Higher temperature (0.8-1.2) for creative writing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIModelSelectionSettings;
