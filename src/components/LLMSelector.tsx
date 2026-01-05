import { AlertTriangle, ChevronDown, Coins, Cpu, Crown, Gauge, Layers, Shield, Sparkles, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Api } from '@/services/api';
import { useAppStore } from '../store/useAppStore';

interface Tier {
    id: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
    name: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    darkColor: string;
}

const TIERS: Tier[] = [
    {
        id: 'BUDGET',
        name: 'Budget Tier',
        description: 'Simple questions, fast responses',
        icon: <Coins size={16} />,
        color: 'bg-emerald-500',
        darkColor: 'bg-emerald-400',
    },
    {
        id: 'STANDARD',
        name: 'Fast Tier',
        description: 'Most tasks, balanced performance',
        icon: <Zap size={16} />,
        color: 'bg-blue-500',
        darkColor: 'bg-blue-400',
    },
    {
        id: 'PREMIUM',
        name: 'Premium Tier',
        description: 'Complex analysis, reports',
        icon: <Crown size={16} />,
        color: 'bg-purple-500',
        darkColor: 'bg-purple-400',
    },
    {
        id: 'REASONING',
        name: 'Reasoning Tier',
        description: 'MAX Mode, deep thinking',
        icon: <Cpu size={16} />,
        color: 'bg-amber-500',
        darkColor: 'bg-amber-400',
    },
];

interface LLMSelectorProps {
    compact?: boolean;
}

export const LLMSelector: React.FC<LLMSelectorProps> = ({ compact = false }) => {
    const { aiConfig, setAIConfig } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [activeModelName, setActiveModelName] = useState<string>('');

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
                if (result && result.recommendation && typeof result.recommendation === 'object') {
                    setActiveModelName((result.recommendation as any).model_id);
                }
            } catch (err) {
                console.error('Failed to get recommendation:', err);
            }
        };

        if (isOpen) {
            fetchRecommendation();
        }
    }, [isOpen, activeTier.id, aiConfig.selectedModelId]);

    return (
        <div className="relative z-50" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'} rounded-lg border transition-all duration-200 ${isOpen ? 'bg-slate-100 dark:bg-white/10 border-brand/50' : 'bg-transparent border-slate-200 dark:border-white/10 hover:border-brand/50 hover:bg-slate-50 dark:hover:bg-white/5'} text-xs font-medium text-navy-900 dark:text-white`}
            >
                {/* Status Dot / Icon */}
                <div className={`w-2 h-2 rounded-full ${activeTier.color} animate-pulse`} />

                {!compact && <span>{activeTier.name}</span>}
                {compact && <span className="max-w-[60px] truncate">{activeTier.name}</span>}

                <ChevronDown
                    size={compact ? 10 : 12}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 right-0 w-80 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="p-3 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-navy-950/30">
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
                            Model Routing per Tier
                        </div>
                        <p className="text-[10px] text-slate-400">
                            Define which LLM level to use. System automatically selects the best available model in that
                            tier.
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
                                            {tier.name}
                                        </div>
                                        <div className="text-[10px] text-slate-400">{tier.description}</div>
                                    </div>
                                </div>
                                {aiConfig.selectedTier === tier.id && (
                                    <div className="text-xs font-mono text-purple-600 dark:text-purple-400 bg-white dark:bg-black/20 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-500/20">
                                        Active
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Active Model Info */}
                    {activeModelName && (
                        <div className="px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <Gauge size={10} />
                                <span>Current routing:</span>
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
