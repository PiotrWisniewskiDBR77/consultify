/**
 * FeatureFlagsDevToolsToggleButton
 *
 * Minimal floating button matching sidebar icon scale.
 * Transparent bg, subtle white border, colored icon.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

const OPEN_DEVTOOLS_EVENT = 'consultify:openFeatureFlagsDevTools';

export const FeatureFlagsDevToolsToggleButton: React.FC = () => {
  const { t } = useTranslation();
  const { activeSidePanel } = useAppStore();

  if (activeSidePanel !== null) return null;

  return (
    <button
      onClick={() => window.dispatchEvent(new Event(OPEN_DEVTOOLS_EVENT))}
      className="
        group relative
        w-8 h-8
        flex items-center justify-center
        rounded-l-md rounded-r-none
        bg-transparent
        border border-white/20
        hover:bg-c-surface/[0.06]
        hover:border-white/30
        active:scale-95
        transition-all duration-150
      "
      title={t('widgets.ab.title', 'A/B Experiments')}
      aria-label={t('widgets.ab.title', 'A/B Experiments')}
    >
      <span className="relative z-10 text-[10px] font-bold tracking-wide text-emerald-400 group-hover:text-emerald-300 transition-colors">
        A/B
      </span>

      <div
        className="
          absolute right-full mr-2
          px-2.5 py-1.5
          bg-navy-900/95
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
        {t('widgets.ab.tooltip', 'A/B Experiments')}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[4px] w-1.5 h-1.5 bg-navy-900/95 rotate-45 border-r border-t border-white/10" />
      </div>
    </button>
  );
};

export default FeatureFlagsDevToolsToggleButton;
