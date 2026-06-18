import { MessageCircle, Shield } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAIContext } from '../../contexts/AIContext';
import { AIRoleBadge } from './AIRoleBadge';

// CSS for the chat button animation (matching other widgets)
const chatAnimationStyle = `
@keyframes chatColorPulse {
    0%, 100% {
        background: linear-gradient(135deg, #6366F1 0%, #7C3AED 100%);
        box-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
    }
    50% {
        background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
        box-shadow: 0 0 16px rgba(99, 102, 241, 0.5);
    }
}

@keyframes chatIconGlow {
    0%, 100% {
        filter: drop-shadow(0 0 1px rgba(255,255,255,0.3));
    }
    50% {
        filter: drop-shadow(0 0 5px rgba(255,255,255,0.6));
    }
}
`;

export const ChatToggleButton: React.FC = () => {
  const { toggleChat, pmoContext, isChatOpen } = useAIContext();
  const { t } = useTranslation();
  const assistantLabel = t('chat.toggle.assistant', 'AI Assistant');

  // We assume regulatory mode is handled by context or we fetch specific to this component if needed.
  // For simplicity, we'll keep the context badge.

  // Note: Regulatory mode state was local in ChatOverlay.
  // Ideally it should be moved to AIContext, but for now we'll stick to the main badge
  // or we'd need to duplicate the fetch logic.
  // Let's implement the refined style first.

  return (
    <>
      <style>{chatAnimationStyle}</style>
      {!isChatOpen && (
        <button
          onClick={toggleChat}
          className="w-12 h-12 flex items-center justify-center text-white rounded-l-2xl rounded-r-none shadow-lg transition-all duration-300 group relative"
          style={{
            animation: 'chatColorPulse 5s ease-in-out infinite',
          }}
          title={assistantLabel}
        >
          <MessageCircle
            size={20}
            className="transition-transform"
            style={{ animation: 'chatIconGlow 5s ease-in-out infinite' }}
          />

          {/* Badge indicator when context is loaded */}
          {pmoContext.projectId && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-green-400 rounded-full border border-white dark:border-navy-900 animate-pulse" />
          )}

          {/* Tooltip */}
          <div
            className={`
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
                    `}
          >
            {assistantLabel}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45" />
          </div>
        </button>
      )}
    </>
  );
};
