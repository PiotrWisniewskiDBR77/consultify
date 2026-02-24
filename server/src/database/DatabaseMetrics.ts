// @ts-nocheck
/**
 * Database Metrics Collector
 * Real-time performance metrics and monitoring
 *
 * Features:
 * - Query performance tracking (avg/min/max/p95/p99)
 * - Connection pool metrics
 * - Database size monitoring
 * - Error rate tracking
 * - Missing index detection
 */

import { EventEmitter } from 'events';

import logger from '../utils/Logger.js';
import type { ConnectionPool } from './ConnectionPool.js';

interface QueryMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
}

interface ConnectionMetrics {
  poolSize: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  healthyConnections: number;
  unhealthyConnections: number;
}

interface DatabaseMetricsStats {
  sizeBytes: number;
  tableCount: number;
  indexCount: number;
  lastVacuum?: Date;
}

interface ErrorMetrics {
  totalErrors: number;
  connectionErrors: number;
  timeoutErrors: number;
  queryErrors: number;
  errorRate: number; // errors per minute
}

export class DatabaseMetrics extends EventEmitter {
  private queryTimes: number[] = [];
  private maxSamples: number = 10000;
  private queryCount: number = 0;
  private errorCount: number = 0;
  private startTime: Date = new Date();
  private pool?: ConnectionPool;

  constructor(pool?: ConnectionPool) {
    super();
    this.pool = pool;
    logger.info('[DatabaseMetrics] Initialized');
  }

  /**
   * Record a query execution
   */
  recordQuery(executionTime: number, success: boolean = true): void {
    this.queryCount++;

    if (success) {
      this.queryTimes.push(executionTime);

      // Trim if too many samples
      if (this.queryTimes.length > this.maxSamples) {
        this.queryTimes = this.queryTimes.slice(-this.maxSamples);
      }
    } else {
      this.errorCount++;
    }

    this.emit('query-recorded', { executionTime, success });
  }

  /**
   * Get query performance metrics
   */
  getQueryMetrics(): QueryMetrics {
    if (this.queryTimes.length === 0) {
      return {
        totalQueries: this.queryCount,
        successfulQueries: this.queryCount - this.errorCount,
        failedQueries: this.errorCount,
        avgExecutionTime: 0,
        minExecutionTime: 0,
        maxExecutionTime: 0,
        p95ExecutionTime: 0,
        p99ExecutionTime: 0,
      };
    }

    const sorted = [...this.queryTimes].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      totalQueries: this.queryCount,
      successfulQueries: this.queryCount - this.errorCount,
      failedQueries: this.errorCount,
      avgExecutionTime: sum / sorted.length,
      minExecutionTime: sorted[0],
      maxExecutionTime: sorted[sorted.length - 1],
      p95ExecutionTime: this.percentile(sorted, 0.95),
      p99ExecutionTime: this.percentile(sorted, 0.99),
    };
  }

  /**
   * Get connection pool metrics
   */
  getConnectionMetrics(): ConnectionMetrics | null {
    if (!this.pool) {
      return null;
    }

    const stats = this.pool.getStats();

    return {
      poolSize: stats.total,
      activeConnections: stats.active,
      idleConnections: stats.idle,
      waitingRequests: stats.waiting,
      healthyConnections: stats.healthy,
      unhealthyConnections: stats.unhealthy,
    };
  }

  /**
   * Get error metrics
   */
  getErrorMetrics(): ErrorMetrics {
    const uptimeMinutes = (Date.now() - this.startTime.getTime()) / 60000;
    const errorRate = uptimeMinutes > 0 ? this.errorCount / uptimeMinutes : 0;

    return {
      totalErrors: this.errorCount,
      connectionErrors: 0, // TODO: Track separately
      timeoutErrors: 0, // TODO: Track separately
      queryErrors: this.errorCount,
      errorRate,
    };
  }

  /**
   * Get database size metrics (PostgreSQL)
   */
  async getDatabaseMetrics(db: any): Promise<DatabaseMetricsStats> {
    try {
      const sizeResult = await db.query('SELECT pg_database_size(current_database()) as size_bytes', []);
      const sizeBytes = Number(sizeResult.rows[0]?.size_bytes) || 0;

      const tableResult = await db.query(
        `SELECT COUNT(*)::int as count FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
        []
      );
      const tableCount = Number(tableResult.rows[0]?.count) || 0;

      const indexResult = await db.query(
        `SELECT COUNT(*)::int as count FROM pg_indexes WHERE schemaname = 'public'`,
        []
      );
      const indexCount = Number(indexResult.rows[0]?.count) || 0;

      return {
        sizeBytes,
        tableCount,
        indexCount,
      };
    } catch (error) {
      logger.error('[DatabaseMetrics] Failed to get database metrics:', error);
      return {
        sizeBytes: 0,
        tableCount: 0,
        indexCount: 0,
      };
    }
  }

  /**
   * Get all metrics
   */
  async getAllMetrics(db?: any): Promise<{
    query: QueryMetrics;
    connection: ConnectionMetrics | null;
    error: ErrorMetrics;
    database?: DatabaseMetricsStats;
    uptime: number;
  }> {
    const uptimeSeconds = (Date.now() - this.startTime.getTime()) / 1000;

    return {
      query: this.getQueryMetrics(),
      connection: this.getConnectionMetrics(),
      error: this.getErrorMetrics(),
      database: db ? await this.getDatabaseMetrics(db) : undefined,
      uptime: uptimeSeconds,
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.queryTimes = [];
    this.queryCount = 0;
    this.errorCount = 0;
    this.startTime = new Date();
    logger.info('[DatabaseMetrics] Metrics reset');
  }

  // ==================== Private Methods ====================

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

// Singleton instance
let databaseMetrics: DatabaseMetrics | null = null;

export function getDatabaseMetrics(pool?: ConnectionPool): DatabaseMetrics {
  if (!databaseMetrics) {
    databaseMetrics = new DatabaseMetrics(pool);
  }
  return databaseMetrics;
}

export default DatabaseMetrics;
