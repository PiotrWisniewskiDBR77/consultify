import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  DollarSign,
  Eye,
  FileText,
  Hand,
  MessageSquare,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Wand2,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

// AI Capability definitions with their prompt keys
const AI_CAPABILITIES = [
  {
    id: 'chat',
    name: 'AI Chat',
    icon: MessageSquare,
    description: 'Główny asystent AI w rozmowach',
    promptKey: 'system_chat',
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'magic_wand',
    name: 'Magic Wand',
    icon: Wand2,
    description: 'Sugestie dla pól formularzy',
    promptKey: 'system_magic_wand',
    color: 'from-primary-500 to-primary-600',
  },
  {
    id: 'reports',
    name: 'Report Generator',
    icon: FileText,
    description: 'Generowanie raportów i analiz',
    promptKey: 'system_reports',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    id: 'initiative_analysis',
    name: 'Initiative Analysis',
    icon: Target,
    description: 'Analiza i scoring inicjatyw',
    promptKey: 'system_initiative',
    color: 'from-amber-500 to-amber-600',
  },
  {
    id: 'max_mode',
    name: 'MAX Mode (Deep Reasoning)',
    icon: Sparkles,
    description: 'Głęboka analiza z chain-of-thought',
    promptKey: 'system_max_reasoner',
    color: 'from-danger-500 to-danger-600',
  },
  {
    id: 'coach',
    name: 'AI Coach',
    icon: Brain,
    description: 'Coaching i mentoring PMO',
    promptKey: 'system_coach',
    color: 'from-blue-500 to-blue-600',
  },
];

// Tabs for the AI Hub
type AIHubTab = 'capabilities' | 'providers' | 'routing' | 'usage' | 'health';

