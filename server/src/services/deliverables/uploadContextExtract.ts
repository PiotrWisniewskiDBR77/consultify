/**
 * uploadContextExtract (W3.3 / F2.3 „Wejście 2: upload pliku→parse") — wyciąga
 * TEKST z wgranego pliku, by zakotwiczyć generację wiązki w realnym dokumencie
 * klienta (zamiast tylko w słowach briefu).
 *
 * Komponuje DOJRZAŁE parsery: `xlsx`, `jszip` (DOCX OOXML), `parseCSV`
 * (CsvImportService), `PDFParserService` — wszystko już w repo (W0.1 = komponuj).
 * Dyspozytor po rozszerzeniu/typie. Czyste, fail-soft (błąd → text=''), bounded.
 * DI na ekstraktor PDF → testowalne bez pdf-parse.
 */
import logger from '../../utils/Logger.js';
import { parseCSV } from '../tablePlatform/CsvImportService.js';

const LOG = '[uploadContextExtract]';

/** Maks. długość wyekstrahowanego tekstu (ochrona promptu/pamięci). */
export const UPLOAD_CONTEXT_MAX_CHARS = 12000;

export type UploadKind = 'text' | 'csv' | 'xlsx' | 'docx' | 'pdf' | 'unknown';

export interface UploadExtractResult {
  text: string;
  kind: UploadKind;
  truncated: boolean;
  /** Czy cokolwiek wyciągnięto. */
  ok: boolean;
}

export interface UploadExtractDeps {
  /** Ekstraktor PDF (domyślnie PDFParserService.extractTextFromBuffer). */
  extractPdf?: (buffer: Buffer) => Promise<string>;
}

function kindFromName(filename: string, mimetype?: string): UploadKind {
  const lower = (filename || '').toLowerCase();
  const mt = (mimetype || '').toLowerCase();
  if (lower.endsWith('.csv') || mt.includes('csv')) return 'csv';
  if (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    mt.includes('spreadsheet') ||
    mt.includes('excel')
  )
    return 'xlsx';
  if (lower.endsWith('.docx') || mt.includes('wordprocessingml')) return 'docx';
  if (lower.endsWith('.pdf') || mt.includes('pdf')) return 'pdf';
  if (lower.endsWith('.txt') || lower.endsWith('.md') || mt.startsWith('text/')) return 'text';
  return 'unknown';
}

function clamp(text: string): { text: string; truncated: boolean } {
  const collapsed = String(text || '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (collapsed.length <= UPLOAD_CONTEXT_MAX_CHARS) return { text: collapsed, truncated: false };
  return { text: collapsed.slice(0, UPLOAD_CONTEXT_MAX_CHARS), truncated: true };
}

/** CSV → płaski tekst „nagłówki + wiersze" (do groundingu, nie do tabeli). */
function csvToText(content: string): string {
  try {
    const { headers, rows } = parseCSV(content);
    const head = headers.join(' | ');
    const body = rows
      .slice(0, 200)
      .map((r) => (Array.isArray(r) ? r.join(' | ') : Object.values(r).join(' | ')))
      .join('\n');
    return `${head}\n${body}`;
  } catch {
    return content;
  }
}

/** XLSX (buffer) → tekst CSV ze wszystkich arkuszy. */
async function xlsxToText(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];
  for (const name of wb.SheetNames.slice(0, 6)) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    if (csv.trim()) parts.push(`# ${name}\n${csv}`);
  }
  return parts.join('\n\n');
}

/** DOCX (OOXML zip) → tekst z word/document.xml (strip tagów). */
async function docxToText(buffer: Buffer): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const docXml = zip.file('word/document.xml');
  if (!docXml) return '';
  const xml = await docXml.async('string');
  // Akapity </w:p> → newline; reszta tagów usunięta; podstawowe encje.
  return xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Wyciągnij tekst z wgranego pliku. Fail-soft: błąd/nieznany typ → ok=false, text=''.
 */
export async function extractUploadContext(
  buffer: Buffer,
  filename: string,
  mimetype?: string,
  deps: UploadExtractDeps = {}
): Promise<UploadExtractResult> {
  const kind = kindFromName(filename, mimetype);
  const empty: UploadExtractResult = { text: '', kind, truncated: false, ok: false };
  if (!buffer || buffer.length === 0) return empty;
  try {
    let raw = '';
    switch (kind) {
      case 'text':
        raw = buffer.toString('utf8');
        break;
      case 'csv':
        raw = csvToText(buffer.toString('utf8'));
        break;
      case 'xlsx':
        raw = await xlsxToText(buffer);
        break;
      case 'docx':
        raw = await docxToText(buffer);
        break;
      case 'pdf': {
        const extractPdf =
          deps.extractPdf ??
          (async (buf: Buffer) => {
            const mod = (await import('../pdfParserService.js')).default;
            return mod.extractTextFromBuffer(buf);
          });
        raw = await extractPdf(buffer);
        break;
      }
      default:
        return empty;
    }
    const { text, truncated } = clamp(raw);
    return { text, kind, truncated, ok: text.length > 0 };
  } catch (err) {
    logger.warn(
      `${LOG} extract(${kind}) failed (fail-soft): ${err instanceof Error ? err.message : String(err)}`
    );
    return empty;
  }
}

/**
 * Zbuduj blok kontekstu z wyekstrahowanego tekstu — gotowy do dopisania do briefu
 * (spójnie z W3.2 briefEnrichment). Zwraca '' gdy pusto.
 */
export function uploadTextToContextBlock(
  result: UploadExtractResult,
  filename: string,
  isPolish = true
): string {
  if (!result.ok || !result.text) return '';
  const header = isPolish
    ? `Kontekst z wgranego pliku „${filename}" (fakty — użyj jako podstawy, nie zmyślaj):`
    : `Context from uploaded file "${filename}" (facts — use as basis, do not fabricate):`;
  return `${header}\n${result.text}`;
}
