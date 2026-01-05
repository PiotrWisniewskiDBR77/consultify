import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import * as DbPromise from '../../utils/DbPromise.js';
import { DailyUsage, OrganizationRow, TrialUsage, UsageCountersRow } from './AccessTypes.js';

export class AccessUsageService {
    private db: IDatabase;

    constructor(dbOrNull?: IDatabase) {
        this.db = dbOrNull || getDatabase();
    }

    setDependencies(deps: { db?: IDatabase }) {
        if (deps.db) {
            this.db = deps.db;
        }
    }

    /**
     * Get today's usage counters for an organization
     */
    async getDailyUsage(organizationId: string): Promise<DailyUsage> {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        const row = await DbPromise.get<UsageCountersRow>(
            this.db,
            `SELECT * FROM usage_counters WHERE organization_id = ? AND counter_date = ?`,
            [organizationId, today],
            { fallback: false },
        );

        if (!row) {
            return {
                organizationId,
                counterDate: today,
                aiCallsCount: 0,
                projectsCount: 0,
                usersCount: 0,
                initiativesCount: 0,
                storageUsedMb: 0,
            };
        }

        return {
            id: row.id,
            organizationId: row.organization_id,
            counterDate: row.counter_date,
            aiCallsCount: row.ai_calls_count,
            projectsCount: row.projects_count,
            usersCount: row.users_count,
            initiativesCount: row.initiatives_count,
            storageUsedMb: row.storage_used_mb,
        };
    }

    /**
     * Increment a usage counter
     */
    async incrementUsage(
        organizationId: string,
        counterType: 'ai_calls' | 'projects' | 'users' | 'initiatives' | 'storage',
        amount: number = 1,
    ): Promise<void> {
        const today = new Date().toISOString().split('T')[0];
        const columnMap: Record<string, string> = {
            ai_calls: 'ai_calls_count',
            projects: 'projects_count',
            users: 'users_count',
            initiatives: 'initiatives_count',
            storage: 'storage_used_mb',
        };

        const column = columnMap[counterType];
        if (!column) throw new Error(`Invalid counter type: ${counterType}`);

        // Upsert pattern for SQLite
        await DbPromise.run(
            this.db,
            `INSERT INTO usage_counters (id, organization_id, counter_date, ${column})
             VALUES (?, ?, ?, ?)
             ON CONFLICT(organization_id, counter_date) 
             DO UPDATE SET ${column} = ${column} + ?`,
            [`usage-${uuidv4()}`, organizationId, today, amount, amount],
        );
    }

    /**
     * Track token usage for trial budget
     */
    async trackTokenUsage(organizationId: string, tokens: number): Promise<void> {
        await DbPromise.run(
            this.db,
            `UPDATE organizations SET trial_tokens_used = COALESCE(trial_tokens_used, 0) + ? WHERE id = ?`,
            [tokens, organizationId],
        );
    }

    /**
     * Get trial usage stats
     */
    async getTrialUsage(organizationId: string): Promise<TrialUsage> {
        const row = await DbPromise.get<OrganizationRow>(
            this.db,
            `SELECT trial_tokens_used FROM organizations WHERE id = ?`,
            [organizationId],
            { fallback: false },
        );

        return { tokensUsed: row?.trial_tokens_used || 0 };
    }
}
