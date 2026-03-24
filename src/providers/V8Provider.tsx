/**
 * V8Provider
 * Context provider exposing V8 feature flag state to the component tree.
 */

import React, { createContext, useContext, useMemo } from 'react';

import { useV8FeatureFlag } from '@/hooks/useV8FeatureFlag';

interface V8ContextValue {
  isV8Enabled: boolean;
  isV8ChatEnabled: boolean;
  isV8AICoreEnabled: boolean;
  isLoading: boolean;
  flags: Record<string, boolean> | undefined;
}

const V8Context = createContext<V8ContextValue | null>(null);

export function V8Provider({ children }: { children: React.ReactNode }) {
  const { flags: rawFlags, isLoading, error } = useV8FeatureFlag();

  const value = useMemo<V8ContextValue>(() => {
    const flags = error ? undefined : rawFlags;
    const safe = flags ?? {};
    return {
      isV8Enabled: Object.values(safe).some(Boolean),
      isV8ChatEnabled: safe.chat === true,
      isV8AICoreEnabled: safe.ai_core === true,
      isLoading,
      flags,
    };
  }, [rawFlags, isLoading, error]);

  return <V8Context.Provider value={value}>{children}</V8Context.Provider>;
}

export function useV8() {
  const ctx = useContext(V8Context);
  if (!ctx) throw new Error('useV8 must be used within V8Provider');
  return ctx;
}
