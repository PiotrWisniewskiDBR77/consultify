// @vitest-environment node
/**
 * W3.3 (F2.3) — uploadContextExtract: tekst z wgranego pliku (txt/csv/xlsx/docx/pdf).
 * Realne bufory dla txt/csv/xlsx/docx; DI dla pdf. Fail-soft.
 */
import { describe, expect, it } from 'vitest';
import {
  extractUploadContext,
  uploadTextToContextBlock,
  UPLOAD_CONTEXT_MAX_CHARS,
} from '../../../server/src/services/deliverables/uploadContextExtract.js';

describe('W3.3 — extractUploadContext', () => {
  it('txt → tekst utf8', async () => {
    const r = await extractUploadContext(Buffer.from('Apator AiR audyt 2026'), 'notes.txt');
    expect(r.kind).toBe('text');
    expect(r.ok).toBe(true);
    expect(r.text).toContain('Apator AiR');
  });

  it('csv → płaski tekst nagłówki+wiersze', async () => {
    const csv = 'firma,przychod\nApator,1200\nElkomtech,800';
    const r = await extractUploadContext(Buffer.from(csv), 'data.csv');
    expect(r.kind).toBe('csv');
    expect(r.ok).toBe(true);
    expect(r.text).toContain('firma');
    expect(r.text).toContain('Apator');
  });

  it('xlsx → tekst CSV z arkusza (realny buffer przez xlsx)', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['rok', 'ebitda'], ['R1', -20], ['R2', 800]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Model');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const r = await extractUploadContext(buf, 'model.xlsx');
    expect(r.kind).toBe('xlsx');
    expect(r.ok).toBe(true);
    expect(r.text).toContain('ebitda');
    expect(r.text).toContain('800');
  });

  it('docx → tekst z OOXML (realny zip przez jszip)', async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>Teza redukcji kosztów 30%</w:t></w:r></w:p></w:body></w:document>');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const r = await extractUploadContext(buf, 'brief.docx');
    expect(r.kind).toBe('docx');
    expect(r.ok).toBe(true);
    expect(r.text).toContain('redukcji kosztów 30%');
  });

  it('pdf → DI extractPdf', async () => {
    const r = await extractUploadContext(Buffer.from('%PDF-1.4 fake'), 'doc.pdf', undefined, {
      extractPdf: async () => 'Wyciąg z PDF: rynek 8 mld EUR',
    });
    expect(r.kind).toBe('pdf');
    expect(r.ok).toBe(true);
    expect(r.text).toContain('8 mld EUR');
  });

  it('nieznany typ → ok=false', async () => {
    const r = await extractUploadContext(Buffer.from('xx'), 'file.bin');
    expect(r.ok).toBe(false);
    expect(r.kind).toBe('unknown');
  });

  it('pusty buffer → ok=false', async () => {
    const r = await extractUploadContext(Buffer.alloc(0), 'empty.txt');
    expect(r.ok).toBe(false);
  });

  it('długi tekst → uciięty do limitu', async () => {
    const r = await extractUploadContext(Buffer.from('x'.repeat(UPLOAD_CONTEXT_MAX_CHARS + 5000)), 'big.txt');
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(UPLOAD_CONTEXT_MAX_CHARS);
  });

  it('extractPdf rzuca → fail-soft ok=false', async () => {
    const r = await extractUploadContext(Buffer.from('%PDF'), 'd.pdf', undefined, {
      extractPdf: async () => { throw new Error('pdf-parse missing'); },
    });
    expect(r.ok).toBe(false);
  });
});

describe('W3.3 — uploadTextToContextBlock', () => {
  it('buduje blok z nagłówkiem i nazwą pliku', () => {
    const block = uploadTextToContextBlock({ text: 'fakt A', kind: 'text', truncated: false, ok: true }, 'raport.pdf');
    expect(block).toContain('raport.pdf');
    expect(block).toContain('fakt A');
  });

  it('pusty wynik → pusty string', () => {
    expect(uploadTextToContextBlock({ text: '', kind: 'unknown', truncated: false, ok: false }, 'x')).toBe('');
  });
});
