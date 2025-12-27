/**
 * useSwipeGestures Hook - Touch gestures for mobile
 * Part of My Work Module PMO Upgrade
 * 
 * Gestures:
 * - Swipe left: Schedule/Archive
 * - Swipe right: Accept today
 * - Pull down: Refresh
 * - Long press: Context menu
 */

import { useRef, useCallback, useState, useEffect } from 'react';

export interface SwipeConfig {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onLongPress?: () => void;
    threshold?: number;
    longPressDelay?: number;
    enabled?: boolean;
}

interface TouchState {
    startX: number;
    startY: number;
    startTime: number;
    isLongPress: boolean;
}

interface UseSwipeGesturesReturn {
    handlers: {
        onTouchStart: (e: React.TouchEvent) => void;
        onTouchMove: (e: React.TouchEvent) => void;
        onTouchEnd: (e: React.TouchEvent) => void;
    };
    swipeOffset: { x: number; y: number };
    isSwipingLeft: boolean;
    isSwipingRight: boolean;
}

/**
 * useSwipeGestures Hook
 */
export function useSwipeGestures(config: SwipeConfig = {}): UseSwipeGesturesReturn {
    const {
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        onLongPress,
        threshold = 50,
        longPressDelay = 500,
        enabled = true
    } = config;
    
    const touchState = useRef<TouchState | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    
    const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
    const [isSwipingLeft, setIsSwipingLeft] = useState(false);
    const [isSwipingRight, setIsSwipingRight] = useState(false);
    
    // Cleanup
    useEffect(() => {
        return () => {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
            }
        };
    }, []);
    
    // Touch start
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!enabled) return;
        
        const touch = e.touches[0];
        touchState.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            startTime: Date.now(),
            isLongPress: false
        };
        
        // Start long press timer
        if (onLongPress) {
            longPressTimer.current = setTimeout(() => {
                if (touchState.current) {
                    touchState.current.isLongPress = true;
                    onLongPress();
                }
            }, longPressDelay);
        }
    }, [enabled, onLongPress, longPressDelay]);
    
    // Touch move
    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!enabled || !touchState.current) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchState.current.startX;
        const deltaY = touch.clientY - touchState.current.startY;
        
        // Cancel long press if moved too much
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        }
        
        // Update swipe state
        setSwipeOffset({ x: deltaX, y: deltaY });
        setIsSwipingLeft(deltaX < -threshold);
        setIsSwipingRight(deltaX > threshold);
    }, [enabled, threshold]);
    
    // Touch end
    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!enabled || !touchState.current) return;
        
        // Clear long press timer
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        
        // Skip if was long press
        if (touchState.current.isLongPress) {
            touchState.current = null;
            setSwipeOffset({ x: 0, y: 0 });
            setIsSwipingLeft(false);
            setIsSwipingRight(false);
            return;
        }
        
        const changedTouch = e.changedTouches[0];
        const deltaX = changedTouch.clientX - touchState.current.startX;
        const deltaY = changedTouch.clientY - touchState.current.startY;
        
        // Determine swipe direction
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        
        if (absDeltaX > threshold && absDeltaX > absDeltaY) {
            // Horizontal swipe
            if (deltaX < 0 && onSwipeLeft) {
                onSwipeLeft();
            } else if (deltaX > 0 && onSwipeRight) {
                onSwipeRight();
            }
        } else if (absDeltaY > threshold && absDeltaY > absDeltaX) {
            // Vertical swipe
            if (deltaY < 0 && onSwipeUp) {
                onSwipeUp();
            } else if (deltaY > 0 && onSwipeDown) {
                onSwipeDown();
            }
        }
        
        // Reset state
        touchState.current = null;
        setSwipeOffset({ x: 0, y: 0 });
        setIsSwipingLeft(false);
        setIsSwipingRight(false);
    }, [enabled, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);
    
    return {
        handlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd
        },
        swipeOffset,
        isSwipingLeft,
        isSwipingRight
    };
}

export default useSwipeGestures;



