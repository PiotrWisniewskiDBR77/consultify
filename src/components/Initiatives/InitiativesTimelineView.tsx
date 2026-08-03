/**
 * InitiativesTimelineView
 *
 * Canonical initiatives timeline based on the Execution timeline surface.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { bumpInitiativeRefresh } from '@/store/useInitiativeRefreshStore';

import type { FullInitiative, PortfolioInitiative, RelatedInitiative } from '../../types';
import { type CriticalPathInfo, ExecutionTimelineView } from '../Execution/ExecutionTimelineView';

interface Dependency {
  id: string;
  fromInitiativeId: string;
  toInitiativeId: string;
  type: 'FINISH_TO_START' | 'START_TO_START';
}

/** Shape of one task row from GET /pmo/tasks/critical-path (task-level CPM,
 *  server/src/services/criticalPathService.ts). Only the fields we roll up
 *  onto initiatives are listed here. */
interface CriticalPathTaskRow {
  initiativeId?: string | null;
  isCritical?: boolean;
  slack?: number;
}

interface InitiativesTimelineViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
  projectId?: string;
}

const PRIORITY_MAP: Record<PortfolioInitiative['priority'], FullInitiative['priority']> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

function mapDependencyToRelation(
  initiativeId: string,
  dependency: Dependency,
  createdAt: string
): RelatedInitiative {
  return {
    id: dependency.id,
    initiativeId,
    relatedInitiativeId: dependency.fromInitiativeId,
    relationType: 'DEPENDS_ON',
    createdAt,
    createdBy: 'system',
  };
}

function mapPortfolioToFullInitiative(
  initiative: PortfolioInitiative,
  fallbackProjectId: string | undefined,
  relatedInitiatives: RelatedInitiative[]
): FullInitiative {
  const plannedStartDate = initiative.plannedStartDate;
  const plannedEndDate = initiative.plannedEndDate;

  return {
    id: initiative.id,
    projectId: initiative.projectId || fallbackProjectId || 'portfolio',
    name: initiative.name,
    description: initiative.description,
    axis: initiative.axis as FullInitiative['axis'],
    priority: PRIORITY_MAP[initiative.priority],
    complexity: 'Medium',
    status: initiative.status,
    summary: initiative.summary,
    sourceId: initiative.sourceId,
    sourceType: initiative.sourceType,
    budget: initiative.budget,
    expectedRoi: initiative.expectedRoi,
    plannedStartDate,
    plannedEndDate,
    startDate: plannedStartDate,
    endDate: plannedEndDate,
    ownerBusinessId: initiative.ownerBusiness?.id,
    ownerExecutionId: initiative.ownerExecution?.id,
    ownerBusiness: initiative.ownerBusiness,
    ownerExecution: initiative.ownerExecution,
    progress: initiative.progress,
    createdAt: initiative.createdAt,
    updatedAt: initiative.updatedAt,
    relatedInitiatives,
  };
}

