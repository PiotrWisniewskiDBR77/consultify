/**
 * ThinkingBlock - Chain of Thought reasoning display
 * Shows AI's thinking process step by step with animations
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ChevronDown, 
  ChevronUp, 
  Brain, 
  Search, 
  FileText, 
  CheckCircle2, 
  Loader2,
  Sparkles
} from 'lucide-react';
import { ThinkingStep } from '../../../types';

interface ThinkingBlockProps {
  steps: ThinkingStep[];
  isStreaming?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  analysis: <Brain size={14} />,
  research: <Search size={14} />,
  synthesis: <FileText size={14} />,
  validation: <CheckCircle2 size={14} />
};

const CATEGORY_COLORS: Record<string, string> = {
  analysis: 'text-purple-500 dark:text-purple-400',
  research: 'text-blue-500 dark:text-blue-400',
  synthesis: 'text-green-500 dark:text-green-400',
  validation: 'text-amber-500 dark:text-amber-400'
};

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  steps,
  isStreaming = false,
  defaultExpanded = false,
  className = ''
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calculate progress
  const completedSteps = steps.filter(s => s.status === 'done').length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  // Current step being processed
  const currentStep = useMemo(() => 
    steps.find(s => s.status === 'in_progress') || steps.find(s => s.status === 'pending'),
    [steps]
  );

  // Total duration
  const totalDuration = useMemo(() => 
    steps.reduce((acc, step) => acc + (step.durationMs || 0), 0),
    [steps]
  );

  if (steps.length === 0) return null;

  return (
    <div className={`mb-3 ${className}`}>
      {/* Collapsed Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
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
        <div className={`flex-shrink-0 ${isStreaming ? 'animate-pulse' : ''}`}>
          {isStreaming ? (
            <Loader2 size={16} className="text-purple-500 animate-spin" />
          ) : (
            <Sparkles size={16} className="text-purple-500" />
          )}
        </div>

        {/* Status */}
        <div className="flex-1 text-left">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {isStreaming 
              ? t('thinking.processing', 'Thinking...')
              : t('thinking.complete', 'Reasoning complete')
            }
          </span>
          {currentStep && isStreaming && (
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
              {currentStep.label}
            </span>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
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

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-2 px-3 py-2 bg-slate-50 dark:bg-navy-800/50 rounded-lg border border-slate-100 dark:border-navy-700 space-y-2">
          {steps.map((step, index) => (
            <ThinkingStepItem 
              key={step.id} 
              step={step} 
              index={index}
              isLast={index === steps.length - 1}
            />
          ))}

          {/* Total duration */}
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
  const categoryColor = step.category ? CATEGORY_COLORS[step.category] : 'text-slate-500';

  const statusStyles = {
    pending: 'opacity-50',
    in_progress: 'animate-pulse',
    done: 'opacity-100'
  };

  return (
    <div className={`flex items-start gap-2 ${statusStyles[step.status]}`}>
      {/* Status indicator */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`
          w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium
          ${step.status === 'done' 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
            : step.status === 'in_progress'
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
              : 'bg-slate-100 dark:bg-navy-700 text-slate-400 dark:text-slate-500'
          }
        `}>
          {step.status === 'done' ? (
            <CheckCircle2 size={12} />
          ) : step.status === 'in_progress' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            index + 1
          )}
        </div>
        {!isLast && (
          <div className="w-0.5 h-4 bg-slate-200 dark:bg-navy-700 mt-1" />
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center gap-2">
          {categoryIcon && (
            <span className={categoryColor}>{categoryIcon}</span>
          )}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {step.label}
          </span>
          {step.durationMs && step.status === 'done' && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {step.durationMs}ms
            </span>
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






