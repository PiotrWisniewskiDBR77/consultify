import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * usePageTracking - Analytics tracking hook
 * 
 * Automatically tracks page views when route changes.
 * Integrates with Google Analytics and custom analytics.
 */
export function usePageTracking() {
    const location = useLocation();

    useEffect(() => {
        const pagePath = location.pathname + location.search;

        // Google Analytics (gtag.js)
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('config', process.env.VITE_GA_MEASUREMENT_ID || 'GA_MEASUREMENT_ID', {
                page_path: pagePath,
                page_title: document.title,
            });
        }

        // Google Analytics 4 (gtag.js)
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'page_view', {
                page_path: pagePath,
                page_title: document.title,
            });
        }

        // Custom analytics / logging
        console.log('[Analytics] Page view:', {
            path: pagePath,
            title: document.title,
            timestamp: new Date().toISOString(),
        });

        // TODO: Add your custom analytics service here
        // Example: Mixpanel, Amplitude, Segment, etc.
        // analytics.track('Page View', { path: pagePath });

    }, [location.pathname, location.search]);
}
