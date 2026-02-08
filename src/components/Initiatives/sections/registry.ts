/**
 * Initiative Section Registry
 *
 * Maps section component_key values to their React components.
 * The dynamic renderer uses this registry to resolve which component
 * to render for each section type.
 */

import type React from 'react';

import type { InitiativeSectionProps } from './types';

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
import { KpisSection } from './KpisSection';
import { LinkedItemsSection } from './LinkedItemsSection';
import { OverviewSection } from './OverviewSection';
import { PilotSection } from './PilotSection';
import { ProblemDefinitionSection } from './ProblemDefinitionSection';
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
export function getSectionComponent(componentKey: string): React.ComponentType<InitiativeSectionProps> | null {
  return SECTION_REGISTRY[componentKey] || null;
}

/**
 * Default section ordering for when no template is applied.
 * Maps section keys to their default order values.
 */
export const DEFAULT_SECTION_ORDER: Record<string, number> = {
  overview: 10,
  problemDefinition: 20,
  targetState: 30,
  scope: 40,
  tasks: 50,
  decisions: 60,
  raid: 70,
  gates: 80,
  financialAnalysis: 90,
  financialImpact: 100,
  kpis: 110,
  pilot: 120,
  comments: 130,
  history: 140,
  // Right column
  control: 10,
  team: 20,
  timeline: 30,
  resources: 40,
  stakeholders: 50,
  dependencies: 60,
  attachments: 70,
  linkedItems: 75,
  tags: 80,
  reminders: 90,
  watchers: 100,
};

/**
 * Default visible sections when no template is applied.
 * Matches the current "show everything" behavior.
 */
export const DEFAULT_VISIBLE_SECTIONS: Record<string, boolean> = {
  overview: true,
  tasks: true,
  decisions: true,
  raid: true,
  gates: true,
  financialAnalysis: true,
  financialImpact: true,
  comments: true,
  history: true,
  control: true,
  team: true,
  timeline: true,
  attachments: true,
  linkedItems: true,
  stakeholders: true,
  reminders: true,
  tags: true,
  dependencies: true,
};
