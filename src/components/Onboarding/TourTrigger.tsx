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
        background: var(--c-accent);
        box-shadow: 0 0 8px color-mix(in srgb, var(--c-accent) 30%, transparent);
    }
    50% {
        background: color-mix(in srgb, var(--c-accent) 85%, white);
        box-shadow: 0 0 12px color-mix(in srgb, var(--c-accent) 40%, transparent);
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
        className={`flex items-center gap-1.5 text-sm text-c-accent hover:text-c-accent dark:text-c-accent dark:hover:text-c-accent transition-colors ${className}`}
      >
        <Play size={14} />
        <span>{label}</span>
        {completed && (
          <span className="text-xs text-c-text-secondary dark:text-c-text-muted">(ukończony)</span>
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
