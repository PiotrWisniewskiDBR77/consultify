import React from 'react';
import { useTranslation } from 'react-i18next';

interface DemoBannerProps {
    onStartTrialClick: () => void;
}

/**
 * DemoBanner - Persistent banner for Demo mode
 * Indicates read-only demo environment with trial CTA
 */
const DemoBanner: React.FC<DemoBannerProps> = ({ onStartTrialClick }) => {
    const { t } = useTranslation();

    return (
        <div className="bg-gradient-to-r from-purple-100 to-indigo-100 border-l-4 border-purple-500 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <span className="font-medium text-sm text-purple-800">
                    {t('demo.viewingDemo', 'You are viewing a demo environment')}
                </span>
                <span className="text-xs text-purple-600 ml-2">
                    {t('demo.readOnly', '(read-only)')}
                </span>
            </div>
            <button
                onClick={onStartTrialClick}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 transition-all shadow-sm"
            >
                {t('demo.startTrial', 'Start Free Trial')}
            </button>
        </div>
    );
};

export default DemoBanner;
