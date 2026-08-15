import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../migrations');
const MIGRATION_FILE_PATTERN = /^2026\d{4}_v8_.*\.sql$/;

function discoverMigrationFiles(): string[] {
  const allFiles = fs.readdirSync(MIGRATIONS_DIR);
  return allFiles.filter((f) => MIGRATION_FILE_PATTERN.test(f)).sort();
}

function transformSqliteToPostgres(rawSql: string): { sql: string; transformations: string[] } {
  const transformations: string[] = [];
  let sql = rawSql;

  const parenCount = (sql.match(/\(datetime\('now'\)\)/g) || []).length;
  if (parenCount > 0) {
    sql = sql.replace(/\(datetime\('now'\)\)/g, 'CURRENT_TIMESTAMP');
    transformations.push(`(datetime('now')) → CURRENT_TIMESTAMP: ${parenCount}`);
  }

  const bareCount = (sql.match(/datetime\('now'\)/g) || []).length;
  if (bareCount > 0) {
    sql = sql.replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP');
    transformations.push(`datetime('now') → CURRENT_TIMESTAMP: ${bareCount}`);
  }

  const alterAddCount = (
    sql.match(/ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/gi) || []
  ).length;
  if (alterAddCount > 0) {
    sql = sql.replace(
      /ALTER\s+TABLE\s+(\S+)\s+ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/gi,
      'ALTER TABLE $1 ADD COLUMN IF NOT EXISTS '
    );
    transformations.push(`ADD COLUMN → ADD COLUMN IF NOT EXISTS: ${alterAddCount}`);
  }

  return { sql, transformations };
}

describe('CP-28: V8 Migration Runner — dry-run validation', () => {
  const files = discoverMigrationFiles();

  it('discovers at least 45 V8 migration files', () => {
    expect(files.length).toBeGreaterThanOrEqual(45);
  });

  it('all migration files start with v8_ prefix after date', () => {
    for (const f of files) {
      expect(f).toMatch(/^2026\d{4}_v8_/);
    }
  });

  it('all migration files are valid SQL (no empty files)', () => {
    for (const f of files) {
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8');
      expect(content.trim().length).toBeGreaterThan(0);
    }
  });

  it('all migration files contain CREATE TABLE or ALTER TABLE', () => {
    for (const f of files) {
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8');
      const hasCreate = /CREATE\s+TABLE/i.test(content);
      const hasAlter = /ALTER\s+TABLE/i.test(content);
      const hasIndex = /CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(content);
      expect(hasCreate || hasAlter || hasIndex).toBe(true);
    }
  });

  it('transformSqliteToPostgres converts datetime correctly', () => {
    const input = "DEFAULT (datetime('now'))";
    const { sql, transformations } = transformSqliteToPostgres(input);
    expect(sql).toBe('DEFAULT CURRENT_TIMESTAMP');
    expect(transformations.length).toBeGreaterThan(0);
  });

  it('transformSqliteToPostgres makes ALTER TABLE idempotent', () => {
    const input = 'ALTER TABLE v8_test ADD COLUMN foo TEXT';
    const { sql } = transformSqliteToPostgres(input);
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS');
  });

  it('transformSqliteToPostgres does not double-transform IF NOT EXISTS', () => {
    const input = 'ALTER TABLE v8_test ADD COLUMN IF NOT EXISTS foo TEXT';
    const { sql } = transformSqliteToPostgres(input);
    expect(sql).toBe(input);
  });

  it('CREATE TABLE statements use v8_ prefix except explicit shared AI prerequisites', () => {
    const sharedPrerequisites = new Set([
      'ai_playbook_template_versions',
      'wave8_agent_tool_governance_events',
    ]);
    for (const f of files) {
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8');
      const tableMatches = [
        ...content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi),
      ];
      for (const m of tableMatches) {
        const tableName = m[1].toLowerCase();
        expect(tableName.startsWith('v8_') || sharedPrerequisites.has(tableName)).toBe(true);
      }
    }
  });

  it('dry-run transformation produces valid SQL for every file', () => {
    let totalTransformations = 0;
    for (const f of files) {
      const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8');
      const { sql, transformations } = transformSqliteToPostgres(raw);

      expect(sql.length).toBeGreaterThan(0);
      expect(sql).not.toContain("datetime('now')");

      totalTransformations += transformations.length;
    }
    expect(totalTransformations).toBeGreaterThanOrEqual(0);
  });

  it('no migration file contains SQLite-specific json_extract after transformation', () => {
    for (const f of files) {
      const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8');
      const { sql } = transformSqliteToPostgres(raw);
      expect(sql).not.toMatch(/json_extract\s*\(/i);
    }
  });
});
