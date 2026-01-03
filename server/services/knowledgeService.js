// Dependency injection container (for deterministic unit tests)
import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';

const deps = {
    db,
    uuidv4,
};

const KnowledgeService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    // --- 1. IDEA COLLECTOR (Inbox) ---

    addCandidate: (content, reasoning, source, relatedAxis = null, originContext = '') => {
        return new Promise((resolve, reject) => {
            const id = deps.uuidv4();
            const sql = `INSERT INTO knowledge_candidates (id, content, reasoning, source, origin_context, related_axis) VALUES (?, ?, ?, ?, ?, ?)`;
            deps.db.run(sql, [id, content, reasoning, source, originContext, relatedAxis], function (err) {
                if (err) reject(err);
                else resolve(id);
            });
        });
    },

    getCandidates: (status = 'pending') => {
        return new Promise((resolve, reject) => {
            deps.db.all("SELECT * FROM knowledge_candidates WHERE status = ? ORDER BY created_at DESC", [status], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    updateCandidateStatus: (id, status, adminComment = '') => {
        return new Promise((resolve, reject) => {
            // Support new statuses: pending, approved, rejected, implemented, archived
            const validStatuses = ['pending', 'approved', 'rejected', 'implemented', 'archived'];
            if (!validStatuses.includes(status)) {
                return reject(new Error(`Invalid status: ${status}`));
            }
            deps.db.run("UPDATE knowledge_candidates SET status = ?, admin_comment = ? WHERE id = ?", [status, adminComment, id], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },

    updateCandidate: (id, updates) => {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];
            
            if (updates.category !== undefined) {
                fields.push('category = ?');
                values.push(updates.category);
            }
            if (updates.tags !== undefined) {
                fields.push('tags = ?');
                values.push(JSON.stringify(updates.tags));
            }
            if (updates.implementation_notes !== undefined) {
                fields.push('implementation_notes = ?');
                values.push(updates.implementation_notes);
            }
            if (updates.impact_score !== undefined) {
                fields.push('impact_score = ?');
                values.push(updates.impact_score);
            }
            if (updates.status !== undefined) {
                fields.push('status = ?');
                values.push(updates.status);
            }
            
            if (fields.length === 0) {
                return resolve(0);
            }
            
            values.push(id);
            const sql = `UPDATE knowledge_candidates SET ${fields.join(', ')} WHERE id = ?`;
            deps.db.run(sql, values, function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },

    linkIdeaToProject: (ideaId, projectId, notes = '') => {
        return new Promise((resolve, reject) => {
            deps.db.get("SELECT related_project_ids FROM knowledge_candidates WHERE id = ?", [ideaId], (err, idea) => {
                if (err) return reject(err);
                if (!idea) return reject(new Error('Idea not found'));
                
                try {
                    const projectIds = idea.related_project_ids ? JSON.parse(idea.related_project_ids) : [];
                    if (!projectIds.includes(projectId)) {
                        projectIds.push(projectId);
                    }
                    
                    const updateFields = ['related_project_ids = ?'];
                    const updateValues = [JSON.stringify(projectIds)];
                    
                    if (notes) {
                        updateFields.push('implementation_notes = ?');
                        updateValues.push(notes);
                    }
                    
                    // Update status to implemented if not already
                    if (idea.status === 'approved') {
                        updateFields.push('status = ?');
                        updateValues.push('implemented');
                    }
                    
                    updateValues.push(ideaId);
                    const sql = `UPDATE knowledge_candidates SET ${updateFields.join(', ')} WHERE id = ?`;
                    deps.db.run(sql, updateValues, function (err) {
                        if (err) reject(err);
                        else resolve(this.changes);
                    });
                } catch (e) {
                    reject(new Error('Failed to parse related_project_ids: ' + e.message));
                }
            });
        });
    },

    getApprovedIdeas: (filters = {}) => {
        return new Promise((resolve, reject) => {
            let sql = "SELECT * FROM knowledge_candidates WHERE status IN ('approved', 'implemented')";
            const params = [];
            
            if (filters.category) {
                sql += " AND category = ?";
                params.push(filters.category);
            }
            
            sql += " ORDER BY created_at DESC";
            
            deps.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else {
                    // Parse JSON fields
                    const parsed = (rows || []).map(row => ({
                        ...row,
                        tags: row.tags ? JSON.parse(row.tags) : [],
                        related_project_ids: row.related_project_ids ? JSON.parse(row.related_project_ids) : []
                    }));
                    resolve(parsed);
                }
            });
        });
    },

    getIdeasByCategory: (category) => {
        return new Promise((resolve, reject) => {
            deps.db.all("SELECT * FROM knowledge_candidates WHERE category = ? AND status IN ('approved', 'implemented') ORDER BY created_at DESC", 
                [category], (err, rows) => {
                    if (err) reject(err);
                    else {
                        const parsed = (rows || []).map(row => ({
                            ...row,
                            tags: row.tags ? JSON.parse(row.tags) : [],
                            related_project_ids: row.related_project_ids ? JSON.parse(row.related_project_ids) : []
                        }));
                        resolve(parsed);
                    }
                });
        });
    },

    getIdeasByProject: (projectId) => {
        return new Promise((resolve, reject) => {
            deps.db.all("SELECT * FROM knowledge_candidates WHERE related_project_ids LIKE ? ORDER BY created_at DESC", 
                [`%${projectId}%`], (err, rows) => {
                    if (err) reject(err);
                    else {
                        // Filter to ensure projectId is actually in the array
                        const filtered = (rows || []).filter(row => {
                            try {
                                const projectIds = row.related_project_ids ? JSON.parse(row.related_project_ids) : [];
                                return projectIds.includes(projectId);
                            } catch (e) {
                                return false;
                            }
                        }).map(row => ({
                            ...row,
                            tags: row.tags ? JSON.parse(row.tags) : [],
                            related_project_ids: row.related_project_ids ? JSON.parse(row.related_project_ids) : []
                        }));
                        resolve(filtered);
                    }
                });
        });
    },

    // --- 2. GLOBAL STRATEGY (Admin Direction) ---

    addStrategy: (title, description, createdBy = 'admin', options = {}) => {
        return new Promise((resolve, reject) => {
            const id = deps.uuidv4();
            const successMetrics = JSON.stringify(options.success_metrics || []);
            const priority = options.priority || 'medium';
            const targetDate = options.target_date || null;
            const progressPercentage = options.progress_percentage || 0;
            
            deps.db.run("INSERT INTO global_strategies (id, title, description, created_by, success_metrics, priority, target_date, progress_percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [id, title, description, createdBy, successMetrics, priority, targetDate, progressPercentage], function (err) {
                    if (err) reject(err);
                    else resolve(id);
                });
        });
    },

    updateStrategy: (id, updates) => {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];
            
            if (updates.title !== undefined) {
                fields.push('title = ?');
                values.push(updates.title);
            }
            if (updates.description !== undefined) {
                fields.push('description = ?');
                values.push(updates.description);
            }
            if (updates.success_metrics !== undefined) {
                fields.push('success_metrics = ?');
                values.push(JSON.stringify(updates.success_metrics));
            }
            if (updates.priority !== undefined) {
                fields.push('priority = ?');
                values.push(updates.priority);
            }
            if (updates.target_date !== undefined) {
                fields.push('target_date = ?');
                values.push(updates.target_date);
            }
            if (updates.progress_percentage !== undefined) {
                fields.push('progress_percentage = ?');
                values.push(updates.progress_percentage);
            }
            if (updates.is_active !== undefined) {
                fields.push('is_active = ?');
                values.push(updates.is_active ? 1 : 0);
            }
            
            if (fields.length === 0) {
                return resolve(0);
            }
            
            values.push(id);
            const sql = `UPDATE global_strategies SET ${fields.join(', ')} WHERE id = ?`;
            deps.db.run(sql, values, function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },

    linkStrategyToDocument: (strategyId, docId) => {
        return new Promise((resolve, reject) => {
            deps.db.get("SELECT related_document_ids FROM global_strategies WHERE id = ?", [strategyId], (err, strategy) => {
                if (err) return reject(err);
                if (!strategy) return reject(new Error('Strategy not found'));
                
                try {
                    const docIds = strategy.related_document_ids ? JSON.parse(strategy.related_document_ids) : [];
                    if (!docIds.includes(docId)) {
                        docIds.push(docId);
                    }
                    
                    deps.db.run("UPDATE global_strategies SET related_document_ids = ? WHERE id = ?", 
                        [JSON.stringify(docIds), strategyId], function (err) {
                            if (err) reject(err);
                            else resolve(this.changes);
                        });
                } catch (e) {
                    reject(new Error('Failed to parse related_document_ids: ' + e.message));
                }
            });
        });
    },

    linkStrategyToIdea: (strategyId, ideaId) => {
        return new Promise((resolve, reject) => {
            deps.db.get("SELECT related_idea_ids FROM global_strategies WHERE id = ?", [strategyId], (err, strategy) => {
                if (err) return reject(err);
                if (!strategy) return reject(new Error('Strategy not found'));
                
                try {
                    const ideaIds = strategy.related_idea_ids ? JSON.parse(strategy.related_idea_ids) : [];
                    if (!ideaIds.includes(ideaId)) {
                        ideaIds.push(ideaId);
                    }
                    
                    deps.db.run("UPDATE global_strategies SET related_idea_ids = ? WHERE id = ?", 
                        [JSON.stringify(ideaIds), strategyId], function (err) {
                            if (err) reject(err);
                            else resolve(this.changes);
                        });
                } catch (e) {
                    reject(new Error('Failed to parse related_idea_ids: ' + e.message));
                }
            });
        });
    },

    unlinkStrategyFromDocument: (strategyId, docId) => {
        return new Promise((resolve, reject) => {
            deps.db.get("SELECT related_document_ids FROM global_strategies WHERE id = ?", [strategyId], (err, strategy) => {
                if (err) return reject(err);
                if (!strategy) return reject(new Error('Strategy not found'));
                
                try {
                    const docIds = strategy.related_document_ids ? JSON.parse(strategy.related_document_ids) : [];
                    const filtered = docIds.filter(id => id !== docId);
                    
                    deps.db.run("UPDATE global_strategies SET related_document_ids = ? WHERE id = ?", 
                        [JSON.stringify(filtered), strategyId], function (err) {
                            if (err) reject(err);
                            else resolve(this.changes);
                        });
                } catch (e) {
                    reject(new Error('Failed to parse related_document_ids: ' + e.message));
                }
            });
        });
    },

    unlinkStrategyFromIdea: (strategyId, ideaId) => {
        return new Promise((resolve, reject) => {
            deps.db.get("SELECT related_idea_ids FROM global_strategies WHERE id = ?", [strategyId], (err, strategy) => {
                if (err) return reject(err);
                if (!strategy) return reject(new Error('Strategy not found'));
                
                try {
                    const ideaIds = strategy.related_idea_ids ? JSON.parse(strategy.related_idea_ids) : [];
                    const filtered = ideaIds.filter(id => id !== ideaId);
                    
                    deps.db.run("UPDATE global_strategies SET related_idea_ids = ? WHERE id = ?", 
                        [JSON.stringify(filtered), strategyId], function (err) {
                            if (err) reject(err);
                            else resolve(this.changes);
                        });
                } catch (e) {
                    reject(new Error('Failed to parse related_idea_ids: ' + e.message));
                }
            });
        });
    },

    updateStrategyProgress: (strategyId, percentage) => {
        return new Promise((resolve, reject) => {
            if (percentage < 0 || percentage > 100) {
                return reject(new Error('Progress percentage must be between 0 and 100'));
            }
            deps.db.run("UPDATE global_strategies SET progress_percentage = ? WHERE id = ?", 
                [percentage, strategyId], function (err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                });
        });
    },

    getStrategyWithRelated: (strategyId) => {
        return new Promise((resolve, reject) => {
            deps.db.get("SELECT * FROM global_strategies WHERE id = ?", [strategyId], async (err, strategy) => {
                if (err) return reject(err);
                if (!strategy) return resolve(null);
                
                try {
                    const docIds = strategy.related_document_ids ? JSON.parse(strategy.related_document_ids) : [];
                    const ideaIds = strategy.related_idea_ids ? JSON.parse(strategy.related_idea_ids) : [];
                    const successMetrics = strategy.success_metrics ? JSON.parse(strategy.success_metrics) : [];
                    
                    // Fetch related documents
                    let documents = [];
                    if (docIds.length > 0) {
                        const placeholders = docIds.map(() => '?').join(',');
                        documents = await new Promise((resolve, reject) => {
                            deps.db.all(`SELECT * FROM knowledge_docs WHERE id IN (${placeholders}) AND deleted_at IS NULL`, 
                                docIds, (err, rows) => {
                                    if (err) reject(err);
                                    else resolve(rows || []);
                                });
                        });
                    }
                    
                    // Fetch related ideas
                    let ideas = [];
                    if (ideaIds.length > 0) {
                        const placeholders = ideaIds.map(() => '?').join(',');
                        ideas = await new Promise((resolve, reject) => {
                            deps.db.all(`SELECT * FROM knowledge_candidates WHERE id IN (${placeholders})`, 
                                ideaIds, (err, rows) => {
                                    if (err) reject(err);
                                    else resolve(rows || []);
                                });
                        });
                    }
                    
                    resolve({
                        ...strategy,
                        success_metrics: successMetrics,
                        related_documents: documents,
                        related_ideas: ideas.map(idea => ({
                            ...idea,
                            tags: idea.tags ? JSON.parse(idea.tags) : [],
                            related_project_ids: idea.related_project_ids ? JSON.parse(idea.related_project_ids) : []
                        }))
                    });
                } catch (e) {
                    reject(new Error('Failed to parse strategy data: ' + e.message));
                }
            });
        });
    },

    getActiveStrategies: () => {
        return new Promise((resolve, reject) => {
            deps.db.all("SELECT * FROM global_strategies WHERE is_active = 1 ORDER BY priority DESC, created_at DESC", (err, rows) => {
                if (err) reject(err);
                else {
                    // Parse JSON fields
                    const parsed = (rows || []).map(row => ({
                        ...row,
                        success_metrics: row.success_metrics ? JSON.parse(row.success_metrics) : [],
                        related_document_ids: row.related_document_ids ? JSON.parse(row.related_document_ids) : [],
                        related_idea_ids: row.related_idea_ids ? JSON.parse(row.related_idea_ids) : [],
                        related_initiative_ids: row.related_initiative_ids ? JSON.parse(row.related_initiative_ids) : []
                    }));
                    resolve(parsed);
                }
            });
        });
    },

    getAllStrategies: () => {
        return new Promise((resolve, reject) => {
            deps.db.all("SELECT * FROM global_strategies ORDER BY priority DESC, created_at DESC", (err, rows) => {
                if (err) reject(err);
                else {
                    // Parse JSON fields
                    const parsed = (rows || []).map(row => ({
                        ...row,
                        success_metrics: row.success_metrics ? JSON.parse(row.success_metrics) : [],
                        related_document_ids: row.related_document_ids ? JSON.parse(row.related_document_ids) : [],
                        related_idea_ids: row.related_idea_ids ? JSON.parse(row.related_idea_ids) : [],
                        related_initiative_ids: row.related_initiative_ids ? JSON.parse(row.related_initiative_ids) : []
                    }));
                    resolve(parsed);
                }
            });
        });
    },

    toggleStrategy: (id, isActive) => {
        return new Promise((resolve, reject) => {
            deps.db.run("UPDATE global_strategies SET is_active = ? WHERE id = ?", [isActive ? 1 : 0, id], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },

    // --- 3. CLIENT CONTEXT (Memory) ---

    setClientContext: (orgId, key, value, source = 'inferred', confidence = 1.0) => {
        return new Promise((resolve, reject) => {
            const id = deps.uuidv4();
            const valStr = typeof value === 'object' ? JSON.stringify(value) : value;

            // Upsert logic (delete then insert, or check exists)
            // SQLite upsert: INSERT INTO ... ON CONFLICT(organization_id, key) DO UPDATE... (requires unique index)
            // For now, let's just check if exists
            deps.db.get("SELECT id FROM client_context WHERE organization_id = ? AND key = ?", [orgId, key], (err, row) => {
                if (row) {
                    deps.                    deps.db.run("UPDATE client_context SET value = ?, source = ?, confidence = ? WHERE id = ?",
                        [valStr, source, confidence, row.id], (err) => {
                            if (err) return reject(err);
                            resolve(row.id);
                        });
                } else {
                    deps.db.run("INSERT INTO client_context (id, organization_id, key, value, source, confidence) VALUES (?, ?, ?, ?, ?, ?)",
                        [id, orgId, key, valStr, source, confidence], (err) => err ? reject(err) : resolve(id));
                }
            });
        });
    },

    getClientContext: (orgId) => {
        return new Promise((resolve, reject) => {
            deps.db.all("SELECT * FROM client_context WHERE organization_id = ?", [orgId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    // --- 4. KNOWLEDGE DOCUMENTS (RAG) ---

    addDocument: (filename, filepath, orgId, projectId, size, category = null, tags = []) => {
        const id = deps.uuidv4();
        const tagsJson = JSON.stringify(tags || []);
        // Force project_id = NULL for global knowledge docs
        const globalProjectId = null;
        return new Promise((resolve, reject) => {
            deps.db.run("INSERT INTO knowledge_docs (id, filename, filepath, organization_id, project_id, file_size_bytes, status, category, tags) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
                [id, filename, filepath, orgId, globalProjectId, size, category, tagsJson], function (err) {
                    if (err) reject(err);
                    else resolve(id);
                });
        });
    },

    updateDocument: (docId, updates) => {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];
            
            if (updates.category !== undefined) {
                fields.push('category = ?');
                values.push(updates.category);
            }
            if (updates.tags !== undefined) {
                fields.push('tags = ?');
                values.push(JSON.stringify(updates.tags));
            }
            if (updates.version !== undefined) {
                fields.push('version = ?');
                values.push(updates.version);
            }
            if (updates.parent_doc_id !== undefined) {
                fields.push('parent_doc_id = ?');
                values.push(updates.parent_doc_id);
            }
            
            if (fields.length === 0) {
                return resolve(0);
            }
            
            values.push(docId);
            const sql = `UPDATE knowledge_docs SET ${fields.join(', ')} WHERE id = ?`;
            deps.db.run(sql, values, function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },

    getDocumentsByCategory: (orgId, category) => {
        return new Promise((resolve, reject) => {
            deps.db.all("SELECT * FROM knowledge_docs WHERE organization_id = ? AND category = ? AND deleted_at IS NULL ORDER BY created_at DESC", 
                [orgId, category], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });
    },

    getDocumentsByStrategy: (strategyId) => {
        return new Promise((resolve, reject) => {
            deps.db.get("SELECT related_document_ids FROM global_strategies WHERE id = ?", [strategyId], (err, strategy) => {
                if (err) return reject(err);
                if (!strategy || !strategy.related_document_ids) return resolve([]);
                
                try {
                    const docIds = JSON.parse(strategy.related_document_ids);
                    if (docIds.length === 0) return resolve([]);
                    
                    const placeholders = docIds.map(() => '?').join(',');
                    deps.db.all(`SELECT * FROM knowledge_docs WHERE id IN (${placeholders}) AND deleted_at IS NULL ORDER BY created_at DESC`, 
                        docIds, (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows || []);
                        });
                } catch (e) {
                    resolve([]);
                }
            });
        });
    },

    getDocuments: (orgId, userId = null, userRole = 'USER') => {
        return new Promise((resolve, reject) => {
            // If superadmin or org admin, return all
            const isAdmin = ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(userRole.toUpperCase());

            let sql = "";
            let params = [];

            if (isAdmin || !userId) {
                // Admin can see all files in org
                sql = orgId
                    ? "SELECT * FROM knowledge_docs WHERE organization_id = ? AND deleted_at IS NULL ORDER BY created_at DESC"
                    : "SELECT * FROM knowledge_docs WHERE deleted_at IS NULL ORDER BY created_at DESC";
                params = orgId ? [orgId] : [];
            } else {
                // Regular user: Can see global docs (project_id IS NULL) OR docs in their projects
                sql = `
                    SELECT DISTINCT kd.* 
                    FROM knowledge_docs kd
                    LEFT JOIN project_users pu ON kd.project_id = pu.project_id AND pu.user_id = ?
                    WHERE kd.organization_id = ? 
                    AND kd.deleted_at IS NULL
                    AND (kd.project_id IS NULL OR pu.user_id IS NOT NULL)
                    ORDER BY kd.created_at DESC
                `;
                params = [userId, orgId];
            }

            deps.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    /**
     * Chunks text and generates embeddings.
     */
    processDocument: async (docId, text) => {
        const RagService = require('./ragService'); // Lazy load to avoid circular dep if any

        // 1. Chunking Strategy (Simple paragraph/length based)
        const CHUNK_SIZE = 1000;
        const chunks = [];
        let currentChunk = "";

        const lines = text.split('\n');
        for (const line of lines) {
            if ((currentChunk.length + line.length) > CHUNK_SIZE) {
                chunks.push(currentChunk);
                currentChunk = "";
            }
            currentChunk += line + "\n";
        }
        if (currentChunk.trim().length > 0) chunks.push(currentChunk);

        // 2. Clear existing chunks for this doc
        await new Promise((resolve) => deps.db.run("DELETE FROM knowledge_chunks WHERE doc_id = ?", [docId], resolve));

        // 3. Process Chunks
        let processedCount = 0;
        for (let i = 0; i < chunks.length; i++) {
            const content = chunks[i];
            const chunkId = uuidv4();

            // Generate Embedding
            const embedding = await RagService.generateEmbedding(content);
            const embeddingJson = embedding ? JSON.stringify(embedding) : null;

            await new Promise((resolve, reject) => {
                deps.db.run("INSERT INTO knowledge_chunks (id, doc_id, content, chunk_index, embedding) VALUES (?, ?, ?, ?, ?)",
                    [chunkId, docId, content, i, embeddingJson], (err) => {
                        if (err) console.error("Chunk insert error", err);
                        resolve();
                    });
            });
            processedCount++;
        }

        // 4. Update Doc Status
        return new Promise((resolve, reject) => {
            deps.db.run("UPDATE knowledge_docs SET status = 'indexed' WHERE id = ?", [docId], (err) => {
                if (err) reject(err);
                else resolve(processedCount);
            });
        });
    },

    // --- 5. LIFECYCLE MANAGEMENT ---

    deleteDocument: (docId, orgId) => {
        const StorageService = require('./storageService');
        const usageService = require('./usageService');

        return new Promise((resolve, reject) => {
            // 1. Get document info
            deps.db.get("SELECT * FROM knowledge_docs WHERE id = ?", [docId], async (err, doc) => {
                if (err) return reject(err);
                if (!doc) return resolve(false);

                try {
                    // 2. Soft Delete File (Move to trash)
                    if (doc.filepath) {
                        try {
                            await StorageService.softDeleteFile(doc.filepath, orgId);
                        } catch (e) {
                            console.warn("Storage soft delete failed or not implemented:", e.message);
                        }
                    }

                    // 3. Mark as Deleted in DB
                    const deletedAt = new Date().toISOString().replace('T', ' ').split('.')[0];

                    deps.db.run("UPDATE knowledge_docs SET deleted_at = ? WHERE id = ?", [deletedAt, docId], function (err) {
                        if (err) return reject(err);

                        if (this.changes === 0) {
                            return reject(new Error('Soft delete failed: No rows updated'));
                        }

                        // 4. Record negative storage usage (free up space)
                        if (doc.file_size_bytes > 0) {
                            usageService.recordStorageUsage(
                                orgId,
                                -doc.file_size_bytes,
                                'document_delete',
                                { filename: doc.filename }
                            ).catch(e => console.error('Failed to record storage release:', e));
                        }

                        resolve(true);
                    });
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

};

export default KnowledgeService;
