export interface RedisConnectionConfig {
    host: string;
    port: number;
    password?: string;
}
export interface QueueConfig {
    connection?: RedisConnectionConfig;
}
declare const redisConfig: QueueConfig;
export default redisConfig;
//# sourceMappingURL=queue.config.d.ts.map