/**
 * AI Feedback API Routes
 * 
 * Endpoints for collecting and managing user feedback on AI responses.
 */

import express from 'express';
const router = express.Router();
import verifyToken from '../middleware/authMiddleware.js';
import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';
import { aiLogger  } from '../services/ai/logger.js';

// All routes require authentication
router.use(verifyToken);

/**
 * POST /api/ai-feedback
 * Submit feedback on an AI response
 */
router.post('/', async (req, res) => {
    try {
        const {
            interactionId,
            draftId,
            feedbackType,
            rating,
            comment,
            capability,
            modelUsed
        } = req.body;

        if (!feedbackType) {
            return res.status(400).json({ error: 'feedbackType is required' });
        }

        const validTypes = ['HELPFUL', 'NOT_HELPFUL', 'ACCURATE', 'INACCURATE', 'RELEVANT', 'IRRELEVANT', 'RATING'];
        if (!validTypes.includes(feedbackType)) {
            return res.status(400).json({ 
                error: `Invalid feedbackType. Valid types: ${validTypes.join(', ')}`
            });
        }

        const id = uuidv4();

        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO ai_feedback 
                (id, organization_id, user_id, interaction_id, draft_id, feedback_type, 
                 rating, comment, capability, model_used, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                id,
                req.user.organizationId,
                req.user.id,
                interactionId,
                draftId,
                feedbackType,
                rating,
                comment,
                capability,
                modelUsed
            ], (err) => {
                if (err) reject(err);
                else resolve(null);
            });
        });

        aiLogger.info('AIFeedback', `Feedback submitted: ${feedbackType} for ${capability}`);

        res.status(201).json({
            success: true,
            feedbackId: id
        });

    } catch (error) {
        aiLogger.error('AIFeedback', `Submit error: ${error.message}`);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

/**
 * GET /api/ai-feedback/stats
 * Get feedback statistics (admin only)
 */
router.get('/stats', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { period = '30d', capability } = req.query;
        const organizationId = req.user.organizationId;

        let daysBack = 30;
        if (period === '7d') daysBack = 7;
        else if (period === '90d') daysBack = 90;

        // Get overall stats
        let statsQuery = `
            SELECT 
                feedback_type,
                COUNT(*) as count,
                AVG(rating) as avg_rating
            FROM ai_feedback
            WHERE organization_id = ?
            AND created_at > datetime('now', '-${daysBack} days')
        `;
        const params = [organizationId];

        if (capability) {
            statsQuery += ` AND capability = ?`;
            params.push(capability);
        }

        statsQuery += ` GROUP BY feedback_type`;

        const typeStats = await new Promise((resolve) => {
            db.all(statsQuery, params, (err, rows) => {
                resolve(err ? [] : rows);
            });
        });

        // Get capability breakdown
        const capabilityStats = await new Promise((resolve) => {
            db.all(`
                SELECT 
                    capability,
                    SUM(CASE WHEN feedback_type = 'HELPFUL' THEN 1 ELSE 0 END) as helpful,
                    SUM(CASE WHEN feedback_type = 'NOT_HELPFUL' THEN 1 ELSE 0 END) as not_helpful,
                    COUNT(*) as total,
                    AVG(rating) as avg_rating
                FROM ai_feedback
                WHERE organization_id = ?
                AND created_at > datetime('now', '-${daysBack} days')
                GROUP BY capability
            `, [organizationId], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });

        // Calculate satisfaction score
        const helpfulCount = typeStats.find(t => t.feedback_type === 'HELPFUL')?.count || 0;
        const notHelpfulCount = typeStats.find(t => t.feedback_type === 'NOT_HELPFUL')?.count || 0;
        const totalFeedback = helpfulCount + notHelpfulCount;
        const satisfactionScore = totalFeedback > 0 
            ? ((helpfulCount / totalFeedback) * 100).toFixed(1)
            : null;

        res.json({
            success: true,
            period,
            stats: {
                satisfactionScore,
                totalFeedback,
                byType: typeStats,
                byCapability: capabilityStats.map(c => ({
                    ...c,
                    satisfactionRate: c.total > 0 
                        ? ((c.helpful / c.total) * 100).toFixed(1)
                        : null
                }))
            }
        });

    } catch (error) {
        aiLogger.error('AIFeedback', `Stats error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch feedback stats' });
    }
});

/**
 * GET /api/ai-feedback/recent
 * Get recent feedback with comments (admin only)
 */
router.get('/recent', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { limit = 20, type } = req.query;
        const organizationId = req.user.organizationId;

        let query = `
            SELECT 
                f.*,
                u.full_name as user_name,
                u.email as user_email
            FROM ai_feedback f
            LEFT JOIN users u ON f.user_id = u.id
            WHERE f.organization_id = ?
        `;
        const params = [organizationId];

        if (type) {
            query += ` AND f.feedback_type = ?`;
            params.push(type);
        }

        query += ` ORDER BY f.created_at DESC LIMIT ?`;
        params.push(parseInt(limit));

        const feedback = await new Promise((resolve) => {
            db.all(query, params, (err, rows) => {
                resolve(err ? [] : rows);
            });
        });

        res.json({
            success: true,
            feedback
        });

    } catch (error) {
        aiLogger.error('AIFeedback', `Recent error: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch recent feedback' });
    }
});

/**
 * GET /api/ai-feedback/improvement-suggestions
 * Get AI-generated suggestions based on feedback patterns (admin only)
 */
router.get('/improvement-suggestions', async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const organizationId = req.user.organizationId;

        // Find capabilities with low satisfaction
        const problemAreas = await new Promise((resolve) => {
            db.all(`
                SELECT 
                    capability,
                    model_used,
                    COUNT(*) as total_feedback,
                    SUM(CASE WHEN feedback_type = 'NOT_HELPFUL' THEN 1 ELSE 0 END) as negative,
                    GROUP_CONCAT(comment, ' | ') as comments
                FROM ai_feedback
                WHERE organization_id = ?
                AND created_at > datetime('now', '-30 days')
                AND feedback_type = 'NOT_HELPFUL'
                GROUP BY capability
                HAVING negative > 2
                ORDER BY negative DESC
                LIMIT 5
            `, [organizationId], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });

        const suggestions = problemAreas.map(area => ({
            capability: area.capability,
            model: area.model_used,
            negativeCount: area.negative,
            totalFeedback: area.total_feedback,
            sampleComments: area.comments ? area.comments.split(' | ').slice(0, 3) : [],
            suggestion: generateSuggestion(area)
        }));

        res.json({
            success: true,
            suggestions
        });

    } catch (error) {
        aiLogger.error('AIFeedback', `Suggestions error: ${error.message}`);
        res.status(500).json({ error: 'Failed to generate suggestions' });
    }
});

