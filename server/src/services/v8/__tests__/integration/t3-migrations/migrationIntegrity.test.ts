/**
 * T3 — Migration Safety Gate Tests
 *
 * Static hygiene for the current V8 SQL migration subset.
 *
 * The authoritative safety and replay proof is the complete strict chain on
 * a fresh PostgreSQL database. This file deliberately avoids frozen counts,
 * V8-only dependency assumptions, and line-based guesses about guarded DO
 * blocks; those made the historical test stale as soon as migrations grew.
 */

import fs from 'fs';
import path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

import { isExecutableMigration } from '../../../../releaseGate/migrationExecutionPolicy';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../../../migrations');
const MIGRATION_FILE_PATTERN = /^2026\d{4}_v8_.*\.sql$/;

interface MigrationFile {
  filename: string;
  sql: string;
}

function loadMigrationFiles(): MigrationFile[] {
  const allFiles = fs.readdirSync(MIGRATIONS_DIR).sort();
  const v8Files = allFiles.filter((f) => MIGRATION_FILE_PATTERN.test(f));
  return v8Files.map((filename) => ({
    filename,
    sql: fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8'),
  }));
}

function loadExecutableMigrationTableNames(): Set<string> {
  const tables = new Set<string>();
  for (const filename of fs.readdirSync(MIGRATIONS_DIR).sort()) {
    if (!filename.endsWith('.sql') || !isExecutableMigration(filename)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
    for (const table of extractCreateTableNames(sql)) tables.add(table.toLowerCase());
  }
  return tables;
}

function extractCreateTableNames(sql: string): string[] {
  const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    names.push(match[1].toLowerCase());
  }
  return names;
}

function extractIndexNames(sql: string): string[] {
  const regex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    names.push(match[1].toLowerCase());
  }
  return names;
}

function extractForeignKeyTargets(sql: string): { table: string; column: string }[] {
  const regex = /REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)/gi;
  const refs: { table: string; column: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    refs.push({ table: match[1].toLowerCase(), column: match[2].toLowerCase() });
  }
  return refs;
}