export const InitiativesTimelineView: React.FC<InitiativesTimelineViewProps> = ({
  initiatives,
  onInitiativeClick,
  projectId,
}) => {
  const { t } = useTranslation();
  const [localInitiatives, setLocalInitiatives] = useState<PortfolioInitiative[]>(initiatives);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [criticalPath, setCriticalPath] = useState<Map<string, CriticalPathInfo>>(new Map());

  useEffect(() => {
    setLocalInitiatives(initiatives);
  }, [initiatives]);

  // #76 — wire the real, task-level CPM engine (server/src/services/criticalPathService.ts,
  // GET /api/pmo/tasks/critical-path) into the timeline. It previously had zero callers in
  // the front-end; the ring highlight was driven entirely by a client-side longest-chain
  // heuristic over initiative-level dependencies (see ExecutionTimelineView.computeExecutionCriticalPath).
  // The endpoint requires either initiativeId or projectId — this view lists many initiatives
  // at once, so we use projectId (the project currently in scope) and roll task-level
  // criticality/slack up to whichever initiative each task belongs to.
  // Fail-soft by design: no projectId, an empty result, or a request error all leave
  // `criticalPath` empty, so ExecutionTimelineView falls back to its existing heuristic
  // — the timeline renders exactly as it does today.
  useEffect(() => {
    if (!projectId) {
      setCriticalPath(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await Api.get(
          `/pmo/tasks/critical-path?projectId=${encodeURIComponent(projectId)}`
        );
        const tasks: CriticalPathTaskRow[] = Array.isArray(response?.tasks) ? response.tasks : [];
        const map = new Map<string, CriticalPathInfo>();
        for (const task of tasks) {
          const initiativeId = task.initiativeId;
          if (!initiativeId) continue;
          const prev = map.get(initiativeId);
          const isCritical = !!task.isCritical || !!prev?.isCritical;
          const taskSlack = typeof task.slack === 'number' ? task.slack : undefined;
          const slackDays =
            taskSlack === undefined
              ? (prev?.slackDays ?? 0)
              : prev
                ? Math.min(prev.slackDays, taskSlack)
                : taskSlack;
          map.set(initiativeId, { isCritical, slackDays });
        }
        if (!cancelled) setCriticalPath(map);
      } catch (error) {
        console.error('[InitiativesTimelineView] Failed to load critical path:', error);
        if (!cancelled) setCriticalPath(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const loadDependencies = useCallback(async () => {
    try {
      const query = projectId ? `?projectId=${projectId}` : '';
      const response = await Api.get(`/initiatives/portfolio/dependencies${query}`);
      setDependencies(Array.isArray(response?.dependencies) ? response.dependencies : []);
    } catch (error: any) {
      console.error('[InitiativesTimelineView] Failed to load dependencies:', error);
      setDependencies([]);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDependencies();
  }, [loadDependencies]);

  const dependencyMap = useMemo(() => {
    const createdAt = new Date().toISOString();
    return dependencies.reduce<Map<string, RelatedInitiative[]>>((acc, dependency) => {
      const existing = acc.get(dependency.toInitiativeId) || [];
      existing.push(mapDependencyToRelation(dependency.toInitiativeId, dependency, createdAt));
      acc.set(dependency.toInitiativeId, existing);
      return acc;
    }, new Map<string, RelatedInitiative[]>());
  }, [dependencies]);

  const timelineInitiatives = useMemo(
    () =>
      localInitiatives.map((initiative) =>
        mapPortfolioToFullInitiative(initiative, projectId, dependencyMap.get(initiative.id) || [])
      ),
    [dependencyMap, localInitiatives, projectId]
  );

  const handleTimelineClick = useCallback(
    (initiative: FullInitiative) => {
      const match = localInitiatives.find((item) => item.id === initiative.id);
      if (match) {
        onInitiativeClick(match);
      }
    },
    [localInitiatives, onInitiativeClick]
  );

  const handleUpdateInitiative = useCallback(
    async (updated: FullInitiative) => {
      const nextStart = updated.plannedStartDate || updated.startDate;
      const nextEnd = updated.plannedEndDate || updated.endDate;
      let previous: PortfolioInitiative | undefined;

      setLocalInitiatives((prev) => {
        previous = prev.find((initiative) => initiative.id === updated.id);
        return prev.map((initiative) =>
          initiative.id === updated.id
            ? {
                ...initiative,
                plannedStartDate: nextStart,
                plannedEndDate: nextEnd,
              }
            : initiative
        );
      });

      try {
        await Api.patch(`/initiatives/${updated.id}/quick-update`, {
          plannedStartDate: nextStart,
          plannedEndDate: nextEnd,
        });
        toast.success(t('initiatives.toast.scheduleUpdated', 'Harmonogram zaktualizowany'));
        // INI-05: the portfolio list / detail view for this initiative must
        // not keep showing the pre-drag dates.
        bumpInitiativeRefresh();
      } catch (error: any) {
        if (previous) {
          setLocalInitiatives((prev) =>
            prev.map((initiative) => (initiative.id === previous?.id ? previous : initiative))
          );
        }

        const msg =
          error?.data?.error ||
          error?.message ||
          t('initiatives.toast.scheduleUpdateError', 'Could not update the schedule');
        toast.error(msg);
      }
    },
    [t]
  );

  return (
    <div className="h-full min-h-0" data-testid="initiatives-timeline">
      <ExecutionTimelineView
        initiatives={timelineInitiatives}
        onInitiativeClick={handleTimelineClick}
        onUpdateInitiative={handleUpdateInitiative}
        onDependenciesChanged={loadDependencies}
        projectId={projectId}
        serverCriticalPath={criticalPath}
      />
    </div>
  );
};

export default InitiativesTimelineView;
