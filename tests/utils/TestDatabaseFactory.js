
import sqlite3 from 'sqlite3';
import { TEST_SCHEMA } from './testSchema.js';

export class TestDatabaseFactory {
    static async create() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(':memory:', async (err) => {
                if (err) return reject(err);

                // Initialize schema
                try {
                    await this.initSchema(db);

                    // Wrap with async helper methods that match server/database.js usage
                    // but also keep the callback style for backward compatibility
                    this.enhanceDb(db);

                    resolve(db);
                } catch (schemaErr) {
                    reject(schemaErr);
                }
            });
        });
    }

    static async initSchema(db) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                let completed = 0;
                let failed = false;

                // Disable foreign keys for schema setup to avoid order issues
                db.run('PRAGMA foreign_keys = OFF');

                TEST_SCHEMA.forEach((sql) => {
                    if (failed) return;
                    db.run(sql, (err) => {
                        if (err && !failed) {
                            failed = true;
                            reject(err);
                        }
                    });
                });

                // Wait for queue to drain (serialize ensures order, but we need to know when done)
                // A simple query at the end will confirm
                db.run('PRAGMA foreign_keys = ON', (err) => {
                    if (err && !failed) reject(err);
                    else if (!failed) resolve();
                });
            });
        });
    }

    static enhanceDb(db) {
        // Add async wrappers if missing (server/database.js usually just exports the sqlite instance directly in test mode)
        // But some services might expect .runAsync if they use a promise wrapper.
        // For now, we return the raw sqlite3 instance because that's what `server/database.js` does for `database.sqlite.active.js`.

        // However, we can add a helper to close it cleanly
        db.destroy = () => {
            return new Promise((resolve) => db.close(resolve));
        };
    }
}
