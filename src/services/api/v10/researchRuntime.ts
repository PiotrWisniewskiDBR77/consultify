import { fetchWithRetry, handleDataResponse } from '../baseClient';

export type ResearchMissionPlanStepKind = 'scope' | 'sources' | 'extract' | 'synthesize' | 'qa' | 'deliver';

export type ResearchMissionPlanRequest = {
  query: string;
  now?: string;
  depth?: 'quick' | 'standard' | 'deep';
  maxSources?: number;
};

export type ResearchMissionPlanResponse = {
  missionId: string;
  now: string;
  plan: Array<{ kind: ResearchMissionPlanStepKind; label: string }>;
  missionSummary: string;
};

export type ResearchMissionStartRequest = { missionId?: string; query: string; now?: string };
export type ResearchMissionStartResponse = { missionId: string; now: string; summary: string };

export type ResearchMissionWatchRequest = { missionId: string; cursor?: number; now?: string };
export type ResearchMissionEventKind = 'mission_planned' | 'mission_started' | 'delta' | 'mission_completed';
export type ResearchMissionEvent = { seq: number; at: string; kind: ResearchMissionEventKind; message: string };
export type ResearchMissionWatchResponse = {
  missionId: string;
  now: string;
  nextCursor: number;
  events: ResearchMissionEvent[];
  completed: boolean;
};

export type ResearchMissionSummaryRequest = { missionId: string };
export type ResearchMissionSummaryResponse = {
  missionId: string;
  now: string;
  summary: string;
  status: 'planned' | 'running' | 'completed' | 'unknown';
};

export const ResearchRuntimeApi = {
  planMission: async (body: ResearchMissionPlanRequest): Promise<ResearchMissionPlanResponse> => {
    const res = await fetchWithRetry('/api/v10/research-runtime/missions/plan', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ResearchMissionPlanResponse>(res, 'Failed to plan research mission');
  },

  startMission: async (body: ResearchMissionStartRequest): Promise<ResearchMissionStartResponse> => {
    const res = await fetchWithRetry('/api/v10/research-runtime/missions/start', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ResearchMissionStartResponse>(res, 'Failed to start research mission');
  },

  watchMission: async (body: ResearchMissionWatchRequest): Promise<ResearchMissionWatchResponse> => {
    const res = await fetchWithRetry('/api/v10/research-runtime/missions/watch', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ResearchMissionWatchResponse>(res, 'Failed to watch research mission');
  },

  getSummary: async (body: ResearchMissionSummaryRequest): Promise<ResearchMissionSummaryResponse> => {
    const res = await fetchWithRetry('/api/v10/research-runtime/missions/summary', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ResearchMissionSummaryResponse>(res, 'Failed to load research mission summary');
  },

  delegatePlanFromReasoning: async (body: ResearchMissionPlanRequest): Promise<ResearchMissionPlanResponse> => {
    const res = await fetchWithRetry('/api/v10/reasoning-runtime/delegate/research/plan', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<ResearchMissionPlanResponse>(
      res,
      'Failed to delegate research planning from reasoning'
    );
  },
};

