/**
 * Presentation Export Parity Service (Epic F1)
 *
 * Cross-format export parity checker for presentation decks. Validates that
 * a deck's canonical structural invariants (page count, header/footer text,
 * confidentiality watermark, and required structural sections — cover /
 * dashboard / insight / roadmap / appendix) are reflected consistently across
 * the recorded exports of that deck (PDF / PPTX / HTML / PNG).
 *
 * Design notes:
 *   - The checker is *manifest-based*: it does NOT re-run exports. Instead it
 *     derives an "expected" parity manifest from the canonical `DeckDocument`
 *     and compares it against the latest recorded export per format from
 *     `presentation_export_records`. This keeps checks cheap (CI-friendly)
 *     and lets us validate AFTER the export pipeline has already recorded
 *     its artifacts.
 *   - The pure-logic core (`buildParityCheckReport`) is DB-free and never
 *     throws on malformed input — it always returns a structured report.
 *   - DB helpers degrade honestly: missing tables/columns surface as
 *     `storage_error` with `migration_pending` instead of leaking 500s.
 *   - The report is read-only — we never mutate decks or export records.
 */

import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import { normalizeDeckDocument, type DeckDocument } from './presentationDeckDocumentService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'pdf' | 'pptx' | 'png' | 'html';

export const REQUIRED_FORMATS: readonly ExportFormat[] = ['pdf', 'pptx'];
export const OPTIONAL_FORMATS: readonly ExportFormat[] = ['png', 'html'];
export const ALL_FORMATS: readonly ExportFormat[] = [...REQUIRED_FORMATS, ...OPTIONAL_FORMATS];

export const RECOGNIZED_SECTIONS = [
  'cover',
  'dashboard',
  'insight',
  'roadmap',
  'appendix',
] as const;
export type RecognizedSection = (typeof RECOGNIZED_SECTIONS)[number];

export type ExportRecordStatus = 'completed' | 'failed' | 'blocked';

export interface ExportRecordSummary {
  format: ExportFormat;
  generatedAt: string;
  status: ExportRecordStatus;
  pageCount: number | null;
  headerText: string | null;
  footerText: string | null;
  confidentialityWatermark: string | null;
  sectionsPresent: string[];
  bytes: number | null;
  errorReason: string | null;
}

export interface ParityExpected {
  pageCount: number;
  headerText: string | null;
  footerText: string | null;
  confidentialityWatermark: string | null;
  requiredSections: string[];
}

export interface ParityCheckInput {
  deckId: string;
  expected: ParityExpected;
  exports: ExportRecordSummary[];
}

export type ParityIssueSeverity = 'critical' | 'warning' | 'info';

export type ParityIssueField =
  | 'page_count'
  | 'header_text'
  | 'footer_text'
  | 'confidentiality_watermark'
  | 'sections'
  | 'export_status'
  | 'missing_export';

export interface ParityIssue {
  format: ExportFormat;
  field: ParityIssueField;
  expected: string | number | null;
  actual: string | number | null;
  severity: ParityIssueSeverity;
  reason: string;
}

export type ParityVerdict = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';

export interface ParityCheckReport {
  deckId: string;
  generatedAt: string;
  formatsChecked: ExportFormat[];
  formatsMissing: ExportFormat[];
  issues: ParityIssue[];
  verdict: ParityVerdict;
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
}

// ---------------------------------------------------------------------------
// Pure logic
// ---------------------------------------------------------------------------

function isExportFormat(value: unknown): value is ExportFormat {
  return value === 'pdf' || value === 'pptx' || value === 'png' || value === 'html';
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).replace(/\s+/g, ' ').trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeWatermark(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  return text.toUpperCase();
}

function safeArrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const t = item.trim().toLowerCase();
      if (t) out.push(t);
    }
  }
  return out;
}

function pickLatestPerFormat(records: ExportRecordSummary[]): Map<ExportFormat, ExportRecordSummary> {
  const latest = new Map<ExportFormat, ExportRecordSummary>();
  for (const record of records) {
    if (!isExportFormat(record.format)) continue;
    const prior = latest.get(record.format);
    if (!prior) {
      latest.set(record.format, record);
      continue;
    }
    const priorMs = Date.parse(String(prior.generatedAt || ''));
    const currentMs = Date.parse(String(record.generatedAt || ''));
    const priorOk = Number.isFinite(priorMs);
    const currentOk = Number.isFinite(currentMs);
    if (currentOk && (!priorOk || currentMs >= priorMs)) {
      latest.set(record.format, record);
    }
  }
  return latest;
}

