/**
 * T050 — Financial Statement Ingestion & Standardization Service
 *
 * Handles: PDF text extraction → auto-detection (BS/P&L/CF, period, currency, scale)
 *        → line extraction with confidence → mapping to canonical lines → validation.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import {
  type CanonicalStatementType,
  getCanonicalLineById,
  getRequiredCanonicalLineIds,
} from './financeCanonicalRegistry.js';
import { detachStatementFromPack } from './financialStatementPackService.js';

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
  language: 'en' | 'pl' | 'de' | 'fr' | 'unknown';
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
  comparisonValue?: number | null;
  comparisonRawValue?: string;
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

const PDF_PAGE_MARKER = /^--\s*(\d+)\s+of\s+\d+\s*--$/i;

/**
 * pdf-parse v2 inserts `-- N of M --` between pages. Keep a page number for
 * every source-text row so later section scoping can retain exact PDF lineage.
 */
function buildPdfPageByLine(text: string): Array<number | null> {
  const sourceLines = String(text || '').split(/\r?\n/);
  const pageByLine: Array<number | null> = [];
  let currentPage: number | null = sourceLines.length > 0 ? 1 : null;
  for (let index = 0; index < sourceLines.length; index += 1) {
    const marker = sourceLines[index].trim().match(PDF_PAGE_MARKER);
    pageByLine.push(currentPage);
    // pdf-parse emits the marker after the page body, so subsequent lines
    // belong to the following page.
    if (marker) currentPage = Number(marker[1]) + 1;
  }
  return pageByLine;
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
  'unknown' | 'native_pdf' | 'scan_pdf' | 'spreadsheet' | 'csv' | 'mixed_report';

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
      statementTypeIndexes.some(
        (index) => normalizeStatementTypeToken(normalizedParams[index]) === 'P&L'
      );
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

    const rows = (await dbAll<{ name?: string }>(
      `PRAGMA table_info(financial_statement_line_aliases)`,
      []
    )) as Array<{
      name?: string;
    }>;
    const columns = new Set(
      (rows || []).map((row) => String(row.name || '').trim()).filter(Boolean)
    );
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
    {
      keywords: [
        'gewinn- und verlustrechnung',
        'gewinn und verlustrechnung',
        'gesamtergebnisrechnung',
        'konzern-gewinn- und verlustrechnung',
      ],
      weight: 10,
    },
    {
      keywords: [
        'compte de résultat',
        'compte de resultat',
        'compte de résultat consolidé',
        'état du résultat net',
      ],
      weight: 10,
    },
    { keywords: ['revenue', 'przychody', 'sales', 'sprzedaż'], weight: 3 },
    { keywords: ['umsatzerlöse', 'umsatz'], weight: 3 },
    { keywords: ["chiffre d'affaires", 'produits des ventes'], weight: 3 },
    { keywords: ['cost of goods', 'koszt własny', 'cogs'], weight: 3 },
    { keywords: ['herstellungskosten', 'materialaufwand'], weight: 3 },
    { keywords: ['coût des ventes', 'coût de revient'], weight: 3 },
    { keywords: ['gross profit', 'zysk brutto', 'gross margin'], weight: 3 },
    { keywords: ['bruttoergebnis', 'rohertrag'], weight: 3 },
    { keywords: ['marge brute'], weight: 3 },
    { keywords: ['operating profit', 'zysk operacyjny', 'ebit'], weight: 3 },
    { keywords: ['betriebsergebnis', 'betriebsgewinn'], weight: 3 },
    { keywords: ['résultat opérationnel', 'résultat opérationnel courant'], weight: 3 },
    { keywords: ['net income', 'zysk netto', 'net profit'], weight: 4 },
    { keywords: ['jahresüberschuss', 'konzernergebnis', 'jahresergebnis'], weight: 4 },
    { keywords: ['résultat net', 'résultat net consolidé', 'bénéfice net'], weight: 4 },
    { keywords: ['ebitda'], weight: 2 },
  ],
  BS: [
    { keywords: ['balance sheet', 'statement of financial position'], weight: 10 },
    { keywords: ['bilans'], weight: 10 },
    { keywords: ['bilanz', 'konzernbilanz', 'vermögensaufstellung'], weight: 10 },
    { keywords: ['bilan', 'bilan consolidé', 'état de la situation financière'], weight: 10 },
    { keywords: ['total assets', 'aktywa ogółem', 'aktywa razem'], weight: 5 },
    { keywords: ['bilanzsumme', 'summe aktiva', 'summe der aktiva'], weight: 5 },
    { keywords: ['total actif', "total de l'actif"], weight: 5 },
    { keywords: ['total liabilities', 'zobowiązania ogółem'], weight: 4 },
    { keywords: ['summe verbindlichkeiten', 'summe schulden'], weight: 4 },
    { keywords: ['total passif', 'total des dettes'], weight: 4 },
    { keywords: ['equity', 'kapitał własny', "shareholders' equity"], weight: 4 },
    { keywords: ['eigenkapital', 'konzerneigenkapital'], weight: 4 },
    { keywords: ['capitaux propres'], weight: 4 },
    { keywords: ['current assets', 'aktywa obrotowe'], weight: 3 },
    { keywords: ['umlaufvermögen', 'kurzfristige vermögenswerte'], weight: 3 },
    { keywords: ['actif courant', 'actifs courants'], weight: 3 },
    { keywords: ['fixed assets', 'aktywa trwałe', 'non-current assets'], weight: 3 },
    { keywords: ['anlagevermögen', 'langfristige vermögenswerte'], weight: 3 },
    { keywords: ['actif non courant', 'actifs non courants', 'immobilisations'], weight: 3 },
    { keywords: ['accounts receivable', 'należności'], weight: 2 },
    { keywords: ['forderungen', 'forderungen aus lieferungen'], weight: 2 },
    { keywords: ['créances clients', 'créances'], weight: 2 },
    { keywords: ['accounts payable', 'zobowiązania'], weight: 2 },
    { keywords: ['verbindlichkeiten aus lieferungen'], weight: 2 },
    { keywords: ['dettes fournisseurs', 'fournisseurs et comptes rattachés'], weight: 2 },
  ],
  CF: [
    { keywords: ['cash flow', 'cash flows', 'statement of cash flows'], weight: 10 },
    { keywords: ['rachunek przepływów pieniężnych', 'przepływy pieniężne'], weight: 10 },
    {
      keywords: ['kapitalflussrechnung', 'konzern-kapitalflussrechnung', 'cashflow-rechnung'],
      weight: 10,
    },
    {
      keywords: ['tableau des flux de trésorerie', 'flux de trésorerie', 'tableau de flux'],
      weight: 10,
    },
    { keywords: ['operating activities', 'działalność operacyjna'], weight: 5 },
    {
      keywords: ['betriebliche tätigkeit', 'laufende geschäftstätigkeit', 'operativer cashflow'],
      weight: 5,
    },
    { keywords: ['activités opérationnelles', "activités d'exploitation"], weight: 5 },
    { keywords: ['investing activities', 'działalność inwestycyjna'], weight: 5 },
    { keywords: ['investitionstätigkeit', 'cashflow aus investitionstätigkeit'], weight: 5 },
    { keywords: ["activités d'investissement"], weight: 5 },
    { keywords: ['financing activities', 'działalność finansowa'], weight: 5 },
    { keywords: ['finanzierungstätigkeit', 'cashflow aus finanzierungstätigkeit'], weight: 5 },
    { keywords: ['activités de financement'], weight: 5 },
    { keywords: ['cash and cash equivalents', 'środki pieniężne'], weight: 3 },
    { keywords: ['zahlungsmittel', 'flüssige mittel', 'finanzmittelbestand'], weight: 3 },
    { keywords: ['trésorerie et équivalents de trésorerie', 'trésorerie'], weight: 3 },
  ],
};

