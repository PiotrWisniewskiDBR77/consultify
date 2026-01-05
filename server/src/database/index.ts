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
} from '../config/DatabaseConfig.js';
export { createDatabase, getDatabase, type MockDatabase } from './Database.js';
export { default } from './Database.js';
export type { IDatabase, QueryResult, RunResult } from './IDatabase.js';
