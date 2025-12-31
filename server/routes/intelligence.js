/**
 * Project Intelligence Routes
 * 
 * Routes for managing project insights, interview sessions, and knowledge capture
 * Part of the Project Intelligence Hub module
 */

const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/errorHandler');
const queryHelpers = require('../utils/queryHelpers');

router.use(verifyToken);

// ==========================================
// ENSURE TABLES EXIST
// ==========================================
const ensureTables = async () => {
    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS interview_sessions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            topic TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            progress TEXT DEFAULT '{"completed":[],"current":null,"remaining":[]}',
            started_at TEXT DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT,
            duration_minutes INTEGER
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS project_insights (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            session_id TEXT,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            source TEXT,
            confidence TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'draft',
            related_insights TEXT,
            pmo_domain TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS interview_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            detected_insights TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create indexes if they don't exist
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_insights_project ON project_insights(project_id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_insights_category ON project_insights(category)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_sessions_project ON interview_sessions(project_id)`);
};

// ==========================================
// PROJECT INSIGHTS CRUD
// ==========================================

// GET all insights for a project
router.get('/projects/:projectId/insights', asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { category, status, sessionId } = req.query;
    const orgId = req.user.organizationId;

    await ensureTables();

    // Verify project belongs to org
    const project = await queryHelpers.queryOne(
        'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
        [projectId, orgId]
    );
    if (!project) {
        return res.status(404).json({ error: 'Project not found' });
    }

    let sql = `
        SELECT i.*, 
            u.first_name as creator_first_name, 
            u.last_name as creator_last_name
        FROM project_insights i
        LEFT JOIN users u ON i.created_by = u.id
        WHERE i.project_id = ?
    `;
    const params = [projectId];

    if (category) {
        sql += ` AND i.category = ?`;
        params.push(category);
    }

    if (status) {
        sql += ` AND i.status = ?`;
        params.push(status);
    }

    if (sessionId) {
        sql += ` AND i.session_id = ?`;
        params.push(sessionId);
    }

    sql += ` ORDER BY i.created_at DESC`;

    const rows = await queryHelpers.queryAll(sql, params);

    const insights = rows.map(r => ({
        id: r.id,
        projectId: r.project_id,
        sessionId: r.session_id,
        category: r.category,
        title: r.title,
        content: r.content ? JSON.parse(r.content) : {},
        source: r.source ? JSON.parse(r.source) : null,
        confidence: r.confidence,
        status: r.status,
        relatedInsights: r.related_insights ? JSON.parse(r.related_insights) : [],
        pmoDomain: r.pmo_domain,
        createdBy: r.created_by ? {
            id: r.created_by,
            firstName: r.creator_first_name,
            lastName: r.creator_last_name
        } : null,
        createdAt: r.created_at,
        updatedAt: r.updated_at
    }));

    // Group by category for counts
    const categoryCounts = {};
    insights.forEach(i => {
        categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
    });

    res.json({ 
        insights, 
        total: insights.length,
        categoryCounts
    });
}));

// GET single insight
router.get('/insights/:insightId', asyncHandler(async (req, res) => {
    const { insightId } = req.params;
    const orgId = req.user.organizationId;

    await ensureTables();

    const row = await queryHelpers.queryOne(`
        SELECT i.*, 
            u.first_name as creator_first_name, 
            u.last_name as creator_last_name,
            p.name as project_name
        FROM project_insights i
        LEFT JOIN users u ON i.created_by = u.id
        LEFT JOIN projects p ON i.project_id = p.id
        WHERE i.id = ? AND p.organization_id = ?
    `, [insightId, orgId]);

    if (!row) {
        return res.status(404).json({ error: 'Insight not found' });
    }

    res.json({
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name,
        sessionId: row.session_id,
        category: row.category,
        title: row.title,
        content: row.content ? JSON.parse(row.content) : {},
        source: row.source ? JSON.parse(row.source) : null,
        confidence: row.confidence,
        status: row.status,
        relatedInsights: row.related_insights ? JSON.parse(row.related_insights) : [],
        pmoDomain: row.pmo_domain,
        createdBy: row.created_by ? {
            id: row.created_by,
            firstName: row.creator_first_name,
            lastName: row.creator_last_name
        } : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    });
}));

// CREATE insight
router.post('/projects/:projectId/insights', asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const userId = req.user.id;
    const orgId = req.user.organizationId;
    const {
        category,
        title,
        content,
        source,
        confidence,
        status,
        relatedInsights,
        pmoDomain,
        sessionId
    } = req.body;

    if (!category || !title) {
        return res.status(400).json({ error: 'Category and title are required' });
    }

    await ensureTables();

    // Verify project belongs to org
    const project = await queryHelpers.queryOne(
        'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
        [projectId, orgId]
    );
    if (!project) {
        return res.status(404).json({ error: 'Project not found' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await db.runAsync(`
        INSERT INTO project_insights (
            id, project_id, session_id, category, title, content,
            source, confidence, status, related_insights, pmo_domain,
            created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id,
        projectId,
        sessionId || null,
        category,
        title,
        content ? JSON.stringify(content) : '{}',
        source ? JSON.stringify(source) : null,
        confidence || 'medium',
        status || 'draft',
        relatedInsights ? JSON.stringify(relatedInsights) : null,
        pmoDomain || null,
        userId,
        now,
        now
    ]);

    res.status(201).json({
        id,
        projectId,
        sessionId: sessionId || null,
        category,
        title,
        content: content || {},
        source: source || null,
        confidence: confidence || 'medium',
        status: status || 'draft',
        relatedInsights: relatedInsights || [],
        pmoDomain: pmoDomain || null,
        createdAt: now,
        updatedAt: now
    });
}));

