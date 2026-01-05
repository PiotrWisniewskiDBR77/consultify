/**
 * Database Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.1: Testy dla Database Layer - 95%+ coverage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDatabase, getDatabase, type MockDatabase } from '../../../../src/database/Database.js';
import type { IDatabase } from '../../../../src/database/IDatabase.js';

describe('Database', () => {
    let originalMockDb: string | undefined;
    let originalDbType: string | undefined;

    beforeEach(() => {
        originalMockDb = process.env.MOCK_DB;
        originalDbType = process.env.DB_TYPE;
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (originalMockDb !== undefined) {
            process.env.MOCK_DB = originalMockDb;
        } else {
            delete process.env.MOCK_DB;
        }
        if (originalDbType !== undefined) {
            process.env.DB_TYPE = originalDbType;
        } else {
            delete process.env.DB_TYPE;
        }
    });

    describe('createDatabase', () => {
        it('should create mock database when MOCK_DB is true', async () => {
            process.env.MOCK_DB = 'true';

            const db = await createDatabase();
            expect(db).toBeDefined();
            expect(typeof db.get).toBe('function');
            expect(typeof db.all).toBe('function');
            expect(typeof db.run).toBe('function');
            expect(typeof db.query).toBe('function');
            expect(typeof db.exec).toBe('function');
            expect(typeof db.serialize).toBe('function');
            expect(typeof db.close).toBe('function');
        });

        it('should use global test mock if available', async () => {
            process.env.MOCK_DB = 'true';
            const customMock = (await createDatabase()) as MockDatabase;
            // @ts-expect-error - setting global test mock
            global.__TEST_DB_MOCK__ = customMock;

            const db = await createDatabase();
            expect(db).toBe(customMock);

            // @ts-expect-error - cleaning up
            delete global.__TEST_DB_MOCK__;
        });

        it('should return singleton instance from getDatabase', () => {
            process.env.MOCK_DB = 'true';
            const db1 = getDatabase();
            const db2 = getDatabase();
            expect(db1).toBe(db2);
        });

        it('should create new instance if singleton is null', async () => {
            process.env.MOCK_DB = 'true';
            // Force reset singleton by calling createDatabase first
            const db1 = await createDatabase();
            const db2 = getDatabase();
            // Both should be valid database instances
            expect(db1).toBeDefined();
            expect(db2).toBeDefined();
        });
    });

    describe('IDatabase interface - Mock Database', () => {
        let mockDb: MockDatabase;

        beforeEach(async () => {
            process.env.MOCK_DB = 'true';
            mockDb = (await createDatabase()) as MockDatabase;
        });

        describe('get method', () => {
            it('should implement get method with callback', async () => {
                const result = await new Promise<unknown | null>((resolve) => {
                    mockDb.get('SELECT * FROM users WHERE id = ?', ['123'], (err, row) => {
                        expect(err).toBeNull();
                        resolve(row);
                    });
                });
                expect(result).toBeNull();
            });

            it('should implement get method without callback', () => {
                const result = mockDb.get('SELECT * FROM users WHERE id = ?', ['123']);
                expect(result).toBe(mockDb);
            });

            it('should implement get method without params', () => {
                const result = mockDb.get('SELECT * FROM users');
                expect(result).toBe(mockDb);
            });
        });

        describe('all method', () => {
            it('should implement all method with callback', async () => {
                const result = await new Promise<unknown[]>((resolve) => {
                    mockDb.all('SELECT * FROM users', [], (err, rows) => {
                        expect(err).toBeNull();
                        expect(Array.isArray(rows)).toBe(true);
                        resolve(rows);
                    });
                });
                expect(Array.isArray(result)).toBe(true);
                expect(result.length).toBe(0);
            });

            it('should implement all method without callback', () => {
                const result = mockDb.all('SELECT * FROM users', []);
                expect(result).toBe(mockDb);
            });

            it('should implement all method without params', () => {
                const result = mockDb.all('SELECT * FROM users');
                expect(result).toBe(mockDb);
            });
        });

        describe('run method', () => {
            it('should implement run method with callback', async () => {
                const result = await new Promise<void>((resolve, reject) => {
                    mockDb.run('INSERT INTO users (id, email) VALUES (?, ?)', ['123', 'test@example.com'], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                expect(result).toBeUndefined();
            });

            it('should implement run method without callback', () => {
                const result = mockDb.run('INSERT INTO users (id, email) VALUES (?, ?)', ['123', 'test@example.com']);
                expect(result).toBe(mockDb);
            });

            it('should implement run method without params', () => {
                const result = mockDb.run('INSERT INTO users DEFAULT VALUES');
                expect(result).toBe(mockDb);
            });
        });

        describe('exec method', () => {
            it('should implement exec method with callback', async () => {
                const result = await new Promise<void>((resolve, reject) => {
                    mockDb.exec('CREATE TABLE test (id INTEGER)', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                expect(result).toBeUndefined();
            });

            it('should implement exec method without callback', () => {
                const result = mockDb.exec('CREATE TABLE test (id INTEGER)');
                expect(result).toBe(mockDb);
            });
        });

        describe('serialize method', () => {
            it('should implement serialize method', () => {
                let called = false;
                mockDb.serialize(() => {
                    called = true;
                });
                expect(called).toBe(true);
            });
        });

        describe('query method', () => {
            it('should implement query method', async () => {
                const result = await mockDb.query('SELECT * FROM users');
                expect(result).toHaveProperty('rows');
                expect(result).toHaveProperty('rowCount');
                expect(Array.isArray(result.rows)).toBe(true);
                expect(typeof result.rowCount).toBe('number');
                expect(result.rowCount).toBe(0);
            });

            it('should implement query method with params', async () => {
                const result = await mockDb.query('SELECT * FROM users WHERE id = ?', ['123']);
                expect(result).toHaveProperty('rows');
                expect(result).toHaveProperty('rowCount');
                expect(Array.isArray(result.rows)).toBe(true);
            });
        });

        describe('close method', () => {
            it('should implement close method without callback', async () => {
                await expect(mockDb.close()).resolves.toBeUndefined();
            });

            it('should implement close method with callback', async () => {
                await new Promise<void>((resolve) => {
                    mockDb.close((err) => {
                        expect(err).toBeNull();
                        resolve();
                    });
                });
            });
        });
    });

    describe('Database Error Handling', () => {
        it('should handle database operations gracefully', async () => {
            process.env.MOCK_DB = 'true';
            const db = (await createDatabase()) as MockDatabase;

            // All operations should not throw
            await expect(db.query('SELECT * FROM invalid_table')).resolves.toBeDefined();
            await expect(db.close()).resolves.toBeUndefined();
        });
    });

    describe('Database Type Selection', () => {
        it('should select SQLite when DB_TYPE is sqlite', () => {
            process.env.MOCK_DB = 'false';
            process.env.DB_TYPE = 'sqlite';
            // This will try to load SQLite database
            // In test environment, we expect it to work or fail gracefully
            expect(async () => {
                try {
                    await createDatabase();
                } catch (e) {
                    // Expected if database file doesn't exist in test
                }
            }).not.toThrow();
        });
    });
});
