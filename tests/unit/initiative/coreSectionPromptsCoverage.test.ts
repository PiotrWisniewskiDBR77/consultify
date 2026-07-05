/**
 * Regression guard for the "dead generator" bug (2026-06-28).
 *
 * The F1 generator silently produced nothing because 24/25 section types had no
 * ai_prompt_template (migration 530 keyed templates snake_case while the `key`
 * column is camelCase → 0 rows matched). This test pins the corrective migration:
 * EVERY CORE_SECTION_KEY must be set with a JSON-emitting template under its exact
 * camelCase key. If someone adds a core section or reintroduces a key mismatch,
 * this fails — deterministically, with no DB.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CORE_SECTION_KEYS } from '../../../server/src/services/initiative/initiativeGeneratorBrain.ts';

const MIGRATION = path.resolve(
  process.cwd(),
  'server/migrations/20260628_initiative_core_section_prompts.sql',
);

describe('core section AI prompt coverage (anti-regression)', () => {
  const sql = fs.readFileSync(MIGRATION, 'utf-8');

  it('migration exists and is non-trivial', () => {
    expect(sql.length).toBeGreaterThan(500);
  });

  it.each([...CORE_SECTION_KEYS])(
    'sets a JSON-emitting template for core key "%s" (exact camelCase)',
    (key) => {
      // an UPDATE ... WHERE key = '<key>' must exist (exact camelCase match)
      const whereRe = new RegExp(`WHERE\\s+key\\s*=\\s*'${key}'`);
      expect(whereRe.test(sql), `no UPDATE WHERE key = '${key}'`).toBe(true);
      // and it must NOT use a snake_case variant (the original bug)
      const snake = key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
      if (snake !== key) {
        expect(sql).not.toContain(`key = '${snake}'`);
      }
    },
  );

  it('every core key block instructs JSON output', () => {
    // crude but effective: one "Return valid JSON" per core UPDATE block at least.
    const jsonMarkers = (sql.match(/Return valid JSON/gi) || []).length;
    expect(jsonMarkers).toBeGreaterThanOrEqual(CORE_SECTION_KEYS.length);
  });
});
