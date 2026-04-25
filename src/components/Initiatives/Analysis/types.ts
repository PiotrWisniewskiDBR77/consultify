/**
 * Portfolio Analysis Types
 * V3-F02: Initiatives Portfolio Analysis
 * V3-F02b: Inline initiative management during planning
 */

import type { ReactNode } from 'react';

import type { PortfolioInitiative } from '@/types';

export type AnalysisSubview = 'resources' | 'feasibility' | 'logic' | 'timeline' | 'completeness';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AnalysisIssue {
  id: string;
  severity: IssueSeverity;
  description: string;
  initiativeId?: string;
  initiativeName?: string;
  fixSuggestion?: string;
  issueType: string;
  autoFixPayload?: Record<string, unknown>;
}

export interface OrgUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export interface QuickUpdatePayload {
  ownerBusinessId?: string;
  ownerExecutionId?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  priority?: string;
  budget?: number;
}

export interface AnalysisWorkspacePanelConfig {
  title: string;
  subtitle: string;
  icon: ReactNode;
  content: ReactNode;
}

export type RegisterAnalysisWorkspacePanel = (panel: AnalysisWorkspacePanelConfig | null) => void;

export interface ResourceAllocation {
  resourceId: string;
  resourceName: string;
  role: string;
  allocatedInitiatives: string[];
  allocatedInitiativeNames: string[];
  utilizationPercent: number;
  status: 'ok' | 'overallocated' | 'underutilized';
}

export interface FeasibilityDimension {
  budget: 'green' | 'amber' | 'red';
  skills: 'green' | 'amber' | 'red';
  time: 'green' | 'amber' | 'red';
  risk: 'green' | 'amber' | 'red';
}

export interface InitiativeFeasibility {
  initiativeId: string;
  initiativeName: string;
  dimensions: FeasibilityDimension;
  overallScore: number; // 0-100
  ownerName?: string;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  budget?: number;
}

export interface DependencyLink {
  id?: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  type: string;
  hasTimingConflict?: boolean;
}

export interface TimelineBar {
  initiativeId: string;
  initiativeName: string;
  startDate: string | null;
  endDate: string | null;
  status: 'on-schedule' | 'delayed' | 'at-risk' | 'no-dates';
  ownerName?: string;
}
