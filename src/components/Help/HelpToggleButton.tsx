/**
 * Help Toggle Button
 *
 * Minimal floating button matching sidebar icon scale.
 * Transparent bg, subtle white border, colored icon.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

export const HelpToggleButton: React.FC = () => {
  const { t } = useTranslation();
  const { toggleSidePanel, activeSidePanel } = useAppStore();

  if (activeSidePanel === 'HELP') return null;

  return (
    <button
      onClick={() => toggleSidePanel('HELP')}
      className="
        group relative
        w-8 h-8
        flex items-center justify-center
        rounded-l-md rounded-r-none
        bg-transparent
        border border-white/20
        hover:bg-white/[0.06]
        hover:border-white/30
        active:scale-95
        transition-all duration-150
      "
      title={t('widgets.help.title', 'Help Center')}
      aria-label={t('widgets.help.title', 'Help Center')}
    >
      <span className="relative z-10 text-sm font-semibold text-slate-600 group-hover:text-slate-300 transition-colors">
        ?
      </span>

      <div
        className="
          absolute right-full mr-2
          px-2.5 py-1.5
          bg-navy-900/95 dark:bg-slate-800/95
          backdrop-blur-sm
          text-white text-[11px] font-medium
          rounded-md
          whitespace-nowrap
          opacity-0 group-hover:opacity-100
          translate-x-1 group-hover:translate-x-0
          transition-all duration-150
          pointer-events-none
          shadow-lg
          border border-white/10
        "
      >
        {t('widgets.help.tooltip', 'Help Center')}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[4px] w-1.5 h-1.5 bg-navy-900/95 dark:bg-slate-800/95 rotate-45 border-r border-t border-white/10" />
      </div>
    </button>
  );
};

export default HelpToggleButton;
