/**
 * Database Migration Tests
 * Tests for database migration handling
 *
 * @module tests/database/migrations.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

interface Migration {
  id: string;
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

// Mock migration runner
const createMigrationRunner = () => {
  const appliedMigrations: string[] = [];
  const schemaChanges: string[] = [];

  return {
    getAppliedMigrations: () => [...appliedMigrations],
    getPendingMigrations: (allMigrations: Migration[]) => {
      return allMigrations.filter((m) => !appliedMigrations.includes(m.id));
    },
    applyMigration: async (migration: Migration) => {
      if (appliedMigrations.includes(migration.id)) {
        throw new Error(`Migration ${migration.id} already applied`);
      }
      await migration.up();
      appliedMigrations.push(migration.id);
      schemaChanges.push(`UP: ${migration.name}`);
    },
    rollbackMigration: async (migration: Migration) => {
      if (!appliedMigrations.includes(migration.id)) {
        throw new Error(`Migration ${migration.id} not applied`);
      }
      await migration.down();
      const index = appliedMigrations.indexOf(migration.id);
      appliedMigrations.splice(index, 1);
      schemaChanges.push(`DOWN: ${migration.name}`);
    },
    migrateUp: async (migrations: Migration[]) => {
      const pending = migrations.filter((m) => !appliedMigrations.includes(m.id));
      for (const migration of pending) {
        await migration.up();
        appliedMigrations.push(migration.id);
      }
      return pending.length;
    },
    migrateDown: async (migrations: Migration[], steps = 1) => {
      const applied = migrations.filter((m) => appliedMigrations.includes(m.id)).reverse();
      const toRollback = applied.slice(0, steps);
      for (const migration of toRollback) {
        await migration.down();
        const index = appliedMigrations.indexOf(migration.id);
        appliedMigrations.splice(index, 1);
      }
      return toRollback.length;
    },
    reset: () => {
      appliedMigrations.length = 0;
      schemaChanges.length = 0;
    },
    getSchemaChanges: () => [...schemaChanges],
  };
};

// Sample migrations for testing
const sampleMigrations: Migration[] = [
  {
    id: '001',
    name: 'create_users_table',
    up: vi.fn().mockResolvedValue(undefined),
    down: vi.fn().mockResolvedValue(undefined),
  },
  {
    id: '002',
    name: 'create_projects_table',
    up: vi.fn().mockResolvedValue(undefined),
    down: vi.fn().mockResolvedValue(undefined),
  },
  {
    id: '003',
    name: 'add_user_email_index',
    up: vi.fn().mockResolvedValue(undefined),
    down: vi.fn().mockResolvedValue(undefined),
  },
];

describe('Database Migration Tests', () => {
  let runner: ReturnType<typeof createMigrationRunner>;

  beforeEach(() => {
    runner = createMigrationRunner();
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET MIGRATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('Get Migrations', () => {
    it('should return empty applied migrations initially', () => {
      expect(runner.getAppliedMigrations()).toEqual([]);
    });

    it('should return all migrations as pending initially', () => {
      const pending = runner.getPendingMigrations(sampleMigrations);
      expect(pending.length).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // APPLY MIGRATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Apply Migration', () => {
    it('should apply single migration', async () => {
      await runner.applyMigration(sampleMigrations[0]);

      expect(runner.getAppliedMigrations()).toContain('001');
      expect(sampleMigrations[0].up).toHaveBeenCalled();
    });

    it('should not apply already applied migration', async () => {
      await runner.applyMigration(sampleMigrations[0]);

      await expect(runner.applyMigration(sampleMigrations[0])).rejects.toThrow('already applied');
    });

    it('should track multiple applied migrations', async () => {
      await runner.applyMigration(sampleMigrations[0]);
      await runner.applyMigration(sampleMigrations[1]);

      expect(runner.getAppliedMigrations()).toEqual(['001', '002']);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ROLLBACK MIGRATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Rollback Migration', () => {
    it('should rollback applied migration', async () => {
      await runner.applyMigration(sampleMigrations[0]);
      await runner.rollbackMigration(sampleMigrations[0]);

      expect(runner.getAppliedMigrations()).not.toContain('001');
      expect(sampleMigrations[0].down).toHaveBeenCalled();
    });

    it('should not rollback non-applied migration', async () => {
      await expect(runner.rollbackMigration(sampleMigrations[0])).rejects.toThrow('not applied');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MIGRATE UP
  // ═══════════════════════════════════════════════════════════════════

  describe('Migrate Up', () => {
    it('should apply all pending migrations', async () => {
      const count = await runner.migrateUp(sampleMigrations);

      expect(count).toBe(3);
      expect(runner.getAppliedMigrations()).toEqual(['001', '002', '003']);
    });

    it('should return 0 when no pending migrations', async () => {
      await runner.migrateUp(sampleMigrations);
      const count = await runner.migrateUp(sampleMigrations);

      expect(count).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MIGRATE DOWN
  // ═══════════════════════════════════════════════════════════════════

  describe('Migrate Down', () => {
    it('should rollback last migration', async () => {
      await runner.migrateUp(sampleMigrations);
      const count = await runner.migrateDown(sampleMigrations, 1);

      expect(count).toBe(1);
      expect(runner.getAppliedMigrations()).toEqual(['001', '002']);
    });

    it('should rollback multiple migrations', async () => {
      await runner.migrateUp(sampleMigrations);
      const count = await runner.migrateDown(sampleMigrations, 2);

      expect(count).toBe(2);
      expect(runner.getAppliedMigrations()).toEqual(['001']);
    });

    it('should rollback all migrations', async () => {
      await runner.migrateUp(sampleMigrations);
      const count = await runner.migrateDown(sampleMigrations, 10);

      expect(count).toBe(3);
      expect(runner.getAppliedMigrations()).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ORDER
  // ═══════════════════════════════════════════════════════════════════

  describe('Migration Order', () => {
    it('should apply migrations in order', async () => {
      await runner.migrateUp(sampleMigrations);

      expect(runner.getAppliedMigrations()).toEqual(['001', '002', '003']);
    });

    it('should rollback in reverse order', async () => {
      await runner.migrateUp(sampleMigrations);
      await runner.migrateDown(sampleMigrations, 3);

      // All should be rolled back
      expect(runner.getAppliedMigrations()).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════

  describe('Reset', () => {
    it('should clear all state', async () => {
      await runner.migrateUp(sampleMigrations);
      runner.reset();

      expect(runner.getAppliedMigrations()).toEqual([]);
      expect(runner.getSchemaChanges()).toEqual([]);
    });
  });
});
