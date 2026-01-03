import React from 'react';
import { AlertTriangle, CreditCard, X, Coins, TrendingUp, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LowBalanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBuyTokens: () => void;
    currentBalance: number;
    minRequired?: number;
}

export const LowBalanceModal: React.FC<LowBalanceModalProps> = ({
    isOpen,
    onClose,
    onBuyTokens,
    currentBalance,
    minRequired = 100
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const isZeroBalance = currentBalance <= 0;
    const isLowBalance = currentBalance > 0 && currentBalance < minRequired;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className={`p-6 ${isZeroBalance ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                {isZeroBalance ? (
                                    <AlertTriangle className="w-6 h-6 text-white" />
                                ) : (
                                    <Coins className="w-6 h-6 text-white" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    {isZeroBalance 
                                        ? t('billing.noTokens', 'Out of Tokens') 
                                        : t('billing.lowBalance', 'Low Token Balance')}
                                </h2>
                                <p className="text-white/80 text-sm">
                                    {t('billing.currentBalance', 'Current balance')}: {currentBalance.toLocaleString()} tokens
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <p className="text-slate-600 dark:text-slate-300">
                        {isZeroBalance 
                            ? t('billing.noTokensDescription', 'You need to purchase tokens to continue using AI features. Our AI assistant requires tokens to process your requests.')
                            : t('billing.lowBalanceDescription', 'Your token balance is running low. Purchase more tokens to ensure uninterrupted access to AI features.')
                        }
                    </p>

                    {/* Token Benefits */}
                    <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 space-y-3">
                        <h3 className="font-medium text-slate-900 dark:text-white text-sm flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            {t('billing.whatYouGet', 'What you get with tokens')}
                        </h3>
                        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                {t('billing.benefit1', 'AI-powered project analysis and insights')}
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                {t('billing.benefit2', 'Smart recommendations and suggestions')}
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                {t('billing.benefit3', 'Automated reports and documentation')}
                            </li>
                            <li className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                {t('billing.benefit4', 'Risk detection and early warnings')}
                            </li>
                        </ul>
                    </div>

                    {/* Special Offer Badge */}
                    <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-500/30">
                        <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <p className="text-sm text-purple-700 dark:text-purple-300">
                            {t('billing.bonusOffer', 'Get up to 20% bonus tokens on larger packages!')}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                    >
                        {t('common.later', 'Maybe Later')}
                    </button>
                    <button
                        onClick={onBuyTokens}
                        className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
                    >
                        <CreditCard className="w-4 h-4" />
                        {t('billing.buyTokens', 'Buy Tokens')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LowBalanceModal;








