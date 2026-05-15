import { HelpCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useHelpSidePanel } from '../../contexts/HelpContext';

/**
 * FloatingHelpWidget — Opens the main HelpSidePanel (bottom-left FAB).
 *
 * This widget delegates all logic to the HelpContext system so the user
 * always gets the full contextual help experience.
 */

const widgetAnimationStyle = `
@keyframes widgetColorPulse {
    0%, 100% {
        background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
        box-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
    }
    50% {
        background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
        box-shadow: 0 0 16px rgba(99, 102, 241, 0.5);
    }
}
@keyframes widgetIconGlow {
    0%, 100% { filter: drop-shadow(0 0 1px rgba(255,255,255,0.3)); }
    50%       { filter: drop-shadow(0 0 5px rgba(255,255,255,0.6)); }
}
`;

export const FloatingHelpWidget: React.FC = () => {
  const { t } = useTranslation();
  const { toggle } = useHelpSidePanel();

  return (
    <>
      <style>{widgetAnimationStyle}</style>
      <button
        onClick={toggle}
        className="fixed bottom-6 left-6 w-12 h-12 rounded-xl shadow-lg flex items-center justify-center text-white transition-all z-40 group"
        style={{ animation: 'widgetColorPulse 5s ease-in-out infinite' }}
        aria-label={t('help.widget.label', 'Help')}
      >
        <HelpCircle size={22} style={{ animation: 'widgetIconGlow 5s ease-in-out infinite' }} />
        <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity shadow-lg">
          {t('help.widget.label', 'Help')}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-slate-900 rotate-45" />
        </span>
      </button>
    </>
  );
};

export default FloatingHelpWidget;
