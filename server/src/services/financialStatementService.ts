/**
 * T050 — Financial Statement Ingestion & Standardization Service
 *
 * Handles: PDF text extraction → auto-detection (BS/P&L/CF, period, currency, scale)
 *        → line extraction with confidence → mapping to canonical lines → validation.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import {
  getCanonicalLineById,
  getRequiredCanonicalLineIds,
  type CanonicalStatementType,
} from './financeCanonicalRegistry.js';
import logger from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectionResult {
  statementType: 'P&L' | 'BS' | 'CF' | 'UNKNOWN';
  confidence: number;
  periodStart: string | null;
  periodEnd: string | null;
  periodLabel: string | null;
  currency: string;
  scaling: 'units' | 'thousands' | 'millions' | 'billions';
  language: 'en' | 'pl' | 'de' | 'unknown';
}

export interface ExtractedLine {
  originalLabel: string;
  value: number;
  confidence: number;
  sourcePage?: number;
  sourceRow?: number;
  rawValue?: string;
  selectedPeriodLabel?: string;
  suggestedCanonicalId?: string;
  suggestedCanonicalLabel?: string;
  mappingReason?: string;
  isNonFinancial?: boolean;
  classificationReason?: string;
  mappingCandidates?: Array<{
    canonicalLineId: string;
    canonicalLabel: string;
    score: number;
    reason: string;
    selected?: boolean;
  }>;
}

export interface ExtractionResult {
  lines: ExtractedLine[];
  rawTableCount: number;
  warnings: string[];
}

export interface ValidationMessage {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  details?: string;
}

export type StatementReadinessStatus = 'pending' | 'recoverable' | 'ready' | 'rejected';
export type StatementQualityStage =
  | 'upload'
  | 'detect'
  | 'extract'
  | 'map'
  | 'validate'
  | 'repair'
  | 'readiness'
  | 'confirm'
  | 'benchmark';
export type StatementQualityResultStatus = 'pass' | 'warning' | 'fail' | 'info';
export type StatementDocumentClass =
  | 'unknown'
  | 'native_pdf'
  | 'scan_pdf'
  | 'spreadsheet'
  | 'csv'
  | 'mixed_report';

export interface StatementDocumentProfile {
  documentClass: StatementDocumentClass;
  extractionStrategy: string;
  templateFamily: string | null;
}

export interface DocumentFamilyProfile {
  templateFamily: string | null;
  displayName: string | null;
  matcherTerms: string[];
  sectionKeywords: string[];
  valueColumnStrategy: 'latest_reported_period' | 'quarter_end_primary' | 'annual_primary';
}

export interface StatementReadinessEvaluation {
  readinessStatus: StatementReadinessStatus;
  readinessScore: number;
  summary: string;
  reasonCodes: string[];
  eligibleLineCount: number;
  mappedLineCount: number;
  unmappedLineCount: number;
  nonFinancialLineCount: number;
  hardFailCount: number;
  warningCount: number;
  isReady: boolean;
}

interface CanonicalLine {
  id: string;
  statement_type: string;
  line_code: string;
  line_name: string;
  line_name_pl: string;
  required_level?: string;
  sign_convention?: string;
  is_computed?: boolean;
  deaggregation_ready?: boolean;
}

let aliasTableSupport: boolean | null = null;

export interface StatementSectionRecord {
  sectionKey: string;
  sectionLabel: string;
  statementType: string;
  lineStart: number;
  lineEnd: number;
  confidence: number;
  text: string;
  metadata?: Record<string, unknown>;
}

function isSchemaCompatError(error: unknown): boolean {
  const message = String((error as Error)?.message || error || '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('no such column') ||
    message.includes('no such table') ||
    message.includes('undefined column')
  );
}

function toCanonicalStatementType(value: unknown): CanonicalStatementType | null {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (normalized === 'P&L' || normalized === 'BS' || normalized === 'CF') {
    return normalized;
  }
  return null;
}

function mapValidationMessageStatus(type: ValidationMessage['type']): 'pass' | 'warning' | 'fail' {
  if (type === 'error') return 'fail';
  if (type === 'warning') return 'warning';
  return 'pass';
}

async function canUseStatementAliasTable(): Promise<boolean> {
  if (aliasTableSupport != null) return aliasTableSupport;

  try {
    if (process.env.DB_TYPE === 'postgres') {
      const rows = (await dbAll<{ column_name?: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'financial_statement_line_aliases'`,
        []
      )) as Array<{ column_name?: string }>;
      const columns = new Set(
        (rows || []).map((row) => String(row.column_name || '').trim()).filter(Boolean)
      );
      aliasTableSupport =
        columns.has('statement_line_id') &&
        columns.has('normalized_alias') &&
        columns.has('template_family');
      return aliasTableSupport;
    }

    const rows = (await dbAll<{ name?: string }>(`PRAGMA table_info(financial_statement_line_aliases)`, [])) as Array<{
      name?: string;
    }>;
    const columns = new Set((rows || []).map((row) => String(row.name || '').trim()).filter(Boolean));
    aliasTableSupport =
      columns.has('statement_line_id') &&
      columns.has('normalized_alias') &&
      columns.has('template_family');
    return aliasTableSupport;
  } catch {
    aliasTableSupport = false;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Statement type detection
// ---------------------------------------------------------------------------

const TYPE_KEYWORDS: Record<string, { keywords: string[]; weight: number }[]> = {
  'P&L': [
    { keywords: ['income statement', 'profit and loss', 'profit & loss', 'p&l'], weight: 10 },
    { keywords: ['rachunek zysków i strat', 'rachunek wyników'], weight: 10 },
    { keywords: ['revenue', 'przychody', 'sales', 'sprzedaż'], weight: 3 },
    { keywords: ['cost of goods', 'koszt własny', 'cogs'], weight: 3 },
    { keywords: ['gross profit', 'zysk brutto', 'gross margin'], weight: 3 },
    { keywords: ['operating profit', 'zysk operacyjny', 'ebit'], weight: 3 },
    { keywords: ['net income', 'zysk netto', 'net profit'], weight: 4 },
    { keywords: ['ebitda'], weight: 2 },
  ],
  BS: [
    { keywords: ['balance sheet', 'statement of financial position'], weight: 10 },
    { keywords: ['bilans'], weight: 10 },
    { keywords: ['total assets', 'aktywa ogółem', 'aktywa razem'], weight: 5 },
    { keywords: ['total liabilities', 'zobowiązania ogółem'], weight: 4 },
    { keywords: ['equity', 'kapitał własny', "shareholders' equity"], weight: 4 },
    { keywords: ['current assets', 'aktywa obrotowe'], weight: 3 },
    { keywords: ['fixed assets', 'aktywa trwałe', 'non-current assets'], weight: 3 },
    { keywords: ['accounts receivable', 'należności'], weight: 2 },
    { keywords: ['accounts payable', 'zobowiązania'], weight: 2 },
  ],
  CF: [
    { keywords: ['cash flow', 'cash flows', 'statement of cash flows'], weight: 10 },
    { keywords: ['rachunek przepływów pieniężnych', 'przepływy pieniężne'], weight: 10 },
    { keywords: ['operating activities', 'działalność operacyjna'], weight: 5 },
    { keywords: ['investing activities', 'działalność inwestycyjna'], weight: 5 },
    { keywords: ['financing activities', 'działalność finansowa'], weight: 5 },
    { keywords: ['cash and cash equivalents', 'środki pieniężne'], weight: 3 },
  ],
};

export function detectStatementType(text: string): DetectionResult {
  const lower = text.toLowerCase();

  // Score statement types
  const scores: Record<string, number> = { 'P&L': 0, BS: 0, CF: 0 };
  for (const [type, patterns] of Object.entries(TYPE_KEYWORDS)) {
    for (const { keywords, weight } of patterns) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          scores[type] += weight;
          break;
        }
      }
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = sorted[0];
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = total > 0 ? Math.min(bestScore / Math.max(total, 1), 1) : 0;
  const statementType = bestScore > 0 ? (bestType as DetectionResult['statementType']) : 'UNKNOWN';

  // Detect currency
  const currency = detectCurrency(lower);

  // Detect scaling
  const scaling = detectScaling(lower);

  // Detect period
  const { periodStart, periodEnd, periodLabel } = detectPeriod(text);

  // Detect language
  const language = detectLanguage(lower);

  return {
    statementType,
    confidence: Math.round(confidence * 100) / 100,
    periodStart,
    periodEnd,
    periodLabel,
    currency,
    scaling,
    language,
  };
}

function detectCurrency(text: string): string {
  const patterns: [RegExp, string][] = [
    [/\b(pln|złot|zł)\b/i, 'PLN'],
    [/\b(eur|euro|€)\b/i, 'EUR'],
    [/\b(usd|us\s*dollar|\$)\b/i, 'USD'],
    [/\b(gbp|£|pound\s*sterling)\b/i, 'GBP'],
    [/\b(czk|koruna|korona czeska)\b/i, 'CZK'],
    [/\b(chf|swiss\s*franc|frank)\b/i, 'CHF'],
  ];
  for (const [re, code] of patterns) {
    if (re.test(text)) return code;
  }
  return 'PLN';
}

function detectScaling(text: string): DetectionResult['scaling'] {
  const lower = text.toLowerCase();
  if (/\b(in millions|w milionach|mln zł|mln pln|000\s*000)\b/.test(lower)) return 'millions';
  if (/\b(in thousands|w tysiącach|tys\.?\s*zł|tys\.?\s*pln|000)\b/.test(lower)) return 'thousands';
  if (/\b(in billions|w miliardach|mld)\b/.test(lower)) return 'billions';
  return 'units';
}

function detectPeriod(text: string): {
  periodStart: string | null;
  periodEnd: string | null;
  periodLabel: string | null;
} {
  // Try "for the year ended YYYY-MM-DD" / "za rok obrotowy YYYY"
  const yearMatch = text.match(
    /(?:for the (?:year|period) ended|za rok(?: obrotowy)?)\s+(\d{4}(?:[.\-/]\d{1,2}[.\-/]\d{1,2})?)/i
  );
  if (yearMatch) {
    const raw = yearMatch[1];
    if (raw.length === 4) {
      return { periodStart: `${raw}-01-01`, periodEnd: `${raw}-12-31`, periodLabel: raw };
    }
  }

  // Try standalone 4-digit year near header
  const headerLines = text.substring(0, 2000);
  const years = [...headerLines.matchAll(/\b(20[1-3]\d)\b/g)].map((m) => parseInt(m[1]));
  if (years.length >= 1) {
    const latest = Math.max(...years);
    return {
      periodStart: `${latest}-01-01`,
      periodEnd: `${latest}-12-31`,
      periodLabel: String(latest),
    };
  }

  return { periodStart: null, periodEnd: null, periodLabel: null };
}

function detectLanguage(text: string): DetectionResult['language'] {
  const plMarkers = [
    'przychody',
    'zysk',
    'zobowiązania',
    'aktywa',
    'bilans',
    'kapitał',
    'amortyzacja',
  ];
  const enMarkers = [
    'revenue',
    'profit',
    'liabilities',
    'assets',
    'balance',
    'equity',
    'depreciation',
  ];
  const deMarkers = ['umsatz', 'gewinn', 'verbindlichkeiten', 'vermögen', 'bilanz', 'eigenkapital'];
  const countHits = (markers: string[]) => markers.filter((m) => text.includes(m)).length;
  const pl = countHits(plMarkers);
  const en = countHits(enMarkers);
  const de = countHits(deMarkers);
  if (pl >= en && pl >= de && pl > 0) return 'pl';
  if (en >= pl && en >= de && en > 0) return 'en';
  if (de > 0) return 'de';
  return 'unknown';
}

const DOCUMENT_FAMILY_REGISTRY: Record<string, Omit<DocumentFamilyProfile, 'templateFamily'>> = {
  gpw_apator: {
    displayName: 'GPW Apator',
    matcherTerms: ['apator', 'grupy apator', 'gk apator'],
    sectionKeywords: ['bilans', 'rachunek zysków i strat', 'rachunek przepływów pieniężnych'],
    valueColumnStrategy: 'quarter_end_primary',
  },
  gpw_quarterly_consolidated: {
    displayName: 'GPW Quarterly Consolidated',
    matcherTerms: ['skonsolidowany raport kwartalny', 'consolidated quarterly report'],
    sectionKeywords: ['bilans', 'sprawozdanie z sytuacji finansowej', 'statement of financial position'],
    valueColumnStrategy: 'quarter_end_primary',
  },
  annual_financial_report: {
    displayName: 'Annual Financial Report',
    matcherTerms: ['raport roczny', 'annual report', 'roczne sprawozdanie'],
    sectionKeywords: ['bilans', 'rachunek zysków i strat', 'cash flow'],
    valueColumnStrategy: 'annual_primary',
  },
};

export function resolveDocumentFamilyProfile(
  fileName: string,
  loweredText: string
): DocumentFamilyProfile {
  const matches = Object.entries(DOCUMENT_FAMILY_REGISTRY)
    .map(([templateFamily, definition]) => {
      const score = definition.matcherTerms.filter(
        (term) => fileName.includes(term) || loweredText.includes(term)
      ).length;
      return {
        templateFamily,
        score,
        definition,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const bestMatch = matches[0];
  if (!bestMatch) {
    return {
      templateFamily: null,
      displayName: null,
      matcherTerms: [],
      sectionKeywords: [],
      valueColumnStrategy: 'latest_reported_period',
    };
  }
  return {
    templateFamily: bestMatch.templateFamily,
    displayName: bestMatch.definition.displayName,
    matcherTerms: bestMatch.definition.matcherTerms,
    sectionKeywords: bestMatch.definition.sectionKeywords,
    valueColumnStrategy: bestMatch.definition.valueColumnStrategy,
  };
}

export function resolveStatementColumnSelection(text: string, detection?: Partial<DetectionResult>): {
  selectedPeriodLabel: string | null;
  comparisonPeriodLabel: string | null;
  selectionStrategy: string;
} {
  const headerWindow = String(text || '')
    .split(/\r?\n/)
    .slice(0, 120)
    .join(' ');
  const periodMatches = Array.from(
    new Set(
      [...headerWindow.matchAll(/\b(?:Q[1-4]|I|II|III|IV)\s*[-\/]?\s*(20\d{2})\b/gi)].map((match) =>
        String(match[0]).replace(/\s+/g, ' ').trim()
      )
    )
  );
  const yearMatches = Array.from(
    new Set([...headerWindow.matchAll(/\b(20\d{2})\b/g)].map((match) => String(match[1]).trim()))
  );

  if (periodMatches.length > 0) {
    return {
      selectedPeriodLabel: periodMatches[0] || null,
      comparisonPeriodLabel: periodMatches[1] || yearMatches[1] || null,
      selectionStrategy: 'header_period_primary',
    };
  }

  const detectedPeriodLabel = String(detection?.periodLabel || '').trim();
  return {
    selectedPeriodLabel: detectedPeriodLabel || yearMatches[0] || null,
    comparisonPeriodLabel: yearMatches[1] || null,
    selectionStrategy: detectedPeriodLabel ? 'detected_period_fallback' : 'header_year_fallback',
  };
}

export function classifyStatementDocument(params: {
  fileName?: string;
  parseMethod?: string;
  text?: string;
}): StatementDocumentProfile {
  const fileName = String(params.fileName || '').toLowerCase();
  const parseMethod = String(params.parseMethod || '').toLowerCase();
  const text = String(params.text || '');
  const loweredText = text.toLowerCase();

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return {
      documentClass: 'spreadsheet',
      extractionStrategy: 'spreadsheet_structured',
      templateFamily: detectTemplateFamily(fileName, loweredText),
    };
  }

  if (fileName.endsWith('.csv')) {
    return {
      documentClass: 'csv',
      extractionStrategy: 'csv_structured',
      templateFamily: detectTemplateFamily(fileName, loweredText),
    };
  }

  if (
    parseMethod === 'ocr' ||
    /scan|skan|zeskanowany/.test(fileName) ||
    /ocr/.test(loweredText.slice(0, 500))
  ) {
    return {
      documentClass: 'scan_pdf',
      extractionStrategy: 'ocr_review',
      templateFamily: detectTemplateFamily(fileName, loweredText),
    };
  }

  if (fileName.endsWith('.pdf')) {
    const multiStatementHints =
      /(skonsolidowany raport kwartalny|sprawozdanie finansowe|statement of financial position|rachunek przepływów)/.test(
        loweredText
      ) && /(nota|note\s+\d+)/.test(loweredText);
    return {
      documentClass: multiStatementHints ? 'mixed_report' : 'native_pdf',
      extractionStrategy: multiStatementHints ? 'pdf_layout_mixed' : 'pdf_layout_primary',
      templateFamily: detectTemplateFamily(fileName, loweredText),
    };
  }

  return {
    documentClass: 'unknown',
    extractionStrategy: 'manual_review',
    templateFamily: detectTemplateFamily(fileName, loweredText),
  };
}

function detectTemplateFamily(fileName: string, loweredText: string): string | null {
  return resolveDocumentFamilyProfile(fileName, loweredText).templateFamily;
}

// ---------------------------------------------------------------------------
// Line extraction from text
// ---------------------------------------------------------------------------

function normalizeAliasText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[–—-]/g, ' ')
    .replace(/\bnota\b\.?\s*[0-9ivxlcdm]+[a-z]?/giu, ' ')
    .replace(/\bnote\b\.?\s*[0-9ivxlcdm]+[a-z]?/giu, ' ')
    .replace(/^[ivxlcdm]+\.\s+/giu, ' ')
    .replace(/^\d+[a-z]?[.)]\s+/giu, ' ')
    .replace(/[^\p{L}\p{N}% ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanupExtractedLabel(value: string): string {
  return String(value || '')
    .replace(/\b(?:nota|note)\b\.?\s*[0-9ivxlcdm]+[a-z]?/giu, ' ')
    .replace(/^[ivxlcdm]+\.\s+/giu, ' ')
    .replace(/^\d+[a-z]?[.)]\s+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function locateStatementSections(
  text: string,
  statementType: string
): StatementSectionRecord[] {
  const normalizedType = String(statementType || '').trim().toUpperCase();
  const rawLines = String(text || '').split(/\r?\n/);
  if (rawLines.length < 20) {
    return [
      {
        sectionKey: normalizedType || 'UNKNOWN',
        sectionLabel: normalizedType || 'Unknown Statement Section',
        statementType: normalizedType || 'UNKNOWN',
        lineStart: 1,
        lineEnd: rawLines.length,
        confidence: 0.2,
        text,
      },
    ];
  }

  const sectionMarkers: Record<string, { start: RegExp[]; end: RegExp[] }> = {
    BS: {
      start: [
        /\bbilans\b/i,
        /sprawozdanie z sytuacji finansowej/i,
        /statement of financial position/i,
        /balance sheet/i,
      ],
      end: [
        /rachunek zysków i strat/i,
        /sprawozdanie z całkowitych dochodów/i,
        /statement of profit or loss/i,
        /cash flow/i,
        /rachunek przepływów pieniężnych/i,
        /zestawienie zmian w kapitale/i,
      ],
    },
    'P&L': {
      start: [
        /rachunek zysków i strat/i,
        /sprawozdanie z całkowitych dochodów/i,
        /statement of profit or loss/i,
        /\bprofit and loss\b/i,
      ],
      end: [
        /cash flow/i,
        /rachunek przepływów pieniężnych/i,
        /zestawienie zmian w kapitale/i,
        /\bbilans\b/i,
        /sprawozdanie z sytuacji finansowej/i,
      ],
    },
    CF: {
      start: [
        /cash flow/i,
        /statement of cash flows/i,
        /rachunek przepływów pieniężnych/i,
      ],
      end: [
        /zestawienie zmian w kapitale/i,
        /\bnotes\b/i,
        /\binformacje dodatkowe\b/i,
        /\bobjaśnienia\b/i,
      ],
    },
  };

  const markers = sectionMarkers[normalizedType];
  if (!markers) {
    return [
      {
        sectionKey: normalizedType || 'UNKNOWN',
        sectionLabel: normalizedType || 'Unknown Statement Section',
        statementType: normalizedType || 'UNKNOWN',
        lineStart: 1,
        lineEnd: rawLines.length,
        confidence: 0.2,
        text,
      },
    ];
  }

  const numericGroupRegex = /\(?-?(?:\d{1,3}(?:[ \u00A0]\d{3})+|\d+)(?:[.,]\d+)?\)?/g;
  const candidateWindows: Array<{ start: number; end: number; score: number; sectionLabel: string }> =
    [];

  for (let index = 0; index < rawLines.length; index++) {
    const line = rawLines[index];
    if (!markers.start.some((pattern) => pattern.test(line))) continue;

    const start = Math.max(0, index - 4);
    let end = Math.min(rawLines.length, index + 220);
    for (let cursor = index + 8; cursor < Math.min(rawLines.length, index + 260); cursor++) {
      if (markers.end.some((pattern) => pattern.test(rawLines[cursor]))) {
        end = cursor;
        break;
      }
    }

    const windowLines = rawLines.slice(start, end);
    const numericLines = windowLines.filter((candidate) => {
      const matches = candidate.match(numericGroupRegex) || [];
      return matches.length >= 2;
    }).length;
    const semanticLines = windowLines.filter((candidate) =>
      /(aktywa|pasywa|kapitał|equity|liabilities|assets|cash|należności|zobowiązania|revenue|przychody|profit|ebitda|flow)/i.test(
        candidate
      )
    ).length;
    candidateWindows.push({
      start,
      end,
      score: numericLines * 2 + semanticLines,
      sectionLabel: line.trim().slice(0, 120) || normalizedType,
    });
  }

  const windows = candidateWindows
    .sort((left, right) => right.score - left.score)
    .filter((window, index, arr) => {
      if (window.score < 12) return false;
      return !arr.slice(0, index).some((other) => Math.abs(other.start - window.start) < 6);
    })
    .slice(0, 3);

  if (windows.length === 0) {
    return [
      {
        sectionKey: normalizedType || 'UNKNOWN',
        sectionLabel: normalizedType || 'Unknown Statement Section',
        statementType: normalizedType || 'UNKNOWN',
        lineStart: 1,
        lineEnd: rawLines.length,
        confidence: 0.2,
        text,
      },
    ];
  }

  return windows.map((window, index) => ({
    sectionKey: `${normalizedType || 'UNKNOWN'}_${index + 1}`,
    sectionLabel: window.sectionLabel,
    statementType: normalizedType || 'UNKNOWN',
    lineStart: window.start + 1,
    lineEnd: window.end,
    confidence: Math.max(0.2, Math.min(0.98, window.score / 40)),
    text: rawLines.slice(window.start, window.end).join('\n'),
    metadata: {
      score: window.score,
      sectionRank: index + 1,
    },
  }));
}

function extractRelevantStatementSection(
  text: string,
  statementType: string
): { scopedText: string; lineOffset: number; sections: StatementSectionRecord[] } {
  const sections = locateStatementSections(text, statementType);
  const bestSection = sections[0];
  if (!bestSection) {
    return { scopedText: text, lineOffset: 0, sections: [] };
  }
  return {
    scopedText: bestSection.text,
    lineOffset: Math.max(0, bestSection.lineStart - 1),
    sections,
  };
}

function classifyNonFinancialLine(label: string): { isNonFinancial: boolean; reason?: string } {
  const normalized = normalizeAliasText(label);
  if (!normalized) return { isNonFinancial: true, reason: 'EMPTY_LABEL' };
  if (normalized.length > 140) return { isNonFinancial: true, reason: 'NARRATIVE_LABEL_TOO_LONG' };
  if (
    /(sytuacja|sytuacji|szczegóły|w związku|na dzień publikacji|see note|refer to note|objaśnienia|komentarz|commentary)/.test(
      normalized
    )
  ) {
    return { isNonFinancial: true, reason: 'NARRATIVE_NOTE_LINE' };
  }
  if (normalized.split(' ').length > 14) {
    return { isNonFinancial: true, reason: 'LONG_SENTENCE_LINE' };
  }
  return { isNonFinancial: false };
}

export function extractFinancialLines(
  text: string,
  detectedType: string,
  _options?: { templateFamily?: string | null }
): ExtractionResult {
  const lines: ExtractedLine[] = [];
  const warnings: string[] = [];
  const { scopedText, lineOffset, sections } = extractRelevantStatementSection(text, detectedType);
  const rawLines = scopedText.split(/\r?\n/);
  let rawTableCount = 0;
  let pendingLabel: string | null = null;

  // Number normalization: handle (negative), spaces in thousands, comma vs dot
  const normalizeNumber = (raw: string): number | null => {
    let s = raw.trim();
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) return null;
    if (/^\d{4}$/.test(s)) {
      const maybeYear = Number(s);
      if (maybeYear >= 1900 && maybeYear <= 2100) return null;
    }
    const isNeg = s.startsWith('(') && s.endsWith(')');
    if (isNeg) s = s.slice(1, -1);
    if (s.startsWith('-')) {
      s = s.slice(1);
    }

    // Detect separator style: "1,234.56" vs "1.234,56" vs "1 234,56"
    s = s.replace(/\s/g, '');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // European: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US/UK: 1,234.56
      s = s.replace(/,/g, '');
    }

    const num = parseFloat(s);
    if (!Number.isFinite(num)) return null;
    return isNeg || raw.trim().startsWith('-') ? -num : num;
  };

  const noisePatterns = [
    /^strona\s+\d+/i,
    /^--\s*\d+\s+of\s+\d+\s*--$/i,
    /^w\s+tys\./i,
    /^poziom zaokrągleń/i,
    /^okres objęty/i,
    /^waluta sprawozdawcza/i,
    /^skonsolidowany raport/i,
    /^spis treści/i,
    /^nota\b/i,
    /^note\b/i,
  ];

  const isNoiseLine = (line: string): boolean =>
    noisePatterns.some((pattern) => pattern.test(line)) ||
    /\b\d{2}\.\d{2}\.\d{4}\b.*\b\d{2}\.\d{2}\.\d{4}\b/.test(line);

  const isLikelyLabelOnlyLine = (line: string): boolean => {
    if (isNoiseLine(line)) return false;
    if (!/[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]/.test(line)) return false;
    if (/\d/.test(line)) return false;
    return line.length >= 3 && line.length <= 140;
  };

  const numberGroupRegex =
    /\(?-?(?:\d{1,3}(?:[ \u00A0]\d{3})+|\d+)(?:[.,]\d+)?\)?/g;
  const seen = new Set<string>();

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;
    if (isNoiseLine(line)) {
      pendingLabel = null;
      continue;
    }

    const matches = [...line.matchAll(numberGroupRegex)];
    const parsedMatches = matches
      .map((match) => ({
        raw: match[0],
        index: match.index ?? -1,
        value: normalizeNumber(match[0]),
      }))
      .filter((item) => item.index >= 0 && item.value !== null) as Array<{
      raw: string;
      index: number;
      value: number;
    }>;

    if (parsedMatches.length < 2) {
      if (isLikelyLabelOnlyLine(line)) {
        pendingLabel = pendingLabel ? `${pendingLabel} ${line}` : line;
      } else {
        pendingLabel = null;
      }
      continue;
    }

    const firstNumberIndex = parsedMatches[0].index;
    let label = line.slice(0, firstNumberIndex).trim();
    if (pendingLabel) {
      label = label ? `${pendingLabel} ${label}` : pendingLabel;
      pendingLabel = null;
    }

    label = cleanupExtractedLabel(label.replace(/\s+/g, ' ').trim());
    if (!label || label.length < 3 || isNoiseLine(label)) continue;
    const lineClassification = classifyNonFinancialLine(label);

    // Prefer the first resolved value in the row. In GPW-style statements the
    // current/reporting period is typically shown before the comparison period,
    // while the previous implementation incorrectly picked the trailing value.
    const rawValue = parsedMatches[0].raw;
    const value = parsedMatches[0].value;
    const dedupeKey = `${detectedType}:${label.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    rawTableCount++;
    lines.push({
      originalLabel: label,
      value,
      confidence: lineClassification.isNonFinancial ? 0.2 : 0.6,
      rawValue,
      selectedPeriodLabel: sections[0]?.sectionLabel,
      sourceRow: lineOffset + i + 1,
      isNonFinancial: lineClassification.isNonFinancial,
      classificationReason: lineClassification.reason,
    });
  }

  if (lines.length === 0) {
    warnings.push(
      'No structured financial lines detected. The PDF may require OCR or manual entry.'
    );
  }

  return { lines, rawTableCount, warnings };
}

// ---------------------------------------------------------------------------
// Auto-mapping to canonical lines
// ---------------------------------------------------------------------------

const CANONICAL_MAPPING_HINTS: Record<string, string[]> = {
  'fsl-pl-revenue': [
    'revenue',
    'przychody',
    'przychody ze sprzedaży',
    'net revenue',
    'sales',
    'sprzedaż',
    'total revenue',
  ],
  'fsl-pl-cogs': ['cost of goods', 'cogs', 'koszt sprzedanych', 'koszt własny', 'cost of sales'],
  'fsl-pl-gross': ['gross profit', 'gross margin', 'zysk brutto', 'marża brutto'],
  'fsl-pl-opex': [
    'operating expenses',
    'sg&a',
    'koszty operacyjne',
    'koszty ogólne',
    'opex',
    'selling general',
  ],
  'fsl-pl-ebitda': ['ebitda'],
  'fsl-pl-ebit': [
    'ebit',
    'operating profit',
    'operating income',
    'zysk operacyjny',
    'zysk z działalności operacyjnej',
  ],
  'fsl-pl-net': ['net income', 'net profit', 'zysk netto', 'zysk/strata netto', 'net earnings'],
  'fsl-pl-interest': ['interest expense', 'koszty odsetkowe', 'koszty finansowe', 'finance costs'],
  'fsl-pl-depreciation': [
    'depreciation',
    'amortization',
    'amortyzacja',
    'd&a',
    'depreciation and amortization',
  ],
  'fsl-pl-tax': ['income tax', 'tax expense', 'podatek dochodowy', 'podatek'],
  'fsl-bs-total-assets': [
    'total assets',
    'aktywa ogółem',
    'aktywa razem',
    'suma aktywów',
    'aktywa razem ogółem',
  ],
  'fsl-bs-current-assets': ['current assets', 'aktywa obrotowe', 'aktywa bieżące', 'aktywa obrotowe razem'],
  'fsl-bs-cash': ['cash', 'cash and cash equivalents', 'środki pieniężne', 'gotówka', 'środki pieniężne i ich ekwiwalenty'],
  'fsl-bs-inventory': ['inventory', 'inventories', 'zapasy'],
  'fsl-bs-ar': [
    'accounts receivable',
    'receivables',
    'należności',
    'trade receivables',
    'należności handlowe',
    'należności z tytułu dostaw i usług',
  ],
  'fsl-bs-ap': [
    'accounts payable',
    'payables',
    'zobowiązania handlowe',
    'trade payables',
    'zobowiązania z tytułu dostaw i usług',
  ],
  'fsl-bs-wc': ['working capital', 'kapitał obrotowy'],
  'fsl-bs-fixed': ['fixed assets', 'property plant', 'aktywa trwałe', 'ppe', 'non-current assets', 'aktywa trwałe razem'],
  'fsl-bs-total-liabilities': [
    'total liabilities',
    'zobowiązania ogółem',
    'zobowiązania razem',
    'pasywa razem',
    'pasywa ogółem',
    'zobowiązania i rezerwy na zobowiązania',
    'suma pasywów',
    'zobowiązania razem ogółem',
  ],
  'fsl-bs-current-liabilities': [
    'current liabilities',
    'zobowiązania krótkoterminowe',
    'zobowiązania bieżące',
    'zobowiązania krótkoterminowe razem',
  ],
  'fsl-bs-long-term-debt': [
    'long-term debt',
    'long term liabilities',
    'zobowiązania długoterminowe',
    'non-current liabilities',
    'zobowiązania długoterminowe razem',
    'kredyty i pożyczki długoterminowe',
  ],
  'fsl-bs-equity': [
    'equity',
    'shareholders equity',
    'kapitał własny',
    'total equity',
    'kapitał własny razem',
    'kapitał własny ogółem',
    'razem kapitał własny',
    'kapitał własny przypadający akcjonariuszom jednostki dominującej',
  ],
  'fsl-cf-operating': [
    'operating cash flow',
    'cash from operations',
    'przepływy operacyjne',
    'cfo',
  ],
  'fsl-cf-capex': [
    'capital expenditures',
    'capex',
    'nakłady inwestycyjne',
    'purchases of property',
  ],
  'fsl-cf-fcf': ['free cash flow', 'fcf', 'wolne przepływy'],
  'fsl-cf-financing': ['financing cash flow', 'cash from financing', 'przepływy z finansowania'],
  'fsl-cf-investing': ['investing cash flow', 'cash from investing', 'przepływy z inwestycji'],
};

function buildFallbackCanonicalLines(statementType: string): CanonicalLine[] {
  const normalizedStatementType = String(statementType || '').trim().toUpperCase();
  const prefix =
    normalizedStatementType === 'P&L'
      ? 'fsl-pl-'
      : normalizedStatementType === 'BS'
        ? 'fsl-bs-'
        : normalizedStatementType === 'CF'
          ? 'fsl-cf-'
          : '';
  if (!prefix) return [];

  return Object.entries(CANONICAL_MAPPING_HINTS)
    .filter(([id]) => id.startsWith(prefix))
    .map(([id, hints]) => {
      const slug = id.replace(prefix, '');
      const firstHint = hints[0] || slug;
      return {
        id,
        statement_type: normalizedStatementType,
        line_code: slug.replace(/-/g, '_').toUpperCase(),
        line_name: firstHint
          .split(' ')
          .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
          .join(' '),
        line_name_pl: firstHint,
      };
    });
}

export async function autoMapLines(
  extractedLines: ExtractedLine[],
  statementType: string,
  options?: { organizationId?: string; templateFamily?: string | null }
): Promise<ExtractedLine[]> {
  const normalizedStatementType = String(statementType || '').trim().toUpperCase();
  const organizationScope = String(options?.organizationId || '').trim();
  const templateFamily = String(options?.templateFamily || '').trim();
  const canonicalLines: CanonicalLine[] = (await dbAll(
    `SELECT id, statement_type, line_code, line_name, line_name_pl
     FROM financial_statement_lines
     WHERE statement_type = ?
       AND (is_system = TRUE OR organization_id = ? OR organization_id IS NULL)`,
    [normalizedStatementType, organizationScope]
  )) as CanonicalLine[];
  for (const fallbackLine of buildFallbackCanonicalLines(normalizedStatementType)) {
    if (!canonicalLines.some((canonical) => canonical.id === fallbackLine.id)) {
      canonicalLines.push(fallbackLine);
    }
  }

  let aliasRows: Array<{ statement_line_id: string; normalized_alias: string; template_family: string }> = [];
  if (await canUseStatementAliasTable()) {
    try {
      aliasRows = (await dbAll(
        `SELECT statement_line_id, normalized_alias, template_family
         FROM financial_statement_line_aliases
         WHERE statement_type = ?
           AND organization_id IN ('', ?)
           AND (template_family = '' OR template_family = ?)`,
        [normalizedStatementType, organizationScope, templateFamily]
      )) as Array<{ statement_line_id: string; normalized_alias: string; template_family: string }>;
    } catch (error) {
      if (!isSchemaCompatError(error)) throw error;
      aliasRows = [];
      aliasTableSupport = false;
    }
  }

  const aliasLookup = new Map<string, string[]>();
  for (const canonical of canonicalLines) {
    const hints = CANONICAL_MAPPING_HINTS[canonical.id] || [];
    aliasLookup.set(
      canonical.id,
      Array.from(
        new Set([
          ...hints.map((hint) => normalizeAliasText(hint)),
          normalizeAliasText(canonical.line_code),
          normalizeAliasText(canonical.line_name),
          normalizeAliasText(canonical.line_name_pl),
        ]).values()
      ).filter(Boolean)
    );
  }

  for (const row of aliasRows) {
    const existing = aliasLookup.get(row.statement_line_id) || [];
    aliasLookup.set(
      row.statement_line_id,
      Array.from(new Set([...existing, normalizeAliasText(row.normalized_alias)])).filter(Boolean)
    );
  }

  return extractedLines.map((line) => {
    const classification =
      line.isNonFinancial != null
        ? { isNonFinancial: line.isNonFinancial, reason: line.classificationReason }
        : classifyNonFinancialLine(line.originalLabel);
    if (classification.isNonFinancial) {
      return {
        ...line,
        confidence: Math.min(line.confidence, 0.25),
        suggestedCanonicalId: undefined,
        suggestedCanonicalLabel: undefined,
        isNonFinancial: true,
        classificationReason: classification.reason || 'NON_FINANCIAL_LINE',
        mappingReason: 'non_financial_filter',
      };
    }

    const label = normalizeAliasText(line.originalLabel);
    const scoredMatches: Array<{ id: string; name: string; score: number; reason: string }> = [];

    for (const canonical of canonicalLines) {
      const aliases = aliasLookup.get(canonical.id) || [];
      for (const alias of aliases) {
        if (!alias) continue;
        let score = 0;
        if (label === alias) score = 1;
        else if (label.includes(alias) || alias.includes(label)) {
          score = Math.min(alias.length, label.length) / Math.max(alias.length, label.length);
        } else {
          const aliasTokens = new Set(alias.split(' ').filter(Boolean));
          const labelTokens = label.split(' ').filter(Boolean);
          const overlap = labelTokens.filter((token) => aliasTokens.has(token)).length;
          if (overlap >= 2) {
            score = overlap / Math.max(labelTokens.length, aliasTokens.size);
          }
        }

        if (score <= 0) continue;
        if (templateFamily && aliasRows.some((row) => row.statement_line_id === canonical.id && row.template_family === templateFamily)) {
          score += 0.1;
        }
        scoredMatches.push({
          id: canonical.id,
          name: canonical.line_name,
          score,
          reason: score >= 1 ? 'exact_alias_match' : 'alias_similarity_match',
        });
      }
    }

    const dedupedMatches = Array.from(
      scoredMatches
        .sort((left, right) => right.score - left.score)
        .reduce((acc, match) => {
          if (!acc.has(match.id)) acc.set(match.id, match);
          return acc;
        }, new Map<string, { id: string; name: string; score: number; reason: string }>())
        .values()
    ).slice(0, 3);
    const bestMatch = dedupedMatches[0] || null;
    const mappingCandidates = dedupedMatches.map((match, index) => ({
      canonicalLineId: match.id,
      canonicalLabel: match.name,
      score: Number(match.score.toFixed(4)),
      reason: match.reason,
      selected: index === 0,
    }));

    if (bestMatch) {
      return {
        ...line,
        confidence: Math.min(line.confidence + Math.min(bestMatch.score, 0.3), 0.98),
        suggestedCanonicalId: bestMatch.id,
        suggestedCanonicalLabel: bestMatch.name,
        mappingReason: bestMatch.reason,
        isNonFinancial: false,
        mappingCandidates,
      };
    }
    return {
      ...line,
      mappingReason: 'no_alias_match',
      isNonFinancial: false,
      mappingCandidates,
    };
  });
}

export function resolveDuplicateSuggestedMappings(extractedLines: ExtractedLine[]): ExtractedLine[] {
  const grouped = new Map<string, Array<{ line: ExtractedLine; index: number }>>();
  extractedLines.forEach((line, index) => {
    const key = String(line.suggestedCanonicalId || '').trim();
    if (!key) return;
    const bucket = grouped.get(key) || [];
    bucket.push({ line, index });
    grouped.set(key, bucket);
  });

  const nextLines = extractedLines.map((line) => ({ ...line }));
  for (const [, bucket] of grouped) {
    if (bucket.length <= 1) continue;
    const winner = [...bucket].sort((left, right) => {
      const candidateScore = (entry: { line: ExtractedLine }) =>
        Number(entry.line.mappingCandidates?.find((candidate) => candidate.selected)?.score || 0);
      const scoreDiff = candidateScore(right) - candidateScore(left);
      if (scoreDiff !== 0) return scoreDiff;
      const confidenceDiff = Number(right.line.confidence || 0) - Number(left.line.confidence || 0);
      if (confidenceDiff !== 0) return confidenceDiff;
      return Number(left.line.sourceRow || 0) - Number(right.line.sourceRow || 0);
    })[0];

    for (const entry of bucket) {
      if (entry.index === winner.index) continue;
      const current = nextLines[entry.index];
      nextLines[entry.index] = {
        ...current,
        suggestedCanonicalId: undefined,
        suggestedCanonicalLabel: undefined,
        mappingReason: 'duplicate_candidate_conflict',
        mappingCandidates: (current.mappingCandidates || []).map((candidate) => ({
          ...candidate,
          selected: false,
        })),
      };
    }
  }

  return nextLines;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateStatement(
  lines: Array<{
    canonicalLineId: string | null;
    value: number;
    originalLabel?: string;
    mappingStatus?: string;
    isNonFinancial?: boolean;
  }>,
  statementType: string
): { status: 'pass' | 'warnings' | 'needs_review'; messages: ValidationMessage[] } {
  const messages: ValidationMessage[] = [];
  const activeLines = lines.filter((line) => !line.isNonFinancial);
  const canonicalStatementType = toCanonicalStatementType(statementType);

  const getValues = (lineId: string): number[] =>
    activeLines.filter((line) => line.canonicalLineId === lineId).map((line) => Number(line.value || 0));
  const getValue = (lineId: string): number | null => {
    const values = getValues(lineId);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0);
  };

  const duplicateCodes = Array.from(
    new Set(
      activeLines
        .filter((line) => line.canonicalLineId)
        .map((line) => String(line.canonicalLineId))
        .filter((lineId, index, arr) => arr.indexOf(lineId) !== index)
    )
  );
  if (duplicateCodes.length > 0) {
    messages.push({
      type: 'warning',
      code: 'DUPLICATE_CANONICAL_LINES',
      message: `Detected duplicate canonical mappings: ${duplicateCodes.join(', ')}`,
    });
  }

  if (statementType === 'BS') {
    const totalAssets = getValue('fsl-bs-total-assets');
    const totalLiabilities = getValue('fsl-bs-total-liabilities');
    const equity = getValue('fsl-bs-equity');
    const cash = getValue('fsl-bs-cash');
    const currentAssets = getValue('fsl-bs-current-assets');
    const currentLiabilities = getValue('fsl-bs-current-liabilities');

    if (totalAssets !== null && totalLiabilities !== null && equity !== null) {
      const diff = Math.abs(totalAssets - (totalLiabilities + equity));
      const tolerance = Math.abs(totalAssets) * 0.01;
      if (diff > tolerance) {
        messages.push({
          type: 'error',
          code: 'BS_EQUATION_MISMATCH',
          message: 'Assets ≠ Liabilities + Equity',
          details: `Assets: ${totalAssets}, Liabilities + Equity: ${totalLiabilities + equity}, Diff: ${diff.toFixed(2)}`,
        });
      } else {
        messages.push({
          type: 'info',
          code: 'BS_EQUATION_OK',
          message: 'Balance sheet equation verified',
        });
      }
    } else {
      messages.push({
        type: 'warning',
        code: 'BS_EQUATION_INCOMPLETE',
        message:
          'Cannot verify balance sheet equation — missing Total Assets, Total Liabilities, or Equity',
      });
    }

    if (cash !== null && cash < 0) {
      messages.push({
        type: 'warning',
        code: 'BS_NEGATIVE_CASH',
        message: 'Cash is negative. Verify sign and scale.',
      });
    }
    if (currentAssets !== null && totalAssets !== null && Math.abs(currentAssets) > Math.abs(totalAssets) * 1.05) {
      messages.push({
        type: 'error',
        code: 'BS_CURRENT_ASSETS_EXCEED_TOTAL',
        message: 'Current assets exceed total assets.',
      });
    }
    if (
      currentLiabilities !== null &&
      totalLiabilities !== null &&
      Math.abs(currentLiabilities) > Math.abs(totalLiabilities) * 1.1
    ) {
      messages.push({
        type: 'warning',
        code: 'BS_CURRENT_LIABILITIES_EXCEED_TOTAL',
        message: 'Current liabilities exceed total liabilities.',
      });
    }
  }

  if (statementType === 'P&L') {
    const revenue = getValue('fsl-pl-revenue');
    const cogs = getValue('fsl-pl-cogs');
    const gross = getValue('fsl-pl-gross');
    const ebitda = getValue('fsl-pl-ebitda');
    const ebit = getValue('fsl-pl-ebit');
    const netIncome = getValue('fsl-pl-net');
    if (revenue !== null && cogs !== null && gross !== null) {
      const expected = revenue - Math.abs(cogs);
      const diff = Math.abs(gross - expected);
      if (diff > Math.abs(revenue) * 0.02) {
        messages.push({
          type: 'warning',
          code: 'PL_GROSS_MISMATCH',
          message: 'Gross Margin ≠ Revenue − COGS',
          details: `Revenue: ${revenue}, COGS: ${cogs}, Gross: ${gross}, Expected: ${expected.toFixed(2)}`,
        });
      }
    }
    if (revenue !== null && revenue <= 0) {
      messages.push({
        type: 'warning',
        code: 'PL_NON_POSITIVE_REVENUE',
        message: 'Revenue is zero or negative. Verify statement type and sign.',
      });
    }
    if (ebitda !== null && ebit !== null && ebitda < ebit) {
      messages.push({
        type: 'warning',
        code: 'PL_EBITDA_BELOW_EBIT',
        message: 'EBITDA is below EBIT. Verify depreciation or sign handling.',
      });
    }
    if (revenue !== null && netIncome !== null && Math.abs(netIncome) > Math.abs(revenue) * 2) {
      messages.push({
        type: 'warning',
        code: 'PL_NET_INCOME_OUTLIER',
        message: 'Net income magnitude looks disproportionate to revenue.',
      });
    }
  }

  if (statementType === 'CF') {
    const operating = getValue('fsl-cf-operating');
    const capex = getValue('fsl-cf-capex');
    const freeCashFlow = getValue('fsl-cf-fcf');
    const financing = getValue('fsl-cf-financing');
    const investing = getValue('fsl-cf-investing');
    if (operating !== null && capex !== null && freeCashFlow !== null) {
      const expected = operating + (capex > 0 ? -capex : capex);
      const diff = Math.abs(freeCashFlow - expected);
      if (diff > Math.max(Math.abs(expected) * 0.05, 1)) {
        messages.push({
          type: 'warning',
          code: 'CF_FCF_MISMATCH',
          message: 'Free cash flow does not reconcile with operating cash flow and capex.',
        });
      }
    }
    if (operating === null && investing === null && financing === null) {
      messages.push({
        type: 'warning',
        code: 'CF_CORE_LINES_MISSING',
        message: 'Cash flow statement is missing operating, investing, and financing lines.',
      });
    }
  }

  const mappedCount = activeLines.filter((line) => line.canonicalLineId).length;
  const totalCount = activeLines.length;
  if (totalCount > 0 && mappedCount / totalCount < 0.75) {
    messages.push({
      type: 'warning',
      code: 'LOW_MAPPING_COVERAGE',
      message: `Only ${Math.round((mappedCount / totalCount) * 100)}% of lines are mapped to canonical categories`,
    });
  }
  if (totalCount === 0) {
    messages.push({
      type: 'error',
      code: 'NO_FINANCIAL_LINES',
      message: 'No eligible financial lines remain after filtering non-financial rows.',
    });
  }
  if (canonicalStatementType) {
    const presentLineIds = new Set(
      activeLines
        .map((line) => String(line.canonicalLineId || '').trim())
        .filter(Boolean)
    );
    const missingRequiredLineIds = getRequiredCanonicalLineIds(canonicalStatementType).filter(
      (lineId) => !presentLineIds.has(lineId)
    );
    if (missingRequiredLineIds.length > 0) {
      const missingCodes = missingRequiredLineIds
        .map((lineId) => getCanonicalLineById(lineId)?.code || lineId)
        .filter(Boolean);
      messages.push({
        type: 'warning',
        code: 'REQUIRED_LINES_MISSING',
        message: `Required canonical lines are missing: ${missingCodes.join(', ')}`,
      });
    }
  }

  const hasErrors = messages.some((m) => m.type === 'error');
  const hasWarnings = messages.some((m) => m.type === 'warning');
  const status = hasErrors ? 'needs_review' : hasWarnings ? 'warnings' : 'pass';

  return { status, messages };
}

export function evaluateStatementReadiness(params: {
  rawStatus?: unknown;
  statementType?: unknown;
  validationStatus?: unknown;
  currency?: unknown;
  scaling?: unknown;
  validationMessages?: ValidationMessage[];
  values: Array<{
    canonicalLineId: string | null;
    value: number;
    isNonFinancial?: boolean;
  }>;
}): StatementReadinessEvaluation {
  const normalizedStatus = String(params.rawStatus || '').trim().toLowerCase();
  const normalizedType = String(params.statementType || '').trim().toUpperCase();
  const normalizedValidation = String(params.validationStatus || '').trim().toLowerCase();
  const normalizedCurrency = String(params.currency || '').trim().toUpperCase();
  const normalizedScaling = String(params.scaling || '').trim().toLowerCase();
  const validationMessages = Array.isArray(params.validationMessages) ? params.validationMessages : [];
  const activeValues = (params.values || []).filter((value) => !value.isNonFinancial);
  const canonicalStatementType = toCanonicalStatementType(params.statementType);
  const nonFinancialLineCount = Math.max(0, (params.values || []).length - activeValues.length);
  const mappedLineCount = activeValues.filter((value) => value.canonicalLineId).length;
  const eligibleLineCount = activeValues.length;
  const unmappedLineCount = Math.max(0, eligibleLineCount - mappedLineCount);
  const presentLineIds = new Set(
    activeValues
      .map((value) => String(value.canonicalLineId || '').trim())
      .filter(Boolean)
  );
  const missingRequiredLineCount = canonicalStatementType
    ? getRequiredCanonicalLineIds(canonicalStatementType).filter((lineId) => !presentLineIds.has(lineId)).length
    : 0;
  const hardFailCount =
    validationMessages.filter((message) => message.type === 'error').length +
    (normalizedValidation === 'needs_review' || normalizedValidation === 'failed' ? 1 : 0);
  const warningCount = validationMessages.filter((message) => message.type === 'warning').length;

  const reasonCodes: string[] = [];
  const hasDuplicateWarnings = validationMessages.some(
    (message) => String(message.code || '').trim() === 'DUPLICATE_CANONICAL_LINES'
  );
  if (!['P&L', 'BS', 'CF'].includes(normalizedType)) reasonCodes.push('UNSUPPORTED_STATEMENT_TYPE');
  if (eligibleLineCount === 0) reasonCodes.push('NO_ELIGIBLE_FINANCIAL_LINES');
  if (!['imported', 'mapped', 'confirmed'].includes(normalizedStatus))
    reasonCodes.push('PIPELINE_NOT_ADVANCED');
  if (mappedLineCount === 0) reasonCodes.push('NO_MAPPED_LINES');
  if (unmappedLineCount > 0) reasonCodes.push('UNMAPPED_FINANCIAL_LINES');
  if (missingRequiredLineCount > 0) reasonCodes.push('MISSING_REQUIRED_CANONICAL_LINES');
  if (!normalizedCurrency || normalizedCurrency === 'UNKNOWN') reasonCodes.push('UNRESOLVED_CURRENCY');
  if (!normalizedScaling || normalizedScaling === 'unknown') reasonCodes.push('UNRESOLVED_SCALING');
  if (hasDuplicateWarnings) reasonCodes.push('DUPLICATE_MAPPING_CONFLICT');
  if (hardFailCount > 0) reasonCodes.push('VALIDATION_HARD_FAIL');

  const coverage = eligibleLineCount > 0 ? mappedLineCount / eligibleLineCount : 0;
  const readinessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        coverage * 70 +
          (hardFailCount === 0 ? 20 : 0) +
          (warningCount === 0 ? 10 : 5) -
          (reasonCodes.includes('PIPELINE_NOT_ADVANCED') ? 20 : 0) -
          missingRequiredLineCount * 6 -
          (reasonCodes.includes('DUPLICATE_MAPPING_CONFLICT') ? 10 : 0)
      )
    )
  );

  let readinessStatus: StatementReadinessStatus = 'pending';
  if (reasonCodes.includes('UNSUPPORTED_STATEMENT_TYPE') || reasonCodes.includes('NO_ELIGIBLE_FINANCIAL_LINES')) {
    readinessStatus = 'rejected';
  } else if (
    hardFailCount === 0 &&
    coverage === 1 &&
    mappedLineCount > 0 &&
    ['mapped', 'confirmed'].includes(normalizedStatus) &&
    ['pass', 'warnings'].includes(normalizedValidation) &&
    missingRequiredLineCount === 0 &&
    !reasonCodes.includes('UNRESOLVED_CURRENCY') &&
    !reasonCodes.includes('UNRESOLVED_SCALING') &&
    !reasonCodes.includes('DUPLICATE_MAPPING_CONFLICT')
  ) {
    readinessStatus = 'ready';
  } else if (mappedLineCount > 0 || warningCount > 0 || normalizedStatus === 'imported') {
    readinessStatus = 'recoverable';
  }

  const summary =
    readinessStatus === 'ready'
      ? 'Statement passed the readiness contract and is ready for downstream work.'
      : readinessStatus === 'recoverable'
        ? 'Statement contains recognized financial data but still needs recovery actions before downstream use.'
        : readinessStatus === 'rejected'
          ? 'Statement could not meet the minimum recognition contract and should stay outside the working set.'
          : 'Statement is still progressing through the ingestion pipeline.';

  return {
    readinessStatus,
    readinessScore,
    summary,
    reasonCodes,
    eligibleLineCount,
    mappedLineCount,
    unmappedLineCount,
    nonFinancialLineCount,
    hardFailCount,
    warningCount,
    isReady: readinessStatus === 'ready',
  };
}

export async function startStatementIngestRun(params: {
  statementId: string;
  organizationId: string;
  sourceFileName?: string | null;
  sourceFilePath?: string | null;
  parseMethod?: string | null;
  documentClass?: string | null;
  extractionStrategy?: string | null;
  templateFamily?: string | null;
  rawTextLength?: number | null;
  summary?: Record<string, unknown> | null;
  createdBy?: string | null;
}): Promise<string | null> {
  try {
    const id = uuidv4();
    await dbRun(
      `INSERT INTO financial_statement_ingest_runs
        (id, statement_id, organization_id, run_status, current_stage, source_file_name, source_file_path, parse_method,
         document_class, extraction_strategy, template_family, raw_text_length, summary_json, created_by)
       VALUES (?, ?, ?, 'running', 'upload', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.statementId,
        params.organizationId,
        params.sourceFileName || null,
        params.sourceFilePath || null,
        params.parseMethod || null,
        params.documentClass || null,
        params.extractionStrategy || null,
        params.templateFamily || null,
        params.rawTextLength ?? 0,
        params.summary ? JSON.stringify(params.summary) : null,
        params.createdBy || null,
      ],
      { fallback: false }
    );
    return id;
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    return null;
  }
}

export async function getLatestStatementIngestRun(statementId: string): Promise<string | null> {
  try {
    const row = await dbGet<{ id: string }>(
      `SELECT id
       FROM financial_statement_ingest_runs
       WHERE statement_id = ?
       ORDER BY started_at DESC
       LIMIT 1`,
      [statementId]
    );
    return String(row?.id || '').trim() || null;
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    return null;
  }
}

export async function updateStatementIngestRun(params: {
  ingestRunId?: string | null;
  currentStage?: string | null;
  runStatus?: 'running' | 'completed' | 'failed' | 'cancelled' | null;
  documentClass?: string | null;
  extractionStrategy?: string | null;
  templateFamily?: string | null;
  rawTextLength?: number | null;
  reasonCodes?: string[] | null;
  summary?: Record<string, unknown> | null;
}): Promise<void> {
  if (!params.ingestRunId) return;
  try {
    await dbRun(
      `UPDATE financial_statement_ingest_runs
       SET current_stage = COALESCE(?, current_stage),
           run_status = COALESCE(?, run_status),
           document_class = COALESCE(?, document_class),
           extraction_strategy = COALESCE(?, extraction_strategy),
           template_family = COALESCE(?, template_family),
           raw_text_length = COALESCE(?, raw_text_length),
           latest_reason_codes = COALESCE(?, latest_reason_codes),
           summary_json = COALESCE(?, summary_json),
           completed_at = CASE WHEN ? IN ('completed', 'failed', 'cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        params.currentStage || null,
        params.runStatus || null,
        params.documentClass || null,
        params.extractionStrategy || null,
        params.templateFamily || null,
        params.rawTextLength ?? null,
        params.reasonCodes ? JSON.stringify(params.reasonCodes) : null,
        params.summary ? JSON.stringify(params.summary) : null,
        params.runStatus || null,
        params.ingestRunId,
      ],
      { fallback: false }
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
  }
}

export async function recordStatementSourceArtifact(params: {
  statementId: string;
  ingestRunId?: string | null;
  artifactType: string;
  stage: string;
  contentText?: string | null;
  contentJson?: unknown;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
}): Promise<void> {
  try {
    const latestVersion =
      Number(
        (
          await dbGet<{ next_version: number }>(
            `SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version
             FROM financial_statement_source_artifacts
             WHERE statement_id = ? AND artifact_type = ? AND stage = ?`,
            [params.statementId, params.artifactType, params.stage]
          )
        )?.next_version || 1
      ) || 1;
    await dbRun(
      `INSERT INTO financial_statement_source_artifacts
        (id, statement_id, ingest_run_id, artifact_type, stage, version_no, content_text, content_json, metadata_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.statementId,
        params.ingestRunId || null,
        params.artifactType,
        params.stage,
        latestVersion,
        params.contentText || null,
        params.contentJson != null ? JSON.stringify(params.contentJson) : null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.createdBy || null,
      ],
      { fallback: false }
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
  }
}

export async function loadStatementSourceText(
  statementId: string,
  fallbackText?: string | null
): Promise<string> {
  try {
    const artifact = await dbGet<{ content_text?: string | null }>(
      `SELECT content_text
       FROM financial_statement_source_artifacts
       WHERE statement_id = ?
         AND artifact_type = 'raw_text'
       ORDER BY created_at DESC
       LIMIT 1`,
      [statementId]
    );
    const content = String(artifact?.content_text || '').trim();
    if (content) return content;
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
  }
  return String(fallbackText || '');
}

export async function persistStatementExtractedSections(params: {
  statementId: string;
  ingestRunId?: string | null;
  sections: StatementSectionRecord[];
}): Promise<Array<{ sectionId: string; sectionKey: string }>> {
  if (!Array.isArray(params.sections) || params.sections.length === 0) return [];
  try {
    if (params.ingestRunId) {
      await dbRun(`DELETE FROM financial_statement_extracted_sections WHERE ingest_run_id = ?`, [params.ingestRunId], {
        fallback: false,
      });
    }
    const created: Array<{ sectionId: string; sectionKey: string }> = [];
    for (const section of params.sections) {
      const sectionId = uuidv4();
      await dbRun(
        `INSERT INTO financial_statement_extracted_sections
          (id, statement_id, ingest_run_id, section_key, section_label, statement_type, source_page_start, source_page_end, line_start, line_end, confidence, text_excerpt, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sectionId,
          params.statementId,
          params.ingestRunId || null,
          section.sectionKey,
          section.sectionLabel,
          section.statementType,
          null,
          null,
          section.lineStart,
          section.lineEnd,
          section.confidence,
          section.text.slice(0, 4000),
          section.metadata ? JSON.stringify(section.metadata) : null,
        ],
        { fallback: false }
      );
      created.push({ sectionId, sectionKey: section.sectionKey });
    }
    return created;
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    return [];
  }
}

export async function persistStatementCandidateRows(params: {
  statementId: string;
  ingestRunId?: string | null;
  rows: ExtractedLine[];
  sectionIdsByKey?: Record<string, string>;
  statementType?: string | null;
  currency?: string | null;
  scaling?: string | null;
}): Promise<Array<{ candidateRowId: string; sourceRow?: number }>> {
  if (!Array.isArray(params.rows)) return [];
  try {
    if (params.ingestRunId) {
      await dbRun(`DELETE FROM financial_statement_candidate_rows WHERE ingest_run_id = ?`, [params.ingestRunId], {
        fallback: false,
      });
    }
    const created: Array<{ candidateRowId: string; sourceRow?: number }> = [];
    const sectionKey = `${String(params.statementType || '').trim().toUpperCase() || 'UNKNOWN'}_1`;
    for (const row of params.rows) {
      const candidateRowId = uuidv4();
      await dbRun(
        `INSERT INTO financial_statement_candidate_rows
          (id, statement_id, ingest_run_id, section_id, row_key, row_label, normalized_label, source_row, selected_period_label, raw_value, normalized_value, currency, scaling, confidence, classification_reason, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          candidateRowId,
          params.statementId,
          params.ingestRunId || null,
          params.sectionIdsByKey?.[sectionKey] || null,
          row.sourceRow != null ? `${params.statementId}:${row.sourceRow}` : uuidv4(),
          row.originalLabel,
          normalizeAliasText(row.originalLabel),
          row.sourceRow || null,
          row.selectedPeriodLabel || null,
          row.rawValue || null,
          Number.isFinite(row.value) ? row.value : null,
          params.currency || null,
          params.scaling || null,
          row.confidence,
          row.classificationReason || null,
          JSON.stringify({
            mappingReason: row.mappingReason || null,
            isNonFinancial: !!row.isNonFinancial,
          }),
        ],
        { fallback: false }
      );
      created.push({ candidateRowId, sourceRow: row.sourceRow });
    }
    return created;
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    return [];
  }
}

export async function persistStatementMappingCandidates(params: {
  statementId: string;
  ingestRunId?: string | null;
  rows: ExtractedLine[];
  candidateRowIdsBySourceRow?: Record<number, string>;
}): Promise<void> {
  if (!Array.isArray(params.rows)) return;
  try {
    if (params.ingestRunId) {
      await dbRun(`DELETE FROM financial_statement_mapping_candidates WHERE ingest_run_id = ?`, [params.ingestRunId], {
        fallback: false,
      });
    }
    for (const row of params.rows) {
      const candidates = Array.isArray(row.mappingCandidates) ? row.mappingCandidates : [];
      const candidateRowId =
        row.sourceRow != null ? params.candidateRowIdsBySourceRow?.[row.sourceRow] || null : null;
      for (const candidate of candidates) {
        await dbRun(
          `INSERT INTO financial_statement_mapping_candidates
            (id, statement_id, ingest_run_id, candidate_row_id, canonical_line_id, score, match_reason, is_selected, selected_by, metadata_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            params.statementId,
            params.ingestRunId || null,
            candidateRowId,
            candidate.canonicalLineId,
            candidate.score,
            candidate.reason,
            !!candidate.selected,
            candidate.selected ? 'system' : 'system_alt',
            JSON.stringify({
              sourceRow: row.sourceRow || null,
              originalLabel: row.originalLabel,
            }),
          ],
          { fallback: false }
        );
      }
    }
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
  }
}

export async function openStatementRepairSession(params: {
  statementId: string;
  organizationId: string;
  ingestRunId?: string | null;
  startedBy?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO financial_statement_repair_sessions
        (id, statement_id, organization_id, ingest_run_id, repair_status, summary, payload_json, started_by)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`,
      [
        uuidv4(),
        params.statementId,
        params.organizationId,
        params.ingestRunId || null,
        params.summary || null,
        params.payload ? JSON.stringify(params.payload) : null,
        params.startedBy || null,
      ],
      { fallback: false }
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
  }
}

export async function recordStatementQualityRun(params: {
  statementId: string;
  organizationId: string;
  stage: StatementQualityStage;
  resultStatus: StatementQualityResultStatus;
  readinessStatus?: StatementReadinessStatus;
  strategy?: string;
  summary?: string;
  reasonCodes?: string[];
  payload?: unknown;
  createdBy?: string;
}): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO financial_statement_quality_runs
        (id, statement_id, organization_id, stage, result_status, readiness_status, strategy, summary, reason_codes, payload_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.statementId,
        params.organizationId,
        params.stage,
        params.resultStatus,
        params.readinessStatus || null,
        params.strategy || null,
        params.summary || null,
        params.reasonCodes ? JSON.stringify(params.reasonCodes) : null,
        params.payload ? JSON.stringify(params.payload) : null,
        params.createdBy || null,
      ],
      { fallback: false }
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
  }
}

export async function persistStatementValidationLedger(params: {
  statementId: string;
  statementType: string;
  messages: ValidationMessage[];
  values: Array<{
    canonicalLineId: string | null;
    value: number;
    isNonFinancial?: boolean;
  }>;
}): Promise<void> {
  try {
    await dbRun(
      `DELETE FROM financial_statement_validations
       WHERE statement_id = ? AND validation_scope = 'statement'`,
      [params.statementId],
      { fallback: false }
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    return;
  }

  for (const message of params.messages || []) {
    await dbRun(
      `INSERT INTO financial_statement_validations
        (id, statement_id, validation_scope, check_code, check_name, severity, status, message, details_json)
       VALUES (?, ?, 'statement', ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.statementId,
        message.code,
        message.code.replace(/_/g, ' '),
        message.type,
        mapValidationMessageStatus(message.type),
        message.message,
        message.details ? JSON.stringify({ details: message.details }) : null,
      ],
      { fallback: false }
    );
  }

  const activeValues = (params.values || []).filter((value) => !value.isNonFinancial);
  const mappedCount = activeValues.filter((value) => value.canonicalLineId).length;
  const eligibleCount = activeValues.length;
  const coveragePct = eligibleCount > 0 ? mappedCount / eligibleCount : 0;
  const canonicalStatementType = toCanonicalStatementType(params.statementType);
  const presentLineIds = new Set(
    activeValues
      .map((value) => String(value.canonicalLineId || '').trim())
      .filter(Boolean)
  );
  const missingRequired = canonicalStatementType
    ? getRequiredCanonicalLineIds(canonicalStatementType).filter((lineId) => !presentLineIds.has(lineId))
    : [];

  await dbRun(
    `INSERT INTO financial_statement_validations
      (id, statement_id, validation_scope, check_code, check_name, severity, status, expected_value, actual_value, difference, tolerance, message, details_json)
     VALUES (?, ?, 'statement', 'MAPPING_COVERAGE', 'Mapping Coverage', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      params.statementId,
      coveragePct === 1 ? 'info' : 'warning',
      coveragePct === 1 ? 'pass' : 'warning',
      1,
      coveragePct,
      1 - coveragePct,
      0,
      `Mapping coverage is ${Math.round(coveragePct * 100)}%.`,
      JSON.stringify({ mappedCount, eligibleCount }),
    ],
    { fallback: false }
  );

  if (missingRequired.length > 0) {
    await dbRun(
      `INSERT INTO financial_statement_validations
        (id, statement_id, validation_scope, check_code, check_name, severity, status, expected_value, actual_value, difference, tolerance, message, details_json)
       VALUES (?, ?, 'statement', 'REQUIRED_LINE_COVERAGE', 'Required Line Coverage', 'warning', 'warning', ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.statementId,
        canonicalStatementType ? getRequiredCanonicalLineIds(canonicalStatementType).length : 0,
        (canonicalStatementType ? getRequiredCanonicalLineIds(canonicalStatementType).length : 0) - missingRequired.length,
        missingRequired.length,
        0,
        'Required canonical lines are missing from the statement.',
        JSON.stringify({
          missingLineIds: missingRequired,
          missingLineCodes: missingRequired
            .map((lineId) => getCanonicalLineById(lineId)?.code || lineId)
            .filter(Boolean),
        }),
      ],
      { fallback: false }
    );
  }
}

export async function persistStatementValueEvidence(
  evidences: Array<{
    statementValueId: string;
    candidateRowId?: string | null;
    evidenceType?: 'direct' | 'aggregated' | 'split' | 'derived' | 'manual_note';
    weight?: number;
    contributionValue?: number | null;
    explanation?: string | null;
  }>
): Promise<void> {
  if (!Array.isArray(evidences) || evidences.length === 0) return;
  for (const evidence of evidences) {
    await dbRun(
      `INSERT INTO financial_statement_value_evidence
        (id, statement_value_id, candidate_row_id, evidence_type, weight, contribution_value, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        evidence.statementValueId,
        evidence.candidateRowId || null,
        evidence.evidenceType || 'direct',
        evidence.weight ?? 1,
        evidence.contributionValue ?? null,
        evidence.explanation || null,
      ],
      { fallback: false }
    );
  }
}

export async function snapshotCanonicalStatementVersion(params: {
  statementId: string;
  versionKind: 'mapped' | 'validated' | 'confirmed' | 'repair';
  readinessStatus?: StatementReadinessStatus;
  values: unknown;
  validations?: unknown;
  createdBy?: string;
  summary?: string;
}): Promise<number> {
  try {
    const snapshotValues = Array.isArray(params.values)
      ? params.values.map((value: any) => {
          const canonical = getCanonicalLineById(String(value?.canonicalLineId || '').trim());
          return {
            ...value,
            lineCode: canonical?.code || null,
            lineName: canonical?.labelEn || null,
            lineNamePl: canonical?.labelPl || null,
            statementType: canonical?.statementType || null,
            aggregationLevel: canonical?.aggregationLevel ?? null,
            parentCanonicalLineId: canonical?.parentId || null,
            requiredLevel: canonical?.requiredLevel || null,
            signConvention: canonical?.signConvention || null,
            formulaJson: canonical?.formulaJson || null,
          };
        })
      : params.values || [];
    const nextVersion =
      Number(
        (
          await dbGet<{ next_version: number }>(
            `SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version
             FROM financial_statement_versions
             WHERE statement_id = ?`,
            [params.statementId]
          )
        )?.next_version || 1
      ) || 1;

    await dbRun(
      `INSERT INTO financial_statement_versions
        (id, statement_id, version_no, version_kind, readiness_status, snapshot_json, change_summary, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.statementId,
        nextVersion,
        params.versionKind,
        params.readinessStatus || null,
        JSON.stringify({
          values: snapshotValues,
          validations: params.validations || [],
        }),
        params.summary || null,
        params.createdBy || null,
      ],
      { fallback: false }
    );

    await dbRun(
      `UPDATE financial_statements
       SET values_version = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextVersion, params.statementId],
      { fallback: false }
    );

    return nextVersion;
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    return 0;
  }
}

export async function loadLatestStatementVersionSnapshot(
  statementId: string
): Promise<{ versionNo: number; snapshot: any } | null> {
  try {
    const row = await dbGet<{ version_no?: number; snapshot_json?: string }>(
      `SELECT version_no, snapshot_json
       FROM financial_statement_versions
       WHERE statement_id = ?
       ORDER BY version_no DESC
       LIMIT 1`,
      [statementId]
    );
    if (!row?.snapshot_json) return null;
    return {
      versionNo: Number(row.version_no || 0),
      snapshot: JSON.parse(String(row.snapshot_json || '{}')),
    };
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    return null;
  }
}

export async function snapshotStatementValueVersion(params: {
  statementId: string;
  sourceStage: string;
  values: unknown;
  createdBy?: string;
}): Promise<number> {
  try {
    const nextVersion =
      Number(
        (
          await dbGet<{ next_version: number }>(
            `SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version
             FROM financial_statement_value_versions
             WHERE statement_id = ?`,
            [params.statementId]
          )
        )?.next_version || 1
      ) || 1;

    await dbRun(
      `INSERT INTO financial_statement_value_versions
        (id, statement_id, version_no, source_stage, values_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.statementId,
        nextVersion,
        params.sourceStage,
        JSON.stringify(params.values || []),
        params.createdBy || null,
      ],
      { fallback: false }
    );

    await dbRun(
      `UPDATE financial_statements
       SET values_version = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextVersion, params.statementId],
      { fallback: false }
    );

    return nextVersion;
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    return 0;
  }
}

export async function updateStatementMetadata(
  statementId: string,
  patch: {
    statementType?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    periodLabel?: string | null;
    currency?: string | null;
    scaling?: string | null;
    overallConfidence?: number | null;
    documentClass?: StatementDocumentClass | null;
    extractionStrategy?: string | null;
    templateFamily?: string | null;
  }
): Promise<void> {
  try {
    await dbRun(
      `UPDATE financial_statements
       SET statement_type = COALESCE(?, statement_type),
           period_start = COALESCE(?, period_start),
           period_end = COALESCE(?, period_end),
           period_label = COALESCE(?, period_label),
           currency = COALESCE(?, currency),
           scaling = COALESCE(?, scaling),
           overall_confidence = COALESCE(?, overall_confidence),
           document_class = COALESCE(?, document_class),
           extraction_strategy = COALESCE(?, extraction_strategy),
           template_family = COALESCE(?, template_family),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        patch.statementType || null,
        patch.periodStart || null,
        patch.periodEnd || null,
        patch.periodLabel || null,
        patch.currency || null,
        patch.scaling || null,
        patch.overallConfidence ?? null,
        patch.documentClass || null,
        patch.extractionStrategy || null,
        patch.templateFamily || null,
        statementId,
      ],
      { fallback: false }
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    await dbRun(
      `UPDATE financial_statements
       SET statement_type = COALESCE(?, statement_type),
           period_start = COALESCE(?, period_start),
           period_end = COALESCE(?, period_end),
           period_label = COALESCE(?, period_label),
           currency = COALESCE(?, currency),
           scaling = COALESCE(?, scaling),
           overall_confidence = COALESCE(?, overall_confidence),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        patch.statementType || null,
        patch.periodStart || null,
        patch.periodEnd || null,
        patch.periodLabel || null,
        patch.currency || null,
        patch.scaling || null,
        patch.overallConfidence ?? null,
        statementId,
      ],
      { fallback: false }
    );
  }
}

export async function updateStatementReadinessState(
  statementId: string,
  evaluation: StatementReadinessEvaluation
): Promise<void> {
  try {
    await dbRun(
      `UPDATE financial_statements
       SET readiness_status = ?,
           readiness_score = ?,
           quality_summary = ?,
           quality_reason_codes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        evaluation.readinessStatus,
        evaluation.readinessScore,
        evaluation.summary,
        JSON.stringify(evaluation.reasonCodes),
        statementId,
      ],
      { fallback: false }
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
  }
}

export async function learnStatementAliases(params: {
  organizationId: string;
  statementType: string;
  templateFamily?: string | null;
  values: Array<{ canonicalLineId: string | null; originalLabel: string }>;
  createdBy?: string;
}): Promise<void> {
  const normalizedStatementType = String(params.statementType || '').trim().toUpperCase();
  const templateFamily = String(params.templateFamily || '').trim();
  for (const value of params.values || []) {
    const canonicalLineId = String(value.canonicalLineId || '').trim();
    const aliasText = String(value.originalLabel || '').trim();
    const normalizedAlias = normalizeAliasText(aliasText);
    if (!canonicalLineId || !normalizedAlias) continue;
    try {
      await dbRun(
        `INSERT INTO financial_statement_line_aliases
          (id, organization_id, statement_line_id, statement_type, alias_text, normalized_alias, template_family, source, usage_count, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'learned', 1, ?)
         ON CONFLICT (organization_id, statement_line_id, normalized_alias, template_family)
         DO UPDATE SET
           alias_text = EXCLUDED.alias_text,
           usage_count = financial_statement_line_aliases.usage_count + 1,
           updated_at = CURRENT_TIMESTAMP`,
        [
          uuidv4(),
          params.organizationId || '',
          canonicalLineId,
          normalizedStatementType,
          aliasText,
          normalizedAlias,
          templateFamily,
          params.createdBy || null,
        ],
        { fallback: false }
      );
    } catch (error) {
      if (!isSchemaCompatError(error)) throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function createStatement(params: {
  organizationId: string;
  statementType: string;
  periodStart: string;
  periodEnd: string;
  periodLabel?: string;
  currency?: string;
  scaling?: string;
  sourceFileName?: string;
  sourceFilePath?: string;
  parseMethod?: string;
  overallConfidence?: number;
  documentClass?: StatementDocumentClass;
  extractionStrategy?: string;
  templateFamily?: string | null;
  createdBy: string;
}): Promise<string> {
  const id = uuidv4();
  let insertRes;
  try {
    insertRes = await dbRun(
      `INSERT INTO financial_statements (id, organization_id, statement_type, period_start, period_end, period_label, currency, scaling, source_file_name, source_file_path, parse_method, overall_confidence, document_class, extraction_strategy, template_family, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.organizationId,
        params.statementType,
        params.periodStart,
        params.periodEnd,
        params.periodLabel || null,
        params.currency || 'PLN',
        params.scaling || 'units',
        params.sourceFileName || null,
        params.sourceFilePath || null,
        params.parseMethod || 'text_extraction',
        params.overallConfidence || 0,
        params.documentClass || 'unknown',
        params.extractionStrategy || null,
        params.templateFamily || null,
        params.createdBy,
      ],
      { fallback: false }
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    insertRes = await dbRun(
      `INSERT INTO financial_statements (id, organization_id, statement_type, period_start, period_end, period_label, currency, scaling, source_file_name, source_file_path, parse_method, overall_confidence, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.organizationId,
        params.statementType,
        params.periodStart,
        params.periodEnd,
        params.periodLabel || null,
        params.currency || 'PLN',
        params.scaling || 'units',
        params.sourceFileName || null,
        params.sourceFilePath || null,
        params.parseMethod || 'text_extraction',
        params.overallConfidence || 0,
        params.createdBy,
      ],
      { fallback: false }
    );
  }
  if (!insertRes?.success) {
    throw new Error(`DB insert failed (financial_statements): ${insertRes?.error || 'unknown'}`);
  }
  return id;
}

export async function saveStatementValues(
  statementId: string,
  values: Array<{
    canonicalLineId: string | null;
    originalLabel: string;
    value: number;
    confidence: number;
    sourcePage?: number | null;
    sourceRow?: number;
    mappingStatus?: string;
    isNonFinancial?: boolean;
    classificationReason?: string;
    valueOrigin?: 'source' | 'mapped' | 'manual' | 'computed' | 'estimated';
    mappingConfidence?: number;
    sourceCandidateRowId?: string | null;
    selectedMappingCandidateId?: string | null;
    periodGranularity?: string | null;
    periodLabel?: string | null;
    periodIndex?: number | null;
    lineageType?: 'direct' | 'aggregated' | 'split' | 'derived' | 'manual_note';
    derivedFromLineCodes?: string[] | null;
    evidenceJson?: Record<string, unknown> | null;
    manualOverrideReason?: string | null;
  }>
): Promise<Array<{ id: string; sourceCandidateRowId?: string | null; value: number; originalLabel: string }>> {
  const insertedRows: Array<{
    id: string;
    sourceCandidateRowId?: string | null;
    value: number;
    originalLabel: string;
  }> = [];
  for (const v of values) {
    let r;
    const rowId = uuidv4();
    try {
      r = await dbRun(
        `INSERT INTO financial_statement_values
          (id, statement_id, canonical_line_id, original_label, value, confidence, source_page, source_row,
           mapping_status, is_non_financial, classification_reason, value_origin, mapping_confidence,
           source_candidate_row_id, selected_mapping_candidate_id, period_granularity, evidence_json, notes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          rowId,
          statementId,
          v.canonicalLineId || null,
          v.originalLabel,
          v.value,
          v.confidence,
          v.sourcePage ?? null,
          v.sourceRow || null,
          v.mappingStatus || 'auto',
          !!v.isNonFinancial,
          v.classificationReason || null,
          v.valueOrigin || 'source',
          v.mappingConfidence ?? v.confidence ?? 0,
          v.sourceCandidateRowId || null,
          v.selectedMappingCandidateId || null,
          v.periodGranularity || null,
          v.evidenceJson ? JSON.stringify(v.evidenceJson) : null,
          v.manualOverrideReason || null,
        ],
        { fallback: false }
      );
    } catch (error) {
      if (!isSchemaCompatError(error)) throw error;
      r = await dbRun(
        `INSERT INTO financial_statement_values (id, statement_id, canonical_line_id, original_label, value, confidence, source_row, mapping_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rowId,
          statementId,
          v.canonicalLineId || null,
          v.originalLabel,
          v.value,
          v.confidence,
          v.sourceRow || null,
          v.mappingStatus || 'auto',
        ],
        { fallback: false }
      );
    }
    if (!r?.success) {
      throw new Error(`DB insert failed (financial_statement_values): ${r?.error || 'unknown'}`);
    }
    insertedRows.push({
      id: rowId,
      sourceCandidateRowId: v.sourceCandidateRowId || null,
      value: v.value,
      originalLabel: v.originalLabel,
    });
  }
  return insertedRows;
}

export async function updateStatementStatus(
  statementId: string,
  status: string,
  validationStatus?: string,
  validationMessages?: ValidationMessage[]
): Promise<void> {
  const r = await dbRun(
    `UPDATE financial_statements SET status = ?, validation_status = COALESCE(?, validation_status), validation_messages = COALESCE(?, validation_messages), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [
      status,
      validationStatus || null,
      validationMessages ? JSON.stringify(validationMessages) : null,
      statementId,
    ],
    { fallback: false }
  );
  if (!r?.success) {
    throw new Error(`DB update failed (financial_statements.status): ${r?.error || 'unknown'}`);
  }
}

export async function confirmStatement(
  statementId: string,
  userId: string,
  evaluation?: StatementReadinessEvaluation
): Promise<void> {
  let r;
  try {
    r = await dbRun(
      `UPDATE financial_statements
       SET status = 'confirmed',
           confirmed_by = ?,
           confirmed_at = CURRENT_TIMESTAMP,
           readiness_status = COALESCE(?, readiness_status),
           readiness_score = COALESCE(?, readiness_score),
           quality_summary = COALESCE(?, quality_summary),
           quality_reason_codes = COALESCE(?, quality_reason_codes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        userId,
        evaluation?.readinessStatus || null,
        evaluation?.readinessScore ?? null,
        evaluation?.summary || null,
        evaluation?.reasonCodes ? JSON.stringify(evaluation.reasonCodes) : null,
        statementId,
      ],
      { fallback: false }
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    r = await dbRun(
      `UPDATE financial_statements
       SET status = 'confirmed',
           confirmed_by = ?,
           confirmed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId, statementId],
      { fallback: false }
    );
  }
  if (!r?.success) {
    throw new Error(`DB update failed (financial_statements.confirm): ${r?.error || 'unknown'}`);
  }
}

logger.info('[FinancialStatementService] Loaded');
