const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const ReportService = {
    /**
     * Get or create a draft report for a project
     */
    getReport: (projectId) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM reports WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`;
            db.get(sql, [projectId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                // Get blocks
                const blockSql = `SELECT * FROM report_blocks WHERE report_id = ? ORDER BY position ASC`;
                db.all(blockSql, [row.id], (err, blocks) => {
                    if (err) return reject(err);

                    row.blocks = {};
                    blocks.forEach(b => {
                        row.blocks[b.id] = {
                            ...b,
                            content: JSON.parse(b.content || '{}'),
                            meta: JSON.parse(b.meta || '{}'),
                            editable: !!b.editable,
                            aiRegeneratable: !!b.ai_regeneratable,
                            locked: !!b.locked
                        };
                    });

                    row.blockOrder = JSON.parse(row.block_order || '[]');
                    row.sources = JSON.parse(row.sources || '[]');

                    resolve(row);
                });
            });
        });
    },

    /**
     * Create a new draft report
     */
    createDraft: (projectId, organizationId, title, sources = []) => {
        return new Promise((resolve, reject) => {
            const reportId = uuidv4();
            const sql = `
                INSERT INTO reports (id, project_id, organization_id, title, status, version, block_order, sources)
                VALUES (?, ?, ?, ?, 'draft', 1, '[]', ?)
            `;

            db.run(sql, [reportId, projectId, organizationId, title, JSON.stringify(sources)], function (err) {
                if (err) return reject(err);
                resolve({ id: reportId, status: 'draft' });
            });
        });
    },

    /**
     * Add a block to a report
     */
    addBlock: (reportId, blockData) => {
        return new Promise((resolve, reject) => {
            const blockId = uuidv4();
            const { type, title, module, content, position, meta } = blockData;

            const sql = `
                INSERT INTO report_blocks (id, report_id, type, title, module, content, meta, position)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.run(sql, [
                blockId,
                reportId,
                type,
                title,
                module,
                JSON.stringify(content || {}),
                JSON.stringify(meta || {}),
                position
            ], function (err) {
                if (err) return reject(err);

                // Update report block_order
                ReportService._updateBlockOrder(reportId)
                    .then(() => resolve({ id: blockId }))
                    .catch(reject);
            });
        });
    },

    /**
     * Update a block
     */
    updateBlock: (reportId, blockId, updates) => {
        return new Promise((resolve, reject) => {
            const allowedFields = ['content', 'meta', 'locked', 'title', 'position'];
            const fields = [];
            const values = [];

            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key)) {
                    fields.push(`${key} = ?`);
                    let val = updates[key];
                    if (key === 'content' || key === 'meta') val = JSON.stringify(val);
                    values.push(val);
                }
            });

            if (fields.length === 0) return resolve();

            values.push(blockId);
            values.push(reportId);

            const sql = `UPDATE report_blocks SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND report_id = ?`;

            db.run(sql, values, function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    },

    /**
     * Update block order for the report
     */
    reorderBlocks: (reportId, blockOrder) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE reports SET block_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            db.run(sql, [JSON.stringify(blockOrder), reportId], function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    },

    /**
     * Regenerate block content (Mock AI)
     */
    regenerateBlock: (reportId, blockId, instructions) => {
        return new Promise((resolve, reject) => {
            // Mock AI delay
            setTimeout(() => {
                const sql = `SELECT * FROM report_blocks WHERE id = ? AND report_id = ?`;
                db.get(sql, [blockId, reportId], (err, block) => {
                    if (err) return reject(err);
                    if (!block) return reject(new Error('Block not found'));

                    let content = JSON.parse(block.content || '{}');

                    // Simple Mock Logic
                    if (block.type === 'text') {
                        content.text = (content.text || '') + "\n\n[AI Refined]: " + (instructions || "Better version of the text.");
                    } else if (block.type === 'callout') {
                        content.text = "AI Updated Warning: " + (instructions || "Pay attention to this.");
                    }

                    // Update
                    const updateSql = `UPDATE report_blocks SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
                    db.run(updateSql, [JSON.stringify(content), blockId], (err) => {
                        if (err) return reject(err);
                        resolve({ ...block, content });
                    });
                });
            }, 1000);
        });
    },

    /**
     * Helper to sync block_order in parent report
     */
    _updateBlockOrder: (reportId) => {
        return new Promise((resolve, reject) => {
            const sql = `SELECT id FROM report_blocks WHERE report_id = ? ORDER BY position ASC`;
            db.all(sql, [reportId], (err, rows) => {
                if (err) return reject(err);
                const order = rows.map(r => r.id);
                const updateSql = `UPDATE reports SET block_order = ? WHERE id = ?`;
                db.run(updateSql, [JSON.stringify(order), reportId], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    }
};

module.exports = ReportService;
