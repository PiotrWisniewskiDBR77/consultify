/**
 * Support Ticket Service
 * Manages support tickets and comments
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const SupportTicketService = {
    /**
     * Generate unique ticket number
     */
    generateTicketNumber: () => {
        const prefix = 'TKT';
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${timestamp}-${random}`;
    },

    /**
     * Create a support ticket
     */
    createTicket: (ticketData) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            const ticketNumber = this.generateTicketNumber();
            
            db.run(
                `INSERT INTO support_tickets 
                 (id, organization_id, user_id, ticket_number, subject, description, priority, category, tags_json, metadata_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    ticketData.organizationId,
                    ticketData.userId || null,
                    ticketNumber,
                    ticketData.subject,
                    ticketData.description,
                    ticketData.priority || 'medium',
                    ticketData.category || null,
                    JSON.stringify(ticketData.tags || []),
                    JSON.stringify(ticketData.metadata || {})
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, ticketNumber, ...ticketData });
                }
            );
        });
    },

    /**
     * Get tickets with filters
     */
    getTickets: (filters = {}) => {
        return new Promise((resolve, reject) => {
            let query = `SELECT t.*, 
                        u.email as user_email, u.first_name, u.last_name,
                        a.email as assigned_email, a.first_name as assigned_first_name, a.last_name as assigned_last_name
                        FROM support_tickets t
                        LEFT JOIN users u ON t.user_id = u.id
                        LEFT JOIN users a ON t.assigned_to = a.id
                        WHERE 1=1`;
            const params = [];

            if (filters.organizationId) {
                query += ' AND t.organization_id = ?';
                params.push(filters.organizationId);
            }
            if (filters.userId) {
                query += ' AND t.user_id = ?';
                params.push(filters.userId);
            }
            if (filters.status) {
                query += ' AND t.status = ?';
                params.push(filters.status);
            }
            if (filters.priority) {
                query += ' AND t.priority = ?';
                params.push(filters.priority);
            }
            if (filters.assignedTo) {
                query += ' AND t.assigned_to = ?';
                params.push(filters.assignedTo);
            }

            query += ' ORDER BY t.created_at DESC LIMIT ?';
            params.push(filters.limit || 50);

            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Get ticket by ID
     */
    getTicket: (ticketId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT t.*, 
                 u.email as user_email, u.first_name, u.last_name,
                 a.email as assigned_email, a.first_name as assigned_first_name, a.last_name as assigned_last_name
                 FROM support_tickets t
                 LEFT JOIN users u ON t.user_id = u.id
                 LEFT JOIN users a ON t.assigned_to = a.id
                 WHERE t.id = ?`,
                [ticketId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Update ticket
     */
    updateTicket: (ticketId, updates) => {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];

            if (updates.status) {
                fields.push('status = ?');
                values.push(updates.status);
                if (updates.status === 'resolved' && !updates.resolvedAt) {
                    fields.push('resolved_at = datetime("now")');
                }
                if (updates.status === 'closed' && !updates.closedAt) {
                    fields.push('closed_at = datetime("now")');
                }
            }
            if (updates.priority) {
                fields.push('priority = ?');
                values.push(updates.priority);
            }
            if (updates.assignedTo !== undefined) {
                fields.push('assigned_to = ?');
                values.push(updates.assignedTo);
            }
            if (updates.tags) {
                fields.push('tags_json = ?');
                values.push(JSON.stringify(updates.tags));
            }
            if (updates.metadata) {
                fields.push('metadata_json = ?');
                values.push(JSON.stringify(updates.metadata));
            }

            if (fields.length === 0) {
                return resolve({ updated: false });
            }

            fields.push('updated_at = datetime("now")');
            values.push(ticketId);

            db.run(
                `UPDATE support_tickets SET ${fields.join(', ')} WHERE id = ?`,
                values,
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Add comment to ticket
     */
    addComment: (ticketId, userId, commentText, isInternal = false, attachments = []) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            
            // Update first_response_at if this is the first comment from support
            db.run(
                `INSERT INTO support_ticket_comments 
                 (id, ticket_id, user_id, comment_text, is_internal, attachments_json)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, ticketId, userId, commentText, isInternal ? 1 : 0, JSON.stringify(attachments)],
                function (err) {
                    if (err) return reject(err);
                    
                    // Update first_response_at if needed
                    if (!isInternal) {
                        db.run(
                            `UPDATE support_tickets 
                             SET first_response_at = COALESCE(first_response_at, datetime('now'))
                             WHERE id = ? AND first_response_at IS NULL`,
                            [ticketId]
                        );
                    }
                    
                    resolve({ id, ticketId, userId, commentText, isInternal });
                }
            );
        });
    },

    /**
     * Get comments for a ticket
     */
    getComments: (ticketId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT c.*, u.email, u.first_name, u.last_name
                 FROM support_ticket_comments c
                 INNER JOIN users u ON c.user_id = u.id
                 WHERE c.ticket_id = ?
                 ORDER BY c.created_at ASC`,
                [ticketId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
};

module.exports = SupportTicketService;





