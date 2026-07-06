/**
 * ModelSelector Component
 *
 * Grid selector for AI models with capabilities badges.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Brain,
  Check,
  Code,
  Cpu,
  Eye,
  Lock,
  Star,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import type { LLMProviderConfig } from '../../types/domain/ai';

interface ModelSelectorProps {
  value: string | null;
  onChange: (modelId: string | null) => void;
  availableModels?: LLMProviderConfig[];
  visibleModelIds?: string[];
  onVisibilityChange?: (modelIds: string[]) => void;
  showVisibilityToggle?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

// Capability icons
const CAPABILITY_ICONS: Record<string, React.ElementType> = {
  vision: Eye,
  reasoning: Brain,
  coding: Code,
  fast: Zap,
  streaming: Wifi,
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  availableModels = [],
  visibleModelIds = [],
  onVisibilityChange,
  showVisibilityToggle = false,
  disabled = false,
  loading = false,
  className = '',
}) => {
  const [models, setModels] = useState<LLMProviderConfig[]>(availableModels);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/ai-settings/available-models', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          queueMicrotask(() => setModels(data));
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };

    if (availableModels.length > 0) {
      queueMicrotask(() => setModels(availableModels));
    } else {
      // Fetch available models
      fetchModels();
    }
  }, [availableModels]);

  const isModelVisible = (modelId: string) => {
    if (visibleModelIds.length === 0) return true;
    return visibleModelIds.includes(modelId);
  };

  const toggleVisibility = (modelId: string) => {
    if (!onVisibilityChange) return;

    const newVisibleIds = isModelVisible(modelId)
      ? visibleModelIds.filter((id) => id !== modelId)
      : [...visibleModelIds, modelId];

    onVisibilityChange(newVisibleIds);
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'openai':
        return 'from-emerald-500 to-blue-500';
      case 'anthropic':
        return 'from-amber-500 to-amber-500';
      case 'google':
        return 'from-blue-500 to-blue-500';
      case 'ollama':
        return 'from-c-accent-soft to-c-accent-soft';
      case 'deepseek':
        return 'from-danger-500 to-pink-500';
      default:
        return 'from-c-surface to-c-surface';
    }
  };

  const getHealthBadge = (status?: string) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="flex items-center gap-1 text-emerald-400">
            <Wifi className="w-3 h-3" /> Online
          </span>
        );
      case 'degraded':
        return (
          <span className="flex items-center gap-1 text-amber-400">
            <AlertCircle className="w-3 h-3" /> Degraded
          </span>
        );
      case 'unhealthy':
        return (
          <span className="flex items-center gap-1 text-danger-400">
            <WifiOff className="w-3 h-3" /> Offline
          </span>
        );
      default:
        return null;
    }
  };

  if (loading || models.length === 0) {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${className}`}>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-c-surface-raised animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-c-accent" />
          <h3 className="font-semibold text-c-text">AI Models</h3>
        </div>
        {value && (
          <button
            onClick={() => onChange(null)}
            className="text-xs text-c-text-muted hover:text-c-text dark:hover:text-white transition-colors"
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Models Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {models.map((model) => {
          const isSelected = value === model.id;
          const isVisible = isModelVisible(model.id);
          const providerColor = getProviderColor(model.provider);

          return (
            <motion.div
              key={model.id}
              className={`relative`}
              whileHover={!disabled ? { scale: 1.02 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
            >
              <button
                onClick={() => !disabled && onChange(isSelected ? null : model.id)}
                disabled={disabled}
                className={`
                                    w-full p-4 rounded-xl text-left transition-all duration-200
                                    ${
                                      isSelected
                                        ? `bg-gradient-to-br ${providerColor} bg-opacity-20 border-2 border-white/30 shadow-lg`
                                        : 'bg-c-surface-raised border border-c-border-subtle hover:border-c-border-subtle'
                                    }
                                    ${!isVisible && showVisibilityToggle ? 'opacity-50' : ''}
                                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                `}
              >
                {/* Selection indicator */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-c-surface text-c-text flex items-center justify-center"
                    >
                      <Check className="w-3 h-3" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Provider badge */}
                <div
                  className={`
                                    inline-flex px-2 py-0.5 rounded text-xs font-medium mb-2
                                    bg-gradient-to-r ${providerColor} text-white/90
                                `}
                >
                  {model.provider}
                </div>

                {/* Model name */}
                <h4 className="font-medium text-c-text truncate mb-1">
                  {model.name}
                </h4>

                {/* Model ID */}
                <p className="text-xs text-c-text-muted truncate mb-2">
                  {model.model_id}
                </p>

                {/* Capabilities */}
                {model.capabilities && model.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {model.capabilities.slice(0, 3).map((cap) => {
                      const CapIcon = CAPABILITY_ICONS[cap] || Zap;
                      return (
                        <span
                          key={cap}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-c-surface-raised text-c-text-secondary"
                        >
                          <CapIcon className="w-3 h-3" />
                          {cap}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Health status */}
                {model.healthStatus && (
                  <div className="mt-2 text-xs">{getHealthBadge(model.healthStatus)}</div>
                )}
              </button>

              {/* Visibility toggle */}
              {showVisibilityToggle && onVisibilityChange && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisibility(model.id);
                  }}
                  className={`
                                        absolute bottom-2 right-2 p-1.5 rounded-lg transition-colors
                                        ${
                                          isVisible
                                            ? 'bg-c-accent-soft text-c-accent hover:bg-c-accent-soft'
                                            : 'bg-c-surface-raised text-c-text-muted hover:text-c-text-secondary'
                                        }
                                    `}
                  title={isVisible ? 'Hide model' : 'Show model'}
                >
                  {isVisible ? <Eye className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* No models message */}
      {models.length === 0 && !loading && (
        <div className="text-center py-8">
          <Cpu className="w-12 h-12 text-c-text-secondary mx-auto mb-3" />
          <p className="text-c-text-muted">No models available</p>
          <p className="text-sm text-c-text-muted mt-1">
            Contact your administrator to enable AI models
          </p>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
