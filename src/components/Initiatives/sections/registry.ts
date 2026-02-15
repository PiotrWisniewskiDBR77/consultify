/**
 * Initiative Section Registry
 *
 * Maps section component_key values to their React components.
 * The dynamic renderer uses this registry to resolve which component
 * to render for each section type.
 */

import type React from 'react';

// Section component imports
import { AttachmentsSection } from './AttachmentsSection';
import { CommentsSection } from './CommentsSection';
import { ControlSection } from './ControlSection';
import { DecisionsSection } from './DecisionsSection';
import { DependenciesSection } from './DependenciesSection';
import { FinancialAnalysisSection } from './FinancialAnalysisSection';
import { FinancialImpactSection } from './FinancialImpactSection';
import { GateReadinessSection } from './GateReadinessSection';
import { HistorySection } from './HistorySection';
import { InitiativeTeamSection } from './InitiativeTeamSection';
import { KpisSection } from './KpisSection';
import { LinkedItemsSection } from './LinkedItemsSection';
import { OverviewSection } from './OverviewSection';
import { PilotSection } from './PilotSection';
import { ProblemDefinitionSection } from './ProblemDefinitionSection';
import { RaciEscalationSection } from './RaciEscalationSection';
import { RaidSection } from './RaidSection';
import { RemindersSection } from './RemindersSection';
import { ResourcesSection } from './ResourcesSection';
import { ScopeSection } from './ScopeSection';
import { StakeholdersSection } from './StakeholdersSection';
import { TagsSection } from './TagsSection';
import { TargetStateSection } from './TargetStateSection';
import { TasksMilestonesSection } from './TasksMilestonesSection';
import { TeamSection } from './TeamSection';
import { TimelineSection } from './TimelineSection';
import type { InitiativeSectionProps } from './types';

/**
 * Registry mapping component_key -> React component.
 *
 * When adding new section types:
 * 1. Create the component in this directory
 * 2. Add it to this registry
 * 3. Add the section type to the DB seed
 */
export const SECTION_REGISTRY: Record<string, React.ComponentType<InitiativeSectionProps>> = {
  // Left column - Content
  overview: OverviewSection,
  problemDefinition: ProblemDefinitionSection,
  targetState: TargetStateSection,
  scope: ScopeSection,
  tasks: TasksMilestonesSection,
  decisions: DecisionsSection,
  raid: RaidSection,
  gates: GateReadinessSection,
  financialAnalysis: FinancialAnalysisSection,
  financialImpact: FinancialImpactSection,
  kpis: KpisSection,
  pilot: PilotSection,
  comments: CommentsSection,
  history: HistorySection,

  // Right column - Control/Meta
  control: ControlSection,
  team: TeamSection,
  initiativeTeam: InitiativeTeamSection,
  raciEscalation: RaciEscalationSection,
  timeline: TimelineSection,
  resources: ResourcesSection,
  stakeholders: StakeholdersSection,
  dependencies: DependenciesSection,
  attachments: AttachmentsSection,
  linkedItems: LinkedItemsSection,
  tags: TagsSection,
  reminders: RemindersSection,
  watchers: OverviewSection, // Watchers have a simpler UI - can be enhanced later
};

/**
 * Get a section component by key, with fallback.
 */
export function getSectionComponent(
  componentKey: string
): React.ComponentType<InitiativeSectionProps> | null {
  return SECTION_REGISTRY[componentKey] || null;
}

/**
 * Default section ordering for when no template is applied.
 * Maps section keys to their default order values.
 */
export const DEFAULT_SECTION_ORDER: Record<string, number> = {
  // Canonical N-mode content sequence (left column)
  scope: 10,
  targetState: 20,
  problemDefinition: 30,
  kpis: 40,
  financialAnalysis: 50,
  financialImpact: 60,
  raid: 70,
  tasks: 80,
  timeline: 90,
  decisions: 100,
  gates: 110,
  attachments: 120,
  comments: 130,
  history: 140,
  // Legacy sections kept for backward compatibility
  overview: 200,
  pilot: 210,
  // Right column
  control: 10,
  team: 15,
  initiativeTeam: 20,
  raciEscalation: 30,
  resources: 40,
  dependencies: 50,
  stakeholders: 60,
  linkedItems: 70,
  tags: 80,
  reminders: 90,
  watchers: 220,
};

/**
 * Default visible sections when no template is applied.
 * Matches the current "show everything" behavior.
 */
export const DEFAULT_VISIBLE_SECTIONS: Record<string, boolean> = {
  // Canonical initiative cards enabled by default
  scope: true,
  targetState: true,
  problemDefinition: true,
  kpis: true,
  tasks: true,
  decisions: true,
  raid: true,
  gates: true,
  financialAnalysis: true,
  financialImpact: true,
  resources: true,
  dependencies: true,
  comments: true,
  history: true,
  control: true,
  team: true,
  initiativeTeam: true,
  raciEscalation: true,
  timeline: true,
  attachments: true,
  linkedItems: true,
  stakeholders: true,
  reminders: true,
  tags: true,
  // Excluded from canonical N-mode but left in registry for compatibility
  overview: false,
  pilot: false,
  watchers: false,
};
