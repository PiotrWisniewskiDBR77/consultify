import { describe, expect, it } from 'vitest';

import {
  ALL_FORMATS,
  buildExpectedParityFromDeckDocument,
  buildParityCheckReport,
  classifyCardSection,
  deriveRequiredSections,
  expectedWatermarkFromConfidentiality,
  type ExportRecordSummary,
  type ParityExpected,
} from '../presentationExportParityService.js';

const REQUIRED_SECTIONS = ['cover', 'dashboard', 'insight', 'roadmap', 'appendix'];

function makeRecord(
  overrides: Partial<ExportRecordSummary> & { format: ExportRecordSummary['format'] }
): ExportRecordSummary {
  return {
    format: overrides.format,
    generatedAt: overrides.generatedAt ?? '2026-05-07T10:00:00.000Z',
    status: overrides.status ?? 'completed',
    pageCount: overrides.pageCount ?? 5,
    headerText: overrides.headerText ?? 'Acme · Confidential briefing',
    footerText: overrides.footerText ?? 'Consultify · 2026',
    confidentialityWatermark: overrides.confidentialityWatermark ?? null,
    sectionsPresent: overrides.sectionsPresent ?? [...REQUIRED_SECTIONS],
    bytes: overrides.bytes ?? 1024,
    errorReason: overrides.errorReason ?? null,
  };
}

function baseExpected(overrides: Partial<ParityExpected> = {}): ParityExpected {
  return {
    pageCount: overrides.pageCount ?? 5,
    headerText: overrides.headerText ?? 'Acme · Confidential briefing',
    footerText: overrides.footerText ?? 'Consultify · 2026',
    confidentialityWatermark: overrides.confidentialityWatermark ?? null,
    requiredSections: overrides.requiredSections ?? [...REQUIRED_SECTIONS],
  };
}

