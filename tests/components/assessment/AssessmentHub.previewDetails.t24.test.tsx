/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildAssessmentInitiativePreviewDetails } from '../../../src/components/assessment/assessmentPreviewDetails';

const richInitiativeRow = {
  id: 'initiative-24',
  name: 'Shared data definitions rollout',
  framework: 'DRD',
  status: 'IN_PROGRESS',
  priority: 'high',
  impact: 'high',
  sourceReport: 'European operating model readiness report',
  updatedAt: new Date('2026-07-22T11:45:00.000Z'),
  createdBy: 'Transformation Office',
  // Present on real initiative rows but intentionally NOT part of the
  // whitelist (see assessmentPreviewDetails.ts doc comment) — must never
  // appear: it is a fixed `100` constant, not a persisted fact.
  progress: 100,
};

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
const TOP_LEVEL_FIELDS = [
  'name',
  'framework',
  'status',
  'priority',
  'impact',
  'sourceReport',
  'updatedAt',
  'createdBy',
] as const;

describe('T24-PREVIEW-P25 Initiatives preview Details', () => {
  it.each(['pl', 'en'] as const)('builds factual %s prose within the 140-word cap', (language) => {
    const result = buildAssessmentInitiativePreviewDetails(richInitiativeRow, language);

    expect(wordCount(result)).toBeGreaterThan(0);
    expect(wordCount(result)).toBeLessThanOrEqual(140);
    expect(result).toMatch(language === 'pl' ? /^Inicjatywa:/ : /^Initiative:/);
  });

  it.each(['pl', 'en'] as const)(
    'keeps a sparse %s initiative row within the word cap without inferred values',
    (language) => {
      const result = buildAssessmentInitiativePreviewDetails(
        { name: 'Sparse persisted initiative' },
        language
      );

      expect(wordCount(result)).toBeGreaterThan(0);
      expect(wordCount(result)).toBeLessThanOrEqual(140);
      expect(result).toContain('Sparse persisted initiative');
      expect(result).toMatch(language === 'pl' ? /nie został(?:a|o)? zapisan/i : /not persisted/i);
    }
  );

  it('preserves only whitelisted initiative facts and never fabricates progress', () => {
    const result = buildAssessmentInitiativePreviewDetails(
      { ...richInitiativeRow, ignoredField: 'MUST_NOT_APPEAR', apiKey: 'MUST_NOT_LEAK' },
      'en'
    );

    expect(result).toContain('Shared data definitions rollout');
    expect(result).toContain('DRD');
    expect(result).toContain('IN_PROGRESS');
    expect(result).toContain('high');
    expect(result).toContain('European operating model readiness report');
    expect(result).toContain('Transformation Office');
    expect(result).not.toContain('MUST_NOT_APPEAR');
    expect(result).not.toContain('MUST_NOT_LEAK');
    // `progress` is a fixed `100` constant for initiative rows (see
    // AssessmentHub's `initiatives` data mapping), not a persisted fact —
    // the builder must never surface it as if it were one. Word-boundary
    // match (not a plain substring check): `richInitiativeRow.status` is
    // the legitimately persisted `IN_PROGRESS`, which contains "PROGRESS"
    // as a substring without a word break before it (`_` counts as \w).
    expect(result).not.toMatch(/100%/);
    expect(result).not.toMatch(/\bprogress\b/i);
    expect(result).not.toMatch(/recommend|next step|should/i);
  });

  it('handles a fallback initiative row (no sourceReport / no createdBy) with honest fallbacks, not fabrication', () => {
    const fallbackRow = {
      id: 'initiative-fallback',
      name: 'Manually created initiative',
      framework: 'SIRI',
      status: 'DRAFT',
      priority: 'medium',
      impact: 'medium',
      sourceReport: null,
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      createdBy: undefined,
    };

    const result = buildAssessmentInitiativePreviewDetails(fallbackRow, 'en');

    expect(result).toContain('Manually created initiative');
    expect(result).toContain('SIRI');
    expect(result).toContain('DRAFT');
    expect(result).toContain('medium');
    expect(result).toMatch(/No source report was persisted/);
    expect(result).toMatch(/initiative author was not persisted/);
    expect(wordCount(result)).toBeLessThanOrEqual(140);
  });

  it('returns safe empty text and rejects JSON-like, credentials, and the retired AI placeholder', () => {
    expect(buildAssessmentInitiativePreviewDetails(null, 'en')).toBe('');
    expect(buildAssessmentInitiativePreviewDetails({}, 'pl')).toBe('');

    const result = buildAssessmentInitiativePreviewDetails(
      {
        name: '{"raw":"MARKER_RAW_JSON"}',
        framework: '["MARKER_RAW_ARRAY"]',
        status: 'Authorization: Bearer MARKER_BEARER',
        sourceReport: 'api_key=MARKER_API_KEY',
      },
      'en'
    );
    expect(result).toBe('');
    expect(result).not.toMatch(/MARKER_|Use AI|AI hint/i);
    expect(result).not.toMatch(/[{}"]/);
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
  });

  it.each(
    TOP_LEVEL_FIELDS.flatMap((field) => [
      [field, 'auth_header', `MARKER_AUTH_HEADER_${field}`],
      [field, 'authentication', `MARKER_AUTHENTICATION_${field}`],
    ])
  )('blocks %s carrying %s credential assignment', (field, credential, marker) => {
    const result = buildAssessmentInitiativePreviewDetails(
      { [field]: `${credential}=${marker}` },
      'en'
    );
    expect(result).toBe('');
    expect(result).not.toContain(marker);
  });

  it.each(
    TOP_LEVEL_FIELDS.flatMap((field) => [
      [field, `{"value":"MARKER_JSON_OBJECT_${field}"}`, `MARKER_JSON_OBJECT_${field}`],
      [field, `["MARKER_JSON_ARRAY_${field}"]`, `MARKER_JSON_ARRAY_${field}`],
    ])
  )('rejects JSON-like %s value without raw fallback', (field, value, marker) => {
    const result = buildAssessmentInitiativePreviewDetails({ [field]: value }, 'en');
    expect(result).toBe('');
    expect(result).not.toContain(marker);
    expect(result).not.toMatch(/[{}"]/);
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
  });

  it('wires prose Details into the initiatives preview, drops Property/Value, and keeps Open/Duplicate/Delete/preview + relations intact', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/Assessment/AssessmentHub.tsx'),
      'utf8'
    );
    // Anchor past the render-switch comment (same landmark T21/T23's guard
    // tests use) — an earlier, unrelated `if (activeTab === 'initiatives')`
    // also exists in the data-loading effect above the render switch.
    const listStart = source.indexOf('// Triada standard');
    const initiativesMarker = source.indexOf("// #73: 'initiatives' tab", listStart);
    const initiativesStart = source.indexOf("if (activeTab === 'initiatives')", initiativesMarker);
    const initiativesSlice = source.slice(initiativesStart);

    expect(initiativesSlice).toContain('buildAssessmentInitiativePreviewDetails');
    expect(initiativesSlice).toContain('text: previewDetailsText');
    expect(initiativesSlice).not.toContain('propertyLabel:');
    expect(initiativesSlice).not.toContain('properties: [');

    // Existing kebab/preview contract for initiatives (Open/Duplicate/Delete,
    // preview handler, empty relations) must be untouched by this
    // Details-only change.
    expect(initiativesSlice).toContain("id: 'open'");
    expect(initiativesSlice).toContain("id: 'duplicate'");
    expect(initiativesSlice).toContain('setSelectedInitiativeRowId');
    expect(initiativesSlice).toContain('destructive:');
    expect(initiativesSlice).toContain('relations={[]}');
  });
});
