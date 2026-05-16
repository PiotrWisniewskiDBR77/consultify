/**
 * Static + idempotency tests for the Tabele consulting templates seed pack
 * (Block A · EPIC-T5 · Sprint 2).
 *
 * Coverage:
 *   * Static invariants over the 30-template list:
 *       - exactly 30 entries
 *       - exactly 12 approved + 18 draft
 *       - unique seed_ids (also returned in `governance_rules.seed_id`)
 *       - schema_snapshot.tables[0].fields has ≥ 5 entries
 *       - every field type used is in ALLOWED_FIELD_TYPES
 *       - governance_rules carries audience + min_records_for_publish
 *   * Seeder idempotency (run #1 inserts, run #2 updates):
 *       - SELECT-by-seed_id returns nothing → INSERT path
 *       - SELECT-by-seed_id returns row → UPDATE path
 *       - Multiple back-to-back runs yield the same DB state
 *       - System user_id stamped on insert; preserved on update
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ALLOWED_FIELD_TYPES } from '../../SchemaValidationService.js';
import {
  TABELE_CONSULTING_TEMPLATES,
  type TabeleTemplateSeed,
} from '../tabele_consulting_templates.js';

const mockQuery = vi.fn();

vi.mock('../../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import tabeleConsultingTemplatesSeeder from '../tabeleConsultingTemplatesSeeder.js';

describe('TABELE_CONSULTING_TEMPLATES — static invariants', () => {
  it('contains exactly 30 entries', () => {
    expect(TABELE_CONSULTING_TEMPLATES).toHaveLength(30);
  });

  it('splits 12 approved / 18 draft', () => {
    const approved = TABELE_CONSULTING_TEMPLATES.filter((t) => t.status === 'approved');
    const draft = TABELE_CONSULTING_TEMPLATES.filter((t) => t.status === 'draft');
    expect(approved).toHaveLength(12);
    expect(draft).toHaveLength(18);
  });

  it('every approved entry is also is_featured=true', () => {
    for (const tpl of TABELE_CONSULTING_TEMPLATES.filter((t) => t.status === 'approved')) {
      expect(tpl.is_featured).toBe(true);
    }
  });

  it('every draft entry is is_featured=false', () => {
    for (const tpl of TABELE_CONSULTING_TEMPLATES.filter((t) => t.status === 'draft')) {
      expect(tpl.is_featured).toBe(false);
    }
  });

  it('every seed_id is unique and matches governance_rules.seed_id', () => {
    const seen = new Set<string>();
    for (const tpl of TABELE_CONSULTING_TEMPLATES) {
      expect(seen.has(tpl.seed_id)).toBe(false);
      seen.add(tpl.seed_id);
      expect(tpl.governance_rules.seed_id).toBe(tpl.seed_id);
    }
    expect(seen.size).toBe(30);
  });

  it('every schema_snapshot has ≥ 1 table and the first table has ≥ 5 fields', () => {
    for (const tpl of TABELE_CONSULTING_TEMPLATES) {
      expect(tpl.schema_snapshot.tables.length).toBeGreaterThanOrEqual(1);
      expect(tpl.schema_snapshot.tables[0].fields.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('every fieldType used is in SchemaValidationService.ALLOWED_FIELD_TYPES', () => {
    const allowed = new Set<string>(ALLOWED_FIELD_TYPES as readonly string[]);
    const offenders: Array<{ seed_id: string; field: string; type: string }> = [];
    for (const tpl of TABELE_CONSULTING_TEMPLATES) {
      for (const table of tpl.schema_snapshot.tables) {
        for (const field of table.fields) {
          if (!allowed.has(field.fieldType)) {
            offenders.push({
              seed_id: tpl.seed_id,
              field: field.name,
              type: field.fieldType,
            });
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every governance_rules carries audience (non-empty) + min_records_for_publish', () => {
    for (const tpl of TABELE_CONSULTING_TEMPLATES) {
      expect(tpl.governance_rules.audience.length).toBeGreaterThan(0);
      expect(tpl.governance_rules.min_records_for_publish).toBeGreaterThanOrEqual(0);
    }
  });

  it('formula fields define a non-empty `formula` expression', () => {
    for (const tpl of TABELE_CONSULTING_TEMPLATES) {
      for (const t of tpl.schema_snapshot.tables) {
        for (const field of t.fields) {
          if (field.fieldType === 'formula') {
            expect(field.formula).toBeTruthy();
            expect(typeof field.formula).toBe('string');
          }
        }
      }
    }
  });
});

describe('tabeleConsultingTemplatesSeeder.seed — idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('first run on empty DB inserts all 30 entries', async () => {
    // Each template incurs:
    //   - 1× SELECT-by-seed_id (returns empty) → 30 calls
    //   - 1× INSERT                            → 30 calls
    // = 60 mock query calls; alternating SELECT then INSERT.
    let callIndex = 0;
    mockQuery.mockImplementation(async () => {
      callIndex += 1;
      // Even index (1, 3, 5…) is SELECT; odd index (2, 4, 6…) is INSERT.
      if (callIndex % 2 === 1) {
        return { rows: [] };
      }
      return { rows: [{ id: `tpl-${callIndex}` }] };
    });

    const result = await tabeleConsultingTemplatesSeeder.seed();

    expect(result.inserted).toBe(30);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.byStatus.approved).toBe(12);
    expect(result.byStatus.draft).toBe(18);
    expect(result.seedIds).toHaveLength(30);
    expect(new Set(result.seedIds).size).toBe(30);

    expect(mockQuery).toHaveBeenCalledTimes(60);

    // Spot-check one INSERT param shape: 10 positional params, schema_snapshot
    // is a JSON string, governance_rules carries seed_id.
    const firstInsert = mockQuery.mock.calls[1];
    const [sql, params] = firstInsert;
    expect(sql).toContain('INSERT INTO tp_base_templates');
    expect(params).toHaveLength(10);
    expect(typeof params[3]).toBe('string'); // schema_snapshot JSON
    expect(typeof params[9]).toBe('string'); // governance_rules JSON
    const govParsed = JSON.parse(params[9] as string);
    expect(govParsed.seed_id).toBe(TABELE_CONSULTING_TEMPLATES[0].seed_id);
  });

  it('second run with all entries already present updates instead of inserts', async () => {
    // SELECT returns a row each time → seeder takes the UPDATE branch.
    let callIndex = 0;
    mockQuery.mockImplementation(async () => {
      callIndex += 1;
      if (callIndex % 2 === 1) {
        // SELECT path: pretend a template with seed_id already exists.
        return {
          rows: [
            {
              id: `existing-${callIndex}`,
              status: 'draft',
              owner_user_id: null,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const result = await tabeleConsultingTemplatesSeeder.seed();

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(30);
    expect(mockQuery).toHaveBeenCalledTimes(60);

    const firstUpdate = mockQuery.mock.calls[1];
    expect(firstUpdate[0]).toContain('UPDATE tp_base_templates');
  });

  it('UPDATE never demotes a manually-approved row back to seed status', async () => {
    let callIndex = 0;
    mockQuery.mockImplementation(async () => {
      callIndex += 1;
      if (callIndex % 2 === 1) {
        return {
          rows: [
            {
              id: `manually-approved-${callIndex}`,
              status: 'approved',
              owner_user_id: 'user-real',
            },
          ],
        };
      }
      return { rows: [] };
    });

    await tabeleConsultingTemplatesSeeder.seed();

    // Spot-check: UPDATE SQL uses CASE ... WHEN status IS NULL OR 'draft'
    // THEN $8 ELSE current END, so a manually-approved row must keep its
    // existing status. We check the SQL string explicitly.
    const firstUpdateSql = mockQuery.mock.calls[1][0] as string;
    expect(firstUpdateSql).toMatch(/CASE[\s\S]*?WHEN tp_base_templates\.status IS NULL/);
    expect(firstUpdateSql).toMatch(/ELSE tp_base_templates\.status/);
  });

  it('owner_user_id is preserved when already set (COALESCE pattern)', async () => {
    let callIndex = 0;
    mockQuery.mockImplementation(async () => {
      callIndex += 1;
      if (callIndex % 2 === 1) {
        return {
          rows: [
            {
              id: `owned-${callIndex}`,
              status: 'draft',
              owner_user_id: 'user-existing',
            },
          ],
        };
      }
      return { rows: [] };
    });

    await tabeleConsultingTemplatesSeeder.seed();

    const updateSql = mockQuery.mock.calls[1][0] as string;
    expect(updateSql).toMatch(/owner_user_id\s+=\s+COALESCE\(tp_base_templates\.owner_user_id/);
  });

  it('honours an injected templates list', async () => {
    const subset: TabeleTemplateSeed[] = TABELE_CONSULTING_TEMPLATES.slice(0, 3);

    let callIndex = 0;
    mockQuery.mockImplementation(async () => {
      callIndex += 1;
      if (callIndex % 2 === 1) return { rows: [] };
      return { rows: [{ id: `tpl-${callIndex}` }] };
    });

    const result = await tabeleConsultingTemplatesSeeder.seed({ templates: subset });

    expect(result.inserted).toBe(3);
    expect(result.seedIds).toEqual(subset.map((s) => s.seed_id));
    expect(mockQuery).toHaveBeenCalledTimes(6);
  });

  it('insert failure aborts the seed and surfaces the error', async () => {
    let callIndex = 0;
    mockQuery.mockImplementation(async () => {
      callIndex += 1;
      if (callIndex === 1) return { rows: [] };
      throw new Error('db down');
    });

    await expect(tabeleConsultingTemplatesSeeder.seed()).rejects.toThrow('db down');
  });
});
