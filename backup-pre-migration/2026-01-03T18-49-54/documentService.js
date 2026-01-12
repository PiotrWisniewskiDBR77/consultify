/**
 * Document Service
 * Handles document library operations with project/user scope separation
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class DocumentService {
    /**
     * Upload a document
     */
    static async uploadDocument(file, {
        organizationId,
        projectId = null,
        ownerId,
        scope = 'user',
        description = null,
        tags = []
    }) {
        const id = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO documents (
                    id, organization_id, project_id, owner_id, scope,
                    filename, original_name, file_type, file_size, mime_type,
                    filepath, description, tags, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
                [
                    id,
                    organizationId,
                    scope === 'project' ? projectId : null,
                    ownerId,
                    scope,
                    file.filename,
                    file.originalname,
                    path.extname(file.originalname).toLowerCase().replace('.', ''),
                    file.size,
                    file.mimetype,
                    file.path,
                    description,
                    JSON.stringify(tags),
                    now,
                    now
                ],
                function (err) {
                    if (err) {
                        console.error('[DocumentService] Upload error:', err);
                        reject(err);
                        return;
                    }

                    resolve({
                        id,
                        organizationId,
                        projectId: scope === 'project' ? projectId : null,
                        ownerId,
                        scope,
                        filename: file.filename,
                        originalName: file.originalname,
                        fileType: path.extname(file.originalname).toLowerCase().replace('.', ''),
                        fileSize: file.size,
                        mimeType: file.mimetype,
                        filepath: file.path,
                        description,
                        tags,
                        status: 'active',
                        createdAt: now,
                        updatedAt: now
                    });
                }
            );
        });
    }

    /**
     * Get project documents (visible to all project members)
     */
    static async getProjectDocuments(projectId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM documents 
                 WHERE project_id = ? AND scope = 'project' AND status = 'active'
                 ORDER BY created_at DESC`,
                [projectId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(rows?.map(this.mapRow) || []);
                }
            );
        });
    }

    /**
     * Get user's private documents
     */
    static async getUserDocuments(ownerId, organizationId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM documents 
                 WHERE owner_id = ? AND organization_id = ? AND scope = 'user' AND status = 'active'
                 ORDER BY created_at DESC`,
                [ownerId, organizationId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(rows?.map(this.mapRow) || []);
                }
            );
        });
    }

    /**
     * Get all documents accessible to a user (their private + project documents)
     */
    static async getAccessibleDocuments(userId, organizationId, projectId = null) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT * FROM documents 
                WHERE organization_id = ? AND status = 'active'
                AND (
                    (scope = 'user' AND owner_id = ?)
                    ${projectId ? `OR (scope = 'project' AND project_id = ?)` : ''}
                )
                ORDER BY created_at DESC
            `;

            const params = projectId
                ? [organizationId, userId, projectId]
                : [organizationId, userId];

            db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows?.map(this.mapRow) || []);
            });
        });
    }

    /**
     * Move a private document to project scope
     */
    static async moveToProject(documentId, projectId, userId) {
        return new Promise((resolve, reject) => {
            // First verify ownership
            db.get(
                `SELECT * FROM documents WHERE id = ? AND owner_id = ? AND scope = 'user'`,
                [documentId, userId],
                (err, doc) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (!doc) {
                        reject(new Error('Document not found or not owned by user'));
                        return;
                    }

                    // Update scope
                    const now = new Date().toISOString();
                    db.run(
                        `UPDATE documents SET scope = 'project', project_id = ?, updated_at = ? WHERE id = ?`,
                        [projectId, now, documentId],
                        function (err) {
                            if (err) {
                                reject(err);
                                return;
                            }
                            resolve({
                                ...DocumentService.mapRow(doc),
                                scope: 'project',
                                projectId,
                                updatedAt: now
                            });
                        }
                    );
                }
            );
        });
    }

    /**
     * Get document by ID
     */
    static async getDocumentById(documentId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM documents WHERE id = ?`,
                [documentId],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(row ? this.mapRow(row) : null);
                }
            );
        });
    }

    /**
     * Delete (soft) a document
     */
    static async deleteDocument(documentId, userId) {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            db.run(
                `UPDATE documents SET status = 'deleted', updated_at = ? 
                 WHERE id = ? AND (owner_id = ? OR scope = 'project')`,
                [now, documentId, userId],
                function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ success: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Map database row to API response format
     */
    static mapRow(row) {
        if (!row) return null;
        return {
            id: row.id,
            organizationId: row.organization_id,
            projectId: row.project_id,
            ownerId: row.owner_id,
            scope: row.scope,
            filename: row.filename,
            originalName: row.original_name,
            fileType: row.file_type,
            fileSize: row.file_size,
            mimeType: row.mime_type,
            filepath: row.filepath,
            description: row.description,
            tags: row.tags ? JSON.parse(row.tags) : [],
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

module.exports = DocumentService;
