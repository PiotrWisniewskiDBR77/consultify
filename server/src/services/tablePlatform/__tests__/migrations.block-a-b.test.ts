/**
 * Static migration verification for Block A (Template Lifecycle) and
 * Block B (Record Provenance) — both date-prefixed `20260508_*.sql`.
 *
 * Verifies file presence, balanced parens, idempotent guards, expected DDL
 * statements, and rollback symmetry. Does NOT execute SQL — staging deploy
 * is the runtime gate.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = resolve(__dirname, '../../../../migrations');
const ROLLBACK_DIR = resolve(MIGRATIONS_DIR, 'rollback');

const BLOCK_A_FORWARD = '20260508_block_a_template_lifecycle.sql';
const BLOCK_A_ROLLBACK = '20260508_block_a_template_lifecycle.down.sql';
const BLOCK_B_FORWARD = '20260508_block_b_record_provenance.sql';
const BLOCK_B_ROLLBACK = '20260508_block_b_record_provenance.down.sql';

function readForward(filename: string): string {
  return readFileSync(resolve(MIGRATIONS_DIR, filename), 'utf-8');
}

function readRollback(filename: string): string {
  return readFileSync(resolve(ROLLBACK_DIR, filename), 'utf-8');
}

/**
 * Strip line comments (`-- ...`) before structural checks so prose
 * like "1) tp_record_sources" doesn't unbalance paren counts.
 */
function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

describe('Block A migration — 20260508_block_a_template_lifecycle.sql', () => {
  it('exists alongside its rollback', () => {
    expect(existsSync(resolve(MIGRATIONS_DIR, BLOCK_A_FORWARD))).toBe(true);
    expect(existsSync(resolve(ROLLBACK_DIR, BLOCK_A_ROLLBACK))).toBe(true);
  });

  it('adds the 5 lifecycle columns with idempotent guards', () => {
    const sql = readForward(BLOCK_A_FORWARD);
    for (const col of [
      'status',
      'version',
      'owner_user_id',
      'approval_history',
      'governance_rules',
    ]) {
      expect(sql).toMatch(new RegExp(`ADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+${col}`, 'i'));
    }
  });

  it('owner_user_id is TEXT (matches existing tp_base_templates.created_by convention)', () => {
    const sql = readForward(BLOCK_A_FORWARD);
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+owner_user_id\s+TEXT/i);
  });

  it('status CHECK constraint pins the lifecycle vocabulary', () => {
    const sql = readForward(BLOCK_A_FORWARD);
    expect(sql).toContain("status IN ('draft', 'approved', 'deprecated')");
  });

  it('promotes legacy is_featured rows to approved with audit history', () => {
    const sql = readForward(BLOCK_A_FORWARD);
    expect(sql).toMatch(/UPDATE\s+tp_base_templates/i);
    expect(sql).toContain("SET status           = 'approved'");
    expect(sql).toContain('auto_promoted_from_legacy_featured');
    expect(sql).toContain('WHERE is_featured = true');
    expect(sql).toContain("AND status      = 'draft'");
  });

  it('creates lifecycle lookup indexes', () => {
    const sql = readForward(BLOCK_A_FORWARD);
    expect(sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_tp_templates_status/i);
    expect(sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_tp_templates_owner_user/i);
  });

  it('parens are balanced (DDL only — comments stripped)', () => {
    const sql = stripSqlComments(readForward(BLOCK_A_FORWARD));
    const open = (sql.match(/\(/g) || []).length;
    const close = (sql.match(/\)/g) || []).length;
    expect(open).toBe(close);
  });

  it('rollback drops every column and index added by forward migration', () => {
    const rollback = readRollback(BLOCK_A_ROLLBACK);
    for (const col of [
      'status',
      'version',
      'owner_user_id',
      'approval_history',
      'governance_rules',
    ]) {
      expect(rollback).toMatch(new RegExp(`DROP\\s+COLUMN\\s+IF\\s+EXISTS\\s+${col}`, 'i'));
    }
    expect(rollback).toMatch(/DROP\s+INDEX\s+IF\s+EXISTS\s+idx_tp_templates_status/i);
    expect(rollback).toMatch(/DROP\s+INDEX\s+IF\s+EXISTS\s+idx_tp_templates_owner_user/i);
    expect(rollback).toMatch(/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+tp_base_templates_status_check/i);
  });
});

