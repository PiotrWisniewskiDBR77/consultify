/**
 * Type declarations for 'redis' module
 * Note: Install @types/redis or redis package for full types
 */

declare module 'redis' {
    export interface RedisClientType {
        get(key: string): Promise<string | null>;
        set(key: string, value: string, options?: any): Promise<string | null>;
        del(key: string): Promise<number>;
        exists(key: string): Promise<number>;
        expire(key: string, seconds: number): Promise<boolean>;
        [key: string]: any;
    }

    export function createClient(options?: any): RedisClientType;
}
