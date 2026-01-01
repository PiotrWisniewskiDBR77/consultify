/**
 * Studio API Routes
 * 
 * CRUD operations for Consultify Studio - Visual AI Workspace
 * Handles documents, snapshots, templates, and AI diagram generation.
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Helper: Promisify db.all
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});

// Helper: Promisify db.get
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
});

// Helper: Promisify db.run
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

// Generate share token
const generateShareToken = () => crypto.randomBytes(16).toString('hex');

// ==================== DOCUMENTS ====================

/**
 * GET /api/studio/documents
 * List user's studio documents
 */
router.get('/documents', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { type, linkedTaskId, linkedProjectId, linkedInitiativeId, limit = 50, offset = 0 } = req.query;
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        let sql = `
            SELECT 
                sd.*,
                u.first_name || ' ' || u.last_name as creator_name,
                u.email as creator_email
            FROM studio_documents sd
            LEFT JOIN users u ON sd.created_by = u.id
            WHERE sd.organization_id = ?
        `;
        const params = [user.organization_id];
        
        if (type) {
            sql += ' AND sd.type = ?';
            params.push(type);
        }
        
        if (linkedTaskId) {
            sql += ' AND sd.linked_task_id = ?';
            params.push(linkedTaskId);
        }
        
        if (linkedProjectId) {
            sql += ' AND sd.linked_project_id = ?';
            params.push(linkedProjectId);
        }
        
        if (linkedInitiativeId) {
            sql += ' AND sd.linked_initiative_id = ?';
            params.push(linkedInitiativeId);
        }
        
        sql += ' ORDER BY sd.updated_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const documents = await dbAll(sql, params);
        
        // Parse JSON fields
        const parsedDocs = documents.map(doc => ({
            ...doc,
            nodes: JSON.parse(doc.nodes_json || '[]'),
            edges: JSON.parse(doc.edges_json || '[]'),
            viewport: JSON.parse(doc.viewport_json || '{}'),
            tags: JSON.parse(doc.tags_json || '[]'),
            aiContext: JSON.parse(doc.ai_context_json || '{}')
        }));
        
        res.json(parsedDocs);
    } catch (err) {
        console.error('[Studio] Error listing documents:', err);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

/**
 * POST /api/studio/documents
 * Create new studio document
 */
router.post('/documents', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { 
            name, 
            description = '', 
            type = 'process_flow',
            nodes = [],
            edges = [],
            viewport = { x: 0, y: 0, zoom: 1 },
            linkedTaskId,
            linkedProjectId,
            linkedInitiativeId,
            tags = [],
            templateId
        } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        let finalNodes = nodes;
        let finalEdges = edges;
        let finalViewport = viewport;
        
        // If using a template, load it
        if (templateId) {
            const template = await dbGet('SELECT * FROM studio_templates WHERE id = ?', [templateId]);
            if (template) {
                finalNodes = JSON.parse(template.nodes_json || '[]');
                finalEdges = JSON.parse(template.edges_json || '[]');
                finalViewport = JSON.parse(template.default_viewport_json || '{}');
                
                // Increment template usage
                await dbRun('UPDATE studio_templates SET usage_count = usage_count + 1 WHERE id = ?', [templateId]);
            }
        }
        
        const id = uuidv4();
        const now = new Date().toISOString();
        
        await dbRun(`
            INSERT INTO studio_documents (
                id, organization_id, name, description, type,
                nodes_json, edges_json, viewport_json,
                linked_task_id, linked_project_id, linked_initiative_id,
                tags_json, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, user.organization_id, name, description, type,
            JSON.stringify(finalNodes), JSON.stringify(finalEdges), JSON.stringify(finalViewport),
            linkedTaskId || null, linkedProjectId || null, linkedInitiativeId || null,
            JSON.stringify(tags), userId, now, now
        ]);
        
        // Create AI session for this document
        const sessionId = uuidv4();
        await dbRun(`
            INSERT INTO studio_ai_sessions (id, document_id, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        `, [sessionId, id, now, now]);
        
        const document = await dbGet('SELECT * FROM studio_documents WHERE id = ?', [id]);
        
        res.status(201).json({
            ...document,
            nodes: JSON.parse(document.nodes_json || '[]'),
            edges: JSON.parse(document.edges_json || '[]'),
            viewport: JSON.parse(document.viewport_json || '{}'),
            tags: JSON.parse(document.tags_json || '[]')
        });
    } catch (err) {
        console.error('[Studio] Error creating document:', err);
        res.status(500).json({ error: 'Failed to create document' });
    }
});

/**
 * GET /api/studio/documents/:id
 * Get single document
 */
router.get('/documents/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const document = await dbGet(`
            SELECT 
                sd.*,
                u.first_name || ' ' || u.last_name as creator_name,
                sas.messages_json as ai_messages
            FROM studio_documents sd
            LEFT JOIN users u ON sd.created_by = u.id
            LEFT JOIN studio_ai_sessions sas ON sas.document_id = sd.id
            WHERE sd.id = ? AND sd.organization_id = ?
        `, [id, user.organization_id]);
        
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Get snapshots
        const snapshots = await dbAll(`
            SELECT id, version, name, snapshot_reason, created_at
            FROM studio_snapshots
            WHERE document_id = ?
            ORDER BY version DESC
            LIMIT 10
        `, [id]);
        
        // Get comments
        const comments = await dbAll(`
            SELECT sc.*, u.first_name || ' ' || u.last_name as author_name
            FROM studio_comments sc
            LEFT JOIN users u ON sc.author_id = u.id
            WHERE sc.document_id = ?
            ORDER BY sc.created_at DESC
        `, [id]);
        
        res.json({
            ...document,
            nodes: JSON.parse(document.nodes_json || '[]'),
            edges: JSON.parse(document.edges_json || '[]'),
            viewport: JSON.parse(document.viewport_json || '{}'),
            tags: JSON.parse(document.tags_json || '[]'),
            aiContext: JSON.parse(document.ai_context_json || '{}'),
            aiMessages: JSON.parse(document.ai_messages || '[]'),
            snapshots,
            comments
        });
    } catch (err) {
        console.error('[Studio] Error getting document:', err);
        res.status(500).json({ error: 'Failed to get document' });
    }
});

/**
 * PUT /api/studio/documents/:id
 * Update document
 */
router.put('/documents/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const {
            name,
            description,
            type,
            nodes,
            edges,
            viewport,
            tags,
            linkedTaskId,
            linkedProjectId,
            linkedInitiativeId,
            createSnapshot = false,
            snapshotReason = 'manual'
        } = req.body;
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check document exists and belongs to org
        const existing = await dbGet(
            'SELECT * FROM studio_documents WHERE id = ? AND organization_id = ?',
            [id, user.organization_id]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Create snapshot before update if requested
        if (createSnapshot) {
            const lastSnapshot = await dbGet(
                'SELECT MAX(version) as maxVersion FROM studio_snapshots WHERE document_id = ?',
                [id]
            );
            const newVersion = (lastSnapshot?.maxVersion || 0) + 1;
            
            await dbRun(`
                INSERT INTO studio_snapshots (
                    id, document_id, version, nodes_json, edges_json, viewport_json,
                    snapshot_reason, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(), id, newVersion,
                existing.nodes_json, existing.edges_json, existing.viewport_json,
                snapshotReason, userId, new Date().toISOString()
            ]);
        }
        
        // Build update query
        const updates = [];
        const params = [];
        
        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (type !== undefined) { updates.push('type = ?'); params.push(type); }
        if (nodes !== undefined) { updates.push('nodes_json = ?'); params.push(JSON.stringify(nodes)); }
        if (edges !== undefined) { updates.push('edges_json = ?'); params.push(JSON.stringify(edges)); }
        if (viewport !== undefined) { updates.push('viewport_json = ?'); params.push(JSON.stringify(viewport)); }
        if (tags !== undefined) { updates.push('tags_json = ?'); params.push(JSON.stringify(tags)); }
        if (linkedTaskId !== undefined) { updates.push('linked_task_id = ?'); params.push(linkedTaskId); }
        if (linkedProjectId !== undefined) { updates.push('linked_project_id = ?'); params.push(linkedProjectId); }
        if (linkedInitiativeId !== undefined) { updates.push('linked_initiative_id = ?'); params.push(linkedInitiativeId); }
        
        updates.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);
        
        await dbRun(`UPDATE studio_documents SET ${updates.join(', ')} WHERE id = ?`, params);
        
        const updated = await dbGet('SELECT * FROM studio_documents WHERE id = ?', [id]);
        
        res.json({
            ...updated,
            nodes: JSON.parse(updated.nodes_json || '[]'),
            edges: JSON.parse(updated.edges_json || '[]'),
            viewport: JSON.parse(updated.viewport_json || '{}'),
            tags: JSON.parse(updated.tags_json || '[]')
        });
    } catch (err) {
        console.error('[Studio] Error updating document:', err);
        res.status(500).json({ error: 'Failed to update document' });
    }
});

