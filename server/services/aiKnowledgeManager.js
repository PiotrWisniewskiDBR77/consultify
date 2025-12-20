/**
 * AI Knowledge Manager
 * 
 * Orchestrates knowledge retrieval for AI with strict tenant/project/phase scoping.
 * Ensures internal knowledge is preferred over model knowledge.
 * Provides citation support for audit trails.
 */

const db = require('../database');
const RagService = require('./ragService');
const { v4: uuidv4 } = require('uuid');

// Knowledge types
const KNOWLEDGE_TYPES = {
    GENERAL: 'general',
    DECISION: 'decision',
    LESSON_LEARNED: 'lesson_learned',
    TEMPLATE: 'template',
    POLICY: 'policy'
};

// Visibility scopes
const VISIBILITY_SCOPES = {
    PROJECT: 'project',
    ORGANIZATION: 'organization'
};

const AIKnowledgeManager = {
    KNOWLEDGE_TYPES,
    VISIBILITY_SCOPES,

    // ==========================================
    // CONTEXTUAL KNOWLEDGE RETRIEVAL
    // ==========================================

    /**
     * Get contextual knowledge for AI prompt enrichment
     * Enforces strict scoping and returns with citations
     */
    getContextualKnowledge: async (context) => {
        const {
            organizationId,
            projectId,
            phase,
            query,
            userId,
            maxChunks = 5,
            minRelevance = 0.5
        } = context;

        // SECURITY: Organization ID is required
        if (!organizationId) {
            console.warn('[AIKnowledgeManager] No organization ID provided - returning empty');
            return { context: '', citations: [], scoped: false };
        }

        // Get RAG settings for project
        const settings = projectId
            ? await AIKnowledgeManager.getRAGSettings(projectId)
            : { rag_enabled: true, max_chunks_per_query: 5, min_relevance_score: 0.5 };

        if (!settings.rag_enabled) {
            return { context: '', citations: [], ragDisabled: true };
        }

        // Determine visibility scope
        const visibility = settings.knowledge_visibility || VISIBILITY_SCOPES.PROJECT;

        // Build scoped query
        const scopedResults = await AIKnowledgeManager._getScopedKnowledge({
            organizationId,
            projectId,
            phase,
            query,
            visibility,
            maxChunks: settings.max_chunks_per_query || maxChunks,
            minRelevance: settings.min_relevance_score || minRelevance
        });

        // Format for prompt injection
        const formattedContext = AIKnowledgeManager._formatKnowledgeForPrompt(
            scopedResults.chunks,
            settings.include_citations !== false
        );

        return {
            context: formattedContext,
            citations: scopedResults.citations,
            chunksUsed: scopedResults.chunks.length,
            scope: { organizationId, projectId, phase, visibility }
        };
    },

    /**
     * Internal: Get knowledge with strict scoping
     */
    _getScopedKnowledge: async ({ organizationId, projectId, phase, query, visibility, maxChunks, minRelevance }) => {
        return new Promise(async (resolve) => {
            // Build the base query with organization filter
            let sql = `
                SELECT c.id, c.content, c.embedding, d.id as doc_id, d.filename, d.phase, d.knowledge_type
                FROM knowledge_chunks c
                JOIN knowledge_docs d ON c.doc_id = d.id
                WHERE d.organization_id = ?
                AND d.status = 'indexed'
            `;
            const params = [organizationId];

            // Apply project scope if visibility is project-level
            if (visibility === VISIBILITY_SCOPES.PROJECT && projectId) {
                sql += ` AND (d.project_id = ? OR d.project_id IS NULL)`;
                params.push(projectId);
            }

            // Apply phase filter if specified
            if (phase) {
                sql += ` AND (d.phase = ? OR d.phase IS NULL)`;
                params.push(phase);
            }

            db.all(sql, params, async (err, rows) => {
                if (err || !rows || rows.length === 0) {
                    resolve({ chunks: [], citations: [] });
                    return;
                }

                // If we have embeddings, do vector search
                if (query) {
                    const queryEmbedding = await RagService.generateEmbedding(query);

                    if (queryEmbedding) {
                        // Calculate similarity scores
                        const scored = rows.map(row => {
                            let vec;
                            try {
                                vec = JSON.parse(row.embedding);
                            } catch (e) {
                                return { ...row, score: 0 };
                            }
                            return {
                                ...row,
                                score: AIKnowledgeManager._cosineSimilarity(queryEmbedding, vec)
                            };
                        });

                        // Filter and sort by relevance
                        const relevant = scored
                            .filter(c => c.score >= minRelevance)
                            .sort((a, b) => b.score - a.score)
                            .slice(0, maxChunks);

                        resolve({
                            chunks: relevant,
                            citations: relevant.map(c => ({
                                docId: c.doc_id,
                                filename: c.filename,
                                relevance: Math.round(c.score * 100),
                                phase: c.phase,
                                type: c.knowledge_type
                            }))
                        });
                        return;
                    }
                }

                // Fallback: Return most recent chunks
                const recent = rows.slice(0, maxChunks);
                resolve({
                    chunks: recent.map(c => ({ ...c, score: 0.5 })),
                    citations: recent.map(c => ({
                        docId: c.doc_id,
                        filename: c.filename,
                        relevance: 50,
                        phase: c.phase,
                        type: c.knowledge_type
                    }))
                });
            });
        });
    },

    /**
     * Calculate cosine similarity between two vectors
     */
    _cosineSimilarity: (vecA, vecB) => {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    },

    /**
     * Format knowledge chunks for prompt injection
     */
    _formatKnowledgeForPrompt: (chunks, includeCitations = true) => {
        if (!chunks || chunks.length === 0) return '';

        const formatted = chunks.map((chunk, idx) => {
            const citation = includeCitations
                ? `[Source ${idx + 1}: ${chunk.filename} (${Math.round(chunk.score * 100)}% relevance)]`
                : '';
            return `${citation}\n${chunk.content}`;
        });

        return `### INTERNAL KNOWLEDGE BASE (Priority Over Model Knowledge) ###\n\n${formatted.join('\n\n---\n\n')}`;
    },

    // ==========================================
    // RAG SETTINGS MANAGEMENT
    // ==========================================

    /**
     * Get RAG settings for a project
     */
    getRAGSettings: async (projectId) => {
        return new Promise((resolve) => {
            db.get(`SELECT * FROM project_rag_settings WHERE project_id = ?`, [projectId], (err, row) => {
                resolve(row || {
                    rag_enabled: true,
                    max_chunks_per_query: 5,
                    min_relevance_score: 0.5,
                    knowledge_visibility: 'project',
                    prefer_internal_knowledge: true,
                    include_citations: true
                });
            });
        });
    },

    /**
     * Update RAG settings for a project
     */
    updateRAGSettings: async (projectId, settings) => {
        const {
            ragEnabled,
            maxChunks,
            minRelevance,
            visibility,
            preferInternal,
            includeCitations
        } = settings;

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO project_rag_settings 
                (project_id, rag_enabled, max_chunks_per_query, min_relevance_score, 
                 knowledge_visibility, prefer_internal_knowledge, include_citations)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id) DO UPDATE SET
                    rag_enabled = COALESCE(?, rag_enabled),
                    max_chunks_per_query = COALESCE(?, max_chunks_per_query),
                    min_relevance_score = COALESCE(?, min_relevance_score),
                    knowledge_visibility = COALESCE(?, knowledge_visibility),
                    prefer_internal_knowledge = COALESCE(?, prefer_internal_knowledge),
                    include_citations = COALESCE(?, include_citations),
                    updated_at = CURRENT_TIMESTAMP
            `, [
                projectId,
                ragEnabled ? 1 : 0, maxChunks, minRelevance, visibility,
                preferInternal ? 1 : 0, includeCitations ? 1 : 0,
                ragEnabled !== undefined ? (ragEnabled ? 1 : 0) : null,
                maxChunks, minRelevance, visibility,
                preferInternal !== undefined ? (preferInternal ? 1 : 0) : null,
                includeCitations !== undefined ? (includeCitations ? 1 : 0) : null
            ], function (err) {
                if (err) reject(err);
                else resolve({ projectId, updated: true });
            });
        });
    },

    // ==========================================
    // KNOWLEDGE CLASSIFICATION
    // ==========================================

    /**
     * Update document metadata for better retrieval
     */
    classifyDocument: async (docId, { phase, knowledgeType }) => {
        return new Promise((resolve, reject) => {
            db.run(`
                UPDATE knowledge_docs 
                SET phase = COALESCE(?, phase),
                    knowledge_type = COALESCE(?, knowledge_type)
                WHERE id = ?
            `, [phase, knowledgeType, docId], function (err) {
                if (err) reject(err);
                else resolve({ docId, changes: this.changes });
            });
        });
    },

    /**
     * Get documents by type and scope
     */
    getDocumentsByType: async (organizationId, knowledgeType, projectId = null) => {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT * FROM knowledge_docs 
                WHERE organization_id = ? AND knowledge_type = ?
            `;
            const params = [organizationId, knowledgeType];

            if (projectId) {
                sql += ` AND (project_id = ? OR project_id IS NULL)`;
                params.push(projectId);
            }

            sql += ` ORDER BY created_at DESC`;

            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    // ==========================================
    // DECISION & LESSON LEARNED CAPTURE
    // ==========================================

    /**
     * Store a decision as knowledge for future reference
     */
    captureDecision: async ({ organizationId, projectId, title, rationale, outcome, phase, createdBy }) => {
        const docId = uuidv4();
        const content = `DECISION: ${title}\n\nRATIONALE:\n${rationale}\n\nOUTCOME: ${outcome}`;

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO knowledge_docs 
                (id, organization_id, project_id, filename, content, phase, knowledge_type, status)
                VALUES (?, ?, ?, ?, ?, ?, 'decision', 'indexed')
            `, [docId, organizationId, projectId, `Decision: ${title}`, content, phase], async function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                // Generate embedding and store chunk
                try {
                    await RagService.storeChunks(docId, [content]);
                } catch (e) {
                    console.warn('[AIKnowledgeManager] Failed to embed decision:', e);
                }

                resolve({ docId, captured: true });
            });
        });
    },

    /**
     * Store a lesson learned as knowledge
     */
    captureLessonLearned: async ({ organizationId, projectId, title, description, recommendations, phase, createdBy }) => {
        const docId = uuidv4();
        const content = `LESSON LEARNED: ${title}\n\nDESCRIPTION:\n${description}\n\nRECOMMENDATIONS:\n${recommendations}`;

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO knowledge_docs 
                (id, organization_id, project_id, filename, content, phase, knowledge_type, status)
                VALUES (?, ?, ?, ?, ?, ?, 'lesson_learned', 'indexed')
            `, [docId, organizationId, projectId, `Lesson: ${title}`, content, phase], async function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                // Generate embedding and store chunk
                try {
                    await RagService.storeChunks(docId, [content]);
                } catch (e) {
                    console.warn('[AIKnowledgeManager] Failed to embed lesson:', e);
                }

                resolve({ docId, captured: true });
            });
        });
    },

    // ==========================================
    // ACCESS VALIDATION
    // ==========================================

    /**
     * Validate user can access specific knowledge
     */
    validateAccess: async (userId, knowledgeDocId) => {
        return new Promise((resolve) => {
            db.get(`
                SELECT d.id, d.organization_id, d.project_id
                FROM knowledge_docs d
                JOIN users u ON u.organization_id = d.organization_id
                WHERE d.id = ? AND u.id = ?
            `, [knowledgeDocId, userId], (err, row) => {
                resolve(!!row);
            });
        });
    }
};

module.exports = AIKnowledgeManager;