export const AIHubView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AIHubTab>('capabilities');
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

  // Providers
  const [providers, setProviders] = useState<any[]>([]);

  const loadInitialData = useCallback(async () => {
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
        const usage = await fetch('/api/llm/control/usage', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).then((r) => r.json());
        setUsageStats(usage);
      } catch (e) {
        console.error('Usage load failed:', e);
      }

      // Load costs
      try {
        const costs = await fetch('/api/llm/costs', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).then((r) => r.json());
        setCostStats(costs);
      } catch (e) {
        console.error('Costs load failed:', e);
      }

      // Load health
      try {
        const health = await fetch('/api/llm/diagnose').then((r) => r.json());
        setHealthStatus(health);
      } catch (e) {
        console.error('Health load failed:', e);
      }
    } catch (err) {
      console.error('Failed to load AI Hub data:', err);
      toast.error('Failed to load AI configuration');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const selectCapability = (capabilityId: string) => {
    const cap = AI_CAPABILITIES.find((c) => c.id === capabilityId);
    if (cap) {
      setSelectedCapability(capabilityId);
      setEditingPrompt(prompts[cap.promptKey]?.content || getDefaultPrompt(capabilityId));
    }
  };

  const getDefaultPrompt = (capabilityId: string): string => {
    const defaults: Record<string, string> = {
      chat: `Jesteś profesjonalnym konsultantem AI dla platformy Consultify.
Twoja rola: Pomagać użytkownikom w zarządzaniu projektami transformacji cyfrowej.

ZASADY:
- Odpowiadaj zwięźle i konkretnie
- Używaj metodologii DRD (Digital Readiness Diagnostic)
- Cytuj źródła z bazy wiedzy gdy to możliwe
- Proponuj konkretne działania, nie tylko teorie
- Bądź wspierający ale profesjonalny`,

      magic_wand: `Jesteś asystentem do autouzupełniania pól formularzy.
Generuj krótkie, trafne sugestie bazując na kontekście ekranu i projektu.

FORMAT ODPOWIEDZI:
- suggestion: główna sugestia (max 500 znaków)
- reasoning: krótkie uzasadnienie
- confidence: high/medium/low
- alternatives: 2-3 alternatywne propozycje`,

      reports: `Jesteś ekspertem od raportów PMO i analiz strategicznych.
Generujesz profesjonalne raporty zgodne ze standardami ISO 21500 i PMBOK.

STRUKTURA RAPORTÓW:
1. Executive Summary (max 3 zdania)
2. Kluczowe metryki i KPI
3. Analiza gaps i ryzyk
4. Rekomendacje z priorytetami
5. Następne kroki

STYL: Formalny, oparty na danych, z wizualizacjami.`,

      initiative_analysis: `Jesteś analitykiem strategicznym oceniającym inicjatywy transformacyjne.

KRYTERIA OCENY:
- Strategic Alignment (1-5)
- Business Impact (1-5)
- Technical Feasibility (1-5)
- Resource Requirements (S/M/L)
- Risk Level (Low/Medium/High)

Zawsze uzasadniaj oceny konkretnymi argumentami.`,

      max_mode: `Jesteś ekspertem strategicznym najwyższego poziomu.
Używasz głębokiego rozumowania (chain-of-thought) do analizy złożonych problemów.

PROTOKÓŁ MYŚLENIA:
1. <thinking> - wewnętrzna analiza krok po kroku
2. Rozważ wszystkie perspektywy
3. Zidentyfikuj ukryte założenia
4. Oceń trade-offs
5. </thinking> - podsumowanie dla użytkownika

Odpowiedzi muszą być głębokie, strategiczne i oparte na faktach.`,

      coach: `Jesteś coachem PMO i mentorem transformacji cyfrowej.
Pomagasz liderom rozwijać kompetencje zarządzania zmianą.

PODEJŚCIE:
- Zadawaj pytania zamiast dawać gotowe odpowiedzi
- Buduj świadomość przez refleksję
- Wspieraj w definiowaniu celów
- Celebruj postępy
- Bądź empatyczny ale wymagający`,
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
      toast.success(`Zapisano instrukcje dla ${cap.name}`);
    } catch (err) {
      toast.error('Nie udało się zapisać');
    }
    setSaving(false);
  };

  const tabs = [
    { id: 'capabilities' as AIHubTab, label: 'Instrukcje AI', icon: Brain },
    { id: 'providers' as AIHubTab, label: 'Dostawcy LLM', icon: Cpu },
    { id: 'routing' as AIHubTab, label: 'Model Routing', icon: Settings },
    { id: 'usage' as AIHubTab, label: 'Użycie & Koszty', icon: BarChart3 },
    { id: 'health' as AIHubTab, label: 'Zdrowie Systemu', icon: Activity },
  ];

  return (
    <div className="h-full flex flex-col bg-c-bg">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-c-border-subtle bg-gradient-to-r from-primary-900/20 to-blue-900/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-blue-500">
            <Brain className="text-c-text" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-c-text">AI Hub</h1>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Centralne zarządzanie zachowaniem AI
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-6 py-3 border-b border-c-border-subtle flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
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
        {activeTab === 'capabilities' && (
          <div className="h-full flex">
            {/* Capabilities List */}
            <div className="w-80  border-c-border-subtle overflow-y-auto p-4">
              <h3 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-3 px-2">
                Funkcje AI
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
                          ? 'bg-white/10 border border-primary-500/50'
                          : 'hover:bg-white/5 border border-transparent'
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
                        Instrukcje dla:{' '}
                        {AI_CAPABILITIES.find((c) => c.id === selectedCapability)?.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Prompt key:{' '}
                        <code className="text-primary-400">
                          {AI_CAPABILITIES.find((c) => c.id === selectedCapability)?.promptKey}
                        </code>
                      </p>
                    </div>
                    <button
                      onClick={savePrompt}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {saving ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      Zapisz
                    </button>
                  </div>
                  <div className="flex-1 p-4 overflow-hidden">
                    <textarea
                      value={editingPrompt}
                      onChange={(e) => setEditingPrompt(e.target.value)}
                      placeholder="Wpisz instrukcje dla AI..."
                      className="w-full h-full bg-c-text text-c-bg border border-c-border-subtle rounded-xl p-4 text-sm font-mono resize-none focus:outline-none focus:border-c-accent/50 focus:ring-1 focus:ring-c-focus"
                    />
                  </div>
                  <div className="shrink-0 p-4 border-t border-c-border-subtle text-xs text-slate-500 dark:text-slate-400">
                    💡 Tip: Użyj placeholderów jak{' '}
                    <code className="text-primary-400">{'{{project_name}}'}</code>,{' '}
                    <code className="text-primary-400">{'{{user_role}}'}</code>,{' '}
                    <code className="text-primary-400">{'{{screen_context}}'}</code>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <div className="text-center">
                    <Brain size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Wybierz funkcję AI, aby edytować jej instrukcje</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'providers' && (
          <div className="p-6 overflow-y-auto h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="bg-c-surface border border-c-border-subtle rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${provider.is_active ? 'bg-emerald-500/20' : 'bg-c-surface-raised'}`}
                      >
                        <Cpu
                          size={18}
                          className={
                            provider.is_active
                              ? 'text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }
                        />
                      </div>
                      <div>
                        <div className="font-medium text-c-text">{provider.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {provider.provider}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        provider.is_active
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {provider.is_active ? 'Aktywny' : 'Nieaktywny'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <div>
                      Model: <span className="text-slate-300">{provider.model_id}</span>
                    </div>
                    <div>
                      Widoczność: <span className="text-slate-300">{provider.visibility}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-6">
              Pełne zarządzanie dostawcami: Super Admin → LLM Providers
            </p>
          </div>
        )}

        {activeTab === 'routing' && (
          <div className="p-6 overflow-y-auto h-full">
            <div className="max-w-2xl mx-auto">
              <div className="bg-c-surface border border-c-border-subtle rounded-xl p-6">
                <h3 className="text-lg font-semibold text-c-text mb-4">Model Routing per Tier</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">
                  Określ, który model LLM ma być używany dla różnych poziomów złożoności zadań.
                </p>

                <div className="space-y-4">
                  {[
                    {
                      tier: 'BUDGET',
                      label: 'Budget Tier',
                      desc: 'Proste pytania, szybkie odpowiedzi',
                      default: 'deepseek-chat',
                    },
                    {
                      tier: 'STANDARD',
                      label: 'Standard Tier',
                      desc: 'Większość zadań (chat, magic wand)',
                      default: 'gpt-4o-mini',
                    },
                    {
                      tier: 'PREMIUM',
                      label: 'Premium Tier',
                      desc: 'Złożone analizy, raporty',
                      default: 'gpt-4o',
                    },
                    {
                      tier: 'REASONING',
                      label: 'Reasoning Tier',
                      desc: 'MAX Mode, deep thinking',
                      default: 'o1-preview',
                    },
                  ].map((item) => (
                    <div
                      key={item.tier}
                      className="flex items-center gap-4 p-4 bg-c-surface-raised/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-c-text">{item.label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.desc}
                        </div>
                      </div>
                      <select className="bg-c-surface-raised border border-c-border-subtle rounded-lg px-3 py-2 text-sm text-c-text">
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

        {activeTab === 'usage' && (
          <div className="p-6 overflow-y-auto h-full">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={Zap}
                label="Tokeny dzisiaj"
                value={usageStats?.user?.tokens_used_today?.toLocaleString() || '0'}
                color="text-yellow-400"
              />
              <StatCard
                icon={DollarSign}
                label="Koszt (30 dni)"
                value={`$${(costStats?.totals?.costUsd || 0).toFixed(4)}`}
                color="text-emerald-400"
              />
              <StatCard
                icon={Activity}
                label="Requesty (30 dni)"
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
              <div className="bg-c-surface border border-c-border-subtle rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-c-text mb-4">Koszty per Model</h3>
                <div className="space-y-3">
                  {costStats.byModel.map((m: any) => (
                    <div key={m.model} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-sm text-c-text">{m.model}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {m.requests} requestów
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-emerald-400">${(m.cost || 0).toFixed(4)}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {(m.tokens || 0).toLocaleString()} tokenów
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'health' && (
          <div className="p-6 overflow-y-auto h-full">
            <div className="max-w-2xl mx-auto">
              {/* System Status */}
              <div className="bg-c-surface border border-c-border-subtle rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-c-text">Status Systemu AI</h3>
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
                      className="flex items-center gap-3 p-4 bg-c-surface-raised/50 rounded-lg hover:bg-c-surface-raised transition-colors"
                    >
                      <cap.icon size={20} className="text-primary-400" />
                      <span className="text-sm text-c-text">{cap.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-center text-slate-500 dark:text-slate-400 text-xs mt-4">
                  Pełne testy: Admin → AI Mission Control
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
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

export default AIHubView;