describe('presentationExportParityService.buildParityCheckReport', () => {
  it('test 1 — returns PASS when all formats match expected', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-1',
      expected: baseExpected(),
      exports: ALL_FORMATS.map((format) => makeRecord({ format })),
    });
    expect(report.verdict).toBe('PASS');
    expect(report.issues).toHaveLength(0);
    expect(report.formatsChecked.sort()).toEqual([...ALL_FORMATS].sort());
    expect(report.formatsMissing).toEqual([]);
    expect(report.summary.total).toBe(0);
  });

  it('test 2 — missing pdf produces a critical missing_export issue', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-2',
      expected: baseExpected(),
      exports: ['pptx', 'png', 'html'].map((f) => makeRecord({ format: f as any })),
    });
    expect(report.verdict).toBe('FAIL');
    expect(report.formatsMissing).toContain('pdf');
    const missingPdf = report.issues.find(
      (i) => i.format === 'pdf' && i.field === 'missing_export'
    );
    expect(missingPdf?.severity).toBe('critical');
  });

  it('test 3 — missing pptx produces a critical missing_export issue', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-3',
      expected: baseExpected(),
      exports: ['pdf', 'png', 'html'].map((f) => makeRecord({ format: f as any })),
    });
    expect(report.verdict).toBe('FAIL');
    const missingPptx = report.issues.find(
      (i) => i.format === 'pptx' && i.field === 'missing_export'
    );
    expect(missingPptx?.severity).toBe('critical');
  });

  it('test 4 — missing png produces only an info issue (not critical)', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-4',
      expected: baseExpected(),
      exports: ['pdf', 'pptx', 'html'].map((f) => makeRecord({ format: f as any })),
    });
    const missingPng = report.issues.find(
      (i) => i.format === 'png' && i.field === 'missing_export'
    );
    expect(missingPng?.severity).toBe('info');
    expect(report.summary.critical).toBe(0);
    expect(report.verdict).toBe('PASS_WITH_WARNINGS');
  });

  it('test 5 — missing html produces only an info issue (not critical)', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-5',
      expected: baseExpected(),
      exports: ['pdf', 'pptx', 'png'].map((f) => makeRecord({ format: f as any })),
    });
    const missingHtml = report.issues.find(
      (i) => i.format === 'html' && i.field === 'missing_export'
    );
    expect(missingHtml?.severity).toBe('info');
    expect(report.summary.critical).toBe(0);
    expect(report.verdict).toBe('PASS_WITH_WARNINGS');
  });

  it('test 6 — page count mismatch produces a critical issue', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-6',
      expected: baseExpected({ pageCount: 5 }),
      exports: [
        makeRecord({ format: 'pdf', pageCount: 5 }),
        makeRecord({ format: 'pptx', pageCount: 7 }),
        makeRecord({ format: 'png', pageCount: 5 }),
        makeRecord({ format: 'html', pageCount: 5 }),
      ],
    });
    const issue = report.issues.find((i) => i.format === 'pptx' && i.field === 'page_count');
    expect(issue?.severity).toBe('critical');
    expect(issue?.expected).toBe(5);
    expect(issue?.actual).toBe(7);
    expect(report.verdict).toBe('FAIL');
  });

  it('test 7 — header whitespace differences are normalized away (no issue)', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-7',
      expected: baseExpected({ headerText: 'Acme · Confidential briefing' }),
      exports: ALL_FORMATS.map((format) =>
        makeRecord({ format, headerText: '  Acme  ·   Confidential\tbriefing  ' })
      ),
    });
    expect(report.issues.filter((i) => i.field === 'header_text')).toHaveLength(0);
    expect(report.verdict).toBe('PASS');
  });

  it('test 8 — confidentiality watermark missing on confidential deck is critical', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-8',
      expected: baseExpected({ confidentialityWatermark: 'CONFIDENTIAL' }),
      exports: ALL_FORMATS.map((format) =>
        makeRecord({ format, confidentialityWatermark: format === 'png' ? null : 'CONFIDENTIAL' })
      ),
    });
    const issue = report.issues.find(
      (i) => i.format === 'png' && i.field === 'confidentiality_watermark'
    );
    expect(issue?.severity).toBe('critical');
    expect(report.verdict).toBe('FAIL');
  });

  it('test 9 — public deck (expected watermark null, actual null) produces no issue', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-9',
      expected: baseExpected({ confidentialityWatermark: null }),
      exports: ALL_FORMATS.map((format) => makeRecord({ format, confidentialityWatermark: null })),
    });
    expect(report.issues.filter((i) => i.field === 'confidentiality_watermark')).toHaveLength(0);
    expect(report.verdict).toBe('PASS');
  });

  it('test 10 — section missing in pptx is critical', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-10',
      expected: baseExpected({ requiredSections: REQUIRED_SECTIONS }),
      exports: [
        makeRecord({ format: 'pdf' }),
        makeRecord({
          format: 'pptx',
          sectionsPresent: ['cover', 'dashboard', 'insight', 'roadmap'],
        }),
        makeRecord({ format: 'png' }),
        makeRecord({ format: 'html' }),
      ],
    });
    const issue = report.issues.find(
      (i) => i.format === 'pptx' && i.field === 'sections' && i.expected === 'appendix'
    );
    expect(issue?.severity).toBe('critical');
    expect(report.verdict).toBe('FAIL');
  });

  it('test 11 — failed export status produces a critical export_status issue', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-11',
      expected: baseExpected(),
      exports: [
        makeRecord({ format: 'pdf' }),
        makeRecord({ format: 'pptx', status: 'failed', errorReason: 'render_timeout' }),
        makeRecord({ format: 'png' }),
        makeRecord({ format: 'html' }),
      ],
    });
    const issue = report.issues.find((i) => i.format === 'pptx' && i.field === 'export_status');
    expect(issue?.severity).toBe('critical');
    expect(issue?.actual).toBe('failed');
    expect(issue?.reason).toContain('render_timeout');
    expect(report.verdict).toBe('FAIL');
  });

  it('test 12 — only-warning + only-info issues yield PASS_WITH_WARNINGS', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-12',
      expected: baseExpected({ headerText: 'Canonical header' }),
      exports: [
        makeRecord({ format: 'pdf', headerText: 'Different header' }),
        makeRecord({ format: 'pptx' }),
        // png missing — info
      ].concat([makeRecord({ format: 'html' })]),
    });
    expect(report.summary.critical).toBe(0);
    expect(report.summary.warning).toBeGreaterThanOrEqual(1);
    expect(report.summary.info).toBeGreaterThanOrEqual(1);
    expect(report.verdict).toBe('PASS_WITH_WARNINGS');
  });

  it('test 13 — mix of critical + warning yields FAIL', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-13',
      expected: baseExpected({ headerText: 'Canonical header' }),
      exports: [
        makeRecord({ format: 'pdf', headerText: 'Other header' }),
        makeRecord({ format: 'pptx', pageCount: 999 }),
        makeRecord({ format: 'png' }),
        makeRecord({ format: 'html' }),
      ],
    });
    expect(report.summary.critical).toBeGreaterThanOrEqual(1);
    expect(report.summary.warning).toBeGreaterThanOrEqual(1);
    expect(report.verdict).toBe('FAIL');
  });

  it('test 14 — report is JSON-serializable round-trip', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-14',
      expected: baseExpected({ confidentialityWatermark: 'RESTRICTED' }),
      exports: [
        makeRecord({ format: 'pdf', confidentialityWatermark: 'RESTRICTED' }),
        makeRecord({ format: 'pptx', confidentialityWatermark: 'RESTRICTED' }),
        makeRecord({ format: 'png', confidentialityWatermark: 'RESTRICTED' }),
        makeRecord({ format: 'html', confidentialityWatermark: 'RESTRICTED' }),
      ],
    });
    const json = JSON.stringify(report);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.deckId).toBe('deck-14');
    expect(parsed.verdict).toBe('PASS');
    expect(Array.isArray(parsed.issues)).toBe(true);
  });

  it('test 15 — never throws on malformed input (null/undefined exports, garbage fields)', () => {
    expect(() =>
      buildParityCheckReport({
        deckId: undefined as any,
        expected: undefined as any,
        exports: undefined as any,
      })
    ).not.toThrow();
    const report = buildParityCheckReport({
      deckId: '' as any,
      expected: {
        pageCount: 'not-a-number' as any,
        headerText: 42 as any,
        footerText: undefined as any,
        confidentialityWatermark: 'confidential',
        requiredSections: ['cover', 123 as any, ''],
      },
      exports: [
        {
          format: 'banana' as any,
          generatedAt: 'not-a-date',
          status: 'weird' as any,
          pageCount: 'x' as any,
          headerText: null,
          footerText: null,
          confidentialityWatermark: null,
          sectionsPresent: null as any,
          bytes: null,
          errorReason: null,
        },
      ],
    });
    expect(report.verdict).toBeDefined();
    expect(Array.isArray(report.issues)).toBe(true);
  });

  it('test 16 — picks the most-recent export per format when duplicates exist', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-16',
      expected: baseExpected({ pageCount: 10 }),
      exports: [
        makeRecord({ format: 'pdf', generatedAt: '2026-05-01T08:00:00.000Z', pageCount: 7 }),
        makeRecord({ format: 'pdf', generatedAt: '2026-05-07T08:00:00.000Z', pageCount: 10 }),
        makeRecord({ format: 'pptx', pageCount: 10 }),
        makeRecord({ format: 'png', pageCount: 10 }),
        makeRecord({ format: 'html', pageCount: 10 }),
      ],
    });
    expect(
      report.issues.filter((i) => i.format === 'pdf' && i.field === 'page_count')
    ).toHaveLength(0);
    expect(report.verdict).toBe('PASS');
  });

  it('test 17 — operator-facing reasons mention format name, expected vs actual values', () => {
    const report = buildParityCheckReport({
      deckId: 'deck-17',
      expected: baseExpected({ pageCount: 5 }),
      exports: [
        makeRecord({ format: 'pdf', pageCount: 4 }),
        makeRecord({ format: 'pptx' }),
        makeRecord({ format: 'png' }),
        makeRecord({ format: 'html' }),
      ],
    });
    const issue = report.issues.find((i) => i.format === 'pdf' && i.field === 'page_count');
    expect(issue?.reason).toMatch(/PDF/);
    expect(issue?.reason).toContain('4');
    expect(issue?.reason).toContain('5');
  });
});