/**
 * DELETE /api/studio/documents/:id
 * Delete document
 */
router.delete('/documents/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const result = await dbRun(
            'DELETE FROM studio_documents WHERE id = ? AND organization_id = ?',
            [id, user.organization_id]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        res.json({ success: true, message: 'Document deleted' });
    } catch (err) {
        console.error('[Studio] Error deleting document:', err);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// ==================== SNAPSHOTS ====================

/**
 * POST /api/studio/documents/:id/snapshot
 * Create document snapshot
 */
router.post('/documents/:id/snapshot', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const { name, reason = 'manual' } = req.body;
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const document = await dbGet(
            'SELECT * FROM studio_documents WHERE id = ? AND organization_id = ?',
            [id, user.organization_id]
        );
        
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Get next version number
        const lastSnapshot = await dbGet(
            'SELECT MAX(version) as maxVersion FROM studio_snapshots WHERE document_id = ?',
            [id]
        );
        const newVersion = (lastSnapshot?.maxVersion || 0) + 1;
        
        const snapshotId = uuidv4();
        await dbRun(`
            INSERT INTO studio_snapshots (
                id, document_id, version, name, nodes_json, edges_json, viewport_json,
                snapshot_reason, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            snapshotId, id, newVersion, name || `Version ${newVersion}`,
            document.nodes_json, document.edges_json, document.viewport_json,
            reason, userId, new Date().toISOString()
        ]);
        
        const snapshot = await dbGet('SELECT * FROM studio_snapshots WHERE id = ?', [snapshotId]);
        
        res.status(201).json(snapshot);
    } catch (err) {
        console.error('[Studio] Error creating snapshot:', err);
        res.status(500).json({ error: 'Failed to create snapshot' });
    }
});

/**
 * POST /api/studio/documents/:id/restore/:snapshotId
 * Restore document from snapshot
 */
router.post('/documents/:id/restore/:snapshotId', verifyToken, async (req, res) => {
    try {
        const { id, snapshotId } = req.params;
        const userId = req.userId;
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const document = await dbGet(
            'SELECT * FROM studio_documents WHERE id = ? AND organization_id = ?',
            [id, user.organization_id]
        );
        
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const snapshot = await dbGet(
            'SELECT * FROM studio_snapshots WHERE id = ? AND document_id = ?',
            [snapshotId, id]
        );
        
        if (!snapshot) {
            return res.status(404).json({ error: 'Snapshot not found' });
        }
        
        // Create snapshot of current state before restore
        const lastSnap = await dbGet(
            'SELECT MAX(version) as maxVersion FROM studio_snapshots WHERE document_id = ?',
            [id]
        );
        const newVersion = (lastSnap?.maxVersion || 0) + 1;
        
        await dbRun(`
            INSERT INTO studio_snapshots (
                id, document_id, version, name, nodes_json, edges_json, viewport_json,
                snapshot_reason, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuidv4(), id, newVersion, 'Before restore',
            document.nodes_json, document.edges_json, document.viewport_json,
            'before_restore', userId, new Date().toISOString()
        ]);
        
        // Restore from snapshot
        await dbRun(`
            UPDATE studio_documents SET
                nodes_json = ?, edges_json = ?, viewport_json = ?, updated_at = ?
            WHERE id = ?
        `, [snapshot.nodes_json, snapshot.edges_json, snapshot.viewport_json, new Date().toISOString(), id]);
        
        const updated = await dbGet('SELECT * FROM studio_documents WHERE id = ?', [id]);
        
        res.json({
            ...updated,
            nodes: JSON.parse(updated.nodes_json || '[]'),
            edges: JSON.parse(updated.edges_json || '[]'),
            viewport: JSON.parse(updated.viewport_json || '{}')
        });
    } catch (err) {
        console.error('[Studio] Error restoring snapshot:', err);
        res.status(500).json({ error: 'Failed to restore snapshot' });
    }
});

