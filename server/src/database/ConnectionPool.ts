/**
 * Connection Pool Manager
 * Enterprise-grade database connection pooling with health monitoring
 *
 * Features:
 * - Connection pooling (min 2, max 10)
 * - Automatic reconnection with exponential backoff
 * - Circuit breaker pattern
 * - Connection health checks
 * - Query and connection timeouts
 * - Dead connection detection
 */

import { EventEmitter } from 'events';

import logger from '../utils/Logger.js';
import type { IDatabase } from './IDatabase.js';

interface PoolConfig {
    minConnections: number;
    maxConnections: number;
    connectionTimeout: number; // ms
    queryTimeout: number; // ms
    healthCheckInterval: number; // ms
    maxRetries: number;
    retryDelayMs: number;
}

interface PooledConnection {
    connection: IDatabase;
    id: string;
    createdAt: Date;
    lastUsed: Date;
    inUse: boolean;
    healthy: boolean;
    failureCount: number;
}

interface PoolStats {
    total: number;
    active: number;
    idle: number;
    waiting: number;
    healthy: number;
    unhealthy: number;
}

export class ConnectionPool extends EventEmitter {
    private config: PoolConfig;
    private connections: Map<string, PooledConnection> = new Map();
    private waitQueue: Array<(conn: PooledConnection) => void> = [];
    private healthCheckTimer?: NodeJS.Timeout;
    private circuitBreakerOpen: boolean = false;
    private circuitBreakerOpenUntil?: Date;
    private consecutiveFailures: number = 0;
    private createConnection: () => Promise<IDatabase>;

    constructor(createConnectionFn: () => Promise<IDatabase>, config?: Partial<PoolConfig>) {
        super();

        this.createConnection = createConnectionFn;
        this.config = {
            minConnections: config?.minConnections ?? 2,
            maxConnections: config?.maxConnections ?? 10,
            connectionTimeout: config?.connectionTimeout ?? 30000, // 30s
            queryTimeout: config?.queryTimeout ?? 60000, // 60s
            healthCheckInterval: config?.healthCheckInterval ?? 30000, // 30s
            maxRetries: config?.maxRetries ?? 5,
            retryDelayMs: config?.retryDelayMs ?? 100,
        };

        logger.info('[ConnectionPool] Initialized with config:', this.config);
    }

    /**
     * Initialize the connection pool
     */
    async initialize(): Promise<void> {
        logger.info('[ConnectionPool] Initializing pool...');

        // Create minimum connections
        const promises = [];
        for (let i = 0; i < this.config.minConnections; i++) {
            promises.push(this.createPooledConnection());
        }

        await Promise.all(promises);

        // Start health check timer
        this.startHealthChecks();

        logger.info(`[ConnectionPool] Initialized with ${this.connections.size} connections`);
    }

    /**
     * Get a connection from the pool
     */
    async acquire(): Promise<PooledConnection> {
        // Check circuit breaker
        if (this.isCircuitBreakerOpen()) {
            throw new Error('Circuit breaker is open - too many connection failures');
        }

        // Try to get an idle connection
        const idleConnection = this.getIdleConnection();
        if (idleConnection) {
            idleConnection.inUse = true;
            idleConnection.lastUsed = new Date();
            logger.debug(`[ConnectionPool] Acquired connection ${idleConnection.id}`);
            return idleConnection;
        }

        // Create new connection if under max
        if (this.connections.size < this.config.maxConnections) {
            const newConnection = await this.createPooledConnection();
            newConnection.inUse = true;
            logger.debug(`[ConnectionPool] Created and acquired new connection ${newConnection.id}`);
            return newConnection;
        }

        // Wait for a connection to become available
        logger.debug('[ConnectionPool] Pool exhausted, waiting for connection...');
        return this.waitForConnection();
    }

