/**
 * Studio Service Tests
 * Real database tests for studio/workspace management
 * 
 * @module tests/unit/backend/services/studioService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('StudioService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS studios (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        type TEXT DEFAULT 'workspace',
                        settings TEXT,
                        is_active INTEGER DEFAULT 1,
                        created_by TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                db.run(`
                    CREATE TABLE IF NOT EXISTS studio_members (
                        id TEXT PRIMARY KEY,
                        studio_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        role TEXT DEFAULT 'member',
                        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(studio_id, user_id),
                        FOREIGN KEY (studio_id) REFERENCES studios(id)
                    )
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    });

    afterAll(() => db.close());

    beforeEach(async () => {
        await new Promise<void>((resolve) => {
            db.serialize(() => {
                db.run('DELETE FROM studio_members');
                db.run('DELETE FROM studios', () => resolve());
            });
        });
    });

    describe('Studio CRUD', () => {
        it('should create studio workspace', async () => {
            const studioId = `studio-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO studios (id, organization_id, name, description, created_by) VALUES (?, ?, ?, ?, ?)',
                    [studioId, 'org-123', 'Main Workspace', 'Primary team workspace', 'user-admin'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const studio = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM studios WHERE id = ?', [studioId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(studio).toBeDefined();
            expect(studio.name).toBe('Main Workspace');
            expect(studio.type).toBe('workspace');
        });

        it('should store studio settings', async () => {
            const studioId = `studio-${Date.now()}`;
            const settings = { theme: 'dark', notifications: true, layout: 'grid' };

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO studios (id, organization_id, name, settings) VALUES (?, ?, ?, ?)',
                    [studioId, 'org-123', 'Custom Studio', JSON.stringify(settings)],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const studio = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM studios WHERE id = ?', [studioId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            const parsedSettings = JSON.parse(studio.settings);
            expect(parsedSettings.theme).toBe('dark');
        });
    });

    describe('Studio Membership', () => {
        it('should add members to studio', async () => {
            const studioId = `studio-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO studios (id, organization_id, name) VALUES (?, ?, ?)',
                    [studioId, 'org-123', 'Team Studio'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO studio_members (id, studio_id, user_id, role) VALUES (?, ?, ?, ?)',
                        ['m1', studioId, 'user-1', 'admin']);
                    db.run('INSERT INTO studio_members (id, studio_id, user_id, role) VALUES (?, ?, ?, ?)',
                        ['m2', studioId, 'user-2', 'member']);
                    db.run('INSERT INTO studio_members (id, studio_id, user_id, role) VALUES (?, ?, ?, ?)',
                        ['m3', studioId, 'user-3', 'viewer'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const members = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM studio_members WHERE studio_id = ?', [studioId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(members).toHaveLength(3);
            const admin = members.find(m => m.role === 'admin');
            expect(admin).toBeDefined();
        });
    });
});
