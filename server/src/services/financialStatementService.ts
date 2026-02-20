/**
 * T050 — Financial Statement Ingestion & Standardization Service
 *
 * Handles: PDF text extraction → auto-detection (BS/P&L/CF, period, currency, scale)
 *        → line extraction with confidence → mapping to canonical lines → validation.
 */

import { v4 as uuidv4 } from 'uuid';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
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
  suggestedCanonicalId?: string;
  suggestedCanonicalLabel?: string;
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

interface CanonicalLine {
  id: string;
  statement_type: string;
  line_code: string;
  line_name: string;
  line_name_pl: string;
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

  return { statementType, confidence: Math.round(confidence * 100) / 100, periodStart, periodEnd, periodLabel, currency, scaling, language };
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

function detectPeriod(text: string): { periodStart: string | null; periodEnd: string | null; periodLabel: string | null } {
  // Try "for the year ended YYYY-MM-DD" / "za rok obrotowy YYYY"
  const yearMatch = text.match(/(?:for the (?:year|period) ended|za rok(?: obrotowy)?)\s+(\d{4}(?:[.\-/]\d{1,2}[.\-/]\d{1,2})?)/i);
  if (yearMatch) {
    const raw = yearMatch[1];
    if (raw.length === 4) {
      return { periodStart: `${raw}-01-01`, periodEnd: `${raw}-12-31`, periodLabel: raw };
    }
  }

  // Try standalone 4-digit year near header
  const headerLines = text.substring(0, 2000);
  const years = [...headerLines.matchAll(/\b(20[1-3]\d)\b/g)].map(m => parseInt(m[1]));
  if (years.length >= 1) {
    const latest = Math.max(...years);
    return { periodStart: `${latest}-01-01`, periodEnd: `${latest}-12-31`, periodLabel: String(latest) };
  }

  return { periodStart: null, periodEnd: null, periodLabel: null };
}

function detectLanguage(text: string): DetectionResult['language'] {
  const plMarkers = ['przychody', 'zysk', 'zobowiązania', 'aktywa', 'bilans', 'kapitał', 'amortyzacja'];
  const enMarkers = ['revenue', 'profit', 'liabilities', 'assets', 'balance', 'equity', 'depreciation'];
  const deMarkers = ['umsatz', 'gewinn', 'verbindlichkeiten', 'vermögen', 'bilanz', 'eigenkapital'];
  const countHits = (markers: string[]) => markers.filter(m => text.includes(m)).length;
  const pl = countHits(plMarkers);
  const en = countHits(enMarkers);
  const de = countHits(deMarkers);
  if (pl >= en && pl >= de && pl > 0) return 'pl';
  if (en >= pl && en >= de && en > 0) return 'en';
  if (de > 0) return 'de';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Line extraction from text
// ---------------------------------------------------------------------------

export function extractFinancialLines(text: string, detectedType: string): ExtractionResult {
  const lines: ExtractedLine[] = [];
  const warnings: string[] = [];
  const rawLines = text.split(/\r?\n/);
  let rawTableCount = 0;

  // Number normalization: handle (negative), spaces in thousands, comma vs dot
  const normalizeNumber = (raw: string): number | null => {
    let s = raw.trim();
    const isNeg = s.startsWith('(') && s.endsWith(')');
    if (isNeg) s = s.slice(1, -1);
    if (s.startsWith('-')) { s = s.slice(1); }

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
    return (isNeg || raw.trim().startsWith('-')) ? -num : num;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    // Pattern: "Label ... number" or "Label: number" with possible multi-column
    const match = line.match(/^(.{3,80}?)\s{2,}([\d\s().,\-]+)$/);
    if (!match) continue;

    const label = match[1].trim();
    const numbersPart = match[2].trim();

    // Split multi-column numbers (take last column = most recent period)
    const numTokens = numbersPart.split(/\s{2,}/).filter(Boolean);
    const rawValue = numTokens[numTokens.length - 1];
    const value = normalizeNumber(rawValue);
    if (value === null) continue;

    rawTableCount++;
    lines.push({
      originalLabel: label,
      value,
      confidence: 0.6,
      sourceRow: i + 1,
    });
  }

  if (lines.length === 0) {
    warnings.push('No structured financial lines detected. The PDF may require OCR or manual entry.');
  }

  return { lines, rawTableCount, warnings };
}

// ---------------------------------------------------------------------------
// Auto-mapping to canonical lines
// ---------------------------------------------------------------------------

const CANONICAL_MAPPING_HINTS: Record<string, string[]> = {
  'fsl-pl-revenue': ['revenue', 'przychody', 'przychody ze sprzedaży', 'net revenue', 'sales', 'sprzedaż', 'total revenue'],
  'fsl-pl-cogs': ['cost of goods', 'cogs', 'koszt sprzedanych', 'koszt własny', 'cost of sales'],
  'fsl-pl-gross': ['gross profit', 'gross margin', 'zysk brutto', 'marża brutto'],
  'fsl-pl-opex': ['operating expenses', 'sg&a', 'koszty operacyjne', 'koszty ogólne', 'opex', 'selling general'],
  'fsl-pl-ebitda': ['ebitda'],
  'fsl-pl-ebit': ['ebit', 'operating profit', 'operating income', 'zysk operacyjny', 'zysk z działalności operacyjnej'],
  'fsl-pl-net': ['net income', 'net profit', 'zysk netto', 'zysk/strata netto', 'net earnings'],
  'fsl-pl-interest': ['interest expense', 'koszty odsetkowe', 'koszty finansowe', 'finance costs'],
  'fsl-pl-depreciation': ['depreciation', 'amortization', 'amortyzacja', 'd&a', 'depreciation and amortization'],
  'fsl-pl-tax': ['income tax', 'tax expense', 'podatek dochodowy', 'podatek'],
  'fsl-bs-total-assets': ['total assets', 'aktywa ogółem', 'aktywa razem'],
  'fsl-bs-current-assets': ['current assets', 'aktywa obrotowe', 'aktywa bieżące'],
  'fsl-bs-cash': ['cash', 'cash and cash equivalents', 'środki pieniężne', 'gotówka'],
  'fsl-bs-inventory': ['inventory', 'inventories', 'zapasy'],
  'fsl-bs-ar': ['accounts receivable', 'receivables', 'należności', 'trade receivables'],
  'fsl-bs-ap': ['accounts payable', 'payables', 'zobowiązania handlowe', 'trade payables'],
  'fsl-bs-wc': ['working capital', 'kapitał obrotowy'],
  'fsl-bs-fixed': ['fixed assets', 'property plant', 'aktywa trwałe', 'ppe', 'non-current assets'],
  'fsl-bs-total-liabilities': ['total liabilities', 'zobowiązania ogółem', 'zobowiązania razem'],
  'fsl-bs-current-liabilities': ['current liabilities', 'zobowiązania krótkoterminowe', 'zobowiązania bieżące'],
  'fsl-bs-long-term-debt': ['long-term debt', 'long term liabilities', 'zobowiązania długoterminowe', 'non-current liabilities'],
  'fsl-bs-equity': ['equity', 'shareholders equity', 'kapitał własny', 'total equity'],
  'fsl-cf-operating': ['operating cash flow', 'cash from operations', 'przepływy operacyjne', 'cfo'],
  'fsl-cf-capex': ['capital expenditures', 'capex', 'nakłady inwestycyjne', 'purchases of property'],
  'fsl-cf-fcf': ['free cash flow', 'fcf', 'wolne przepływy'],
  'fsl-cf-financing': ['financing cash flow', 'cash from financing', 'przepływy z finansowania'],
  'fsl-cf-investing': ['investing cash flow', 'cash from investing', 'przepływy z inwestycji'],
};

export async function autoMapLines(
  extractedLines: ExtractedLine[],
  statementType: string
): Promise<ExtractedLine[]> {
  const canonicalLines: CanonicalLine[] = (await dbAll(
    `SELECT id, statement_type, line_code, line_name, line_name_pl FROM financial_statement_lines WHERE is_system = TRUE`,
    []
  )) as CanonicalLine[];

  return extractedLines.map(line => {
    const label = line.originalLabel.toLowerCase();
    let bestMatch: { id: string; name: string; score: number } | null = null;

    for (const [canonId, hints] of Object.entries(CANONICAL_MAPPING_HINTS)) {
      for (const hint of hints) {
        if (label.includes(hint)) {
          const canonical = canonicalLines.find(c => c.id === canonId);
          const score = hint.length / label.length;
          if (canonical && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { id: canonical.id, name: canonical.line_name, score };
          }
        }
      }
    }

    if (bestMatch) {
      return {
        ...line,
        confidence: Math.min(line.confidence + 0.2, 0.95),
        suggestedCanonicalId: bestMatch.id,
        suggestedCanonicalLabel: bestMatch.name,
      };
    }
    return line;
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateStatement(
  lines: Array<{ canonicalLineId: string | null; value: number }>,
  statementType: string
): { status: 'pass' | 'warnings' | 'needs_review'; messages: ValidationMessage[] } {
  const messages: ValidationMessage[] = [];

  const getValue = (lineId: string): number | null => {
    const found = lines.find(l => l.canonicalLineId === lineId);
    return found ? found.value : null;
  };

  if (statementType === 'BS') {
    const totalAssets = getValue('fsl-bs-total-assets');
    const totalLiabilities = getValue('fsl-bs-total-liabilities');
    const equity = getValue('fsl-bs-equity');

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
        messages.push({ type: 'info', code: 'BS_EQUATION_OK', message: 'Balance sheet equation verified' });
      }
    } else {
      messages.push({ type: 'warning', code: 'BS_EQUATION_INCOMPLETE', message: 'Cannot verify balance sheet equation — missing Total Assets, Total Liabilities, or Equity' });
    }
  }

  if (statementType === 'P&L') {
    const revenue = getValue('fsl-pl-revenue');
    const cogs = getValue('fsl-pl-cogs');
    const gross = getValue('fsl-pl-gross');
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
  }

  const mappedCount = lines.filter(l => l.canonicalLineId).length;
  const totalCount = lines.length;
  if (totalCount > 0 && mappedCount / totalCount < 0.5) {
    messages.push({ type: 'warning', code: 'LOW_MAPPING_COVERAGE', message: `Only ${Math.round((mappedCount / totalCount) * 100)}% of lines are mapped to canonical categories` });
  }

  const hasErrors = messages.some(m => m.type === 'error');
  const hasWarnings = messages.some(m => m.type === 'warning');
  const status = hasErrors ? 'needs_review' : hasWarnings ? 'warnings' : 'pass';

  return { status, messages };
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
  createdBy: string;
}): Promise<string> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO financial_statements (id, organization_id, statement_type, period_start, period_end, period_label, currency, scaling, source_file_name, source_file_path, parse_method, overall_confidence, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, params.organizationId, params.statementType, params.periodStart, params.periodEnd,
     params.periodLabel || null, params.currency || 'PLN', params.scaling || 'units',
     params.sourceFileName || null, params.sourceFilePath || null,
     params.parseMethod || 'text_extraction', params.overallConfidence || 0, params.createdBy]
  );
  return id;
}

export async function saveStatementValues(
  statementId: string,
  values: Array<{ canonicalLineId: string | null; originalLabel: string; value: number; confidence: number; sourceRow?: number; mappingStatus?: string }>
): Promise<void> {
  for (const v of values) {
    await dbRun(
      `INSERT INTO financial_statement_values (id, statement_id, canonical_line_id, original_label, value, confidence, source_row, mapping_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), statementId, v.canonicalLineId || null, v.originalLabel, v.value, v.confidence, v.sourceRow || null, v.mappingStatus || 'auto']
    );
  }
}

export async function updateStatementStatus(
  statementId: string,
  status: string,
  validationStatus?: string,
  validationMessages?: ValidationMessage[]
): Promise<void> {
  await dbRun(
    `UPDATE financial_statements SET status = ?, validation_status = COALESCE(?, validation_status), validation_messages = COALESCE(?, validation_messages), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, validationStatus || null, validationMessages ? JSON.stringify(validationMessages) : null, statementId]
  );
}

export async function confirmStatement(
  statementId: string,
  userId: string
): Promise<void> {
  await dbRun(
    `UPDATE financial_statements SET status = 'confirmed', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [userId, statementId]
  );
}

logger.info('[FinancialStatementService] Loaded');
