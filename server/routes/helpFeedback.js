/**
 * Help Feedback API Routes
 * 
 * Handles feedback submission, analytics tracking, and statistics
 * for the help system.
 */

import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

// ==========================================
// FEEDBACK ENDPOINTS
// ==========================================

/**
 * POST /api/help/feedback
 * Submit feedback on help content
 */
router.post('/feedback', async (req, res) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organization_id;
        const { contentType, contentId, isHelpful, rating, comment, metadata } = req.body;

        if (!contentType || !contentId) {
            return res.status(400).json({ error: 'contentType and contentId are required' });
        }

        const validTypes = ['module', 'card', 'faq', 'video'];
        if (!validTypes.includes(contentType)) {
            return res.status(400).json({ error: `contentType must be one of: ${validTypes.join(', ')}` });
        }

        const id = uuidv4();

        await db.run(`
            INSERT INTO help_feedback (id, user_id, organization_id, content_type, content_id, is_helpful, rating, comment, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, userId, orgId, contentType, contentId, isHelpful, rating, comment, JSON.stringify(metadata || {})]);

        console.log(`[HelpFeedback] Feedback submitted: ${contentType}/${contentId} - helpful: ${isHelpful}`);

        res.json({
            success: true,
            id,
            message: 'Thank you for your feedback!'
        });
    } catch (error) {
        console.error('[HelpFeedback] Error submitting feedback:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

/**
 * GET /api/help/feedback/stats
 * Get feedback statistics (admin only)
 */
router.get('/feedback/stats', async (req, res) => {
    try {
        const { contentType, contentId, days = 30 } = req.query;

        let whereClause = `WHERE created_at >= datetime('now', '-${parseInt(days)} days')`;
        const params = [];

        if (contentType) {
            whereClause += ` AND content_type = ?`;
            params.push(contentType);
        }

        if (contentId) {
            whereClause += ` AND content_id = ?`;
            params.push(contentId);
        }

        // Overall stats
        const overallStatsResult = await db.query(`
            SELECT 
                COUNT(*) as total_feedback,
                SUM(CASE WHEN is_helpful = 1 THEN 1 ELSE 0 END) as helpful_count,
                SUM(CASE WHEN is_helpful = 0 THEN 1 ELSE 0 END) as not_helpful_count,
                AVG(rating) as avg_rating
            FROM help_feedback
            ${whereClause}
        `, params);
        const overallStats = overallStatsResult.rows[0];

        // Stats by content type
        const byTypeResult = await db.query(`
            SELECT 
                content_type,
                COUNT(*) as count,
                AVG(CASE WHEN is_helpful = 1 THEN 100.0 ELSE 0 END) as helpfulness_rate,
                AVG(rating) as avg_rating
            FROM help_feedback
            ${whereClause}
            GROUP BY content_type
        `, params);
        const byType = byTypeResult.rows;

        // Most helpful content
        const topContentResult = await db.query(`
            SELECT 
                content_type,
                content_id,
                COUNT(*) as feedback_count,
                AVG(CASE WHEN is_helpful = 1 THEN 100.0 ELSE 0 END) as helpfulness_rate,
                AVG(rating) as avg_rating
            FROM help_feedback
            ${whereClause}
            GROUP BY content_type, content_id
            HAVING feedback_count >= 3
            ORDER BY helpfulness_rate DESC, feedback_count DESC
            LIMIT 10
        `, params);
        const topContent = topContentResult.rows;

        // Least helpful content (needs improvement)
        const needsImprovementResult = await db.query(`
            SELECT 
                content_type,
                content_id,
                COUNT(*) as feedback_count,
                AVG(CASE WHEN is_helpful = 1 THEN 100.0 ELSE 0 END) as helpfulness_rate,
                AVG(rating) as avg_rating
            FROM help_feedback
            ${whereClause}
            GROUP BY content_type, content_id
            HAVING feedback_count >= 3
            ORDER BY helpfulness_rate ASC
            LIMIT 10
        `, params);
        const needsImprovement = needsImprovementResult.rows;

        // Recent comments
        const recentCommentsResult = await db.query(`
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
        const recentComments = recentCommentsResult.rows;

        res.json({
            overall: overallStats,
            byType,
            topContent,
            needsImprovement,
            recentComments,
            period: `${days} days`
        });
    } catch (error) {
        console.error('[HelpFeedback] Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch feedback stats' });
    }
});

/**
 * GET /api/help/feedback/content/:type/:id
 * Get feedback for specific content
 */
