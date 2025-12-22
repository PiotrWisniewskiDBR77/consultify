// Simple error logging service
// In production, this would send to Sentry, LogRocket, etc.

interface ErrorContext {
    userId?: string;
    route?: string;
    timestamp: string;
    userAgent: string;
    [key: string]: unknown;
}

export const logError = async (
    error: Error,
    context: Partial<ErrorContext> = {}
): Promise<void> => {
    const errorData = {
        message: error.message,
        stack: error.stack,
        context: {
            ...context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            route: window.location.pathname
        }
    };

    // In development, just log to console
    if (process.env.NODE_ENV !== 'production') {
        console.error('[Error Logger]', errorData);
        return;
    }

    // In production, send to backend
    try {
        await fetch('/api/errors', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(errorData)
        });
    } catch (e) {
        // Silently fail - don't want error logging to cause more errors
        console.error('Failed to log error:', e);
    }
};

export const logPerformance = (
    metric: string,
    value: number,
    context?: Record<string, unknown>
): void => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Performance] ${metric}:`, value, context);
    }

    // TODO: Send to analytics service
};
