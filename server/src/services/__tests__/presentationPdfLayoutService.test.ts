import { PDFParse } from 'pdf-parse';
import PDFDocument from 'pdfkit';
import { describe, expect, it } from 'vitest';

import { drawPresentationPdfFooter } from '../presentationPdfLayoutService';

async function buildTenSlidePdf(): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  for (let index = 0; index < 10; index += 1) {
    if (index > 0) doc.addPage();
    doc.fontSize(22).text(`Runtime slide ${index + 1}`);
    drawPresentationPdfFooter(doc, `INTERNAL · Runtime deck · ${index + 1}/10`, 48);
  }
  doc.end();
  return done;
}

describe('presentation PDF footer layout', () => {
  it('keeps ten slide footers on ten pages and remains independently parseable', async () => {
    const buffer = await buildTenSlidePdf();
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');

    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

    expect(result.total).toBe(10);
    expect(result.text).toContain('Runtime slide 1');
    expect(result.text).toContain('Runtime slide 10');
    expect(result.text).toContain('INTERNAL · Runtime deck · 10/10');
  });
});
