/**
 * Prompt Version Service
 * 
 * Manages AI prompt versions with:
 * - Version control
 * - Activation/rollback
 * - Performance metrics
 * - A/B testing support
 * 
 * Usage:
 * const prompt = await PromptVersionService.getActivePrompt('system.diagnosis');
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const AuditService = require('./auditService');

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Default prompts (fallback if no versioned prompt exists)
const DEFAULT_PROMPTS = {
    'system.base': 'You are a helpful AI assistant for strategic change management.',
    'system.diagnosis': 'Analyze the organization\'s current state and identify key challenges.',
    'system.recommendations': 'Based on the analysis, provide actionable recommendations.',
    'role.advisor': 'Act as a strategic advisor, providing guidance without taking direct action.',
    'role.manager': 'Act as a project manager, helping organize and track work.',
    'role.operator': 'Act as an autonomous agent, executing approved actions.',
};

const PromptVersionService = {
    /**
     * Create a new prompt version
     * @param {Object} options 
     */
    async createVersion(options) {
        const {
            promptKey,
            content,
            description = null,
            createdBy = null,
            tags = [],
            metadata = {},
        } = options;

        // Get next version number
        const latest = await dbGet(
            `SELECT MAX(version) as maxVersion FROM prompt_versions WHERE prompt_key = ?`,
            [promptKey]
        );

        const version = (latest?.maxVersion || 0) + 1;
        const id = uuidv4();

        await dbRun(
            `INSERT INTO prompt_versions 
             (id, prompt_key, version, content, description, created_by, tags, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, promptKey, version, content, description, createdBy, JSON.stringify(tags), JSON.stringify(metadata)]
        );

        // Audit
        AuditService.logSystemEvent('PROMPT_VERSION_CREATED', 'prompt_version', id, null, {
            promptKey,
            version,
        });

        return { id, promptKey, version };
    },

    /**
     * Get active prompt for a key
     * @param {string} promptKey 
     * @returns {Promise<{content: string, version: number, id: string} | null>}
     */
    async getActivePrompt(promptKey) {
        const prompt = await dbGet(
            `SELECT id, content, version FROM prompt_versions 
             WHERE prompt_key = ? AND is_active = 1 AND is_archived = 0`,
            [promptKey]
        );

        if (prompt) {
            return {
                id: prompt.id,
                content: prompt.content,
                version: prompt.version,
            };
        }

        // Return default if available
        if (DEFAULT_PROMPTS[promptKey]) {
            return {
                id: null,
                content: DEFAULT_PROMPTS[promptKey],
                version: 0,
                isDefault: true,
            };
        }

        return null;
    },

    /**
     * Activate a specific version
     * @param {string} promptKey 
     * @param {number} version 
     * @param {string} activatedBy - user_id
     */
    async activateVersion(promptKey, version, activatedBy = null) {
        // Deactivate current active version
        await dbRun(
            `UPDATE prompt_versions SET is_active = 0, deactivated_at = datetime('now')
             WHERE prompt_key = ? AND is_active = 1`,
            [promptKey]
        );

        // Activate specified version
        const result = await dbRun(
            `UPDATE prompt_versions SET is_active = 1, activated_at = datetime('now')
             WHERE prompt_key = ? AND version = ?`,
            [promptKey, version]
        );

        if (result.changes === 0) {
            throw new Error(`Version ${version} not found for prompt ${promptKey}`);
        }

        // Audit
        AuditService.logSystemEvent('PROMPT_VERSION_ACTIVATED', 'prompt_version', promptKey, null, {
            version,
            activatedBy,
        });

        return { success: true };
    },

    /**
     * Rollback to a previous version
     * @param {string} promptKey 
     * @param {number} version 
     * @param {string} reason 
     */
    async rollbackToVersion(promptKey, version, reason, rolledBackBy = null) {
        // Get current active version for logging
        const current = await dbGet(
            `SELECT version FROM prompt_versions WHERE prompt_key = ? AND is_active = 1`,
            [promptKey]
        );

        await this.activateVersion(promptKey, version, rolledBackBy);

        // Audit with rollback context
        AuditService.logSystemEvent('PROMPT_VERSION_ROLLBACK', 'prompt_version', promptKey, null, {
            fromVersion: current?.version,
            toVersion: version,
            reason,
            rolledBackBy,
        });

        return { success: true, previousVersion: current?.version };
    },

    /**
     * Get version history for a prompt
     * @param {string} promptKey 
     */
    async getVersionHistory(promptKey) {
        const versions = await dbAll(
            `SELECT id, version, description, is_active, created_at, activated_at, 
                    total_uses, success_count, avg_quality_score
             FROM prompt_versions 
             WHERE prompt_key = ? AND is_archived = 0
             ORDER BY version DESC`,
            [promptKey]
        );

        return versions.map(v => ({
            ...v,
            successRate: v.total_uses > 0 ? (v.success_count / v.total_uses * 100).toFixed(1) : null,
        }));
    },

    /**
     * Get version content (for diff comparison)
     * @param {string} promptKey 
     * @param {number} version 
     */
    async getVersionContent(promptKey, version) {
        const prompt = await dbGet(
            `SELECT id, content, description, created_at, created_by, tags, metadata
             FROM prompt_versions 
             WHERE prompt_key = ? AND version = ?`,
            [promptKey, version]
        );

        if (!prompt) return null;

        return {
            ...prompt,
            tags: JSON.parse(prompt.tags || '[]'),
            metadata: JSON.parse(prompt.metadata || '{}'),
        };
    },

    /**
     * Compare two versions
     * @param {string} promptKey 
     * @param {number} version1 
     * @param {number} version2 
     */
    async compareVersions(promptKey, version1, version2) {
        const [v1, v2] = await Promise.all([
            this.getVersionContent(promptKey, version1),
            this.getVersionContent(promptKey, version2),
        ]);

        if (!v1 || !v2) {
            throw new Error('One or both versions not found');
        }

        return {
            version1: v1,
            version2: v2,
            diff: this._generateDiff(v1.content, v2.content),
        };
    },

    /**
     * Record prompt usage (called by AI service)
     * @param {Object} usage 
     */
    async recordUsage(usage) {
        const {
            promptVersionId,
            promptKey,
            version,
            userId,
            organizationId,
            action,
            correlationId,
            tokensUsed,
            latencyMs,
            success = true,
            errorMessage = null,
        } = usage;

        // Log usage
        await dbRun(
            `INSERT INTO prompt_usage_log 
             (id, prompt_version_id, prompt_key, version, user_id, organization_id, action, 
              correlation_id, tokens_used, latency_ms, success, error_message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuidv4(), promptVersionId, promptKey, version, userId, organizationId,
                action, correlationId, tokensUsed, latencyMs, success ? 1 : 0, errorMessage
            ]
        );

        // Update aggregate metrics
        if (promptVersionId) {
            await dbRun(
                `UPDATE prompt_versions SET 
                    total_uses = total_uses + 1,
                    success_count = success_count + ?,
                    failure_count = failure_count + ?,
                    avg_tokens_used = COALESCE((avg_tokens_used * total_uses + ?) / (total_uses + 1), ?),
                    avg_latency_ms = COALESCE((avg_latency_ms * total_uses + ?) / (total_uses + 1), ?)
                 WHERE id = ?`,
                [
                    success ? 1 : 0, success ? 0 : 1,
                    tokensUsed, tokensUsed,
                    latencyMs, latencyMs,
                    promptVersionId
                ]
            );
        }
    },

    /**
     * Get performance metrics for a prompt
     * @param {string} promptKey 
     */
    async getMetrics(promptKey) {
        const versions = await dbAll(
            `SELECT version, is_active, total_uses, success_count, failure_count,
                    avg_tokens_used, avg_latency_ms, avg_quality_score
             FROM prompt_versions 
             WHERE prompt_key = ? AND total_uses > 0
             ORDER BY version DESC`,
            [promptKey]
        );

        return versions.map(v => ({
            version: v.version,
            isActive: !!v.is_active,
            totalUses: v.total_uses,
            successRate: ((v.success_count / v.total_uses) * 100).toFixed(1),
            avgTokens: Math.round(v.avg_tokens_used || 0),
            avgLatencyMs: Math.round(v.avg_latency_ms || 0),
            qualityScore: v.avg_quality_score?.toFixed(2) || null,
        }));
    },

    /**
     * List all prompt keys
     */
    async listPromptKeys() {
        const prompts = await dbAll(
            `SELECT DISTINCT prompt_key, 
                    MAX(version) as latestVersion,
                    MAX(CASE WHEN is_active = 1 THEN version END) as activeVersion
             FROM prompt_versions 
             WHERE is_archived = 0
             GROUP BY prompt_key
             ORDER BY prompt_key`
        );

        // Include defaults not in DB
        const keys = new Set(prompts.map(p => p.prompt_key));
        for (const key of Object.keys(DEFAULT_PROMPTS)) {
            if (!keys.has(key)) {
                prompts.push({
                    prompt_key: key,
                    latestVersion: 0,
                    activeVersion: 0,
                    isDefault: true,
                });
            }
        }

        return prompts;
    },

    /**
     * Archive a version (soft delete)
     * @param {string} promptKey 
     * @param {number} version 
     */
    async archiveVersion(promptKey, version) {
        // Can't archive active version
        const prompt = await dbGet(
            `SELECT is_active FROM prompt_versions WHERE prompt_key = ? AND version = ?`,
            [promptKey, version]
        );

        if (prompt?.is_active) {
            throw new Error('Cannot archive active version. Activate another version first.');
        }

        await dbRun(
            `UPDATE prompt_versions SET is_archived = 1 WHERE prompt_key = ? AND version = ?`,
            [promptKey, version]
        );

        return { success: true };
    },

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    _generateDiff(content1, content2) {
        // Simple line-by-line diff
        const lines1 = content1.split('\n');
        const lines2 = content2.split('\n');

        const diff = [];
        const maxLines = Math.max(lines1.length, lines2.length);

        for (let i = 0; i < maxLines; i++) {
            if (lines1[i] !== lines2[i]) {
                if (lines1[i] && !lines2[i]) {
                    diff.push({ type: 'removed', line: i + 1, content: lines1[i] });
                } else if (!lines1[i] && lines2[i]) {
                    diff.push({ type: 'added', line: i + 1, content: lines2[i] });
                } else {
                    diff.push({ type: 'changed', line: i + 1, from: lines1[i], to: lines2[i] });
                }
            }
        }

        return diff;
    },
};

module.exports = PromptVersionService;
