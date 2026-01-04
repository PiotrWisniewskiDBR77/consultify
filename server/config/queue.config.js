const redisConfig = process.env.MOCK_REDIS === 'true' ? {} : {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined
    }
};
export default redisConfig;
//# sourceMappingURL=queue.config.js.map