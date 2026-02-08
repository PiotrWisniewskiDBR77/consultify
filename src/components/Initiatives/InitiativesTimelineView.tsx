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
    }));
  }, [dependencies, localInitiatives]);

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
        </div>

        {Array.isArray(aiSchedule) && aiSchedule.length > 0 && (
          <div className="mt-3 text-xs text-slate-400">
            Suggested schedule for {aiSchedule.length} initiatives.
          </div>
        )}
        {aiConflicts && (
          <pre className="mt-3 text-xs text-slate-400 whitespace-pre-wrap">
            {JSON.stringify(aiConflicts, null, 2)}
          </pre>
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
