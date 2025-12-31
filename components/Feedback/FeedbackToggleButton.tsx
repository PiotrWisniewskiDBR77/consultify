import React from 'react';
import { MessageSquareText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';

// CSS for the feedback button glow (static)
const feedbackButtonStyle = `
.feedback-btn-gradient {
    background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
}
.feedback-btn-gradient:hover {
    box-shadow: 0 0 16px rgba(245, 158, 11, 0.6);
}
`;

export const FeedbackToggleButton: React.FC = () => {
    const { t } = useTranslation();
    const { toggleSidePanel, activeSidePanel } = useAppStore();

    // Don't show button if ANY panel is open
    if (activeSidePanel !== null) return null;

    return (
        <>
            <style>{feedbackButtonStyle}</style>
            <button
                onClick={() => toggleSidePanel('FEEDBACK')}
                className="w-10 h-10 flex items-center justify-center text-white rounded-l-2xl rounded-r-none shadow-lg transition-all duration-300 group relative feedback-btn-gradient"
                title={t('widgets.feedback.title', 'Feedback / Bug Report')}
            >
                <MessageSquareText
                    size={18}
                    className="transition-transform group-hover:scale-110"
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
                    {t('widgets.feedback.tooltip', 'Feedback')}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45" />
                </div>
            </button>
        </>
    );
};
