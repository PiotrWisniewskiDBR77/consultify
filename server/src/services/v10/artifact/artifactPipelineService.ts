import crypto from 'crypto';
import { ZodError } from 'zod';

import type { ArtifactRuntimeArtifactDto } from '../../../types/v10/artifact-runtime.js';
import type { ArtifactRecord } from '../../../types/artifactRegistry.js';
import { registerArtifactOrigin } from '../../v8/artifactRegistryService.js';
import artifactRuntimeService from './artifactRuntimeService.js';
import type {
  ArtifactPipelinePreflightRequest,
  ArtifactPipelinePreflightResponse,
  ArtifactPipelineRunRequest,
  ArtifactPipelineRunResponse,
  ArtifactPipelineTimelineStep,
} from '../../../types/v10/artifact-pipeline.js';
import {
  artifactPipelinePreflightRequestSchema,
  artifactPipelineRunRequestSchema,
} from '../../../types/v10/artifact-pipeline.js';

type ArtifactStoreKey = string;
function storeKey(tenantId: string, artifactId: string): ArtifactStoreKey {
  return `${tenantId}:${artifactId}`;
}

type ArtifactRunKey = string;
function runKey(tenantId: string, runId: string): ArtifactRunKey {
  return `${tenantId}:${runId}`;
}

const artifactStore = new Map<ArtifactStoreKey, ArtifactRuntimeArtifactDto>();
const runStore = new Map<ArtifactRunKey, ArtifactPipelineRunResponse>();

class ArtifactPipelineInputError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = 'ArtifactPipelineInputError';
    this.code = code;
    this.status = status;
  }
}

function resolveRunId(provided?: string): string {
  return provided?.trim() || crypto.randomUUID();
}

function resolveNow(provided?: string): string {
  return provided?.trim() || new Date().toISOString();
}

function step(now: string, kind: ArtifactPipelineTimelineStep['kind'], detail?: string | null) {
  return { at: now, kind, detail: detail ?? null } satisfies ArtifactPipelineTimelineStep;
}

function materializePreviewArtifact(args: {
  now: string;
  artifact: ArtifactRuntimeArtifactDto;
  preview: unknown;
  nextReviewState?: string | null;
}): { next: ArtifactRuntimeArtifactDto; fromVersionId: string; toVersionId: string } {
  const fromVersionId = args.artifact.currentVersionId;
  const toVersionId = crypto.randomUUID();
  const nextReviewState = args.nextReviewState?.trim() || args.artifact.reviewState;

  const next: ArtifactRuntimeArtifactDto = {
    ...args.artifact,
    derivedFromVersionId: fromVersionId,
    currentVersionId: toVersionId,
    reviewState: nextReviewState as ArtifactRuntimeArtifactDto['reviewState'],
    updatedAt: args.now,
    content: args.preview,
  };

  return { next, fromVersionId, toVersionId };
}

function mapArtifactToOutputsFamilyAndType(artifact: Pick<ArtifactRuntimeArtifactDto, 'type'>): {
  artifactFamily: 'document' | 'presentation' | 'sheet';
  outputType: 'report' | 'presentation' | 'sheet';
} {
  switch (artifact.type) {
    case 'spreadsheet':
      return { artifactFamily: 'sheet', outputType: 'sheet' };
    case 'presentation':
      return { artifactFamily: 'presentation', outputType: 'presentation' };
    case 'memo':
    case 'decision_doc':
    case 'generic':
    default:
      return { artifactFamily: 'document', outputType: 'report' };
  }
}

function extractTitleSnapshot(content: unknown): string | null {
  if (!content || typeof content !== 'object') return null;
  const maybeTitle = (content as any).title;
  if (typeof maybeTitle === 'string' && maybeTitle.trim()) return maybeTitle.trim().slice(0, 180);
  return null;
}