    /**
     * Release a connection back to the pool
     */
    release(pooledConn: PooledConnection): void {
        pooledConn.inUse = false;
        pooledConn.lastUsed = new Date();

        logger.debug(`[ConnectionPool] Released connection ${pooledConn.id}`);

        // If there are waiters, give them this connection
        if (this.waitQueue.length > 0) {
            const waiter = this.waitQueue.shift();
            if (waiter) {
                pooledConn.inUse = true;
                waiter(pooledConn);
            }
        }

        this.emit('connection-released', pooledConn);
    }

    /**
     * Execute a query with automatic connection management
     */
    async query<T = any>(sql: string, params: any[] = []): Promise<T> {
        const connection = await this.acquire();

        try {
            const result = await this.executeWithTimeout(
                () => connection.connection.query(sql, params),
                this.config.queryTimeout,
            );

            this.onQuerySuccess(connection);
            return result as T;
        } catch (error) {
            this.onQueryFailure(connection, error);
            throw error;
        } finally {
            this.release(connection);
        }
    }

    /**
     * Get pool statistics
     */
    getStats(): PoolStats {
        const stats = {
            total: this.connections.size,
            active: 0,
            idle: 0,
            waiting: this.waitQueue.length,
            healthy: 0,
            unhealthy: 0,
        };

        for (const conn of this.connections.values()) {
            if (conn.inUse) stats.active++;
            else stats.idle++;

            if (conn.healthy) stats.healthy++;
            else stats.unhealthy++;
        }

        return stats;
    }

    /**
     * Shutdown the pool
     */
    async shutdown(): Promise<void> {
        logger.info('[ConnectionPool] Shutting down...');

        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }

        const closePromises = Array.from(this.connections.values()).map((pooledConn) =>
            this.closeConnection(pooledConn),
        );

        await Promise.all(closePromises);
        this.connections.clear();

