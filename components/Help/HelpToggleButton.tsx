/**
 * Help Toggle Button
 * 
 * A floating button that toggles the HelpSidePanel.
 * Features a subtle color animation to draw attention.
 */

import React from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';

// CSS for the color pulse animation
const pulseAnimationStyle = `
@keyframes helpColorPulse {
    0%, 100% {
        background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
        box-shadow: 0 0 15px rgba(139, 92, 246, 0.4);
    }
    50% {
        background: linear-gradient(135deg, #6366F1 0%, #3B82F6 100%);
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
    }
}

@keyframes helpIconGlow {
    0%, 100% { 
        filter: drop-shadow(0 0 2px rgba(255,255,255,0.3));
        transform: scale(1);
    }
    50% { 
        filter: drop-shadow(0 0 6px rgba(255,255,255,0.6));
        transform: scale(1.05);
    }
}
`;

export const HelpToggleButton: React.FC = () => {
    const { t } = useTranslation();
    const { toggleSidePanel, activeSidePanel } = useAppStore();

    // Don't show button if ANY panel is open
    if (activeSidePanel !== null) return null;

    return (
        <>
            <style>{pulseAnimationStyle}</style>
            <button
                onClick={() => toggleSidePanel('HELP')}
                className="w-10 h-10 flex items-center justify-center text-white rounded-l-2xl rounded-r-none shadow-lg transition-all duration-300 group relative"
                style={{
                    animation: 'helpColorPulse 4s ease-in-out infinite',
                }}
                title={t('widgets.help.title', 'Help Center')}
                aria-label={t('widgets.help.title', 'Help Center')}
            >
                <MessageCircleQuestion
                    size={18}
                    className="transition-transform duration-300"
                    style={{
                        animation: 'helpIconGlow 4s ease-in-out infinite'
                    }}
                />

                {/* Tooltip */}
                <div className={`
                    absolute right-full mr-3 
                    px-3 py-1.5 
                    bg-slate-900 dark:bg-slate-800 
                    text-white text-xs font-medium 
                    rounded-lg
                    whitespace-nowrap
                    opacity-0 group-hover:opacity-100
                    transition-opacity duration-200
                    pointer-events-none
                    shadow-lg
                `}>
                    {t('widgets.help.tooltip', 'Help Center')}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45" />
                </div>
            </button>
        </>
    );
};

export default HelpToggleButton;









