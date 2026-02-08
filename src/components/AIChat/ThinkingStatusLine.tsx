import React, { useEffect, useMemo, useState } from 'react';

/**
 * ThinkingStatusLine - Cursor-style plain-text thinking log
 *
 * Renders each thinking step as a plain, dim line of text — no backgrounds,
 * no panels, no spinners, no varying opacities. Just text.
 */
export function ThinkingStatusLine({
  label,
  lines,
  className = '',
  compact = false,
  show = true,
}: {
  label: string;
  lines?: string[];
  className?: string;
  compact?: boolean;
  show?: boolean;
  /** @deprecated — kept for API compat, ignored */
  showSpinner?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  const displayLines = useMemo(() => {
    const base = Array.isArray(lines) && lines.length ? lines : [label];
    const cleaned = base.map((x) => String(x || '').trim()).filter(Boolean);

    // Dedupe consecutive duplicates
    const out: string[] = [];
    for (const l of cleaned) {
      if (out.length === 0 || out[out.length - 1] !== l) out.push(l);
    }

    return out.slice(-8);
  }, [label, lines]);

  // Smooth fade-in on mount
  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={`
        select-none
        transition-opacity duration-300 ease-out
        ${visible ? 'opacity-100' : 'opacity-0'}
        ${className}
      `}
      role="status"
      aria-live="polite"
      aria-label={displayLines[displayLines.length - 1] || label}
    >
      {displayLines.map((line, idx) => (
        <div
          key={`${idx}-${line}`}
          className={`
            text-slate-400 dark:text-slate-500
            ${compact ? 'text-[11px] leading-5' : 'text-xs leading-5'}
          `}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

export default ThinkingStatusLine;
