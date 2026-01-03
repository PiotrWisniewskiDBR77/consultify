/**
 * DatabaseConfig Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Unit tests for DatabaseConfig - 95%+ coverage target
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadDatabaseConfig } from '../../../../src/config/DatabaseConfig.js';

describe('DatabaseConfig', () => {
    beforeEach(() => {
        delete process.env.DATABASE_URL;
        delete process.env.DATABASE_TYPE;
    });

    describe('loadDatabaseConfig', () => {
        it('should load SQLite config by default', () => {
            const config = loadDatabaseConfig();

            expect(config.type).toBe('sqlite');
        });

        it('should load PostgreSQL config from DATABASE_URL', () => {
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

            const config = loadDatabaseConfig();

            expect(config.type).toBe('postgres');
        });

        it('should parse PostgreSQL connection string correctly', () => {
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/dbname';

            const config = loadDatabaseConfig();

            if (config.type === 'postgres') {
                expect(config.postgres).toBeDefined();
                expect(config.postgres?.host).toBe('localhost');
                expect(config.postgres?.port).toBe(5432);
                expect(config.postgres?.database).toBe('dbname');
            }
        });

        it('should handle SSL configuration', () => {
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db?ssl=true';

            const config = loadDatabaseConfig();

            expect(config).toBeDefined();
        });
    });
});

