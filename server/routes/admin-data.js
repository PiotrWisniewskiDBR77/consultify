/**
 * Admin Data Routes
 * 
 * API endpoints for Admin panel data:
 * - User Tiers & Cost Attribution
 * - Security Events
 * - Dashboard Activity
 * - Sessions Management
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');

// ==========================================
// USER TIERS & COST ATTRIBUTION
// ==========================================

/**
 * GET /api/admin-data/user-tiers/:orgId
 * Get user tier assignments with usage stats
 */
router.get('/user-tiers/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        
        const users = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    u.id as userId,
                    u.first_name || ' ' || u.last_name as userName,
                    u.email,
                    COALESCE(aus.tier, 'STANDARD') as currentTier,
                    COALESCE(aus.requests_count, 0) as usage,
                    COALESCE(aus.cost_usd, 0) as cost
                FROM users u
                LEFT JOIN ai_usage_stats aus ON u.id = aus.user_id 
                    AND aus.period_start >= date('now', '-7 days')
                WHERE u.organization_id = ?
                ORDER BY aus.cost_usd DESC NULLS LAST
            `, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.json(users);
    } catch (error) {
        console.error('[Admin Data] Error getting user tiers:', error);
        res.status(500).json({ error: 'Failed to get user tiers' });
    }
});

/**
 * PUT /api/admin-data/user-tiers/:orgId/:userId
 * Update user's AI tier
 */
router.put('/user-tiers/:orgId/:userId', authMiddleware, async (req, res) => {
    try {
        const { orgId, userId } = req.params;
        const { tier } = req.body;
        
        // Update or create ai_usage_stats record with new tier
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO ai_usage_stats (id, organization_id, user_id, tier, period_start, period_end)
                VALUES (?, ?, ?, ?, date('now', '-7 days'), date('now'))
                ON CONFLICT(user_id, period_start) DO UPDATE SET tier = ?
            `, [require('uuid').v4(), orgId, userId, tier, tier], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ success: true, tier });
    } catch (error) {
        console.error('[Admin Data] Error updating user tier:', error);
        res.status(500).json({ error: 'Failed to update user tier' });
    }
});

/**
 * GET /api/admin-data/cost-attribution/:orgId
 * Get cost attribution by user and project
 */
router.get('/cost-attribution/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        
        // Get user cost attribution
        const userCosts = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    'user' as entityType,
                    aus.user_id as entityId,
                    u.first_name || ' ' || u.last_name as entityName,
                    SUM(aus.requests_count) as requests,
                    SUM(aus.tokens_used) as tokens,
                    SUM(aus.cost_usd) as cost
                FROM ai_usage_stats aus
                JOIN users u ON aus.user_id = u.id
                WHERE aus.organization_id = ?
                    AND aus.period_start >= date('now', '-7 days')
                    AND aus.user_id IS NOT NULL
                GROUP BY aus.user_id
                ORDER BY cost DESC
                LIMIT 10
            `, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Get project cost attribution
        const projectCosts = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    'project' as entityType,
                    aus.project_id as entityId,
                    p.name as entityName,
                    SUM(aus.requests_count) as requests,
                    SUM(aus.tokens_used) as tokens,
                    SUM(aus.cost_usd) as cost
                FROM ai_usage_stats aus
                JOIN projects p ON aus.project_id = p.id
                WHERE aus.organization_id = ?
                    AND aus.period_start >= date('now', '-7 days')
                    AND aus.project_id IS NOT NULL
                GROUP BY aus.project_id
                ORDER BY cost DESC
                LIMIT 10
            `, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Combine and calculate percentages
        const allCosts = [...userCosts, ...projectCosts];
        const totalCost = allCosts.reduce((sum, item) => sum + (item.cost || 0), 0);
        
        const costAttribution = allCosts.map(item => ({
            ...item,
            percentage: totalCost > 0 ? Math.round((item.cost / totalCost) * 100) : 0
        })).sort((a, b) => b.cost - a.cost);

        res.json(costAttribution);
    } catch (error) {
        console.error('[Admin Data] Error getting cost attribution:', error);
        res.status(500).json({ error: 'Failed to get cost attribution' });
    }
});

// ==========================================
// SECURITY EVENTS
// ==========================================

/**
 * GET /api/admin-data/security-events/:orgId
 * Get security events for organization
 */
