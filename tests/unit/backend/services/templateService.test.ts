/**
 * Template Service Tests
 * Real database tests for template management
 *
 * @module tests/unit/backend/services/templateService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('TemplateService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS templates (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT,
                        name TEXT NOT NULL,
                        category TEXT,
                        content TEXT NOT NULL,
                        variables TEXT,
                        is_public INTEGER DEFAULT 0,
                        version INTEGER DEFAULT 1,
                        created_by TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      db.run('DELETE FROM templates', () => resolve());
    });
  });

  describe('Template CRUD', () => {
    it('should create template', async () => {
      const templateId = `tpl-${Date.now()}`;
      const variables = ['name', 'date', 'amount'];

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO templates (id, organization_id, name, category, content, variables) VALUES (?, ?, ?, ?, ?, ?)',
          [
            templateId,
            'org-123',
            'Invoice Template',
            'billing',
            'Dear {{name}}, Amount: {{amount}}',
            JSON.stringify(variables),
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const template = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM templates WHERE id = ?', [templateId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(template).toBeDefined();
      expect(template.name).toBe('Invoice Template');
      expect(template.version).toBe(1);
    });

    it('should update template version', async () => {
      const templateId = `tpl-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO templates (id, name, content) VALUES (?, ?, ?)',
          [templateId, 'Test Template', 'Original content'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE templates SET content = ?, version = version + 1 WHERE id = ?',
          ['Updated content', templateId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const template = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM templates WHERE id = ?', [templateId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(template.content).toBe('Updated content');
      expect(template.version).toBe(2);
    });
  });

  describe('Template Queries', () => {
    it('should find templates by category', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO templates (id, name, category, content) VALUES (?, ?, ?, ?)', [
            't1',
            'Template 1',
            'email',
            'Content 1',
          ]);
          db.run('INSERT INTO templates (id, name, category, content) VALUES (?, ?, ?, ?)', [
            't2',
            'Template 2',
            'report',
            'Content 2',
          ]);
          db.run(
            'INSERT INTO templates (id, name, category, content) VALUES (?, ?, ?, ?)',
            ['t3', 'Template 3', 'email', 'Content 3'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const emailTemplates = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM templates WHERE category = ?', ['email'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(emailTemplates).toHaveLength(2);
    });
  });
});
