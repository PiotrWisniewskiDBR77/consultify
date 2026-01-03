/**
 * AI Draft Service
 * 
 * Manages AI-generated drafts for the Draft-Review-Approve pattern.
 * Provides staging area for AI suggestions before user approval.
 */

const db = require('../../database');
import { v4 as uuidv4 } from 'uuid';
const { aiLogger } = require('./logger');

// Draft types and their default configurations
const DRAFT_TYPES = {
    INITIATIVE: { expiryHours: 48, requiresApproval: true },
    REPORT_SECTION: { expiryHours: 72, requiresApproval: true },
    TASK_BREAKDOWN: { expiryHours: 24, requiresApproval: true },
    RECOMMENDATION: { expiryHours: 24, requiresApproval: false },
    RISK_ANALYSIS: { expiryHours: 48, requiresApproval: true },
    FIELD_SUGGESTION: { expiryHours: 1, requiresApproval: false },
    PATTERN: { expiryHours: 168, requiresApproval: true }, // 7 days
    SUMMARY: { expiryHours: 24, requiresApproval: false }
};

class DraftService {
    constructor() {
        this.ensureTable();
    }

    /**
     * Ensure the ai_drafts table exists
     */
    async ensureTable() {
        return new Promise((resolve) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS ai_drafts (
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    project_id TEXT,
                    user_id TEXT NOT NULL,
                    draft_type TEXT NOT NULL,
                    target_entity_type TEXT,
                    target_entity_id TEXT,
                    target_field TEXT,
                    original_content TEXT,
                    suggested_content TEXT NOT NULL,
                    diff_data TEXT,
                    confidence_score REAL DEFAULT 0.8,
                    reasoning TEXT,
                    status TEXT DEFAULT 'PENDING',
                    reviewed_by TEXT,
                    reviewed_at TEXT,
                    review_notes TEXT,
                    model_used TEXT,
                    prompt_id TEXT,
                    tokens_used INTEGER,
                    expires_at TEXT,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            `, (err) => {
                if (err) aiLogger.warn('DraftService', `Table creation: ${err.message}`);
                resolve();
            });
        });
    }

    /**
     * Create a new draft
     * @param {Object} draftData - Draft data
     */
    async createDraft(draftData) {
        const {
            organizationId,
            projectId,
            userId,
            draftType,
            targetEntityType,
            targetEntityId,
            targetField,
            originalContent,
            suggestedContent,
            confidence = 0.8,
            reasoning,
            modelUsed,
            promptId,
            tokensUsed
        } = draftData;

        const id = uuidv4();
        const typeConfig = DRAFT_TYPES[draftType] || { expiryHours: 24 };
        
        // Calculate expiry time
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + typeConfig.expiryHours);

        // Generate diff data if original content provided
        const diffData = originalContent 
            ? this._generateDiff(originalContent, suggestedContent)
            : null;

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO ai_drafts 
                 (id, organization_id, project_id, user_id, draft_type, 
                  target_entity_type, target_entity_id, target_field,
                  original_content, suggested_content, diff_data,
                  confidence_score, reasoning, model_used, prompt_id, tokens_used,
                  expires_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    id,
                    organizationId,
                    projectId,
                    userId,
                    draftType,
                    targetEntityType,
                    targetEntityId,
                    targetField,
                    typeof originalContent === 'string' ? originalContent : JSON.stringify(originalContent),
                    typeof suggestedContent === 'string' ? suggestedContent : JSON.stringify(suggestedContent),
                    diffData ? JSON.stringify(diffData) : null,
                    confidence,
                    reasoning,
                    modelUsed,
                    promptId,
                    tokensUsed,
                    expiresAt.toISOString()
                ],
                function(err) {
                    if (err) {
                        aiLogger.error('DraftService', `createDraft error: ${err.message}`);
                        reject(err);
                    } else {
                        aiLogger.info('DraftService', `Created draft ${id} (${draftType})`);
                        resolve({ 
                            id, 
                            draftType, 
                            confidence, 
                            expiresAt: expiresAt.toISOString(),
                            requiresApproval: typeConfig.requiresApproval
                        });
                    }
                }
            );
        });
    }

    /**
     * Get a draft by ID
     * @param {string} draftId - Draft ID
     */
    async getDraft(draftId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM ai_drafts WHERE id = ?`,
                [draftId],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (!row) {
                        resolve(null);
                        return;
                    }
                    resolve(this._parseDraft(row));
                }
            );
        });
    }

    /**
     * Get pending drafts for a user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     */
    async getPendingDrafts(userId, options = {}) {
        const { organizationId, projectId, draftType, limit = 20 } = options;

        let sql = `
            SELECT * FROM ai_drafts 
            WHERE user_id = ? 
            AND status = 'PENDING'
            AND (expires_at IS NULL OR expires_at > datetime('now'))
        `;
        const params = [userId];

        if (organizationId) {
            sql += ` AND organization_id = ?`;
            params.push(organizationId);
        }

        if (projectId) {
            sql += ` AND project_id = ?`;
            params.push(projectId);
        }

        if (draftType) {
            sql += ` AND draft_type = ?`;
            params.push(draftType);
        }

        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve((rows || []).map(row => this._parseDraft(row)));
            });
        });
    }

    /**
     * Get drafts for a specific entity
     * @param {string} entityType - Entity type
     * @param {string} entityId - Entity ID
     */
    async getDraftsForEntity(entityType, entityId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM ai_drafts 
                 WHERE target_entity_type = ? 
                 AND target_entity_id = ?
                 AND status = 'PENDING'
                 ORDER BY created_at DESC`,
                [entityType, entityId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve((rows || []).map(row => this._parseDraft(row)));
                }
            );
        });
    }

    /**
     * Approve a draft
     * @param {string} draftId - Draft ID
     * @param {Object} approvalData - Approval data
     */
    async approveDraft(draftId, approvalData) {
        const { reviewedBy, notes, modifications } = approvalData;

        // If there are modifications, this is a "MODIFIED" approval
        const status = modifications ? 'MODIFIED' : 'APPROVED';

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE ai_drafts 
                 SET status = ?, 
                     reviewed_by = ?, 
                     reviewed_at = datetime('now'),
                     review_notes = ?,
                     suggested_content = COALESCE(?, suggested_content)
                 WHERE id = ?`,
                [
                    status,
                    reviewedBy,
                    notes,
                    modifications ? JSON.stringify(modifications) : null,
                    draftId
                ],
                function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        resolve({ success: false, reason: 'Draft not found' });
                    } else {
                        aiLogger.info('DraftService', `Draft ${draftId} ${status}`);
                        resolve({ success: true, status });
                    }
                }
            );
        });
    }

    /**
     * Reject a draft
     * @param {string} draftId - Draft ID
     * @param {Object} rejectionData - Rejection data
     */
    async rejectDraft(draftId, rejectionData) {
        const { reviewedBy, notes } = rejectionData;

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE ai_drafts 
                 SET status = 'REJECTED', 
                     reviewed_by = ?, 
                     reviewed_at = datetime('now'),
                     review_notes = ?
                 WHERE id = ?`,
                [reviewedBy, notes, draftId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else if (this.changes === 0) {
                        resolve({ success: false, reason: 'Draft not found' });
                    } else {
                        aiLogger.info('DraftService', `Draft ${draftId} REJECTED`);
                        resolve({ success: true, status: 'REJECTED' });
                    }
                }
            );
        });
    }

    /**
     * Expire old drafts
     */
    async expireOldDrafts() {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE ai_drafts 
                 SET status = 'EXPIRED'
                 WHERE status = 'PENDING'
                 AND expires_at < datetime('now')`,
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        if (this.changes > 0) {
                            aiLogger.info('DraftService', `Expired ${this.changes} drafts`);
                        }
                        resolve({ expired: this.changes });
                    }
                }
            );
        });
    }

    /**
     * Get draft statistics for a user
     * @param {string} userId - User ID
     */
    async getDraftStats(userId, organizationId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
                    SUM(CASE WHEN status = 'MODIFIED' THEN 1 ELSE 0 END) as modified,
                    AVG(confidence_score) as avg_confidence,
                    AVG(CASE WHEN status IN ('APPROVED', 'MODIFIED') 
                        THEN (julianday(reviewed_at) - julianday(created_at)) * 24 * 60 
                        ELSE NULL END) as avg_review_time_minutes
                 FROM ai_drafts 
                 WHERE user_id = ? AND organization_id = ?`,
                [userId, organizationId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row || { total: 0 });
                    }
                }
            );
        });
    }

    /**
     * Generate diff data between original and suggested content
     * @private
     */
    _generateDiff(original, suggested) {
        // Simple character-level diff indicator
        const origStr = typeof original === 'string' ? original : JSON.stringify(original);
        const suggStr = typeof suggested === 'string' ? suggested : JSON.stringify(suggested);

        // For now, just mark as having changes
        return {
            hasChanges: origStr !== suggStr,
            originalLength: origStr.length,
            suggestedLength: suggStr.length,
            changePercent: Math.round(Math.abs(suggStr.length - origStr.length) / Math.max(origStr.length, 1) * 100)
        };
    }

    /**
     * Parse a draft row from database
     * @private
     */
    _parseDraft(row) {
        return {
            ...row,
            suggestedContent: this._parseJSON(row.suggested_content),
            originalContent: this._parseJSON(row.original_content),
            diffData: this._parseJSON(row.diff_data),
            isExpired: row.expires_at && new Date(row.expires_at) < new Date(),
            typeConfig: DRAFT_TYPES[row.draft_type] || {}
        };
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
const draftService = new DraftService();

// Periodic cleanup of expired drafts
setInterval(() => {
    draftService.expireOldDrafts().catch(console.error);
}, 60 * 60 * 1000); // Every hour

export default {
    DraftService,
    draftService,
    DRAFT_TYPES
};