export interface ArtifactPipelineServiceContract {
  preflight(input: ArtifactPipelinePreflightRequest): ArtifactPipelinePreflightResponse;
  run(input: ArtifactPipelineRunRequest): ArtifactPipelineRunResponse;
  getRun(args: {
    scope: { tenantId: string; userId: string; userRole: string | null };
    runId: string;
  }): ArtifactPipelineRunResponse | null;
  publishRunToOutputsLibrary(args: {
    scope: { tenantId: string; userId: string; userRole: string | null };
    runId: string;
  }): Promise<{ artifact: ArtifactRecord; origin: { originRuntime: 'native_artifact'; originRecordId: string } }>;
  getMaterializedArtifact(args: {
    scope: { tenantId: string; userId: string; userRole: string | null };
    artifactId: string;
  }): ArtifactRuntimeArtifactDto | null;
}

const artifactPipelineService: ArtifactPipelineServiceContract = {
  preflight(input: ArtifactPipelinePreflightRequest): ArtifactPipelinePreflightResponse {
    const parsed = artifactPipelinePreflightRequestSchema.parse(input);
    const now = resolveNow(parsed.now);
    const runId = resolveRunId(parsed.runId);

    // MVP: rely on the runtime request schema as the primary validation surface.
    const checks = [
      { id: 'request_schema_valid', status: 'pass' as const, message: null },
      {
        id: 'selection_context_present',
        status: parsed.selectionContext ? ('pass' as const) : ('fail' as const),
        message: parsed.selectionContext ? null : 'Missing selectionContext',
      },
      {
        id: 'selected_ops_nonempty',
        status: parsed.selectedOpIndices.length > 0 ? ('pass' as const) : ('warn' as const),
        message: parsed.selectedOpIndices.length > 0 ? null : 'No operations selected',
      },
    ];

    const ok = checks.every((c) => c.status !== 'fail');

    return {
      scope: parsed.scope,
      runId,
      now,
      ok,
      checks,
    };
  },

  run(input: ArtifactPipelineRunRequest): ArtifactPipelineRunResponse {
    const parsed = artifactPipelineRunRequestSchema.parse(input);
    const now = resolveNow(parsed.now);
    const runId = resolveRunId(parsed.runId);

    const preflight = artifactPipelineService.preflight({ ...parsed, runId, now });
    const timeline: ArtifactPipelineTimelineStep[] = [];

    if (!preflight.ok) {
      timeline.push(step(now, 'preflight_failed', 'Validation failed'));
      const result = {
        scope: parsed.scope,
        runId,
        now,
        timeline,
        plan: artifactRuntimeService.planMutation({ ...parsed, runId, now }),
        materialized: false,
        artifact: parsed.artifact,
        summary: {
          artifactId: parsed.artifact.id,
          fromVersionId: parsed.artifact.currentVersionId,
          toVersionId: null,
          reviewState: parsed.artifact.reviewState,
        },
      };
      runStore.set(runKey(parsed.scope.tenantId, runId), result);
      return result;
    }

    timeline.push(step(now, 'preflight_passed', null));

    const plan = artifactRuntimeService.planMutation({ ...parsed, runId, now });
    timeline.push(
      step(
        now,
        'mutation_planned',
        (plan as any)?.pipeline?.nextReviewState ? `next: ${(plan as any).pipeline.nextReviewState}` : null
      )
    );

    if (!parsed.materialize) {
      const result = {
        scope: parsed.scope,
        runId,
        now,
        timeline,
        plan,
        materialized: false,
        artifact: parsed.artifact,
        summary: {
          artifactId: parsed.artifact.id,
          fromVersionId: parsed.artifact.currentVersionId,
          toVersionId: null,
          reviewState: parsed.artifact.reviewState,
        },
      };
      runStore.set(runKey(parsed.scope.tenantId, runId), result);
      return result;
    }

    const { next, fromVersionId, toVersionId } = materializePreviewArtifact({
      now,
      artifact: parsed.artifact,
      preview: parsed.proposal.preview,
      nextReviewState: (plan as any)?.pipeline?.nextReviewState ?? null,
    });

    timeline.push(step(now, 'materialized_preview_applied', `version: ${toVersionId}`));

    artifactStore.set(storeKey(parsed.scope.tenantId, next.id), next);

    const result = {
      scope: parsed.scope,
      runId,
      now,
      timeline,
      plan,
      materialized: true,
      artifact: next,
      summary: {
        artifactId: next.id,
        fromVersionId,
        toVersionId,
        reviewState: next.reviewState,
      },
    };
    runStore.set(runKey(parsed.scope.tenantId, runId), result);
    return result;
  },

  getRun(args: {
    scope: { tenantId: string; userId: string; userRole: string | null };
    runId: string;
  }): ArtifactPipelineRunResponse | null {
    const runId = String(args.runId || '').trim();
    if (!runId) return null;
    return runStore.get(runKey(String(args.scope.tenantId || ''), runId)) ?? null;
  },

  async publishRunToOutputsLibrary(args: {
    scope: { tenantId: string; userId: string; userRole: string | null };
    runId: string;
  }): Promise<{ artifact: ArtifactRecord; origin: { originRuntime: 'native_artifact'; originRecordId: string } }> {
    const scope = args.scope;
    const runId = String(args.runId || '').trim();
    if (!runId) {
      throw new ArtifactPipelineInputError(
        'ARTIFACT_PIPELINE_RUN_ID_REQUIRED',
        'runId is required',
        422
      );
    }
    const run = runStore.get(runKey(String(scope.tenantId || ''), runId));
    if (!run) {
      throw new ArtifactPipelineInputError(
        'ARTIFACT_PIPELINE_RUN_NOT_FOUND',
        `Artifact pipeline run '${runId}' not found`,
        404
      );
    }

    const artifactDto = run.artifact as ArtifactRuntimeArtifactDto;
    const mapping = mapArtifactToOutputsFamilyAndType(artifactDto);
    const titleSnapshot = extractTitleSnapshot((artifactDto as any).content);

    const originRecordId = runId;
    const record = await registerArtifactOrigin({
      organizationId: String(scope.tenantId || ''),
      outputType: mapping.outputType,
      artifactFamily: mapping.artifactFamily,
      originRuntime: 'native_artifact',
      originRecordId,
      titleSnapshot,
      ownerUserId: String(scope.userId || '') || null,
      createdBy: String(scope.userId || ''),
      originSummary: {
        v10: {
          pipeline: 'artifact_pipeline',
          runId,
          artifactId: run.summary.artifactId,
          fromVersionId: run.summary.fromVersionId,
          toVersionId: run.summary.toVersionId,
          reviewState: run.summary.reviewState,
          content: (artifactDto as any).content,
        },
      },
    });

    if (!record) {
      throw new ArtifactPipelineInputError(
        'ARTIFACT_PIPELINE_OUTPUTS_LIBRARY_REJECTED',
        'Outputs Library registration failed',
        500
      );
    }

    return {
      artifact: record,
      origin: { originRuntime: 'native_artifact', originRecordId },
    };
  },

  getMaterializedArtifact(args: {
    scope: { tenantId: string; userId: string; userRole: string | null };
    artifactId: string;
  }): ArtifactRuntimeArtifactDto | null {
    const artifactId = String(args.artifactId || '').trim();
    if (!artifactId) return null;
    return artifactStore.get(storeKey(String(args.scope.tenantId || ''), artifactId)) ?? null;
  },
};

export function mapArtifactPipelineError(error: unknown): { status: number; body: unknown } {
  if (error instanceof ZodError) {
    return {
      status: 422,
      body: {
        error: 'Invalid artifact pipeline request',
        code: 'ARTIFACT_PIPELINE_INVALID_REQUEST',
        issues: error.issues,
      },
    };
  }

  if (error instanceof ArtifactPipelineInputError) {
    return {
      status: error.status,
      body: { error: error.message, code: error.code },
    };
  }

  if (error instanceof Error) {
    return {
      status: 422,
      body: { error: error.message, code: error.name },
    };
  }

  return {
    status: 500,
    body: { error: 'Unknown artifact pipeline failure', code: 'ARTIFACT_PIPELINE_UNKNOWN_ERROR' },
  };
}

export { ArtifactPipelineInputError };
export default artifactPipelineService;

