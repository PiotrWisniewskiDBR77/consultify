/**
 * Assessment Report Templates Index
 *
 * Exports report templates for all supported assessment frameworks:
 * - DRD (Digital Readiness Diagnosis) - existing, uses legacy components
 * - SIRI (Smart Industry Readiness Index) - Singapore EDB
 * - ADMA (Advanced Digital Maturity Assessment) - European Commission
 * - CMMI (Capability Maturity Model Integration) - ISACA
 * - DBR77 Lean 4.0 (Pomierz-Zoptymalizuj-Automatyzuj) - Consultinity proprietary
 */

export { ADMAReportTemplate } from './ADMAReportTemplate';
export { CMMIReportTemplate } from './CMMIReportTemplate';
export { DBR77ReportTemplate } from './DBR77ReportTemplate';
export { SIRIReportTemplate } from './SIRIReportTemplate';

// Visualization components
export {
  AssessmentVisualizationDashboard,
  AssessmentRadarChart,
  GapHeatmap,
  DimensionBars,
  ScoreCardsGrid,
  ScoreCard,
} from '../AssessmentReportVisualizations';

export type {
  AssessmentVisualizationData,
  DimensionScore,
  AssessmentFramework,
} from '../AssessmentReportVisualizations';
