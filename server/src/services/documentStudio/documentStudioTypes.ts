/**
 * Consultify Document Studio — Backend Types (MVP-1)
 *
 * Canonical doctrine: docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md
 * Type taxonomy:      docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_TYPE_TAXONOMY.md
 *
 * MVP-1 boundary: types support Mode 1 (generate without template) only.
 * Modes 2 and 3, the Document Template Architect, the AI Document Editor with
 * full multi-scope support, and the full QA Engine are deferred to later waves.
 */

// A4 — re-export the generation-warning type so consumers that already
// import from the types barrel get it here too. The warnings module is
// standalone (imports nothing from this file) so there is no cycle.
export type {
  DocumentGenerationWarning,
  DocumentGenerationWarningCode,
  DocumentGenerationWarningScope,
} from './documentGenerationWarnings.js';
import type { DocumentGenerationWarning } from './documentGenerationWarnings.js';

export type DocumentStudioMode = 'mode_1' | 'mode_2' | 'mode_3';

export type DocumentTypeKey =
  | 'executive_memo'
  | 'decision_memo'
  | 'project_status_report'
  | 'steering_committee_report'
  | 'benefits_tracking_report'
  | 'portfolio_overview'
  | 'ai_audit_report'
  | 'interview_summary_report'
  | 'digital_transformation_roadmap'
  | 'business_case'
  | 'sales_proposal'
  | 'client_discovery_report'
  | 'workshop_summary'
  | 'risk_register_report'
  | 'sop_document'
  | 'implementation_plan'
  | 'change_management_plan'
  | 'board_report'
  | 'research_report'
  | 'due_diligence_note'
  | 'internal_policy_document'
  | 'client_final_report'
  | 'generic_document';

export type DocumentLanguageStyle = 'formal' | 'consulting' | 'legal' | 'narrative';
export type CommunicationRegister = 'executive' | 'professional' | 'technical' | 'narrative';
export type DocumentDensity = 'concise' | 'standard' | 'detailed' | 'comprehensive';
export type DocumentGoal = 'inform' | 'decide' | 'approve' | 'recommend' | 'align';
export type DocumentConfidentiality = 'internal' | 'client_confidential' | 'restricted' | 'public';

/**
 * Slice E17.charts (FR-22 — Charts substrate). Adds the `'chart'`
 * block kind to the canonical block-type enum so consultants can
 * embed data visualisations directly inside the document body
 * (bar / line / pie / donut / scatter / area). The block carries
 * a structured `DocumentChartBlockContent` payload (see below)
 * with chart kind, axis labels, series, and optional caption /
 * source binding.
 *
 * Substrate-only scope. The DOCX + PDF renderers, the audience
 * projector, the markdown renderer, and the QA pipeline currently
 * fall through to `default: return ''` for unknown block types,
 * so adding the enum value is non-breaking — chart blocks
 * silently render as empty until renderer upgrades wire them in.
 * The follow-up slice `E17.charts.render` ships:
 *   - chart.js → PNG conversion in the DOCX renderer (chart.js
 *     server-side render → image bytes embedded inline);
 *   - PDF parity using the same pipeline;
 *   - Format QA category: chart blocks must declare ≥1 series
 *     and an x-axis label, etc.;
 *   - FE-E2 chart preview using a client-side chart library.
 */
export type DocumentBlockType =
  | 'heading'
  | 'paragraph'
  | 'bullet_list'
  | 'numbered_list'
  | 'table'
  | 'callout'
  | 'quote'
  | 'kpi_strip'
  | 'risk_table'
  | 'image'
  | 'chart'
  | 'footnote'
  | 'citation';

/**
 * Slice E17.charts — canonical chart kind enum. `bar`, `line`,
 * `pie`, `donut`, `scatter`, `area` cover ~95% of consulting-deck
 * patterns. The renderer follow-up slice maps these to chart.js
 * configurations.
 */
export type DocumentChartKind = 'bar' | 'line' | 'pie' | 'donut' | 'scatter' | 'area';

/**
 * Slice E17.charts — single chart series: a label + an array of
 * numeric values aligned positionally to the chart's category
 * axis. The renderer follow-up slice maps `values[i]` to the i-th
 * category on the x-axis (or the i-th slice of the pie).
 */
export interface DocumentChartSeries {
  label: string;
  values: number[];
  /**
   * Optional series colour hint (any CSS-compatible string the
   * renderer can map to its chart library). Renderers may ignore
   * this and fall back to a deterministic palette when absent.
   */
  color?: string;
}

/**
 * Slice E17.charts — canonical chart block payload. Stored on
 * `DocumentBlock.content` when `DocumentBlock.type === 'chart'`.
 *
 * Required fields (`kind`, `title`, `series[]`) make the block
 * meaningful for any renderer. Optional fields cover richer
 * publishing surfaces (caption, axis labels, categories) without
 * forcing every author to populate them.
 */
export interface DocumentChartBlockContent {
  kind: DocumentChartKind;
  /** Chart title — displayed above the chart by all renderers. */
  title: string;
  /**
   * Categorical x-axis labels (or pie-slice labels for
   * `kind === 'pie' | 'donut'`). When omitted, renderers fall back
   * to "1, 2, 3, …".
   */
  categories?: string[];
  /** X-axis label (semantic name of the categorical dimension). */
  xAxisLabel?: string;
  /** Y-axis label (semantic name of the numeric dimension). */
  yAxisLabel?: string;
  /** One or more data series. Empty array is a Format-QA finding. */
  series: DocumentChartSeries[];
  /** Optional caption rendered below the chart. */
  caption?: string;
}

export interface DocumentBlock {
  blockId: string;
  type: DocumentBlockType;
  content: unknown;
  sourceRef?: DocumentSourceRef;
  isAssumption?: boolean;
  /**
   * Optional audience-tag list — Epic E9 (Audience-driven warianty).
   *
   * When present, the audience projector uses these tags to decide whether
   * the block survives projection for a given AudienceProfile. When omitted,
   * the block is treated as audience-neutral and surfaces in every variant
   * (default-include semantics — backwards compatible with pre-E9 schemas).
   *
   * Tags are free-form strings ('technical_detail', 'engineering_only',
   * 'client_only', 'internal_only', …) and only become meaningful in the
   * presence of an AudienceProfile that filters on them.
   */
  audienceTags?: string[];
}

export type DocumentSectionKind = 'body' | 'appendix';

export interface DocumentSection {
  sectionId: string;
  orderIndex: number;
  level: 1 | 2 | 3;
  title: string;
  purpose?: string;
  blocks: DocumentBlock[];
  sourceRefs: DocumentSourceRef[];
  /**
   * Optional structural classification — Epic E8 (Advanced DOCX).
   *
   *  - `'body'` (default when omitted): part of the main numbered
   *    section sequence (e.g. "1. Executive Summary", "2. Findings").
   *  - `'appendix'`: rendered after the body sequence under the
   *    document's `appendixStyle` numbering scheme (lettered A./B./…,
   *    numbered 1./2./…, or bare titles when `appendixStyle === 'none'`).
   *
   * Schemas authored before E8 do not carry this field. The renderer
   * falls back to a title-prefix heuristic ("Appendix" / "Annex" /
   * "Załącznik") so legacy documents still render with appendix
   * formatting where the author clearly intended it.
   */
  kind?: DocumentSectionKind;
  /**
   * Optional audience-tag list — Epic E9 (Audience-driven warianty).
   *
   * Same semantics as `DocumentBlock.audienceTags` but section-scoped:
   * when present, an AudienceProfile may include / exclude the entire
   * section (and all its blocks) based on these tags. Default-include
   * when omitted to preserve backwards compatibility.
   */
  audienceTags?: string[];
}

/**
 * A reference from a document block / section / artifact to one of its
 * underlying sources. Slice E5.6 adds two backwards-compatible
 * fields for source-version pinning (NFR-17).
 *
 * - `sourceVersion`: semantic version / hash / monotonic id of the
 *   source as it existed when the document was generated. The renderer
 *   and QA pipeline use this field to detect drift ("the source has
 *   advanced beyond the version this document was anchored to") and
 *   to warn approvers when a document is rendered against a source
 *   that has since changed.
 *
 * - `sourceSnapshotId`: optional pointer to a durable snapshot of the
 *   source content (e.g. a `SourcePackVersion` id, a content hash, or
 *   an artifact registry pin). When present, the document can be
 *   rolled back / re-rendered against the exact bytes the author saw
 *   even if the live source has been mutated, archived, or removed.
 *
 * Both fields are optional. Pre-E5.6 schemas omit them; consumers
 * MUST treat the omission as "version unspecified" — the same shape
 * the registry has always produced — and continue to function. Helper
 * `documentSourceRefHasVersionPin()` codifies that contract so callers
 * do not hand-roll truthy checks.
 */
export interface DocumentSourceRef {
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
  /** Human-readable source content used for generation and grounding. */
  sourceExcerpt?: string;
  sourceVersion?: string;
  sourceSnapshotId?: string;
}

/** Extract bounded inline evidence, including the legacy text-in-sourceId shape. */
export function documentSourceRefEvidenceText(ref: DocumentSourceRef): string {
  const explicit = typeof ref.sourceExcerpt === 'string' ? ref.sourceExcerpt.trim() : '';
  if (explicit) return explicit.slice(0, 12_000);
  if (String(ref.sourceType || '').toLowerCase() !== 'text') return '';
  const title = String(ref.sourceTitle || '').trim();
  const prefix = title ? `text:${title}:` : '';
  if (!prefix || !String(ref.sourceId || '').startsWith(prefix)) return '';
  return String(ref.sourceId).slice(prefix.length).trim().slice(0, 12_000);
}

