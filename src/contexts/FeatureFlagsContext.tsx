/**
 * FeatureFlagsContext - Application-wide Feature Flag Provider
 *
 * Provides feature flag state to the entire application tree.
 * Includes DevTools panel for development/testing.
 *
 * @example
 * // In App.tsx
 * <FeatureFlagsProvider>
 *   <App />
 * </FeatureFlagsProvider>
 *
 * // In any component
 * const { isEnabled } = useFeatureFlagsContext();
 * if (isEnabled('newFeature')) {
 *   return <NewFeatureComponent />;
 * }
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Beaker,
  Brain,
  ChevronDown,
  ChevronUp,
  Eye,
  Flag,
  GitBranch,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  FeatureFlag,
  FeatureFlagsConfig,
  useFeatureFlags,
  UseFeatureFlagsReturn,
} from '../hooks/useFeatureFlags';

// ============================================
// CONTEXT
// ============================================

const FeatureFlagsContext = createContext<UseFeatureFlagsReturn | null>(null);

export const useFeatureFlagsContext = (): UseFeatureFlagsReturn => {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error('useFeatureFlagsContext must be used within FeatureFlagsProvider');
  }
  return context;
};

const OPEN_DEVTOOLS_EVENT = 'consultify:openFeatureFlagsDevTools';

// ============================================
// DEVTOOLS COMPONENT
// ============================================

interface DevToolsPanelProps {
  featureFlags: UseFeatureFlagsReturn;
  onClose: () => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  ui: <Eye size={14} />,
  ai: <Brain size={14} />,
  performance: <GitBranch size={14} />,
  experimental: <Beaker size={14} />,
  beta: <Sparkles size={14} />,
};

const categoryColors: Record<string, string> = {
  ui: 'text-blue-400 bg-blue-400/10',
  ai: 'text-primary-400 bg-primary-400/10',
  performance: 'text-green-400 bg-green-400/10',
  experimental: 'text-amber-400 bg-amber-400/10',
  beta: 'text-pink-400 bg-pink-400/10',
};

const DevToolsPanel: React.FC<DevToolsPanelProps> = ({ featureFlags, onClose }) => {
  const { flags, flagDefinitions, setFlag, clearAllOverrides, refresh, isLoading } = featureFlags;
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['ui', 'ai']));

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev: Set<string>) => {
      const next = new Set<string>(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Group flags by category
  const groupedFlags = flagDefinitions.reduce(
    (acc, flag) => {
      if (!acc[flag.category]) {
        acc[flag.category] = [];
      }
      acc[flag.category].push(flag);
      return acc;
    },
    {} as Record<string, FeatureFlag[]>
  );

  return (
    <motion.div
      className="fixed bottom-4 right-4 w-96 bg-navy-900 border border-c-border-subtle rounded-xl shadow-2xl overflow-hidden z-[9999]"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-navy-800 border-b border-c-border-subtle">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <Flag size={16} className="text-primary-400" />
            <span className="font-medium text-white text-sm">Feature Flags</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-500 leading-snug">
            Toggle experimental features locally. Changes persist in localStorage. Only tested flags
            are shown.
          </p>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/20 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh flags"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={clearAllOverrides}
            className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-danger-400 hover:bg-danger-400/10 rounded-lg transition-colors"
            title="Clear all overrides"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/20 rounded-lg transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Flag List */}
      <div className="max-h-96 overflow-y-auto">
        {Object.entries(groupedFlags).map(([category, categoryFlags]) => (
          <div key={category}>
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-4 py-2 bg-navy-850 hover:bg-navy-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`p-1 rounded ${categoryColors[category]}`}>
                  {categoryIcons[category]}
                </span>
                <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                  {category}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ({categoryFlags.length})
                </span>
              </div>
              {expandedCategories.has(category) ? (
                <ChevronUp size={14} className="text-slate-500 dark:text-slate-400" />
              ) : (
                <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
              )}
            </button>

            {/* Category Flags */}
            <AnimatePresence>
              {expandedCategories.has(category) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {categoryFlags.map((flag) => (
                    <div
                      key={flag.id}
                      className="flex items-center justify-between px-4 py-2.5 border-b border-c-border-subtle last:border-b-0"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="text-sm text-white truncate">{flag.name}</div>
                        {flag.description && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {flag.description}
                          </div>
                        )}
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={flags[flag.id] ?? false}
                          onChange={(e) => setFlag(flag.id, e.target.checked)}
                          disabled={flag.allowLocalOverride === false}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-navy-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed" />
                      </label>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-navy-800 border-t border-c-border-subtle">
        <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Changes saved to localStorage
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// PROVIDER
// ============================================

export interface FeatureFlagsProviderProps {
  children: React.ReactNode;
  config?: Partial<FeatureFlagsConfig>;
  /** Show DevTools in development mode */
  showDevTools?: boolean;
}

export const FeatureFlagsProvider: React.FC<FeatureFlagsProviderProps> = ({
  children,
  config = {},
  showDevTools = process.env.NODE_ENV === 'development',
}) => {
  const resolvedConfig = useMemo(() => {
    if (typeof window === 'undefined') return config;

    const storageKey = `${config.storagePrefix ?? 'consultify'}_anon_id`;
    let anonId = '';
    try {
      anonId = localStorage.getItem(storageKey) ?? '';
      if (!anonId) {
        // Prefer crypto.randomUUID when available for stable client bucketing
        const uuid =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? (crypto.randomUUID as () => string)()
            : `anon_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
        anonId = uuid;
        localStorage.setItem(storageKey, anonId);
      }
    } catch {
      // If storage is unavailable, use a per-session fallback (still deterministic within the session)
      anonId = `anon_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    }

    return {
      ...config,
      userId: config.userId ?? anonId,
    };
  }, [config]);

  const featureFlags = useFeatureFlags(resolvedConfig);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

  useEffect(() => {
    if (!showDevTools) return;

    const open = () => setIsDevToolsOpen(true);
    window.addEventListener(OPEN_DEVTOOLS_EVENT, open);
    return () => window.removeEventListener(OPEN_DEVTOOLS_EVENT, open);
  }, [showDevTools]);

  return (
    <FeatureFlagsContext.Provider value={featureFlags}>
      {children}

      {/* DevTools */}
      {showDevTools && (
        <>
          <AnimatePresence>
            {isDevToolsOpen ? (
              <DevToolsPanel featureFlags={featureFlags} onClose={() => setIsDevToolsOpen(false)} />
            ) : null}
          </AnimatePresence>
        </>
      )}
    </FeatureFlagsContext.Provider>
  );
};

// ============================================
// FEATURE FLAG CONDITIONAL COMPONENT
// ============================================

export interface FeatureProps {
  /** Flag ID to check */
  flag: string;
  /** Content to render when flag is enabled */
  children: React.ReactNode;
  /** Content to render when flag is disabled */
  fallback?: React.ReactNode;
}

/**
 * Conditionally render content based on feature flag
 *
 * @example
 * <Feature flag="newHeader" fallback={<OldHeader />}>
 *   <NewHeader />
 * </Feature>
 */
export const Feature: React.FC<FeatureProps> = ({ flag, children, fallback = null }) => {
  const { isEnabled } = useFeatureFlagsContext();

  if (isEnabled(flag)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

export default FeatureFlagsProvider;
