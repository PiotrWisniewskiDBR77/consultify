// Parse Redis connection from REDIS_URL (Railway format) or individual components
const parseRedisConfig = () => {
    if (process.env.MOCK_REDIS === 'true') {
        return {};
    }

    // Priority 1: REDIS_URL (Railway format: redis://user:pass@host:port)
    if (process.env.REDIS_URL) {
        try {
            const url = new URL(process.env.REDIS_URL);
            return {
                connection: {
                    host: url.hostname,
                    port: parseInt(url.port || '6379', 10),
                    password: url.password || undefined,
                    username: url.username || undefined
                }
            };
        } catch (err) {
            console.warn('[Queue Config] Failed to parse REDIS_URL, falling back to individual components:', err.message);
        }
    }

    // Priority 2: Individual components (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD)
    return {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined
        }
    };
};

const redisConfig = parseRedisConfig();
module.exports = redisConfig;
