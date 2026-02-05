import { Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

/**
 * ThinkingStatusLine - Cursor-like AI thinking indicator
 *
 * Shows a subtle, dimmer text while the AI is processing.
 * Features smooth fade-in animation and gentle pulsing effect.
 */
export function ThinkingStatusLine({
  label,
  className = '',
  compact = false,
  show = true,
}: {
  label: string;
  className?: string;
  compact?: boolean;
  show?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [displayLabel, setDisplayLabel] = useState(label);

  // Smooth fade-in on mount
  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, [show]);

  // Update label with slight delay for smoother transition
  useEffect(() => {
    if (label === displayLabel) return;
    const timer = setTimeout(() => setDisplayLabel(label), 100);
    return () => clearTimeout(timer);
  }, [label, displayLabel]);

  if (!show) return null;

  return (
    <div
      className={`
        flex items-center gap-2 
        text-slate-400/80 dark:text-slate-500/80 
        italic select-none
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}
        ${compact ? 'text-[11px]' : 'text-xs'}
        ${className}
      `}
      role="status"
      aria-live="polite"
      aria-label={displayLabel}
    >
      {/* Animated spinner */}
      <div className="relative flex items-center justify-center">
        <Loader2
          size={compact ? 12 : 14}
          className="animate-spin text-slate-400/60 dark:text-slate-500/60"
        />
        {/* Subtle glow effect */}
        <div
          className="absolute inset-0 rounded-full bg-slate-400/10 dark:bg-slate-500/10 animate-ping"
          style={{ animationDuration: '2s' }}
        />
      </div>

      {/* Text with subtle animation */}
      <span className="truncate animate-pulse" style={{ animationDuration: '2.5s' }}>
        {displayLabel}
      </span>

      {/* Typing dots - Cursor style */}
      <span className="flex gap-0.5 ml-1">
        <span
          className="w-1 h-1 rounded-full bg-slate-400/50 dark:bg-slate-500/50 animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '1s' }}
        />
        <span
          className="w-1 h-1 rounded-full bg-slate-400/50 dark:bg-slate-500/50 animate-bounce"
          style={{ animationDelay: '200ms', animationDuration: '1s' }}
        />
        <span
          className="w-1 h-1 rounded-full bg-slate-400/50 dark:bg-slate-500/50 animate-bounce"
          style={{ animationDelay: '400ms', animationDuration: '1s' }}
        />
      </span>
    </div>
  );
}

export default ThinkingStatusLine;
