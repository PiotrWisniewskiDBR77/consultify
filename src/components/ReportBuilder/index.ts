/**
 * Report Builder Components
 */

// Main Editor (Gamma-style)
export { ReportEditor } from './ReportEditor';

// Legacy Wizard (removed 2026-07-27 — never imported)
export { useReportBuilder } from './useReportBuilder';

// Steps (legacy)
export { ConfigureStructureStep } from './steps/ConfigureStructureStep';
export { GenerateStep } from './steps/GenerateStep';
export { ReviewEditStep } from './steps/ReviewEditStep';
export { SourceSelectStep } from './steps/SourceSelectStep';

// Composer
export { ReportsComposer } from './ReportsComposer';

// Types
export type {
  CanApproveResult,
  CommentAnchor,
  CommentPriority,
  CommentStatus,
  CommentSummary,
  CommentType,
  Report,
  ReportBuilderState,
  ReportComment,
  ReportSection,
  ReportSourceType,
  ReportStatus,
  SectionLanguage,
  SectionLength,
  SourceOption,
  TemplateSection,
} from './useReportBuilder';
