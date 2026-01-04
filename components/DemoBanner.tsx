import { AlertCircle, ChevronDown, ChevronUp, Clock, Database, ExternalLink, Eye, Info, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * DemoBanner — Demo Session Indicator
 *
 * Shows when user is logged in as demo@legolex.com
 * Provides link to contact sales for commercial access
 */

interface DemoBannerProps {
    onStartTrialClick?: () => void;
}

const DemoBanner: React.FC<DemoBannerProps> = ({ onStartTrialClick }) => {
    const { t } = useTranslation();
    const [showLimitations, setShowLimitations] = useState(false);

    const DEMO_LIMITATIONS = [
        { icon: Eye, text: t('demo.banner.limitations.readOnly', "Read-only mode — changes won't persist") },
        {
            icon: Database,
            text: t('demo.banner.limitations.sampleData', 'Sample data — explore with realistic examples'),
        },
        { icon: Clock, text: t('demo.banner.limitations.session', 'Session expires in 24h') },
    ];

    const handleContactSales = () => {
        window.open(
            'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017',
            '_blank',
        );
    };

    return (
        <div
            data-tour="demo-banner"
            className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-md relative z-50"
        >
            {/* Main Banner */}
            <div className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm font-medium">
                    <div className="flex items-center gap-2 bg-white/10 px-2 py-1 rounded">
                        <Sparkles size={14} className="text-purple-200" />
                        <span className="font-bold tracking-wide uppercase text-purple-100 text-xs">
                            {t('demo.banner.mode', 'Demo Mode')}
                        </span>
                    </div>
                    <span className="text-white/90">
                        <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono">demo@legolex.com</code>
                        <span className="ml-2 hidden sm:inline">
                            {t('demo.banner.description', 'Exploring with sample data')}
                        </span>
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowLimitations(!showLimitations)}
                        className="flex items-center gap-1 text-xs text-purple-200 hover:text-white transition-colors"
                    >
                        <AlertCircle size={14} />
                        <span className="hidden sm:inline">{t('demo.banner.showLimitations', 'Limitations')}</span>
                        {showLimitations ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <button
                        data-tour="demo-exit"
                        onClick={handleContactSales}
                        className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded border border-white/20 transition-colors font-semibold flex items-center gap-1.5"
                    >
                        {t('demo.banner.contactSales', 'Get Full Access')}
                        <ExternalLink size={12} />
                    </button>
                </div>
            </div>

            {/* Expanded Limitations */}
            {showLimitations && (
                <div className="px-4 py-3 bg-purple-800/50 border-t border-purple-500/30">
                    <div className="flex flex-wrap items-center gap-6 text-xs text-purple-100">
                        {DEMO_LIMITATIONS.map((limitation, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <limitation.icon size={14} className="text-purple-300" />
                                <span>{limitation.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DemoBanner;
