/**
 * Support Ticket Service
 * Manages support tickets and comments
 */

import { getDatabase } from '../src/database/Database.ts';
import { v4 as uuidv4 } from 'uuid';

// Dependency injection wrapper
const deps = {
    _db: null,
    get db() {
        if (!this._db) {
            this._db = getDatabase();
        }
        return this._db;
    },
    set db(val) {
        this._db = val;
    }
};

const SupportTicketService = {
    // Expose setDependencies for testing
    setDependencies(newDeps) {
        if (newDeps.db) deps.db = newDeps.db;
    },

    /**
     * Generate unique ticket number
     */
    generateTicketNumber() {
        const prefix = 'TKT';
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${timestamp}-${random}`;
    },

    /**
     * Create a support ticket
     */
    async createTicket(ticketData) {
        const id = uuidv4();
        // Fix: Use direct property access or just call it if part of 'this' context in proper object structure
        // Since we are inside an object method, 'this' refers to SupportTicketService
        const ticketNumber = this.generateTicketNumber();

        const sql = `INSERT INTO support_tickets 
                (id, organization_id, user_id, ticket_number, subject, description, priority, category, tags_json, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await deps.db.run(sql, [
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
        ]);

        return { id, ticketNumber, ...ticketData };
    },

    /**
     * Get tickets with filters
     */
    async getTickets(filters = {}) {
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

        const rows = await deps.db.all(query, params);
        return rows || [];
    },

    /**
     * Get ticket by ID
     */
    async getTicket(ticketId) {
        const sql = `SELECT t.*, 
                u.email as user_email, u.first_name, u.last_name,
                a.email as assigned_email, a.first_name as assigned_first_name, a.last_name as assigned_last_name
                FROM support_tickets t
                LEFT JOIN users u ON t.user_id = u.id
                LEFT JOIN users a ON t.assigned_to = a.id
                WHERE t.id = ?`;

        const row = await deps.db.get(sql, [ticketId]);
        return row || null;
    },

    /**
     * Update ticket
     */
    async updateTicket(ticketId, updates) {
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
            return { updated: false };
        }

        fields.push('updated_at = datetime("now")');
        values.push(ticketId);

        const sql = `UPDATE support_tickets SET ${fields.join(', ')} WHERE id = ?`;
        const result = await deps.db.run(sql, values);

        // Ensure result.changes is handled safely
        const changes = result ? (result.changes || 0) : 0;
        return { updated: changes > 0 };
    },

    /**
     * Add comment to ticket
     */
    async addComment(ticketId, userId, commentText, isInternal = false, attachments = []) {
        const id = uuidv4();

        // Insert comment
        await deps.db.run(
            `INSERT INTO support_ticket_comments 
                (id, ticket_id, user_id, comment_text, is_internal, attachments_json)
                VALUES (?, ?, ?, ?, ?, ?)`,
            [id, ticketId, userId, commentText, isInternal ? 1 : 0, JSON.stringify(attachments)]
        );

        // Update first_response_at if needed
        if (!isInternal) {
            await deps.db.run(
                `UPDATE support_tickets 
                    SET first_response_at = COALESCE(first_response_at, datetime('now'))
                    WHERE id = ? AND first_response_at IS NULL`,
                [ticketId]
            );
        }

        return { id, ticketId, userId, commentText, isInternal };
    },

    /**
     * Get comments for a ticket
     */
    async getComments(ticketId) {
        const sql = `SELECT c.*, u.email, u.first_name, u.last_name
                FROM support_ticket_comments c
                INNER JOIN users u ON c.user_id = u.id
                WHERE c.ticket_id = ?
                ORDER BY c.created_at ASC`;

        const rows = await deps.db.all(sql, [ticketId]);
        return rows || [];
    }
};

export default SupportTicketService;
