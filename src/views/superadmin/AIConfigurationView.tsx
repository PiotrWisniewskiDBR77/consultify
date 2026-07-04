import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Check,
  CheckCircle,
  Cpu,
  Database,
  DollarSign,
  Edit,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Hand,
  History,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wand2,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import {
  AuditLogViewer,
  SettingsCard,
  SettingsSlider,
  SettingsToggle,
} from '../../components/AISettings';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';
import { SuperAdminAISettings } from '../../types';
import { LLMProvider, LLMProviderConfig } from '../../types/domain/ai';

// AI Capability definitions with their prompt keys
const AI_CAPABILITIES = [
  {
    id: 'chat',
    name: 'AI Chat',
    icon: MessageSquare,
    description: 'Main AI assistant for conversations',
    promptKey: 'system_chat',
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'magic_wand',
    name: 'Magic Wand',
    icon: Wand2,
    description: 'Field auto-suggestions',
    promptKey: 'system_magic_wand',
    color: 'from-primary-500 to-primary-600',
  },
  {
    id: 'reports',
    name: 'Report Generator',
    icon: FileText,
    description: 'Report and analysis generation',
    promptKey: 'system_reports',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    id: 'initiative_analysis',
    name: 'Initiative Analysis',
    icon: Target,
    description: 'Initiative scoring and analysis',
    promptKey: 'system_initiative',
    color: 'from-amber-500 to-amber-600',
  },
  {
    id: 'max_mode',
    name: 'MAX Mode (Deep Reasoning)',
    icon: Sparkles,
    description: 'Deep analysis with chain-of-thought',
    promptKey: 'system_max_reasoner',
    color: 'from-danger-500 to-danger-600',
  },
  {
    id: 'coach',
    name: 'AI Coach',
    icon: Brain,
    description: 'PMO coaching and mentoring',
    promptKey: 'system_coach',
    color: 'from-blue-500 to-blue-600',
  },
];

// Tabs for AI Configuration
type AIConfigTab = 'functions' | 'providers' | 'routing' | 'usage' | 'health' | 'settings';