function describeFormat(format: ExportFormat): string {
  return format.toUpperCase();
}

/**
 * Pure-logic core. Never throws. Returns a fully structured parity report
 * even for malformed input.
 */
export function buildParityCheckReport(input: ParityCheckInput): ParityCheckReport {
  const generatedAt = new Date().toISOString();
  const safeInput: ParityCheckInput = {
    deckId: typeof input?.deckId === 'string' ? input.deckId : '',
    expected: {
      pageCount:
        typeof input?.expected?.pageCount === 'number' && Number.isFinite(input.expected.pageCount)
          ? Math.max(0, Math.floor(input.expected.pageCount))
          : 0,
      headerText: normalizeText(input?.expected?.headerText),
      footerText: normalizeText(input?.expected?.footerText),
      confidentialityWatermark: normalizeWatermark(input?.expected?.confidentialityWatermark),
      requiredSections: safeArrayOfStrings(input?.expected?.requiredSections),
    },
    exports: Array.isArray(input?.exports) ? input.exports : [],
  };

  const issues: ParityIssue[] = [];
  const latest = pickLatestPerFormat(safeInput.exports);
  const formatsChecked: ExportFormat[] = [];
  const formatsMissing: ExportFormat[] = [];

  for (const format of ALL_FORMATS) {
    const record = latest.get(format);
    if (!record) {
      formatsMissing.push(format);
      const isRequired = REQUIRED_FORMATS.includes(format);
      issues.push({
        format,
        field: 'missing_export',
        expected: 'completed export record',
        actual: null,
        severity: isRequired ? 'critical' : 'info',
        reason: isRequired
          ? `${describeFormat(format)} export is mandatory but no export record was found. Trigger a fresh ${describeFormat(format)} export.`
          : `${describeFormat(format)} export is optional and not present. Skip if intentional, otherwise trigger a ${describeFormat(format)} export.`,
      });
      continue;
    }

    formatsChecked.push(format);

    if (record.status !== 'completed') {
      issues.push({
        format,
        field: 'export_status',
        expected: 'completed',
        actual: record.status || null,
        severity: 'critical',
        reason: `${describeFormat(format)} export is not in 'completed' state (actual='${record.status || 'unknown'}'${
          record.errorReason ? `, reason='${String(record.errorReason).slice(0, 200)}'` : ''
        }). Re-run the export and clear the failure.`,
      });
      continue;
    }

    if (
      typeof record.pageCount === 'number' &&
      Number.isFinite(record.pageCount) &&
      record.pageCount !== safeInput.expected.pageCount
    ) {
      issues.push({
        format,
        field: 'page_count',
        expected: safeInput.expected.pageCount,
        actual: record.pageCount,
        severity: 'critical',
        reason: `${describeFormat(format)} export has ${record.pageCount} pages but the canonical deck has ${safeInput.expected.pageCount} slides. Page count must match exactly.`,
      });
    }

    const actualHeader = normalizeText(record.headerText);
    if (
      safeInput.expected.headerText !== null &&
      (actualHeader === null || actualHeader !== safeInput.expected.headerText)
    ) {
      issues.push({
        format,
        field: 'header_text',
        expected: safeInput.expected.headerText,
        actual: actualHeader,
        severity: 'warning',
        reason: `${describeFormat(format)} header text differs from canonical (expected='${safeInput.expected.headerText}', actual='${actualHeader ?? '∅'}'). Re-render with the deck's canonical header.`,
      });
    }

    const actualFooter = normalizeText(record.footerText);
    if (
      safeInput.expected.footerText !== null &&
      (actualFooter === null || actualFooter !== safeInput.expected.footerText)
    ) {
      issues.push({
        format,
        field: 'footer_text',
        expected: safeInput.expected.footerText,
        actual: actualFooter,
        severity: 'warning',
        reason: `${describeFormat(format)} footer text differs from canonical (expected='${safeInput.expected.footerText}', actual='${actualFooter ?? '∅'}'). Re-render with the deck's canonical footer.`,
      });
    }

    const actualWatermark = normalizeWatermark(record.confidentialityWatermark);
    if (safeInput.expected.confidentialityWatermark !== null) {
      if (actualWatermark === null) {
        issues.push({
          format,
          field: 'confidentiality_watermark',
          expected: safeInput.expected.confidentialityWatermark,
          actual: null,
          severity: 'critical',
          reason: `${describeFormat(format)} export is missing the '${safeInput.expected.confidentialityWatermark}' confidentiality watermark. Confidential decks must render the watermark on every slide.`,
        });
      } else if (actualWatermark !== safeInput.expected.confidentialityWatermark) {
        issues.push({
          format,
          field: 'confidentiality_watermark',
          expected: safeInput.expected.confidentialityWatermark,
          actual: actualWatermark,
          severity: 'critical',
          reason: `${describeFormat(format)} watermark mismatch (expected='${safeInput.expected.confidentialityWatermark}', actual='${actualWatermark}'). Re-export with the deck's canonical confidentiality.`,
        });
      }
    }

    const actualSections = new Set(safeArrayOfStrings(record.sectionsPresent));
    for (const required of safeInput.expected.requiredSections) {
      if (!actualSections.has(required)) {
        issues.push({
          format,
          field: 'sections',
          expected: required,
          actual: null,
          severity: 'critical',
          reason: `${describeFormat(format)} export is missing the '${required}' section. Re-export so all canonical sections are rendered.`,
        });
      }
    }
  }

  const summary = {
    total: issues.length,
    critical: issues.filter((i) => i.severity === 'critical').length,
    warning: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
  };

  let verdict: ParityVerdict;
  if (summary.critical > 0) verdict = 'FAIL';
  else if (summary.warning > 0 || summary.info > 0) verdict = 'PASS_WITH_WARNINGS';
  else verdict = 'PASS';

  return {
    deckId: safeInput.deckId,
    generatedAt,
    formatsChecked,
    formatsMissing,
    issues,
    verdict,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Expected manifest derivation (deck-side helpers)
// ---------------------------------------------------------------------------

function readDeckBag(deck: DeckDocument): Record<string, any> {
  return deck as unknown as Record<string, any>;
}

/**
 * Pull a header/footer text from the canonical DeckDocument. Probes the
 * shapes a deck may carry: explicit `metadata.*Text`, `brand.*Text`, the
 * first card's `header_footer.footerText`, and finally the meta fallback.
 */
function readDeckHeaderFooter(deck: DeckDocument): { headerText: string | null; footerText: string | null } {
  const bag = readDeckBag(deck);
  const metadataLike = (bag.metadata && typeof bag.metadata === 'object' ? bag.metadata : {}) as Record<string, any>;
  const metaLike = (deck.meta && typeof deck.meta === 'object' ? deck.meta : {}) as Record<string, any>;
  const brandLike = (bag.brand && typeof bag.brand === 'object' ? bag.brand : {}) as Record<string, any>;

  const headerCandidates = [
    metadataLike.headerText,
    metadataLike.header_text,
    brandLike.headerText,
    brandLike.header_text,
    metaLike.headerText,
    metaLike.header_text,
  ];
  const footerCandidates = [
    metadataLike.footerText,
    metadataLike.footer_text,
    brandLike.footerText,
    brandLike.footer_text,
    metaLike.footerText,
    metaLike.footer_text,
  ];

  for (const card of Array.isArray(deck.cards) ? deck.cards : []) {
    const hf = (card as any)?.header_footer;
    if (hf && typeof hf === 'object') {
      headerCandidates.push((hf as any).headerText);
      footerCandidates.push((hf as any).footerText);
      // also accept lowercase aliases used by some renderers
      headerCandidates.push((hf as any).header_text);
      footerCandidates.push((hf as any).footer_text);
      break;
    }
  }

  const headerText = headerCandidates.map(normalizeText).find((v) => v !== null) ?? null;
  const footerText = footerCandidates.map(normalizeText).find((v) => v !== null) ?? null;
  return { headerText, footerText };
}

/**
 * Map the deck's confidentiality classification to the watermark string
 * we expect to see in confidentiality-marked exports. `internal` and
 * `public` decks are not watermarked so expected = null.
 */
export function expectedWatermarkFromConfidentiality(value: unknown): string | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'confidential') return 'CONFIDENTIAL';
  if (raw === 'restricted') return 'RESTRICTED';
  return null;
}

