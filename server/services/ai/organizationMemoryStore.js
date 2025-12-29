/**
 * Organization Memory Store (Layer 3)
 * 
 * Stores organization-wide patterns and learnings with vector embeddings
 * for semantic search. Includes:
 * - Success/failure patterns from past projects
 * - Best practices and standards
 * - Templates and benchmarks
 * - AI-generated insights
 */

const db = require('../../database');
const { v4: uuidv4 } = require('uuid');
const { embeddingService } = require('./embeddingService');
const { aiLogger } = require('./logger');

// Memory types for organization-level patterns
const ORG_MEMORY_TYPES = {
    SUCCESS_PATTERN: { weight: 1.2, minApplicability: 0.7 },
    FAILURE_PATTERN: { weight: 1.1, minApplicability: 0.6 },
    BEST_PRACTICE: { weight: 1.0, minApplicability: 0.8 },
    LESSON_LEARNED: { weight: 0.9, minApplicability: 0.5 },
    BENCHMARK: { weight: 0.8, minApplicability: 0.9 },
    TEMPLATE: { weight: 0.7, minApplicability: 0.9 },
    STANDARD: { weight: 1.0, minApplicability: 0.95 },
    AI_INSIGHT: { weight: 0.6, minApplicability: 0.4 }
};

class OrganizationMemoryStore {
    constructor() {
        this.isPg = process.env.DB_TYPE === 'postgres';
        this.ensureTable();
    }

