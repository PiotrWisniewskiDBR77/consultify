// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
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
            deps.db.run("UPDATE knowledge_candidates SET status = ?, admin_comment = ? WHERE id = ?", [status, adminComment, id], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    },

    // --- 2. GLOBAL STRATEGY (Admin Direction) ---

    addStrategy: (title, description, createdBy = 'admin') => {
        return new Promise((resolve, reject) => {
            const id = deps.uuidv4();
            deps.db.run("INSERT INTO global_strategies (id, title, description, created_by) VALUES (?, ?, ?, ?)",
                [id, title, description, createdBy], function (err) {
                    if (err) reject(err);
                    else resolve(id);
                });
        });
    },

    getActiveStrategies: () => {
        return new Promise((resolve, reject) => {
            deps.db.all("SELECT * FROM global_strategies WHERE is_active = 1", (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
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

    addDocument: (filename, filepath, orgId, projectId, size) => {
        const id = uuidv4();
        return new Promise((resolve, reject) => {
            deps.db.run("INSERT INTO knowledge_docs (id, filename, filepath, organization_id, project_id, file_size_bytes, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
                [id, filename, filepath, orgId, projectId, size], function (err) {
                    if (err) reject(err);
                    else resolve(id);
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

module.exports = KnowledgeService;
