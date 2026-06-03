import { HelpCircle, Play } from 'lucide-react';
import React from 'react';

import { Tour, useTour } from './TourProvider';

/**
 * TourTrigger — Button to manually start a tour
 * Features animated color pulse on icon variant for discoverability.
 */

// CSS for tour trigger animation
const tourAnimationStyle = `
@keyframes tourColorPulse {
    0%, 100% {
        background: linear-gradient(135deg, #6366F1 0%, #7C3AED 100%);
        box-shadow: 0 0 8px rgba(139, 92, 246, 0.3);
    }
    50% {
        background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
        box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
    }
}

@keyframes tourIconGlow {
    0%, 100% {
        filter: drop-shadow(0 0 1px rgba(255,255,255,0.2));
    }
    50% {
        filter: drop-shadow(0 0 4px rgba(255,255,255,0.5));
    }
}
`;

interface TourTriggerProps {
  tour: Tour;
  label?: string;
  variant?: 'button' | 'link' | 'icon';
  className?: string;
}

export const TourTrigger: React.FC<TourTriggerProps> = ({
  tour,
  label = 'Pokaż przewodnik',
  variant = 'button',
  className = '',
}) => {
  const { startTour, isTourCompleted } = useTour();
  const completed = isTourCompleted(tour.id);

  const handleClick = () => {
    startTour({ ...tour, triggerCondition: 'manual' });
  };

  if (variant === 'icon') {
    return (
      <>
        <style>{tourAnimationStyle}</style>
        <button
          onClick={handleClick}
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all ${className}`}
          style={{
            animation: 'tourColorPulse 5s ease-in-out infinite',
          }}
          title={label}
        >
          <HelpCircle size={18} style={{ animation: 'tourIconGlow 5s ease-in-out infinite' }} />
        </button>
      </>
    );
  }

  if (variant === 'link') {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors ${className}`}
      >
        <Play size={14} />
        <span>{label}</span>
        {completed && (
          <span className="text-xs text-slate-600 dark:text-slate-500">(ukończony)</span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all ${className}`}
      style={{
        animation: 'tourColorPulse 5s ease-in-out infinite',
      }}
    >
      <Play size={16} style={{ animation: 'tourIconGlow 5s ease-in-out infinite' }} />
      <span>{label}</span>
    </button>
  );
};

export default TourTrigger;