describe('Block B migration — 20260508_block_b_record_provenance.sql', () => {
  it('exists alongside its rollback', () => {
    expect(existsSync(resolve(MIGRATIONS_DIR, BLOCK_B_FORWARD))).toBe(true);
    expect(existsSync(resolve(ROLLBACK_DIR, BLOCK_B_ROLLBACK))).toBe(true);
  });

  it('creates tp_record_sources with provenance shape', () => {
    const sql = readForward(BLOCK_B_FORWARD);
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+tp_record_sources/i);
    for (const col of [
      'organization_id',
      'record_id',
      'source_type',
      'source_uri',
      'source_metadata',
      'confidence_contribution',
      'created_by',
      'created_at',
      'last_verified_at',
      'last_verified_by',
      'archived_at',
    ]) {
      expect(sql).toContain(col);
    }
  });

  it('organization_id is TEXT NOT NULL (denormalized per S0-F2)', () => {
    const sql = readForward(BLOCK_B_FORWARD);
    expect(sql).toMatch(/organization_id\s+TEXT\s+NOT\s+NULL/i);
  });

  it('source_type is constrained to the enumerated vocabulary', () => {
    const sql = readForward(BLOCK_B_FORWARD);
    expect(sql).toContain("'manual'");
    expect(sql).toContain("'document'");
    expect(sql).toContain("'presentation'");
    expect(sql).toContain("'external_api'");
    expect(sql).toContain("'ai_generated'");
    expect(sql).toContain("'imported'");
  });

  it('FK from tp_record_sources.record_id to tp_records cascades on delete', () => {
    const sql = readForward(BLOCK_B_FORWARD);
    expect(sql).toMatch(/REFERENCES\s+tp_records\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i);
  });

  it('adds confidence_score and validation_status to tp_records', () => {
    const sql = readForward(BLOCK_B_FORWARD);
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+confidence_score\s+NUMERIC\(3,2\)/i);
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+validation_status\s+TEXT/i);
  });

  it('confidence_score range CHECK is 0..1 inclusive (or NULL)', () => {
    const sql = readForward(BLOCK_B_FORWARD);
    expect(sql).toContain('tp_records_confidence_range_check');
    expect(sql).toContain(
      'confidence_score IS NULL OR (confidence_score >= 0.00 AND confidence_score <= 1.00)'
    );
  });

  it('validation_status CHECK pins the verification vocabulary', () => {
    const sql = readForward(BLOCK_B_FORWARD);
    expect(sql).toContain("validation_status IN ('unverified', 'verified', 'flagged')");
  });

  it('creates lookup indexes on tp_record_sources and tp_records', () => {
    const sql = readForward(BLOCK_B_FORWARD);
    for (const idx of [
      'idx_tp_record_sources_record',
      'idx_tp_record_sources_org',
      'idx_tp_record_sources_record_active',
      'idx_tp_record_sources_source_type',
      'idx_tp_records_validation_status',
      'idx_tp_records_confidence_low',
    ]) {
      expect(sql).toContain(idx);
    }
  });

  it('parens are balanced (DDL only — comments stripped)', () => {
    const sql = stripSqlComments(readForward(BLOCK_B_FORWARD));
    const open = (sql.match(/\(/g) || []).length;
    const close = (sql.match(/\)/g) || []).length;
    expect(open).toBe(close);
  });

  it('rollback drops the new table, indexes, columns, and constraints', () => {
    const rollback = readRollback(BLOCK_B_ROLLBACK);
    expect(rollback).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+tp_record_sources/i);
    for (const col of ['confidence_score', 'validation_status']) {
      expect(rollback).toMatch(new RegExp(`DROP\\s+COLUMN\\s+IF\\s+EXISTS\\s+${col}`, 'i'));
    }
    expect(rollback).toMatch(/DROP\s+INDEX\s+IF\s+EXISTS\s+idx_tp_records_validation_status/i);
    expect(rollback).toMatch(/DROP\s+INDEX\s+IF\s+EXISTS\s+idx_tp_records_confidence_low/i);
    expect(rollback).toMatch(
      /DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+tp_records_confidence_range_check/i
    );
    expect(rollback).toMatch(
      /DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+tp_records_validation_status_check/i
    );
  });
});

describe('Cross-cutting — date-prefixed migration discoverability', () => {
  it('migrationRunner pattern accepts both 20260508_* files', () => {
    // Mirrors the regex defined in migrationRunner.ts
    const pattern = /^(7\d{2}|\d{8})_.*\.sql$/;
    expect(pattern.test(BLOCK_A_FORWARD)).toBe(true);
    expect(pattern.test(BLOCK_B_FORWARD)).toBe(true);
  });

  it('no duplicate index names across the two new migrations', () => {
    const sqlA = readForward(BLOCK_A_FORWARD);
    const sqlB = readForward(BLOCK_B_FORWARD);
    const names = new Set<string>();
    const duplicates: string[] = [];
    for (const sql of [sqlA, sqlB]) {
      const matches = sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi);
      for (const m of matches) {
        const name = m[1].toLowerCase();
        if (names.has(name)) duplicates.push(name);
        names.add(name);
      }
    }
    expect(duplicates).toEqual([]);
  });
});
