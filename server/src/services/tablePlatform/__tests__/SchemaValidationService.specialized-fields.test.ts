/**
 * Integration smoke for SchemaValidationService extension by EPIC-T7
 * (Block A · Sprint 3).
 *
 * Verifies that the 5 specialised field types are accepted by the public
 * surface of `SchemaValidationService` and that options dispatch reaches
 * the `SpecializedFieldTypes` validators.
 */

import { describe, expect, it, vi } from 'vitest';

// Database is not exercised by these tests — provide a no-op mock so the
// service module can load without a real connection.
vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [] })) }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import schemaValidationService, { ALLOWED_FIELD_TYPES } from '../SchemaValidationService.js';
import { SPECIALIZED_FIELD_TYPES } from '../SpecializedFieldTypes.js';

describe('SchemaValidationService × EPIC-T7 specialised types', () => {
  it('ALLOWED_FIELD_TYPES contains all 5 specialised types', () => {
    for (const t of SPECIALIZED_FIELD_TYPES) {
      expect((ALLOWED_FIELD_TYPES as readonly string[]).includes(t)).toBe(true);
    }
  });

  it('total count is now 34 (29 base + 5 EPIC-T7) — guard against accidental drops', () => {
    expect(ALLOWED_FIELD_TYPES.length).toBe(34);
  });

  it('validateFieldType accepts each specialised type', () => {
    for (const t of SPECIALIZED_FIELD_TYPES) {
      const result = schemaValidationService.validateFieldType(t);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  it('validateFieldType still rejects unknown types', () => {
    const r = schemaValidationService.validateFieldType('teleport');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/Invalid field type/);
  });

  // ── Options dispatch reaches the per-type validators ─────────────────────

  it('routes risk_score options through validateSpecializedField', () => {
    expect(schemaValidationService.validateFieldOptions('risk_score', { scale: 25 })).toEqual({
      valid: true,
      errors: [],
    });

    const bad = schemaValidationService.validateFieldOptions('risk_score', { scale: 99 });
    expect(bad.valid).toBe(false);
    expect(bad.errors.some((e) => /scale must be one of/.test(e))).toBe(true);
  });

  it('routes priority options through validateSpecializedField', () => {
    expect(
      schemaValidationService.validateFieldOptions('priority', { levels: 'P0_P1_P2_P3' })
    ).toEqual({ valid: true, errors: [] });

    const bad = schemaValidationService.validateFieldOptions('priority', {
      levels: 'unknown',
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors.some((e) => /levels must be one of/.test(e))).toBe(true);
  });

  it('routes ai_generated_summary options', () => {
    expect(
      schemaValidationService.validateFieldOptions('ai_generated_summary', { max_chars: 100 })
    ).toEqual({ valid: true, errors: [] });

    const bad = schemaValidationService.validateFieldOptions('ai_generated_summary', {
      max_chars: 9999,
    });
    expect(bad.valid).toBe(false);
  });

  it('routes ai_classification options', () => {
    expect(
      schemaValidationService.validateFieldOptions('ai_classification', {
        classes: ['a', 'b'],
      })
    ).toEqual({ valid: true, errors: [] });

    const bad = schemaValidationService.validateFieldOptions('ai_classification', {
      classes: ['only-one'],
    });
    expect(bad.valid).toBe(false);
  });

  it('routes source_reference options', () => {
    expect(
      schemaValidationService.validateFieldOptions('source_reference', {
        allow_external: true,
      })
    ).toEqual({ valid: true, errors: [] });

    const bad = schemaValidationService.validateFieldOptions('source_reference', {
      allow_external: 'yes' as unknown as boolean,
    });
    expect(bad.valid).toBe(false);
  });

  it('non-specialised types still validate via the existing branches', () => {
    // singleSelect must still demand `options.options[]`
    const bad = schemaValidationService.validateFieldOptions('singleSelect', {
      options: [],
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toMatch(/cannot be empty/);
  });
});
