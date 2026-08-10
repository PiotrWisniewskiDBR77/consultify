/**
 * Shared components for MyWork detail views
 * C-style (dense) design following Golden Standard
 */

export type { Attachment } from './AttachmentsSection';
export { AttachmentsSection } from './AttachmentsSection';
export type { Comment } from './CommentsSection';
export { CommentsSection } from './CommentsSection';
export type { DelegationType } from './DelegationModal';
export { DelegationModal } from './DelegationModal';
export { DraggableTaskRow } from './DraggableTaskRow';
export type { EscalationRule, ReminderRule, WarningThresholds } from './EscalationRulesSection';
export { EscalationRulesSection } from './EscalationRulesSection';
export { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
export type { LinkedItem, LinkedItemType, LinkRelationType } from './LinkedItemsSection';
export { LinkedItemsSection } from './LinkedItemsSection';
export { QuickActions } from './QuickActions';
export type {
  NotificationTrigger,
  Stakeholder,
  StakeholderNotificationSettings,
  StakeholderRole,
} from './StakeholdersSection';
export { StakeholdersSection } from './StakeholdersSection';
export type { RecurringPattern, TaskTemplate } from './TaskTemplates';
export { TaskTemplates } from './TaskTemplates';
export { TaskTimer } from './TaskTimer';

// Decision-specific components
export type { Alternative } from './AlternativesSection';
export { AlternativesSection } from './AlternativesSection';
export { DeadlineAlertBanner } from './DeadlineAlertBanner';
export type { DecisionReadinessData } from './DecisionReadinessBar';
export { DecisionReadinessBar } from './DecisionReadinessBar';
export type { ImpactValues } from './ImpactAssessmentCompact';
export { ImpactAssessmentCompact } from './ImpactAssessmentCompact';
export type { RiskItem } from './RiskAssessmentCompact';
export { RiskAssessmentCompact } from './RiskAssessmentCompact';

// Presentation mode switcher (shared across all detail views)
export { PresentationModeSwitcher } from './PresentationModeSwitcher';

// Task-specific components
export type { AIInsight } from './AIInsightSection';
export { AIInsightSection } from './AIInsightSection';
export type { DependencyType, TaskDependency } from './DependenciesSection';
export { DependenciesSection } from './DependenciesSection';
export type { EvidenceItem, EvidenceType } from './EvidenceSection';
export { EvidenceSection } from './EvidenceSection';
export type { ImplementationIdea } from './ImplementationIdeasSection';
export { ImplementationIdeasSection } from './ImplementationIdeasSection';
