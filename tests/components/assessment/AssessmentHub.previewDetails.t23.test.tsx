/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildAssessmentReportPreviewDetails } from '../../../src/components/assessment/assessmentPreviewDetails';

const richReportRow = {
  id: 'report-23',
  name: 'European operating model readiness report',
  framework: 'DRD',
  status: 'APPROVED',
  assessmentName: 'European operating model readiness',
  updatedAt: new Date('2026-07-20T09:15:00.000Z'),
  createdBy: 'Transformation Office',
  // Present on real report rows but intentionally NOT part of the whitelist
  // (see assessmentPreviewDetails.ts doc comment) — must never appear.
  progress: 80,
  builderReportId: 'builder-23',
  _isImported: false,
};

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
const TOP_LEVEL_FIELDS = [
  'name',
  'framework',
  'status',
  'assessmentName',
  'updatedAt',
  'createdBy',
] as const;

describe('T23-PREVIEW-P25 Reports preview Details', () => {
  it.each(['pl', 'en'] as const)('builds factual %s prose within the 140-word cap', (language) => {
    const result = buildAssessmentReportPreviewDetails(richReportRow, language);

    expect(wordCount(result)).toBeGreaterThan(0);
    expect(wordCount(result)).toBeLessThanOrEqual(140);
    expect(result).toMatch(language === 'pl' ? /^Raport:/ : /^Report:/);
  });

  it.each(['pl', 'en'] as const)(
    'keeps a sparse %s report row within the word cap without inferred values',
    (language) => {
      const result = buildAssessmentReportPreviewDetails(
        { name: 'Sparse persisted report' },
        language
      );

      expect(wordCount(result)).toBeGreaterThan(0);
      expect(wordCount(result)).toBeLessThanOrEqual(140);
      expect(result).toContain('Sparse persisted report');
      expect(result).toMatch(language === 'pl' ? /nie został(?:a|o)? zapisan/i : /not persisted/i);
    }
  );

  it('preserves only whitelisted report facts and never fabricates progress', () => {
    const result = buildAssessmentReportPreviewDetails(
      { ...richReportRow, ignoredField: 'MUST_NOT_APPEAR', apiKey: 'MUST_NOT_LEAK' },
      'en'
    );

    expect(result).toContain('European operating model readiness report');
    expect(result).toContain('DRD');
    expect(result).toContain('APPROVED');
    expect(result).toContain('European operating model readiness');
    expect(result).toContain('Transformation Office');
    expect(result).not.toContain('MUST_NOT_APPEAR');
    expect(result).not.toContain('MUST_NOT_LEAK');
    // `progress` is a status-derived UI proxy for report rows, not a
    // persisted fact (see AssessmentHub's `reports` data mapping) — the
    // builder must never surface it as if it were one.
    expect(result).not.toMatch(/80%/);
    expect(result).not.toMatch(/progress/i);
    expect(result).not.toMatch(/recommend|next step|should/i);
  });

  it('handles imported reports (no assessmentName / no createdBy) with honest fallbacks, not fabrication', () => {
    const importedRow = {
      id: 'import-9',
      name: 'Imported Report.pdf',
      framework: 'SIRI',
      status: 'ANALYZED',
      assessmentName: null,
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      createdBy: undefined,
    };

    const result = buildAssessmentReportPreviewDetails(importedRow, 'en');

    expect(result).toContain('Imported Report.pdf');
    expect(result).toContain('SIRI');
    expect(result).toContain('ANALYZED');
    expect(result).toMatch(/No source assessment was persisted/);
    expect(result).toMatch(/report author was not persisted/);
    expect(wordCount(result)).toBeLessThanOrEqual(140);
  });

  it('returns safe empty text and rejects JSON-like, credentials, and the retired AI placeholder', () => {
    expect(buildAssessmentReportPreviewDetails(null, 'en')).toBe('');
    expect(buildAssessmentReportPreviewDetails({}, 'pl')).toBe('');

    const result = buildAssessmentReportPreviewDetails(
      {
        name: '{"raw":"MARKER_RAW_JSON"}',
        framework: '["MARKER_RAW_ARRAY"]',
        status: 'Authorization: Bearer MARKER_BEARER',
        assessmentName: 'api_key=MARKER_API_KEY',
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
    const result = buildAssessmentReportPreviewDetails(
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
    const result = buildAssessmentReportPreviewDetails({ [field]: value }, 'en');
    expect(result).toBe('');
    expect(result).not.toContain(marker);
    expect(result).not.toMatch(/[{}"]/);
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
  });

  it('wires prose Details into the reports preview, drops Property/Value, and keeps the imported-reports guard + row actions intact', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/Assessment/AssessmentHub.tsx'),
      'utf8'
    );
    // Anchor past the render-switch comment (same landmark T21's guard test
    // uses) — an earlier, unrelated `if (activeTab === 'reports')` also
    // exists in the data-loading effect above the render switch.
    const listStart = source.indexOf('// Triada standard');
    const reportsMarker = source.indexOf("// #73: 'reports' tab", listStart);
    const reportsStart = source.indexOf("if (activeTab === 'reports')", reportsMarker);
    const initiativesMarker = source.indexOf("// #73: 'initiatives' tab", reportsStart);
    const initiativesStart = source.indexOf("if (activeTab === 'initiatives')", initiativesMarker);
    const reportsSlice = source.slice(reportsStart, initiativesStart);

    expect(reportsSlice).toContain('buildAssessmentReportPreviewDetails');
    expect(reportsSlice).toContain('text: previewDetailsText');
    expect(reportsSlice).not.toContain('propertyLabel:');
    expect(reportsSlice).not.toContain('properties: [');

    // Existing kebab/preview contract for reports (Open/Duplicate/Delete,
    // imported-reports edit-note guard, ReportSlideOverContent) must be
    // untouched by this Details-only change.
    expect(reportsSlice).toContain("id: 'open'");
    expect(reportsSlice).toContain("id: 'duplicate'");
    expect(reportsSlice).toContain('isImported');
    expect(reportsSlice).toContain('ReportSlideOverContent');
    expect(reportsSlice).toContain('relations={[]}');
  });
});
