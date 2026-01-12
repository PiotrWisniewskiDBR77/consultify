import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';

export interface ReportGeneratorDependencies {
    db: IDatabase;
}

export type ReportType = 'users' | 'organizations' | 'revenue' | 'activity' | 'ai_usage';

export class ReportGeneratorService {
    private deps: ReportGeneratorDependencies;

    constructor(deps?: Partial<ReportGeneratorDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
        };
    }

    async generateReportData(reportType: string, filters: any, columns: any[]): Promise<any> {
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

    private async generateUsersReport(filters: any, columns: any[]): Promise<any> {
        let query = `
            SELECT 
                u.id, u.email, u.role, u.status, u.created_at,
                o.name as organization_name
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE 1=1
        `;
        const params: any[] = [];

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

        const rows = await this.deps.db.all<any[]>(query, params);

        return {
            report_type: 'users',
            generated_at: new Date().toISOString(),
            total_count: (rows || []).length,
            data: rows || [],
        };
    }

    private async generateOrganizationsReport(filters: any, columns: any[]): Promise<any> {
        let query = `
            SELECT 
                o.id, o.name, o.status, o.created_at, o.subscription_plan,
                (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count
            FROM organizations o
            WHERE 1=1
        `;
        const params: any[] = [];

        if (filters.status) {
            query += ' AND o.status = ?';
            params.push(filters.status);
        }
        if (filters.subscription_plan) {
            query += ' AND o.subscription_plan = ?';
            params.push(filters.subscription_plan);
        }

        query += ' ORDER BY o.created_at DESC LIMIT 1000';

        const rows = await this.deps.db.all<any[]>(query, params);

        return {
            report_type: 'organizations',
            generated_at: new Date().toISOString(),
            total_count: (rows || []).length,
            data: rows || [],
        };
    }

    private async generateRevenueReport(filters: any, columns: any[]): Promise<any> {
        let query = `
            SELECT 
                i.id, i.organization_id, i.amount, i.status, i.invoice_date, i.due_date,
                o.name as organization_name
            FROM invoices i
            LEFT JOIN organizations o ON i.organization_id = o.id
            WHERE 1=1
        `;
        const params: any[] = [];

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

        const rows = await this.deps.db.all<any[]>(query, params);
        const safeRows = rows || [];
        const totalRevenue = safeRows.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

        return {
            report_type: 'revenue',
            generated_at: new Date().toISOString(),
            total_count: safeRows.length,
            total_revenue: totalRevenue,
            data: safeRows,
        };
    }

    private async generateActivityReport(filters: any, columns: any[]): Promise<any> {
        let query = `
            SELECT 
                al.id, al.user_id, al.action, al.resource_type, al.created_at,
                u.email as user_email
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        const params: any[] = [];

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

        const rows = await this.deps.db.all<any[]>(query, params);

        return {
            report_type: 'activity',
            generated_at: new Date().toISOString(),
            total_count: (rows || []).length,
            data: rows || [],
        };
    }

    private async generateAIUsageReport(filters: any, columns: any[]): Promise<any> {
        let query = `
            SELECT 
                al.id, al.user_id, al.model, al.tokens_used, al.cost, al.created_at,
                u.email as user_email
            FROM ai_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        const params: any[] = [];

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

        const rows = await this.deps.db.all<any[]>(query, params);
        const safeRows = rows || [];
        const totalTokens = safeRows.reduce((sum: number, r: any) => sum + (r.tokens_used || 0), 0);
        const totalCost = safeRows.reduce((sum: number, r: any) => sum + (r.cost || 0), 0);

        return {
            report_type: 'ai_usage',
            generated_at: new Date().toISOString(),
            total_count: safeRows.length,
            total_tokens: totalTokens,
            total_cost: totalCost,
            data: safeRows,
        };
    }
}
