/**
 * Initiative Sections - Barrel export
 */

// Core infrastructure
export { CollapsibleSection } from './CollapsibleSection';
export { InitiativeContext, useInitiativeContext } from './InitiativeContext';
export type { InitiativeContextValue } from './InitiativeContext';
export { SECTION_REGISTRY, getSectionComponent, DEFAULT_SECTION_ORDER, DEFAULT_VISIBLE_SECTIONS } from './registry';
export type { InitiativeSectionProps, SectionTypeInfo } from './types';

// Re-export types and constants
export type { Decision, RaidItem, Watcher, HistoryEvent, TaskItem, UserInfo, PendingApproval } from './types';
export {
  GATE_DEFINITIONS, GATE_CONFIG, MODULE_CONFIG, PRIORITY_CONFIG,
  RAID_TYPE_CONFIG, SEVERITY_CONFIG,
  getModuleFromStatus, getNextGateForStatus, getRoleLabel,
} from './types';

// Section components
export { OverviewSection } from './OverviewSection';
export { CommentsSection } from './CommentsSection';
export { TasksMilestonesSection } from './TasksMilestonesSection';
export { DecisionsSection } from './DecisionsSection';
export { RaidSection } from './RaidSection';
export { GateReadinessSection } from './GateReadinessSection';
export { FinancialAnalysisSection } from './FinancialAnalysisSection';
export { FinancialImpactSection } from './FinancialImpactSection';
export { HistorySection } from './HistorySection';
export { ControlSection } from './ControlSection';
export { TeamSection } from './TeamSection';
export { TimelineSection } from './TimelineSection';
export { AttachmentsSection } from './AttachmentsSection';
export { LinkedItemsSection } from './LinkedItemsSection';
export { StakeholdersSection } from './StakeholdersSection';
export { DependenciesSection } from './DependenciesSection';
export { RemindersSection } from './RemindersSection';
export { TagsSection } from './TagsSection';

// Phase 2 - New structured sections
export { ProblemDefinitionSection } from './ProblemDefinitionSection';
export { TargetStateSection } from './TargetStateSection';
export { ScopeSection } from './ScopeSection';
export { KpisSection } from './KpisSection';
export { PilotSection } from './PilotSection';
export { ResourcesSection } from './ResourcesSection';
