/**
 * Help Button Component
 *
 * Global floating help button that opens the HelpPanel.
 * Shows badge with count of available playbooks.
 * Features animated color pulse for visibility.
 *
 * Step 6: Enterprise+ Ready
 */

import { HelpCircle } from 'lucide-react';
import React from 'react';

import { useHelp } from '../../contexts/HelpContext';

// CSS for the playbook button animation (blue -> purple)
const playbookAnimationStyle = `
@keyframes playbookColorPulse {
    0%, 100% {
        background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
        box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
    }
    50% {
        background: linear-gradient(135deg, #A51C30 0%, #651120 100%);
        box-shadow: 0 0 16px rgba(165, 28, 48, 0.5);
    }
}

@keyframes playbookIconGlow {
    0%, 100% {
        filter: drop-shadow(0 0 1px rgba(255,255,255,0.3));
    }
    50% {
        filter: drop-shadow(0 0 5px rgba(255,255,255,0.6));
    }
}
`;

interface HelpButtonProps {
  onClick: () => void;
}

const HelpButton: React.FC<HelpButtonProps> = ({ onClick }) => {
  const { playbooks, loading } = useHelp();

  // Count available (not completed/dismissed) playbooks
  const availableCount = playbooks.filter((p) => p.status === 'AVAILABLE').length;

  return (
    <>
      <style>{playbookAnimationStyle}</style>
      <button
        onClick={onClick}
        className="fixed bottom-6 right-6 z-30 flex items-center justify-center w-14 h-14 text-white rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-c-focus dark:focus:ring-c-focus"
        style={{
          animation: 'playbookColorPulse 4.5s ease-in-out infinite',
        }}
        title="Help & Training"
        aria-label="Open Help Panel"
      >
        <HelpCircle
          className="w-6 h-6"
          style={{ animation: 'playbookIconGlow 4.5s ease-in-out infinite' }}
        />

        {/* Badge */}
        {availableCount > 0 && !loading && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-danger-500 rounded-full border-2 border-white dark:border-slate-900">
            {availableCount > 9 ? '9+' : availableCount}
          </span>
        )}
      </button>
    </>
  );
};

export default HelpButton;
