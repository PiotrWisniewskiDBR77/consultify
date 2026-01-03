/**
 * Progress Component - Apple HIG Design System
 * 
 * Progress indicators for showing completion status.
 * Supports bar, circular, and step variants.
 * 
 * @example
 * <Progress value={60} />
 * <Progress variant="circular" value={75} size="lg" />
 * <ProgressSteps current={2} total={5} />
 */

import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export type ProgressVariant = 'bar' | 'circular';
export type ProgressSize = 'sm' | 'md' | 'lg';
export type ProgressColor = 'primary' | 'success' | 'danger';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current value (0-100) */
  value: number;
  /** Maximum value */
  max?: number;
  /** Progress variant */
  variant?: ProgressVariant;
  /** Size */
  size?: ProgressSize;
  /** Color theme */
  color?: ProgressColor;
  /** Show value label */
  showLabel?: boolean;
  /** Custom label */
  label?: string;
  /** Animate value changes */
  animated?: boolean;
}

const barSizeStyles: Record<ProgressSize, string> = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2.5',
};

const circularSizeStyles: Record<ProgressSize, { size: number; stroke: number }> = {
  sm: { size: 32, stroke: 3 },
  md: { size: 48, stroke: 4 },
  lg: { size: 64, stroke: 5 },
};

const colorStyles: Record<ProgressColor, { bar: string; track: string }> = {
  primary: { 
    bar: 'bg-primary-500', 
    track: 'bg-slate-200 dark:bg-navy-800' 
  },
  success: { 
    bar: 'bg-success-500', 
    track: 'bg-slate-200 dark:bg-navy-800' 
  },
  danger: { 
    bar: 'bg-danger-500', 
    track: 'bg-slate-200 dark:bg-navy-800' 
  },
};

const strokeColors: Record<ProgressColor, string> = {
  primary: '#7C3AED',
  success: '#059669',
  danger: '#DC2626',
};

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      value,
      max = 100,
      variant = 'bar',
      size = 'md',
      color = 'primary',
      showLabel = false,
      label,
      animated = true,
      className = '',
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const { bar, track } = colorStyles[color];

    // Circular variant
    if (variant === 'circular') {
      const { size: circleSize, stroke } = circularSizeStyles[size];
      const radius = (circleSize - stroke) / 2;
      const circumference = radius * 2 * Math.PI;
      const offset = circumference - (percentage / 100) * circumference;

      return (
        <div
          ref={ref}
          className={`relative inline-flex items-center justify-center ${className}`}
          style={{ width: circleSize, height: circleSize }}
          {...props}
        >
          <svg
            width={circleSize}
            height={circleSize}
            className="transform -rotate-90"
          >
            {/* Track */}
            <circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              className="text-slate-200 dark:text-navy-800"
            />
            {/* Progress */}
            <motion.circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              fill="none"
              stroke={strokeColors[color]}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={animated ? { strokeDashoffset: circumference } : false}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </svg>
          {showLabel && (
            <span className="absolute text-xs font-semibold text-navy-900 dark:text-white">
              {label || `${Math.round(percentage)}%`}
            </span>
          )}
        </div>
      );
    }

    // Bar variant (default)
    return (
      <div ref={ref} className={`w-full ${className}`} {...props}>
        {showLabel && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-navy-900 dark:text-white">
              {label || 'Progress'}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
        <div className={`w-full ${track} rounded-full overflow-hidden ${barSizeStyles[size]}`}>
          <motion.div
            className={`h-full ${bar} rounded-full`}
            initial={animated ? { width: 0 } : false}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = 'Progress';

// Step Progress
export interface ProgressStepsProps {
  /** Current step (1-indexed) */
  current: number;
  /** Total steps */
  total: number;
  /** Step labels */
  labels?: string[];
  /** Clickable steps */
  clickable?: boolean;
  /** On step click */
  onStepClick?: (step: number) => void;
}

export const ProgressSteps: React.FC<ProgressStepsProps> = ({
  current,
  total,
  labels,
  clickable = false,
  onStepClick,
}) => {
  return (
    <div className="flex items-center w-full">
      {Array.from({ length: total }).map((_, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < current;
        const isCurrent = stepNumber === current;
        const isClickable = clickable && onStepClick;

        return (
          <React.Fragment key={index}>
            {/* Step indicator */}
            <button
              type="button"
              onClick={() => isClickable && onStepClick(stepNumber)}
              disabled={!isClickable}
              className={`
                relative flex flex-col items-center
                ${isClickable ? 'cursor-pointer' : 'cursor-default'}
              `}
            >
              <motion.div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center
                  text-sm font-medium
                  transition-colors duration-200
                  ${isCompleted 
                    ? 'bg-primary-500 text-white' 
                    : isCurrent
                    ? 'bg-primary-500 text-white ring-4 ring-primary-100 dark:ring-primary-900/30'
                    : 'bg-slate-200 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                  }
                `}
                initial={false}
                animate={isCompleted ? { scale: [1, 1.1, 1] } : {}}
              >
                {isCompleted ? <Check size={16} /> : stepNumber}
              </motion.div>
              {labels && labels[index] && (
                <span
                  className={`
                    absolute top-10 whitespace-nowrap text-xs font-medium
                    ${isCurrent 
                      ? 'text-navy-900 dark:text-white' 
                      : 'text-slate-500 dark:text-slate-400'
                    }
                  `}
                >
                  {labels[index]}
                </span>
              )}
            </button>

            {/* Connector line */}
            {index < total - 1 && (
              <div className="flex-1 h-0.5 mx-2">
                <div
                  className={`
                    h-full rounded-full transition-colors duration-200
                    ${stepNumber < current 
                      ? 'bg-primary-500' 
                      : 'bg-slate-200 dark:bg-navy-800'
                    }
                  `}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Progress;


