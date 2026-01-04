import { AlertTriangle, Coins, CreditCard, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useTokenBalance } from '../../hooks/useTokenBalance';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';
import { LowBalanceModal } from '../modals/LowBalanceModal';

interface LowBalanceBannerProps {
    className?: string;
    showOnlyWhenLow?: boolean;
}

export const LowBalanceBanner: React.FC<LowBalanceBannerProps> = ({ className = '', showOnlyWhenLow = true }) => {
    const { t } = useTranslation();
    const { setCurrentView } = useAppStore();
    const { balance, isLowBalance, isZeroBalance, isLoading, ZERO_BALANCE_THRESHOLD } = useTokenBalance();
    const [isDismissed, setIsDismissed] = useState(false);
    const [showModal, setShowModal] = useState(false);

    // Don't show if dismissed, loading, or balance is fine
    if (isDismissed || isLoading) return null;
    if (showOnlyWhenLow && !isLowBalance && !isZeroBalance) return null;

    const handleBuyTokens = () => {
        setShowModal(false);
        setCurrentView(AppView.SETTINGS_BILLING);
    };

    const bannerColor = isZeroBalance
        ? 'from-red-500 to-orange-500 border-red-400/50'
        : 'from-amber-500 to-orange-500 border-amber-400/50';

    const iconBg = isZeroBalance ? 'bg-red-600/20' : 'bg-amber-600/20';

    return (
        <>
            <div className={`relative overflow-hidden rounded-xl border ${className}`}>
                <div className={`absolute inset-0 bg-gradient-to-r ${bannerColor} opacity-10`} />
                <div className="relative flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
                            {isZeroBalance ? (
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            ) : (
                                <Coins className="w-5 h-5 text-amber-500" />
                            )}
                        </div>
                        <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                                {isZeroBalance
                                    ? t('billing.outOfTokens', 'Out of Tokens')
                                    : t('billing.lowTokenBalance', 'Low Token Balance')}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {isZeroBalance
                                    ? t('billing.purchaseToUseAI', 'Purchase tokens to continue using AI features')
                                    : t('billing.tokensRemaining', '{{count}} tokens remaining', { count: balance })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowModal(true)}
                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-500/25 flex items-center gap-2"
                        >
                            <CreditCard className="w-4 h-4" />
                            {t('billing.buyTokens', 'Buy Tokens')}
                        </button>
                        {!isZeroBalance && (
                            <button
                                onClick={() => setIsDismissed(true)}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                            >
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <LowBalanceModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onBuyTokens={handleBuyTokens}
                currentBalance={balance}
                minRequired={ZERO_BALANCE_THRESHOLD}
            />
        </>
    );
};

export default LowBalanceBanner;



