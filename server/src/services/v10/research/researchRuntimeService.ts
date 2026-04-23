import type {
  ResearchMissionPlanRequest,
  ResearchMissionPlanResponse,
  ResearchMissionRequest,
  ResearchRuntimeScope,
  ResearchMissionResponse,
  ResearchMissionSummaryRequest,
  ResearchMissionSummaryResponse,
  ResearchMissionWatchRequest,
  ResearchMissionWatchResponse,
} from '../../../types/v10/research-runtime.js';
import {
  ResearchMissionPlanRequestSchema,
  ResearchMissionRequestSchema,
  ResearchMissionSummaryRequestSchema,
  ResearchMissionWatchRequestSchema,
} from '../../../types/v10/research-runtime.js';
import {
  runResearchMissionPipeline,
  unsafeResearchMissionPipelineRunId,
} from '../../../models/v10/pipelines/ResearchMissionPipeline.js';

type MissionStatus = 'planned' | 'running' | 'completed';
type MissionRecord = {
  missionId: string;
  tenantId: string;
  userId: string;
  status: MissionStatus;
  query: string;
  createdAt: string;
  updatedAt: string;
  summary: string;
  events: Array<{ seq: number; at: string; kind: string; message: string }>;
};

const missionStore = new Map<string, Map<string, MissionRecord>>();

function nowIso(provided?: string): string {
  return provided?.trim() || new Date().toISOString();
}

function pushEvent(record: MissionRecord, kind: string, message: string, at: string) {
  const seq = record.events.length;
  record.events.push({ seq, at, kind, message });
  record.updatedAt = at;
}

function requireScope(scope: ResearchRuntimeScope | null | undefined): ResearchRuntimeScope {
  if (!scope?.tenantId || !scope?.userId) {
    throw new ResearchRuntimeInputError(
      'RESEARCH_RUNTIME_SCOPE_REQUIRED',
      'Research runtime requires tenant and user scope'
    );
  }
  return {
    tenantId: String(scope.tenantId),
    userId: String(scope.userId),
    userRole: scope.userRole ? String(scope.userRole) : null,
  };
}

function storeForTenant(tenantId: string): Map<string, MissionRecord> {
  const key = String(tenantId || '').trim();
  let store = missionStore.get(key);
  if (!store) {
    store = new Map<string, MissionRecord>();
    missionStore.set(key, store);
  }
  return store;
}

export class ResearchRuntimeInputError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = 'ResearchRuntimeInputError';
    this.code = code;
    this.status = status;
  }
}

export class ResearchRuntimeMissionNotFoundError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(missionId: string, status = 404) {
    super(`Research mission not found: ${missionId}`);
    this.name = 'ResearchRuntimeMissionNotFoundError';
    this.code = 'RESEARCH_RUNTIME_MISSION_NOT_FOUND';
    this.status = status;
  }
}

export class ResearchRuntimeService {
  planMission(input: ResearchMissionPlanRequest): ResearchMissionPlanResponse {
    const parsed = ResearchMissionPlanRequestSchema.parse(input);
    const scope = requireScope(parsed.scope);
    const now = nowIso(parsed.now);
    const missionId = crypto.randomUUID();

    const plan =
      parsed.depth === 'quick'
        ? ([
            { kind: 'scope', label: 'Clarify scope and constraints' },
            { kind: 'sources', label: 'Select a small source set' },
            { kind: 'synthesize', label: 'Synthesize summary' },
            { kind: 'deliver', label: 'Deliver mission summary' },
          ] as const)
        : parsed.depth === 'deep'
          ? ([
              { kind: 'scope', label: 'Clarify scope and constraints' },
              { kind: 'sources', label: 'Enumerate and prioritize sources' },
              { kind: 'extract', label: 'Extract structured notes' },
              { kind: 'synthesize', label: 'Synthesize findings with citations' },
              { kind: 'qa', label: 'Cross-check and identify gaps' },
              { kind: 'deliver', label: 'Deliver mission summary' },
            ] as const)
          : ([
              { kind: 'scope', label: 'Clarify scope and constraints' },
              { kind: 'sources', label: 'Select sources' },
              { kind: 'extract', label: 'Extract notes' },
              { kind: 'synthesize', label: 'Synthesize summary' },
              { kind: 'deliver', label: 'Deliver mission summary' },
            ] as const);

    const record: MissionRecord = {
      missionId,
      tenantId: scope.tenantId,
      userId: scope.userId,
      status: 'planned',
      query: parsed.query,
      createdAt: now,
      updatedAt: now,
      summary: `Planned (${parsed.depth}, maxSources=${parsed.maxSources}): ${parsed.query}`,
      events: [],
    };
    pushEvent(record, 'mission_planned', record.summary, now);
    storeForTenant(scope.tenantId).set(missionId, record);

    return { missionId, now, plan: [...plan], missionSummary: record.summary };
  }

  startMission(input: ResearchMissionRequest): ResearchMissionResponse {
    const parsed = ResearchMissionRequestSchema.parse(input);
    const scope = requireScope(parsed.scope);
    const now = nowIso(parsed.now);
    const tenantStore = storeForTenant(scope.tenantId);
    const existing = parsed.missionId ? tenantStore.get(parsed.missionId) || null : null;
    const missionId = existing?.missionId || parsed.missionId?.trim() || crypto.randomUUID();
    const pipeline = runResearchMissionPipeline({
      missionId: unsafeResearchMissionPipelineRunId(missionId),
      query: parsed.query,
      now,
    });
    const record: MissionRecord = existing ?? {
      missionId: String(pipeline.missionId),
      tenantId: scope.tenantId,
      userId: scope.userId,
      status: 'running',
      query: parsed.query,
      createdAt: now,
      updatedAt: now,
      summary: pipeline.summary,
      events: [],
    };
    record.status = 'running';
    record.summary = pipeline.summary;
    pushEvent(record, 'mission_started', `Started mission for "${parsed.query}"`, now);
    pushEvent(record, 'delta', pipeline.summary, now);
    pushEvent(record, 'mission_completed', 'Completed (MVP)', now);
    record.status = 'completed';
    tenantStore.set(record.missionId, record);

    return { missionId: record.missionId, now: pipeline.now, summary: pipeline.summary };
  }

  watchMission(input: ResearchMissionWatchRequest): ResearchMissionWatchResponse {
    const parsed = ResearchMissionWatchRequestSchema.parse(input);
    const scope = requireScope(parsed.scope);
    const now = nowIso(parsed.now);
    const record = storeForTenant(scope.tenantId).get(parsed.missionId);
    if (!record) {
      throw new ResearchRuntimeMissionNotFoundError(parsed.missionId);
    }
    const cursor = Math.max(0, parsed.cursor);
    const events = record.events.slice(cursor);
    const nextCursor = cursor + events.length;
    return {
      missionId: record.missionId,
      now,
      nextCursor,
      events,
      completed: record.status === 'completed',
    };
  }

  getMissionSummary(input: ResearchMissionSummaryRequest): ResearchMissionSummaryResponse {
    const parsed = ResearchMissionSummaryRequestSchema.parse(input);
    const scope = requireScope(parsed.scope);
    const now = new Date().toISOString();
    const record = storeForTenant(scope.tenantId).get(parsed.missionId);
    if (!record) {
      throw new ResearchRuntimeMissionNotFoundError(parsed.missionId);
    }
    return { missionId: record.missionId, now, summary: record.summary, status: record.status };
  }
}

export const researchRuntimeService = new ResearchRuntimeService();