// UPDATE insight
router.patch('/insights/:insightId', asyncHandler(async (req, res) => {
    const { insightId } = req.params;
    const orgId = req.user.organizationId;
    const updates = req.body;

    await ensureTables();

    // Verify insight belongs to org
    const existing = await queryHelpers.queryOne(`
        SELECT i.* FROM project_insights i
        JOIN projects p ON i.project_id = p.id
        WHERE i.id = ? AND p.organization_id = ?
    `, [insightId, orgId]);

    if (!existing) {
        return res.status(404).json({ error: 'Insight not found' });
    }

    const now = new Date().toISOString();
    const updateFields = [];
    const params = [];

    if (updates.title !== undefined) {
        updateFields.push('title = ?');
        params.push(updates.title);
    }
    if (updates.content !== undefined) {
        updateFields.push('content = ?');
        params.push(JSON.stringify(updates.content));
    }
    if (updates.status !== undefined) {
        updateFields.push('status = ?');
        params.push(updates.status);
    }
    if (updates.confidence !== undefined) {
        updateFields.push('confidence = ?');
        params.push(updates.confidence);
    }
    if (updates.relatedInsights !== undefined) {
        updateFields.push('related_insights = ?');
        params.push(JSON.stringify(updates.relatedInsights));
    }
    if (updates.pmoDomain !== undefined) {
        updateFields.push('pmo_domain = ?');
        params.push(updates.pmoDomain);
    }

    updateFields.push('updated_at = ?');
    params.push(now);
    params.push(insightId);

    await db.runAsync(
        `UPDATE project_insights SET ${updateFields.join(', ')} WHERE id = ?`,
        params
    );

    res.json({ success: true, updatedAt: now });
}));

// DELETE insight
router.delete('/insights/:insightId', asyncHandler(async (req, res) => {
    const { insightId } = req.params;
    const orgId = req.user.organizationId;

    await ensureTables();

    // Verify insight belongs to org
    const existing = await queryHelpers.queryOne(`
        SELECT i.id FROM project_insights i
        JOIN projects p ON i.project_id = p.id
        WHERE i.id = ? AND p.organization_id = ?
    `, [insightId, orgId]);

    if (!existing) {
        return res.status(404).json({ error: 'Insight not found' });
    }

    await db.runAsync('DELETE FROM project_insights WHERE id = ?', [insightId]);

    res.json({ success: true });
}));

