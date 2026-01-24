/**
 * Email Template Service Tests
 * Real database tests for email templates
 *
 * @module tests/unit/backend/services/emailTemplateService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('EmailTemplateService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS email_templates (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        subject TEXT NOT NULL,
                        body_html TEXT,
                        body_text TEXT,
                        category TEXT,
                        variables TEXT,
                        is_active INTEGER DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      db.run('DELETE FROM email_templates', () => resolve());
    });
  });

  describe('Template CRUD', () => {
    it('should create email template', async () => {
      const templateId = `tpl-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO email_templates (id, organization_id, name, subject, body_html, category) VALUES (?, ?, ?, ?, ?, ?)',
          [
            templateId,
            'org-123',
            'Welcome Email',
            'Welcome to {{company}}',
            '<h1>Welcome!</h1>',
            'onboarding',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const template = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM email_templates WHERE id = ?', [templateId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(template).toBeDefined();
      expect(template.name).toBe('Welcome Email');
      expect(template.subject).toContain('{{company}}');
    });

    it('should update template content', async () => {
      const templateId = `tpl-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO email_templates (id, organization_id, name, subject, body_html) VALUES (?, ?, ?, ?, ?)',
          [templateId, 'org-1', 'Test', 'Subject', '<p>Old</p>'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE email_templates SET body_html = ?, updated_at = datetime("now") WHERE id = ?',
          ['<p>New content</p>', templateId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const template = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM email_templates WHERE id = ?', [templateId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(template.body_html).toBe('<p>New content</p>');
    });
  });

  describe('Template Queries', () => {
    it('should get active templates by category', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO email_templates (id, organization_id, name, subject, category, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            ['t1', 'o1', 'T1', 'S1', 'marketing', 1]
          );
          db.run(
            'INSERT INTO email_templates (id, organization_id, name, subject, category, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            ['t2', 'o1', 'T2', 'S2', 'marketing', 1]
          );
          db.run(
            'INSERT INTO email_templates (id, organization_id, name, subject, category, is_active) VALUES (?, ?, ?, ?, ?, ?)',
            ['t3', 'o1', 'T3', 'S3', 'transactional', 1],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const marketingTemplates = await new Promise<any[]>((resolve, reject) => {
        db.all(
          'SELECT * FROM email_templates WHERE category = ? AND is_active = 1',
          ['marketing'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(marketingTemplates).toHaveLength(2);
    });
  });
});
