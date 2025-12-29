/**
 * Redis Client for AI Services
 * Handles connection, reconnection, and provides a unified interface
 * 
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Graceful fallback when Redis unavailable
 * - Connection health monitoring
 */

const { aiLogger } = require('./logger');

let redisClient = null;
let isConnected = false;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000; // 1 second

/**
 * Initialize Redis connection
 * @param {string} redisUrl - Redis connection URL (e.g., redis://localhost:6379)
 * @returns {Promise<object|null>} Redis client or null if unavailable
 */
async function initRedis(redisUrl) {
    // Check if Railway variable expansion didn't work (still contains ${{)
    if (redisUrl && redisUrl.includes('${{')) {
        aiLogger.warn('Redis', `REDIS_URL appears to contain unexpanded Railway variable: ${redisUrl}`);
        aiLogger.warn('Redis', 'Falling back to in-memory fallback');
        redisUrl = null;
    }
    
    if (!redisUrl) {
        aiLogger.info('Redis', 'No REDIS_URL configured, using in-memory fallback');
        return null;
    }

    // Check if MOCK_REDIS is set (for development without Redis)
    if (process.env.MOCK_REDIS === 'true') {
        aiLogger.info('Redis', 'MOCK_REDIS enabled, using in-memory fallback');
        return null;
    }

    try {
        const redis = require('redis');
        
        const connectTimeout = parseInt(process.env.REDIS_CONNECT_TIMEOUT || '30000', 10); // 30 seconds default for Railway
        const commandTimeout = parseInt(process.env.REDIS_COMMAND_TIMEOUT || '10000', 10); // 10 seconds for commands
        
        redisClient = redis.createClient({
            url: redisUrl,
            socket: {
                connectTimeout: connectTimeout,
                commandTimeout: commandTimeout,
                reconnectStrategy: (retries) => {
                    if (retries > MAX_RECONNECT_ATTEMPTS) {
                        aiLogger.error('Redis', `Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) exceeded`);
                        return new Error('Max reconnection attempts exceeded');
                    }
                    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, retries), 30000);
                    aiLogger.info('Redis', `Reconnecting in ${delay}ms (attempt ${retries})`);
                    return delay;
                }
            }
        });

        // Event handlers
        redisClient.on('connect', () => {
            aiLogger.info('Redis', 'Connecting...');
        });

        redisClient.on('ready', () => {
            isConnected = true;
            connectionAttempts = 0;
            aiLogger.info('Redis', 'Connected and ready');
        });

        redisClient.on('error', (err) => {
            aiLogger.error('Redis', 'Connection error', err);
        });

        redisClient.on('end', () => {
            isConnected = false;
            aiLogger.warn('Redis', 'Connection closed');
        });

        redisClient.on('reconnecting', () => {
            connectionAttempts++;
            aiLogger.info('Redis', `Reconnecting (attempt ${connectionAttempts})`);
        });

        await redisClient.connect();
        return redisClient;

    } catch (error) {
        aiLogger.error('Redis', 'Failed to initialize', error);
        redisClient = null;
        return null;
    }
}

/**
 * Get the Redis client (or null if not connected)
 */
function getRedisClient() {
    return isConnected ? redisClient : null;
}

/**
 * Check if Redis is connected
 */
function isRedisConnected() {
    return isConnected && redisClient !== null;
}

/**
 * Gracefully close Redis connection
 */
async function closeRedis() {
    if (redisClient) {
        try {
            await redisClient.quit();
            aiLogger.info('Redis', 'Connection closed gracefully');
        } catch (e) {
            aiLogger.error('Redis', 'Error closing connection', e);
        }
        redisClient = null;
        isConnected = false;
    }
}

/**
 * Health check for Redis
 */
async function healthCheck() {
    if (!redisClient || !isConnected) {
        return { status: 'disconnected', latency: null };
    }

    try {
        const start = Date.now();
        await redisClient.ping();
        const latency = Date.now() - start;
        return { status: 'healthy', latency };
    } catch (e) {
        return { status: 'error', error: e.message };
    }
}

module.exports = {
    initRedis,
    getRedisClient,
    isRedisConnected,
    closeRedis,
    healthCheck
};

