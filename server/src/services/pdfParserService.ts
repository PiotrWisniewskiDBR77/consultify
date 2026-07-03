import fs from 'fs';
import path from 'path';

import logger from '../utils/Logger.js';
import {
  logFinanceError,
  logFinanceEvent,
  summarizeTextPayload,
} from './financeDiagnosticsService.js';

type ParsedScores = { scores: Record<string, number> };

const normalizeScore = (value: number): number => {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 10) / 10;
};

const extractKeyValueScores = (text: string): Record<string, number> => {
  const scores: Record<string, number> = {};
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Examples:
    // "Process Digitalization: 3"
    // "Cybersecurity - 4.5"
    // "Smart Manufacturing 2"
    const m = line.match(/^(.{3,80}?)[\s:–-]+\s*(\d(?:\.\d)?)\s*$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = Number(m[2]);
    if (!key || !Number.isFinite(value)) continue;
    // Ignore obviously wrong values
    if (value < 0 || value > 10) continue;
    scores[key] = normalizeScore(value);
  }

  return scores;
};

const PDFParserService = {
  async extractTextFromBuffer(buffer: Buffer): Promise<string> {
    try {
      const mod = (await import('pdf-parse')) as any;
      let raw = '';
      // pdf-parse v2.x: klasa PDFParse z metodą getText({data}).
      // (Wcześniejszy kod wołał default-export jako funkcję — w v2 to obiekt
      // namespace, więc PDF upload rzucał "pdfParse is not a function" → 422.)
      const PDFParse = mod.PDFParse ?? mod.default?.PDFParse;
      if (typeof PDFParse === 'function') {
        const parser = new PDFParse({ data: buffer });
        try {
          const result = await parser.getText();
          raw = String(result?.text || '');
        } finally {
          // zwolnij zasoby pdfjs (jeśli API udostępnia destroy)
          if (typeof parser.destroy === 'function') {
            await parser.destroy().catch(() => undefined);
          }
        }
      } else {
        // Fallback dla starszego pdf-parse v1.x (funkcja default).
        const pdfParse = (mod.default ?? mod) as (
          dataBuffer: Buffer
        ) => Promise<{ text?: string | null }>;
        const pdfData = await pdfParse(buffer);
        raw = String(pdfData?.text || '');
      }
      // Postgres TEXT columns reject null bytes (0x00) — strip them
      return raw.replace(/\0/g, '');
    } catch (err: unknown) {
      throw new Error(`Failed to extract PDF text: ${(err as Error)?.message || String(err)}`);
    }
  },

  async extractText(filePath: string): Promise<string> {
    const fileName = path.basename(filePath);
    try {
      const buffer = fs.readFileSync(filePath);
      const text = await this.extractTextFromBuffer(buffer);
      logFinanceEvent('pdf.extract.completed', {
        fileName,
        sizeBytes: buffer.length,
        text: summarizeTextPayload(text),
      });
      return text;
    } catch (err: unknown) {
      logger.warn('[PDFParserService] pdf-parse failed:', (err as Error)?.message);
      logFinanceError('pdf.extract.failed', err, { fileName });
      throw new Error(`Failed to extract text from PDF: ${fileName}`);
    }
  },

  async parseGenericReport(text: string): Promise<{ findings: string[] }> {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const findings: string[] = [];
    for (const line of lines) {
      // Prefer bullet-like findings
      const bullet = line.match(/^[-*•]\s+(.*)$/);
      if (bullet?.[1] && bullet[1].length >= 20) findings.push(bullet[1]);
      if (findings.length >= 20) break;
    }

    // Fallback: extract a few "Finding:" lines
    if (findings.length === 0) {
      for (const line of lines) {
        const m = line.match(/^(finding|issue|risk)\s*[:-]\s*(.+)$/i);
        if (m?.[2] && m[2].length >= 20) findings.push(m[2]);
        if (findings.length >= 10) break;
      }
    }

    return { findings };
  },

  async parseSIRI(text: string): Promise<ParsedScores> {
    return { scores: extractKeyValueScores(text) };
  },

  async parseADMA(text: string): Promise<ParsedScores> {
    return { scores: extractKeyValueScores(text) };
  },
};

export default PDFParserService;