router.get('/security-events/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { limit = 50, resolved } = req.query;
        
        let whereClause = 'WHERE organization_id = ?';
        const params = [orgId];
        
        if (resolved !== undefined) {
            whereClause += ' AND resolved = ?';
            params.push(resolved === 'true' ? 1 : 0);
        }
        
        const events = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    se.id,
                    se.type,
                    se.severity,
                    se.user_id as userId,
                    u.email as userEmail,
                    se.details,
                    se.resolved,
                    se.created_at as timestamp,
                    se.resolved_at,
                    se.resolved_by
                FROM security_events se
                LEFT JOIN users u ON se.user_id = u.id
                ${whereClause}
                ORDER BY se.created_at DESC
                LIMIT ?
            `, [...params, parseInt(limit)], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.json(events);
    } catch (error) {
        console.error('[Admin Data] Error getting security events:', error);
        res.status(500).json({ error: 'Failed to get security events' });
    }
});

/**
 * PUT /api/admin-data/security-events/:eventId/resolve
 * Mark security event as resolved
 */
router.put('/security-events/:eventId/resolve', authMiddleware, async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user.id;
        
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE security_events 
                SET resolved = 1, resolved_at = datetime('now'), resolved_by = ?
                WHERE id = ?
            `, [userId, eventId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[Admin Data] Error resolving security event:', error);
        res.status(500).json({ error: 'Failed to resolve security event' });
    }
});

// ==========================================
// DASHBOARD ACTIVITY
// ==========================================

/**
 * GET /api/admin-data/recent-activity/:orgId
 * Get recent activity for dashboard
 */
router.get('/recent-activity/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { limit = 10 } = req.query;
        
        const activity = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    ae.id,
                    ae.action_type as type,
                    json_extract(ae.metadata_json, '$.description') as description,
                    ae.ts as timestamp,
                    u.email as userEmail,
                    u.first_name || ' ' || u.last_name as userName
                FROM audit_events ae
                LEFT JOIN users u ON ae.actor_user_id = u.id
                WHERE ae.org_id = ?
                ORDER BY ae.ts DESC
                LIMIT ?
            `, [orgId, parseInt(limit)], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Map to frontend format
        const formattedActivity = activity.map(a => ({
            id: a.id,
            type: mapEventType(a.type),
            description: a.description || formatEventDescription(a.type),
            timestamp: formatTimestamp(a.timestamp),
            user: a.userEmail
        }));

        res.json(formattedActivity);
    } catch (error) {
        console.error('[Admin Data] Error getting recent activity:', error);
        res.status(500).json({ error: 'Failed to get recent activity' });
    }
});

/**
 * GET /api/admin-data/system-health
 * Get system health status
 */
router.get('/system-health', authMiddleware, async (req, res) => {
    try {
        // Basic health check
        const dbHealthy = await new Promise((resolve) => {
            db.get('SELECT 1 as ok', (err) => {
                resolve(!err);
            });
        });

        const health = {
            status: dbHealthy ? 'healthy' : 'degraded',
            uptime: '99.9%',
            lastCheck: 'Just now',
            services: [
                { name: 'API', status: 'up' },
                { name: 'Database', status: dbHealthy ? 'up' : 'down' },
                { name: 'AI Services', status: 'up' },
                { name: 'Storage', status: 'up' }
            ]
        };

        res.json(health);
    } catch (error) {
        console.error('[Admin Data] Error getting system health:', error);
        res.status(500).json({ 
            status: 'critical',
            error: 'Failed to check system health' 
        });
    }
});

// ==========================================
// SESSIONS & LOGIN HISTORY
// ==========================================

/**
 * GET /api/admin-data/sessions/:orgId
 * Get active sessions for organization users
 */
router.get('/sessions/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        
        const sessions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    us.id,
                    us.user_id as userId,
                    u.email as userEmail,
                    u.first_name || ' ' || u.last_name as userName,
                    us.device_info as deviceName,
                    us.ip_address as ipAddress,
                    us.location,
                    us.is_current as isCurrent,
                    us.last_active_at as lastActivity,
                    us.created_at as createdAt
                FROM user_sessions us
                JOIN users u ON us.user_id = u.id
                WHERE u.organization_id = ?
                    AND (us.expires_at IS NULL OR us.expires_at > datetime('now'))
                ORDER BY us.last_active_at DESC
            `, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.json(sessions);
    } catch (error) {
        console.error('[Admin Data] Error getting sessions:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});

/**
 * GET /api/admin-data/login-history/:orgId
 * Get login history for organization
 */
router.get('/login-history/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { limit = 50 } = req.query;
        
        const history = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    lh.id,
                    lh.user_id as userId,
                    u.email as userEmail,
                    u.first_name || ' ' || u.last_name as userName,
                    lh.ip_address as ipAddress,
                    lh.user_agent as userAgent,
                    lh.location,
                    lh.status,
                    lh.failure_reason as failureReason,
                    lh.created_at as timestamp
                FROM login_history lh
                JOIN users u ON lh.user_id = u.id
                WHERE lh.organization_id = ?
                ORDER BY lh.created_at DESC
                LIMIT ?
            `, [orgId, parseInt(limit)], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.json(history);
    } catch (error) {
        console.error('[Admin Data] Error getting login history:', error);
        res.status(500).json({ error: 'Failed to get login history' });
    }
});

/**
 * DELETE /api/admin-data/sessions/:sessionId
 * Terminate a specific session
 */
router.delete('/sessions/:sessionId', authMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM user_sessions WHERE id = ?', [sessionId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[Admin Data] Error terminating session:', error);
        res.status(500).json({ error: 'Failed to terminate session' });
    }
});

// ==========================================
// COMPLIANCE REPORTS
// ==========================================

/**
 * GET /api/admin-data/compliance-reports/:orgId
 * Get compliance reports for organization
 */
router.get('/compliance-reports/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        
        const reports = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    id,
                    name,
                    standard,
                    status,
                    findings_count as findings,
                    generated_at as generatedAt
                FROM compliance_reports
                WHERE organization_id = ?
                ORDER BY generated_at DESC
            `, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.json(reports);
    } catch (error) {
        console.error('[Admin Data] Error getting compliance reports:', error);
        res.status(500).json({ error: 'Failed to get compliance reports' });
    }
});

