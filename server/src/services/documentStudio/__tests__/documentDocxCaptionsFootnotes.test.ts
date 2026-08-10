/**
 * Document Studio — DOCX captions + footnotes + citation markers
 * (Epic E8, Slice 8.3).
 *
 * Renders representative `DocumentSchema` fixtures to a real .docx
 * buffer, unzips them via JSZip, and asserts the new MVP-4 surface:
 *
 *  - tables auto-emit a `Table N — caption` paragraph in `Caption` style;
 *  - images auto-emit a `Figure N — caption` paragraph;
 *  - `block.type === 'footnote'` registers a body in `word/footnotes.xml`
 *    and emits a `<w:footnoteReference>` in the body;
 *  - `block.sourceRef` + `citationStyle === 'inline_marker'` produces
 *    `[N]` markers indexed against `schema.sourceRefs`;
 *  - `citationStyle === 'footnote'` lifts source citations into Word
 *    footnote machinery instead of inline markers.
 *
 * Renders are intentionally minimal so a regression in caption
 * counters or footnote ids surfaces directly in the expected XML.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../documentDocxRenderer.js';
import { DOCX_STYLE_IDS } from '../documentDocxStyles.js';
import type { DocumentSchema, DocumentSection, FormattingSchema } from '../documentStudioTypes.js';

function makeFormattingSchema(overrides: Partial<FormattingSchema> = {}): FormattingSchema {
  return {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
    tableStyles: { default: 'default' },
    listStyles: { bullet: 'bullet', numbered: 'numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
    headers: { enabled: true },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
    toc: false,
    coverPage: false,
    appendixStyle: 'lettered',
    citationStyle: 'inline_marker',
    ...overrides,
  };
}

function makeSection(overrides: Partial<DocumentSection> & { sectionId: string }): DocumentSection {
  return {
    // `sectionId` is required on `overrides` and the trailing spread already
    // supplies it — restating it here was dead (and flagged as an overwritten
    // duplicate property).
    orderIndex: overrides.orderIndex ?? 0,
    level: overrides.level ?? 1,
    title: overrides.title ?? 'Section',
    blocks: overrides.blocks ?? [],
    sourceRefs: overrides.sourceRefs ?? [],
    ...overrides,
  };
}

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-1',
    artifactId: 'art-1',
    title: 'Caption Footnote Citation Smoke',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'inform',
    communicationRegister: 'professional',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: makeFormattingSchema(),
    sections: [],
    sourceRefs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function readDocxParts(
  buffer: Buffer
): Promise<{ document: string; styles: string; footnotes: string | null }> {
  const zip = await JSZip.loadAsync(buffer);
  const document = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const styles = (await zip.file('word/styles.xml')?.async('string')) ?? '';
  const footnotesFile = zip.file('word/footnotes.xml');
  const footnotes = footnotesFile ? await footnotesFile.async('string') : null;
  return { document, styles, footnotes };
}

describe('documentDocxRenderer — captions (Slice 8.3)', () => {
  it('auto-numbers tables as "Table N" with the schema-supplied caption text', async () => {
    const schema = makeSchema({
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            {
              blockId: 'b1',
              type: 'table',
              content: {
                headers: ['Metric', 'Value'],
                rows: [['Revenue', '$10m']],
                caption: 'Revenue performance Q1',
              },
            },
            {
              blockId: 'b2',
              type: 'table',
              content: {
                headers: ['Owner', 'Risk'],
                rows: [['CFO', 'Sponsor exit']],
                caption: 'Top risks',
              },
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document } = await readDocxParts(buffer);
    expect(document).toContain('Table 1 — Revenue performance Q1');
    expect(document).toContain('Table 2 — Top risks');
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.CAPTION}"`);
    expect(document.indexOf('Table 1')).toBeLessThan(document.indexOf('Table 2'));
  });

  it('emits a "Table N" caption even when the block has no caption text', async () => {
    const schema = makeSchema({
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            {
              blockId: 'b1',
              type: 'table',
              content: { headers: ['A'], rows: [['x']] },
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document } = await readDocxParts(buffer);
    expect(document).toContain('Table 1');
  });

  it('numbers image blocks as "Figure N" with placeholder + caption', async () => {
    const schema = makeSchema({
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            {
              blockId: 'b1',
              type: 'image',
              content: { caption: 'Architecture overview', alt: 'Architecture diagram' },
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document } = await readDocxParts(buffer);
    expect(document).toContain('Figure 1 — Architecture overview');
    expect(document).toContain('placeholder — image bytes unavailable');
  });

  it('embeds inline PNG bytes as a real DOCX figure with caption', async () => {
    const schema = makeSchema({
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            {
              blockId: 'b1',
              type: 'image',
              content: {
                caption: 'Uploaded process',
                alt: 'Process diagram',
                mimeType: 'image/png',
                dataBase64:
                  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP4z8DA8B+MgBgAHfAD/dPQfSYAAAAASUVORK5CYII=',
              },
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const zip = await JSZip.loadAsync(buffer);
    const document = (await zip.file('word/document.xml')?.async('string')) ?? '';
    const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
    expect(document).toContain('Figure 1 — Uploaded process');
    expect(document).not.toContain('placeholder');
    expect(media.length).toBeGreaterThan(0);
  });
});

describe('documentDocxRenderer — citation markers (Slice 8.3)', () => {
  const sourceRef = { sourceType: 'finance_report', sourceId: 'fr-2026-q1' };

  it('appends [N] inline markers when citationStyle is "inline_marker"', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ citationStyle: 'inline_marker' }),
      sourceRefs: [{ ...sourceRef, sourceTitle: 'Q1 Finance Report' }],
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            {
              blockId: 'b1',
              type: 'paragraph',
              content: { text: 'Revenue grew 18 percent in Q1.' },
              sourceRef,
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document, footnotes } = await readDocxParts(buffer);
    expect(document).toContain(' [1]');
    // The docx package always emits `word/footnotes.xml` (with the
    // mandatory separator + continuation entries Word expects), so we
    // assert the user-provided source body is *absent* rather than
    // the file itself.
    expect(footnotes ?? '').not.toContain('Source: ');
  });

  it('promotes source refs to Word footnotes when citationStyle is "footnote"', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ citationStyle: 'footnote' }),
      sourceRefs: [{ ...sourceRef, sourceTitle: 'Q1 Finance Report' }],
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            {
              blockId: 'b1',
              type: 'paragraph',
              content: { text: 'Revenue grew 18 percent in Q1.' },
              sourceRef,
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document, footnotes } = await readDocxParts(buffer);
    expect(document).toContain('w:footnoteReference');
    expect(document).not.toContain(' [1]');
    expect(footnotes).not.toBeNull();
    expect(footnotes).toContain('Source: finance_report#fr-2026-q1');
  });

  it('also promotes source refs to footnotes when citationStyle is "endnote" (folded into footnote semantics for MVP-4)', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ citationStyle: 'endnote' }),
      sourceRefs: [{ ...sourceRef }],
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            {
              blockId: 'b1',
              type: 'paragraph',
              content: { text: 'Revenue grew 18 percent in Q1.' },
              sourceRef,
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document, footnotes } = await readDocxParts(buffer);
    expect(document).toContain('w:footnoteReference');
    expect(footnotes).toContain('Source: finance_report#fr-2026-q1');
  });
});

describe('documentDocxRenderer — footnote blocks (Slice 8.3)', () => {
  it('registers footnote bodies in word/footnotes.xml and emits inline references', async () => {
    const schema = makeSchema({
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            {
              blockId: 'b1',
              type: 'paragraph',
              content: { text: 'Revenue grew 18 percent in Q1.' },
            },
            {
              blockId: 'b2',
              type: 'footnote',
              content: { text: 'Includes one-off licensing revenue.' },
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document, footnotes } = await readDocxParts(buffer);
    expect(document).toContain('w:footnoteReference');
    expect(footnotes).not.toBeNull();
    expect(footnotes).toContain('Includes one-off licensing revenue.');
  });

  it('skips empty footnote blocks gracefully', async () => {
    const schema = makeSchema({
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            { blockId: 'b1', type: 'footnote', content: { text: '   ' } },
            {
              blockId: 'b2',
              type: 'paragraph',
              content: { text: 'Body text.' },
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document, footnotes } = await readDocxParts(buffer);
    // The renderer allocates user footnote ids starting at 2 (ids 0
    // and -1 are reserved by docx for separator + continuation).
    // Skipping the empty block must not allocate id 2.
    expect(footnotes ?? '').not.toContain('w:id="2"');
    expect(document).not.toContain('w:footnoteReference');
  });

  it('assigns distinct ids when multiple footnote blocks coexist', async () => {
    const schema = makeSchema({
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            { blockId: 'b1', type: 'footnote', content: { text: 'First note.' } },
            { blockId: 'b2', type: 'footnote', content: { text: 'Second note.' } },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document, footnotes } = await readDocxParts(buffer);
    const refMatches = document.match(/w:footnoteReference/g) ?? [];
    expect(refMatches.length).toBe(2);
    expect(footnotes).toContain('First note.');
    expect(footnotes).toContain('Second note.');
  });
});
