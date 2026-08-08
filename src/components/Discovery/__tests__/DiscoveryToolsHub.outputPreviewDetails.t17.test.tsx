/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildOutputPreviewDetails } from '../outputPreviewDetails';

const richOutput = {
  kind: 'output',
  outputKind: 'assessment_report',
  id: 'output-17',
  name: 'Digital readiness findings',
  status: 'APPROVED',
  createdAt: new Date('2026-07-01T08:00:00.000Z'),
  updatedAt: new Date('2026-07-19T14:30:00.000Z'),
  projectId: 'project-44',
  sourceType: 'assessment',
  sourceId: 'assessment-12',
};

const STRING_FIELDS = [
  'id',
  'name',
  'outputKind',
  'status',
  'createdAt',
  'updatedAt',
  'projectId',
  'sourceType',
  'sourceId',
] as const;

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

describe('T17 Discovery outputs preview Details', () => {
  it.each(['pl', 'en'] as const)(
    'builds rich factual %s Details within 80–140 words',
    (language) => {
      const result = buildOutputPreviewDetails(richOutput, language);
      expect(wordCount(result)).toBeGreaterThanOrEqual(80);
      expect(wordCount(result)).toBeLessThanOrEqual(140);
      expect(result).toContain('Digital readiness findings');
      expect(result).toContain('assessment-12');
    }
  );

  it('keeps the shortest complete Polish record within the 80–140 word contract', () => {
    const result = buildOutputPreviewDetails(
      {
        id: 'a',
        name: 'a',
        outputKind: 'a',
        status: 'a',
        createdAt: 'a',
        updatedAt: 'a',
        projectId: 'a',
        sourceType: 'a',
        sourceId: 'a',
      },
      'pl'
    );

    expect(wordCount(result)).toBeGreaterThanOrEqual(80);
    expect(wordCount(result)).toBeLessThanOrEqual(140);
  });

  it.each(['pl', 'en'] as const)(
    'builds minimal non-empty %s Details within 80–140 words',
    (language) => {
      const result = buildOutputPreviewDetails({ name: 'Sparse output' }, language);
      expect(wordCount(result)).toBeGreaterThanOrEqual(80);
      expect(wordCount(result)).toBeLessThanOrEqual(140);
      expect(result).toContain('Sparse output');
      expect(result).toMatch(language === 'pl' ? /nie został/i : /not persisted/i);
    }
  );

  it('uses only persisted whitelist facts without recommendations or date defaults', () => {
    const result = buildOutputPreviewDetails(
      { ...richOutput, ignored: 'MUST_NOT_APPEAR', apiKey: 'MUST_NOT_LEAK' },
      'en'
    );
    expect(result).toContain('output-17');
    expect(result).toContain('project-44');
    expect(result).not.toContain('MUST_NOT_APPEAR');
    expect(result).not.toContain('MUST_NOT_LEAK');
    expect(result).not.toContain('2026-08-07');
    expect(result).not.toMatch(/recommend|next step|should/i);
  });

  it('returns empty text for empty and entirely rejected rows', () => {
    expect(buildOutputPreviewDetails(null, 'en')).toBe('');
    expect(buildOutputPreviewDetails({}, 'pl')).toBe('');
    expect(
      buildOutputPreviewDetails(
        {
          name: '<b>MARKER_HTML</b>',
          status: '{"raw":"MARKER_JSON"}',
          sourceId: 'Authorization: Bearer MARKER_BEARER',
        },
        'en'
      )
    ).toBe('');
  });

  it.each(
    STRING_FIELDS.flatMap((field) => [
      [field, `auth_header=MARKER_AUTH_${field}`, `MARKER_AUTH_${field}`],
      [field, `authentication:MARKER_LOGIN_${field}`, `MARKER_LOGIN_${field}`],
      [field, `Bearer MARKER_BEARER_${field}`, `MARKER_BEARER_${field}`],
      [field, `eyJMARKER_JWT_${field}.payload.signature`, `MARKER_JWT_${field}`],
    ])
  )('blocks credentials in output field %s', (field, value, marker) => {
    const result = buildOutputPreviewDetails({ [field]: value }, 'en');
    expect(result).toBe('');
    expect(result).not.toContain(marker);
  });

  it.each(
    STRING_FIELDS.flatMap((field) => [
      [field, `{"x":"MARKER_OBJECT_${field}"}`, `MARKER_OBJECT_${field}`],
      [field, `["MARKER_ARRAY_${field}"]`, `MARKER_ARRAY_${field}`],
      [field, `{"x":"MARKER_TRUNCATED_${field}"`, `MARKER_TRUNCATED_${field}`],
      [field, `{"x":"MARKER_TRAILING_${field}"} tail`, `MARKER_TRAILING_${field}`],
    ])
  )('rejects raw JSON-like output field %s', (field, value, marker) => {
    const result = buildOutputPreviewDetails({ [field]: value }, 'en');
    expect(result).toBe('');
    expect(result).not.toContain(marker);
    expect(result).not.toMatch(/[{}"]/);
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
  });

  it('limits Details to outputs and preserves reports, openOutput, layout, kebab, and PPM paths', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/Discovery/DiscoveryToolsHub.tsx'),
      'utf8'
    );
    const openOutputStart = source.indexOf('const openOutput = useCallback');
    const openDocumentStart = source.indexOf('const openDocumentById', openOutputStart);
    const openOutputSlice = source.slice(openOutputStart, openDocumentStart);
    const previewStart = source.lastIndexOf('renderPreview={(item) => {');
    const footerStart = source.indexOf('renderPreviewFooter={(item) => {', previewStart);
    const previewSlice = source.slice(previewStart, footerStart);
    const tableStart = source.indexOf('<StandardTable', footerStart);
    const tableSlice = source.slice(tableStart);

    expect(previewSlice).toContain("activeTab === 'outputs'");
    expect(previewSlice).toContain('<PreviewDetailsSection');
    expect(previewSlice).toContain('text={outputDetailsText}');
    expect(previewSlice).not.toContain("activeTab === 'reports' && outputDetailsText");
    expect(openOutputSlice).not.toContain('buildOutputPreviewDetails');
    expect(openOutputSlice).toContain("item.outputKind === 'assessment_report'");
    expect(tableSlice).toContain('onRowDoubleClick={(row) => {');
    expect(tableSlice).toContain('rowActions={');
    expect(tableSlice).toContain("id: 'preview'");
    expect(tableSlice).toContain('setPreviewItemId(id)');
    expect(tableSlice).toContain('openOutput(row as any)');
    expect(source).toContain('<TableWithPreviewLayout<ToolsPreviewItem>');
  });
});
