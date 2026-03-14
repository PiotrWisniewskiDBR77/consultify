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
  containedStatementTypes?: Array<'P&L' | 'BS' | 'CF'>;
  containsMultipleStatements?: boolean;
}

export interface ExtractedLine {
  originalLabel: string;
  value: number;
  confidence: number;
  sourcePage?: number;
  sourceRow?: number;
  sectionKey?: string;
  rawValue?: string;
  selectedPeriodLabel?: string;
  comparisonPeriodLabel?: string;
  rowType?: 'detail' | 'subtotal' | 'total' | 'header' | 'nonFinancial';
  hierarchyDepth?: number;
  signMode?: 'positive' | 'negative' | 'mixed' | 'unknown';
  numericTokens?: Array<{
    raw: string;
    normalizedValue: number | null;
    index: number;
    tokenType: 'period' | 'value' | 'note_ref';
    periodLabel?: string;
  }>;
  selectedNumericToken?: {
    raw: string;
    normalizedValue: number | null;
    index: number;
    selectionReason: string;
  };
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

export interface StatementPeriodColumn {
  label: string;
  normalizedLabel: string;
  kind: 'year' | 'quarter';
  year: number | null;
  quarter: string | null;
  order: number;
}

export interface StatementColumnSelection {
  selectedPeriodLabel: string | null;
  comparisonPeriodLabel: string | null;
  selectionStrategy: string;
  periodGrid: StatementPeriodColumn[];
  selectedPeriodIndex: number | null;
  comparisonPeriodIndex: number | null;
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

function normalizeStatementTypeToken(value: unknown): string {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (normalized === 'PL') return 'P&L';
  return normalized;
}

function toCanonicalStatementType(value: unknown): CanonicalStatementType | null {
  const normalized = normalizeStatementTypeToken(value);
  if (normalized === 'P&L' || normalized === 'BS' || normalized === 'CF') {
    return normalized;
  }
  return null;
}

function isStatementTypeConstraintError(error: unknown): boolean {
  const message = String((error as Error)?.message || error || '').toLowerCase();
  return (
    message.includes('statement_type_check') ||
    message.includes('financial_statements_statement_type_check') ||
    (message.includes('violates check constraint') && message.includes('statement'))
  );
}

async function runStatementTypeAwareWrite(
  sql: string,
  params: unknown[],
  statementTypeIndexes: number[]
): Promise<any> {
  const normalizedParams = [...params];
  for (const index of statementTypeIndexes) {
    normalizedParams[index] = normalizeStatementTypeToken(normalizedParams[index]);
  }
  try {
    return await dbRun(sql, normalizedParams, { fallback: false });
  } catch (error) {
    const needsLegacyFallback =
      isStatementTypeConstraintError(error) &&
      statementTypeIndexes.some((index) => normalizeStatementTypeToken(normalizedParams[index]) === 'P&L');
    if (!needsLegacyFallback) throw error;
    const legacyParams = [...normalizedParams];
    for (const index of statementTypeIndexes) {
      if (normalizeStatementTypeToken(legacyParams[index]) === 'P&L') {
        legacyParams[index] = 'PL';
      }
    }
    return await dbRun(sql, legacyParams, { fallback: false });
  }
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
  const containedStatementTypes = detectContainedStatementTypes(text);

  return {
    statementType,
    confidence: Math.round(confidence * 100) / 100,
    periodStart,
    periodEnd,
    periodLabel,
    currency,
    scaling,
    language,
    containedStatementTypes,
    containsMultipleStatements: containedStatementTypes.length > 1,
  };
}

export function detectContainedStatementTypes(text: string): Array<'P&L' | 'BS' | 'CF'> {
  const lower = String(text || '').toLowerCase();
  const scores: Record<'P&L' | 'BS' | 'CF', number> = { 'P&L': 0, BS: 0, CF: 0 };
  for (const [type, patterns] of Object.entries(TYPE_KEYWORDS) as Array<
    ['P&L' | 'BS' | 'CF', Array<{ keywords: string[]; weight: number }>]
  >) {
    for (const { keywords, weight } of patterns) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          scores[type] += weight;
          break;
        }
      }
    }
  }

  return (Object.entries(scores) as Array<['P&L' | 'BS' | 'CF', number]>)
    .filter(([, score]) => score >= 8)
    .sort((left, right) => right[1] - left[1])
    .map(([type]) => type);
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
  const headerArea = text.substring(0, 4000);

  const periodEndMatch = headerArea.match(
    /(?:okres objęty|za okres|do)\s+.*?(31\.12\.(20\d{2})|31\/(12)\/(20\d{2}))/i
  );
  if (periodEndMatch) {
    const year = periodEndMatch[2] || periodEndMatch[4] || '';
    if (/^20\d{2}$/.test(year)) {
      return { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, periodLabel: year };
    }
  }

  const reportCodeMatch = headerArea.match(/\b[RQ]S?[-‐]\s*(20\d{2})\b/i);
  if (reportCodeMatch) {
    const year = reportCodeMatch[1];
    return { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, periodLabel: year };
  }

  const yearEndedMatches = [
    ...headerArea.matchAll(
      /(?:for the (?:year|period) ended|za rok(?: obrotowy)?)\s+(\d{4}(?:[.\-/]\d{1,2}[.\-/]\d{1,2})?)/gi
    ),
  ];
  if (yearEndedMatches.length > 0) {
    const years = yearEndedMatches
      .map((m) => String(m[1] || '').slice(0, 4))
      .filter((y) => /^20\d{2}$/.test(y))
      .map(Number);
    if (years.length > 0) {
      const latest = Math.max(...years);
      return {
        periodStart: `${latest}-01-01`,
        periodEnd: `${latest}-12-31`,
        periodLabel: String(latest),
      };
    }
  }

  const allYears = [...headerArea.matchAll(/\b(20[1-3]\d)\b/g)].map((m) => parseInt(m[1]));
  if (allYears.length >= 1) {
    const latest = Math.max(...allYears);
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

function normalizePeriodLabel(label: string): string {
  return String(label || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function isYearInReportingContext(text: string, matchIndex: number): boolean {
  const windowStart = Math.max(0, matchIndex - 60);
  const windowEnd = Math.min(text.length, matchIndex + 30);
  const context = text.slice(windowStart, windowEnd).toLowerCase();
  if (/\b(?:od|do|za|okres|na dzień|rok|31\.12|01\.01|fy|period|quarter)\b/.test(context)) return true;
  if (/\b(?:r-|rs-|raport|sprawozdanie)\b/.test(context)) return true;
  if (/\d{2}\.\d{2}\.\d{4}/.test(context)) return true;
  return false;
}

function extractPeriodGrid(text: string): StatementPeriodColumn[] {
  const headerLines = String(text || '').split(/\r?\n/).slice(0, 120);
  const headerWindow = headerLines.join(' ');
  const seen = new Set<string>();
  const periodColumns: StatementPeriodColumn[] = [];

  for (const match of headerWindow.matchAll(/\b(Q[1-4]|I|II|III|IV)\s*[-\/]?\s*(20\d{2})\b/gi)) {
    const quarter = String(match[1] || '').toUpperCase();
    const year = Number(match[2] || 0);
    const label = String(match[0] || '').replace(/\s+/g, ' ').trim();
    const normalizedLabel = normalizePeriodLabel(label);
    if (seen.has(normalizedLabel)) continue;
    seen.add(normalizedLabel);
    periodColumns.push({
      label,
      normalizedLabel,
      kind: 'quarter',
      year: Number.isFinite(year) ? year : null,
      quarter,
      order: periodColumns.length,
    });
  }

  const yearCandidates: Array<{ label: string; index: number; inContext: boolean }> = [];
  for (const match of headerWindow.matchAll(/\b(20\d{2})\b/g)) {
    const label = String(match[1] || '').trim();
    if (seen.has(normalizePeriodLabel(label))) continue;
    const yearNum = Number(label);
    if (yearNum < 2015 || yearNum > 2035) continue;
    yearCandidates.push({
      label,
      index: match.index ?? 0,
      inContext: isYearInReportingContext(headerWindow, match.index ?? 0),
    });
  }

  const contextYears = yearCandidates.filter((c) => c.inContext);
  const effectiveYears =
    contextYears.length > 0
      ? contextYears
      : yearCandidates;

  const dedupedYears = new Map<string, (typeof effectiveYears)[0]>();
  for (const c of effectiveYears) {
    if (!dedupedYears.has(c.label)) dedupedYears.set(c.label, c);
  }

  for (const [, c] of dedupedYears) {
    const normalizedLabel = normalizePeriodLabel(c.label);
    if (seen.has(normalizedLabel)) continue;
    seen.add(normalizedLabel);
    periodColumns.push({
      label: c.label,
      normalizedLabel,
      kind: 'year',
      year: Number(c.label),
      quarter: null,
      order: periodColumns.length,
    });
  }

  return periodColumns;
}

export function resolveStatementColumnSelection(
  text: string,
  detection?: Partial<DetectionResult>
): StatementColumnSelection {
  const periodGrid = extractPeriodGrid(text);
  const detectedPeriodLabel = String(detection?.periodLabel || '').trim();
  const normalizedDetectedPeriodLabel = normalizePeriodLabel(detectedPeriodLabel);
  const explicitMatch =
    normalizedDetectedPeriodLabel.length > 0
      ? periodGrid.find((period) => period.normalizedLabel === normalizedDetectedPeriodLabel) || null
      : null;
  const selected = explicitMatch || periodGrid[0] || null;
  const comparison =
    periodGrid.find((period) => period.normalizedLabel !== selected?.normalizedLabel) || null;

  return {
    selectedPeriodLabel: selected?.label || detectedPeriodLabel || null,
    comparisonPeriodLabel: comparison?.label || null,
    selectionStrategy: detectedPeriodLabel
      ? 'detected_period_fallback'
      : periodGrid[0]
        ? periodGrid[0].kind === 'quarter'
          ? 'header_period_primary'
          : 'header_year_fallback'
        : 'no_period_detected',
    periodGrid,
    selectedPeriodIndex: selected?.order ?? null,
    comparisonPeriodIndex: comparison?.order ?? null,
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
    .replace(/\s*[-–—]+\s*$/, '')
    .replace(/\s*\d{1,2}\.\d{1,3}\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function locateStatementSections(
  text: string,
  statementType: string
): StatementSectionRecord[] {
  const normalizedType = normalizeStatementTypeToken(statementType);
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
        /sprawozdanie z zysków lub strat/i,
        /sprawozdanie z całkowitych dochodów/i,
        /statement of profit or loss/i,
        /cash flow/i,
        /rachunek przepływów pieniężnych/i,
        /sprawozdanie z przepływów pieniężnych/i,
        /zestawienie zmian w kapitale/i,
        /sprawozdanie ze zmian w kapitale/i,
      ],
    },
    'P&L': {
      start: [
        /rachunek zysków i strat/i,
        /sprawozdanie z zysków lub strat/i,
        /sprawozdanie z całkowitych dochodów/i,
        /statement of profit or loss/i,
        /\bprofit and loss\b/i,
      ],
      end: [
        /cash flow/i,
        /rachunek przepływów pieniężnych/i,
        /sprawozdanie z przepływów pieniężnych/i,
        /zestawienie zmian w kapitale/i,
        /sprawozdanie ze zmian w kapitale/i,
        /\bbilans\b/i,
        /sprawozdanie z sytuacji finansowej/i,
      ],
    },
    CF: {
      start: [
        /^(?:3\.\d\.?\s*)?(?:jednostkowe |skonsolidowane )?sprawozdanie z przepływów pieniężnych/i,
        /^(?:3\.\d\.?\s*)?rachunek przepływów pieniężnych/i,
        /^przepływy środków pieniężnych z działalności/i,
        /^(?:statement of )?cash flows?\b/i,
      ],
      end: [
        /zestawienie zmian w kapitale/i,
        /sprawozdanie ze zmian w kapitale/i,
        /\bnotes\b/i,
        /\binformacje dodatkowe\b/i,
        /\bobjaśnienia\b/i,
        /\bnoty objaśniające\b/i,
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

  const isStandardsRefLine = (line: string): boolean =>
    /\b(?:MSR|MSSF|IAS|IFRS|MSR\s*\d|MSSF\s*\d)\b/.test(line) ||
    /\b(?:zmiany do|amendments to)\b/i.test(line);

  for (let index = 0; index < rawLines.length; index++) {
    const line = rawLines[index];
    if (!markers.start.some((pattern) => pattern.test(line))) continue;
    if (isStandardsRefLine(line)) continue;

    const start = Math.max(0, index - 4);
    let end = Math.min(rawLines.length, index + 220);
    for (let cursor = index + 8; cursor < Math.min(rawLines.length, index + 260); cursor++) {
      if (markers.end.some((pattern) => pattern.test(rawLines[cursor]))) {
        end = cursor;
        break;
      }
    }

    const windowLines = rawLines.slice(start, end);
    const windowText = windowLines.join('\n').toLowerCase();
    const tocLines = windowLines.filter((candidate) =>
      /\.{4,}/.test(candidate) || /\.\s*\d{1,3}\s*$/.test(candidate.trim())
    ).length;
    const numericLines = windowLines.filter((candidate) => {
      const matches = candidate.match(numericGroupRegex) || [];
      return matches.length >= 2;
    }).length;
    const semanticLines = windowLines.filter((candidate) =>
      /(aktywa|pasywa|kapitał|equity|liabilities|assets|cash|należności|zobowiązania|revenue|przychody|profit|ebitda|flow|zysk|koszt|amortyzacja|depreciation|przepływy)/i.test(
        candidate
      )
    ).length;
    const tocPenalty = tocLines > 5 ? tocLines * 3 : 0;

    const statementAnchors: Record<string, RegExp[]> = {
      'P&L': [
        /przychody ze sprzedaży|revenue|sales/,
        /koszt własny|cost of goods|cogs/,
        /zysk brutto|gross profit/,
        /zysk.*operacyjn|operating profit|ebit\b/,
        /zysk netto|net (?:income|profit)/,
        /podatek dochodowy|income tax/,
      ],
      BS: [
        /aktywa razem|total assets/,
        /pasywa razem|total liabilities/,
        /aktywa trwałe|non.?current assets/,
        /aktywa obrotowe|current assets/,
        /kapitał własny|equity/,
      ],
      CF: [
        /środki pieniężne.*(?:netto|wygenerowane).*operacyjn|operating cash/,
        /środki pieniężne.*(?:netto|wykorzystane).*inwestycyjn|investing cash/,
        /środki pieniężne.*(?:netto|wykorzystane).*finansow|financing cash/,
      ],
    };
    const anchors = statementAnchors[normalizedType] || [];
    const anchorHits = anchors.filter((anchor) => anchor.test(windowText)).length;
    const anchorRatio = anchors.length > 0 ? anchorHits / anchors.length : 0;
    const anchorBonus = anchorRatio >= 0.6
      ? Math.round(anchorRatio * 200)
      : Math.round(anchorRatio * 80);

    const isNumberedStatementSection = /^3\.\d/.test(line.trim());
    const isNoteSection = /^(?:4|5|6|7|8|9)\.\d/.test(line.trim());
    const statementSectionBonus = isNumberedStatementSection ? 60 : 0;
    const notesSectionPenalty = isNoteSection ? 50 : 0;

    candidateWindows.push({
      start,
      end,
      score: numericLines * 2 + semanticLines - tocPenalty + anchorBonus + statementSectionBonus - notesSectionPenalty,
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
  if (normalized.length < 4) return { isNonFinancial: true, reason: 'FRAGMENT_TOO_SHORT' };
  if (
    /(sytuacja|sytuacji|szczegóły|w związku|na dzień publikacji|see note|refer to note|objaśnienia|komentarz|commentary|stanowiącymi|integralną część|należy analizować łącznie)/.test(
      normalized
    )
  ) {
    return { isNonFinancial: true, reason: 'NARRATIVE_NOTE_LINE' };
  }
  if (/(roczne (?:jednostkowe|skonsolidowane)|raport finansowy|nazwa jednostki|nazwa grupy)/.test(normalized)) {
    return { isNonFinancial: true, reason: 'PAGE_HEADER_LINE' };
  }
  if (normalized.split(' ').length > 14) {
    return { isNonFinancial: true, reason: 'LONG_SENTENCE_LINE' };
  }
  return { isNonFinancial: false };
}

export function extractFinancialLines(
  text: string,
  detectedType: string,
  options?: {
    templateFamily?: string | null;
    selectedPeriodLabel?: string | null;
    comparisonPeriodLabel?: string | null;
  }
): ExtractionResult {
  const lines: ExtractedLine[] = [];
  const warnings: string[] = [];
  const { scopedText, lineOffset, sections } = extractRelevantStatementSection(text, detectedType);
  const columnSelection = resolveStatementColumnSelection(scopedText, {
    periodLabel: options?.selectedPeriodLabel || undefined,
  });
  const targetPeriodLabel =
    String(options?.selectedPeriodLabel || columnSelection.selectedPeriodLabel || '').trim() || null;
  const comparisonPeriodLabel =
    String(options?.comparisonPeriodLabel || columnSelection.comparisonPeriodLabel || '').trim() || null;
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
    /^roczne (?:jednostkowe|skonsolidowane) sprawozdanie/i,
    /^spis treści/i,
    /^nota\b/i,
    /^note\b/i,
    /^nazwa (?:jednostki|grupy)/i,
    /^wyszczególnienie\s*$/i,
    /^za\s+okres\s*$/i,
    /^od\s+\d{2}\.\d{2}\.\d{4}/i,
    /^do\s+\d{2}\.\d{2}\.\d{4}/i,
    /^\(przekształcone/i,
    /^zgodnie z notą/i,
    /^korekty:\s*$/i,
    /^korekty\s+\d/i,
    /^kapitałach\s/i,
    /^przepływy środków pieniężnych z działalności (?:operacyjnej|inwestycyjnej|finansowej)\s+(?:zysk|strata)/i,
    /^przepływy środków pieniężnych z działalności inwestycyjnej\s+[-–—]?\s*wydatki/i,
    /^środki pieniężne (?:z działalności operacyjnej przed|wygenerowane w toku|netto z)/i,
  ];

  const isNoiseLine = (line: string): boolean =>
    noisePatterns.some((pattern) => pattern.test(line)) ||
    /\b\d{2}\.\d{2}\.\d{4}\b.*\b\d{2}\.\d{2}\.\d{4}\b/.test(line) ||
    /^[-–—]\s+\w/.test(line) ||
    /^[▪•●◆■]\s+/.test(line) ||
    /^[−]\s+/.test(line) ||
    /^(?:w tym|w tym:)\s*$/i.test(line.trim()) ||
    /^(?:z tego|z tego:)\s*$/i.test(line.trim()) ||
    /^akcjonariuszom\s+spółki/i.test(line.trim()) ||
    /^finansowych\s*$/i.test(line.trim()) ||
    /^kapitałach\s*$/i.test(line.trim()) ||
    /^operacyjnej\s*$/i.test(line.trim()) ||
    /^przychody\s*$/i.test(line.trim()) ||
    /^koszty\s*$/i.test(line.trim()) ||
    /^utrata\s+kontroli\s+nad\s+jednostką/i.test(line.trim()) ||
    /środki\s+pieniężne\s+na\s+dzień\s+utraty\s+kontroli/i.test(line.trim()) ||
    / - - /.test(line.trim()) ||
    /^zależną\s*\(/i.test(line.trim()) ||
    /,\s*z\s+tego\s+przypadając[aey]?\s*:/i.test(line.trim());

  const isLikelyLabelOnlyLine = (line: string): boolean => {
    if (isNoiseLine(line)) return false;
    if (!/[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]/.test(line)) return false;
    if (/\d/.test(line)) return false;
    return line.length >= 3 && line.length <= 140;
  };

  const seen = new Set<string>();
  const baseNumericTokenRegex = /\(?-?\d[\d.,]*\)?/g;
  const extractNumericSpans = (lineValue: string): Array<{ raw: string; index: number }> => {
    const baseTokens = Array.from(lineValue.matchAll(baseNumericTokenRegex))
      .map((match) => ({
        raw: String(match[0] || ''),
        index: match.index ?? -1,
      }))
      .filter((token) => token.index >= 0);

    const merged: Array<{ raw: string; index: number; initialGroupLen?: number }> = [];
    for (const token of baseTokens) {
      const previous = merged[merged.length - 1];
      const gap = previous ? lineValue.slice(previous.index + previous.raw.length, token.index) : '';
      const previousDigits = previous ? previous.raw.replace(/[^\d]/g, '') : '';
      const currentDigits = token.raw.replace(/[^\d]/g, '');
      const initialGroup = previous?.initialGroupLen ?? previousDigits.length;
      const isFirstMerge = previousDigits.length >= 1 && previousDigits.length <= 3;
      const isContinuedMerge = initialGroup >= 1 && initialGroup <= 2 && previousDigits.length > 3;
      const mergedDigitCount = previousDigits.length + currentDigits.length;
      const canMergeThousands =
        !!previous &&
        /^\s+$/.test(gap) &&
        (isFirstMerge || isContinuedMerge) &&
        mergedDigitCount <= 7 &&
        currentDigits.length === 3 &&
        !/^20\d{2}$/.test(previousDigits) &&
        !/^20\d{2}$/.test(currentDigits) &&
        !/[.,]/.test(previous.raw) &&
        !/[.,]/.test(token.raw);
      if (canMergeThousands) {
        if (!previous.initialGroupLen) previous.initialGroupLen = previousDigits.length;
        previous.raw = `${previous.raw}${gap}${token.raw}`;
        continue;
      }
      merged.push({ ...token });
    }

    return merged;
  };
  const isLikelyNoteRef = (raw: string): boolean => {
    if (!/^\d{1,2}\.\d{1,3}$/.test(raw)) return false;
    const val = parseFloat(raw);
    return Number.isFinite(val) && val >= 1 && val < 100;
  };

  const normalizeNumericToken = (
    raw: string,
    index: number
  ): {
    raw: string;
    normalizedValue: number | null;
    index: number;
    tokenType: 'period' | 'value' | 'note_ref';
    periodLabel?: string;
  } => {
    const cleaned = String(raw || '').trim();
    if (/^20\d{2}$/.test(cleaned)) {
      return {
        raw: cleaned,
        normalizedValue: null,
        index,
        tokenType: 'period',
        periodLabel: cleaned,
      };
    }
    if (isLikelyNoteRef(cleaned)) {
      return {
        raw: cleaned,
        normalizedValue: parseFloat(cleaned),
        index,
        tokenType: 'note_ref',
      };
    }
    return {
      raw: cleaned,
      normalizedValue: normalizeNumber(cleaned),
      index,
      tokenType: 'value',
    };
  };
  const normalizedTargetPeriod = normalizePeriodLabel(targetPeriodLabel || '');
  const selectValueToken = (
    numericTokens: Array<{
      raw: string;
      normalizedValue: number | null;
      index: number;
      tokenType: 'period' | 'value' | 'note_ref';
      periodLabel?: string;
    }>
  ):
    | {
        raw: string;
        normalizedValue: number | null;
        index: number;
        selectionReason: string;
      }
    | null => {
    const hasRealValues = numericTokens.some(
      (t) => t.tokenType === 'value' && t.normalizedValue !== null && Math.abs(t.normalizedValue) >= 1
    );

    const effectiveTokens = numericTokens.map((t) => {
      if (t.tokenType === 'note_ref' && hasRealValues) return { ...t, tokenType: 'note_ref' as const };
      if (t.tokenType === 'note_ref' && !hasRealValues) return { ...t, tokenType: 'value' as const };
      return t;
    });

    if (normalizedTargetPeriod) {
      for (let idx = 0; idx < effectiveTokens.length; idx++) {
        const token = effectiveTokens[idx];
        if (
          token.tokenType === 'period' &&
          normalizePeriodLabel(token.periodLabel || token.raw) === normalizedTargetPeriod
        ) {
          const pairedValue = effectiveTokens
            .slice(idx + 1)
            .find((candidate) => candidate.tokenType === 'value');
          if (pairedValue) {
            return {
              raw: pairedValue.raw,
              normalizedValue: pairedValue.normalizedValue,
              index: pairedValue.index,
              selectionReason: 'matched_selected_period',
            };
          }
        }
      }
    }

    const firstValue = effectiveTokens.find((token) => token.tokenType === 'value');
    if (!firstValue) return null;
    return {
      raw: firstValue.raw,
      normalizedValue: firstValue.normalizedValue,
      index: firstValue.index,
      selectionReason: 'first_value_fallback',
    };
  };
  const deriveRowType = (label: string): ExtractedLine['rowType'] => {
    const normalized = normalizeAliasText(label);
    if (/(total|together|razem|ogółem|suma)/.test(normalized)) return 'total';
    if (/(gross|ebitda|ebit|net income|zysk brutto|zysk netto|przepływy pieniężne netto)/.test(normalized)) {
      return 'subtotal';
    }
    return 'detail';
  };
  const deriveSignMode = (value: number): ExtractedLine['signMode'] => {
    if (!Number.isFinite(value)) return 'unknown';
    if (value < 0) return 'negative';
    if (value > 0) return 'positive';
    return 'mixed';
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;
    if (isNoiseLine(line)) {
      pendingLabel = null;
      continue;
    }

    const numericTokens = extractNumericSpans(line)
      .map((match) => normalizeNumericToken(match.raw, match.index ?? -1))
      .filter((item) => item.index >= 0);
    const valueTokens = numericTokens.filter(
      (item) => item.tokenType === 'value' && item.normalizedValue !== null
    );
    const effectiveNonNoteTokens = numericTokens.filter((t) => t.tokenType !== 'note_ref');

    if (effectiveNonNoteTokens.length < 2 || valueTokens.length === 0) {
      if (isLikelyLabelOnlyLine(line)) {
        pendingLabel = pendingLabel ? `${pendingLabel} ${line}` : line;
      } else {
        pendingLabel = null;
      }
      continue;
    }

    const firstNonNoteToken = numericTokens.find((t) => t.tokenType !== 'note_ref') || numericTokens[0];
    const firstNumberIndex = firstNonNoteToken.index;
    let label = line.slice(0, firstNumberIndex).trim();
    if (pendingLabel) {
      label = label ? `${pendingLabel} ${label}` : pendingLabel;
      pendingLabel = null;
    }

    label = cleanupExtractedLabel(label.replace(/\s+/g, ' ').trim());
    if (!label || label.length < 3 || isNoiseLine(label)) continue;
    const lineClassification = classifyNonFinancialLine(label);
    const selectedToken = selectValueToken(numericTokens);
    if (!selectedToken || selectedToken.normalizedValue == null) continue;
    const rawValue = selectedToken.raw;
    const value = selectedToken.normalizedValue;
    const outputLabel =
      targetPeriodLabel &&
      !normalizePeriodLabel(label).endsWith(normalizePeriodLabel(targetPeriodLabel))
        ? `${label} ${targetPeriodLabel}`.trim()
        : label;
    const dedupeKey = `${detectedType}:${outputLabel.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    rawTableCount++;
    lines.push({
      originalLabel: outputLabel,
      value,
      confidence: lineClassification.isNonFinancial ? 0.2 : 0.6,
      sectionKey: sections[0]?.sectionKey,
      rawValue,
      selectedPeriodLabel: targetPeriodLabel,
      comparisonPeriodLabel,
      sourceRow: lineOffset + i + 1,
      rowType: lineClassification.isNonFinancial ? 'nonFinancial' : deriveRowType(label),
      hierarchyDepth: Math.max(0, (rawLines[i].match(/^\s+/)?.[0].length || 0) / 2),
      signMode: deriveSignMode(value),
      numericTokens,
      selectedNumericToken: selectedToken,
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
  // ── P&L ──
  'fsl-pl-revenue': [
    'revenue',
    'przychody ze sprzedaży',
    'przychody ze sprzedaży dóbr i usług',
    'przychody ze sprzedaży produktów',
    'przychody ze sprzedaży ogółem',
    'razem przychody',
    'net revenue',
    'sales',
    'sprzedaż',
    'total revenue',
  ],
  'fsl-pl-cogs': [
    'cost of goods',
    'cogs',
    'koszt sprzedanych',
    'koszt własny',
    'koszt własny sprzedaży',
    'koszt sprzedanych towarów i materiałów',
    'cost of sales',
  ],
  'fsl-pl-gross': [
    'gross profit',
    'gross margin',
    'zysk brutto',
    'zysk brutto ze sprzedaży',
    'marża brutto',
  ],
  'fsl-pl-selling': [
    'selling expenses',
    'koszty sprzedaży',
    'distribution costs',
  ],
  'fsl-pl-gna': [
    'general and administrative',
    'koszty ogólnego zarządu',
    'koszty administracyjne',
    'administrative expenses',
    'g&a expenses',
  ],
  'fsl-pl-opex': [
    'operating expenses',
    'sg&a',
    'koszty operacyjne',
    'koszty ogólne',
    'opex',
    'selling general',
    'zysk ze sprzedaży',
    'zysk na sprzedaży',
  ],
  'fsl-pl-ebitda': ['ebitda'],
  'fsl-pl-ebit': [
    'ebit',
    'operating profit',
    'operating income',
    'zysk operacyjny',
    'zysk z działalności operacyjnej',
    'strata z działalności operacyjnej',
  ],
  'fsl-pl-ebt': [
    'profit before tax',
    'earnings before tax',
    'zysk przed opodatkowaniem',
    'zysk brutto',
    'strata przed opodatkowaniem',
  ],
  'fsl-pl-net': [
    'net income',
    'net profit',
    'zysk netto',
    'zysk/strata netto',
    'net earnings',
    'zysk netto za okres',
    'zysk netto przypadający',
  ],
  'fsl-pl-interest': [
    'interest expense',
    'koszty odsetkowe',
    'wynik na działalności finansowej',
  ],
  'fsl-pl-depreciation': [
    'depreciation',
    'amortization',
    'amortyzacja',
    'd&a',
    'depreciation and amortization',
    'amortyzacja wartości niematerialnych',
    'amortyzacja rzeczowych aktywów trwałych',
  ],
  'fsl-pl-tax': [
    'income tax',
    'tax expense',
    'podatek dochodowy',
    'podatek',
    'obciążenie podatkowe',
    'bieżący podatek dochodowy',
  ],
  'fsl-pl-tax-deferred': [
    'deferred tax expense',
    'odroczony podatek dochodowy',
    'podatek odroczony',
    'deferred tax',
  ],
  'fsl-pl-tax-current': [
    'current tax expense',
    'bieżący podatek dochodowy',
    'podatek bieżący',
    'current tax',
  ],
  'fsl-pl-other-income': [
    'other income',
    'other revenue',
    'pozostałe przychody operacyjne',
    'inne przychody',
  ],
  'fsl-pl-other-expense': [
    'other expenses',
    'pozostałe koszty operacyjne',
    'inne koszty',
  ],
  // ── BS ──
  'fsl-bs-total-assets': [
    'total assets',
    'aktywa ogółem',
    'aktywa razem',
    'suma aktywów',
    'aktywa razem ogółem',
  ],
  'fsl-bs-fixed': [
    'fixed assets',
    'property plant',
    'aktywa trwałe',
    'ppe',
    'non-current assets',
    'aktywa trwałe razem',
  ],
  'fsl-bs-intangibles': [
    'intangible assets',
    'intangibles',
    'wartości niematerialne',
    'wartości niematerialne i prawne',
  ],
  'fsl-bs-intangibles-goodwill': [
    'goodwill',
    'wartość firmy',
  ],
  'fsl-bs-ppe': [
    'property plant and equipment',
    'ppe',
    'rzeczowe aktywa trwałe',
    'środki trwałe',
  ],
  'fsl-bs-rou-assets': [
    'right of use assets',
    'aktywa z tytułu prawa do użytkowania',
    'prawo do użytkowania aktywów',
    'lease right of use',
  ],
  'fsl-bs-investment-property': [
    'investment property',
    'nieruchomości inwestycyjne',
  ],
  'fsl-bs-other-non-current-assets-deferred-tax': [
    'deferred tax asset',
    'deferred tax assets',
    'aktywa z tytułu odroczonego podatku dochodowego',
    'aktywo z tytułu podatku odroczonego',
  ],
  'fsl-bs-current-assets': [
    'current assets',
    'aktywa obrotowe',
    'aktywa bieżące',
    'aktywa obrotowe razem',
  ],
  'fsl-bs-cash': [
    'cash',
    'cash and cash equivalents',
    'środki pieniężne',
    'gotówka',
    'środki pieniężne i ich ekwiwalenty',
    'środki pieniężne o ograniczonym sposobie dysponowania',
  ],
  'fsl-bs-inventory': ['inventory', 'inventories', 'zapasy'],
  'fsl-bs-ar': [
    'accounts receivable',
    'receivables',
    'należności',
    'trade receivables',
    'należności handlowe',
    'należności z tytułu dostaw i usług',
    'należności handlowe oraz pozostałe należności',
  ],
  'fsl-bs-ap': [
    'accounts payable',
    'payables',
    'zobowiązania handlowe',
    'trade payables',
    'zobowiązania z tytułu dostaw i usług',
  ],
  'fsl-bs-wc': ['working capital', 'kapitał obrotowy'],
  'fsl-bs-total-liabilities': [
    'total liabilities',
    'zobowiązania ogółem',
    'zobowiązania razem',
    'zobowiązania i rezerwy na zobowiązania',
    'suma pasywów',
    'zobowiązania razem ogółem',
    'zobowiązania',
  ],
  'fsl-bs-current-liabilities': [
    'current liabilities',
    'zobowiązania krótkoterminowe',
    'zobowiązania bieżące',
    'zobowiązania krótkoterminowe razem',
    'zobowiązania i rezerwy krótkoterminowe',
  ],
  'fsl-bs-long-term-debt': [
    'long-term debt',
    'long term liabilities',
    'zobowiązania długoterminowe',
    'non-current liabilities',
    'zobowiązania długoterminowe razem',
    'zobowiązania i rezerwy długoterminowe',
  ],
  'fsl-bs-long-term-borrowings': [
    'long-term borrowings',
    'długoterminowe kredyty i pożyczki',
    'kredyty i pożyczki długoterminowe',
    'kredyty i pożyczki',
    'long-term bank loans',
  ],
  'fsl-bs-equity': [
    'equity',
    'shareholders equity',
    'kapitał własny',
    'total equity',
    'kapitał własny razem',
    'kapitał własny ogółem',
  ],
  'fsl-bs-equity-parent': [
    'equity attributable to parent',
    'kapitał własny przypadający akcjonariuszom jednostki dominującej',
    'kapitał własny przypadający akcjonariuszom',
    'equity attributable to owners of the parent',
  ],
  'fsl-bs-share-capital': [
    'share capital',
    'kapitał podstawowy',
    'kapitał zakładowy',
    'issued capital',
  ],
  'fsl-bs-retained-earnings': [
    'retained earnings',
    'zyski zatrzymane',
    'niepodzielony wynik finansowy',
    'wynik z lat ubiegłych',
  ],
  'fsl-bs-provisions': [
    'provisions',
    'rezerwy',
    'rezerwy na zobowiązania',
    'provisions for liabilities',
    'rezerwy krótkoterminowe',
    'pozostałe rezerwy krótkoterminowe',
  ],
  'fsl-bs-other-current-assets': [
    'other current assets',
    'pozostałe aktywa obrotowe',
    'inne aktywa obrotowe',
    'pozostałe aktywa krótkoterminowe',
  ],
  'fsl-bs-other-st-receivables': [
    'other short-term receivables',
    'pozostałe należności krótkoterminowe',
    'inne należności krótkoterminowe',
  ],
  'fsl-bs-other-current-financial-assets': [
    'other current financial assets',
    'pozostałe krótkoterminowe aktywa finansowe',
    'krótkoterminowe aktywa finansowe',
  ],
  'fsl-bs-other-current-assets-prepaids': [
    'prepaid expenses',
    'rozliczenia międzyokresowe',
    'krótkoterminowe rozliczenia międzyokresowe',
  ],
  'fsl-bs-lt-prepaids': [
    'long-term prepaid expenses',
    'długoterminowe rozliczenia międzyokresowe',
    'rozliczenia międzyokresowe długoterminowe',
  ],
  // ── CF ──
  'fsl-cf-change-wc-ar': [
    'change in receivables',
    'zmiana stanu należności',
    'zmiana należności',
  ],
  'fsl-cf-change-wc-inventory': [
    'change in inventory',
    'zmiana stanu zapasów',
    'zmiana zapasów',
  ],
  'fsl-cf-change-wc-ap': [
    'change in payables',
    'zmiana stanu zobowiązań',
    'zmiana zobowiązań',
    'zmiana stanu zobowiązań handlowych',
  ],
  'fsl-cf-operating': [
    'operating cash flow',
    'cash from operations',
    'przepływy operacyjne',
    'cfo',
    'przepływy pieniężne netto z działalności operacyjnej',
    'środki pieniężne netto z działalności operacyjnej',
    'przepływy środków pieniężnych z działalności operacyjnej',
    'działalność operacyjna',
  ],
  'fsl-cf-investing': [
    'investing cash flow',
    'cash from investing',
    'przepływy z inwestycji',
    'przepływy pieniężne netto z działalności inwestycyjnej',
    'środki pieniężne netto z działalności inwestycyjnej',
    'przepływy środków pieniężnych z działalności inwestycyjnej',
    'działalność inwestycyjna',
  ],
  'fsl-cf-financing': [
    'financing cash flow',
    'cash from financing',
    'przepływy z finansowania',
    'przepływy pieniężne netto z działalności finansowej',
    'środki pieniężne netto z działalności finansowej',
    'przepływy środków pieniężnych z działalności finansowej',
    'działalność finansowa',
  ],
  'fsl-cf-capex': [
    'capital expenditures',
    'capex',
    'nakłady inwestycyjne',
    'purchases of property',
    'wydatki na nabycie rzeczowych aktywów trwałych',
    'wydatki na nabycie wartości niematerialnych',
  ],
  'fsl-cf-fcf': ['free cash flow', 'fcf', 'wolne przepływy', 'wolne przepływy pieniężne'],
  'fsl-cf-change-wc-provisions': [
    'change in provisions',
    'zmiana stanu rezerw',
    'zmiana rezerw',
  ],
  'fsl-cf-change-wc-other': [
    'change in other working capital',
    'zmiana stanu pozostałych aktywów',
    'zmiana stanu rozliczeń międzyokresowych',
    'zmiana stanu amortyzowanego aktywa kontraktowego',
  ],
  'fsl-cf-operating-depreciation': [
    'depreciation and amortization',
    'amortyzacja',
    'amortyzacja wartości niematerialnych',
    'amortyzacja rzeczowych aktywów trwałych',
    'amortyzacja aktywów z tytułu prawa do użytkowania',
  ],
  'fsl-cf-operating-interest-cost': [
    'interest cost',
    'koszty odsetek',
    'koszty odsetkowe',
    'przychody z tytułu odsetek',
  ],
  'fsl-cf-net-change-cash': [
    'net change in cash',
    'zmiana stanu środków pieniężnych',
    'zwiększenie netto środków pieniężnych',
    'zmniejszenie netto środków pieniężnych',
    'zmiana netto stanu środków pieniężnych i ich ekwiwalentów',
    'zmiana netto środków pieniężnych',
  ],
  'fsl-cf-opening-cash': [
    'opening cash balance',
    'środki pieniężne na początek okresu',
    'stan środków pieniężnych na początek okresu',
  ],
  'fsl-cf-closing-cash': [
    'closing cash balance',
    'środki pieniężne na koniec okresu',
    'stan środków pieniężnych na koniec okresu',
  ],
  // ── NEW BS HINTS ──
  'fsl-bs-lt-receivables': [
    'long-term receivables',
    'należności długoterminowe',
    'pozostałe należności długoterminowe',
  ],
  'fsl-bs-lt-financial-assets': [
    'long-term financial assets',
    'długoterminowe aktywa finansowe',
    'aktywa finansowe długoterminowe',
    'inwestycje długoterminowe',
  ],
  'fsl-bs-equity-method-investments': [
    'equity method investments',
    'inwestycje w jednostkach stowarzyszonych',
    'inwestycje wyceniane metodą praw własności',
    'udziały w jednostkach zależnych',
    'udziały i akcje w jednostkach zależnych',
    'udziały w jednostkach podporządkowanych',
  ],
  'fsl-bs-tax-receivables': [
    'tax receivables',
    'należności podatkowe',
    'należności z tytułu bieżącego podatku dochodowego',
    'należności z tytułu podatku dochodowego',
    'należności z tytułu podatku dochodowego od osób prawnych',
  ],
  'fsl-bs-other-tax-receivables': [
    'other tax receivables',
    'należności z tytułu innych podatków ceł i ubezpieczeń społecznych',
    'należności z tytułu innych podatków',
    'należności z tytułu podatku VAT',
  ],
  'fsl-bs-contract-assets': [
    'contract assets',
    'aktywa kontraktowe',
    'aktywa z tytułu umów z klientami',
  ],
  'fsl-bs-assets-held-for-sale': [
    'assets held for sale',
    'aktywa przeznaczone do sprzedaży',
    'aktywa trwałe przeznaczone do zbycia',
    'aktywa klasyfikowane jako przeznaczone do sprzedaży',
  ],
  'fsl-bs-treasury-shares': [
    'treasury shares',
    'akcje własne',
    'udziały własne',
  ],
  'fsl-bs-other-equity-reserves': [
    'other equity reserves',
    'pozostałe kapitały rezerwowe',
    'kapitał rezerwowy',
    'kapitał z aktualizacji wyceny',
    'pozostałe kapitały',
    'inne kapitały',
  ],
  'fsl-bs-actuarial-reserve': [
    'actuarial remeasurement reserve',
    'kapitał z przeszacowania programu określonych świadczeń',
    'przeszacowanie programu określonych świadczeń',
    'zyski i straty aktuarialne kapitał',
  ],
  'fsl-bs-minority-interest': [
    'non-controlling interests',
    'minority interest',
    'udziały niesprawujące kontroli',
    'udziały mniejszościowe',
    'udziały niekontrolujące',
    'kapitały przypadające udziałom niesprawującym kontroli',
  ],
  'fsl-bs-hedge-reserve': [
    'hedging reserve',
    'kapitał z wyceny zabezpieczeń',
    'kapitał z wyceny transakcji zabezpieczających',
    'zabezpieczenia przepływów pieniężnych',
    'hedge reserve',
  ],
  'fsl-bs-fx-reserve': [
    'fx translation reserve',
    'różnice kursowe z konsolidacji',
    'różnice kursowe z przeliczenia',
    'foreign currency translation',
  ],
  'fsl-bs-employee-benefits-lt': [
    'employee benefits long-term',
    'zobowiązania z tytułu świadczeń pracowniczych',
    'świadczenia pracownicze długoterminowe',
    'rezerwy na świadczenia emerytalne',
    'zobowiązania z tytułu świadczeń po okresie zatrudnienia',
  ],
  'fsl-bs-employee-benefits-st': [
    'employee benefits short-term',
    'zobowiązania z tytułu świadczeń pracowniczych krótkoterminowe',
    'świadczenia pracownicze',
  ],
  'fsl-bs-contract-liabilities': [
    'contract liabilities',
    'zobowiązania kontraktowe',
    'zobowiązania z tytułu umów z klientami',
    'przychody przyszłych okresów',
    'zaliczki otrzymane',
  ],
  'fsl-bs-other-non-current-liabilities-deferred-tax': [
    'deferred tax liabilities',
    'rezerwa z tytułu podatku odroczonego',
    'rezerwa z tytułu odroczonego podatku dochodowego',
    'zobowiązania z tytułu odroczonego podatku dochodowego',
    'rezerwa na podatek odroczony',
  ],
  'fsl-bs-total-liabilities-equity': [
    'total liabilities and equity',
    'pasywa razem',
    'pasywa ogółem',
    'razem pasywa',
    'suma bilansowa pasywów',
    'suma pasywów',
  ],
  'fsl-bs-share-premium': [
    'share premium',
    'kapitał zapasowy',
    'nadwyżka ze sprzedaży akcji',
    'agio',
    'kapitał zapasowy ze sprzedaży akcji powyżej ich wartości nominalnej',
  ],
  'fsl-bs-short-term-debt': [
    'short-term debt',
    'krótkoterminowe kredyty i pożyczki',
    'krótkoterminowe zobowiązania finansowe',
    'kredyty krótkoterminowe',
  ],
  'fsl-bs-long-term-debt-lease': [
    'non-current lease liabilities',
    'zobowiązania długoterminowe z tytułu leasingu',
    'zobowiązania długoterminowe z tytułu prawa do użytkowania aktywów',
    'zobowiązania długoterminowe z tytułu prawa do użytkowania',
  ],
  'fsl-bs-short-term-debt-lease': [
    'current lease liabilities',
    'krótkoterminowe zobowiązania leasingowe',
    'zobowiązania krótkoterminowe z tytułu leasingu',
    'zobowiązania krótkoterminowe z tytułu prawa do użytkowania aktywów',
    'zobowiązania krótkoterminowe z tytułu prawa do użytkowania',
  ],
  'fsl-bs-other-current-liabilities': [
    'other current liabilities',
    'pozostałe zobowiązania krótkoterminowe',
    'inne zobowiązania krótkoterminowe',
  ],
  'fsl-bs-other-non-current-liabilities': [
    'other non-current liabilities',
    'pozostałe zobowiązania długoterminowe',
    'inne zobowiązania długoterminowe',
  ],
  'fsl-bs-other-non-current-liabilities-provisions': [
    'long-term provisions',
    'rezerwy długoterminowe',
    'pozostałe rezerwy długoterminowe',
  ],
  'fsl-bs-other-current-liabilities-tax': [
    'tax payables',
    'zobowiązania podatkowe',
    'zobowiązania z tytułu podatku dochodowego',
    'zobowiązania z tytułu podatku dochodowego od osób prawnych',
  ],
  'fsl-bs-other-tax-payables': [
    'other tax payables',
    'zobowiązania z tytułu innych podatków ceł i ubezpieczeń społecznych',
    'zobowiązania z tytułu innych podatków',
    'zobowiązania z tytułu VAT',
  ],
  // ── NEW P&L HINTS ──
  'fsl-pl-net-parent': [
    'net income attributable to parent',
    'zysk netto przypadający akcjonariuszom jednostki dominującej',
    'zysk przypadający akcjonariuszom podmiotu dominującego',
    'zysk netto jednostki dominującej',
  ],
  'fsl-pl-net-minority': [
    'net income attributable to non-controlling interests',
    'zysk netto przypadający udziałom niesprawującym kontroli',
    'zysk przypadający udziałom mniejszościowym',
    'udziały niesprawujące kontroli',
  ],
  'fsl-pl-net-continuing': [
    'net income from continuing operations',
    'zysk netto z działalności kontynuowanej',
    'wynik z działalności kontynuowanej',
  ],
  'fsl-pl-other-op-result': [
    'other operating result',
    'wynik na pozostałej działalności operacyjnej',
    'saldo pozostałej działalności operacyjnej',
  ],
  'fsl-pl-other-op-income': [
    'other operating income',
    'pozostałe przychody operacyjne',
    'inne przychody operacyjne',
  ],
  'fsl-pl-equity-method-income': [
    'share of profit of associates',
    'equity method income',
    'udział w zyskach jednostek stowarzyszonych',
    'udział w zyskach jednostek wycenianych metodą praw własności',
    'udział w wynikach jednostek stowarzyszonych',
  ],
  'fsl-pl-fin-income': [
    'financial income',
    'przychody finansowe',
    'przychody z tytułu odsetek',
    'finance income',
  ],
  'fsl-pl-fin-expense': [
    'financial expenses',
    'koszty finansowe',
    'finance costs',
    'financial costs',
  ],
  'fsl-pl-impairment-receivables': [
    'impairment of receivables',
    'zmiana odpisów na należności',
    'odpis aktualizujący wartość należności',
    'strata z tytułu utraty wartości należności',
  ],
  'fsl-pl-oci-total': [
    'other comprehensive income',
    'inne całkowite dochody',
    'inne całkowite dochody ogółem',
    'inne całkowite dochody netto',
  ],
  'fsl-pl-oci-reclassifiable': [
    'items that may be reclassified',
    'pozycje które mogą być przeklasyfikowane',
    'pozycje przeklasyfikowywalne do wyniku',
    'pozycje podlegające przeklasyfikowaniu',
  ],
  'fsl-pl-oci-non-reclassifiable': [
    'items that will not be reclassified',
    'pozycje nieprzeklasyfikowywalne',
    'pozycje które nie zostaną przeklasyfikowane',
    'pozycje niepodlegające przeklasyfikowaniu',
  ],
  'fsl-pl-oci-fx': [
    'fx translation differences',
    'różnice kursowe z przeliczenia',
    'różnice kursowe z przeliczenia jednostek zagranicznych',
  ],
  'fsl-pl-oci-hedge': [
    'hedging result oci',
    'wynik na zabezpieczeniach',
    'wycena instrumentów zabezpieczających',
    'zabezpieczenia przepływów pieniężnych',
    'efektywna część zmian wartości godziwej',
    'wynik na rachunkowości zabezpieczeń',
    'wynik na rachunkowości zabezpieczeń wraz z efektem podatkowym',
  ],
  'fsl-pl-oci-actuarial': [
    'actuarial gains and losses',
    'zyski i straty aktuarialne',
    'przeszacowania zobowiązań z tytułu świadczeń',
    'wycena aktuarialna',
  ],
  'fsl-pl-comprehensive-income': [
    'total comprehensive income',
    'całkowite dochody ogółem',
    'łączne całkowite dochody',
    'razem całkowite dochody',
    'całkowite dochody ogółem z tego przypadające',
  ],
  'fsl-pl-eps-basic': [
    'basic earnings per share',
    'zysk na jedną akcję podstawowy',
    'zysk na jedną akcję',
    'zysk na akcję',
    'zysk na jedną akcję zwykłą',
    'podstawowy zysk na akcję',
  ],
  'fsl-pl-eps-diluted': [
    'diluted earnings per share',
    'zysk na jedną akcję rozwodniony',
    'rozwodniony zysk na jedną akcję',
    'rozwodniony zysk na akcję',
  ],
  'fsl-pl-shares-outstanding': [
    'weighted average shares outstanding',
    'średnia ważona liczba akcji',
    'średnia ważona liczba akcji zwykłych',
    'liczba akcji',
  ],
  // ── NEW CF HINTS ──
  'fsl-cf-operating-depreciation-intangibles': [
    'amortization of intangible assets',
    'amortyzacja wartości niematerialnych',
    'amortyzacja wnip',
  ],
  'fsl-cf-operating-depreciation-ppe': [
    'depreciation of ppe',
    'amortyzacja rzeczowych aktywów trwałych',
    'amortyzacja środków trwałych',
  ],
  'fsl-cf-operating-depreciation-rou': [
    'depreciation of right-of-use assets',
    'amortyzacja aktywów z tytułu prawa do użytkowania',
    'amortyzacja prawa do użytkowania',
  ],
  'fsl-cf-operating-ebt': [
    'profit before tax cf',
    'zysk przed opodatkowaniem',
    'zysk brutto',
    'strata brutto',
    'zysk/strata brutto',
  ],
  'fsl-cf-operating-adjustments': [
    'total adjustments',
    'korekty razem',
    'korekty',
    'adjustments',
  ],
  'fsl-cf-operating-impairment': [
    'impairment charges cf',
    'odpisy aktualizujące',
    'odpisy aktualizujące wartość aktywów',
    'utrata wartości aktywów',
  ],
  'fsl-cf-operating-gain-disposal': [
    'gain on disposal of assets',
    'zyski straty na sprzedaży aktywów',
    'zysk strata ze sprzedaży niefinansowych aktywów trwałych',
    'zysk strata ze zbycia aktywów trwałych',
    'strata zysk ze sprzedaży aktywów trwałych',
    'zysk na sprzedaży rzeczowych aktywów trwałych i wartości niematerialnych',
    'zysk na sprzedaży rzeczowych aktywów trwałych',
    'zyski straty na sprzedaży rzeczowych aktywów trwałych',
  ],
  'fsl-cf-operating-fv-changes': [
    'fair value changes investment property',
    'zyski z wyceny nieruchomości inwestycyjnych według wartości godziwej',
    'straty z wyceny nieruchomości inwestycyjnych',
    'zmiana wartości godziwej nieruchomości',
  ],
  'fsl-cf-operating-fv-derivatives': [
    'fair value changes derivatives',
    'zyski straty z tytułu zmiany wartości godziwej instrumentów pochodnych',
    'zmiany wartości godziwej instrumentów pochodnych',
    'zmiana wartości godziwej instrumentów pochodnych',
    'niezrealizowane różnice kursowe',
    'różnice kursowe',
  ],
  'fsl-cf-operating-dividend-income': [
    'dividend income cf',
    'przychody z dywidend',
    'przychody z tytułu dywidend',
  ],
  'fsl-cf-dividends-received': [
    'dividends received',
    'dywidendy otrzymane',
    'otrzymane dywidendy',
  ],
  'fsl-cf-operating-other-adj': [
    'other adjustments',
    'inne korekty',
    'pozostałe korekty',
  ],
  'fsl-cf-operating-equity-method': [
    'equity method cf',
    'udział w zyskach jednostek stowarzyszonych',
    'udział w wyniku jednostek wycenianych metodą praw własności',
  ],
  'fsl-cf-operating-interest-income': [
    'interest income cf',
    'przychody z odsetek',
    'przychody z tytułu odsetek',
    'przychody odsetkowe',
    'odsetki otrzymane',
  ],
  'fsl-cf-operating-before-wc': [
    'cf before working capital changes',
    'przepływy przed zmianami w kapitale obrotowym',
    'środki pieniężne z działalności operacyjnej przed zmianami',
  ],
  'fsl-cf-operating-generated': [
    'cash generated from operations',
    'środki pieniężne wygenerowane z działalności operacyjnej',
    'środki pieniężne z działalności operacyjnej',
  ],
  'fsl-cf-capex-intangibles': [
    'capex intangible assets',
    'wydatki na wartości niematerialne',
    'wydatki na nabycie wartości niematerialnych',
    'nabycie wartości niematerialnych',
  ],
  'fsl-cf-investing-disposal-proceeds': [
    'disposal proceeds',
    'wpływy ze sprzedaży aktywów',
    'wpływy ze sprzedaży rzeczowych aktywów trwałych',
    'wpływy ze sprzedaży aktywów trwałych',
    'wpływy ze zbycia aktywów trwałych',
  ],
  'fsl-cf-fx-on-cash': [
    'fx effect on cash',
    'wpływ zmian kursów walut na środki pieniężne',
    'różnice kursowe netto',
    'wpływ zmian kursów walut',
  ],
  'fsl-cf-tax-refund': [
    'tax refund',
    'zwrot podatku',
    'zwrot podatku dochodowego',
  ],
  'fsl-cf-dividends': [
    'dividends paid',
    'dywidendy wypłacone',
    'wypłata dywidend',
    'dywidendy zapłacone',
  ],
  'fsl-cf-debt-drawdown': [
    'debt drawdown',
    'wpływy z tytułu zaciągnięcia kredytów',
    'zaciągnięcie kredytów i pożyczek',
    'wpływy z kredytów',
  ],
  'fsl-cf-debt-repayment': [
    'debt repayment',
    'spłata kredytów i pożyczek',
    'spłaty kredytów i pożyczek',
    'spłata kredytów',
    'spłaty kredytów',
  ],
  'fsl-cf-lease-repayment': [
    'lease repayment',
    'spłata zobowiązań z tytułu leasingu',
    'spłaty zobowiązań leasingowych',
    'spłata leasingu',
  ],
  'fsl-cf-taxes-paid': [
    'taxes paid',
    'zapłacony podatek dochodowy',
    'podatek zapłacony',
    'podatek dochodowy zapłacony',
  ],
  'fsl-cf-interest-paid': [
    'interest paid',
    'odsetki zapłacone',
    'odsetki zapłacone netto',
    'zapłacone odsetki',
  ],
  'fsl-cf-other-expenditure': [
    'other expenditure',
    'inne wydatki',
    'inne wydatki finansowe',
    'inne wydatki inwestycyjne',
  ],
  'fsl-cf-other-receipts': [
    'other receipts',
    'inne wpływy',
    'inne wpływy wydatki',
    'inne wpływy finansowe',
    'inne wpływy inwestycyjne',
  ],
  'fsl-cf-investing-subsidiaries': [
    'investment in subsidiaries',
    'inwestycje w jednostki zależne',
    'nabycie jednostek zależnych',
    'wydatki na nabycie udziałów w jednostkach zależnych',
  ],
  'fsl-cf-change-wc-restricted-cash': [
    'change in restricted cash',
    'zmiana stanu środków pieniężnych o ograniczonym sposobie dysponowania',
    'środki pieniężne o ograniczonym dysponowaniu',
  ],
  'fsl-cf-change-wc-prepaids': [
    'change in prepayments',
    'zmiana stanu rozliczeń międzyokresowych',
    'zmiana stanu czynnych rozliczeń międzyokresowych',
  ],
};

function buildFallbackCanonicalLines(statementType: string): CanonicalLine[] {
  const normalizedStatementType = normalizeStatementTypeToken(statementType);
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

function detectCrossContamination(normalizedLabel: string, statementType: string): string | null {
  const bsOnlyPatterns = [
    /^pasywa\s+razem/i,
    /^aktywa\s+razem/i,
    /^suma\s+pasywów/i,
    /^suma\s+aktywów/i,
    /^pozostałe\s+rezerwy\s+krótkoterminowe/i,
    /^pozostałe\s+rezerwy\s+długoterminowe/i,
    /^zobowiązania\s+i\s+rezerwy/i,
    /^nieruchomości\s+inwestycyjne/i,
    /^rzeczowe\s+aktywa\s+trwałe/i,
    /^wartości\s+niematerialne\b/i,
    /^wartość\s+firmy/i,
    /^aktywa\s+(?:trwałe|obrotowe)\s*$/i,
  ];
  const plOnlyPatterns = [
    /^zysk\s+brutto\s+ze\s+sprzedaży/i,
    /^koszt\s+własny\s+sprzedaży/i,
    /^koszty\s+(?:sprzedaży|ogólnego\s+zarządu)\s*$/i,
  ];
  if (statementType === 'P&L' && bsOnlyPatterns.some((p) => p.test(normalizedLabel))) {
    return 'CROSS_CONTAMINATION_BS_IN_PL';
  }
  if (statementType === 'CF' && bsOnlyPatterns.some((p) => p.test(normalizedLabel))) {
    return 'CROSS_CONTAMINATION_BS_IN_CF';
  }
  if (statementType === 'BS' && plOnlyPatterns.some((p) => p.test(normalizedLabel))) {
    return 'CROSS_CONTAMINATION_PL_IN_BS';
  }
  return null;
}

export async function autoMapLines(
  extractedLines: ExtractedLine[],
  statementType: string,
  options?: { organizationId?: string; templateFamily?: string | null }
): Promise<ExtractedLine[]> {
  const normalizedStatementType = normalizeStatementTypeToken(statementType);
  const organizationScope = String(options?.organizationId || '').trim();
  const templateFamily = String(options?.templateFamily || '').trim();
  let canonicalLines: CanonicalLine[] = [];
  try {
    canonicalLines = (await dbAll(
      `SELECT id, statement_type, line_code, line_name, line_name_pl
       FROM financial_statement_lines
       WHERE statement_type = ?
         AND (is_system = TRUE OR organization_id = ? OR organization_id IS NULL)`,
      [normalizedStatementType, organizationScope]
    )) as CanonicalLine[];
  } catch {
    canonicalLines = [];
  }
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

  const applyStructuralMappingBoost = (
    normalizedLabel: string,
    canonicalId: string,
    normalizedType: string
  ): { delta: number; reason?: string } => {
    if (normalizedType === 'CF') {
      if (/operacyj|z działalności operacyjnej/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating') return { delta: 0.75, reason: 'cash_flow_scope_match' };
        if (canonicalId === 'fsl-cf-investing' || canonicalId === 'fsl-cf-financing') {
          return { delta: -0.45, reason: 'cash_flow_scope_conflict' };
        }
      }
      if (/inwestycyjn|z działalności inwestycyjnej/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-investing') return { delta: 0.75, reason: 'cash_flow_scope_match' };
        if (canonicalId === 'fsl-cf-operating' || canonicalId === 'fsl-cf-financing') {
          return { delta: -0.45, reason: 'cash_flow_scope_conflict' };
        }
      }
      if (/finansow|z działalności finansowej/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-financing') return { delta: 0.75, reason: 'cash_flow_scope_match' };
        if (canonicalId === 'fsl-cf-operating' || canonicalId === 'fsl-cf-investing') {
          return { delta: -0.45, reason: 'cash_flow_scope_conflict' };
        }
      }
      if (/zmiana stanu zobowiązań\b/i.test(normalizedLabel) && !/pozostałych|leasingu|handlowych/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-ap') return { delta: 0.7, reason: 'cash_flow_ap_anchor' };
        if (canonicalId === 'fsl-cf-change-wc-other') return { delta: -0.3, reason: 'cash_flow_ap_vs_other' };
      }
      if (/zmiana stanu należności\b/i.test(normalizedLabel) && !/pozostałych/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-ar') return { delta: 0.7, reason: 'cash_flow_ar_anchor' };
        if (canonicalId === 'fsl-cf-change-wc-other') return { delta: -0.3, reason: 'cash_flow_ar_vs_other' };
      }
      if (/zmiana stanu zapasów/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-inventory') return { delta: 0.7, reason: 'cash_flow_inventory_anchor' };
      }
      if (/zmiana stanu rezerw/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-provisions') return { delta: 0.7, reason: 'cash_flow_provisions_anchor' };
        if (canonicalId === 'fsl-cf-net-change-cash') return { delta: -0.6, reason: 'cash_flow_provisions_vs_net_change' };
      }
      if (/zmiana stanu pozostałych/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-other') return { delta: 0.6, reason: 'cash_flow_other_wc_anchor' };
        if (canonicalId === 'fsl-cf-net-change-cash') return { delta: -0.6, reason: 'cash_flow_other_wc_vs_net_change' };
      }
      if (/koszty odsetek/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-interest-cost') return { delta: 0.6, reason: 'cash_flow_interest_cost_anchor' };
        if (canonicalId === 'fsl-cf-interest-paid') return { delta: -0.3, reason: 'cash_flow_interest_cost_vs_paid' };
      }
      if (/amortyzacja\s+(wartości\s+)?niemate/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-depreciation-intangibles') return { delta: 0.8, reason: 'cf_depreciation_intangibles_anchor' };
        if (canonicalId === 'fsl-cf-operating-depreciation') return { delta: -0.3, reason: 'cf_depreciation_parent_vs_child' };
      }
      if (/amortyzacja\s+rzeczowych/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-depreciation-ppe') return { delta: 0.8, reason: 'cf_depreciation_ppe_anchor' };
        if (canonicalId === 'fsl-cf-operating-depreciation') return { delta: -0.3, reason: 'cf_depreciation_parent_vs_child' };
      }
      if (/amortyzacja\s+aktywów z tytułu\s+prawa/i.test(normalizedLabel) || /amortyzacja\s+prawa\s+do\s+użytk/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-depreciation-rou') return { delta: 0.8, reason: 'cf_depreciation_rou_anchor' };
        if (canonicalId === 'fsl-cf-operating-depreciation') return { delta: -0.3, reason: 'cf_depreciation_parent_vs_child' };
      }
      if (/amortyzacja/i.test(normalizedLabel) && !/wartości\s+niematerialnych|rzeczowych|prawa\s+do|aktywów z tytułu/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-depreciation') return { delta: 0.5, reason: 'cash_flow_depreciation_anchor' };
      }
      if (/zysk.*przed\s+opodatkowaniem|strata.*przed\s+opodatkowaniem/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-ebt') return { delta: 0.7, reason: 'cf_ebt_anchor' };
        if (canonicalId === 'fsl-cf-net-change-cash') return { delta: -0.5, reason: 'cf_ebt_vs_net_change' };
      }
      if (/korekty\s*razem|korekty\s+ogółem/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-adjustments') return { delta: 0.7, reason: 'cf_adjustments_anchor' };
      }
      if (/odpisy\s+aktualizujące/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-impairment') return { delta: 0.6, reason: 'cf_impairment_anchor' };
      }
      if (/zysk.*strat.*sprzedaż.*aktyw|strat.*zysk.*sprzedaż.*aktyw|zysk.*ze\s+zbycia|strat.*ze\s+zbycia/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-gain-disposal') return { delta: 0.7, reason: 'cf_gain_disposal_anchor' };
      }
      if (/instrumentów\s+pochodnych|derivatives/i.test(normalizedLabel) && /wartości?\s+godziwej/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-fv-derivatives') return { delta: 0.8, reason: 'cf_fv_derivatives_anchor' };
        if (canonicalId === 'fsl-cf-operating-fv-changes') return { delta: -0.3, reason: 'cf_fv_derivatives_vs_property' };
      }
      if (/nieruchomości\s+inwestycyjnych/i.test(normalizedLabel) && /wartości?\s+godziwej/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-fv-changes') return { delta: 0.8, reason: 'cf_fv_property_anchor' };
        if (canonicalId === 'fsl-cf-operating-fv-derivatives') return { delta: -0.3, reason: 'cf_fv_property_vs_derivatives' };
      }
      if (/wartości?\s+godziwej|niezrealizowane\s+różnice/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-fv-changes') return { delta: 0.4, reason: 'cf_fv_changes_anchor' };
        if (canonicalId === 'fsl-cf-operating-fv-derivatives') return { delta: 0.3, reason: 'cf_fv_derivatives_fallback' };
      }
      if (/przychody\s+z\s+(?:tytułu\s+)?dywidend/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-dividend-income') return { delta: 0.7, reason: 'cf_dividend_income_anchor' };
        if (canonicalId === 'fsl-cf-dividends-received') return { delta: -0.2, reason: 'cf_dividend_income_vs_received' };
        if (canonicalId === 'fsl-cf-dividends') return { delta: -0.3, reason: 'cf_dividend_income_vs_paid' };
      }
      if (/(?:dywidendy\s+)?otrzymane\s+dywidendy|otrzymane\s+dywidendy/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-dividends-received') return { delta: 0.7, reason: 'cf_dividends_received_anchor' };
        if (canonicalId === 'fsl-cf-operating-dividend-income') return { delta: -0.2, reason: 'cf_received_vs_income' };
        if (canonicalId === 'fsl-cf-dividends') return { delta: -0.3, reason: 'cf_received_vs_paid' };
      }
      if (/inne\s+korekty|pozostałe\s+korekty/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-other-adj') return { delta: 0.6, reason: 'cf_other_adj_anchor' };
      }
      if (/udział\s+w\s+zysk.*jednostek|udział\s+w\s+wynik.*praw\s+własności/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-equity-method') return { delta: 0.6, reason: 'cf_equity_method_anchor' };
      }
      if (/przychody\s+z\s+odsetek|odsetki\s+otrzymane|przychody\s+odsetkowe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-interest-income') return { delta: 0.6, reason: 'cf_interest_income_anchor' };
        if (canonicalId === 'fsl-cf-operating-interest-cost') return { delta: -0.3, reason: 'cf_interest_income_vs_cost' };
      }
      if (/wpływy\s+ze\s+sprzedaży\s+aktyw|wpływy\s+ze\s+zbycia/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-investing-disposal-proceeds') return { delta: 0.7, reason: 'cf_disposal_proceeds_anchor' };
      }
      if (/wydatki\s+na\s+(?:nabycie\s+)?wartości\s+niematerial|nabycie\s+wartości\s+niematerial/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-capex-intangibles') return { delta: 0.7, reason: 'cf_capex_intangibles_anchor' };
        if (canonicalId === 'fsl-cf-capex') return { delta: -0.2, reason: 'cf_capex_intangibles_vs_parent' };
      }
      if (/wpływ\s+zmian\s+kursów|różnice\s+kursowe\s+netto/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-fx-on-cash') return { delta: 0.6, reason: 'cf_fx_on_cash_anchor' };
      }
      if (/dywidendy\s+wypłacone|wypłata\s+dywidend|dywidendy\s+zapłacone/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-dividends') return { delta: 0.6, reason: 'cf_dividends_paid_anchor' };
        if (canonicalId === 'fsl-cf-operating-dividend-income') return { delta: -0.3, reason: 'cf_dividends_paid_vs_income' };
      }
      if (/spłat[ay].*leasingu|spłat[ay].*zobowiązań\s+z\s+tytułu\s+leasingu/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-lease-repayment') return { delta: 0.8, reason: 'cf_lease_repayment_anchor' };
        if (canonicalId === 'fsl-cf-debt-repayment') return { delta: -0.3, reason: 'cf_lease_vs_debt_repayment' };
      }
      if (/spłat[ay].*kredyt|spłat[ay].*pożyczek/i.test(normalizedLabel) && !/leasingu/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-debt-repayment') return { delta: 0.5, reason: 'cf_debt_repayment_anchor' };
        if (canonicalId === 'fsl-cf-lease-repayment') return { delta: -0.3, reason: 'cf_debt_vs_lease_repayment' };
      }
      if (/wpływy.*zaciągnięcia|zaciągnięcie.*kredyt|wpływy.*kredyt/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-debt-drawdown') return { delta: 0.5, reason: 'cf_debt_drawdown_anchor' };
      }
      if (/na początek|na pocz[aą]tek|opening/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-opening-cash') return { delta: 0.6, reason: 'cash_flow_opening_anchor' };
      }
      if (/na koniec|closing/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-closing-cash') return { delta: 0.6, reason: 'cash_flow_closing_anchor' };
      }
      if (/wydatki na nabycie|capital expenditure|capex/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-capex') return { delta: 0.6, reason: 'cash_flow_capex_anchor' };
      }
      if (/^inne\s+wydatki/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-other-expenditure') return { delta: 0.7, reason: 'cf_other_expenditure_anchor' };
        if (canonicalId === 'fsl-cf-operating-other-adj') return { delta: -0.3, reason: 'cf_other_expenditure_vs_adj' };
      }
      if (/^inne\s+wpływy/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-other-receipts') return { delta: 0.7, reason: 'cf_other_receipts_anchor' };
        if (canonicalId === 'fsl-cf-operating-other-adj') return { delta: -0.3, reason: 'cf_other_receipts_vs_adj' };
      }
      if (/inwestycje\s+w\s+jednostki\s+zależne/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-investing-subsidiaries') return { delta: 0.7, reason: 'cf_investing_subsidiaries_anchor' };
        if (canonicalId === 'fsl-cf-capex') return { delta: -0.3, reason: 'cf_subsidiaries_vs_capex' };
      }
      if (/zmiana\s+stanu\s+środków\s+pieniężnych\s+o\s+ograniczonym/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-restricted-cash') return { delta: 0.7, reason: 'cf_restricted_cash_anchor' };
        if (canonicalId === 'fsl-cf-change-wc-other') return { delta: -0.3, reason: 'cf_restricted_cash_vs_other' };
      }
      if (/zmiana\s+stanu\s+rozliczeń\s+międzyokresowych/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-prepaids') return { delta: 0.7, reason: 'cf_prepaids_anchor' };
        if (canonicalId === 'fsl-cf-change-wc-other') return { delta: -0.3, reason: 'cf_prepaids_vs_other' };
      }
      if (/otrzymane\s+dywidendy/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-dividend-income') return { delta: 0.7, reason: 'cf_received_dividends_anchor' };
        if (canonicalId === 'fsl-cf-dividends') return { delta: -0.3, reason: 'cf_received_vs_paid_dividends' };
      }
      if (/przychody\s+z\s+tytułu\s+odsetek/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-interest-income') return { delta: 0.7, reason: 'cf_interest_income_tytulu_anchor' };
        if (canonicalId === 'fsl-cf-operating-interest-cost') return { delta: -0.4, reason: 'cf_interest_income_vs_cost' };
      }
    }

    if (normalizedType === 'BS') {
      if (/(aktywa razem|aktywa ogolem|aktywa ogółem|total assets)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-total-assets'
          ? { delta: 0.6, reason: 'balance_sheet_total_anchor' }
          : { delta: -0.2, reason: 'balance_sheet_total_conflict' };
      }
      if (/(zobowiazania razem|zobowiązania razem|total liabilities|pasywa razem)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-total-liabilities'
          ? { delta: 0.6, reason: 'balance_sheet_total_anchor' }
          : { delta: -0.2, reason: 'balance_sheet_total_conflict' };
      }
      if (/^kapitał\s+własny\s*$/i.test(normalizedLabel) || /^kapitał\s+własny\s+razem/i.test(normalizedLabel) || /^total\s+equity/i.test(normalizedLabel) || /^equity\s*$/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-equity') return { delta: 0.6, reason: 'balance_sheet_equity_anchor' };
        if (canonicalId === 'fsl-bs-equity-method-investments') return { delta: -0.4, reason: 'equity_vs_equity_method' };
        return { delta: -0.1, reason: 'equity_conflict' };
      }
      if (/kapitał\s+własny/i.test(normalizedLabel) && /przypadający|dominującej|akcjonariuszom/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-equity-parent') return { delta: 0.8, reason: 'balance_sheet_equity_parent_anchor' };
        if (canonicalId === 'fsl-bs-equity') return { delta: -0.3, reason: 'equity_parent_vs_total' };
        return { delta: 0, reason: undefined };
      }
      if (/(rzeczowe aktywa trwałe|property plant and equipment)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-ppe'
          ? { delta: 0.4, reason: 'balance_sheet_ppe_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(wartości niematerialne|intangible assets)/.test(normalizedLabel) && !/firmy|goodwill/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-intangibles'
          ? { delta: 0.4, reason: 'balance_sheet_intangibles_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(wartość firmy|goodwill)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-intangibles-goodwill'
          ? { delta: 0.5, reason: 'balance_sheet_goodwill_anchor' }
          : { delta: -0.1, reason: 'balance_sheet_goodwill_conflict' };
      }
      if (/(zapasy|inventor)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-inventory'
          ? { delta: 0.3, reason: 'balance_sheet_inventory_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(środki pieniężne|cash)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-cash'
          ? { delta: 0.3, reason: 'balance_sheet_cash_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(pasywa\s+razem|pasywa\s+ogółem|razem\s+pasywa|suma\s+pasywów)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-total-liabilities-equity') return { delta: 0.7, reason: 'bs_total_liabilities_equity_anchor' };
        if (canonicalId === 'fsl-bs-total-liabilities') return { delta: -0.3, reason: 'bs_pasywa_vs_total_liabilities' };
      }
      if (/(akcje\s+własne|udziały\s+własne|treasury\s+shares)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-treasury-shares'
          ? { delta: 0.5, reason: 'bs_treasury_shares_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(udziały\s+niesprawujące|udziały\s+mniejszościowe|non-?controlling\s+interest|minority\s+interest)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-minority-interest'
          ? { delta: 0.6, reason: 'bs_minority_interest_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(należności\s+długoterminowe|long.term\s+receivables)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-lt-receivables'
          ? { delta: 0.5, reason: 'bs_lt_receivables_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(długoterminowe\s+aktywa\s+finansowe|aktywa\s+finansowe\s+długoterminowe)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-lt-financial-assets'
          ? { delta: 0.5, reason: 'bs_lt_financial_assets_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(inwestycje.*praw\s+własności|udziały.*jednostk.*zależn|inwestycje.*stowarzyszon)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-equity-method-investments'
          ? { delta: 0.5, reason: 'bs_equity_method_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(należności\s+podatkowe|należności.*podatku\s+dochodowego|należności\s+z\s+tytułu\s+innych\s+podatków)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-tax-receivables') return { delta: 0.6, reason: 'bs_tax_receivables_anchor' };
        if (canonicalId === 'fsl-bs-other-current-liabilities-tax') return { delta: -0.5, reason: 'bs_receivable_not_liability' };
        return { delta: 0, reason: undefined };
      }
      if (/zobowiązania\s+z\s+tytułu\s+podatku\s+dochodowego/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-current-liabilities-tax') return { delta: 0.6, reason: 'bs_tax_payable_anchor' };
        if (canonicalId === 'fsl-bs-tax-receivables') return { delta: -0.5, reason: 'bs_liability_not_receivable' };
        return { delta: 0, reason: undefined };
      }
      if (/(aktywa\s+kontraktowe|aktywa.*umów\s+z\s+klientami)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-contract-assets'
          ? { delta: 0.5, reason: 'bs_contract_assets_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(aktywa\s+przeznaczone\s+do\s+sprzedaży|aktywa.*przeznaczone\s+do\s+zbycia)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-assets-held-for-sale'
          ? { delta: 0.5, reason: 'bs_assets_held_for_sale_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(aktywa.*prawa\s+do\s+użytk|prawo\s+do\s+użytkowania)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-rou-assets'
          ? { delta: 0.5, reason: 'bs_rou_assets_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(kapitał\s+z\s+wyceny\s+zabezpieczeń|hedge\s+reserve)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-hedge-reserve'
          ? { delta: 0.5, reason: 'bs_hedge_reserve_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(różnice\s+kursowe\s+z\s+konsolidacji|fx\s+translation)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-fx-reserve'
          ? { delta: 0.5, reason: 'bs_fx_reserve_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(zobowiązania.*świadczeń\s+pracowniczych|świadczenia\s+pracownicze)/i.test(normalizedLabel)) {
        if (/długoterminow/i.test(normalizedLabel)) {
          return canonicalId === 'fsl-bs-employee-benefits-lt'
            ? { delta: 0.5, reason: 'bs_employee_benefits_lt_anchor' }
            : { delta: 0, reason: undefined };
        }
        return canonicalId === 'fsl-bs-employee-benefits-st'
          ? { delta: 0.4, reason: 'bs_employee_benefits_st_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(zobowiązania\s+kontraktowe|zobowiązania.*umów\s+z\s+klientami|przychody\s+przyszłych\s+okresów|zaliczki\s+otrzymane)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-contract-liabilities'
          ? { delta: 0.5, reason: 'bs_contract_liabilities_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(rezerwa.*podatku\s+odroczonego|zobowiązania.*odroczonego\s+podatku)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-other-non-current-liabilities-deferred-tax'
          ? { delta: 0.5, reason: 'bs_deferred_tax_liabilities_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(pozostałe\s+kapitały|kapitał\s+rezerwowy|kapitał\s+z\s+aktualizacji)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-other-equity-reserves'
          ? { delta: 0.4, reason: 'bs_other_equity_reserves_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(kapitał\s+zapasowy|nadwyżka\s+ze\s+sprzedaży\s+akcji)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-share-premium'
          ? { delta: 0.4, reason: 'bs_share_premium_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/długoterminowe\s+kredyty\s+i\s+pożyczki|kredyty\s+i\s+pożyczki\s+długoterminowe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-long-term-borrowings') return { delta: 0.8, reason: 'bs_lt_borrowings_anchor' };
        if (canonicalId === 'fsl-bs-long-term-debt') return { delta: -0.3, reason: 'bs_borrowings_vs_total_lt' };
        return { delta: 0, reason: undefined };
      }
      if (/pozostałe\s+zobowiązania\s+długoterminowe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-non-current-liabilities') return { delta: 0.8, reason: 'bs_other_lt_liabilities_anchor' };
        if (canonicalId === 'fsl-bs-long-term-debt') return { delta: -0.3, reason: 'bs_other_lt_not_total' };
      }
      if (/zobowiązania\s+(?:i\s+rezerwy\s+)?długoterminowe\b/i.test(normalizedLabel) && !/kredyt|pożyczk|leasingu|pozostałe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-long-term-debt') return { delta: 0.5, reason: 'bs_lt_debt_total_anchor' };
        if (canonicalId === 'fsl-bs-long-term-borrowings') return { delta: -0.3, reason: 'bs_lt_total_vs_borrowings' };
      }
      if (/należności\s+z\s+tytułu\s+innych\s+podatków/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-tax-receivables') return { delta: 0.8, reason: 'bs_other_tax_receivables_anchor' };
        if (canonicalId === 'fsl-bs-tax-receivables') return { delta: -0.3, reason: 'bs_other_tax_vs_income_tax_receivables' };
        return { delta: 0, reason: undefined };
      }
      if (/zobowiązania\s+z\s+tytułu\s+innych\s+podatków/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-tax-payables') return { delta: 0.8, reason: 'bs_other_tax_payables_anchor' };
        if (canonicalId === 'fsl-bs-other-current-liabilities-tax') return { delta: -0.3, reason: 'bs_other_tax_vs_income_tax_payables' };
        return { delta: 0, reason: undefined };
      }
      if (/kapitał\s+z\s+przeszacowania\s+programu/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-actuarial-reserve') return { delta: 0.8, reason: 'bs_actuarial_reserve_anchor' };
        if (canonicalId === 'fsl-bs-other-equity-reserves') return { delta: -0.3, reason: 'bs_actuarial_vs_other_reserves' };
        return { delta: 0, reason: undefined };
      }
      if (/pozostałe\s+krótkoterminowe\s+aktywa\s+finansowe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-current-financial-assets') return { delta: 0.8, reason: 'bs_current_financial_assets_anchor' };
        if (canonicalId === 'fsl-bs-other-current-assets') return { delta: -0.3, reason: 'bs_financial_vs_other_current' };
        return { delta: 0, reason: undefined };
      }
      if (/długoterminowe\s+rozliczenia\s+międzyokresowe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-lt-prepaids') return { delta: 0.8, reason: 'bs_lt_prepaids_anchor' };
        if (canonicalId === 'fsl-bs-other-current-assets-prepaids') return { delta: -0.3, reason: 'bs_lt_vs_st_prepaids' };
      }
      if (/krótkoterminowe\s+rozliczenia\s+międzyokresowe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-current-assets-prepaids') return { delta: 0.8, reason: 'bs_st_prepaids_anchor' };
        if (canonicalId === 'fsl-bs-lt-prepaids') return { delta: -0.3, reason: 'bs_st_vs_lt_prepaids' };
      }
      if (/pozostałe\s+należności\s+krótkoterminowe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-st-receivables') return { delta: 0.8, reason: 'bs_other_st_receivables_anchor' };
        if (canonicalId === 'fsl-bs-other-current-assets') return { delta: -0.3, reason: 'bs_other_st_recv_vs_current_assets' };
      }
    }

    if (normalizedType === 'P&L') {
      if (/(przychody ze sprzedaży|przychody.*sprzedaż|razem przychody|revenue|total sales)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-revenue' ? { delta: 0.55, reason: 'profit_loss_revenue_anchor' } : { delta: 0 };
      }
      if (/^przychody\s*$/.test(normalizedLabel) || /^przychody\s+\d/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-revenue') return { delta: -0.7, reason: 'profit_loss_generic_przychody_conflict' };
        if (canonicalId === 'fsl-pl-other-income') return { delta: 0.3, reason: 'profit_loss_other_income_fallback' };
      }
      if (/^koszty\s*$/.test(normalizedLabel) || /^koszty\s+\d/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-cogs') return { delta: -0.5, reason: 'profit_loss_generic_koszty_conflict' };
        if (canonicalId === 'fsl-pl-other-expense') return { delta: 0.3, reason: 'profit_loss_other_expense_fallback' };
      }
      if (/(pozostałe przychody operacyjne|przychody operacyjne|other (?:operating )?income)/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-revenue') return { delta: -0.4, reason: 'profit_loss_other_income_vs_revenue' };
        if (canonicalId === 'fsl-pl-other-income') return { delta: 0.4, reason: 'profit_loss_other_income_anchor' };
      }
      if (/(przychody finansowe|koszty finansowe|wynik.*finansow|finance costs|financial)/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-revenue') return { delta: -0.4, reason: 'profit_loss_finance_vs_revenue' };
        if (canonicalId === 'fsl-pl-interest') return { delta: 0.4, reason: 'profit_loss_finance_anchor' };
      }
      if (/(zysk netto|net income|net profit)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-net' ? { delta: 0.45, reason: 'profit_loss_net_anchor' } : { delta: 0 };
      }
      if (/(zysk przed opodatkowaniem|profit before tax|earnings before tax)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-ebt' ? { delta: 0.45, reason: 'profit_loss_ebt_anchor' } : { delta: 0 };
      }
      if (/(koszt własny sprzedaży|cost of sales|cost of goods)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-cogs' ? { delta: 0.45, reason: 'profit_loss_cogs_anchor' } : { delta: 0 };
      }
      if (/(koszty sprzedaży|selling expenses|distribution costs)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-selling' ? { delta: 0.45, reason: 'profit_loss_selling_anchor' } : { delta: 0 };
      }
      if (/(koszty ogólnego zarządu|administrative expenses|g&a)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-gna' ? { delta: 0.45, reason: 'profit_loss_gna_anchor' } : { delta: 0 };
      }
      if (/odroczony\s+podatek\s+dochodowy|deferred\s+(?:income\s+)?tax/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-tax-deferred') return { delta: 0.6, reason: 'pl_deferred_tax_anchor' };
        if (canonicalId === 'fsl-pl-tax') return { delta: -0.5, reason: 'pl_deferred_not_current_tax' };
        return { delta: 0 };
      }
      if (/bieżący\s+podatek\s+dochodowy|current\s+(?:income\s+)?tax/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-tax-current') return { delta: 0.6, reason: 'pl_current_tax_anchor' };
        if (canonicalId === 'fsl-pl-tax') return { delta: -0.3, reason: 'pl_current_not_generic_tax' };
        return { delta: 0 };
      }
      if (/(podatek dochodowy|income tax|tax expense)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-tax' ? { delta: 0.35, reason: 'profit_loss_tax_anchor' } : { delta: 0 };
      }
      if (/(zysk.*operacyjn|operating (?:profit|income))/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-ebit' ? { delta: 0.45, reason: 'profit_loss_ebit_anchor' } : { delta: 0 };
      }
      if (/(zysk brutto|zysk brutto ze sprzedaży|gross profit)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-gross' ? { delta: 0.45, reason: 'profit_loss_gross_anchor' } : { delta: 0 };
      }
      if (/(zysk\s+netto\s+przypadający\s+akcjonariuszom|zysk\s+przypadający\s+akcjonariuszom\s+podmiotu\s+domin)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-net-parent') return { delta: 0.7, reason: 'pl_net_parent_anchor' };
        if (canonicalId === 'fsl-pl-net') return { delta: -0.3, reason: 'pl_net_parent_vs_net' };
      }
      if (/(zysk.*przypadając.*niesprawują|zysk.*udziałom\s+mniejszościowym)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-net-minority') return { delta: 0.7, reason: 'pl_net_minority_anchor' };
        if (canonicalId === 'fsl-pl-net') return { delta: -0.3, reason: 'pl_net_minority_vs_net' };
      }
      if (/(zysk.*z\s+działalności\s+kontynuowanej|wynik.*działalności\s+kontynuowanej)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-net-continuing') return { delta: 0.6, reason: 'pl_net_continuing_anchor' };
        if (canonicalId === 'fsl-pl-net') return { delta: -0.2, reason: 'pl_net_continuing_vs_net' };
      }
      if (/(udział\s+w\s+zysk.*stowarzyszonych|udział\s+w\s+wynik.*praw\s+własności)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-equity-method-income'
          ? { delta: 0.6, reason: 'pl_equity_method_anchor' }
          : { delta: 0 };
      }
      if (/(inne\s+całkowite\s+dochody|other\s+comprehensive\s+income)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-oci-total'
          ? { delta: 0.6, reason: 'pl_oci_total_anchor' }
          : { delta: 0 };
      }
      if (/(pozycje\s+(?:które\s+)?(?:mogą\s+być\s+)?przeklasyfiko|podlegające\s+przeklasyfikowaniu)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-oci-reclassifiable'
          ? { delta: 0.6, reason: 'pl_oci_reclassifiable_anchor' }
          : { delta: 0 };
      }
      if (/(pozycje\s+nieprzeklasyfiko|nie\s+zostaną\s+przeklasyfikowane|niepodlegające\s+przeklasyfikowaniu)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-oci-non-reclassifiable'
          ? { delta: 0.6, reason: 'pl_oci_non_reclassifiable_anchor' }
          : { delta: 0 };
      }
      if (/(różnice\s+kursowe\s+z\s+przeliczenia)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-oci-fx'
          ? { delta: 0.5, reason: 'pl_oci_fx_anchor' }
          : { delta: 0 };
      }
      if (/(wynik\s+na\s+zabezpieczeniach|wycena\s+instrumentów\s+zabezpiecz|zabezpieczenia\s+przepływów)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-oci-hedge'
          ? { delta: 0.5, reason: 'pl_oci_hedge_anchor' }
          : { delta: 0 };
      }
      if (/(zyski.*straty\s+aktuarialne|przeszacowania\s+zobowiązań.*świadczeń|wycena\s+aktuarialna)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-oci-actuarial'
          ? { delta: 0.5, reason: 'pl_oci_actuarial_anchor' }
          : { delta: 0 };
      }
      if (/(całkowite\s+dochody\s+ogółem|łączne\s+całkowite\s+dochody|total\s+comprehensive)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-comprehensive-income'
          ? { delta: 0.6, reason: 'pl_comprehensive_income_anchor' }
          : { delta: 0 };
      }
      if (/(zysk\s+na\s+(?:jedną\s+)?akcję\s+(?:zwykłą\s+)?podstawowy|basic\s+earnings?\s+per\s+share)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-eps-basic') return { delta: 0.7, reason: 'pl_eps_basic_anchor' };
        if (canonicalId === 'fsl-pl-eps-diluted') return { delta: -0.3, reason: 'pl_eps_basic_vs_diluted' };
      }
      if (/(zysk\s+na\s+(?:jedną\s+)?akcję\s+rozwodniony|rozwodniony\s+zysk|diluted\s+earnings?\s+per\s+share)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-eps-diluted') return { delta: 0.7, reason: 'pl_eps_diluted_anchor' };
        if (canonicalId === 'fsl-pl-eps-basic') return { delta: -0.3, reason: 'pl_eps_diluted_vs_basic' };
      }
      if (/(zysk\s+na\s+(?:jedną\s+)?akcję|zysk\s+na\s+akcję)/i.test(normalizedLabel) && !/rozwodniony|diluted/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-eps-basic') return { delta: 0.4, reason: 'pl_eps_generic_anchor' };
      }
      if (/(średnia\s+ważona\s+liczba\s+akcji|weighted\s+average\s+shares)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-shares-outstanding'
          ? { delta: 0.6, reason: 'pl_shares_outstanding_anchor' }
          : { delta: 0 };
      }
      if (/(przychody\s+finansowe|finance\s+income)/i.test(normalizedLabel) && !/koszty/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-fin-income') return { delta: 0.5, reason: 'pl_fin_income_anchor' };
        if (canonicalId === 'fsl-pl-revenue') return { delta: -0.4, reason: 'pl_fin_income_vs_revenue' };
        if (canonicalId === 'fsl-pl-interest') return { delta: -0.2, reason: 'pl_fin_income_vs_interest' };
      }
      if (/(koszty\s+finansowe|finance\s+costs)/i.test(normalizedLabel) && !/przychody/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-fin-expense') return { delta: 0.5, reason: 'pl_fin_expense_anchor' };
        if (canonicalId === 'fsl-pl-interest') return { delta: -0.2, reason: 'pl_fin_expense_vs_interest' };
      }
      if (/(pozostałe\s+koszty\s+operacyjne|other\s+operating\s+expenses)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-other-opex') return { delta: 0.4, reason: 'pl_other_opex_anchor' };
      }
    }

    return { delta: 0 };
  };

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

    const labelRaw = normalizeAliasText(line.originalLabel);
    const label = labelRaw
      .replace(/\s+\d{4}\s*$/, '')
      .replace(/\s*,?\s*z\s+tego\s+przypadając[aey]?\s*:?\s*$/i, '')
      .trim();
    const crossContamination = detectCrossContamination(label, normalizedStatementType);
    if (crossContamination) {
      return {
        ...line,
        confidence: Math.min(line.confidence, 0.2),
        suggestedCanonicalId: undefined,
        suggestedCanonicalLabel: undefined,
        isNonFinancial: true,
        classificationReason: crossContamination,
        mappingReason: 'cross_statement_contamination',
      };
    }
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
        const structuralBoost = applyStructuralMappingBoost(label, canonical.id, normalizedStatementType);
        score += structuralBoost.delta;
        if (score <= 0) continue;
        scoredMatches.push({
          id: canonical.id,
          name: canonical.line_name,
          score,
          reason:
            structuralBoost.reason ||
            (score >= 1 ? 'exact_alias_match' : 'alias_similarity_match'),
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
  const normalizedType = normalizeStatementTypeToken(params.statementType);
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
    const sectionKey = `${normalizeStatementTypeToken(params.statementType) || 'UNKNOWN'}_1`;
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
          params.sectionIdsByKey?.[row.sectionKey || sectionKey] || null,
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
            sectionKey: row.sectionKey || sectionKey,
            rowType: row.rowType || null,
            hierarchyDepth: row.hierarchyDepth ?? null,
            signMode: row.signMode || null,
            comparisonPeriodLabel: row.comparisonPeriodLabel || null,
            numericTokens: row.numericTokens || [],
            selectedNumericToken: row.selectedNumericToken || null,
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

export async function loadPersistedStatementCandidateRows(params: {
  statementId: string;
  ingestRunId?: string | null;
}): Promise<ExtractedLine[]> {
  try {
    const where = params.ingestRunId
      ? `WHERE row.statement_id = ? AND row.ingest_run_id = ?`
      : `WHERE row.statement_id = ?`;
    const values = params.ingestRunId ? [params.statementId, params.ingestRunId] : [params.statementId];
    const rows = (await dbAll(
      `SELECT
         row.row_label as row_label,
         row.source_row as source_row,
         row.selected_period_label as selected_period_label,
         row.raw_value as raw_value,
         row.normalized_value as normalized_value,
         row.confidence as confidence,
         row.classification_reason as classification_reason,
         row.metadata_json as metadata_json
       FROM financial_statement_candidate_rows row
       ${where}
       ORDER BY COALESCE(row.source_row, 999999) ASC`,
      values
    )) as Array<{
      row_label?: string;
      source_row?: number | null;
      selected_period_label?: string | null;
      raw_value?: string | null;
      normalized_value?: number | null;
      confidence?: number | null;
      classification_reason?: string | null;
      metadata_json?: string | null;
    }>;

    return rows.map((row) => {
      let metadata: Record<string, any> = {};
      try {
        metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {};
      } catch {
        metadata = {};
      }
      return {
        originalLabel: String(row.row_label || ''),
        value: Number(row.normalized_value || 0),
        confidence: Number(row.confidence || 0),
        sourceRow: row.source_row != null ? Number(row.source_row) : undefined,
        sectionKey: metadata.sectionKey || undefined,
        rawValue: row.raw_value || undefined,
        selectedPeriodLabel: row.selected_period_label || undefined,
        comparisonPeriodLabel: metadata.comparisonPeriodLabel || undefined,
        rowType: metadata.rowType || undefined,
        hierarchyDepth:
          metadata.hierarchyDepth != null && Number.isFinite(Number(metadata.hierarchyDepth))
            ? Number(metadata.hierarchyDepth)
            : undefined,
        signMode: metadata.signMode || undefined,
        numericTokens: Array.isArray(metadata.numericTokens) ? metadata.numericTokens : undefined,
        selectedNumericToken: metadata.selectedNumericToken || undefined,
        isNonFinancial: Boolean(metadata.isNonFinancial),
        classificationReason: row.classification_reason || metadata.classificationReason || undefined,
        mappingReason: metadata.mappingReason || undefined,
      } satisfies ExtractedLine;
    });
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
  const normalizedStatementType = patch.statementType
    ? normalizeStatementTypeToken(patch.statementType)
    : null;
  try {
    await runStatementTypeAwareWrite(
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
        normalizedStatementType,
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
      [0]
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    await runStatementTypeAwareWrite(
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
        normalizedStatementType,
        patch.periodStart || null,
        patch.periodEnd || null,
        patch.periodLabel || null,
        patch.currency || null,
        patch.scaling || null,
        patch.overallConfidence ?? null,
        statementId,
      ],
      [0]
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
  const normalizedStatementType = normalizeStatementTypeToken(params.statementType);
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
  const normalizedStatementType = normalizeStatementTypeToken(params.statementType);
  let insertRes;
  try {
    insertRes = await runStatementTypeAwareWrite(
      `INSERT INTO financial_statements (id, organization_id, statement_type, period_start, period_end, period_label, currency, scaling, source_file_name, source_file_path, parse_method, overall_confidence, document_class, extraction_strategy, template_family, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.organizationId,
        normalizedStatementType,
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
      [2]
    );
  } catch (error) {
    if (!isSchemaCompatError(error)) throw error;
    insertRes = await runStatementTypeAwareWrite(
      `INSERT INTO financial_statements (id, organization_id, statement_type, period_start, period_end, period_label, currency, scaling, source_file_name, source_file_path, parse_method, overall_confidence, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.organizationId,
        normalizedStatementType,
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
      [2]
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