/**
 * Map a card intent (or its layout/title hint) to a recognized parity
 * section identifier, or null if it does not contribute to the parity
 * required-sections set.
 */
export function classifyCardSection(card: any): RecognizedSection | null {
  if (!card || typeof card !== 'object') return null;
  const intent = String(card.intent || '').toLowerCase();
  const layout = String(card.layout_id || '').toLowerCase();
  const title = String(card.title || '').toLowerCase();

  if (intent === 'cover' || layout.includes('cover')) return 'cover';
  if (intent === 'appendix' || layout.includes('appendix')) return 'appendix';
  if (intent === 'roadmap' || layout.includes('roadmap')) return 'roadmap';
  if (
    intent === 'performance_overview' ||
    intent === 'dashboard' ||
    layout.includes('dashboard') ||
    layout.includes('kpi-strip') ||
    title.includes('dashboard')
  ) {
    return 'dashboard';
  }
  if (
    intent === 'key_messages' ||
    intent === 'single_insight' ||
    intent === 'executive_summary' ||
    intent === 'insight' ||
    layout.includes('insight') ||
    title.includes('insight')
  ) {
    return 'insight';
  }
  return null;
}

/**
 * Derive the parity required-sections list from a DeckDocument. A section
 * is required if at least one card in the deck is classified as that
 * section. This way decks that genuinely don't have an appendix don't
 * trigger spurious "missing appendix" failures.
 */