/**
 * GET /api/admin-data/custom-templates/:orgId
 * Get custom compliance templates
 */
router.get('/custom-templates/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        
        const templates = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    id,
                    name,
                    description,
                    based_on as basedOn,
                    sections_count as sectionsCount,
                    checkpoints_count as checkpointsCount,
                    created_at as createdAt,
                    updated_at as updatedAt
                FROM custom_compliance_templates
                WHERE organization_id = ?
                ORDER BY updated_at DESC
            `, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.json(templates);
    } catch (error) {
        console.error('[Admin Data] Error getting custom templates:', error);
        res.status(500).json({ error: 'Failed to get custom templates' });
    }
});

// ==========================================
// USER GROUPS
// ==========================================

/**
 * GET /api/admin-data/user-groups/:orgId
 * Get user groups for organization
 */
router.get('/user-groups/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        
        const groups = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    id,
                    name,
                    description,
                    color,
                    members_count as membersCount,
                    permissions,
                    created_at as createdAt
                FROM user_groups
                WHERE organization_id = ?
                ORDER BY name ASC
            `, [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        res.json(groups);
    } catch (error) {
        console.error('[Admin Data] Error getting user groups:', error);
        res.status(500).json({ error: 'Failed to get user groups' });
    }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function mapEventType(type) {
    const typeMap = {
        'USER_LOGIN': 'user_joined',
        'PROJECT_CREATE': 'project_created',
        'TASK_COMPLETE': 'task_completed',
        'INVITATION_SEND': 'invitation_sent',
        'SETTINGS_UPDATE': 'settings_changed',
        'USER_ROLE_CHANGE': 'user_role_changed'
    };
    return typeMap[type] || 'activity';
}

function formatEventDescription(type) {
    const descMap = {
        'USER_LOGIN': 'User logged in',
        'PROJECT_CREATE': 'New project created',
        'TASK_COMPLETE': 'Task marked complete',
        'INVITATION_SEND': 'Invitation sent',
        'SETTINGS_UPDATE': 'Settings updated',
        'USER_ROLE_CHANGE': 'User role changed'
    };
    return descMap[type] || 'Activity recorded';
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffHours < 48) return 'Yesterday';
    return `${Math.floor(diffHours / 24)} days ago`;
}

module.exports = router;

