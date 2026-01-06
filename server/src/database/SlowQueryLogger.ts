/**
 * Slow Query Logger
 * Automatically logs queries that exceed performance thresholds
 * 
 * Features:
 * - Configurable threshold (default 100ms)
 * - Query logging with params and stack traces
 * - Aggregation and reporting
 * - Top slow queries tracking
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SlowQuery {
    sql: string;
    params: any[];
    executionTime: number;
    timestamp: Date;
    stackTrace?: string;
}

interface QueryStats {
    sql: string;
    count: number;
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    lastSeen: Date;
}

export class SlowQueryLogger {
    private threshold: number;
    private logFile: string;
    private queries: SlowQuery[] = [];
    private stats: Map<string, QueryStats> = new Map();
    private maxQueries: number = 1000;
    private isEnabled: boolean;

    constructor(thresholdMs: number = 100) {
        this.threshold = thresholdMs;
        this.isEnabled = process.env.DISABLE_SLOW_QUERY_LOG !== 'true';
        this.logFile = path.join(__dirname, '../../logs/slow-queries.log');

        if (this.isEnabled) {
            logger.info(`[SlowQueryLogger] Initialized with ${this.threshold}ms threshold`);
        }
    }

    /**
     * Log a slow query
     */
    async logQuery(sql: string, params: any[], executionTime: number): Promise<void> {
        if (!this.isEnabled || executionTime < this.threshold) {
            return;
        }

        const slowQuery: SlowQuery = {
            sql: this.normalizeSql(sql),
            params,
            executionTime,
            timestamp: new Date(),
            stackTrace: this.captureStackTrace(),
        };

        this.queries.push(slowQuery);
        this.updateStats(slowQuery);

        // Trim if too many queries
        if (this.queries.length > this.maxQueries) {
            this.queries = this.queries.slice(-this.maxQueries);
        }

        // Log to console
        logger.warn(
            `[SlowQuery] ${executionTime.toFixed(2)}ms - ${slowQuery.sql.substring(0, 100)}...`
        );

        // Log to file
        await this.writeToFile(slowQuery);
    }

    /**
     * Get top slow queries
     */
    getTopSlowQueries(limit: number = 10): QueryStats[] {
        return Array.from(this.stats.values())
            .sort((a, b) => b.avgTime - a.avgTime)
            .slice(0, limit);
    }

    /**
     * Get recent slow queries
     */
    getRecentSlowQueries(limit: number = 50): SlowQuery[] {
        return this.queries.slice(-limit).reverse();
    }

    /**
     * Get statistics
     */
    getStatistics() {
        const totalQueries = this.queries.length;
        const uniqueQueries = this.stats.size;
        const avgExecutionTime = totalQueries > 0
            ? this.queries.reduce((sum, q) => sum + q.executionTime, 0) / totalQueries
            : 0;

        return {
            totalSlowQueries: totalQueries,
            uniqueSlowQueries: uniqueQueries,
            averageExecutionTime: avgExecutionTime,
            threshold: this.threshold,
            topSlowQueries: this.getTopSlowQueries(5),
        };
    }

    /**
     * Clear all logged queries
     */
    clear(): void {
        this.queries = [];
        this.stats.clear();
        logger.info('[SlowQueryLogger] Cleared all logged queries');
    }

    /**
     * Export to JSON
     */
    async exportToJson(filepath?: string): Promise<string> {
        const exportPath = filepath || path.join(__dirname, '../../logs/slow-queries-export.json');

        const data = {
            exportedAt: new Date().toISOString(),
            threshold: this.threshold,
            statistics: this.getStatistics(),
            topQueries: this.getTopSlowQueries(20),
            recentQueries: this.getRecentSlowQueries(100),
        };

        await fs.writeFile(exportPath, JSON.stringify(data, null, 2));
        logger.info(`[SlowQueryLogger] Exported to ${exportPath}`);

        return exportPath;
    }

    // ==================== Private Methods ====================

    private normalizeSql(sql: string): string {
        // Remove extra whitespace
        return sql.replace(/\s+/g, ' ').trim();
    }

    private captureStackTrace(): string {
        const stack = new Error().stack || '';
        const lines = stack.split('\n').slice(3, 8); // Skip first 3 lines
        return lines.join('\n');
    }

    private updateStats(query: SlowQuery): void {
        const existing = this.stats.get(query.sql);

        if (existing) {
            existing.count++;
            existing.totalTime += query.executionTime;
            existing.avgTime = existing.totalTime / existing.count;
            existing.minTime = Math.min(existing.minTime, query.executionTime);
            existing.maxTime = Math.max(existing.maxTime, query.executionTime);
            existing.lastSeen = query.timestamp;
        } else {
            this.stats.set(query.sql, {
                sql: query.sql,
                count: 1,
                totalTime: query.executionTime,
                avgTime: query.executionTime,
                minTime: query.executionTime,
                maxTime: query.executionTime,
                lastSeen: query.timestamp,
            });
        }
    }

    private async writeToFile(query: SlowQuery): Promise<void> {
        try {
            // Ensure logs directory exists
            const logsDir = path.dirname(this.logFile);
            await fs.mkdir(logsDir, { recursive: true });

            const logEntry = {
                timestamp: query.timestamp.toISOString(),
                executionTime: `${query.executionTime.toFixed(2)}ms`,
                sql: query.sql,
                params: query.params,
                stackTrace: query.stackTrace,
            };

            await fs.appendFile(
                this.logFile,
                JSON.stringify(logEntry) + '\n'
            );
        } catch (error) {
            logger.error('[SlowQueryLogger] Failed to write to log file:', error);
        }
    }
}

// Singleton instance
let slowQueryLogger: SlowQueryLogger | null = null;

export function getSlowQueryLogger(): SlowQueryLogger {
    if (!slowQueryLogger) {
        const threshold = parseInt(process.env.SLOW_QUERY_THRESHOLD || '100');
        slowQueryLogger = new SlowQueryLogger(threshold);
    }
    return slowQueryLogger;
}

export default SlowQueryLogger;