export function documentSourceRefsEvidenceText(sourceRefs: DocumentSourceRef[]): string {
  return sourceRefs
    .map((ref) => {
      const evidence = documentSourceRefEvidenceText(ref);
      return evidence ? `${ref.sourceTitle || ref.sourceType}: ${evidence}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Returns true iff the source ref carries enough version metadata to
 * detect drift. NFR-17 (source-version pinning) requires that any
 * approval-gated render flow can distinguish between "source v3 at
 * generation time" and "source v5 at render time"; this helper
 * encodes the contract used by the renderer + audit pipeline.
 *
 * A source ref qualifies as version-pinned when EITHER:
 *   - `sourceVersion` is a non-empty trimmed string, OR
 *   - `sourceSnapshotId` is a non-empty trimmed string.
 *
 * Refs that have neither field (the legacy default) are treated as
 * unpinned and surface a soft warning in the version-mismatch QA
 * (E5.6 codifies the type; the QA-side warning lands in a follow-up
 * slice on top of this substrate).
 */
export function documentSourceRefHasVersionPin(ref: DocumentSourceRef | undefined | null): boolean {
  if (!ref) return false;
  const versionPinned =
    typeof ref.sourceVersion === 'string' && ref.sourceVersion.trim().length > 0;
  const snapshotPinned =
    typeof ref.sourceSnapshotId === 'string' && ref.sourceSnapshotId.trim().length > 0;
  return versionPinned || snapshotPinned;
}

/**
 * Slice E15.5.formatting (§15.5 of the gap-vs-target report) —
 * spec §8.5 substrate. Closes the structural-formatting contract
 * gaps without breaking any of the existing flat fields:
 *   - structured `headingStyles` per level (font_size + bold +
 *     spacing_before/after) — the current `headingStyles: { h1:
 *     string; h2: string; h3: string }` flat string descriptor
 *     stays in place for legacy renderers, but the new
 *     `headingStylesDetailed` carries the structured shape that
 *     spec §8.5 demands;
 *   - `headers.content` (e.g. "Client Confidential | Consultify");
 *   - `footers.pageNumberingFormat` (e.g. "Page X of Y");
 *   - `coverPage` as an object with `includeLogo / includeStatus /
 *     includeConfidentiality` flags vs. today's binary `coverPage:
 *     boolean`;
 *   - `toc.maxDepth` vs. today's binary `toc: boolean`.
 *
 * Substrate-only: the existing flat fields STAY because the DOCX
 * + PDF renderers, the QA pipeline, and the materialize service
 * all consume them today. Adding the structured fields side-by-
 * side gives renderers a forward-compatible upgrade path: when a
 * renderer becomes aware of `headingStylesDetailed`, it can
 * branch on its presence and fall back to the flat descriptor
 * otherwise. This slice does NOT touch any consumer; the upgrade
 * is delegated to follow-up slices in the renderer / QA / FE-E2
 * Properties tab.
 */
export interface HeadingStyleDescriptor {
  /** Point size matching `formattingSchema.fonts.heading`. */
  fontSizePt: number;
  bold: boolean;
  /** Vertical space before the heading paragraph (points). */
  spacingBeforePt: number;
  /** Vertical space after the heading paragraph (points). */
  spacingAfterPt: number;
}

export interface FormattingSchema {
  fonts: { body: string; heading: string; mono?: string };
  headingStyles: { h1: string; h2: string; h3: string };
  tableStyles: { default: string };
  listStyles: { bullet: string; numbered: string };
  page: {
    size: 'A4' | 'Letter';
    marginsCm: { top: number; bottom: number; left: number; right: number };
  };
  headers: {
    enabled: boolean;
    /**
     * Slice E15.5.formatting — header content (e.g. "Client
     * Confidential | Consultify"). Optional / backwards-compatible.
     * Renderers may ignore this field until they explicitly
     * upgrade to consume it.
     */
    content?: string;
  };
  footers: {
    enabled: boolean;
    pageNumbering: boolean;
    confidentialityLabel: boolean;
    /** Optional author-defined footer text rendered before governance labels. */
    content?: string;
    /**
     * Slice E15.5.formatting — page-numbering format string (e.g.
     * "Page X of Y", "X / Y", "Strona X z Y"). Optional /
     * backwards-compatible. Renderers may ignore this field until
     * they explicitly upgrade to consume it.
     */
    pageNumberingFormat?: string;
  };
  toc: boolean;
  coverPage: boolean;
  appendixStyle: 'lettered' | 'numbered' | 'none';
  citationStyle: 'inline_marker' | 'footnote' | 'endnote';

  // ---------------------------------------------------------------------
  // Slice E15.5.formatting (§15.5) — spec §8.5 substrate. All optional /
  // backwards-compatible. Renderers / QA / FE-E2 stay forward-compatible
  // because the legacy flat fields above (`headingStyles`, `toc`,
  // `coverPage`, `headers.enabled`, `footers.*`) keep their existing
  // semantics. Consumer wiring is delegated to follow-up slices.
  // ---------------------------------------------------------------------
  /**
   * Per-level structured heading style descriptors. When present,
   * upgraded renderers consume this (with `headingStyles` as a
   * fallback hint). Legacy renderers ignore this field entirely.
   */
  headingStylesDetailed?: {
    h1: HeadingStyleDescriptor;
    h2: HeadingStyleDescriptor;
    h3: HeadingStyleDescriptor;
  };
  /**
   * TOC configuration object. When present, upgraded renderers
   * consume `enabled` (overrides `toc`) and `maxDepth` (caps the
   * depth of generated TOC entries). Legacy renderers ignore this
   * field and continue to honour the binary `toc: boolean`.
   */
  tocConfig?: {
    enabled: boolean;
    maxDepth?: 1 | 2 | 3;
  };
  /**
   * Cover-page configuration object. When present, upgraded
   * renderers consume `enabled` (overrides `coverPage`) plus the
   * three `include*` flags. Legacy renderers ignore this field
   * and continue to honour the binary `coverPage: boolean`.
   */
  coverPageDetailed?: {
    enabled: boolean;
    includeLogo?: boolean;
    includeStatus?: boolean;
    includeConfidentiality?: boolean;
  };
  /**
   * Fala 1 (2026-07-28) — "wzorzec kolorów" (N31). Mirrors the Deck
   * Template Architect's `presentation_templates.layout_policy_json
   * .colorTemplateId`: a `CURATED_COLOR_SETS[].id` or `'brand_kit'`, or
   * `undefined`/`null` when this Word template has no saved color pattern
   * (Document Studio had no color-pattern concept at all before this —
   * only `fonts`/heading styles above). Independent of `sectionBlueprint`
   * — a template can carry colors, structure, or both.
   */
  colorTemplateId?: string | null;
}

/**
 * Slice E15.5.formatting helper — true if the schema carries the
 * full per-level structured heading descriptors. Consumers branch
 * on this to decide whether to apply the rich H1/H2/H3 style
 * recipe or fall back to the flat `headingStyles` strings.
 * Defensive: returns false if any of h1/h2/h3 is missing or if
 * any required field on a descriptor is missing.
 */
export function formattingSchemaHasStructuredHeadings(
  schema: FormattingSchema | undefined | null
): boolean {
  if (!schema || !schema.headingStylesDetailed) return false;
  const { h1, h2, h3 } = schema.headingStylesDetailed;
  for (const d of [h1, h2, h3]) {
    if (!d) return false;
    if (typeof d.fontSizePt !== 'number' || !Number.isFinite(d.fontSizePt)) return false;
    if (typeof d.bold !== 'boolean') return false;
    if (typeof d.spacingBeforePt !== 'number' || !Number.isFinite(d.spacingBeforePt)) return false;
    if (typeof d.spacingAfterPt !== 'number' || !Number.isFinite(d.spacingAfterPt)) return false;
  }
  return true;
}

/**
 * Slice E15.5.formatting helper — collapses the §15.5 substrate
 * fields into a stable plain-object summary suitable for log
 * lines, audit entries, and the FE-E2 Properties tab "Formatting"
 * row. Stable shape, never throws, never mutates input.
 *
 * Each field reports the *effective* value the renderer should
 * use: when the structured field is present, it wins; otherwise
 * the flat legacy field's value is reported. `null` means the
 * schema does not carry meaningful info for that surface yet.
 */
export function summarizeFormattingSchemaSpecExtensions(
  schema: FormattingSchema | undefined | null
): {
  hasStructuredHeadings: boolean;
  tocEnabled: boolean | null;
  tocMaxDepth: 1 | 2 | 3 | null;
  coverPageEnabled: boolean | null;
  coverPageIncludesLogo: boolean | null;
  coverPageIncludesStatus: boolean | null;
  coverPageIncludesConfidentiality: boolean | null;
  headerContent: string | null;
  footerPageNumberingFormat: string | null;
} {
  if (!schema) {
    return {
      hasStructuredHeadings: false,
      tocEnabled: null,
      tocMaxDepth: null,
      coverPageEnabled: null,
      coverPageIncludesLogo: null,
      coverPageIncludesStatus: null,
      coverPageIncludesConfidentiality: null,
      headerContent: null,
      footerPageNumberingFormat: null,
    };
  }
  const trimOrNull = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    return trimmed.length === 0 ? null : trimmed;
  };
  const tocEnabled =
    schema.tocConfig && typeof schema.tocConfig.enabled === 'boolean'
      ? schema.tocConfig.enabled
      : typeof schema.toc === 'boolean'
        ? schema.toc
        : null;
  const tocMaxDepth =
    schema.tocConfig &&
    (schema.tocConfig.maxDepth === 1 ||
      schema.tocConfig.maxDepth === 2 ||
      schema.tocConfig.maxDepth === 3)
      ? schema.tocConfig.maxDepth
      : null;
  const coverPageEnabled =
    schema.coverPageDetailed && typeof schema.coverPageDetailed.enabled === 'boolean'
      ? schema.coverPageDetailed.enabled
      : typeof schema.coverPage === 'boolean'
        ? schema.coverPage
        : null;
  return {
    hasStructuredHeadings: formattingSchemaHasStructuredHeadings(schema),
    tocEnabled,
    tocMaxDepth,
    coverPageEnabled,
    coverPageIncludesLogo:
      schema.coverPageDetailed && typeof schema.coverPageDetailed.includeLogo === 'boolean'
        ? schema.coverPageDetailed.includeLogo
        : null,
    coverPageIncludesStatus:
      schema.coverPageDetailed && typeof schema.coverPageDetailed.includeStatus === 'boolean'
        ? schema.coverPageDetailed.includeStatus
        : null,
    coverPageIncludesConfidentiality:
      schema.coverPageDetailed &&
      typeof schema.coverPageDetailed.includeConfidentiality === 'boolean'
        ? schema.coverPageDetailed.includeConfidentiality
        : null,
    headerContent: schema.headers ? trimOrNull(schema.headers.content) : null,
    footerPageNumberingFormat: schema.footers
      ? trimOrNull(schema.footers.pageNumberingFormat)
      : null,
  };
}

// =============================================================================
// Slice E17.charts (FR-22) — chart-block helpers.
// =============================================================================

/**
 * Slice E17.charts helper — type guard that narrows a
 * `DocumentBlock` to the chart variant. Returns true iff
 * `block.type === 'chart'` AND `block.content` looks like a
 * structurally-valid `DocumentChartBlockContent` (kind + title +
 * series array). Defensive: returns false for any malformed
 * payload so consumers can branch safely without risking runtime
 * type errors.
 */
export function isDocumentChartBlock(
  block: DocumentBlock | undefined | null
): block is DocumentBlock & { type: 'chart'; content: DocumentChartBlockContent } {
  if (!block || block.type !== 'chart') return false;
  const content = block.content as Partial<DocumentChartBlockContent> | undefined | null;
  if (!content || typeof content !== 'object') return false;
  if (!isValidChartKind(content.kind)) return false;
  if (typeof content.title !== 'string' || content.title.trim().length === 0) return false;
  if (!Array.isArray(content.series)) return false;
  for (const s of content.series) {
    if (!s || typeof s !== 'object') return false;
    if (typeof s.label !== 'string') return false;
    if (!Array.isArray(s.values)) return false;
    for (const v of s.values) {
      if (typeof v !== 'number' || !Number.isFinite(v)) return false;
    }
  }
  return true;
}

function isValidChartKind(value: unknown): value is DocumentChartKind {
  return (
    value === 'bar' ||
    value === 'line' ||
    value === 'pie' ||
    value === 'donut' ||
    value === 'scatter' ||
    value === 'area'
  );
}

/**
 * Slice E17.charts helper — extract the typed chart payload
 * from a block, returning `null` when the block is not a chart
 * or carries a malformed payload. Wraps `isDocumentChartBlock`
 * for ergonomic narrowing in renderer / QA code paths.
 */
export function documentChartBlockContent(
  block: DocumentBlock | undefined | null
): DocumentChartBlockContent | null {
  if (!isDocumentChartBlock(block)) return null;
  return block.content;
}

/**
 * Slice E17.charts helper — canonical readiness summary the
 * renderer / FE-E2 chart preview / Format-QA category will
 * consume. Returns a stable plain-object summary for any block;
 * for non-chart blocks, the summary reports `kind = null` and
 * `seriesCount = 0`. Never throws, never mutates.
 *
 * `seriesCount` is the number of well-formed series that survived
 * validation — a chart with 3 declared series but only 2 valid
 * (e.g. one series carries a non-finite value) reports 2. This is
 * the metric the Format-QA follow-up uses for the "chart has at
 * least one valid series" finding.
 */
export function summarizeDocumentChartBlock(block: DocumentBlock | undefined | null): {
  kind: DocumentChartKind | null;
  title: string | null;
  seriesCount: number;
  totalValueCount: number;
  hasCaption: boolean;
  hasAxisLabels: boolean;
} {
  const empty = {
    kind: null as DocumentChartKind | null,
    title: null as string | null,
    seriesCount: 0,
    totalValueCount: 0,
    hasCaption: false,
    hasAxisLabels: false,
  };
  if (!block || block.type !== 'chart') return empty;
  const content = block.content as Partial<DocumentChartBlockContent> | undefined | null;
  if (!content || typeof content !== 'object') return empty;
  const kind = isValidChartKind(content.kind) ? content.kind : null;
  const titleRaw = typeof content.title === 'string' ? content.title.trim() : '';
  const title = titleRaw.length > 0 ? titleRaw : null;
  let seriesCount = 0;
  let totalValueCount = 0;
  if (Array.isArray(content.series)) {
    for (const s of content.series) {
      if (!s || typeof s !== 'object') continue;
      if (typeof s.label !== 'string') continue;
      if (!Array.isArray(s.values)) continue;
      let valid = true;
      for (const v of s.values) {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          valid = false;
          break;
        }
      }
      if (!valid) continue;
      seriesCount += 1;
      totalValueCount += s.values.length;
    }
  }
  const captionRaw = typeof content.caption === 'string' ? content.caption.trim() : '';
  const xRaw = typeof content.xAxisLabel === 'string' ? content.xAxisLabel.trim() : '';
  const yRaw = typeof content.yAxisLabel === 'string' ? content.yAxisLabel.trim() : '';
  return {
    kind,
    title,
    seriesCount,
    totalValueCount,
    hasCaption: captionRaw.length > 0,
    hasAxisLabels: xRaw.length > 0 || yRaw.length > 0,
  };
}

/**
 * The Document Schema is the canonical structured representation of a document
 * before any DOCX/PDF rendering. It is the source of truth; renderers are derivable.
 */
/**
 * Slice E15.artifact (§15.1 of the gap-vs-target report) — explicit
 * reference fields the spec §8.1 contract demands at the artifact
 * level. Pre-E15.artifact schemas relied on V8 ACL + per-service
 * lookups for these (organizationId carried tenancy, materialize
 * carried `templateId` only into the build pipeline, etc.), but the
 * artifact itself was not self-describing — readers had to chase
 * cross-service joins to answer "which template was this generated
 * from?" or "which source pack drives this artifact?". The 4 fields
 * below close that gap as backwards-compatible optional pointers.
 *
 * Field semantics:
 * - `templateRef` — the canonical pointer to the template the
 *   artifact was generated from (Mode-3) or refined under
 *   (template-aware Mode 1). Carries both `templateId` and
 *   `templateVersion` so audit trails can prove which version of
 *   the template applied at generation time, even if the template
 *   has been reapproved into a newer version since. Mode-1
 *   artifacts that were never associated with a template legitimately
 *   omit this field.
 * - `sourcePackId` — pointer to the bound source pack (Epic E4).
 *   Document-level source refs (`sourceRefs[]`) continue to live on
 *   the artifact as the citation surface; this top-level pointer
 *   identifies the *binding* (one source pack per artifact) so the
 *   FE-E2 Sources tab can render the matrix used/skipped/approved/
 *   draft/missing without iterating refs.
 * - `clientId` — optional pointer to the V8 client / customer
 *   record this artifact is for. V8 ACL still gates access via
 *   `organizationId`; `clientId` adds the "scoped to this end-
 *   client" semantic that the spec §8.1 mentions and that the
 *   FE-E2 Properties tab needs to render the client name.
 * - `owner` — userId of the consultant currently accountable for
 *   the artifact (vs. createdBy which is immutable). Powers the
 *   "Owner" column in the Documents list and the @owner mention
 *   handler in comments.
 *
 * All four fields are OPTIONAL. Pre-E15.artifact schemas omit them
 * and the service layer (materialize / hydration / persistence)
 * stays unchanged in this slice — populating these refs is delegated
 * to follow-up slices that wire them at the appropriate ingestion
 * points (materialize for `templateRef` + `sourcePackId`, V8 work-
 * canvas resolver for `clientId`, owner-change service for `owner`).
 */
export interface DocumentTemplateRef {
  /** Canonical template ID. */
  templateId: string;
  /**
   * Version label captured at generation time. Locks the audit
   * trail to the exact template revision that produced the
   * artifact, even after the template moves on to v1.1 / v2.0 /
   * etc. Format mirrors `DocumentTemplate.version`.
   */
  templateVersion: string;
}

export interface DocumentSchema {
  documentId: string;
  artifactId: string;
  title: string;
  documentType: DocumentTypeKey;
  language: 'pl' | 'en';
  audience: string[];
  goal: DocumentGoal;
  communicationRegister: CommunicationRegister;
  density: DocumentDensity;
  languageStyle: DocumentLanguageStyle;
  confidentiality: DocumentConfidentiality;
  formattingSchema: FormattingSchema;
  sections: DocumentSection[];
  sourceRefs: DocumentSourceRef[];
  createdAt: string;
  updatedAt: string;
  /**
   * Lifecycle status — Epic E5. Optional on the type to keep historical
   * artifacts (created before E5 shipped) readable; service overlays a
   * default `'draft'` when missing so callers can rely on a value.
   */
  documentStatus?: DocumentStatus;
  statusChangedAt?: string;
  statusChangedBy?: string;
  statusReason?: string;

  // ---------------------------------------------------------------------
  // Slice E15.artifact (§15.1) — explicit spec §8.1 refs. All optional /
  // backwards-compatible. See the doc-comment above the interface for
  // semantics + populate-side ownership.
  // ---------------------------------------------------------------------
  templateRef?: DocumentTemplateRef;
  sourcePackId?: string;
  clientId?: string;
  owner?: string;

  /**
   * HP-16 — realny EvidenceContract (`server/src/services/evidence/evidenceContract.ts`),
   * DETERMINISTYCZNIE wyprowadzony z `sourceRefs` + `isAssumption` flag na blokach (doktryna
   * §5.4 "Deklaracja—niepotwierdzone"). Populated by `documentContentGenerator.buildDocumentSchema`
   * / `buildDocumentSchemaPremium`. Optional for backwards compatibility with pre-HP-16 artifacts.
   */
  evidence?: import('../evidence/evidenceContract.js').EvidenceContract;
}

/**
 * Slice E15.artifact helper — true if the artifact is bound to a
 * specific template (i.e. carries `templateRef.templateId` AND
 * `templateRef.templateVersion`). Whitespace-only fields are treated
 * as unbound (defensive — protects against accidental empty-string
 * persistence).
 */
export function documentSchemaHasTemplateBinding(
  schema: DocumentSchema | undefined | null
): boolean {
  if (!schema) return false;
  const ref = schema.templateRef;
  if (!ref) return false;
  if (typeof ref.templateId !== 'string' || ref.templateId.trim().length === 0) return false;
  if (typeof ref.templateVersion !== 'string' || ref.templateVersion.trim().length === 0) {
    return false;
  }
  return true;
}

/**
 * Slice E15.artifact helper — collapses the optional artifact-level
 * refs into a stable plain-object summary suitable for log lines,
 * audit entries, and FE-E2 Properties tab rendering. Returns `null`
 * for every field that is not set, never throws, and never mutates
 * the input. Use this instead of touching the optional fields
 * directly so consumers don't drift from each other on edge-case
 * handling (whitespace, empty strings, etc.).
 */
export function summarizeDocumentSchemaArtifactRefs(schema: DocumentSchema | undefined | null): {
  templateId: string | null;
  templateVersion: string | null;
  sourcePackId: string | null;
  clientId: string | null;
  owner: string | null;
} {
  const empty = {
    templateId: null,
    templateVersion: null,
    sourcePackId: null,
    clientId: null,
    owner: null,
  };
  if (!schema) return empty;
  const trim = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    return trimmed.length === 0 ? null : trimmed;
  };
  return {
    templateId: schema.templateRef ? trim(schema.templateRef.templateId) : null,
    templateVersion: schema.templateRef ? trim(schema.templateRef.templateVersion) : null,
    sourcePackId: trim(schema.sourcePackId),
    clientId: trim(schema.clientId),
    owner: trim(schema.owner),
  };
}

export interface DocumentIntake {
  title?: string;
  description: string;
  documentType?: DocumentTypeKey;
  language?: 'pl' | 'en';
  audience?: string[];
  goal?: DocumentGoal;
  communicationRegister?: CommunicationRegister;
  density?: DocumentDensity;
  languageStyle?: DocumentLanguageStyle;
  confidentiality?: DocumentConfidentiality;
  sourceHints?: DocumentSourceRef[];
}

export interface DocumentOutlineSection {
  title: string;
  level: 1 | 2 | 3;
  purpose: string;
  expectedLengthHint: 'short' | 'medium' | 'long';
}

export interface DocumentOutline {
  documentType: DocumentTypeKey;
  title: string;
  sections: DocumentOutlineSection[];
  recommendedDensity: DocumentDensity;
  recommendedRegister: CommunicationRegister;
  recommendedLanguageStyle: DocumentLanguageStyle;
}

export interface DocumentRunRequest {
  organizationId: string;
  userId: string;
  intake: DocumentIntake;
  outline?: DocumentOutline;
}

// =============================================================================
// QA Engine — MVP-3 hardening (deterministic Brand QA + Language QA).
// =============================================================================

// Slice E5.6.qa adds the 11th canonical QA category: `source_drift`.
// It is positioned right after `sources` because the two are
// semantically twinned (sources = "do we have citations?",
// source_drift = "are the citations we have pinned to a known
// version of the underlying source?"). The category is
// non-blocking by default — pre-E5.6 schemas legitimately have
// unpinned refs and we do not want to soft-block their export
// the moment the QA pipeline learns about pinning.
export type DocumentQaCategory =
  | 'brand'
  | 'language'
  | 'completeness'
  | 'sources'
  | 'source_drift'
  | 'methodology'
  | 'executive'
  | 'risk'
  | 'data'
  | 'format'
  | 'export';

export type DocumentQaSeverity = 'low' | 'medium' | 'high';

export interface DocumentQaFinding {
  findingId: string;
  severity: DocumentQaSeverity;
  message: string;
  sectionId?: string;
  blockId?: string;
  /** Optional code for telemetry / i18n keys ("language_mismatch", "banned_phrase", etc.). */
  code?: string;
}

export interface DocumentQaCategoryReport {
  category: DocumentQaCategory;
  /** 0..100 score where 100 = no findings. Severity-weighted deduction. */
  score: number;
  findings: DocumentQaFinding[];
  /** Whether the score crosses the policy threshold for soft-blocking exports. */
  blocking: boolean;
  /** Human-readable summary the UI can show without iterating findings. */
  summary: string;
}

export interface DocumentQaReport {
  artifactId: string;
  organizationId: string;
  generatedAt: string;
  /** True when ANY category report has `blocking === true`. */
  anyBlocking: boolean;
  categories: DocumentQaCategoryReport[];
  /**
   * A3 — deterministic fabrication signal (documentFabricationCheck),
   * surfaced additively on the QA report so the on-demand QA panel and
   * the export-blocked banner can show it without a dedicated endpoint.
   * `count === 0` means no unsupported precise-looking numbers were
   * found (already computed; this field only carries it through).
   * Absent when the detector itself failed (fail-soft — never blocks).
   */
  fabrication?: {
    count: number;
    sample: string[];
  };
}

export interface DocumentRunResult {
  artifactId: string;
  schema: DocumentSchema;
  /**
   * A4 — generation-time warnings recorded when the pipeline degraded
   * via a silent fallback (e.g. LLM prose failure → deterministic
   * stubs). Optional / backwards-compatible: absent or empty means the
   * document generated at full fidelity. Persisted on the artifact
   * metadata and surfaced to the FE as a "generated with limitations"
   * chip.
   */
  generationWarnings?: DocumentGenerationWarning[];
}

export interface DocumentExportResult {
  format: 'markdown' | 'docx' | 'pdf';
  filename: string;
  contentBase64?: string;
  contentText?: string;
  manifest: Record<string, unknown>;
  /**
   * A4 — export-time warnings recorded when a binary render degraded
   * (chart rasterization fell back to a text placeholder, requested
   * cover logo unavailable). Optional; absent means the export rendered
   * at full fidelity. Also mirrored inside `manifest.generationWarnings`.
   */
  generationWarnings?: DocumentGenerationWarning[];
}

/**
 * Editor scopes (Epic E3 — extended in Sprint 4):
 *  - local:        single block under the cursor
 *  - section:      every editable block in one section
 *  - global:       every editable block in every section
 *  - methodology:  every editable block in Methodology/Approach/Scope/Założenia/
 *                  Assumptions/Sensitivity sections only — stricter prompt
 *                  rules ("do not invent methodology steps, do not reorder
 *                  phases, only refine prose")
 *  - source:       every editable block whose block.sourceRef is set —
 *                  stricter prompt rules ("never modify numbers, names,
 *                  citation markers; polish prose only") + post-rewrite
 *                  preservation guard (digits + bracketed citations must
 *                  match before/after; otherwise deterministic fallback)
 *  - transformative: every editable block of every section — the user
 *                  has explicitly opted into a dramatic restructure
 *                  ("przepisz od nowa", "completely rewrite", "rebuild").
 *                  Refiner relaxes structural guardrails (may merge /
 *                  split paragraphs, may shift register fundamentally)
 *                  but keeps non-empty + 4× growth + 4000 char absolute
 *                  caps so approval-time surprises stay bounded. NO
 *                  source-preservation guard: the user has consciously
 *                  authorized a rebuild. Slice E3.6 — completes the
 *                  SSOT 6-scope edit doctrine.
 */
export type DocumentEditorScope =
  'local' | 'section' | 'global' | 'methodology' | 'source' | 'transformative';
export type DocumentProposalStatus = 'proposed' | 'approved' | 'rejected' | 'executed';

/**
 * Editor proposal input. Required fields differ by scope:
 *   - local:   sectionId + blockId + instruction
 *   - section: sectionId + instruction (blockId omitted/ignored)
 *   - global:  instruction only (no sectionId/blockId)
 *
 * Routes validate the shape per-scope before delegating to the service.
 */
export interface DocumentEditorProposalInput {
  scope: DocumentEditorScope;
  instruction: string;
  sectionId?: string;
  blockId?: string;
}

export interface DocumentEditorProposalDiff {
  before: string;
  after: string;
}

/**
 * Slice E15.4.edit (§15.4 of the gap-vs-target report) — closes the
 * spec §8.4 DocumentEdit contract gap. Spec demands:
 * - `edit_type` enum naming the *kind* of mutation independently of
 *   the scope (local/section/global etc. answer "where", edit_type
 *   answers "what kind of change");
 * - `proposed_changes[]` as a structured array of per-target diffs
 *   so reviewers can approve/reject individual changes (not just
 *   the whole proposal as one blob);
 * - `version_before` / `version_after` snapshot links so the audit
 *   trail can reconstruct the pre/post-execution state without
 *   chasing cross-service joins.
 *
 * The current `DocumentEditorProposal` carries scope + a single
 * before/after string diff, with snapshots created at execute time
 * but NOT linked back onto the proposal. That works for the
 * happy-path UI but breaks the spec contract for forensic replay.
 *
 * This slice ships the substrate ONLY: type + helpers. Service
 * code (proposal creation paths in editor / refiner / transformative
 * service slices) is NOT touched in this slice — it would multiply
 * the diff and the collision risk against parallel agents in the
 * service layer. Follow-up slices wire the new fields into the
 * existing proposal-creation code paths and into the snapshot
 * service so executed proposals carry both `versionBeforeId` and
 * `versionAfterId`.
 */
export type DocumentEditType =
  | 'rewrite' // local rewrite of existing prose
  | 'replace' // wholesale block/section replacement
  | 'restructure' // section reorder / split / merge — typically `transformative`
  | 'annotate' // add comment / note / footnote without altering prose
  | 'expand' // grow content (more detail / examples / data)
  | 'condense' // shrink content (executive cut / TLDR pass)
  | 'reformat'; // formatting-only change (style / list / table)

/**
 * Per-target structured change inside a proposal. Each entry
 * names the editorial target (section + optional block) and
 * carries a before/after pair so the reviewer can approve / reject
 * individual changes. The aggregate `diff` field on the proposal
 * stays as the human-readable summary; this array is the
 * machine-readable fan-out used by the FE-E2 review UI and the
 * forensic audit replay.
 */
export interface DocumentEditTargetedChange {
  targetSectionId: string;
  targetBlockId?: string;
  before: string;
  after: string;
  /**
   * Optional kind override per change — if a single proposal touches
   * both a `rewrite` and an `annotate` target, the proposal-level
   * `editType` names the dominant kind and individual entries can
   * override. When omitted, consumers fall back to the proposal's
   * top-level `editType`.
   */
  editType?: DocumentEditType;
}

/**
 * For section/global scopes, `diff` carries a stringified summary of the
 * before/after sections (rendered via the markdown projection) so the UI can
 * present a reviewable preview without leaking the raw schema to clients
 * that only know about the editor surface. The full structural change is
 * applied at approval time using `affectedSectionIds`.
 *
 * `blockRewrites` is an optional map `blockId -> rewritten text` that the
 * LLM-augmented refiner populates at proposal time. When present, approval
 * uses the rewritten text per block; when absent, approval falls back to the
 * deterministic instruction-marker application. This keeps the governance
 * envelope (proposal → approval → execution → audit) intact regardless of
 * whether AI rewrites are involved.
 *
 * Slice E15.4.edit (§15.4) extends the proposal with four
 * backwards-compatible optional fields that close the spec §8.4
 * gap. See the `DocumentEditType` and `DocumentEditTargetedChange`
 * doc-comments above for semantics. All four are `undefined` on
 * pre-E15.4.edit proposals; service code is NOT touched in this
 * slice (substrate-only).
 */
export interface DocumentEditorProposal {
  proposalId: string;
  artifactId: string;
  organizationId: string;
  scope: DocumentEditorScope;
  instruction: string;
  sectionId?: string;
  blockId?: string;
  /** Sections touched by the proposal. For local: one section. */
  affectedSectionIds: string[];
  /** Optional per-block LLM rewrites applied at approval time. */
  blockRewrites?: Record<string, string>;
  /** Whether the LLM refiner produced any rewrites for this proposal. */
  llmRefined?: boolean;
  status: DocumentProposalStatus;
  diff: DocumentEditorProposalDiff;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  executedAt?: string;

  // ---------------------------------------------------------------------
  // Slice E15.4.edit (§15.4) — spec §8.4 substrate. All optional /
  // backwards-compatible. Populate-side ownership is delegated to
  // follow-up slices in the service layer.
  // ---------------------------------------------------------------------
  /**
   * Dominant kind of mutation this proposal represents. Independent
   * of `scope` (which answers "where"); `editType` answers "what
   * kind of change". Used by the FE-E2 review UI to render
   * scope-appropriate review affordances and by the audit trail
   * for category aggregation.
   */
  editType?: DocumentEditType;
  /**
   * Per-target structured changes. When populated, the FE renders
   * a list of individually-reviewable changes; when empty/absent,
   * the FE falls back to the aggregate `diff` field. Approval
   * semantics for partial-acceptance of a structured array is a
   * follow-up; today the proposal is approved or rejected as a
   * whole unit.
   */
  proposedChanges?: DocumentEditTargetedChange[];
  /**
   * Snapshot ID captured immediately BEFORE the proposal executes.
   * Populated by the snapshot service at execute-time in a
   * follow-up wiring slice. Allows forensic replay: "show me the
   * artifact exactly as it was when this proposal was approved".
   */
  versionBeforeId?: string;
  /**
   * Snapshot ID captured immediately AFTER the proposal executes.
   * Pair of `versionBeforeId`. Together they let the audit log
   * reconstruct the diff that the approval actually delivered,
   * independent of whether the proposal's pre-computed `diff`
   * remained accurate (defensive: prose may have been re-edited
   * between approval and execute on contended workflows).
   */
  versionAfterId?: string;
  /**
   * C2 hardening — durable-persistence outcome for THIS write of the
   * proposal (create / approve / reject / execute all re-stamp it).
   * Additive + optional so existing consumers that only read the
   * proposal fields above are unaffected.
   *
   * `persisted: true`  — the durable-write survived a DB round trip
   *   (INSERT/UPSERT confirmed `success`). The in-process cache and
   *   the DB row agree.
   * `persisted: false` — the durable write did NOT confirm; the
   *   caller is running on the in-process cache only. `degraded`
   *   distinguishes *why*:
   *     - `degraded: 'schema_missing'` — the backing table doesn't
   *       exist yet (pre-migration environment). Expected/tolerated;
   *       not a production incident by itself.
   *     - `degraded: 'db_error'` — the table exists but the write
   *       failed (connection loss, constraint violation, etc.). A
   *       real signal that this proposal is at risk of being lost on
   *       process restart.
   */
  persistence?: {
    persisted: boolean;
    degraded?: 'schema_missing' | 'db_error';
    reason?: string;
  };
}

/**
 * Slice E15.4.edit helper — true if the proposal carries the
 * structured per-target changes array (non-empty). Consumers
 * should branch on this to decide whether to render the
 * machine-readable change list or fall back to the aggregate
 * `diff`. Defensive: returns false for null / undefined / empty
 * arrays; treats non-array values as "no structured changes".
 */
export function documentEditorProposalHasStructuredChanges(
  proposal: DocumentEditorProposal | undefined | null
): boolean {
  if (!proposal) return false;
  if (!Array.isArray(proposal.proposedChanges)) return false;
  return proposal.proposedChanges.length > 0;
}

/**
 * Slice E15.4.edit helper — true if both `versionBeforeId` and
 * `versionAfterId` are non-empty after trimming. Used by audit
 * surfaces to decide whether the proposal carries a complete
 * forensic-replay link (only `executed` proposals will satisfy
 * this; `proposed` / `approved` / `rejected` proposals
 * legitimately lack one or both ends of the version pair).
 */
export function documentEditorProposalHasVersionLink(
  proposal: DocumentEditorProposal | undefined | null
): boolean {
  if (!proposal) return false;
  const before =
    typeof proposal.versionBeforeId === 'string' ? proposal.versionBeforeId.trim() : '';
  const after = typeof proposal.versionAfterId === 'string' ? proposal.versionAfterId.trim() : '';
  return before.length > 0 && after.length > 0;
}

/**
 * Slice E15.4.edit helper — collapses the §15.4 substrate fields
 * into a stable plain-object summary suitable for log lines, audit
 * entries, and the FE-E2 review UI's "what kind of change is
 * this?" header. Returns `null` for every field that is not set
 * (after trimming for strings). Never throws, never mutates input.
 *
 * `changesCount` is always a number (defaults to 0 when
 * `proposedChanges` is absent / non-array / empty); other fields
 * are nullable strings.
 */
export function summarizeDocumentEditorProposalAuditFields(
  proposal: DocumentEditorProposal | undefined | null
): {
  editType: DocumentEditType | null;
  changesCount: number;
  versionBeforeId: string | null;
  versionAfterId: string | null;
} {
  const empty = {
    editType: null as DocumentEditType | null,
    changesCount: 0,
    versionBeforeId: null as string | null,
    versionAfterId: null as string | null,
  };
  if (!proposal) return empty;
  const trim = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    return trimmed.length === 0 ? null : trimmed;
  };
  return {
    editType: proposal.editType ?? null,
    changesCount: Array.isArray(proposal.proposedChanges) ? proposal.proposedChanges.length : 0,
    versionBeforeId: trim(proposal.versionBeforeId),
    versionAfterId: trim(proposal.versionAfterId),
  };
}

export type DocumentAuditAction =
  | 'proposal_created'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'proposal_executed'
  | 'qa_blocked_export'
  | 'qa_override_export'
  | 'qa_override_denied'
  // Epic E5 — Document Lifecycle
  | 'document_status_changed'
  | 'document_version_snapshot_created'
  | 'document_rolled_back'
  | 'content_block_inserted'
  // P0 fix — manual (non-AI) TipTap editor autosave
  | 'manual_content_saved'
  // Epic E6 — Comments + review mode
  | 'comment_added'
  | 'comment_replied'
  | 'comment_resolved'
  | 'comment_reopened'
  | 'comment_deleted';

// =============================================================================
// Epic E6 — Comments + review mode
// =============================================================================

/**
 * Lifecycle status of a `DocumentComment`. Comments live in two
 * states only — `'open'` (the default on creation) and `'resolved'`
 * (closed after a reviewer marked it done). Reopening flips the
 * state back to `'open'` and bumps `reopenedAt`. We deliberately
 * keep this binary so the UI affordances (thread badges, unresolved
 * counts) stay simple and the audit trail unambiguous.
 */
export type DocumentCommentStatus = 'open' | 'resolved';

/**
 * Anchor — what part of the document the comment is attached to.
 *
 *   document   The whole artifact (general feedback, no anchor).
 *   section    Bound to a specific section by `sectionId`.
 *   block      Bound to a specific block inside a section by both
 *              `sectionId` AND `blockId` (enables inline annotation
 *              UX in the editor canvas).
 *
 * The discriminant is captured in `anchor.kind`; required ids ride
 * along on the same object so the type narrows them automatically.
 */
export type DocumentCommentAnchor =
  | { kind: 'document' }
  | { kind: 'section'; sectionId: string }
  | { kind: 'block'; sectionId: string; blockId: string };

/**
 * A reviewer comment on a document. Threads are formed by sharing
 * `threadId` — the root comment of a thread carries
 * `parentCommentId === undefined` and all replies carry
 * `parentCommentId === root.commentId`. Replies inherit the root's
 * `anchor`.
 *
 * Resolution semantics: resolving the root marks every comment in
 * the thread as resolved (atomic operation in the service); replies
 * cannot be resolved independently in MVP. Reopen mirrors that.
 */
export interface DocumentComment {
  commentId: string;
  threadId: string;
  artifactId: string;
  organizationId: string;
  /** Root of a thread has parentCommentId === undefined. */
  parentCommentId?: string;
  anchor: DocumentCommentAnchor;
  authorId: string;
  body: string;
  status: DocumentCommentStatus;
  createdAt: string;
  updatedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolveReason?: string;
  reopenedBy?: string;
  reopenedAt?: string;
  /** Soft-delete: the comment row stays in the timeline so the
   *  audit trail is complete, but body is replaced with `''` and
   *  `deletedAt` is stamped. Replies on a deleted root keep working. */
  deletedBy?: string;
  deletedAt?: string;
}

/**
 * Aggregated view of a comment thread for UI rendering. The service
 * groups comments by `threadId` and returns:
 *   - `root`    The first comment in the thread (parentCommentId === undefined).
 *   - `replies` All other comments in the thread, ordered by createdAt asc.
 *   - `status`  Mirrors the root's status (resolution is thread-wide).
 *   - `anchor`  Mirrors the root's anchor.
 */
export interface DocumentCommentThread {
  threadId: string;
  artifactId: string;
  organizationId: string;
  anchor: DocumentCommentAnchor;
  status: DocumentCommentStatus;
  root: DocumentComment;
  replies: DocumentComment[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Per-section unresolved-comment counts for the editor canvas to
 * render thread badges next to section / block headings.
 */
export interface DocumentCommentSectionCounts {
  artifactId: string;
  organizationId: string;
  /** Sum of `'open'` thread counts across the entire artifact. */
  totalOpen: number;
  /** Sum of `'resolved'` thread counts across the entire artifact. */
  totalResolved: number;
  /** Per-section breakdown. The map omits sections with zero threads. */
  perSection: Record<string, { open: number; resolved: number }>;
  /** Per-block breakdown — only `'block'`-anchored threads contribute. */
  perBlock: Record<string, { open: number; resolved: number }>;
}

/**
 * Origin of a `DocumentVersionSnapshot` (Epic E5 Slice 5.2 / 5.3).
 *
 *   manual              Operator clicked "snapshot now" or wrote a label
 *                       at a meaningful moment.
 *   auto_status_change  Created automatically on a meaningful lifecycle
 *                       transition (e.g. → approved) so rollback can
 *                       always reach the cleared version.
 *   rollback_revert     Created right before a rollback overwrites the
 *                       current schema, so the operator never loses the
 *                       state they rolled away from.
 *   autosave            Created automatically by the server on a
 *                       content autosave (`PUT /:artifactId/content`)
 *                       once a time or content-delta threshold is
 *                       crossed since the last snapshot (Epic E1 —
 *                       automatic history). Subject to a 30-snapshot
 *                       retention cap per artifact; `manual` /
 *                       `auto_status_change` / `rollback_revert`
 *                       snapshots are never pruned by that cap.
 */
export type DocumentVersionSnapshotOrigin =
  'manual' | 'auto_status_change' | 'rollback_revert' | 'autosave';

/**
 * Frozen, addressable copy of a `DocumentSchema` at a point in time.
 * Snapshots are append-only; the rollback machinery in slice 5.3
 * restores a snapshot by writing a new "rollback_revert" snapshot of
 * the current schema, then activating the target snapshot's schema.
 */
export interface DocumentVersionSnapshot {
  versionId: string;
  artifactId: string;
  organizationId: string;
  /** Monotonic 1-based per-artifact counter. */
  versionNumber: number;
  capturedAt: string;
  capturedBy: string;
  label?: string;
  reason?: string;
  statusAtCapture: DocumentStatus;
  schema: DocumentSchema;
  origin: DocumentVersionSnapshotOrigin;
}

/**
 * Document Lifecycle (Epic E5).
 *
 *   draft        Working copy; freely mutable. Initial state on creation.
 *   in_review    Submitted for review; intended-immutable but mutations
 *                are allowed (no hard lock). Reviewers leave comments
 *                (Epic E6) and decide approve / send-back.
 *   approved     Cleared for publication. Auto-creates a "approved"
 *                version snapshot on entry so rollback can always get
 *                back to the cleared state.
 *   published    Externally shared / exported as official deliverable.
 *                Only path forward is `archived`. To revise, the operator
 *                rolls back to a snapshot or creates a new artifact.
 *   archived     Removed from the active list. Restorable to `draft`.
 */
export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';

export interface DocumentAuditEntry {
  auditId: string;
  artifactId: string;
  organizationId: string;
  proposalId?: string;
  action: DocumentAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// MVP-2 — Document Template Architect
// =============================================================================

export type TemplateCategory =
  | 'memo'
  | 'report'
  | 'audit'
  | 'business_case'
  | 'proposal'
  | 'sop'
  | 'plan'
  | 'governance'
  | 'discovery'
  | 'other';

export type TemplateStatus = 'draft' | 'approved' | 'deprecated';

/**
 * Per-section blueprint inside a `DocumentTemplate`. Slice E14.blueprint
 * (§15.3 of the gap-vs-target report) extends the original 5-field
 * shape with **4** backwards-compatible optional fields so the
 * Template Architect can express the missing spec §8.3 contract
 * (`required_data[]`, `optional_data[]`, `formatting_style`,
 * `approval_required` per blueprint). Pre-E14.blueprint templates
 * omit these fields and continue to work without any changes to
 * seeders, refiners, hydration, persistence, draft / approve /
 * deprecate flows, or the materialize pipeline.
 *
 * Field semantics:
 * - `requiredData` — short, free-form labels naming the inputs a
 *   Template Architect demands inside this section (e.g. "client
 *   revenue 2024", "Q3 board minutes timestamp"). Mode-3 generation
 *   surfaces this as the per-section input checklist; missing items
 *   become QA findings on the source-coverage category. Empty array
 *   = "no specific data demanded for this section" (different from
 *   `undefined`, which means "the template author has not classified
 *   this section yet" → the Template Architect prompts to fill it
 *   in).
 * - `optionalData` — labels for inputs that ENRICH but do not block
 *   the section. The recommender uses these to suggest enrichment
 *   opportunities to the consultant; never blocking.
 * - `formattingStyle` — short identifier (e.g.
 *   `"h1_with_intro_and_table"`, `"bullet_list_decisions"`,
 *   `"narrative_two_column"`) that the renderer can map to a
 *   per-section formatting recipe override on top of the
 *   document-level `formattingSchema`. Free-form string so
 *   tenants can extend the catalogue without changing types.
 * - `approvalRequired` — when true, the section MUST clear an
 *   approval decision INDEPENDENTLY of the document-level approval
 *   gate. Document-level approvals (E10) continue to gate the
 *   whole artifact; this flag adds an extra requirement per
 *   section, used by sensitive blueprints (e.g. legal-language
 *   sections, confidentiality clauses, regulatory disclosures).
 *   Default `undefined` is treated as "no per-section approval
 *   gate" — only the document-level gate applies.
 *
 * No mutations to existing fields. Seeders, refiners, the
 * materialize pipeline, and persistence stay forward-compatible
 * because the new fields default to `undefined` everywhere.
 */
export interface TemplateSectionBlueprint {
  title: string;
  level: 1 | 2 | 3;
  purpose: string;
  required: boolean;
  expectedLengthHint: 'short' | 'medium' | 'long';
  // -------------------------------------------------------------------------
  // Slice E14.blueprint (gap-vs-target §15.3) — closes spec §8.3 gap.
  // All four are optional / backwards-compatible.
  // -------------------------------------------------------------------------
  requiredData?: string[];
  optionalData?: string[];
  formattingStyle?: string;
  approvalRequired?: boolean;
  /**
   * Optional 2-4 short thematic guidance phrases for this section (e.g.
   * "Frame the current-state pain points", "Contrast before/after
   * operating model") — content STRUCTURE guidance for whoever fills the
   * template with real data later, never fabricated facts/numbers (this
   * is a reusable template, not a specific document). Mirrors the deck
   * template `contentHints` field
   * (`presentationTemplateDraftService.ts`). `undefined` means "no
   * guidance yet" and is safe to omit anywhere this type is used; the
   * deterministic draft never sets it, `refineTemplateWithLlm` may add
   * it, and the manual structure editor (`reviseTemplateStructure`) may
   * persist author-typed guidance.
   */
  contentHints?: string[];
  /**
   * Optional one-sentence THESIS the section should argue/prove (e.g.
   * "The current operating model cannot scale past 3x volume without a
   * platform rebuild") — a content-guidance anchor for whoever drafts the
   * section, never a fabricated conclusion (this is a reusable template,
   * not a specific document's actual finding). Mirrors the Deck Template
   * Architect's per-slide `keyMessage` guidance. `undefined` means "no
   * guidance yet"; the deterministic draft never sets it,
   * `refineTemplateWithLlm` may add it, and the manual structure editor
   * (`reviseTemplateStructure`) may persist author-typed guidance.
   */
  keyMessage?: string;
  /**
   * Optional 2-6 short labels naming WHAT DATA/INPUT to collect before this
   * section can be written (e.g. "Latest org chart", "Customer churn by
   * segment, last 4 quarters") — structure guidance describing categories of
   * evidence to gather, never invented values. Distinct from `requiredData`
   * (E14.blueprint's machine-facing gating list feeding the Source Pack
   * matrix): `dataNeeded` is free-text author/AI guidance shown read-only
   * next to `contentHints`, not a gating mechanism. `undefined` means "no
   * guidance yet".
   */
  dataNeeded?: string[];
  /**
   * Optional short description of the TYPE of evidence/source that should
   * back this section's claims (e.g. "quote from stakeholder interview",
   * "benchmark table from survey results") — describes a category of proof,
   * never a specific fabricated citation. `undefined` means "no guidance
   * yet".
   */
  suggestedEvidence?: string;
}

/**
 * Slice E14.blueprint helper — true if any blueprint inside the
 * template demands per-section approval beyond the document-level
 * gate. Powers a future approvals UI affordance ("this template
 * requires N additional per-section approvals before export").
 *
 * Returns `false` for templates whose every blueprint omits
 * `approvalRequired` (legacy behaviour).
 */
export function templateHasPerSectionApprovalRequirements(
  blueprint: TemplateSectionBlueprint[] | undefined | null
): boolean {
  if (!Array.isArray(blueprint) || blueprint.length === 0) return false;
  return blueprint.some((b) => b?.approvalRequired === true);
}

/**
 * Slice E14.blueprint helper — returns the union (deduplicated, in
 * insertion order) of all `requiredData` entries across the
 * template's blueprints. Used by Mode-3 generation to build a
 * top-level "inputs we still need" checklist that also feeds the
 * per-section Source Pack matrix (R13).
 *
 * Empty / unset blueprints contribute nothing; whitespace-only
 * entries are dropped because they are user-input noise.
 */
export function collectTemplateRequiredDataLabels(
  blueprint: TemplateSectionBlueprint[] | undefined | null
): string[] {
  if (!Array.isArray(blueprint) || blueprint.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const section of blueprint) {
    if (!section || !Array.isArray(section.requiredData)) continue;
    for (const label of section.requiredData) {
      if (typeof label !== 'string') continue;
      const trimmed = label.trim();
      if (trimmed.length === 0) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

export interface TemplateExportRules {
  docx: boolean;
  pdf: boolean;
  markdown: boolean;
  approvalRequiredForExport: boolean;
}

/**
 * Canonical Document Template — the artifact that governs Mode 2 ("plan a
 * template") and Mode 3 ("generate from approved template"). Templates are
 * versioned and gated by approval before they become usable in Mode 3.
 *
 * Slice E14 adds an opt-in product-fields surface (usage telemetry +
 * feedback aggregate + classification tags) so the registry can power
 * data-driven recommendations and the FR-06 "discover the right
 * template" loop. Every product field is OPTIONAL and absent on legacy
 * templates; the service treats `undefined` as "no signal yet".
 */
export interface DocumentTemplate {
  templateId: string;
  organizationId: string;
  name: string;
  category: TemplateCategory;
  documentType: DocumentTypeKey;
  purpose: string;
  audience: string[];
  language: 'pl' | 'en';
  languageStyle: DocumentLanguageStyle;
  communicationRegister: CommunicationRegister;
  density: DocumentDensity;
  confidentiality: DocumentConfidentiality;
  requiredInputs: string[];
  sectionBlueprint: TemplateSectionBlueprint[];
  formattingSchema: FormattingSchema;
  exportRules: TemplateExportRules;
  status: TemplateStatus;
  version: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  deprecatedBy?: string;
  deprecatedAt?: string;
  notes?: string;

  // ---------------------------------------------------------------------
  // Slice E14 — product fields. All optional / backwards-compatible.
  // ---------------------------------------------------------------------
  /**
   * Monotonically incremented every time a Mode-3 generation flow
   * applies this template. Backwards-compatible: legacy templates
   * (and freshly drafted templates) report `undefined` until the
   * first `recordTemplateUsage()` call lands.
   */
  usageCount?: number;
  /**
   * ISO timestamp of the most recent `recordTemplateUsage()`. Powers
   * the "recently used" sort order in the FE-E2 template picker
   * without requiring a separate analytics rollup.
   */
  lastUsedAt?: string;
  /**
   * Running average of consultant-supplied quality ratings on a 1..5
   * scale. Computed as `feedbackQualityScore * feedbackSampleSize +
   * newRating` divided by `feedbackSampleSize + 1` on each
   * `recordTemplateFeedback()` call. `undefined` until the first
   * rating arrives.
   */
  feedbackQualityScore?: number;
  /**
   * Number of ratings folded into `feedbackQualityScore`. Surfaced to
   * the UI so reviewers can distinguish "5.0 from 1 rating" from
   * "5.0 from 38 ratings". `undefined` until the first rating
   * arrives.
   */
  feedbackSampleSize?: number;
  /**
   * Audience-classification tags (e.g. 'cto', 'cfo', 'board',
   * 'consultant', 'engineering_lead'). Free-form strings; the
   * recommender uses them to match templates to the active
   * `AudienceProfile` (Epic E9).
   */
  personaTags?: string[];
  /**
   * Geography classification (e.g. 'EU', 'US', 'APAC', 'PL', 'DACH').
   * Free-form strings; the recommender uses them to filter templates
   * by tenant region preference and to surface region-specific
   * variants (e.g. GDPR-aware vs. SOX-aware reports).
   */
  regionTags?: string[];
  /**
   * Industry / brand classification (e.g. 'fintech', 'healthcare',
   * 'retail', 'public_sector'). Free-form strings; the recommender
   * scopes templates to the active organization's industry vertical.
   */
  brandTags?: string[];
  /**
   * Required input dependencies that must be present in the source
   * pack / intake for the template to render meaningfully (e.g.
   * 'requires_financial_data', 'requires_transcript',
   * 'requires_market_sizing'). The recommender hides templates whose
   * dependencies are not satisfied by the current source pack so the
   * Mode-3 flow surfaces only viable options.
   */
  dependencyTags?: string[];
}

export interface TemplateDraftInput {
  name?: string;
  category?: TemplateCategory;
  documentType?: DocumentTypeKey;
  purpose: string;
  audience?: string[];
  language?: 'pl' | 'en';
  languageStyle?: DocumentLanguageStyle;
  communicationRegister?: CommunicationRegister;
  density?: DocumentDensity;
  confidentiality?: DocumentConfidentiality;
  requiredInputs?: string[];
  notes?: string;
}

export type TemplateAuditAction =
  | 'template_drafted'
  | 'template_updated'
  | 'template_approved'
  | 'template_deprecated'
  | 'template_usage_recorded'
  | 'template_feedback_recorded';

export interface TemplateAuditEntry {
  auditId: string;
  templateId: string;
  organizationId: string;
  action: TemplateAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// Source Pack — Epic E4 (chat-first creation entry + connector ingestion).
// =============================================================================

/**
 * Concrete connector vocabulary. The pack registry is connector-agnostic;
 * each connector adapter normalizes its native shape into a `SourcePackItem`
 * that carries enough body text for the LLM and a stable `sourceRef` so the
 * resulting Document can cite the item via the existing
 * `DocumentSourceRef` plumbing without any schema migrations elsewhere.
 *
 *   - url           public web fetch (head + body, HTML stripped to text).
 *   - text          consultant-pasted raw text or markdown.
 *   - file          uploaded file content (text-extractable today; binary
 *                   handling is a follow-up).
 *   - integration   third-party connector (Notion / Drive / SharePoint).
 *                   Only stub validation in MVP; real handlers wire in
 *                   block by block.
 *   - v8_artifact   reference to an existing wave5 artifact in the same
 *                   tenant (e.g. interview transcript, finance pack).
 */
export type SourcePackItemType = 'url' | 'text' | 'file' | 'integration' | 'v8_artifact';

export type SourcePackStatus = 'draft' | 'ready' | 'archived';

export interface SourcePackItem {
  itemId: string;
  itemType: SourcePackItemType;
  title: string;
  /** Normalized text content the LLM can consume. Optional for pure refs. */
  body?: string;
  /** True when the connector trimmed `body` to fit a budget. */
  bodyTruncated?: boolean;
  /** Pre-truncation length (characters). 0 when no body was captured. */
  contentLength: number;
  /** Source URI / file path / integration handle. */
  uri?: string;
  /** ISO timestamp when the connector finished ingestion. */
  ingestedAt: string;
  ingestedBy: string;
  language?: 'pl' | 'en';
  notes?: string;
  /**
   * Stable `DocumentSourceRef` projected when the pack is attached to a
   * document. Built by the connector at ingest time so callers do not have
   * to re-derive the citation shape.
   */
  sourceRef: DocumentSourceRef;
}

export interface SourcePack {
  packId: string;
  organizationId: string;
  name: string;
  description?: string;
  language: 'pl' | 'en';
  items: SourcePackItem[];
  /** Sum of `contentLength` across all items at the moment of last write. */
  totalContentLength: number;
  status: SourcePackStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedBy?: string;
  archivedAt?: string;
  notes?: string;
}

export type SourcePackAuditAction =
  | 'pack_drafted'
  | 'pack_item_added'
  | 'pack_item_removed'
  | 'pack_marked_ready'
  | 'pack_archived'
  | 'pack_attached_to_document';

export interface SourcePackAuditEntry {
  auditId: string;
  packId: string;
  organizationId: string;
  action: SourcePackAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// Epic E13 — Document share-link surface (FR-40)
// =============================================================================

/**
 * Lifecycle status of a `DocumentShareLink`. Links enter as `active`,
 * end either as `revoked` (explicit revoke by the creator or an
 * org admin) or `expired` (passive — `expiresAt` past now at
 * consume-time). Status transitions are one-way: an expired or
 * revoked link is immutable for audit purposes.
 *
 * `expired` is computed lazily by the service at consume / get time
 * to avoid background sweepers; persisted rows may still carry
 * `status: 'active'` while their `expiresAt` is past — the
 * consumer / accessor is the source of truth for the runtime status.
 */
export type DocumentShareLinkStatus = 'active' | 'revoked' | 'expired';

/**
 * Permission scope a share link grants its consumer:
 *
 *   - `read` — render the document (DOCX / PDF / markdown) without
 *     any mutation surface. Always allowed; the safe default.
 *   - `comment` — additionally permits adding comments
 *     (`documentCommentsService.addComment`) without joining the
 *     organization. Useful for client review without onboarding.
 *
 * Future scopes (out of this slice's MVP):
 *   - `edit` — mutate proposals via the editor surface. Requires
 *     a stronger authorization story (audit trail per anonymous
 *     mutation, abuse prevention) before it ships.
 *   - `download` — restrict to render only, no export. Currently
 *     `read` includes export; a follow-up can split that.
 */
export type DocumentShareLinkAccessScope = 'read' | 'comment' | 'download' | 'edit';

/**
 * Audit verbs for `DocumentShareLinkAuditEntry`. Mirrors the
 * `SourcePackAuditAction` style:
 *
 *   - `share_link_created` — link minted.
 *   - `share_link_consumed` — token resolved by an external party.
 *     Multiple `consumed` rows are expected per link (one per
 *     access). Carries optional ip/user-agent hashes for forensic
 *     replay.
 *   - `share_link_revoked` — explicit revoke. Carries a free-text
 *     `reason` in `details` when supplied.
 *   - `share_link_expired_observed` — emitted on the FIRST
 *     consume / get attempt that crosses the `expiresAt` boundary.
 *     Persisted once per link to keep the audit trail finite even
 *     if a stale token is hit thousands of times.
 */
export type DocumentShareLinkAuditAction =
  | 'share_link_created'
  | 'share_link_consumed'
  | 'share_link_revoked'
  | 'share_link_expired_observed'
  | 'share_link_token_rotated';

/**
 * A share link grants scoped, optionally time-boxed access to a
 * `DocumentArtifact` for a party that does NOT have a seat in the
 * owning organization. Typical use cases:
 *
 *   - send-to-client review without onboarding the client into the
 *     workspace;
 *   - share with a partner / advisor for governance comments;
 *   - public preview of an executive memo with `read` scope and a
 *     short expiry.
 *
 * Token contract:
 *
 *   - `token` is a 256-bit URL-safe random string generated server-
 *     side at create time. It is the ONLY field the consumer ever
 *     sees — it MUST NOT carry tenant data, artifact id, or any
 *     other guessable info. The DAO maintains a token → linkId
 *     index for O(1) resolve in `consumeShareLink`.
 *   - `token` is stored opaquely; we do NOT hash it (the in-memory
 *     DAO is a pre-DB stand-in; the wave5 migration can choose to
 *     hash with HMAC-SHA-256 + a per-tenant salt, but this slice
 *     ships the substrate without breaking changes for that
 *     follow-up).
 *
 * Tenant boundary: `organizationId` is the canonical owner. A
 * cross-tenant `getShareLink(linkId, orgB)` returns `null` even if
 * the link exists under `orgA`. `consumeShareLink` is the one
 * exception — it accepts a `token` without an `organizationId`
 * because the consumer does not know the tenant; the DAO resolves
 * the tuple internally.
 */
export interface DocumentShareLink {
  shareLinkId: string;
  artifactId: string;
  organizationId: string;
  /**
   * Opaque URL-safe token (>= 32 chars, server-generated).
   *
   * Slice E13.hardening: in the in-memory MVP DAO this carries the
   * plaintext token for fast resolve + test ergonomics. The wave5
   * migration retires this field and stores ONLY `tokenHash`; the
   * service exposes the plaintext only on the create + rotate
   * responses. Until that migration lands, the persisted row stores
   * both `token` and `tokenHash` so the public surface can swap in
   * a single drop.
   */
  token: string;
  /**
   * Slice E13.hardening — HMAC-SHA-256 hash of the plaintext token,
   * computed with the per-process `SHARE_LINK_TOKEN_SECRET`. The
   * persistence layer stores this column so a DB dump or read-only
   * peer never sees the plaintext token after creation. `undefined`
   * for legacy rows that pre-date the hardening slice.
   */
  tokenHash?: string;
  accessScope: DocumentShareLinkAccessScope;
  status: DocumentShareLinkStatus;
  /**
   * Optional ISO-8601 expiry. When unset, the link does not expire
   * passively (only an explicit `revoke` ends it). When set and
   * past, runtime status reads as `expired` regardless of the
   * persisted `status` field.
   */
  expiresAt?: string;
  /**
   * Optional human-readable label for the right-panel surface.
   * "Q1 client review", "Auditor preview", … Defaults to undefined.
   */
  label?: string;
  /**
   * Free-text reason captured at revoke time. `undefined` for
   * active / expired links.
   */
  revokedReason?: string;
  createdBy: string;
  createdAt: string;
  revokedBy?: string;
  revokedAt?: string;
  /**
   * Total number of successful `consumeShareLink` resolutions for
   * this link. Updated atomically with each consume so the
   * right-panel surface can render "Used 17 times" without
   * scanning the audit trail.
   */
  consumeCount: number;
  /** ISO-8601 timestamp of the last successful consume, or undefined. */
  lastConsumedAt?: string;
}

export interface DocumentShareLinkAuditEntry {
  auditId: string;
  shareLinkId: string;
  artifactId: string;
  organizationId: string;
  action: DocumentShareLinkAuditAction;
  /**
   * For `share_link_created` and `share_link_revoked` this is the
   * actor's user id. For `share_link_consumed` and
   * `share_link_expired_observed` this is `'anonymous'` because the
   * consumer is by definition outside the workspace.
   */
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

/**
 * Test-friendly contract for the runtime status of a link. Computed
 * by the service from the persisted row + current time.
 */
export interface DocumentShareLinkRuntimeStatus {
  effectiveStatus: DocumentShareLinkStatus;
  isUsable: boolean;
  reason?: 'revoked' | 'expired';
}

// =============================================================================
// Epic E7 — Per-tenant Brand Voice profile
// =============================================================================

/**
 * Lifecycle status of a `BrandVoiceProfile`. Profiles enter as `draft`,
 * are promoted to `active` (at most one active row per organization at
 * any time — activation auto-archives the previous active), and end at
 * `archived`. Archived profiles are immutable but stay queryable for
 * audit purposes.
 */
export type BrandVoiceProfileStatus = 'draft' | 'active' | 'archived';

/**
 * Which document languages a profile applies to. `'all'` matches every
 * language; `'pl'` / `'en'` restrict the profile to a single language so
 * a tenant can run different lexicons on PL vs EN documents.
 */
export type BrandVoiceProfileLanguageScope = 'pl' | 'en' | 'all';

/**
 * Glossary entry — a directed pair (avoid, prefer). Brand QA emits a
 * finding when the document uses `avoid` and points the consultant at
 * `prefer` in the suggestion. `note` is optional reviewer guidance.
 */
export interface BrandVoiceGlossaryEntry {
  avoid: string;
  prefer: string;
  note?: string;
}

/**
 * Per-tenant Brand Voice profile. Layered on top of the global banned-
 * phrase catalogue baked into `documentQaService.runBrandQa`:
 *
 *   - `bannedPhrases` ADD to the global list (tenant-specific terms the
 *     org wants to ban: competitor names, deprecated product brands,
 *     internal jargon that leaked into client-facing text, …).
 *   - `disabledGlobalBannedPhrases` SUBTRACT from the global list — an
 *     escape-hatch for the small set of orgs whose voice intentionally
 *     uses one of the global "fluff" words (e.g. an innovation studio
 *     that genuinely sells "rewolucyjny"). Phrase comparison is
 *     case-insensitive.
 *   - `glossaryEntries` are directed (avoid → prefer) and surface a
 *     suggestion alongside the finding.
 *   - `requiredKeywords` are terms that MUST appear in the document at
 *     least once (e.g. company name in client-facing memos). Missing
 *     terms become a finding.
 *   - `registerOverride` lets the tenant pin every document to a stricter
 *     register than the schema requests (e.g. "always score documents
 *     against `executive` even when the schema says `professional`").
 *   - `languageScope` filters which language(s) the profile applies to.
 *
 * Activation rule: at most one `'active'` profile per organization at a
 * time. The service enforces this by auto-archiving the previous active
 * row when a new one is activated.
 */
export interface BrandVoiceProfile {
  profileId: string;
  organizationId: string;
  name: string;
  description?: string;
  status: BrandVoiceProfileStatus;
  /** Monotonic version string per profile id; bumped on every update. */
  version: string;
  languageScope: BrandVoiceProfileLanguageScope;
  bannedPhrases: string[];
  disabledGlobalBannedPhrases: string[];
  preferredPhrases: string[];
  glossaryEntries: BrandVoiceGlossaryEntry[];
  requiredKeywords: string[];
  registerOverride?: CommunicationRegister;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  activatedBy?: string;
  activatedAt?: string;
  archivedBy?: string;
  archivedAt?: string;
}

export interface BrandVoiceProfileDraftInput {
  name: string;
  description?: string;
  languageScope?: BrandVoiceProfileLanguageScope;
  bannedPhrases?: string[];
  disabledGlobalBannedPhrases?: string[];
  preferredPhrases?: string[];
  glossaryEntries?: BrandVoiceGlossaryEntry[];
  requiredKeywords?: string[];
  registerOverride?: CommunicationRegister;
  notes?: string;
}

export interface BrandVoiceProfileUpdateInput {
  name?: string;
  description?: string;
  languageScope?: BrandVoiceProfileLanguageScope;
  bannedPhrases?: string[];
  disabledGlobalBannedPhrases?: string[];
  preferredPhrases?: string[];
  glossaryEntries?: BrandVoiceGlossaryEntry[];
  requiredKeywords?: string[];
  registerOverride?: CommunicationRegister | null;
  notes?: string | null;
}

export type BrandVoiceProfileAuditAction =
  | 'profile_drafted'
  | 'profile_updated'
  | 'profile_activated'
  | 'profile_archived'
  | 'profile_superseded';

export interface BrandVoiceProfileAuditEntry {
  auditId: string;
  profileId: string;
  organizationId: string;
  action: BrandVoiceProfileAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// Epic E9 — Audience-driven warianty
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle status for an AudienceProfile. Mirrors BrandVoiceProfileStatus:
 * profiles start as `'draft'`, become `'active'` (multiple actives allowed
 * per organization, unlike Brand Voice — different audiences are not
 * mutually exclusive), and end as `'archived'` (immutable, queryable).
 *
 * `'system'` profiles seeded by Document Studio itself (board / client /
 * engineering / pmo) are immutable and always `'active'`.
 */
export type AudienceProfileStatus = 'draft' | 'active' | 'archived';

/**
 * Policy for the document's executive summary section under projection.
 *
 *   - `'preserve'` (default): keep the executive summary verbatim.
 *   - `'expand'`: keep + flag for the AI editor to expand later (today
 *     a structural marker only — no LLM call in E9.1).
 *   - `'drop'`: remove the executive summary section entirely (e.g. an
 *     engineering variant that wants to skip the C-level recap).
 */
export type AudienceProfileExecutiveSummaryPolicy = 'preserve' | 'expand' | 'drop';

/** Policy for appendix sections under projection — keep them or drop them all. */
export type AudienceProfileAppendixPolicy = 'preserve' | 'drop';

/**
 * Policy for jargon substitution. Today purely declarative (the projector
 * carries the policy onto the variant for downstream tooling); a future
 * slice may wire this through an AI rewrite pass.
 */
export type AudienceProfileJargonPolicy = 'as_is' | 'plain_language';

/**
 * Section / block tag filter. Both lists are tag-name lists (the same
 * free-form strings authored on `DocumentSection.audienceTags` and
 * `DocumentBlock.audienceTags`).
 *
 *   - `include`: when non-empty, ONLY tagged elements with at least one
 *     matching tag survive. Untagged elements still survive (default-include).
 *   - `exclude`: tagged elements with any matching tag are dropped.
 *
 * `exclude` wins over `include` when both match.
 */
export interface AudienceProfileTagFilter {
  include?: string[];
  exclude?: string[];
}

/**
 * Audience-driven projection profile — Epic E9.
 *
 * An AudienceProfile is the configuration for a single audience-aware
 * variant of a document. Given a base `DocumentSchema`, the projector
 * (`projectDocumentForAudience`) produces a derived schema with:
 *
 *   - schema-level scalar overrides (`audience`, `communicationRegister`,
 *     `density`, `languageStyle`),
 *   - section / block tag filtering,
 *   - executive-summary and appendix policies,
 *   - jargon-policy metadata for downstream rewrite passes.
 *
 * The same audience-tag vocabulary is shared across all profiles in an
 * organization; profiles only differ in which tags they include / exclude
 * and which scalar overrides they apply.
 *
 * Multiple `'active'` AudienceProfiles can coexist per organization (unlike
 * Brand Voice profiles): a single document is typically projected into
 * several variants (board + client + engineering) at export time.
 */
export interface AudienceProfile {
  profileId: string;
  /** Owning organization — `'system'` for built-in seeds. */
  organizationId: string;
  name: string;
  description?: string;
  status: AudienceProfileStatus;
  /** Monotonic version string per profile id; bumped on every update. */
  version: string;
  /**
   * Audience labels written into the projected schema's `audience` array.
   * Empty array → keep the source schema's audience.
   */
  audienceLabels: string[];
  /** Override the source schema's `communicationRegister`. `null`/omitted → inherit. */
  registerOverride?: CommunicationRegister;
  /** Override the source schema's `density`. */
  densityOverride?: DocumentDensity;
  /** Override the source schema's `languageStyle`. */
  languageStyleOverride?: DocumentLanguageStyle;
  /** Section-level audience-tag filter. */
  sectionFilters: AudienceProfileTagFilter;
  /** Block-level audience-tag filter (applied within surviving sections). */
  blockFilters: AudienceProfileTagFilter;
  executiveSummaryPolicy: AudienceProfileExecutiveSummaryPolicy;
  appendixPolicy: AudienceProfileAppendixPolicy;
  jargonPolicy: AudienceProfileJargonPolicy;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  activatedBy?: string;
  activatedAt?: string;
  archivedBy?: string;
  archivedAt?: string;
}

export interface AudienceProfileDraftInput {
  name: string;
  description?: string;
  audienceLabels?: string[];
  registerOverride?: CommunicationRegister;
  densityOverride?: DocumentDensity;
  languageStyleOverride?: DocumentLanguageStyle;
  sectionFilters?: AudienceProfileTagFilter;
  blockFilters?: AudienceProfileTagFilter;
  executiveSummaryPolicy?: AudienceProfileExecutiveSummaryPolicy;
  appendixPolicy?: AudienceProfileAppendixPolicy;
  jargonPolicy?: AudienceProfileJargonPolicy;
  notes?: string;
}

export interface AudienceProfileUpdateInput {
  name?: string;
  description?: string | null;
  audienceLabels?: string[];
  registerOverride?: CommunicationRegister | null;
  densityOverride?: DocumentDensity | null;
  languageStyleOverride?: DocumentLanguageStyle | null;
  sectionFilters?: AudienceProfileTagFilter;
  blockFilters?: AudienceProfileTagFilter;
  executiveSummaryPolicy?: AudienceProfileExecutiveSummaryPolicy;
  appendixPolicy?: AudienceProfileAppendixPolicy;
  jargonPolicy?: AudienceProfileJargonPolicy;
  notes?: string | null;
}

export type AudienceProfileAuditAction =
  'profile_drafted' | 'profile_updated' | 'profile_activated' | 'profile_archived';

export interface AudienceProfileAuditEntry {
  auditId: string;
  profileId: string;
  organizationId: string;
  action: AudienceProfileAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

/**
 * Provenance metadata stamped onto every projected DocumentSchema so a
 * variant can be traced back to its source artifact and the profile that
 * produced it. Returned alongside the projected schema by
 * `projectDocumentForAudience`; not part of the wire-line schema itself
 * (the projector does not mutate `DocumentSchema` to keep it stable).
 */
export interface DocumentVariantProvenance {
  sourceDocumentId: string;
  sourceArtifactId: string;
  profileId: string;
  profileVersion: string;
  projectedAt: string;
  /**
   * Per-section bookkeeping describing what survived projection. Useful
   * for explainability ("why is section X missing in the board variant?").
   */
  sectionsKept: string[];
  sectionsDropped: { sectionId: string; reason: string }[];
  blocksDropped: number;
}

export interface DocumentVariant {
  schema: DocumentSchema;
  provenance: DocumentVariantProvenance;
}

// ────────────────────────────────────────────────────────────────────────────
// Epic E10 — Enterprise Collaboration: Approval workflow
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle state of a single ApprovalRequest.
 *
 *   - `'pending'`           — awaiting decisions from required reviewers.
 *   - `'approved'`          — quorum policy satisfied; document may move
 *                             to `DocumentStatus === 'approved'`.
 *   - `'rejected'`          — at least one required reviewer rejected
 *                             under the active quorum policy.
 *   - `'changes_requested'` — at least one reviewer requested changes;
 *                             the request is closed and the consultant
 *                             must address feedback + open a new approval.
 *   - `'cancelled'`         — author cancelled the approval request
 *                             (e.g. document withdrawn from review).
 *
 * Terminal states: approved, rejected, changes_requested, cancelled.
 */
export type DocumentApprovalStatus =
  'pending' | 'approved' | 'rejected' | 'changes_requested' | 'cancelled';

/** A single reviewer's verdict on an open approval request. */
export type DocumentApprovalDecisionKind = 'approve' | 'reject' | 'request_changes';

/**
 * Quorum policy controlling when the request auto-resolves to `approved`.
 *
 *   - `'unanimous'`       — every required participant must `'approve'`.
 *   - `'majority'`        — strictly more than half of required
 *                           participants must `'approve'`.
 *   - `'single_approval'` — any required participant approving resolves
 *                           the request immediately.
 *
 * Rejection / changes-requested semantics are policy-independent: any
 * required reviewer's `'reject'` flips the request to `'rejected'`, and
 * any `'request_changes'` flips it to `'changes_requested'`.
 */
export type DocumentApprovalQuorumPolicy = 'unanimous' | 'majority' | 'single_approval';

/**
 * Reviewer slot on an approval request.
 *
 * `required` reviewers count toward the quorum. Optional reviewers may
 * still record decisions for visibility but are excluded from the quorum
 * arithmetic so a "FYI" stakeholder does not block approval.
 */
export interface DocumentApprovalParticipant {
  userId: string;
  role?: string;
  required: boolean;
}

/** A single reviewer decision attached to an approval request. */
export interface DocumentApprovalDecision {
  decisionId: string;
  approvalId: string;
  reviewerId: string;
  kind: DocumentApprovalDecisionKind;
  comment?: string;
  occurredAt: string;
}

/**
 * Multi-reviewer approval ticket attached to a document artifact.
 *
 * Lifecycle: `'pending'` → terminal (`'approved'` / `'rejected'` /
 * `'changes_requested'` / `'cancelled'`). At most one non-terminal
 * approval per `(organization, artifact)` pair — the service rejects
 * a second open request with `approval_already_open` so two parallel
 * tracks cannot drift.
 *
 * Decisions are append-only; `recordApprovalDecision` rejects a second
 * decision from the same reviewer with `decision_already_recorded` to
 * keep the audit trail honest.
 */
export interface DocumentApprovalRequest {
  approvalId: string;
  organizationId: string;
  artifactId: string;
  requestedBy: string;
  participants: DocumentApprovalParticipant[];
  quorumPolicy: DocumentApprovalQuorumPolicy;
  status: DocumentApprovalStatus;
  decisions: DocumentApprovalDecision[];
  reason?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentApprovalAuditAction =
  'approval_requested' | 'approval_decision_recorded' | 'approval_resolved' | 'approval_cancelled';

export interface DocumentApprovalAuditEntry {
  auditId: string;
  approvalId: string;
  organizationId: string;
  artifactId: string;
  action: DocumentApprovalAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// Epic E10 — Enterprise Collaboration: Reusable Content Block library
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle status for a Content Block library entry. Mirrors the
 * BrandVoiceProfile / AudienceProfile lifecycle: `draft → active →
 * archived`. Archived entries stay queryable for audit but cannot be
 * inserted into new documents.
 */
export type DocumentContentBlockStatus = 'draft' | 'active' | 'archived';

/**
 * Reusable, named content snippet stored in the tenant's library so a
 * consultant can re-use boilerplate language (standard intros,
 * compliance disclaimers, methodology blurbs, …) across documents
 * without copy/pasting from older artifacts.
 *
 * The `block` is a payload-only `DocumentBlock` — the same shape used
 * inside a `DocumentSection.blocks` array. Inserting a content block
 * into a document allocates a fresh `blockId` so two copies of the
 * same library entry never share an id.
 *
 * Multiple `'active'` content blocks are allowed (different blocks
 * serve different purposes). The library is tenant-scoped; system
 * seeds may ship in a future slice.
 */
export interface DocumentContentBlockTemplate {
  contentBlockId: string;
  organizationId: string;
  name: string;
  description?: string;
  status: DocumentContentBlockStatus;
  /** Monotonic version string per content-block id; bumped on every update. */
  version: string;
  /** Optional free-form tags (e.g. 'compliance', 'standard_intro'). */
  tags: string[];
  /** Document types the snippet is intended for; empty array → applicable to all types. */
  documentTypes: DocumentTypeKey[];
  /** Language scope (`'all'` matches every language, otherwise a specific one). */
  languageScope: 'pl' | 'en' | 'all';
  /** Payload — the same shape as a `DocumentBlock` inside a section. */
  block: Omit<DocumentBlock, 'blockId'>;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  activatedBy?: string;
  activatedAt?: string;
  archivedBy?: string;
  archivedAt?: string;
}

export interface DocumentContentBlockDraftInput {
  name: string;
  description?: string;
  tags?: string[];
  documentTypes?: DocumentTypeKey[];
  languageScope?: 'pl' | 'en' | 'all';
  block: Omit<DocumentBlock, 'blockId'>;
  notes?: string;
}

export interface DocumentContentBlockUpdateInput {
  name?: string;
  description?: string | null;
  tags?: string[];
  documentTypes?: DocumentTypeKey[];
  languageScope?: 'pl' | 'en' | 'all';
  block?: Omit<DocumentBlock, 'blockId'>;
  notes?: string | null;
}

export type DocumentContentBlockAuditAction =
  | 'content_block_drafted'
  | 'content_block_updated'
  | 'content_block_activated'
  | 'content_block_archived';

export interface DocumentContentBlockAuditEntry {
  auditId: string;
  contentBlockId: string;
  organizationId: string;
  action: DocumentContentBlockAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

/**
 * Slice FR-37.access-history — unified access-history aggregator.
 *
 * Surfaces a chronological feed of every meaningful event that
 * touched a `DocumentArtifact`, drawing from the per-service audit
 * stores: the document-level audit (`listDocumentAuditEntries`),
 * the share-link audit (`listShareLinkAuditEntries`), and the
 * approval audit (`listDocumentApprovalAuditEntries`).
 *
 * Each entry preserves the raw action verb from the underlying
 * audit row so the UI / analytics can categorize without forcing
 * the aggregator to pre-classify.
 */
export type DocumentAccessHistorySource = 'document_audit' | 'share_link' | 'approval';

export interface DocumentAccessHistoryEntry {
  /** Composite id `${source}::${origin row's auditId}` for stable React keys. */
  entryId: string;
  source: DocumentAccessHistorySource;
  artifactId: string;
  organizationId: string;
  /** `userId` for authed actions, `'anonymous-{shareLinkId}'` for public consumes. */
  actorId: string;
  /** Raw action verb (`proposal_executed`, `share_link_consumed`, ...). */
  action: string;
  occurredAt: string;
  /**
   * Origin entity id (share-link id, approval id, comment id, etc.).
   * `undefined` for `document_audit` rows that don't carry an origin.
   */
  sourceId?: string;
  details?: Record<string, unknown>;
}

/**
 * Slice E15.5.coverPageLogo — tenant-scoped binary asset registry.
 *
 * Stores small visual assets (currently `'logo'`) so the renderer
 * can embed them on the cover page when `formattingSchema.coverPageDetailed.includeLogo`
 * is set. Substrate is intentionally narrow (logos only) so the
 * abuse story is small; richer media (header banners, watermarks,
 * cover art) extend the same surface in follow-ups.
 *
 * Constraints enforced by the service:
 *   - PNG / JPEG MIME types only;
 *   - Hard size cap (`DOCUMENT_ASSET_MAX_BYTES` = 5 MB raw);
 *   - At most one `'active'` asset per (org, kind) tuple — registering
 *     a new logo auto-archives the previous one. Audit row records the
 *     archive event with `auto_archived_by_replacement = true`.
 */
export type DocumentAssetKind = 'logo';
export type DocumentAssetStatus = 'active' | 'archived';
export type DocumentAssetMimeType = 'image/png' | 'image/jpeg';

export interface DocumentAsset {
  assetId: string;
  organizationId: string;
  kind: DocumentAssetKind;
  status: DocumentAssetStatus;
  mimeType: DocumentAssetMimeType;
  /** Base64-encoded asset bytes. Decode with `Buffer.from(dataBase64, 'base64')`. */
  dataBase64: string;
  /** Decoded byte size. Cached so we don't decode just to read length. */
  byteLength: number;
  /** Human-friendly file label for UI (e.g. "company-logo-2026.png"). */
  filename?: string;
  createdBy: string;
  createdAt: string;
  archivedBy?: string;
  archivedAt?: string;
  archiveReason?: string;
}

export type DocumentAssetAuditAction = 'asset_registered' | 'asset_archived' | 'asset_replaced';

export interface DocumentAssetAuditEntry {
  auditId: string;
  assetId: string;
  organizationId: string;
  action: DocumentAssetAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

/** Canonical default consulting formatting schema for Mode 1 (no template). */
export const DEFAULT_CONSULTING_FORMATTING_SCHEMA: FormattingSchema = {
  fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
  headingStyles: {
    h1: '16pt bold numbered',
    h2: '13pt bold numbered',
    h3: '11pt bold',
  },
  tableStyles: { default: 'consultify_clean_table' },
  listStyles: { bullet: 'consultify_bullet', numbered: 'consultify_numbered' },
  page: { size: 'A4', marginsCm: { top: 2.0, bottom: 2.0, left: 2.3, right: 2.3 } },
  headers: { enabled: true },
  footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
  toc: true,
  coverPage: true,
  appendixStyle: 'lettered',
  citationStyle: 'inline_marker',
};
