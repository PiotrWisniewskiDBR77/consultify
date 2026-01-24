/**
 * Feedback Toggle Button
 *
 * Modern floating button that toggles the FeedbackSidePanel.
 * Glass morphism design with warm amber glow.
 */

import { MessageSquareText } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

export const FeedbackToggleButton: React.FC = () => {
  const { t } = useTranslation();
  const { toggleSidePanel, activeSidePanel } = useAppStore();

  // Don't show button if ANY panel is open
  if (activeSidePanel !== null) return null;

  return (
    <button
      onClick={() => toggleSidePanel('FEEDBACK')}
      className="
                group relative
                w-10 h-10 
                flex items-center justify-center 
                rounded-l-lg rounded-r-none
                bg-gradient-to-br from-amber-500 to-orange-600
                hover:from-amber-400 hover:to-orange-500
                text-white
                shadow-md shadow-amber-500/25
                hover:shadow-lg hover:shadow-amber-500/35
                hover:scale-105
                active:scale-95
                transition-all duration-200
                border border-white/20
                backdrop-blur-sm
            "
      title={t('widgets.feedback.title', 'Feedback / Bug Report')}
      aria-label={t('widgets.feedback.title', 'Feedback')}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-l-lg bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

      <MessageSquareText
        size={20}
        className="relative z-10 transition-transform duration-200 group-hover:scale-110"
      />

      {/* Tooltip */}
      <div
        className="
                absolute right-full mr-3 
                px-3 py-2 
                bg-navy-900/95 dark:bg-slate-800/95
                backdrop-blur-sm
                text-white text-xs font-medium 
                rounded-lg
                whitespace-nowrap
                opacity-0 group-hover:opacity-100
                translate-x-2 group-hover:translate-x-0
                transition-all duration-200
                pointer-events-none
                shadow-xl
                border border-white/10
            "
      >
        {t('widgets.feedback.tooltip', 'Feedback')}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[5px] w-2 h-2 bg-navy-900/95 dark:bg-slate-800/95 rotate-45 border-r border-t border-white/10" />
      </div>
    </button>
  );
};

export default FeedbackToggleButton;
