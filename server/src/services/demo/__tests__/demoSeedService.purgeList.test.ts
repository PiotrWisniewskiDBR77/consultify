/** @vitest-environment node */

/**
 * B4 / DEC-576 (OPCJA C) — static guard over `DEMO_DATASET_DELETE_QUERIES`.
 *
 * WHY THIS FILE EXISTS
 * The demo TTL purge (`deleteDemoDatasetForOrganization`) walks the list
 * children-first and runs every DELETE with `{ fallback: false }`, so the first
 * table that refuses a DELETE aborts the whole loop BEFORE it reaches
 * `organizations` — the clone org then survives (the exact defect behind the 126
 * staging orphans). `results_writer_observations` is append-only: migration
 * 20261014 installs `trg_results_writer_observation_no_delete` (BEFORE DELETE →
 * RAISE restrict_violation). It was listed at `demoSeedService.ts:4415` and is
 * now removed (OPCJA C).
 *
 * This is a DB-FREE unit test on purpose: it reads the migration DDL from disk
 * and the exported list, so it runs in EVERY suite (no RUN_DB_TESTS needed) and
 * fails the moment anyone re-couples the purge to an append-only table — with
 * `results_writer_observations` OR with any other `*_no_delete` table.
 *
 * The runtime behaviour (clone org deleted, ledger row survives) is proved
 * against a real PostgreSQL in `demoSeedService.purgeLedger.pg.test.ts`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DEMO_DATASET_DELETE_QUERIES } from '../demoSeedService.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, '../../../../migrations');

/**
 * Every table a `*_no_delete` BEFORE DELETE trigger protects, parsed from the
 * real migration files. Trigger name and `ON <table>` may sit on separate lines,
 * so the pattern is multiline (`\s+` spans the newline).
 */
function tablesWithNoDeleteTrigger(): Set<string> {
  const tables = new Set<string>();
  const re =
    /CREATE\s+TRIGGER\s+[A-Za-z0-9_]*no_delete\s+BEFORE\s+DELETE\s+ON\s+(?:public\.)?([A-Za-z0-9_]+)/gi;
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) tables.add(m[1].toLowerCase());
  }
  return tables;
}

const purgeTargetTables = DEMO_DATASET_DELETE_QUERIES.map((step) => step[0].toLowerCase());

describe('B4/DEC-576 — demo purge list never targets an append-only (*_no_delete) table', () => {
  it('OPCJA C regression guard: results_writer_observations is not in the purge list', () => {
    expect(purgeTargetTables).not.toContain('results_writer_observations');
  });

  it('no table protected by a *_no_delete trigger appears in DEMO_DATASET_DELETE_QUERIES', () => {
    const guarded = tablesWithNoDeleteTrigger();

    // The parser must actually find the known append-only tables, otherwise the
    // assertion below could pass vacuously (a broken regex = a silent green).
    expect(guarded.has('results_writer_observations')).toBe(true);
    expect(guarded.has('partner_economics_policy_events')).toBe(true);

    const collision = purgeTargetTables.filter((t) => guarded.has(t));
    expect(collision).toEqual([]);
  });

  it('organizations is purged last so every child resolves before the parent row goes', () => {
    expect(purgeTargetTables[purgeTargetTables.length - 1]).toBe('organizations');
    expect(purgeTargetTables.filter((t) => t === 'organizations')).toHaveLength(1);
  });
});
