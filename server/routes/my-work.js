// My Work Routes - Execution hub
// Step 5: Execution Control, My Work & Notifications
// Enhanced with PMO Focus, Inbox, and Dashboard endpoints

const express = require('express');
const router = express.Router();
const MyWorkService = require('../services/myWorkService');
const ExecutionMonitorService = require('../services/executionMonitorService');
const FocusService = require('../services/focusService');
const InboxService = require('../services/inboxService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/my-work
router.get('/', verifyToken, async (req, res) => {
    try {
        const myWork = await MyWorkService.getMyWork(req.userId, req.organizationId);
        res.json(myWork);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/tasks
router.get('/tasks', verifyToken, async (req, res) => {
    try {
        const tasks = await MyWorkService._getMyTasks(req.userId);
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/initiatives
router.get('/initiatives', verifyToken, async (req, res) => {
    try {
        const initiatives = await MyWorkService._getMyInitiatives(req.userId);
        res.json(initiatives);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/decisions
router.get('/decisions', verifyToken, async (req, res) => {
    try {
        const decisions = await MyWorkService._getMyDecisions(req.userId);
        res.json(decisions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/alerts
router.get('/alerts', verifyToken, async (req, res) => {
    try {
        const alerts = await MyWorkService._getMyAlerts(req.userId);
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/execution-summary/:projectId (PMO/Admin view)
router.get('/execution-summary/:projectId', verifyToken, async (req, res) => {
    try {
        const summary = await ExecutionMonitorService.generateExecutionSummary(req.params.projectId);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/my-work/monitor/:projectId (Run daily monitor)
router.post('/monitor/:projectId', verifyToken, async (req, res) => {
    if (!req.can('edit_project_settings')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const result = await ExecutionMonitorService.runDailyMonitor(req.params.projectId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// FOCUS API - Daily focus task management (PMO Upgrade)
// ============================================================================

// GET /api/my-work/focus - Get focus tasks for a date
router.get('/focus', verifyToken, async (req, res) => {
    try {
        const { date } = req.query;
        const result = await FocusService.getFocus(req.userId, date);
        res.json(result);
    } catch (err) {
        console.error('Focus GET error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/my-work/focus - Set focus tasks for a date
router.put('/focus', verifyToken, async (req, res) => {
    try {
        const { date, tasks } = req.body;
        if (!date || !Array.isArray(tasks)) {
            return res.status(400).json({ error: 'date and tasks array required' });
        }
        const result = await FocusService.setFocus(req.userId, date, tasks);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Focus PUT error:', err);
        res.status(400).json({ error: err.message });
    }
});

// POST /api/my-work/focus/add - Add single task to focus
router.post('/focus/add', verifyToken, async (req, res) => {
    try {
        const { taskId, date, timeBlock } = req.body;
        if (!taskId) {
            return res.status(400).json({ error: 'taskId required' });
        }
        const targetDate = date || new Date().toISOString().split('T')[0];
        const result = await FocusService.addToFocus(req.userId, taskId, targetDate, timeBlock);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Focus add error:', err);
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/my-work/focus/:taskId - Remove task from focus
router.delete('/focus/:taskId', verifyToken, async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        const result = await FocusService.removeFromFocus(req.userId, req.params.taskId, targetDate);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Focus remove error:', err);
        res.status(400).json({ error: err.message });
    }
});

// POST /api/my-work/focus/reorder - Reorder focus tasks
router.post('/focus/reorder', verifyToken, async (req, res) => {
    try {
        const { date, fromIndex, toIndex } = req.body;
        if (fromIndex === undefined || toIndex === undefined) {
            return res.status(400).json({ error: 'fromIndex and toIndex required' });
        }
        const targetDate = date || new Date().toISOString().split('T')[0];
        const result = await FocusService.reorderFocus(req.userId, targetDate, fromIndex, toIndex);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Focus reorder error:', err);
        res.status(400).json({ error: err.message });
    }
});

// POST /api/my-work/focus/complete - Mark focus task complete
router.post('/focus/complete', verifyToken, async (req, res) => {
    try {
        const { taskId, date, completed } = req.body;
        if (!taskId) {
            return res.status(400).json({ error: 'taskId required' });
        }
        const targetDate = date || new Date().toISOString().split('T')[0];
        const result = await FocusService.setFocusTaskComplete(req.userId, taskId, targetDate, completed !== false);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Focus complete error:', err);
        res.status(400).json({ error: err.message });
    }
});

// POST /api/my-work/focus/ai-suggest - Get AI suggestions
router.post('/focus/ai-suggest', verifyToken, async (req, res) => {
    try {
        const { projectId, date } = req.body;
        const result = await FocusService.getAISuggestions(req.userId, projectId);
        res.json(result);
    } catch (err) {
        console.error('Focus AI suggest error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// INBOX API - Inbox Zero methodology (PMO Upgrade)
// ============================================================================

// GET /api/my-work/inbox - Get inbox items
router.get('/inbox', verifyToken, async (req, res) => {
    try {
        const { includeTriaged, limit } = req.query;
        const result = await InboxService.getInbox(req.userId, {
            includeTriaged: includeTriaged === 'true',
            limit: parseInt(limit) || 50
        });
        res.json(result);
    } catch (err) {
        console.error('Inbox GET error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/inbox/counts - Get inbox counts for badges
router.get('/inbox/counts', verifyToken, async (req, res) => {
    try {
        const counts = await InboxService.getInboxCounts(req.userId);
        res.json(counts);
    } catch (err) {
        console.error('Inbox counts error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/my-work/inbox/:id/triage - Triage single item
router.post('/inbox/:id/triage', verifyToken, async (req, res) => {
    try {
        const { action, params } = req.body;
        if (!action) {
            return res.status(400).json({ error: 'action required' });
        }
        const result = await InboxService.triageItem(req.userId, req.params.id, action, params);
        res.json({ success: true, item: result });
    } catch (err) {
        console.error('Inbox triage error:', err);
        res.status(400).json({ error: err.message });
    }
});

// POST /api/my-work/inbox/bulk-triage - Bulk triage
router.post('/inbox/bulk-triage', verifyToken, async (req, res) => {
    try {
        const { itemIds, action, params } = req.body;
        if (!Array.isArray(itemIds) || !action) {
            return res.status(400).json({ error: 'itemIds array and action required' });
        }
        const result = await InboxService.bulkTriage(req.userId, itemIds, action, params);
        res.json(result);
    } catch (err) {
        console.error('Inbox bulk triage error:', err);
        res.status(400).json({ error: err.message });
    }
});

// ============================================================================
// DASHBOARD API - Execution metrics (PMO Upgrade)
// ============================================================================

// GET /api/my-work/dashboard - Enhanced dashboard with PMO metrics
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const { locationIds } = req.query;
        const locations = locationIds ? locationIds.split(',') : null;
        
        // Get base my work data
        const myWork = await MyWorkService.getMyWork(req.userId, req.organizationId);
        
        // Get focus data for today
        const today = new Date().toISOString().split('T')[0];
        const focusData = await FocusService.getFocus(req.userId, today);
        
        // Combine into dashboard response
        res.json({
            overdueCount: myWork.myTasks?.overdue || 0,
            dueThisWeekCount: myWork.myTasks?.dueToday || 0,
            blockedCount: myWork.myTasks?.blocked || 0,
            completedCount: focusData.board?.completedCount || 0,
            totalCount: myWork.myTasks?.total || 0,
            todayFocus: focusData.board?.tasks || [],
            executionScore: focusData.board?.executionScore || 0
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/execution-score - Detailed execution metrics
router.get('/execution-score', verifyToken, async (req, res) => {
    try {
        const { historyDays } = req.query;
        const days = parseInt(historyDays) || 30;
        
        // Get execution history
        const history = await FocusService.getExecutionHistory(req.userId, days);
        
        // Calculate current score and trends
        const today = history[0];
        const lastWeek = history.slice(0, 7);
        const previousWeek = history.slice(7, 14);
        
        const avgThisWeek = lastWeek.length > 0 
            ? lastWeek.reduce((sum, h) => sum + h.score, 0) / lastWeek.length 
            : 0;
        const avgPrevWeek = previousWeek.length > 0 
            ? previousWeek.reduce((sum, h) => sum + h.score, 0) / previousWeek.length 
            : 0;
        
        const trend = avgThisWeek > avgPrevWeek + 5 ? 'up' : avgThisWeek < avgPrevWeek - 5 ? 'down' : 'stable';
        
        res.json({
            score: {
                current: today?.score || 0,
                trend,
                vsLastWeek: Math.round(avgThisWeek - avgPrevWeek),
                breakdown: {
                    completionRate: today?.score || 0,
                    onTimeRate: 70, // Placeholder - would need more data
                    velocityScore: 75,
                    qualityScore: 80
                },
                rank: {
                    position: 1,
                    totalInTeam: 1,
                    percentile: 100
                },
                streak: {
                    current: lastWeek.filter(h => h.score >= 80).length,
                    best: 14,
                    lastBreak: null
                }
            },
            history,
            bottlenecks: [] // Would be populated by ExecutionMonitorService
        });
    } catch (err) {
        console.error('Execution score error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/velocity - Velocity metrics
router.get('/velocity', verifyToken, async (req, res) => {
    try {
        const { period, weeks } = req.query;
        const numWeeks = parseInt(weeks) || 4;
        
        // Get completion history
        const history = await FocusService.getExecutionHistory(req.userId, numWeeks * 7);
        
        // Group by week
        const weeklyData = [];
        for (let i = 0; i < numWeeks; i++) {
            const weekStart = i * 7;
            const weekEnd = weekStart + 7;
            const weekHistory = history.slice(weekStart, weekEnd);
            
            const completed = weekHistory.reduce((sum, h) => sum + h.completedCount, 0);
            const total = weekHistory.reduce((sum, h) => sum + h.totalCount, 0);
            
            weeklyData.push({
                date: weekHistory[0]?.date || '',
                completed,
                created: total, // Simplified - would need separate tracking
                netVelocity: completed
            });
        }
        
        const avgVelocity = weeklyData.reduce((sum, w) => sum + w.completed, 0) / numWeeks;
        const trend = weeklyData[0]?.completed > avgVelocity ? 'up' : 'stable';
        
        res.json({
            metrics: {
                period: period || 'week',
                data: weeklyData.reverse(),
                averageVelocity: Math.round(avgVelocity),
                teamAverageVelocity: Math.round(avgVelocity * 0.9), // Placeholder
                trend
            }
        });
    } catch (err) {
        console.error('Velocity error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/bottlenecks - Current bottlenecks
router.get('/bottlenecks', verifyToken, async (req, res) => {
    try {
        // Get tasks data to identify bottlenecks
        const tasks = await MyWorkService._getMyTasks(req.userId);
        
        const bottlenecks = [];
        
        // Check for stalled tasks (no implementation yet - placeholder)
        if (tasks.overdue > 0) {
            bottlenecks.push({
                type: 'overdue_cluster',
                count: tasks.overdue,
                impact: tasks.overdue >= 3 ? 'high' : 'medium',
                suggestion: `You have ${tasks.overdue} overdue task(s). Consider prioritizing these today.`,
                affectedTasks: tasks.items?.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).map(t => t.id) || []
            });
        }
        
        if (tasks.blocked > 0) {
            bottlenecks.push({
                type: 'blocked_chain',
                count: tasks.blocked,
                impact: 'high',
                suggestion: `${tasks.blocked} task(s) are blocked. Resolve blockers to unblock progress.`,
                affectedTasks: tasks.items?.filter(t => t.status === 'blocked').map(t => t.id) || []
            });
        }
        
        res.json({ bottlenecks });
    } catch (err) {
        console.error('Bottlenecks error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/workload - Team workload data
router.get('/workload', verifyToken, async (req, res) => {
    try {
        // Placeholder - would need team data and task allocations
        res.json({
            workload: {
                period: {
                    start: new Date().toISOString().split('T')[0],
                    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                },
                members: [],
                teamAverage: 0,
                overloadedCount: 0,
                underutilizedCount: 0
            }
        });
    } catch (err) {
        console.error('Workload error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
