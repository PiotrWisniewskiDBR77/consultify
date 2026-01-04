/**
 * Help Analytics Service
 * 
 * Provides analytics and reporting for help system usage.
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();



/**
 * Get help content performance metrics
 */
async function getContentPerformance(options = {}) {
    const { days = 30, contentType, organizationId } = options;
    
    let whereClause = `WHERE created_at >= datetime('now', '-${days} days')`;
    const params = [];
    
    if (contentType) {
        whereClause += ` AND content_type = ?`;
        params.push(contentType);
    }
    
    if (organizationId) {
        whereClause += ` AND organization_id = ?`;
        params.push(organizationId);
    }
    
    // Views per content
    const viewsByContent = await db.all(`
        SELECT 
            content_type,
            content_id,
            COUNT(*) as views,
            COUNT(DISTINCT user_id) as unique_viewers,
            AVG(duration_ms) as avg_duration_ms
        FROM help_analytics
        ${whereClause} AND event_type = 'view'
        GROUP BY content_type, content_id
        ORDER BY views DESC
        LIMIT 50
    `, params);
    
    // Completion rates for videos
    const videoCompletion = await db.all(`
        SELECT 
            content_id,
            COUNT(CASE WHEN event_type = 'view' THEN 1 END) as starts,
            COUNT(CASE WHEN event_type = 'complete' THEN 1 END) as completions,
            ROUND(COUNT(CASE WHEN event_type = 'complete' THEN 1 END) * 100.0 / 
                NULLIF(COUNT(CASE WHEN event_type = 'view' THEN 1 END), 0), 2) as completion_rate
        FROM help_analytics
        ${whereClause} AND content_type = 'video'
        GROUP BY content_id
        HAVING starts > 0
    `, params);
    
    // Average engagement time
    const avgEngagement = await db.get(`
        SELECT 
            AVG(duration_ms) as avg_duration,
            MAX(duration_ms) as max_duration,
            MIN(duration_ms) as min_duration
        FROM help_analytics
        ${whereClause} AND duration_ms IS NOT NULL AND duration_ms > 0
    `, params);
    
    return {
        viewsByContent,
        videoCompletion,
        avgEngagement,
        period: `${days} days`
    };
}

/**
 * Get search analytics
 */
async function getSearchAnalytics(options = {}) {
    const { days = 30, organizationId } = options;
    
    let whereClause = `WHERE created_at >= datetime('now', '-${days} days')`;
    const params = [];
    
    if (organizationId) {
        whereClause += ` AND organization_id = ?`;
        params.push(organizationId);
    }
    
    // Top search queries
    const topQueries = await db.all(`
        SELECT 
            query,
            COUNT(*) as count,
            AVG(results_count) as avg_results
        FROM help_search_queries
        ${whereClause}
        GROUP BY query
        ORDER BY count DESC
        LIMIT 30
    `, params);
    
    // Zero result searches (improvement opportunities)
    const zeroResults = await db.all(`
        SELECT 
            query,
            COUNT(*) as count
        FROM help_search_queries
        ${whereClause} AND results_count = 0
        GROUP BY query
        ORDER BY count DESC
        LIMIT 20
    `, params);
    
    // Search to click conversion
    const searchConversion = await db.get(`
        SELECT 
            COUNT(*) as total_searches,
            SUM(CASE WHEN selected_result_id IS NOT NULL THEN 1 ELSE 0 END) as searches_with_click,
            ROUND(SUM(CASE WHEN selected_result_id IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / 
                NULLIF(COUNT(*), 0), 2) as conversion_rate
        FROM help_search_queries
        ${whereClause}
    `, params);
    
    // Search volume over time
    const searchVolume = await db.all(`
        SELECT 
            date(created_at) as date,
            COUNT(*) as searches
        FROM help_search_queries
        ${whereClause}
        GROUP BY date(created_at)
        ORDER BY date ASC
    `, params);
    
    return {
        topQueries,
        zeroResults,
        searchConversion,
        searchVolume,
        period: `${days} days`
    };
}

/**
 * Get feedback summary
 */
