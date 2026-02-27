import {
  AlertTriangle,
  ChevronDown,
  Coins,
  Cpu,
  Crown,
  Gauge,
  Layers,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { useAppStore } from '../store/useAppStore';

interface Tier {
  id: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
  nameKey: string;
  descKey: string;
  icon: React.ReactNode;
  color: string;
  darkColor: string;
}

const TIERS: Tier[] = [
  {
    id: 'BUDGET',
    nameKey: 'llm.budgetTier',
    descKey: 'llm.budgetTierDesc',
    icon: <Coins size={16} />,
    color: 'bg-emerald-500',
    darkColor: 'bg-emerald-400',
  },
  {
    id: 'STANDARD',
    nameKey: 'llm.fastTier',
    descKey: 'llm.fastTierDesc',
    icon: <Zap size={16} />,
    color: 'bg-blue-500',
    darkColor: 'bg-blue-400',
  },
  {
    id: 'PREMIUM',
    nameKey: 'llm.premiumTier',
    descKey: 'llm.premiumTierDesc',
    icon: <Crown size={16} />,
    color: 'bg-purple-500',
    darkColor: 'bg-purple-400',
  },
  {
    id: 'REASONING',
    nameKey: 'llm.reasoningTier',
    descKey: 'llm.reasoningTierDesc',
    icon: <Cpu size={16} />,
    color: 'bg-amber-500',
    darkColor: 'bg-amber-400',
  },
];

interface LLMSelectorProps {
  compact?: boolean;
}

export const LLMSelector: React.FC<LLMSelectorProps> = ({ compact = false }) => {
  const { t } = useTranslation();
  const { aiConfig, setAIConfig } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeModelName, setActiveModelName] = useState<string>('');
  const [isAIAvailable, setIsAIAvailable] = useState<boolean>(true);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTierSelect = (tierId: Tier['id']) => {
    setAIConfig({
      selectedTier: tierId,
      selectedModelId: null, // Clear explicit model logic if any
      // autoMode: false // We can keep autoMode for fallback, but for tier selection it's implied
    });
    setIsOpen(false);
  };

  // Get active tier object
  const activeTier = TIERS.find((t) => t.id === aiConfig.selectedTier) || TIERS[0];

  // Fetch recommended provider name for display
  useEffect(() => {
    const fetchRecommendation = async () => {
      try {
        // If using specific model override, show that name
        if (aiConfig.selectedModelId) {
          // We could fetch model name here but let's stick to Tier for now
          return;
        }

        // Get what model the backend would pick for this tier
        const result = await Api.getRecommendedProvider(activeTier.id);
        if (result && result.recommendation) {
          const rec = result.recommendation as any;
          // backend returns { provider, model, reason }
          setActiveModelName(rec.model || rec.model_id || rec.recommendation || '');
        }
      } catch (err) {
        console.error('Failed to get recommendation:', err);
      }
    };

    if (isOpen) {
      fetchRecommendation();
    }
  }, [isOpen, activeTier.id, aiConfig.selectedModelId]);

  // Health indicator for top-bar model button.
  // Red indicator means AI providers are currently unavailable.
  const checkAIAvailability = useCallback(async () => {
    try {
      const health = await Api.checkLLMProvidersHealth();
      const providersRaw = health?.providers;
      const providers = Array.isArray(providersRaw)
        ? providersRaw
        : Object.values(providersRaw || {});
      const hasAvailable = providers.some(
        (p: any) => p?.available === true || p?.status === 'healthy'
      );
      const isOverallHealthy = health?.overall === 'healthy';
      setIsAIAvailable(hasAvailable || isOverallHealthy);
    } catch {
      setIsAIAvailable(false);
    }
  }, []);

  useEffect(() => {
    checkAIAvailability();
    const interval = setInterval(checkAIAvailability, 45000);
    return () => clearInterval(interval);
  }, [checkAIAvailability]);

  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isDisconnected = !isNetworkOnline || !isAIAvailable;

  return (
    <div className="relative z-50" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-testid="llm-tier-selector"
        title={isDisconnected ? 'AI currently unavailable' : 'AI providers available'}
        className={`flex items-center gap-2 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} rounded-lg border transition-all duration-200 ${
          !isDisconnected
            ? isOpen
              ? 'bg-slate-100 dark:bg-white/10 border-brand/50'
              : 'bg-transparent border-slate-200 dark:border-navy-700 hover:border-brand/50 hover:bg-slate-50 dark:hover:bg-white/5'
            : 'bg-red-50/70 dark:bg-red-500/10 border-red-400/50 dark:border-red-500/40 hover:bg-red-100/70 dark:hover:bg-red-500/15'
        } text-xs font-medium text-navy-900 dark:text-white`}
      >
        {/* Status Dot / Icon */}
        <div
          className={`w-2 h-2 rounded-full animate-pulse ${!isDisconnected ? activeTier.color : 'bg-red-500'}`}
        />

        {!compact && <span>{t('llm.model', 'Model')}</span>}
        {compact && <span className="max-w-[60px] truncate">{t('llm.model', 'Model')}</span>}

        <ChevronDown
          size={compact ? 10 : 12}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="p-3 border-b border-slate-200 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-950/30">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
              {t('llm.title', 'Model Routing per Tier')}
            </div>
            {isDisconnected && (
              <div className="mb-2 flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400">
                <AlertTriangle size={11} />
                <span>
                  {!isNetworkOnline
                    ? t('llm.offlineMessage', 'Offline - check network connection')
                    : t('llm.unavailableMessage', 'AI unavailable - check provider health')}
                </span>
              </div>
            )}
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {t(
                'llm.description',
                'Define which LLM level to use. System automatically selects the best available model in that tier.'
              )}
            </p>
          </div>

          {/* Tier List */}
          <div className="p-2 space-y-1">
            {TIERS.map((tier) => (
              <button
                key={tier.id}
                onClick={() => handleTierSelect(tier.id)}
                className={`w-full text-left px-3 py-3 flex items-center justify-between rounded-lg transition-colors group ${
                  aiConfig.selectedTier === tier.id
                    ? 'bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500/20'
                    : 'hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${tier.id === aiConfig.selectedTier ? 'bg-white dark:bg-white/10' : 'bg-slate-100 dark:bg-white/5 group-hover:bg-white dark:group-hover:bg-white/10'}`}
                  >
                    <div
                      className={
                        tier.id === aiConfig.selectedTier
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }
                    >
                      {tier.icon}
                    </div>
                  </div>
                  <div>
                    <div
                      className={`text-sm font-medium ${tier.id === aiConfig.selectedTier ? 'text-navy-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      {t(tier.nameKey)}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">
                      {t(tier.descKey)}
                    </div>
                  </div>
                </div>
                {aiConfig.selectedTier === tier.id && (
                  <div className="text-xs font-mono text-purple-600 dark:text-purple-400 bg-white dark:bg-black/20 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-500/20">
                    {t('llm.active', 'Active')}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Active Model Info */}
          {activeModelName && (
            <div className="px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                <Gauge size={10} />
                <span>{t('llm.currentRouting', 'Current routing:')}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-300">
                {activeModelName}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
