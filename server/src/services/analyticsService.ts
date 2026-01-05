/**
 * Analytics Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/analyticsService.js
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface AnalyticsServiceDeps {
    db: IDatabase;
    uuidv4: () => string;
}

interface AILogStats {
    total_calls: number;
    avg_latency: number;
    total_tokens: number;
    model: string;
}

interface TopicCount {
    topic: string;
    count: number;
}

interface IndustryBenchmark {
    axis: string;
    avg_score: number;
    sample_size: number;
}

// ==========================================
// CLASS IMPLEMENTATION
// ==========================================

export class AnalyticsServiceClass {
    #deps: AnalyticsServiceDeps | null = null;
    #initialized = false;
    #initPromise: Promise<void> | null = null;

    constructor(deps?: Partial<AnalyticsServiceDeps>) {
        if (deps?.db && deps?.uuidv4) {
            this.#deps = deps as AnalyticsServiceDeps;
            this.#initialized = true;
        }
    }

    async #initDeps() {
        if (this.#initialized) return;
        if (this.#initPromise) return this.#initPromise;

        this.#initPromise = (async () => {
            const [uuidModule] = await Promise.all([import('uuid')]);

            this.#deps = {
                db: getDatabase(),
                uuidv4: uuidModule.v4,
            };
            this.#initialized = true;
        })();

        return this.#initPromise;
    }

    setDependencies(newDeps: Partial<AnalyticsServiceDeps>) {
        this.#deps = { ...this.#deps!, ...newDeps };
        this.#initialized = true;
    }

    private async dbGet<T>(sql: string, params: any[] = []): Promise<T | null> {
        await this.#initDeps();
        return DbPromise.get<T>(this.#deps!.db, sql, params);
    }

    private async dbRun(sql: string, params: any[] = []): Promise<{ lastID?: number; changes: number }> {
        await this.#initDeps();
        const result = await DbPromise.run(this.#deps!.db, sql, params);
        return {
            lastID: result.lastID,
            changes: result.changes || 0,
        };
    }

    private async dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
        await this.#initDeps();
        return DbPromise.all<T>(this.#deps!.db, sql, params);
    }

    // ==========================================
    // SERVICE METHODS
    // ==========================================

    async logUsage(
        userId: string,
        action: string,
        model: string,
        inputTokens: number,
        outputTokens: number,
        latencyMs: number,
        topic: string = '',
    ): Promise<void> {
        await this.#initDeps();
        const { uuidv4 } = this.#deps!;

        await this.dbRun(
            `INSERT INTO ai_logs (id, user_id, action, model, input_tokens, output_tokens, latency_ms, topic) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), userId, action, model, inputTokens, outputTokens, latencyMs, topic],
        );
    }

    async getStats(_period: string = '7d'): Promise<AILogStats[]> {
        await this.#initDeps();

        const sql = `
            SELECT 
                COUNT(*) as total_calls,
                AVG(latency_ms) as avg_latency,
                SUM(input_tokens + output_tokens) as total_tokens,
                model
            FROM ai_logs
            WHERE created_at > datetime('now', '-7 days')
            GROUP BY model
        `;

        return this.dbAll<AILogStats>(sql);
    }

    async getTopTopics(): Promise<TopicCount[]> {
        await this.#initDeps();

        const sql = `
            SELECT topic, COUNT(*) as count
            FROM ai_logs
            WHERE topic IS NOT NULL AND topic != ''
            GROUP BY topic
            ORDER BY count DESC
            LIMIT 5
        `;

        return this.dbAll<TopicCount>(sql);
    }

    async saveMaturityScore(
        organizationId: string,
        axis: string,
        score: number,
        industry: string = 'General',
    ): Promise<void> {
        await this.#initDeps();
        const { uuidv4 } = this.#deps!;

        try {
            await this.dbRun(
                `INSERT INTO maturity_scores (id, organization_id, axis, score, industry) 
                 VALUES (?, ?, ?, ?, ?)`,
                [uuidv4(), organizationId, axis, score, industry],
            );
        } catch (err: any) {
            logger.error('[AnalyticsService] Failed to save maturity score:', err);
        }
    }

    async getIndustryBenchmarks(industry: string | null = null): Promise<IndustryBenchmark[]> {
        await this.#initDeps();

        let sql = `
            SELECT axis, AVG(score) as avg_score, COUNT(*) as sample_size
            FROM maturity_scores
        `;
        const params: any[] = [];

        if (industry && industry !== 'All') {
            sql += ` WHERE industry = ?`;
            params.push(industry);
        }

        sql += ` GROUP BY axis`;

        return this.dbAll<IndustryBenchmark>(sql, params);
    }
}

// ==========================================
// EXPORTS
// ==========================================

const AnalyticsService = new AnalyticsServiceClass();

export const logUsage = (
    userId: string,
    action: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    latencyMs: number,
    topic?: string,
) => AnalyticsService.logUsage(userId, action, model, inputTokens, outputTokens, latencyMs, topic);
export const getStats = (period?: string) => AnalyticsService.getStats(period);
export const getTopTopics = () => AnalyticsService.getTopTopics();
export const saveMaturityScore = (orgId: string, axis: string, score: number, industry?: string) =>
    AnalyticsService.saveMaturityScore(orgId, axis, score, industry);
export const getIndustryBenchmarks = (industry?: string | null) => AnalyticsService.getIndustryBenchmarks(industry);

export default AnalyticsService;
