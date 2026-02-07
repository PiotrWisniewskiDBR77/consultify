/**
 * Presentation Generation System — Public API
 *
 * BCG-grade PPTX pipeline.
 * Import from this file for all presentation generation needs.
 */

// Core service
export { PptxPipelineService, default as PptxPipelineServiceDefault } from './PptxPipelineService.js';
export type { PipelineOptions, PipelineResult } from './PptxPipelineService.js';

// Types
export type {
  UnifiedReportJSON,
  UnifiedReportMeta,
  UnifiedSlide,
  SlideIntent,
  SlideContent,
  DesignTokens,
  RenderedElement,
  LayoutResult,
  ValidationResult,
  RuleViolation,
  KpiData,
  AxisScore,
  ChartDataSet,
  TableData,
} from './types.js';

// Design tokens
export { getDesignTokens, corporateTokens, minimalTokens, modernTokens } from './designTokens.js';

// Transformer
export { transformToUnifiedJson } from './UnifiedJsonTransformer.js';
export type { TransformOptions } from './UnifiedJsonTransformer.js';

// Rules engine
export { validateReport, decideRecommendationIntent, decideKpiIntent } from './RulesEngine.js';

// Intent resolver
export { resolveIntent, inferIntentFromContent, getAllIntents } from './IntentResolver.js';

// Layout registry
export { resolveLayout, LAYOUT_REGISTRY } from './layouts/index.js';
