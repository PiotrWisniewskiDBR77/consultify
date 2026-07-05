import { AlertTriangle, Coins, CreditCard, Sparkles, TrendingUp, X } from 'lucide-react';
import React from 'react';
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
  minRequired = 100,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const isZeroBalance = currentBalance <= 0;
  const isLowBalance = currentBalance > 0 && currentBalance < minRequired;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div
          className={`p-6 ${isZeroBalance ? 'bg-gradient-to-r from-danger-500 to-amber-500' : 'bg-gradient-to-r from-amber-500 to-amber-500'}`}
        >
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
                  {t('billing.currentBalance', 'Current balance')}:{' '}
                  {currentBalance.toLocaleString()} tokens
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
              ? t(
                  'billing.noTokensDescription',
                  'You need to purchase tokens to continue using AI features. Our AI assistant requires tokens to process your requests.'
                )
              : t(
                  'billing.lowBalanceDescription',
                  'Your token balance is running low. Purchase more tokens to ensure uninterrupted access to AI features.'
                )}
          </p>

          {/* Token Benefits */}
          <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 space-y-3">
            <h3 className="font-medium text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-500" />
              {t('billing.whatYouGet', 'What you get with tokens')}
            </h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-navy-900 dark:bg-white" />
                {t('billing.benefit1', 'AI-powered project analysis and insights')}
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-navy-900 dark:bg-white" />
                {t('billing.benefit2', 'Smart recommendations and suggestions')}
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-navy-900 dark:bg-white" />
                {t('billing.benefit3', 'Automated reports and documentation')}
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-navy-900 dark:bg-white" />
                {t('billing.benefit4', 'Risk detection and early warnings')}
              </li>
            </ul>
          </div>

          {/* Special Offer Badge */}
          <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-500/30">
            <TrendingUp className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
            <p className="text-sm text-primary-700 dark:text-primary-300">
              {t('billing.bonusOffer', 'Get up to 20% bonus tokens on larger packages!')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
          >
            {t('common.later', 'Maybe Later')}
          </button>
          <button
            onClick={onBuyTokens}
            className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-crimson-600 text-white font-medium hover:from-primary-500 hover:to-crimson-500 transition-all shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2"
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
