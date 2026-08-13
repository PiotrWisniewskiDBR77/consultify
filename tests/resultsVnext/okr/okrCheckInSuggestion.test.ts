/**
 * OKR-E004 — AC-F-012-AC-01 (the "isolating AC") — `suggestNextCheckInValue`.
 *
 * No DB, no network. Two proof classes:
 *  1. STATIC: `okrCheckInSuggestionService.ts`'s own source text imports
 *     NOTHING from `kpiDefinitionService.js` (legacy) or
 *     `resultsVnext/kpi/*` (vNext) — the literal, already-confirmed AS-IS
 *     violation this AC exists to block from crossing into vNext
 *     (`okrService.ts::getSuggestedValueForKeyResult`). Mirrors
 *     `legacyIsolation.realdb.test.ts`'s established pattern elsewhere in
 *     this program for D09-class guarantees, but needs no DB — a pure
 *     source-text/import-graph check.
 *  2. BEHAVIORAL: the function itself only ever reads the `OkrCheckIn[]`
 *     array it is handed — never calls out anywhere else — proven by
 *     exercising every basis branch (`no_history`/`linear_trend`) purely
 *     from in-memory fixtures, no fixture ever touching a KPI concept.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { suggestNextCheckInValue } from '../../../server/src/services/resultsVnext/okr/okrCheckInSuggestionService.js';
import type { OkrCheckIn } from '../../../server/src/services/resultsVnext/okr/okrCheckInTypes.js';
import type { OkrKeyResult } from '../../../server/src/services/resultsVnext/okr/okrKeyResultTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUGGESTION_SERVICE_SOURCE_PATH = path.resolve(
  __dirname,
  '../../../server/src/services/resultsVnext/okr/okrCheckInSuggestionService.ts'
);

function baseKeyResult(overrides: Partial<OkrKeyResult> = {}): OkrKeyResult {
  return {
    keyResultId: 'kr-1',
    objectiveId: 'obj-1',
    setId: 'set-1',
    organizationId: 'org-1',
    ownerUserId: 'user-1',
    title: 'Suggestion fixture KR',
    description: null,
    measurementType: 'numeric',
    unit: null,
    currency: null,
    baselineValue: '0',
    targetValue: '100',
    startValue: null,
    currentValue: '10',
    direction: 'increase',
    rangeMin: null,
    rangeMax: null,
    progress: '0.1',
    progressCalcPolicyVersionId: 'policy-1',
    progressCalcReason: 'increase: ...',
    outOfRangeDistance: null,
    confidence: null,
    confidenceNumericValue: null,
    status: 'on_track',
    sourceType: 'manual',
    sourceReference: null,
    weight: null,
    rowVersion: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function checkIn(overrides: Partial<OkrCheckIn> = {}): OkrCheckIn {
  return {
    checkInId: 'checkin-1',
    organizationId: 'org-1',
    keyResultId: 'kr-1',
    objectiveId: 'obj-1',
    setId: 'set-1',
    cadenceOccurrenceId: 'occ-1',
    previousValue: null,
    newValue: '10',
    calculatedProgress: '0.1',
    ownerDeclaredStatus: null,
    systemSuggestedStatus: null,
    confidence: null,
    confidenceNumericValue: null,
    note: 'note',
    blocker: null,
    supportRequested: null,
    evidenceRefs: [],
    correctionOfCheckInId: null,
    correctionReason: null,
    submittedBy: 'user-1',
    submittedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('OKR-E004 AC-012 isolation — okrCheckInSuggestionService.ts (static)', () => {
  it('imports NOTHING from kpiDefinitionService.js (legacy) or resultsVnext/kpi/* (vNext) — literal source-text proof', () => {
    const source = fs.readFileSync(SUGGESTION_SERVICE_SOURCE_PATH, 'utf-8');
    const importLines = source
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line) || /from\s+['"]/.test(line));

    const forbidden = importLines.filter(
      (line) => /kpiDefinitionService/i.test(line) || /resultsVnext\/kpi\//.test(line) || /['"]\.\.\/kpi\//.test(line)
    );
    expect(forbidden, `forbidden import lines found: ${JSON.stringify(forbidden)}`).toEqual([]);

    // Sanity: the file DOES import something (a vacuous "no forbidden
    // imports" from an empty import list would prove nothing).
    expect(importLines.length).toBeGreaterThan(0);
  });

  it('issues literally no SQL string in its CODE — a DB-free pure function, cannot query kpi_time_series even accidentally', () => {
    const source = fs.readFileSync(SUGGESTION_SERVICE_SOURCE_PATH, 'utf-8');
    // Strip block (/** ... */) and line (// ...) comments first — the
    // file's own doc comments MUST discuss "kpi_time_series" by name
    // (that's the whole point of documenting what this file forbids), so
    // checking the raw source text would make this assertion vacuously
    // fail on its own documentation. Checking CODE-only text is the real
    // proof: no live SQL string, no `client.query`, no `pg` import.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(/\bSELECT\b/i.test(codeOnly)).toBe(false);
    expect(/kpi_time_series/i.test(codeOnly)).toBe(false);
    expect(/\bclient\.query\b/.test(codeOnly)).toBe(false);
    expect(/from\s+['"]pg['"]/.test(codeOnly)).toBe(false);
  });
});

