import { useCallback, useRef } from 'react';
import { Api } from '../services/api';

/**
 * useJourneyTracking — Frontend hook for journey analytics
 * 
 * Features:
 * - Tracks milestones, feature usage, tour events
 * - Batches events for performance
 * - Handles offline queueing
 */

interface TrackOptions {
    organizationId?: string;
    [key: string]: any;
}

interface QueuedEvent {
    eventType: string;
    eventName: string;
    phase?: string;
    metadata: TrackOptions;
    timestamp: number;
}

const BATCH_INTERVAL = 5000; // 5 seconds
const MAX_QUEUE_SIZE = 20;

export const useJourneyTracking = () => {
    const queueRef = useRef<QueuedEvent[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const flushQueue = useCallback(async () => {
        if (queueRef.current.length === 0) return;

        const events = [...queueRef.current];
        queueRef.current = [];

        // Send events in parallel
        try {
            await Promise.all(
                events.map(event =>
                    Api.post('/analytics/journey/track', event).catch(err => {
                        console.warn('[JourneyTracking] Failed to track:', err);
                        // Re-queue failed events
                        queueRef.current.push(event);
                    })
                )
            );
        } catch (error) {
            console.error('[JourneyTracking] Flush error:', error);
        }
    }, []);

    const scheduleFlush = useCallback(() => {
        if (timerRef.current) return;
        timerRef.current = setTimeout(() => {
            flushQueue();
            timerRef.current = null;
        }, BATCH_INTERVAL);
    }, [flushQueue]);

    const queueEvent = useCallback((event: QueuedEvent) => {
        queueRef.current.push(event);

        // Flush immediately if queue is full
        if (queueRef.current.length >= MAX_QUEUE_SIZE) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            flushQueue();
        } else {
            scheduleFlush();
        }
    }, [flushQueue, scheduleFlush]);

    /**
     * Track phase entry
     */
    const trackPhaseEntry = useCallback((phase: string, options: TrackOptions = {}) => {
        queueEvent({
            eventType: 'phase_entry',
            eventName: `phase_${phase}_entered`,
            phase,
            metadata: options,
            timestamp: Date.now(),
        });
    }, [queueEvent]);

    /**
     * Track activation milestone
     */
    const trackMilestone = useCallback((milestone: string, options: TrackOptions = {}) => {
        queueEvent({
            eventType: 'milestone',
            eventName: milestone,
            metadata: options,
            timestamp: Date.now(),
        });
    }, [queueEvent]);

    /**
     * Track feature usage
     */
    const trackFeature = useCallback((featureId: string, options: TrackOptions = {}) => {
        queueEvent({
            eventType: 'feature_use',
            eventName: featureId,
            metadata: options,
            timestamp: Date.now(),
        });
    }, [queueEvent]);

    /**
     * Track tour events
     */
    const trackTour = useCallback((tourId: string, eventName: string, options: TrackOptions = {}) => {
        queueEvent({
            eventType: 'tour_event',
            eventName: eventName,
            metadata: { tourId, ...options },
            timestamp: Date.now(),
        });
    }, [queueEvent]);

    /**
     * Force flush (call before navigation)
     */
    const flush = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        flushQueue();
    }, [flushQueue]);

    return {
        trackPhaseEntry,
        trackMilestone,
        trackFeature,
        trackTour,
        flush,
    };
};

// Expose globally for TourProvider
if (typeof window !== 'undefined') {
    (window as any).journeyAnalytics = {
        trackMilestone: async (milestone: string, options?: TrackOptions) => {
            try {
                await Api.post('/analytics/journey/track', {
                    eventType: 'milestone',
                    eventName: milestone,
                    metadata: options || {},
                });
            } catch { /* ignore */ }
        },
    };
}

export default useJourneyTracking;
