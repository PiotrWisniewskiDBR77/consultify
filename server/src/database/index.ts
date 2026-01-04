/**
 * Database Module Exports
 * Enterprise SaaS Architecture - TypeScript Backend
 */

export {
    type DatabaseConfig,
    databaseConfig,
    type DatabaseType,
    type PostgresConfig,
    type SQLiteConfig,
} from '../config/DatabaseConfig.ts';
export { createDatabase, getDatabase, type MockDatabase } from './Database.ts';
export { default } from './Database.ts';
export type { IDatabase, QueryResult, RunResult } from './IDatabase.ts';

