/**
 * Presentation Generation System — Core Types
 *
 * BCG-grade type definitions for the component-based PPTX pipeline.
 * Implements the Unified Report JSON model and all mapping interfaces.
 */

// ============================================================
// SLIDE INTENT — narrative purpose of each slide
// ============================================================

export type SlideIntent =
  | 'cover'
  | 'executive_summary'
  | 'section_intro'
  | 'key_messages'
  | 'performance_overview'
  | 'single_insight'
  | 'comparison'
  | 'assessment'
  | 'root_cause'
  | 'recommendation_single'
  | 'recommendation_portfolio'
  | 'initiative_portfolio'
  | 'prioritization_matrix'
  | 'roadmap'
  | 'risk_management'
  | 'next_steps'
  | 'appendix';

// ============================================================
// UNIFIED REPORT JSON — single source of truth
// ============================================================

export interface UnifiedReportMeta {
  client: string;
  project: string;
  date: string;
  author: string;
  confidentiality: 'confidential' | 'internal' | 'public';
  framework?: string;
  sourceType?: string;
  language: 'en' | 'pl';
  brandColor?: string;
  template?: 'corporate' | 'minimal' | 'modern';
  customTemplate?: import('../../presentationTemplateRuntimeService.js').PresentationCustomTemplateDefinition;
  templateId?: string;
  templateVersion?: number;
}

export interface UnifiedSlide {
  intent: SlideIntent;
  key_message: string;
  content: SlideContent;
  /**
   * Optional visuals for this slide (Gamma-like).
   * When present and the renderer supports it, visuals are embedded via `addImage`.
   */
  visuals?: SlideVisualSpec[];
  /**
   * Sprint S15 — Layout audit flags carried over from
   * `presentationStudioLayoutAuditService`. When present and non-empty,
   * the renderer attaches an inline truncation/review marker so the
   * exported artifact is honest about the warnings the audit raised
   * (e.g. an overflowing title that the renderer would otherwise
   * silently truncate). Closes R-S13-4.
   *
   * Values are the audit's stable `LayoutAuditFlag` ids (e.g.
   * `'layout_overflow_title'`, `'missing_source_for_evidence_intent'`,
   * `'unsupported_intent_for_pptx_export'`). The PPTX module keeps the
   * field as `string[]` rather than typed against `LayoutAuditFlag` to
   * avoid a circular import between PPTX types ← generator ← audit.
   * The marker helper validates the strings before rendering.
   *
   * Backward compatible: legacy callers leave the field unset; the
   * renderer treats `undefined`/empty arrays as "no marker".
   */
  auditFlags?: string[];
  /**
   * STEP 1b — per-slide composition plan carried from B1
   * (`presentationLayoutDirectorService.SlideComposition`). Additive +
   * back-compatible: legacy callers leave it unset, and the persisted
   * `unifiedJson` simply omits it, so the FE renderer keeps its pure
   * heuristic (today's behaviour). When present, it flows through the
   * persisted deck to the FE (`deckFromUnifiedJson` → `DeckCard.composition`)
   * where `layoutVariantId`/`regions` drive layout selection.
   *
   * Typed structurally (not against `SlideComposition`) to avoid a circular
   * import between PPTX types ← generator ← layout director. The FE
   * `normalizeSlideComposition` re-validates before use.
   */
  composition?: {
    layoutVariantId?: string;
    regions?: { area: string; blockTypes?: string[] }[];
    emphasis?: string;
  } | null;
}

export interface UnifiedReportJSON {
  meta: UnifiedReportMeta;
  slides: UnifiedSlide[];
}

// ============================================================
// VISUALS (image generation / embedding)
// ============================================================

export type SlideVisualSlot =
  | 'cover_bg'
  | 'hero'
  | 'side_illustration'
  | 'icon_strip'
  | 'diagram'
  | 'background_texture'
  | 'decorative_accent';

export interface SlideVisualAssetRef {
  /**
   * Local filesystem path (preferred for PPTX generation on the server).
   * Example: exports/presentations/assets/<deckId>/cover.png
   */
  path?: string;
  /** Data URI: data:image/png;base64,... (fallback) */
  dataUri?: string;
  /** Remote URL (must be downloaded before PPTX render) */
  url?: string;

  provider?: string;
  model_id?: string;
}

