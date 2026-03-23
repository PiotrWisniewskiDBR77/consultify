import { useV8 } from '@/providers/V8Provider';

/**
 * Gate hook for conditionally rendering V8 features.
 * Returns { showV8, showLegacy } based on V8 feature flags.
 *
 * Usage:
 *   const { showV8Chat, showLegacyChat } = useV8Gate();
 *   return showV8Chat ? <V8ChatPanel /> : <LegacyChatPanel />;
 */
export function useV8Gate() {
  const { isV8Enabled, isV8ChatEnabled, isV8AICoreEnabled, isLoading } = useV8();

  return {
    isLoading,
    showV8Chat: isV8ChatEnabled && !isLoading,
    showLegacyChat: !isV8ChatEnabled || isLoading,
    showV8AICore: isV8AICoreEnabled && !isLoading,
    showLegacyAICore: !isV8AICoreEnabled || isLoading,
    isV8Enabled,
  };
}
