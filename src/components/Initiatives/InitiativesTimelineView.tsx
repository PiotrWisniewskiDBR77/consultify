/**
 * InitiativesTimelineView
 *
 * Roadmap timeline with dependencies and drag/resize scheduling.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

import { PortfolioInitiative } from '../../types';
import { RoadmapGantt } from '../RoadmapGantt';
import type { InitiativeConflict } from './InitiativeConflictsPanel';
import { InitiativeConflictsPanel } from './InitiativeConflictsPanel';

interface Dependency {
  id: string;
  fromInitiativeId: string;
  toInitiativeId: string;
  type: 'FINISH_TO_START' | 'START_TO_START';
}

interface InitiativesTimelineViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
  projectId?: string;
}

function safeDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getRange(i: PortfolioInitiative): { start: Date; end: Date } | null {
  const start = safeDate(i.plannedStartDate);
  const end = safeDate(i.plannedEndDate);
  if (!start || !end) return null;
  return { start, end };
}

function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
  return a.start <= b.end && b.start <= a.end;
}

function normalizeAiConflicts(aiConflicts: any): InitiativeConflict[] {
  const raw = Array.isArray(aiConflicts) ? aiConflicts : aiConflicts?.conflicts;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === 'object')
    .map((c: any) => ({
      source: 'ai' as const,
      type: (c.type === 'resource' || c.type === 'dependency' || c.type === 'timeline'
        ? c.type
        : 'timeline') as any,
      severity: (c.severity === 'low' || c.severity === 'medium' || c.severity === 'high'
        ? c.severity
        : 'low') as any,
      initiatives: Array.isArray(c.initiatives)
        ? c.initiatives.map((name: any) => ({ name: String(name) }))
        : [],
      description: String(c.description || ''),
      recommendation: c.recommendation ? String(c.recommendation) : undefined,
    }))
    .filter((c) => c.description || c.initiatives.length > 0);
}

function detectLocalConflicts(
  initiatives: PortfolioInitiative[],
  dependencies: Dependency[]
): InitiativeConflict[] {
  const conflicts: InitiativeConflict[] = [];

  // Owner overlap conflicts (resource)
  const byOwner = new Map<string, PortfolioInitiative[]>();
  for (const i of initiatives) {
    const ownerKey = i.ownerBusiness?.id || i.ownerExecution?.id;
    if (!ownerKey) continue;
    const key = `owner:${ownerKey}`;
    const list = byOwner.get(key) || [];
    list.push(i);
    byOwner.set(key, list);
  }

  for (const [, list] of byOwner.entries()) {
    const withRanges = list
      .map((i) => ({ i, range: getRange(i) }))
      .filter((x): x is { i: PortfolioInitiative; range: { start: Date; end: Date } } => !!x.range)
      .sort((a, b) => a.range.start.getTime() - b.range.start.getTime());

    for (let a = 0; a < withRanges.length; a++) {
      for (let b = a + 1; b < withRanges.length; b++) {
        const A = withRanges[a];
        const B = withRanges[b];
        if (!overlaps(A.range, B.range)) break; // sorted by start, so we can stop early

        const overlapDays = Math.round(
          (Math.min(A.range.end.getTime(), B.range.end.getTime()) -
            Math.max(A.range.start.getTime(), B.range.start.getTime())) /
            (24 * 60 * 60 * 1000)
        );

        const severity: InitiativeConflict['severity'] =
          A.i.priority === 'CRITICAL' || B.i.priority === 'CRITICAL' || overlapDays >= 60
            ? 'high'
            : 'medium';

        conflicts.push({
          source: 'local',
          type: 'resource',
          severity,
          initiatives: [
            { id: A.i.id, name: A.i.name },
            { id: B.i.id, name: B.i.name },
          ],
          description: `Overlapping initiatives for the same owner (${overlapDays} days overlap).`,
          recommendation: 'Reschedule one initiative, split scope, or assign additional capacity.',
        });
      }
    }
  }

  // Dependency date violations (dependency)
  const byId = new Map(initiatives.map((i) => [i.id, i] as const));
  for (const dep of dependencies) {
    const from = byId.get(dep.fromInitiativeId);
    const to = byId.get(dep.toInitiativeId);
    if (!from || !to) continue;
    const fromR = getRange(from);
    const toR = getRange(to);
    if (!fromR || !toR) continue;

    const violatesFinishToStart = toR.start < fromR.end;
    if (dep.type === 'FINISH_TO_START' && violatesFinishToStart) {
      conflicts.push({
        source: 'local',
        type: 'dependency',
        severity: 'high',
        initiatives: [
          { id: from.id, name: from.name },
          { id: to.id, name: to.name },
        ],
        description: 'Dependency violated: successor starts before predecessor finishes.',
        recommendation: 'Move successor later or adjust dependency/scope.',
      });
    }
  }

  return conflicts;
}

function computeReadiness(i: PortfolioInitiative): { percent: number; missing: string[] } {
  let score = 0;
  const missing: string[] = [];

  // 100-point heuristic for portfolio planning (fast, based on what portfolio API provides)
  if (i.summary || i.description) score += 25;
  else missing.push('Summary');

  if (i.ownerBusiness) score += 15;
  else missing.push('Business owner');

  if (i.ownerExecution) score += 10;
  else missing.push('Execution owner');

  if (i.plannedStartDate) score += 15;
  else missing.push('Planned start date');

  if (i.plannedEndDate) score += 10;
  else missing.push('Planned end date');

  if ((i.expectedRoi ?? 0) > 0 || (i.budget ?? 0) > 0) score += 15;
  else missing.push('Value sizing (ROI/Budget)');

  if ((i.progress ?? 0) > 0) score += 10;

  return { percent: Math.min(100, Math.max(0, score)), missing };
}

export const InitiativesTimelineView: React.FC<InitiativesTimelineViewProps> = ({
  initiatives,
  onInitiativeClick,
  projectId,
}) => {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localInitiatives, setLocalInitiatives] = useState<PortfolioInitiative[]>(initiatives);
  const [aiSchedule, setAiSchedule] = useState<any | null>(null);
  const [aiConflicts, setAiConflicts] = useState<any | null>(null);
  const [aiPriorities, setAiPriorities] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState<'schedule' | 'conflicts' | 'priorities' | null>(null);
  const [showConflictsPanel, setShowConflictsPanel] = useState(false);

  useEffect(() => {
    setLocalInitiatives(initiatives);
  }, [initiatives]);

  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        setIsLoading(true);
        const query = projectId ? `?projectId=${projectId}` : '';
        const response = await Api.get(`/initiatives/portfolio/dependencies${query}`);
        setDependencies(response.dependencies || []);
      } catch (error: any) {
        console.error('[InitiativesTimelineView] Failed to load dependencies:', error);
        setDependencies([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDependencies();
  }, [projectId]);

  const readinessById = useMemo(() => {
    return new Map(localInitiatives.map((i) => [i.id, computeReadiness(i)] as const));
  }, [localInitiatives]);

  const localConflicts = useMemo(
    () => detectLocalConflicts(localInitiatives, dependencies),
    [dependencies, localInitiatives]
  );

  const aiConflictList = useMemo(() => normalizeAiConflicts(aiConflicts), [aiConflicts]);

  const conflictCountById = useMemo(() => {
    const counts = new Map<string, number>();

    // local conflicts include IDs
    for (const c of localConflicts) {
      for (const init of c.initiatives) {
        if (!init.id) continue;
        counts.set(init.id, (counts.get(init.id) || 0) + 1);
      }
    }

    // AI conflicts contain names; map uniquely if possible
    const byName = new Map<string, string>();
    const dupes = new Set<string>();
    for (const i of localInitiatives) {
      if (byName.has(i.name)) dupes.add(i.name);
      else byName.set(i.name, i.id);
    }
    for (const name of dupes) byName.delete(name);

    for (const c of aiConflictList) {
      for (const init of c.initiatives) {
        const id = byName.get(init.name);
        if (!id) continue;
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }

    return counts;
  }, [aiConflictList, localConflicts, localInitiatives]);

  const initiativesWithDeps = useMemo(() => {
    const depsByTarget = dependencies.reduce<Record<string, Dependency[]>>((acc, dep) => {
      acc[dep.toInitiativeId] = acc[dep.toInitiativeId] || [];
      acc[dep.toInitiativeId].push(dep);
      return acc;
    }, {});
    const depFrom = new Set(dependencies.map((dep) => dep.fromInitiativeId));
    const depTo = new Set(dependencies.map((dep) => dep.toInitiativeId));

    return localInitiatives.map((initiative) => ({
      ...initiative,
      dependencies: (depsByTarget[initiative.id] || []).map((dep) => ({
        initiativeId: dep.fromInitiativeId,
        type: dep.type,
      })),
      plannedStartDate: initiative.plannedStartDate,
      plannedEndDate: initiative.plannedEndDate,
      isCriticalPath: depFrom.has(initiative.id) || depTo.has(initiative.id),
      readinessPercent: readinessById.get(initiative.id)?.percent ?? 0,
      missingReadiness: readinessById.get(initiative.id)?.missing ?? [],
      conflictCount: conflictCountById.get(initiative.id) || 0,
    }));
  }, [dependencies, localInitiatives, readinessById, conflictCountById]);

  const handleUpdateInitiative = useCallback(async (updated: any) => {
    const { id, plannedStartDate, plannedEndDate } = updated;
    setLocalInitiatives((prev) =>
      prev.map((initiative) =>
        initiative.id === id ? { ...initiative, plannedStartDate, plannedEndDate } : initiative
      )
    );
    try {
      await Api.patch(`/initiatives/${id}/quick-update`, {
        plannedStartDate,
        plannedEndDate,
      });
      toast.success('Schedule updated');
    } catch (error: any) {
      setLocalInitiatives((prev) => [...prev]);
      toast.error('Failed to update schedule');
    }
  }, []);

  const handleCreateDependency = useCallback(
    async (fromId: string, toId: string, type: 'FINISH_TO_START' | 'START_TO_START') => {
      try {
        const response = await Api.post('/initiatives/portfolio/dependencies', {
          fromInitiativeId: fromId,
          toInitiativeId: toId,
          type,
          projectId,
        });
        setDependencies((prev) => [...prev, response.dependency || response]);
      } catch (error: any) {
        toast.error('Failed to create dependency');
      }
    },
    [projectId]
  );

  const aiInitiativesPayload = useMemo(
    () =>
      localInitiatives.map((initiative) => ({
        id: initiative.id,
        name: initiative.name,
        priority: initiative.priority,
        owner: initiative.ownerBusiness
          ? `${initiative.ownerBusiness.firstName} ${initiative.ownerBusiness.lastName}`
          : initiative.ownerExecution
            ? `${initiative.ownerExecution.firstName} ${initiative.ownerExecution.lastName}`
            : undefined,
        expectedRoi: initiative.expectedRoi,
        plannedStartDate: initiative.plannedStartDate,
        plannedEndDate: initiative.plannedEndDate,
      })),
    [localInitiatives]
  );

  const aiDependenciesPayload = useMemo(
    () =>
      dependencies.map((dep) => ({
        fromInitiativeId: dep.fromInitiativeId,
        toInitiativeId: dep.toInitiativeId,
        type: dep.type,
      })),
    [dependencies]
  );

  const handleAiSchedule = useCallback(async () => {
    try {
      setAiLoading('schedule');
      const response = await Api.post('/ai/initiatives/schedule', {
        initiatives: aiInitiativesPayload,
      });
      setAiSchedule(response.schedule || response);
    } catch (error: any) {
      toast.error('Failed to generate AI schedule');
    } finally {
      setAiLoading(null);
    }
  }, [aiInitiativesPayload]);

  const handleAiConflicts = useCallback(async () => {
    try {
      setAiLoading('conflicts');
      const response = await Api.post('/ai/initiatives/conflicts', {
        initiatives: aiInitiativesPayload,
        dependencies: aiDependenciesPayload,
      });
      setAiConflicts(response.conflicts || response);
      setShowConflictsPanel(true);
    } catch (error: any) {
      toast.error('Failed to analyze conflicts');
    } finally {
      setAiLoading(null);
    }
  }, [aiDependenciesPayload, aiInitiativesPayload]);

  const handleAiPriorities = useCallback(async () => {
    try {
      setAiLoading('priorities');
      const response = await Api.post('/ai/initiatives/priorities', {
        initiatives: aiInitiativesPayload,
      });
      setAiPriorities(response.priorities || response);
    } catch (error: any) {
      toast.error('Failed to recommend priorities');
    } finally {
      setAiLoading(null);
    }
  }, [aiInitiativesPayload]);

  const applyAiSchedule = useCallback(async () => {
    if (!Array.isArray(aiSchedule)) return;
    try {
      await Promise.all(
        aiSchedule.map((item: any) =>
          Api.patch(`/initiatives/${item.id}/quick-update`, {
            plannedStartDate: item.plannedStartDate,
            plannedEndDate: item.plannedEndDate,
          })
        )
      );
      setLocalInitiatives((prev) =>
        prev.map((initiative) => {
          const match = aiSchedule.find((item: any) => item.id === initiative.id);
          if (!match) return initiative;
          return {
            ...initiative,
            plannedStartDate: match.plannedStartDate,
            plannedEndDate: match.plannedEndDate,
          };
        })
      );
      toast.success('AI schedule applied');
    } catch (error: any) {
      toast.error('Failed to apply AI schedule');
    }
  }, [aiSchedule]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Loading timeline...
      </div>
    );
  }

  return (
    <div className="h-full p-4" data-testid="initiatives-timeline">
      <div className="mb-4 rounded-xl border border-navy-700 bg-navy-900 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase text-slate-400">AI Assist</span>
          <button
            onClick={handleAiSchedule}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors"
            disabled={aiLoading !== null}
          >
            {aiLoading === 'schedule' ? 'Scheduling...' : 'AI Schedule'}
          </button>
          <button
            onClick={handleAiConflicts}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-navy-800 text-slate-200 hover:bg-navy-700 transition-colors"
            disabled={aiLoading !== null}
          >
            {aiLoading === 'conflicts' ? 'Analyzing...' : 'AI Conflicts'}
          </button>
          <button
            onClick={handleAiPriorities}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-navy-800 text-slate-200 hover:bg-navy-700 transition-colors"
            disabled={aiLoading !== null}
          >
            {aiLoading === 'priorities' ? 'Recommending...' : 'AI Priorities'}
          </button>
          {Array.isArray(aiSchedule) && aiSchedule.length > 0 && (
            <button
              onClick={applyAiSchedule}
              className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
            >
              Apply Schedule
            </button>
          )}
          {(localConflicts.length > 0 || aiConflictList.length > 0) && (
            <button
              onClick={() => setShowConflictsPanel((p) => !p)}
              className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600/20 text-rose-200 hover:bg-rose-600/30 transition-colors"
            >
              {showConflictsPanel ? 'Hide Conflicts' : 'View Conflicts'} (
              {localConflicts.length + aiConflictList.length})
            </button>
          )}
        </div>

        {Array.isArray(aiSchedule) && aiSchedule.length > 0 && (
          <div className="mt-3 text-xs text-slate-400">
            Suggested schedule for {aiSchedule.length} initiatives.
          </div>
        )}
        {showConflictsPanel && (localConflicts.length > 0 || aiConflictList.length > 0) && (
          <InitiativeConflictsPanel
            conflicts={[...localConflicts, ...aiConflictList]}
            title="Conflicts (Local + AI)"
          />
        )}
        {aiPriorities && (
          <pre className="mt-3 text-xs text-slate-400 whitespace-pre-wrap">
            {JSON.stringify(aiPriorities, null, 2)}
          </pre>
        )}
      </div>
      <RoadmapGantt
        initiatives={initiativesWithDeps as any}
        onUpdateInitiative={handleUpdateInitiative}
        onInitiativeClick={onInitiativeClick as any}
        onCreateDependency={handleCreateDependency}
      />
    </div>
  );
};

export default InitiativesTimelineView;