describe('presentationExportParityService.buildExpectedParityFromDeckDocument', () => {
  it('classifies card sections by intent and layout', () => {
    expect(classifyCardSection({ intent: 'cover' })).toBe('cover');
    expect(classifyCardSection({ intent: 'appendix' })).toBe('appendix');
    expect(classifyCardSection({ intent: 'roadmap' })).toBe('roadmap');
    expect(classifyCardSection({ intent: 'performance_overview' })).toBe('dashboard');
    expect(classifyCardSection({ intent: 'key_messages' })).toBe('insight');
    expect(
      classifyCardSection({ intent: 'something-else', layout_id: 'dashboard-kpi-strip' })
    ).toBe('dashboard');
    expect(classifyCardSection(null)).toBeNull();
  });

  it('derives required sections only when present in the deck', () => {
    const required = deriveRequiredSections({
      cards: [
        { intent: 'cover' } as any,
        { intent: 'performance_overview' } as any,
        { intent: 'roadmap' } as any,
      ],
    } as any);
    expect(required).toEqual(['cover', 'dashboard', 'roadmap']);
  });

  it('maps confidentiality to the canonical watermark', () => {
    expect(expectedWatermarkFromConfidentiality('confidential')).toBe('CONFIDENTIAL');
    expect(expectedWatermarkFromConfidentiality('restricted')).toBe('RESTRICTED');
    expect(expectedWatermarkFromConfidentiality('internal')).toBeNull();
    expect(expectedWatermarkFromConfidentiality('public')).toBeNull();
    expect(expectedWatermarkFromConfidentiality(null)).toBeNull();
  });

  it('builds an expected manifest with header/footer fallbacks', () => {
    const expected = buildExpectedParityFromDeckDocument({
      cards: [
        { intent: 'cover', header_footer: { footerText: 'Consultify · 2026' } } as any,
        { intent: 'performance_overview' } as any,
        { intent: 'appendix' } as any,
      ],
      meta: { confidentiality: 'confidential' },
      // simulate explicit metadata-level header text
      metadata: { headerText: 'Acme · Strategy ' },
    } as any);
    expect(expected.pageCount).toBe(3);
    expect(expected.headerText).toBe('Acme · Strategy');
    expect(expected.footerText).toBe('Consultify · 2026');
    expect(expected.confidentialityWatermark).toBe('CONFIDENTIAL');
    expect(expected.requiredSections).toEqual(['cover', 'dashboard', 'appendix']);
  });
});
