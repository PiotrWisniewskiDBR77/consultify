/**
 * usePortfolioAnalysisData — Derives analysis data from initiatives
 * V3-F02: Portfolio quality gate
 */

import { useMemo } from 'react';

import {
  buildCompletenessConfigFromTemplate,
  getConfigKeyForStatus,
  getInitiativeLevelTemplate,
} from '@/components/Initiatives/templates/initiativeLevelTemplates';
import type { InitiativeLevel } from '@/components/Initiatives/templates/types';
import { getCompletenessConfig } from '@/components/shared/NModeCompleteness/completenessConfigs';
import type { PortfolioInitiative } from '@/types';

import type { InitiativeCompletenessRow } from './CompletenessAnalysis';
import type {
  AnalysisIssue,
  DependencyLink,
  FeasibilityDimension,
  InitiativeFeasibility,
  ResourceAllocation,
  TimelineBar,
} from './types';

function buildDataFromPortfolio(i: PortfolioInitiative): Record<string, unknown> {
  const data: Record<string, unknown> = {
    name: i.name,
    description: i.description || i.summary,
    ownerId: i.ownerBusiness?.id ?? (i as any).ownerBusinessId,
    level: (i as any).level ?? 'standard',
    status: i.status,
    scope: (i as any).scope,
    objectives: (i as any).objectives,
    timeline: (i as any).timeline,
    kpis: (i as any).kpis ?? [],
    tasks: (i as any).tasks ?? [],
    budget: i.budget,
    team: (i as any).team ?? [],
  };
  return data;
}

