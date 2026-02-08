/**
 * Report Builder Components
 */

// Main Editor (Gamma-style)
export { ReportEditor } from './ReportEditor';

// Legacy Wizard (kept for compatibility)
export { ReportBuilderWizard } from './ReportBuilderWizard';
export { useReportBuilder } from './useReportBuilder';

// Steps (legacy)
export { ConfigureStructureStep } from './steps/ConfigureStructureStep';
export { GenerateStep } from './steps/GenerateStep';
export { ReviewEditStep } from './steps/ReviewEditStep';
export { SourceSelectStep } from './steps/SourceSelectStep';

// Composer
export { ReportsComposer } from './ReportsComposer';

// Comment Panel
export { ReportBuilderCommentPanel } from './ReportBuilderCommentPanel';

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
