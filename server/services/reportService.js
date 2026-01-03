/**
 * Report Service
 * Handles saved reports, scheduled reports, and report execution for SuperAdmin Analytics
 */

const defaultDb = require('../database.sqlite.active').db;
const { v4: uuidv4 } = require('uuid');

class ReportService {
    constructor() {
        this.db = defaultDb;
    }

    /**
     * Inject dependencies for testing
     */
    setDependencies(deps) {
        if (deps.db) this.db = deps.db;
    }
    /**
     * Get all saved reports with optional filters
     */
    async getReports(filters = {}) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    r.*,
                    u.email as created_by_email,
                    (SELECT COUNT(*) FROM admin_report_executions WHERE report_id = r.id) as execution_count,
                    (SELECT MAX(executed_at) FROM admin_report_executions WHERE report_id = r.id) as last_executed_at
                FROM admin_saved_reports r
                LEFT JOIN users u ON r.created_by = u.id
                WHERE 1=1
            `;
            const params = [];

            if (filters.report_type) {
                query += ' AND r.report_type = ?';
                params.push(filters.report_type);
            }

            if (filters.created_by) {
                query += ' AND r.created_by = ?';
                params.push(filters.created_by);
            }

            if (filters.has_schedule) {
                query += ' AND r.schedule_json IS NOT NULL';
            }

            query += ' ORDER BY r.updated_at DESC';

            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
            }

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    /**
     * Get a single report by ID
     */
    async getReportById(reportId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT r.*, u.email as created_by_email
                 FROM admin_saved_reports r
                 LEFT JOIN users u ON r.created_by = u.id
                 WHERE r.id = ?`,
                [reportId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row || null);
                }
            );
        });
    }

    /**
     * Create a new saved report
     */
    async createReport(data, userId) {
        const id = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO admin_saved_reports 
                 (id, name, description, report_type, filters_json, columns_json, schedule_json, created_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    data.name,
                    data.description || null,
                    data.report_type,
                    JSON.stringify(data.filters || {}),
                    JSON.stringify(data.columns || []),
                    data.schedule ? JSON.stringify(data.schedule) : null,
                    userId,
                    now,
                    now
                ],
                function (err) {
                    if (err) reject(err);
                    else resolve({ id, ...data, created_at: now, updated_at: now });
                }
            );
        });
    }

    /**
     * Update an existing report
     */
    async updateReport(reportId, data) {
        const now = new Date().toISOString();
        const updates = [];
        const params = [];

        if (data.name !== undefined) {
            updates.push('name = ?');
            params.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push('description = ?');
            params.push(data.description);
        }
        if (data.report_type !== undefined) {
            updates.push('report_type = ?');
            params.push(data.report_type);
        }
        if (data.filters !== undefined) {
            updates.push('filters_json = ?');
            params.push(JSON.stringify(data.filters));
        }
        if (data.columns !== undefined) {
            updates.push('columns_json = ?');
            params.push(JSON.stringify(data.columns));
        }
        if (data.schedule !== undefined) {
            updates.push('schedule_json = ?');
            params.push(data.schedule ? JSON.stringify(data.schedule) : null);
        }

        updates.push('updated_at = ?');
        params.push(now);
        params.push(reportId);

        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE admin_saved_reports SET ${updates.join(', ')} WHERE id = ?`,
                params,
                function (err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                }
            );
        });
    }

    /**
     * Delete a report
     */
    async deleteReport(reportId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM admin_saved_reports WHERE id = ?',
                [reportId],
                function (err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                }
            );
        });
    }

    /**
     * Execute a report and store results
     */
    async executeReport(reportId) {
        const report = await this.getReportById(reportId);
        if (!report) {
            throw new Error('Report not found');
        }

        const executionId = uuidv4();
        const now = new Date().toISOString();

        // Create execution record
        await new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO admin_report_executions 
                 (id, report_id, status, executed_at, created_at)
                 VALUES (?, ?, 'running', ?, ?)`,
                [executionId, reportId, now, now],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        try {
            // Generate report data based on report type and filters
            const filters = JSON.parse(report.filters_json || '{}');
            const columns = JSON.parse(report.columns_json || '[]');
            const result = await this.generateReportData(report.report_type, filters, columns);

            // Update execution with results
            await new Promise((resolve, reject) => {
                this.db.run(
                    `UPDATE admin_report_executions 
                     SET status = 'completed', completed_at = ?, result_json = ?
                     WHERE id = ?`,
                    [new Date().toISOString(), JSON.stringify(result), executionId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            return { executionId, status: 'completed', result };
        } catch (error) {
            // Update execution with error
            await new Promise((resolve, reject) => {
                this.db.run(
                    `UPDATE admin_report_executions 
                     SET status = 'failed', completed_at = ?, error_message = ?
                     WHERE id = ?`,
                    [new Date().toISOString(), error.message, executionId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            throw error;
        }
    }

    /**
     * Generate report data based on type and filters
     */
    async generateReportData(reportType, filters, columns) {
        switch (reportType) {
            case 'users':
                return this.generateUsersReport(filters, columns);
            case 'organizations':
                return this.generateOrganizationsReport(filters, columns);
            case 'revenue':
                return this.generateRevenueReport(filters, columns);
            case 'activity':
                return this.generateActivityReport(filters, columns);
            case 'ai_usage':
                return this.generateAIUsageReport(filters, columns);
            default:
                return { error: 'Unknown report type', data: [] };
        }
    }

    async generateUsersReport(filters, columns) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    u.id, u.email, u.role, u.status, u.created_at,
                    o.name as organization_name
                FROM users u
                LEFT JOIN organizations o ON u.organization_id = o.id
                WHERE 1=1
            `;
            const params = [];

            if (filters.status) {
                query += ' AND u.status = ?';
                params.push(filters.status);
            }
            if (filters.role) {
                query += ' AND u.role = ?';
                params.push(filters.role);
            }
            if (filters.date_from) {
                query += ' AND u.created_at >= ?';
                params.push(filters.date_from);
            }
            if (filters.date_to) {
                query += ' AND u.created_at <= ?';
                params.push(filters.date_to);
            }

            query += ' ORDER BY u.created_at DESC LIMIT 1000';

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve({
                    report_type: 'users',
                    generated_at: new Date().toISOString(),
                    total_count: rows.length,
                    data: rows
                });
            });
        });
    }

    async generateOrganizationsReport(filters, columns) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    o.id, o.name, o.status, o.created_at, o.subscription_plan,
                    (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count
                FROM organizations o
                WHERE 1=1
            `;
            const params = [];

            if (filters.status) {
                query += ' AND o.status = ?';
                params.push(filters.status);
            }
            if (filters.subscription_plan) {
                query += ' AND o.subscription_plan = ?';
                params.push(filters.subscription_plan);
            }

            query += ' ORDER BY o.created_at DESC LIMIT 1000';

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve({
                    report_type: 'organizations',
                    generated_at: new Date().toISOString(),
                    total_count: rows.length,
                    data: rows
                });
            });
        });
    }

    async generateRevenueReport(filters, columns) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    i.id, i.organization_id, i.amount, i.status, i.invoice_date, i.due_date,
                    o.name as organization_name
                FROM invoices i
                LEFT JOIN organizations o ON i.organization_id = o.id
                WHERE 1=1
            `;
            const params = [];

            if (filters.status) {
                query += ' AND i.status = ?';
                params.push(filters.status);
            }
            if (filters.date_from) {
                query += ' AND i.invoice_date >= ?';
                params.push(filters.date_from);
            }
            if (filters.date_to) {
                query += ' AND i.invoice_date <= ?';
                params.push(filters.date_to);
            }

            query += ' ORDER BY i.invoice_date DESC LIMIT 1000';

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else {
                    const totalRevenue = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
                    resolve({
                        report_type: 'revenue',
                        generated_at: new Date().toISOString(),
                        total_count: rows.length,
                        total_revenue: totalRevenue,
                        data: rows
                    });
                }
            });
        });
    }

    async generateActivityReport(filters, columns) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    al.id, al.user_id, al.action, al.resource_type, al.created_at,
                    u.email as user_email
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE 1=1
            `;
            const params = [];

            if (filters.action) {
                query += ' AND al.action = ?';
                params.push(filters.action);
            }
            if (filters.resource_type) {
                query += ' AND al.resource_type = ?';
                params.push(filters.resource_type);
            }
            if (filters.date_from) {
                query += ' AND al.created_at >= ?';
                params.push(filters.date_from);
            }
            if (filters.date_to) {
                query += ' AND al.created_at <= ?';
                params.push(filters.date_to);
            }

            query += ' ORDER BY al.created_at DESC LIMIT 1000';

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve({
                    report_type: 'activity',
                    generated_at: new Date().toISOString(),
                    total_count: rows.length,
                    data: rows
                });
            });
        });
    }

    async generateAIUsageReport(filters, columns) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    al.id, al.user_id, al.model, al.tokens_used, al.cost, al.created_at,
                    u.email as user_email
                FROM ai_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE 1=1
            `;
            const params = [];

            if (filters.model) {
                query += ' AND al.model = ?';
                params.push(filters.model);
            }
            if (filters.date_from) {
                query += ' AND al.created_at >= ?';
                params.push(filters.date_from);
            }
            if (filters.date_to) {
                query += ' AND al.created_at <= ?';
                params.push(filters.date_to);
            }

            query += ' ORDER BY al.created_at DESC LIMIT 1000';

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else {
                    const totalTokens = rows.reduce((sum, r) => sum + (r.tokens_used || 0), 0);
                    const totalCost = rows.reduce((sum, r) => sum + (r.cost || 0), 0);
                    resolve({
                        report_type: 'ai_usage',
                        generated_at: new Date().toISOString(),
                        total_count: rows.length,
                        total_tokens: totalTokens,
                        total_cost: totalCost,
                        data: rows
                    });
                }
            });
        });
    }

    /**
     * Get report execution history
     */
    async getReportExecutions(reportId, limit = 20) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM admin_report_executions 
                 WHERE report_id = ? 
                 ORDER BY executed_at DESC 
                 LIMIT ?`,
                [reportId, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * Get scheduled reports that need to be executed
     */
    async getScheduledReportsToRun() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM admin_saved_reports 
                 WHERE schedule_json IS NOT NULL 
                 AND json_extract(schedule_json, '$.is_active') = 1`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * Export report to CSV format
     */
    exportToCsv(reportData) {
        if (!reportData.data || reportData.data.length === 0) {
            return '';
        }

        const headers = Object.keys(reportData.data[0]);
        const csvRows = [headers.join(',')];

        for (const row of reportData.data) {
            const values = headers.map(h => {
                const val = row[h];
                if (val === null || val === undefined) return '';
                if (typeof val === 'string' && val.includes(',')) {
                    return `"${val.replace(/"/g, '""')}"`;
                }
                return String(val);
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    }
}

module.exports = new ReportService();
