import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase, RunResult } from '../../database/IDatabase.js';

export interface ReportExecution {
    id: string;
    reportId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    executedAt: string;
    completedAt?: string | null;
    result?: any | null;
    errorMessage?: string | null;
    createdAt: string;
}

export interface ReportExecutionServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

export class ReportExecutionService {
    private deps: ReportExecutionServiceDependencies;

    constructor(deps?: Partial<ReportExecutionServiceDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4,
        };
    }

    async startExecution(reportId: string): Promise<string> {
        const executionId = this.deps.uuidv4();
        const now = new Date().toISOString();

        await this.deps.db.run(
            `INSERT INTO admin_report_executions 
             (id, report_id, status, executed_at, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [executionId, reportId, 'running', now, now],
        );

        return executionId;
    }

    async completeExecution(executionId: string, result: any): Promise<void> {
        const now = new Date().toISOString();
        const resultJson = JSON.stringify(result);

        await this.deps.db.run(
            `UPDATE admin_report_executions 
             SET status = 'completed', completed_at = ?, result_json = ?
             WHERE id = ?`,
            [now, resultJson, executionId],
        );
    }

    async failExecution(executionId: string, error: Error): Promise<void> {
        const now = new Date().toISOString();
        const errorMessage = error.message || String(error);

        await this.deps.db.run(
            `UPDATE admin_report_executions 
             SET status = 'failed', completed_at = ?, error_message = ?
             WHERE id = ?`,
            [now, errorMessage, executionId],
        );
    }

    async getReportExecutions(reportId: string, limit: number = 20): Promise<ReportExecution[]> {
        const rows = await this.deps.db.all<any[]>(
            `SELECT * FROM admin_report_executions 
             WHERE report_id = ? 
             ORDER BY executed_at DESC 
             LIMIT ?`,
            [reportId, limit],
        );

        return (rows || []).map((row: any) => this._mapExecutionRow(row));
    }

    private _mapExecutionRow(row: any): ReportExecution {
        return {
            id: row.id,
            reportId: row.report_id,
            status: row.status,
            executedAt: row.executed_at,
            completedAt: row.completed_at,
            result: row.result_json ? JSON.parse(row.result_json) : null,
            errorMessage: row.error_message,
            createdAt: row.created_at,
        };
    }
}
