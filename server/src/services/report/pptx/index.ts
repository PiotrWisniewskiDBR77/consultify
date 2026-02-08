/**
 * Presentation Generation System — Public API
 *
 * BCG-grade PPTX pipeline.
 * Import from this file for all presentation generation needs.
 */

// Core service
export type { PipelineOptions, PipelineResult } from './PptxPipelineService.js';
export {
  PptxPipelineService,
  default as PptxPipelineServiceDefault,
} from './PptxPipelineService.js';

// Types
export type {
  AxisScore,
  ChartDataSet,
  DesignTokens,
  KpiData,
  LayoutResult,
  RenderedElement,
  RuleViolation,
  SlideContent,
  SlideIntent,
  TableData,
  UnifiedReportJSON,
  UnifiedReportMeta,
  UnifiedSlide,
  ValidationResult,
} from './types.js';

// Design tokens
export { corporateTokens, getDesignTokens, minimalTokens, modernTokens } from './designTokens.js';

// Transformer
export type { TransformOptions } from './UnifiedJsonTransformer.js';
export { transformToUnifiedJson } from './UnifiedJsonTransformer.js';

// Rules engine
export { decideKpiIntent, decideRecommendationIntent, validateReport } from './RulesEngine.js';

// Intent resolver
export { getAllIntents, inferIntentFromContent, resolveIntent } from './IntentResolver.js';

// Layout registry
export { LAYOUT_REGISTRY, resolveLayout } from './layouts/index.js';
