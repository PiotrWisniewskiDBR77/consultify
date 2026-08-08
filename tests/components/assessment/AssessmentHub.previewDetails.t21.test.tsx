/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildAssessmentPreviewDetails } from '../../../src/components/assessment/assessmentPreviewDetails';

const richRow = {
  id: 'assessment-21',
  name: 'European operating model readiness',
  framework: 'DRD',
  type: 'DRD',
  status: 'IN_REVIEW',
  progress: 72,
  overallScore: 3.6,
  description:
    'The persisted assessment covers governance, process ownership, technology foundations, workforce capability, data quality, customer operations, supplier collaboration, portfolio controls, and execution discipline. Interview evidence identifies strong executive sponsorship and repeatable planning routines. Recorded gaps concern local process documentation, shared data definitions, benefits tracking, role clarity, and integration ownership. The assessment scope includes the European business units and the current annual planning cycle.',
  createdAt: new Date('2026-07-01T08:00:00.000Z'),
  updatedAt: new Date('2026-07-18T14:30:00.000Z'),
  createdBy: 'Transformation Office',
};

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
const TOP_LEVEL_FIELDS = [
  'name',
  'framework',
  'type',
  'status',
  'progress',
  'overallScore',
  'description',
  'createdAt',
  'updatedAt',
  'createdBy',
] as const;

describe('T21 Assessment list preview Details', () => {
  it.each(['pl', 'en'] as const)('builds factual %s prose within 80–140 words', (language) => {
    const result = buildAssessmentPreviewDetails(richRow, language);

    expect(wordCount(result)).toBeGreaterThanOrEqual(80);
    expect(wordCount(result)).toBeLessThanOrEqual(140);
    expect(result).toMatch(language === 'pl' ? /^Ocena:/ : /^Assessment:/);
  });

  it.each(['pl', 'en'] as const)(
    'keeps every non-empty sparse %s row within 80–140 words without inferred values',
    (language) => {
      const result = buildAssessmentPreviewDetails({ name: 'Sparse persisted assessment' }, language);

      expect(wordCount(result)).toBeGreaterThanOrEqual(80);
      expect(wordCount(result)).toBeLessThanOrEqual(140);
      expect(result).toContain('Sparse persisted assessment');
      expect(result).toMatch(
        language === 'pl' ? /nie został(?:a|o)? zapisany/i : /not persisted/i
      );
    }
  );

  it('preserves only whitelisted selected-row facts without fabrication', () => {
    const result = buildAssessmentPreviewDetails(
      { ...richRow, ignoredField: 'MUST_NOT_APPEAR', apiKey: 'MUST_NOT_LEAK' },
      'en'
    );

    expect(result).toContain('European operating model readiness');
    expect(result).toContain('DRD');
    expect(result).toContain('IN_REVIEW');
    expect(result).toContain('72%');
    expect(result).toContain('3.6');
    expect(result).toContain('Transformation Office');
    expect(result).not.toContain('MUST_NOT_APPEAR');
    expect(result).not.toContain('MUST_NOT_LEAK');
    expect(result).not.toMatch(/recommend|next step|should/i);
  });

  it('returns safe empty text and rejects JSON-like, credentials, and the retired AI placeholder', () => {
    expect(buildAssessmentPreviewDetails(null, 'en')).toBe('');
    expect(buildAssessmentPreviewDetails({}, 'pl')).toBe('');

    const result = buildAssessmentPreviewDetails(
      {
        name: '{"raw":"MARKER_RAW_JSON"}',
        framework: '["MARKER_RAW_ARRAY"]',
        status: 'Authorization: Bearer MARKER_BEARER',
        description: 'api_key=MARKER_API_KEY',
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
    const result = buildAssessmentPreviewDetails(
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
      [field, `{"value":"MARKER_JSON_TRUNCATED_${field}"`, `MARKER_JSON_TRUNCATED_${field}`],
      [field, `{"value":"MARKER_JSON_TRAILING_${field}"} tail`, `MARKER_JSON_TRAILING_${field}`],
    ])
  )('rejects JSON-like %s value without raw fallback', (field, value, marker) => {
    const result = buildAssessmentPreviewDetails({ [field]: value }, 'en');
    expect(result).toBe('');
    expect(result).not.toContain(marker);
    expect(result).not.toMatch(/[{}"]/);
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
  });

  it('changes list+reports+initiatives Details and keeps canonical block order', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/Assessment/AssessmentHub.tsx'),
      'utf8'
    );
    const listStart = source.indexOf(
      "// 'list' tab → StandardTable + StandardPreview"
    );
    const reportsStart = source.indexOf("if (activeTab === 'reports')", listStart);
    const initiativesStart = source.indexOf("if (activeTab === 'initiatives')", reportsStart);
    const listSlice = source.slice(listStart, reportsStart);
    const reportsSlice = source.slice(reportsStart, initiativesStart);
    const initiativesSlice = source.slice(initiativesStart);

    expect(listSlice).toContain('text: previewDetailsText');
    expect(listSlice).not.toContain('propertyLabel:');
    // T23-PREVIEW-P25: Reports Details moved from Property/Value to prose —
    // this is the one line this correction flips versus the original T21
    // guard, which asserted Reports must stay on Property/Value.
    expect(reportsSlice).toContain('text: previewDetailsText');
    expect(reportsSlice).not.toContain('propertyLabel:');
    // T24-PREVIEW-P25: Initiatives Details moved from Property/Value to
    // prose too — the second (and final) line this correction flips versus
    // the original T21 guard.
    expect(initiativesSlice).toContain('text: previewDetailsText');
    expect(initiativesSlice).not.toContain('propertyLabel:');

    const blockOrder = ['meta={{', 'details={{', 'ai={{', 'relations={[]}', 'actions={previewActions}'];
    const positions = blockOrder.map((token) => listSlice.indexOf(token));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
