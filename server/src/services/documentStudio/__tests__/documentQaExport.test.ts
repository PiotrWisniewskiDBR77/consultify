/**
 * Document Studio — Export QA tests (Epic E2, Slice 3.4).
 *
 * Export QA performs pre-export sanity checks: required formattingSchema
 * keys, cover-page / TOC / appendix-style coherency with section content,
 * non-empty schema walk, and confidentiality footer alignment.
 */

import { describe, expect, it } from 'vitest';

import { runDocumentQa } from '../documentQaService.js';
import type { DocumentSchema, FormattingSchema } from '../documentStudioTypes.js';
import { DEFAULT_CONSULTING_FORMATTING_SCHEMA } from '../documentStudioTypes.js';

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-export-1',
    artifactId: 'artifact-export-1',
    title: 'Export QA Test Document',
    documentType: 'analysis_report',
    language: 'en',
    audience: ['Steering Committee'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'detailed',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
    formattingSchema: { ...DEFAULT_CONSULTING_FORMATTING_SCHEMA },
    sections: [
      {
        sectionId: 's-1',
        title: 'Overview',
        level: 1,
        blocks: [{ blockId: 'b-1', type: 'paragraph', content: { text: 'Overview content.' } }],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function findExport(report: ReturnType<typeof runDocumentQa>) {
  const c = report.categories.find((cat) => cat.category === 'export');
  if (!c) throw new Error('expected export category in report');
  return c;
}

describe('Document QA — Export QA category', () => {
  it('returns clean Export QA on a fully-configured default consulting schema', () => {
    // Override appendixStyle to 'none' for the cleanest baseline because
    // the default schema enables the lettered style which (correctly)
    // produces a low-severity finding when no Appendix sections are
    // present. That branch is exercised in a dedicated test below.
    const schema = makeSchema({
      formattingSchema: { ...DEFAULT_CONSULTING_FORMATTING_SCHEMA, appendixStyle: 'none' },
    });
    const report = runDocumentQa(schema);
    const exp = findExport(report);
    expect(exp.findings).toHaveLength(0);
  });

  it('flags missing `formattingSchema` at high severity (export-blocking)', () => {
    const schema = makeSchema({
      // Cast through unknown to allow simulating a misconfigured payload
      // without weakening the FormattingSchema contract.
      formattingSchema: undefined as unknown as FormattingSchema,
    });
    const report = runDocumentQa(schema);
    const exp = findExport(report);
    const finding = exp.findings.find((f) => f.code === 'export_missing_formatting_schema');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('high');
    expect(exp.blocking).toBe(true);
  });

  it('flags missing required keys inside formattingSchema (page.size)', () => {
    const schema = makeSchema({
      formattingSchema: {
        ...DEFAULT_CONSULTING_FORMATTING_SCHEMA,
        page: {
          ...DEFAULT_CONSULTING_FORMATTING_SCHEMA.page,
          // intentionally drop the size
          size: undefined as unknown as 'A4',
        },
      },
    });
    const report = runDocumentQa(schema);
    const exp = findExport(report);
    expect(exp.findings.map((f) => f.code)).toContain('export_formatting_schema_keys_missing');
  });

  it('flags cover page enabled without a document title', () => {
    const schema = makeSchema({
      title: '',
      formattingSchema: {
        ...DEFAULT_CONSULTING_FORMATTING_SCHEMA,
        coverPage: true,
      },
    });
    const report = runDocumentQa(schema);
    const exp = findExport(report);
    expect(exp.findings.map((f) => f.code)).toContain('export_cover_page_without_title');
  });

  it('flags TOC enabled without any level-1 sections', () => {
    const schema = makeSchema({
      formattingSchema: {
        ...DEFAULT_CONSULTING_FORMATTING_SCHEMA,
        toc: true,
      },
      sections: [
        {
          sectionId: 's-detail',
          title: 'Sub-detail',
          level: 2,
          blocks: [{ blockId: 'b-1', type: 'paragraph', content: { text: 'Sub-detail content.' } }],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exp = findExport(report);
    expect(exp.findings.map((f) => f.code)).toContain('export_toc_without_level_one');
  });

  it('flags lettered appendixStyle without any "Appendix" / "Załącznik" sections at low severity', () => {
    const schema = makeSchema({
      formattingSchema: {
        ...DEFAULT_CONSULTING_FORMATTING_SCHEMA,
        appendixStyle: 'lettered',
      },
    });
    const report = runDocumentQa(schema);
    const exp = findExport(report);
    const finding = exp.findings.find((f) => f.code === 'export_appendix_style_without_sections');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('low');
  });

  it('does NOT flag appendixStyle when an "Appendix" section is present', () => {
    const schema = makeSchema({
      formattingSchema: {
        ...DEFAULT_CONSULTING_FORMATTING_SCHEMA,
        appendixStyle: 'lettered',
      },
      sections: [
        {
          sectionId: 's-1',
          title: 'Overview',
          level: 1,
          blocks: [{ blockId: 'b-1', type: 'paragraph', content: { text: 'Overview content.' } }],
          sourceRefs: [],
        },
        {
          sectionId: 's-app',
          title: 'Appendix A — Data Sources',
          level: 1,
          blocks: [{ blockId: 'b-app', type: 'paragraph', content: { text: 'Appendix content.' } }],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exp = findExport(report);
    expect(exp.findings.map((f) => f.code)).not.toContain('export_appendix_style_without_sections');
  });

  it('flags zero-content schema walk at high severity', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: '',
          level: 1,
          blocks: [{ blockId: 'b-1', type: 'paragraph', content: { text: '' } }],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const exp = findExport(report);
    const finding = exp.findings.find((f) => f.code === 'export_zero_content_after_walk');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('high');
    expect(exp.blocking).toBe(true);
  });

  it('flags confidentiality footer enabled without a confidentiality value at low severity', () => {
    const schema = makeSchema({
      confidentiality: undefined as unknown as DocumentSchema['confidentiality'],
      formattingSchema: {
        ...DEFAULT_CONSULTING_FORMATTING_SCHEMA,
        footers: {
          enabled: true,
          pageNumbering: true,
          confidentialityLabel: true,
        },
      },
    });
    const report = runDocumentQa(schema);
    const exp = findExport(report);
    const finding = exp.findings.find(
      (f) => f.code === 'export_confidentiality_footer_without_value'
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('low');
  });

  it('Export QA participates in `anyBlocking` when formattingSchema is missing', () => {
    const schema = makeSchema({
      formattingSchema: undefined as unknown as FormattingSchema,
    });
    const report = runDocumentQa(schema);
    expect(report.anyBlocking).toBe(true);
  });
});
