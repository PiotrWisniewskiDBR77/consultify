/**
 * Document Studio — FormattingSchema spec §8.5 fields tests
 * (Slice E15.5.formatting).
 *
 * Verifies the substrate fields added in slice E15.5.formatting to
 * close the §15.5 gap from
 * CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_VS_TARGET_2026-05-08.md (spec
 * §8.5 FormattingSchema contract):
 *   - structured per-level headings (`headingStylesDetailed`),
 *   - `headers.content` extension,
 *   - `footers.pageNumberingFormat` extension,
 *   - `coverPageDetailed` configuration object,
 *   - `tocConfig` configuration object.
 *
 * Also covers the two new public helpers exported from
 * `documentStudioTypes.ts`:
 *   - `formattingSchemaHasStructuredHeadings(schema)`;
 *   - `summarizeFormattingSchemaSpecExtensions(schema)`.
 *
 * Backwards-compat contract: every legacy schema (without these
 * fields) MUST keep working unchanged. The DOCX + PDF renderers,
 * QA pipeline, materialize service, and seed templates all
 * consume the existing flat fields (`headingStyles`, `toc`,
 * `coverPage`, `headers.enabled`, `footers.*`); none are touched
 * in this slice.
 */

import { describe, expect, it } from 'vitest';

import type { FormattingSchema } from '../documentStudioTypes.js';
import {
  formattingSchemaHasStructuredHeadings,
  summarizeFormattingSchemaSpecExtensions,
} from '../documentStudioTypes.js';

function makeLegacySchema(overrides: Partial<FormattingSchema> = {}): FormattingSchema {
  return {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: '16pt bold', h2: '14pt bold', h3: '12pt bold' },
    tableStyles: { default: 'default' },
    listStyles: { bullet: 'bullet', numbered: 'numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
    headers: { enabled: true },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
    toc: false,
    coverPage: false,
    appendixStyle: 'none',
    citationStyle: 'inline_marker',
    ...overrides,
  };
}

describe('FormattingSchema — backwards-compatible legacy shape (Slice E15.5.formatting)', () => {
  it('legacy schema leaves all 5 new substrate surfaces undefined', () => {
    const s = makeLegacySchema();
    expect(s.headingStylesDetailed).toBeUndefined();
    expect(s.tocConfig).toBeUndefined();
    expect(s.coverPageDetailed).toBeUndefined();
    expect(s.headers.content).toBeUndefined();
    expect(s.footers.pageNumberingFormat).toBeUndefined();
  });

  it('legacy flat fields keep their semantics (toc, coverPage, headingStyles)', () => {
    const s = makeLegacySchema();
    expect(s.toc).toBe(false);
    expect(s.coverPage).toBe(false);
    expect(s.headingStyles.h1).toBe('16pt bold');
  });
});

