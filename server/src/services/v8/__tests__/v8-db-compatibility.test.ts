/**
 * V8 DB Compatibility Test Suite — CP-02
 *
 * Connects to the real Railway Postgres and verifies:
 *   1. v8 schema existence and table/index counts
 *   2. CRUD operations on key tables
 *   3. Postgres-specific constraint behaviour (CHECK, DEFAULT CURRENT_TIMESTAMP)
 *   4. Documents SQLite-vs-Postgres incompatibilities
 *
 * Runs ONLY when V8_DB_TEST_MODE=real (skipped otherwise).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  connectV8Db,
  disconnectV8Db,
  getV8DbClient,
  getV8IndexCount,
  getV8TableCount,
  getV8TableNames,
  isRealDbMode,
} from './helpers/v8-db-test-setup.js';

const SKIP_REASON = 'Skipped: V8_DB_TEST_MODE !== "real"';

describe('V8 DB Compatibility', () => {
  beforeAll(async () => {
    if (!isRealDbMode()) return;
    await connectV8Db();
  });

  afterAll(async () => {
    if (!isRealDbMode()) return;
    await disconnectV8Db();
  });

  // ========================================
  // Schema verification
  // ========================================

  describe('Schema verification', () => {
    it('v8 schema exists', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true); // skip gracefully

      const client = getV8DbClient();
      const result = await client.query(
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'v8'"
      );
      expect(result.rows.length).toBe(1);
    });

    it('has expected number of tables (>= 40)', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true);

      const count = await getV8TableCount();
      console.log(`[V8-DB-Test] Tables found: ${count}`);
      expect(count).toBeGreaterThanOrEqual(40);
    });

    it('has indexes', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true);

      const count = await getV8IndexCount();
      console.log(`[V8-DB-Test] Indexes found: ${count}`);
      expect(count).toBeGreaterThan(0);
    });

    it('lists all v8 table names', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true);

      const names = await getV8TableNames();
      console.log(`[V8-DB-Test] Tables:\n  ${names.join('\n  ')}`);
      expect(names.length).toBeGreaterThanOrEqual(40);

      expect(names).toContain('v8_context_snapshots');
      expect(names).toContain('v8_feature_flags');
      expect(names).toContain('v8_tool_catalog');
    });
  });

  // ========================================
  // Key table CRUD
  // ========================================

  describe('Key table CRUD', () => {
    it('can insert and read from v8_context_snapshots', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true);

      const client = getV8DbClient();
      const id = `test-snap-${Date.now()}`;

      await client.query(
        `INSERT INTO v8.v8_context_snapshots
         (snapshot_id, workspace_id, organization_id, effective_scope_ref,
          resolved_role_ref, initiator_user_id, consumer_class)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, 'ws-1', 'org-1', 'scope-1', 'role-1', 'user-1', 'chat']
      );

      const result = await client.query(
        'SELECT * FROM v8.v8_context_snapshots WHERE snapshot_id = $1',
        [id]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].consumer_class).toBe('chat');

      await client.query('DELETE FROM v8.v8_context_snapshots WHERE snapshot_id = $1', [id]);
    });

    it('can insert and read from v8_feature_flags', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true);

      const client = getV8DbClient();
      const id = `test-flag-${Date.now()}`;

      await client.query(
        `INSERT INTO v8.v8_feature_flags (flag_id, organization_id, module, enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, 'org-test', 'chat', 1, new Date().toISOString()]
      );

      const result = await client.query('SELECT * FROM v8.v8_feature_flags WHERE flag_id = $1', [
        id,
      ]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].enabled).toBe(1);

      await client.query('DELETE FROM v8.v8_feature_flags WHERE flag_id = $1', [id]);
    });

    it('can insert and read from v8_tool_catalog', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true);

      const client = getV8DbClient();
      const id = `test-tool-${Date.now()}`;

      await client.query(
        `INSERT INTO v8.v8_tool_catalog
         (tool_id, organization_id, name, description, category, risk_class, mutation_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, 'org-1', 'Test Tool', 'A test tool', 'retrieval', 'low_risk', 'read_only']
      );

      const result = await client.query('SELECT * FROM v8.v8_tool_catalog WHERE tool_id = $1', [
        id,
      ]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe('Test Tool');
      expect(result.rows[0].risk_class).toBe('low_risk');

      await client.query('DELETE FROM v8.v8_tool_catalog WHERE tool_id = $1', [id]);
    });
  });

  // ========================================
  // Postgres compatibility checks
  // ========================================

  describe('Postgres compatibility checks', () => {
    it('CHECK constraint rejects invalid consumer_class', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true);

      const client = getV8DbClient();
      const id = `test-check-${Date.now()}`;

      await expect(
        client.query(
          `INSERT INTO v8.v8_context_snapshots
           (snapshot_id, workspace_id, organization_id, effective_scope_ref,
            resolved_role_ref, initiator_user_id, consumer_class)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, 'ws-1', 'org-1', 'scope-1', 'role-1', 'user-1', 'INVALID_CLASS']
        )
      ).rejects.toThrow();
    });

    it('CHECK constraint rejects invalid tool category', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true);

      const client = getV8DbClient();
      const id = `test-cat-${Date.now()}`;

      await expect(
        client.query(
          `INSERT INTO v8.v8_tool_catalog
           (tool_id, organization_id, name, description, category, risk_class, mutation_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, 'org-1', 'Bad Tool', 'desc', 'INVALID_CATEGORY', 'low_risk', 'read_only']
        )
      ).rejects.toThrow();
    });

    it('DEFAULT values are applied (captured_at / created_at)', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true);

      const client = getV8DbClient();
      const id = `test-ts-${Date.now()}`;

      await client.query(
        `INSERT INTO v8.v8_context_snapshots
         (snapshot_id, workspace_id, organization_id, effective_scope_ref,
          resolved_role_ref, initiator_user_id, consumer_class)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, 'ws-1', 'org-1', 'scope-1', 'role-1', 'user-1', 'chat']
      );

      const result = await client.query(
        'SELECT created_at, captured_at FROM v8.v8_context_snapshots WHERE snapshot_id = $1',
        [id]
      );

      expect(result.rows[0].created_at).toBeTruthy();
      expect(result.rows[0].captured_at).toBeTruthy();

      await client.query('DELETE FROM v8.v8_context_snapshots WHERE snapshot_id = $1', [id]);
    });

    it('partial indexes exist (conversation_id WHERE NOT NULL)', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true);

      const client = getV8DbClient();
      const result = await client.query(
        `SELECT indexname, indexdef FROM pg_indexes
         WHERE schemaname = 'v8'
           AND indexdef LIKE '%WHERE%'
         ORDER BY indexname`
      );

      console.log(
        `[V8-DB-Test] Partial indexes:\n  ${result.rows.map((r: { indexname: string }) => r.indexname).join('\n  ')}`
      );
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('UNIQUE constraint on v8_feature_flags(organization_id, module)', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true);

      const client = getV8DbClient();
      const id1 = `test-uniq1-${Date.now()}`;
      const id2 = `test-uniq2-${Date.now()}`;
      const orgId = `org-uniq-${Date.now()}`;

      await client.query(
        `INSERT INTO v8.v8_feature_flags (flag_id, organization_id, module, enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [id1, orgId, 'chat', 1, new Date().toISOString()]
      );

      await expect(
        client.query(
          `INSERT INTO v8.v8_feature_flags (flag_id, organization_id, module, enabled, updated_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [id2, orgId, 'chat', 0, new Date().toISOString()]
        )
      ).rejects.toThrow();

      await client.query('DELETE FROM v8.v8_feature_flags WHERE flag_id = $1', [id1]);
    });
  });

  // ========================================
  // SQLite compatibility notes
  // ========================================

  describe('SQLite-vs-Postgres compatibility notes', () => {
    it('documents datetime("now") incompatibility', async () => {
      if (!isRealDbMode()) return expect(true).toBe(true);

      const client = getV8DbClient();

      // datetime('now') is SQLite-specific — Postgres uses CURRENT_TIMESTAMP or NOW()
      // The v8 migrations use datetime('now') in DEFAULT clauses.
      // Postgres accepts this in CREATE TABLE only if the migration runner
      // rewrites it to CURRENT_TIMESTAMP. Verify the actual default works:
      await expect(client.query("SELECT datetime('now')")).rejects.toThrow(); // Postgres does not have datetime() function

      // But CURRENT_TIMESTAMP works:
      const result = await client.query('SELECT CURRENT_TIMESTAMP AS ts');
      expect(result.rows[0].ts).toBeTruthy();
    });

    it('documents ? vs $1 placeholder difference', () => {
      // SQLite uses ? positional placeholders
      // Postgres uses $1, $2, ... numbered placeholders
      // The pg driver does NOT accept ? — all queries must use $N
      // V8 services that use DbPromise already use $1 style in many places,
      // but any remaining ? usage will fail against real Postgres.
      expect(true).toBe(true); // documented — no runtime assertion needed
    });
  });
});