describe('OKR-E004 AC-012 isolation — suggestNextCheckInValue (behavioral, pure)', () => {
  it('no_history: zero prior check-ins with a numeric value', () => {
    const result = suggestNextCheckInValue([], baseKeyResult());
    expect(result.basis).toBe('no_history');
    expect(result.suggestedValue).toBeNull();
  });

  it('no_history: exactly one prior numeric check-in is not enough to trend', () => {
    const result = suggestNextCheckInValue([checkIn({ newValue: '10' })], baseKeyResult());
    expect(result.basis).toBe('no_history');
    expect(result.suggestedValue).toBeNull();
  });

  it('linear_trend: two or more prior check-ins project the average step forward', () => {
    const history = [
      checkIn({ checkInId: 'c1', newValue: '10', submittedAt: '2026-01-01T00:00:00.000Z' }),
      checkIn({ checkInId: 'c2', newValue: '20', submittedAt: '2026-01-08T00:00:00.000Z' }),
      checkIn({ checkInId: 'c3', newValue: '30', submittedAt: '2026-01-15T00:00:00.000Z' }),
    ];
    const result = suggestNextCheckInValue(history, baseKeyResult());
    expect(result.basis).toBe('linear_trend');
    expect(result.suggestedValue).toBeCloseTo(40, 10);
  });

  it('sorts history by submittedAt itself — caller order does not matter', () => {
    const history = [
      checkIn({ checkInId: 'c3', newValue: '30', submittedAt: '2026-01-15T00:00:00.000Z' }),
      checkIn({ checkInId: 'c1', newValue: '10', submittedAt: '2026-01-01T00:00:00.000Z' }),
      checkIn({ checkInId: 'c2', newValue: '20', submittedAt: '2026-01-08T00:00:00.000Z' }),
    ];
    const result = suggestNextCheckInValue(history, baseKeyResult());
    expect(result.suggestedValue).toBeCloseTo(40, 10);
  });

  it('null-valued (qualitative-only) check-ins are excluded from the numeric trend', () => {
    const history = [
      checkIn({ checkInId: 'c1', newValue: '10', submittedAt: '2026-01-01T00:00:00.000Z' }),
      checkIn({ checkInId: 'c2', newValue: null, submittedAt: '2026-01-08T00:00:00.000Z' }),
      checkIn({ checkInId: 'c3', newValue: '20', submittedAt: '2026-01-15T00:00:00.000Z' }),
    ];
    const result = suggestNextCheckInValue(history, baseKeyResult());
    expect(result.basis).toBe('linear_trend');
    expect(result.suggestedValue).toBeCloseTo(30, 10);
  });
});
