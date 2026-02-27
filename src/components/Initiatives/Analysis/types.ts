/**
 * Portfolio Analysis Types
 * V3-F02: Initiatives Portfolio Analysis
 */

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
}

export interface ResourceAllocation {
  resourceId: string;
  resourceName: string;
  role: string;
  allocatedInitiatives: string[];
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
}

export interface DependencyLink {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  type: string;
}

export interface TimelineBar {
  initiativeId: string;
  initiativeName: string;
  startDate: string | null;
  endDate: string | null;
  status: 'on-schedule' | 'delayed' | 'at-risk' | 'no-dates';
}