router.get('/feedback/content/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;

        const ratingsResult = await db.query(`
            SELECT * FROM help_content_ratings
            WHERE content_type = ? AND content_id = ?
        `, [type, id]);

        res.json(ratingsResult.rows[0] || {
            content_type: type,
            content_id: id,
            total_ratings: 0,
            helpful_count: 0,
            not_helpful_count: 0,
            avg_rating: 0
        });
    } catch (error) {
        console.error('[HelpFeedback] Error fetching content feedback:', error);
        res.status(500).json({ error: 'Failed to fetch content feedback' });
    }
});

// ==========================================
// ANALYTICS ENDPOINTS
// ==========================================

/**
 * POST /api/help/analytics/event
 * Track help interaction event
 */
router.post('/analytics/event', async (req, res) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organization_id;
        const { eventType, contentType, contentId, metadata, durationMs, sessionId } = req.body;

        const validEvents = ['view', 'search', 'click', 'complete', 'video_progress', 'tour_step', 'tour_complete', 'feedback_submit'];
        if (!validEvents.includes(eventType)) {
            return res.status(400).json({ error: `eventType must be one of: ${validEvents.join(', ')}` });
        }

        const id = uuidv4();

        await db.run(`
            INSERT INTO help_analytics (id, user_id, organization_id, session_id, event_type, content_type, content_id, metadata, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, userId, orgId, sessionId, eventType, contentType, contentId, JSON.stringify(metadata || {}), durationMs]);

        res.json({ success: true, id });
    } catch (error) {
        console.error('[HelpAnalytics] Error tracking event:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
});

/**
 * GET /api/help/analytics/summary
 * Get analytics summary (admin only)
 */
router.get('/analytics/summary', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const daysInt = parseInt(days);

        // Total events by type
        const eventsByTypeResult = await db.query(`
            SELECT 
                event_type,
                COUNT(*) as count
            FROM help_analytics
            WHERE created_at >= datetime('now', '-${daysInt} days')
            GROUP BY event_type
            ORDER BY count DESC
        `);
        const eventsByType = eventsByTypeResult.rows;

        // Most viewed content
        const mostViewedResult = await db.query(`
            SELECT 
                content_type,
                content_id,
                COUNT(*) as views
            FROM help_analytics
            WHERE event_type = 'view' 
            AND created_at >= datetime('now', '-${daysInt} days')
            AND content_id IS NOT NULL
            GROUP BY content_type, content_id
            ORDER BY views DESC
            LIMIT 15
        `);
        const mostViewed = mostViewedResult.rows;

        // Search queries
        const topSearchesResult = await db.query(`
            SELECT 
                json_extract(metadata, '$.query') as query,
                COUNT(*) as count
            FROM help_analytics
            WHERE event_type = 'search'
            AND created_at >= datetime('now', '-${daysInt} days')
            GROUP BY query
            ORDER BY count DESC
            LIMIT 20
        `);
        const topSearches = topSearchesResult.rows;

        // Video completion rates
        const videoStatsResult = await db.query(`
            SELECT 
                content_id,
                COUNT(CASE WHEN event_type = 'view' THEN 1 END) as views,
                COUNT(CASE WHEN event_type = 'complete' THEN 1 END) as completions,
                AVG(CASE WHEN event_type = 'video_progress' THEN CAST(json_extract(metadata, '$.progress') AS REAL) END) as avg_progress
            FROM help_analytics
            WHERE content_type = 'video'
            AND created_at >= datetime('now', '-${daysInt} days')
            GROUP BY content_id
        `);
        const videoStats = videoStatsResult.rows;

        // Tour completion rates
        const tourStatsResult = await db.query(`
            SELECT 
                content_id as tour_id,
                COUNT(CASE WHEN event_type = 'tour_step' THEN 1 END) as steps_viewed,
                COUNT(CASE WHEN event_type = 'tour_complete' THEN 1 END) as completions
            FROM help_analytics
            WHERE content_type = 'tour'
            AND created_at >= datetime('now', '-${daysInt} days')
            GROUP BY content_id
        `);
        const tourStats = tourStatsResult.rows;

        // Daily activity trend
        const dailyTrendResult = await db.query(`
            SELECT 
                date(created_at) as date,
                COUNT(*) as events
            FROM help_analytics
            WHERE created_at >= datetime('now', '-${daysInt} days')
            GROUP BY date(created_at)
            ORDER BY date ASC
        `);
        const dailyTrend = dailyTrendResult.rows;

        res.json({
            eventsByType,
            mostViewed,
            topSearches: topSearches.filter(s => s.query),
            videoStats,
            tourStats,
            dailyTrend,
            period: `${daysInt} days`
        });
    } catch (error) {
        console.error('[HelpAnalytics] Error fetching summary:', error);
        res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
});

// ==========================================
// VIDEO PROGRESS ENDPOINTS
// ==========================================

/**
 * POST /api/help/video/progress
 * Update video watch progress
 */
router.post('/video/progress', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { videoId, progressPercent, lastPositionSeconds, watchTimeSeconds, isCompleted } = req.body;

        if (!videoId) {
            return res.status(400).json({ error: 'videoId is required' });
        }

        const id = uuidv4();

        await db.run(`
            INSERT INTO help_video_progress (id, user_id, video_id, progress_percent, last_position_seconds, watch_time_seconds, is_completed, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, video_id) DO UPDATE SET
                progress_percent = MAX(help_video_progress.progress_percent, excluded.progress_percent),
                last_position_seconds = excluded.last_position_seconds,
                watch_time_seconds = help_video_progress.watch_time_seconds + COALESCE(excluded.watch_time_seconds, 0),
                is_completed = CASE WHEN excluded.is_completed = 1 OR help_video_progress.is_completed = 1 THEN 1 ELSE 0 END,
                completed_at = CASE WHEN excluded.is_completed = 1 AND help_video_progress.completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE help_video_progress.completed_at END,
                updated_at = CURRENT_TIMESTAMP
        `, [id, userId, videoId, progressPercent, lastPositionSeconds, watchTimeSeconds, isCompleted, isCompleted ? new Date().toISOString() : null]);

        res.json({ success: true });
    } catch (error) {
        console.error('[HelpVideo] Error saving progress:', error);
        res.status(500).json({ error: 'Failed to save video progress' });
    }
});

/**
 * GET /api/help/video/progress
 * Get all video progress for current user
 */
router.get('/video/progress', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.json({ progress: [] });
        }

        const progress = await db.all(`
            SELECT video_id, progress_percent, is_completed, watch_time_seconds, last_position_seconds
            FROM help_video_progress
            WHERE user_id = ?
        `, [userId]);

        res.json({ progress });
    } catch (error) {
        console.error('[HelpVideo] Error fetching progress:', error);
        res.status(500).json({ error: 'Failed to fetch video progress' });
    }
});

// ==========================================
// TOUR PROGRESS ENDPOINTS
// ==========================================

/**
 * POST /api/help/tour/progress
 * Update tour progress
 */
router.post('/tour/progress', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { tourId, currentStep, isCompleted, isSkipped } = req.body;

        if (!tourId) {
            return res.status(400).json({ error: 'tourId is required' });
        }

        const id = uuidv4();

        await db.run(`
            INSERT INTO help_tour_progress (id, user_id, tour_id, current_step, is_completed, is_skipped, completed_at, skipped_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, tour_id) DO UPDATE SET
                current_step = MAX(help_tour_progress.current_step, excluded.current_step),
                is_completed = CASE WHEN excluded.is_completed = 1 THEN 1 ELSE help_tour_progress.is_completed END,
                is_skipped = CASE WHEN excluded.is_skipped = 1 THEN 1 ELSE help_tour_progress.is_skipped END,
                completed_at = CASE WHEN excluded.is_completed = 1 AND help_tour_progress.completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE help_tour_progress.completed_at END,
                skipped_at = CASE WHEN excluded.is_skipped = 1 AND help_tour_progress.skipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE help_tour_progress.skipped_at END,
                updated_at = CURRENT_TIMESTAMP
        `, [id, userId, tourId, currentStep || 0, isCompleted, isSkipped, isCompleted ? new Date().toISOString() : null, isSkipped ? new Date().toISOString() : null]);

        res.json({ success: true });
    } catch (error) {
        console.error('[HelpTour] Error saving progress:', error);
        res.status(500).json({ error: 'Failed to save tour progress' });
    }
});

/**
 * GET /api/help/tour/progress
 * Get all tour progress for current user
 */
router.get('/tour/progress', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.json({ progress: [] });
        }

        const progress = await db.all(`
            SELECT tour_id, current_step, is_completed, is_skipped
            FROM help_tour_progress
            WHERE user_id = ?
        `, [userId]);

        res.json({ progress });
    } catch (error) {
        console.error('[HelpTour] Error fetching progress:', error);
        res.status(500).json({ error: 'Failed to fetch tour progress' });
    }
});

export default router;

