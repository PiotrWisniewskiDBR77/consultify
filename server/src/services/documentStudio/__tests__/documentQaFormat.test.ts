/**
 * Document Studio — Format QA tests (Epic E2, Slice 3.3).
 *
 * Format QA enforces heading hierarchy, list integrity, table headers
 * and absence of whitespace artifacts.
 */

import { describe, expect, it } from 'vitest';

import { runDocumentQa } from '../documentQaService.js';
import type { DocumentSchema } from '../documentStudioTypes.js';
import { DEFAULT_CONSULTING_FORMATTING_SCHEMA } from '../documentStudioTypes.js';

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-format-1',
    artifactId: 'artifact-format-1',
    title: 'Format QA Test Document',
    documentType: 'analysis_report',
    language: 'en',
    audience: ['Steering Committee'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'detailed',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
    formattingSchema: { ...DEFAULT_CONSULTING_FORMATTING_SCHEMA },
    sections: [],
    sourceRefs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeParagraph(blockId: string, text: string) {
  return { blockId, type: 'paragraph' as const, content: { text } };
}

function findFormat(report: ReturnType<typeof runDocumentQa>) {
  const c = report.categories.find((cat) => cat.category === 'format');
  if (!c) throw new Error('expected format category in report');
  return c;
}

describe('Document QA — Format QA category', () => {
  it('returns clean Format QA on a well-formatted document', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Overview',
          level: 1,
          blocks: [
            makeParagraph('b-1', 'Overview paragraph with sufficient length and substance.'),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-2',
          title: 'Findings',
          level: 1,
          blocks: [
            makeParagraph('b-2', 'Findings paragraph with sufficient length and substance.'),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const fmt = findFormat(report);
    expect(fmt.findings).toHaveLength(0);
  });

  it('flags heading-level skip across sections (H1 → H3 without H2)', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Top',
          level: 1,
          blocks: [makeParagraph('b-1', 'Top section content.')],
          sourceRefs: [],
        },
        {
          sectionId: 's-2',
          title: 'Sub-detail without parent',
          level: 3,
          blocks: [makeParagraph('b-2', 'Detail content.')],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const fmt = findFormat(report);
    expect(fmt.findings.map((f) => f.code)).toContain('format_heading_level_skip');
  });

  it('flags heading-level skip inside a section block stream', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Overview',
          level: 1,
          blocks: [
            makeParagraph('b-1', 'Intro paragraph.'),
            { blockId: 'b-h', type: 'heading', content: { level: 3, text: 'Sub-sub heading' } },
            makeParagraph('b-2', 'After heading.'),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const fmt = findFormat(report);
    expect(fmt.findings.map((f) => f.code)).toContain('format_block_heading_skip');
  });

  it('flags an empty bullet_list block', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Overview',
          level: 1,
          blocks: [
            makeParagraph('b-1', 'Intro paragraph.'),
            { blockId: 'b-list', type: 'bullet_list', content: { items: [] } },
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const fmt = findFormat(report);
    expect(fmt.findings.map((f) => f.code)).toContain('format_empty_list');
  });

  it('flags a single-item numbered_list block', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Overview',
          level: 1,
          blocks: [
            makeParagraph('b-1', 'Intro paragraph.'),
            {
              blockId: 'b-list',
              type: 'numbered_list',
              content: { items: ['Just one step here'] },
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const fmt = findFormat(report);
    expect(fmt.findings.map((f) => f.code)).toContain('format_single_item_list');
  });

  it('flags a table without a header row', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Data',
          level: 1,
          blocks: [
            {
              blockId: 'b-table',
              type: 'table',
              content: {
                rows: [
                  ['A', 'B', 'C'],
                  ['1', '2', '3'],
                ],
              },
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const fmt = findFormat(report);
    const finding = fmt.findings.find((f) => f.code === 'format_table_without_header');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('medium');
  });

  it('does NOT flag a table that declares headers', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Data',
          level: 1,
          blocks: [
            {
              blockId: 'b-table',
              type: 'table',
              content: {
                header: ['Metric', 'Q1', 'Q2'],
                rows: [
                  ['Revenue', '1.0', '1.2'],
                  ['Margin', '15%', '17%'],
                ],
              },
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const fmt = findFormat(report);
    expect(fmt.findings.map((f) => f.code)).not.toContain('format_table_without_header');
  });

  it('accepts canonical `columns` as the rendered table header', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-columns',
          title: 'Scenarios',
          level: 1,
          blocks: [
            {
              blockId: 'b-columns',
              type: 'table',
              content: {
                columns: ['Scenario', 'Revenue', 'Margin'],
                rows: [['Base', 'Assumption', 'Assumption']],
              },
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const fmt = findFormat(runDocumentQa(schema));
    expect(fmt.findings.map((f) => f.code)).not.toContain('format_table_without_header');
  });

  it('flags consecutive empty paragraphs as a whitespace artifact', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Overview',
          level: 1,
          blocks: [
            makeParagraph('b-1', 'Intro paragraph with sufficient content.'),
            makeParagraph('b-empty-1', ''),
            makeParagraph('b-empty-2', ''),
            makeParagraph('b-3', 'Next real paragraph.'),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const fmt = findFormat(report);
    expect(fmt.findings.map((f) => f.code)).toContain('format_consecutive_empty_paragraphs');
  });

  it('does NOT flag a single empty paragraph between content blocks', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Overview',
          level: 1,
          blocks: [
            makeParagraph('b-1', 'Intro paragraph with sufficient content.'),
            makeParagraph('b-empty-1', ''),
            makeParagraph('b-3', 'Next real paragraph.'),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const fmt = findFormat(report);
    expect(fmt.findings.map((f) => f.code)).not.toContain('format_consecutive_empty_paragraphs');
  });

  it('Format QA does NOT block solely on low-severity heading skips', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Top',
          level: 1,
          blocks: [makeParagraph('b-1', 'Top paragraph.')],
          sourceRefs: [],
        },
        {
          sectionId: 's-2',
          title: 'Detail',
          level: 3,
          blocks: [makeParagraph('b-2', 'Detail paragraph.')],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const fmt = findFormat(report);
    expect(fmt.findings.length).toBeGreaterThan(0);
    expect(fmt.blocking).toBe(false);
  });
});