export interface SlideVisualSpec {
  slot: SlideVisualSlot;
  /** SSOT v3: image_* purpose */
  purpose: 'image_cover' | 'image_diagram' | 'image_slide_asset';
  /** Human-readable label for audit/debug */
  label?: string;

  // Generation hints (optional; may be ignored by some providers)
  prompt?: string;
  negativePrompt?: string;
  styleHint?: string;
  palette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
  };

  // Output constraints
  aspect?: '16:9' | '4:3' | '1:1' | '3:2' | '9:16';
  widthPx?: number;
  heightPx?: number;

  asset?: SlideVisualAssetRef;
}

// ============================================================
// SLIDE CONTENT — structured data per intent
// ============================================================

export type SlideContent =
  | CoverContent
  | ExecutiveSummaryContent
  | SectionIntroContent
  | KeyMessagesContent
  | PerformanceOverviewContent
  | SingleInsightContent
  | ComparisonContent
  | AssessmentContent
  | RootCauseContent
  | RecommendationSingleContent
  | RecommendationPortfolioContent
  | InitiativePortfolioContent
  | PrioritizationMatrixContent
  | RoadmapContent
  | RiskManagementContent
  | NextStepsContent
  | AppendixContent;

export interface CoverContent {
  type: 'cover';
  title: string;
  subtitle?: string;
  organization: string;
  date: string;
  confidentiality?: string;
}

export interface ExecutiveSummaryContent {
  type: 'executive_summary';
  headline: string;
  kpis?: KpiData[];
  key_findings: string[];
  recommendation?: string;
}

export interface SectionIntroContent {
  type: 'section_intro';
  section_title: string;
  section_number?: number;
  description?: string;
}

export interface KeyMessagesContent {
  type: 'key_messages';
  messages: Array<{
    title: string;
    description: string;
    icon?: string;
  }>;
}

export interface PerformanceOverviewContent {
  type: 'performance_overview';
  kpis: KpiData[];
  period?: string;
  context?: string;
}

export interface SingleInsightContent {
  type: 'single_insight';
  chart_type: 'bar' | 'line' | 'pie' | 'radar' | 'gauge';
  chart_data: ChartDataSet;
  insight_text: string;
  source?: string;
}

export interface ComparisonContent {
  type: 'comparison';
  left_label: string;
  right_label: string;
  left_items: string[];
  right_items: string[];
  verdict?: string;
}

export interface AssessmentContent {
  type: 'assessment';
  matrix_type: 'heatmap' | 'maturity' | 'radar';
  axes: AxisScore[];
  scale_max: number;
  overall_score?: number;
}