export function deriveRequiredSections(deck: DeckDocument): string[] {
  const present = new Set<RecognizedSection>();
  for (const card of Array.isArray(deck.cards) ? deck.cards : []) {
    const section = classifyCardSection(card);
    if (section) present.add(section);
  }
  // Return in canonical order so output is stable across runs.
  return RECOGNIZED_SECTIONS.filter((section) => present.has(section));
}

/**
 * Build the expected parity manifest from a canonical DeckDocument. Pure
 * function — exposed for unit testing without a DB.
 */
export function buildExpectedParityFromDeckDocument(deck: DeckDocument): ParityExpected {
  const slideCount = Array.isArray(deck.cards) ? deck.cards.length : 0;
  const { headerText, footerText } = readDeckHeaderFooter(deck);
  const confidentialityWatermark = expectedWatermarkFromConfidentiality(deck.meta?.confidentiality);
  const requiredSections = deriveRequiredSections(deck);
  return {
    pageCount: slideCount,
    headerText,
    footerText,
    confidentialityWatermark,
    requiredSections,
  };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function isSchemaMissingError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('no such table') ||
    msg.includes('no such column') ||
    msg.includes('relation')
  );
}

function parseExportRecordStatus(value: unknown): ExportRecordStatus {
  const raw = String(value || '').toLowerCase();
  if (raw === 'completed' || raw === 'failed' || raw === 'blocked') return raw;
  if (raw === 'started') return 'failed';
  return 'failed';
}

interface ExportRecordRow {
  format: string;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  quality_report_json: string | null;
  error_category: string | null;
}

function parseQualityReport(raw: string | null | undefined): {
  pageCount: number | null;
  headerText: string | null;
  footerText: string | null;
  confidentialityWatermark: string | null;
  sectionsPresent: string[];
  bytes: number | null;
} {
  if (!raw) {
    return {
      pageCount: null,
      headerText: null,
      footerText: null,
      confidentialityWatermark: null,
      sectionsPresent: [],
      bytes: null,
    };
  }
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return {
      pageCount: null,
      headerText: null,
      footerText: null,
      confidentialityWatermark: null,
      sectionsPresent: [],
      bytes: null,
    };
  }
  const parityBag =
    parsed.parity && typeof parsed.parity === 'object' ? (parsed.parity as Record<string, any>) : parsed;
  const pageCount =
    typeof parityBag.pageCount === 'number'
      ? parityBag.pageCount
      : typeof parityBag.page_count === 'number'
        ? parityBag.page_count
        : typeof parityBag.slideCount === 'number'
          ? parityBag.slideCount
          : null;
  const bytes =
    typeof parityBag.bytes === 'number'
      ? parityBag.bytes
      : typeof parityBag.size === 'number'
        ? parityBag.size
        : null;
  const headerText =
    normalizeText(parityBag.headerText ?? parityBag.header_text ?? parityBag.header) ?? null;
  const footerText =
    normalizeText(parityBag.footerText ?? parityBag.footer_text ?? parityBag.footer) ?? null;
  const confidentialityWatermark = normalizeWatermark(
    parityBag.confidentialityWatermark ?? parityBag.confidentiality_watermark ?? parityBag.watermark
  );
  const sectionsPresent = safeArrayOfStrings(
    parityBag.sectionsPresent ?? parityBag.sections_present ?? parityBag.sections
  );
  return {
    pageCount: typeof pageCount === 'number' && Number.isFinite(pageCount) ? pageCount : null,
    headerText,
    footerText,
    confidentialityWatermark,
    sectionsPresent,
    bytes,
  };
}

