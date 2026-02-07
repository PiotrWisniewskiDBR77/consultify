/**
 * ThinkingBlock - Chain of Thought reasoning display
 * Shows AI's thinking process step by step with animations.
 *
 * Enterprise UX: auto-expands during streaming, smooth collapse on completion,
 * live elapsed timer, and business-language status labels.
 */

import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThinkingStep } from '../../../types';

interface ThinkingBlockProps {
  steps: ThinkingStep[];
  isStreaming?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  /** Timestamp (Date.now()) when the stream started, for live elapsed counter */
  streamStartedAt?: number | null;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  analysis: <Brain size={14} />,
  research: <Search size={14} />,
  synthesis: <FileText size={14} />,
  validation: <CheckCircle2 size={14} />,
};

const CATEGORY_COLORS: Record<string, string> = {
  analysis: 'text-purple-500 dark:text-purple-400',
  research: 'text-blue-500 dark:text-blue-400',
  synthesis: 'text-green-500 dark:text-green-400',
  validation: 'text-amber-500 dark:text-amber-400',
};

/** Format elapsed seconds into human-readable string */
function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  steps,
  isStreaming = false,
  defaultExpanded = false,
  className = '',
  streamStartedAt,
}) => {
  const { t } = useTranslation();
  // Auto-expand when streaming begins, allow manual toggle
  const [userToggled, setUserToggled] = useState(false);
  const [userExpandState, setUserExpandState] = useState(defaultExpanded);
  const isExpanded = userToggled ? userExpandState : (isStreaming ? true : defaultExpanded);

  // Animated collapse: track if block is collapsing
  const [isCollapsing, setIsCollapsing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const wasStreamingRef = useRef(isStreaming);

  // Live elapsed timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isStreaming || !streamStartedAt) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Date.now() - streamStartedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isStreaming, streamStartedAt]);

  // Detect transition from streaming → done for animated collapse
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && !userToggled) {
      // Stream just finished — animate collapse
      setIsCollapsing(true);
      const timer = setTimeout(() => setIsCollapsing(false), 400);
      wasStreamingRef.current = false;
      return () => { clearTimeout(timer); };
    }
    wasStreamingRef.current = isStreaming;
    return undefined;
  }, [isStreaming, userToggled]);

  const handleToggle = () => {
    setUserToggled(true);
    setUserExpandState(!isExpanded);
  };

  // Calculate progress
  const completedSteps = steps.filter((s) => s.status === 'done').length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  // Current step being processed
  const currentStep = useMemo(
    () =>
      steps.find((s) => s.status === 'in_progress') || steps.find((s) => s.status === 'pending'),
    [steps]
  );

  // Total duration
  const totalDuration = useMemo(
    () => steps.reduce((acc, step) => acc + (step.durationMs || 0), 0),
    [steps]
  );

  if (steps.length === 0) return null;

  // Business-language label for collapsed header (never show bare "Thinking...")
  const headerLabel = isStreaming
    ? (currentStep?.label || t('thinking.processing', 'Analyzing your request...'))
    : t('thinking.complete', 'Analysis complete');

  const showContent = isExpanded || isCollapsing;

  return (
    <div className={`mb-3 ${className}`}>
      {/* Header */}
      <button
        onClick={handleToggle}
        className={`
          w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
          bg-gradient-to-r from-purple-50 to-indigo-50 
          dark:from-purple-900/20 dark:to-indigo-900/20
          border border-purple-100 dark:border-purple-800/50
          hover:from-purple-100 hover:to-indigo-100
          dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30
          transition-all duration-200
        `}
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          {isStreaming ? (
            <Loader2 size={16} className="text-purple-500 animate-spin" />
          ) : (
            <Sparkles size={16} className="text-purple-500" />
          )}
        </div>

        {/* Status — always shows business-language label */}
        <div className="flex-1 text-left truncate">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {headerLabel}
          </span>
        </div>

        {/* Progress + elapsed */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isStreaming && elapsed > 0 && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          )}
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {completedSteps}/{totalSteps}
          </span>
          <div className="w-16 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expandable Content — with animated collapse */}
      {showContent && (
        <div
          ref={contentRef}
          className={`
            mt-2 px-3 py-2 bg-slate-50 dark:bg-navy-800/50 rounded-lg border border-slate-100 dark:border-navy-700 space-y-2
            transition-all duration-300 ease-in-out overflow-hidden
            ${isCollapsing ? 'max-h-0 opacity-0 mt-0 py-0' : 'max-h-[600px] opacity-100'}
          `}
        >
          {steps.map((step, index) => (
            <ThinkingStepItem
              key={step.id}
              step={step}
              index={index}
              isLast={index === steps.length - 1}
            />
          ))}

          {/* Total duration (shown after completion) */}
          {!isStreaming && totalDuration > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-navy-700 text-xs text-slate-500 dark:text-slate-400 text-right">
              {t('thinking.totalTime', 'Total time')}: {(totalDuration / 1000).toFixed(1)}s
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Individual step component
const ThinkingStepItem: React.FC<{
  step: ThinkingStep;
  index: number;
  isLast: boolean;
}> = ({ step, index, isLast }) => {
  const categoryIcon = step.category ? CATEGORY_ICONS[step.category] : null;
  const categoryColor = step.category
    ? CATEGORY_COLORS[step.category]
    : 'text-slate-500 dark:text-slate-400';

  const statusStyles = {
    pending: 'opacity-50',
    in_progress: 'animate-pulse',
    done: 'opacity-100',
    processing: 'animate-pulse',
    completed: 'opacity-100',
    failed: 'opacity-100',
  };

  return (
    <div
      className={`flex items-start gap-2 ${
        statusStyles[step.status as keyof typeof statusStyles] || 'opacity-100'
      }`}
    >
      {/* Status indicator */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={`
          w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium
          ${
            step.status === 'done'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : step.status === 'in_progress'
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                : 'bg-slate-100 dark:bg-navy-700 text-slate-400 dark:text-slate-500'
          }
        `}
        >
          {step.status === 'done' ? (
            <CheckCircle2 size={12} />
          ) : step.status === 'in_progress' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            index + 1
          )}
        </div>
        {!isLast && <div className="w-0.5 h-4 bg-slate-200 dark:bg-navy-700 mt-1" />}
      </div>

      {/* Step content */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center gap-2">
          {categoryIcon && <span className={categoryColor}>{categoryIcon}</span>}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {step.label}
          </span>
          {step.durationMs && step.status === 'done' && (
            <span className="text-xs text-slate-400 dark:text-slate-500">{step.durationMs}ms</span>
          )}
        </div>

        {step.content && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {step.content}
          </p>
        )}
      </div>
    </div>
  );
};

export default ThinkingBlock;
