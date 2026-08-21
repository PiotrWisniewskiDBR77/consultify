import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Migration Runner', () => {
  it('accepts every exact approved historical checksum variant and rejects unknown history', async () => {
    const { classifyMigrationChecksum } = await import('../migrationIdentity.js');
    const current = fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/20260623_distribution_delivery.sql'),
      'utf-8'
    );

    expect(
      classifyMigrationChecksum('20260623_distribution_delivery.sql', 'afb449dbaf10f409', current)
    ).toBe('accepted_historical_variant');
    expect(
      classifyMigrationChecksum('20260623_distribution_delivery.sql', '7712332cdc298d49', current)
    ).toBe('accepted_historical_variant');
    expect(
      classifyMigrationChecksum('20260623_distribution_delivery.sql', '0000000000000000', current)
    ).toBe('drift');
    expect(
      classifyMigrationChecksum(
        '20260623_distribution_delivery.sql',
        '7712332cdc298d49',
        `${current}\n-- unreviewed edit`
      )
    ).toBe('drift');
  });

  it('keeps the mounted Studio persistence producer in the strict Postgres path', async () => {
    const { PROMOTED_LEGACY_SET } = await import('../../../../scripts/migrationOrdering.js');
    const runner = fs.readFileSync(
      path.resolve(process.cwd(), 'server/scripts/migrate.postgres.ts'),
      'utf-8'
    );

    expect(PROMOTED_LEGACY_SET.has('081_studio_tables.sql')).toBe(true);
    expect(runner).toContain('PROMOTED_LEGACY_SET.has(m.filename)');
  });

  it('runtime discovery includes the MAT-010 operation-claims producer', async () => {
    const { isRuntimeMigrationFile } = await import('../migrationIdentity.js');

    expect(isRuntimeMigrationFile('20260802c_mat010_operation_claims_table.sql')).toBe(true);
  });

  it('runtime discovery includes the curated workbook lifecycle repair', async () => {
    const { isRuntimeMigrationFile } = await import('../migrationIdentity.js');

    expect(isRuntimeMigrationFile('20260807_approve_dbr77_workbook_templates.sql')).toBe(true);
    expect(isRuntimeMigrationFile('946_approve_dbr77_workbook_templates.sql')).toBe(false);
  });

  it('all 27 migration files exist (700-726)', () => {
    const migrationsDir = path.resolve(process.cwd(), 'server/migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => /^7\d{2}_.*\.sql$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(25);

    const numbers = files.map((f) => parseInt(f.split('_')[0], 10)).sort((a, b) => a - b);
    expect(numbers[0]).toBe(700);
    expect(numbers.includes(724)).toBe(true);
  });

  it('migration files are sorted sequentially with no gaps in 700-724', () => {
    const migrationsDir = path.resolve(process.cwd(), 'server/migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => /^7\d{2}_.*\.sql$/.test(f));
    const numbers = files.map((f) => parseInt(f.split('_')[0], 10)).sort((a, b) => a - b);

    for (let i = 700; i <= 724; i++) {
      expect(numbers).toContain(i);
    }
  });

  it('each migration file contains valid SQL', () => {
    const migrationsDir = path.resolve(process.cwd(), 'server/migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => /^7\d{2}_.*\.sql$/.test(f));

    for (const file of files) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      expect(content.length).toBeGreaterThan(10);
      const hasSQL = /CREATE|ALTER|INSERT|DROP|SELECT/i.test(content);
      expect(hasSQL).toBe(true);
    }
  });

  it('foundation migration 700 creates core tables', () => {
    const migrationsDir = path.resolve(process.cwd(), 'server/migrations');
    const content = fs.readFileSync(
      path.join(migrationsDir, '700_table_platform_foundation.sql'),
      'utf-8'
    );
    expect(content).toContain('tp_bases');
    expect(content).toContain('tp_tables');
    expect(content).toContain('tp_fields');
    expect(content).toContain('tp_records');
    expect(content).toContain('tp_views');
  });

  it('new migrations 725 and 726 exist', () => {
    const migrationsDir = path.resolve(process.cwd(), 'server/migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => /^7\d{2}_.*\.sql$/.test(f));
    const numbers = files.map((f) => parseInt(f.split('_')[0], 10));
    expect(numbers).toContain(725);
    expect(numbers).toContain(726);
  });
});

describe('canonical-to-TP migration ledger reconciliation', () => {
  const file = '700_runtime_reconciliation_probe.sql';
  let dir: string;
  let content: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'consultify-ledger-reconcile-'));
    content = 'CREATE TABLE runtime_reconciliation_probe (id TEXT PRIMARY KEY);\n';
    fs.writeFileSync(path.join(dir, file), content, 'utf8');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function fakeDb(options?: {
    canonicalChecksum?: string | null;
    canonicalStatus?: string;
    conflictingInsertChecksum?: string;
    existingTpChecksum?: string;
  }) {
    const tp = new Map<string, string | null>();
    if (options?.existingTpChecksum) tp.set(file, options.existingTpChecksum);
    const checksum =
      options && 'canonicalChecksum' in options
        ? options.canonicalChecksum
        : crypto.createHash('sha256').update(content).digest('hex');
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("to_regclass('public.schema_migrations')")) {
        return { rows: [{ present: true }] };
      }
      if (sql.includes('FROM schema_migrations')) {
        return {
          rows: [
            {
              filename: file,
              checksum,
              status: options?.canonicalStatus ?? 'success',
            },
          ],
        };
      }
      if (sql.startsWith('SELECT filename, checksum FROM tp_migration_history')) {
        return { rows: [...tp].map(([filename, stored]) => ({ filename, checksum: stored })) };
      }
      if (sql.startsWith('INSERT INTO tp_migration_history')) {
        const filename = String(params?.[0]);
        if (!tp.has(filename)) {
          tp.set(filename, options?.conflictingInsertChecksum ?? String(params?.[1]));
        }
        return { rows: [] };
      }
      if (sql.startsWith('SELECT checksum FROM tp_migration_history WHERE filename')) {
        const stored = tp.get(String(params?.[0]));
        return { rows: stored === undefined ? [] : [{ checksum: stored }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    return { db: { query }, tp, query };
  }

  it('copies exact current full-SHA success evidence into the TP ledger', async () => {
    const { reconcileTablePlatformLedgerFromCanonical } = await import('../migrationRunner.js');
    const { db, tp } = fakeDb();

    await expect(reconcileTablePlatformLedgerFromCanonical(db, [file], dir)).resolves.toBe(1);
    expect(tp.get(file)).toBe(
      crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)
    );
  });

  it('fails closed on malformed or stale canonical success checksum without a TP write', async () => {
    const { reconcileTablePlatformLedgerFromCanonical } = await import('../migrationRunner.js');
    const { db, tp } = fakeDb({ canonicalChecksum: '0'.repeat(64) });

    await expect(reconcileTablePlatformLedgerFromCanonical(db, [file], dir)).rejects.toThrow(
      /exact current SHA-256/
    );
    expect(tp.size).toBe(0);
  });

  it('does not trust a conflicting TP row won by a concurrent writer', async () => {
    const { reconcileTablePlatformLedgerFromCanonical } = await import('../migrationRunner.js');
    const { db } = fakeDb({ conflictingInsertChecksum: 'badbadbadbadbadb' });

    await expect(reconcileTablePlatformLedgerFromCanonical(db, [file], dir)).rejects.toThrow(
      /readback mismatch/
    );
  });

  it('does not reconcile a canonical failed row', async () => {
    const { reconcileTablePlatformLedgerFromCanonical } = await import('../migrationRunner.js');
    const { db, tp } = fakeDb({ canonicalStatus: 'failed' });

    await expect(reconcileTablePlatformLedgerFromCanonical(db, [file], dir)).resolves.toBe(0);
    expect(tp.size).toBe(0);
  });

  it('does not retroactively revalidate an already-present TP identity', async () => {
    const { reconcileTablePlatformLedgerFromCanonical } = await import('../migrationRunner.js');
    const { db } = fakeDb({
      canonicalChecksum: 'stale-legacy-value',
      existingTpChecksum: crypto.createHash('sha256').update(content).digest('hex').slice(0, 16),
    });

    await expect(reconcileTablePlatformLedgerFromCanonical(db, [file], dir)).resolves.toBe(0);
  });

  it('runs canonical reconciliation before startup calculates the TP pending set', () => {
    const initializer = fs.readFileSync(
      path.resolve(process.cwd(), 'server/src/database/DatabaseInitializer.ts'),
      'utf-8'
    );
    const reconcileAt = initializer.indexOf(
      'reconcileTablePlatformLedgerFromCanonical(db, allFiles, migrationsDir)'
    );
    const pendingReadAt = initializer.indexOf(
      'SELECT filename FROM tp_migration_history ORDER BY filename'
    );

    expect(reconcileAt).toBeGreaterThan(-1);
    expect(pendingReadAt).toBeGreaterThan(reconcileAt);
  });
});
