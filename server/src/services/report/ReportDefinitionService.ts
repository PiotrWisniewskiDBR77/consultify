import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js'; // Assuming direct import or through DI
import type { IDatabase, RunResult } from '../../database/IDatabase.js';

export interface ReportFilter {
    report_type?: string;
    created_by?: string;
    has_schedule?: boolean;
    limit?: number;
    // Add other filter fields as needed based on usage
    status?: string;
    role?: string;
    date_from?: string;
    date_to?: string;
    subscription_plan?: string;
    action?: string;
    resource_type?: string;
    model?: string;
}

export interface ReportSchedule {
    cron: string;
    recipients: string[]; // emails
    format: 'csv' | 'json';
    is_active: boolean;
}

export interface ReportColumn {
    key: string;
    label: string;
    // other column metadata
}

export interface Report {
    id: string;
    name: string;
    description?: string | null;
    reportType: string;
    filters: ReportFilter;
    columns: ReportColumn[];
    schedule?: ReportSchedule | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    // Hydrated fields
    createdByEmail?: string;
    executionCount?: number;
    lastExecutedAt?: string;
}

export interface CreateReportData {
    name: string;
    description?: string;
    report_type: string;
    filters?: ReportFilter;
    columns?: ReportColumn[];
    schedule?: ReportSchedule;
}

export interface UpdateReportData {
    name?: string;
    description?: string;
    report_type?: string;
    filters?: ReportFilter;
    columns?: ReportColumn[];
    schedule?: ReportSchedule | null;
}

export interface ReportDefinitionServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

export class ReportDefinitionService {
    private deps: ReportDefinitionServiceDependencies;

    constructor(deps?: Partial<ReportDefinitionServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4,
        };
    }

    async getReports(filters: ReportFilter = {}): Promise<Report[]> {
        let query = `
            SELECT 
                r.id, r.name, r.description, r.report_type, 
                r.filters_json, r.columns_json, r.schedule_json,
                r.created_by, r.created_at, r.updated_at,
                u.email as created_by_email,
                (SELECT COUNT(*) FROM admin_report_executions WHERE report_id = r.id) as execution_count,
                (SELECT MAX(executed_at) FROM admin_report_executions WHERE report_id = r.id) as last_executed_at
            FROM admin_saved_reports r
            LEFT JOIN users u ON r.created_by = u.id
            WHERE 1=1
        `;
        const params: unknown[] = [];

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

        const rows = (await this.deps.db.all<any[]>(query, params)) as any[] | null;

        return (rows || []).map((row: any) => this._mapReportRow(row));
    }

    async getReportById(reportId: string): Promise<Report | null> {
        const row = await this.deps.db.get<any>(
            `SELECT 
                r.id, r.name, r.description, r.report_type, 
                r.filters_json, r.columns_json, r.schedule_json,
                r.created_by, r.created_at, r.updated_at,
                u.email as created_by_email
             FROM admin_saved_reports r
             LEFT JOIN users u ON r.created_by = u.id
             WHERE r.id = ?`,
            [reportId],
        );

        if (!row) return null;
        return this._mapReportRow(row);
    }

    async createReport(data: CreateReportData, userId: string): Promise<Report> {
        const id = this.deps.uuidv4();
        const now = new Date().toISOString();

        await this.deps.db.run(
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
                now,
            ],
        );

        return {
            id,
            name: data.name,
            description: data.description || null,
            reportType: data.report_type,
            filters: data.filters || {},
            columns: data.columns || [],
            schedule: data.schedule || null,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
        };
    }

    async updateReport(reportId: string, data: UpdateReportData): Promise<boolean> {
        const now = new Date().toISOString();
        const updates: string[] = [];
        const params: unknown[] = [];

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

        // Where clause param
        params.push(reportId);

        const result = (await this.deps.db.run(
            `UPDATE admin_saved_reports SET ${updates.join(', ')} WHERE id = ?`,
            params,
        )) as RunResult;

        return result.changes > 0;
    }

    async deleteReport(reportId: string): Promise<boolean> {
        const result = (await this.deps.db.run('DELETE FROM admin_saved_reports WHERE id = ?', [
            reportId,
        ])) as RunResult;

        return result.changes > 0;
    }

    async getScheduledReportsToRun(): Promise<Report[]> {
        const rows = (await this.deps.db.all<any>(
            `SELECT * FROM admin_saved_reports 
             WHERE schedule_json IS NOT NULL 
             AND json_extract(schedule_json, '$.is_active') = 1`,
        )) as any[];
        return (rows || []).map((row: any) => this._mapReportRow(row));
    }

    private _mapReportRow(row: any): Report {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            reportType: row.report_type,
            filters: JSON.parse(row.filters_json || '{}'),
            columns: JSON.parse(row.columns_json || '[]'),
            schedule: row.schedule_json ? JSON.parse(row.schedule_json) : null,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            createdByEmail: row.created_by_email,
            executionCount: row.execution_count,
            lastExecutedAt: row.last_executed_at,
        };
    }
}
