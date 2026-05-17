/**
 * Unit tests for SpecializedFieldTypes (Block A · EPIC-T7 · Sprint 3).
 *
 * Coverage:
 *   - SPECIALIZED_FIELD_TYPES surface (count, names)
 *   - AI_REGEN_FIELD_TYPES vs AUTO_FIELD_TYPES contract
 *   - defaultOptionsFor: deep clone, all five types
 *   - validateSpecializedField:
 *       * happy paths
 *       * each error branch
 *       * non-specialised types short-circuit OK
 *   - checkSpecializedFieldValue runtime checks per type
 *   - helpers: riskScoreMatrixSize, priorityValuesFor, isSpecializedFieldType
 */

import { describe, expect, it } from 'vitest';

import {
  AI_CLASSIFICATION_MAX_CLASSES,
  AI_CLASSIFICATION_MIN_CLASSES,
  AI_PROMPT_TEMPLATE_MAX_LENGTH,
  AI_REGEN_FIELD_TYPES,
  AI_SUMMARY_MAX_CHARS_HARD_LIMIT,
  checkSpecializedFieldValue,
  defaultSpecializedOptionsFor,
  isSpecializedFieldType,
  PRIORITY_LEVEL_PRESETS,
  priorityValuesFor,
  RISK_SCORE_VALID_SCALES,
  riskScoreMatrixSize,
  SOURCE_REFERENCE_MAX_EXTERNAL_URL,
  SPECIALIZED_FIELD_TYPES,
  validateSpecializedField,
} from '../index.js';

describe('SpecializedFieldTypes — surface', () => {
  it('exposes exactly the 5 EPIC-T7 types', () => {
    expect(SPECIALIZED_FIELD_TYPES).toEqual([
      'risk_score',
      'priority',
      'ai_generated_summary',
      'ai_classification',
      'source_reference',
    ]);
  });

  it('AI_REGEN_FIELD_TYPES = AI summary + AI classification only', () => {
    expect([...AI_REGEN_FIELD_TYPES].sort()).toEqual(
      ['ai_classification', 'ai_generated_summary'].sort()
    );
  });

  it('isSpecializedFieldType correctly identifies the union', () => {
    for (const t of SPECIALIZED_FIELD_TYPES) {
      expect(isSpecializedFieldType(t)).toBe(true);
    }
    expect(isSpecializedFieldType('singleLineText')).toBe(false);
    expect(isSpecializedFieldType('')).toBe(false);
    expect(isSpecializedFieldType(null)).toBe(false);
    expect(isSpecializedFieldType(123)).toBe(false);
  });

  it('exposes the documented constants', () => {
    expect(RISK_SCORE_VALID_SCALES).toEqual([3, 5, 25]);
    expect(Object.keys(PRIORITY_LEVEL_PRESETS).sort()).toEqual([
      'CRITICAL_HIGH_MEDIUM_LOW',
      'P0_P1_P2_P3',
    ]);
    expect(AI_SUMMARY_MAX_CHARS_HARD_LIMIT).toBe(2000);
    expect(AI_PROMPT_TEMPLATE_MAX_LENGTH).toBe(2000);
    expect(AI_CLASSIFICATION_MIN_CLASSES).toBe(2);
    expect(AI_CLASSIFICATION_MAX_CLASSES).toBe(50);
    expect(SOURCE_REFERENCE_MAX_EXTERNAL_URL).toBe(2048);
  });
});

describe('riskScoreMatrixSize', () => {
  it('maps 25/5 → 5, 3 → 3, anything else → null', () => {
    expect(riskScoreMatrixSize(25)).toBe(5);
    expect(riskScoreMatrixSize(5)).toBe(5);
    expect(riskScoreMatrixSize(3)).toBe(3);
    expect(riskScoreMatrixSize(7)).toBeNull();
    expect(riskScoreMatrixSize(undefined)).toBeNull();
  });
});

describe('priorityValuesFor', () => {
  it('returns the documented enums', () => {
    expect(priorityValuesFor('P0_P1_P2_P3')).toEqual(['P0', 'P1', 'P2', 'P3']);
    expect(priorityValuesFor('CRITICAL_HIGH_MEDIUM_LOW')).toEqual([
      'critical',
      'high',
      'medium',
      'low',
    ]);
  });

  it('returns [] for unknown preset names', () => {
    expect(priorityValuesFor('UNKNOWN')).toEqual([]);
  });
});

