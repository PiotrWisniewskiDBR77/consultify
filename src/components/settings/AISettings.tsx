import {
  Activity,
  AlertCircle,
  BarChart2,
  Bot,
  Brain,
  Check,
  ChevronRight,
  Cpu,
  ExternalLink,
  Eye,
  FileText,
  Fingerprint,
  Gauge,
  Globe,
  HardDrive,
  Key,
  LayoutGrid,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Network,
  Pause,
  Plus,
  Save,
  Scale,
  Server,
  Settings,
  Shield,
  Sliders,
  Sparkles,
  Terminal,
  Trash2,
  User as UserIcon,
  Wifi,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useRealtimeCosts } from '../../hooks/useRealtimeCosts';
import { Api } from '../../services/api';
import {
  AIPreferences,
  AIProactivityMode,
  LLMProvider,
  OrgAISettings,
  User,
  UserAIProvider,
  UserAISettings,
} from '../../types';
import { LLMProviderConfig } from '../../types/domain/ai';
import { ProactivitySelector } from '../AISettings';

interface AISettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

const defaultPreferences: AIPreferences = {
  responseStyle: 'balanced',
  writingTone: 'professional',
  autoSuggestions: true,
  contextRetention: 'session',
  preferredLanguage: 'auto',
  codeExplanations: true,
  showSources: true,
  userRole: 'analyst',
  supportLevel: 'standard',
  autonomyLevel: 'human_loop',

  // New Defaults
  modelTemperature: 0.7,
  maxTokens: 4096,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  systemInstructions: '',
  enableWebSearch: true,
  enablePiiRedaction: false,
  dataRetentionPolicy: 'standard',
  contextWindowStrategy: 'auto',
};

type SettingsTab = 'org' | 'api' | 'local' | 'behavior' | 'proactivity' | 'privacy';