// ==========================================
// INTERVIEW SESSIONS
// ==========================================

// GET all sessions for a project
router.get('/projects/:projectId/sessions', asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { status } = req.query;
    const orgId = req.user.organizationId;

    await ensureTables();

    // Verify project belongs to org
    const project = await queryHelpers.queryOne(
        'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
        [projectId, orgId]
    );
    if (!project) {
        return res.status(404).json({ error: 'Project not found' });
    }

    let sql = `
        SELECT s.*, 
            u.first_name, u.last_name,
            (SELECT COUNT(*) FROM project_insights WHERE session_id = s.id) as insight_count,
            (SELECT COUNT(*) FROM interview_messages WHERE session_id = s.id) as message_count
        FROM interview_sessions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.project_id = ?
    `;
    const params = [projectId];

    if (status) {
        sql += ` AND s.status = ?`;
        params.push(status);
    }

    sql += ` ORDER BY s.started_at DESC`;

    const rows = await queryHelpers.queryAll(sql, params);

    const sessions = rows.map(r => ({
        id: r.id,
        projectId: r.project_id,
        topic: r.topic,
        status: r.status,
        progress: r.progress ? JSON.parse(r.progress) : { completed: [], current: null, remaining: [] },
        startedAt: r.started_at,
        completedAt: r.completed_at,
        durationMinutes: r.duration_minutes,
        user: {
            id: r.user_id,
            firstName: r.first_name,
            lastName: r.last_name
        },
        insightCount: r.insight_count,
        messageCount: r.message_count
    }));

    res.json({ sessions, total: sessions.length });
}));

