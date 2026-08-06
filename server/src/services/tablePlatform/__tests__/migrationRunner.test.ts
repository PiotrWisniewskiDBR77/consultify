import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Migration Runner', () => {
  it('keeps the mounted Studio persistence producer in the strict Postgres path', () => {
    const runner = fs.readFileSync(
      path.resolve(process.cwd(), 'server/scripts/migrate.postgres.ts'),
      'utf-8'
    );

    expect(runner).toContain("'081_studio_tables.sql'");
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
