export default JourneyAnalytics;
declare namespace JourneyAnalytics {
    /**
     * Track phase entry
     */
    function trackPhaseEntry(userId: any, phase: any, metadata?: {}): Promise<{
        success: boolean;
        eventId: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        eventId?: undefined;
    }>;
    /**
     * Track activation milestone
     */
    function trackMilestone(userId: any, milestone: any, metadata?: {}): Promise<{
        success: boolean;
        eventId: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        eventId?: undefined;
    }>;
    /**
     * Track feature usage
     */
    function trackFeatureUse(userId: any, featureId: any, metadata?: {}): Promise<{
        success: boolean;
        eventId: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        eventId?: undefined;
    }>;
    /**
     * Track tour events
     */
    function trackTourEvent(userId: any, tourId: any, eventName: any, metadata?: {}): Promise<{
        success: boolean;
        eventId: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        eventId?: undefined;
    }>;
    /**
     * Internal event tracking
     */
    function _trackEvent({ userId, eventType, eventName, phase, metadata }: {
        userId: any;
        eventType: any;
        eventName: any;
        phase?: null | undefined;
        metadata?: {} | undefined;
    }): Promise<{
        success: boolean;
        eventId: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        eventId?: undefined;
    }>;
    /**
     * Get user's complete journey
     */
    function getUserJourney(userId: any): Promise<any>;
    /**
     * Check if user is activated for a phase
     */
    function isActivated(userId: any, phase: any): Promise<any>;
    /**
     * Calculate Time-to-Value for user
     */
    function calculateTimeToValue(userId: any): Promise<{
        signup_to_demo: number | null;
        demo_duration: number | null;
        demo_to_trial: number | null;
        trial_to_org: number | null;
        org_to_first_value: number | null;
        total_ttv: number | null;
        first_event: any;
        last_event: any;
    } | null>;
    /**
     * Get aggregate funnel metrics
     */
    function getFunnelMetrics(dateRange?: {}): Promise<any>;
    /**
     * Get drop-off analysis
     */
    function getDropOffAnalysis(dateRange?: {}): Promise<{
        from: string;
        to: string;
        usersIn: any;
        usersOut: any;
        dropOffPercent: number;
    }[]>;
    /**
     * Get average TTV across users
     */
    function getAverageTTV(dateRange?: {}): Promise<{
        avgTTV: number | null;
        sampleSize: number;
    }>;
    /**
     * Helper: get phase for milestone
     */
    function _getPhaseForMilestone(milestone: any): string | null;
}
//# sourceMappingURL=journeyAnalytics.d.ts.map