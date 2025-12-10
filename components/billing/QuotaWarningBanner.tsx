import React from 'react';
import { AlertTriangle, TrendingUp, X } from 'lucide-react';

interface QuotaWarningBannerProps {
    tokenPercentage: number;
    storagePercentage: number;
    onUpgrade?: () => void;
    onDismiss?: () => void;
}

export const QuotaWarningBanner: React.FC<QuotaWarningBannerProps> = ({
    tokenPercentage,
    storagePercentage,
    onUpgrade,
    onDismiss
}) => {
    const tokenWarning = tokenPercentage >= 80;
    const storageWarning = storagePercentage >= 80;
    const isCritical = tokenPercentage >= 95 || storagePercentage >= 95;

    if (!tokenWarning && !storageWarning) {
        return null;
    }

    const getMessage = () => {
        if (isCritical) {
            if (tokenPercentage >= 95 && storagePercentage >= 95) {
                return 'Your organization has reached the quota limits for both tokens and storage.';
            } else if (tokenPercentage >= 95) {
                return `Your organization has used ${tokenPercentage}% of monthly tokens.`;
            } else {
                return `Your organization has used ${storagePercentage}% of storage.`;
            }
        } else {
            if (tokenWarning && storageWarning) {
                return `Approaching limits: ${tokenPercentage}% tokens, ${storagePercentage}% storage used.`;
            } else if (tokenWarning) {
                return `Your organization has used ${tokenPercentage}% of monthly tokens.`;
            } else {
                return `Your organization has used ${storagePercentage}% of storage space.`;
            }
        }
    };

    return (
        <div
            className={`relative px-4 py-3 rounded-lg flex items-center gap-3 ${isCritical
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                }`}
        >
            <AlertTriangle
                className={`w-5 h-5 flex-shrink-0 ${isCritical ? 'text-red-500' : 'text-orange-500'
                    }`}
            />
            <div className="flex-1">
                <p
                    className={`text-sm font-medium ${isCritical
                            ? 'text-red-800 dark:text-red-200'
                            : 'text-orange-800 dark:text-orange-200'
                        }`}
                >
                    {getMessage()}
                </p>
                {isCritical && (
                    <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
                        Upgrade your plan to avoid service interruption.
                    </p>
                )}
            </div>
            {onUpgrade && (
                <button
                    onClick={onUpgrade}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isCritical
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-orange-600 text-white hover:bg-orange-700'
                        }`}
                >
                    <TrendingUp className="w-4 h-4" />
                    Upgrade
                </button>
            )}
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className={`p-1 rounded hover:bg-black/10 transition-colors ${isCritical ? 'text-red-500' : 'text-orange-500'
                        }`}
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

export default QuotaWarningBanner;
