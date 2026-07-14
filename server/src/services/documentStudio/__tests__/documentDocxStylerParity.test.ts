/**
 * Document Studio — DocxStyler PARITY tests (Vegas Fala 6 / task #43).
 *
 * DOCX was the weakest of the three deliverable stylers: it delegated all
 * visuals to Word's named styles and carried no palette of its own, so the
 * output drifted toward flat slate greys while DeckStyler (navy #0C447C +
 * teal #1D9E75) and WorkbookStyler (navy header fills + teal color-scales)
 * shared a consistent brand chord.
 *
 * These tests lock the parity work:
 *   1. DOCX_PALETTE carries the doctrine navy + teal and ZERO crimson in
 *      chrome (crimson only ever appears as a danger/status color).
 *   2. Overflow guards (clampHeadingText / clampTableColumns) behave like the
 *      DeckStyler `fitProse` / WorkbookStyler width-clamp analogues.
 *   3. The rendered .docx actually paints navy table headers, tone-driven
 *      callout accents, and folds runaway tables — asserted by unzipping the
 *      produced package and substring-matching the XML.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../documentDocxRenderer.js';
import {
  clampHeadingText,
  clampTableColumns,
  DOCX_HEADING_MAX_CHARS,
  DOCX_PALETTE,
  DOCX_TABLE_MAX_COLS,
  DOCX_TONE_COLOR,
  DOCX_TONE_FILL,
} from '../documentDocxStyles.js';
import type { DocumentSchema, FormattingSchema } from '../documentStudioTypes.js';

// ---------------------------------------------------------------------------
// Schema factories (mirror the existing renderer test doubles)
// ---------------------------------------------------------------------------

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
    coverPage: true,
    appendixStyle: 'lettered',
    citationStyle: 'inline_marker',
    ...overrides,
  };
}

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-1',
    artifactId: 'artifact-1',
    title: 'Parity Smoke',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'inform',
    communicationRegister: 'executive',
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

async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return (await zip.file('word/document.xml')?.async('string')) ?? '';
}

// ---------------------------------------------------------------------------
// Palette doctrine
// ---------------------------------------------------------------------------

describe('DOCX_PALETTE — brand parity with DeckStyler / WorkbookStyler', () => {
  it('uses the doctrine navy + teal as chrome colors', () => {
    expect(DOCX_PALETTE.navy).toBe('0C447C');
    expect(DOCX_PALETTE.teal).toBe('1D9E75');
  });

  it('carries ZERO crimson in the chrome palette (crimson is status-only)', () => {
    // Crimson doctrine hexes that must never appear as chrome fills/borders.
    const crimsonFamily = ['85182F', '85182f', 'C0392B', 'DC2626'];
    for (const chromeColor of Object.values(DOCX_PALETTE)) {
      expect(crimsonFamily).not.toContain(chromeColor);
    }
  });

  it('routes danger tone to a crimson STATUS color, not a chrome color', () => {
    // Danger is the one place crimson is legitimate — as a status accent.
    expect(DOCX_TONE_COLOR.danger).toBe('C0392B');
    // …and info/success stay on the doctrine navy/teal.
    expect(DOCX_TONE_COLOR.info).toBe(DOCX_PALETTE.navy);
    expect(DOCX_TONE_COLOR.success).toBe(DOCX_PALETTE.teal);
    // Every tone has a paired soft fill.
    for (const key of Object.keys(DOCX_TONE_COLOR)) {
      expect(DOCX_TONE_FILL[key]).toMatch(/^[0-9A-F]{6}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Overflow guards
// ---------------------------------------------------------------------------

describe('clampHeadingText — heading overflow guard', () => {
  it('returns short headings untouched (whitespace-collapsed)', () => {
    expect(clampHeadingText('Executive Summary')).toBe('Executive Summary');
    expect(clampHeadingText('  spaced   out  title ')).toBe('spaced out title');
  });

  it('truncates a runaway heading at a word boundary with an ellipsis', () => {
    // Distinct words so we can prove the cut lands on a boundary, not mid-word.
    const long = Array.from({ length: 60 }, (_, i) => `alpha${i}`).join(' ');
    const out = clampHeadingText(long);
    expect(out.length).toBeLessThanOrEqual(DOCX_HEADING_MAX_CHARS + 1);
    expect(out.endsWith('…')).toBe(true);
    // The text before the ellipsis is a prefix of the original word sequence
    // ending on a whole word (no dangling partial token).
    const body = out.slice(0, -1).trimEnd();
    expect(long.startsWith(body)).toBe(true);
    const lastWord = body.split(' ').pop() ?? '';
    expect(long.split(' ')).toContain(lastWord);
  });

  it('never returns empty for non-empty input', () => {
    expect(clampHeadingText('x'.repeat(500))).not.toBe('');
  });
});

describe('clampTableColumns — A4 column-count guard', () => {
  it('keeps every column when the table already fits', () => {
    const c = clampTableColumns(5);
    expect(c.overflowed).toBe(false);
    expect(c.keep).toEqual([0, 1, 2, 3, 4]);
    expect(c.folded).toEqual([]);
  });

  it('folds overflow columns beyond the max into a trailing summary', () => {
    const c = clampTableColumns(12);
    expect(c.overflowed).toBe(true);
    // Keeps maxCols - 1 leading columns; the last slot is the "+N more" cell.
    expect(c.keep.length).toBe(DOCX_TABLE_MAX_COLS - 1);
    expect(c.folded.length).toBe(12 - (DOCX_TABLE_MAX_COLS - 1));
    // keep + folded must reconstruct the full column set with no overlap.
    expect([...c.keep, ...c.folded]).toEqual(Array.from({ length: 12 }, (_, i) => i));
  });
});

// ---------------------------------------------------------------------------
// Rendered .docx chrome (unzip + substring-match the XML)
// ---------------------------------------------------------------------------

describe('renderer — navy table header + zebra body', () => {
  it('paints table headers with the navy fill and folds runaway columns', async () => {
    // 10-column keyed table → clamp keeps 7 + "+N more".
    const wideCells: Record<string, { value: string }> = {};
    for (let i = 0; i < 10; i++) wideCells[`col${i}`] = { value: `v${i}` };
    const schema = makeSchema({
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Data',
          blocks: [
            {
              blockId: 'blk-tbl',
              type: 'table',
              content: { rows: [wideCells] } as unknown,
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const document = await documentXml(await renderDocumentSchemaToDocxBuffer(schema));
    // Navy header fill present.
    expect(document).toContain(`w:fill="${DOCX_PALETTE.navy}"`);
    // Zebra fill present on the (single) body row is index 0 → no zebra, so
    // assert the fold summary column materialized instead.
    expect(document).toContain('+3 more');
  });

  it('applies zebra striping to alternating body rows', async () => {
    const rows = [0, 1, 2, 3].map((n) => ({ a: { value: `a${n}` }, b: { value: `b${n}` } }));
    const schema = makeSchema({
      sections: [
        {
          sectionId: 'sec-z',
          orderIndex: 0,
          level: 1,
          title: 'Zebra',
          blocks: [{ blockId: 'blk-z', type: 'table', content: { rows } as unknown }],
          sourceRefs: [],
        },
      ],
    });
    const document = await documentXml(await renderDocumentSchemaToDocxBuffer(schema));
    expect(document).toContain(`w:fill="${DOCX_PALETTE.zebraFill}"`);
  });
});

describe('renderer — tone-driven callout chrome', () => {
  it('renders a danger callout with the crimson status accent + soft fill', async () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 'sec-c',
          orderIndex: 0,
          level: 1,
          title: 'Risk',
          blocks: [
            {
              blockId: 'blk-c',
              type: 'callout',
              content: { tone: 'danger', text: 'Budget at risk.' } as unknown,
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const document = await documentXml(await renderDocumentSchemaToDocxBuffer(schema));
    expect(document).toContain(DOCX_TONE_COLOR.danger); // crimson status accent
    expect(document).toContain(`w:fill="${DOCX_TONE_FILL.danger}"`);
  });

  it('renders an untoned/legacy callout with the navy info accent', async () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 'sec-i',
          orderIndex: 0,
          level: 1,
          title: 'Message',
          blocks: [
            {
              blockId: 'blk-i',
              type: 'callout',
              content: { variant: 'key_message', text: 'Decide next week.' } as unknown,
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const document = await documentXml(await renderDocumentSchemaToDocxBuffer(schema));
    expect(document).toContain(`w:fill="${DOCX_TONE_FILL.info}"`);
  });
});

describe('renderer — teal cover rule + navy heading styles', () => {
  it('paints the teal accent rule (cover + H1 hairline) into document.xml', async () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 'sec-h',
          orderIndex: 0,
          level: 1,
          title: 'Findings',
          blocks: [{ blockId: 'b', type: 'paragraph', content: { text: 'Body.' } as unknown }],
          sourceRefs: [],
        },
      ],
    });
    const document = await documentXml(await renderDocumentSchemaToDocxBuffer(schema));
    // Paragraph-level borders (cover rule + H1 hairline) inline the teal color.
    expect(document).toContain(`w:color="${DOCX_PALETTE.teal}"`);
  });

  it('defines the navy heading colors in word/styles.xml', async () => {
    // Heading run colors live in the named-style definitions, not inline in
    // document.xml (that is the whole point of named styles). Assert there.
    const buffer = await renderDocumentSchemaToDocxBuffer(makeSchema());
    const zip = await JSZip.loadAsync(buffer);
    const styles = (await zip.file('word/styles.xml')?.async('string')) ?? '';
    // Run colors serialize as `<w:color w:val="RRGGBB"/>` in styles.xml.
    expect(styles).toContain(`w:val="${DOCX_PALETTE.navy}"`); // H1
    expect(styles).toContain(`w:val="${DOCX_PALETTE.navySoft}"`); // H2
  });
});
