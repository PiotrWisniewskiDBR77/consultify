/**
 * DEC-132/133 smoke test — real report-builder PDF renderer, Polish text.
 *
 * `writeReportBuilderPdf` (server/src/routes/report-builder.routes.ts) is the
 * renderer behind the report-builder PDF export route. It never called
 * `.font()` at all before this fix — it relied entirely on pdfkit's implicit
 * Helvetica default — so this smoke test calls it directly with Polish
 * report/section content and confirms the diacritics survive a real render +
 * text-extraction round-trip.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { describe, expect, it } from 'vitest';

import { writeReportBuilderPdf } from '../report-builder.routes.js';

async function extractPdfText(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return String(result.text ?? '');
}

describe('report-builder PDF — DEC-132/133 Polish diacritics smoke test', () => {
  it('renders a real report with Polish title/section content without mangling diacritics', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-builder-pdf-'));
    const filePath = path.join(tmpDir, 'raport.pdf');

    const report = {
      title: 'Raport końcowy — Zażółć gęślą jaźń',
      sourceName: 'Ocena dojrzałości — Łódź',
    };
    const sections = [
      {
        enabled: true,
        orderIndex: 0,
        title: 'Wnioski i rekomendacje',
        editedContent: 'Rekomendujemy wdrożenie ścieżki naprawczej: ŁÓDŹ ŚĆŃ ąęłńóśźż.',
      },
    ];

    try {
      await writeReportBuilderPdf(report, sections, filePath);
      expect(fs.existsSync(filePath)).toBe(true);

      const text = await extractPdfText(filePath);
      expect(text).toContain('Raport końcowy — Zażółć gęślą jaźń');
      expect(text).toContain('Ocena dojrzałości — Łódź');
      expect(text).toContain('Wnioski i rekomendacje');
      expect(text).toContain('ŁÓDŹ ŚĆŃ ąęłńóśźż');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
