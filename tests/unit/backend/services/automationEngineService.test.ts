/**
 * Automation Engine Service Tests
 * Real database tests for workflow automation
 *
 * @module tests/unit/backend/services/automationEngineService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('AutomationEngineService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS automation_rules (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        trigger_type TEXT NOT NULL,
                        trigger_config TEXT,
                        action_type TEXT NOT NULL,
                        action_config TEXT,
                        is_active INTEGER DEFAULT 1,
                        last_triggered_at DATETIME,
                        trigger_count INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS automation_logs (
                        id TEXT PRIMARY KEY,
                        rule_id TEXT NOT NULL,
                        status TEXT NOT NULL,
                        input_data TEXT,
                        output_data TEXT,
                        error TEXT,
                        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (rule_id) REFERENCES automation_rules(id)
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
      db.serialize(() => {
        db.run('DELETE FROM automation_logs');
        db.run('DELETE FROM automation_rules', () => resolve());
      });
    });
  });

  describe('Automation Rules', () => {
    it('should create automation rule', async () => {
      const ruleId = `rule-${Date.now()}`;
      const triggerConfig = { event: 'task_created', conditions: { priority: 'high' } };
      const actionConfig = { action: 'notify', recipients: ['admin@example.com'] };

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO automation_rules (id, organization_id, name, trigger_type, trigger_config, action_type, action_config) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            ruleId,
            'org-123',
            'High Priority Notification',
            'event',
            JSON.stringify(triggerConfig),
            'notification',
            JSON.stringify(actionConfig),
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const rule = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM automation_rules WHERE id = ?', [ruleId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(rule).toBeDefined();
      expect(rule.name).toBe('High Priority Notification');
      expect(rule.is_active).toBe(1);
    });

    it('should toggle rule active status', async () => {
      const ruleId = `rule-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO automation_rules (id, organization_id, name, trigger_type, action_type, is_active) VALUES (?, ?, ?, ?, ?, ?)',
          [ruleId, 'org-123', 'Test Rule', 'schedule', 'email', 1],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE automation_rules SET is_active = 0 WHERE id = ?', [ruleId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const rule = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM automation_rules WHERE id = ?', [ruleId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(rule.is_active).toBe(0);
    });
  });

  describe('Automation Execution', () => {
    it('should log automation execution', async () => {
      const ruleId = `rule-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO automation_rules (id, organization_id, name, trigger_type, action_type) VALUES (?, ?, ?, ?, ?)',
          [ruleId, 'org-123', 'Log Test', 'event', 'action'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO automation_logs (id, rule_id, status, input_data) VALUES (?, ?, ?, ?)',
            [`log-${Date.now()}`, ruleId, 'success', JSON.stringify({ taskId: 'task-123' })]
          );
          db.run(
            'UPDATE automation_rules SET trigger_count = trigger_count + 1, last_triggered_at = datetime("now") WHERE id = ?',
            [ruleId],
            (err) => (err ? reject(err) : resolve())
          );
        });
      });

      const rule = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM automation_rules WHERE id = ?', [ruleId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(rule.trigger_count).toBe(1);
    });
  });
});
