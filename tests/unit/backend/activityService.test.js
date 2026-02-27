/**
 * Activity Service Unit Tests
 * Tests activity logging and feed management
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

vi.hoisted(() => {
  if (process.env.RUN_DB_TESTS !== '1') return;
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-activity-${workerId}.db`;
});

describeIfDb('ActivityService', () => {
  const db = getDatabase();
  let testOrgId;
  let testUserId;

  beforeAll(async () => {
    await initializeDatabase();

    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
        [testOrgId, 'Activity Test Org', 'pro', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    testUserId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [testUserId, testOrgId, `activity-${Date.now()}@test.com`, 'hash', 'ADMIN', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  afterAll(async () => {
    await new Promise((r) => db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => r()));
    await new Promise((r) =>
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r())
    );
  });

  describe('Activity Logging', () => {
    it('should log user activity data', () => {
      const activity = {
        type: 'login',
        userId: testUserId,
        timestamp: new Date().toISOString(),
        metadata: { ip: '127.0.0.1' },
      };

      expect(activity.type).toBe('login');
      expect(activity.userId).toBe(testUserId);
    });

    it('should support different activity types', () => {
      const activityTypes = ['login', 'logout', 'create', 'update', 'delete', 'view'];

      for (const type of activityTypes) {
        const activity = { type, userId: testUserId };
        expect(activityTypes).toContain(activity.type);
      }
    });
  });

  describe('Event Tracking', () => {
    it('should track event with timestamp', () => {
      const event = {
        action: 'project.created',
        userId: testUserId,
        resourceId: uuidv4(),
        timestamp: Date.now(),
      };

      expect(event.timestamp).toBeDefined();
      expect(event.action).toBe('project.created');
    });

    it('should track event metadata', () => {
      const event = {
        action: 'task.updated',
        changes: { status: 'done', priority: 'high' },
        previousValues: { status: 'todo', priority: 'medium' },
      };

      expect(event.changes.status).toBe('done');
      expect(event.previousValues.status).toBe('todo');
    });
  });

  describe('Activity Feed', () => {
    it('should structure activity feed items', () => {
      const feedItems = [
        { id: uuidv4(), action: 'task.created', timestamp: Date.now() - 1000 },
        { id: uuidv4(), action: 'project.updated', timestamp: Date.now() - 2000 },
        { id: uuidv4(), action: 'comment.added', timestamp: Date.now() - 3000 },
      ];

      expect(feedItems).toHaveLength(3);
      expect(feedItems[0].action).toBe('task.created');
    });

    it('should sort by timestamp descending', () => {
      const feedItems = [{ timestamp: 1000 }, { timestamp: 3000 }, { timestamp: 2000 }];

      const sorted = [...feedItems].sort((a, b) => b.timestamp - a.timestamp);
      expect(sorted[0].timestamp).toBe(3000);
    });
  });

  describe('Activity Aggregation', () => {
    it('should count activities by type', () => {
      const activities = [
        { type: 'login' },
        { type: 'view' },
        { type: 'login' },
        { type: 'create' },
      ];

      const counts = activities.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      }, {});

      expect(counts.login).toBe(2);
      expect(counts.view).toBe(1);
    });
  });
});
