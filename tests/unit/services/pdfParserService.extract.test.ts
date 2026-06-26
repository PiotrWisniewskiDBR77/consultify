import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import PDFParserService from '../../../server/src/services/pdfParserService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../../fixtures/finance/dbr77-balance-sheet.pdf');

/**
 * REGRESJA: pdf-parse v2.x zmienił API z funkcji `pdfParse(buffer)` na klasę
 * `new PDFParse({data}).getText()`. Stary kod wołał namespace-object jako funkcję
 * → "pdfParse is not a function" → KAŻDY upload PDF rzucał 422 "File extraction failed".
 * Ten test ładuje realny fixture PDF i wymaga niepustego tekstu z liniami bilansu.
 */
describe('PDFParserService.extractTextFromBuffer (pdf-parse v2 API)', () => {
  it('wyciąga tekst z realnego PDF bilansu (nie rzuca, niepusty)', async () => {
    const buffer = fs.readFileSync(FIXTURE);
    const text = await PDFParserService.extractTextFromBuffer(buffer);
    expect(text.length).toBeGreaterThan(50);
    expect(text).toMatch(/Balance Sheet/i);
    expect(text).toMatch(/Total Assets/i);
    // brak null-byte (PG TEXT je odrzuca)
    expect(text.includes('\0')).toBe(false);
  });

  it('extractText(filePath) czyta plik i zwraca tekst', async () => {
    const text = await PDFParserService.extractText(FIXTURE);
    expect(text).toMatch(/DBR77/);
    expect(text).toMatch(/Total Liabilities/i);
  });
});
