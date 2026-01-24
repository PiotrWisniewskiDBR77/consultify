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

// Components
export { CategorySidebar, CATEGORY_CONFIG, CATEGORY_ORDER } from './CategorySidebar';
export { QuestionsList } from './QuestionsList';
export { NotesPanel } from './NotesPanel';
export { EvidencePanel } from './EvidencePanel';
export { CompanyFactsPanel } from './CompanyFactsPanel';

// Legacy components (for backward compatibility)
export { InterviewSummary } from './InterviewSummary';
export { InterviewContextBanner } from './InterviewContextBanner';

// Types
export type { InterviewCategory, CategoryProgress, CategorySidebarProps } from './CategorySidebar';
export type { QuestionStatus, InterviewQuestion, QuestionsListProps } from './QuestionsList';
export type { InterviewNote, NotesPanelProps } from './NotesPanel';
export type { EvidenceType, InterviewEvidence, EvidencePanelProps } from './EvidencePanel';
export type { CompanyProfile, KeyMetric, Stakeholder, OpenGap, CompanyFactsPanelProps } from './CompanyFactsPanel';
