/**
 * Initiative Sections - Barrel export
 */

// Core infrastructure
export { CollapsibleSection } from './CollapsibleSection';
export type { InitiativeContextValue } from './InitiativeContext';
export { InitiativeContext, useInitiativeContext } from './InitiativeContext';
export {
  DEFAULT_SECTION_ORDER,
  DEFAULT_VISIBLE_SECTIONS,
  getSectionComponent,
  SECTION_REGISTRY,
} from './registry';
export type { InitiativeSectionProps, SectionTypeInfo } from './types';

// Re-export types and constants
export type {
  Decision,
  GateReadinessCheck,
  GateRoleAssignment,
  HistoryEvent,
  PendingApproval,
  RaidItem,
  StatusHistoryEntry,
  TaskItem,
  UserInfo,
  Watcher,
} from './types';
export {
  GATE_CONFIG,
  GATE_DEFINITIONS,
  getModuleFromStatus,
  getNextGateForStatus,
  getRoleLabel,
  MODULE_CONFIG,
  PRIORITY_CONFIG,
  RAID_TYPE_CONFIG,
  SEVERITY_CONFIG,
} from './types';

// Section components
export { AttachmentsSection } from './AttachmentsSection';
export { CommentsSection } from './CommentsSection';
export { ControlSection } from './ControlSection';
export { DecisionsSection } from './DecisionsSection';
export { DependenciesSection } from './DependenciesSection';
export { FinancialAnalysisSection } from './FinancialAnalysisSection';
export { FinancialImpactSection } from './FinancialImpactSection';
export { GateReadinessSection } from './GateReadinessSection';
export { HistorySection } from './HistorySection';
export { LinkedItemsSection } from './LinkedItemsSection';
export { OverviewSection } from './OverviewSection';
export { RaidSection } from './RaidSection';
export { RemindersSection } from './RemindersSection';
export { StakeholdersSection } from './StakeholdersSection';
export { TagsSection } from './TagsSection';
export { TasksMilestonesSection } from './TasksMilestonesSection';
export { TeamSection } from './TeamSection';
export { TimelineSection } from './TimelineSection';

// Phase 2 - New structured sections
export { KpisSection } from './KpisSection';
export { PilotSection } from './PilotSection';
export { ProblemDefinitionSection } from './ProblemDefinitionSection';
export { ResourcesSection } from './ResourcesSection';
export { ScopeSection } from './ScopeSection';
export { TargetStateSection } from './TargetStateSection';
