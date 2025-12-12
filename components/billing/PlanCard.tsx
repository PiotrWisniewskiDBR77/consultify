import React from 'react';
import { Check, Star } from 'lucide-react';

interface SubscriptionPlan {
    id: string;
    name: string;
    price_monthly: number;
    token_limit: number;
    storage_limit_gb: number;
    token_overage_rate: number;
    storage_overage_rate: number;
}

interface PlanCardProps {
    plan: SubscriptionPlan;
    isCurrentPlan?: boolean;
    isPopular?: boolean;
    onSelect?: (planId: string) => void;
    disabled?: boolean;
}

const formatTokens = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
};

export const PlanCard: React.FC<PlanCardProps> = ({
    plan,
    isCurrentPlan = false,
    isPopular = false,
    onSelect,
    disabled = false
}) => {
    const features = [
        { label: `${formatTokens(plan.token_limit)} tokens/month`, included: true },
        { label: `${plan.storage_limit_gb} GB storage`, included: true },
        { label: 'Email support', included: true },
        { label: 'API access', included: plan.price_monthly >= 100 },
        { label: 'Priority support', included: plan.price_monthly >= 100 },
        { label: 'Custom integrations', included: plan.price_monthly >= 100 }
    ];

    return (
        <div
            className={`relative rounded-2xl p-6 transition-all duration-300 ${isCurrentPlan
                ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/25 scale-105'
                : isPopular
                    ? 'bg-white dark:bg-gray-800 border-2 border-indigo-500 shadow-lg'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg'
                }`}
        >
            {/* Popular Badge */}
            {isPopular && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full">
                        <Star className="w-3 h-3" />
                        Popular
                    </span>
                </div>
            )}

            {/* Current Plan Badge */}
            {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="flex items-center gap-1 px-3 py-1 bg-white text-indigo-600 text-xs font-bold rounded-full">
                        <Check className="w-3 h-3" />
                        Current Plan
                    </span>
                </div>
            )}

            {/* Plan Header */}
            <div className="text-center mb-6">
                <h3 className={`text-xl font-bold mb-2 ${isCurrentPlan ? 'text-white' : 'text-gray-900 dark:text-white'
                    }`}>
                    {plan.name}
                </h3>
                <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-4xl font-bold ${isCurrentPlan ? 'text-white' : 'text-gray-900 dark:text-white'
                        }`}>
                        ${plan.price_monthly}
                    </span>
                    <span className={`text-sm ${isCurrentPlan ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                        /month
                    </span>
                </div>
            </div>

            {/* Features List */}
            <ul className="space-y-3 mb-6">
                {features.map((feature, idx) => (
                    <li
                        key={idx}
                        className={`flex items-center gap-2 text-sm ${feature.included
                            ? isCurrentPlan
                                ? 'text-white'
                                : 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-500 line-through'
                            }`}
                    >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${feature.included
                            ? isCurrentPlan
                                ? 'bg-white/20'
                                : 'bg-indigo-100 dark:bg-indigo-900/30'
                            : 'bg-gray-100 dark:bg-gray-700'
                            }`}>
                            <Check className={`w-3 h-3 ${feature.included
                                ? isCurrentPlan
                                    ? 'text-white'
                                    : 'text-indigo-600 dark:text-indigo-400'
                                : 'text-gray-400'
                                }`} />
                        </div>
                        {feature.label}
                    </li>
                ))}
            </ul>

            {/* Overage Rates */}
            <div className={`text-xs text-center mb-6 ${isCurrentPlan ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'
                }`}>
                Overage: ${plan.token_overage_rate}/1K tokens • ${plan.storage_overage_rate}/GB
            </div>

            {/* Action Button */}
            {onSelect && !isCurrentPlan && (
                <button
                    onClick={() => onSelect(plan.id)}
                    disabled={disabled}
                    className={`w-full py-3 rounded-xl font-semibold transition-all ${isPopular
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {disabled ? 'Processing...' : 'Select Plan'}
                </button>
            )}

            {isCurrentPlan && (
                <div className="w-full py-3 rounded-xl font-semibold text-center bg-white/20 text-white">
                    Your Current Plan
                </div>
            )}
        </div>
    );
};

export default PlanCard;
