/**
 * ProactivitySelector Component
 *
 * Visual selector for AI proactivity modes (REACTIVE, BALANCED, PROACTIVE)
 * with animated transitions and behavior explanations.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, Pause, Scale, X, Zap } from 'lucide-react';
import React from 'react';

import { AIProactivityMode, ProactivityBehavior } from '../../types';

// Mode configurations
const MODE_CONFIG: Record<
  AIProactivityMode,
  {
    title: string;
    shortDescription: string;
    longDescription: string;
    icon: React.ElementType;
    color: string;
    bgGradient: string;
    borderColor: string;
    glowColor: string;
    characteristics: string[];
    behaviors: ProactivityBehavior;
  }
> = {
  REACTIVE: {
    title: 'Reactive',
    shortDescription: 'AI waits for your questions',
    longDescription:
      'The AI remains silent until you ask. Perfect for experienced users who prefer to work independently.',
    icon: Pause,
    color: 'text-slate-400 dark:text-slate-500',
    bgGradient: 'from-slate-800 to-slate-900',
    borderColor: 'border-slate-600',
    glowColor: 'shadow-slate-500/20',
    characteristics: [
      'Responds only when asked',
      'No automatic suggestions',
      'No proactive notifications',
      'Full user control',
    ],
    behaviors: {
      autoSuggest: false,
      nudges: false,
      contextualHints: false,
      initiateConversation: false,
    },
  },
  BALANCED: {
    title: 'Balanced',
    shortDescription: 'AI suggests when helpful',
    longDescription:
      'The AI provides suggestions when it detects you might benefit, but waits for you to initiate major interactions.',
    icon: Scale,
    color: 'text-violet-400',
    bgGradient: 'from-violet-900/50 to-purple-900/50',
    borderColor: 'border-violet-500',
    glowColor: 'shadow-violet-500/30',
    characteristics: [
      'Helpful suggestions when relevant',
      'Contextual hints appear naturally',
      'Waits for you to start conversations',
      'Background recommendations',
    ],
    behaviors: {
      autoSuggest: true,
      nudges: true,
      contextualHints: true,
      initiateConversation: false,
    },
  },
  PROACTIVE: {
    title: 'Proactive',
    shortDescription: 'AI actively assists',
    longDescription:
      'The AI actively monitors your work and proactively offers assistance, starting conversations about potential issues.',
    icon: Zap,
    color: 'text-emerald-400',
    bgGradient: 'from-emerald-900/50 to-teal-900/50',
    borderColor: 'border-emerald-500',
    glowColor: 'shadow-emerald-500/30',
    characteristics: [
      'Active suggestions and analysis',
      'Proactively starts conversations',
      'Continuous monitoring and alerts',
      'Frequent recommendations',
    ],
    behaviors: {
      autoSuggest: true,
      nudges: true,
      contextualHints: true,
      initiateConversation: true,
    },
  },
};

const MODES: AIProactivityMode[] = ['REACTIVE', 'BALANCED', 'PROACTIVE'];

interface ProactivitySelectorProps {
  value: AIProactivityMode;
  onChange: (mode: AIProactivityMode) => void;
  maxAllowed?: AIProactivityMode;
  disabled?: boolean;
  compact?: boolean;
  showBehaviors?: boolean;
  className?: string;
}

export const ProactivitySelector: React.FC<ProactivitySelectorProps> = ({
  value,
  onChange,
  maxAllowed = 'PROACTIVE',
  disabled = false,
  compact = false,
  showBehaviors = true,
  className = '',
}) => {
  const maxIndex = MODES.indexOf(maxAllowed);
  const selectedConfig = MODE_CONFIG[value];
  const Icon = selectedConfig.icon;

  const isAllowed = (mode: AIProactivityMode) => {
    return MODES.indexOf(mode) <= maxIndex;
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {MODES.map((mode) => {
          const config = MODE_CONFIG[mode];
          const ModeIcon = config.icon;
          const isSelected = value === mode;
          const allowed = isAllowed(mode);

          return (
            <motion.button
              key={mode}
              onClick={() => allowed && !disabled && onChange(mode)}
              disabled={disabled || !allowed}
              className={`
                                relative p-2 rounded-lg transition-all duration-200
                                ${
                                  isSelected
                                    ? `bg-gradient-to-br ${config.bgGradient} ${config.borderColor} border shadow-lg ${config.glowColor}`
                                    : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
                                }
                                ${!allowed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
              whileHover={allowed && !disabled ? { scale: 1.05 } : {}}
              whileTap={allowed && !disabled ? { scale: 0.98 } : {}}
            >
              <ModeIcon
                className={`w-5 h-5 ${isSelected ? config.color : 'text-slate-500 dark:text-slate-400'}`}
              />
              {isSelected && (
                <motion.div
                  layoutId="proactivity-indicator"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white dark:bg-navy-900"
                />
              )}
            </motion.button>
          );
        })}
        <span className={`ml-2 text-sm font-medium ${selectedConfig.color}`}>
          {selectedConfig.title}
        </span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${selectedConfig.color}`} />
        <h3 className="text-lg font-semibold text-navy-900 dark:text-white">AI Proactivity</h3>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">How should AI interact with you?</p>

      {/* Mode Selector Cards */}
      <div className="grid grid-cols-3 gap-3">
        {MODES.map((mode) => {
          const config = MODE_CONFIG[mode];
          const ModeIcon = config.icon;
          const isSelected = value === mode;
          const allowed = isAllowed(mode);

          return (
            <motion.button
              key={mode}
              onClick={() => allowed && !disabled && onChange(mode)}
              disabled={disabled || !allowed}
              className={`
                                relative p-4 rounded-xl transition-all duration-300 text-left
                                ${
                                  isSelected
                                    ? `bg-gradient-to-br ${config.bgGradient} ${config.borderColor} border-2 shadow-xl ${config.glowColor}`
                                    : 'bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                }
                                ${!allowed ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
              whileHover={allowed && !disabled ? { y: -2 } : {}}
              whileTap={allowed && !disabled ? { scale: 0.98 } : {}}
            >
              {/* Selection indicator */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className={`absolute top-3 right-3 w-5 h-5 rounded-full ${config.color} bg-white/10 flex items-center justify-center`}
                  >
                    <Check className="w-3 h-3" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Icon */}
              <div
                className={`
                                w-10 h-10 rounded-lg flex items-center justify-center mb-3
                                ${
                                  isSelected
                                    ? `bg-gradient-to-br ${config.bgGradient} border ${config.borderColor}`
                                    : 'bg-slate-200 dark:bg-slate-700/50'
                                }
                            `}
              >
                <ModeIcon
                  className={`w-5 h-5 ${isSelected ? config.color : 'text-slate-500 dark:text-slate-400'}`}
                />
              </div>

              {/* Title */}
              <h4
                className={`font-semibold mb-1 ${isSelected ? config.color : 'text-navy-900 dark:text-slate-300'}`}
              >
                {config.title}
              </h4>

              {/* Short description */}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {config.shortDescription}
              </p>

              {/* Locked indicator */}
              {!allowed && (
                <div className="absolute inset-0 rounded-xl bg-white/60 dark:bg-slate-900/60 flex items-center justify-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                    Org limit
                  </span>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Selected Mode Details */}
      {showBehaviors && (
        <AnimatePresence mode="wait">
          <motion.div
            key={value}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`
                            p-4 rounded-xl border
                            bg-gradient-to-br ${selectedConfig.bgGradient}
                            ${selectedConfig.borderColor}
                        `}
          >
            <div className="flex items-start gap-3">
              <div
                className={`
                                w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                                bg-white/5 border ${selectedConfig.borderColor}
                            `}
              >
                <Icon className={`w-5 h-5 ${selectedConfig.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`font-semibold ${selectedConfig.color} mb-1`}>
                  {selectedConfig.title} Mode
                </h4>
                <p className="text-sm text-slate-300 mb-3">{selectedConfig.longDescription}</p>

                {/* Behavior flags */}
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedConfig.behaviors).map(([key, enabled]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      {enabled ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      )}
                      <span
                        className={
                          enabled ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {formatBehaviorKey(key)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

// Helper to format behavior key names
function formatBehaviorKey(key: string): string {
  const labels: Record<string, string> = {
    autoSuggest: 'Auto-suggestions',
    nudges: 'Proactive nudges',
    contextualHints: 'Contextual hints',
    initiateConversation: 'Start conversations',
  };
  return labels[key] || key;
}

export default ProactivitySelector;
