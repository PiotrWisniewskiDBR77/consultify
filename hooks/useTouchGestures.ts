/**
 * useTouchGestures Hook
 * 
 * Provides touch gesture detection for mobile/tablet interactions.
 * Supports swipe, long-press, and pinch gestures.
 */

import { useRef, useCallback, useEffect, useState } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

interface TouchPosition {
    x: number;
    y: number;
    time: number;
}

interface SwipeConfig {
    minDistance?: number;      // Minimum distance in pixels for swipe
    maxTime?: number;          // Maximum time in ms for swipe
    threshold?: number;        // Angle threshold for direction detection
}

interface LongPressConfig {
    delay?: number;            // Time in ms to trigger long press
    onStart?: () => void;      // Called when long press starts
    onEnd?: () => void;        // Called when long press ends
    onCancel?: () => void;     // Called when long press is cancelled
}

interface UseTouchGesturesOptions {
    onSwipe?: (direction: SwipeDirection) => void;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onLongPress?: () => void;
    onDoubleTap?: () => void;
    swipeConfig?: SwipeConfig;
    longPressConfig?: LongPressConfig;
    enabled?: boolean;
}

const DEFAULT_SWIPE_CONFIG: SwipeConfig = {
    minDistance: 50,
    maxTime: 300,
    threshold: 30,
};

const DEFAULT_LONG_PRESS_CONFIG: LongPressConfig = {
    delay: 500,
};

export const useTouchGestures = <T extends HTMLElement = HTMLElement>(
    options: UseTouchGesturesOptions = {}
) => {
    const {
        onSwipe,
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        onLongPress,
        onDoubleTap,
        swipeConfig = DEFAULT_SWIPE_CONFIG,
        longPressConfig = DEFAULT_LONG_PRESS_CONFIG,
        enabled = true,
    } = options;

    const elementRef = useRef<T | null>(null);
    const touchStartRef = useRef<TouchPosition | null>(null);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastTapTimeRef = useRef<number>(0);
    const [isLongPressing, setIsLongPressing] = useState(false);

    // Swipe config with defaults
    const config: SwipeConfig = {
        ...DEFAULT_SWIPE_CONFIG,
        ...swipeConfig,
    };

    const lpConfig: LongPressConfig = {
        ...DEFAULT_LONG_PRESS_CONFIG,
        ...longPressConfig,
    };

    // Clear long press timer
    const clearLongPressTimer = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }, []);

    // Calculate swipe direction
    const getSwipeDirection = useCallback((
        startX: number,
        startY: number,
        endX: number,
        endY: number
    ): SwipeDirection => {
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Check if swipe distance is significant
        if (absX < config.minDistance! && absY < config.minDistance!) {
            return null;
        }

        // Determine primary direction
        if (absX > absY) {
            return deltaX > 0 ? 'right' : 'left';
        } else {
            return deltaY > 0 ? 'down' : 'up';
        }
    }, [config.minDistance]);

    // Touch start handler
    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (!enabled) return;

        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
        };

        // Double tap detection
        const currentTime = Date.now();
        if (currentTime - lastTapTimeRef.current < 300 && onDoubleTap) {
            onDoubleTap();
            lastTapTimeRef.current = 0;
        } else {
            lastTapTimeRef.current = currentTime;
        }

        // Long press detection
        if (onLongPress) {
            clearLongPressTimer();
            longPressTimerRef.current = setTimeout(() => {
                setIsLongPressing(true);
                lpConfig.onStart?.();
                onLongPress();
            }, lpConfig.delay);
        }
    }, [enabled, onDoubleTap, onLongPress, clearLongPressTimer, lpConfig]);

    // Touch move handler
    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!enabled || !touchStartRef.current) return;

        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

        // Cancel long press if moved too much
        if (deltaX > 10 || deltaY > 10) {
            if (isLongPressing) {
                setIsLongPressing(false);
                lpConfig.onCancel?.();
            }
            clearLongPressTimer();
        }
    }, [enabled, isLongPressing, clearLongPressTimer, lpConfig]);

    // Touch end handler
    const handleTouchEnd = useCallback((e: TouchEvent) => {
        if (!enabled) return;

        clearLongPressTimer();

        if (isLongPressing) {
            setIsLongPressing(false);
            lpConfig.onEnd?.();
            touchStartRef.current = null;
            return;
        }

        if (!touchStartRef.current) return;

        const touch = e.changedTouches[0];
        const elapsed = Date.now() - touchStartRef.current.time;

        // Check if within swipe time threshold
        if (elapsed <= config.maxTime!) {
            const direction = getSwipeDirection(
                touchStartRef.current.x,
                touchStartRef.current.y,
                touch.clientX,
                touch.clientY
            );

            if (direction) {
                onSwipe?.(direction);
                
                switch (direction) {
                    case 'left':
                        onSwipeLeft?.();
                        break;
                    case 'right':
                        onSwipeRight?.();
                        break;
                    case 'up':
                        onSwipeUp?.();
                        break;
                    case 'down':
                        onSwipeDown?.();
                        break;
                }
            }
        }

        touchStartRef.current = null;
    }, [
        enabled,
        isLongPressing,
        clearLongPressTimer,
        lpConfig,
        config.maxTime,
        getSwipeDirection,
        onSwipe,
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
    ]);

    // Touch cancel handler
    const handleTouchCancel = useCallback(() => {
        clearLongPressTimer();
        if (isLongPressing) {
            setIsLongPressing(false);
            lpConfig.onCancel?.();
        }
        touchStartRef.current = null;
    }, [clearLongPressTimer, isLongPressing, lpConfig]);

    // Attach event listeners
    useEffect(() => {
        const element = elementRef.current;
        if (!element || !enabled) return;

        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: true });
        element.addEventListener('touchend', handleTouchEnd, { passive: true });
        element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
            element.removeEventListener('touchcancel', handleTouchCancel);
            clearLongPressTimer();
        };
    }, [
        enabled,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleTouchCancel,
        clearLongPressTimer,
    ]);

    return {
        ref: elementRef,
        isLongPressing,
    };
};

/**
 * Simple hook for swipe-to-navigate between items
 */
export const useSwipeNavigation = (
    onPrevious: () => void,
    onNext: () => void,
    enabled: boolean = true
) => {
    return useTouchGestures({
        onSwipeLeft: onNext,
        onSwipeRight: onPrevious,
        enabled,
        swipeConfig: {
            minDistance: 80,
            maxTime: 400,
        },
    });
};

/**
 * Hook for swipeable modals/panels (swipe down to close)
 */
export const useSwipeToClose = (
    onClose: () => void,
    enabled: boolean = true
) => {
    return useTouchGestures({
        onSwipeDown: onClose,
        enabled,
        swipeConfig: {
            minDistance: 100,
            maxTime: 500,
        },
    });
};

export default useTouchGestures;