describe('FormattingSchema — new spec §8.5 fields (Slice E15.5.formatting)', () => {
  it('accepts headingStylesDetailed independently', () => {
    const s = makeLegacySchema({
      headingStylesDetailed: {
        h1: { fontSizePt: 16, bold: true, spacingBeforePt: 12, spacingAfterPt: 6 },
        h2: { fontSizePt: 14, bold: true, spacingBeforePt: 10, spacingAfterPt: 6 },
        h3: { fontSizePt: 12, bold: true, spacingBeforePt: 8, spacingAfterPt: 4 },
      },
    });
    expect(s.headingStylesDetailed?.h1.fontSizePt).toBe(16);
    expect(s.headingStylesDetailed?.h2.bold).toBe(true);
    expect(s.headingStylesDetailed?.h3.spacingAfterPt).toBe(4);
  });

  it('accepts headers.content extension', () => {
    const s = makeLegacySchema({
      headers: { enabled: true, content: 'Client Confidential | Consultify' },
    });
    expect(s.headers.content).toBe('Client Confidential | Consultify');
    expect(s.headers.enabled).toBe(true);
  });

  it('accepts footers.pageNumberingFormat extension', () => {
    const s = makeLegacySchema({
      footers: {
        enabled: true,
        pageNumbering: true,
        confidentialityLabel: true,
        pageNumberingFormat: 'Page X of Y',
      },
    });
    expect(s.footers.pageNumberingFormat).toBe('Page X of Y');
  });

  it('accepts tocConfig with maxDepth', () => {
    const s = makeLegacySchema({ tocConfig: { enabled: true, maxDepth: 3 } });
    expect(s.tocConfig?.enabled).toBe(true);
    expect(s.tocConfig?.maxDepth).toBe(3);
  });

  it('accepts coverPageDetailed with all three include flags', () => {
    const s = makeLegacySchema({
      coverPageDetailed: {
        enabled: true,
        includeLogo: true,
        includeStatus: true,
        includeConfidentiality: false,
      },
    });
    expect(s.coverPageDetailed?.enabled).toBe(true);
    expect(s.coverPageDetailed?.includeLogo).toBe(true);
    expect(s.coverPageDetailed?.includeConfidentiality).toBe(false);
  });

  it('all 5 substrate surfaces can coexist on a single schema', () => {
    const s = makeLegacySchema({
      headingStylesDetailed: {
        h1: { fontSizePt: 16, bold: true, spacingBeforePt: 12, spacingAfterPt: 6 },
        h2: { fontSizePt: 14, bold: true, spacingBeforePt: 10, spacingAfterPt: 6 },
        h3: { fontSizePt: 12, bold: true, spacingBeforePt: 8, spacingAfterPt: 4 },
      },
      headers: { enabled: true, content: 'Client Confidential' },
      footers: {
        enabled: true,
        pageNumbering: true,
        confidentialityLabel: true,
        pageNumberingFormat: 'X / Y',
      },
      tocConfig: { enabled: true, maxDepth: 2 },
      coverPageDetailed: {
        enabled: true,
        includeLogo: true,
        includeStatus: false,
        includeConfidentiality: true,
      },
    });
    expect(s.headingStylesDetailed).toBeDefined();
    expect(s.headers.content).toBe('Client Confidential');
    expect(s.footers.pageNumberingFormat).toBe('X / Y');
    expect(s.tocConfig?.maxDepth).toBe(2);
    expect(s.coverPageDetailed?.includeStatus).toBe(false);
  });
});

describe('formattingSchemaHasStructuredHeadings (Slice E15.5.formatting)', () => {
  it('returns false for null / undefined / legacy schema', () => {
    expect(formattingSchemaHasStructuredHeadings(null)).toBe(false);
    expect(formattingSchemaHasStructuredHeadings(undefined)).toBe(false);
    expect(formattingSchemaHasStructuredHeadings(makeLegacySchema())).toBe(false);
  });

  it('returns true when all three descriptors are fully populated', () => {
    const s = makeLegacySchema({
      headingStylesDetailed: {
        h1: { fontSizePt: 16, bold: true, spacingBeforePt: 12, spacingAfterPt: 6 },
        h2: { fontSizePt: 14, bold: true, spacingBeforePt: 10, spacingAfterPt: 6 },
        h3: { fontSizePt: 12, bold: false, spacingBeforePt: 8, spacingAfterPt: 4 },
      },
    });
    expect(formattingSchemaHasStructuredHeadings(s)).toBe(true);
  });

  it('returns false when any descriptor field is non-finite (NaN / Infinity)', () => {
    const s = makeLegacySchema({
      headingStylesDetailed: {
        h1: { fontSizePt: NaN, bold: true, spacingBeforePt: 12, spacingAfterPt: 6 },
        h2: { fontSizePt: 14, bold: true, spacingBeforePt: 10, spacingAfterPt: 6 },
        h3: { fontSizePt: 12, bold: true, spacingBeforePt: 8, spacingAfterPt: 4 },
      },
    });
    expect(formattingSchemaHasStructuredHeadings(s)).toBe(false);
  });

  it('returns false when bold is non-boolean (defensive)', () => {
    const s = makeLegacySchema();
    s.headingStylesDetailed = {
      h1: { fontSizePt: 16, bold: true, spacingBeforePt: 12, spacingAfterPt: 6 },
      h2: { fontSizePt: 14, bold: true, spacingBeforePt: 10, spacingAfterPt: 6 },
      h3: {
        fontSizePt: 12,
        bold: 'yes' as unknown as boolean,
        spacingBeforePt: 8,
        spacingAfterPt: 4,
      },
    };
    expect(formattingSchemaHasStructuredHeadings(s)).toBe(false);
  });
});

