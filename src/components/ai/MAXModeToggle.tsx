/**
 * MAX Mode Toggle Component
 *
 * Enables users to switch to MAX Mode (o1 reasoning models) for:
 * - Deep analytical tasks
 * - Strategic planning
 * - Complex problem solving
 *
 * Warning: MAX Mode uses 3x tokens for premium reasoning.
 */

import { AlertTriangle, Brain, Sparkles, Zap } from 'lucide-react';
import React, { useState } from 'react';

interface MAXModeToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  tokenMultiplier?: number;
  disabled?: boolean;
  showWarning?: boolean;
  compact?: boolean;
}

export function MAXModeToggle({
  enabled,
  onChange,
  tokenMultiplier = 3,
  disabled = false,
  showWarning = true,
  compact = false,
}: MAXModeToggleProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleToggle = () => {
    if (disabled) return;
    onChange(!enabled);
  };

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${
          enabled
            ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-500/30'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title={enabled ? 'MAX Mode aktywny (o1 reasoning)' : 'Włącz MAX Mode'}
      >
        {enabled ? <Zap className="w-3 h-3" /> : <Brain className="w-3 h-3" />}
        <span>MAX</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
          enabled
            ? 'bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-900/30 dark:to-indigo-900/30 border-primary-300 dark:border-primary-700'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
        }`}
      >
        {/* Icon */}
        <div
          className={`p-2 rounded-full ${
            enabled
              ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
          }`}
        >
          {enabled ? <Zap className="w-5 h-5" /> : <Brain className="w-5 h-5" />}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`font-semibold ${enabled ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}
            >
              MAX Mode
            </span>
            {enabled && (
              <span className="flex items-center gap-1 text-xs bg-primary-600 text-white px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                Aktywny
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {enabled
              ? 'Głęboka analiza z modelami o1 (reasoning)'
              : 'Włącz dla złożonych zadań analitycznych'}
          </p>
        </div>

        {/* Toggle */}
        <button
          onClick={handleToggle}
          disabled={disabled}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`relative w-12 h-6 rounded-full transition-all ${
            enabled
              ? 'bg-gradient-to-r from-primary-600 to-indigo-600'
              : 'bg-gray-300 dark:bg-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white dark:bg-navy-900 shadow-md transition-transform ${
              enabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>

        {/* Tooltip */}
        {showTooltip && !disabled && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50">
            {enabled ? 'Wyłącz MAX Mode' : 'Włącz MAX Mode (3x tokens)'}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>

      {/* Warning */}
      {showWarning && enabled && (
        <div className="mt-2 flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-300">
            <p className="font-medium">MAX Mode zużywa {tokenMultiplier}x więcej tokenów</p>
            <p className="mt-0.5 text-amber-600 dark:text-amber-400">
              Zalecane dla: planowania strategicznego, złożonych analiz, decyzji krytycznych
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Inline MAX Mode indicator
 */
export function MAXModeIndicator({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-primary-600 to-indigo-600 text-white text-xs font-medium rounded-full">
      <Zap className="w-3 h-3" />
      MAX
    </span>
  );
}

/**
 * MAX Mode cost indicator
 */
export function MAXModeCostBadge({
  baseTokens,
  multiplier = 3,
}: {
  baseTokens: number;
  multiplier?: number;
}) {
  const totalTokens = baseTokens * multiplier;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 dark:text-gray-400">Szacowany koszt:</span>
      <span className="font-medium text-primary-600">~{totalTokens.toLocaleString()} tokenów</span>
      <span className="text-gray-600 dark:text-gray-500 dark:text-gray-400">
        ({multiplier}x MAX)
      </span>
    </div>
  );
}

export default MAXModeToggle;
