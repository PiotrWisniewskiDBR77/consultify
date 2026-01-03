/**
 * Database Module Exports
 * Enterprise SaaS Architecture - TypeScript Backend
 */

export type { IDatabase, QueryResult, RunResult } from './IDatabase.js';
export { createDatabase, getDatabase, type MockDatabase } from './Database.js';
export { databaseConfig, type DatabaseConfig, type DatabaseType, type PostgresConfig, type SQLiteConfig } from '../config/DatabaseConfig.js';
export { default } from './Database.js';



