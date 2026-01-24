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
    // Add promise wrappers for services expecting async methods
    db.runAsync = function (sql, params = []) {
      return new Promise((resolve, reject) => {
        this.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    };

    db.getAsync = function (sql, params = []) {
      return new Promise((resolve, reject) => {
        this.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
    };

    db.allAsync = function (sql, params = []) {
      return new Promise((resolve, reject) => {
        this.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
    };

    // Alias query to allAsync for DatabaseInitializer compatibility
    db.query = db.allAsync;

    // Helper to close database cleanly
    db.destroy = () => {
      return new Promise((resolve) => db.close(resolve));
    };
  }
}