// ==================== SHARING ====================

/**
 * POST /api/studio/documents/:id/share
 * Generate share link
 */
router.post('/documents/:id/share', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const document = await dbGet(
            'SELECT * FROM studio_documents WHERE id = ? AND organization_id = ?',
            [id, user.organization_id]
        );
        
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const shareToken = generateShareToken();
        
        await dbRun(
            'UPDATE studio_documents SET share_token = ?, is_public = 1 WHERE id = ?',
            [shareToken, id]
        );
        
        res.json({ shareToken, shareUrl: `/studio/shared/${shareToken}` });
    } catch (err) {
        console.error('[Studio] Error sharing document:', err);
        res.status(500).json({ error: 'Failed to share document' });
    }
});

/**
 * GET /api/studio/shared/:token
 * Get shared document (public)
 */
router.get('/shared/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const document = await dbGet(`
            SELECT sd.*, u.first_name || ' ' || u.last_name as creator_name
            FROM studio_documents sd
            LEFT JOIN users u ON sd.created_by = u.id
            WHERE sd.share_token = ? AND sd.is_public = 1
        `, [token]);
        
        if (!document) {
            return res.status(404).json({ error: 'Document not found or not shared' });
        }
        
        res.json({
            id: document.id,
            name: document.name,
            description: document.description,
            type: document.type,
            nodes: JSON.parse(document.nodes_json || '[]'),
            edges: JSON.parse(document.edges_json || '[]'),
            viewport: JSON.parse(document.viewport_json || '{}'),
            creatorName: document.creator_name,
            createdAt: document.created_at
        });
    } catch (err) {
        console.error('[Studio] Error getting shared document:', err);
        res.status(500).json({ error: 'Failed to get shared document' });
    }
});

// ==================== COMMENTS ====================

/**
 * POST /api/studio/documents/:id/comments
 * Add comment to node
 */
router.post('/documents/:id/comments', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const { nodeId, text } = req.body;
        
        if (!nodeId || !text) {
            return res.status(400).json({ error: 'nodeId and text are required' });
        }
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify document exists
        const document = await dbGet(
            'SELECT * FROM studio_documents WHERE id = ? AND organization_id = ?',
            [id, user.organization_id]
        );
        
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const commentId = uuidv4();
        const now = new Date().toISOString();
        
        await dbRun(`
            INSERT INTO studio_comments (
                id, document_id, node_id, text, author_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [commentId, id, nodeId, text, userId, now, now]);
        
        const comment = await dbGet(`
            SELECT sc.*, u.first_name || ' ' || u.last_name as author_name
            FROM studio_comments sc
            LEFT JOIN users u ON sc.author_id = u.id
            WHERE sc.id = ?
        `, [commentId]);
        
        res.status(201).json(comment);
    } catch (err) {
        console.error('[Studio] Error adding comment:', err);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

/**
 * PUT /api/studio/comments/:commentId/resolve
 * Resolve comment
 */
router.put('/comments/:commentId/resolve', verifyToken, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.userId;
        
        await dbRun(`
            UPDATE studio_comments SET
                resolved = 1, resolved_at = ?, resolved_by = ?
            WHERE id = ?
        `, [new Date().toISOString(), userId, commentId]);
        
        const comment = await dbGet('SELECT * FROM studio_comments WHERE id = ?', [commentId]);
        
        res.json(comment);
    } catch (err) {
        console.error('[Studio] Error resolving comment:', err);
        res.status(500).json({ error: 'Failed to resolve comment' });
    }
});

