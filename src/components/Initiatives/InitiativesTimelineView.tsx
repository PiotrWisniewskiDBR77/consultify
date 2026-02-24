/**
 * InitiativesTimelineView
 *
 * Roadmap timeline with dependencies and drag/resize scheduling.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
      toast.success(t('initiatives.toast.scheduleUpdated', 'Harmonogram zaktualizowany'));
    } catch (error: any) {
      setLocalInitiatives((prev) => [...prev]);
      const msg =
        error?.data?.error ||
        error?.message ||
        t('initiatives.toast.scheduleUpdateError', 'Nie udało się zaktualizować harmonogramu');
      toast.error(msg);
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
        toast.error(
          t('initiatives.toast.createDependencyError', 'Nie udało się utworzyć zależności')
        );
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
      toast.error(
        t('initiatives.toast.aiScheduleError', 'Nie udało się wygenerować harmonogramu AI')
      );
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
      const msg =
        error?.data?.error ||
        error?.message ||
        t('initiatives.toast.aiConflictsError', 'Nie udało się przeanalizować konfliktów');
      toast.error(msg);
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
      const msg =
        error?.data?.error ||
        error?.message ||
        t('initiatives.toast.aiPrioritiesError', 'Nie udało się zasugerować priorytetów');
      toast.error(msg);
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
      toast.success(t('initiatives.toast.aiScheduleApplied', 'Harmonogram AI zastosowany'));
    } catch (error: any) {
      toast.error(
        t('initiatives.toast.aiScheduleApplyError', 'Nie udało się zastosować harmonogramu AI')
      );
    }
  }, [aiSchedule]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Loading timeline...
      </div>
    );
  }

  // Tech Sexy v2.0 button primitives (monochrome chrome, h-9, hover bg-only)
  const BTN_BASE =
    'inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
  const BTN_GHOST = `${BTN_BASE} text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.05]`;
  const BTN_PRIMARY = `${BTN_BASE} bg-hig-primary text-white hover:bg-hig-primary-hover`;

  const conflictsCount = localConflicts.length + aiConflictList.length;

  return (
    <div className="h-full p-4" data-testid="initiatives-timeline">
      <div className="mb-4 rounded-xl bg-white dark:bg-navy-900/50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mr-1">
            AI Assist
          </span>

          {/* Primary action: generate schedule unless there's a schedule to apply */}
          {Array.isArray(aiSchedule) && aiSchedule.length > 0 ? (
            <button onClick={applyAiSchedule} className={BTN_PRIMARY}>
              Apply schedule
            </button>
          ) : (
            <button
              onClick={handleAiSchedule}
              className={BTN_PRIMARY}
              disabled={aiLoading !== null}
            >
              {aiLoading === 'schedule' ? 'Scheduling…' : 'AI schedule'}
            </button>
          )}

          <button onClick={handleAiConflicts} className={BTN_GHOST} disabled={aiLoading !== null}>
            {aiLoading === 'conflicts' ? 'Analyzing…' : 'AI conflicts'}
            {conflictsCount > 0 && (
              <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300">
                {conflictsCount}
              </span>
            )}
          </button>

          <button onClick={handleAiPriorities} className={BTN_GHOST} disabled={aiLoading !== null}>
            {aiLoading === 'priorities' ? 'Recommending…' : 'AI priorities'}
          </button>

          {/* Conflicts panel toggle (only when there are conflicts to show) */}
          {conflictsCount > 0 && (
            <button
              onClick={() => setShowConflictsPanel((p) => !p)}
              className={BTN_GHOST}
              aria-expanded={showConflictsPanel}
            >
              {showConflictsPanel ? 'Hide conflicts' : 'View conflicts'}
            </button>
          )}
        </div>

        {Array.isArray(aiSchedule) && aiSchedule.length > 0 && (
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Suggested schedule for {aiSchedule.length} initiatives. Review and apply when ready.
          </div>
        )}
        {showConflictsPanel && (localConflicts.length > 0 || aiConflictList.length > 0) && (
          <InitiativeConflictsPanel
            conflicts={[...localConflicts, ...aiConflictList]}
            title="Conflicts (Local + AI)"
          />
        )}
        {aiPriorities && (
          <div className="mt-3 space-y-2">
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              AI Priority Recommendations
            </h4>
            {Array.isArray(aiPriorities) ? (
              <div className="space-y-1.5">
                {aiPriorities.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 bg-slate-50/70 dark:bg-white/[0.03] rounded-lg"
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-200/70 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                        {item.name || item.initiativeName || item.title || `Initiative #${idx + 1}`}
                      </p>
                      {(item.reason || item.rationale) && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.reason || item.rationale}
                        </p>
                      )}
                      {item.priority && (
                        <span
                          className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            item.priority === 'CRITICAL'
                              ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                              : item.priority === 'HIGH'
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                          }`}
                        >
                          {item.priority}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : typeof aiPriorities === 'object' ? (
              <div className="space-y-1.5">
                {Object.entries(aiPriorities).map(([key, value]: [string, any]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2 bg-slate-50/70 dark:bg-white/[0.03] rounded-lg"
                  >
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {key}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {typeof value === 'string' ? value : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
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
