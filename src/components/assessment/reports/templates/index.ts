/**
 * Assessment Report Templates Index
 *
 * Exports report templates for all supported assessment frameworks:
 * - DRD (Digital Readiness Diagnosis) - existing, uses legacy components
 * - SIRI (Smart Industry Readiness Index) - Singapore EDB
 * - ADMA (Advanced Digital Maturity Assessment) - European Commission
 * - CMMI (Capability Maturity Model Integration) - ISACA
 * - DBR77 Lean 4.0 (Pomierz-Zoptymalizuj-Automatyzuj) - Consultify proprietary
 */

export { ADMAReportTemplate } from './ADMAReportTemplate';
export { CMMIReportTemplate } from './CMMIReportTemplate';
export { DBR77ReportTemplate } from './DBR77ReportTemplate';
export { DRDReportTemplate } from './DRDReportTemplate';
export { SIRIReportTemplate } from './SIRIReportTemplate';

// Visualization components
export type {
  AssessmentFramework,
  AssessmentVisualizationData,
  DimensionScore,
} from '../AssessmentReportVisualizations';
export {
  AssessmentRadarChart,
  AssessmentVisualizationDashboard,
  DimensionBars,
  GapHeatmap,
  ScoreCard,
  ScoreCardsGrid,
} from '../AssessmentReportVisualizations';
