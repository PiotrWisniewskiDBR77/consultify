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
    color: 'bg-sky-500',
    darkColor: 'bg-sky-400',
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

type AIAvailabilityState = 'available' | 'degraded' | 'unavailable' | 'unknown';
type AIAvailabilityReason = 'network' | 'rate_limited' | 'server' | 'unknown' | null;

export const LLMSelector: React.FC<LLMSelectorProps> = ({ compact = false }) => {
  const { t } = useTranslation();
  const { aiConfig, setAIConfig, currentUser, isDemoMode } = useAppStore();
  const isDemoContext = isDemoMode || currentUser?.isDemo === true;
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeModelName, setActiveModelName] = useState<string>('');
  const [availabilityState, setAvailabilityState] = useState<AIAvailabilityState>('unknown');
  const [availabilityReason, setAvailabilityReason] = useState<AIAvailabilityReason>(null);
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
        if (isDemoContext) {
          setActiveModelName('');
          return;
        }
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
  }, [isOpen, activeTier.id, aiConfig.selectedModelId, isDemoContext]);

  // Health indicator for top-bar model button.
  // Red indicator means AI providers are currently unavailable.
  const checkAIAvailability = useCallback(async () => {
    if (isDemoContext) {
      setAvailabilityState('available');
      setAvailabilityReason(null);
      return;
    }
    try {
      const health = await Api.checkLLMProvidersHealth();
      const providersRaw = health?.providers;
      const providers = Array.isArray(providersRaw)
        ? providersRaw
        : Object.values(providersRaw || {});
      const hasAvailable = providers.some(
        (p: any) => p?.available === true || p?.status === 'healthy'
      );
      const hasDegraded = providers.some((p: any) => p?.status === 'degraded');
      const overall = String(health?.overall || '').toLowerCase();

      if (hasAvailable || overall === 'healthy') {
        setAvailabilityState('available');
        setAvailabilityReason(null);
        return;
      }

      if (hasDegraded || overall === 'degraded') {
        setAvailabilityState('degraded');
        setAvailabilityReason('server');
        return;
      }

      setAvailabilityState('unavailable');
      setAvailabilityReason('unknown');
    } catch (err: any) {
      const statusCode = err?.status;
      if (statusCode === 401 || statusCode === 403) return;
      if (statusCode === 429) {
        setAvailabilityState('degraded');
        setAvailabilityReason('rate_limited');
        return;
      }
      if (statusCode === 503) {
        setAvailabilityState('degraded');
        setAvailabilityReason('server');
        return;
      }
      setAvailabilityState('unknown');
      setAvailabilityReason('unknown');
    }
  }, [isDemoContext]);

  useEffect(() => {
    checkAIAvailability();
    const interval = setInterval(checkAIAvailability, 45000);
    return () => clearInterval(interval);
  }, [checkAIAvailability]);

  useEffect(() => {
    const handleOnline = () => {
      setIsNetworkOnline(true);
      setAvailabilityReason(null);
    };
    const handleOffline = () => {
      setIsNetworkOnline(false);
      setAvailabilityReason('network');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isUnavailable = !isNetworkOnline || availabilityState === 'unavailable';
  const isDegraded =
    isNetworkOnline && (availabilityState === 'degraded' || availabilityState === 'unknown');
  const buttonTitle = !isNetworkOnline
    ? 'AI unavailable - network offline'
    : availabilityState === 'available'
      ? 'AI providers available'
      : availabilityReason === 'rate_limited'
        ? 'AI status delayed due to rate limiting'
        : availabilityState === 'unavailable'
          ? 'AI currently unavailable'
          : 'AI status temporarily degraded';

  if (isDemoContext) {
    return (
      <div className="relative z-50" ref={menuRef}>
        <button
          type="button"
          disabled
          title={t('llm.demoTitle', 'Demo AI workspace')}
          className="inline-flex items-center gap-2 h-9 px-2 rounded-full border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 dark:border-navy-600 dark:bg-navy-800/50 dark:text-slate-300 cursor-default"
        >
          <div className="w-2 h-2 rounded-full bg-navy-900 dark:bg-slate-300" />
          <span className={compact ? 'max-w-[72px] truncate' : ''}>
            {t('llm.demoLabel', 'Demo AI')}
          </span>
          <ChevronDown size={compact ? 10 : 12} className="text-primary-300/80" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative z-50" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-testid="llm-tier-selector"
        title={buttonTitle}
        className={`inline-flex h-9 items-center gap-2 rounded-full border ${compact ? 'px-2' : 'px-3'} transition-colors duration-150 ${
          isUnavailable
            ? 'bg-slate-50 dark:bg-white/5 border-slate-300 dark:border-navy-600 hover:bg-slate-100 dark:hover:bg-white/10'
            : isDegraded
              ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-400/50 dark:border-amber-500/40 hover:bg-amber-100/70 dark:hover:bg-amber-500/15'
              : isOpen
                ? 'bg-slate-100 dark:bg-white/10 border-c-info/50'
                : 'bg-transparent border-slate-200 dark:border-navy-700 hover:border-c-info/50 hover:bg-slate-50 dark:hover:bg-white/5'
        } text-xs font-medium text-navy-900 dark:text-white`}
      >
        {/* Status Dot / Icon */}
        <div
          className={`w-2 h-2 rounded-full animate-pulse ${
            isUnavailable ? 'bg-danger-500' : isDegraded ? 'bg-amber-500' : activeTier.color
          }`}
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
            {(isUnavailable || isDegraded) && (
              <div
                className={`mb-2 flex items-center gap-1.5 text-[10px] ${
                  isUnavailable
                    ? 'text-danger-600 dark:text-danger-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                <AlertTriangle size={11} />
                <span>
                  {!isNetworkOnline
                    ? t('llm.offlineMessage', 'Offline - check network connection')
                    : availabilityReason === 'rate_limited'
                      ? t(
                          'llm.rateLimitedMessage',
                          'AI status delayed by rate limiting - using last known state'
                        )
                      : isUnavailable
                        ? t('llm.unavailableMessage', 'AI unavailable - check provider health')
                        : t(
                            'llm.degradedMessage',
                            'AI status temporarily degraded - check provider health'
                          )}
                </span>
              </div>
            )}
            <p className="text-[10px] text-slate-600 dark:text-slate-500">
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
                    ? 'bg-slate-100 dark:bg-white/[0.08] ring-1 ring-c-info/20'
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
                          ? 'text-[var(--c-info)]'
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
                    <div className="text-[10px] text-slate-600 dark:text-slate-500">
                      {t(tier.descKey)}
                    </div>
                  </div>
                </div>
                {aiConfig.selectedTier === tier.id && (
                  <div className="text-xs font-mono text-[var(--c-info)] bg-white dark:bg-black/20 px-1.5 py-0.5 rounded border border-c-info/20">
                    {t('llm.active', 'Active')}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Active Model Info */}
          {activeModelName && (
            <div className="px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-500">
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