    /**
     * Ensure the organization_memory table exists
     */
    async ensureTable() {
        return new Promise((resolve) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS organization_memory (
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    memory_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    content TEXT NOT NULL,
                    embedding TEXT,
                    source_project_id TEXT,
                    source_assessment_id TEXT,
                    applicability_score REAL DEFAULT 1.0,
                    usage_count INTEGER DEFAULT 0,
                    last_used_at TEXT,
                    tags TEXT,
                    industry TEXT,
                    company_size TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_by TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                )
            `, (err) => {
                if (err) aiLogger.warn('OrgMemoryStore', `Table creation: ${err.message}`);
                resolve();
            });
        });
    }

    /**
     * Add a pattern to organization memory
     * @param {string} organizationId - Organization ID
     * @param {Object} pattern - Pattern data
     */
    async addPattern(organizationId, pattern) {
        const {
            type,
            title,
            description,
            content,
            sourceProjectId,
            sourceAssessmentId,
            applicabilityScore = 1.0,
            tags = [],
            industry,
            companySize,
            createdBy
        } = pattern;

        const id = uuidv4();

        // Generate embedding for semantic search
        let embedding = null;
        try {
            const textToEmbed = `${title}. ${description}. ${JSON.stringify(content)}`.substring(0, 8000);
            embedding = await embeddingService.generateEmbedding(textToEmbed);
        } catch (error) {
            aiLogger.warn('OrgMemoryStore', `Embedding generation failed: ${error.message}`);
        }

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organization_memory 
                 (id, organization_id, memory_type, title, description, content, embedding, 
                  source_project_id, source_assessment_id, applicability_score, tags, 
                  industry, company_size, created_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [
                    id,
                    organizationId,
                    type,
                    title,
                    description,
                    typeof content === 'string' ? content : JSON.stringify(content),
                    embedding ? JSON.stringify(embedding) : null,
                    sourceProjectId,
                    sourceAssessmentId,
                    applicabilityScore,
                    JSON.stringify(tags),
                    industry,
                    companySize,
                    createdBy
                ],
                function(err) {
                    if (err) {
                        aiLogger.error('OrgMemoryStore', `addPattern error: ${err.message}`);
                        reject(err);
                    } else {
                        aiLogger.info('OrgMemoryStore', `Added pattern ${id} to org ${organizationId}`);
                        resolve({ id, organizationId, type, title });
                    }
                }
            );
        });
    }

    /**
     * Add a success pattern from a completed project
     * @param {string} organizationId - Organization ID
     * @param {Object} successData - Success pattern data
     */
    async addSuccessPattern(organizationId, successData) {
        const { projectId, title, description, keyFactors, metrics, recommendations, createdBy } = successData;

        return this.addPattern(organizationId, {
            type: 'SUCCESS_PATTERN',
            title: title || 'Project Success Pattern',
            description,
            content: {
                keyFactors: keyFactors || [],
                metrics: metrics || {},
                recommendations: recommendations || [],
                extractedAt: new Date().toISOString()
            },
            sourceProjectId: projectId,
            applicabilityScore: 0.8,
            tags: ['success', 'pattern'],
            createdBy
        });
    }

    /**
     * Add a best practice
     * @param {string} organizationId - Organization ID
     * @param {Object} practiceData - Best practice data
     */
    async addBestPractice(organizationId, practiceData) {
        const { title, description, steps, benefits, applicableContexts, industry, createdBy } = practiceData;

        return this.addPattern(organizationId, {
            type: 'BEST_PRACTICE',
            title,
            description,
            content: {
                steps: steps || [],
                benefits: benefits || [],
                applicableContexts: applicableContexts || [],
                validatedAt: new Date().toISOString()
            },
            applicabilityScore: 0.9,
            tags: ['best-practice'],
            industry,
            createdBy
        });
    }

    /**
     * Search patterns using semantic similarity
     * @param {string} organizationId - Organization ID
     * @param {string} query - Search query
     * @param {Object} options - Search options
     */
    async searchPatterns(organizationId, query, options = {}) {
        const {
            types,
            limit = 10,
            minSimilarity = 0.5,
            industry,
            includeInactive = false
        } = options;

        // If no query, return recent patterns
        if (!query || query.trim().length === 0) {
            return this.getRecentPatterns(organizationId, { types, limit });
        }

        try {
            // Generate query embedding
            const queryEmbedding = await embeddingService.generateEmbedding(query);

            if (this.isPg) {
                return this._searchPg(organizationId, queryEmbedding, options);
            } else {
                return this._searchSqlite(organizationId, queryEmbedding, options);
            }
        } catch (error) {
            aiLogger.error('OrgMemoryStore', `Search error: ${error.message}`);
            // Fallback to keyword search
            return this._keywordSearch(organizationId, query, options);
        }
    }

    /**
     * SQLite semantic search (cosine similarity in JS)
     * @private
     */
    async _searchSqlite(organizationId, queryEmbedding, options) {
        const { types, limit = 10, minSimilarity = 0.5, includeInactive = false } = options;

        return new Promise((resolve, reject) => {
            let sql = `SELECT * FROM organization_memory WHERE organization_id = ?`;
            const params = [organizationId];

            if (!includeInactive) {
                sql += ` AND is_active = 1`;
            }

            if (types && types.length > 0) {
                sql += ` AND memory_type IN (${types.map(() => '?').join(',')})`;
                params.push(...types);
            }

            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!rows || rows.length === 0) {
                    resolve([]);
                    return;
                }

                // Compute cosine similarity for each row
                const results = rows
                    .map(row => {
                        const embedding = this._parseJSON(row.embedding);
                        if (!embedding || embedding.length === 0) {
                            return { ...row, similarity: 0 };
                        }
                        const similarity = this._cosineSimilarity(queryEmbedding, embedding);
                        return {
                            ...row,
                            similarity,
                            content: this._parseJSON(row.content),
                            tags: this._parseJSON(row.tags) || []
                        };
                    })
                    .filter(r => r.similarity >= minSimilarity)
                    .sort((a, b) => {
                        // Weight by type importance
                        const weightA = ORG_MEMORY_TYPES[a.memory_type]?.weight || 1;
                        const weightB = ORG_MEMORY_TYPES[b.memory_type]?.weight || 1;
                        return (b.similarity * weightB) - (a.similarity * weightA);
                    })
                    .slice(0, limit);

                // Update usage counts
                this._updateUsageCounts(results.map(r => r.id));

                resolve(results);
            });
        });
    }

    /**
     * PostgreSQL semantic search (pgvector)
     * @private
     */
    async _searchPg(organizationId, queryEmbedding, options) {
        const { types, limit = 10, minSimilarity = 0.5, includeInactive = false } = options;

        const vectorLiteral = `[${queryEmbedding.join(',')}]`;

        let sql = `
            SELECT *,
                   1 - (embedding <=> $1::vector) as similarity
            FROM organization_memory
            WHERE organization_id = $2
            AND 1 - (embedding <=> $1::vector) > $3
        `;
        const params = [vectorLiteral, organizationId, minSimilarity];
        let paramIndex = 4;

        if (!includeInactive) {
            sql += ` AND is_active = true`;
        }

        if (types && types.length > 0) {
            sql += ` AND memory_type IN (${types.map((_, i) => `$${paramIndex + i}`).join(',')})`;
            params.push(...types);
            paramIndex += types.length;
        }

        sql += ` ORDER BY embedding <=> $1::vector LIMIT $${paramIndex}`;
        params.push(limit);

        return new Promise((resolve, reject) => {
            db.query(sql, params, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }

                const rows = (result.rows || []).map(row => ({
                    ...row,
                    content: this._parseJSON(row.content),
                    tags: this._parseJSON(row.tags) || []
                }));

                // Update usage counts
                this._updateUsageCounts(rows.map(r => r.id));

                resolve(rows);
            });
        });
    }

    /**
     * Keyword-based search fallback
     * @private
     */
    async _keywordSearch(organizationId, query, options) {
        const { types, limit = 10, includeInactive = false } = options;
        const searchTerm = `%${query.toLowerCase()}%`;

        return new Promise((resolve, reject) => {
            let sql = `
                SELECT * FROM organization_memory 
                WHERE organization_id = ?
                AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags) LIKE ?)
            `;
            const params = [organizationId, searchTerm, searchTerm, searchTerm];

            if (!includeInactive) {
                sql += ` AND is_active = 1`;
            }

            if (types && types.length > 0) {
                sql += ` AND memory_type IN (${types.map(() => '?').join(',')})`;
                params.push(...types);
            }

            sql += ` ORDER BY usage_count DESC, created_at DESC LIMIT ?`;
            params.push(limit);

            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve((rows || []).map(row => ({
                    ...row,
                    similarity: 0.5, // Default similarity for keyword matches
                    content: this._parseJSON(row.content),
                    tags: this._parseJSON(row.tags) || []
                })));
            });
        });
    }

    /**
     * Get recent patterns without search
     */
    async getRecentPatterns(organizationId, options = {}) {
        const { types, limit = 10 } = options;

        return new Promise((resolve, reject) => {
            let sql = `
                SELECT * FROM organization_memory 
                WHERE organization_id = ? AND is_active = 1
            `;
            const params = [organizationId];

            if (types && types.length > 0) {
                sql += ` AND memory_type IN (${types.map(() => '?').join(',')})`;
                params.push(...types);
            }

            sql += ` ORDER BY usage_count DESC, created_at DESC LIMIT ?`;
            params.push(limit);

            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve((rows || []).map(row => ({
                    ...row,
                    content: this._parseJSON(row.content),
                    tags: this._parseJSON(row.tags) || []
                })));
            });
        });
    }

    /**
     * Extract patterns from a completed project using AI
     * @param {string} organizationId - Organization ID
     * @param {Object} projectData - Completed project data
     */
    async extractPatternsFromProject(organizationId, projectData) {
        const { LLMService } = require('./llmService');
        const { ModelRouter } = require('./modelRouter');

        const llmService = new LLMService();
        const modelRouter = new ModelRouter();

        try {
            // Get model for pattern extraction
            const modelConfig = await modelRouter.getProviderConfig('gpt-4o-mini', 'STANDARD');

            // Create prompt for pattern extraction
            const prompt = `Analyze this completed project and extract reusable patterns:

Project: ${projectData.name}
Industry: ${projectData.industry || 'Unknown'}
Duration: ${projectData.duration || 'Unknown'}
Outcomes: ${JSON.stringify(projectData.outcomes || {})}
Key Decisions: ${JSON.stringify(projectData.decisions || [])}
Lessons Learned: ${JSON.stringify(projectData.learnings || [])}

Extract:
1. 2-3 success patterns (what worked well)
2. 1-2 failure patterns (what to avoid)
3. Key best practices

Return JSON:
{
  "successPatterns": [{ "title": "...", "description": "...", "keyFactors": [...] }],
  "failurePatterns": [{ "title": "...", "description": "...", "warning": "..." }],
  "bestPractices": [{ "title": "...", "description": "...", "steps": [...] }]
}`;

            const response = await llmService.call({
                type: 'chat',
                modelConfig,
                messages: [{ role: 'user', content: prompt }],
                stream: false
            });

            // Parse AI response
            const patterns = this._parseJSON(response.content);
            
            if (!patterns) {
                aiLogger.warn('OrgMemoryStore', 'Could not parse pattern extraction response');
                return { extracted: 0 };
            }

            // Store extracted patterns
            let extractedCount = 0;

            for (const pattern of (patterns.successPatterns || [])) {
                await this.addSuccessPattern(organizationId, {
                    projectId: projectData.id,
                    ...pattern,
                    createdBy: 'ai'
                });
                extractedCount++;
            }

            for (const pattern of (patterns.failurePatterns || [])) {
                await this.addPattern(organizationId, {
                    type: 'FAILURE_PATTERN',
                    ...pattern,
                    content: { warning: pattern.warning },
                    sourceProjectId: projectData.id,
                    applicabilityScore: 0.7,
                    tags: ['failure', 'warning'],
                    createdBy: 'ai'
                });
                extractedCount++;
            }

            for (const practice of (patterns.bestPractices || [])) {
                await this.addBestPractice(organizationId, {
                    ...practice,
                    industry: projectData.industry,
                    createdBy: 'ai'
                });
                extractedCount++;
            }

            aiLogger.info('OrgMemoryStore', `Extracted ${extractedCount} patterns from project ${projectData.id}`);
            return { extracted: extractedCount };

        } catch (error) {
            aiLogger.error('OrgMemoryStore', `Pattern extraction failed: ${error.message}`);
            return { extracted: 0, error: error.message };
        }
    }

    /**
     * Update usage count for accessed patterns
     * @private
     */
    async _updateUsageCounts(ids) {
        if (!ids || ids.length === 0) return;

        const placeholders = ids.map(() => '?').join(',');
        
        db.run(
            `UPDATE organization_memory 
             SET usage_count = usage_count + 1,
                 last_used_at = datetime('now')
             WHERE id IN (${placeholders})`,
            ids,
            (err) => {
                if (err) aiLogger.warn('OrgMemoryStore', `Usage update failed: ${err.message}`);
            }
        );
    }

    /**
     * Deactivate low-value patterns
     * @param {string} organizationId - Organization ID
     * @param {number} minUsage - Minimum usage count
     * @param {number} daysOld - Days since creation
     */
    async deactivateLowValuePatterns(organizationId, minUsage = 0, daysOld = 180) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE organization_memory 
                 SET is_active = 0, updated_at = datetime('now')
                 WHERE organization_id = ?
                 AND usage_count <= ?
                 AND created_at < datetime('now', '-' || ? || ' days')
                 AND memory_type NOT IN ('STANDARD', 'TEMPLATE')`,
                [organizationId, minUsage, daysOld],
                function(err) {
                    if (err) reject(err);
                    else resolve({ deactivated: this.changes });
                }
            );
        });
    }

    /**
     * Compute cosine similarity
     * @private
     */
    _cosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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
const organizationMemoryStore = new OrganizationMemoryStore();

module.exports = {
    OrganizationMemoryStore,
    organizationMemoryStore,
    ORG_MEMORY_TYPES
};

