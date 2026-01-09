/**
 * Database Module - Enhanced with Connection Pooling
 * Exports connection pool, health monitor, metrics, and database instance
 */

import { ConnectionPool } from './ConnectionPool.js';
import { ConnectionHealthMonitor } from './ConnectionHealthMonitor.js';
import { createDatabase } from './Database.js';
import { getDatabaseMetrics } from './DatabaseMetrics.js';
import { getSlowQueryLogger } from './SlowQueryLogger.js';
import logger from '../utils/Logger.js';

let connectionPool: ConnectionPool | null = null;
let healthMonitor: ConnectionHealthMonitor | null = null;
let isInitialized = false;

/**
 * Initialize connection pool and health monitoring
 */
export async function initializeConnectionPool(): Promise<void> {
    if (isInitialized) {
        logger.warn('[Database] Connection pool already initialized');
        return;
    }

    // Check if pooling is disabled
    if (process.env.DISABLE_CONNECTION_POOL === 'true') {
        logger.warn('[Database] Connection pooling is DISABLED');
        return;
    }

    try {
        logger.info('[Database] Initializing connection pool...');

        // Create connection pool
        connectionPool = new ConnectionPool(() => createDatabase(), {
            minConnections: parseInt(process.env.DB_POOL_MIN || '2'),
            maxConnections: parseInt(process.env.DB_POOL_MAX || '10'),
            connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
            queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '60000'),
            healthCheckInterval: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '30000'),
        });

        await connectionPool.initialize();

        // Initialize metrics with pool reference
        getDatabaseMetrics(connectionPool);
        getSlowQueryLogger();

        // Create health monitor
        healthMonitor = new ConnectionHealthMonitor(connectionPool);
        healthMonitor.start();

        // Listen to health events
        healthMonitor.on('persistent-failure', (metrics) => {
            logger.error('[Database] ALERT: Persistent connection failures detected', metrics);
        });

        connectionPool.on('circuit-breaker-open', () => {
            logger.error('[Database] ALERT: Circuit breaker opened - connection failures');
        });

        connectionPool.on('circuit-breaker-closed', () => {
            logger.info('[Database] Circuit breaker closed - connections restored');
        });

        isInitialized = true;
        logger.info('[Database] Connection pool initialized successfully');
    } catch (error) {
        logger.error('[Database] Failed to initialize connection pool:', error);
        throw error;
    }
}

/**
 * Get connection pool instance
 */
export function getConnectionPool(): ConnectionPool | null {
    return connectionPool;
}

/**
 * Get health monitor instance
 */
export function getHealthMonitor(): ConnectionHealthMonitor | null {
    return healthMonitor;
}

/**
 * Shutdown connection pool
 */
export async function shutdownConnectionPool(): Promise<void> {
    if (healthMonitor) {
        healthMonitor.stop();
        healthMonitor = null;
    }

    if (connectionPool) {
        await connectionPool.shutdown();
        connectionPool = null;
    }

    isInitialized = false;
    logger.info('[Database] Connection pool shutdown complete');
}

// Export everything from Database.ts
export * from './Database.js';
export * from './IDatabase.js';
export { ConnectionPool } from './ConnectionPool.js';
export { ConnectionHealthMonitor } from './ConnectionHealthMonitor.js';
export { SlowQueryLogger, getSlowQueryLogger } from './SlowQueryLogger.js';
export { DatabaseMetrics, getDatabaseMetrics } from './DatabaseMetrics.js';