/**
 * Load the most-recent export record per format for a deck. Returns a
 * schema-tolerant array (empty on missing tables/columns).
 */
export async function loadExportRecordsForParity(
  deckId: string,
  organizationId: string
): Promise<{ status: 'ok' | 'storage_error'; records: ExportRecordSummary[]; reason?: string }> {
  try {
    const rows = (await dbAll(
      `SELECT format, status, created_at, completed_at, quality_report_json, error_category
       FROM presentation_export_records
       WHERE deck_id = ? AND organization_id = ?
       ORDER BY COALESCE(completed_at, created_at) DESC
       LIMIT 200`,
      [deckId, organizationId]
    )) as ExportRecordRow[];
    const latest = new Map<ExportFormat, ExportRecordSummary>();
    for (const row of rows || []) {
      const format = String(row.format || '').toLowerCase();
      if (!isExportFormat(format)) continue;
      if (latest.has(format)) continue; // first row per format wins (already sorted DESC)
      const status = parseExportRecordStatus(row.status);
      const generatedAt = String(row.completed_at || row.created_at || '');
      const parityFields = parseQualityReport(row.quality_report_json);
      latest.set(format, {
        format,
        generatedAt,
        status,
        pageCount: parityFields.pageCount,
        headerText: parityFields.headerText,
        footerText: parityFields.footerText,
        confidentialityWatermark: parityFields.confidentialityWatermark,
        sectionsPresent: parityFields.sectionsPresent,
        bytes: parityFields.bytes,
        errorReason: row.error_category ? String(row.error_category) : null,
      });
    }
    return { status: 'ok', records: Array.from(latest.values()) };
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', records: [], reason: 'migration_pending' };
    }
    return { status: 'storage_error', records: [], reason: 'db_error' };
  }
}

/**
 * Build the expected parity manifest from the deck row (DB-bound).
 * Honest 503 surface when the deck table/columns are missing.
 */
export async function buildExpectedParityFromDeck(
  deckId: string,
  organizationId: string
): Promise<{ status: 'ok' | 'not_found' | 'storage_error'; expected?: ParityExpected; reason?: string }> {
  let row: any;
  try {
    row = (await dbGet(
      `SELECT id, organization_id, title, status, deck_json, unified_json, outline_json, source_artifacts, source_refs_json, validation_warnings, export_path, export_format, exported_at, generated_by, created_by, created_at, updated_at, confidentiality
       FROM presentation_decks
       WHERE id = ? AND organization_id = ?
       LIMIT 1`,
      [deckId, organizationId]
    )) as any;
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', reason: 'migration_pending' };
    }
    return { status: 'storage_error', reason: 'db_error' };
  }
  if (!row) return { status: 'not_found' };
  const deck = normalizeDeckDocument(row);
  if (!deck) return { status: 'not_found' };
  // Carry the row-level confidentiality column when the deck JSON omits it.
  if (!deck.meta?.confidentiality && row.confidentiality) {
    deck.meta = { ...(deck.meta || { title: deck.title, deckType: 'custom' }), confidentiality: String(row.confidentiality) };
  }
  return { status: 'ok', expected: buildExpectedParityFromDeckDocument(deck) };
}

/**
 * Build a full parity report for a deck. Combines expected manifest
 * derivation with export-record loading. Schema-tolerant.
 */
export async function buildParityReportForDeck(
  deckId: string,
  organizationId: string
): Promise<{ status: 'ok' | 'not_found' | 'storage_error'; report?: ParityCheckReport; reason?: string }> {
  const expectedResult = await buildExpectedParityFromDeck(deckId, organizationId);
  if (expectedResult.status === 'not_found') return { status: 'not_found' };
  if (expectedResult.status === 'storage_error') {
    return { status: 'storage_error', reason: expectedResult.reason };
  }
  const exportsResult = await loadExportRecordsForParity(deckId, organizationId);
  if (exportsResult.status === 'storage_error') {
    return { status: 'storage_error', reason: exportsResult.reason };
  }
  const report = buildParityCheckReport({
    deckId,
    expected: expectedResult.expected!,
    exports: exportsResult.records,
  });
  return { status: 'ok', report };
}
