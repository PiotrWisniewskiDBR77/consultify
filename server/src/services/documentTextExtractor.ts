/**
 * documentTextExtractor — wspólny ekstraktor tekstu dla pipeline'u RAG (HP-23).
 *
 * Client Vault (Blok F Harvey-Parity) rozszerza ingest o formaty biurowe.
 * Historycznie `/api/knowledge/documents` parsował TYLKO PDF/TXT/MD; ten moduł
 * dokłada DOCX (mammoth), XLSX/XLS/CSV (SheetJS) i PPTX (OOXML via jszip) tak,
 * aby WSZYSTKIE formaty zwracały czysty tekst wpinany w TEN SAM chunking+embedding
 * (`KnowledgeService.processDocument`). Zero drugiego pipeline'u.
 *
 * Reużywa sprawdzonych wzorów z repo:
 *   - PDF: `pdfParserService.extractTextFromBuffer` (pdf-parse v2).
 *   - DOCX: `mammoth.extractRawText` (wzór z cvMatchingService), z fallbackiem
 *     na strip OOXML (wzór z deliverables/uploadContextExtract).
 *   - XLSX: `XLSX.utils.sheet_to_csv` po arkuszach (wzór z uploadContextExtract).
 *   - PPTX: jszip + zbiór `<a:t>` z ppt/slides/slideN.xml.
 *
 * Fail-soft: błąd parsera nie wywala uploadu — zwraca pusty/oznaczony tekst,
 * a warstwa wyżej decyduje. Null-byty (0x00) są usuwane (Postgres TEXT je odrzuca).
 */

import fs from 'fs';
import path from 'path';

import logger from '../utils/Logger.js';
import PDFParserService from './pdfParserService.js';

const LOG = '[DocExtract]';

export type ExtractableFormat = 'pdf' | 'txt' | 'md' | 'docx' | 'xlsx' | 'csv' | 'pptx' | 'unknown';

/** Mimetypy akceptowane przez ingest RAG (multer fileFilter woła to samo). */
export const SUPPORTED_INGEST_MIMETYPES: readonly string[] = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls (część przeglądarek wysyła to dla .xlsx)
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
];

/** Rozszerzenia akceptowane przez ingest RAG (fallback gdy mimetype pusty). */
export const SUPPORTED_INGEST_EXTENSIONS: readonly string[] = [
  '.pdf',
  '.txt',
  '.md',
  '.csv',
  '.docx',
  '.xlsx',
  '.xls',
  '.pptx',
];

const strip = (s: string) => s.replace(/\0/g, '');

/** Ustal format z rozszerzenia (priorytet) lub mimetype. */
export function resolveFormat(filename: string, mimetype?: string): ExtractableFormat {
  const ext = path.extname(String(filename || '')).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'pdf';
    case '.txt':
      return 'txt';
    case '.md':
    case '.markdown':
      return 'md';
    case '.csv':
      return 'csv';
    case '.docx':
      return 'docx';
    case '.xlsx':
    case '.xls':
      return 'xlsx';
    case '.pptx':
      return 'pptx';
    default:
      break;
  }
  const m = String(mimetype || '').toLowerCase();
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('markdown')) return 'md';
  if (m === 'text/csv') return 'csv';
  if (m.startsWith('text/')) return 'txt';
  if (m.includes('wordprocessingml')) return 'docx';
  if (m.includes('spreadsheetml') || m === 'application/vnd.ms-excel') return 'xlsx';
  if (m.includes('presentationml')) return 'pptx';
  return 'unknown';
}

/** Czy dany plik może zostać zaindeksowany (mimetype LUB rozszerzenie). */
export function isSupportedIngest(filename: string, mimetype?: string): boolean {
  const ext = path.extname(String(filename || '')).toLowerCase();
  if (SUPPORTED_INGEST_EXTENSIONS.includes(ext)) return true;
  return SUPPORTED_INGEST_MIMETYPES.includes(String(mimetype || '').toLowerCase());
}

// ---------------------------------------------------------------------------
// Per-format buffer extractors
// ---------------------------------------------------------------------------

async function docxToText(buffer: Buffer): Promise<string> {
  // Preferuj mammoth (lepsza wierność tekstu); przy błędzie — strip OOXML.
  try {
    const mammoth = (await import('mammoth')) as any;
    const result = await mammoth.extractRawText({ buffer });
    const value = String(result?.value || '');
    if (value.trim()) return value;
  } catch (err) {
    logger.warn(`${LOG} mammoth DOCX failed, falling back to OOXML strip: ${errMsg(err)}`);
  }
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(buffer);
    const docXml = zip.file('word/document.xml');
    if (!docXml) return '';
    const xml = await docXml.async('string');
    return decodeXmlEntities(xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ''));
  } catch (err) {
    logger.warn(`${LOG} DOCX OOXML strip failed: ${errMsg(err)}`);
    return '';
  }
}

async function xlsxToText(buffer: Buffer): Promise<string> {
  const XLSX = (await import('xlsx')) as any;
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];
  for (const name of (wb.SheetNames || []).slice(0, 20)) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    if (csv && csv.trim()) parts.push(`# ${name}\n${csv}`);
  }
  return parts.join('\n\n');
}

async function pptxToText(buffer: Buffer): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  // Slajdy: ppt/slides/slide1.xml, slide2.xml, ... — posortuj numerycznie.
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNum(a) - slideNum(b));
  const parts: string[] = [];
  for (const name of slideFiles) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async('string');
    // Tekst prezentacji siedzi w węzłach <a:t>...</a:t>.
    const runs = xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [];
    const text = runs
      .map((r) => decodeXmlEntities(r.replace(/<\/?a:t>/g, '')))
      .filter((t) => t.trim())
      .join(' ');
    if (text.trim()) parts.push(text);
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Ekstrakcja z bufora — rdzeń współdzielony przez testy i ścieżkę pliku. */
export async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string,
  mimetype?: string
): Promise<string> {
  if (!buffer || buffer.length === 0) return '';
  const format = resolveFormat(filename, mimetype);
  try {
    switch (format) {
      case 'pdf':
        return strip(await PDFParserService.extractTextFromBuffer(buffer));
      case 'txt':
      case 'md':
        return strip(buffer.toString('utf8'));
      case 'csv':
        return strip(buffer.toString('utf8'));
      case 'docx':
        return strip(await docxToText(buffer));
      case 'xlsx':
        return strip(await xlsxToText(buffer));
      case 'pptx':
        return strip(await pptxToText(buffer));
      default:
        // Nieznany format — spróbuj utf8 (nie wywalaj uploadu).
        return strip(buffer.toString('utf8'));
    }
  } catch (err) {
    logger.error(`${LOG} extract(${format}) failed for ${filename}: ${errMsg(err)}`);
    return '';
  }
}

/** Ekstrakcja ze ścieżki pliku (używane przez knowledge.routes ingest). */
export async function extractTextFromFile(filePath: string, mimetype?: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  return extractTextFromBuffer(buffer, path.basename(filePath), mimetype);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function slideNum(name: string): number {
  const m = name.match(/slide(\d+)\.xml$/);
  return m ? Number(m[1]) : 0;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default {
  extractTextFromBuffer,
  extractTextFromFile,
  resolveFormat,
  isSupportedIngest,
  SUPPORTED_INGEST_MIMETYPES,
  SUPPORTED_INGEST_EXTENSIONS,
};