        logger.info('[ConnectionPool] Shutdown complete');
    }

    // ==================== Private Methods ====================

    private async createPooledConnection(): Promise<PooledConnection> {
        const id = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        try {
            const connection = await this.createConnectionWithRetry();

            const pooledConn: PooledConnection = {
                connection,
                id,
                createdAt: new Date(),
                lastUsed: new Date(),
                inUse: false,
                healthy: true,
                failureCount: 0,
            };

            this.connections.set(id, pooledConn);
            this.emit('connection-created', pooledConn);

            return pooledConn;
        } catch (error) {
            logger.error(`[ConnectionPool] Failed to create connection: ${error}`);
            throw error;
        }
    }

    private async createConnectionWithRetry(): Promise<IDatabase> {
        let lastError: any;

        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
            try {
                const connection = await this.executeWithTimeout(
                    () => this.createConnection(),
                    this.config.connectionTimeout,
                );

                // Reset failure counter on success
                this.consecutiveFailures = 0;
                this.closeCircuitBreaker();

                return connection;
            } catch (error) {
                lastError = error;
                this.consecutiveFailures++;

                // Open circuit breaker after 5 consecutive failures
                if (this.consecutiveFailures >= 5) {
                    this.openCircuitBreaker();
                }

                if (attempt < this.config.maxRetries - 1) {
                    const delay = this.calculateBackoff(attempt);
                    logger.warn(`[ConnectionPool] Connection attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                    await this.sleep(delay);
                }
            }
        }

        throw new Error(`Failed to create connection after ${this.config.maxRetries} attempts: ${lastError}`);
    }

    private getIdleConnection(): PooledConnection | null {
        for (const conn of this.connections.values()) {
            if (!conn.inUse && conn.healthy) {
                return conn;
            }
        }
        return null;
    }

    private waitForConnection(): Promise<PooledConnection> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                const index = this.waitQueue.indexOf(resolve);
                if (index > -1) {
                    this.waitQueue.splice(index, 1);
                }
                reject(new Error('Connection acquisition timeout'));
            }, this.config.connectionTimeout);

            const resolver = (conn: PooledConnection) => {
                clearTimeout(timeout);
                resolve(conn);
            };

            this.waitQueue.push(resolver);
        });
    }

    private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
        return Promise.race([
            fn(),
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)),
        ]);
    }

    private calculateBackoff(attempt: number): number {
        // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
        const delay = this.config.retryDelayMs * Math.pow(2, attempt);
        const maxDelay = 10000; // Cap at 10s
        return Math.min(delay, maxDelay);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private startHealthChecks(): void {
        this.healthCheckTimer = setInterval(() => {
            this.performHealthChecks();
        }, this.config.healthCheckInterval);
    }

    private async performHealthChecks(): Promise<void> {
        logger.debug('[ConnectionPool] Performing health checks...');

        const checks = Array.from(this.connections.values()).map((conn) => this.checkConnectionHealth(conn));

        await Promise.all(checks);

        const stats = this.getStats();
        logger.debug(`[ConnectionPool] Health check complete. Stats:`, stats);

        this.emit('health-check-complete', stats);
    }

    private async checkConnectionHealth(pooledConn: PooledConnection): Promise<void> {
        if (pooledConn.inUse) {
            return; // Skip connections in use
        }

        try {
            // Simple health check query
            await this.executeWithTimeout(
                () => pooledConn.connection.query('SELECT 1', []),
                5000, // 5s timeout for health check
            );

            pooledConn.healthy = true;
            pooledConn.failureCount = 0;
        } catch (error) {
            logger.warn(`[ConnectionPool] Health check failed for ${pooledConn.id}: ${error}`);
            pooledConn.healthy = false;
            pooledConn.failureCount++;

            // Replace unhealthy connection after 3 failures
            if (pooledConn.failureCount >= 3) {
                await this.replaceConnection(pooledConn);
            }
        }
    }

    private async replaceConnection(oldConn: PooledConnection): Promise<void> {
        logger.info(`[ConnectionPool] Replacing unhealthy connection ${oldConn.id}`);

        try {
            // Remove old connection
            this.connections.delete(oldConn.id);
            await this.closeConnection(oldConn);

            // Create new connection
            await this.createPooledConnection();
        } catch (error) {
            logger.error(`[ConnectionPool] Failed to replace connection: ${error}`);
        }
    }

    private async closeConnection(pooledConn: PooledConnection): Promise<void> {
        try {
            if ((pooledConn.connection as any).close) {
                await (pooledConn.connection as any).close();
            }
        } catch (error) {
            logger.error(`[ConnectionPool] Error closing connection ${pooledConn.id}: ${error}`);
        }
    }

    private onQuerySuccess(pooledConn: PooledConnection): void {
        pooledConn.failureCount = 0;
        pooledConn.healthy = true;
    }

    private onQueryFailure(pooledConn: PooledConnection, error: any): void {
        pooledConn.failureCount++;

        if (pooledConn.failureCount >= 3) {
            pooledConn.healthy = false;
        }

        logger.error(`[ConnectionPool] Query failed on ${pooledConn.id}: ${error}`);
    }

    private openCircuitBreaker(): void {
        this.circuitBreakerOpen = true;
        this.circuitBreakerOpenUntil = new Date(Date.now() + 60000); // Open for 1 minute

        logger.error('[ConnectionPool] Circuit breaker OPENED - too many failures');
        this.emit('circuit-breaker-open');
    }

    private closeCircuitBreaker(): void {
        if (this.circuitBreakerOpen) {
            this.circuitBreakerOpen = false;
            this.circuitBreakerOpenUntil = undefined;

            logger.info('[ConnectionPool] Circuit breaker CLOSED - connections restored');
            this.emit('circuit-breaker-closed');
        }
    }

    private isCircuitBreakerOpen(): boolean {
        if (!this.circuitBreakerOpen) {
            return false;
        }

        // Auto-close circuit breaker after timeout
        if (this.circuitBreakerOpenUntil && new Date() > this.circuitBreakerOpenUntil) {
            this.closeCircuitBreaker();
            return false;
        }

        return true;
    }
}

export default ConnectionPool;
