import React from 'react';
import { useTrial } from '../../contexts/TrialContext';
import { useNavigate } from 'react-router-dom';

export const TrialBanner: React.FC = () => {
    const { isTrial, isExpired, daysRemaining, usage, limits } = useTrial();
    const navigate = useNavigate();

    if (!isTrial || isExpired) return null; // Expired handled by Gate

    // Calculate usage percentages
    const tokenLimit = limits?.maxTotalTokens || 10000;
    const tokensUsed = usage?.trialTokensUsed || 0;
    const tokenPercent = Math.min(100, (tokensUsed / tokenLimit) * 100);

    // Warning thresholds
    const lowDays = daysRemaining <= 3;
    const lowTokens = tokenPercent >= 80;

    return (
        <div className={`w-full px-4 py-2 flex items-center justify-between transition-colors ${lowDays || lowTokens ? 'bg-amber-50 border-b border-amber-200' : 'bg-slate-50 border-b border-slate-200'
            }`}>
            <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-slate-700">Trial Plan</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${lowDays ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                        {daysRemaining} Days Left
                    </span>
                </div>

                {/* Token Usage Bar */}
                <div className="flex items-center space-x-2" title={`${tokensUsed} / ${tokenLimit} Tokens Used`}>
                    <span className="text-xs text-slate-500 font-medium">AI Budget</span>
                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${lowTokens ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                            style={{ width: `${tokenPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-4">
                <button
                    onClick={() => navigate('/settings?tab=billing')}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                    Upgrade Plan &rarr;
                </button>
            </div>
        </div>
    );
};
