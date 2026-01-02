/**
 * Daily Brief API Routes
 * 
 * Generates personalized daily briefing for AI Chat.
 * Aggregates pending decisions, overdue tasks, initiative updates,
 * and upcoming milestones into a structured summary.
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const db = require('../database');

// Helper: Promisify db.all
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});

// Helper: Format date for display
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
};

// Helper: Get relative day label
const getRelativeDay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateOnly = new Date(date.toDateString());
    const todayOnly = new Date(today.toDateString());
    const tomorrowOnly = new Date(tomorrow.toDateString());
    
    if (dateOnly.getTime() === todayOnly.getTime()) return 'dziś';
    if (dateOnly.getTime() === tomorrowOnly.getTime()) return 'jutro';
    return formatDate(dateStr);
};

/**
 * GET /api/daily-brief
 * Generate personalized daily briefing
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const organizationId = req.organizationId;
        const { projectId } = req.query;

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        const weekStr = weekFromNow.toISOString().split('T')[0];

        // 1. Pending Decisions (due today or tomorrow, awaiting user)
        let decisionsQuery = `
            SELECT d.id, d.title, d.priority, d.decision_deadline, d.status,
                   p.name as project_name
            FROM decisions d
            LEFT JOIN projects p ON d.project_id = p.id
            WHERE d.status IN ('PENDING', 'AWAITING_INPUT')
              AND d.organization_id = ?
              AND (
                  d.decision_deadline <= ? 
                  OR d.decision_deadline IS NULL
              )
        `;
        const decisionsParams = [organizationId, tomorrowStr];
        
        if (projectId) {
            decisionsQuery += ` AND d.project_id = ?`;
            decisionsParams.push(projectId);
        }
        decisionsQuery += ` ORDER BY d.priority DESC, d.decision_deadline ASC LIMIT 5`;

        const pendingDecisions = await dbAll(decisionsQuery, decisionsParams);

        // 2. Overdue Tasks (assigned to user or unassigned in org)
        let tasksQuery = `
            SELECT t.id, t.title, t.priority, t.due_date, t.status,
                   p.name as project_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.status NOT IN ('COMPLETED', 'CANCELLED')
              AND t.organization_id = ?
              AND t.due_date < ?
              AND (t.assignee_id = ? OR t.assignee_id IS NULL)
        `;
        const tasksParams = [organizationId, todayStr, userId];
        
        if (projectId) {
            tasksQuery += ` AND t.project_id = ?`;
            tasksParams.push(projectId);
        }
        tasksQuery += ` ORDER BY t.due_date ASC, t.priority DESC LIMIT 5`;

        const overdueTasks = await dbAll(tasksQuery, tasksParams);

        // 3. Tasks due today
        let todayTasksQuery = `
            SELECT t.id, t.title, t.priority, t.due_date, t.status,
                   p.name as project_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.status NOT IN ('COMPLETED', 'CANCELLED')
              AND t.organization_id = ?
              AND DATE(t.due_date) = DATE(?)
              AND (t.assignee_id = ? OR t.assignee_id IS NULL)
        `;
        const todayTasksParams = [organizationId, todayStr, userId];
        
        if (projectId) {
            todayTasksQuery += ` AND t.project_id = ?`;
            todayTasksParams.push(projectId);
        }
        todayTasksQuery += ` ORDER BY t.priority DESC LIMIT 5`;

        const todayTasks = await dbAll(todayTasksQuery, todayTasksParams);

        // 4. Initiative Status Changes (last 24h)
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString();

        let initiativesQuery = `
            SELECT i.id, i.name, i.status, i.priority,
                   p.name as project_name
            FROM initiatives i
            LEFT JOIN projects p ON i.project_id = p.id
            WHERE i.organization_id = ?
              AND i.updated_at >= ?
              AND i.status != i.previous_status
        `;
        const initiativesParams = [organizationId, yesterdayStr];
        
        if (projectId) {
            initiativesQuery += ` AND i.project_id = ?`;
            initiativesParams.push(projectId);
        }
        initiativesQuery += ` ORDER BY i.updated_at DESC LIMIT 5`;

        let initiativeUpdates = [];
        try {
            initiativeUpdates = await dbAll(initiativesQuery, initiativesParams);
        } catch (e) {
            // Column previous_status might not exist
            console.log('[DailyBrief] Initiative updates query failed, skipping:', e.message);
        }

        // 5. Upcoming Milestones (next 7 days)
        let milestonesQuery = `
            SELECT m.id, m.name, m.target_date, m.status,
                   i.name as initiative_name,
                   p.name as project_name
            FROM milestones m
            LEFT JOIN initiatives i ON m.initiative_id = i.id
            LEFT JOIN projects p ON i.project_id = p.id
            WHERE m.status != 'COMPLETED'
              AND m.target_date >= ?
              AND m.target_date <= ?
        `;
        const milestonesParams = [todayStr, weekStr];
        
        if (projectId) {
            milestonesQuery += ` AND i.project_id = ?`;
            milestonesParams.push(projectId);
        }
        milestonesQuery += ` ORDER BY m.target_date ASC LIMIT 5`;

        let upcomingMilestones = [];
        try {
            upcomingMilestones = await dbAll(milestonesQuery, milestonesParams);
        } catch (e) {
            // Table might not exist
            console.log('[DailyBrief] Milestones query failed, skipping:', e.message);
        }

        // 6. Quick Stats
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM tasks WHERE organization_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED') AND (assignee_id = ? OR assignee_id IS NULL)) as open_tasks,
                (SELECT COUNT(*) FROM decisions WHERE organization_id = ? AND status IN ('PENDING', 'AWAITING_INPUT')) as pending_decisions,
                (SELECT COUNT(*) FROM initiatives WHERE organization_id = ? AND status = 'IN_PROGRESS') as active_initiatives
        `;
        const statsRow = await dbAll(statsQuery, [organizationId, userId, organizationId, organizationId]);
        const stats = statsRow[0] || { open_tasks: 0, pending_decisions: 0, active_initiatives: 0 };

        // Generate brief content
        const briefSections = [];

        // Greeting based on time
        const hour = today.getHours();
        let greeting = 'Dzień dobry';
        if (hour < 12) greeting = 'Dzień dobry';
        else if (hour < 18) greeting = 'Cześć';
        else greeting = 'Dobry wieczór';

        // Stats summary
        briefSections.push({
            type: 'stats',
            title: 'Podsumowanie',
            content: `Masz ${stats.open_tasks} otwartych zadań, ${stats.pending_decisions} decyzji do podjęcia i ${stats.active_initiatives} aktywnych inicjatyw.`
        });

        // Urgent items
        if (pendingDecisions.length > 0) {
            briefSections.push({
                type: 'decisions',
                title: 'Pilne decyzje',
                items: pendingDecisions.map(d => ({
                    id: d.id,
                    text: d.title,
                    meta: d.decision_deadline ? `Termin: ${getRelativeDay(d.decision_deadline)}` : 'Brak terminu',
                    priority: d.priority,
                    project: d.project_name
                }))
            });
        }

        // Overdue
        if (overdueTasks.length > 0) {
            briefSections.push({
                type: 'overdue',
                title: 'Zaległe zadania',
                items: overdueTasks.map(t => ({
                    id: t.id,
                    text: t.title,
                    meta: `Termin minął: ${formatDate(t.due_date)}`,
                    priority: t.priority,
                    project: t.project_name
                }))
            });
        }

        // Today's tasks
        if (todayTasks.length > 0) {
            briefSections.push({
                type: 'today',
                title: 'Na dziś',
                items: todayTasks.map(t => ({
                    id: t.id,
                    text: t.title,
                    priority: t.priority,
                    project: t.project_name
                }))
            });
        }

        // Initiative updates
        if (initiativeUpdates.length > 0) {
            briefSections.push({
                type: 'updates',
                title: 'Zmiany w inicjatywach',
                items: initiativeUpdates.map(i => ({
                    id: i.id,
                    text: i.name,
                    meta: `Status: ${i.status}`,
                    project: i.project_name
                }))
            });
        }

        // Upcoming milestones
        if (upcomingMilestones.length > 0) {
            briefSections.push({
                type: 'milestones',
                title: 'Nadchodzące kamienie milowe',
                items: upcomingMilestones.map(m => ({
                    id: m.id,
                    text: m.name,
                    meta: `${getRelativeDay(m.target_date)} - ${m.initiative_name || 'Brak inicjatywy'}`,
                    project: m.project_name
                }))
            });
        }

        // Generate readable text version for AI chat
        let textBrief = `${greeting}! Oto Twój dzienny brief:\n\n`;
        
        textBrief += `📊 **Podsumowanie:** ${stats.open_tasks} zadań, ${stats.pending_decisions} decyzji, ${stats.active_initiatives} aktywnych inicjatyw.\n\n`;

        if (pendingDecisions.length > 0) {
            textBrief += `⚠️ **Pilne decyzje (${pendingDecisions.length}):**\n`;
            pendingDecisions.forEach(d => {
                textBrief += `• ${d.title}${d.decision_deadline ? ` (termin: ${getRelativeDay(d.decision_deadline)})` : ''}\n`;
            });
            textBrief += '\n';
        }

        if (overdueTasks.length > 0) {
            textBrief += `🔴 **Zaległe zadania (${overdueTasks.length}):**\n`;
            overdueTasks.forEach(t => {
                textBrief += `• ${t.title} (termin minął: ${formatDate(t.due_date)})\n`;
            });
            textBrief += '\n';
        }

        if (todayTasks.length > 0) {
            textBrief += `📅 **Na dziś (${todayTasks.length}):**\n`;
            todayTasks.forEach(t => {
                textBrief += `• ${t.title}\n`;
            });
            textBrief += '\n';
        }

        if (upcomingMilestones.length > 0) {
            textBrief += `🎯 **Nadchodzące kamienie milowe:**\n`;
            upcomingMilestones.forEach(m => {
                textBrief += `• ${m.name} (${getRelativeDay(m.target_date)})\n`;
            });
            textBrief += '\n';
        }

        if (briefSections.length === 1) {
            textBrief += 'Wygląda na spokojny dzień! Nie masz pilnych spraw do załatwienia. 🎉';
        } else {
            textBrief += 'Jak mogę Ci dziś pomóc?';
        }

        res.json({
            success: true,
            brief: {
                greeting,
                date: today.toISOString(),
                sections: briefSections,
                stats,
                textVersion: textBrief
            }
        });

    } catch (err) {
        console.error('[DailyBrief] Error:', err);
        res.status(500).json({ 
            error: 'Failed to generate daily brief',
            message: err.message 
        });
    }
});

module.exports = router;