export const AISettings: React.FC<AISettingsProps> = ({ currentUser, onUpdateUser }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('org');

  const [preferences, setPreferences] = useState<
    AIPreferences & { userRole: string; supportLevel: string; autonomyLevel: string }
  >(defaultPreferences as any);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Model Management State
  const [orgProviders, setOrgProviders] = useState<LLMProviderConfig[]>([]);
  const [localProviders, setLocalProviders] = useState<UserAIProvider[]>([]);
  const [selectedOrgModels, setSelectedOrgModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [localOllamaModelId, setLocalOllamaModelId] = useState<string>(
    (currentUser.aiConfig as any)?.provider === 'ollama'
      ? String((currentUser.aiConfig as any)?.modelId || 'gemma3:27b')
      : 'gemma3:27b'
  );

  useEffect(() => {
    if ((currentUser.aiConfig as any)?.provider === 'ollama') {
      const m = String((currentUser.aiConfig as any)?.modelId || '').trim();
      if (m) setLocalOllamaModelId(m);
    }
  }, [(currentUser.aiConfig as any)?.provider, (currentUser.aiConfig as any)?.modelId]);

  // New Provider Form
  const [showAddProvider, setShowAddProvider] = useState(false);
  const createEmptyProviderForm = (
    provider: UserAIProvider['provider'] = 'openai'
  ): Partial<UserAIProvider> => ({
    name: '',
    provider,
    apiKey: '',
    endpoint: provider === 'ollama' ? 'http://localhost:11434' : '',
    isEnabled: true,
    isLocal: provider === 'ollama',
  });
  const [newProvider, setNewProvider] =
    useState<Partial<UserAIProvider>>(createEmptyProviderForm());

  useEffect(() => {
    setShowAddProvider(false);
    setNewProvider(createEmptyProviderForm());
  }, [activeTab]);

  // Health Check State
  const [providerHealth, setProviderHealth] = useState<any>(null);

  // Proactivity Mode State
  const [proactivityMode, setProactivityMode] = useState<AIProactivityMode>('BALANCED');
  const [maxProactivity, setMaxProactivity] = useState<AIProactivityMode>('PROACTIVE');

  const getUserAISetting = <T,>(settings: any, snakeKey: string, camelKey: string): T | undefined =>
    settings?.[snakeKey] ?? settings?.[camelKey];

  const applyPersistedUserAISettings = (settings: any) => {
    if (!settings) return;

    setPreferences((prev: any) => ({
      ...prev,
      responseStyle:
        getUserAISetting(settings, 'response_style', 'responseStyle') ?? prev.responseStyle,
      writingTone: getUserAISetting(settings, 'writing_tone', 'writingTone') ?? prev.writingTone,
      preferredLanguage:
        getUserAISetting(settings, 'preferred_language', 'preferredLanguage') ??
        prev.preferredLanguage,
      codeExplanations:
        getUserAISetting(settings, 'code_explanations', 'codeExplanations') ??
        prev.codeExplanations,
      showSources: getUserAISetting(settings, 'show_sources', 'showSources') ?? prev.showSources,
      modelTemperature:
        getUserAISetting(settings, 'model_temperature', 'modelTemperature') ??
        prev.modelTemperature,
      maxTokens: getUserAISetting(settings, 'max_tokens', 'maxTokens') ?? prev.maxTokens,
      topP: getUserAISetting(settings, 'top_p', 'topP') ?? prev.topP,
      frequencyPenalty:
        getUserAISetting(settings, 'frequency_penalty', 'frequencyPenalty') ??
        prev.frequencyPenalty,
      presencePenalty:
        getUserAISetting(settings, 'presence_penalty', 'presencePenalty') ?? prev.presencePenalty,
      systemInstructions:
        getUserAISetting(settings, 'system_instructions', 'systemInstructions') ??
        prev.systemInstructions,
      enablePiiRedaction:
        getUserAISetting(settings, 'enable_pii_redaction', 'enablePiiRedaction') ??
        prev.enablePiiRedaction,
      dataRetentionPolicy:
        getUserAISetting(settings, 'data_retention_policy', 'dataRetentionPolicy') ??
        prev.dataRetentionPolicy,
      contextRetention:
        getUserAISetting(settings, 'context_retention', 'contextRetention') ??
        prev.contextRetention,
      autoSuggestions:
        getUserAISetting(settings, 'auto_suggestions', 'autoSuggestions') ?? prev.autoSuggestions,
    }));

    const persistedProactivity = getUserAISetting<AIProactivityMode>(
      settings,
      'proactivity_mode',
      'proactivityMode'
    );
    const persistedVisibleModels = getUserAISetting<string[]>(
      settings,
      'visible_model_ids',
      'visibleModelIds'
    );
    if (persistedProactivity) {
      setProactivityMode(persistedProactivity);
    }
    if (Array.isArray(persistedVisibleModels)) {
      setSelectedOrgModels(persistedVisibleModels);
    }
  };

  const loadPersonalProviders = async () => {
    const response = await Api.get('/settings/preferences/ai-providers').catch(() => null);
    const serverProviders = Array.isArray(response?.providers) ? response.providers : [];
    if (serverProviders.length > 0) {
      setLocalProviders(serverProviders);
      return serverProviders;
    }

    const perUserKey = `user_ai_providers:${currentUser.id}`;
    const storedPerUser = localStorage.getItem(perUserKey);
    const legacy = localStorage.getItem('user_ai_providers');
    const raw = storedPerUser || legacy;
    if (!raw) {
      setLocalProviders([]);
      return [];
    }

    try {
      const migratedProviders = JSON.parse(raw);
      if (Array.isArray(migratedProviders)) {
        const persisted = await savePersonalProviders(migratedProviders);
        localStorage.removeItem(perUserKey);
        localStorage.removeItem('user_ai_providers');
        return persisted;
      }
    } catch {
      localStorage.removeItem(perUserKey);
      localStorage.removeItem('user_ai_providers');
    }

    setLocalProviders([]);
    return [];
  };

  const savePersonalProviders = async (providers: UserAIProvider[]) => {
    const response = await Api.put('/settings/preferences/ai-providers', { providers });
    const persisted = Array.isArray(response?.providers) ? response.providers : providers;
    setLocalProviders(persisted);
    return persisted;
  };

  // Real-time Cost Tracking
  const {
    connected: costsConnected,
    summary: costSummary,
    refresh: refreshCosts,
  } = useRealtimeCosts({
    enabled: true,
    onBudgetAlert: (percentage) => {
      toast.error(`Budget Alert: You've used ${percentage}% of your monthly budget!`);
    },
  });

  useEffect(() => {
    const initData = async () => {
      setLoadingModels(true);
      try {
        // 1. Load User AI Settings from the canonical server-backed API.
        const initialUserSettings = await Api.getAIUserSettings().catch(() => null);
        applyPersistedUserAISettings(initialUserSettings);

        // 2. Load Organization Providers
        const providers = await Api.getLLMProviders(true); // adminContext=true to get is_enabled_for_org
        // Filter only those active globally AND enabled for org
        const availableFn = providers.filter(
          (p: any) => p.is_active && p.is_enabled_for_org !== false
        );
        setOrgProviders(availableFn);

        // 3. Load User selection (from user.aiConfig.visibleModelIds)
        if (currentUser.aiConfig?.visibleModelIds) {
          setSelectedOrgModels(currentUser.aiConfig.visibleModelIds);
        } else {
          setSelectedOrgModels(availableFn.map((p) => p.id));
        }

        // 4. Load Local/Personal Providers
        await loadPersonalProviders();

        // 5. Fetch Real-time Health
        try {
          const health = await Api.checkLLMProvidersHealth();
          setProviderHealth(health);
        } catch (e) {
          console.error('Failed to fetch provider health', e);
        }

        // 6. Load User AI Settings (proactivity)
        try {
          const userSettings = await Api.getAIUserSettings();
          applyPersistedUserAISettings(userSettings);
        } catch (e) {
          console.error('Failed to load user AI settings', e);
        }

        // 7. Load Org Settings (for max proactivity)
        try {
          const orgSettings = await Api.get(`/ai-settings/org/${currentUser.organizationId}`);
          if (orgSettings.defaultProactivityMode) {
            setMaxProactivity(orgSettings.defaultProactivityMode);
          }
        } catch (e) {
          console.error('Failed to load org settings', e);
        }
      } catch (e) {
        console.error('Failed to load AI settings', e);
        toast.error(t('settings.ai.loadError', 'Failed to load settings'));
      } finally {
        setLoadingModels(false);
      }
    };
    initData();
  }, [currentUser.aiConfig, t]);

  const savePreferences = async () => {
    setSaving(true);
    try {
      // Save all user-editable AI settings through the canonical server-backed API.
      await Api.updateAIUserSettings({
        response_style: preferences.responseStyle,
        writing_tone: preferences.writingTone,
        preferred_language: preferences.preferredLanguage,
        code_explanations: preferences.codeExplanations,
        show_sources: preferences.showSources,
        proactivity_mode: proactivityMode,
        model_temperature: preferences.modelTemperature,
        max_tokens: preferences.maxTokens,
        top_p: preferences.topP,
        frequency_penalty: preferences.frequencyPenalty,
        presence_penalty: preferences.presencePenalty,
        system_instructions: preferences.systemInstructions,
        visible_model_ids: selectedOrgModels,
        enable_pii_redaction: preferences.enablePiiRedaction,
        data_retention_policy: preferences.dataRetentionPolicy,
        context_retention: preferences.contextRetention,
        auto_suggestions: preferences.autoSuggestions,
      });
      await savePersonalProviders(localProviders);
      const persistedUserSettings = await Api.getAIUserSettings().catch(() => null);
      const persistedProactivity =
        getUserAISetting<AIProactivityMode>(
          persistedUserSettings,
          'proactivity_mode',
          'proactivityMode'
        ) || proactivityMode;
      const persistedVisibleModels =
        getUserAISetting<string[]>(persistedUserSettings, 'visible_model_ids', 'visibleModelIds') ||
        selectedOrgModels;
      setProactivityMode(persistedProactivity);
      setSelectedOrgModels(persistedVisibleModels);
      applyPersistedUserAISettings(persistedUserSettings);

      const updatedAiConfig = {
        ...currentUser.aiConfig,
        visibleModelIds: persistedVisibleModels,
      };

      onUpdateUser({ aiConfig: updatedAiConfig as any });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success(t('settings.ai.configurationSaved', 'Configuration saved'));
    } catch (e) {
      toast.error(t('settings.ai.configurationSaveError', 'Failed to save configuration'));
    } finally {
      setSaving(false);
    }
  };

  const handleOrgModelToggle = (modelId: string) => {
    setSelectedOrgModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
    setSaved(false);
  };

  const handleAddProvider = async () => {
    if (!newProvider.name || (!newProvider.apiKey && !newProvider.endpoint)) {
      toast.error('Please fill in required fields');
      return;
    }

    const isLocal = newProvider.provider === 'ollama';

    const provider: UserAIProvider = {
      id: crypto.randomUUID(),
      name: newProvider.name,
      provider: newProvider.provider as any,
      apiKey: newProvider.apiKey,
      endpoint: isLocal ? newProvider.endpoint || 'http://localhost:11434' : undefined,
      isEnabled: true,
      isLocal: isLocal,
    };

    const updated = [...localProviders, provider];
    try {
      await savePersonalProviders(updated);
    } catch {
      toast.error(t('settings.ai.providerSaveError', 'Failed to save provider'));
      return;
    }

    setShowAddProvider(false);
    setNewProvider(createEmptyProviderForm());
    toast.success(isLocal ? 'Local provider added' : 'API key added');
  };

  const removeLocalProvider = async (id: string) => {
    const updated = localProviders.filter((p) => p.id !== id);
    try {
      await savePersonalProviders(updated);
    } catch {
      toast.error(t('settings.ai.providerSaveError', 'Failed to save provider'));
      return;
    }
    toast.success('Provider removed');
  };

  // Filter providers for current view
  const apiProviders = localProviders.filter((p) => !p.isLocal);
  const localHostProviders = localProviders.filter((p) => p.isLocal);
  const activeOllamaEndpoint =
    (currentUser.aiConfig as any)?.provider === 'ollama'
      ? String((currentUser.aiConfig as any)?.endpoint || '')
      : '';

  const activateOllama = (endpoint: string) => {
    if (!endpoint || endpoint.trim().length === 0) {
      toast.error('Missing Ollama endpoint');
      return;
    }
    const next = {
      ...(currentUser.aiConfig || {}),
      provider: 'ollama',
      endpoint: endpoint.trim(),
      modelId: String(localOllamaModelId || 'gemma3:27b').trim(),
    };
    onUpdateUser({ aiConfig: next as any });
    toast.success('Local inference enabled');
  };

  const disableLocalInference = () => {
    const next = {
      ...(currentUser.aiConfig || {}),
      provider: 'system',
      endpoint: undefined,
      modelId: undefined,
    };
    onUpdateUser({ aiConfig: next as any });
    toast.success('Local inference disabled');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Minimalist Header */}
      <div className="flex justify-between items-center mb-6 border-b border-c-border-subtle pb-4">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-c-surface-raised rounded-lg border border-c-border-subtle">
            <Brain className="w-6 h-6 text-c-text" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-c-text tracking-tight">LLM Management</h2>
            <p className="text-xs text-c-text-muted uppercase tracking-widest font-medium mt-0.5">
              Enterprise Control Plane
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={savePreferences}
            disabled={saving || saved || loadingModels}
            className={`px-6 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition ${
              saved
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface border border-c-border-subtle shadow-sm'
            }`}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                {t('common.saved', 'Synced')}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {saving ? 'Syncing...' : 'Save Configuration'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs - High Tech Button Style */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
        <NavTab
          id="org"
          label="Performance Tiers"
          icon={<Shield size={16} />}
          active={activeTab === 'org'}
          onClick={() => setActiveTab('org')}
        />
        <NavTab
          id="api"
          label="BYOK Keys"
          icon={<Key size={16} />}
          active={activeTab === 'api'}
          onClick={() => setActiveTab('api')}
        />
        <NavTab
          id="local"
          label="Local Inference"
          icon={<Terminal size={16} />}
          active={activeTab === 'local'}
          onClick={() => setActiveTab('local')}
        />
        <div className="w-px h-6 bg-c-surface-raised mx-2" />
        <NavTab
          id="proactivity"
          label="AI Proactivity"
          icon={<Scale size={16} />}
          active={activeTab === 'proactivity'}
          onClick={() => setActiveTab('proactivity')}
        />
        <NavTab
          id="behavior"
          label="Behavior & Context"
          icon={<Sliders size={16} />}
          active={activeTab === 'behavior'}
          onClick={() => setActiveTab('behavior')}
        />
        <NavTab
          id="privacy"
          label="Privacy & Controls"
          icon={<Lock size={16} />}
          active={activeTab === 'privacy'}
          onClick={() => setActiveTab('privacy')}
        />
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {/* 1. Performance Tiers (Was Model Registry) */}
        {activeTab === 'org' && (
          <div className="animate-in fade-in duration-300">
            <SectionHeader
              title="Default Performance Tier"
              subtitle="Select your preferred balance of speed, capability, and cost."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: 'BUDGET',
                  label: 'Budget Tier',
                  desc: 'Fastest responses, lowest cost. Best for simple queries and drafting.',
                  icon: <Zap size={24} className="text-emerald-400" />,
                  color: 'emerald',
                  example: 'GPT-4o Mini, Haiku',
                },
                {
                  id: 'STANDARD',
                  label: 'Standard Tier',
                  desc: 'Balanced performance. Good for most daily tasks and coding.',
                  icon: <Activity size={24} className="text-blue-400" />,
                  color: 'blue',
                  example: 'GPT-4o, Sonnet 3.5',
                },
                {
                  id: 'PREMIUM',
                  label: 'Premium Tier',
                  desc: 'Highest quality output. Best for complex analysis and creativity.',
                  icon: <Sparkles size={24} className="text-c-accent" />,
                  color: 'purple',
                  example: 'GPT-4-Turbo, Opus',
                },
                {
                  id: 'REASONING',
                  label: 'Reasoning Tier',
                  desc: 'Deep thought capability. Best for math, hard logic, and architecture.',
                  icon: <Brain size={24} className="text-amber-400" />,
                  color: 'amber',
                  example: 'o1-preview, o1-mini',
                },
              ].map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => {
                    // Update local preference state - assuming we add selectedTier to preferences or handle it separately
                    // Since preferences is typed strictly, we might need to cast or just update the visibleModelIds hack or add a new field
                    // For now, let's update selectedOrgModels as a proxy or add a new state
                    // But to persist, we need to add it to savePreferences
                    onUpdateUser({
                      aiConfig: { ...currentUser.aiConfig, selectedTier: tier.id } as any,
                    });
                    toast.success(`Default tier set to ${tier.label}`);
                  }}
                  className={`p-6 rounded-xl border text-left transition relative group overflow-hidden ${
                    (currentUser.aiConfig as any)?.selectedTier === tier.id
                      ? `bg-${tier.color}-500/10 border-${tier.color}-500`
                      : 'bg-c-surface-raised border-c-border-subtle hover:border-c-border-subtle hover:bg-c-surface-raised dark:hover:bg-navy-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg bg-${tier.color}-500/10`}>{tier.icon}</div>
                    {(currentUser.aiConfig as any)?.selectedTier === tier.id && (
                      <div
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase bg-${tier.color}-500 text-c-text`}
                      >
                        Active Default
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-c-text mb-1">{tier.label}</h3>
                  <p className="text-sm text-c-text-secondary mb-4 h-10">{tier.desc}</p>

                  <div className="flex items-center gap-2 text-xs text-c-text-muted font-mono bg-c-surface-raised p-2 rounded">
                    <Server size={12} />
                    {tier.example}
                  </div>
                </button>
              ))}
            </div>

            {/* Personal Cost Dashboard - Real-time */}
            <div className="mt-12">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader
                  title="Your AI Usage"
                  subtitle="Track your personal AI costs and usage this month."
                />
                <div className="flex items-center gap-2">
                  {costsConnected && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      Live
                    </span>
                  )}
                  <button
                    onClick={refreshCosts}
                    className="text-xs text-c-text-secondary hover:text-c-text px-2 py-1 rounded hover:bg-c-surface-raised dark:hover:bg-navy-800/40 transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-emerald-500/10 to-c-surface-raised border border-emerald-500/20 rounded-xl p-4 relative overflow-hidden">
                  {costsConnected && (
                    <div className="absolute top-2 right-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse inline-block" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={16} className="text-emerald-400" />
                    <span className="text-xs text-emerald-400 uppercase font-bold tracking-wider">
                      Total Spent
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-c-text">
                    ${costSummary.totalCostThisMonth.toFixed(2)}
                  </p>
                  <p className="text-xs text-c-text-muted mt-1">this month</p>
                </div>

                <div className="bg-c-surface-raised border border-c-border-subtle rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={16} className="text-blue-400" />
                    <span className="text-xs text-c-text-secondary uppercase font-bold tracking-wider">
                      Requests
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-c-text">
                    {costSummary.totalRequestsThisMonth.toLocaleString()}
                  </p>
                  <p className="text-xs text-c-text-muted mt-1">AI interactions</p>
                </div>

                <div className="bg-c-surface-raised border border-c-border-subtle rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={16} className="text-c-accent" />
                    <span className="text-xs text-c-text-secondary uppercase font-bold tracking-wider">
                      Tokens
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-c-text">
                    {costSummary.totalTokensThisMonth >= 1000000
                      ? `${(costSummary.totalTokensThisMonth / 1000000).toFixed(1)}M`
                      : costSummary.totalTokensThisMonth >= 1000
                        ? `${(costSummary.totalTokensThisMonth / 1000).toFixed(1)}k`
                        : costSummary.totalTokensThisMonth}
                  </p>
                  <p className="text-xs text-c-text-muted mt-1">consumed</p>
                </div>

                <div className="bg-c-surface-raised border border-c-border-subtle rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Gauge size={16} className="text-amber-400" />
                    <span className="text-xs text-c-text-secondary uppercase font-bold tracking-wider">
                      Avg/Request
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-c-text">
                    $
                    {costSummary.totalRequestsThisMonth > 0
                      ? (
                          costSummary.totalCostThisMonth / costSummary.totalRequestsThisMonth
                        ).toFixed(3)
                      : '0.00'}
                  </p>
                  <p className="text-xs text-c-text-muted mt-1">cost efficiency</p>
                </div>
              </div>

              {/* Usage by Tier */}
              <div className="bg-c-surface-raised border border-c-border-subtle rounded-xl p-6">
                <h4 className="text-sm font-semibold text-c-text mb-4 flex items-center gap-2">
                  <BarChart2 size={16} className="text-c-accent" />
                  Usage by Tier
                </h4>
                <div className="space-y-3">
                  {[
                    { tier: 'Budget', requests: 85, cost: 1.2, color: 'emerald', percent: 67 },
                    { tier: 'Standard', requests: 35, cost: 2.45, color: 'blue', percent: 27 },
                    { tier: 'Premium', requests: 7, cost: 0.67, color: 'purple', percent: 6 },
                  ].map((stat) => (
                    <div key={stat.tier} className="flex items-center gap-4">
                      <div className="w-20 text-xs font-medium text-c-text-secondary">
                        {stat.tier}
                      </div>
                      <div className="flex-1 h-2 bg-c-surface rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-${stat.color}-500 rounded-full`}
                          style={{ width: `${stat.percent}%` }}
                        />
                      </div>
                      <div className="w-20 text-xs text-c-text-muted text-right">
                        {stat.requests} req
                      </div>
                      <div className="w-16 text-xs font-mono text-c-text text-right">
                        ${stat.cost.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-c-border-subtle flex justify-between items-center">
                  <span className="text-xs text-c-text-muted">Period: Jan 1 - Jan 31, 2026</span>
                  <button className="text-xs text-c-accent hover:text-c-accent flex items-center gap-1">
                    View Full History <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. BYOK Keys (API Tab) */}
        {activeTab === 'api' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-end mb-6">
              <SectionHeader
                title="Bring Your Own Keys"
                subtitle="Connect external providers securely."
              />
              <button
                onClick={() => {
                  setNewProvider(createEmptyProviderForm('openai'));
                  setShowAddProvider(true);
                }}
                className="text-xs uppercase tracking-wider font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 px-4 py-2 rounded hover:bg-blue-500/10 transition-colors flex items-center gap-2"
              >
                <Plus size={14} /> Add Key
              </button>
            </div>

            {/* Add Form */}
            {showAddProvider && (
              <div className="mb-8 p-6 bg-gradient-to-br from-c-surface to-c-surface-raised border border-c-border-subtle rounded-xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                <h4 className="text-c-text font-medium mb-4 flex items-center gap-2">
                  <Key size={16} className="text-blue-500" />
                  Add New API Key
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-c-text-muted font-bold mb-2">
                      Provider
                    </label>
                    <div className="relative">
                      <select
                        value={newProvider.provider}
                        onChange={(e) =>
                          setNewProvider({ ...newProvider, provider: e.target.value as any })
                        }
                        className="w-full bg-c-surface-raised border border-c-border-subtle rounded-lg px-4 py-3 text-c-text appearance-none focus:border-blue-500/50 outline-none transition"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="google">Google Gemini</option>
                        <option value="deepseek">DeepSeek</option>
                      </select>
                      <ChevronRight
                        className="absolute right-4 top-3.5 text-c-text-muted rotate-90 pointer-events-none"
                        size={14}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-c-text-muted font-bold mb-2">
                      Friendly Name
                    </label>
                    <input
                      placeholder="e.g. My Personal GPT-4 Key"
                      value={newProvider.name}
                      onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                      className="w-full bg-c-surface-raised border border-c-border-subtle rounded-lg px-4 py-3 text-c-text placeholder-c-text-muted focus:border-blue-500/50 outline-none transition"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-c-text-muted font-bold mb-2">
                      API Secret Key
                    </label>
                    <div className="relative">
                      <Key className="absolute left-4 top-3.5 text-c-text-secondary" size={16} />
                      <input
                        type="password"
                        placeholder="sk-..."
                        value={newProvider.apiKey}
                        onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                        className="w-full bg-c-surface-raised border border-c-border-subtle rounded-lg pl-12 pr-4 py-3 text-c-text placeholder-c-text-muted focus:border-blue-500/50 outline-none font-mono transition"
                      />
                    </div>
                    <p className="text-[10px] text-c-text-muted mt-2 flex items-center gap-1">
                      <Lock size={10} />
                      Stored locally in your browser. Never sent to our servers.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-c-border-subtle">
                  <button
                    onClick={() => setShowAddProvider(false)}
                    className="px-5 py-2 text-sm text-c-text-secondary hover:text-c-text transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddProvider}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-900/20 transition flex items-center gap-2"
                  >
                    <Save size={16} /> Save Key
                  </button>
                </div>
              </div>
            )}

            <div className="border border-c-border-subtle rounded-xl overflow-hidden bg-c-surface-raised">
              <table
                /* §27-exempt: panel konfiguracyjny/billingowy, mala tabela ustawien poza zakresem listowym */ className="w-full text-left border-collapse"
              >
                <thead>
                  <tr className="bg-c-surface-raised border-b border-c-border-subtle text-xs uppercase tracking-wider text-c-text-muted font-semibold">
                    <th className="px-6 py-4">Friendly Name</th>
                    <th className="px-6 py-4">Provider</th>
                    <th className="px-6 py-4">API Key Hash</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {apiProviders.map((p) => (
                    <tr key={p.id} className="hover:bg-c-surface-raised transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-c-text flex items-center gap-3">
                          <div className="p-2 bg-c-surface-raised rounded border border-c-border-subtle group-hover:border-c-border-subtle transition-colors">
                            <Globe size={16} className="text-blue-400" />
                          </div>
                          {p.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-c-text-secondary capitalize bg-c-surface-raised px-2 py-1 rounded border border-c-border-subtle">
                          {p.provider}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-c-text-secondary">
                        •••••••••••••••••{p.apiKey?.slice(-4)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => removeLocalProvider(p.id)}
                          className="text-c-text-muted hover:text-danger-400 p-2 rounded hover:bg-danger-500/10 transition-colors"
                          title="Remove Key"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {apiProviders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-c-text-muted">
                        <Key className="mx-auto mb-3 opacity-20" size={32} />
                        No personal API keys added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Local Models - TABLE VIEW */}
        {activeTab === 'local' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-end mb-6">
              <SectionHeader
                title="Local Inference Engine"
                subtitle="Connect to high-performance local models via Ollama."
              />
              {!showAddProvider && (
                <button
                  onClick={() => {
                    setNewProvider(createEmptyProviderForm('ollama'));
                    setShowAddProvider(true);
                  }}
                  className="text-xs uppercase tracking-wider font-bold text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 px-4 py-2 rounded hover:bg-emerald-500/10 transition-colors flex items-center gap-2"
                >
                  <Plus size={14} /> Connect Local
                </button>
              )}
            </div>

            {/* Active local model settings */}
            <div className="mb-6 p-4 bg-c-surface-raised border border-c-border-subtle rounded-xl">
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-wider text-c-text-muted font-bold mb-2">
                    Default Local Model ID
                  </label>
                  <input
                    value={localOllamaModelId}
                    onChange={(e) => setLocalOllamaModelId(e.target.value)}
                    placeholder="e.g. gemma3:27b"
                    className="w-full bg-c-surface-raised border border-c-border-subtle rounded-lg px-4 py-3 text-c-text placeholder-c-text-muted focus:border-emerald-500/50 outline-none transition font-mono"
                  />
                  <p className="text-[10px] text-c-text-muted mt-2">
                    Used when Chat is routed to Ollama.
                  </p>
                </div>
                <div className="flex gap-3">
                  {(currentUser.aiConfig as any)?.provider === 'ollama' ? (
                    <button
                      onClick={disableLocalInference}
                      className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-danger-300 border border-danger-500/30 rounded-lg hover:bg-danger-500/10 transition-colors"
                    >
                      Disable
                    </button>
                  ) : (
                    <div className="text-[10px] text-c-text-muted self-center">
                      Not active (using system routing)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Premium Local Connect Form */}
            {showAddProvider && (
              <div className="mb-8 p-6 bg-gradient-to-br from-c-surface to-c-surface-raised border border-c-border-subtle rounded-xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                <h4 className="text-c-text font-medium mb-4 flex items-center gap-2">
                  <Terminal size={16} className="text-emerald-500" />
                  Connect Local Instance
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-c-text-muted font-bold mb-2">
                      Connection Name
                    </label>
                    <input
                      placeholder="e.g. My MacBook Ollama"
                      value={newProvider.name}
                      onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                      className="w-full bg-c-surface-raised border border-c-border-subtle rounded-lg px-4 py-3 text-c-text placeholder-c-text-muted focus:border-emerald-500/50 outline-none transition"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-c-text-muted font-bold mb-2">
                      Endpoint URL
                    </label>
                    <div className="relative">
                      <Wifi className="absolute left-4 top-3.5 text-c-text-secondary" size={16} />
                      <input
                        placeholder="http://localhost:11434"
                        value={newProvider.endpoint}
                        onChange={(e) =>
                          setNewProvider({ ...newProvider, endpoint: e.target.value })
                        }
                        className="w-full bg-c-surface-raised border border-c-border-subtle rounded-lg pl-12 pr-4 py-3 text-c-text placeholder-c-text-muted focus:border-emerald-500/50 outline-none font-mono transition"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-c-border-subtle">
                  <button
                    onClick={() => setShowAddProvider(false)}
                    className="px-5 py-2 text-sm text-c-text-secondary hover:text-c-text transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddProvider}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition flex items-center gap-2"
                  >
                    <Zap size={16} /> Connect
                  </button>
                </div>
              </div>
            )}

            <div className="border border-c-border-subtle rounded-xl overflow-hidden bg-c-surface-raised">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-c-surface-raised border-b border-c-border-subtle text-xs uppercase tracking-wider text-c-text-muted font-semibold">
                    <th className="px-6 py-4">Instance Name</th>
                    <th className="px-6 py-4">Endpoint Type</th>
                    <th className="px-6 py-4">URL</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {localHostProviders.map((p) => (
                    <tr key={p.id} className="hover:bg-c-surface-raised transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-c-text flex items-center gap-3">
                          <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
                            <Terminal size={16} className="text-emerald-400" />
                          </div>
                          <div>
                            <div>{p.name}</div>
                            {String(p.endpoint || '') === activeOllamaEndpoint ? (
                              <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active for Chat
                              </div>
                            ) : (
                              <div className="text-[10px] text-c-text-muted mt-0.5">Not active</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-c-text-secondary">
                          Ollama / OpenAI Compatible
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-c-text-muted group-hover:text-c-text-muted transition-colors">
                        {p.endpoint}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {String(p.endpoint || '') !== activeOllamaEndpoint && (
                            <button
                              onClick={() => activateOllama(String(p.endpoint || ''))}
                              className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-colors"
                              title="Use this Ollama endpoint for chat"
                            >
                              Use
                            </button>
                          )}
                          <button
                            onClick={() => removeLocalProvider(p.id)}
                            className="text-c-text-muted hover:text-danger-400 p-2 rounded hover:bg-danger-500/10 transition-colors"
                            title="Disconnect"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {localHostProviders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-c-text-muted">
                        <Server className="mx-auto mb-3 opacity-20" size={32} />
                        No local inference engines connected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. Behavior & Context Settings */}
        {activeTab === 'behavior' && (
          <div className="animate-in fade-in duration-300 max-w-4xl">
            <SectionHeader
              title="Model Behavior"
              subtitle="Configure granular generation parameters and persona."
            />

            {/* System Instructions */}
            <div className="mb-8">
              <label className="flex items-center justify-between text-xs font-bold text-c-text-muted uppercase tracking-widest mb-3">
                <span className="flex items-center gap-2">
                  <Terminal size={14} />
                  Global System Instructions
                </span>
                <span className="text-c-text-secondary font-normal normal-case">
                  Applied to all chat sessions
                </span>
              </label>
              <textarea
                className="w-full bg-c-surface-raised border border-c-border-subtle rounded-xl p-4 text-sm font-mono text-c-text-secondary focus:border-c-border-subtle focus:ring-0 transition-colors h-32 resize-y"
                placeholder="e.g. You are a senior solutions architect. Always prioritize security and scalability in your responses..."
                value={preferences.systemInstructions || ''}
                onChange={(e) =>
                  setPreferences({ ...preferences, systemInstructions: e.target.value })
                }
              />
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 p-6 bg-c-surface-raised rounded-xl border border-c-border-subtle">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-medium text-c-text flex items-center gap-2">
                    <Gauge size={16} className="text-blue-400" />
                    Temperature
                  </label>
                  <span className="text-xs font-mono bg-c-surface-raised px-2 py-1 rounded text-blue-400">
                    {preferences.modelTemperature ?? 0.7}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={preferences.modelTemperature ?? 0.7}
                  onChange={(e) =>
                    setPreferences({ ...preferences, modelTemperature: parseFloat(e.target.value) })
                  }
                  className="w-full accent-blue-500 bg-c-surface-raised h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-c-text-muted mt-2 font-medium uppercase tracking-wider">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-medium text-c-text flex items-center gap-2">
                    <HardDrive size={16} className="text-c-accent" />
                    Max Output Tokens
                  </label>
                  <span className="text-xs font-mono bg-c-surface-raised px-2 py-1 rounded text-c-accent">
                    {preferences.maxTokens ?? 4096}
                  </span>
                </div>
                <input
                  type="number"
                  value={preferences.maxTokens ?? 4096}
                  onChange={(e) =>
                    setPreferences({ ...preferences, maxTokens: parseInt(e.target.value) })
                  }
                  className="w-full bg-c-surface-raised border border-c-border-subtle rounded px-3 py-2 text-sm text-c-text focus:border-c-accent outline-none transition font-mono"
                />
                <p className="text-[10px] text-c-text-muted mt-2">
                  Maximum length of generated response.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-medium text-c-text flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-400" />
                    Top P (Nucleus)
                  </label>
                  <span className="text-xs font-mono bg-c-surface-raised px-2 py-1 rounded text-amber-400">
                    {preferences.topP ?? 1.0}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={preferences.topP ?? 1.0}
                  onChange={(e) =>
                    setPreferences({ ...preferences, topP: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500 bg-c-surface-raised h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-medium text-c-text flex items-center gap-2">
                    <Activity size={16} className="text-emerald-400" />
                    Context Window
                  </label>
                </div>
                <select
                  value={preferences.contextWindowStrategy || 'auto'}
                  onChange={(e) =>
                    setPreferences({ ...preferences, contextWindowStrategy: e.target.value as any })
                  }
                  className="w-full bg-c-surface-raised border border-c-border-subtle rounded px-3 py-2 text-sm text-c-text focus:border-emerald-500/50 outline-none transition"
                >
                  <option value="auto">Auto (Recommended)</option>
                  <option value="limit_8k">Limit to 8k (Cost Saving)</option>
                  <option value="limit_16k">Limit to 16k</option>
                  <option value="full">Full Context</option>
                </select>
              </div>
            </div>

            {/* Response Mode Settings - NEW */}
            <SectionHeader
              title="Response Mode"
              subtitle="Configure default response length and style preferences."
            />

            {/* Mode Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[
                {
                  id: 'quick',
                  label: 'Quick',
                  desc: 'Szybkie, zwięzłe odpowiedzi',
                  tokens: '50-300',
                  icon: <Zap size={24} className="text-amber-400" />,
                  color: 'amber',
                },
                {
                  id: 'standard',
                  label: 'Standard',
                  desc: 'Zbalansowane z wyjaśnieniami',
                  tokens: '300-800',
                  icon: <MessageSquare size={24} className="text-blue-400" />,
                  color: 'blue',
                },
                {
                  id: 'deepStudy',
                  label: 'Deep Study',
                  desc: 'Kompleksowa analiza',
                  tokens: '1000-4000',
                  icon: <Brain size={24} className="text-c-accent" />,
                  color: 'purple',
                },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() =>
                    setPreferences(
                      (p) =>
                        ({
                          ...p,
                          contextualBehavior: {
                            ...p.contextualBehavior,
                            chatMode: mode.id as any,
                          },
                        }) as any
                    )
                  }
                  className={`p-5 rounded-xl border transition text-center ${
                    preferences.contextualBehavior?.chatMode === mode.id
                      ? `bg-${mode.color}-500/10 border-${mode.color}-500/50`
                      : 'bg-c-surface-raised border-c-border-subtle hover:border-c-border-subtle'
                  }`}
                >
                  <div className="mx-auto mb-3">{mode.icon}</div>
                  <div
                    className={`font-bold text-sm mb-1 ${
                      preferences.contextualBehavior?.chatMode === mode.id
                        ? `text-${mode.color}-400`
                        : 'text-c-text'
                    }`}
                  >
                    {mode.label}
                  </div>
                  <div className="text-xs text-c-text-muted mb-2">{mode.desc}</div>
                  <div className="text-xs font-mono text-c-text-secondary">
                    {mode.tokens} tokens
                  </div>
                </button>
              ))}
            </div>

            {/* Fine-tune Length Sliders */}
            <div className="p-6 bg-c-surface-raised rounded-xl border border-c-border-subtle mb-6">
              <h4 className="text-sm font-semibold text-c-text mb-4 flex items-center gap-2">
                <Settings size={16} className="text-c-text-secondary" />
                Fine-tune Response Length
              </h4>

              <div className="space-y-6">
                {/* Quick Mode Length */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-c-text-secondary">Quick Mode</span>
                    <span className="text-xs font-mono text-amber-400">
                      {preferences.responseLength?.quick || 'short'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    className="w-full accent-amber-500 bg-c-surface-raised h-1.5 rounded-lg appearance-none cursor-pointer"
                    value={['ultra_short', 'short', 'medium'].indexOf(
                      preferences.responseLength?.quick || 'short'
                    )}
                    onChange={(e) => {
                      const values = ['ultra_short', 'short', 'medium'] as const;
                      setPreferences(
                        (p) =>
                          ({
                            ...p,
                            responseLength: {
                              ...p.responseLength,
                              quick: values[parseInt(e.target.value)],
                            },
                          }) as any
                      );
                    }}
                  />
                  <div className="flex justify-between text-[10px] text-c-text-muted mt-1">
                    <span>Ultra Short (50)</span>
                    <span>Short (150)</span>
                    <span>Medium (300)</span>
                  </div>
                </div>

                {/* Standard Mode Length */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-c-text-secondary">Standard Mode</span>
                    <span className="text-xs font-mono text-blue-400">
                      {preferences.responseLength?.standard || 'medium'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    className="w-full accent-blue-500 bg-c-surface-raised h-1.5 rounded-lg appearance-none cursor-pointer"
                    value={['short', 'medium', 'long'].indexOf(
                      preferences.responseLength?.standard || 'medium'
                    )}
                    onChange={(e) => {
                      const values = ['short', 'medium', 'long'] as const;
                      setPreferences(
                        (p) =>
                          ({
                            ...p,
                            responseLength: {
                              ...p.responseLength,
                              standard: values[parseInt(e.target.value)],
                            },
                          }) as any
                      );
                    }}
                  />
                  <div className="flex justify-between text-[10px] text-c-text-muted mt-1">
                    <span>Short (250)</span>
                    <span>Medium (500)</span>
                    <span>Long (900)</span>
                  </div>
                </div>

                {/* Deep Study Length */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs text-c-text-secondary">Deep Study Mode</span>
                    <span className="text-xs font-mono text-c-accent">
                      {preferences.responseLength?.deepStudy || 'long'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    className="w-full accent-c-accent bg-c-surface-raised h-1.5 rounded-lg appearance-none cursor-pointer"
                    value={['medium', 'long', 'comprehensive'].indexOf(
                      preferences.responseLength?.deepStudy || 'long'
                    )}
                    onChange={(e) => {
                      const values = ['medium', 'long', 'comprehensive'] as const;
                      setPreferences(
                        (p) =>
                          ({
                            ...p,
                            responseLength: {
                              ...p.responseLength,
                              deepStudy: values[parseInt(e.target.value)],
                            },
                          }) as any
                      );
                    }}
                  />
                  <div className="flex justify-between text-[10px] text-c-text-muted mt-1">
                    <span>Medium (800)</span>
                    <span>Long (1800)</span>
                    <span>Comprehensive (3500)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-detect Intent Toggle */}
            <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-xl border border-c-border-subtle mb-8">
              <div>
                <div className="text-c-text font-medium text-sm">Auto-detect Intent</div>
                <div className="text-xs text-c-text-muted">
                  AI automatycznie wykryje czy potrzebujesz krótkiej czy szczegółowej odpowiedzi
                </div>
              </div>
              <Toggle
                enabled={preferences.contextualBehavior?.autoDetectIntent ?? true}
                onChange={() =>
                  setPreferences(
                    (p) =>
                      ({
                        ...p,
                        contextualBehavior: {
                          ...p.contextualBehavior,
                          autoDetectIntent: !(p.contextualBehavior?.autoDetectIntent ?? true),
                        },
                      }) as any
                  )
                }
              />
            </div>

            {/* Formatting Preferences */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <button
                onClick={() =>
                  setPreferences(
                    (p) =>
                      ({
                        ...p,
                        formatting: {
                          ...p.formatting,
                          preferBulletPoints: !p.formatting?.preferBulletPoints,
                        },
                      }) as any
                  )
                }
                className={`p-3 rounded-lg border text-center text-xs transition ${
                  preferences.formatting?.preferBulletPoints
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                    : 'bg-c-surface-raised border-c-border-subtle text-c-text-secondary hover:border-c-border-subtle'
                }`}
              >
                • Bullet Points
              </button>
              <button
                onClick={() =>
                  setPreferences(
                    (p) =>
                      ({
                        ...p,
                        formatting: {
                          ...p.formatting,
                          preferTables: !p.formatting?.preferTables,
                        },
                      }) as any
                  )
                }
                className={`p-3 rounded-lg border text-center text-xs transition ${
                  preferences.formatting?.preferTables
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                    : 'bg-c-surface-raised border-c-border-subtle text-c-text-secondary hover:border-c-border-subtle'
                }`}
              >
                ⊞ Tables
              </button>
              <button
                onClick={() =>
                  setPreferences(
                    (p) =>
                      ({
                        ...p,
                        formatting: {
                          ...p.formatting,
                          includeActionItems: !p.formatting?.includeActionItems,
                        },
                      }) as any
                  )
                }
                className={`p-3 rounded-lg border text-center text-xs transition ${
                  preferences.formatting?.includeActionItems
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                    : 'bg-c-surface-raised border-c-border-subtle text-c-text-secondary hover:border-c-border-subtle'
                }`}
              >
                ✓ Action Items
              </button>
              <button
                onClick={() =>
                  setPreferences(
                    (p) =>
                      ({
                        ...p,
                        formatting: {
                          ...p.formatting,
                          includeSources: !p.formatting?.includeSources,
                        },
                      }) as any
                  )
                }
                className={`p-3 rounded-lg border text-center text-xs transition ${
                  preferences.formatting?.includeSources
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                    : 'bg-c-surface-raised border-c-border-subtle text-c-text-secondary hover:border-c-border-subtle'
                }`}
              >
                📚 Sources
              </button>
            </div>

            <SectionHeader
              title="Persona Definition"
              subtitle="Define your role to tailor AI responses."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: 'executive',
                  label: 'Executive / Strategy',
                  desc: 'Strategic insights, no jargon.',
                },
                { id: 'manager', label: 'Project Manager', desc: 'Timeline-focused, risk-aware.' },
                { id: 'analyst', label: 'Business Analyst', desc: 'Data-driven, detailed output.' },
                {
                  id: 'developer',
                  label: 'Developer / Technical',
                  desc: 'Code-centric, architecture focus.',
                },
              ].map((role) => (
                <button
                  key={role.id}
                  onClick={() => setPreferences((p: any) => ({ ...p, userRole: role.id }))}
                  className={`text-left p-4 rounded-lg border transition ${
                    preferences.userRole === role.id
                      ? 'bg-blue-500/10 border-blue-500/50'
                      : 'bg-c-surface-raised border-c-border-subtle hover:border-c-border-subtle'
                  }`}
                >
                  <div
                    className={`font-semibold text-sm mb-1 ${preferences.userRole === role.id ? 'text-blue-400' : 'text-c-text'}`}
                  >
                    {role.label}
                  </div>
                  <div className="text-xs text-c-text-muted">{role.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Proactivity Tab */}
        {activeTab === 'proactivity' && (
          <div className="animate-in fade-in duration-300 max-w-4xl">
            <SectionHeader
              title="AI Proactivity Level"
              subtitle="Control how actively the AI assists you."
            />

            {/* Proactivity Selector */}
            <div className="mb-8 p-6 rounded-xl border border-c-border-subtle bg-c-surface-raised">
              <ProactivitySelector
                value={proactivityMode}
                onChange={setProactivityMode}
                maxAllowed={maxProactivity}
                showBehaviors={true}
              />
            </div>

            {/* Proactivity Explanation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div
                className={`p-4 rounded-xl border transition ${
                  proactivityMode === 'REACTIVE'
                    ? 'bg-c-surface border-c-border-strong'
                    : 'bg-c-surface-raised border-c-border-subtle'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Pause size={18} className="text-c-text-secondary" />
                  <h4 className="font-semibold text-c-text text-sm">Reactive Mode</h4>
                </div>
                <p className="text-xs text-c-text-secondary leading-relaxed">
                  AI remains silent until you explicitly ask. Perfect for experienced users who
                  prefer full control and only want help when requested.
                </p>
                <div className="mt-3 pt-3 border-t border-c-border-subtle space-y-1">
                  <div className="flex items-center gap-2 text-xs text-c-text-muted">
                    <span>✗</span> No auto-suggestions
                  </div>
                  <div className="flex items-center gap-2 text-xs text-c-text-muted">
                    <span>✗</span> No proactive nudges
                  </div>
                  <div className="flex items-center gap-2 text-xs text-c-text-muted">
                    <span>✗</span> No conversation initiation
                  </div>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border transition ${
                  proactivityMode === 'BALANCED'
                    ? 'bg-c-accent-soft border-c-accent'
                    : 'bg-c-surface-raised border-c-border-subtle'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Scale size={18} className="text-c-accent" />
                  <h4 className="font-semibold text-c-text text-sm">Balanced Mode</h4>
                </div>
                <p className="text-xs text-c-text-secondary leading-relaxed">
                  AI provides helpful suggestions when relevant, but waits for you to drive major
                  interactions. Recommended for most users.
                </p>
                <div className="mt-3 pt-3 border-t border-c-border-subtle space-y-1">
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <span>✓</span> Contextual suggestions
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <span>✓</span> Helpful nudges
                  </div>
                  <div className="flex items-center gap-2 text-xs text-c-text-muted">
                    <span>✗</span> No conversation initiation
                  </div>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border transition ${
                  proactivityMode === 'PROACTIVE'
                    ? 'bg-emerald-600/20 border-emerald-500/50'
                    : 'bg-c-surface-raised border-c-border-subtle'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={18} className="text-emerald-400" />
                  <h4 className="font-semibold text-c-text text-sm">Proactive Mode</h4>
                </div>
                <p className="text-xs text-c-text-secondary leading-relaxed">
                  AI actively monitors your work and proactively offers assistance, even starting
                  conversations about potential issues.
                </p>
                <div className="mt-3 pt-3 border-t border-c-border-subtle space-y-1">
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <span>✓</span> Active suggestions
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <span>✓</span> Continuous monitoring
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <span>✓</span> Proactive conversations
                  </div>
                </div>
              </div>
            </div>

            {/* Organization Limit Notice */}
            {maxProactivity !== 'PROACTIVE' && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-400 text-sm">Organization Limit</h4>
                  <p className="text-xs text-amber-400/80 mt-1">
                    Your organization has set the maximum proactivity level to{' '}
                    <strong>{maxProactivity}</strong>. Contact your administrator if you need a
                    higher level.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Privacy & Controls */}
        {activeTab === 'privacy' && (
          <div className="animate-in fade-in duration-300 max-w-4xl">
            <SectionHeader
              title="Data Privacy & Governance"
              subtitle="Manage how your data is handled and retained."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* PII Redaction */}
              <div className="p-6 rounded-xl border border-c-border-subtle bg-c-surface-raised hover:border-c-border-subtle transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-danger-500/20 text-danger-400">
                      <Fingerprint size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-c-text">PII Redaction</h3>
                      <p className="text-xs text-c-text-muted">Auto-remove sensitive data</p>
                    </div>
                  </div>
                  <Toggle
                    enabled={preferences.enablePiiRedaction || false}
                    onChange={() =>
                      setPreferences((p: any) => ({
                        ...p,
                        enablePiiRedaction: !p.enablePiiRedaction,
                      }))
                    }
                  />
                </div>
                <p className="text-xs text-c-text-secondary leading-relaxed border-t border-c-border-subtle pt-4">
                  Automatically detects and redacts emails, phone numbers, and credit card patterns
                  before sending to the model.
                </p>
              </div>

              {/* Web Search */}
              <div className="p-6 rounded-xl border border-c-border-subtle bg-c-surface-raised hover:border-c-border-subtle transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                      <Globe size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-c-text">Web Connectivity</h3>
                      <p className="text-xs text-c-text-muted">Allow external searches</p>
                    </div>
                  </div>
                  <Toggle
                    enabled={preferences.enableWebSearch || false}
                    onChange={() =>
                      setPreferences((p: any) => ({ ...p, enableWebSearch: !p.enableWebSearch }))
                    }
                  />
                </div>
                <p className="text-xs text-c-text-secondary leading-relaxed border-t border-c-border-subtle pt-4">
                  Enables the model to search the web for real-time information. May increase
                  latency.
                </p>
              </div>
            </div>

            {/* Retention Policy */}
            <div className="p-6 rounded-xl border border-c-border-subtle bg-c-surface-raised">
              <h3 className="text-sm font-semibold text-c-text mb-6 flex items-center gap-2">
                <Activity size={16} className="text-emerald-400" />
                Data Retention Policy
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    id: 'none',
                    label: 'Ephemeral',
                    desc: 'No data saved',
                    icon: <Trash2 size={16} />,
                  },
                  {
                    id: '30days',
                    label: '30 Days',
                    desc: 'Standard rotation',
                    icon: <Activity size={16} />,
                  },
                  {
                    id: 'standard',
                    label: 'Indefinite',
                    desc: 'Full history',
                    icon: <HardDrive size={16} />,
                  },
                ].map((policy) => (
                  <button
                    key={policy.id}
                    onClick={() =>
                      setPreferences((p: any) => ({ ...p, dataRetentionPolicy: policy.id as any }))
                    }
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border transition gap-3 ${
                      preferences.dataRetentionPolicy === policy.id
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                        : 'bg-c-surface-raised border-c-border-subtle text-c-text-secondary hover:border-c-border-subtle'
                    }`}
                  >
                    {policy.icon}
                    <div className="text-center">
                      <div className="font-semibold text-xs">{policy.label}</div>
                      <div className="text-[10px] opacity-70">{policy.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Minimal Footer */}
      <div className="mt-12 border-t border-c-border-subtle pt-6 flex justify-between items-center text-[10px] text-c-text-secondary uppercase tracking-widest">
        <span>AI Governance v2.4.0</span>
        <Link to="/legal/ai-policy" className="hover:text-c-text-muted transition-colors">
          Safety Policy &rarr;
        </Link>
      </div>
    </div>
  );
};

// UI Components
const NavTab = ({ id, label, icon, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-full border transition font-medium text-xs whitespace-nowrap ${
      active
        ? 'bg-navy-900 dark:bg-c-surface text-white dark:text-navy-950 border-navy-900 dark:border-white shadow-sm'
        : 'text-c-text-muted border-transparent hover:text-c-text dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-navy-800/20'
    }`}
  >
    {icon}
    {label}
  </button>
);

const SectionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="mb-6">
    <h3 className="text-lg font-medium text-c-text">{title}</h3>
    <p className="text-sm text-c-text-muted mt-1">{subtitle}</p>
  </div>
);

const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
  <button
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black ${
      enabled ? 'bg-blue-600' : 'bg-c-surface'
    }`}
  >
    <span
      className={`${
        enabled ? 'translate-x-6' : 'translate-x-1'
      } inline-block h-4 w-4 transform rounded-full bg-c-surface transition-transform`}
    />
  </button>
);
