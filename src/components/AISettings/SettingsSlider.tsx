/**
 * SettingsSlider Component
 *
 * Slider with value display for AI settings (temperature, tokens, etc.)
 */

import { motion } from 'framer-motion';
import { Lock, LucideIcon, RotateCcw } from 'lucide-react';
import React from 'react';

interface SettingsSliderProps {
  label: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (value: number) => string;
  defaultValue?: number;
  showReset?: boolean;
  disabled?: boolean;
  locked?: boolean;
  lockedMessage?: string;
  className?: string;
}

export const SettingsSlider: React.FC<SettingsSliderProps> = ({
  label,
  description,
  icon: Icon,
  iconColor = 'text-c-text-secondary',
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit = '',
  formatValue,
  defaultValue,
  showReset = true,
  disabled = false,
  locked = false,
  lockedMessage = 'Controlled by organization',
  className = '',
}) => {
  const isDisabled = disabled || locked;
  const percentage = ((value - min) / (max - min)) * 100;
  const displayValue = formatValue ? formatValue(value) : value.toFixed(step < 1 ? 1 : 0);
  const canReset = showReset && defaultValue !== undefined && value !== defaultValue;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex-shrink-0 mt-0.5">
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`font-medium ${isDisabled ? 'text-c-text-muted' : 'text-c-text-muted'}`}
              >
                {label}
              </span>
              {locked && (
                <div className="relative group">
                  <Lock className="w-3.5 h-3.5 text-c-text-muted" />
                  <div
                    className="
                                        absolute left-1/2 -translate-x-1/2 bottom-full mb-2
                                        px-2 py-1 rounded bg-c-surface border border-c-border-strong
                                        text-xs text-c-text-secondary whitespace-nowrap
                                        opacity-0 invisible group-hover:opacity-100 group-hover:visible
                                        transition-all duration-200 z-50
                                    "
                  >
                    {lockedMessage}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <motion.span
                key={value}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-sm font-mono text-c-text bg-c-surface px-2 py-0.5 rounded"
              >
                {displayValue}
                {unit}
              </motion.span>

              {canReset && !isDisabled && (
                <button
                  onClick={() => onChange(defaultValue!)}
                  className="p-1 text-c-text-muted hover:text-c-text-muted transition-colors"
                  title="Reset to default"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {description && (
            <p
              className={`text-sm mt-0.5 ${isDisabled ? 'text-c-text-secondary' : 'text-c-text-secondary'}`}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Slider */}
      <div className="relative pt-1 pb-2">
        {/* Track background */}
        <div className="h-2 rounded-full bg-c-surface overflow-hidden">
          {/* Filled portion */}
          <motion.div
            className="h-full bg-gradient-to-r from-c-accent-soft to-c-accent-soft rounded-full"
            initial={false}
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>

        {/* Range input (invisible but functional) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => !isDisabled && onChange(parseFloat(e.target.value))}
          disabled={isDisabled}
          className={`
                        absolute inset-0 w-full h-full opacity-0 cursor-pointer
                        ${isDisabled ? 'cursor-not-allowed' : ''}
                    `}
        />

        {/* Custom thumb */}
        <motion.div
          className={`
                        absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full
                        bg-c-surface shadow-lg border-2 border-c-accent
                        pointer-events-none
                        ${isDisabled ? 'opacity-50' : ''}
                    `}
          style={{ left: `calc(${percentage}% - 8px)` }}
          animate={{ scale: isDisabled ? 1 : 1 }}
          whileHover={!isDisabled ? { scale: 1.2 } : {}}
        />

        {/* Min/Max labels */}
        <div className="flex justify-between mt-1 text-xs text-c-text-muted">
          <span>
            {min}
            {unit}
          </span>
          <span>
            {max}
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SettingsSlider;
