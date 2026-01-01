import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Api } from '../services/api';

interface DemoBadgeProps {
    className?: string;
}

/**
 * Demo Badge Component
 * Shows a floating badge when user is in demo mode
 * Provides link to contact sales for full access
 */
export const DemoBadge: React.FC<DemoBadgeProps> = ({ className = '' }) => {
    const { t } = useTranslation();
    const isDemo = Api.isDemoSession();

    if (!isDemo) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
            className={`fixed bottom-4 left-4 z-50 ${className}`}
        >
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl shadow-2xl shadow-purple-500/25 overflow-hidden">
                {/* Main Badge */}
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-white/80">
                            {t('demo.badge.mode', 'Demo Mode')}
                        </p>
                        <p className="text-sm font-bold">
                            demo@legolex.com
                        </p>
                    </div>
                </div>

                {/* CTA Link */}
                <a
                    href="https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 bg-white/10 hover:bg-white/20 transition-colors border-t border-white/10"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white/90">
                            {t('demo.badge.getFullAccess', 'Get Full Commercial Access')}
                        </span>
                        <ExternalLink size={12} className="text-white/70" />
                    </div>
                </a>
            </div>
        </motion.div>
    );
};

/**
 * Demo Mode Indicator for TopBar
 * Compact version for the top navigation
 */
export const DemoIndicator: React.FC = () => {
    const { t } = useTranslation();
    const isDemo = Api.isDemoSession();

    if (!isDemo) return null;

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
            <Sparkles size={14} className="text-purple-500" />
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                {t('demo.indicator', 'DEMO')}
            </span>
        </div>
    );
};