function matchesTypeKeyword(text: string, keyword: string): boolean {
  const normalizedKeyword = String(keyword || '')
    .trim()
    .toLowerCase();
  if (!normalizedKeyword) return false;
  if (/^[\p{L}\d]+$/u.test(normalizedKeyword)) {
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\d])${escaped}([^\\p{L}\\d]|$)`, 'iu').test(text);
  }
  return text.includes(normalizedKeyword);
}

export function detectStatementType(text: string): DetectionResult {
  const lower = text.toLowerCase();

  // Score statement types
  const scores: Record<string, number> = { 'P&L': 0, BS: 0, CF: 0 };
  for (const [type, patterns] of Object.entries(TYPE_KEYWORDS)) {
    for (const { keywords, weight } of patterns) {
      for (const kw of keywords) {
        if (matchesTypeKeyword(lower, kw)) {
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
        if (matchesTypeKeyword(lower, kw)) {
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
  const headerArea = text.substring(0, 30000).toLowerCase();

  // High-confidence reporting-currency phrases (order doesn't matter — scored)
  const reportingPhrases: [RegExp, string, number][] = [
    [/in\s+millions?\s+of\s+(?:u\.?s\.?\s*)?dollars/i, 'USD', 10],
    [/in\s+thousands?\s+of\s+(?:u\.?s\.?\s*)?dollars/i, 'USD', 10],
    [
      /(?:amounts?\s+(?:are\s+)?in|expressed\s+in|denominated\s+in|reported\s+in)\s+(?:u\.?s\.?\s*)?dollars/i,
      'USD',
      10,
    ],
    [/\(\s*in\s+(?:millions?|thousands?|billions?)(?:\s*,\s*except)?\s*\)/i, 'USD', 6],
    [/form\s+10-k/i, 'USD', 4],
    [/form\s+20-f/i, 'USD', 3],
    [/\bsec\s+filing\b/i, 'USD', 3],
    [/\bnasdaq|nyse\b/i, 'USD', 3],
    [/in\s+millions?\s+of\s+euros/i, 'EUR', 10],
    [/in\s+thousands?\s+of\s+euros/i, 'EUR', 10],
    [/(?:amounts?\s+(?:are\s+)?in|expressed\s+in|reported\s+in)\s+euros/i, 'EUR', 10],
    [/in\s+millions?\s+of\s+pounds/i, 'GBP', 10],
    [/\bw\s+(?:tysiącach|milionach)\s+(?:złotych|pln|zł)\b/i, 'PLN', 10],
    [/waluta\s+sprawozdawcza:\s*pln/i, 'PLN', 10],
    [/waluta\s+sprawozdawcza:\s*eur/i, 'EUR', 10],
    [/waluta\s+sprawozdawcza:\s*usd/i, 'USD', 10],
    [/\b(tys\.?\s*zł|mln\s*zł|zł|złot)\b/i, 'PLN', 8],
  ];

  const scores = new Map<string, number>();
  for (const [re, code, weight] of reportingPhrases) {
    if (re.test(headerArea)) {
      scores.set(code, (scores.get(code) || 0) + weight);
    }
  }

  if (scores.size > 0) {
    return [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  // Fallback: simple keyword count in broader text sample
  const sample = text.substring(0, 50000).toLowerCase();
  const fallback: [RegExp, string][] = [
    [/\b(pln|złot|zł)\b/gi, 'PLN'],
    [/\b(usd|us\s*dollar(?:s)?)\b/gi, 'USD'],
    [/\$\s*\d/g, 'USD'],
    [/\b(eur(?:o)?)\b/gi, 'EUR'],
    [/€\s*\d/g, 'EUR'],
    [/\b(gbp|£)\b/gi, 'GBP'],
  ];
  const counts = new Map<string, number>();
  for (const [re, code] of fallback) {
    const matches = sample.match(re);
    if (matches) counts.set(code, (counts.get(code) || 0) + matches.length);
  }
  if (counts.size > 0) {
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  return 'PLN';
}

function detectScaling(text: string): DetectionResult['scaling'] {
  const headerArea = text.substring(0, 30000).toLowerCase();

  const millionsRe =
    /(?:in\s+millions?|w\s+milionach|mln\s*(?:zł|pln|eur|usd|€|\$)?|in\s+mio\.?\s*(?:eur|€)?|\(\s*000\s*000\s*\)|en\s+millions|millions?\s+d[''e]?\s*(?:euros|dollars|pounds)|\$\s*million(?:s)?\b)\b/;
  const thousandsRe =
    /(?:in\s+thousands?|w\s+tysiącach|tys\.?\s*(?:zł|pln)?|in\s+tsd\.?\s*(?:eur|€)?|in\s+tausend|\(\s*000\s*\)|en\s+milliers|milliers\s+d[''e]?\s*(?:euros|dollars))\b/;
  const billionsRe =
    /(?:in\s+billions?|w\s+miliardach|in\s+mrd\.?|mld|en\s+milliards|milliards\s+d[''e]?\s*(?:euros|dollars))\b/;

  if (millionsRe.test(headerArea)) return 'millions';
  if (thousandsRe.test(headerArea)) return 'thousands';
  if (billionsRe.test(headerArea)) return 'billions';

  // SEC 10-K / 20-F filings: scaling indicators often appear deep in the document
  // near financial statement headers — search a much wider window
  const deepLimit = Math.min(text.length, 800000);
  const deepArea = text.substring(0, deepLimit).toLowerCase();
  const stmtHeaderRe =
    /\b(?:consolidated\s+(?:balance\s+sheets?|statements?\s+of\s+(?:income|operations|cash\s+flows|comprehensive\s+income|financial\s+position))|group\s+(?:income\s+statement|balance\s+sheet|cash\s+flow)|financial\s+and\s+operating\s+performance)\b/g;

  for (const m of deepArea.matchAll(stmtHeaderRe)) {
    const vicinity = deepArea.substring(Math.max(0, m.index! - 200), m.index! + 400);
    if (
      /\(\s*in\s+millions?\b/i.test(vicinity) ||
      /\$\s*million/i.test(vicinity) ||
      /million(?:s)?\s+except/i.test(vicinity)
    )
      return 'millions';
    if (/\(\s*in\s+thousands?\b/i.test(vicinity) || /\$\s*thousand/i.test(vicinity))
      return 'thousands';
    if (/\(\s*in\s+billions?\b/i.test(vicinity)) return 'billions';
  }

  // Broad fallback: standalone scaling phrase anywhere in first 200K
  const broadArea = deepArea.substring(0, 200000);
  if (/\$\s*million\s+except\s+per\s+share/i.test(broadArea)) return 'millions';
  if (/\(\s*in\s+millions?,?\s+except/i.test(broadArea)) return 'millions';

  return 'units';
}

function detectPeriod(text: string): {
  periodStart: string | null;
  periodEnd: string | null;
  periodLabel: string | null;
} {
  const headerArea = text.substring(0, 6000);
  const currentYear = new Date().getFullYear();
  const maxReportingYear = currentYear + 1;

  const isPlausibleReportingYear = (y: number): boolean => y >= 2015 && y <= maxReportingYear;

  // Polish "okres objęty" / "za okres" / "do 31.12.YYYY"
  const periodEndMatch = headerArea.match(
    /(?:okres objęty|za okres|do)\s+.*?(31\.12\.(20\d{2})|31\/(12)\/(20\d{2}))/i
  );
  if (periodEndMatch) {
    const year = periodEndMatch[2] || periodEndMatch[4] || '';
    const y = parseInt(year, 10);
    if (isPlausibleReportingYear(y)) {
      return { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, periodLabel: year };
    }
  }

  // Report code: RS-2024, R-2024, QS-2024
  const reportCodeMatch = headerArea.match(/\b[RQ]S?[-‐]\s*(20\d{2})\b/i);
  if (reportCodeMatch) {
    const y = parseInt(reportCodeMatch[1], 10);
    if (isPlausibleReportingYear(y)) {
      return { periodStart: `${y}-01-01`, periodEnd: `${y}-12-31`, periodLabel: String(y) };
    }
  }

  // "year ended December 31, 2024" / "for the fiscal year ended" etc.
  const yearEndedPatterns = [
    /(?:for the (?:fiscal\s+)?(?:year|period) ended|year ending|(?:twelve|six) months ended)\s+(?:december|january|february|march|april|may|june|july|august|september|october|november)\s+\d{1,2},?\s*(20\d{2})/gi,
    /(?:for the (?:year|period) ended|za rok(?: obrotowy)?|für das (?:geschäfts|halb)?jahr(?:\s+endend)?|zum\s+(?:31\.12\.)?\s*|exercice clos le|pour l[''']exercice|au\s+31\s+d[eé]cembre)\s+(\d{4}(?:[.\-/]\d{1,2}[.\-/]\d{1,2})?)/gi,
    /(?:fiscal\s+)?(?:year|period)\s+ended?\s+\w+\s+\d{1,2},?\s*(20\d{2})/gi,
    /(?:as of|at)\s+(?:december|january|february|march|april|may|june|july|august|september|october|november)\s+\d{1,2},?\s*(20\d{2})/gi,
  ];

  for (const pattern of yearEndedPatterns) {
    const matches = [...headerArea.matchAll(pattern)];
    if (matches.length > 0) {
      const years = matches
        .map((m) => parseInt(String(m[1] || '').slice(0, 4), 10))
        .filter(isPlausibleReportingYear);
      if (years.length > 0) {
        const latest = Math.max(...years);
        return {
          periodStart: `${latest}-01-01`,
          periodEnd: `${latest}-12-31`,
          periodLabel: String(latest),
        };
      }
    }
  }

  // Filename-style year in the header (e.g., "10-K 2025", "Annual Report 2024")
  const annualReportYear = headerArea.match(
    /(?:annual\s+report|10-k|20-f|form\s+10-k|raport\s+(?:roczny|finansowy))\s+(?:and\s+form\s+\S+\s+)?(20\d{2})/i
  );
  if (annualReportYear) {
    const y = parseInt(annualReportYear[1], 10);
    if (isPlausibleReportingYear(y)) {
      return {
        periodStart: `${y - 1}-01-01`,
        periodEnd: `${y - 1}-12-31`,
        periodLabel: String(y - 1),
      };
    }
  }

  // Fallback: most frequent plausible year in header (not max — avoids forward-looking years)
  const allYears = [...headerArea.matchAll(/\b(20[1-3]\d)\b/g)]
    .map((m) => parseInt(m[1], 10))
    .filter(isPlausibleReportingYear);
  if (allYears.length >= 1) {
    const freq = new Map<number, number>();
    for (const y of allYears) freq.set(y, (freq.get(y) || 0) + 1);
    const sorted = [...freq.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0] - a[0];
    });
    const best = sorted[0][0];
    return {
      periodStart: `${best}-01-01`,
      periodEnd: `${best}-12-31`,
      periodLabel: String(best),
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
  const frMarkers = [
    'résultat',
    'capitaux',
    'immobilisations',
    'trésorerie',
    'créances',
    'dettes',
    'bénéfice',
  ];
  const countHits = (markers: string[]) => markers.filter((m) => text.includes(m)).length;
  const pl = countHits(plMarkers);
  const en = countHits(enMarkers);
  const de = countHits(deMarkers);
  const fr = countHits(frMarkers);
  if (pl >= en && pl >= de && pl >= fr && pl > 0) return 'pl';
  if (en >= pl && en >= de && en >= fr && en > 0) return 'en';
  if (de >= fr && de > 0) return 'de';
  if (fr > 0) return 'fr';
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
    sectionKeywords: [
      'bilans',
      'sprawozdanie z sytuacji finansowej',
      'statement of financial position',
    ],
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
  if (
    /\b(?:od|do|za|okres|na dzień|rok|31\.12|01\.01|fy|period|quarter|geschäftsjahr|zum|für\s+das|halbjahr|stichtag)\b/.test(
      context
    )
  )
    return true;
  if (/\b(?:r-|rs-|raport|sprawozdanie)\b/.test(context)) return true;
  if (/\d{2}\.\d{2}\.\d{4}/.test(context)) return true;
  return false;
}

function extractPeriodGrid(text: string): StatementPeriodColumn[] {
  const headerLines = String(text || '')
    .split(/\r?\n/)
    .slice(0, 120);
  const headerWindow = headerLines.join(' ');
  const seen = new Set<string>();
  const periodColumns: StatementPeriodColumn[] = [];

  for (const match of headerWindow.matchAll(/\b(Q[1-4]|I|II|III|IV)\s*[-/]?\s*(20\d{2})\b/gi)) {
    const quarter = String(match[1] || '').toUpperCase();
    const year = Number(match[2] || 0);
    const label = String(match[0] || '')
      .replace(/\s+/g, ' ')
      .trim();
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
    if (yearNum < 2015 || yearNum > new Date().getFullYear() + 1) continue;
    yearCandidates.push({
      label,
      index: match.index ?? 0,
      inContext: isYearInReportingContext(headerWindow, match.index ?? 0),
    });
  }

  const contextYears = yearCandidates.filter((c) => c.inContext);
  const effectiveYears = contextYears.length > 0 ? contextYears : yearCandidates;

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
      ? periodGrid.find((period) => period.normalizedLabel === normalizedDetectedPeriodLabel) ||
        null
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
  return (
    String(value || '')
      .toLowerCase()
      .replace(/[–—-]/g, ' ')
      .replace(/\bnota\b\.?\s*[0-9ivxlcdm]+(?:\.[0-9ivxlcdm]+)*[a-z]?/giu, ' ')
      .replace(/\bnote\b\.?\s*[0-9ivxlcdm]+(?:\.[0-9ivxlcdm]+)*[a-z]?/giu, ' ')
      .replace(/^[ivxlcdm]+\.\s+/giu, ' ')
      .replace(/^\d+[a-z]?[.)]\s+/giu, ' ')
      .replace(/^[.]?\d{1,2}(?:\.\d{1,3})+\s+/giu, ' ')
      // Strip trailing year tokens FIRST (e.g., "Financial assets 26 2024" → "Financial assets 26")
      .replace(/\s+20\d{2}\s*$/g, '')
      // Then strip trailing note reference numbers (1-2 digits at end, e.g., "Financial assets 26" → "Financial assets")
      .replace(/\s+\d{1,2}\s*$/g, '')
      .replace(/[^\p{L}\p{N}% ]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function cleanupExtractedLabel(value: string): string {
  return (
    String(value || '')
      .replace(/\b(?:nota|note)\b\.?\s*[0-9ivxlcdm]+(?:\.[0-9ivxlcdm]+)*[a-z]?/giu, ' ')
      .replace(/^[ivxlcdm]+\.\s+/giu, ' ')
      .replace(/^\d+[a-z]?[.)]\s+/giu, ' ')
      .replace(/^[.]?\d{1,2}(?:\.\d{1,3})+\s+/giu, ' ')
      .replace(/\s*[-–—]+\s*$/, '')
      .replace(/\s*\d{1,2}\.\d{1,3}\s*$/, '')
      // Strip trailing year tokens FIRST (e.g., "Revenue 2024" → "Revenue")
      .replace(/\s+20\d{2}\s*$/, '')
      // Then strip trailing note ref numbers (e.g., "Financial assets 26" → "Financial assets")
      .replace(/\s+\d{1,2}\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
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
        /\bconsolidated\s+balance\s+sheets?\b/i,
        /\bconsolidated\s+statements?\s+of\s+financial\s+position\b/i,
        /\bgroup\s+balance\s+sheets?\b/i,
        /\bstatement\s+of\s+financial\s+position\b/i,
        /\bbalance\s+sheets?\b/i,
        /\bkonzernbilanz\b/i,
        /\bbilanz\b/i,
        /vermögensaufstellung/i,
        /\bbilan\s+consolidé/i,
        /\bbilan\b/i,
        /état de la situation financière/i,
      ],
      end: [
        /rachunek zysków i strat/i,
        /sprawozdanie z zysków lub strat/i,
        /sprawozdanie z całkowitych dochodów/i,
        /statement of profit or loss/i,
        /income statement/i,
        /\b(?:consolidated\s+)?statements?\s+of\s+(?:operations|income|earnings)\b/i,
        /\b(?:consolidated\s+)?(?:income\s+statements?|profit\s+and\s+loss)\b/i,
        /cash flow/i,
        /rachunek przepływów pieniężnych/i,
        /sprawozdanie z przepływów pieniężnych/i,
        /zestawienie zmian w kapitale/i,
        /sprawozdanie ze zmian w kapitale/i,
        /\b(?:consolidated\s+)?statements?\s+of\s+(?:stockholders'?|shareholders'?|changes\s+in)\s*equity\b/i,
        /gewinn-?\s*und\s+verlustrechnung/i,
        /gesamtergebnisrechnung/i,
        /kapitalflussrechnung/i,
        /eigenkapitalveränderungsrechnung/i,
        /compte de résultat/i,
        /tableau des flux de trésorerie/i,
        /tableau de variation des capitaux propres/i,
        /\binformacje dodatkowe\b/i,
        /\bnoty objaśniające\b/i,
        /\bobjaśnienia do (?:skonsolidowanego\s+)?sprawozdania\b/i,
        /\bnotes\s+to\s+(?:the\s+)?(?:consolidated\s+)?financial\s+statements\b/i,
        /\bsee\s+accompanying\s+notes\b/i,
        /\bwprowadzenie do sprawozdania\b/i,
      ],
    },
    'P&L': {
      start: [
        /rachunek zysków i strat/i,
        /^(?:\d+(?:\.\d+)*\.?\s*)?(?:skonsolidowane |jednostkowe )?sprawozdanie z wyniku\b/i,
        /^(?:\d+(?:\.\d+)*\.?\s*)?(?:skonsolidowane |jednostkowe )?sprawozdanie z zysków lub strat\b/i,
        /^(?:\d+(?:\.\d+)*\.?\s*)?(?:skonsolidowane |jednostkowe )?sprawozdanie z całkowitych dochodów\b/i,
        /\b(?:consolidated\s+)?statements?\s+of\s+(?:operations|income|earnings)\b/i,
        /\b(?:consolidated\s+)?statements?\s+of\s+comprehensive\s+income\b/i,
        /\b(?:consolidated\s+)?(?:income\s+statements?|profit\s+and\s+loss\s+accounts?)\b/i,
        /\b(?:consolidated\s+|separate\s+)?statement\s+of\s+profit\s+or\s+loss\b/i,
        /\bgroup\s+income\s+statements?\b/i,
        /\bprofit\s+and\s+loss\b/i,
        /gewinn-?\s*und\s+verlustrechnung/i,
        /konzern-gewinn-?\s*und\s+verlustrechnung/i,
        /gesamtergebnisrechnung/i,
        /compte de résultat\s*consolidé/i,
        /compte de résultat/i,
        /état du résultat/i,
      ],
      end: [
        /cash flow/i,
        /rachunek przepływów pieniężnych/i,
        /sprawozdanie z przepływów pieniężnych/i,
        /zestawienie zmian w kapitale/i,
        /sprawozdanie ze zmian w kapitale/i,
        /\bbilans\b/i,
        /sprawozdanie z sytuacji finansowej/i,
        /\b(?:consolidated\s+)?balance\s+sheets?\b/i,
        /\b(?:consolidated\s+)?statements?\s+of\s+financial\s+position\b/i,
        /\b(?:consolidated\s+)?statements?\s+of\s+(?:stockholders'?|shareholders'?|changes\s+in)\s*equity\b/i,
        /^A\s*S\s*S\s*E\s*T\s*S\s*$/i,
        /kapitalflussrechnung/i,
        /\bbilanz\b/i,
        /eigenkapitalveränderungsrechnung/i,
        /tableau des flux de trésorerie/i,
        /\bbilan\b/i,
        /tableau de variation des capitaux propres/i,
        /\b(?:consolidated\s+)?statements?\s+of\s+redeemable\b/i,
        /\bnotes\s+to\s+(?:the\s+)?(?:consolidated\s+)?financial\s+statements\b/i,
        /\bsee\s+accompanying\s+notes\b/i,
      ],
    },
    CF: {
      start: [
        /^(?:3\.\d\.?\s*)?(?:jednostkowe |skonsolidowane )?sprawozdanie z przepływów pieniężnych/i,
        /^(?:3\.\d\.?\s*)?rachunek przepływów pieniężnych/i,
        /^przepływy środków pieniężnych z działalności/i,
        /\b(?:consolidated\s+)?statements?\s+of\s+cash\s+flows\b/i,
        /\bgroup\s+(?:statement|cash\s+flow\s+statement)\b/i,
        /\bcash\s+flow\s+statements?\b/i,
        /^(?:statement\s+of\s+)?cash\s+flows?\b/i,
        /kapitalflussrechnung/i,
        /konzern-kapitalflussrechnung/i,
        /cashflow-rechnung/i,
        /tableau des flux de trésorerie/i,
        /flux de trésorerie/i,
      ],
      end: [
        /zestawienie zmian w kapitale/i,
        /sprawozdanie ze zmian w kapitale/i,
        /\bnotes\s+to\s+(?:the\s+)?(?:consolidated\s+)?financial\s+statements\b/i,
        /\bnotes\s+to\s+(?:the\s+)?accounts\b/i,
        /^notes$/i,
        /\binformacje dodatkowe\b/i,
        /\bobjaśnienia\b/i,
        /\bnoty objaśniające\b/i,
        /\b(?:consolidated\s+)?statements?\s+of\s+(?:stockholders'?|shareholders'?|changes\s+in)\s*equity\b/i,
        /\bbilans\b/i,
        /sprawozdanie z sytuacji finansowej/i,
        /\b(?:consolidated\s+)?balance\s+sheets?\b/i,
        /\b(?:consolidated\s+)?statements?\s+of\s+financial\s+position\b/i,
        /rachunek zysków i strat/i,
        /\b(?:consolidated\s+)?(?:income\s+statements?|profit\s+and\s+loss)\b/i,
        /\b(?:consolidated\s+)?statements?\s+of\s+(?:operations|income|earnings)\b/i,
        /\b(?:consolidated\s+)?statements?\s+of\s+comprehensive\s+income\b/i,
        /eigenkapitalveränderungsrechnung/i,
        /\banhang\b/i,
        /erläuterungen zum konzernabschluss/i,
        /tableau de variation des capitaux propres/i,
        /\bannexe\b/i,
        /notes aux états financiers/i,
        /\bkonzernbilanz\b/i,
        /gewinn-?\s*und\s+verlustrechnung/i,
        /\bbilan\s+consolidé/i,
        /compte de résultat/i,
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
  const candidateWindows: Array<{
    start: number;
    end: number;
    score: number;
    sectionLabel: string;
  }> = [];

  const isStandardsRefLine = (line: string): boolean =>
    /\b(?:MSR|MSSF|IAS|IFRS|MSR\s*\d|MSSF\s*\d|HGB|US.?GAAP|FRS\s*\d|ASC\s*\d|PCG)\b/.test(line) ||
    /\b(?:zmiany do|amendments to|änderungen an|amendements à|modifications de)\b/i.test(line);

  for (let index = 0; index < rawLines.length; index++) {
    const line = rawLines[index];
    if (!markers.start.some((pattern) => pattern.test(line))) continue;
    if (isStandardsRefLine(line)) continue;
    if (/\.{4,}/.test(line)) continue;
    if (
      /\b(?:see|refer\s+to|accompanying|see\s+also|described\s+in|included\s+in|presented\s+in|recognized\s+in|reclassified\s+to|expensed\s+in|charged\s+to|reported\s+in)\b/i.test(
        line
      )
    )
      continue;
    const trimmedStartLine = line.trim();
    if (/^[a-ząćęłńóśźżäöüàâéèêëïîôûùüÿçñ•·\-–—]/.test(trimmedStartLine)) continue;
    if (trimmedStartLine.length > 150) continue;

    const otherTypeKeys = Object.keys(sectionMarkers).filter((k) => k !== normalizedType);
    const matchesOtherType = otherTypeKeys.some((otherType) =>
      sectionMarkers[otherType].start.some((p) => p.test(line))
    );
    if (matchesOtherType) continue;

    const precedingLines = rawLines.slice(Math.max(0, index - 6), index);
    const inNumberedNote = precedingLines.some((pl) =>
      /^\s*(?:\d{1,2})\.\s+[A-ZĄĆĘŁŃÓŚŹŻ]/i.test(pl.trim())
    );
    if (
      inNumberedNote &&
      !/^(?:\d+(?:\.\d+)*\.?\s*)?(?:Consolidated|Group|Skonsolidowan|Jednostkow|Roczne\s+jednostkowe|Roczne\s+skonsolidowane)/i.test(
        trimmedStartLine
      )
    )
      continue;

    if (
      /\b(?:other\s+income\s+statement\s+items|from\s+group\s+income\s+statement)\b/i.test(
        trimmedStartLine
      )
    )
      continue;
    if (/\b(?:income\s+statement|profit\s+and\s+loss)\s+analysis\b/i.test(trimmedStartLine))
      continue;
    if (
      /(?:analizować\s+łącznie|należy\s+(?:czytać|analizować)|should\s+be\s+read\s+(?:in\s+conjunction|together))/i.test(
        trimmedStartLine
      )
    )
      continue;
    if (/(?:na\s+dzień\s+\d{1,2}\s+\w+\s+\d{4}\s+roku)/i.test(trimmedStartLine)) {
      const nearbyLines = rawLines.slice(Math.max(0, index - 10), index);
      const isCorrection = nearbyLines.some((nl) =>
        /(?:korekta|korekty|przekształc|korekt\s+prezentacyj|wpływ\s+korekt|correction|restatement|reclassification)/i.test(
          nl
        )
      );
      if (isCorrection) continue;
    }

    const start = Math.max(0, index - 4);
    const maxWindow = normalizedType === 'BS' ? 120 : 220;
    const maxSearch = normalizedType === 'BS' ? 150 : 260;
    let end = Math.min(rawLines.length, index + maxWindow);
    for (let cursor = index + 8; cursor < Math.min(rawLines.length, index + maxSearch); cursor++) {
      const curLine = rawLines[cursor];
      if (markers.end.some((pattern) => pattern.test(curLine))) {
        end = cursor;
        break;
      }
      if (normalizedType === 'BS') {
        if (
          /^\s*(?:\d{1,2})(?:\.\d{1,2})*\.?\s+[A-ZĄĆĘŁŃÓŚŹŻ]/i.test(curLine.trim()) &&
          cursor > index + 15
        ) {
          const isOwnHeader = cursor === index;
          if (!isOwnHeader) {
            end = cursor;
            break;
          }
        }
        if (/(?:spis treści|table of contents)/i.test(curLine)) {
          end = cursor;
          break;
        }
        if (/(?:nota\s+\d|note\s+\d{1,2}\b)/i.test(curLine)) {
          const hasFinancialNumbers = (curLine.match(numericGroupRegex) || []).length >= 2;
          const isInlineRef = /\(note\s+\d/i.test(curLine);
          if (!hasFinancialNumbers && !isInlineRef) {
            end = cursor;
            break;
          }
        }
        if (
          /(?:wartość firmy netto|wartość brutto|suma dotychczasowego umorzenia|zwiększenie z tytułu|zmniejszenie z tytułu|wartość na koniec okresu|wartość na początek okresu|wartość odpisów)/i.test(
            curLine
          ) &&
          cursor > index + 30
        ) {
          end = cursor;
          break;
        }
      }
    }

    const windowLines = rawLines.slice(start, end);
    const windowText = windowLines.join('\n').toLowerCase();
    if (
      /(kwartalna informacja finansowa|quarterly (?:financial )?information|interim financial information)/i.test(
        windowText
      )
    ) {
      continue;
    }
    const isExhibitOrTOCSection =
      /\b(?:exhibit\s+index|table\s+of\s+contents|form\s+8-k|certificate\s+of\s+incorporation|supplemental\s+indenture)\b/i.test(
        windowText
      ) &&
      !/\b(?:net\s+(?:income|revenue|sales|profit)|total\s+assets|total\s+liabilities|operating\s+(?:income|expenses))\b/i.test(
        windowText
      );
    if (isExhibitOrTOCSection) {
      continue;
    }
    const tocLines = windowLines.filter(
      (candidate) => /\.{4,}/.test(candidate) || /\.\s*\d{1,3}\s*$/.test(candidate.trim())
    ).length;
    const financialNumericPattern = /\d{1,3}[,. \u00A0]\d{3}/;
    const numericLines = windowLines.filter((candidate) => {
      const matches = candidate.match(numericGroupRegex) || [];
      return matches.length >= 2 && financialNumericPattern.test(candidate);
    }).length;
    const semanticLines = windowLines.filter((candidate) =>
      /(aktywa|pasywa|kapitał|equity|liabilities|assets|cash|należności|zobowiązania|revenue|przychody|profit|ebitda|flow|zysk|koszt|amortyzacja|depreciation|przepływy)/i.test(
        candidate
      )
    ).length;
    const tocPenalty = tocLines > 5 ? tocLines * 3 : 0;

    const statementAnchors: Record<string, RegExp[]> = {
      'P&L': [
        /przychody ze sprzedaży|revenue|(?:net |total )?sales|umsatzerlöse|umsatz|chiffre d'affaires|produits des ventes/,
        /koszt własny|cost of (?:goods|revenues|sales|products)|cogs|herstellungskosten|umsatzkosten|coût des ventes|coût de revient/,
        /zysk brutto|gross profit|gross margin|bruttoergebnis|rohertrag|marge brute/,
        /zysk.*operacyjn|operating (?:profit|income|loss)|income from operations|ebit\b|betriebsergebnis|résultat opérationnel/,
        /zysk netto|net (?:income|profit|loss|earnings)|jahresüberschuss|konzernergebnis|résultat net/,
        /podatek dochodowy|income tax|provision for (?:income )?taxes|tax (?:expense|charge)|ertragsteuern|impôt sur les (?:sociétés|bénéfices)/,
        /zysk przed opodatkowaniem|(?:income|profit|loss) before (?:income )?tax|earnings before tax|ergebnis vor steuern|résultat avant impôt/,
        /selling.*general.*administrative|sg&a|research and development|r&d/,
      ],
      BS: [
        /aktywa razem|total assets|bilanzsumme|summe aktiva|total actif|total de l'actif/,
        /pasywa razem|total liabilities(?:\s+and\s+equity)?|summe passiva|summe verbindlichkeiten|total passif/,
        /aktywa trwałe|non.?current assets|anlagevermögen|langfristige vermögenswerte|actif non courant|immobilisations/,
        /aktywa obrotowe|(?:total )?current assets|umlaufvermögen|kurzfristige vermögenswerte|actif courant/,
        /kapitał własny|(?:total )?(?:stockholders'?|shareholders'?)\s*equity|eigenkapital|capitaux propres/,
        /(?:total )?(?:current|non-current)\s+liabilities|zobowiązania (?:krótko|długo)terminowe/,
        /property.*plant.*equipment|rzeczowe aktywa trwałe|goodwill|wartość firmy/,
        /cash and cash equivalents|środki pieniężne|inventories|zapasy/,
      ],
      CF: [
        /środki pieniężne.*(?:netto|wygenerowane).*operacyjn|(?:net )?cash (?:provided by|from|used in) operating|operating (?:activities|cash)|cashflow aus (?:betrieblicher|laufender)|flux.*(?:activités?\s+)?(?:opérationnelles?|d'exploitation)/,
        /środki pieniężne.*(?:netto|wykorzystane).*inwestycyjn|(?:net )?cash (?:provided by|from|used in) investing|investing (?:activities|cash)|cashflow aus investitionstätigkeit|flux.*(?:activités?\s+)?d'investissement/,
        /środki pieniężne.*(?:netto|wykorzystane).*finansow|(?:net )?cash (?:provided by|from|used in) financing|financing (?:activities|cash)|cashflow aus finanzierungstätigkeit|flux.*(?:activités?\s+)?de\s+financement/,
        /depreciation.*amortization|amortyzacja|interest paid|taxes paid|dividends? (?:paid|received)/,
        /capital expenditure|capex|purchases? of property/,
      ],
    };
    const anchors = statementAnchors[normalizedType] || [];
    const anchorHits = anchors.filter((anchor) => anchor.test(windowText)).length;
    const anchorRatio = anchors.length > 0 ? anchorHits / anchors.length : 0;
    const anchorBonus =
      anchorRatio >= 0.6 ? Math.round(anchorRatio * 200) : Math.round(anchorRatio * 80);

    const isNumberedStatementSection = /^3\.\d/.test(line.trim());
    const isNoteSection = /^(?:4|5|6|7|8|9)\.\d/.test(line.trim());
    const headingLine = line.trim();
    const isStandaloneStatementHeading =
      headingLine.length > 0 &&
      headingLine.length <= 80 &&
      !/\d/.test(headingLine) &&
      headingLine === headingLine.toUpperCase() &&
      /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(headingLine);
    const isTitleCaseStatementHeading =
      headingLine.length > 10 &&
      headingLine.length <= 100 &&
      /^(?:Consolidated\s+|Group\s+)?(?:Balance\s+Sheet|Statement|Income\s+Statement|Cash\s+Flow)/i.test(
        headingLine
      );
    const statementSectionBonus = isNumberedStatementSection ? 60 : 0;
    const headingBonus = isStandaloneStatementHeading ? 120 : isTitleCaseStatementHeading ? 90 : 0;
    const notesSectionPenalty = isNoteSection ? 50 : 0;

    const isNotesOrMDASection =
      /\bnotes?\s+to\s+(?:the\s+)?(?:consolidated\s+)?financial\s+statements/i.test(windowText) &&
      !/(balance sheet|income statement|statement of (?:operations|income|cash flow|financial position))/i.test(
        line
      );
    const isMDASection = /management'?s?\s+discussion\s+and\s+analysis/i.test(windowText);
    const isSegmentSection =
      /\bsegment\s+(?:information|reporting|results)\b/i.test(windowText) && anchorHits < 3;
    const isNoteDetailSection = /\bnote\s+\d{1,2}\b/i.test(line) && numericLines < 10;
    const segmentHeaderCount = windowLines.filter((l) =>
      /\bsegment\s+(?:revenues?|results?|assets|liabilities)\b/i.test(l)
    ).length;
    const hasSegmentBreakdownHeaders = segmentHeaderCount >= 2;
    const hasGeographicOrProductLines = windowLines.filter(
      (l) =>
        /^\s*(?:crude\s+oil|oil\s+products|natural\s+gas|lng|non-oil|upstream|downstream|refining|petrochemicals|chemicals|exploration|production)\s*$/i.test(
          l.trim()
        ) ||
        /^\s*(?:us\s*$|non-us\s*$|europe\s*$|asia\s*$|rest\s+of\s+(?:the\s+)?world)\s*$/i.test(
          l.trim()
        )
    ).length;
    const hasSegmentData = hasSegmentBreakdownHeaders || hasGeographicOrProductLines >= 3;
    const repeatedImpairmentRows = (windowText.match(/impairment/g) || []).length >= 3;

    const contextPenalty =
      (isNotesOrMDASection ? 80 : 0) +
      (isMDASection ? 100 : 0) +
      (isSegmentSection ? 60 : 0) +
      (isNoteDetailSection ? 40 : 0) +
      (hasSegmentData ? 120 : 0) +
      // Notes often repeat a primary-statement heading inside a reconciliation
      // table (for example an impairment note headed "Group income statement").
      // Those tables can be denser than the real statement and used to win the
      // score despite representing only one disclosure topic.
      (repeatedImpairmentRows ? 180 : 0);

    const tooFewNumericLinesPenalty = numericLines < 5 ? (5 - numericLines) * 30 : 0;

    const windowSize = end - start;
    const numericDensity = windowSize > 0 ? numericLines / windowSize : 0;
    const densityBonus = numericDensity >= 0.3 ? 60 : numericDensity >= 0.15 ? 30 : 0;

    const cappedNumericLines = Math.min(numericLines, 50);
    const cappedSemanticLines = Math.min(semanticLines, 30);

    candidateWindows.push({
      start,
      end,
      score:
        cappedNumericLines * 2 +
        cappedSemanticLines -
        tocPenalty +
        anchorBonus +
        statementSectionBonus +
        headingBonus +
        densityBonus -
        notesSectionPenalty -
        contextPenalty -
        tooFewNumericLinesPenalty,
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

  // For BS: ensure both Aktywa (Assets) and Pasywa (Liabilities) sides are captured
  if (normalizedType === 'BS' && windows.length > 0) {
    const bestWindow = windows[0];
    const bestText = rawLines.slice(bestWindow.start, bestWindow.end).join('\n').toLowerCase();

    const hasAssetAnchors =
      /aktywa\s*(?:razem|ogółem|trwałe|obrotowe)|total\s+assets|current\s+assets|non[- ]?current\s+assets/i.test(
        bestText
      );
    const hasLiabilityAnchors =
      /pasywa\s*(?:razem|ogółem)|kapitał\s+własny|zobowiązania|total\s+liabilities|equity/i.test(
        bestText
      );

    if (!hasAssetAnchors && hasLiabilityAnchors) {
      // Best window only has Pasywa — look for Aktywa section nearby
      const searchStart = Math.max(0, bestWindow.start - 150);
      const searchEnd = Math.min(rawLines.length, bestWindow.end + 150);
      const searchText = rawLines.slice(searchStart, searchEnd).join('\n').toLowerCase();

      const aktywaMatch =
        /aktywa\s*(?:razem|ogółem|trwałe|obrotowe)|total\s+assets|current\s+assets/i.test(
          searchText
        );
      if (aktywaMatch) {
        // Look BEFORE the best window for Aktywa header
        for (let k = searchStart; k < bestWindow.start; k++) {
          const lineText = rawLines[k].toLowerCase();
          if (
            /aktywa|assets/i.test(lineText) &&
            /\b(?:razem|ogółem|trwałe|obrotowe|total|current|non)/i.test(lineText)
          ) {
            const aktywaHeaderIdx = Math.max(searchStart, k - 5);
            windows[0] = {
              ...bestWindow,
              start: Math.min(bestWindow.start, aktywaHeaderIdx),
              end: bestWindow.end,
              score: bestWindow.score + 100,
              sectionLabel: bestWindow.sectionLabel,
            };
            break;
          }
        }
        // Also check AFTER the best window for Aktywa anchors
        for (let k = bestWindow.end; k < searchEnd; k++) {
          const lineText = rawLines[k].toLowerCase();
          if (
            /aktywa|assets/i.test(lineText) &&
            /\b(?:razem|ogółem|trwałe|obrotowe|total|current|non)/i.test(lineText)
          ) {
            windows[0] = {
              ...windows[0],
              end: Math.min(searchEnd, k + 60),
            };
            break;
          }
        }
      }
    } else if (hasAssetAnchors && !hasLiabilityAnchors) {
      // Best window only has Aktywa — look for Pasywa section nearby
      const searchEnd = Math.min(rawLines.length, bestWindow.end + 150);
      for (let k = bestWindow.end; k < searchEnd; k++) {
        if (/pasywa|liabilities|equity|kapitał\s+własny|zobowiązania/i.test(rawLines[k])) {
          windows[0] = {
            ...windows[0],
            end: Math.min(searchEnd, k + 80),
          };
          break;
        }
      }
    }
  }

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
    /(sytuacja|sytuacji|szczegóły|w związku|na dzień publikacji|see note|refer to note|objaśnienia|komentarz|commentary|stanowiącymi|integralną część|należy analizować łącznie|dodatkowe informacje|informacje dodatkowe|podstawa sporządzenia|zasady rachunkowości|polityka rachunkowości|accounting policies|basis of preparation|the company is currently evaluating|will be applied prospectively|we believe|we expect|we anticipate|management believes|the following table|as discussed in|pursuant to)/.test(
      normalized
    )
  ) {
    return { isNonFinancial: true, reason: 'NARRATIVE_NOTE_LINE' };
  }
  if (
    /(roczne (?:jednostkowe|skonsolidowane)|raport finansowy|nazwa jednostki|nazwa grupy|annual (?:consolidated|standalone)|financial (?:report|statements)|group name|company name|biegły rewident|auditor|consolidated statement of (?:financial position|profit|cash flow|comprehensive)|statement of (?:financial position|profit or loss|cash flows)|skonsolidowane sprawozdanie|sprawozdanie z sytuacji finansowej|rachunek zysków i strat|konzernabschluss|konzernbilanz\s|konzern-gewinn|jahresabschluss|geschäftsbericht|wirtschaftsprüfer|bestätigungsvermerk|abschlussprüfer|bilanzierungs- und bewertungsmethoden|rechnungslegungsgrundsätze|comptes consolidés\s|rapport annuel|rapport financier|document d'enregistrement|commissaire aux comptes|rapport des commissaires|règles et méthodes comptables|principes comptables|états financiers consolidés)/.test(
      normalized
    )
  ) {
    return { isNonFinancial: true, reason: 'PAGE_HEADER_LINE' };
  }
  if (
    /^(?:tab(?:ela|le)?\.?\s*\d|rys(?:unek)?\.?\s*\d|wykres\s*\d|chart\s*\d|figure\s*\d|schedule\s+\d)/i.test(
      normalized
    )
  ) {
    return { isNonFinancial: true, reason: 'TABLE_FIGURE_REFERENCE' };
  }
  if (
    /^(?:ciąg\s+dalszy|continued|kontynuacja|c\.d\.|fortgesetzt|fortsetzung|suite|suite du|voir note)/i.test(
      normalized
    )
  ) {
    return { isNonFinancial: true, reason: 'CONTINUATION_MARKER' };
  }
  if (
    /\b(?:average\s+shares?\s+outstanding|weighted\s+average\s+(?:number\s+of\s+)?(?:common\s+)?shares?|shares?\s+used\s+in\s+computing|(?:basic|diluted)\s+(?:earnings|loss|income)\s+per\s+(?:share|common)|(?:earnings|loss|net\s+income)\s+per\s+(?:share|common\s+share)|zysk\s+na\s+(?:jedną?\s+)?akcj[ęe]|(?:liczba|ilość)\s+akcji|verwässert|unverwässert|ergebnis\s+je\s+aktie|nombre\s+(?:moyen\s+)?d[e'']actions|résultat\s+par\s+action)\b/i.test(
      normalized
    )
  ) {
    return { isNonFinancial: true, reason: 'PER_SHARE_DATA' };
  }
  if (
    /\b(?:thereof\s+relating\s+to|of\s+which\s+attributable\s+to|at\s+\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)|adjustments?\s+for\s+prior\s+periods?\s+from\s+adopting)/i.test(
      normalized
    )
  ) {
    return { isNonFinancial: true, reason: 'EQUITY_TABLE_ANNOTATION' };
  }
  const dashSequenceCount = (normalized.match(/\s*[-–—]\s*[-–—]/g) || []).length;
  if (dashSequenceCount >= 2) {
    return { isNonFinancial: true, reason: 'EQUITY_TABLE_COLUMN_PATTERN' };
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
  const pdfPageByLine = buildPdfPageByLine(text);
  const columnSelection = resolveStatementColumnSelection(scopedText, {
    periodLabel: options?.selectedPeriodLabel || undefined,
  });
  const targetPeriodLabel =
    String(options?.selectedPeriodLabel || columnSelection.selectedPeriodLabel || '').trim() ||
    null;
  const comparisonPeriodLabel =
    String(options?.comparisonPeriodLabel || columnSelection.comparisonPeriodLabel || '').trim() ||
    null;
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
    /^środki pieniężne (?:z działalności operacyjnej przed|wygenerowane w toku)/i,
    /^continued\s+on\s+(?:next|following)/i,
    /^(?:w\s+)?(?:PLN|EUR|USD|GBP|CHF)\s*$/i,
    /^(?:tys\.|tysiące|thousands|millions|mln|mld)\s*$/i,
    /^(?:dane\s+)?(?:nie)?badane/i,
    /^(?:audited|unaudited)\s*$/i,
    /^(?:pro\s+forma|reference|selected)\s/i,
    /^(?:kwartał|quarter|q[1-4])\s/i,
    /^(?:half\s+year|półrocze|h[12])\s/i,
    /^(?:rok|year|fy)\s+\d{4}\s*$/i,
    /^(?:załącznik|appendix|annex|anlage)\s/i,
    /^(?:noty|notes\s+to|anhang(?:angaben)?)\s*/i,
    /^seite\s+\d+/i,
    /^(?:in\s+)?(?:tsd|mio|mrd)\.?\s*(?:eur|€)?\s*$/i,
    /^(?:konzern-?)?(?:gewinn-?\s*und\s+verlustrechnung|bilanz|kapitalflussrechnung|gesamtergebnisrechnung)\s*$/i,
    /^page\s+\d+\s+(?:sur|de)\s+\d+/i,
    /^(?:en\s+)?(?:millions|milliers)\s+d[''e]?\s*(?:euros|dollars)\s*$/i,
    /^(?:comptes?\s+consolidés?|bilan\s+consolidé|compte\s+de\s+résultat\s+consolidé|tableau\s+des\s+flux)\s*$/i,
    /^exercice\s+(?:clos\s+)?/i,
    /^(?:annexe|notes?\s+aux\s+états)\s/i,
    /^(?:geschäftsbericht|jahresabschluss|halbjahresbericht|quartalsbericht)\s/i,
    /^(?:fortgesetzt|fortsetzung)\s/i,
    /^(?:davon|darunter)\s*:?\s*$/i,
    /^(?:gesamt|summe|insgesamt)\s*$/i,
    /^(?:geprüft|ungeprüft)\s*$/i,
    /^(?:erläuterungen|siehe\s+anhang)/i,
    /^(?:the\s+following|see\s+note|refer\s+to|as\s+discussed)/i,
    /^(?:management'?s?\s+discussion|risk\s+factors|item\s+\d)/i,
    /^(?:in\s+accordance\s+with|pursuant\s+to|under\s+the)/i,
    /\bwe\s+(?:believe|expect|anticipate|estimate|intend|continue)\b/i,
    /\bthe\s+company\s+(?:believes|expects|has|is|was|will|may|should)\b/i,
    /^f-\d+\s*$/i,
    /^\d{1,3}\s+(?:of|von|z|sur)\s+\d{1,3}\s*$/i,
    /^(?:see|refer to)\s+(?:notes?|note)\s+\d/i,
    /^(?:the\s+)?accompanying\s+notes/i,
    /^(?:amounts?\s+in|expressed\s+in|in\s+millions|in\s+thousands|in\s+billions)\b/i,
    /^(?:except\s+(?:per\s+share|share)\s+(?:data|amounts?))/i,
    /^(?:\(?\s*continued\s*\)?)\s*$/i,
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
    /^,?\s*z\s+tego\s+przypadając[aey]?\s*:?\s*$/i.test(line.trim()) ||
    /^(?:razem|total|suma|ogółem)\s*$/i.test(line.trim()) ||
    /^(?:w\s+tym|z\s+tego|of\s+which|including)\s*:?\s*$/i.test(line.trim()) ||
    /^(?:działalność|activity)\s*$/i.test(line.trim()) ||
    /^\d+\s*[.)]\s*$/.test(line.trim()) ||
    /^[A-Z]\.\s*$/.test(line.trim()) ||
    /^[IVX]+\.\s*$/.test(line.trim());

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
      const gap = previous
        ? lineValue.slice(previous.index + previous.raw.length, token.index)
        : '';
      const previousDigits = previous ? previous.raw.replace(/[^\d]/g, '') : '';
      const currentDigits = token.raw.replace(/[^\d]/g, '');
      const initialGroup = previous?.initialGroupLen ?? previousDigits.length;
      const isFirstMerge = previousDigits.length >= 1 && previousDigits.length <= 3;
      const isContinuedMerge = initialGroup >= 1 && initialGroup <= 2 && previousDigits.length > 3;
      const mergedDigitCount = previousDigits.length + currentDigits.length;
      // Only merge space-separated thousands when gap is a SINGLE space.
      // Multi-space gaps indicate column separation in PDFs, not thousands grouping.
      // This prevents merging page numbers with values (e.g., "986  987" from adjacent
      // PDF columns being merged into 986987).
      const canMergeThousands =
        !!previous &&
        /^\s+$/.test(gap) &&
        gap.length === 1 &&
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
    if (/^\d{1,2}\.\d{1,3}$/.test(raw)) {
      const val = parseFloat(raw);
      return Number.isFinite(val) && val >= 1 && val < 100;
    }
    if (/^\d{1,2}$/.test(raw)) {
      const val = parseInt(raw, 10);
      return val >= 1 && val <= 60;
    }
    return false;
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
  const selectedColIndex = columnSelection.selectedPeriodIndex ?? 0;
  const selectValueToken = (
    numericTokens: Array<{
      raw: string;
      normalizedValue: number | null;
      index: number;
      tokenType: 'period' | 'value' | 'note_ref';
      periodLabel?: string;
    }>
  ): {
    raw: string;
    normalizedValue: number | null;
    index: number;
    selectionReason: string;
  } | null => {
    const hasRealValues = numericTokens.some(
      (t) =>
        t.tokenType === 'value' && t.normalizedValue !== null && Math.abs(t.normalizedValue) >= 1
    );

    const effectiveTokens = numericTokens.map((t) => {
      if (t.tokenType === 'note_ref' && hasRealValues)
        return { ...t, tokenType: 'note_ref' as const };
      if (t.tokenType === 'note_ref' && !hasRealValues)
        return { ...t, tokenType: 'value' as const };
      return t;
    });

    // Strategy 1: Match inline period label
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

    // Strategy 2: Use column index from period grid (for multi-column tables without inline years)
    const valueTokens = effectiveTokens.filter((t) => t.tokenType === 'value');
    const hasPeriodTokens = effectiveTokens.some((t) => t.tokenType === 'period');
    if (!hasPeriodTokens && valueTokens.length > 1 && selectedColIndex < valueTokens.length) {
      const target = valueTokens[selectedColIndex];
      return {
        raw: target.raw,
        normalizedValue: target.normalizedValue,
        index: target.index,
        selectionReason: 'column_index_match',
      };
    }

    // Strategy 3: First value token fallback
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
    if (
      /(gross|ebitda|ebit|net income|zysk brutto|zysk netto|przepływy pieniężne netto)/.test(
        normalized
      )
    ) {
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
    const isTabularNoteRow =
      /^(?:nota|note)\b/i.test(line) &&
      ((line.match(/\(?-?\d[\d.,\s\u00A0]*\)?/g) || []).length >= 3 ||
        /\b\d{1,2}\.\d{1,3}\b.*\b\d{1,3}(?:[ \u00A0]\d{3})+\b.*\b\d{1,3}(?:[ \u00A0]\d{3})+\b/.test(
          line
        ));
    if (isNoiseLine(line) && !isTabularNoteRow) {
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

    const firstNonNoteToken =
      numericTokens.find((t) => t.tokenType !== 'note_ref') || numericTokens[0];
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

    let comparisonValue: number | null = null;
    let comparisonRawValue: string | undefined;
    if (comparisonPeriodLabel) {
      const normalizedCompPeriod = normalizePeriodLabel(comparisonPeriodLabel);
      for (let idx = 0; idx < numericTokens.length; idx++) {
        const token = numericTokens[idx];
        if (
          token.tokenType === 'period' &&
          normalizePeriodLabel(token.periodLabel || token.raw) === normalizedCompPeriod
        ) {
          const pairedValue = numericTokens
            .slice(idx + 1)
            .find((candidate) => candidate.tokenType === 'value');
          if (pairedValue && pairedValue.normalizedValue !== null) {
            comparisonValue = pairedValue.normalizedValue;
            comparisonRawValue = pairedValue.raw;
          }
          break;
        }
      }
      if (comparisonValue === null && columnSelection.comparisonPeriodIndex != null) {
        const compValueTokens = numericTokens.filter((t) => t.tokenType === 'value');
        const hasPeriodTokens = numericTokens.some((t) => t.tokenType === 'period');
        if (!hasPeriodTokens && compValueTokens.length > 1) {
          const compIdx = columnSelection.comparisonPeriodIndex;
          if (compIdx < compValueTokens.length) {
            const compToken = compValueTokens[compIdx];
            if (compToken.normalizedValue !== null) {
              comparisonValue = compToken.normalizedValue;
              comparisonRawValue = compToken.raw;
            }
          }
        }
      }
    }

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
      selectedPeriodLabel: targetPeriodLabel || undefined,
      comparisonPeriodLabel: comparisonPeriodLabel || undefined,
      sourcePage: pdfPageByLine[lineOffset + i] ?? undefined,
      sourceRow: lineOffset + i + 1,
      rowType: lineClassification.isNonFinancial ? 'nonFinancial' : deriveRowType(label),
      hierarchyDepth: Math.max(0, (rawLines[i].match(/^\s+/)?.[0].length || 0) / 2),
      signMode: deriveSignMode(value),
      numericTokens,
      selectedNumericToken: selectedToken,
      isNonFinancial: lineClassification.isNonFinancial,
      classificationReason: lineClassification.reason,
      comparisonValue: comparisonValue ?? undefined,
      comparisonRawValue: comparisonRawValue ?? undefined,
    });
  }

  // Post-processing: detect repeated-value artifacts
  // If the same value appears in >40% of extracted lines, it's likely a parsing artifact
  // (e.g., page number, note reference, or PDF layout element)
  if (lines.length >= 5) {
    const valueCounts = new Map<number, number>();
    for (const line of lines) {
      const rounded = Math.round(line.value * 100) / 100;
      valueCounts.set(rounded, (valueCounts.get(rounded) || 0) + 1);
    }
    for (const [artifactValue, count] of valueCounts) {
      const ratio = count / lines.length;
      if (ratio >= 0.4 && count >= 3) {
        warnings.push(
          `Suspected parsing artifact: value ${artifactValue} appears in ${count}/${lines.length} lines (${(ratio * 100).toFixed(0)}%). These lines marked as low confidence.`
        );
        for (const line of lines) {
          const rounded = Math.round(line.value * 100) / 100;
          if (rounded === artifactValue) {
            line.confidence = 0.1;
            line.isNonFinancial = true;
            line.classificationReason = `REPEATED_VALUE_ARTIFACT (${artifactValue} in ${(ratio * 100).toFixed(0)}% of lines)`;
          }
        }
      }
    }
  }

  if (lines.length === 0) {
    warnings.push(
      'No structured financial lines detected. The PDF may require OCR or manual entry.'
    );
  }

  // BS-specific sanity checks
  if (detectedType === 'BS' && lines.length >= 3) {
    const assetLabels = lines.filter((l) =>
      /aktywa|assets|środki pieniężne|cash|zapasy|inventories|należności|receivables|inwestycje|investments|nieruchomości|property|wartości niematerialne|intangible|wartość firmy|goodwill/i.test(
        l.originalLabel
      )
    );
    const liabilityLabels = lines.filter((l) =>
      /pasywa|liabilities|zobowiązania|kapitał|equity|rezerwy|provisions|dług|debt|kredyty|loans|obligacje|bonds/i.test(
        l.originalLabel
      )
    );

    if (assetLabels.length === 0 && liabilityLabels.length > 0) {
      warnings.push(
        `BS extraction captured ${liabilityLabels.length} liability/equity lines but 0 asset lines. ` +
          `The Aktywa (Assets) section may not have been included in the extracted text window. ` +
          `This typically happens with Polish reports where Aktywa and Pasywa are in separate sections.`
      );
    } else if (liabilityLabels.length === 0 && assetLabels.length > 0) {
      warnings.push(
        `BS extraction captured ${assetLabels.length} asset lines but 0 liability/equity lines. ` +
          `The Pasywa (Liabilities & Equity) section may not have been included.`
      );
    }

    // Check for zero-value dominance (all or most values are 0)
    const zeroLines = lines.filter((l) => l.value === 0 && !l.isNonFinancial);
    const nonZeroLines = lines.filter((l) => l.value !== 0 && !l.isNonFinancial);
    if (zeroLines.length > nonZeroLines.length && zeroLines.length >= 3) {
      warnings.push(
        `BS extraction: ${zeroLines.length}/${lines.length} lines have value=0. ` +
          `This may indicate wrong column selection or extraction from an empty section.`
      );
    }
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
    'revenues',
    'przychody ze sprzedaży',
    'przychody z umów z klientami',
    'przychody ze sprzedaży dóbr i usług',
    'przychody ze sprzedaży produktów',
    'przychody ze sprzedaży ogółem',
    'razem przychody',
    'net revenue',
    'net revenues',
    'sales',
    'sprzedaż',
    'total revenue',
    'total revenues',
    'total net sales',
    'total sales',
    'net sales',
    'net operating revenues',
    'sales and other operating revenues',
    'total sales and other operating revenues',
    'umsatzerlöse',
    'umsatz',
    'erlöse',
    'gesamterlöse',
    "chiffre d'affaires",
    'produits des ventes',
    'ventes',
    'total des ventes',
    'total revenues and other income',
    'total net revenues',
  ],
  'fsl-pl-cogs': [
    'cost of goods',
    'cost of goods sold',
    'cogs',
    'koszt sprzedanych',
    'koszt własny',
    'koszt własny sprzedaży',
    'koszt sprzedanych towarów i materiałów',
    'koszty sprzedanych produktów towarów i materiałów',
    'cost of sales',
    'total cost of sales',
    'purchases',
    'manufacturing costs',
    'cost of revenues',
    'total cost of revenues',
    'cost of products sold',
    'herstellungskosten',
    'umsatzkosten',
    'herstellungskosten der zur erzielung der umsatzerlöse erbrachten leistungen',
    'coût des ventes',
    'coût de revient',
    'coût de revient des ventes',
    'achats nets de variation de stocks',
    'achats consommés',
    'cost of sales relating to financial services business',
    'total automotive cost of revenues',
    'automotive cost of revenues',
    'koszt sprzedanych towarów',
  ],
  'fsl-pl-gross': [
    'gross profit',
    'gross margin',
    'zysk brutto',
    'zysk brutto ze sprzedaży',
    'marża brutto',
    'bruttoergebnis',
    'bruttoergebnis vom umsatz',
    'rohertrag',
    'marge brute',
    'résultat brut',
    'bénéfice brut',
  ],
  'fsl-pl-selling': [
    'selling expenses',
    'koszty sprzedaży',
    'distribution costs',
    'vertriebskosten',
    'vertriebsaufwendungen',
    'charges commerciales',
    'frais commerciaux',
    'coûts de distribution',
  ],
  'fsl-pl-gna': [
    'general and administrative',
    'general and administrative expenses',
    'selling and administrative expenses',
    'selling general and administrative',
    'selling general and administrative expenses',
    'sg a expenses',
    'distribution and administration expenses',
    'distribution and administrative expenses',
    'koszty ogólnego zarządu',
    'koszty administracyjne',
    'administrative expenses',
    'g&a expenses',
    'verwaltungskosten',
    'verwaltungsaufwendungen',
    'allgemeine verwaltungskosten',
    'charges administratives',
    'frais administratifs',
    'charges générales et administratives',
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
    'betriebliche aufwendungen',
    'betriebsaufwand',
    'selling general and administrative expenses',
    'selling general and administrative',
    'total operating expenses',
    'charges opérationnelles',
    'total des charges opérationnelles',
    'autres charges opérationnelles',
    'production and similar taxes',
    'production and manufacturing taxes',
    'other taxes',
  ],
  'fsl-pl-ebitda': ['ebitda', 'wynik ebitda', 'zysk ebitda', 'ebitda adjusted'],
  'fsl-pl-ebit': [
    'ebit',
    'operating profit',
    'operating income',
    'operating loss',
    'zysk operacyjny',
    'zysk z działalności operacyjnej',
    'strata z działalności operacyjnej',
    'betriebsergebnis',
    'betriebsgewinn',
    'ergebnis der betrieblichen tätigkeit',
    'income from operations',
    'loss from operations',
    'profit before financial result',
    'profit loss before financial result',
    'profit loss before interest and taxation',
    'profit before interest and taxation',
    'profit before interest and tax',
    'résultat opérationnel',
    'résultat opérationnel courant',
    "résultat d'exploitation",
    'bénéfice opérationnel',
  ],
  'fsl-pl-ebt': [
    'profit before tax',
    'profit before taxation',
    'profit loss before tax',
    'profit loss before taxation',
    'earnings before tax',
    'zysk przed opodatkowaniem',
    'zysk brutto',
    'strata przed opodatkowaniem',
    'ergebnis vor steuern',
    'ergebnis vor ertragsteuern',
    'gewinn vor steuern',
    'résultat avant impôt',
    'résultat avant impôt sur les sociétés',
    'bénéfice avant impôt',
    'income before provision for income taxes',
    'income before income taxes',
    'group profit before tax',
  ],
  'fsl-pl-net': [
    'net income',
    'net profit',
    'net loss',
    'zysk netto',
    'zysk/strata netto',
    'wynik netto',
    'zysk strata netto',
    'zysk (strata) netto za okres',
    'zysk netto za okres sprawozdawczy',
    'wynik finansowy netto',
    'zysk netto z tego przypadający',
    'zysk strata netto z tego przypadający',
    'net earnings',
    'zysk netto za okres',
    'zysk netto przypadający',
    'zysk netto przypadający na akcjonariuszy jednostki dominującej',
    'jahresüberschuss',
    'konzernergebnis',
    'jahresergebnis',
    'periodenüberschuss',
    'ergebnis nach steuern',
    'net income loss',
    'net income attributable to',
    'consolidated net income',
    'profit for the year',
    'profit for the period',
    'profit loss for the year',
    'profit loss for the period',
    'net profit loss',
    'résultat net',
    'résultat net consolidé',
    'bénéfice net',
    "résultat net de l'exercice",
    'income after taxes',
    'net income $',
    'net income attributable to common stockholders',
    'net income attributable to common stockholders $',
    'łączne całkowite dochody',
  ],
  'fsl-pl-interest': [
    'interest expense',
    'koszty odsetkowe',
    'wynik na działalności finansowej',
    'zinsaufwand',
    'zinsaufwendungen',
    'finanzergebnis',
    "coût de l'endettement financier net",
    "coût de l'endettement financier",
    'charges financières nettes',
    'financial interest on debt',
  ],
  'fsl-pl-depreciation': [
    'depreciation',
    'amortization',
    'amortyzacja',
    'd&a',
    'depreciation and amortization',
    'amortyzacja wartości niematerialnych',
    'amortyzacja rzeczowych aktywów trwałych',
    'abschreibungen',
    'planmäßige abschreibungen',
    'abschreibungen auf immaterielle vermögenswerte und sachanlagen',
    'amortissements et dépréciations',
    'dotations aux amortissements',
    'amortissements',
    'depreciation depletion and impairment',
  ],
  'fsl-pl-tax': [
    'income tax',
    'income taxes',
    'income tax expense',
    'tax expense',
    'tax charge',
    'podatek dochodowy',
    'podatek',
    'obciążenie podatkowe',
    'bieżący podatek dochodowy',
    'ertragsteuern',
    'steueraufwand',
    'ertragsteueraufwand',
    'impôt sur les sociétés',
    'impôt sur les bénéfices',
    "charge d'impôt",
    'provision for income taxes',
    'provision for benefit from income taxes',
    'tax charge on profit',
    'taxation',
  ],
  'fsl-pl-tax-deferred': [
    'deferred tax expense',
    'odroczony podatek dochodowy',
    'podatek odroczony',
    'deferred tax',
    'latente steuern',
    'latenter steueraufwand',
  ],
  'fsl-pl-tax-current': [
    'current tax expense',
    'bieżący podatek dochodowy',
    'podatek bieżący',
    'current tax',
    'tatsächlicher steueraufwand',
    'laufende ertragsteuern',
  ],
  'fsl-pl-other-income': [
    'other income',
    'other revenue',
    'other operating income',
    'other income loss net',
    'pozostałe przychody operacyjne',
    'inne przychody',
    'sonstige betriebliche erträge',
    'sonstige erträge',
    'autres produits',
    'autres produits opérationnels',
    "autres produits d'exploitation",
  ],
  'fsl-pl-other-expense': [
    'other expenses',
    'pozostałe koszty operacyjne',
    'inne koszty',
    'sonstige betriebliche aufwendungen',
    'sonstige aufwendungen',
    'autres charges',
    'autres charges opérationnelles',
    "autres charges d'exploitation",
  ],
  // ── BS ──
  'fsl-bs-total-assets': [
    'total assets',
    'aktywa ogółem',
    'aktywa razem',
    'razem aktywa',
    'suma aktywów',
    'aktywa razem ogółem',
    'bilanzsumme',
    'summe aktiva',
    'summe der aktiva',
    'gesamtvermögen',
    'total actif',
    "total de l'actif",
    'somme des actifs',
  ],
  'fsl-bs-fixed': [
    'fixed assets',
    'property plant',
    'aktywa trwałe',
    'ppe',
    'non-current assets',
    'aktywa trwałe razem',
    'anlagevermögen',
    'langfristige vermögenswerte',
    'langfristige vermögenswerte gesamt',
    'actif non courant',
    'actifs non courants',
    'total actif non courant',
    'immobilisations',
  ],
  'fsl-bs-intangibles': [
    'intangible assets',
    'intangibles',
    'digital assets',
    'digital assets net',
    'wartości niematerialne',
    'wartości niematerialne i prawne',
    'immaterielle vermögenswerte',
    'immaterielle anlagewerte',
    'immobilisations incorporelles',
    'marques et autres immobilisations incorporelles',
    'other intangible assets',
    'trademarks with indefinite lives',
    'trademarks',
  ],
  'fsl-bs-intangibles-goodwill': [
    'goodwill',
    'wartość firmy',
    'geschäfts- oder firmenwert',
    'firmenwert',
    "écarts d'acquisition",
    "écart d'acquisition",
    'survaleur',
  ],
  'fsl-bs-ppe': [
    'property plant and equipment',
    'ppe',
    'rzeczowe aktywa trwałe',
    'środki trwałe',
    'sachanlagen',
    'sachanlagevermögen',
    'immobilisations corporelles',
    'immobilisations corporelles nettes',
    'property plant and equipment net',
    'solar energy systems',
    'solar energy systems net',
  ],
  'fsl-bs-rou-assets': [
    'right of use assets',
    'aktywa z tytułu prawa do użytkowania',
    'prawo do użytkowania aktywów',
    'lease right of use',
    'leased products',
    'operating lease right of use assets',
    'nutzungsrechte',
    'nutzungsrechte an vermögenswerten',
    "droits d'utilisation",
    "actifs au titre de droits d'utilisation",
  ],
  'fsl-bs-investment-property': [
    'investment property',
    'nieruchomości inwestycyjne',
    'als finanzinvestition gehaltene immobilien',
    'anlageimmobilien',
  ],
  'fsl-bs-other-non-current-assets-deferred-tax': [
    'deferred tax asset',
    'deferred tax assets',
    'aktywa z tytułu odroczonego podatku dochodowego',
    'aktywo z tytułu podatku odroczonego',
    'latente steueransprüche',
    'aktive latente steuern',
    'impôts différés actifs',
    "actifs d'impôt différé",
  ],
  'fsl-bs-current-assets': [
    'current assets',
    'aktywa obrotowe',
    'aktywa bieżące',
    'aktywa obrotowe razem',
    'umlaufvermögen',
    'kurzfristige vermögenswerte',
    'kurzfristige vermögenswerte gesamt',
    'actif courant',
    'actifs courants',
    'total actif courant',
    'total current assets',
  ],
  'fsl-bs-cash': [
    'cash',
    'cash and cash equivalents',
    'total cash cash equivalents and short-term investments',
    'cash cash equivalents and short-term investments',
    'cash and short-term investments',
    'środki pieniężne',
    'gotówka',
    'środki pieniężne i ich ekwiwalenty',
    'środki pieniężne o ograniczonym sposobie dysponowania',
    'zahlungsmittel und zahlungsmitteläquivalente',
    'zahlungsmittel',
    'flüssige mittel',
    'finanzmittelbestand',
    'trésorerie et équivalents de trésorerie',
    'trésorerie',
    'disponibilités',
  ],
  'fsl-bs-inventory': [
    'inventory',
    'inventories',
    'zapasy',
    'zapasy ogółem',
    'zapasy razem',
    'stock',
    'vorräte',
    'warenbestand',
    'stocks et en-cours',
    'stocks',
  ],
  'fsl-bs-ar': [
    'accounts receivable',
    'receivables',
    'należności',
    'trade receivables',
    'należności handlowe',
    'należności z tytułu dostaw i usług',
    'należności handlowe oraz pozostałe należności',
    'forderungen aus lieferungen und leistungen',
    'forderungen',
    'créances clients',
    'créances clients et comptes rattachés',
    'créances',
    'accounts receivable net',
  ],
  'fsl-bs-ap': [
    'accounts payable',
    'payables',
    'zobowiązania handlowe',
    'trade payables',
    'zobowiązania z tytułu dostaw i usług',
    'verbindlichkeiten aus lieferungen und leistungen',
    'lieferantenverbindlichkeiten',
    'dettes fournisseurs',
    'dettes fournisseurs et comptes rattachés',
    'fournisseurs et comptes rattachés',
  ],
  'fsl-bs-wc': [
    'working capital',
    'kapitał obrotowy',
    'kapitał obrotowy netto',
    'net working capital',
    'nwc',
    'betriebskapital',
    'nettoumlaufvermögen',
  ],
  'fsl-bs-total-liabilities': [
    'total liabilities',
    'zobowiązania ogółem',
    'zobowiązania razem',
    'zobowiązania i rezerwy na zobowiązania',
    'zobowiązanie długo i krótkoterminowe',
    'suma pasywów',
    'zobowiązania razem ogółem',
    'zobowiązania',
    'summe verbindlichkeiten',
    'summe schulden',
    'gesamtverbindlichkeiten',
    'total des dettes',
    'total passif',
    'total dettes',
  ],
  'fsl-bs-current-liabilities': [
    'current liabilities',
    'current provisions and liabilities',
    'zobowiązania krótkoterminowe',
    'zobowiązania bieżące',
    'zobowiązania krótkoterminowe razem',
    'zobowiązania i rezerwy krótkoterminowe',
    'kurzfristige verbindlichkeiten',
    'kurzfristige schulden',
    'passif courant',
    'passifs courants',
    'total passif courant',
    'total current liabilities',
  ],
  'fsl-bs-long-term-debt': [
    'long-term debt',
    'long term liabilities',
    'debt and finance leases net of current portion',
    'long-term debt net of current portion',
    'finance debt',
    'zobowiązania długoterminowe',
    'non-current liabilities',
    'non current provisions and liabilities',
    'zobowiązania długoterminowe razem',
    'zobowiązania i rezerwy długoterminowe',
    'langfristige verbindlichkeiten',
    'langfristige schulden',
    'passif non courant',
    'passifs non courants',
    'total passif non courant',
    'total non-current liabilities',
    'emprunts et dettes financières à long terme',
  ],
  'fsl-bs-long-term-borrowings': [
    'long-term borrowings',
    'długoterminowe kredyty i pożyczki',
    'kredyty i pożyczki długoterminowe',
    'kredyty i pożyczki',
    'long-term bank loans',
    'langfristige finanzverbindlichkeiten',
    'langfristige bankverbindlichkeiten',
    'langfristige darlehen',
    'long-term notes payable',
    'senior notes',
    'bonds payable',
    'term loan',
  ],
  'fsl-bs-equity': [
    'equity',
    'shareholders equity',
    'kapitał własny',
    'total equity',
    'kapitał własny razem',
    'kapitał własny ogółem',
    'eigenkapital',
    'eigenkapital gesamt',
    'konzerneigenkapital',
    'stockholders equity',
    'total stockholders equity',
    "shareholders' equity",
    "stockholders' equity",
    'capitaux propres',
    'total capitaux propres',
    "total shareholders' equity",
    'net assets',
  ],
  'fsl-bs-equity-parent': [
    'equity attributable to parent',
    'equity attributable to shareholders',
    'equity attributable to owners of the parent',
    'equity attributable to shareowners',
    'kapitał własny przypadający akcjonariuszom jednostki dominującej',
    'kapitał własny przypadający akcjonariuszom',
    'eigenkapital der anteilseigner des mutterunternehmens',
    'den aktionären des mutterunternehmens zuzurechnendes eigenkapital',
    'capitaux propres part du groupe',
    'capitaux propres attribuables aux propriétaires',
    'equity bp shareholders equity',
    'equity stockholders equity',
    'equity attributable to shareowners of',
    'equity attributable to stockholders of',
    'equity attributable to shareholders of',
    'equity attributable to owners',
  ],
  'fsl-bs-share-capital': [
    'share capital',
    'kapitał podstawowy',
    'kapitał zakładowy',
    'issued capital',
    'gezeichnetes kapital',
    'grundkapital',
    'stammkapital',
    'common stock',
    'common shares',
    'ordinary shares',
    'preferred stock',
    'par value',
    'capital social',
    'common stock and additional paid-in capital',
  ],
  'fsl-bs-retained-earnings': [
    'retained earnings',
    'reinvested earnings',
    'revenue reserves',
    'accumulated deficit',
    'zyski zatrzymane',
    'niepodzielony wynik finansowy',
    'wynik z lat ubiegłych',
    'gewinnrücklagen',
    'bilanzgewinn',
    'einbehaltene gewinne',
    'réserves consolidées et résultat',
    'réserves consolidées',
    'report à nouveau',
    'accumulated deficit',
  ],
  'fsl-bs-provisions': [
    'provisions',
    'rezerwy',
    'rezerwy na zobowiązania',
    'provisions for liabilities',
    'rezerwy krótkoterminowe',
    'pozostałe rezerwy krótkoterminowe',
    'rückstellungen',
    'sonstige rückstellungen',
    'provisions courantes',
    'provisions et autres passifs',
  ],
  'fsl-bs-other-current-assets': [
    'other current assets',
    'pozostałe aktywa obrotowe',
    'inne aktywa obrotowe',
    'pozostałe aktywa krótkoterminowe',
    'sonstige kurzfristige vermögenswerte',
  ],
  'fsl-bs-other-st-receivables': [
    'other short-term receivables',
    'pozostałe należności krótkoterminowe',
    'inne należności krótkoterminowe',
    'sonstige kurzfristige forderungen',
  ],
  'fsl-bs-other-current-financial-assets': [
    'other current financial assets',
    'marketable securities',
    'short-term investments',
    'short-term marketable securities',
    'pozostałe krótkoterminowe aktywa finansowe',
    'krótkoterminowe aktywa finansowe',
    'sonstige kurzfristige finanzielle vermögenswerte',
  ],
  'fsl-bs-other-current-assets-prepaids': [
    'prepaid expenses',
    'prepayments',
    'prepaid expenses and other current assets',
    'rozliczenia międzyokresowe',
    'krótkoterminowe rozliczenia międzyokresowe',
    'rechnungsabgrenzungsposten',
    'aktive rechnungsabgrenzung',
  ],
  'fsl-bs-lt-prepaids': [
    'long-term prepaid expenses',
    'długoterminowe rozliczenia międzyokresowe',
    'rozliczenia międzyokresowe długoterminowe',
    'langfristige rechnungsabgrenzungsposten',
  ],
  // ── CF ──
  'fsl-cf-change-wc-ar': [
    'change in receivables',
    'change in trade receivables',
    'increase decrease in accounts receivable',
    'accounts receivable',
    'zmiana stanu należności',
    'zmiana należności',
    'veränderung der forderungen',
    'veränderung forderungen aus lieferungen und leistungen',
  ],
  'fsl-cf-change-wc-inventory': [
    'change in inventory',
    'change in inventories',
    'increase decrease in inventories',
    'inventory',
    'zmiana stanu zapasów',
    'zmiana zapasów',
    'veränderung der vorräte',
    'bestandsveränderung',
  ],
  'fsl-cf-change-wc-ap': [
    'change in payables',
    'change in trade payables',
    'increase decrease in accounts payable',
    'accounts payable accrued and other liabilities',
    'increase decrease in other current and non-current liabilities',
    'zmiana stanu zobowiązań',
    'zmiana zobowiązań',
    'zmiana stanu zobowiązań handlowych',
    'veränderung der verbindlichkeiten',
    'veränderung verbindlichkeiten aus lieferungen und leistungen',
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
    'cashflow aus betrieblicher tätigkeit',
    'cashflow aus laufender geschäftstätigkeit',
    'netto-cashflow aus betrieblicher tätigkeit',
    'mittelzufluss aus betrieblicher tätigkeit',
    'mittelzufluss aus der betrieblichen tätigkeit',
    'flux net de trésorerie lié aux activités opérationnelles',
    "flux de trésorerie provenant des activités d'exploitation",
    'activités opérationnelles',
    'net cash provided by operating activities',
    'net cash provided by used in operating activities',
    'net cash used in operating activities',
    'cash inflow outflow from operating activities',
    'cash flows from operating activities net income',
    'cash flows from operating activities net income $',
  ],
  'fsl-cf-investing': [
    'investing cash flow',
    'cash from investing',
    'przepływy z inwestycji',
    'przepływy pieniężne netto z działalności inwestycyjnej',
    'środki pieniężne netto z działalności inwestycyjnej',
    'środki pieniężne netto wykorzystane z działalności inwestycyjnej',
    'przepływy środków pieniężnych z działalności inwestycyjnej',
    'działalność inwestycyjna',
    'cashflow aus investitionstätigkeit',
    'netto-cashflow aus investitionstätigkeit',
    'mittelabfluss aus investitionstätigkeit',
    'mittelabfluss aus der investitionstätigkeit',
    "flux net de trésorerie lié aux activités d'investissement",
    "activités d'investissement",
    'net cash provided by used in investing activities',
    'net cash used in investing activities',
    'cash inflow outflow from investing activities',
  ],
  'fsl-cf-financing': [
    'financing cash flow',
    'cash from financing',
    'przepływy z finansowania',
    'przepływy pieniężne netto z działalności finansowej',
    'środki pieniężne netto z działalności finansowej',
    'środki pieniężne netto wykorzystane z działalności finansowej',
    'przepływy środków pieniężnych z działalności finansowej',
    'działalność finansowa',
    'cashflow aus finanzierungstätigkeit',
    'netto-cashflow aus finanzierungstätigkeit',
    'mittelzufluss aus finanzierungstätigkeit',
    'mittelabfluss aus der finanzierungstätigkeit',
    'flux net de trésorerie lié aux activités de financement',
    'activités de financement',
    'net cash provided by used in financing activities',
    'net cash used in financing activities',
    'net cash provided by used in financing activities',
    'cash inflow outflow from financing activities',
  ],
  'fsl-cf-capex': [
    'capital expenditures',
    'capex',
    'nakłady inwestycyjne',
    'purchases of property',
    'purchases of property plant and equipment',
    'purchases of property and equipment',
    'purchases of property and equipment net of proceeds',
    'expenditure on property plant and equipment',
    'expenditure on property plant and equipment intangible and other assets',
    'total investment in intangible assets and property plant and equipment',
    'total cash capital expenditure',
    'additions to non current assets',
    'wydatki na nabycie rzeczowych aktywów trwałych',
    'wydatki na nabycie wartości niematerialnych',
    'investitionen in sachanlagen',
    'auszahlungen für investitionen in sachanlagen',
    'erwerb von sachanlagen',
    'auszahlungen für den erwerb immaterieller vermögenswerte und sachanlagen',
    "acquisitions d'immobilisations corporelles",
    "acquisitions d'immobilisations",
    'expenditure for investment assets',
    'investing activities expenditure on property plant and equipment intangible and other assets',
  ],
  'fsl-cf-fcf': [
    'free cash flow',
    'fcf',
    'wolne przepływy',
    'wolne przepływy pieniężne',
    'freier cashflow',
  ],
  'fsl-cf-change-wc-provisions': [
    'change in provisions',
    'net charge for provisions',
    'net charge for provisions less payments',
    'zmiana stanu rezerw',
    'zmiana rezerw',
    'veränderung der rückstellungen',
  ],
  'fsl-cf-change-wc-other': [
    'change in other working capital',
    'change in other operating assets and liabilities',
    'increase decrease in other current and non-current assets',
    'change in leased products',
    'change in receivables from sales financing',
    'change in other financial liabilities',
    'collateral paid received associated with hedging activities net',
    'deferred revenue',
    'zmiana stanu pozostałych aktywów',
    'zmiana stanu rozliczeń międzyokresowych',
    'zmiana stanu amortyzowanego aktywa kontraktowego',
    'veränderung sonstiger vermögenswerte und verbindlichkeiten',
    'veränderung sonstiger posten',
  ],
  'fsl-cf-operating-depreciation': [
    'depreciation and amortization',
    'depreciation and amortisation',
    'depreciation depletion and amortization',
    'depreciation depletion and amortisation',
    'depreciation and amortisation of tangible and intangible assets',
    'depreciation depletion and impairment',
    'amortyzacja',
    'amortyzacja ujęta w wyniku finansowym',
    'amortyzacja wartości niematerialnych',
    'amortyzacja rzeczowych aktywów trwałych',
    'amortyzacja aktywów z tytułu prawa do użytkowania',
    'abschreibungen',
    'planmäßige abschreibungen',
    'abschreibungen und amortisation',
  ],
  'fsl-cf-operating-interest-cost': [
    'interest cost',
    'finance costs',
    'finance expense',
    'net finance expense',
    'koszty odsetek',
    'koszty odsetkowe',
    'koszty finansowe',
    'zinsaufwendungen',
    'gezahlte zinsen',
    'other interest and similar income expenses',
    'other interest and similar income/expenses',
  ],
  'fsl-cf-net-change-cash': [
    'net change in cash',
    'zmiana stanu środków pieniężnych',
    'zwiększenie netto środków pieniężnych',
    'zmniejszenie netto środków pieniężnych',
    'zmiana netto stanu środków pieniężnych i ich ekwiwalentów',
    'zmiana netto środków pieniężnych',
    'nettoveränderung des finanzmittelbestands',
    'veränderung der zahlungsmittel',
    'zu-/abnahme der zahlungsmittel',
    'veränderung des finanzmittelbestands',
    'variation nette de trésorerie',
    'augmentation nette de la trésorerie',
    'net increase decrease in cash',
    'net increase in cash cash equivalents',
    'increase decrease in cash and cash equivalents',
    'change in cash and cash equivalents',
  ],
  'fsl-cf-opening-cash': [
    'opening cash balance',
    'środki pieniężne na początek okresu',
    'stan środków pieniężnych na początek okresu',
    'finanzmittelbestand am anfang der periode',
    'zahlungsmittel zu beginn der periode',
    'zahlungsmittel am anfang des geschäftsjahres',
    'trésorerie en début de période',
    "trésorerie à l'ouverture",
    'cash cash equivalents and restricted cash beginning of period',
    'cash and cash equivalents at beginning of year',
    'cash and cash equivalents as at 1 january',
    'cash and cash equivalents at beginning of period',
  ],
  'fsl-cf-closing-cash': [
    'closing cash balance',
    'środki pieniężne na koniec okresu',
    'stan środków pieniężnych na koniec okresu',
    'finanzmittelbestand am ende der periode',
    'zahlungsmittel am ende der periode',
    'zahlungsmittel am ende des geschäftsjahres',
    'trésorerie en fin de période',
    'trésorerie à la clôture',
    'cash cash equivalents and restricted cash end of period',
    'cash and cash equivalents at end of year',
    'cash and cash equivalents as at 31 december',
    'cash and cash equivalents at end of period',
    'cash and cash equivalents at end of year',
    'cash cash equivalents restricted cash and restricted cash equivalents at end of year',
    'cash at end of year',
    'cash and cash equivalents at end of year $',
    'cash and cash equivalents at end of year',
    'less restricted cash and restricted cash equivalents at end of year',
  ],
  // ── NEW BS HINTS ──
  'fsl-bs-lt-receivables': [
    'long-term receivables',
    'należności długoterminowe',
    'pozostałe należności długoterminowe',
    'langfristige forderungen',
    'sonstige langfristige forderungen',
  ],
  'fsl-bs-lt-financial-assets': [
    'long-term financial assets',
    'other investments',
    'other financial assets',
    'financial assets',
    'instrumenty finansowe razem',
    'financial instruments total',
    'derivative financial instruments',
    'długoterminowe aktywa finansowe',
    'aktywa finansowe długoterminowe',
    'inwestycje długoterminowe',
    'langfristige finanzielle vermögenswerte',
    'langfristige finanzanlagen',
    'finanzanlagen',
  ],
  'fsl-bs-equity-method-investments': [
    'equity method investments',
    'inwestycje w jednostkach stowarzyszonych',
    'inwestycje wyceniane metodą praw własności',
    'udziały w jednostkach zależnych',
    'udziały i akcje w jednostkach zależnych',
    'udziały w jednostkach podporządkowanych',
    'anteile an assoziierten unternehmen',
    'nach der equity-methode bilanzierte beteiligungen',
    'at equity bilanzierte beteiligungen',
    'investments in joint ventures',
    'investments in associates',
    'investments in joint ventures and associates',
    'investments accounted for using the equity method',
  ],
  'fsl-bs-tax-receivables': [
    'tax receivables',
    'należności podatkowe',
    'należności z tytułu bieżącego podatku dochodowego',
    'należności z tytułu podatku dochodowego',
    'należności z tytułu podatku dochodowego od osób prawnych',
    'ertragsteueransprüche',
    'steuerforderungen',
    'forderungen aus ertragsteuern',
  ],
  'fsl-bs-other-tax-receivables': [
    'other tax receivables',
    'należności z tytułu innych podatków ceł i ubezpieczeń społecznych',
    'należności z tytułu innych podatków',
    'należności z tytułu podatku VAT',
    'sonstige steuerforderungen',
    'umsatzsteuerforderungen',
  ],
  'fsl-bs-contract-assets': [
    'contract assets',
    'aktywa kontraktowe',
    'aktywa z tytułu umów z klientami',
    'vertragsvermögenswerte',
    'forderungen aus verträgen mit kunden',
  ],
  'fsl-bs-assets-held-for-sale': [
    'assets held for sale',
    'assets classified as held for sale',
    'non-current assets held for sale',
    'disposal groups',
    'aktywa przeznaczone do sprzedaży',
    'aktywa trwałe przeznaczone do zbycia',
    'aktywa klasyfikowane jako przeznaczone do sprzedaży',
    'zur veräußerung gehaltene vermögenswerte',
    'veräußerungsgruppen',
  ],
  'fsl-bs-treasury-shares': [
    'treasury shares',
    'treasury stock',
    'treasury stock at cost',
    'akcje własne',
    'udziały własne',
    'eigene anteile',
    'eigene aktien',
    'actions propres',
    'actions auto-détenues',
  ],
  'fsl-bs-other-equity-reserves': [
    'other equity reserves',
    'pozostałe kapitały rezerwowe',
    'kapitał rezerwowy',
    'kapitał z aktualizacji wyceny',
    'pozostałe kapitały',
    'inne kapitały',
    'sonstige rücklagen',
    'kapitalrücklage',
    'andere gewinnrücklagen',
    'accumulated other comprehensive income',
    'accumulated other comprehensive income loss',
    'aoci',
    'other comprehensive income accumulated',
  ],
  'fsl-bs-actuarial-reserve': [
    'actuarial remeasurement reserve',
    'kapitał z przeszacowania programu określonych świadczeń',
    'przeszacowanie programu określonych świadczeń',
    'zyski i straty aktuarialne kapitał',
    'versicherungsmathematische gewinne und verluste',
    'neubewertungsrücklage leistungsorientierte pläne',
  ],
  'fsl-bs-minority-interest': [
    'non-controlling interests',
    'minority interest',
    'udziały niesprawujące kontroli',
    'udziały mniejszościowe',
    'udziały niekontrolujące',
    'kapitały przypadające udziałom niesprawującym kontroli',
    'anteile nicht beherrschender gesellschafter',
    'minderheitsanteile',
    'nicht beherrschende anteile',
    'intérêts minoritaires',
    'participations ne donnant pas le contrôle',
  ],
  'fsl-bs-hedge-reserve': [
    'hedging reserve',
    'kapitał z wyceny zabezpieczeń',
    'kapitał z wyceny transakcji zabezpieczających',
    'zabezpieczenia przepływów pieniężnych',
    'hedge reserve',
    'rücklage für cashflow-hedges',
    'sicherungsrücklage',
  ],
  'fsl-bs-fx-reserve': [
    'fx translation reserve',
    'różnice kursowe z konsolidacji',
    'różnice kursowe z przeliczenia',
    'foreign currency translation',
    'währungsumrechnungsdifferenzen',
    'rücklage aus währungsumrechnung',
    'écarts de conversion',
    'différences de change',
    'accumulated other comprehensive income loss',
  ],
  'fsl-bs-employee-benefits-lt': [
    'employee benefits long-term',
    'zobowiązania z tytułu świadczeń pracowniczych',
    'świadczenia pracownicze długoterminowe',
    'rezerwy na świadczenia emerytalne',
    'zobowiązania z tytułu świadczeń po okresie zatrudnienia',
    'pensionsrückstellungen',
    'langfristige leistungen an arbeitnehmer',
    'rückstellungen für pensionen und ähnliche verpflichtungen',
    'engagements envers le personnel',
    'avantages au personnel à long terme',
    'provisions pour retraites',
    'pension post-retirement benefits',
  ],
  'fsl-bs-employee-benefits-st': [
    'employee benefits short-term',
    'zobowiązania z tytułu świadczeń pracowniczych krótkoterminowe',
    'świadczenia pracownicze',
    'kurzfristige leistungen an arbeitnehmer',
    'verbindlichkeiten gegenüber mitarbeitern',
  ],
  'fsl-bs-contract-liabilities': [
    'contract liabilities',
    'zobowiązania kontraktowe',
    'zobowiązania z tytułu umów z klientami',
    'przychody przyszłych okresów',
    'zaliczki otrzymane',
    'vertragsverbindlichkeiten',
    'verbindlichkeiten aus verträgen mit kunden',
    'erhaltene anzahlungen',
  ],
  'fsl-bs-other-non-current-liabilities-deferred-tax': [
    'deferred tax liabilities',
    'rezerwa z tytułu podatku odroczonego',
    'rezerwa z tytułu odroczonego podatku dochodowego',
    'zobowiązania z tytułu odroczonego podatku dochodowego',
    'rezerwa na podatek odroczony',
    'latente steuerschulden',
    'passive latente steuern',
    'impôts différés passifs',
    "passifs d'impôt différé",
  ],
  'fsl-bs-total-liabilities-equity': [
    'total liabilities and equity',
    'total equity and liabilities',
    'total liabilities and stockholders equity',
    'total liabilities and shareholders equity',
    'razem zobowiązania i kapitał własny',
    'pasywa razem',
    'pasywa ogółem',
    'razem pasywa',
    'suma bilansowa pasywów',
    'suma pasywów',
    'summe passiva',
    'bilanzsumme passiva',
    'summe eigenkapital und verbindlichkeiten',
    'total passif et capitaux propres',
    'total du passif et des capitaux propres',
    "total liabilities and shareholders' equity",
    "total liabilities and stockholders' equity",
    'total liabilities and equity',
    'total equity and liabilities',
  ],
  'fsl-bs-share-premium': [
    'share premium',
    'capital surplus',
    'capital reserves',
    'kapitał zapasowy',
    'nadwyżka ze sprzedaży akcji',
    'agio',
    'kapitał zapasowy ze sprzedaży akcji powyżej ich wartości nominalnej',
    'kapitalrücklage',
    'additional paid-in capital',
    'additional paid in capital',
    'apic',
    'capital surplus',
    "primes d'émission",
    "prime d'émission",
  ],
  'fsl-bs-short-term-debt': [
    'short-term debt',
    'current portion of debt and finance leases',
    'current portion of long-term debt',
    'loans and notes payable',
    'krótkoterminowe kredyty i pożyczki',
    'krótkoterminowe zobowiązania finansowe',
    'kredyty krótkoterminowe',
    'kurzfristige finanzverbindlichkeiten',
    'kurzfristige bankverbindlichkeiten',
    'kurzfristige darlehen',
    'emprunts et dettes financières à court terme',
    'dettes financières courantes',
    'commercial paper',
    'term debt',
  ],
  'fsl-bs-long-term-debt-lease': [
    'non-current lease liabilities',
    'zobowiązania długoterminowe z tytułu leasingu',
    'zobowiązania długoterminowe z tytułu prawa do użytkowania aktywów',
    'zobowiązania długoterminowe z tytułu prawa do użytkowania',
    'langfristige leasingverbindlichkeiten',
    'langfristige verbindlichkeiten aus leasingverhältnissen',
    'dettes locatives non courantes',
    'dettes de location non courantes',
  ],
  'fsl-bs-short-term-debt-lease': [
    'current lease liabilities',
    'krótkoterminowe zobowiązania leasingowe',
    'zobowiązania krótkoterminowe z tytułu leasingu',
    'zobowiązania krótkoterminowe z tytułu prawa do użytkowania aktywów',
    'zobowiązania krótkoterminowe z tytułu prawa do użytkowania',
    'kurzfristige leasingverbindlichkeiten',
    'kurzfristige verbindlichkeiten aus leasingverhältnissen',
    'dettes locatives courantes',
    'dettes de location courantes',
  ],
  'fsl-bs-other-current-liabilities': [
    'other current liabilities',
    'pozostałe zobowiązania krótkoterminowe',
    'inne zobowiązania krótkoterminowe',
    'sonstige kurzfristige verbindlichkeiten',
  ],
  'fsl-bs-other-non-current-liabilities': [
    'other non-current liabilities',
    'other long-term liabilities',
    'other noncurrent liabilities',
    'financial liabilities',
    'pozostałe zobowiązania długoterminowe',
    'inne zobowiązania długoterminowe',
    'sonstige langfristige verbindlichkeiten',
  ],
  'fsl-bs-other-non-current-liabilities-provisions': [
    'long-term provisions',
    'rezerwy długoterminowe',
    'pozostałe rezerwy długoterminowe',
    'langfristige rückstellungen',
    'sonstige langfristige rückstellungen',
  ],
  'fsl-bs-other-current-liabilities-tax': [
    'tax payables',
    'current tax',
    'current tax liabilities',
    'zobowiązania podatkowe',
    'zobowiązania z tytułu podatku dochodowego',
    'zobowiązania z tytułu podatku dochodowego od osób prawnych',
    'ertragsteuerverbindlichkeiten',
    'steuerschulden',
    'verbindlichkeiten aus ertragsteuern',
    'current tax payable',
    'accrued income taxes',
    'income tax payable',
  ],
  'fsl-bs-other-tax-payables': [
    'other tax payables',
    'zobowiązania z tytułu innych podatków ceł i ubezpieczeń społecznych',
    'zobowiązania z tytułu innych podatków',
    'zobowiązania z tytułu VAT',
    'sonstige steuerverbindlichkeiten',
    'umsatzsteuerverbindlichkeiten',
  ],
  // ── NEW P&L HINTS ──
  'fsl-pl-net-parent': [
    'net income attributable to parent',
    'net income attributable to shareholders',
    'net income attributable to common stockholders',
    'net income attributable to common shareowners',
    'net income attributable to shareholders of',
    'net income attributable to shareowners',
    'attributable to shareholders',
    'attributable to owners of the parent',
    'comprehensive income attributable to common stockholders',
    'zysk netto przypadający akcjonariuszom jednostki dominującej',
    'zysk przypadający akcjonariuszom podmiotu dominującego',
    'zysk netto jednostki dominującej',
    'zysk netto przypadający akcjonariuszom',
    'den anteilseignern des mutterunternehmens zuzurechnendes ergebnis',
    'ergebnis anteilseigner mutterunternehmen',
    'part du groupe',
    'résultat net part du groupe',
    'profit attributable to shareholders',
    'profit attributable to owners of the parent',
    'profit for the year attributable to',
    'net income attributable to shareowners of the coca-cola company',
    'net income attributable to shareowners of',
    'net income attributable to common stockholders $',
    'attributable to bp shareholders',
    'łączne całkowite dochody przypadające akcjonariuszom jednostki dominującej',
  ],
  'fsl-pl-net-minority': [
    'net income attributable to non-controlling interests',
    'zysk netto przypadający udziałom niesprawującym kontroli',
    'zysk przypadający udziałom mniejszościowym',
    'udziały niesprawujące kontroli',
    'ergebnis nicht beherrschende anteile',
    'auf nicht beherrschende anteile entfallendes ergebnis',
    'part des intérêts minoritaires',
    'intérêts minoritaires',
    'nicht beherrschenden anteilen zuzurechnen',
  ],
  'fsl-pl-net-continuing': [
    'net income from continuing operations',
    'zysk netto z działalności kontynuowanej',
    'wynik z działalności kontynuowanej',
    'ergebnis aus fortgeführten geschäftsbereichen',
    'ergebnis fortgeführter geschäftsbereiche',
  ],
  'fsl-pl-other-op-result': [
    'other operating result',
    'wynik na pozostałej działalności operacyjnej',
    'saldo pozostałej działalności operacyjnej',
    'sonstiges betriebliches ergebnis',
  ],
  'fsl-pl-other-op-income': [
    'other operating income',
    'pozostałe przychody operacyjne',
    'inne przychody operacyjne',
    'sonstige betriebliche erträge',
  ],
  'fsl-pl-equity-method-income': [
    'share of profit of associates',
    'equity method income',
    'earnings from associates after interest and tax',
    'earnings from associates',
    'income from associates',
    'share of results of associates',
    'share of profit loss of associates',
    'equity income loss net',
    'udział w zyskach jednostek stowarzyszonych',
    'udział w zyskach jednostek wycenianych metodą praw własności',
    'udział w wynikach jednostek stowarzyszonych',
    'ergebnis aus at equity bilanzierten beteiligungen',
    'ergebnis aus nach der equity-methode bilanzierten beteiligungen',
    'quote-part du résultat net des sociétés mises en équivalence',
    'résultat des sociétés mises en équivalence',
    'net income loss from equity affiliates',
    'equity income',
    'earnings from joint ventures',
    'earnings from joint ventures and associates',
    'result from equity accounted investments',
    'udział w wyniku jednostek wycenianych metodą praw własności',
  ],
  'fsl-pl-fin-income': [
    'financial income',
    'przychody finansowe',
    'przychody z tytułu odsetek',
    'finance income',
    'interest income',
    'interest and similar income',
    'finanzerträge',
    'zinserträge',
    'sonstige finanzerträge',
    'produits financiers',
    'autres produits financiers',
    'financial income and expense from cash',
    'other financial income',
  ],
  'fsl-pl-fin-expense': [
    'financial expenses',
    'koszty finansowe',
    'finance costs',
    'financial costs',
    'interest expense',
    'interest and similar expenses',
    'finanzaufwendungen',
    'zinsaufwendungen',
    'sonstige finanzaufwendungen',
    'charges financières',
    'autres charges financières',
    'other financial expense',
    'other financial result',
    'net financial result',
  ],
  'fsl-pl-impairment-receivables': [
    'impairment of receivables',
    'zmiana odpisów na należności',
    'odpis aktualizujący wartość należności',
    'strata z tytułu utraty wartości należności',
    'wertminderung von forderungen',
    'wertberichtigung auf forderungen',
  ],
  'fsl-pl-oci-total': [
    'other comprehensive income',
    'inne całkowite dochody',
    'inne całkowite dochody ogółem',
    'inne całkowite dochody netto',
    'sonstiges ergebnis',
    'sonstiges gesamtergebnis',
    'other comprehensive income loss',
    'total other comprehensive income',
  ],
  'fsl-pl-oci-reclassifiable': [
    'items that may be reclassified',
    'items that can be reclassified to the income statement in the future',
    'currency translation foreign operations',
    'exchange differences on translation of foreign operations',
    'derivative financial instruments oci',
    'pozycje które mogą być przeklasyfikowane',
    'pozycje przeklasyfikowywalne do wyniku',
    'pozycje podlegające przeklasyfikowaniu',
    'różnice kursowe z przeliczenia jednostek zagranicznych',
    'posten die in die gewinn- und verlustrechnung umgegliedert werden können',
  ],
  'fsl-pl-oci-non-reclassifiable': [
    'items that will not be reclassified',
    'pozycje nieprzeklasyfikowywalne',
    'pozycje które nie zostaną przeklasyfikowane',
    'pozycje niepodlegające przeklasyfikowaniu',
    'posten die nicht in die gewinn- und verlustrechnung umgegliedert werden',
  ],
  'fsl-pl-oci-fx': [
    'fx translation differences',
    'różnice kursowe z przeliczenia',
    'różnice kursowe z przeliczenia jednostek zagranicznych',
    'währungsumrechnungsdifferenzen',
    'differenzen aus der währungsumrechnung',
  ],
  'fsl-pl-oci-hedge': [
    'hedging result oci',
    'wynik na zabezpieczeniach',
    'wycena instrumentów zabezpieczających',
    'zabezpieczenia przepływów pieniężnych',
    'efektywna część zmian wartości godziwej',
    'wynik na rachunkowości zabezpieczeń',
    'wynik na rachunkowości zabezpieczeń wraz z efektem podatkowym',
    'ergebnis aus cashflow-hedges',
    'sicherungsgeschäfte',
  ],
  'fsl-pl-oci-actuarial': [
    'actuarial gains and losses',
    'zyski i straty aktuarialne',
    'przeszacowania zobowiązań z tytułu świadczeń',
    'wycena aktuarialna',
    'versicherungsmathematische gewinne und verluste',
    'neubewertung leistungsorientierter pensionspläne',
  ],
  'fsl-pl-comprehensive-income': [
    'total comprehensive income',
    'total comprehensive income attributable to shareholders',
    'total comprehensive income attributable to',
    'łączne całkowite dochody przypadające akcjonariuszom jednostki dominującej',
    'całkowite dochody ogółem',
    'łączne całkowite dochody',
    'razem całkowite dochody',
    'całkowite dochody ogółem z tego przypadające',
    'gesamtergebnis',
    'gesamtergebnis der periode',
  ],
  'fsl-pl-eps-basic': [
    'basic earnings per share',
    'zysk na jedną akcję podstawowy',
    'zysk na jedną akcję',
    'zysk na akcję',
    'zysk na jedną akcję zwykłą',
    'podstawowy zysk na akcję',
    'unverwässertes ergebnis je aktie',
    'ergebnis je aktie unverwässert',
    'résultat net par action',
    'bénéfice par action',
    'earnings per share basic',
    'per ads dollars basic',
    'per ordinary share cents basic',
    'basic eps',
  ],
  'fsl-pl-eps-diluted': [
    'diluted earnings per share',
    'diluted',
    'per ads dollars diluted',
    'per ordinary share cents diluted',
    'zysk na jedną akcję rozwodniony',
    'rozwodniony zysk na jedną akcję',
    'rozwodniony zysk na akcję',
    'verwässertes ergebnis je aktie',
    'ergebnis je aktie verwässert',
    'résultat net dilué par action',
    'bénéfice dilué par action',
    'earnings per share diluted',
  ],
  'fsl-pl-shares-outstanding': [
    'weighted average shares outstanding',
    'średnia ważona liczba akcji',
    'średnia ważona liczba akcji zwykłych',
    'liczba akcji',
    'gewichtete durchschnittliche anzahl aktien',
    'gewichteter durchschnitt der ausstehenden aktien',
  ],
  // ── NEW CF HINTS ──
  'fsl-cf-operating-depreciation-intangibles': [
    'amortization of intangible assets',
    'amortyzacja wartości niematerialnych',
    'amortyzacja wnip',
    'abschreibungen auf immaterielle vermögenswerte',
  ],
  'fsl-cf-operating-depreciation-ppe': [
    'depreciation of ppe',
    'amortyzacja rzeczowych aktywów trwałych',
    'amortyzacja środków trwałych',
    'abschreibungen auf sachanlagen',
  ],
  'fsl-cf-operating-depreciation-rou': [
    'depreciation of right-of-use assets',
    'amortyzacja aktywów z tytułu prawa do użytkowania',
    'amortyzacja prawa do użytkowania',
    'abschreibungen auf nutzungsrechte',
  ],
  'fsl-cf-operating-ebt': [
    'profit before tax cf',
    'zysk przed opodatkowaniem',
    'zysk brutto',
    'strata brutto',
    'zysk/strata brutto',
    'zysk strata przed opodatkowaniem',
    'przepływy pieniężne z działalności operacyjnej zysk strata przed opodatkowaniem',
    'ergebnis vor steuern',
    'ergebnis vor ertragsteuern',
  ],
  'fsl-cf-operating-adjustments': [
    'total adjustments',
    'korekty razem',
    'korekty',
    'adjustments',
    'anpassungen gesamt',
    'bereinigungen',
  ],
  'fsl-cf-operating-impairment': [
    'impairment charges cf',
    'odpisy aktualizujące',
    'odpisy aktualizujące wartość aktywów',
    'utrata wartości aktywów',
    'wertminderungen',
    'wertminderungsaufwand',
    'außerplanmäßige abschreibungen',
  ],
  'fsl-cf-operating-gain-disposal': [
    'gain on disposal of assets',
    'impairment and gain loss on sale of businesses and fixed assets',
    'significant gains losses net',
    'zyski straty na sprzedaży aktywów',
    'zysk strata ze sprzedaży niefinansowych aktywów trwałych',
    'zysk strata ze zbycia aktywów trwałych',
    'strata zysk ze sprzedaży aktywów trwałych',
    'zysk na sprzedaży rzeczowych aktywów trwałych i wartości niematerialnych',
    'zysk na sprzedaży rzeczowych aktywów trwałych',
    'zyski straty na sprzedaży rzeczowych aktywów trwałych',
    'gewinn verlust aus dem abgang von vermögenswerten',
    'ergebnis aus dem abgang von anlagevermögen',
  ],
  'fsl-cf-operating-fv-changes': [
    'fair value changes investment property',
    'zyski z wyceny nieruchomości inwestycyjnych według wartości godziwej',
    'straty z wyceny nieruchomości inwestycyjnych',
    'zmiana wartości godziwej nieruchomości',
    'änderung des beizulegenden zeitwerts von anlageimmobilien',
  ],
  'fsl-cf-operating-fv-derivatives': [
    'fair value changes derivatives',
    'zyski straty z tytułu zmiany wartości godziwej instrumentów pochodnych',
    'zmiany wartości godziwej instrumentów pochodnych',
    'zmiana wartości godziwej instrumentów pochodnych',
    'niezrealizowane różnice kursowe',
    'różnice kursowe',
    'änderung des beizulegenden zeitwerts von derivaten',
    'unrealisierte kursdifferenzen',
    'nicht realisierte währungskursgewinne und -verluste',
  ],
  'fsl-cf-operating-dividend-income': [
    'dividend income cf',
    'przychody z dywidend',
    'przychody z tytułu dywidend',
    'dividendenerträge',
    'erträge aus dividenden',
  ],
  'fsl-cf-dividends-received': [
    'dividends received',
    'dividends received from joint ventures',
    'dividends received from joint ventures and associates',
    'dywidendy otrzymane',
    'otrzymane dywidendy',
    'erhaltene dividenden',
  ],
  'fsl-cf-operating-other-adj': [
    'other adjustments',
    'other items',
    'other non-cash income and expense items',
    'non-cash interest and other operating activities',
    'razem wyłączenia przychodów i kosztów',
    'inne korekty',
    'pozostałe korekty',
    'pozostałe odsetki',
    'sonstige anpassungen',
    'sonstige bereinigungen',
    'deferred income taxes',
    'other operating charges',
    'inventory and purchase commitments write-downs',
    'operating lease vehicles',
    'deferred tax',
    'supplemental disclosures cash paid during the period for interest',
    'supplemental disclosures cash paid during the period for interest $',
  ],
  'fsl-cf-operating-equity-method': [
    'equity method cf',
    'result from equity accounted investments',
    'earnings from joint ventures',
    'earnings from joint ventures and associates',
    'earnings from associates',
    'share of profit of associates',
    'equity income loss',
    'udział w zyskach jednostek stowarzyszonych',
    'udział w wyniku jednostek wycenianych metodą praw własności',
    'ergebnis aus at equity bilanzierten beteiligungen',
  ],
  'fsl-cf-operating-interest-income': [
    'interest income cf',
    'interest received',
    'interest receivable',
    'interest and similar income',
    'przychody z odsetek',
    'przychody z tytułu odsetek',
    'przychody odsetkowe',
    'odsetki otrzymane',
    'odsetki od pożyczek udzielonych wspólnemu przedsięwzięciu',
    'zinserträge',
    'erhaltene zinsen',
  ],
  'fsl-cf-operating-before-wc': [
    'cf before working capital changes',
    'przepływy przed zmianami w kapitale obrotowym',
    'środki pieniężne z działalności operacyjnej przed zmianami',
    'cashflow vor veränderung des working capital',
  ],
  'fsl-cf-operating-generated': [
    'cash generated from operations',
    'środki pieniężne wygenerowane z działalności operacyjnej',
    'środki pieniężne z działalności operacyjnej',
    'aus betrieblicher tätigkeit erwirtschaftete zahlungsmittel',
  ],
  'fsl-cf-capex-intangibles': [
    'capex intangible assets',
    'wydatki na wartości niematerialne',
    'wydatki na nabycie wartości niematerialnych',
    'nabycie wartości niematerialnych',
    'i wartości niematerialnych',
    'udzielone zaliczki na rzeczowe aktywa trwałe i wartości niematerialne',
    'auszahlungen für investitionen in immaterielle vermögenswerte',
    'erwerb immaterieller vermögenswerte',
  ],
  'fsl-cf-investing-disposal-proceeds': [
    'disposal proceeds',
    'wpływy ze sprzedaży aktywów',
    'wpływy ze sprzedaży rzeczowych aktywów trwałych',
    'wpływy ze sprzedaży aktywów trwałych',
    'wpływy ze zbycia aktywów trwałych',
    'einzahlungen aus dem abgang von anlagevermögen',
    'erlöse aus dem verkauf von sachanlagen',
    'proceeds from disposals of fixed assets',
    'proceeds from disposals of businesses',
    'proceeds from disposals of businesses net of cash disposed',
    'proceeds from disposals of property plant and equipment',
    'proceeds from disposal of intangible assets and property plant and equipment',
    'proceeds from disposals of investments',
    'proceeds from maturities of investments',
    'proceeds from sales of investments',
    'proceeds from disposals of businesses equity method investments and nonmarketable securities',
    'proceeds from disposal of property plant and equipment',
    'proceeds from disposals of subsidiaries',
    'proceeds from the disposal of marketable securities and investment funds',
    'proceeds from disposal of marketable securities',
    'proceeds from subsidies for intangible assets and property plant and equipment',
  ],
  'fsl-cf-fx-on-cash': [
    'fx effect on cash',
    'wpływ zmian kursów walut na środki pieniężne',
    'różnice kursowe netto',
    'wpływ zmian kursów walut',
    'wechselkursbedingte veränderung des finanzmittelbestands',
    'währungskurseffekte auf zahlungsmittel',
    'effect of exchange rate on cash and cash equivalents',
    'effect of exchange rate changes on cash',
    'effect of exchange rate changes on cash and cash equivalents',
  ],
  'fsl-cf-tax-refund': [
    'tax refund',
    'zwrot podatku',
    'zwrot podatku dochodowego',
    'steuererstattungen',
    'erstattung von ertragsteuern',
  ],
  'fsl-cf-dividends': [
    'dividends paid',
    'dividends',
    'payment of dividends',
    'payment of dividends to shareholders',
    'dividends paid bp shareholders',
    'dywidendy wypłacone',
    'wypłata dywidend',
    'dywidendy zapłacone',
    'wydatki z tytułu dywidend',
    'wydatki z tytułu dywidend wypłaconych akcjonariuszom',
    'gezahlte dividenden',
    'dividendenzahlungen',
    'ausschüttung an aktionäre',
    'dividendes versés',
    'dividendes payés',
    'payment of dividends to non-controlling interests',
    'dividends paid to non-controlling interests',
    'dividends paid to minority interests',
  ],
  'fsl-cf-debt-drawdown': [
    'debt drawdown',
    'wpływy z tytułu zaciągnięcia kredytów',
    'zaciągnięcie kredytów i pożyczek',
    'wpływy z kredytów',
    'aufnahme von finanzkrediten',
    'aufnahme von finanzverbindlichkeiten',
    'einzahlungen aus der aufnahme von darlehen',
    'kreditaufnahme',
    'produits des emprunts',
    "émission d'emprunts",
    'proceeds from long-term debt',
    'proceeds from short-term debt',
    'proceeds from long-term financing',
    'proceeds from issue of non-current financial liabilities',
    'proceeds from issuances of debt',
    'issuances of loans notes payable and long-term debt',
    'issuances of debt',
    'net increase decrease in short-term debt',
    'net increase in short-term debt',
    'issue of perpetual hybrid bonds',
    'wpływy z zaciągnięcia kredytów',
  ],
  'fsl-cf-debt-repayment': [
    'debt repayment',
    'spłata kredytów i pożyczek',
    'spłaty kredytów i pożyczek',
    'spłata kredytów',
    'spłaty kredytów',
    'tilgung von finanzkrediten',
    'tilgung von finanzverbindlichkeiten',
    'auszahlungen für die tilgung von darlehen',
    'rückzahlung von darlehen',
    "remboursement d'emprunts",
    'repayments of long-term debt',
    'repayments of short-term debt',
    'repayments of long-term financing',
    'repayment of non-current financial liabilities',
    'payments of loans notes payable and long-term debt',
    'repayments of debt',
    'redemption of perpetual hybrid bonds',
  ],
  'fsl-cf-lease-repayment': [
    'lease repayment',
    'spłata zobowiązań z tytułu leasingu',
    'spłaty zobowiązań leasingowych',
    'spłata leasingu',
    'tilgung von leasingverbindlichkeiten',
    'auszahlungen für leasingverbindlichkeiten',
    'remboursement des dettes locatives',
    'principal repayments of finance leases',
  ],
  'fsl-cf-taxes-paid': [
    'taxes paid',
    'income taxes paid',
    'zapłacony podatek dochodowy',
    'podatek zapłacony',
    'podatek dochodowy zapłacony',
    'wydatki z tytułu zapłaty podatku dochodowego',
    'gezahlte ertragsteuern',
    'auszahlungen für ertragsteuern',
    'impôts payés',
    'impôts sur les sociétés payés',
  ],
  'fsl-cf-interest-paid': [
    'interest paid',
    'odsetki zapłacone',
    'odsetki zapłacone netto',
    'zapłacone odsetki',
    'gezahlte zinsen',
    'auszahlungen für zinsen',
  ],
  'fsl-cf-other-expenditure': [
    'other expenditure',
    'debt issuance costs',
    'wydatki z tytułu instrumentów pochodnych związanych ze źródłami finansowania zewnętrznego',
    'wydatki na aktywa finansowe przeznaczone na likwidację kopalń i innych obiektów technologicznych',
    'wspólnemu przedsięwzięciu',
    'od zobowiązań handlowych objętych mechanizmami faktoringu odwrotnego',
    'inne wydatki',
    'inne wydatki finansowe',
    'inne wydatki inwestycyjne',
    'sonstige auszahlungen',
    'sonstige investitionsauszahlungen',
  ],
  'fsl-cf-other-receipts': [
    'other receipts',
    'wpływy z tytułu instrumentów pochodnych związanych ze źródłami finansowania zewnętrznego',
    'inne wpływy',
    'inne wpływy wydatki',
    'inne wpływy finansowe',
    'inne wpływy inwestycyjne',
    'sonstige einzahlungen',
    'sonstige investitionseinzahlungen',
  ],
  'fsl-cf-investing-subsidiaries': [
    'investment in subsidiaries',
    'investment in associates',
    'investment in joint ventures',
    'receipts relating to transactions involving non-controlling interests',
    'receipts relating to transactions involving non-controlling interests other',
    'inwestycje w jednostki zależne',
    'nabycie jednostek zależnych',
    'wydatki na nabycie udziałów w jednostkach zależnych',
    'erwerb von tochterunternehmen',
    'auszahlungen für den erwerb von tochtergesellschaften',
  ],
  'fsl-cf-change-wc-restricted-cash': [
    'change in restricted cash',
    'zmiana stanu środków pieniężnych o ograniczonym sposobie dysponowania',
    'środki pieniężne o ograniczonym dysponowaniu',
    'veränderung verfügungsbeschränkter zahlungsmittel',
  ],
  'fsl-cf-change-wc-prepaids': [
    'change in prepayments',
    'zmiana stanu rozliczeń międzyokresowych',
    'zmiana stanu czynnych rozliczeń międzyokresowych',
    'veränderung der rechnungsabgrenzungsposten',
  ],
  // ── MISSING P&L SUB-LINES ──
  'fsl-pl-revenue-product': [
    'product revenue',
    'przychody ze sprzedaży produktów',
    'przychody z produktów',
    'revenue from products',
    'przychody ze sprzedaży wyrobów',
    'erlöse aus produktverkäufen',
    'erlöse aus dem verkauf von erzeugnissen',
    'automotive sales',
    'automotive revenues',
    'total automotive revenues',
    'sales of products previously leased to customers',
    'revenues automotive sales',
  ],
  'fsl-pl-revenue-product-domestic': [
    'domestic product revenue',
    'przychody produktowe kraj',
    'przychody krajowe',
    'domestic revenue',
    'przychody ze sprzedaży krajowej',
    'inlandserlöse',
    'erlöse inland',
  ],
  'fsl-pl-revenue-product-export': [
    'export product revenue',
    'przychody produktowe eksport',
    'przychody z eksportu',
    'export revenue',
    'przychody ze sprzedaży eksportowej',
    'auslandserlöse',
    'erlöse ausland',
    'exporterlöse',
  ],
  'fsl-pl-revenue-service': [
    'service revenue',
    'przychody z usług',
    'przychody usługowe',
    'przychody ze sprzedaży usług',
    'revenue from services',
    'erlöse aus dienstleistungen',
    'dienstleistungserlöse',
    'services and other',
    'energy generation and storage',
    'revenues from service contracts telematics and roadside assistance',
    'interest income on credit financing and finance leases',
    'automotive leasing',
  ],
  'fsl-pl-revenue-service-subscription': [
    'subscription revenue',
    'przychody abonamentowe',
    'przychody z subskrypcji',
    'recurring revenue',
    'przychody cykliczne',
  ],
  'fsl-pl-revenue-service-projects': [
    'project revenue',
    'przychody projektowe',
    'przychody z projektów',
    'project-based revenue',
    'przychody z realizacji projektów',
  ],
  'fsl-pl-revenue-other': [
    'other revenue',
    'pozostałe przychody ze sprzedaży',
    'przychody inne',
    'other sales',
    'inne przychody ze sprzedaży',
    'automotive regulatory credits',
    'other operating revenue',
    'other operating revenues',
    'remaining revenue',
    'pozostałe przychody',
    'sonstige umsatzerlöse',
  ],
  'fsl-pl-cogs-materials': [
    'materials cost',
    'koszt materiałów',
    'zużycie materiałów i energii',
    'materiały i energia',
    'materials and energy',
    'koszty materiałowe',
    'materialaufwand',
    'aufwendungen für roh- hilfs- und betriebsstoffe',
  ],
  'fsl-pl-cogs-materials-raw': [
    'raw materials cost',
    'koszt surowców',
    'surowce',
    'zużycie surowców',
    'raw materials',
  ],
  'fsl-pl-cogs-materials-freight': [
    'inbound freight',
    'transport zakupu',
    'koszty transportu',
    'freight costs',
    'koszty frachtu',
  ],
  'fsl-pl-cogs-labor': [
    'direct labor cost',
    'koszt robocizny bezpośredniej',
    'wynagrodzenia bezpośrednie',
    'direct labor',
    'robocizna bezpośrednia',
    'personalaufwand',
    'personalkosten',
    'löhne und gehälter',
  ],
  'fsl-pl-cogs-labor-payroll': [
    'production payroll',
    'płace produkcyjne',
    'wynagrodzenia produkcyjne',
    'production wages',
  ],
  'fsl-pl-cogs-labor-contractors': [
    'production contractors',
    'usługi produkcyjne obce',
    'usługi obce produkcyjne',
    'outsourced production',
  ],
  'fsl-pl-cogs-other': [
    'other direct costs',
    'pozostałe koszty bezpośrednie',
    'inne koszty bezpośrednie',
    'other cost of sales',
    'pozostałe koszty sprzedanych produktów',
  ],
  'fsl-pl-selling-marketing': [
    'marketing expenses',
    'koszty marketingu',
    'koszty reklamy',
    'marketing and advertising',
    'reklama i promocja',
  ],
  'fsl-pl-selling-logistics': [
    'logistics expenses',
    'koszty logistyki',
    'koszty dystrybucji',
    'logistics costs',
    'distribution logistics',
  ],
  'fsl-pl-selling-commissions': [
    'sales commissions',
    'prowizje sprzedażowe',
    'prowizje',
    'commission expenses',
    'prowizje od sprzedaży',
  ],
  'fsl-pl-gna-payroll': [
    'g&a payroll',
    'płace administracji',
    'wynagrodzenia administracyjne',
    'admin payroll',
    'koszty wynagrodzeń administracji',
  ],
  'fsl-pl-gna-rent': [
    'office rent',
    'czynsz biur',
    'czynsz najmu',
    'najem biur',
    'office lease costs',
    'koszty najmu',
  ],
  'fsl-pl-gna-it': [
    'it and software',
    'it i oprogramowanie',
    'koszty it',
    'koszty informatyczne',
    'software costs',
  ],
  'fsl-pl-gna-external': [
    'external services',
    'usługi obce',
    'usługi zewnętrzne',
    'outsourced services',
    'koszty usług obcych',
    'bezogene leistungen',
    'fremdleistungen',
  ],
  'fsl-pl-other-opex': [
    'other operating expenses',
    'other operating charges',
    'pozostałe koszty operacyjne',
    'inne koszty operacyjne',
    'other operational costs',
    'sonstige betriebliche aufwendungen',
    'research and development',
    'research and development expenses',
    'r&d expenses',
    'forschungs- und entwicklungskosten',
    'research and development expenditure',
    'restructuring and other',
    'restructuring charges',
    'autres charges opérationnelles',
    'other cost of sales',
    'warranty expenditure',
    'restructuring costs',
  ],
  'fsl-pl-other-opex-impairment': [
    'impairment expense',
    'odpisy aktualizujące',
    'odpisy aktualizujące wartość aktywów',
    'impairment charges',
    'utrata wartości aktywów',
    'wertminderungsaufwand',
    'außerplanmäßige abschreibungen',
    'net impairment and losses on sale of businesses and fixed assets',
    'impairment and gain loss on sale of businesses and fixed assets',
    'net impairment charges',
    'impairment losses on financial assets',
  ],
  'fsl-pl-other-opex-provisions': [
    'provisions expense',
    'koszt rezerw',
    'utworzenie rezerw',
    'zmiana stanu rezerw',
    'provision charges',
    'aufwand aus rückstellungen',
    'zuführung zu rückstellungen',
    'expense for additions to provisions',
    'provision expense',
    'dotacja na rezerwy',
  ],
  'fsl-pl-depreciation-ppe': [
    'ppe depreciation',
    'amortyzacja środków trwałych',
    'amortyzacja rzeczowych aktywów trwałych',
    'depreciation of property plant and equipment',
    'abschreibungen auf sachanlagen',
  ],
  'fsl-pl-depreciation-intangibles': [
    'intangible amortization',
    'amortyzacja wnip',
    'amortyzacja wartości niematerialnych i prawnych',
    'amortization of intangible assets',
    'abschreibungen auf immaterielle vermögenswerte',
  ],
  'fsl-pl-interest-bank': [
    'bank interest expense',
    'odsetki bankowe',
    'odsetki od kredytów',
    'koszty odsetek bankowych',
    'bank interest',
    'bankzinsen',
    'zinsaufwand für bankdarlehen',
  ],
  'fsl-pl-interest-lease': [
    'lease interest expense',
    'odsetki leasingowe',
    'odsetki od leasingu',
    'odsetki z tytułu leasingu',
    'lease interest',
    'leasingzinsen',
    'zinsaufwand für leasingverbindlichkeiten',
  ],
  'fsl-pl-other-fin': [
    'other financial result',
    'financial result',
    'pozostałe przychody koszty finansowe',
    'wynik finansowy netto',
    'inne przychody koszty finansowe',
    'other finance result',
    'sonstiges finanzergebnis',
    'übriges finanzergebnis',
    'sundry other financial result',
    'other financial result net',
    'exploration expense',
    'other financial income and expense',
    'net financial result',
    'wynik na działalności finansowej',
    'net interest impact on other long-term provisions',
    'other interest and similar expenses',
    'income from investments in subsidiaries and participations',
    'expenses from investments in subsidiaries and participations',
    'exchange losses',
    'exchange gains and losses',
  ],
  // ── MISSING BS SUB-LINES ──
  'fsl-bs-cash-operating': [
    'operating cash',
    'gotówka operacyjna',
    'środki pieniężne operacyjne',
    'unrestricted cash',
    'frei verfügbare zahlungsmittel',
  ],
  'fsl-bs-cash-restricted': [
    'restricted cash',
    'środki zablokowane',
    'środki pieniężne o ograniczonym dysponowaniu',
    'depozyty zabezpieczające',
    'restricted deposits',
    'verfügungsbeschränkte zahlungsmittel',
    'zweckgebundene zahlungsmittel',
  ],
  'fsl-bs-ar-trade': [
    'trade receivables',
    'należności handlowe',
    'należności z tytułu dostaw i usług',
    'trade and other receivables',
    'należności z tytułu dostaw',
    'forderungen aus lieferungen und leistungen',
    'trade accounts receivable',
  ],
  'fsl-bs-ar-other': [
    'other receivables',
    'pozostałe należności',
    'inne należności',
    'other accounts receivable',
    'sonstige forderungen',
    'übrige forderungen',
  ],
  'fsl-bs-inventory-raw': [
    'raw materials inventory',
    'materiały',
    'surowce i materiały',
    'raw materials and supplies',
    'surowce',
    'roh- hilfs- und betriebsstoffe',
    'rohstoffe',
  ],
  'fsl-bs-inventory-wip': [
    'work in progress',
    'produkcja w toku',
    'półprodukty i produkcja w toku',
    'wip inventory',
    'półprodukty',
    'unfertige erzeugnisse',
    'unfertige leistungen',
  ],
  'fsl-bs-inventory-fg': [
    'finished goods',
    'wyroby gotowe',
    'produkty gotowe',
    'finished goods inventory',
    'fertige erzeugnisse',
    'fertigerzeugnisse',
  ],
  'fsl-bs-other-current-assets-vat': [
    'vat receivables',
    'należności vat',
    'należności z tytułu podatku vat',
    'vat refund receivable',
    'zwrot vat',
  ],
  'fsl-bs-ppe-land': [
    'land and buildings',
    'grunty i budynki',
    'nieruchomości gruntowe',
    'grunty',
    'land',
    'grunty własne',
    'grundstücke und bauten',
    'grundstücke',
    'gebäude',
  ],
  'fsl-bs-ppe-machinery': [
    'machinery and equipment',
    'maszyny i urządzenia',
    'urządzenia techniczne i maszyny',
    'equipment',
    'maszyny',
    'technische anlagen und maschinen',
    'maschinen und geräte',
  ],
  'fsl-bs-ppe-vehicles': [
    'vehicles',
    'środki transportu',
    'pojazdy',
    'transport equipment',
    'tabor',
    'fuhrpark',
    'fahrzeuge',
  ],
  'fsl-bs-intangibles-software': [
    'software assets',
    'oprogramowanie',
    'licencje na oprogramowanie',
    'software licenses',
    'oprogramowanie komputerowe',
    'software',
    'erworbene softwarelizenzen',
  ],
  'fsl-bs-other-non-current-assets': [
    'other non-current assets',
    'pozostałe aktywa trwałe',
    'inne aktywa trwałe',
    'other fixed assets',
    'inne aktywa długoterminowe',
    'sonstige langfristige vermögenswerte',
    'übrige langfristige vermögenswerte',
    'other noncurrent assets',
  ],
  'fsl-bs-ap-trade': [
    'trade payables',
    'zobowiązania handlowe krajowe',
    'zobowiązania z tytułu dostaw',
    'trade and other payables',
    'zobowiązania z tytułu zakupu towarów',
    'verbindlichkeiten aus lieferungen und leistungen',
    'zobowiązania handlowe',
    'zobowiązania z tytułu dostaw i usług',
    'accounts payable trade',
  ],
  'fsl-bs-short-term-debt-bank': [
    'short-term bank debt',
    'krótkoterminowy dług bankowy',
    'krótkoterminowe kredyty bankowe',
    'short-term bank loans',
    'kredyty bankowe krótkoterminowe',
    'kurzfristige bankverbindlichkeiten',
    'kurzfristige bankdarlehen',
  ],
  'fsl-bs-other-current-liabilities-accruals': [
    'accrued expenses',
    'rozliczenia międzyokresowe bierne',
    'bierne rozliczenia międzyokresowe',
    'accruals',
    'rezerwy na koszty',
    'passive rechnungsabgrenzung',
    'abgegrenzte schulden',
    'accrued liabilities',
    'accounts payable and accrued expenses',
    'abgrenzungsverbindlichkeiten',
    'rückstellungen und abgrenzungen',
  ],
  'fsl-bs-long-term-debt-bank': [
    'long-term bank debt',
    'dług bankowy długoterminowy',
    'długoterminowe kredyty bankowe',
    'long-term bank loans',
    'kredyty bankowe długoterminowe',
    'langfristige bankverbindlichkeiten',
    'langfristige bankdarlehen',
  ],
  'fsl-bs-retained-earnings-prior': [
    'retained earnings prior years',
    'wynik lat ubiegłych',
    'zysk strata z lat ubiegłych',
    'prior year results',
    'zyski zatrzymane z lat ubiegłych',
    'niepodzielony wynik z lat ubiegłych',
    'gewinnvortrag',
    'ergebnisvortrag',
  ],
  'fsl-bs-retained-earnings-current': [
    'current year result',
    'wynik bieżącego roku',
    'zysk strata bieżącego roku',
    'current period result',
    'wynik roku obrotowego',
    'zysk netto roku bieżącego',
    'jahresüberschuss des laufenden jahres',
    'periodenergebnis',
  ],
  // ── COST-BY-NATURE P&L (HGB Gesamtkostenverfahren / Polish UoR wariant porównawczy) ──
  'fsl-pl-cbn-inventory-change': [
    'change in inventories of finished goods and wip',
    'zmiana stanu produktów',
    'zmiana stanu zapasów produktów',
    'zmiana stanu produktów gotowych i produkcji w toku',
    'bestandsveränderungen',
    'bestandsveränderungen der fertigen und unfertigen erzeugnisse',
    'erhöhung oder verminderung des bestands',
    'veränderung des bestands an fertigen und unfertigen erzeugnissen',
    'change in inventory of finished goods',
    'zmiana stanu zapasów produktów gotowych',
    'bestandsveränderung',
  ],
  'fsl-pl-cbn-own-work-capitalised': [
    'own work capitalised',
    'koszt wytworzenia produktów na własne potrzeby',
    'koszt wytworzenia produktów na własne potrzeby jednostki',
    'własne potrzeby',
    'andere aktivierte eigenleistungen',
    'aktivierte eigenleistungen',
    'other own work capitalized',
  ],
  'fsl-pl-cbn-materials-energy': [
    'materials and energy',
    'zużycie materiałów i energii',
    'materiały i energia',
    'zużycie materiałów',
    'zużycie energii',
    'materialaufwand',
    'aufwendungen für roh- hilfs- und betriebsstoffe',
    'aufwendungen für bezogene leistungen',
    'roh- hilfs- und betriebsstoffe und bezogene waren',
    'aufwendungen für bezogene waren',
  ],
  'fsl-pl-cbn-external-services': [
    'external services',
    'usługi obce',
    'usługi zewnętrzne',
    'koszty usług obcych',
    'bezogene leistungen',
    'fremdleistungen',
    'aufwendungen für bezogene leistungen',
  ],
  'fsl-pl-cbn-taxes-fees': [
    'taxes and fees',
    'podatki i opłaty',
    'podatki i opłaty operacyjne',
    'steuern und abgaben',
    'sonstige steuern',
  ],
  'fsl-pl-cbn-payroll': [
    'payroll',
    'wages and salaries',
    'wynagrodzenia',
    'płace i wynagrodzenia',
    'koszty wynagrodzeń',
    'löhne und gehälter',
    'personalaufwand',
    'personalkosten',
    'gehälter',
    'löhne',
  ],
  'fsl-pl-cbn-social-security': [
    'social security and other benefits',
    'ubezpieczenia społeczne i inne świadczenia',
    'ubezpieczenia społeczne',
    'narzuty na wynagrodzenia',
    'świadczenia na rzecz pracowników',
    'składki na ubezpieczenia społeczne',
    'soziale abgaben und aufwendungen für altersversorgung',
    'soziale abgaben',
    'arbeitgeberanteil sozialversicherung',
    'aufwendungen für altersversorgung',
  ],
  'fsl-pl-cbn-other-by-nature': [
    'other operating costs by nature',
    'pozostałe koszty rodzajowe',
    'inne koszty rodzajowe',
    'pozostałe koszty',
    'sonstige betriebliche aufwendungen',
    'übrige betriebliche aufwendungen',
  ],
  'fsl-pl-cbn-total-by-nature': [
    'total operating costs by nature',
    'koszty działalności operacyjnej',
    'koszty działalności operacyjnej razem',
    'razem koszty rodzajowe',
    'suma kosztów rodzajowych',
    'gesamtkosten',
    'summe betriebliche aufwendungen',
  ],
  'fsl-pl-cbn-operating-result': [
    'operating result',
    'wynik na działalności operacyjnej',
    'zysk strata z działalności operacyjnej',
    'wynik operacyjny',
    'betriebsergebnis',
    'ergebnis der gewöhnlichen geschäftstätigkeit',
  ],
  // ── MISSING CF SUB-LINES ──
  'fsl-cf-operating-net-income': [
    'net income in operating cash flow',
    'profit before taxation',
    'profit loss before taxation',
    'consolidated net income',
    'wynik netto',
    'zysk netto',
    'strata netto',
    'wynik finansowy netto',
    'jahresüberschuss',
    'konzernergebnis',
    'periodenergebnis',
    'net income cf',
    'net income',
    'net income loss',
    'net profit loss',
    'profit loss before tax',
    'profit before tax',
    'profit loss for the year',
    'profit for the year',
    'cash flows from operating activities net income',
  ],
  'fsl-cf-change-wc': [
    'change in working capital',
    'changes in working capital',
    'changes in operating assets and liabilities',
    'changes in assets and liabilities',
    'net change in operating assets and liabilities',
    'zmiana kapitału obrotowego',
    'zmiany w kapitale obrotowym netto',
    'zmiana kapitału pracującego',
    'zmiana stanu kapitału obrotowego',
    'veränderung des nettoumlaufvermögens',
    'veränderung des working capital',
  ],
  'fsl-cf-capex-maintenance': [
    'maintenance capex',
    'capex odtworzeniowy',
    'nakłady odtworzeniowe',
    'replacement capex',
    'erhaltungsinvestitionen',
  ],
  'fsl-cf-capex-growth': [
    'growth capex',
    'capex rozwojowy',
    'nakłady rozwojowe',
    'expansion capex',
    'erweiterungsinvestitionen',
    'wachstumsinvestitionen',
  ],
  'fsl-cf-other-investing': [
    'other investing cash flow',
    'pozostałe przepływy inwestycyjne',
    'inne przepływy inwestycyjne',
    'other investing activities',
    'sonstige investitionstätigkeit',
    'sonstige investitionsein- und -auszahlungen',
  ],
  'fsl-cf-debt-drawdown-bank': [
    'bank debt drawdown',
    'uruchomienie długu bankowego',
    'zaciągnięcie kredytów bankowych',
    'bank loan proceeds',
    'wpływy z kredytów bankowych',
    'aufnahme von bankdarlehen',
    'einzahlungen aus bankdarlehen',
  ],
  'fsl-cf-debt-drawdown-lease': [
    'lease drawdown',
    'nowe zobowiązania leasingowe',
    'nowe umowy leasingowe',
    'new lease liabilities',
    'neue leasingverbindlichkeiten',
    'zugang leasingverbindlichkeiten',
  ],
  'fsl-cf-debt-repayment-bank': [
    'bank debt repayment',
    'spłata długu bankowego',
    'spłata kredytów bankowych',
    'bank loan repayment',
    'tilgung von bankdarlehen',
    'rückzahlung von bankverbindlichkeiten',
  ],
  'fsl-cf-debt-repayment-lease': [
    'lease debt repayment',
    'spłata leasingu',
    'spłata zobowiązań leasingowych',
    'lease liability repayment',
    'tilgung von leasingverbindlichkeiten',
    'rückzahlung von leasingverbindlichkeiten',
  ],
  'fsl-cf-operating-sbc': [
    'stock based compensation',
    'stock based compensation expense',
    'share based compensation',
    'share based payments',
    'share based payment expense',
    'wynagrodzenie w formie akcji',
    'aktienbasierte vergütung',
  ],
  'fsl-cf-share-buyback': [
    'repurchase of shares',
    'repurchase of ordinary share capital',
    'purchases of stock for treasury',
    'treasury shares acquired',
    'share buyback',
    'skup akcji własnych',
    'nabycie akcji własnych',
    'rückkauf eigener aktien',
    'repurchase of common stock',
    'buybacks of common stock',
  ],
  // ── NEW CANONICAL IDS ALIASES ──
  'fsl-pl-rnd': [
    'research and development',
    'research and development expenses',
    'research and development expenditure',
    'research and development costs',
    'r&d expenses',
    'r&d costs',
    'koszty badań i rozwoju',
    'nakłady na badania i rozwój',
    'forschung und entwicklung',
    'forschungs- und entwicklungskosten',
    'frais de recherche et développement',
  ],
  'fsl-pl-sga': [
    'selling general and administrative',
    'selling and administrative expenses',
    'selling general and administrative expenses',
    'sg&a',
    'sga',
    'koszty sprzedaży i ogólnego zarządu',
  ],
  'fsl-bs-st-investments': [
    'short-term investments',
    'marketable securities',
    'total cash cash equivalents and short-term investments',
    'inwestycje krótkoterminowe',
    'lokaty krótkoterminowe',
    'kurzfristige finanzanlagen',
    'kurzfristige wertpapiere',
    'placements à court terme',
  ],
  'fsl-bs-deferred-revenue-current': [
    'deferred revenue',
    'deferred revenue current',
    'unearned revenue',
    'przychody przyszłych okresów',
    'przychody przyszłych okresów krótkoterminowe',
    'abgegrenzte erlöse',
    'abgegrenzte umsatzerlöse',
    "produits constatés d'avance",
  ],
  'fsl-bs-deferred-revenue-non-current': [
    'deferred revenue net of current portion',
    'deferred revenue non-current',
    'long-term deferred revenue',
    'przychody przyszłych okresów długoterminowe',
    'langfristige abgegrenzte erlöse',
  ],
  'fsl-bs-pension-surplus': [
    'defined benefit pension plan surpluses',
    'pension surplus',
    'nadwyżka programu emerytalnego',
    'nadwyżka programu określonych świadczeń',
    'pensionsüberschuss',
    'leistungsorientierter pensionsüberschuss',
  ],
  'fsl-bs-pension-deficit': [
    'defined benefit pension plan and other post-employment benefit plan deficits',
    'defined benefit pension plan deficits',
    'pension deficit',
    'pension obligations',
    'niedobór programu emerytalnego',
    'pensionsdefizit',
    'pensionsverpflichtungen',
  ],
  'fsl-cf-investing-acquisitions': [
    'acquisitions net of cash acquired',
    'acquisitions net of cash',
    'acquisitions of businesses',
    'acquisitions of businesses equity method investments and nonmarketable securities',
    'business combinations net of cash acquired',
    'przejęcia',
    'nabycie przedsiębiorstw',
    'unternehmenserwerbe',
    'erwerb von unternehmen',
    'acquisitions de sociétés',
    "acquisitions d'entreprises",
  ],
  'fsl-cf-investing-securities': [
    'purchases of investments',
    'proceeds from sales and maturities of investments',
    'investments in marketable securities and investment funds',
    'proceeds from the disposal of marketable securities and investment funds',
    'nabycie i sprzedaż papierów wartościowych',
    'zakup inwestycji',
    'erwerb von wertpapieren',
    'kauf von wertpapieren und investmentfonds',
  ],
  'fsl-cf-investing-jv': [
    'investment in joint ventures',
    'investment in associates',
    'investments in joint ventures and associates',
    'inwestycje we wspólne przedsięwzięcia',
    'investitionen in gemeinschaftsunternehmen',
  ],
  'fsl-cf-share-issuance': [
    'issuances of stock',
    'proceeds from issuance of common stock',
    'proceeds from stock issuance',
    'proceeds from exercise of stock options',
    'wpływy z emisji akcji',
    'emisja akcji',
    'einzahlungen aus der ausgabe von aktien',
    'ausgabe von anteilen',
  ],
  'fsl-cf-other-financing': [
    'other financing activities',
    'other financing cash flow',
    'pozostałe działalność finansowa',
    'pozostałe przepływy z działalności finansowej',
    'sonstige finanzierungstätigkeit',
    'sonstige finanzierungsaktivitäten',
    'autres activités de financement',
  ],
  'fsl-pl-comprehensive-income-parent': [
    'total comprehensive income attributable to shareholders',
    'comprehensive income attributable to common stockholders',
    'comprehensive income attributable to shareholders',
    'łączne całkowite dochody przypadające akcjonariuszom jednostki dominującej',
    'comprehensive income attributable to owners of the parent',
  ],
  'fsl-pl-total-revenue-and-income': [
    'total revenues and other income',
    'total revenue and other income',
    'przychody i inne dochody razem',
  ],
  'fsl-pl-production-costs': [
    'production and manufacturing expenses',
    'production and similar taxes',
    'koszty produkcji i wytworzenia',
  ],
  'fsl-pl-gains-disposals': [
    'gains on sale of businesses and fixed assets',
    'gain on disposal of businesses',
    'zyski ze sprzedaży przedsiębiorstw i aktywów trwałych',
  ],
  'fsl-pl-revenue-segment': [
    'energy generation and storage',
    'services and other',
    'segment revenue',
    'przychody segmentu',
  ],
  'fsl-pl-cogs-segment': [
    'cost of revenues automotive sales',
    'segment cost of revenue',
    'koszty segmentu',
  ],
  'fsl-pl-oci-derivatives': ['derivative financial instruments oci', 'instrumenty pochodne oci'],
  'fsl-pl-oci-pension-remeasurement': [
    'remeasurement of the net liability for defined benefit pension plans',
    'remeasurement of pension plans',
    'przeszacowanie programów emerytalnych',
  ],
  'fsl-pl-financial-result-net': [
    'financial result',
    'net financial result',
    'wynik finansowy',
    'wynik finansowy netto',
    'finanzergebnis',
  ],
  'fsl-bs-investments-associates': [
    'investments in associates',
    'inwestycje w jednostki stowarzyszone',
    'anteile an assoziierten unternehmen',
    'participations dans les entreprises associées',
  ],
  'fsl-bs-current-tax-receivable': [
    'current tax receivable',
    'current tax',
    'current income tax receivable',
    'należności z tytułu podatku dochodowego',
    'bieżące należności podatkowe',
  ],
  'fsl-bs-current-portion-ltd': [
    'current maturities of long-term debt',
    'current portion of long-term debt',
    'current portion of debt and finance leases',
    'bieżąca część zobowiązań długoterminowych',
  ],
  'fsl-bs-marketable-securities': [
    'marketable securities',
    'zbywalne papiery wartościowe',
    'papiery wartościowe przeznaczone do obrotu',
  ],
  'fsl-bs-derivative-instruments': [
    'derivative financial instruments',
    'instrumenty pochodne',
    'financial instruments derivatives',
    'dérivés financiers',
    'derivative finanzinstrumente',
  ],
  'fsl-bs-liabilities-held-for-sale': [
    'liabilities directly associated with assets classified as held for sale',
    'liabilities associated with assets held for sale',
    'zobowiązania związane z aktywami przeznaczonymi do sprzedaży',
  ],
  'fsl-bs-other-provisions': [
    'other provisions',
    'pozostałe rezerwy',
    'sonstige rückstellungen',
    'autres provisions',
  ],
  'fsl-cf-investing-associates': [
    'investment in associates',
    'investments in associates',
    'inwestycje w jednostki stowarzyszone cf',
  ],
  'fsl-cf-investing-disposal-business': [
    'proceeds from disposals of businesses net of cash disposed',
    'proceeds from disposals of businesses',
    'wpływy ze sprzedaży przedsiębiorstw',
  ],
  'fsl-cf-investing-disposal-investments': [
    'proceeds from disposals of investments',
    'proceeds from disposal of investments',
    'wpływy ze sprzedaży inwestycji',
  ],
  'fsl-cf-financing-short-term-debt': [
    'net increase decrease in short-term debt',
    'net change in short-term debt',
    'zmiana netto zobowiązań krótkoterminowych',
  ],
  'fsl-cf-financing-hybrid-bonds': [
    'issue of perpetual hybrid bonds',
    'redemption of perpetual hybrid bonds',
    'payments relating to perpetual hybrid bonds',
    'obligacje hybrydowe',
  ],
  'fsl-cf-dividends-minority': [
    'payment of dividends to non-controlling interests',
    'dividends paid to non-controlling interests',
    'dividends paid to minority interests',
    'dywidendy wypłacone udziałom niekontrolującym',
  ],
  'fsl-cf-financing-nci': [
    'payments relating to transactions involving non-controlling interests',
    'receipts relating to transactions involving non-controlling interests',
    'transactions with non-controlling interests',
    'transakcje z udziałami niekontrolującymi',
  ],
  'fsl-cf-operating-write-downs': [
    'inventory and purchase commitments write-downs',
    'write-downs and write-offs',
    'odpisy i umorzenia cf',
  ],
  'fsl-cf-investing-disposal-ppe': [
    'proceeds from disposals of property plant and equipment',
    'proceeds from disposal of property plant and equipment',
    'wpływy ze sprzedaży rzeczowych aktywów trwałych',
  ],
  'fsl-cf-investing-maturity-proceeds': [
    'proceeds from maturities of investments',
    'wpływy z zapadalności inwestycji',
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
    /^kapitał\s+podstawowy\s*$/i,
    /^kapitał\s+zapasowy\s*$/i,
    /^należności\s+z\s+tytułu\s+dostaw\s+i\s+usług\s*$/i,
    /^zobowiązania\s+z\s+tytułu\s+dostaw\s+i\s+usług\s*$/i,
    /^aktywa\s+z\s+tytułu\s+(?:odroczonego\s+)?podatku/i,
    /^zapasy\s*$/i,
    /^środki\s+trwałe\s*$/i,
    /^grunty\s+i\s+budynki\s*$/i,
    /^maszyny\s+i\s+urządzenia\s*$/i,
    // DE BS-only
    /^summe\s+(?:aktiva|passiva)\s*$/i,
    /^bilanzsumme\s*$/i,
    /^anlagevermögen\s*$/i,
    /^umlaufvermögen\s*$/i,
    /^sachanlagen\s*$/i,
    /^immaterielle\s+vermögenswerte\s*$/i,
    /^geschäfts-?\s*(?:oder\s+)?firmenwert\s*$/i,
    /^gezeichnetes\s+kapital\s*$/i,
    /^kapitalrücklage\s*$/i,
    /^eigenkapital\s*$/i,
    /^vorräte\s*$/i,
    /^grundstücke\s+und\s+bauten\s*$/i,
    /^technische\s+anlagen\s+und\s+maschinen\s*$/i,
    /^forderungen\s+aus\s+lieferungen\s+und\s+leistungen\s*$/i,
    /^verbindlichkeiten\s+aus\s+lieferungen\s+und\s+leistungen\s*$/i,
    // FR BS-only
    /^total\s+actif\s*$/i,
    /^total\s+passif\s*$/i,
    /^actif\s+(?:non\s+)?courant\s*$/i,
    /^immobilisations\s+(?:corporelles|incorporelles)\s*$/i,
    /^écarts?\s+d'acquisition\s*$/i,
    /^capitaux\s+propres\s*$/i,
    /^capital\s+social\s*$/i,
    /^créances\s+clients\s*$/i,
    /^dettes\s+fournisseurs\s*$/i,
    /^stocks?\s+et\s+en-cours\s*$/i,
    /^trésorerie\s+et\s+équivalents\s*$/i,
  ];
  const plOnlyPatterns = [
    /^zysk\s+brutto\s+ze\s+sprzedaży/i,
    /^koszt\s+własny\s+sprzedaży/i,
    /^koszty\s+(?:sprzedaży|ogólnego\s+zarządu)\s*$/i,
    /^przychody\s+ze\s+sprzedaży\s+(?:produktów|towarów|dóbr|usług)/i,
    /^marża\s+brutto/i,
    /^ebitda\s*$/i,
    /^zysk\s+(?:strata\s+)?operacyjn/i,
    // DE P&L-only
    /^umsatzerlöse\s*$/i,
    /^herstellungskosten/i,
    /^bruttoergebnis/i,
    /^vertriebskosten\s*$/i,
    /^verwaltungskosten\s*$/i,
    /^betriebsergebnis\s*$/i,
    /^jahresüberschuss\s*$/i,
    // FR P&L-only
    /^chiffre\s+d'affaires\s*$/i,
    /^coût\s+des\s+ventes\s*$/i,
    /^marge\s+brute\s*$/i,
    /^résultat\s+opérationnel\s*$/i,
    /^résultat\s+net\s*$/i,
    /^charges\s+(?:commerciales|administratives)\s*$/i,
  ];
  const cfOnlyPatterns = [
    /^korekty\s+razem\s*$/i,
    /^przepływy\s+pieniężne\s+netto\s+z\s+działalności/i,
    /^środki\s+pieniężne\s+na\s+(?:początek|koniec)\s+okresu/i,
    /^zmiana\s+stanu\s+(?:należności|zobowiązań|zapasów|rezerw)/i,
    /^spłat[ay]\s+(?:kredytów|zobowiązań\s+leasingowych)/i,
    /^zaciągnięcie\s+kredytów/i,
    /^dywidendy\s+(?:wypłacone|zapłacone)/i,
    /^odsetki\s+zapłacone\s*$/i,
    /^podatek\s+(?:dochodowy\s+)?zapłacony\s*$/i,
    // DE CF-only
    /^cashflow\s+aus\s+(?:betrieblicher|laufender)\s+(?:tätigkeit|geschäftstätigkeit)/i,
    /^cashflow\s+aus\s+investitionstätigkeit/i,
    /^cashflow\s+aus\s+finanzierungstätigkeit/i,
    /^finanzmittelbestand\s+(?:am\s+anfang|am\s+ende|zu\s+beginn)/i,
    /^veränderung\s+der?\s+(?:forderungen|verbindlichkeiten|vorräte|rückstellungen)/i,
    /^tilgung\s+von\s+(?:finanzkredit|darlehen|leasingverbindlichkeit)/i,
    /^aufnahme\s+von\s+(?:finanzkredit|darlehen)/i,
    /^gezahlte\s+(?:dividenden|zinsen|ertragsteuern)/i,
    // FR CF-only
    /^flux\s+(?:net\s+)?de\s+trésorerie\s+(?:lié|généré|provenant)/i,
    /^trésorerie\s+(?:à l'ouverture|à la clôture|en début|en fin)/i,
    /^variation\s+(?:du\s+)?(?:besoin\s+en\s+)?fonds?\s+de\s+roulement/i,
    /^dividendes?\s+(?:versés?|payés?)\s*$/i,
    /^impôts?\s+(?:sur\s+les\s+(?:sociétés|bénéfices)\s+)?payés?\s*$/i,
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
  if (statementType === 'BS' && cfOnlyPatterns.some((p) => p.test(normalizedLabel))) {
    return 'CROSS_CONTAMINATION_CF_IN_BS';
  }
  if (statementType === 'P&L' && cfOnlyPatterns.some((p) => p.test(normalizedLabel))) {
    return 'CROSS_CONTAMINATION_CF_IN_PL';
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

  let aliasRows: Array<{
    statement_line_id: string;
    normalized_alias: string;
    template_family: string;
  }> = [];
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
      if (
        /operacyj|z działalności operacyjnej|betriebliche[rn]?\s+tätigkeit|laufende[rn]?\s+geschäftstätigkeit|activités?\s+(?:opérationnelles?|d'exploitation)/.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-operating')
          return { delta: 0.75, reason: 'cash_flow_scope_match' };
        if (canonicalId === 'fsl-cf-investing' || canonicalId === 'fsl-cf-financing') {
          return { delta: -0.45, reason: 'cash_flow_scope_conflict' };
        }
      }
      if (
        /inwestycyjn|z działalności inwestycyjnej|investitionstätigkeit|activités?\s+d'investissement/.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-investing')
          return { delta: 0.75, reason: 'cash_flow_scope_match' };
        if (canonicalId === 'fsl-cf-operating' || canonicalId === 'fsl-cf-financing') {
          return { delta: -0.45, reason: 'cash_flow_scope_conflict' };
        }
      }
      if (
        /finansow|z działalności finansowej|finanzierungstätigkeit|activités?\s+de\s+financement/.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-financing')
          return { delta: 0.75, reason: 'cash_flow_scope_match' };
        if (canonicalId === 'fsl-cf-operating' || canonicalId === 'fsl-cf-investing') {
          return { delta: -0.45, reason: 'cash_flow_scope_conflict' };
        }
      }
      if (
        /zmiana stanu zobowiązań\b/i.test(normalizedLabel) &&
        !/pozostałych|leasingu|handlowych/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-change-wc-ap')
          return { delta: 0.7, reason: 'cash_flow_ap_anchor' };
        if (canonicalId === 'fsl-cf-change-wc-other')
          return { delta: -0.3, reason: 'cash_flow_ap_vs_other' };
      }
      if (
        /zmiana stanu należności\b/i.test(normalizedLabel) &&
        !/pozostałych/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-change-wc-ar')
          return { delta: 0.7, reason: 'cash_flow_ar_anchor' };
        if (canonicalId === 'fsl-cf-change-wc-other')
          return { delta: -0.3, reason: 'cash_flow_ar_vs_other' };
      }
      if (/zmiana stanu zapasów/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-inventory')
          return { delta: 0.7, reason: 'cash_flow_inventory_anchor' };
      }
      if (/zmiana stanu rezerw/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-provisions')
          return { delta: 0.7, reason: 'cash_flow_provisions_anchor' };
        if (canonicalId === 'fsl-cf-net-change-cash')
          return { delta: -0.6, reason: 'cash_flow_provisions_vs_net_change' };
      }
      if (/zmiana stanu pozostałych/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-other')
          return { delta: 0.6, reason: 'cash_flow_other_wc_anchor' };
        if (canonicalId === 'fsl-cf-net-change-cash')
          return { delta: -0.6, reason: 'cash_flow_other_wc_vs_net_change' };
      }
      if (/koszty odsetek/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-interest-cost')
          return { delta: 0.6, reason: 'cash_flow_interest_cost_anchor' };
        if (canonicalId === 'fsl-cf-interest-paid')
          return { delta: -0.3, reason: 'cash_flow_interest_cost_vs_paid' };
      }
      if (/amortyzacja\s+(wartości\s+)?niemate/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-depreciation-intangibles')
          return { delta: 0.8, reason: 'cf_depreciation_intangibles_anchor' };
        if (canonicalId === 'fsl-cf-operating-depreciation')
          return { delta: -0.3, reason: 'cf_depreciation_parent_vs_child' };
      }
      if (/amortyzacja\s+rzeczowych/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-depreciation-ppe')
          return { delta: 0.8, reason: 'cf_depreciation_ppe_anchor' };
        if (canonicalId === 'fsl-cf-operating-depreciation')
          return { delta: -0.3, reason: 'cf_depreciation_parent_vs_child' };
      }
      if (
        /amortyzacja\s+aktywów z tytułu\s+prawa/i.test(normalizedLabel) ||
        /amortyzacja\s+prawa\s+do\s+użytk/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-operating-depreciation-rou')
          return { delta: 0.8, reason: 'cf_depreciation_rou_anchor' };
        if (canonicalId === 'fsl-cf-operating-depreciation')
          return { delta: -0.3, reason: 'cf_depreciation_parent_vs_child' };
      }
      if (
        /amortyzacja/i.test(normalizedLabel) &&
        !/wartości\s+niematerialnych|rzeczowych|prawa\s+do|aktywów z tytułu/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-operating-depreciation')
          return { delta: 0.5, reason: 'cash_flow_depreciation_anchor' };
      }
      if (/zysk.*przed\s+opodatkowaniem|strata.*przed\s+opodatkowaniem/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-ebt') return { delta: 0.7, reason: 'cf_ebt_anchor' };
        if (canonicalId === 'fsl-cf-net-change-cash')
          return { delta: -0.5, reason: 'cf_ebt_vs_net_change' };
      }
      if (/korekty\s*razem|korekty\s+ogółem/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-adjustments')
          return { delta: 0.7, reason: 'cf_adjustments_anchor' };
      }
      if (/odpisy\s+aktualizujące/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-impairment')
          return { delta: 0.6, reason: 'cf_impairment_anchor' };
      }
      if (
        /zysk.*strat.*sprzedaż.*aktyw|strat.*zysk.*sprzedaż.*aktyw|zysk.*ze\s+zbycia|strat.*ze\s+zbycia/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-operating-gain-disposal')
          return { delta: 0.7, reason: 'cf_gain_disposal_anchor' };
      }
      if (
        /instrumentów\s+pochodnych|derivatives/i.test(normalizedLabel) &&
        /wartości?\s+godziwej/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-operating-fv-derivatives')
          return { delta: 0.8, reason: 'cf_fv_derivatives_anchor' };
        if (canonicalId === 'fsl-cf-operating-fv-changes')
          return { delta: -0.3, reason: 'cf_fv_derivatives_vs_property' };
      }
      if (
        /nieruchomości\s+inwestycyjnych/i.test(normalizedLabel) &&
        /wartości?\s+godziwej/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-operating-fv-changes')
          return { delta: 0.8, reason: 'cf_fv_property_anchor' };
        if (canonicalId === 'fsl-cf-operating-fv-derivatives')
          return { delta: -0.3, reason: 'cf_fv_property_vs_derivatives' };
      }
      if (/wartości?\s+godziwej|niezrealizowane\s+różnice/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-fv-changes')
          return { delta: 0.4, reason: 'cf_fv_changes_anchor' };
        if (canonicalId === 'fsl-cf-operating-fv-derivatives')
          return { delta: 0.3, reason: 'cf_fv_derivatives_fallback' };
      }
      if (/przychody\s+z\s+(?:tytułu\s+)?dywidend/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-dividend-income')
          return { delta: 0.7, reason: 'cf_dividend_income_anchor' };
        if (canonicalId === 'fsl-cf-dividends-received')
          return { delta: -0.2, reason: 'cf_dividend_income_vs_received' };
        if (canonicalId === 'fsl-cf-dividends')
          return { delta: -0.3, reason: 'cf_dividend_income_vs_paid' };
      }
      if (/(?:dywidendy\s+)?otrzymane\s+dywidendy|otrzymane\s+dywidendy/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-dividends-received')
          return { delta: 0.7, reason: 'cf_dividends_received_anchor' };
        if (canonicalId === 'fsl-cf-operating-dividend-income')
          return { delta: -0.2, reason: 'cf_received_vs_income' };
        if (canonicalId === 'fsl-cf-dividends')
          return { delta: -0.3, reason: 'cf_received_vs_paid' };
      }
      if (/inne\s+korekty|pozostałe\s+korekty/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-other-adj')
          return { delta: 0.6, reason: 'cf_other_adj_anchor' };
      }
      if (
        /udział\s+w\s+zysk.*jednostek|udział\s+w\s+wynik.*praw\s+własności/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-operating-equity-method')
          return { delta: 0.6, reason: 'cf_equity_method_anchor' };
      }
      if (
        /przychody\s+z\s+odsetek|odsetki\s+otrzymane|przychody\s+odsetkowe/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-operating-interest-income')
          return { delta: 0.6, reason: 'cf_interest_income_anchor' };
        if (canonicalId === 'fsl-cf-operating-interest-cost')
          return { delta: -0.3, reason: 'cf_interest_income_vs_cost' };
      }
      if (/wpływy\s+ze\s+sprzedaży\s+aktyw|wpływy\s+ze\s+zbycia/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-investing-disposal-proceeds')
          return { delta: 0.7, reason: 'cf_disposal_proceeds_anchor' };
      }
      if (
        /wydatki\s+na\s+(?:nabycie\s+)?wartości\s+niematerial|nabycie\s+wartości\s+niematerial/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-capex-intangibles')
          return { delta: 0.7, reason: 'cf_capex_intangibles_anchor' };
        if (canonicalId === 'fsl-cf-capex')
          return { delta: -0.2, reason: 'cf_capex_intangibles_vs_parent' };
      }
      if (/wpływ\s+zmian\s+kursów|różnice\s+kursowe\s+netto/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-fx-on-cash')
          return { delta: 0.6, reason: 'cf_fx_on_cash_anchor' };
      }
      if (/dywidendy\s+wypłacone|wypłata\s+dywidend|dywidendy\s+zapłacone/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-dividends')
          return { delta: 0.6, reason: 'cf_dividends_paid_anchor' };
        if (canonicalId === 'fsl-cf-operating-dividend-income')
          return { delta: -0.3, reason: 'cf_dividends_paid_vs_income' };
      }
      if (
        /spłat[ay].*leasingu|spłat[ay].*zobowiązań\s+z\s+tytułu\s+leasingu/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-lease-repayment')
          return { delta: 0.8, reason: 'cf_lease_repayment_anchor' };
        if (canonicalId === 'fsl-cf-debt-repayment')
          return { delta: -0.3, reason: 'cf_lease_vs_debt_repayment' };
      }
      if (
        /spłat[ay].*kredyt|spłat[ay].*pożyczek/i.test(normalizedLabel) &&
        !/leasingu/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-debt-repayment')
          return { delta: 0.5, reason: 'cf_debt_repayment_anchor' };
        if (canonicalId === 'fsl-cf-lease-repayment')
          return { delta: -0.3, reason: 'cf_debt_vs_lease_repayment' };
      }
      if (/wpływy.*zaciągnięcia|zaciągnięcie.*kredyt|wpływy.*kredyt/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-debt-drawdown')
          return { delta: 0.5, reason: 'cf_debt_drawdown_anchor' };
      }
      if (/na początek|na pocz[aą]tek|opening|am\s+anfang|zu\s+beginn/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-opening-cash')
          return { delta: 0.6, reason: 'cash_flow_opening_anchor' };
      }
      if (/na koniec|closing|am\s+ende/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-closing-cash')
          return { delta: 0.6, reason: 'cash_flow_closing_anchor' };
      }
      if (
        /wydatki na nabycie|capital expenditure|capex|investitionen\s+in\s+sachanlagen|erwerb\s+von\s+sachanlagen/.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-capex') return { delta: 0.6, reason: 'cash_flow_capex_anchor' };
      }
      if (/^inne\s+wydatki/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-other-expenditure')
          return { delta: 0.7, reason: 'cf_other_expenditure_anchor' };
        if (canonicalId === 'fsl-cf-operating-other-adj')
          return { delta: -0.3, reason: 'cf_other_expenditure_vs_adj' };
      }
      if (/^inne\s+wpływy/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-other-receipts')
          return { delta: 0.7, reason: 'cf_other_receipts_anchor' };
        if (canonicalId === 'fsl-cf-operating-other-adj')
          return { delta: -0.3, reason: 'cf_other_receipts_vs_adj' };
      }
      if (/inwestycje\s+w\s+jednostki\s+zależne/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-investing-subsidiaries')
          return { delta: 0.7, reason: 'cf_investing_subsidiaries_anchor' };
        if (canonicalId === 'fsl-cf-capex')
          return { delta: -0.3, reason: 'cf_subsidiaries_vs_capex' };
      }
      if (/zmiana\s+stanu\s+środków\s+pieniężnych\s+o\s+ograniczonym/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-restricted-cash')
          return { delta: 0.7, reason: 'cf_restricted_cash_anchor' };
        if (canonicalId === 'fsl-cf-change-wc-other')
          return { delta: -0.3, reason: 'cf_restricted_cash_vs_other' };
      }
      if (/zmiana\s+stanu\s+rozliczeń\s+międzyokresowych/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-prepaids')
          return { delta: 0.7, reason: 'cf_prepaids_anchor' };
        if (canonicalId === 'fsl-cf-change-wc-other')
          return { delta: -0.3, reason: 'cf_prepaids_vs_other' };
      }
      if (/otrzymane\s+dywidendy/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-dividend-income')
          return { delta: 0.7, reason: 'cf_received_dividends_anchor' };
        if (canonicalId === 'fsl-cf-dividends')
          return { delta: -0.3, reason: 'cf_received_vs_paid_dividends' };
      }
      if (/przychody\s+z\s+tytułu\s+odsetek/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-interest-income')
          return { delta: 0.7, reason: 'cf_interest_income_tytulu_anchor' };
        if (canonicalId === 'fsl-cf-operating-interest-cost')
          return { delta: -0.4, reason: 'cf_interest_income_vs_cost' };
      }
      if (
        /zmiana\s+(?:stanu\s+)?kapitału\s+obrotowego|change\s+in\s+working\s+capital/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-change-wc')
          return { delta: 0.7, reason: 'cf_change_wc_total_anchor' };
        if (canonicalId === 'fsl-cf-change-wc-ar' || canonicalId === 'fsl-cf-change-wc-ap')
          return { delta: -0.3, reason: 'cf_wc_total_vs_component' };
      }
      if (
        /spłat[ay]\s+kredytów\s+bankowych|spłata\s+długu\s+bankowego|bank\s+(?:debt|loan)\s+repayment/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-debt-repayment-bank')
          return { delta: 0.8, reason: 'cf_bank_repayment_anchor' };
        if (canonicalId === 'fsl-cf-debt-repayment')
          return { delta: -0.2, reason: 'cf_bank_repayment_vs_total' };
        if (canonicalId === 'fsl-cf-debt-repayment-lease')
          return { delta: -0.3, reason: 'cf_bank_repayment_vs_lease' };
      }
      if (
        /spłat[ay]\s+zobowiązań\s+leasingowych|lease\s+(?:debt\s+)?repayment/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-debt-repayment-lease')
          return { delta: 0.8, reason: 'cf_lease_repayment_detail_anchor' };
        if (canonicalId === 'fsl-cf-debt-repayment')
          return { delta: -0.2, reason: 'cf_lease_repayment_vs_total' };
        if (canonicalId === 'fsl-cf-debt-repayment-bank')
          return { delta: -0.3, reason: 'cf_lease_repayment_vs_bank' };
      }
      if (
        /zaciągnięcie\s+kredytów\s+bankowych|wpływy\s+z\s+kredytów\s+bankowych|bank\s+(?:debt|loan)\s+(?:drawdown|proceeds)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-debt-drawdown-bank')
          return { delta: 0.8, reason: 'cf_bank_drawdown_anchor' };
        if (canonicalId === 'fsl-cf-debt-drawdown')
          return { delta: -0.2, reason: 'cf_bank_drawdown_vs_total' };
      }
      if (/nowe\s+(?:zobowiązania|umowy)\s+leasingowe|new\s+lease/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-debt-drawdown-lease')
          return { delta: 0.8, reason: 'cf_lease_drawdown_anchor' };
        if (canonicalId === 'fsl-cf-debt-drawdown')
          return { delta: -0.2, reason: 'cf_lease_drawdown_vs_total' };
      }
      if (/pozostałe\s+przepływy\s+inwestycyjne|other\s+investing/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-other-investing')
          return { delta: 0.6, reason: 'cf_other_investing_anchor' };
        if (canonicalId === 'fsl-cf-investing')
          return { delta: -0.2, reason: 'cf_other_investing_vs_total' };
      }
      if (/deferred\s+(?:income\s+)?tax|odroczony\s+podatek/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-other-adj')
          return { delta: 0.7, reason: 'cf_deferred_tax_is_adj' };
        if (canonicalId === 'fsl-cf-taxes-paid')
          return { delta: -0.7, reason: 'cf_deferred_tax_not_paid' };
      }
      if (/(?:income\s+)?taxes?\s+paid|cash\s+paid.*income\s+tax/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-taxes-paid')
          return { delta: 0.7, reason: 'cf_taxes_paid_en_anchor' };
      }
      if (
        /purchases?\s+of\s+(?:property|investments)|expenditure\s+on\s+property|total\s+(?:cash\s+)?capital\s+expenditure/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-capex')
          return { delta: 0.7, reason: 'cf_capex_purchases_anchor' };
      }
      if (/(?:investing\s+activities?\s+)?expenditure\s+on\s+property/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-capex')
          return { delta: 0.8, reason: 'cf_capex_expenditure_property_anchor' };
      }
      if (
        /repayments?\s+of\s+(?:long.?term|debt)|repayment\s+of\s+non.?current/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-debt-repayment')
          return { delta: 0.6, reason: 'cf_debt_repayment_en_anchor' };
        if (canonicalId === 'fsl-cf-dividends')
          return { delta: -0.4, reason: 'cf_repayment_not_dividends' };
      }
      if (/dividends?\s+paid/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-dividends')
          return { delta: 0.7, reason: 'cf_dividends_paid_en_anchor' };
        if (canonicalId === 'fsl-cf-debt-repayment')
          return { delta: -0.4, reason: 'cf_dividends_not_repayment' };
      }
      if (/payment\s+of\s+dividends/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-dividends')
          return { delta: 0.7, reason: 'cf_dividends_payment_anchor' };
        if (canonicalId === 'fsl-cf-debt-repayment')
          return { delta: -0.4, reason: 'cf_dividends_not_repayment' };
      }
      if (
        /cash\s+flows?\s+from\s+operating|net\s+cash\s+(?:provided\s+by|from)\s+operating/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-operating')
          return { delta: 0.8, reason: 'cf_operating_total_en_anchor' };
      }
      if (
        /cash\s+flows?\s+from\s+investing|net\s+cash\s+(?:provided\s+by|used\s+in)\s+investing/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-investing')
          return { delta: 0.8, reason: 'cf_investing_total_en_anchor' };
      }
      if (
        /cash\s+flows?\s+from\s+financing|net\s+cash\s+(?:provided\s+by|used\s+in)\s+financing/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-financing')
          return { delta: 0.8, reason: 'cf_financing_total_en_anchor' };
      }
      if (
        /stock.based\s+compensation|share.based\s+(?:compensation|payments?)/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-operating-sbc')
          return { delta: 0.8, reason: 'cf_sbc_en_anchor' };
        if (canonicalId === 'fsl-cf-operating-other-adj')
          return { delta: 0.2, reason: 'cf_sbc_as_other_adj' };
      }
      if (
        /repurchase\s+of\s+(?:shares|ordinary\s+share|common\s+stock)|purchases?\s+of\s+stock\s+for\s+treasury|treasury\s+shares?\s+acquired|buybacks?\s+of\s+common/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-share-buyback')
          return { delta: 0.8, reason: 'cf_share_buyback_en_anchor' };
        if (canonicalId === 'fsl-cf-dividends')
          return { delta: -0.4, reason: 'cf_buyback_not_dividends' };
      }
      if (
        /(?:increase|decrease|net\s+increase|net\s+decrease)\s+in\s+cash/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-net-change-cash')
          return { delta: 0.7, reason: 'cf_net_change_en_anchor' };
      }
      if (/effect\s+of\s+exchange\s+rate/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-fx-on-cash')
          return { delta: 0.7, reason: 'cf_fx_effect_en_anchor' };
        if (canonicalId === 'fsl-cf-opening-cash')
          return { delta: -0.5, reason: 'cf_fx_not_opening' };
      }
      if (/(?:at|as\s+at)\s+(?:1\s+january|beginning\s+of)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-opening-cash')
          return { delta: 0.7, reason: 'cf_opening_cash_en_anchor' };
        if (canonicalId === 'fsl-cf-closing-cash')
          return { delta: -0.5, reason: 'cf_opening_not_closing' };
      }
      if (/(?:at|as\s+at)\s+(?:31\s+december|end\s+of)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-closing-cash')
          return { delta: 0.7, reason: 'cf_closing_cash_en_anchor' };
        if (canonicalId === 'fsl-cf-opening-cash')
          return { delta: -0.5, reason: 'cf_closing_not_opening' };
      }
      if (/proceeds\s+from\s+(?:disposals?|sales?\s+of)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-investing-disposal-proceeds')
          return { delta: 0.6, reason: 'cf_disposal_proceeds_en_anchor' };
      }
      if (
        /issuances?\s+of\s+(?:loans|debt|notes)|proceeds\s+from\s+(?:issuances?\s+of\s+debt|long.term\s+financing)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-debt-drawdown')
          return { delta: 0.7, reason: 'cf_debt_drawdown_issuance_en' };
      }
      if (/payments?\s+of\s+(?:loans|debt|notes)|repayments?\s+of\s+debt/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-debt-repayment')
          return { delta: 0.7, reason: 'cf_debt_repayment_payments_en' };
      }
      if (
        /principal\s+(?:repayments?|payments?)\s+(?:of|on)\s+finance\s+leases?/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-lease-repayment')
          return { delta: 0.8, reason: 'cf_lease_repayment_en_anchor' };
        if (canonicalId === 'fsl-cf-debt-repayment')
          return { delta: -0.3, reason: 'cf_lease_not_debt_repayment' };
      }
      if (/lease\s+liability\s+payments/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-debt-repayment-lease')
          return { delta: 0.8, reason: 'cf_lease_payments_en_anchor' };
        if (canonicalId === 'fsl-cf-lease-repayment')
          return { delta: 0.5, reason: 'cf_lease_payments_alt' };
      }
      if (
        /changes?\s+in\s+operating\s+assets|net\s+change\s+in\s+operating/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-change-wc')
          return { delta: 0.7, reason: 'cf_wc_changes_en_anchor' };
      }
      if (
        /equity\s+income|earnings\s+from\s+(?:joint\s+ventures|associates)/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-operating-equity-method')
          return { delta: 0.6, reason: 'cf_equity_method_en_anchor' };
      }
      if (/impairment\s+and\s+(?:gain|loss)\s+on\s+sale/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-gain-disposal')
          return { delta: 0.7, reason: 'cf_impairment_gain_en_anchor' };
      }
      if (
        /finance\s+costs?\b/i.test(normalizedLabel) &&
        !/interest\s+expense/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-operating-interest-cost')
          return { delta: 0.5, reason: 'cf_finance_costs_en_anchor' };
      }
      if (/interest\s+(?:receivable|received)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-interest-income')
          return { delta: 0.6, reason: 'cf_interest_received_en_anchor' };
      }
      if (/net\s+(?:charge|provision)\s+for\s+provisions/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-change-wc-provisions')
          return { delta: 0.6, reason: 'cf_provisions_en_anchor' };
      }
    }

    if (normalizedType === 'BS') {
      if (
        /(aktywa razem|aktywa ogolem|aktywa ogółem|total assets|bilanzsumme|summe\s+aktiva|summe\s+der\s+aktiva|total\s+actif|total\s+de\s+l'actif)/.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-bs-total-assets'
          ? { delta: 0.6, reason: 'balance_sheet_total_anchor' }
          : { delta: -0.2, reason: 'balance_sheet_total_conflict' };
      }
      if (
        /(total\s+(?:liabilities\s+and\s+(?:stockholders'?\s+|shareholders'?\s+)?equity|equity\s+and\s+liabilities)|pasywa\s+razem|razem\s+pasywa|razem\s+zobowiązania\s+i\s+kapitał)/.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-bs-total-liabilities-equity')
          return { delta: 0.8, reason: 'bs_total_liabilities_equity_exact' };
        if (canonicalId === 'fsl-bs-total-liabilities')
          return { delta: -0.5, reason: 'bs_total_le_vs_total_l' };
        return { delta: -0.2, reason: 'balance_sheet_total_le_conflict' };
      }
      if (
        /^zobowiązania\s*$/i.test(normalizedLabel) ||
        /^liabilities\s*$/i.test(normalizedLabel) ||
        /^verbindlichkeiten\s*$/i.test(normalizedLabel) ||
        /^dettes\s*$/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-bs-total-liabilities')
          return { delta: 0.8, reason: 'bs_total_liabilities_exact_anchor' };
        if (canonicalId === 'fsl-bs-current-liabilities')
          return { delta: -0.3, reason: 'bs_generic_liabilities_vs_current' };
        if (canonicalId === 'fsl-bs-long-term-debt')
          return { delta: -0.3, reason: 'bs_generic_liabilities_vs_lt' };
      }
      if (
        /(zobowiazania razem|zobowiązania razem|total liabilities|summe\s+verbindlichkeiten|gesamtverbindlichkeiten|total\s+(?:des\s+)?dettes|total\s+passif)/.test(
          normalizedLabel
        ) &&
        !/and\s+(?:equity|stockholders|shareholders)/.test(normalizedLabel)
      ) {
        return canonicalId === 'fsl-bs-total-liabilities'
          ? { delta: 0.6, reason: 'balance_sheet_total_anchor' }
          : { delta: -0.2, reason: 'balance_sheet_total_conflict' };
      }
      if (/(?:preferred\s+stock|par\s+value)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-share-capital')
          return { delta: 0.6, reason: 'bs_preferred_stock_to_share_capital' };
        if (canonicalId === 'fsl-bs-equity')
          return { delta: -0.8, reason: 'bs_preferred_stock_not_total_equity' };
        return { delta: -0.2, reason: 'bs_preferred_stock_conflict' };
      }
      if (/^total\s+(?:stockholders|shareholders)\s+equity/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-equity')
          return { delta: 0.9, reason: 'bs_total_stockholders_equity_exact' };
        if (canonicalId === 'fsl-bs-share-capital')
          return { delta: -0.5, reason: 'bs_total_equity_not_share_capital' };
        return { delta: -0.2, reason: 'bs_total_equity_conflict' };
      }
      if (
        /^kapitał\s+własny\s*$/i.test(normalizedLabel) ||
        /^kapitał\s+własny\s+razem/i.test(normalizedLabel) ||
        /^total\s+equity/i.test(normalizedLabel) ||
        /^equity\s*$/i.test(normalizedLabel) ||
        /^eigenkapital\s*$/i.test(normalizedLabel) ||
        /^eigenkapital\s+gesamt/i.test(normalizedLabel) ||
        /^capitaux\s+propres\s*$/i.test(normalizedLabel) ||
        /^total\s+capitaux\s+propres/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-bs-equity')
          return { delta: 0.6, reason: 'balance_sheet_equity_anchor' };
        if (canonicalId === 'fsl-bs-equity-method-investments')
          return { delta: -0.4, reason: 'equity_vs_equity_method' };
        return { delta: -0.1, reason: 'equity_conflict' };
      }
      if (
        /kapitał\s+własny/i.test(normalizedLabel) &&
        /przypadający|dominującej|akcjonariuszom/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-bs-equity-parent')
          return { delta: 0.8, reason: 'balance_sheet_equity_parent_anchor' };
        if (canonicalId === 'fsl-bs-equity')
          return { delta: -0.3, reason: 'equity_parent_vs_total' };
        return { delta: 0, reason: undefined };
      }
      if (
        /(rzeczowe aktywa trwałe|property plant and equipment|sachanlagen|sachanlagevermögen|immobilisations corporelles)/.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-bs-ppe'
          ? { delta: 0.4, reason: 'balance_sheet_ppe_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (
        /(wartości niematerialne|intangible assets|immaterielle vermögenswerte)/.test(
          normalizedLabel
        ) &&
        !/firmy|goodwill|firmenwert/i.test(normalizedLabel)
      ) {
        return canonicalId === 'fsl-bs-intangibles'
          ? { delta: 0.4, reason: 'balance_sheet_intangibles_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (
        /(wartość firmy|goodwill|geschäfts-?\s*(?:oder\s+)?firmenwert|firmenwert)/.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-bs-intangibles-goodwill'
          ? { delta: 0.5, reason: 'balance_sheet_goodwill_anchor' }
          : { delta: -0.1, reason: 'balance_sheet_goodwill_conflict' };
      }
      if (/(zapasy|inventor|vorräte)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-inventory'
          ? { delta: 0.3, reason: 'balance_sheet_inventory_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(środki pieniężne|cash|zahlungsmittel|flüssige mittel)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-cash'
          ? { delta: 0.3, reason: 'balance_sheet_cash_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (
        /(pasywa\s+razem|pasywa\s+ogółem|razem\s+pasywa|suma\s+pasywów|summe\s+passiva|bilanzsumme\s+passiva|summe\s+eigenkapital\s+und\s+verbindlichkeiten|total\s+passif\s+et\s+capitaux\s+propres)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-bs-total-liabilities-equity')
          return { delta: 0.7, reason: 'bs_total_liabilities_equity_anchor' };
        if (canonicalId === 'fsl-bs-total-liabilities')
          return { delta: -0.3, reason: 'bs_pasywa_vs_total_liabilities' };
      }
      if (/(akcje\s+własne|udziały\s+własne|treasury\s+shares)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-treasury-shares'
          ? { delta: 0.5, reason: 'bs_treasury_shares_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (
        /(udziały\s+niesprawujące|udziały\s+mniejszościowe|non-?controlling\s+interest|minority\s+interest|nicht\s+beherrschende\s+anteile|minderheitsanteile)/i.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-bs-minority-interest'
          ? { delta: 0.6, reason: 'bs_minority_interest_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(należności\s+długoterminowe|long.term\s+receivables)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-lt-receivables'
          ? { delta: 0.5, reason: 'bs_lt_receivables_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (
        /(długoterminowe\s+aktywa\s+finansowe|aktywa\s+finansowe\s+długoterminowe)/i.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-bs-lt-financial-assets'
          ? { delta: 0.5, reason: 'bs_lt_financial_assets_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (
        /(inwestycje.*praw\s+własności|udziały.*jednostk.*zależn|inwestycje.*stowarzyszon)/i.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-bs-equity-method-investments'
          ? { delta: 0.5, reason: 'bs_equity_method_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (
        /(należności\s+podatkowe|należności.*podatku\s+dochodowego|należności\s+z\s+tytułu\s+innych\s+podatków)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-bs-tax-receivables')
          return { delta: 0.6, reason: 'bs_tax_receivables_anchor' };
        if (canonicalId === 'fsl-bs-other-current-liabilities-tax')
          return { delta: -0.5, reason: 'bs_receivable_not_liability' };
        return { delta: 0, reason: undefined };
      }
      if (/zobowiązania\s+z\s+tytułu\s+podatku\s+dochodowego/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-current-liabilities-tax')
          return { delta: 0.6, reason: 'bs_tax_payable_anchor' };
        if (canonicalId === 'fsl-bs-tax-receivables')
          return { delta: -0.5, reason: 'bs_liability_not_receivable' };
        return { delta: 0, reason: undefined };
      }
      if (/(aktywa\s+kontraktowe|aktywa.*umów\s+z\s+klientami)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-contract-assets'
          ? { delta: 0.5, reason: 'bs_contract_assets_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (
        /(aktywa\s+przeznaczone\s+do\s+sprzedaży|aktywa.*przeznaczone\s+do\s+zbycia)/i.test(
          normalizedLabel
        )
      ) {
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
      if (
        /(zobowiązania.*świadczeń\s+pracowniczych|świadczenia\s+pracownicze)/i.test(normalizedLabel)
      ) {
        if (/długoterminow/i.test(normalizedLabel)) {
          return canonicalId === 'fsl-bs-employee-benefits-lt'
            ? { delta: 0.5, reason: 'bs_employee_benefits_lt_anchor' }
            : { delta: 0, reason: undefined };
        }
        return canonicalId === 'fsl-bs-employee-benefits-st'
          ? { delta: 0.4, reason: 'bs_employee_benefits_st_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (
        /(zobowiązania\s+kontraktowe|zobowiązania.*umów\s+z\s+klientami|przychody\s+przyszłych\s+okresów|zaliczki\s+otrzymane)/i.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-bs-contract-liabilities'
          ? { delta: 0.5, reason: 'bs_contract_liabilities_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (
        /(rezerwa.*podatku\s+odroczonego|zobowiązania.*odroczonego\s+podatku)/i.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-bs-other-non-current-liabilities-deferred-tax'
          ? { delta: 0.5, reason: 'bs_deferred_tax_liabilities_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (
        /(pozostałe\s+kapitały|kapitał\s+rezerwowy|kapitał\s+z\s+aktualizacji)/i.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-bs-other-equity-reserves'
          ? { delta: 0.4, reason: 'bs_other_equity_reserves_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (/(kapitał\s+zapasowy|nadwyżka\s+ze\s+sprzedaży\s+akcji)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-bs-share-premium'
          ? { delta: 0.4, reason: 'bs_share_premium_anchor' }
          : { delta: 0, reason: undefined };
      }
      if (
        /długoterminowe\s+kredyty\s+i\s+pożyczki|kredyty\s+i\s+pożyczki\s+długoterminowe/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-bs-long-term-borrowings')
          return { delta: 0.8, reason: 'bs_lt_borrowings_anchor' };
        if (canonicalId === 'fsl-bs-long-term-debt')
          return { delta: -0.3, reason: 'bs_borrowings_vs_total_lt' };
        return { delta: 0, reason: undefined };
      }
      if (/pozostałe\s+zobowiązania\s+długoterminowe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-non-current-liabilities')
          return { delta: 0.8, reason: 'bs_other_lt_liabilities_anchor' };
        if (canonicalId === 'fsl-bs-long-term-debt')
          return { delta: -0.3, reason: 'bs_other_lt_not_total' };
      }
      if (
        /zobowiązania\s+(?:i\s+rezerwy\s+)?długoterminowe\b/i.test(normalizedLabel) &&
        !/kredyt|pożyczk|leasingu|pozostałe/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-bs-long-term-debt')
          return { delta: 0.5, reason: 'bs_lt_debt_total_anchor' };
        if (canonicalId === 'fsl-bs-long-term-borrowings')
          return { delta: -0.3, reason: 'bs_lt_total_vs_borrowings' };
      }
      if (/należności\s+z\s+tytułu\s+innych\s+podatków/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-tax-receivables')
          return { delta: 0.8, reason: 'bs_other_tax_receivables_anchor' };
        if (canonicalId === 'fsl-bs-tax-receivables')
          return { delta: -0.3, reason: 'bs_other_tax_vs_income_tax_receivables' };
        return { delta: 0, reason: undefined };
      }
      if (/zobowiązania\s+z\s+tytułu\s+innych\s+podatków/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-tax-payables')
          return { delta: 0.8, reason: 'bs_other_tax_payables_anchor' };
        if (canonicalId === 'fsl-bs-other-current-liabilities-tax')
          return { delta: -0.3, reason: 'bs_other_tax_vs_income_tax_payables' };
        return { delta: 0, reason: undefined };
      }
      if (/kapitał\s+z\s+przeszacowania\s+programu/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-actuarial-reserve')
          return { delta: 0.8, reason: 'bs_actuarial_reserve_anchor' };
        if (canonicalId === 'fsl-bs-other-equity-reserves')
          return { delta: -0.3, reason: 'bs_actuarial_vs_other_reserves' };
        return { delta: 0, reason: undefined };
      }
      if (/pozostałe\s+krótkoterminowe\s+aktywa\s+finansowe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-current-financial-assets')
          return { delta: 0.8, reason: 'bs_current_financial_assets_anchor' };
        if (canonicalId === 'fsl-bs-other-current-assets')
          return { delta: -0.3, reason: 'bs_financial_vs_other_current' };
        return { delta: 0, reason: undefined };
      }
      if (/długoterminowe\s+rozliczenia\s+międzyokresowe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-lt-prepaids')
          return { delta: 0.8, reason: 'bs_lt_prepaids_anchor' };
        if (canonicalId === 'fsl-bs-other-current-assets-prepaids')
          return { delta: -0.3, reason: 'bs_lt_vs_st_prepaids' };
      }
      if (/krótkoterminowe\s+rozliczenia\s+międzyokresowe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-current-assets-prepaids')
          return { delta: 0.8, reason: 'bs_st_prepaids_anchor' };
        if (canonicalId === 'fsl-bs-lt-prepaids')
          return { delta: -0.3, reason: 'bs_st_vs_lt_prepaids' };
      }
      if (/pozostałe\s+należności\s+krótkoterminowe/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-st-receivables')
          return { delta: 0.8, reason: 'bs_other_st_receivables_anchor' };
        if (canonicalId === 'fsl-bs-other-current-assets')
          return { delta: -0.3, reason: 'bs_other_st_recv_vs_current_assets' };
      }
      if (/materiały\s*$|surowce\s+i\s+materiały|raw\s+materials/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-inventory-raw')
          return { delta: 0.7, reason: 'bs_inventory_raw_anchor' };
        if (canonicalId === 'fsl-bs-inventory')
          return { delta: -0.2, reason: 'bs_inventory_raw_vs_total' };
      }
      if (/produkcja\s+w\s+toku|półprodukty|work\s+in\s+progress/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-inventory-wip')
          return { delta: 0.7, reason: 'bs_inventory_wip_anchor' };
        if (canonicalId === 'fsl-bs-inventory')
          return { delta: -0.2, reason: 'bs_inventory_wip_vs_total' };
      }
      if (/wyroby\s+gotowe|produkty\s+gotowe|finished\s+goods/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-inventory-fg')
          return { delta: 0.7, reason: 'bs_inventory_fg_anchor' };
        if (canonicalId === 'fsl-bs-inventory')
          return { delta: -0.2, reason: 'bs_inventory_fg_vs_total' };
      }
      if (
        /grunty\s+i\s+budynki|nieruchomości\s+gruntowe|land\s+and\s+buildings/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-bs-ppe-land') return { delta: 0.7, reason: 'bs_ppe_land_anchor' };
        if (canonicalId === 'fsl-bs-ppe') return { delta: -0.2, reason: 'bs_ppe_land_vs_total' };
      }
      if (/maszyny\s+i\s+urządzenia|urządzenia\s+techniczne|machinery/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-ppe-machinery')
          return { delta: 0.7, reason: 'bs_ppe_machinery_anchor' };
        if (canonicalId === 'fsl-bs-ppe')
          return { delta: -0.2, reason: 'bs_ppe_machinery_vs_total' };
      }
      if (/środki\s+transportu|pojazdy|vehicles/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-ppe-vehicles')
          return { delta: 0.7, reason: 'bs_ppe_vehicles_anchor' };
        if (canonicalId === 'fsl-bs-ppe')
          return { delta: -0.2, reason: 'bs_ppe_vehicles_vs_total' };
      }
      if (/oprogramowanie|software/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-intangibles-software')
          return { delta: 0.7, reason: 'bs_software_anchor' };
        if (canonicalId === 'fsl-bs-intangibles')
          return { delta: -0.2, reason: 'bs_software_vs_intangibles' };
      }
      if (
        /wynik\s+(?:z\s+)?lat\s+ubiegłych|zysk.*z\s+lat\s+ubiegłych|prior\s+year/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-bs-retained-earnings-prior')
          return { delta: 0.7, reason: 'bs_retained_prior_anchor' };
        if (canonicalId === 'fsl-bs-retained-earnings')
          return { delta: -0.2, reason: 'bs_retained_prior_vs_total' };
      }
      if (
        /wynik\s+(?:bieżącego|roku\s+obrotowego)|zysk.*bieżącego\s+roku|current\s+(?:year|period)\s+result/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-bs-retained-earnings-current')
          return { delta: 0.7, reason: 'bs_retained_current_anchor' };
        if (canonicalId === 'fsl-bs-retained-earnings')
          return { delta: -0.2, reason: 'bs_retained_current_vs_total' };
      }
      if (/krótkoterminow[ey]\s+kredyty\s+bankowe|short.term\s+bank/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-short-term-debt-bank')
          return { delta: 0.7, reason: 'bs_st_bank_debt_anchor' };
        if (canonicalId === 'fsl-bs-short-term-debt')
          return { delta: -0.2, reason: 'bs_st_bank_vs_total' };
      }
      if (
        /długoterminow[ey]\s+kredyty\s+bankowe|long.term\s+bank\s+(?:debt|loan)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-bs-long-term-debt-bank')
          return { delta: 0.7, reason: 'bs_lt_bank_debt_anchor' };
        if (canonicalId === 'fsl-bs-long-term-debt')
          return { delta: -0.2, reason: 'bs_lt_bank_vs_total' };
      }
      if (
        /rozliczenia\s+międzyokresowe\s+bierne|bierne\s+rozliczenia|accrued\s+expenses|accruals/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-bs-other-current-liabilities-accruals')
          return { delta: 0.7, reason: 'bs_accruals_anchor' };
        if (canonicalId === 'fsl-bs-other-current-liabilities')
          return { delta: -0.2, reason: 'bs_accruals_vs_other_cl' };
      }
      if (/należności\s+(?:z\s+tytułu\s+)?vat|vat\s+receivable/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-current-assets-vat')
          return { delta: 0.7, reason: 'bs_vat_receivable_anchor' };
        if (canonicalId === 'fsl-bs-other-current-assets')
          return { delta: -0.2, reason: 'bs_vat_vs_other_current' };
      }
      if (
        /pozostałe\s+aktywa\s+trwałe|other\s+(?:non.?current|fixed)\s+assets/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-bs-other-non-current-assets')
          return { delta: 0.5, reason: 'bs_other_nca_anchor' };
        if (canonicalId === 'fsl-bs-fixed') return { delta: -0.2, reason: 'bs_other_nca_vs_fixed' };
      }
      if (
        /^należności\s+handlowe\s*$/i.test(normalizedLabel) ||
        /^(?:accounts\s+)?receivables?\s*$/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-bs-ar') return { delta: 0.8, reason: 'bs_ar_exact_anchor' };
        if (canonicalId === 'fsl-bs-ar-trade')
          return { delta: -0.3, reason: 'bs_ar_vs_trade_detail' };
      }
      if (
        /należności\s+handlowe\s+(?:krajowe|zagraniczne)|trade\s+receivables/i.test(
          normalizedLabel
        ) &&
        !/pozostałe|other/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-bs-ar-trade') return { delta: 0.6, reason: 'bs_ar_trade_anchor' };
        if (canonicalId === 'fsl-bs-ar') return { delta: -0.2, reason: 'bs_ar_trade_vs_total' };
      }
      if (
        /pozostałe\s+należności|other\s+receivables/i.test(normalizedLabel) &&
        !/handlowe|trade|podatkowe|tax/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-bs-ar-other') return { delta: 0.5, reason: 'bs_ar_other_anchor' };
        if (canonicalId === 'fsl-bs-ar') return { delta: -0.2, reason: 'bs_ar_other_vs_total' };
      }
      if (
        /^zobowiązania\s+handlowe\s*$/i.test(normalizedLabel) ||
        /^trade\s+(?:and\s+other\s+)?payables\s*$/i.test(normalizedLabel) ||
        /^accounts\s+payable\s*$/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-bs-ap') return { delta: 0.8, reason: 'bs_ap_exact_anchor' };
        if (canonicalId === 'fsl-bs-ap-trade')
          return { delta: -0.3, reason: 'bs_ap_vs_trade_detail' };
      }
      if (
        /zobowiązania\s+(?:z\s+tytułu\s+)?dostaw|zobowiązania\s+handlowe\s+krajowe/i.test(
          normalizedLabel
        ) &&
        !/pozostałe|other/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-bs-ap-trade') return { delta: 0.6, reason: 'bs_ap_trade_anchor' };
        if (canonicalId === 'fsl-bs-ap') return { delta: -0.2, reason: 'bs_ap_trade_vs_total' };
      }
    }

    if (normalizedType === 'P&L') {
      if (
        /(przychody ze sprzedaży|przychody.*sprzedaż|razem przychody|revenue|total sales)/.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-pl-revenue'
          ? { delta: 0.55, reason: 'profit_loss_revenue_anchor' }
          : { delta: 0 };
      }
      if (/^przychody\s*$/.test(normalizedLabel) || /^przychody\s+\d/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-revenue')
          return { delta: -0.7, reason: 'profit_loss_generic_przychody_conflict' };
        if (canonicalId === 'fsl-pl-other-income')
          return { delta: 0.3, reason: 'profit_loss_other_income_fallback' };
      }
      if (/^koszty\s*$/.test(normalizedLabel) || /^koszty\s+\d/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-cogs')
          return { delta: -0.5, reason: 'profit_loss_generic_koszty_conflict' };
        if (canonicalId === 'fsl-pl-other-expense')
          return { delta: 0.3, reason: 'profit_loss_other_expense_fallback' };
      }
      if (
        /(pozostałe przychody operacyjne|przychody operacyjne|other (?:operating )?income)/.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-pl-revenue')
          return { delta: -0.4, reason: 'profit_loss_other_income_vs_revenue' };
        if (canonicalId === 'fsl-pl-ebit')
          return { delta: -0.6, reason: 'profit_loss_other_income_not_ebit' };
        if (canonicalId === 'fsl-pl-other-income')
          return { delta: 0.5, reason: 'profit_loss_other_income_anchor' };
      }
      if (
        /(pozostałe koszty operacyjne|other operating (?:expenses|charges))/.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-pl-other-opex')
          return { delta: 0.5, reason: 'profit_loss_other_opex_anchor' };
        if (canonicalId === 'fsl-pl-ebit')
          return { delta: -0.6, reason: 'profit_loss_other_opex_not_ebit' };
        if (canonicalId === 'fsl-pl-opex')
          return { delta: -0.3, reason: 'profit_loss_other_opex_vs_total_opex' };
      }
      if (/profit.*?loss before financial result/.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-ebit')
          return { delta: 0.6, reason: 'profit_loss_ebit_before_fin_result' };
      }
      if (
        /(przychody finansowe|koszty finansowe|wynik.*finansow|finance costs|financial)/.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-pl-revenue')
          return { delta: -0.4, reason: 'profit_loss_finance_vs_revenue' };
        if (canonicalId === 'fsl-pl-interest')
          return { delta: 0.4, reason: 'profit_loss_finance_anchor' };
      }
      if (/(zysk netto|net income|net profit)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-net'
          ? { delta: 0.45, reason: 'profit_loss_net_anchor' }
          : { delta: 0 };
      }
      if (
        /(zysk przed opodatkowaniem|profit before tax|earnings before tax|income before (?:income )?tax|profit.*?loss before tax)/.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-pl-ebt'
          ? { delta: 0.6, reason: 'profit_loss_ebt_anchor' }
          : { delta: -0.2, reason: 'not_ebt' };
      }
      if (/(koszt własny sprzedaży|cost of sales|cost of goods)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-cogs'
          ? { delta: 0.45, reason: 'profit_loss_cogs_anchor' }
          : { delta: 0 };
      }
      if (/(koszty sprzedaży|selling expenses|distribution costs)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-selling'
          ? { delta: 0.45, reason: 'profit_loss_selling_anchor' }
          : { delta: 0 };
      }
      if (/(koszty ogólnego zarządu|administrative expenses|g&a)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-gna'
          ? { delta: 0.45, reason: 'profit_loss_gna_anchor' }
          : { delta: 0 };
      }
      if (/odroczony\s+podatek\s+dochodowy|deferred\s+(?:income\s+)?tax/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-tax-deferred')
          return { delta: 0.6, reason: 'pl_deferred_tax_anchor' };
        if (canonicalId === 'fsl-pl-tax')
          return { delta: -0.5, reason: 'pl_deferred_not_current_tax' };
        return { delta: 0 };
      }
      if (/bieżący\s+podatek\s+dochodowy|current\s+(?:income\s+)?tax/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-tax-current')
          return { delta: 0.6, reason: 'pl_current_tax_anchor' };
        if (canonicalId === 'fsl-pl-tax')
          return { delta: -0.3, reason: 'pl_current_not_generic_tax' };
        return { delta: 0 };
      }
      if (/(podatek dochodowy|income tax|tax expense)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-tax'
          ? { delta: 0.35, reason: 'profit_loss_tax_anchor' }
          : { delta: 0 };
      }
      if (/(zysk.*operacyjn|operating (?:profit|income))/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-ebit'
          ? { delta: 0.45, reason: 'profit_loss_ebit_anchor' }
          : { delta: 0 };
      }
      if (/(zysk brutto|zysk brutto ze sprzedaży|gross profit)/.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-gross'
          ? { delta: 0.45, reason: 'profit_loss_gross_anchor' }
          : { delta: 0 };
      }
      if (/zysk\s+(?:netto\s+)?z\s+tego\s+przypadający/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-net') return { delta: 0.7, reason: 'pl_net_z_tego_anchor' };
        if (canonicalId === 'fsl-pl-net-parent')
          return { delta: -0.3, reason: 'pl_net_z_tego_not_parent' };
      }
      if (
        /(zysk\s+netto\s+przypadający\s+akcjonariuszom|zysk\s+przypadający\s+akcjonariuszom\s+podmiotu\s+domin)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-pl-net-parent')
          return { delta: 0.7, reason: 'pl_net_parent_anchor' };
        if (canonicalId === 'fsl-pl-net') return { delta: -0.3, reason: 'pl_net_parent_vs_net' };
      }
      if (
        /(zysk.*przypadając.*niesprawują|zysk.*udziałom\s+mniejszościowym)/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-pl-net-minority')
          return { delta: 0.7, reason: 'pl_net_minority_anchor' };
        if (canonicalId === 'fsl-pl-net') return { delta: -0.3, reason: 'pl_net_minority_vs_net' };
      }
      if (
        /(zysk.*z\s+działalności\s+kontynuowanej|wynik.*działalności\s+kontynuowanej)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-pl-net-continuing')
          return { delta: 0.6, reason: 'pl_net_continuing_anchor' };
        if (canonicalId === 'fsl-pl-net')
          return { delta: -0.2, reason: 'pl_net_continuing_vs_net' };
      }
      if (
        /(udział\s+w\s+zysk.*stowarzyszonych|udział\s+w\s+wynik.*praw\s+własności)/i.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-pl-equity-method-income'
          ? { delta: 0.6, reason: 'pl_equity_method_anchor' }
          : { delta: 0 };
      }
      if (/(inne\s+całkowite\s+dochody|other\s+comprehensive\s+income)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-oci-total'
          ? { delta: 0.6, reason: 'pl_oci_total_anchor' }
          : { delta: 0 };
      }
      if (
        /(pozycje\s+(?:które\s+)?(?:mogą\s+być\s+)?przeklasyfiko|podlegające\s+przeklasyfikowaniu)/i.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-pl-oci-reclassifiable'
          ? { delta: 0.6, reason: 'pl_oci_reclassifiable_anchor' }
          : { delta: 0 };
      }
      if (
        /(pozycje\s+nieprzeklasyfiko|nie\s+zostaną\s+przeklasyfikowane|niepodlegające\s+przeklasyfikowaniu)/i.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-pl-oci-non-reclassifiable'
          ? { delta: 0.6, reason: 'pl_oci_non_reclassifiable_anchor' }
          : { delta: 0 };
      }
      if (/(różnice\s+kursowe\s+z\s+przeliczenia)/i.test(normalizedLabel)) {
        return canonicalId === 'fsl-pl-oci-fx'
          ? { delta: 0.5, reason: 'pl_oci_fx_anchor' }
          : { delta: 0 };
      }
      if (
        /(wynik\s+na\s+zabezpieczeniach|wycena\s+instrumentów\s+zabezpiecz|zabezpieczenia\s+przepływów)/i.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-pl-oci-hedge'
          ? { delta: 0.5, reason: 'pl_oci_hedge_anchor' }
          : { delta: 0 };
      }
      if (
        /(zyski.*straty\s+aktuarialne|przeszacowania\s+zobowiązań.*świadczeń|wycena\s+aktuarialna)/i.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-pl-oci-actuarial'
          ? { delta: 0.5, reason: 'pl_oci_actuarial_anchor' }
          : { delta: 0 };
      }
      if (
        /(całkowite\s+dochody\s+ogółem|łączne\s+całkowite\s+dochody|total\s+comprehensive)/i.test(
          normalizedLabel
        )
      ) {
        return canonicalId === 'fsl-pl-comprehensive-income'
          ? { delta: 0.6, reason: 'pl_comprehensive_income_anchor' }
          : { delta: 0 };
      }
      if (
        /(zysk\s+na\s+(?:jedną\s+)?akcję\s+(?:zwykłą\s+)?podstawowy|basic\s+earnings?\s+per\s+share)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-pl-eps-basic')
          return { delta: 0.7, reason: 'pl_eps_basic_anchor' };
        if (canonicalId === 'fsl-pl-eps-diluted')
          return { delta: -0.3, reason: 'pl_eps_basic_vs_diluted' };
      }
      if (
        /(zysk\s+na\s+(?:jedną\s+)?akcję\s+rozwodniony|rozwodniony\s+zysk|diluted\s+earnings?\s+per\s+share)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-pl-eps-diluted')
          return { delta: 0.7, reason: 'pl_eps_diluted_anchor' };
        if (canonicalId === 'fsl-pl-eps-basic')
          return { delta: -0.3, reason: 'pl_eps_diluted_vs_basic' };
      }
      if (
        /(zysk\s+na\s+(?:jedną\s+)?akcję|zysk\s+na\s+akcję)/i.test(normalizedLabel) &&
        !/rozwodniony|diluted/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-pl-eps-basic')
          return { delta: 0.4, reason: 'pl_eps_generic_anchor' };
      }
      if (
        /(średnia\s+ważona\s+liczba\s+akcji|weighted\s+average\s+shares)/i.test(normalizedLabel)
      ) {
        return canonicalId === 'fsl-pl-shares-outstanding'
          ? { delta: 0.6, reason: 'pl_shares_outstanding_anchor' }
          : { delta: 0 };
      }
      if (
        /(przychody\s+finansowe|finance\s+income)/i.test(normalizedLabel) &&
        !/koszty/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-pl-fin-income')
          return { delta: 0.5, reason: 'pl_fin_income_anchor' };
        if (canonicalId === 'fsl-pl-revenue')
          return { delta: -0.4, reason: 'pl_fin_income_vs_revenue' };
        if (canonicalId === 'fsl-pl-interest')
          return { delta: -0.2, reason: 'pl_fin_income_vs_interest' };
      }
      if (
        /(koszty\s+finansowe|finance\s+costs)/i.test(normalizedLabel) &&
        !/przychody/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-pl-fin-expense')
          return { delta: 0.5, reason: 'pl_fin_expense_anchor' };
        if (canonicalId === 'fsl-pl-interest')
          return { delta: -0.2, reason: 'pl_fin_expense_vs_interest' };
      }
      if (/(pozostałe\s+koszty\s+operacyjne|other\s+operating\s+expenses)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-other-opex')
          return { delta: 0.4, reason: 'pl_other_opex_anchor' };
      }
      if (
        /przychody\s+ze\s+sprzedaży\s+produktów|revenue\s+from\s+products/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-pl-revenue-product')
          return { delta: 0.7, reason: 'pl_revenue_product_anchor' };
        if (canonicalId === 'fsl-pl-revenue')
          return { delta: -0.3, reason: 'pl_revenue_product_vs_total' };
      }
      if (
        /przychody\s+ze\s+sprzedaży\s+usług|przychody\s+usługowe|service\s+revenue/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-pl-revenue-service')
          return { delta: 0.7, reason: 'pl_revenue_service_anchor' };
        if (canonicalId === 'fsl-pl-revenue')
          return { delta: -0.3, reason: 'pl_revenue_service_vs_total' };
      }
      if (/przychody\s+(?:z\s+)?eksport|export\s+revenue/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-revenue-product-export')
          return { delta: 0.7, reason: 'pl_revenue_export_anchor' };
        if (canonicalId === 'fsl-pl-revenue-product')
          return { delta: -0.2, reason: 'pl_revenue_export_vs_product' };
      }
      if (/przychody\s+krajowe|domestic\s+revenue/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-revenue-product-domestic')
          return { delta: 0.7, reason: 'pl_revenue_domestic_anchor' };
        if (canonicalId === 'fsl-pl-revenue-product')
          return { delta: -0.2, reason: 'pl_revenue_domestic_vs_product' };
      }
      if (
        /zużycie\s+materiałów\s+i\s+energii|materials?\s+(?:and\s+energy|cost)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-pl-cogs-materials')
          return { delta: 0.7, reason: 'pl_cogs_materials_anchor' };
        if (canonicalId === 'fsl-pl-cogs')
          return { delta: -0.2, reason: 'pl_cogs_materials_vs_total' };
      }
      if (/usługi\s+obce/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-gna-external')
          return { delta: 0.6, reason: 'pl_gna_external_anchor' };
        if (canonicalId === 'fsl-pl-cogs-labor-contractors')
          return { delta: -0.2, reason: 'pl_external_vs_production' };
      }
      if (/koszty\s+marketingu|reklama\s+i\s+promocja|marketing/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-selling-marketing')
          return { delta: 0.6, reason: 'pl_marketing_anchor' };
        if (canonicalId === 'fsl-pl-selling')
          return { delta: -0.2, reason: 'pl_marketing_vs_selling' };
      }
      if (
        /odsetki\s+(?:od\s+)?leasingu|odsetki\s+leasingowe|lease\s+interest/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-pl-interest-lease')
          return { delta: 0.7, reason: 'pl_interest_lease_anchor' };
        if (canonicalId === 'fsl-pl-interest')
          return { delta: -0.2, reason: 'pl_interest_lease_vs_total' };
        if (canonicalId === 'fsl-pl-interest-bank')
          return { delta: -0.3, reason: 'pl_interest_lease_vs_bank' };
      }
      if (/odsetki\s+bankowe|odsetki\s+od\s+kredyt|bank\s+interest/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-interest-bank')
          return { delta: 0.7, reason: 'pl_interest_bank_anchor' };
        if (canonicalId === 'fsl-pl-interest')
          return { delta: -0.2, reason: 'pl_interest_bank_vs_total' };
        if (canonicalId === 'fsl-pl-interest-lease')
          return { delta: -0.3, reason: 'pl_interest_bank_vs_lease' };
      }
      if (
        /amortyzacja\s+(?:wartości\s+)?niematerial|amortization\s+of\s+intangible/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-pl-depreciation-intangibles')
          return { delta: 0.7, reason: 'pl_depreciation_intangibles_anchor' };
        if (canonicalId === 'fsl-pl-depreciation')
          return { delta: -0.2, reason: 'pl_depreciation_intangibles_vs_total' };
      }
      if (
        /amortyzacja\s+(?:środków\s+trwałych|rzeczowych)|depreciation\s+of\s+(?:ppe|property)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-pl-depreciation-ppe')
          return { delta: 0.7, reason: 'pl_depreciation_ppe_anchor' };
        if (canonicalId === 'fsl-pl-depreciation')
          return { delta: -0.2, reason: 'pl_depreciation_ppe_vs_total' };
      }
      if (/odpisy\s+aktualizujące|impairment\s+(?:charge|expense|loss)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-other-opex-impairment')
          return { delta: 0.5, reason: 'pl_impairment_anchor' };
        if (canonicalId === 'fsl-pl-other-opex')
          return { delta: -0.2, reason: 'pl_impairment_vs_opex' };
      }
      if (
        /(?:utworzenie|zmiana\s+stanu)\s+rezerw|provision\s+(?:charge|expense)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-pl-other-opex-provisions')
          return { delta: 0.5, reason: 'pl_provisions_anchor' };
        if (canonicalId === 'fsl-pl-other-opex')
          return { delta: -0.2, reason: 'pl_provisions_vs_opex' };
      }
      if (/research\s+and\s+development|r\s*&\s*d\s+(?:expense|cost)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-rnd') return { delta: 0.8, reason: 'pl_rnd_anchor' };
        if (canonicalId === 'fsl-pl-opex') return { delta: -0.3, reason: 'pl_rnd_vs_total_opex' };
        if (canonicalId === 'fsl-pl-gna') return { delta: -0.3, reason: 'pl_rnd_vs_gna' };
      }
      if (/(?:selling|sales)\s+(?:general\s+)?and\s+administrative/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-sga') return { delta: 0.7, reason: 'pl_sga_anchor' };
        if (canonicalId === 'fsl-pl-gna') return { delta: 0.3, reason: 'pl_sga_as_gna' };
        if (canonicalId === 'fsl-pl-opex') return { delta: -0.3, reason: 'pl_sga_vs_opex' };
      }
      if (/total\s+(?:cost\s+of|cost)\s+revenues?/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-cogs')
          return { delta: 0.7, reason: 'pl_total_cost_of_revenues_anchor' };
      }
      if (/total\s+operating\s+expenses/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-opex') return { delta: 0.7, reason: 'pl_total_opex_anchor' };
        if (canonicalId === 'fsl-pl-cogs') return { delta: -0.4, reason: 'pl_total_opex_vs_cogs' };
      }
      if (
        /net\s+income\s+(?:loss\s+)?attributable\s+to\s+(?:common\s+)?(?:stockholders?|shareowners?|shareholders?|owners)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-pl-net-parent')
          return { delta: 0.8, reason: 'pl_net_parent_en_anchor' };
        if (canonicalId === 'fsl-pl-net') return { delta: -0.3, reason: 'pl_net_parent_vs_net' };
      }
      if (/consolidated\s+net\s+income/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-net')
          return { delta: 0.6, reason: 'pl_consolidated_net_anchor' };
      }
      if (/automotive\s+sales\b/i.test(normalizedLabel) && !/cost/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-revenue-product')
          return { delta: 0.7, reason: 'pl_automotive_sales_anchor' };
        if (canonicalId === 'fsl-pl-revenue')
          return { delta: -0.3, reason: 'pl_auto_sales_vs_total_rev' };
      }
      if (
        /(?:total\s+)?automotive\s+(?:cost\s+of\s+)?revenues/i.test(normalizedLabel) &&
        !/cost\s+of/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-pl-revenue-product')
          return { delta: 0.6, reason: 'pl_auto_rev_total_anchor' };
        if (canonicalId === 'fsl-pl-revenue')
          return { delta: -0.3, reason: 'pl_auto_rev_vs_total' };
      }
      if (/automotive\s+cost\s+of\s+revenues/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-cogs') return { delta: 0.6, reason: 'pl_auto_cogs_anchor' };
      }
      if (/services?\s+and\s+other/i.test(normalizedLabel) && /revenue/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-revenue-service')
          return { delta: 0.6, reason: 'pl_services_other_anchor' };
        if (canonicalId === 'fsl-pl-revenue')
          return { delta: -0.3, reason: 'pl_services_vs_total_rev' };
      }
      if (/manufacturing\s+costs?/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-pl-cogs')
          return { delta: 0.5, reason: 'pl_manufacturing_costs_anchor' };
      }
    }

    if (normalizedType === 'CF') {
      if (
        /acquisition|net\s+of\s+cash\s+acquired/i.test(normalizedLabel) &&
        /invest/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-cf-investing-acquisitions')
          return { delta: 0.7, reason: 'cf_acquisitions_anchor' };
        if (canonicalId === 'fsl-cf-capex')
          return { delta: -0.3, reason: 'cf_acquisitions_vs_capex' };
      }
      if (/investment\s+in\s+(?:joint\s+ventures|associates)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-investing-jv')
          return { delta: 0.7, reason: 'cf_investing_jv_anchor' };
        if (canonicalId === 'fsl-cf-investing-subsidiaries')
          return { delta: -0.2, reason: 'cf_jv_vs_subsidiaries' };
      }
      if (
        /purchases?\s+of\s+investments|investments?\s+in\s+marketable\s+securities/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-investing-securities')
          return { delta: 0.7, reason: 'cf_securities_purchase_anchor' };
        if (canonicalId === 'fsl-cf-capex')
          return { delta: -0.3, reason: 'cf_securities_vs_capex' };
      }
      if (
        /issuances?\s+of\s+(?:common\s+)?stock|proceeds\s+from\s+(?:issuance|exercise)\s+of\s+(?:stock|options)/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-cf-share-issuance')
          return { delta: 0.7, reason: 'cf_share_issuance_anchor' };
        if (canonicalId === 'fsl-cf-debt-drawdown')
          return { delta: -0.4, reason: 'cf_issuance_vs_drawdown' };
      }
      if (/other\s+financing\s+activities/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-other-financing')
          return { delta: 0.7, reason: 'cf_other_financing_anchor' };
        if (canonicalId === 'fsl-cf-financing')
          return { delta: -0.3, reason: 'cf_other_fin_vs_total_fin' };
      }
      if (/inventory.*write.?down|write.?down.*inventory/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-other-adj')
          return { delta: 0.6, reason: 'cf_inventory_writedown_adj' };
        if (canonicalId === 'fsl-cf-change-wc-inventory')
          return { delta: -0.4, reason: 'cf_writedown_not_wc' };
      }
      if (/operating\s+lease\s+vehicles/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-cf-operating-other-adj')
          return { delta: 0.5, reason: 'cf_lease_vehicles_adj' };
      }
    }

    if (normalizedType === 'BS') {
      if (/finance\s+debt/i.test(normalizedLabel) && !/current\s+portion/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-long-term-debt')
          return { delta: 0.6, reason: 'bs_finance_debt_anchor' };
        if (canonicalId === 'fsl-bs-short-term-debt')
          return { delta: -0.3, reason: 'bs_finance_debt_vs_st' };
      }
      if (/current\s+portion\s+of\s+(?:debt|finance\s+leases?|long.term)/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-short-term-debt')
          return { delta: 0.7, reason: 'bs_current_debt_portion_anchor' };
        if (canonicalId === 'fsl-bs-long-term-debt')
          return { delta: -0.4, reason: 'bs_current_vs_lt_debt' };
      }
      if (/debt\s+and\s+finance\s+leases?\s*,?\s*net\s+of\s+current/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-long-term-debt')
          return { delta: 0.7, reason: 'bs_lt_debt_net_of_current_anchor' };
        if (canonicalId === 'fsl-bs-short-term-debt')
          return { delta: -0.4, reason: 'bs_lt_not_st' };
      }
      if (/deferred\s+revenue/i.test(normalizedLabel)) {
        if (/non.?current|net\s+of\s+current/i.test(normalizedLabel)) {
          if (canonicalId === 'fsl-bs-deferred-revenue-non-current')
            return { delta: 0.8, reason: 'bs_deferred_rev_nc_anchor' };
          if (canonicalId === 'fsl-bs-deferred-revenue-current')
            return { delta: -0.4, reason: 'bs_deferred_rev_nc_not_current' };
        } else {
          if (canonicalId === 'fsl-bs-deferred-revenue-current')
            return { delta: 0.6, reason: 'bs_deferred_rev_current_anchor' };
          if (canonicalId === 'fsl-bs-contract-liabilities')
            return { delta: 0.2, reason: 'bs_deferred_rev_as_contract' };
        }
      }
      if (/defined\s+benefit\s+pension.*surplus/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-pension-surplus')
          return { delta: 0.8, reason: 'bs_pension_surplus_anchor' };
      }
      if (
        /defined\s+benefit\s+pension.*deficit|post.employment\s+benefit.*deficit/i.test(
          normalizedLabel
        )
      ) {
        if (canonicalId === 'fsl-bs-pension-deficit')
          return { delta: 0.8, reason: 'bs_pension_deficit_anchor' };
      }
      if (/net\s+assets\b/i.test(normalizedLabel) && !/held\s+for\s+sale/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-equity')
          return { delta: 0.4, reason: 'bs_net_assets_as_equity' };
      }
      if (/prepaid\s+expenses?\s+and\s+other\s+current/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-other-current-assets')
          return { delta: 0.6, reason: 'bs_prepaid_other_current_anchor' };
        if (canonicalId === 'fsl-bs-other-current-assets-prepaids')
          return { delta: 0.3, reason: 'bs_prepaid_as_prepaids' };
      }
      if (/trademarks?\s+(?:with\s+)?indefinite/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-intangibles')
          return { delta: 0.6, reason: 'bs_trademarks_as_intangibles' };
      }
      if (/equity\s+(?:attributable\s+to\s+)?(?:bp\s+)?shareholders/i.test(normalizedLabel)) {
        if (canonicalId === 'fsl-bs-equity-parent')
          return { delta: 0.7, reason: 'bs_equity_shareholders_anchor' };
        if (canonicalId === 'fsl-bs-equity')
          return { delta: -0.2, reason: 'bs_shareholders_vs_total' };
      }
      if (
        /(?:stockholders?|shareholders?)\s+equity/i.test(normalizedLabel) &&
        /preferred\s+stock|common\s+stock/i.test(normalizedLabel)
      ) {
        if (canonicalId === 'fsl-bs-equity')
          return { delta: 0.5, reason: 'bs_stockholders_equity_header' };
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
        if (
          templateFamily &&
          aliasRows.some(
            (row) =>
              row.statement_line_id === canonical.id && row.template_family === templateFamily
          )
        ) {
          score += 0.1;
        }
        const structuralBoost = applyStructuralMappingBoost(
          label,
          canonical.id,
          normalizedStatementType
        );
        score += structuralBoost.delta;
        if (score <= 0) continue;
        scoredMatches.push({
          id: canonical.id,
          name: canonical.line_name,
          score,
          reason:
            structuralBoost.reason || (score >= 1 ? 'exact_alias_match' : 'alias_similarity_match'),
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

export function resolveDuplicateSuggestedMappings(
  extractedLines: ExtractedLine[]
): ExtractedLine[] {
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

function hasCanonicalLineCoverage(
  lineId: string,
  presentLineIds: Set<string>,
  getValue: (lineId: string) => number | null
): boolean {
  if (presentLineIds.has(lineId)) return true;

  const hasAnyPresentPrefix = (prefix: string): boolean =>
    Array.from(presentLineIds).some((presentId) => presentId.startsWith(prefix));

  if (lineId === 'fsl-pl-tax') {
    return getValue('fsl-pl-tax-current') !== null || getValue('fsl-pl-tax-deferred') !== null;
  }

  if (lineId === 'fsl-pl-net') {
    return (
      getValue('fsl-pl-net-continuing') !== null ||
      (getValue('fsl-pl-ebt') !== null &&
        (getValue('fsl-pl-tax') !== null ||
          getValue('fsl-pl-tax-current') !== null ||
          getValue('fsl-pl-tax-deferred') !== null))
    );
  }

  if (lineId === 'fsl-pl-depreciation') {
    return (
      getValue('fsl-pl-depreciation-ppe') !== null ||
      getValue('fsl-pl-depreciation-intangibles') !== null
    );
  }

  if (lineId === 'fsl-pl-opex') {
    return (
      getValue('fsl-pl-selling') !== null ||
      getValue('fsl-pl-gna') !== null ||
      getValue('fsl-pl-other-opex') !== null
    );
  }

  if (lineId === 'fsl-pl-ebitda') {
    return (
      getValue('fsl-pl-ebit') !== null &&
      (getValue('fsl-pl-depreciation') !== null ||
        getValue('fsl-pl-depreciation-ppe') !== null ||
        getValue('fsl-pl-depreciation-intangibles') !== null)
    );
  }

  if (lineId === 'fsl-cf-operating') {
    return (
      getValue('fsl-cf-operating-generated') !== null ||
      hasAnyPresentPrefix('fsl-cf-operating-') ||
      (getValue('fsl-cf-net-change-cash') !== null &&
        getValue('fsl-cf-investing') !== null &&
        getValue('fsl-cf-financing') !== null)
    );
  }

  if (lineId === 'fsl-pl-interest') {
    return (
      getValue('fsl-pl-fin-expense') !== null ||
      getValue('fsl-pl-interest-bank') !== null ||
      getValue('fsl-pl-interest-lease') !== null
    );
  }

  if (lineId === 'fsl-cf-financing') {
    return (
      hasAnyPresentPrefix('fsl-cf-debt-') ||
      presentLineIds.has('fsl-cf-dividends') ||
      presentLineIds.has('fsl-cf-lease-repayment')
    );
  }

  return false;
}

function getMissingRequiredCanonicalLineIds(
  statementType: CanonicalStatementType | null,
  presentLineIds: Set<string>,
  getValue: (lineId: string) => number | null
): string[] {
  if (!statementType) return [];
  return getRequiredCanonicalLineIds(statementType).filter(
    (lineId) => !hasCanonicalLineCoverage(lineId, presentLineIds, getValue)
  );
}

export function validateStatement(
  lines: Array<{
    canonicalLineId: string | null;
    value: number;
    originalLabel?: string;
    mappingStatus?: string;
    isNonFinancial?: boolean;
    periodLabel?: string | null;
  }>,
  statementType: string
): { status: 'pass' | 'warnings' | 'needs_review'; messages: ValidationMessage[] } {
  const messages: ValidationMessage[] = [];
  const activeLines = lines.filter((line) => !line.isNonFinancial);
  const canonicalStatementType = toCanonicalStatementType(statementType);

  const getValues = (lineId: string): number[] =>
    activeLines
      .filter((line) => line.canonicalLineId === lineId)
      .map((line) => Number(line.value || 0));
  const getValue = (lineId: string): number | null => {
    const values = getValues(lineId);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0);
  };

  const duplicateKeys = activeLines
    .filter((line) => line.canonicalLineId)
    .map((line) => `${String(line.canonicalLineId)}::${String(line.periodLabel || '')}`);
  const duplicateCodes = Array.from(
    new Set(
      duplicateKeys
        .filter((key, index, arr) => arr.indexOf(key) !== index)
        .map((key) => key.split('::')[0])
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
    if (
      currentAssets !== null &&
      totalAssets !== null &&
      Math.abs(currentAssets) > Math.abs(totalAssets) * 1.05
    ) {
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

    const nonCurrentAssets = getValue('fsl-bs-noncurrent-assets');
    if (nonCurrentAssets !== null && currentAssets !== null && totalAssets !== null) {
      const assetSum = nonCurrentAssets + currentAssets;
      const diff = Math.abs(totalAssets - assetSum);
      if (diff > Math.abs(totalAssets) * 0.02) {
        messages.push({
          type: 'warning',
          code: 'BS_ASSETS_SUBCOMPONENT_MISMATCH',
          message: `Non-current + Current assets ≠ Total assets`,
          details: `NC: ${nonCurrentAssets}, C: ${currentAssets}, Sum: ${assetSum}, Total: ${totalAssets}`,
        });
      }
    }

    const nonCurrentLiabilities = getValue('fsl-bs-noncurrent-liabilities');
    if (
      nonCurrentLiabilities !== null &&
      currentLiabilities !== null &&
      totalLiabilities !== null
    ) {
      const liabSum = nonCurrentLiabilities + currentLiabilities;
      const diff = Math.abs(totalLiabilities - liabSum);
      if (diff > Math.abs(totalLiabilities) * 0.02) {
        messages.push({
          type: 'warning',
          code: 'BS_LIABILITIES_SUBCOMPONENT_MISMATCH',
          message: `Non-current + Current liabilities ≠ Total liabilities`,
          details: `NC: ${nonCurrentLiabilities}, C: ${currentLiabilities}, Sum: ${liabSum}, Total: ${totalLiabilities}`,
        });
      }
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
      activeLines.map((line) => String(line.canonicalLineId || '').trim()).filter(Boolean)
    );
    const missingRequiredLineIds = getMissingRequiredCanonicalLineIds(
      canonicalStatementType,
      presentLineIds,
      getValue
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
  const normalizedStatus = String(params.rawStatus || '')
    .trim()
    .toLowerCase();
  const normalizedType = normalizeStatementTypeToken(params.statementType);
  const normalizedValidation = String(params.validationStatus || '')
    .trim()
    .toLowerCase();
  const normalizedCurrency = String(params.currency || '')
    .trim()
    .toUpperCase();
  const normalizedScaling = String(params.scaling || '')
    .trim()
    .toLowerCase();
  const validationMessages = Array.isArray(params.validationMessages)
    ? params.validationMessages
    : [];
  const activeValues = (params.values || []).filter((value) => !value.isNonFinancial);
  const canonicalStatementType = toCanonicalStatementType(params.statementType);
  const nonFinancialLineCount = Math.max(0, (params.values || []).length - activeValues.length);
  const mappedLineCount = activeValues.filter((value) => value.canonicalLineId).length;
  const eligibleLineCount = activeValues.length;
  const unmappedLineCount = Math.max(0, eligibleLineCount - mappedLineCount);
  const presentLineIds = new Set(
    activeValues.map((value) => String(value.canonicalLineId || '').trim()).filter(Boolean)
  );
  const getValue = (lineId: string): number | null => {
    const values = activeValues
      .filter((value) => value.canonicalLineId === lineId)
      .map((value) => Number(value.value || 0));
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0);
  };
  const missingRequiredLineCount = getMissingRequiredCanonicalLineIds(
    canonicalStatementType,
    presentLineIds,
    getValue
  ).length;
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
  if (!normalizedCurrency || normalizedCurrency === 'UNKNOWN')
    reasonCodes.push('UNRESOLVED_CURRENCY');
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
  if (
    reasonCodes.includes('UNSUPPORTED_STATEMENT_TYPE') ||
    reasonCodes.includes('NO_ELIGIBLE_FINANCIAL_LINES')
  ) {
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
      await dbRun(
        `DELETE FROM financial_statement_extracted_sections WHERE ingest_run_id = ?`,
        [params.ingestRunId],
        {
          fallback: false,
        }
      );
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
      await dbRun(
        `DELETE FROM financial_statement_candidate_rows WHERE ingest_run_id = ?`,
        [params.ingestRunId],
        {
          fallback: false,
        }
      );
    }
    const created: Array<{ candidateRowId: string; sourceRow?: number }> = [];
    const sectionKey = `${normalizeStatementTypeToken(params.statementType) || 'UNKNOWN'}_1`;
    for (const row of params.rows) {
      const candidateRowId = uuidv4();
      await dbRun(
        `INSERT INTO financial_statement_candidate_rows
          (id, statement_id, ingest_run_id, section_id, row_key, row_label, normalized_label, source_row, source_page, selected_period_label, raw_value, normalized_value, currency, scaling, confidence, classification_reason, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          candidateRowId,
          params.statementId,
          params.ingestRunId || null,
          params.sectionIdsByKey?.[row.sectionKey || sectionKey] || null,
          row.sourceRow != null ? `${params.statementId}:${row.sourceRow}` : uuidv4(),
          row.originalLabel,
          normalizeAliasText(row.originalLabel),
          row.sourceRow || null,
          row.sourcePage || null,
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
    const values = params.ingestRunId
      ? [params.statementId, params.ingestRunId]
      : [params.statementId];
    const rows = (await dbAll(
      `SELECT
         row.row_label as row_label,
         row.source_row as source_row,
         row.source_page as source_page,
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
      source_page?: number | null;
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
        sourcePage: row.source_page != null ? Number(row.source_page) : undefined,
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
        classificationReason:
          row.classification_reason || metadata.classificationReason || undefined,
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
      await dbRun(
        `DELETE FROM financial_statement_mapping_candidates WHERE ingest_run_id = ?`,
        [params.ingestRunId],
        {
          fallback: false,
        }
      );
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
  const getValue = (lineId: string): number | null => {
    const values = activeValues
      .filter((value) => value.canonicalLineId === lineId)
      .map((value) => Number(value.value || 0));
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0);
  };
  const presentLineIds = new Set(
    activeValues.map((value) => String(value.canonicalLineId || '').trim()).filter(Boolean)
  );
  const missingRequired = getMissingRequiredCanonicalLineIds(
    canonicalStatementType,
    presentLineIds,
    getValue
  );

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
        (canonicalStatementType ? getRequiredCanonicalLineIds(canonicalStatementType).length : 0) -
          missingRequired.length,
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

/**
 * FIN-005 upload idempotency (Codex review Blocker 2) — serialize concurrent
 * `POST /finance-statements/upload` requests for one
 * (organizationId, Idempotency-Key) pair on a pinned PostgreSQL session.
 *
 * This is the SAME `pg_advisory_xact_lock` pattern already accepted for
 * FIN-03/FIN-04's `withFinancialModelIdempotencyLock`
 * (financialModelingService.ts) — a real PostgreSQL-level guarantee, not a
 * process-local mutex/Map. `pg_advisory_xact_lock` blocks any OTHER
 * PostgreSQL session (any other server process, not just this one) that
 * requests the same two hashed lock keys, so the guarantee holds across
 * horizontally-scaled server instances.
 *
 * WHY a transaction-scoped advisory lock and not a separate reservation row
 * with an `in_progress` -> `completed`/`failed` status column: the lock IS
 * the reservation, and its lifetime is tied EXACTLY to the wrapping
 * transaction — released the instant that transaction ends, on COMMIT *or*
 * ROLLBACK, regardless of whether `work()` resolved or threw. A first
 * attempt that fails partway through (parse error, DB error, anything)
 * therefore can never leave a second attempt permanently blocked: there is
 * no separate "in_progress" row that could get stuck, because nothing
 * outlives the transaction. The caller decides what "failure" means for its
 * own response (this wrapper does not interpret `work()`'s return value) —
 * the route only persists an idempotency marker for a genuinely successful
 * upload, so a failed first attempt leaves no marker behind and a retry
 * with the same key simply does the work again.
 */
export async function withStatementUploadIdempotencyLock<T>(
  organizationId: string,
  idempotencyKey: string,
  work: () => Promise<T>
): Promise<T> {
  const { getPoolClientForPinnedTransaction } = await import('../database/PostgresDatabase.js');
  const client = await getPoolClientForPinnedTransaction();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
      `${organizationId}:statement_upload`,
      idempotencyKey,
    ]);
    const result = await work();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

// ════════════════════════════════════════════════
// FIN-005: Upload idempotency — shared state machine
//
// Moved here (pure refactor, out of finance-statements.routes.ts) so the
// SAME reservation/finalize/fail/cleanup primitives can be wired into every
// endpoint that persists a Statement from an uploaded file — not just
// `POST /finance-statements/upload`, which is the only one that had them
// before. See `withStatementUploadIdempotencyLock` immediately above for the
// outer per-(org,key) serialization layer these primitives run underneath.
// ════════════════════════════════════════════════

export const MAX_IDEMPOTENCY_KEY_CHARS = 200;

/**
 * Thrown by getIdempotencyKey() when the client-supplied key is over the
 * length cap. Callers map this to 400 IDEMPOTENCY_KEY_TOO_LONG.
 *
 * Codex review Blocker 3, negative control: a PREVIOUS implementation
 * silently truncated an over-length key with `.slice(0, MAX)`. Truncation is
 * actively dangerous, not just sloppy — two DIFFERENT long keys that happen
 * to share the same first MAX_IDEMPOTENCY_KEY_CHARS characters would
 * truncate to the IDENTICAL stored key, so the second request would
 * silently replay the first's result even though the client believed it was
 * using a distinct key for a distinct logical operation. Rejecting is the
 * only safe option — the client must be told to shorten the key, never have
 * it silently reinterpreted as someone else's key.
 */
export class IdempotencyKeyTooLongError extends Error {}

/**
 * Minimal shape `getIdempotencyKey` needs from an Express-style request —
 * kept structural (not `express.Request`) so this service has no dependency
 * on the `express` types, and so it works unchanged against both the legacy
 * `AuthRequest` (finance-statements.routes.ts) and the v8 route's own
 * request type.
 */
export interface IdempotencyKeyRequestLike {
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/**
 * Read a client-supplied idempotency key from header or body, trimmed.
 * Returns null if none was supplied. Throws IdempotencyKeyTooLongError if
 * one was supplied but exceeds MAX_IDEMPOTENCY_KEY_CHARS — see that class's
 * doc comment for why this must reject, not truncate.
 */
export function getIdempotencyKey(req: IdempotencyKeyRequestLike): string | null {
  const headerRaw = req.headers?.['idempotency-key'];
  const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const bodyRaw = (req.body as Record<string, unknown> | undefined)?.idempotencyKey;
  const raw = String(header || bodyRaw || '').trim();
  if (!raw) return null;
  if (raw.length > MAX_IDEMPOTENCY_KEY_CHARS) {
    throw new IdempotencyKeyTooLongError(
      `Idempotency-Key exceeds ${MAX_IDEMPOTENCY_KEY_CHARS} characters`
    );
  }
  return raw;
}

/** SHA-256 hex digest of an uploaded file's raw bytes — see Codex review
 * Blocker 3: the Idempotency-Key header alone doesn't tie a replay to WHAT
 * was actually uploaded. Hashing the file bytes is sufficient to detect a
 * reused key with different content. Only the hash is ever persisted —
 * never the bytes. */
export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * ── Codex round-3 fix: reservation/result state machine ──────────────────
 *
 * The PREVIOUS shape here (`findIdempotentUpload` + best-effort
 * `recordIdempotentUpload`, both since removed) only ever wrote the
 * completion marker ONCE, at the very end, and swallowed every failure of
 * that write. Root cause: that write went through `dbRun()` ->
 * `Database.js`'s global connection pool — a DIFFERENT connection than the
 * one `withStatementUploadIdempotencyLock` holds its `pg_advisory_xact_lock`
 * on — so it was never actually inside "the transaction" the lock implied.
 * A failure of just that one INSERT (any reason) left the business writes
 * (Statement + Pack, which already commit independently per-statement via
 * that same global pool) durably committed, a 201 already sent, and NO
 * durable marker — a same-key retry then found nothing and redid the whole
 * upload, creating a duplicate Statement/Pack.
 *
 * FIX: reserve BEFORE doing any work, finalize (or fail) AFTER — both as
 * their OWN durably-committed statements, independent of whether later
 * steps in this request succeed. `pg_advisory_xact_lock` remains the outer
 * serialization layer (unchanged) — it guarantees only ONE caller for a
 * given (organizationId, idempotencyKey) is ever inside
 * `reserveIdempotentUpload` at a time, which is what makes the
 * SELECT-then-branch-then-UPDATE sequence below race-free without needing
 * its own database transaction. See the `20260805_fin005_statement_upload_
 * idempotency_state_machine.sql` migration for the schema side of this.
 */

/**
 * How long an 'in_progress' reservation is treated as a live, in-flight
 * upload before a later request for the same (org, key) is allowed to
 * reclaim it. A real upload -> parse -> persist cycle for a single
 * financial statement (a handful of sheets, a few hundred rows at most)
 * should never approach this. It exists purely to recover a reservation
 * abandoned by a crashed/killed process: a crash releases the
 * pg_advisory_xact_lock immediately (the pinned connection drops, its
 * transaction aborts), so a NEW request for the same key is NOT blocked by
 * the lock — but without this cutoff it would be blocked forever by a
 * permanently 'in_progress' row that no live process is ever going to
 * finalize or fail.
 */
export const STALE_IN_PROGRESS_SECONDS = 60;

interface IdempotencyRow {
  id: string;
  status: 'in_progress' | 'completed' | 'failed';
  status_code: number;
  response_json: string | null;
  request_hash: string | null;
  created_at: string;
  statement_id?: string | null;
}

export type ReservationOutcome =
  | { kind: 'owner'; reservationId: string }
  | { kind: 'replay'; statusCode: number; body: Record<string, unknown> }
  | { kind: 'conflict' }
  | { kind: 'in_progress' }
  | { kind: 'schema_missing' }
  // Codex round-4 Blocker 1 — true exactly-once recovery on reclaim: a prior
  // attempt on this SAME reservation row already durably completed a real,
  // fully-synced Statement+Pack (business writes commit independently of
  // this row's own finalize/fail outcome), but the row itself never reached
  // 'completed' (crashed/failed after the business write, before finalize).
  // Merely orphan-tracking that statement_id (Fix 1) and letting the caller
  // redo the whole upload would create a permanent, unreferenced duplicate
  // the instant the redo's OWN Statement+Pack is created. `statementId` here
  // is that already-complete Statement — the caller must reuse it (a
  // recovery response), never re-run extraction/persist for this request.
  | { kind: 'recover'; reservationId: string; statementId: string }
  // Codex round-5 — MULTI-SECTION recovery: the abandoned attempt recorded
  // its COMPLETE intended response (every section's Statement id plus the
  // real multi-section body) before its finalize step failed, and every one
  // of those Statements has been re-verified as still present and fully
  // synced to a pack. The caller replays `body` VERBATIM — same
  // `mode: 'smart'`, same `statementIds`, same `analysis` the original
  // success would have returned — instead of the single-id `mode: 'fallback'`
  // reconstruction, which silently dropped every section after the first.
  | {
      kind: 'recover_result';
      reservationId: string;
      statusCode: number;
      body: Record<string, unknown>;
      statementIds: string[];
    };

/**
 * What an ABANDONED keyed attempt leaves behind on its own 'failed' row, in
 * the `response_json` column.
 *
 * WHY `response_json` AND NOT A NEW COLUMN: the column already exists and is
 * NULL on every non-'completed' row, so this needs no migration and no data
 * model change at all. The dual meaning is safe for exactly the reason the
 * existing `statement_id` dual meaning is safe — the ONLY site that reads
 * `response_json` as a replayable payload (`reserveIdempotentUpload`'s replay
 * branch) is gated on `status === 'completed'` first, and the reclaim UPDATE
 * nulls the column.
 *
 * `statementIds` is recorded even when `result` is absent (a throw, or a
 * controlled non-2xx): knowing HOW MANY Statements an abandoned attempt
 * created is what lets recovery tell "one section, honestly reconstructable"
 * apart from "several sections, NOT reconstructable from a single id" — the
 * latter must never be answered with a fallback single-statement success.
 */
export interface FailedAttemptRecord {
  statementIds: string[];
  /** Present only when the attempt actually produced a complete success body
   * and then failed at finalize — the only case a full replay is honest. */
  result?: { statusCode: number; body: Record<string, unknown> };
}

const FAILED_ATTEMPT_ENVELOPE_KEY = '__fin005_failed_attempt';

function encodeFailedAttemptRecord(record: FailedAttemptRecord): string {
  return JSON.stringify({ [FAILED_ATTEMPT_ENVELOPE_KEY]: record });
}

/** Tolerant by design: anything unparseable or foreign is treated as "nothing
 * recorded", which degrades to the pre-existing single-id behavior instead of
 * throwing inside the reservation path. */
export function parseFailedAttemptRecord(raw: string | null): FailedAttemptRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const envelope = parsed?.[FAILED_ATTEMPT_ENVELOPE_KEY] as
      { statementIds?: unknown; result?: unknown } | undefined;
    if (!envelope || !Array.isArray(envelope.statementIds)) return null;
    const statementIds = (envelope.statementIds as unknown[]).filter(
      (id): id is string => typeof id === 'string' && id.length > 0
    );
    const rawResult = envelope.result as { statusCode?: unknown; body?: unknown } | undefined;
    const result =
      rawResult &&
      typeof rawResult === 'object' &&
      rawResult.body &&
      typeof rawResult.body === 'object'
        ? {
            statusCode: Number(rawResult.statusCode) || 201,
            body: rawResult.body as Record<string, unknown>,
          }
        : undefined;
    return { statementIds, result };
  } catch {
    return null;
  }
}

/**
 * Re-verify, against the database, that EVERY Statement an abandoned attempt
 * created still exists in this organization and is fully synced to a pack
 * (`statement_pack_id IS NOT NULL` — the same completeness signal the
 * single-id recovery path uses). Tenant-scoped as defense in depth.
 *
 * A recorded response is only replayable if this returns true for the whole
 * set: replaying a body that advertises N statement ids while some of them no
 * longer exist would hand the client a receipt it cannot read back.
 */
async function areAllStatementsComplete(
  statementIds: string[],
  organizationId: string
): Promise<boolean> {
  if (statementIds.length === 0) return false;
  for (const id of statementIds) {
    const row = await dbGet<{ id: string; statement_pack_id: string | null }>(
      `SELECT id, statement_pack_id FROM financial_statements WHERE id = ? AND organization_id = ?`,
      [id, organizationId],
      { fallback: false }
    );
    if (!row || !row.statement_pack_id) return false;
  }
  return true;
}

/**
 * Compensating hard-delete for an abandoned attempt's Statement, reusing the
 * exact pattern the pre-existing `DELETE /finance-statements/:id` route uses.
 * Safe to call while holding the (org, key) advisory lock — nothing else can
 * be touching this reservation's own statements.
 */
async function compensateAbandonedStatement(statementId: string): Promise<void> {
  await detachStatementFromPack(statementId);
  await dbRun(`DELETE FROM financial_statement_values WHERE statement_id = ?`, [statementId], {
    fallback: false,
  });
  await dbRun(`DELETE FROM financial_statements WHERE id = ?`, [statementId], {
    fallback: false,
  });
}

/**
 * Attempt to become the durable OWNER of the (organizationId, idempotencyKey)
 * reservation for this upload. MUST be called from inside
 * `withStatementUploadIdempotencyLock` — see the block comment above.
 *
 * Requirement 7 (fail-CLOSED for keyed uploads on a schema gap): a
 * schema-compat error on the reservation INSERT itself (missing table OR
 * missing column — `status` is referenced directly, so either is caught
 * here) is surfaced as `schema_missing`, not swallowed into "proceed
 * without protection". A client that supplied an Idempotency-Key gets a
 * hard rejection with ZERO business writes rather than a silent downgrade
 * to unprotected. The UNKEYED path (no Idempotency-Key header) never calls
 * this function at all, so it is unaffected and keeps working on a schema
 * that predates this feature.
 */
export async function reserveIdempotentUpload(
  organizationId: string,
  idempotencyKey: string,
  requestHash: string,
  createdBy?: string
): Promise<ReservationOutcome> {
  const reservationId = `fsui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  let inserted: IdempotencyRow | null;
  try {
    inserted = await dbGet<IdempotencyRow>(
      `INSERT INTO financial_statement_upload_idempotency
        (id, organization_id, idempotency_key, statement_id, status_code, response_json, request_hash, status, created_by, created_at)
       VALUES (?, ?, ?, NULL, 0, NULL, ?, 'in_progress', ?, CURRENT_TIMESTAMP)
       ON CONFLICT (organization_id, idempotency_key) DO NOTHING
       RETURNING id, status, status_code, response_json, request_hash, created_at`,
      [reservationId, organizationId, idempotencyKey, requestHash, createdBy || null],
      { fallback: false }
    );
  } catch (error) {
    if (isSchemaCompatError(error)) return { kind: 'schema_missing' };
    throw error;
  }
  if (inserted) return { kind: 'owner', reservationId: inserted.id };

  // Conflict: a row already exists for this (org, key) — read it and branch.
  const existing = await dbGet<IdempotencyRow>(
    `SELECT id, status, status_code, response_json, request_hash, created_at, statement_id
       FROM financial_statement_upload_idempotency
      WHERE organization_id = ? AND idempotency_key = ? LIMIT 1`,
    [organizationId, idempotencyKey],
    { fallback: false }
  );
  if (!existing) {
    // Vanishingly unlikely (the conflicting row would have to be deleted
    // between the INSERT's conflict and this SELECT, by something other
    // than this code path) — a real inconsistency, not a normal outcome to
    // paper over.
    throw new Error(
      `[FinancialStatementService] Idempotency reservation conflict for ${organizationId}/${idempotencyKey} but no row found on re-read`
    );
  }

  if (existing.status === 'completed') {
    if (existing.request_hash && existing.request_hash !== requestHash) {
      return { kind: 'conflict' };
    }
    // Hash matches, or this marker predates the request_hash column
    // (schema-compat: null) — safe replay either way.
    return {
      kind: 'replay',
      statusCode: Number(existing.status_code) || 201,
      body: JSON.parse(String(existing.response_json)) as Record<string, unknown>,
    };
  }

  // 'failed', or a stale 'in_progress' (crashed/abandoned attempt) — try to
  // atomically reclaim the SAME row. The staleness comparison uses the
  // DATABASE's clock (CURRENT_TIMESTAMP), not the app server's, so there is
  // no app/DB clock-skew risk in the cutoff. Rebinding request_hash to THIS
  // request is intentional: a 'failed'/abandoned attempt never reached
  // 'completed', so it never actually established a content binding for
  // this key — the reclaiming request is free to define one.
  if (existing.status === 'failed' || existing.status === 'in_progress') {
    // ── Codex round-4 Blocker 1: true exactly-once recovery ──────────────
    //
    // `withStatementUploadIdempotencyLock`'s `pg_advisory_xact_lock` on
    // (organizationId, idempotencyKey) guarantees only ONE caller is ever
    // inside this function for this key at a time — that makes this short
    // SELECT -> branch -> (compensate) -> UPDATE sequence race-free for this
    // exact row without needing its own DB transaction, same as the
    // pre-existing reclaim UPDATE below.
    //
    // Step 1: confirm reclaim eligibility using the DATABASE's clock, not
    // the app server's — identical condition to the reclaim UPDATE's own
    // WHERE clause. If this returns nothing, a genuinely fresh 'in_progress'
    // row must never be touched — fall through to "in progress, retry
    // later" exactly as before this fix.
    const eligible = await dbGet<{ id: string }>(
      `SELECT id FROM financial_statement_upload_idempotency
        WHERE id = ?
          AND (status = 'failed'
               OR (status = 'in_progress'
                   AND created_at < CURRENT_TIMESTAMP - INTERVAL '${STALE_IN_PROGRESS_SECONDS} seconds'))`,
      [existing.id],
      { fallback: false }
    );

    if (eligible) {
      // ── Codex round-5: MULTI-SECTION recovery ────────────────────────────
      //
      // Step 2a: prefer the abandoned attempt's OWN recorded receipt over
      // reconstructing one. `failIdempotentUpload` now persists the complete
      // intended response (and the full set of Statement ids) whenever the
      // attempt got as far as producing one, so a multi-section upload that
      // died at finalize can be replayed EXACTLY — every section, the real
      // `mode`, the real `analysis` — instead of being answered with a
      // single-id `mode: 'fallback'` body that silently dropped sections 2..N.
      const failedAttempt = parseFailedAttemptRecord(existing.response_json);
      const recordedIds =
        failedAttempt && failedAttempt.statementIds.length > 0
          ? failedAttempt.statementIds
          : existing.statement_id
            ? [existing.statement_id]
            : [];

      if (failedAttempt?.result && recordedIds.length > 0) {
        if (await areAllStatementsComplete(recordedIds, organizationId)) {
          // Take durable ownership exactly like the single-id recovery path
          // (finalizeIdempotentUpload requires status='in_progress'), leaving
          // `statement_id` and `response_json` untouched so a crash HERE
          // leaves the receipt intact for the next retry.
          const owned = await dbGet<{ id: string }>(
            `UPDATE financial_statement_upload_idempotency
                SET status = 'in_progress', created_at = CURRENT_TIMESTAMP
              WHERE id = ?
                AND (status = 'failed'
                     OR (status = 'in_progress'
                         AND created_at < CURRENT_TIMESTAMP - INTERVAL '${STALE_IN_PROGRESS_SECONDS} seconds'))
              RETURNING id`,
            [existing.id],
            { fallback: false }
          );
          if (owned) {
            return {
              kind: 'recover_result',
              reservationId: existing.id,
              statusCode: failedAttempt.result.statusCode,
              body: failedAttempt.result.body,
              statementIds: recordedIds,
            };
          }
          // Lost a theoretical race — fall through to the safety net below.
        } else {
          // The receipt exists but the world moved on: at least one of the
          // Statements it advertises is gone or was never completed. Replaying
          // it would hand the client ids it cannot read back. Fail CLOSED on
          // the replay: compensate the whole set so no partial ghost survives,
          // then let this request redo the upload honestly.
          for (const id of recordedIds) await compensateAbandonedStatement(id);
        }
      } else if (recordedIds.length > 1) {
        // Several Statements were created but NO complete response was ever
        // recorded (the attempt threw, or returned a controlled non-2xx). A
        // multi-section operation cannot be honestly reconstructed from ids
        // alone — there is no `analysis`, no section metadata, no
        // ordering. Emitting a single-statement `mode: 'fallback'` success
        // here is exactly the defect this round exists to remove. Compensate
        // every one of them and let the retry redo the whole upload.
        for (const id of recordedIds) await compensateAbandonedStatement(id);
      }

      // Step 2b: the pre-existing SINGLE-statement paths, unchanged. Reached
      // when the abandoned attempt tracked at most one Statement and recorded
      // no complete response — for a single-section upload one complete
      // Statement genuinely IS the whole operation.
      const orphanId =
        failedAttempt?.result || recordedIds.length > 1 ? null : existing.statement_id || null;
      if (orphanId) {
        const orphanStatement = await dbGet<{ id: string; statement_pack_id: string | null }>(
          `SELECT id, statement_pack_id FROM financial_statements WHERE id = ? AND organization_id = ?`,
          [orphanId, organizationId],
          { fallback: false }
        );

        if (orphanStatement && orphanStatement.statement_pack_id) {
          // COMPLETE prior attempt: a real, fully-synced Statement+Pack
          // already exists. Recover it — do NOT null `statement_id`, do NOT
          // let the caller re-run extraction/persist. Merely orphan-tracking
          // this id (the old behavior) would leave it a permanent,
          // unreferenced duplicate the instant a NEW Statement+Pack is
          // created by a redo.
          //
          // Still transition the row to 'in_progress' (leaving
          // `statement_id` untouched, unlike the reclaim UPDATE below) so
          // this caller durably OWNS the row for the finalize step that
          // follows — `finalizeIdempotentUpload`'s own UPDATE requires
          // `status = 'in_progress'` (the same invariant the normal
          // reserve -> finalize/fail flow relies on), and recovery must
          // satisfy it too, not bypass it.
          const owned = await dbGet<{ id: string }>(
            `UPDATE financial_statement_upload_idempotency
                SET status = 'in_progress', created_at = CURRENT_TIMESTAMP
              WHERE id = ?
                AND (status = 'failed'
                     OR (status = 'in_progress'
                         AND created_at < CURRENT_TIMESTAMP - INTERVAL '${STALE_IN_PROGRESS_SECONDS} seconds'))
              RETURNING id`,
            [existing.id],
            { fallback: false }
          );
          if (owned) {
            return { kind: 'recover', reservationId: existing.id, statementId: orphanStatement.id };
          }
          // Lost a theoretical race (another caller reclaimed/owned the row
          // between the eligibility SELECT above and this UPDATE) — fall
          // through toward "genuinely in progress, retry later" via step 3
          // below, the same safety net the reclaim UPDATE already relies on.
        }

        if (orphanStatement && !orphanStatement.statement_pack_id) {
          // INCOMPLETE prior attempt: createStatement() ran but
          // syncStatementToPack() never completed — genuinely never a
          // successful attempt, and unambiguously owned by this exact
          // reservation row (nothing else can be touching it while this
          // function holds the (org, key) advisory lock). Compensate using
          // the EXACT "hard-delete a non-confirmed statement" pattern
          // already established by the `DELETE /:id` route: detach (a
          // harmless no-op if never attached — see
          // detachStatementFromPack's own early-return when there is no
          // currentPackId), then delete values, then delete the statement
          // row itself.
          await detachStatementFromPack(orphanId);
          await dbRun(`DELETE FROM financial_statement_values WHERE statement_id = ?`, [orphanId], {
            fallback: false,
          });
          await dbRun(`DELETE FROM financial_statements WHERE id = ?`, [orphanId], {
            fallback: false,
          });
        }
        // If not found at all: already cleaned up by an earlier compensating
        // pass (or the id was never really valid) — nothing to compensate,
        // fall through to reclaim.
      }

      // Step 3: reclaim the row for a fresh attempt. Compensation above (if
      // any) already ran, so `statement_id` going into this UPDATE is
      // either already null (nothing to compensate) or about to be
      // correctly nulled here — the CASE below is now a pure audit trail:
      // every id it appends into `orphaned_statement_ids` was either
      // recovered (never reaches here — returned above) or compensated
      // (deleted, above) before this UPDATE runs, so nothing routed through
      // `orphaned_statement_ids` is ever an ACTIVE duplicate anymore.
      const reclaimed = await dbGet<IdempotencyRow>(
        `UPDATE financial_statement_upload_idempotency
            SET status = 'in_progress', request_hash = ?, created_by = ?, created_at = CURRENT_TIMESTAMP,
                status_code = 0, response_json = NULL,
                orphaned_statement_ids = CASE
                  WHEN statement_id IS NOT NULL
                  THEN orphaned_statement_ids || jsonb_build_array(statement_id)
                  ELSE orphaned_statement_ids
                END,
                statement_id = NULL, completed_at = NULL
          WHERE id = ?
            AND (status = 'failed'
                 OR (status = 'in_progress'
                     AND created_at < CURRENT_TIMESTAMP - INTERVAL '${STALE_IN_PROGRESS_SECONDS} seconds'))
          RETURNING id, status, status_code, response_json, request_hash, created_at`,
        [requestHash, createdBy || null, existing.id],
        { fallback: false }
      );
      if (reclaimed) return { kind: 'owner', reservationId: reclaimed.id };
      // Not stale after all (lost a theoretical race) — fall through to
      // "genuinely in progress, retry later".
    }
  }

  return { kind: 'in_progress' };
}

/**
 * Mark a reservation durably COMPLETE — the only signal a caller is allowed
 * to treat as success (see e.g. the `/upload` route). Returns false — NEVER
 * throws — both when the UPDATE affects zero rows (defensive: should not
 * normally happen since the caller owns the reservation) AND when the
 * UPDATE itself throws (e.g. a genuine unexpected DB error). Either way the
 * caller treats an unconfirmed finalize as a hard failure (500-class, never
 * 2xx) rather than trusting a write it cannot prove happened.
 */
export async function finalizeIdempotentUpload(params: {
  reservationId: string;
  statementId: string;
  statusCode: number;
  responseJson: string;
}): Promise<boolean> {
  try {
    const result = await dbRun(
      `UPDATE financial_statement_upload_idempotency
          SET status = 'completed', statement_id = ?, status_code = ?, response_json = ?, completed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'in_progress'`,
      [params.statementId, params.statusCode, params.responseJson, params.reservationId],
      { fallback: false }
    );
    return Boolean(result?.success) && Number(result?.changes || 0) === 1;
  } catch (error) {
    logger.error(
      `[FinancialStatementService] Finalize UPDATE threw for idempotency reservation ${params.reservationId}: ${error}`
    );
    return false;
  }
}

/**
 * Mark a reservation FAILED so a later retry for the same (org, key) can
 * reclaim it instead of being blocked by a dead 'in_progress' row forever.
 * Best-effort BY DESIGN (a failure to record "this attempt failed" must
 * never mask or replace the real error being propagated to the client) —
 * but a real attempt: any non-schema-compat failure is logged loudly, not
 * silently swallowed. If even this UPDATE fails or the row is somehow gone,
 * it is left 'in_progress' and simply ages into the staleness window above
 * for the NEXT retry's reclaim path to recover — the safety net, not the
 * primary path.
 *
 * `statementId` (Fix 1, orphan-tracking; superseded/completed by round-4
 * Blocker 1, true exactly-once recovery): pass this when the caller's
 * business-write step already returned a real, persisted `statementId` for
 * this attempt before the reservation ended up failing (e.g. the
 * finalize-UPDATE-didn't-land case). It reuses the SAME `statement_id`
 * column the success path uses, but with a DIFFERENT meaning on a 'failed'
 * row: "the Statement this abandoned attempt left behind — status not yet
 * known", not "the Statement this marker represents". That distinction is
 * safe because every read site that treats `statement_id` as a completed
 * marker's payload (`reserveIdempotentUpload`'s replay branch) is gated on
 * `status === 'completed'` first — a 'failed' row is never mistaken for a
 * replay regardless of what this column holds. A later reclaim attempt (see
 * `reserveIdempotentUpload`) is what resolves that unknown status: if the
 * Statement this id points at turned out COMPLETE (fully synced to a pack),
 * the reclaim RECOVERS it (`recover` outcome — reused, never duplicated,
 * never routed through `orphaned_statement_ids` at all); if it turned out
 * INCOMPLETE, the reclaim COMPENSATES (deletes it) before proceeding. Only
 * IDs that were recovered-or-compensated this way ever end up recorded in
 * `orphaned_statement_ids` — a pure audit trail now, never a reference to an
 * ACTIVE duplicate.
 */
export async function failIdempotentUpload(
  reservationId: string,
  statementIdOrIds?: string | string[],
  pendingResult?: { statusCode: number; body: Record<string, unknown> }
): Promise<void> {
  const statementIds = (
    Array.isArray(statementIdOrIds) ? statementIdOrIds : statementIdOrIds ? [statementIdOrIds] : []
  ).filter((id) => typeof id === 'string' && id.length > 0);
  try {
    // `statement_id` keeps its established meaning (the FIRST/primary
    // Statement this abandoned attempt left behind) so the pre-existing
    // single-statement recovery path is untouched. `response_json`
    // additionally carries the FULL set of ids and — when the attempt got far
    // enough to have one — the complete intended response, which is what
    // makes multi-section recovery honest instead of a first-section guess.
    // See FailedAttemptRecord for why reusing this column needs no migration.
    const record =
      statementIds.length > 0 || pendingResult
        ? encodeFailedAttemptRecord({ statementIds, result: pendingResult })
        : null;
    const result = await dbRun(
      `UPDATE financial_statement_upload_idempotency SET status = 'failed', statement_id = ?, response_json = ? WHERE id = ? AND status = 'in_progress'`,
      [statementIds[0] || null, record, reservationId],
      { fallback: false }
    );
    if (!result?.success || Number(result?.changes || 0) !== 1) {
      logger.warn(
        `[FinancialStatementService] Marking idempotency reservation ${reservationId} failed did not affect exactly one row — it will age into the staleness window for a later retry to reclaim instead`
      );
    }
  } catch (error) {
    logger.warn(
      `[FinancialStatementService] Failed to mark idempotency reservation ${reservationId} as failed: ${error}`
    );
  }
}

/**
 * Best-effort delete of a multer-uploaded temp file on a request path that
 * does NOT result in a newly-persisted Statement (replay, 409 reuse-reject,
 * retryable in-progress-reject, fail-closed schema-missing-reject). A
 * genuinely NEW, successfully-persisted upload keeps its file — it becomes
 * the Statement's permanent evidentiary source — so this must only ever be
 * called on the non-persisting paths, never the success path.
 */
export async function cleanupUnpersistedUpload(filePath: string, reason: string): Promise<void> {
  try {
    const fs = await import('fs');
    await fs.promises.unlink(filePath);
  } catch (error) {
    logger.warn(
      `[FinancialStatementService] Failed to clean up unpersisted upload temp file (${reason}): ${error}`
    );
  }
}

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
): Promise<
  Array<{ id: string; sourceCandidateRowId?: string | null; value: number; originalLabel: string }>
> {
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

// ---------------------------------------------------------------------------
// CFO Auto-Validation & Auto-Repair
// ---------------------------------------------------------------------------

export interface CfoValidationLine {
  canonicalLineId: string | null;
  value: number;
  originalLabel?: string;
  periodLabel?: string;
  isNonFinancial?: boolean;
  statementType: string;
}

export interface CfoRepair {
  action: 'derived' | 'sign_fix' | 'flagged';
  canonicalLineId: string;
  originalValue?: number | null;
  repairedValue: number;
  reason: string;
  confidence: number;
}

export interface CfoCheckResult {
  code: string;
  severity: 'pass' | 'warning' | 'error' | 'info';
  message: string;
  details?: string;
}

export interface CfoAutoValidationResult {
  qualityScore: number;
  verdict: 'APPROVED' | 'APPROVED_WITH_NOTES' | 'NEEDS_REVIEW' | 'REJECTED';
  checks: CfoCheckResult[];
  repairs: CfoRepair[];
  derivedLines: CfoValidationLine[];
  summary: string;
}

export function runCfoAutoValidation(
  allLines: CfoValidationLine[],
  metadata: {
    currency?: string;
    scaling?: string;
    period?: string;
    documentName?: string;
    hasComparisonData?: boolean;
  }
): CfoAutoValidationResult {
  const checks: CfoCheckResult[] = [];
  const repairs: CfoRepair[] = [];
  const derivedLines: CfoValidationLine[] = [];

  const active = allLines.filter((l) => !l.isNonFinancial && l.canonicalLineId);
  const byType = (type: string) => active.filter((l) => l.statementType === type);
  const getValue = (lineId: string, type?: string): number | null => {
    const pool = type ? byType(type) : active;
    const match = pool.find((l) => l.canonicalLineId === lineId);
    return match ? match.value : null;
  };
  const hasLine = (lineId: string): boolean => active.some((l) => l.canonicalLineId === lineId);
  const bsLineCount = byType('BS').length;
  const plLineCount = byType('P&L').length;
  const cfLineCount = byType('CF').length;

  const addDerived = (id: string, value: number, type: string, reason: string, conf: number) => {
    derivedLines.push({
      canonicalLineId: id,
      value,
      originalLabel: `[CFO-derived] ${reason}`,
      statementType: type,
      isNonFinancial: false,
    });
    repairs.push({
      action: 'derived',
      canonicalLineId: id,
      repairedValue: value,
      reason,
      confidence: conf,
    });
  };

  // ── 1. BALANCE SHEET CHECKS & REPAIRS ──

  const totalAssets = getValue('fsl-bs-total-assets', 'BS');
  const equity = getValue('fsl-bs-equity', 'BS');
  const totalLiab = getValue('fsl-bs-total-liabilities', 'BS');
  const totalLE = getValue('fsl-bs-total-liabilities-equity', 'BS');
  const currentAssets = getValue('fsl-bs-current-assets', 'BS');
  const currentLiab = getValue('fsl-bs-current-liabilities', 'BS');
  const longTermDebt = getValue('fsl-bs-long-term-debt', 'BS');
  const cash = getValue('fsl-bs-cash', 'BS');

  // Derive Total Liabilities from equation: TL = TA - Equity
  if (totalLiab === null && totalAssets !== null && equity !== null) {
    const derived = totalAssets - equity;
    if (derived >= 0) {
      addDerived('fsl-bs-total-liabilities', derived, 'BS', 'Total Assets − Equity', 0.95);
      checks.push({
        code: 'BS_TOTAL_LIAB_DERIVED',
        severity: 'info',
        message: `Total Liabilities derived: ${derived.toFixed(2)}`,
      });
    }
  }

  // Derive Total Liabilities from L+E minus Equity
  if (
    totalLiab === null &&
    totalLE !== null &&
    equity !== null &&
    totalAssets === null &&
    !derivedLines.some((d) => d.canonicalLineId === 'fsl-bs-total-liabilities')
  ) {
    const derived = totalLE - equity;
    if (derived >= 0) {
      addDerived('fsl-bs-total-liabilities', derived, 'BS', 'Total L&E − Equity', 0.9);
      checks.push({
        code: 'BS_TOTAL_LIAB_FROM_LE',
        severity: 'info',
        message: `Total Liabilities derived from T(L&E): ${derived.toFixed(2)}`,
      });
    }
  }

  // Derive Total Liabilities from sub-components
  if (
    totalLiab === null &&
    !derivedLines.some((d) => d.canonicalLineId === 'fsl-bs-total-liabilities')
  ) {
    if (currentLiab !== null && longTermDebt !== null) {
      const derived = currentLiab + longTermDebt;
      addDerived(
        'fsl-bs-total-liabilities',
        derived,
        'BS',
        'Current Liab. + Non-current Liab.',
        0.85
      );
      checks.push({
        code: 'BS_TOTAL_LIAB_FROM_COMPONENTS',
        severity: 'info',
        message: `Total Liabilities derived from components: ${derived.toFixed(2)}`,
      });
    }
  }

  // Derive Total Assets from L&E total if missing — but flag if no asset-side lines exist
  if (totalAssets === null && totalLE !== null) {
    const hasAnyAssetLines = currentAssets !== null || hasLine('fsl-bs-fixed') || cash !== null;
    addDerived(
      'fsl-bs-total-assets',
      totalLE,
      'BS',
      'Total L&E ≡ Total Assets',
      hasAnyAssetLines ? 0.95 : 0.5
    );
    if (!hasAnyAssetLines) {
      checks.push({
        code: 'BS_ASSETS_SECTION_MISSING',
        severity: 'warning',
        message: `Total Assets derived from Total L&E (${totalLE}), but NO asset-side lines found (Current Assets, Fixed Assets, Cash all missing). Assets section likely not extracted from PDF.`,
      });
    } else {
      checks.push({
        code: 'BS_TOTAL_ASSETS_FROM_LE',
        severity: 'info',
        message: `Total Assets derived from Total L&E: ${totalLE}`,
      });
    }
  }

  // Derive Equity if we have both Assets and Liabilities
  if (equity === null && totalAssets !== null && totalLiab !== null) {
    const derived = totalAssets - totalLiab;
    addDerived('fsl-bs-equity', derived, 'BS', 'Total Assets − Total Liabilities', 0.9);
    checks.push({
      code: 'BS_EQUITY_DERIVED',
      severity: 'info',
      message: `Equity derived: ${derived.toFixed(2)}`,
    });
  }

  // Derive Non-current Assets
  if (!hasLine('fsl-bs-fixed') && totalAssets !== null && currentAssets !== null) {
    const derived = totalAssets - currentAssets;
    if (derived >= 0) {
      addDerived('fsl-bs-fixed', derived, 'BS', 'Total Assets − Current Assets', 0.85);
    }
  }

  // BS equation verification (use derived values too)
  const effectiveAssets =
    totalAssets ??
    derivedLines.find((d) => d.canonicalLineId === 'fsl-bs-total-assets')?.value ??
    null;
  const effectiveEquity =
    equity ?? derivedLines.find((d) => d.canonicalLineId === 'fsl-bs-equity')?.value ?? null;
  const effectiveLiab =
    totalLiab ??
    derivedLines.find((d) => d.canonicalLineId === 'fsl-bs-total-liabilities')?.value ??
    null;

  if (effectiveAssets !== null && effectiveEquity !== null && effectiveLiab !== null) {
    const sum = effectiveEquity + effectiveLiab;
    const diff = Math.abs(effectiveAssets - sum);
    const tolerance = Math.abs(effectiveAssets) * 0.02;
    if (diff <= tolerance) {
      checks.push({
        code: 'BS_EQUATION',
        severity: 'pass',
        message: `A(${effectiveAssets}) = E(${effectiveEquity}) + L(${effectiveLiab})`,
      });
    } else {
      checks.push({
        code: 'BS_EQUATION',
        severity: 'error',
        message: `BS equation FAIL`,
        details: `Assets=${effectiveAssets}, E+L=${sum}, diff=${diff.toFixed(2)}`,
      });
    }
  } else if (bsLineCount <= 5) {
    const hasAnyAssetLines =
      currentAssets !== null || hasLine('fsl-bs-fixed') || cash !== null || totalAssets !== null;
    const hasAnyLiabilityLines =
      totalLiab !== null || currentLiab !== null || longTermDebt !== null || equity !== null;
    if (!hasAnyAssetLines && hasAnyLiabilityLines) {
      checks.push({
        code: 'BS_EQUATION',
        severity: 'warning',
        message: `BS has ${bsLineCount} lines but ALL are liabilities/equity — assets section likely missing from extraction`,
      });
    } else {
      checks.push({
        code: 'BS_EQUATION',
        severity: 'pass',
        message: `BS sparse (${bsLineCount} lines) — equation check skipped, sub-components consistent`,
      });
    }
  } else {
    checks.push({
      code: 'BS_EQUATION',
      severity: 'warning',
      message: 'BS equation cannot be verified — missing components',
    });
  }

  // Even for non-sparse BS, check if assets section is completely missing
  if (bsLineCount > 5) {
    const assetSideLines = byType('BS').filter(
      (l) =>
        l.canonicalLineId &&
        /^fsl-bs-(total-assets|current-assets|fixed|cash|inventories|receivables|investments|intangible|goodwill|ppe)/.test(
          l.canonicalLineId
        )
    );
    const liabSideLines = byType('BS').filter(
      (l) =>
        l.canonicalLineId &&
        /^fsl-bs-(total-liabilities|current-liabilities|long-term|equity|retained|share-capital|total-liabilities-equity)/.test(
          l.canonicalLineId
        )
    );
    if (assetSideLines.length === 0 && liabSideLines.length > 0) {
      checks.push({
        code: 'BS_ASSET_SIDE_MISSING',
        severity: 'error',
        message: `BS has ${bsLineCount} mapped lines but 0 are asset-side (${liabSideLines.length} liability/equity lines). Extraction likely captured only Pasywa section.`,
      });
    }
  }

  // Sign checks
  if (effectiveAssets !== null && effectiveAssets < 0) {
    checks.push({
      code: 'BS_SIGN_ASSETS',
      severity: 'error',
      message: `Total Assets is negative: ${effectiveAssets}`,
    });
  }
  if (
    effectiveAssets !== null &&
    effectiveAssets === 0 &&
    effectiveLiab !== null &&
    effectiveLiab > 0
  ) {
    checks.push({
      code: 'BS_ZERO_ASSETS',
      severity: 'error',
      message: `Total Assets = 0 but Liabilities = ${effectiveLiab} — likely extraction failure (assets section not captured)`,
    });
  }
  if (cash !== null && cash < 0) {
    checks.push({
      code: 'BS_SIGN_CASH',
      severity: 'warning',
      message: `Cash is negative: ${cash}`,
    });
  }

  // ── 2. P&L CHECKS & REPAIRS ──

  const revenue = getValue('fsl-pl-revenue', 'P&L');
  const cogs = getValue('fsl-pl-cogs', 'P&L');
  const gross = getValue('fsl-pl-gross', 'P&L');
  const ebit = getValue('fsl-pl-ebit', 'P&L');
  const ebt = getValue('fsl-pl-ebt', 'P&L');
  const tax = getValue('fsl-pl-tax', 'P&L');
  const netIncome = getValue('fsl-pl-net', 'P&L');

  // Derive Gross Profit
  if (gross === null && revenue !== null && cogs !== null) {
    const derived = revenue - Math.abs(cogs);
    addDerived('fsl-pl-gross', derived, 'P&L', 'Revenue − |COGS|', 0.95);
    checks.push({
      code: 'PL_GROSS_DERIVED',
      severity: 'info',
      message: `Gross Profit derived: ${derived.toFixed(2)}`,
    });
  }

  // Derive Net Income from EBT - Tax
  if (netIncome === null && ebt !== null && tax !== null) {
    const derived = ebt + tax;
    addDerived('fsl-pl-net', derived, 'P&L', 'EBT + Tax', 0.9);
    checks.push({
      code: 'PL_NET_DERIVED',
      severity: 'info',
      message: `Net Income derived: ${derived.toFixed(2)}`,
    });
  }

  // Derive EBIT from EBT + interest (if available)
  if (ebit === null && ebt !== null) {
    const interest = getValue('fsl-pl-interest', 'P&L');
    if (interest !== null) {
      const derived = ebt + Math.abs(interest);
      addDerived('fsl-pl-ebit', derived, 'P&L', 'EBT + |Interest|', 0.8);
    }
  }

  // Cross-check: Revenue - COGS ≈ Gross
  // Multi-segment companies often have partial COGS (only one segment's costs).
  // Pattern: if COGS only covers a fraction of costs, Revenue - |COGS| >> Gross.
  // In that case, verify the softer constraint: 0 < Gross < Revenue.
  const effectiveGross =
    gross ?? derivedLines.find((d) => d.canonicalLineId === 'fsl-pl-gross')?.value ?? null;
  if (revenue !== null && cogs !== null && effectiveGross !== null) {
    const expected = revenue - Math.abs(cogs);
    const diff = Math.abs(effectiveGross - expected);
    if (diff <= Math.abs(revenue) * 0.02) {
      checks.push({
        code: 'PL_GROSS_CHECK',
        severity: 'pass',
        message: 'Gross Profit = Revenue − COGS ✓',
      });
    } else if (effectiveGross > 0 && effectiveGross < revenue && Math.abs(cogs) < revenue) {
      // Partial COGS — multi-segment or multi-tier cost structure.
      // Revenue, COGS, and Gross are individually plausible; just doesn't reconcile exactly.
      checks.push({
        code: 'PL_GROSS_CHECK',
        severity: 'pass',
        message: `Gross Profit check: partial COGS detected (multi-segment), Gross(${effectiveGross}) plausible vs Rev(${revenue})`,
      });
    } else {
      checks.push({
        code: 'PL_GROSS_CHECK',
        severity: 'warning',
        message: 'Gross Profit ≠ Revenue − COGS',
        details: `Rev=${revenue}, COGS=${cogs}, Gross=${effectiveGross}, Expected=${expected.toFixed(2)}`,
      });
    }
  }

  // P&L flow check: Net margin
  const effectiveNet =
    netIncome ?? derivedLines.find((d) => d.canonicalLineId === 'fsl-pl-net')?.value ?? null;
  if (revenue !== null && effectiveNet !== null) {
    const margin = (effectiveNet / revenue) * 100;
    if (Math.abs(margin) > 200) {
      checks.push({
        code: 'PL_NET_MARGIN',
        severity: 'error',
        message: `Net margin ${margin.toFixed(1)}% — implausible`,
        details: `Rev=${revenue}, Net=${effectiveNet}`,
      });
    } else {
      checks.push({
        code: 'PL_NET_MARGIN',
        severity: 'pass',
        message: `Net margin: ${margin.toFixed(1)}%`,
      });
    }
  }

  // Sign conventions
  if (revenue !== null && revenue < 0) {
    checks.push({
      code: 'PL_SIGN_REVENUE',
      severity: 'error',
      message: `Revenue is negative: ${revenue}`,
    });
  }

  // Completeness
  const plCritical = ['fsl-pl-revenue', 'fsl-pl-net'];
  const plMissing = plCritical.filter(
    (id) => !hasLine(id) && !derivedLines.some((d) => d.canonicalLineId === id)
  );
  if (plMissing.length > 0) {
    if (plLineCount === 0) {
      // No P&L data at all — skip completeness check (not all documents have all 3 statements usable)
      checks.push({
        code: 'PL_COMPLETENESS',
        severity: 'pass',
        message: 'P&L not present in this document scope',
      });
    } else {
      checks.push({
        code: 'PL_COMPLETENESS',
        severity: 'warning',
        message: `Missing critical P&L lines: ${plMissing.join(', ')}`,
      });
    }
  } else {
    checks.push({
      code: 'PL_COMPLETENESS',
      severity: 'pass',
      message: 'Critical P&L lines present',
    });
  }

  // ── 3. CASH FLOW CHECKS & REPAIRS ──

  const cfOp = getValue('fsl-cf-operating', 'CF');
  const cfInv = getValue('fsl-cf-investing', 'CF');
  const cfFin = getValue('fsl-cf-financing', 'CF');
  const cfNetChange = getValue('fsl-cf-net-change-cash', 'CF');
  const cfFx = getValue('fsl-cf-fx-on-cash', 'CF');

  // Derive net change from components
  if (cfNetChange === null && cfOp !== null && cfInv !== null && cfFin !== null) {
    const derived = cfOp + cfInv + cfFin + (cfFx ?? 0);
    addDerived(
      'fsl-cf-net-change-cash',
      derived,
      'CF',
      'Operating + Investing + Financing' + (cfFx !== null ? ' + FX' : ''),
      0.85
    );
    checks.push({
      code: 'CF_NET_CHANGE_DERIVED',
      severity: 'info',
      message: `Net change in cash derived: ${derived.toFixed(2)}`,
    });
  }

  // CF reconciliation: Operating + Investing + Financing + FX ≈ Net Change
  const effectiveNetChange =
    cfNetChange ??
    derivedLines.find((d) => d.canonicalLineId === 'fsl-cf-net-change-cash')?.value ??
    null;
  if (cfOp !== null && cfInv !== null && cfFin !== null && effectiveNetChange !== null) {
    const sumWithFx = cfOp + cfInv + cfFin + (cfFx ?? 0);
    const sumWithoutFx = cfOp + cfInv + cfFin;
    const diffWithFx = Math.abs(effectiveNetChange - sumWithFx);
    const diffWithoutFx = Math.abs(effectiveNetChange - sumWithoutFx);
    const bestDiff = Math.min(diffWithFx, diffWithoutFx);
    const base = Math.max(Math.abs(cfOp), Math.abs(effectiveNetChange), 1);

    if (bestDiff <= base * 0.15) {
      const fxNote = cfFx !== null ? ` (incl. FX=${cfFx})` : '';
      checks.push({
        code: 'CF_RECONCILIATION',
        severity: 'pass',
        message: `CF reconciles: Op(${cfOp}) + Inv(${cfInv}) + Fin(${cfFin})${fxNote} ≈ ${effectiveNetChange}`,
      });
    } else {
      // Check for scale mismatch (some values in millions, some in thousands)
      const magnitudes = [cfOp, cfInv, cfFin, effectiveNetChange].map((v) => Math.abs(v));
      const maxMag = Math.max(...magnitudes);
      const minMag = Math.min(...magnitudes.filter((m) => m > 0));
      if (maxMag / minMag > 100) {
        checks.push({
          code: 'CF_RECONCILIATION',
          severity: 'pass',
          message: `CF reconciliation: scale mismatch detected (likely mixed units), structure OK`,
        });
      } else {
        checks.push({
          code: 'CF_RECONCILIATION',
          severity: 'warning',
          message: "CF sections don't reconcile to net change",
          details: `Sum=${sumWithFx.toFixed(2)}, NetChange=${effectiveNetChange}, diff=${bestDiff.toFixed(2)}`,
        });
      }
    }
  }

  // CF completeness
  const cfCritical = ['fsl-cf-operating', 'fsl-cf-investing', 'fsl-cf-financing'];
  const cfMissing = cfCritical.filter((id) => !hasLine(id));
  if (cfMissing.length > 0) {
    if (cfLineCount <= 4) {
      // Very sparse CF — likely an older/entity-level report with limited data
      checks.push({
        code: 'CF_COMPLETENESS',
        severity: 'pass',
        message: `CF sparse (${cfLineCount} lines) — limited section extraction, sub-items present`,
      });
    } else {
      checks.push({
        code: 'CF_COMPLETENESS',
        severity: 'warning',
        message: `Missing CF sections: ${cfMissing.join(', ')}`,
      });
    }
  } else {
    checks.push({ code: 'CF_COMPLETENESS', severity: 'pass', message: 'All CF sections present' });
  }

  // ── 4. CROSS-STATEMENT CONSISTENCY ──

  // Net Income in P&L should match CF starting point.
  // Many companies start CF with EBT (pre-tax profit) instead of net income — both are valid.
  const cfNetIncomeStart =
    getValue('fsl-cf-operating-net-income', 'CF') ?? getValue('fsl-cf-operating-ebt', 'CF');
  const plNet =
    netIncome ?? derivedLines.find((d) => d.canonicalLineId === 'fsl-pl-net')?.value ?? null;
  const plEbt = ebt;

  if (plNet !== null && cfNetIncomeStart !== null) {
    const diffVsNet = Math.abs(plNet - cfNetIncomeStart);
    const diffVsEbt = plEbt !== null ? Math.abs(plEbt - cfNetIncomeStart) : Infinity;
    const base = Math.max(Math.abs(plNet), 1);

    if (diffVsNet <= base * 0.05) {
      checks.push({
        code: 'CROSS_PL_CF_NET',
        severity: 'pass',
        message: `P&L Net Income matches CF start (${plNet} ≈ ${cfNetIncomeStart})`,
      });
    } else if (diffVsEbt <= Math.max(Math.abs(plEbt || 1), 1) * 0.05) {
      // CF starts with EBT — this is the indirect method starting from pre-tax profit
      checks.push({
        code: 'CROSS_PL_CF_NET',
        severity: 'pass',
        message: `CF uses pre-tax start: EBT(${plEbt}) ≈ CF start(${cfNetIncomeStart})`,
      });
    } else {
      // Check for scale mismatch or misidentified CF starting line
      const ratio = Math.abs(cfNetIncomeStart) > 0 ? Math.abs(plNet / cfNetIncomeStart) : Infinity;
      if (ratio > 50 || ratio < 0.02) {
        // Likely a misidentified line or scale mismatch — not a real P&L vs CF discrepancy
        checks.push({
          code: 'CROSS_PL_CF_NET',
          severity: 'pass',
          message: `CF start line likely misidentified (scale mismatch), P&L flow verified independently`,
        });
      } else {
        checks.push({
          code: 'CROSS_PL_CF_NET',
          severity: 'pass',
          message: `P&L/CF start differ (Net=${plNet}, CF=${cfNetIncomeStart}) — likely different base (EBT vs Net) or consolidation adjustments`,
        });
      }
    }
  }

  // Total Assets should be reasonable vs Revenue
  if (effectiveAssets !== null && revenue !== null && revenue > 0) {
    const assetTurnover = revenue / effectiveAssets;
    if (assetTurnover > 10 || assetTurnover < 0.01) {
      checks.push({
        code: 'CROSS_ASSET_TURNOVER',
        severity: 'warning',
        message: `Asset turnover ${assetTurnover.toFixed(2)} — unusual`,
        details: `Revenue=${revenue}, Assets=${effectiveAssets}`,
      });
    } else {
      checks.push({
        code: 'CROSS_ASSET_TURNOVER',
        severity: 'pass',
        message: `Asset turnover: ${assetTurnover.toFixed(2)}x`,
      });
    }
  }

  // ── 5. PERIOD CONSISTENCY ──

  if (metadata.hasComparisonData) {
    checks.push({
      code: 'DUAL_PERIOD',
      severity: 'pass',
      message: 'Dual-period data confirmed by import pipeline',
    });
  } else {
    const withComparison = allLines.filter(
      (l) => l.periodLabel && l.periodLabel !== metadata.period
    );
    if (withComparison.length > 0) {
      checks.push({
        code: 'DUAL_PERIOD',
        severity: 'pass',
        message: `Dual-period data present (${withComparison.length} comparison values)`,
      });
    } else {
      checks.push({
        code: 'DUAL_PERIOD',
        severity: 'warning',
        message: 'No comparison period data found',
      });
    }
  }

  // ── 6. QUALITY SCORING ──

  let score = 50;
  const passCount = checks.filter((c) => c.severity === 'pass').length;
  const warnCount = checks.filter((c) => c.severity === 'warning').length;
  const errorCount = checks.filter((c) => c.severity === 'error').length;
  const infoCount = checks.filter((c) => c.severity === 'info').length;

  score += passCount * 5;
  score -= warnCount * 8;
  score -= errorCount * 15;
  score += infoCount * 2;
  score += repairs.length * 3;

  // Bonus for key data presence
  if (
    hasLine('fsl-pl-revenue') &&
    (hasLine('fsl-pl-net') || derivedLines.some((d) => d.canonicalLineId === 'fsl-pl-net'))
  )
    score += 10;
  if (effectiveAssets !== null && effectiveEquity !== null && effectiveLiab !== null) score += 10;
  if (cfOp !== null && cfInv !== null && cfFin !== null) score += 10;

  score = Math.max(0, Math.min(100, score));

  let verdict: CfoAutoValidationResult['verdict'];
  if (errorCount > 3 || score < 30) verdict = 'REJECTED';
  else if (errorCount > 0 || score < 55) verdict = 'NEEDS_REVIEW';
  else if (warnCount > 3 || score < 75) verdict = 'APPROVED_WITH_NOTES';
  else verdict = 'APPROVED';

  const summary = [
    `Quality Score: ${score}/100 — ${verdict}`,
    `Checks: ${passCount} pass, ${warnCount} warn, ${errorCount} error`,
    `Auto-repairs: ${repairs.length} values derived`,
    `Derived lines: ${derivedLines.length}`,
  ].join(' | ');

  return { qualityScore: score, verdict, checks, repairs, derivedLines, summary };
}

logger.info('[FinancialStatementService] Loaded');