export interface RootCauseContent {
  type: 'root_cause';
  problem: string;
  causes: Array<{
    cause: string;
    impact: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}

export interface RecommendationSingleContent {
  type: 'recommendation_single';
  title: string;
  description: string;
  impact: string;
  effort: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timeline?: string;
}

export interface RecommendationPortfolioContent {
  type: 'recommendation_portfolio';
  recommendations: Array<{
    title: string;
    description: string;
    impact: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    category?: string;
  }>;
}

export interface RoadmapContent {
  type: 'roadmap';
  phases: Array<{
    label: string;
    timeframe: string;
    items: string[];
    status?: 'completed' | 'in_progress' | 'planned';
  }>;
}

export interface RiskManagementContent {
  type: 'risk_management';
  risks: Array<{
    risk: string;
    likelihood: 'high' | 'medium' | 'low';
    impact: 'high' | 'medium' | 'low';
    mitigation: string;
    owner?: string;
  }>;
}

export interface NextStepsContent {
  type: 'next_steps';
  actions: Array<{
    action: string;
    owner?: string;
    deadline?: string;
    status?: 'pending' | 'in_progress' | 'done';
  }>;
  closing_message?: string;
}

export interface AppendixContent {
  type: 'appendix';
  title: string;
  body: string;
  tables?: TableData[];
  footnotes?: string[];
}

export interface InitiativePortfolioContent {
  type: 'initiative_portfolio';
  initiatives: Array<{
    name: string;
    summary?: string;
    strategicIntent?: 'Grow' | 'Fix' | 'Stabilize' | 'De-risk' | 'Build Capability' | string;
    strategicRole?: 'Foundation' | 'Enabler' | 'Accelerator' | 'Scaling' | string;
    priority?: 'critical' | 'high' | 'medium' | 'low';
    timeline?: string;
    impact?: number; // 1-5
    effort?: number; // 1-5
    effortProfile?: { analytical: number; operational: number; change: number };
    budget?: string;
    roi?: string;
    owner?: string;
    relatedGap?: string;
    relatedAxis?: string;
    tags?: string[];
  }>;
}

export interface PrioritizationMatrixContent {
  type: 'prioritization_matrix';
  quadrants: Array<{
    label: string;
    position: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
    items: Array<{
      name: string;
      description?: string;
    }>;
  }>;
  xAxisLabel: string;
  yAxisLabel: string;
}

// ============================================================
// DATA PRIMITIVES
// ============================================================

export interface KpiData {
  name: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  target?: number | string;
  delta?: number | string;
  status?: 'good' | 'warning' | 'critical';
}

export interface AxisScore {
  axisId: string;
  axisName: string;
  score: number;
  maxScore: number;
  target?: number;
  gap?: number;
}

export interface ChartDataSet {
  labels: string[];
  series: Array<{
    name: string;
    values: number[];
    color?: string;
  }>;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

// ============================================================
// ATOMIC COMPONENT INTERFACES
// ============================================================

/** Position + size on a slide (inches, 16:9 = 10×5.625) */
export interface ElementPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Base props every atomic component receives */
export interface AtomicProps {
  position: ElementPosition;
}

/** A rendered element — the thing an atomic returns */
export interface RenderedElement {
  kind: 'text' | 'shape' | 'table' | 'chart' | 'image';
  apply: (slide: any) => void;
}

// ============================================================
// COMPOSITE COMPONENT INTERFACE
// ============================================================

export interface CompositeResult {
  elements: RenderedElement[];
}

// ============================================================
// LAYOUT INTERFACE
// ============================================================

export interface LayoutResult {
  masterName: string;
  elements: RenderedElement[];
  slideOptions?: Record<string, any>;
}

/**
 * P13 — ekran = eksport parity. The on-screen deck editor resolves each slide's
 * layout template (honouring `composition.layoutVariantId` + W7 guard-split) via
 * the FE `LayoutEngine`. The PPTX pipeline computes the SAME decision through
 * `deckLayoutDecision.resolveDeckLayoutTemplateId(slide)` and passes it to the
 * intent-bound layout function as this OPTIONAL context, so a layout that has
 * more than one composition variant (e.g. Cover: centered vs left-image vs
 * bottom-strip) renders the same shape the screen shows. Layouts that don't read
 * it are unaffected (fully back-compatible).
 */
export interface LayoutContext {
  /** Canonical `LAYOUT_TEMPLATES` id the FE would render for this slide. */
  resolvedLayoutTemplateId: string;
  /** Coarse topology of that template (stacked / split / kpi_grid / image_split / three_col). */
  topology: 'stacked' | 'split' | 'kpi_grid' | 'image_split' | 'three_col';
}

export interface LayoutDefinition {
  id: string;
  intent: SlideIntent;
  render: (slide: UnifiedSlide, meta: UnifiedReportMeta, tokens: DesignTokens) => LayoutResult;
}

// ============================================================
// DESIGN TOKENS
// ============================================================

export interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    textInverse: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    border: string;
    muted: string;
  };
  fonts: {
    title: string;
    body: string;
    mono: string;
  };
  fontSizes: {
    slideTitle: number;
    sectionTitle: number;
    heading: number;
    subheading: number;
    body: number;
    caption: number;
    footnote: number;
    kpiValue: number;
    kpiLabel: number;
  };
  spacing: {
    margin: number; // slide edge margin
    gutter: number; // gap between columns
    paragraphGap: number; // gap between paragraphs
    elementGap: number; // gap between elements
  };
  grid: {
    slideW: number; // 10 (inches, 16:9)
    slideH: number; // 5.625
    contentX: number; // left margin
    contentY: number; // below header
    contentW: number; // usable width
    contentH: number; // usable height
    headerH: number; // header bar height
    footerY: number; // footer y position
  };
}

// ============================================================
// RULES ENGINE
// ============================================================

export interface RuleViolation {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
  slideIndex?: number;
}

export interface ValidationResult {
  valid: boolean;
  violations: RuleViolation[];
}
