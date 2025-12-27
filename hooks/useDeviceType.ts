/**
 * useDeviceType Hook
 * 
 * Detects the current device type and provides responsive utilities
 * for mobile, tablet, and desktop layouts.
 */

import { useState, useEffect, useCallback } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

interface DeviceInfo {
    deviceType: DeviceType;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isTouchDevice: boolean;
    orientation: Orientation;
    screenWidth: number;
    screenHeight: number;
    safeAreaInsets: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
}

// Breakpoints matching tailwind.config.js
const BREAKPOINTS = {
    mobile: 767,    // max-width for mobile
    tablet: 1023,   // max-width for tablet
    desktop: 1024,  // min-width for desktop
};

/**
 * Determines if the device supports touch
 */
const checkTouchDevice = (): boolean => {
    if (typeof window === 'undefined') return false;
    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - for older browsers
        navigator.msMaxTouchPoints > 0
    );
};

/**
 * Gets safe area insets for notched devices
 */
const getSafeAreaInsets = () => {
    if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') {
        return { top: 0, bottom: 0, left: 0, right: 0 };
    }

    const style = getComputedStyle(document.documentElement);
    
    const parseInset = (prop: string): number => {
        const value = style.getPropertyValue(prop);
        return value ? parseInt(value, 10) || 0 : 0;
    };

    return {
        top: parseInset('--sat') || parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0', 10) || 0,
        bottom: parseInset('--sab') || parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10) || 0,
        left: parseInset('--sal') || parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0', 10) || 0,
        right: parseInset('--sar') || parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0', 10) || 0,
    };
};

/**
 * Determines device type based on screen width
 */
const getDeviceType = (width: number): DeviceType => {
    if (width <= BREAKPOINTS.mobile) return 'mobile';
    if (width <= BREAKPOINTS.tablet) return 'tablet';
    return 'desktop';
};

/**
 * Gets current orientation
 */
const getOrientation = (): Orientation => {
    if (typeof window === 'undefined') return 'portrait';
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
};

/**
 * Main hook for device detection
 */
export const useDeviceType = (): DeviceInfo => {
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
        const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const height = typeof window !== 'undefined' ? window.innerHeight : 768;
        const type = getDeviceType(width);

        return {
            deviceType: type,
            isMobile: type === 'mobile',
            isTablet: type === 'tablet',
            isDesktop: type === 'desktop',
            isTouchDevice: checkTouchDevice(),
            orientation: getOrientation(),
            screenWidth: width,
            screenHeight: height,
            safeAreaInsets: getSafeAreaInsets(),
        };
    });

    const updateDeviceInfo = useCallback(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const type = getDeviceType(width);

        setDeviceInfo({
            deviceType: type,
            isMobile: type === 'mobile',
            isTablet: type === 'tablet',
            isDesktop: type === 'desktop',
            isTouchDevice: checkTouchDevice(),
            orientation: getOrientation(),
            screenWidth: width,
            screenHeight: height,
            safeAreaInsets: getSafeAreaInsets(),
        });
    }, []);

    useEffect(() => {
        // Initial check
        updateDeviceInfo();

        // Listen for resize events
        window.addEventListener('resize', updateDeviceInfo);
        
        // Listen for orientation change (mobile devices)
        window.addEventListener('orientationchange', () => {
            // Delay to allow orientation to complete
            setTimeout(updateDeviceInfo, 100);
        });

        return () => {
            window.removeEventListener('resize', updateDeviceInfo);
            window.removeEventListener('orientationchange', updateDeviceInfo);
        };
    }, [updateDeviceInfo]);

    return deviceInfo;
};

/**
 * Hook to check if screen matches a specific breakpoint
 */
export const useMediaQuery = (query: string): boolean => {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia(query);
        const handleChange = (e: MediaQueryListEvent) => setMatches(e.matches);

        // Set initial value
        setMatches(mediaQuery.matches);

        // Listen for changes
        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [query]);

    return matches;
};

/**
 * Preset media query hooks for common breakpoints
 */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
export const useIsTouch = () => useMediaQuery('(max-width: 1023px)');
export const useIsPortrait = () => useMediaQuery('(orientation: portrait)');
export const useIsLandscape = () => useMediaQuery('(orientation: landscape)');

/**
 * Hook to detect if keyboard is visible (mobile)
 */
export const useKeyboardVisible = (): boolean => {
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const { isMobile, isTablet } = useDeviceType();

    useEffect(() => {
        if (!isMobile && !isTablet) return;

        const initialHeight = window.innerHeight;

        const handleResize = () => {
            // If height decreased significantly, keyboard is likely visible
            const heightDiff = initialHeight - window.innerHeight;
            setIsKeyboardVisible(heightDiff > 150);
        };

        // Use visualViewport API if available (more reliable)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
            return () => window.visualViewport?.removeEventListener('resize', handleResize);
        }

        // Fallback to window resize
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMobile, isTablet]);

    return isKeyboardVisible;
};

export default useDeviceType;