describe('defaultSpecializedOptionsFor', () => {
  it('returns sensible defaults for each type', () => {
    expect(defaultSpecializedOptionsFor('risk_score')).toEqual({
      scale: 25,
      axes: { likelihood: 5, impact: 5 },
    });
    expect(defaultSpecializedOptionsFor('priority')).toEqual({
      levels: 'P0_P1_P2_P3',
      defaultLevel: 'P2',
    });
    expect(defaultSpecializedOptionsFor('ai_generated_summary')).toEqual({
      prompt_template: 'Summarize record in ≤200 chars',
      max_chars: 200,
      recompute_on: [],
    });
    expect(defaultSpecializedOptionsFor('ai_classification')).toEqual({
      classes: ['option_a', 'option_b'],
      prompt_template: 'Classify the record',
    });
    expect(defaultSpecializedOptionsFor('source_reference')).toEqual({
      allow_external: false,
    });
  });

  it('returns a deep clone — caller mutations do not poison the global preset', () => {
    const a = defaultSpecializedOptionsFor('risk_score') as { scale: number };
    a.scale = 99 as unknown as 3;
    const b = defaultSpecializedOptionsFor('risk_score') as { scale: number };
    expect(b.scale).toBe(25);
  });
});

describe('validateSpecializedField — dispatch', () => {
  it('non-specialised types short-circuit as valid (caller-friendly)', () => {
    expect(validateSpecializedField('singleLineText', { foo: 'bar' })).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('null / undefined options short-circuit as valid', () => {
    expect(validateSpecializedField('priority', null)).toEqual({
      valid: true,
      errors: [],
    });
    expect(validateSpecializedField('priority', undefined)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('non-object options surface a single error', () => {
    const r = validateSpecializedField('priority', 'banana');
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/options must be an object/);
  });
});

describe('validateSpecializedField — risk_score', () => {
  it('happy path with default scale', () => {
    expect(
      validateSpecializedField('risk_score', { scale: 25, axes: { likelihood: 4, impact: 5 } })
    ).toEqual({ valid: true, errors: [] });
  });

  it('rejects bogus scale', () => {
    const r = validateSpecializedField('risk_score', { scale: 12 });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/scale must be one of/);
  });

  it('rejects axes that exceed the matrix dim', () => {
    const r = validateSpecializedField('risk_score', {
      scale: 3,
      axes: { likelihood: 4, impact: 1 },
    });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/axes\.likelihood/);
  });

  it('rejects non-integer axes', () => {
    const r = validateSpecializedField('risk_score', {
      scale: 25,
      axes: { likelihood: 2.5 },
    });
    expect(r.valid).toBe(false);
  });

  it('rejects non-object axes', () => {
    const r = validateSpecializedField('risk_score', { scale: 25, axes: 'oops' });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/axes must be an object/);
  });
});

describe('validateSpecializedField — priority', () => {
  it('happy path', () => {
    expect(
      validateSpecializedField('priority', { levels: 'P0_P1_P2_P3', defaultLevel: 'P1' })
    ).toEqual({ valid: true, errors: [] });
  });

  it('rejects unknown preset', () => {
    const r = validateSpecializedField('priority', { levels: 'P0_P9' });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/levels must be one of/);
  });

  it('rejects defaultLevel outside the preset', () => {
    const r = validateSpecializedField('priority', {
      levels: 'P0_P1_P2_P3',
      defaultLevel: 'critical',
    });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/defaultLevel/);
  });
});