describe('summarizeFormattingSchemaSpecExtensions (Slice E15.5.formatting)', () => {
  it('returns the empty summary for null / undefined schema', () => {
    const empty = {
      hasStructuredHeadings: false,
      tocEnabled: null,
      tocMaxDepth: null,
      coverPageEnabled: null,
      coverPageIncludesLogo: null,
      coverPageIncludesStatus: null,
      coverPageIncludesConfidentiality: null,
      headerContent: null,
      footerPageNumberingFormat: null,
    };
    expect(summarizeFormattingSchemaSpecExtensions(null)).toEqual(empty);
    expect(summarizeFormattingSchemaSpecExtensions(undefined)).toEqual(empty);
  });

  it('reports legacy schema via flat fallback values', () => {
    const s = makeLegacySchema({ toc: true, coverPage: true });
    const summary = summarizeFormattingSchemaSpecExtensions(s);
    expect(summary.hasStructuredHeadings).toBe(false);
    // Flat fields fallback through.
    expect(summary.tocEnabled).toBe(true);
    expect(summary.tocMaxDepth).toBe(null);
    expect(summary.coverPageEnabled).toBe(true);
    // No detailed object → all `include*` fields stay null.
    expect(summary.coverPageIncludesLogo).toBe(null);
    expect(summary.coverPageIncludesStatus).toBe(null);
    expect(summary.coverPageIncludesConfidentiality).toBe(null);
    expect(summary.headerContent).toBe(null);
    expect(summary.footerPageNumberingFormat).toBe(null);
  });

  it('detailed config overrides flat fallback for toc + coverPage', () => {
    const s = makeLegacySchema({
      toc: false, // flat says false…
      tocConfig: { enabled: true, maxDepth: 2 }, // …but detailed says true.
      coverPage: false, // flat says false…
      coverPageDetailed: {
        enabled: true,
        includeLogo: true,
        includeStatus: true,
        includeConfidentiality: false,
      },
    });
    const summary = summarizeFormattingSchemaSpecExtensions(s);
    expect(summary.tocEnabled).toBe(true);
    expect(summary.tocMaxDepth).toBe(2);
    expect(summary.coverPageEnabled).toBe(true);
    expect(summary.coverPageIncludesLogo).toBe(true);
    expect(summary.coverPageIncludesStatus).toBe(true);
    expect(summary.coverPageIncludesConfidentiality).toBe(false);
  });

  it('header / footer extensions are trimmed; whitespace-only collapses to null', () => {
    const sFull = makeLegacySchema({
      headers: { enabled: true, content: '  Client Confidential  ' },
      footers: {
        enabled: true,
        pageNumbering: true,
        confidentialityLabel: true,
        pageNumberingFormat: '  Page X of Y  ',
      },
    });
    expect(summarizeFormattingSchemaSpecExtensions(sFull).headerContent).toBe(
      'Client Confidential'
    );
    expect(summarizeFormattingSchemaSpecExtensions(sFull).footerPageNumberingFormat).toBe(
      'Page X of Y'
    );
    const sEmpty = makeLegacySchema({
      headers: { enabled: true, content: '   ' },
      footers: {
        enabled: true,
        pageNumbering: true,
        confidentialityLabel: true,
        pageNumberingFormat: '\t\n',
      },
    });
    expect(summarizeFormattingSchemaSpecExtensions(sEmpty).headerContent).toBe(null);
    expect(summarizeFormattingSchemaSpecExtensions(sEmpty).footerPageNumberingFormat).toBe(null);
  });

  it('hasStructuredHeadings is wired through to the summary', () => {
    const s = makeLegacySchema({
      headingStylesDetailed: {
        h1: { fontSizePt: 16, bold: true, spacingBeforePt: 12, spacingAfterPt: 6 },
        h2: { fontSizePt: 14, bold: true, spacingBeforePt: 10, spacingAfterPt: 6 },
        h3: { fontSizePt: 12, bold: true, spacingBeforePt: 8, spacingAfterPt: 4 },
      },
    });
    expect(summarizeFormattingSchemaSpecExtensions(s).hasStructuredHeadings).toBe(true);
  });

  it('does not mutate the input schema', () => {
    const s = makeLegacySchema({
      tocConfig: { enabled: true, maxDepth: 3 },
      coverPageDetailed: { enabled: true, includeLogo: true },
    });
    const before = JSON.stringify(s);
    summarizeFormattingSchemaSpecExtensions(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('tocConfig.maxDepth outside 1..3 collapses to null', () => {
    const s = makeLegacySchema({
      tocConfig: { enabled: true, maxDepth: 5 as unknown as 1 | 2 | 3 },
    });
    expect(summarizeFormattingSchemaSpecExtensions(s).tocMaxDepth).toBe(null);
  });
});