export function usePortfolioAnalysisData(initiatives: PortfolioInitiative[]) {
  return useMemo(() => {
    const idToName = new Map(initiatives.map((i) => [i.id, i.name]));

    // Resources: derive from ownerBusiness + ownerExecution
    const resourceMap = new Map<string, { name: string; role: string; initIds: string[] }>();
    for (const i of initiatives) {
      const ownerId = i.ownerBusiness?.id ?? (i as any).ownerBusinessId;
      const execId = i.ownerExecution?.id ?? (i as any).ownerExecutionId;
      if (ownerId) {
        const r = resourceMap.get(ownerId) ?? {
          name: i.ownerBusiness
            ? `${i.ownerBusiness.firstName} ${i.ownerBusiness.lastName}`
            : ownerId,
          role: 'Business Owner',
          initIds: [] as string[],
        };
        r.initIds.push(i.id);
        resourceMap.set(ownerId, r);
      }
      if (execId && execId !== ownerId) {
        const r = resourceMap.get(execId) ?? {
          name: i.ownerExecution
            ? `${i.ownerExecution.firstName} ${i.ownerExecution.lastName}`
            : execId,
          role: 'Execution Owner',
          initIds: [] as string[],
        };
        r.initIds.push(i.id);
        resourceMap.set(execId, r);
      }
    }

    const allocations: ResourceAllocation[] = Array.from(resourceMap.entries()).map(([id, r]) => {
      const util = r.initIds.length * 100; // 100% per initiative
      const status: ResourceAllocation['status'] =
        util > 100 ? 'overallocated' : util < 50 ? 'underutilized' : 'ok';
      return {
        resourceId: id,
        resourceName: r.name,
        role: r.role,
        allocatedInitiatives: r.initIds,
        utilizationPercent: util,
        status,
      };
    });

    const resourceIssues: AnalysisIssue[] = allocations
      .filter((a) => a.status === 'overallocated')
      .flatMap((a) =>
        a.allocatedInitiatives.map((initId, idx) => ({
          id: `res-over-${a.resourceId}-${initId}`,
          severity: 'high' as const,
          description: `${a.resourceName} is overallocated at ${a.utilizationPercent}%`,
          initiativeId: initId,
          initiativeName: idToName.get(initId),
          fixSuggestion:
            idx > 0 ? `Consider delaying Initiative ${idToName.get(initId) ?? initId}` : undefined,
          issueType: 'overallocated',
        }))
      );

    // Feasibility: budget, skills, time, risk from initiative data
    const feasibilities: InitiativeFeasibility[] = initiatives.map((i) => {
      const budget: FeasibilityDimension['budget'] =
        i.budget > 0 ? 'green' : i.budget === 0 ? 'amber' : 'red';
      const riskScore = i.riskScore ?? 50;
      const risk: FeasibilityDimension['risk'] =
        riskScore > 75 ? 'red' : riskScore > 50 ? 'amber' : 'green';
      const hasDates = !!(i.plannedStartDate && i.plannedEndDate);
      const time: FeasibilityDimension['time'] = hasDates ? 'green' : 'amber';
      const hasOwner = !!(i.ownerBusiness?.id ?? (i as any).ownerBusinessId);
      const skills: FeasibilityDimension['skills'] = hasOwner ? 'green' : 'amber';

      const dims = { budget, skills, time, risk };
      const scores = { green: 100, amber: 50, red: 0 };
      const overall =
        (scores[dims.budget] + scores[dims.skills] + scores[dims.time] + scores[dims.risk]) / 4;

      return {
        initiativeId: i.id,
        initiativeName: i.name,
        dimensions: dims,
        overallScore: Math.round(overall),
      };
    });

    const feasibilityIssues: AnalysisIssue[] = feasibilities
      .filter((f) => f.overallScore < 50 || f.dimensions.budget === 'red')
      .map((f) => ({
        id: `feas-${f.initiativeId}`,
        severity: f.overallScore < 30 ? 'critical' : ('high' as const),
        description:
          f.dimensions.budget === 'red'
            ? `${f.initiativeName} has insufficient budget`
            : `${f.initiativeName} has high feasibility risk (${f.overallScore}%)`,
        initiativeId: f.initiativeId,
        initiativeName: f.initiativeName,
        fixSuggestion: 'Review budget and resource allocation',
        issueType: 'feasibility',
      }));

    // Logic: dependencies
    const deps: DependencyLink[] = [];
    const logicIssues: AnalysisIssue[] = [];
    const depsList = (i: PortfolioInitiative) => i.dependencies ?? (i as any).dependsOnIds ?? [];
    for (const i of initiatives) {
      const fromIds = depsList(i);
      for (const toId of fromIds) {
        const toName = idToName.get(toId) ?? toId;
        deps.push({
          fromId: i.id,
          fromName: i.name,
          toId,
          toName,
          type: 'depends_on',
        });
        // Check: does i start before to completes?
        const toInit = initiatives.find((x) => x.id === toId);
        if (toInit && i.plannedStartDate && toInit.plannedEndDate) {
          if (new Date(i.plannedStartDate) < new Date(toInit.plannedEndDate)) {
            logicIssues.push({
              id: `logic-${i.id}-${toId}`,
              severity: 'critical',
              description: `${i.name} starts before dependency ${toName} completes`,
              initiativeId: i.id,
              initiativeName: i.name,
              fixSuggestion: 'Adjust start date or dependency end date',
              issueType: 'dependency_timing',
            });
          }
        }
      }
    }

    // Timeline: bars
    const today = new Date();
    const bars: TimelineBar[] = initiatives.map((i) => {
      const start = i.plannedStartDate ?? (i as any).startDate;
      const end = i.plannedEndDate ?? (i as any).endDate;
      let status: TimelineBar['status'] = 'on-schedule';
      if (!start || !end)
        return {
          initiativeId: i.id,
          initiativeName: i.name,
          startDate: start ?? null,
          endDate: end ?? null,
          status: 'no-dates',
        };
      const endDate = new Date(end);
      if (endDate < today) status = 'delayed';
      else if (endDate < new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)) status = 'at-risk';
      return { initiativeId: i.id, initiativeName: i.name, startDate: start, endDate: end, status };
    });

    const timelineIssues: AnalysisIssue[] = bars
      .filter((b) => b.status === 'delayed' || b.status === 'no-dates')
      .map((b) => ({
        id: `timeline-${b.initiativeId}`,
        severity: b.status === 'delayed' ? 'high' : ('medium' as const),
        description:
          b.status === 'delayed'
            ? `${b.initiativeName} is delayed`
            : `${b.initiativeName} has no dates`,
        initiativeId: b.initiativeId,
        initiativeName: b.initiativeName,
        fixSuggestion:
          b.status === 'no-dates' ? 'Add planned start and end dates' : 'Update timeline',
        issueType: b.status === 'delayed' ? 'delayed' : 'no_dates',
      }));

    return {
      allocations,
      resourceIssues,
      feasibilities,
      feasibilityIssues,
      dependencies: deps,
      logicIssues,
      bars,
      timelineIssues,
      initiatives: initiatives as any[],
    };
  }, [initiatives]);
}

