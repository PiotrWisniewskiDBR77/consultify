/**
 * Project Memory Store (Layer 2)
 * 
 * Stores and retrieves project-specific context including:
 * - Decisions made during the project
 * - Phase transitions and learnings
 * - Risks and blockers
 * - AI recommendations and user feedback
 */

const db = require('../../database');
import { v4 as uuidv4 } from 'uuid';
const { aiLogger } = require('./logger');

// Memory types with importance defaults
const MEMORY_TYPES = {
    DECISION: { importance: 4, ttlDays: null }, // Permanent
    PHASE_TRANSITION: { importance: 5, ttlDays: null },
    LEARNING: { importance: 3, ttlDays: null },
    RISK: { importance: 4, ttlDays: 90 },
    MILESTONE: { importance: 4, ttlDays: null },
    BLOCKER: { importance: 5, ttlDays: 30 },
    AI_RECOMMENDATION: { importance: 2, ttlDays: 30 },
    USER_FEEDBACK: { importance: 3, ttlDays: 60 },
    CONTEXT_UPDATE: { importance: 1, ttlDays: 7 }
};

class ProjectMemoryStore {
    constructor() {
        this.ensureTable();
    }

    /**
     * Ensure the project_memory table exists
     */
    async ensureTable() {
        return new Promise((resolve) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS project_memory (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    memory_type TEXT NOT NULL,
                    content TEXT NOT NULL,
                    title TEXT,
                    importance INTEGER DEFAULT 1,
                    recorded_by TEXT,
                    tags TEXT,
                    related_entity_type TEXT,
                    related_entity_id TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                )
            `, (err) => {
                if (err) aiLogger.warn('ProjectMemoryStore', `Table creation: ${err.message}`);
                resolve();
            });
        });
    }

    /**
     * Add a memory entry to a project
     * @param {string} projectId - Project ID
     * @param {Object} memory - Memory data
     */
    async addMemory(projectId, memory) {
        const {
            type,
            content,
            title,
            importance,
            recordedBy,
            tags = [],
            relatedEntityType,
            relatedEntityId
        } = memory;

        const id = uuidv4();
        const typeConfig = MEMORY_TYPES[type] || { importance: 2 };
        const finalImportance = importance || typeConfig.importance;

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO project_memory 
                 (id, project_id, memory_type, content, title, importance, recorded_by, tags, related_entity_type, related_entity_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [
                    id,
                    projectId,
                    type,
                    typeof content === 'string' ? content : JSON.stringify(content),
                    title,
                    finalImportance,
                    recordedBy,
                    JSON.stringify(tags),
                    relatedEntityType,
                    relatedEntityId
                ],
                function(err) {
                    if (err) {
                        aiLogger.error('ProjectMemoryStore', `addMemory error: ${err.message}`);
                        reject(err);
                    } else {
                        aiLogger.debug('ProjectMemoryStore', `Added memory ${id} to project ${projectId}`);
                        resolve({ id, projectId, type, importance: finalImportance });
                    }
                }
            );
        });
    }

    /**
     * Record a decision made in the project
     * @param {string} projectId - Project ID
     * @param {Object} decision - Decision data
     */
    async recordDecision(projectId, decision) {
        const { title, outcome, rationale, alternatives, aiSuggested, recordedBy } = decision;
        
        return this.addMemory(projectId, {
            type: 'DECISION',
            title: title || 'Project Decision',
            content: {
                outcome,
                rationale,
                alternatives: alternatives || [],
                aiSuggested: aiSuggested || false,
                timestamp: new Date().toISOString()
            },
            importance: 4,
            recordedBy,
            tags: ['decision']
        });
    }

    /**
     * Record a phase transition
     * @param {string} projectId - Project ID
     * @param {Object} transition - Transition data
     */
    async recordPhaseTransition(projectId, transition) {
        const { fromPhase, toPhase, reason, recordedBy, keyLearnings } = transition;

        return this.addMemory(projectId, {
            type: 'PHASE_TRANSITION',
            title: `Phase Transition: ${fromPhase} → ${toPhase}`,
            content: {
                fromPhase,
                toPhase,
                reason,
                keyLearnings: keyLearnings || [],
                timestamp: new Date().toISOString()
            },
            importance: 5,
            recordedBy,
            tags: ['phase', 'transition']
        });
    }

    /**
     * Record a learning or insight
     * @param {string} projectId - Project ID
     * @param {Object} learning - Learning data
     */
    async recordLearning(projectId, learning) {
        const { title, description, category, applicableToFuture, recordedBy } = learning;

        return this.addMemory(projectId, {
            type: 'LEARNING',
            title,
            content: {
                description,
                category,
                applicableToFuture: applicableToFuture || false,
                timestamp: new Date().toISOString()
            },
            importance: 3,
            recordedBy,
            tags: ['learning', category].filter(Boolean)
        });
    }

    /**
     * Record an AI recommendation
     * @param {string} projectId - Project ID
     * @param {Object} recommendation - Recommendation data
     */
    async recordAIRecommendation(projectId, recommendation) {
        const { title, content, capability, modelUsed, accepted, userId } = recommendation;

        return this.addMemory(projectId, {
            type: 'AI_RECOMMENDATION',
            title: title || `AI Recommendation: ${capability}`,
            content: {
                recommendation: content,
                capability,
                modelUsed,
                accepted: accepted || null,
                timestamp: new Date().toISOString()
            },
            importance: 2,
            recordedBy: userId,
            tags: ['ai', capability]
        });
    }

    /**
     * Get all memory for a project
     * @param {string} projectId - Project ID
     * @param {Object} options - Query options
     */
    async getProjectMemory(projectId, options = {}) {
        const {
            types,
            minImportance = 1,
            limit = 50,
            offset = 0,
            orderBy = 'created_at',
            orderDir = 'DESC'
        } = options;

        let sql = `
            SELECT * FROM project_memory 
            WHERE project_id = ?
            AND importance >= ?
        `;
        const params = [projectId, minImportance];

        if (types && types.length > 0) {
            sql += ` AND memory_type IN (${types.map(() => '?').join(',')})`;
            params.push(...types);
        }

        sql += ` ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const memories = (rows || []).map(row => ({
                    ...row,
                    content: this._parseJSON(row.content),
                    tags: this._parseJSON(row.tags) || []
                }));

                resolve(memories);
            });
        });
    }

    /**
     * Get project context for AI (optimized for token usage)
     * @param {string} projectId - Project ID
     * @param {Object} options - Context options
     */
    async getProjectContext(projectId, options = {}) {
        const { maxTokens = 2000, focusTypes } = options;

        // Get high-importance memories first
        const memories = await this.getProjectMemory(projectId, {
            types: focusTypes,
            minImportance: 3,
            limit: 20,
            orderBy: 'importance',
            orderDir: 'DESC'
        });

        // Also get recent context updates
        const recentContext = await this.getProjectMemory(projectId, {
            types: ['CONTEXT_UPDATE'],
            limit: 5,
            orderBy: 'created_at',
            orderDir: 'DESC'
        });

        // Combine and serialize for AI context
        const allMemories = [...memories, ...recentContext];
        
        // Estimate token usage and truncate if needed
        const serialized = this._serializeForContext(allMemories, maxTokens);

        return {
            projectId,
            memoryCount: allMemories.length,
            context: serialized,
            types: [...new Set(allMemories.map(m => m.memory_type))]
        };
    }

    /**
     * Get decisions for a project
     * @param {string} projectId - Project ID
     */
    async getDecisions(projectId) {
        return this.getProjectMemory(projectId, {
            types: ['DECISION'],
            orderBy: 'created_at',
            orderDir: 'DESC'
        });
    }

    /**
     * Get learnings that can apply to future projects
     * @param {string} projectId - Project ID
     */
    async getApplicableLearnings(projectId) {
        const learnings = await this.getProjectMemory(projectId, {
            types: ['LEARNING', 'DECISION', 'PHASE_TRANSITION']
        });

        // Filter for learnings marked as applicable to future
        return learnings.filter(l => 
            l.content?.applicableToFuture || 
            l.importance >= 4
        );
    }

    /**
     * Search project memory by keyword
     * @param {string} projectId - Project ID
     * @param {string} query - Search query
     */
    async searchMemory(projectId, query) {
        const searchTerm = `%${query.toLowerCase()}%`;

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM project_memory 
                 WHERE project_id = ?
                 AND (LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(tags) LIKE ?)
                 ORDER BY importance DESC, created_at DESC
                 LIMIT 20`,
                [projectId, searchTerm, searchTerm, searchTerm],
                (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve((rows || []).map(row => ({
                        ...row,
                        content: this._parseJSON(row.content),
                        tags: this._parseJSON(row.tags) || []
                    })));
                }
            );
        });
    }

    /**
     * Update memory importance based on usage
     * @param {string} memoryId - Memory ID
     * @param {number} delta - Importance change (+1 or -1)
     */
    async updateImportance(memoryId, delta) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE project_memory 
                 SET importance = MIN(5, MAX(1, importance + ?)),
                     updated_at = datetime('now')
                 WHERE id = ?`,
                [delta, memoryId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Delete old, low-importance memories
     * @param {string} projectId - Project ID
     * @param {number} daysOld - Days threshold
     */
    async cleanupOldMemories(projectId, daysOld = 90) {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM project_memory 
                 WHERE project_id = ?
                 AND importance <= 2
                 AND created_at < datetime('now', '-' || ? || ' days')
                 AND memory_type NOT IN ('DECISION', 'PHASE_TRANSITION', 'MILESTONE')`,
                [projectId, daysOld],
                function(err) {
                    if (err) reject(err);
                    else resolve({ deleted: this.changes });
                }
            );
        });
    }

    /**
     * Serialize memories for AI context window
     * @private
     */
    _serializeForContext(memories, maxTokens) {
        // Rough token estimation: 1 token ≈ 4 chars
        const maxChars = maxTokens * 4;
        
        const serialized = memories.map(m => {
            const contentStr = typeof m.content === 'object' 
                ? JSON.stringify(m.content) 
                : m.content;
            
            return `[${m.memory_type}] ${m.title || ''}: ${contentStr.substring(0, 500)}`;
        });

        let result = '';
        for (const item of serialized) {
            if (result.length + item.length > maxChars) break;
            result += item + '\n\n';
        }

        return result.trim();
    }

    /**
     * Safely parse JSON
     * @private
     */
    _parseJSON(str) {
        if (!str) return null;
        if (typeof str === 'object') return str;
        try {
            return JSON.parse(str);
        } catch {
            return str;
        }
    }
}

// Singleton instance
const projectMemoryStore = new ProjectMemoryStore();

export default {
    ProjectMemoryStore,
    projectMemoryStore,
    MEMORY_TYPES
};








