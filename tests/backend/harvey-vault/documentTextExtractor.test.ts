/**
 * HP-23 — ekstraktor tekstu dla ingestu RAG (Client Vault, Blok F Harvey-Parity).
 *
 * Weryfikuje, że DOCX/XLSX/PPTX/CSV/TXT/MD zwracają czysty tekst z fixtur
 * generowanych realnymi bibliotekami (docx / xlsx / jszip) — ten sam tekst,
 * który dalej wpada w niezmieniony chunking+embedding KnowledgeService.
 */

import { Document, Packer, Paragraph, TextRun } from 'docx';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import {
  extractTextFromBuffer,
  isSupportedIngest,
  resolveFormat,
} from '../../../server/src/services/documentTextExtractor.js';

// --- fixtures ---------------------------------------------------------------

const MARKER = 'CONSULTIFY_VAULT_MARKER_42';

async function makeDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun('Client vault heading')] }),
          new Paragraph({ children: [new TextRun(MARKER)] }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function makeXlsx(): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Metric', 'Value'],
    ['Revenue', MARKER],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function makeXls(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Revenue', MARKER]]), 'Budget');
  return XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }) as Buffer;
}

async function makePptx(): Promise<Buffer> {
  // Minimalny OOXML PPTX: extractor czyta ppt/slides/slideN.xml → <a:t>.
  const zip = new JSZip();
  const slideXml = `<?xml version="1.0"?>
    <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld><p:spTree>
        <a:p><a:r><a:t>Slide one title</a:t></a:r></a:p>
        <a:p><a:r><a:t>${MARKER}</a:t></a:r></a:p>
      </p:spTree></p:cSld>
    </p:sld>`;
  zip.file('ppt/slides/slide1.xml', slideXml);
  zip.file('[Content_Types].xml', '<Types/>');
  return zip.generateAsync({ type: 'nodebuffer' });
}

// --- tests ------------------------------------------------------------------

describe('HP-23 documentTextExtractor — 3 formaty biurowe', () => {
  it('DOCX → tekst zawiera treść akapitów', async () => {
    const buf = await makeDocx();
    const text = await extractTextFromBuffer(buf, 'report.docx');
    expect(text).toContain(MARKER);
    expect(text).toContain('Client vault heading');
    expect(text).not.toContain('<w:');
  });

  it('XLSX → tekst zawiera komórki (CSV per arkusz)', async () => {
    const text = await extractTextFromBuffer(makeXlsx(), 'model.xlsx');
    expect(text).toContain(MARKER);
    expect(text).toContain('Revenue');
    expect(text).toContain('Sheet1');
  });

  it('advertised Finance import formats use genuine extractor fixtures', async () => {
    const pdf = fs.readFileSync(
      path.resolve(process.cwd(), 'tests/fixtures/finance/dbr77-balance-sheet.pdf')
    );
    expect(await extractTextFromBuffer(pdf, 'statement.pdf', 'application/pdf')).toMatch(
      /Balance Sheet/i
    );
    expect(
      await extractTextFromBuffer(makeXls(), 'budget.xls', 'application/vnd.ms-excel')
    ).toContain(MARKER);
    expect(
      await extractTextFromBuffer(
        makeXlsx(),
        'budget.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    ).toContain(MARKER);
    expect(
      await extractTextFromBuffer(Buffer.from(`Revenue,${MARKER}`), 'budget.csv', 'text/csv')
    ).toContain(MARKER);
  });

  it('PPTX → tekst zawiera treść slajdów z <a:t>', async () => {
    const buf = await makePptx();
    const text = await extractTextFromBuffer(buf, 'deck.pptx');
    expect(text).toContain(MARKER);
    expect(text).toContain('Slide one title');
    expect(text).not.toContain('<a:t>');
  });

  it('TXT / MD / CSV → utf8 pass-through', async () => {
    expect(await extractTextFromBuffer(Buffer.from(`# ${MARKER}`), 'n.md')).toContain(MARKER);
    expect(await extractTextFromBuffer(Buffer.from(MARKER), 'n.txt')).toContain(MARKER);
    expect(await extractTextFromBuffer(Buffer.from(`a,b\n1,${MARKER}`), 'n.csv')).toContain(MARKER);
  });

  it('pusty bufor → pusty string (fail-soft, brak wyjątku)', async () => {
    expect(await extractTextFromBuffer(Buffer.alloc(0), 'x.docx')).toBe('');
  });

  it('null-byty usunięte (Postgres TEXT)', async () => {
    const text = await extractTextFromBuffer(Buffer.from(`${MARKER}\0tail`), 'n.txt');
    expect(text).not.toContain('\0');
    expect(text).toContain(MARKER);
  });

  it('resolveFormat + isSupportedIngest po rozszerzeniu i mimetype', () => {
    expect(resolveFormat('a.pptx')).toBe('pptx');
    expect(resolveFormat('a.docx')).toBe('docx');
    expect(resolveFormat('a.xlsx')).toBe('xlsx');
    expect(resolveFormat('a', 'application/pdf')).toBe('pdf');
    expect(isSupportedIngest('deck.pptx', '')).toBe(true);
    expect(isSupportedIngest('sheet.xlsx', '')).toBe(true);
    expect(isSupportedIngest('evil.exe', 'application/x-msdownload')).toBe(false);
  });
});
