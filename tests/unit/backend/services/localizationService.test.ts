/**
 * Localization Service Tests
 * Real database tests for localization
 *
 * @module tests/unit/backend/services/localizationService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('LocalizationService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS translations (
                        id TEXT PRIMARY KEY,
                        key TEXT NOT NULL,
                        locale TEXT NOT NULL,
                        value TEXT NOT NULL,
                        namespace TEXT DEFAULT 'common',
                        is_approved INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(key, locale, namespace)
                    )
                `,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.run('DELETE FROM translations', () => resolve());
    });
  });

  describe('Translation CRUD', () => {
    it('should create translation', async () => {
      const translationId = `trans-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO translations (id, key, locale, value, namespace) VALUES (?, ?, ?, ?, ?)',
          [translationId, 'common.save', 'pl', 'Zapisz', 'buttons'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const translation = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM translations WHERE id = ?', [translationId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(translation.value).toBe('Zapisz');
      expect(translation.locale).toBe('pl');
    });

    it('should update translation', async () => {
      const translationId = `trans-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO translations (id, key, locale, value) VALUES (?, ?, ?, ?)',
          [translationId, 'greeting', 'en', 'Hello'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE translations SET value = ? WHERE id = ?',
          ['Hi there', translationId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const translation = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM translations WHERE id = ?', [translationId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(translation.value).toBe('Hi there');
    });
  });

  describe('Translation Queries', () => {
    it('should get translations by locale', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO translations (id, key, locale, value) VALUES (?, ?, ?, ?)', [
            't1',
            'hello',
            'pl',
            'Cześć',
          ]);
          db.run('INSERT INTO translations (id, key, locale, value) VALUES (?, ?, ?, ?)', [
            't2',
            'goodbye',
            'pl',
            'Do widzenia',
          ]);
          db.run(
            'INSERT INTO translations (id, key, locale, value) VALUES (?, ?, ?, ?)',
            ['t3', 'hello', 'de', 'Hallo'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const plTranslations = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM translations WHERE locale = ?', ['pl'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(plTranslations).toHaveLength(2);
    });
  });
});
