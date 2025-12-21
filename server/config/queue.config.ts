export interface RedisConnectionConfig {
    host: string;
    port: number;
    password?: string;
}

export interface QueueConfig {
    connection?: RedisConnectionConfig;
}

const redisConfig: QueueConfig = process.env.MOCK_REDIS === 'true' ? {} : {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined
    }
};

export default redisConfig;

