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
        text-slate-500/90 dark:text-slate-400/80 
        select-none
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}
        ${compact ? 'text-[11px]' : 'text-xs'}
        ${className}
      `}
      role="status"
      aria-live="polite"
      aria-label={displayLabel}
    >
      {/* Single clean spinner — enterprise-grade minimalism */}
      <Loader2
        size={compact ? 12 : 14}
        className="animate-spin text-purple-500/70 dark:text-purple-400/70 flex-shrink-0"
      />

      {/* Business-language label with gentle pulse */}
      <span className="truncate animate-pulse" style={{ animationDuration: '3s' }}>
        {displayLabel}
      </span>
    </div>
  );
}

export default ThinkingStatusLine;
