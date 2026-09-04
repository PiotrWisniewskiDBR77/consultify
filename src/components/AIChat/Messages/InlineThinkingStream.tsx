/**
 * InlineThinkingStream Component
 *
 * Displays AI thinking process in a subtle, inline, streaming fashion.
 * Shows the current thinking step with a typewriter effect.
 *
 * FLOW-AI-THINKING: Inline reasoning display
 */

import { Loader2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThinkingStep } from '../../../types';

// ==========================================
// TYPES
// ==========================================

interface InlineThinkingStreamProps {
  steps: ThinkingStep[];
  isStreaming: boolean;
  className?: string;
  autoHideDelay?: number;
}

interface ThinkingIndicatorProps {
  isActive: boolean;
  label?: string;
  className?: string;
}

// ==========================================
// COMPONENTS
// ==========================================

/**
 * Simple thinking indicator (pulsing dots)
 */
export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  isActive,
  label,
  className = '',
}) => {
  const { t } = useTranslation();

  if (!isActive) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
      {label && <span className="text-xs text-slate-600 dark:text-slate-500 italic">{label}</span>}
    </div>
  );
};

/**
 * Inline thinking stream - shows AI's current thinking as subtle text
 */
export const InlineThinkingStream: React.FC<InlineThinkingStreamProps> = ({
  steps,
  isStreaming,
  className = '',
  autoHideDelay = 2000,
}) => {
  const { t } = useTranslation();
  const [displayedText, setDisplayedText] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get current step
  const currentStep = steps.find((s) => s.status === 'in_progress') || steps[steps.length - 1];

  // Typewriter effect for current step content
  useEffect(() => {
    if (!currentStep?.content || !isStreaming) {
      setDisplayedText(currentStep?.content || currentStep?.label || '');
      return;
    }

    const content = currentStep.content;
    let index = 0;

    const typeInterval = setInterval(() => {
      if (index < content.length) {
        setDisplayedText(content.slice(0, index + 2)); // 2 chars at a time
        index += 2;
      } else {
        clearInterval(typeInterval);
      }
    }, 20);

    return () => clearInterval(typeInterval);
  }, [currentStep?.content, currentStep?.label, isStreaming]);

  // Auto-scroll to keep current thinking visible
  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [displayedText, isStreaming]);

  // Auto-hide after streaming completes
  useEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    if (isStreaming) {
      setIsVisible(true);
    } else if (autoHideDelay > 0) {
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [isStreaming, autoHideDelay]);

  if (steps.length === 0 || !isVisible) return null;

  return (
    <div
      ref={containerRef}
      className={`
        transition-all duration-300 ease-in-out
        ${isStreaming ? 'opacity-100' : 'opacity-60'}
        ${className}
      `}
    >
      <div className="flex items-start gap-2 py-1">
        {/* Thinking indicator */}
        {isStreaming && (
          <div className="flex-shrink-0 mt-0.5">
            <Loader2 size={12} className="text-slate-600 dark:text-slate-500 animate-spin" />
          </div>
        )}

        {/* Current thinking content - subtle styling */}
        <div className="flex-1 min-w-0">
          <p className="text-xs italic text-slate-600 dark:text-slate-500 opacity-70 leading-relaxed">
            {displayedText || currentStep?.label || t('thinking.analyzing', 'Analyzing...')}
            {/* Cursor indicator when streaming */}
            {isStreaming && displayedText.length < (currentStep?.content?.length || 0) && (
              <span className="inline-block w-1 h-3 ml-0.5 bg-slate-400 dark:bg-slate-500 animate-pulse" />
            )}
          </p>

          {/* Step progress indicator */}
          {steps.length > 1 && (
            <div className="flex items-center gap-1 mt-1">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`
                    w-1.5 h-1.5 rounded-full transition-all duration-200
                    ${
                      step.status === 'done'
                        ? 'bg-green-400 dark:bg-green-500'
                        : step.status === 'in_progress'
                          ? 'bg-c-surface-raised dark:bg-c-surface-raised animate-pulse'
                          : 'bg-slate-300 dark:bg-slate-600'
                    }
                  `}
                  title={step.label}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InlineThinkingStream;
