declare namespace _default {
    export { getContentPerformance };
    export { getSearchAnalytics };
    export { getFeedbackSummary };
    export { getTourAnalytics };
    export { getUserEngagement };
    export { getDashboardData };
}
export default _default;
/**
 * Get help content performance metrics
 */
export function getContentPerformance(options?: {}): Promise<{
    viewsByContent: any;
    videoCompletion: any;
    avgEngagement: any;
    period: string;
}>;
/**
 * Get search analytics
 */
export function getSearchAnalytics(options?: {}): Promise<{
    topQueries: any;
    zeroResults: any;
    searchConversion: any;
    searchVolume: any;
    period: string;
}>;
/**
 * Get feedback summary
 */
export function getFeedbackSummary(options?: {}): Promise<{
    overall: any;
    byType: any;
    needsImprovement: any;
    recentComments: any;
    period: string;
}>;
/**
 * Get tour analytics
 */
export function getTourAnalytics(options?: {}): Promise<{
    tourStats: any;
    stepDropoff: any;
    period: string;
}>;
/**
 * Get user engagement metrics
 */
export function getUserEngagement(options?: {}): Promise<{
    activeUsers: any;
    userActivity: any;
    dauTrend: any;
    period: string;
}>;
/**
 * Get comprehensive help analytics dashboard data
 */
export function getDashboardData(options?: {}): Promise<{
    contentPerformance: {
        viewsByContent: any;
        videoCompletion: any;
        avgEngagement: any;
        period: string;
    };
    searchAnalytics: {
        topQueries: any;
        zeroResults: any;
        searchConversion: any;
        searchVolume: any;
        period: string;
    };
    feedbackSummary: {
        overall: any;
        byType: any;
        needsImprovement: any;
        recentComments: any;
        period: string;
    };
    tourAnalytics: {
        tourStats: any;
        stepDropoff: any;
        period: string;
    };
    userEngagement: {
        activeUsers: any;
        userActivity: any;
        dauTrend: any;
        period: string;
    };
    generatedAt: string;
    period: string;
}>;
//# sourceMappingURL=helpAnalyticsService.d.ts.map