export const AIConfigurationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AIConfigTab>('functions');
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Record<string, { content: string; updated_at?: string }>>(
    {}
  );
  const [editingPrompt, setEditingPrompt] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Usage stats
  const [usageStats, setUsageStats] = useState<any>(null);
  const [costStats, setCostStats] = useState<any>(null);

  // Health status
  const [healthStatus, setHealthStatus] = useState<any>(null);

  // SuperAdmin Global Settings
  const [globalSettings, setGlobalSettings] = useState<SuperAdminAISettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Providers
  const [providers, setProviders] = useState<LLMProviderConfig[]>([]);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [providerForm, setProviderForm] = useState<Partial<LLMProviderConfig>>({
    name: '',
    provider: 'openai',
    apiKey: '',
    api_key: '',
    baseUrl: '',
    endpoint: '',
    model: '',
    model_id: '',
    isEnabled: true,
    is_active: true,
    isDefault: false,
    tier: 'standard',
    maxTokens: 4096,
    contextWindow: 4096,
    capabilities: ['text'],
    visibility: 'admin',
    cost_per_1k: 0,
    costPerInputToken: 0,
    costPerOutputToken: 0,
  });

  // Ollama
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<{ name: string; size?: number }[]>([]);
  const [testingOllama, setTestingOllama] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load prompts
      const promptsData = await Api.aiGetSystemPrompts();
      const promptsMap: Record<string, any> = {};
      promptsData.forEach((p: any) => {
        promptsMap[p.key] = { content: p.content, updated_at: p.updated_at };
      });
      setPrompts(promptsMap);

      // Load providers
      const providersData = await Api.getLLMProviders();
      setProviders(providersData);

      // Load usage stats
      try {
        const usage = await Api.getLLMControlUsage();
        setUsageStats(usage);
      } catch (e) {
        console.error('Usage load failed:', e);
      }

      // Load costs
      try {
        const costs = await Api.getLLMCosts();
        setCostStats(costs);
      } catch (e) {
        console.error('Costs load failed:', e);
      }

      // Load health
      try {
        const health = await Api.diagnoseLLM();
        setHealthStatus(health);
      } catch (e) {
        console.error('Health load failed:', e);
      }

      // Load global AI settings
      try {
        const settings = await Api.getSuperAdminAISettings();
        setGlobalSettings(settings);
      } catch (e) {
        console.error('Global settings load failed:', e);
      }
    } catch (err) {
      console.error('Failed to load AI config data:', err);
      toast.error('Failed to load AI configuration');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Save global settings
  const saveGlobalSettings = async () => {
    if (!globalSettings) return;
    setSavingSettings(true);
    try {
      const updated = await Api.updateSuperAdminAISettings(globalSettings);
      setGlobalSettings(updated);
      toast.success('Global settings saved');
    } catch (e) {
      toast.error('Failed to save settings');
    }
    setSavingSettings(false);
  };

  const updateGlobalSetting = <K extends keyof SuperAdminAISettings>(
    key: K,
    value: SuperAdminAISettings[K]
  ) => {
    setGlobalSettings((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const selectCapability = (capabilityId: string) => {
    const cap = AI_CAPABILITIES.find((c) => c.id === capabilityId);
    if (cap) {
      setSelectedCapability(capabilityId);
      setEditingPrompt(prompts[cap.promptKey]?.content || getDefaultPrompt(capabilityId));
    }
  };

  const getDefaultPrompt = (capabilityId: string): string => {
    const defaults: Record<string, string> = {
      chat: `You are a professional AI consultant for the Consultify platform.
Your role: Help users manage digital transformation projects.

RULES:
- Respond concisely and specifically
- Use DRD (Digital Readiness Diagnostic) methodology
- Cite knowledge base sources when possible
- Propose concrete actions, not just theories
- Be supportive but professional`,

      magic_wand: `You are an assistant for form field auto-completion.
Generate short, accurate suggestions based on screen and project context.

RESPONSE FORMAT:
- suggestion: main suggestion (max 500 chars)
- reasoning: brief justification
- confidence: high/medium/low
- alternatives: 2-3 alternative proposals`,

      reports: `You are a PMO reports and strategic analysis expert.
Generate professional reports compliant with ISO 21500 and PMBOK standards.`,

      initiative_analysis: `You are a strategic analyst evaluating transformation initiatives.

EVALUATION CRITERIA:
- Strategic Alignment (1-5)
- Business Impact (1-5)
- Technical Feasibility (1-5)
- Resource Requirements (S/M/L)
- Risk Level (Low/Medium/High)`,

      max_mode: `You are a top-level strategic expert.
Use deep reasoning (chain-of-thought) for complex problem analysis.

THINKING PROTOCOL:
1. <thinking> - internal step-by-step analysis
2. Consider all perspectives
3. Identify hidden assumptions
4. Evaluate trade-offs
5. </thinking> - summary for user`,

      coach: `You are a PMO coach and digital transformation mentor.
Help leaders develop change management competencies.`,
    };
    return defaults[capabilityId] || '';
  };

  const savePrompt = async () => {
    if (!selectedCapability) return;

    const cap = AI_CAPABILITIES.find((c) => c.id === selectedCapability);
    if (!cap) return;

    setSaving(true);
    try {
      await Api.aiUpdateSystemPrompt(cap.promptKey, { content: editingPrompt });
      setPrompts((prev) => ({
        ...prev,
        [cap.promptKey]: { content: editingPrompt, updated_at: new Date().toISOString() },
      }));
      toast.success(`Saved instructions for ${cap.name}`);
    } catch (err) {
      toast.error('Failed to save');
    }
    setSaving(false);
  };

  // Provider management
  const handleProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProviderId) {
        await Api.updateLLMProvider(editingProviderId, providerForm as any);
        toast.success('Provider updated');
      } else {
        await Api.addLLMProvider(providerForm as any);
        toast.success('Provider added');
      }
      setShowProviderModal(false);
      setEditingProviderId(null);
      resetProviderForm();
      loadInitialData();
    } catch (err) {
      toast.error('Operation failed');
    }
  };

  const resetProviderForm = () => {
    setProviderForm({
      name: '',
      provider: 'openai',
      api_key: '',
      endpoint: '',
      model_id: '',
      is_active: true,
      visibility: 'admin',
      cost_per_1k: 0,
    });
  };

  const handleEditProvider = (p: LLMProviderConfig) => {
    setEditingProviderId(p.id);
    setProviderForm(p);
    setShowProviderModal(true);
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return;
    try {
      await Api.deleteLLMProvider(id);
      toast.success('Provider deleted');
      loadInitialData();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const testOllamaConnection = async () => {
    setTestingOllama(true);
    try {
      const result = await Api.testOllamaConnection(ollamaEndpoint);
      if (result.success) {
        setOllamaConnected(true);
        setOllamaModels(result.models || []);
        toast.success(result.message || 'Connected to Ollama!');
      } else {
        setOllamaConnected(false);
        setOllamaModels([]);
        toast.error(result.error || 'Connection failed');
      }
    } catch (err) {
      setOllamaConnected(false);
      setOllamaModels([]);
      toast.error('Failed to connect to Ollama');
    }
    setTestingOllama(false);
  };

  const addOllamaModel = async (modelName: string) => {
    try {
      await Api.addLLMProvider({
        name: `Ollama - ${modelName}`,
        provider: 'ollama',
        model: modelName,
        apiKey: '',
        api_key: '',
        endpoint: ollamaEndpoint,
        baseUrl: ollamaEndpoint,
        model_id: modelName,
        isEnabled: true,
        is_active: true,
        isDefault: false,
        tier: 'standard',
        maxTokens: 4096,
        contextWindow: 4096,
        capabilities: ['text'],
        visibility: 'public',
        cost_per_1k: 0,
        costPerInputToken: 0,
        costPerOutputToken: 0,
      } as any);
      toast.success(`Added ${modelName}`);
      loadInitialData();
    } catch (err) {
      toast.error('Failed to add model');
    }
  };

  const handleTestConnection = async (config: Partial<LLMProviderConfig>) => {
    setTestingConnection(true);
    try {
      const result = await Api.testLLMConnection(config as any);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(`Connection Failed: ${result.message}`);
      }
    } catch (err) {
      toast.error('Test failed to execute');
    }
    setTestingConnection(false);
  };

  const tabs = [
    { id: 'functions' as AIConfigTab, label: 'AI Functions', icon: Brain },
    { id: 'providers' as AIConfigTab, label: 'LLM Providers', icon: Cpu },
    { id: 'routing' as AIConfigTab, label: 'Model Routing', icon: Settings },
    { id: 'usage' as AIConfigTab, label: 'Usage & Costs', icon: BarChart3 },
    { id: 'health' as AIConfigTab, label: 'System Health', icon: Activity },
    { id: 'settings' as AIConfigTab, label: 'Global Settings', icon: Shield },
  ];

  return (
    <div className="h-full flex flex-col bg-c-bg overflow-hidden relative">
      <InfoButton cardId="superadmin-ai-config" position="top-right" />
      {/* Header */}
      <div className="shrink-0 px-8 py-6 border-b border-c-border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Brain className="text-c-text" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-c-text">LLM Management</h1>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Manage AI behavior, providers, and system health
              </p>
            </div>
          </div>
          <InfoButton
            cardId="superadmin-ai-config"
            position="header-inline"
            size="md"
            showLabel
            label="Help"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-8 py-3 border-b border-c-border-subtle flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/20'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* AI Functions Tab */}
        {activeTab === 'functions' && (
          <div className="h-full flex">
            {/* Capabilities List */}
            <div className="w-80  border-c-border-subtle overflow-y-auto p-4">
              <h3 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-3 px-2">
                AI Functions
              </h3>
              <div className="space-y-2">
                {AI_CAPABILITIES.map((cap) => {
                  const Icon = cap.icon;
                  const hasCustomPrompt = !!prompts[cap.promptKey]?.content;
                  return (
                    <button
                      key={cap.id}
                      onClick={() => selectCapability(cap.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                        selectedCapability === cap.id
                          ? 'bg-white/10 border border-blue-500/50'
                          : 'hover:bg-slate-50 dark:hover:bg-navy-800/20 border border-transparent'
                      }`}
                    >
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${cap.color}`}>
                        <Icon size={18} className="text-c-text" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-c-text text-sm truncate">{cap.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {cap.description}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {hasCustomPrompt ? (
                          <CheckCircle size={14} className="text-emerald-400" />
                        ) : (
                          <AlertTriangle size={14} className="text-amber-400" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt Editor */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedCapability ? (
                <>
                  <div className="shrink-0 p-4 border-b border-c-border-subtle flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-c-text">
                        Instructions for:{' '}
                        {AI_CAPABILITIES.find((c) => c.id === selectedCapability)?.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Prompt key:{' '}
                        <code className="text-blue-400">
                          {AI_CAPABILITIES.find((c) => c.id === selectedCapability)?.promptKey}
                        </code>
                      </p>
                    </div>
                    <button
                      onClick={savePrompt}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {saving ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      Save
                    </button>
                  </div>
                  <div className="flex-1 p-4 overflow-hidden">
                    <textarea
                      value={editingPrompt}
                      onChange={(e) => setEditingPrompt(e.target.value)}
                      placeholder="Enter AI instructions..."
                      className="w-full h-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-c-border-subtle rounded-xl p-4 text-slate-900 dark:text-white text-sm font-mono resize-none focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="shrink-0 p-4 border-t border-c-border-subtle text-xs text-slate-500 dark:text-slate-400">
                    💡 Tip: Use placeholders like{' '}
                    <code className="text-blue-400">{'{{project_name}}'}</code>,{' '}
                    <code className="text-blue-400">{'{{user_role}}'}</code>,{' '}
                    <code className="text-blue-400">{'{{screen_context}}'}</code>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <div className="text-center">
                    <Brain size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Select an AI function to edit its instructions</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Providers Tab */}
        {activeTab === 'providers' && (
          <div className="p-8 overflow-y-auto h-full space-y-6">
            {/* Ollama Local Models */}
            <div className="bg-gradient-to-br from-primary-900/30 to-navy-900 border border-primary-500/20 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary-500/20">
                  <Server size={20} className="text-primary-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-c-text">Ollama Local Models</h3>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Connect to local Ollama for privacy-focused AI
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  value={ollamaEndpoint}
                  onChange={(e) => setOllamaEndpoint(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="flex-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded-lg px-4 py-2 text-slate-900 dark:text-white text-sm"
                />
                <button
                  onClick={testOllamaConnection}
                  disabled={testingOllama}
                  className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {testingOllama ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : ollamaConnected ? (
                    <Wifi size={16} />
                  ) : (
                    <WifiOff size={16} />
                  )}
                  {testingOllama ? 'Testing...' : 'Test Connection'}
                </button>
              </div>

              {ollamaConnected === true && ollamaModels.length > 0 && (
                <div className="bg-c-bg/50 rounded-lg p-4">
                  <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                    Available Models (click to add)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ollamaModels.map((model) => {
                      const alreadyAdded = providers.some(
                        (p) => p.provider === 'ollama' && p.model_id === model.name
                      );
                      return (
                        <button
                          key={model.name}
                          onClick={() => !alreadyAdded && addOllamaModel(model.name)}
                          disabled={alreadyAdded}
                          className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                            alreadyAdded
                              ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                              : 'bg-primary-500/20 text-primary-300 hover:bg-primary-500/30'
                          }`}
                        >
                          {alreadyAdded && <Check size={12} />}
                          {model.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {ollamaConnected === false && (
                <p className="text-danger-400 text-sm">
                  Unable to connect. Make sure Ollama is running.
                </p>
              )}
            </div>

            {/* Cloud Providers */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-c-text">LLM Providers</h2>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                  Configure AI models available to tenants
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowInactive(!showInactive)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm font-medium ${showInactive ? 'bg-white/10 border-c-border text-c-text' : 'border-c-border-subtle text-slate-400 dark:text-slate-500 hover:text-white'}`}
                >
                  {showInactive ? <Eye size={16} /> : <EyeOff size={16} />}
                  {showInactive ? 'Hide Inactive' : 'Show Inactive'}
                </button>
                <button
                  onClick={() => {
                    setEditingProviderId(null);
                    resetProviderForm();
                    setShowProviderModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus size={16} /> Add Provider
                </button>
              </div>
            </div>

            <div className="bg-c-surface border border-c-border-subtle rounded-xl overflow-hidden">
              <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 text-slate-500 dark:text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Provider</th>
                    <th className="px-6 py-4 font-medium">Model ID</th>
                    <th className="px-6 py-4 font-medium">Visibility</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : providers.filter((p) => showInactive || p.is_active).length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        No providers configured
                      </td>
                    </tr>
                  ) : (
                    providers
                      .filter((p) => showInactive || p.is_active)
                      .map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-c-text">{p.name}</td>
                          <td className="px-6 py-4 text-slate-300 capitalize">{p.provider}</td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-400 dark:text-slate-500">
                            {p.model_id}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-1 rounded text-xs ${p.visibility === 'public' ? 'bg-emerald-500/20 text-emerald-400' : p.visibility === 'beta' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                            >
                              {p.visibility}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {p.is_active ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <Check size={14} /> Active
                              </span>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">Inactive</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleTestConnection(p)}
                                title="Test Connection"
                                disabled={testingConnection}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg text-slate-400 dark:text-slate-500 hover:text-emerald-400 transition-colors"
                              >
                                <Wifi size={16} />
                              </button>
                              <button
                                onClick={() => handleEditProvider(p)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg text-slate-400 dark:text-slate-500 hover:text-white"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteProvider(p.id)}
                                className="p-2 hover:bg-danger-500/20 rounded-lg text-slate-400 dark:text-slate-500 hover:text-danger-400"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Routing Tab */}
        {activeTab === 'routing' && (
          <div className="p-8 overflow-y-auto h-full">
            <div className="max-w-3xl mx-auto">
              <div className="bg-c-surface border border-c-border-subtle rounded-xl p-6">
                <h3 className="text-lg font-semibold text-c-text mb-4">Model Routing per Tier</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">
                  Define which LLM model to use for different complexity levels.
                </p>

                <div className="space-y-4">
                  {[
                    {
                      tier: 'BUDGET',
                      label: 'Budget Tier',
                      desc: 'Simple questions, fast responses',
                      default: 'gpt-4o-mini',
                    },
                    {
                      tier: 'STANDARD',
                      label: 'Standard Tier',
                      desc: 'Most tasks (chat, magic wand)',
                      default: 'gpt-4o',
                    },
                    {
                      tier: 'PREMIUM',
                      label: 'Premium Tier',
                      desc: 'Complex analysis, reports',
                      default: 'gpt-4o',
                    },
                    {
                      tier: 'REASONING',
                      label: 'Reasoning Tier',
                      desc: 'MAX Mode, deep thinking',
                      default: 'gpt-4o',
                    },
                  ].map((item) => (
                    <div
                      key={item.tier}
                      className="flex items-center gap-4 p-4 bg-c-bg/50 rounded-lg border border-c-border-subtle"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-c-text">{item.label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.desc}
                        </div>
                      </div>
                      <select className="bg-c-surface-raised border border-c-border-subtle rounded-lg px-3 py-2 text-sm text-c-text focus:border-blue-500 outline-none">
                        <option>{item.default}</option>
                        {providers
                          .filter((p) => p.is_active)
                          .map((p) => (
                            <option key={p.id} value={p.model_id}>
                              {p.model_id}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Usage Tab */}
        {activeTab === 'usage' && (
          <div className="p-8 overflow-y-auto h-full">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={Zap}
                label="Tokens Today"
                value={usageStats?.user?.tokens_used_today?.toLocaleString() || '0'}
                color="text-yellow-400"
              />
              <StatCard
                icon={DollarSign}
                label="Cost (30 days)"
                value={`$${(costStats?.totals?.costUsd || 0).toFixed(4)}`}
                color="text-emerald-400"
              />
              <StatCard
                icon={Activity}
                label="Requests (30 days)"
                value={costStats?.totals?.requests?.toLocaleString() || '0'}
                color="text-blue-400"
              />
              <StatCard
                icon={TrendingUp}
                label="Cache Hit Rate"
                value={`${usageStats?.cache?.hitRate || 0}%`}
                color="text-primary-400"
              />
            </div>

            {costStats?.byModel && costStats.byModel.length > 0 && (
              <div className="bg-c-surface border border-c-border-subtle rounded-xl p-6">
                <h3 className="text-lg font-semibold text-c-text mb-4">Costs per Model</h3>
                <div className="space-y-3">
                  {costStats.byModel.map((m: any) => (
                    <div
                      key={m.model}
                      className="flex items-center gap-4 p-3 bg-c-bg/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="text-sm text-c-text">{m.model}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {m.requests} requests
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-emerald-400">${(m.cost || 0).toFixed(4)}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {(m.tokens || 0).toLocaleString()} tokens
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Health Tab */}
        {activeTab === 'health' && (
          <div className="p-8 overflow-y-auto h-full">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* System Status */}
              <div className="bg-c-surface border border-c-border-subtle rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-c-text">AI System Status</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      healthStatus?.status === 'OK'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {healthStatus?.status || 'Unknown'}
                  </span>
                </div>

                <div className="space-y-3">
                  {healthStatus?.checks?.map((check: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 border-b border-c-border-subtle last:border-0"
                    >
                      <span className="text-sm text-slate-300">{check.name}</span>
                      <span
                        className={`text-sm ${
                          check.status === 'OK'
                            ? 'text-emerald-400'
                            : check.status === 'MISSING'
                              ? 'text-amber-400'
                              : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {check.status || check.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Capabilities Health */}
              <div className="bg-c-surface border border-c-border-subtle rounded-xl p-6">
                <h3 className="text-lg font-semibold text-c-text mb-4">Test Capabilities</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'connection', icon: Zap, label: 'Connection' },
                    { id: 'eyes', icon: Eye, label: 'AI Eyes (Visual)' },
                    { id: 'memory', icon: Database, label: 'AI Memory (RAG)' },
                    { id: 'hands', icon: Hand, label: 'AI Hands (Tools)' },
                  ].map((cap) => (
                    <button
                      key={cap.id}
                      className="flex items-center gap-3 p-4 bg-c-bg/50 border border-c-border-subtle rounded-lg hover:bg-c-bg hover:border-c-border-subtle transition-colors"
                    >
                      <cap.icon size={20} className="text-blue-400" />
                      <span className="text-sm text-c-text">{cap.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Settings Tab */}
        {activeTab === 'settings' && (
          <div className="p-8 overflow-y-auto h-full">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Header with Save Button */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-c-text">Global AI Settings</h2>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                    Platform-wide AI configuration. These settings apply to all organizations.
                  </p>
                </div>
                <button
                  onClick={saveGlobalSettings}
                  disabled={savingSettings || !globalSettings}
                  className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {savingSettings ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              </div>

              {globalSettings ? (
                <>
                  {/* Infrastructure Settings */}
                  <SettingsCard
                    title="Infrastructure"
                    description="Provider failover and circuit breaker configuration"
                    icon={Server}
                    iconColor="text-blue-400"
                  >
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
                          Default Provider
                        </label>
                        <select
                          value={globalSettings.defaultProvider || ''}
                          onChange={(e) =>
                            updateGlobalSetting('defaultProvider', e.target.value || null)
                          }
                          className="w-full bg-c-surface-raised/50 border border-c-border rounded-lg p-2 text-c-text focus:border-c-focus-solid outline-none"
                        >
                          <option value="">Auto (First Available)</option>
                          {providers
                            .filter((p) => p.is_active)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
                            Failure Threshold
                          </label>
                          <input
                            type="number"
                            value={globalSettings.circuitBreakerConfig.failureThreshold}
                            onChange={(e) =>
                              updateGlobalSetting('circuitBreakerConfig', {
                                ...globalSettings.circuitBreakerConfig,
                                failureThreshold: parseInt(e.target.value) || 5,
                              })
                            }
                            className="w-full bg-c-surface-raised/50 border border-c-border rounded-lg p-2 text-c-text focus:border-c-focus-solid outline-none"
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Failures before circuit opens
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
                            Cooldown (seconds)
                          </label>
                          <input
                            type="number"
                            value={globalSettings.circuitBreakerConfig.cooldownSeconds}
                            onChange={(e) =>
                              updateGlobalSetting('circuitBreakerConfig', {
                                ...globalSettings.circuitBreakerConfig,
                                cooldownSeconds: parseInt(e.target.value) || 60,
                              })
                            }
                            className="w-full bg-c-surface-raised/50 border border-c-border rounded-lg p-2 text-c-text focus:border-c-focus-solid outline-none"
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Wait before retry
                          </p>
                        </div>
                      </div>
                    </div>
                  </SettingsCard>

                  {/* Global Limits */}
                  <SettingsCard
                    title="Global Limits"
                    description="Token and rate limits for the entire platform"
                    icon={Globe}
                    iconColor="text-emerald-400"
                  >
                    <div className="space-y-6">
                      <SettingsSlider
                        label="Global Token Limit"
                        description="Maximum tokens across all organizations per month"
                        value={globalSettings.globalTokenLimit}
                        onChange={(v) => updateGlobalSetting('globalTokenLimit', v)}
                        min={1000000}
                        max={100000000}
                        step={1000000}
                        formatValue={(v) => `${(v / 1000000).toFixed(0)}M`}
                        defaultValue={10000000}
                      />

                      <SettingsSlider
                        label="Max Context Window"
                        description="Maximum context size in tokens"
                        value={globalSettings.maxContextWindowSize}
                        onChange={(v) => updateGlobalSetting('maxContextWindowSize', v)}
                        min={4096}
                        max={200000}
                        step={4096}
                        formatValue={(v) => `${(v / 1000).toFixed(0)}k`}
                        defaultValue={128000}
                      />

                      <SettingsSlider
                        label="Max Tokens Per Request"
                        description="Maximum output tokens per single request"
                        value={globalSettings.maxTokensPerRequest}
                        onChange={(v) => updateGlobalSetting('maxTokensPerRequest', v)}
                        min={1024}
                        max={16384}
                        step={512}
                        defaultValue={8192}
                      />

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-c-border/50">
                        <div>
                          <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
                            Requests per Minute
                          </label>
                          <input
                            type="number"
                            value={globalSettings.globalRateLimit.requestsPerMinute}
                            onChange={(e) =>
                              updateGlobalSetting('globalRateLimit', {
                                ...globalSettings.globalRateLimit,
                                requestsPerMinute: parseInt(e.target.value) || 60,
                              })
                            }
                            className="w-full bg-c-surface-raised/50 border border-c-border rounded-lg p-2 text-c-text focus:border-c-focus-solid outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
                            Requests per Hour
                          </label>
                          <input
                            type="number"
                            value={globalSettings.globalRateLimit.requestsPerHour}
                            onChange={(e) =>
                              updateGlobalSetting('globalRateLimit', {
                                ...globalSettings.globalRateLimit,
                                requestsPerHour: parseInt(e.target.value) || 1000,
                              })
                            }
                            className="w-full bg-c-surface-raised/50 border border-c-border rounded-lg p-2 text-c-text focus:border-c-focus-solid outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </SettingsCard>

                  {/* Security & PII */}
                  <SettingsCard
                    title="Security & Privacy"
                    description="PII detection, encryption, and data residency"
                    icon={Lock}
                    iconColor="text-danger-400"
                  >
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
                          PII Detection Sensitivity
                        </label>
                        <div className="flex gap-2">
                          {(['low', 'medium', 'high'] as const).map((level) => (
                            <button
                              key={level}
                              onClick={() => updateGlobalSetting('piiDetectionSensitivity', level)}
                              className={`
                                                                flex-1 py-2 px-4 rounded-lg border transition-all capitalize
                                                                ${
                                                                  globalSettings.piiDetectionSensitivity ===
                                                                  level
                                                                    ? 'bg-primary-500/20 border-primary-500 text-primary-300'
                                                                    : 'bg-c-surface-raised/50 border-c-border text-slate-400 dark:text-slate-500 hover:border-slate-600'
                                                                }
                                                            `}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          Higher sensitivity may increase false positives but better protects user
                          data
                        </p>
                      </div>

                      <SettingsToggle
                        label="Require Encryption"
                        description="Enforce encryption for all AI communications"
                        checked={globalSettings.requireEncryption}
                        onChange={(v) => updateGlobalSetting('requireEncryption', v)}
                        icon={Shield}
                        iconColor="text-emerald-400"
                      />

                      <div>
                        <label className="block text-sm text-slate-400 dark:text-slate-500 mb-2">
                          Data Residency
                        </label>
                        <select
                          value={globalSettings.dataResidency || ''}
                          onChange={(e) =>
                            updateGlobalSetting('dataResidency', e.target.value || null)
                          }
                          className="w-full bg-c-surface-raised/50 border border-c-border rounded-lg p-2 text-c-text focus:border-c-focus-solid outline-none"
                        >
                          <option value="">No Restriction</option>
                          <option value="eu">European Union</option>
                          <option value="us">United States</option>
                          <option value="uk">United Kingdom</option>
                          <option value="apac">Asia Pacific</option>
                        </select>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Restrict AI data processing to specific regions
                        </p>
                      </div>
                    </div>
                  </SettingsCard>

                  {/* Audit Log */}
                  <SettingsCard
                    title="Settings Audit Log"
                    description="Track all changes to AI settings across the platform"
                    icon={History}
                    iconColor="text-amber-400"
                    collapsible
                    defaultExpanded={false}
                  >
                    <AuditLogViewer
                      level="superadmin"
                      showFilters={true}
                      showExport={true}
                      limit={50}
                    />
                  </SettingsCard>
                </>
              ) : (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 text-slate-600 dark:text-slate-400 mx-auto mb-3 animate-spin" />
                  <p className="text-slate-400 dark:text-slate-500">Loading global settings...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Provider Modal */}
      {showProviderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-c-surface border border-c-border-subtle rounded-xl p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-c-text">
                {editingProviderId ? 'Edit Provider' : 'Add Provider'}
              </h2>
              <button
                onClick={() => setShowProviderModal(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleProviderSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">
                    Display Name
                  </label>
                  <input
                    required
                    value={providerForm.name}
                    onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                    className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded p-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">
                    Provider Type
                  </label>
                  <select
                    value={providerForm.provider}
                    onChange={(e) =>
                      setProviderForm({ ...providerForm, provider: e.target.value as any })
                    }
                    className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded p-2 text-slate-900 dark:text-white"
                  >
                    <optgroup label="Major Providers">
                      <option value="openai">OpenAI (GPT-4)</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="google">Google Gemini</option>
                    </optgroup>
                    <optgroup label="Open Source / Fast">
                      <option value="mistral">Mistral AI</option>
                      <option value="groq">Groq (Ultra Fast)</option>
                      <option value="together">Together AI</option>
                      <option value="ollama">Ollama (Local)</option>
                    </optgroup>
                    <optgroup label="Chinese Providers">
                      <option value="deepseek">DeepSeek</option>
                      <option value="qwen">Alibaba Qwen</option>
                      <option value="z_ai">Zhipu AI (GLM)</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={providerForm.api_key}
                  onChange={(e) => setProviderForm({ ...providerForm, api_key: e.target.value })}
                  className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded p-2 text-slate-900 dark:text-white"
                  placeholder="sk-..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">
                    Model ID
                  </label>
                  <input
                    required
                    value={providerForm.model_id}
                    onChange={(e) => setProviderForm({ ...providerForm, model_id: e.target.value })}
                    className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded p-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">
                    Endpoint (Optional)
                  </label>
                  <input
                    value={providerForm.endpoint}
                    onChange={(e) => setProviderForm({ ...providerForm, endpoint: e.target.value })}
                    className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded p-2 text-slate-900 dark:text-white"
                    placeholder="https://api..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">
                    Visibility
                  </label>
                  <select
                    value={providerForm.visibility}
                    onChange={(e) =>
                      setProviderForm({ ...providerForm, visibility: e.target.value as any })
                    }
                    className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded p-2 text-slate-900 dark:text-white"
                  >
                    <option value="admin">Admin Only</option>
                    <option value="beta">Beta Users</option>
                    <option value="public">Public</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={providerForm.is_active}
                      onChange={(e) =>
                        setProviderForm({ ...providerForm, is_active: e.target.checked })
                      }
                      className="w-4 h-4 rounded bg-c-bg border-c-border-subtle"
                    />
                    <span className="text-sm text-slate-300">Active</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowProviderModal(false)}
                  className="px-4 py-2 bg-transparent border border-c-border-subtle hover:bg-slate-50 dark:hover:bg-navy-800/20 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleTestConnection(providerForm)}
                  disabled={!providerForm.provider || !providerForm.api_key || testingConnection}
                  className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/50 rounded flex items-center gap-2"
                >
                  <Wifi size={16} /> Test
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded"
                >
                  Save Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component
const StatCard: React.FC<{ icon: any; label: string; value: string; color: string }> = ({
  icon: Icon,
  label,
  value,
  color,
}) => (
  <div className="bg-c-surface border border-c-border-subtle rounded-xl p-4">
    <div className="flex items-center gap-3 mb-2">
      <Icon size={18} className={color} />
      <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label}
      </span>
    </div>
    <div className="text-2xl font-bold text-c-text">{value}</div>
  </div>
);

export default AIConfigurationView;
