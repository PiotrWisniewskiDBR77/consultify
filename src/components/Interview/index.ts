/**
 * Interview Module - v2.0 ModuleHub Golden Standard
 *
 * 5 Categories: Strategy, Operations, Digital, People, Finance
 * Task-list style with inline edit, status per question, confidence score
 * 4 Tabs: Questions, Notes, Evidence, Summary
 * ONLY facts - NO recommendations
 *
 * @see docs/wdrozenia/UI_UX_GOLDEN_STANDARD.md
 * @see PROMPT 8 in wdrozenia/PROMPTY_DLA_AGENTOW.md
 */

// Main Hub (Golden Standard)
export { InterviewHub } from './InterviewHub';

// Main workspace
export { InterviewWorkspace } from './InterviewWorkspace';

// Assignment Modal
export { AssignInterviewModal } from './AssignInterviewModal';

// Template Builder
export { TemplateBuilder } from './TemplateBuilder';

// Insight Creator Modal
export { InsightCreatorModal } from './InsightCreatorModal';

// Insight Viewer
export { InsightViewer } from './InsightViewer';

// Components
export { CATEGORY_CONFIG, CATEGORY_ORDER, CategorySidebar } from './CategorySidebar';
export { CompanyFactsPanel } from './CompanyFactsPanel';
export { EvidencePanel } from './EvidencePanel';
export { InterviewSingleQuestionRuntime } from './InterviewSingleQuestionRuntime';
export { NotesPanel } from './NotesPanel';
export { QuestionsList } from './QuestionsList';

// V3-D01/D02 support components
export { RuntimeModeSelector } from './RuntimeModeSelector';
export { SufficiencyIndicator } from './SufficiencyIndicator';

// Legacy components (for backward compatibility)
export { InterviewContextBanner } from './InterviewContextBanner';
export { InterviewSummary } from './InterviewSummary';

// Types
export type { CategoryProgress, CategorySidebarProps, InterviewCategory } from './CategorySidebar';
export type {
  CompanyFactsPanelProps,
  CompanyProfile,
  KeyMetric,
  OpenGap,
  Stakeholder,
} from './CompanyFactsPanel';
export type { EvidencePanelProps, EvidenceType, InterviewEvidence } from './EvidencePanel';
export type { InterviewNote, NotesPanelProps } from './NotesPanel';
export type { InterviewQuestion, QuestionsListProps, QuestionStatus } from './QuestionsList';
export type { RuntimeMode, RuntimeModeSelectorProps } from './RuntimeModeSelector';
export type { SufficiencyCriterion, SufficiencyIndicatorProps } from './SufficiencyIndicator';