describe('validateSpecializedField — ai_generated_summary', () => {
  it('happy path', () => {
    expect(
      validateSpecializedField('ai_generated_summary', {
        prompt_template: 'Summarize',
        max_chars: 100,
        recompute_on: ['fld-1'],
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it('rejects oversize max_chars', () => {
    const r = validateSpecializedField('ai_generated_summary', { max_chars: 9999 });
    expect(r.valid).toBe(false);
  });

  it('rejects non-string prompt_template', () => {
    const r = validateSpecializedField('ai_generated_summary', { prompt_template: 42 });
    expect(r.valid).toBe(false);
  });

  it('rejects oversize prompt_template', () => {
    const r = validateSpecializedField('ai_generated_summary', {
      prompt_template: 'x'.repeat(AI_PROMPT_TEMPLATE_MAX_LENGTH + 1),
    });
    expect(r.valid).toBe(false);
  });

  it('rejects bad recompute_on entries', () => {
    const r = validateSpecializedField('ai_generated_summary', { recompute_on: [42] });
    expect(r.valid).toBe(false);
  });

  it('rejects non-array recompute_on', () => {
    const r = validateSpecializedField('ai_generated_summary', { recompute_on: 'fld-1' });
    expect(r.valid).toBe(false);
  });

  it('rejects non-boolean aiAuto', () => {
    const r = validateSpecializedField('ai_generated_summary', { aiAuto: 'yes' });
    expect(r.valid).toBe(false);
  });
});

describe('validateSpecializedField — ai_classification', () => {
  it('happy path', () => {
    expect(
      validateSpecializedField('ai_classification', {
        classes: ['a', 'b', 'c'],
        prompt_template: 'Classify',
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it('rejects too few classes', () => {
    const r = validateSpecializedField('ai_classification', { classes: ['only-one'] });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/at least/);
  });

  it('rejects too many classes', () => {
    const big = Array.from({ length: AI_CLASSIFICATION_MAX_CLASSES + 1 }, (_, i) => `c${i}`);
    const r = validateSpecializedField('ai_classification', { classes: big });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/at most/);
  });

  it('rejects duplicates', () => {
    const r = validateSpecializedField('ai_classification', { classes: ['a', 'a'] });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/duplicate/);
  });

  it('rejects non-string classes', () => {
    const r = validateSpecializedField('ai_classification', { classes: ['a', 1] });
    expect(r.valid).toBe(false);
  });

  it('rejects non-array classes', () => {
    const r = validateSpecializedField('ai_classification', { classes: 'a,b' });
    expect(r.valid).toBe(false);
  });
});

describe('validateSpecializedField — source_reference', () => {
  it('happy path with allow_external = false', () => {
    expect(validateSpecializedField('source_reference', { allow_external: false })).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('rejects non-boolean allow_external', () => {
    const r = validateSpecializedField('source_reference', { allow_external: 'yes' });
    expect(r.valid).toBe(false);
  });
});

// ── Runtime value validation ────────────────────────────────────────────────

describe('checkSpecializedFieldValue — risk_score', () => {
  it('accepts integers in range', () => {
    expect(checkSpecializedFieldValue('risk_score', 12, { scale: 25 }).ok).toBe(true);
    expect(checkSpecializedFieldValue('risk_score', 1, { scale: 3 }).ok).toBe(true);
    expect(checkSpecializedFieldValue('risk_score', 3, { scale: 3 }).ok).toBe(true);
  });

  it('rejects non-integers', () => {
    const r = checkSpecializedFieldValue('risk_score', 1.5, { scale: 25 });
    expect(r.ok).toBe(false);
  });

  it('rejects out-of-range values', () => {
    expect(checkSpecializedFieldValue('risk_score', 0, { scale: 25 }).ok).toBe(false);
    expect(checkSpecializedFieldValue('risk_score', 26, { scale: 25 }).ok).toBe(false);
  });

  it('rejects when configured scale is invalid', () => {
    const r = checkSpecializedFieldValue('risk_score', 1, { scale: 99 });
    expect(r.ok).toBe(false);
  });

  it('treats null/undefined values as valid (required handled elsewhere)', () => {
    expect(checkSpecializedFieldValue('risk_score', null, { scale: 25 }).ok).toBe(true);
    expect(checkSpecializedFieldValue('risk_score', undefined, { scale: 25 }).ok).toBe(true);
  });
});

describe('checkSpecializedFieldValue — priority', () => {
  it('accepts values in the preset', () => {
    expect(checkSpecializedFieldValue('priority', 'P1', { levels: 'P0_P1_P2_P3' }).ok).toBe(true);
    expect(
      checkSpecializedFieldValue('priority', 'critical', {
        levels: 'CRITICAL_HIGH_MEDIUM_LOW',
      }).ok
    ).toBe(true);
  });

  it('rejects values outside the preset', () => {
    const r = checkSpecializedFieldValue('priority', 'foo', { levels: 'P0_P1_P2_P3' });
    expect(r.ok).toBe(false);
  });

  it('rejects non-string values', () => {
    const r = checkSpecializedFieldValue('priority', 42, { levels: 'P0_P1_P2_P3' });
    expect(r.ok).toBe(false);
  });

  it('rejects when configured preset is unknown', () => {
    const r = checkSpecializedFieldValue('priority', 'P1', { levels: 'BOGUS' });
    expect(r.ok).toBe(false);
  });
});

describe('checkSpecializedFieldValue — ai_generated_summary', () => {
  it('accepts strings within max_chars', () => {
    expect(checkSpecializedFieldValue('ai_generated_summary', 'short', { max_chars: 100 }).ok).toBe(
      true
    );
  });

  it('rejects strings exceeding max_chars', () => {
    expect(
      checkSpecializedFieldValue('ai_generated_summary', 'x'.repeat(101), {
        max_chars: 100,
      }).ok
    ).toBe(false);
  });

  it('falls back to default 200 when max_chars is missing', () => {
    expect(checkSpecializedFieldValue('ai_generated_summary', 'x'.repeat(200), {}).ok).toBe(true);
    expect(checkSpecializedFieldValue('ai_generated_summary', 'x'.repeat(201), {}).ok).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(checkSpecializedFieldValue('ai_generated_summary', 42, {}).ok).toBe(false);
  });
});

describe('checkSpecializedFieldValue — ai_classification', () => {
  it('accepts values in classes', () => {
    expect(checkSpecializedFieldValue('ai_classification', 'a', { classes: ['a', 'b'] }).ok).toBe(
      true
    );
  });

  it('rejects values outside classes', () => {
    expect(checkSpecializedFieldValue('ai_classification', 'c', { classes: ['a', 'b'] }).ok).toBe(
      false
    );
  });

  it('rejects non-string values', () => {
    expect(checkSpecializedFieldValue('ai_classification', 1, { classes: ['a', 'b'] }).ok).toBe(
      false
    );
  });

  it('rejects when classes is unset', () => {
    expect(checkSpecializedFieldValue('ai_classification', 'a', {}).ok).toBe(false);
  });
});

describe('checkSpecializedFieldValue — source_reference', () => {
  const UUID = '11111111-2222-3333-4444-555555555555';

  it('accepts a UUID string regardless of allow_external', () => {
    expect(checkSpecializedFieldValue('source_reference', UUID, { allow_external: false }).ok).toBe(
      true
    );
    expect(checkSpecializedFieldValue('source_reference', UUID, { allow_external: true }).ok).toBe(
      true
    );
  });

  it('rejects non-UUID strings when allow_external = false', () => {
    expect(
      checkSpecializedFieldValue('source_reference', 'https://example.org', {
        allow_external: false,
      }).ok
    ).toBe(false);
  });

  it('accepts non-UUID strings when allow_external = true', () => {
    expect(
      checkSpecializedFieldValue('source_reference', 'https://example.org', {
        allow_external: true,
      }).ok
    ).toBe(true);
  });

  it('rejects oversize external strings', () => {
    expect(
      checkSpecializedFieldValue(
        'source_reference',
        'x'.repeat(SOURCE_REFERENCE_MAX_EXTERNAL_URL + 1),
        { allow_external: true }
      ).ok
    ).toBe(false);
  });

  it('accepts {source_id: UUID} object', () => {
    expect(checkSpecializedFieldValue('source_reference', { source_id: UUID }, {}).ok).toBe(true);
  });

  it('rejects {source_id: bogus} object', () => {
    expect(checkSpecializedFieldValue('source_reference', { source_id: 'not-uuid' }, {}).ok).toBe(
      false
    );
  });

  it('accepts {external_url} only when allow_external = true', () => {
    expect(
      checkSpecializedFieldValue(
        'source_reference',
        { external_url: 'https://x.org' },
        { allow_external: true }
      ).ok
    ).toBe(true);
    expect(
      checkSpecializedFieldValue(
        'source_reference',
        { external_url: 'https://x.org' },
        { allow_external: false }
      ).ok
    ).toBe(false);
  });

  it('rejects empty / oversize external_url', () => {
    expect(
      checkSpecializedFieldValue('source_reference', { external_url: '' }, { allow_external: true })
        .ok
    ).toBe(false);
    expect(
      checkSpecializedFieldValue(
        'source_reference',
        { external_url: 'x'.repeat(SOURCE_REFERENCE_MAX_EXTERNAL_URL + 1) },
        { allow_external: true }
      ).ok
    ).toBe(false);
  });

  it('rejects empty object', () => {
    expect(checkSpecializedFieldValue('source_reference', {}, {}).ok).toBe(false);
  });

  it('rejects non-string non-object value', () => {
    expect(checkSpecializedFieldValue('source_reference', 42, {}).ok).toBe(false);
  });
});