async function getFeedbackSummary(options = {}) {
    const { days = 30, organizationId } = options;
    
    let whereClause = `WHERE created_at >= datetime('now', '-${days} days')`;
    const params = [];
    
    if (organizationId) {
        whereClause += ` AND organization_id = ?`;
        params.push(organizationId);
    }
    
    // Overall helpfulness
    const overall = await db.get(`
        SELECT 
            COUNT(*) as total_feedback,
            SUM(CASE WHEN is_helpful = 1 THEN 1 ELSE 0 END) as helpful,
            SUM(CASE WHEN is_helpful = 0 THEN 1 ELSE 0 END) as not_helpful,
            ROUND(SUM(CASE WHEN is_helpful = 1 THEN 1 ELSE 0 END) * 100.0 / 
                NULLIF(COUNT(*), 0), 2) as helpfulness_rate,
            AVG(rating) as avg_rating
        FROM help_feedback
        ${whereClause}
    `, params);
    
    // Helpfulness by content type
    const byType = await db.all(`
        SELECT 
            content_type,
            COUNT(*) as count,
            ROUND(SUM(CASE WHEN is_helpful = 1 THEN 1 ELSE 0 END) * 100.0 / 
                NULLIF(COUNT(*), 0), 2) as helpfulness_rate,
            AVG(rating) as avg_rating
        FROM help_feedback
        ${whereClause}
        GROUP BY content_type
    `, params);
    
    // Content needing improvement (low helpfulness)
    const needsImprovement = await db.all(`
        SELECT 
            content_type,
            content_id,
            COUNT(*) as feedback_count,
            ROUND(SUM(CASE WHEN is_helpful = 1 THEN 1 ELSE 0 END) * 100.0 / 
                NULLIF(COUNT(*), 0), 2) as helpfulness_rate
        FROM help_feedback
        ${whereClause}
        GROUP BY content_type, content_id
        HAVING feedback_count >= 3 AND helpfulness_rate < 70
        ORDER BY helpfulness_rate ASC
        LIMIT 10
    `, params);
    
    // Recent comments
    const recentComments = await db.all(`
        SELECT 
            id,
            content_type,
            content_id,
            is_helpful,
            rating,
            comment,
            created_at
        FROM help_feedback
        ${whereClause} AND comment IS NOT NULL AND comment != ''
        ORDER BY created_at DESC
        LIMIT 20
    `, params);
    
    return {
        overall,
        byType,
        needsImprovement,
        recentComments,
        period: `${days} days`
    };
}

/**
 * Get tour analytics
 */
async function getTourAnalytics(options = {}) {
    const { days = 30 } = options;
    
    // Tour completion rates
    const tourStats = await db.all(`
        SELECT 
            tour_id,
            COUNT(*) as total_starts,
            SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completions,
            SUM(CASE WHEN is_skipped = 1 THEN 1 ELSE 0 END) as skips,
            ROUND(SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) * 100.0 / 
                NULLIF(COUNT(*), 0), 2) as completion_rate,
            AVG(current_step) as avg_steps_viewed
        FROM help_tour_progress
        WHERE created_at >= datetime('now', '-${days} days')
        GROUP BY tour_id
    `);
    
    // Step drop-off analysis (from analytics events)
    const stepDropoff = await db.all(`
        SELECT 
            content_id as tour_id,
            json_extract(metadata, '$.step') as step,
            COUNT(*) as views
        FROM help_analytics
        WHERE event_type = 'tour_step'
        AND created_at >= datetime('now', '-${days} days')
        GROUP BY content_id, step
        ORDER BY content_id, CAST(step AS INTEGER)
    `);
    
    return {
        tourStats,
        stepDropoff,
        period: `${days} days`
    };
}

/**
 * Get user engagement metrics
 */
async function getUserEngagement(options = {}) {
    const { days = 30, organizationId } = options;
    
    let whereClause = `WHERE created_at >= datetime('now', '-${days} days')`;
    const params = [];
    
    if (organizationId) {
        whereClause += ` AND organization_id = ?`;
        params.push(organizationId);
    }
    
    // Active help users
    const activeUsers = await db.get(`
        SELECT 
            COUNT(DISTINCT user_id) as active_users,
            COUNT(DISTINCT session_id) as sessions,
            COUNT(*) as total_events
        FROM help_analytics
        ${whereClause}
    `, params);
    
    // User activity distribution
    const userActivity = await db.all(`
        SELECT 
            user_id,
            COUNT(*) as events,
            COUNT(DISTINCT date(created_at)) as active_days
        FROM help_analytics
        ${whereClause}
        GROUP BY user_id
        ORDER BY events DESC
        LIMIT 50
    `, params);
    
    // Daily active users trend
    const dauTrend = await db.all(`
        SELECT 
            date(created_at) as date,
            COUNT(DISTINCT user_id) as users,
            COUNT(*) as events
        FROM help_analytics
        ${whereClause}
        GROUP BY date(created_at)
        ORDER BY date ASC
    `, params);
    
    return {
        activeUsers,
        userActivity,
        dauTrend,
        period: `${days} days`
    };
}

/**
 * Get comprehensive help analytics dashboard data
 */
async function getDashboardData(options = {}) {
    const { days = 30, organizationId } = options;
    
    const [
        contentPerformance,
        searchAnalytics,
        feedbackSummary,
        tourAnalytics,
        userEngagement
    ] = await Promise.all([
        getContentPerformance({ days, organizationId }),
        getSearchAnalytics({ days, organizationId }),
        getFeedbackSummary({ days, organizationId }),
        getTourAnalytics({ days }),
        getUserEngagement({ days, organizationId })
    ]);
    
    return {
        contentPerformance,
        searchAnalytics,
        feedbackSummary,
        tourAnalytics,
        userEngagement,
        generatedAt: new Date().toISOString(),
        period: `${days} days`
    };
}

export {
getContentPerformance,
    getSearchAnalytics,
    getFeedbackSummary,
    getTourAnalytics,
    getUserEngagement,
    getDashboardData
};

export default {
    getContentPerformance,
    getSearchAnalytics,
    getFeedbackSummary,
    getTourAnalytics,
    getUserEngagement,
    getDashboardData
};














