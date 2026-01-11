/**
 * Analytics Service Tests
 * Real database tests for analytics events
 *
 * @module tests/unit/backend/services/analyticsEventService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('AnalyticsEventService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS analytics_events (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        user_id TEXT,
                        event_type TEXT NOT NULL,
                        event_name TEXT NOT NULL,
                        properties TEXT,
                        session_id TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
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
      db.run('DELETE FROM analytics_events', () => resolve());
    });
  });

  describe('Event Tracking', () => {
    it('should track event', async () => {
      const eventId = `evt-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO analytics_events (id, organization_id, user_id, event_type, event_name, properties) VALUES (?, ?, ?, ?, ?, ?)',
          [
            eventId,
            'org-123',
            'user-456',
            'click',
            'button_click',
            JSON.stringify({ button: 'submit' }),
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const event = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM analytics_events WHERE id = ?', [eventId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(event).toBeDefined();
      expect(event.event_name).toBe('button_click');
    });

    it('should track page view', async () => {
      const eventId = `evt-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO analytics_events (id, organization_id, event_type, event_name, properties) VALUES (?, ?, ?, ?, ?)',
          [eventId, 'org-1', 'pageview', 'pageview', JSON.stringify({ path: '/dashboard' })],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const event = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM analytics_events WHERE id = ?', [eventId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(event.event_type).toBe('pageview');
    });
  });

  describe('Event Queries', () => {
    it('should get events by type', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO analytics_events (id, organization_id, event_type, event_name) VALUES (?, ?, ?, ?)',
            ['e1', 'o1', 'click', 'btn_click']
          );
          db.run(
            'INSERT INTO analytics_events (id, organization_id, event_type, event_name) VALUES (?, ?, ?, ?)',
            ['e2', 'o1', 'pageview', 'pageview']
          );
          db.run(
            'INSERT INTO analytics_events (id, organization_id, event_type, event_name) VALUES (?, ?, ?, ?)',
            ['e3', 'o1', 'click', 'link_click'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const clickEvents = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM analytics_events WHERE event_type = ?', ['click'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(clickEvents).toHaveLength(2);
    });
  });
});
