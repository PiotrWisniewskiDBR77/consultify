import React from 'react';
import { useTranslation } from 'react-i18next';

interface TrialBannerProps {
    daysRemaining: number;
    warningLevel: 'none' | 'warning' | 'critical' | 'expired';
    onUpgradeClick: () => void;
}

/**
 * TrialBanner - Persistent banner for Trial organizations
 * Shows days remaining and upgrade CTA
 */
const TrialBanner: React.FC<TrialBannerProps> = ({
    daysRemaining,
    warningLevel,
    onUpgradeClick
}) => {
    const { t } = useTranslation();

    if (warningLevel === 'none') return null;

    const getBannerStyles = () => {
        switch (warningLevel) {
            case 'warning':
                return 'bg-yellow-50 border-yellow-400 text-yellow-800';
            case 'critical':
                return 'bg-orange-50 border-orange-400 text-orange-800';
            case 'expired':
                return 'bg-red-50 border-red-400 text-red-800';
            default:
                return 'bg-blue-50 border-blue-400 text-blue-800';
        }
    };

    const getIcon = () => {
        switch (warningLevel) {
            case 'expired':
                return '🔒';
            case 'critical':
                return '⚠️';
            case 'warning':
                return '⏰';
            default:
                return '🔬';
        }
    };

    const getMessage = () => {
        if (warningLevel === 'expired') {
            return t('trial.expired', 'Your trial has expired. Upgrade to continue.');
        }
        return t('trial.daysRemaining', 'Trial: {{days}} days remaining', { days: daysRemaining });
    };

    return (
        <div className={`border-l-4 p-3 flex items-center justify-between ${getBannerStyles()}`}>
            <div className="flex items-center gap-2">
                <span className="text-lg">{getIcon()}</span>
                <span className="font-medium text-sm">{getMessage()}</span>
            </div>
            <button
                onClick={onUpgradeClick}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition-all"
            >
                {t('trial.upgrade', 'Upgrade Plan')}
            </button>
        </div>
    );
};

export default TrialBanner;