function extractCreateTableStatements(sql: string): string[] {
  const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+[^;]*;/gis;
  return sql.match(regex) || [];
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('T3 — Migration Safety Gate (M01–M06)', () => {
  let migrations: MigrationFile[];

  beforeAll(() => {
    migrations = loadMigrationFiles();
  });

  // =========================================================================
  // M01 — Sequential migration run (structural validation)
  // =========================================================================
  describe('M01 — Sequential migration run', () => {
    it('discovers the current V8 migration set without a frozen count', () => {
      expect(migrations.length).toBeGreaterThan(0);
    });

    it('should have files sorted alphabetically matching deployment order', () => {
      const filenames = migrations.map((m) => m.filename);
      const sorted = [...filenames].sort();
      expect(filenames).toEqual(sorted);
    });

    it('every CREATE TABLE must use IF NOT EXISTS', () => {
      const violations: { file: string; statement: string }[] = [];

      for (const mig of migrations) {
        const rawStatements = extractCreateTableStatements(mig.sql);
        for (const stmt of rawStatements) {
          if (!/IF\s+NOT\s+EXISTS/i.test(stmt)) {
            violations.push({
              file: mig.filename,
              statement: stmt.substring(0, 120),
            });
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('every CREATE INDEX must use IF NOT EXISTS', () => {
      const violations: { file: string; line: string }[] = [];

      for (const mig of migrations) {
        const lines = mig.sql.split('\n');
        for (const line of lines) {
          if (/CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(line) && !/IF\s+NOT\s+EXISTS/i.test(line)) {
            violations.push({
              file: mig.filename,
              line: line.trim().substring(0, 120),
            });
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('every migration contains at least one recognizable SQL operation', () => {
      for (const mig of migrations) {
        const uncommented = mig.sql.replace(/--[^\n]*/g, ' ');
        expect(uncommented, mig.filename).toMatch(
          /\b(CREATE|ALTER|DO|INSERT|UPDATE|COMMENT|GRANT)\b/i
        );
      }
    });

    it('reports a non-empty V8 table inventory without freezing its size', () => {
      const allTables: string[] = [];
      for (const mig of migrations) {
        allTables.push(...extractCreateTableNames(mig.sql));
      }
      console.log(`\n=== V8 Total Tables: ${allTables.length} ===\n`);
      expect(allTables.length).toBeGreaterThan(0);
    });

    it('cross-file FK references must target tables defined in earlier or same migration', () => {
      const definedTables = new Set<string>();
      const crossFileRefs: { file: string; fk_table: string; fk_column: string }[] = [];

      for (const mig of migrations) {
        const tablesInThisFile = extractCreateTableNames(mig.sql);
        const tablesInThisFileSet = new Set(tablesInThisFile.map((t) => t.toLowerCase()));

        const fkRefs = extractForeignKeyTargets(mig.sql);
        for (const ref of fkRefs) {
          const target = ref.table.toLowerCase();
          if (!definedTables.has(target) && !tablesInThisFileSet.has(target)) {
            crossFileRefs.push({
              file: mig.filename,
              fk_table: ref.table,
              fk_column: ref.column,
            });
          }
        }

        for (const t of tablesInThisFile) {
          definedTables.add(t.toLowerCase());
        }
      }

      if (crossFileRefs.length > 0) {
        console.log(
          `\n=== Cross-file FK forward references (${crossFileRefs.length}) ===\n` +
            `These FKs reference tables outside the preceding V8 subset.\n` +
            `The strict full-chain PostgreSQL runner remains authoritative for execution order.\n` +
            crossFileRefs.map((r) => `  ${r.file}: → ${r.fk_table}(${r.fk_column})`).join('\n') +
            '\n'
        );
      }

      // All forward-referenced tables must still exist in the full migration set (covered by M04).
      // This test ensures we have visibility into ordering dependencies.
      const allTables = loadExecutableMigrationTableNames();
      for (const ref of crossFileRefs) {
        expect(allTables.has(ref.fk_table.toLowerCase())).toBe(true);
      }
    });
  });

  // =========================================================================
  // M02 — Table collision check
  // =========================================================================
  describe('M02 — Table collision check', () => {
    it('allows compatibility re-declarations only when CREATE TABLE is replay-safe', () => {
      const tableRegistry = new Map<string, string[]>();

      for (const mig of migrations) {
        const tables = extractCreateTableNames(mig.sql);
        for (const table of tables) {
          const key = table.toLowerCase();
          if (!tableRegistry.has(key)) {
            tableRegistry.set(key, []);
          }
          tableRegistry.get(key)!.push(mig.filename);
        }
      }

      const duplicates = new Map<string, string[]>();
      for (const [table, files] of tableRegistry) {
        if (files.length > 1) {
          duplicates.set(table, files);
        }
      }

      for (const [table, files] of duplicates) {
        for (const filename of files) {
          const migration = migrations.find((item) => item.filename === filename)!;
          const definitions = extractCreateTableStatements(migration.sql).filter((statement) =>
            new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table}\\b`, 'i').test(
              statement
            )
          );
          expect(definitions.length, `${filename}: ${table}`).toBeGreaterThan(0);
          expect(definitions.every((statement) => /IF\s+NOT\s+EXISTS/i.test(statement))).toBe(true);
        }
      }
    });

    it('should report full table inventory', () => {
      const allTables: { table: string; file: string }[] = [];

      for (const mig of migrations) {
        const tables = extractCreateTableNames(mig.sql);
        for (const table of tables) {
          allTables.push({ table, file: mig.filename });
        }
      }

      expect(allTables.length).toBeGreaterThan(0);

      const inventory = allTables.map((t) => `${t.table} (${t.file})`).join('\n');
      console.log(`\n=== V8 Table Inventory (${allTables.length} tables) ===\n${inventory}\n`);
    });
  });

  // =========================================================================
  // M03 — Index collision check
  // =========================================================================
  describe('M03 — Index collision check', () => {
    it('should have no duplicate index names across the current V8 migration set', () => {
      const indexRegistry = new Map<string, string[]>();

      for (const mig of migrations) {
        const indexes = extractIndexNames(mig.sql);
        for (const idx of indexes) {
          const key = idx.toLowerCase();
          if (!indexRegistry.has(key)) {
            indexRegistry.set(key, []);
          }
          indexRegistry.get(key)!.push(mig.filename);
        }
      }

      const duplicates = new Map<string, string[]>();
      for (const [index, files] of indexRegistry) {
        if (files.length > 1) {
          duplicates.set(index, files);
        }
      }

      if (duplicates.size > 0) {
        const report = Array.from(duplicates.entries())
          .map(([idx, files]) => `  ${idx}: ${files.join(', ')}`)
          .join('\n');
        expect.fail(`Found ${duplicates.size} duplicate index name(s):\n${report}`);
      }

      expect(duplicates.size).toBe(0);
    });

    it('should report total index count', () => {
      let totalIndexes = 0;
      for (const mig of migrations) {
        totalIndexes += extractIndexNames(mig.sql).length;
      }
      expect(totalIndexes).toBeGreaterThan(0);
      console.log(`\n=== V8 Total Indexes: ${totalIndexes} ===\n`);
    });
  });

  // =========================================================================
  // M04 — Foreign key consistency
  // =========================================================================
  describe('M04 — Foreign key consistency', () => {
    it('all FK references must point to tables that exist in the full migration set', () => {
      const allTables = loadExecutableMigrationTableNames();

      const danglingRefs: { file: string; target_table: string; target_column: string }[] = [];

      for (const mig of migrations) {
        const fkRefs = extractForeignKeyTargets(mig.sql);
        for (const ref of fkRefs) {
          if (!allTables.has(ref.table.toLowerCase())) {
            danglingRefs.push({
              file: mig.filename,
              target_table: ref.table,
              target_column: ref.column,
            });
          }
        }
      }

      if (danglingRefs.length > 0) {
        const report = danglingRefs
          .map(
            (r) => `  ${r.file}: REFERENCES ${r.target_table}(${r.target_column}) — table not found`
          )
          .join('\n');
        expect.fail(`Found ${danglingRefs.length} dangling FK reference(s):\n${report}`);
      }

      expect(danglingRefs.length).toBe(0);
    });

    it('should report FK reference inventory', () => {
      const allRefs: { file: string; target: string }[] = [];

      for (const mig of migrations) {
        const fkRefs = extractForeignKeyTargets(mig.sql);
        for (const ref of fkRefs) {
          allRefs.push({
            file: mig.filename,
            target: `${ref.table}(${ref.column})`,
          });
        }
      }

      console.log(
        `\n=== V8 FK References (${allRefs.length} total) ===\n${allRefs.map((r) => `  ${r.file} → ${r.target}`).join('\n')}\n`
      );
    });
  });

  // =========================================================================
  // M05 — identifier hygiene
  // =========================================================================
  describe('M05 — identifier hygiene', () => {
    it('every table created by a V8 migration uses a portable snake_case identifier', () => {
      const violations: { file: string; table: string }[] = [];

      for (const mig of migrations) {
        const tables = extractCreateTableNames(mig.sql);
        for (const table of tables) {
          if (!/^[a-z][a-z0-9_]*$/.test(table)) {
            violations.push({ file: mig.filename, table });
          }
        }
      }

      if (violations.length > 0) {
        const report = violations.map((v) => `  ${v.file}: ${v.table}`).join('\n');
        expect.fail(`Found ${violations.length} invalid table identifier(s):\n${report}`);
      }

      expect(violations.length).toBe(0);
    });
  });

  // =========================================================================
  // M06 — Idempotent re-run
  // =========================================================================
  describe('M06 — Idempotent re-run', () => {
    it('all CREATE TABLE statements use IF NOT EXISTS (safe for re-run)', () => {
      const violations: { file: string; statement: string }[] = [];

      for (const mig of migrations) {
        const rawStatements = extractCreateTableStatements(mig.sql);
        for (const stmt of rawStatements) {
          if (!/IF\s+NOT\s+EXISTS/i.test(stmt)) {
            violations.push({
              file: mig.filename,
              statement: stmt.substring(0, 120),
            });
          }
        }
      }

      if (violations.length > 0) {
        const report = violations.map((v) => `  ${v.file}: ${v.statement}`).join('\n');
        expect.fail(
          `Found ${violations.length} CREATE TABLE without IF NOT EXISTS (not idempotent):\n${report}`
        );
      }

      expect(violations.length).toBe(0);
    });

    it('all CREATE INDEX statements use IF NOT EXISTS (safe for re-run)', () => {
      const violations: { file: string; line: string }[] = [];

      for (const mig of migrations) {
        const lines = mig.sql.split('\n');
        for (const line of lines) {
          if (/CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(line) && !/IF\s+NOT\s+EXISTS/i.test(line)) {
            violations.push({
              file: mig.filename,
              line: line.trim().substring(0, 120),
            });
          }
        }
      }

      if (violations.length > 0) {
        const report = violations.map((v) => `  ${v.file}: ${v.line}`).join('\n');
        expect.fail(
          `Found ${violations.length} CREATE INDEX without IF NOT EXISTS (not idempotent):\n${report}`
        );
      }

      expect(violations.length).toBe(0);
    });

    it('no DROP TABLE or DROP INDEX statements (destructive operations)', () => {
      const violations: { file: string; line: string }[] = [];

      for (const mig of migrations) {
        const lines = mig.sql.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('--')) continue;
          if (/DROP\s+(TABLE|INDEX)/i.test(trimmed)) {
            violations.push({
              file: mig.filename,
              line: trimmed.substring(0, 120),
            });
          }
        }
      }

      if (violations.length > 0) {
        const report = violations.map((v) => `  ${v.file}: ${v.line}`).join('\n');
        expect.fail(`Found ${violations.length} destructive DROP statement(s):\n${report}`);
      }

      expect(violations.length).toBe(0);
    });

    it('every ALTER TABLE ADD COLUMN operation uses IF NOT EXISTS', () => {
      const violations: { file: string; line: string }[] = [];

      for (const mig of migrations) {
        const lines = mig.sql.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('--')) continue;
          if (
            /ALTER\s+TABLE/i.test(trimmed) &&
            /ADD\s+COLUMN/i.test(trimmed) &&
            !/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i.test(trimmed)
          ) {
            violations.push({
              file: mig.filename,
              line: trimmed.substring(0, 120),
            });
          }
        }
      }

      if (violations.length > 0) {
        const report = violations.map((v) => `  ${v.file}: ${v.line}`).join('\n');
        expect.fail(
          `Found ${violations.length} ALTER TABLE ADD COLUMN statement(s) without IF NOT EXISTS:\n${report}`
        );
      }

      expect(violations.length).toBe(0);
    });
  });
});
