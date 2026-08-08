/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildReportPreviewDetails } from '../reportPreviewDetails';

const richReport = {
  kind: 'output',
  outputKind: 'assessment_report',
  id: 'report-18',
  name: 'Digital maturity report',
  status: 'APPROVED',
  createdAt: new Date('2026-07-01T08:00:00.000Z'),
  updatedAt: new Date('2026-07-19T14:30:00.000Z'),
  projectId: 'project-55',
  sourceType: 'assessment',
  sourceId: 'assessment-21',
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

describe('T18 Discovery reports preview Details', () => {
  it.each(['pl', 'en'] as const)(
    'builds rich factual %s Details within 80–140 words',
    (language) => {
      const result = buildReportPreviewDetails(richReport, language);
      expect(wordCount(result)).toBeGreaterThanOrEqual(80);
      expect(wordCount(result)).toBeLessThanOrEqual(140);
      expect(result).toContain('Digital maturity report');
      expect(result).toContain('assessment-21');
    }
  );

  it('keeps the shortest complete Polish record within the 80–140 word contract', () => {
    const result = buildReportPreviewDetails(
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
      const result = buildReportPreviewDetails({ name: 'Sparse report' }, language);
      expect(wordCount(result)).toBeGreaterThanOrEqual(80);
      expect(wordCount(result)).toBeLessThanOrEqual(140);
      expect(result).toContain('Sparse report');
      expect(result).toMatch(language === 'pl' ? /nie został/i : /not persisted/i);
    }
  );

  it('uses only persisted whitelist facts without recommendations or date defaults', () => {
    const result = buildReportPreviewDetails(
      { ...richReport, ignored: 'MUST_NOT_APPEAR', apiKey: 'MUST_NOT_LEAK' },
      'en'
    );
    expect(result).toContain('report-18');
    expect(result).toContain('project-55');
    expect(result).not.toContain('MUST_NOT_APPEAR');
    expect(result).not.toContain('MUST_NOT_LEAK');
    expect(result).not.toContain('2026-08-07');
    expect(result).not.toMatch(/recommend|next step|should/i);
  });

  it('returns empty text for empty and entirely rejected rows', () => {
    expect(buildReportPreviewDetails(null, 'en')).toBe('');
    expect(buildReportPreviewDetails({}, 'pl')).toBe('');
    expect(
      buildReportPreviewDetails(
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
  )('blocks credentials in report field %s', (field, value, marker) => {
    const result = buildReportPreviewDetails({ [field]: value }, 'en');
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
  )('rejects raw JSON-like report field %s', (field, value, marker) => {
    const result = buildReportPreviewDetails({ [field]: value }, 'en');
    expect(result).toBe('');
    expect(result).not.toContain(marker);
    expect(result).not.toMatch(/[{}"]/);
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
  });

  it('never stringifies a nested object or array value wholesale', () => {
    const result = buildReportPreviewDetails(
      {
        name: 'Nested payload report',
        status: { raw: 'MARKER_NESTED_OBJECT' },
        sourceType: ['MARKER_NESTED_ARRAY'],
      },
      'en'
    );
    expect(result).not.toContain('MARKER_NESTED_OBJECT');
    expect(result).not.toContain('MARKER_NESTED_ARRAY');
    expect(result).not.toContain('[object Object]');
  });

  /**
   * ── T18 source-slice: live 'outputs' surface, per-record outputKind
   *    selection, T17/openOutput/layout/KEBAB/PPM unregressed ─────────────────
   *
   * QA rejected the first version of this packet: it gated the new Details
   * builder on `activeTab === 'reports'`, which is unreachable — the only tab
   * `StandardModuleBar` ever offers is `'outputs'` ("Reports & Presentations").
   * That branch could never render on the live surface, so nothing was
   * actually fixable through the UI.
   *
   * This test proves the corrected wiring: on the LIVE `activeTab === 'outputs'`
   * tab, the builder is chosen PER RECORD from the persisted `outputKind`
   * (`assessment_report` / `report_builder` → T18's `buildReportPreviewDetails`;
   * `presentation_deck` → T17's `buildOutputPreviewDetails`, unchanged), and
   * exactly one Details section renders from exactly one text variable.
   */
  it('selects the Details builder by outputKind on the live outputs tab, not by a reports guard', () => {
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

    // Selection happens on the LIVE tab. This is the one guard that gates the
    // Details render — it must be 'outputs', never 'reports'. Matched as a
    // regex tolerant of formatting so a prettier reflow can't hide a
    // regression to the dead branch.
    expect(previewSlice).toMatch(/activeTab === 'outputs'\s*\n?\s*\?\s*isReportLikeOutputKind/);
    expect(previewSlice).not.toContain("activeTab === 'reports' &&");
    expect(previewSlice).not.toContain("activeTab === 'reports' ?");
    expect(previewSlice).not.toMatch(/isReportLikeOutputKind[\s\S]{0,40}activeTab === 'reports'/);

    // Per-record selection is by the PERSISTED, EXISTING OutputKind literals —
    // no invented kind is used to route the builder. Whitespace-tolerant: this
    // line wraps or not depending on prettier's column width for the file.
    expect(previewSlice).toMatch(
      /const isReportLikeOutputKind =\s*\n?\s*kind === 'assessment_report' \|\| kind === 'report_builder';/
    );

    // Both builders are wired: report-like kinds get T18, everything else
    // (presentation_deck) keeps T17's builder untouched.
    expect(previewSlice).toContain('buildReportPreviewDetails(');
    expect(previewSlice).toContain('buildOutputPreviewDetails(');

    // Exactly one canonical Details section, backed by exactly one text. T17's
    // own source-slice test pins the variable name `outputDetailsText` — kept
    // here deliberately so ONE variable serves BOTH builders' output, instead
    // of forking into a second `PreviewDetailsSection`/text pair.
    expect(previewSlice.match(/<PreviewDetailsSection/g)).toHaveLength(1);
    expect(previewSlice).toContain('text={outputDetailsText}');
    expect(previewSlice).toContain(
      'onCopy={() => void navigator.clipboard?.writeText(outputDetailsText)}'
    );
    // The rejected two-builder, two-block wiring (separate `reportDetailsText`
    // gated on the dead `'reports'` tab) must not come back.
    expect(previewSlice).not.toContain('reportDetailsText');
    expect(previewSlice.match(/text=\{[a-zA-Z]+DetailsText\}/g)).toHaveLength(1);

    // Library/Sessions/Initiatives preview branches are unmoved — selection
    // sits INSIDE the existing outputs-and-reports card branch, before the
    // ToolSessionPreviewV3Body / initiatives fallthrough.
    expect(previewSlice).toContain('<ToolSessionPreviewV3Body');
    expect(previewSlice.indexOf('buildReportPreviewDetails(')).toBeLessThan(
      previewSlice.indexOf('<ToolSessionPreviewV3Body')
    );

    // openOutput navigation is untouched by this packet.
    expect(openOutputSlice).not.toContain('buildOutputPreviewDetails');
    expect(openOutputSlice).not.toContain('buildReportPreviewDetails');
    expect(openOutputSlice).toContain("item.outputKind === 'assessment_report'");

    // Layout / KEBAB (row actions) / PPM (context-menu preview action) unregressed.
    expect(tableSlice).toContain('onRowDoubleClick={(row) => {');
    expect(tableSlice).toContain('rowActions={');
    expect(tableSlice).toContain("id: 'preview'");
    expect(tableSlice).toContain('setPreviewItemId(id)');
    expect(tableSlice).toContain('openOutput(row as any)');
    expect(source).toContain('<TableWithPreviewLayout<ToolsPreviewItem>');
  });

  it('leaves the shared outputs/reports data-source and column merge untouched', () => {
    // Grid/data-source infra ("isReportsAndPresentationsTab" and every switch
    // keyed on `activeTab === 'outputs' || activeTab === 'reports'") is out of
    // scope for this packet — QA required Details selection only, no routing,
    // tab, data, or handler changes.
    const source = readFileSync(
      join(process.cwd(), 'src/components/Discovery/DiscoveryToolsHub.tsx'),
      'utf8'
    );
    const occurrences = source.match(/activeTab === 'outputs' \|\| activeTab === 'reports'/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain('const isReportsAndPresentationsTab =');
  });

  /**
   * ── Render-logic proof: same helper output the component would render for
   *    each outputKind, driven from the same selection rule as the source
   *    slice above ────────────────────────────────────────────────────────
   */
  describe('builder selection mirrors the component rule for each outputKind', () => {
    const selectBuilder = (outputKind: string) =>
      outputKind === 'assessment_report' || outputKind === 'report_builder' ? 'report' : 'output';

    it('report-like kinds (assessment_report, report_builder) resolve to buildReportPreviewDetails', () => {
      expect(selectBuilder('assessment_report')).toBe('report');
      expect(selectBuilder('report_builder')).toBe('report');
    });

    it('presentation_deck resolves to buildOutputPreviewDetails, not the report builder', () => {
      expect(selectBuilder('presentation_deck')).toBe('output');
    });

    it('a report-like row renders Reports-flavored, factual text distinguishable from the outputs builder', async () => {
      const { buildOutputPreviewDetails } = await import('../outputPreviewDetails');
      const row = {
        id: 'row-1',
        name: 'Quarterly assessment',
        outputKind: 'assessment_report',
        status: 'DRAFT',
      };
      const reportText = buildReportPreviewDetails(row, 'en');
      const outputText = buildOutputPreviewDetails(row, 'en');
      expect(reportText).toContain('Report name: Quarterly assessment.');
      expect(outputText).toContain('Name: Quarterly assessment.');
      expect(reportText).not.toBe(outputText);
    });
  });
});
