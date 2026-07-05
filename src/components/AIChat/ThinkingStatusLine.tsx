import { Check, Loader2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

/**
 * ThinkingStatusLine - Cursor-style plain-text thinking log
 *
 * Renders each thinking step as a plain, dim line of text with status indicators:
 * - ✓ checkmark for completed steps
 * - spinner for in-progress steps
 * - no icon for pending/future steps
 *
 * Shows the user what the AI is actually doing at each stage of processing.
 */

export interface ThinkingLineItem {
  label: string;
  status: 'done' | 'in_progress' | 'pending';
}

export function ThinkingStatusLine({
  label,
  lines,
  steps,
  className = '',
  compact = false,
  show = true,
}: {
  label: string;
  /** Simple string lines (legacy API) */
  lines?: string[];
  /** Rich step data with status (preferred) */
  steps?: ThinkingLineItem[];
  className?: string;
  compact?: boolean;
  show?: boolean;
  /** @deprecated — kept for API compat, ignored */
  showSpinner?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  const displaySteps: ThinkingLineItem[] = useMemo(() => {
    // Prefer rich steps if provided
    if (Array.isArray(steps) && steps.length > 0) {
      // Dedupe ALL duplicates by label, preserving order of first occurrence
      const seen = new Set<string>();
      const out: ThinkingLineItem[] = [];
      for (const s of steps) {
        const trimmed = String(s.label || '').trim();
        if (trimmed && !seen.has(trimmed)) {
          seen.add(trimmed);
          out.push({ label: trimmed, status: s.status });
        }
      }
      return out.slice(-8);
    }

    // Fallback to simple string lines
    const base = Array.isArray(lines) && lines.length ? lines : [label];
    const cleaned = base.map((x) => String(x || '').trim()).filter(Boolean);

    // Dedupe ALL duplicates, preserving order of first occurrence
    const seen = new Set<string>();
    const out: ThinkingLineItem[] = [];
    for (const l of cleaned) {
      if (!seen.has(l)) {
        seen.add(l);
        // Last one is in_progress, rest are done
        out.push({ label: l, status: 'in_progress' });
      }
    }
    // Mark all except last as done
    for (let i = 0; i < out.length - 1; i++) {
      out[i].status = 'done';
    }

    return out.slice(-8);
  }, [label, lines, steps]);

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
      aria-label={displaySteps[displaySteps.length - 1]?.label || label}
    >
      {displaySteps.map((step, idx) => (
        <div
          key={`${idx}-${step.label}`}
          className={`
            flex items-center gap-1.5
            transition-opacity duration-200
            ${step.status === 'done' ? 'opacity-50' : 'opacity-100'}
            ${compact ? 'text-[11px] leading-5' : 'text-xs leading-5'}
          `}
        >
          {/* Status indicator */}
          {step.status === 'done' && (
            <Check
              size={compact ? 10 : 12}
              className="text-c-success flex-shrink-0"
              strokeWidth={2.5}
            />
          )}
          {step.status === 'in_progress' && (
            <Loader2
              size={compact ? 10 : 12}
              className="text-c-text-muted flex-shrink-0 animate-spin"
            />
          )}
          {step.status === 'pending' && (
            <span className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} flex-shrink-0`} />
          )}

          {/* Step label */}
          <span className="text-c-text-muted">{step.label}</span>
        </div>
      ))}
    </div>
  );
}

export default ThinkingStatusLine;