// CREATE session
router.post('/projects/:projectId/sessions', asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const userId = req.user.id;
    const orgId = req.user.organizationId;
    const { topic, progress } = req.body;

    if (!topic) {
        return res.status(400).json({ error: 'Topic is required' });
    }

    await ensureTables();

    // Verify project belongs to org
    const project = await queryHelpers.queryOne(
        'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
        [projectId, orgId]
    );
    if (!project) {
        return res.status(404).json({ error: 'Project not found' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await db.runAsync(`
        INSERT INTO interview_sessions (
            id, project_id, user_id, topic, status, progress, started_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        id,
        projectId,
        userId,
        topic,
        'active',
        progress ? JSON.stringify(progress) : '{"completed":[],"current":null,"remaining":[]}',
        now
    ]);

    res.status(201).json({
        id,
        projectId,
        userId,
        topic,
        status: 'active',
        progress: progress || { completed: [], current: null, remaining: [] },
        startedAt: now
    });
}));

// UPDATE session
router.patch('/sessions/:sessionId', asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const orgId = req.user.organizationId;
    const updates = req.body;

    await ensureTables();

    // Verify session belongs to org
    const existing = await queryHelpers.queryOne(`
        SELECT s.* FROM interview_sessions s
        JOIN projects p ON s.project_id = p.id
        WHERE s.id = ? AND p.organization_id = ?
    `, [sessionId, orgId]);

    if (!existing) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const updateFields = [];
    const params = [];

    if (updates.status !== undefined) {
        updateFields.push('status = ?');
        params.push(updates.status);
        
        // If completing, set completed_at and calculate duration
        if (updates.status === 'completed') {
            const now = new Date().toISOString();
            updateFields.push('completed_at = ?');
            params.push(now);
            
            const startedAt = new Date(existing.started_at);
            const completedAt = new Date(now);
            const durationMinutes = Math.round((completedAt - startedAt) / 60000);
            updateFields.push('duration_minutes = ?');
            params.push(durationMinutes);
        }
    }
    if (updates.progress !== undefined) {
        updateFields.push('progress = ?');
        params.push(JSON.stringify(updates.progress));
    }
    if (updates.topic !== undefined) {
        updateFields.push('topic = ?');
        params.push(updates.topic);
    }

    if (updateFields.length === 0) {
        return res.json({ success: true });
    }

    params.push(sessionId);

    await db.runAsync(
        `UPDATE interview_sessions SET ${updateFields.join(', ')} WHERE id = ?`,
        params
    );

    res.json({ success: true });
}));

// ==========================================
// INTERVIEW MESSAGES
// ==========================================

// GET messages for a session
router.get('/sessions/:sessionId/messages', asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const orgId = req.user.organizationId;

    await ensureTables();

    // Verify session belongs to org
    const session = await queryHelpers.queryOne(`
        SELECT s.id FROM interview_sessions s
        JOIN projects p ON s.project_id = p.id
        WHERE s.id = ? AND p.organization_id = ?
    `, [sessionId, orgId]);

    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const rows = await queryHelpers.queryAll(
        'SELECT * FROM interview_messages WHERE session_id = ? ORDER BY created_at ASC',
        [sessionId]
    );

    const messages = rows.map(r => ({
        id: r.id,
        sessionId: r.session_id,
        role: r.role,
        content: r.content,
        detectedInsights: r.detected_insights ? JSON.parse(r.detected_insights) : [],
        createdAt: r.created_at
    }));

    res.json({ messages });
}));

// ADD message to session
router.post('/sessions/:sessionId/messages', asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const orgId = req.user.organizationId;
    const { role, content, detectedInsights } = req.body;

    if (!role || !content) {
        return res.status(400).json({ error: 'Role and content are required' });
    }

    await ensureTables();

    // Verify session belongs to org
    const session = await queryHelpers.queryOne(`
        SELECT s.id FROM interview_sessions s
        JOIN projects p ON s.project_id = p.id
        WHERE s.id = ? AND p.organization_id = ?
    `, [sessionId, orgId]);

    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await db.runAsync(`
        INSERT INTO interview_messages (id, session_id, role, content, detected_insights, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        id,
        sessionId,
        role,
        content,
        detectedInsights ? JSON.stringify(detectedInsights) : null,
        now
    ]);

    res.status(201).json({
        id,
        sessionId,
        role,
        content,
        detectedInsights: detectedInsights || [],
        createdAt: now
    });
}));

// ==========================================
// INSIGHT DETECTION (AI)
// ==========================================

// POST detect insights from text
router.post('/detect-insights', asyncHandler(async (req, res) => {
    const { text, context } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }

    // This will be enhanced with actual AI detection
    // For now, return empty array - AI integration will be added later
    res.json({
        detectedInsights: [],
        message: 'AI insight detection will be implemented with AI prompts integration'
    });
}));

// ==========================================
// SEED DATA (Development)
// ==========================================

// POST seed sample data for a project
router.post('/projects/:projectId/seed', asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const userId = req.user.id;
    const orgId = req.user.organizationId;

    await ensureTables();

    // Verify project belongs to org
    const project = await queryHelpers.queryOne(
        'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
        [projectId, orgId]
    );
    if (!project) {
        return res.status(404).json({ error: 'Project not found' });
    }

    const { seedIntelligenceData } = require('../seeds/intelligence-seed');
    const result = await seedIntelligenceData(db, projectId, userId);
    
    res.json({ 
        success: true, 
        message: 'Sample data created',
        ...result
    });
}));

// GET all insights without project filter (for testing)
router.get('/all-insights', asyncHandler(async (req, res) => {
    await ensureTables();

    const rows = await queryHelpers.queryAll(`
        SELECT i.*, p.name as project_name
        FROM project_insights i
        LEFT JOIN projects p ON i.project_id = p.id
        ORDER BY i.created_at DESC
        LIMIT 100
    `, []);

    const insights = rows.map(r => ({
        id: r.id,
        projectId: r.project_id,
        projectName: r.project_name,
        category: r.category,
        title: r.title,
        content: r.content ? JSON.parse(r.content) : {},
        confidence: r.confidence,
        status: r.status,
        pmoDomain: r.pmo_domain,
        createdAt: r.created_at
    }));

    res.json({ insights, total: insights.length });
}));

module.exports = router;

