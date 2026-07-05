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
import { classifyLoad, computeUtilizationPercent, isActiveLoadStatus } from './resourceLoadMath';
import type {
  AnalysisIssue,
  DependencyLink,
  FeasibilityDimension,
  InitiativeFeasibility,
  ResourceAllocation,
  TimelineBar,
} from './types';

interface PortfolioDependencyRecord {
  id: string;
  fromInitiativeId: string;
  toInitiativeId: string;
  type: string;
}

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

export function usePortfolioAnalysisData(
  initiatives: PortfolioInitiative[],
  dependencySource: PortfolioDependencyRecord[] | null = null
) {
  return useMemo(() => {
    const idToName = new Map(initiatives.map((i) => [i.id, i.name]));

    // Resources: derive from ownerBusiness + ownerExecution.
    // `initIds`       = every initiative the person owns (shown in the UI list).
    // `activeInitIds` = subset that counts toward CONCURRENT load (non-terminal,
    //                   non-draft) — this is what utilization is measured against.
    // A Set guards against the same initiative being counted twice for one owner.
    const resourceMap = new Map<
      string,
      { name: string; role: string; initIds: string[]; activeInitIds: Set<string> }
    >();
    const addOwnership = (
      id: string,
      name: string,
      role: string,
      initiative: PortfolioInitiative
    ) => {
      const r =
        resourceMap.get(id) ??
        ({ name, role, initIds: [], activeInitIds: new Set<string>() } as {
          name: string;
          role: string;
          initIds: string[];
          activeInitIds: Set<string>;
        });
      if (!r.initIds.includes(initiative.id)) r.initIds.push(initiative.id);
      if (isActiveLoadStatus(initiative.status)) r.activeInitIds.add(initiative.id);
      resourceMap.set(id, r);
    };
    for (const i of initiatives) {
      const ownerId = i.ownerBusiness?.id ?? (i as any).ownerBusinessId;
      const execId = i.ownerExecution?.id ?? (i as any).ownerExecutionId;
      if (ownerId) {
        addOwnership(
          ownerId,
          i.ownerBusiness ? `${i.ownerBusiness.firstName} ${i.ownerBusiness.lastName}` : ownerId,
          'Business Owner',
          i
        );
      }
      if (execId && execId !== ownerId) {
        addOwnership(
          execId,
          i.ownerExecution ? `${i.ownerExecution.firstName} ${i.ownerExecution.lastName}` : execId,
          'Execution Owner',
          i
        );
      }
    }

    const allocations: ResourceAllocation[] = Array.from(resourceMap.entries()).map(([id, r]) => {
      // Utilization = concurrent ACTIVE-ownership load vs. a sane capacity — NOT
      // 100% × (owned count). Bounded + guarded in resourceLoadMath so real
      // overload (e.g. 200%) stays visible while the 4500% unit artefact is gone.
      const util = computeUtilizationPercent(r.activeInitIds.size);
      const status = classifyLoad(util);
      return {
        resourceId: id,
        resourceName: r.name,
        role: r.role,
        allocatedInitiatives: r.initIds,
        allocatedInitiativeNames: r.initIds.map((iid) => idToName.get(iid) ?? iid),
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

      const ownerObj = i.ownerBusiness;
      const ownerName = ownerObj ? `${ownerObj.firstName} ${ownerObj.lastName}` : undefined;

      return {
        initiativeId: i.id,
        initiativeName: i.name,
        dimensions: dims,
        overallScore: Math.round(overall),
        ownerName,
        plannedStartDate: i.plannedStartDate ?? null,
        plannedEndDate: i.plannedEndDate ?? null,
        budget: i.budget,
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
    const localFallbackDependencies =
      dependencySource === null
        ? initiatives.flatMap((initiative) => {
            const predecessorIds =
              initiative.dependencies ?? (initiative as any).dependsOnIds ?? [];
            return predecessorIds.map((predecessorId: string, idx: number) => ({
              id: `derived-${initiative.id}-${predecessorId}-${idx}`,
              fromInitiativeId: predecessorId,
              toInitiativeId: initiative.id,
              type: 'depends_on',
            }));
          })
        : dependencySource;

    for (const dep of localFallbackDependencies) {
      const predecessor = initiatives.find((x) => x.id === dep.fromInitiativeId);
      const successor = initiatives.find((x) => x.id === dep.toInitiativeId);
      const predecessorName = idToName.get(dep.fromInitiativeId) ?? dep.fromInitiativeId;
      const successorName = idToName.get(dep.toInitiativeId) ?? dep.toInitiativeId;
      let hasTimingConflict = false;

      if (predecessor && successor?.plannedStartDate && predecessor.plannedEndDate) {
        if (new Date(successor.plannedStartDate) < new Date(predecessor.plannedEndDate)) {
          hasTimingConflict = true;
          const suggestedStart = predecessor.plannedEndDate;
          logicIssues.push({
            id: `logic-${dep.toInitiativeId}-${dep.fromInitiativeId}`,
            severity: 'critical',
            description: `${successorName} starts before predecessor ${predecessorName} completes`,
            initiativeId: dep.toInitiativeId,
            initiativeName: successorName,
            fixSuggestion: `Move start date to ${new Date(suggestedStart).toLocaleDateString()}`,
            issueType: 'dependency_timing',
            autoFixPayload: { plannedStartDate: suggestedStart },
          });
        }
      }

      deps.push({
        id: dep.id,
        fromId: dep.fromInitiativeId,
        fromName: predecessorName,
        toId: dep.toInitiativeId,
        toName: successorName,
        type: dep.type,
        hasTimingConflict,
      });
    }

    // Timeline: bars
    const today = new Date();
    const bars: TimelineBar[] = initiatives.map((i) => {
      const start = i.plannedStartDate ?? (i as any).startDate;
      const end = i.plannedEndDate ?? (i as any).endDate;
      const ownerObj = i.ownerBusiness;
      const ownerName = ownerObj ? `${ownerObj.firstName} ${ownerObj.lastName}` : undefined;
      let status: TimelineBar['status'] = 'on-schedule';
      if (!start || !end)
        return {
          initiativeId: i.id,
          initiativeName: i.name,
          startDate: start ?? null,
          endDate: end ?? null,
          status: 'no-dates',
          ownerName,
        };
      const endDate = new Date(end);
      if (endDate < today) status = 'delayed';
      else if (endDate < new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)) status = 'at-risk';
      return {
        initiativeId: i.id,
        initiativeName: i.name,
        startDate: start,
        endDate: end,
        status,
        ownerName,
      };
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
  }, [dependencySource, initiatives]);
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
