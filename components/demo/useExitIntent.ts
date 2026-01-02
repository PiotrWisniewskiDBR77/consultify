import { useState, useEffect, useCallback } from 'react';

/**
 * useExitIntent — Detects user exit intent for conversion optimization
 * 
 * Triggers when:
 * - Mouse moves toward browser chrome (top of screen)
 * - User switches tabs
 * - Mobile: user scrolls up quickly (back gesture pattern)
 */

interface UseExitIntentOptions {
    threshold?: number; // Y threshold in pixels to trigger exit intent
    delayMs?: number; // Minimum time before exit intent can trigger
    triggerOnce?: boolean; // Only trigger once per session
    disabled?: boolean;
}

interface UseExitIntentReturn {
    showExitIntent: boolean;
    dismissExitIntent: () => void;
    resetExitIntent: () => void;
}

export const useExitIntent = (options: UseExitIntentOptions = {}): UseExitIntentReturn => {
    const {
        threshold = 50,
        delayMs = 5000, // Wait 5 seconds before allowing trigger
        triggerOnce = true,
        disabled = false
    } = options;

    const [showExitIntent, setShowExitIntent] = useState(false);
    const [hasTriggered, setHasTriggered] = useState(false);
    const [isReady, setIsReady] = useState(false);

    // Check if already dismissed in this session
    useEffect(() => {
        if (disabled) return;
        
        const alreadyDismissed = sessionStorage.getItem('exit_intent_dismissed');
        if (alreadyDismissed && triggerOnce) {
            setHasTriggered(true);
        }

        // Start delay timer
        const timer = setTimeout(() => {
            setIsReady(true);
        }, delayMs);

        return () => clearTimeout(timer);
    }, [delayMs, triggerOnce, disabled]);

    // Mouse exit detection (desktop)
    useEffect(() => {
        if (disabled || !isReady || hasTriggered) return;

        const handleMouseLeave = (e: MouseEvent) => {
            // Only trigger if mouse leaves toward top
            if (e.clientY <= threshold && !hasTriggered) {
                setShowExitIntent(true);
                if (triggerOnce) {
                    setHasTriggered(true);
                }
            }
        };

        document.addEventListener('mouseleave', handleMouseLeave);
        
        return () => {
            document.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [threshold, isReady, hasTriggered, triggerOnce, disabled]);

    // Tab visibility detection (desktop & mobile)
    useEffect(() => {
        if (disabled || !isReady || hasTriggered) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && !hasTriggered) {
                // User is leaving the tab
                setShowExitIntent(true);
                if (triggerOnce) {
                    setHasTriggered(true);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isReady, hasTriggered, triggerOnce, disabled]);

    const dismissExitIntent = useCallback(() => {
        setShowExitIntent(false);
        sessionStorage.setItem('exit_intent_dismissed', 'true');
    }, []);

    const resetExitIntent = useCallback(() => {
        setShowExitIntent(false);
        setHasTriggered(false);
        sessionStorage.removeItem('exit_intent_dismissed');
    }, []);

    return {
        showExitIntent,
        dismissExitIntent,
        resetExitIntent
    };
};

export default useExitIntent;