// ==================== TEMPLATES ====================

/**
 * GET /api/studio/templates
 * List available templates
 */
router.get('/templates', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { category } = req.query;
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        let sql = `
            SELECT * FROM studio_templates
            WHERE (organization_id IS NULL OR organization_id = ?)
            AND (is_public = 1 OR organization_id = ?)
        `;
        const params = [user.organization_id, user.organization_id];
        
        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }
        
        sql += ' ORDER BY is_featured DESC, usage_count DESC, name ASC';
        
        const templates = await dbAll(sql, params);
        
        res.json(templates.map(t => ({
            ...t,
            nodes: JSON.parse(t.nodes_json || '[]'),
            edges: JSON.parse(t.edges_json || '[]'),
            tags: JSON.parse(t.tags_json || '[]')
        })));
    } catch (err) {
        console.error('[Studio] Error listing templates:', err);
        res.status(500).json({ error: 'Failed to list templates' });
    }
});

/**
 * POST /api/studio/templates
 * Create template from document
 */
router.post('/templates', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const {
            name,
            description,
            category,
            nodes,
            edges,
            tags = [],
            isPublic = false,
            fromDocumentId
        } = req.body;
        
        if (!name || !category) {
            return res.status(400).json({ error: 'Name and category are required' });
        }
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        let templateNodes = nodes || [];
        let templateEdges = edges || [];
        
        // If creating from existing document
        if (fromDocumentId) {
            const doc = await dbGet(
                'SELECT * FROM studio_documents WHERE id = ? AND organization_id = ?',
                [fromDocumentId, user.organization_id]
            );
            if (doc) {
                templateNodes = JSON.parse(doc.nodes_json || '[]');
                templateEdges = JSON.parse(doc.edges_json || '[]');
            }
        }
        
        const id = uuidv4();
        const now = new Date().toISOString();
        
        await dbRun(`
            INSERT INTO studio_templates (
                id, organization_id, name, description, category,
                nodes_json, edges_json, tags_json, is_public,
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, user.organization_id, name, description, category,
            JSON.stringify(templateNodes), JSON.stringify(templateEdges),
            JSON.stringify(tags), isPublic ? 1 : 0,
            userId, now, now
        ]);
        
        const template = await dbGet('SELECT * FROM studio_templates WHERE id = ?', [id]);
        
        res.status(201).json({
            ...template,
            nodes: JSON.parse(template.nodes_json || '[]'),
            edges: JSON.parse(template.edges_json || '[]'),
            tags: JSON.parse(template.tags_json || '[]')
        });
    } catch (err) {
        console.error('[Studio] Error creating template:', err);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// ==================== AI ====================

const studioAIService = require('../services/studioAIService');

/**
 * POST /api/studio/ai/generate
 * Generate diagram from text description
 */
router.post('/ai/generate', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { prompt, diagramType = 'process_flow' } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const result = await studioAIService.generateDiagram(
            prompt, 
            diagramType, 
            userId, 
            user.organization_id
        );
        
        res.json(result);
    } catch (err) {
        console.error('[Studio] Error generating diagram:', err);
        res.status(500).json({ error: 'Failed to generate diagram' });
    }
});

/**
 * POST /api/studio/ai/modify
 * Modify existing diagram based on instruction
 */
router.post('/ai/modify', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { prompt, nodes, edges } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        if (!nodes || nodes.length === 0) {
            return res.status(400).json({ error: 'Current diagram nodes are required' });
        }
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const result = await studioAIService.modifyDiagram(
            prompt,
            nodes,
            edges || [],
            userId,
            user.organization_id
        );
        
        res.json(result);
    } catch (err) {
        console.error('[Studio] Error modifying diagram:', err);
        res.status(500).json({ error: 'Failed to modify diagram' });
    }
});

/**
 * POST /api/studio/ai/chat
 * Process chat message and optionally update diagram
 */
router.post('/ai/chat', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { message, documentId, context = {} } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // If documentId provided, load current context
        let diagramContext = context;
        if (documentId && (!context.nodes || context.nodes.length === 0)) {
            const doc = await dbGet(
                'SELECT nodes_json, edges_json FROM studio_documents WHERE id = ? AND organization_id = ?',
                [documentId, user.organization_id]
            );
            if (doc) {
                diagramContext = {
                    nodes: JSON.parse(doc.nodes_json || '[]'),
                    edges: JSON.parse(doc.edges_json || '[]')
                };
            }
        }
        
        const result = await studioAIService.processMessage(
            message,
            diagramContext,
            userId,
            user.organization_id
        );
        
        // Update session history if documentId provided
        if (documentId) {
            await studioAIService.updateSession(documentId, 'user', message, result.intent);
            await studioAIService.updateSession(documentId, 'assistant', result.text, result.intent);
        }
        
        // Auto-save diagram if updated and documentId provided
        if (documentId && result.diagramUpdate) {
            const now = new Date().toISOString();
            await dbRun(`
                UPDATE studio_documents SET
                    nodes_json = ?, edges_json = ?, updated_at = ?
                WHERE id = ? AND organization_id = ?
            `, [
                JSON.stringify(result.diagramUpdate.nodes),
                JSON.stringify(result.diagramUpdate.edges),
                now,
                documentId,
                user.organization_id
            ]);
        }
        
        res.json(result);
    } catch (err) {
        console.error('[Studio] Error processing chat:', err);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

/**
 * POST /api/studio/ai/suggest
 * Get optimization suggestions for diagram
 */
router.post('/ai/suggest', verifyToken, async (req, res) => {
    try {
        const { nodes, edges, diagramType = 'process_flow' } = req.body;
        
        if (!nodes) {
            return res.status(400).json({ error: 'Nodes are required' });
        }
        
        const suggestions = await studioAIService.suggestOptimizations(
            nodes,
            edges || [],
            diagramType
        );
        
        res.json({ suggestions });
    } catch (err) {
        console.error('[Studio] Error getting suggestions:', err);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

/**
 * POST /api/studio/ai/classify
 * Classify intent of a message
 */
router.post('/ai/classify', verifyToken, async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        const result = await studioAIService.classifyIntent(message);
        
        res.json(result);
    } catch (err) {
        console.error('[Studio] Error classifying intent:', err);
        res.status(500).json({ error: 'Failed to classify intent' });
    }
});

// ==================== LINKING ====================

/**
 * POST /api/studio/documents/:id/link
 * Link document to task/project/initiative
 */
router.post('/documents/:id/link', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const { taskId, projectId, initiativeId } = req.body;
        
        // Get user's organization
        const user = await dbGet('SELECT organization_id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const document = await dbGet(
            'SELECT * FROM studio_documents WHERE id = ? AND organization_id = ?',
            [id, user.organization_id]
        );
        
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const updates = [];
        const params = [];
        
        if (taskId !== undefined) {
            updates.push('linked_task_id = ?');
            params.push(taskId);
        }
        if (projectId !== undefined) {
            updates.push('linked_project_id = ?');
            params.push(projectId);
        }
        if (initiativeId !== undefined) {
            updates.push('linked_initiative_id = ?');
            params.push(initiativeId);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No link specified' });
        }
        
        updates.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);
        
        await dbRun(`UPDATE studio_documents SET ${updates.join(', ')} WHERE id = ?`, params);
        
        const updated = await dbGet('SELECT * FROM studio_documents WHERE id = ?', [id]);
        
        res.json({
            ...updated,
            nodes: JSON.parse(updated.nodes_json || '[]'),
            edges: JSON.parse(updated.edges_json || '[]')
        });
    } catch (err) {
        console.error('[Studio] Error linking document:', err);
        res.status(500).json({ error: 'Failed to link document' });
    }
});

module.exports = router;

