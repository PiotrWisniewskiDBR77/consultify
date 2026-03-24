import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const MIGRATIONS_DIR = resolve(__dirname, '../../../../migrations');

const MIGRATION_FILES = [
  '700_table_platform_foundation.sql',
  '701_table_platform_performance.sql',
  '702_schema_versioning.sql',
  '703_data_collection.sql',
  '704_forms.sql',
];

function readMigration(filename: string): string {
  return readFileSync(resolve(MIGRATIONS_DIR, filename), 'utf-8');
}

describe('Migration Chain Verification (700-704)', () => {
  it('all migration files (700-704) exist', () => {
    for (const file of MIGRATION_FILES) {
      const fullPath = resolve(MIGRATIONS_DIR, file);
      expect(existsSync(fullPath), `Missing migration: ${file}`).toBe(true);
    }
  });

  it('each migration contains valid SQL (no obvious syntax errors in CREATE TABLE)', () => {
    for (const file of MIGRATION_FILES) {
      const sql = readMigration(file);

      const createTableMatches = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+\w+\s*\(/gi) ?? [];
      for (const match of createTableMatches) {
        expect(match).toBeTruthy();
      }

      const openParens = (sql.match(/\(/g) || []).length;
      const closeParens = (sql.match(/\)/g) || []).length;
      expect(openParens).toBe(closeParens);
    }
  });

  it('foreign key references are consistent (referenced tables exist in prior migrations)', () => {
    const createdTables = new Set<string>();

    for (const file of MIGRATION_FILES) {
      const sql = readMigration(file);

      const createMatches = sql.matchAll(
        /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi,
      );
      for (const m of createMatches) {
        createdTables.add(m[1].toLowerCase());
      }

      const fkMatches = sql.matchAll(/REFERENCES\s+(\w+)\s*\(/gi);
      for (const m of fkMatches) {
        const refTable = m[1].toLowerCase();
        expect(
          createdTables.has(refTable),
          `FK references ${refTable} in ${file}, but table not created in prior/current migrations`,
        ).toBe(true);
      }
    }
  });

  it('index names are unique across all migrations', () => {
    const indexNames = new Set<string>();
    const duplicates: string[] = [];

    for (const file of MIGRATION_FILES) {
      const sql = readMigration(file);
      const indexMatches = sql.matchAll(
        /CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi,
      );
      for (const m of indexMatches) {
        const name = m[1].toLowerCase();
        if (indexNames.has(name)) {
          duplicates.push(`${name} (in ${file})`);
        }
        indexNames.add(name);
      }
    }

    expect(duplicates, `Duplicate index names: ${duplicates.join(', ')}`).toEqual([]);
  });

  it('all tp_* tables have proper primary keys', () => {
    for (const file of MIGRATION_FILES) {
      const sql = readMigration(file);

      const tableBlocks = sql.split(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+/i).slice(1);
      for (const block of tableBlocks) {
        const tableNameMatch = block.match(/^(\w+)/);
        if (!tableNameMatch) continue;
        const tableName = tableNameMatch[1];

        if (!tableName.startsWith('tp_')) continue;

        const hasPK =
          /PRIMARY\s+KEY/i.test(block);
        expect(
          hasPK,
          `Table ${tableName} in ${file} is missing a PRIMARY KEY`,
        ).toBe(true);
      }
    }
  });

  it('migration 700 creates all foundation tables', () => {
    const sql = readMigration('700_table_platform_foundation.sql');
    const expectedTables = [
      'tp_bases',
      'tp_tables',
      'tp_fields',
      'tp_views',
      'tp_records',
      'tp_record_links',
      'tp_attachments',
      'tp_audit_events',
      'tp_schema_proposals',
    ];
    for (const table of expectedTables) {
      expect(sql.toLowerCase()).toContain(table);
    }
  });

  it('migration 703 creates data collection tables', () => {
    const sql = readMigration('703_data_collection.sql');
    expect(sql.toLowerCase()).toContain('tp_connectors');
    expect(sql.toLowerCase()).toContain('tp_connector_runs');
    expect(sql.toLowerCase()).toContain('tp_record_provenance');
  });

  it('migration 704 creates forms table', () => {
    const sql = readMigration('704_forms.sql');
    expect(sql.toLowerCase()).toContain('tp_forms');
  });
});