// Helper function to generate suggestions based on feedback patterns
function generateSuggestion(area) {
    const suggestions = [];

    if (area.negative > 5) {
        suggestions.push(`Consider reviewing the prompt for "${area.capability}" capability`);
    }

    if (area.comments && area.comments.includes('długo') || area.comments.includes('wolno')) {
        suggestions.push('Users report slow responses - consider using a faster model');
    }

    if (area.comments && area.comments.includes('błąd') || area.comments.includes('error')) {
        suggestions.push('Users report errors - check model configuration and fallbacks');
    }

    if (suggestions.length === 0) {
        suggestions.push(`Review ${area.negative} negative feedbacks for "${area.capability}"`);
    }

    return suggestions;
}

// =====================================================
// Response Feedback Endpoints (AI Response Personalization)
// =====================================================

const { adaptiveResponseService   } = await import('../ai/adaptiveResponseService.js');

/**
 * POST /api/ai-feedback/response
 * Submit detailed feedback on AI response length/style
 */
router.post('/response', async (req, res) => {
    try {
        const {
            messageId,
            conversationId,
            rating,
            lengthFeedback,
            detailFeedback,
            formatFeedback,
            wantedMode,
            customFeedback,
            responseMode,
            responseLength,
            capability
        } = req.body;

        if (!messageId) {
            return res.status(400).json({ error: 'messageId is required' });
        }

        if (!rating || !['positive', 'negative', 'neutral'].includes(rating)) {
            return res.status(400).json({ error: 'Valid rating is required (positive, negative, neutral)' });
        }

        const feedback = {
            rating,
            lengthFeedback,
            detailFeedback,
            formatFeedback,
            wantedMode,
            customFeedback
        };

        const context = {
            responseMode,
            responseLength,
            capability
        };

        const result = await adaptiveResponseService.processFeedback(
            req.user.id,
            messageId,
            conversationId,
            feedback,
            context
        );

        aiLogger.info('AIFeedback', `Response feedback: ${rating} from user ${req.user.id}, wanted: ${wantedMode || 'N/A'}`);

        res.status(201).json({
            success: true,
            feedbackId: result.feedbackId,
            message: 'Feedback recorded successfully'
        });

    } catch (error) {
        aiLogger.error('AIFeedback', `Response feedback error: ${error.message}`);
        res.status(500).json({ error: 'Failed to submit response feedback' });
    }
});

/**
 * GET /api/ai-feedback/response/stats
 * Get user's response feedback statistics
 */
router.get('/response/stats', async (req, res) => {
    try {
        const stats = await adaptiveResponseService.getUserFeedbackStats(req.user.id);
        const recommendedMode = await adaptiveResponseService.getRecommendedMode(req.user.id);

        res.json({
            success: true,
            stats: stats || {
                total_feedback: 0,
                positive_count: 0,
                negative_count: 0,
                satisfaction_rate: null
            },
            recommendedMode
        });

    } catch (error) {
        aiLogger.error('AIFeedback', `Response stats error: ${error.message}`);
        res.status(500).json({ error: 'Failed to get response stats' });
    }
});

/**
 * GET /api/ai-feedback/response/preferences
 * Get user's learned response preferences
 */
router.get('/response/preferences', async (req, res) => {
    try {
        const prefs = await new Promise((resolve) => {
            db.get(`
                SELECT 
                    response_mode_preference,
                    quick_length_preference,
                    standard_length_preference,
                    deep_study_length_preference,
                    auto_detect_intent,
                    prefer_bullet_points,
                    prefer_tables,
                    prefer_action_items,
                    include_examples,
                    satisfaction_score
                FROM user_ai_profiles
                WHERE user_id = ?
            `, [req.user.id], (err, row) => {
                resolve(err ? null : row);
            });
        });

        res.json({
            success: true,
            preferences: prefs || {
                response_mode_preference: 'standard',
                quick_length_preference: 'short',
                standard_length_preference: 'medium',
                deep_study_length_preference: 'long',
                auto_detect_intent: true
            }
        });

    } catch (error) {
        aiLogger.error('AIFeedback', `Preferences error: ${error.message}`);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});

export default router;

