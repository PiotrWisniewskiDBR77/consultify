/**
 * Document Studio — PDF figure embedding (Module 10 hardening).
 *
 * Verifies that `image` blocks with inline bytes are embedded as real
 * figures in the rendered PDF (instead of the legacy "image asset not yet
 * embedded" placeholder), and that blocks without bytes still degrade
 * gracefully to a numbered `Figure N — caption` placeholder line.
 */

import { PDFParse } from 'pdf-parse';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToPdfBuffer } from '../documentPdfRenderer.js';
import type { DocumentSchema } from '../documentStudioTypes.js';

// Valid 2x2 RGB PNG (red/green pixels) that PDFKit's PNG parser accepts.
// A 1x1 PNG is rejected by PDFKit ("Incomplete or corrupt PNG file"), so
// we use the smallest PNG PDFKit will actually embed.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP4z8DA8B+MgBgAHfAD/dPQfSYAAAAASUVORK5CYII=';

function makeSchemaWithImageBlock(imageContent: Record<string, unknown>): DocumentSchema {
  return {
    documentId: 'doc-fig-1',
    artifactId: 'art-fig-1',
    title: 'Figure Embedding Test',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: {
      fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
      headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'b', numbered: 'n' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
      headers: { enabled: true },
      footers: { enabled: true, pageNumbering: true, confidentialityLabel: false },
      toc: false,
      coverPage: false,
      appendixStyle: 'none',
      citationStyle: 'inline_marker',
    },
    sections: [
      {
        sectionId: 'sec-body',
        orderIndex: 0,
        level: 1,
        title: 'Findings',
        blocks: [
          {
            blockId: 'blk-img-1',
            type: 'image',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: imageContent as any,
          },
        ],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

async function extractText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}

describe('Document Studio PDF figure embedding', () => {
  it('embeds a real figure (no placeholder line) when the image block carries inline bytes', async () => {
    const withImage = makeSchemaWithImageBlock({
      dataBase64: TINY_PNG_BASE64,
      mimeType: 'image/png',
      caption: 'Revenue trend',
      widthCm: 6,
    });
    const withoutImage = makeSchemaWithImageBlock({ caption: 'Revenue trend' });

    const embeddedPdf = await renderDocumentSchemaToPdfBuffer(withImage);
    const placeholderPdf = await renderDocumentSchemaToPdfBuffer(withoutImage);

    expect(embeddedPdf.length).toBeGreaterThan(0);
    expect(placeholderPdf.length).toBeGreaterThan(0);

    const embeddedText = await extractText(embeddedPdf);
    const placeholderText = await extractText(placeholderPdf);

    // The embedded variant must NOT contain the no-asset placeholder line,
    // but must still carry the auto-numbered caption.
    expect(embeddedText).not.toContain('no image asset attached');
    expect(embeddedText).toContain('Figure 1');
    expect(embeddedText).toContain('Revenue trend');

    // The placeholder variant keeps the explicit placeholder line.
    expect(placeholderText).toContain('no image asset attached');
    expect(placeholderText).toContain('Figure 1');
  });

  it('falls back to the placeholder when the base64 is malformed', async () => {
    const badImage = makeSchemaWithImageBlock({
      dataBase64: '!!!not-valid-base64-image-bytes!!!',
      caption: 'Broken figure',
    });
    const pdf = await renderDocumentSchemaToPdfBuffer(badImage);
    const text = await extractText(pdf);
    expect(pdf.length).toBeGreaterThan(0);
    expect(text).toContain('Figure 1');
    expect(text).toContain('Broken figure');
  });

  it('tolerates a data: URI prefix on the inline bytes', async () => {
    const dataUri = makeSchemaWithImageBlock({
      dataBase64: `data:image/png;base64,${TINY_PNG_BASE64}`,
      caption: 'URI figure',
    });
    const pdf = await renderDocumentSchemaToPdfBuffer(dataUri);
    const text = await extractText(pdf);
    expect(text).not.toContain('no image asset attached');
    expect(text).toContain('URI figure');
  });
});