/** Compute completeness for a single initiative (pure, no hooks) */
function computeCompleteness(
  i: PortfolioInitiative & { level?: string },
  data: Record<string, unknown>
): { score: number; missingCritical: number; missingTotal: number; gateReady: boolean } {
  const level = (i.level ?? (i as any).level ?? 'standard') as InitiativeLevel;
  const template = getInitiativeLevelTemplate(level);
  const configOverride = template ? buildCompletenessConfigFromTemplate(template, i.status) : null;
  const cfg = configOverride ?? getCompletenessConfig('initiative', i.status);
  if (!cfg) {
    return { score: 100, missingCritical: 0, missingTotal: 0, gateReady: true };
  }

  let totalFilled = 0;
  const missingItems: { isCritical: boolean }[] = [];
  for (const section of cfg.requiredSections) {
    for (const field of section.fields) {
      const value = getValueAtPath(data, field.fieldPath);
      if (
        !isFilled(value, field.type as 'text' | 'rich_text' | 'number' | 'date' | 'select' | 'list')
      ) {
        missingItems.push({ isCritical: field.isCritical });
      } else {
        totalFilled++;
      }
    }
  }
  const totalRequired = cfg.requiredSections.reduce((sum, s) => sum + s.fields.length, 0);
  const criticalMissing = missingItems.filter((m) => m.isCritical).length;
  const score = totalRequired === 0 ? 100 : Math.round((totalFilled / totalRequired) * 100);

  return {
    score,
    missingCritical: criticalMissing,
    missingTotal: missingItems.length,
    gateReady: criticalMissing === 0,
  };
}

/** Compute completeness rows for initiatives */
export function useCompletenessRows(
  initiatives: Array<PortfolioInitiative & { level?: string }>
): InitiativeCompletenessRow[] {
  return useMemo(
    () =>
      initiatives.map((i) => {
        const data = buildDataFromPortfolio(i);
        const level = (i.level ?? (i as any).level ?? 'standard') as InitiativeLevel;
        const { score, missingCritical, missingTotal, gateReady } = computeCompleteness(i, data);
        return {
          initiativeId: i.id,
          initiativeName: i.name,
          level,
          status: i.status,
          completeness: score,
          missingCritical,
          missingTotal,
          gateReady,
        };
      }),
    [initiatives]
  );
}

function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isFilled(
  value: unknown,
  type: 'text' | 'rich_text' | 'number' | 'date' | 'select' | 'list'
): boolean {
  if (value === undefined || value === null) return false;
  if (type === 'text' || type === 'rich_text') {
    return typeof value === 'string' && value.trim().length > 0;
  }
  if (type === 'number') return typeof value === 'number' && !Number.isNaN(value);
  if (type === 'date') {
    if (typeof value === 'string') return value.trim().length > 0;
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    return false;
  }
  if (type === 'select') return value !== '' && value !== undefined && value !== null;
  if (type === 'list') return Array.isArray(value) ? value.length > 0 : false;
  return true;
}
