import { describe, expect, it } from 'vitest';

import {
  ArtifactPlanningRequestSchema,
  RegisterArtifactOriginParamsSchema,
} from '../../../../../server/src/types/artifactRegistry.js';
import {
  deriveArtifactValidationSnapshot,
  deriveArtifactRunStatusFromExecutionState,
  deriveArtifactVisibilityScope,
  mapPresentationStatusToDeliveryState,
  mapReportStatusToDeliveryState,
  resolvePresentationSlideCount,
} from '../../../../../server/src/services/v8/artifactRegistryService.js';

describe('artifactRegistryService', () => {
  it('maps report builder native statuses into allowed shared delivery states', () => {
    expect(mapReportStatusToDeliveryState('CONFIGURING')).toBe('draft');
    expect(mapReportStatusToDeliveryState('GENERATING')).toBe('generated');
    expect(mapReportStatusToDeliveryState('IN_REVIEW')).toBe('in_review');
    expect(mapReportStatusToDeliveryState('APPROVED')).toBe('ready');
    expect(mapReportStatusToDeliveryState('SENT_INTERNAL')).toBe('shared');
    expect(mapReportStatusToDeliveryState('SENT_EXTERNAL')).toBe('shared');
  });

  it('maps presentation statuses into allowed shared delivery states', () => {
    expect(mapPresentationStatusToDeliveryState('draft')).toBe('draft');
    expect(mapPresentationStatusToDeliveryState('generating')).toBe('editing');
    expect(mapPresentationStatusToDeliveryState('ready')).toBe('ready');
    expect(mapPresentationStatusToDeliveryState('failed')).toBe('editing');
  });

  it('uses canonical deck_json cards over a stale materialized slide_count', () => {
    expect(
      resolvePresentationSlideCount(
        JSON.stringify({ cards: [{ card_id: '1' }, { card_id: '2' }] }),
        11
      )
    ).toBe(2);
    expect(resolvePresentationSlideCount('{malformed', 11)).toBe(11);
  });

  it('derives conservative default visibility for backfill and new artifacts', () => {
    expect(
      deriveArtifactVisibilityScope({
        outputType: 'report',
        projectId: 'proj-1',
        ownerUserId: 'user-1',
      }),
    ).toBe('project');
    expect(
      deriveArtifactVisibilityScope({
        outputType: 'report',
        ownerUserId: 'user-1',
      }),
    ).toBe('private');
    expect(
      deriveArtifactVisibilityScope({
        outputType: 'presentation',
        isBackfill: true,
      }),
    ).toBe('private');
    expect(
      deriveArtifactVisibilityScope({
        outputType: 'sheet',
        ownerUserId: 'user-1',
      }),
    ).toBe('private');
    expect(
      deriveArtifactVisibilityScope({
        outputType: 'sheet',
      }),
    ).toBe('organization');
  });

  it('accepts sheet in register-origin params schema', () => {
    const parsed = RegisterArtifactOriginParamsSchema.parse({
      organizationId: 'org-1',
      outputType: 'sheet',
      artifactFamily: 'sheet',
      originRuntime: 'sheet',
      originRecordId: 'tbl-1',
      createdBy: 'user-1',
    });
    expect(parsed.outputType).toBe('sheet');
  });

  it('accepts sheet as a valid planned artifact output', () => {
    const parsed = ArtifactPlanningRequestSchema.parse({
      organizationId: 'org-1',
      userId: 'user-1',
      conversationId: 'conv-1',
      contextSnapshotId: 'ctx-1',
      goal: 'Build an Excel operating model',
      requestedArtifactFamily: 'sheet',
      requestedOutputType: 'sheet',
    });

    expect(parsed.requestedArtifactFamily).toBe('sheet');
    expect(parsed.requestedOutputType).toBe('sheet');
  });

  it('derives richer artifact-run lifecycle states from execution state without rewriting persistence', () => {
    expect(
      deriveArtifactRunStatusFromExecutionState({
        persistedStatus: 'proposal_created',
        executionState: 'waiting_for_review',
      })
    ).toBe('awaiting_review');
    expect(
      deriveArtifactRunStatusFromExecutionState({
        persistedStatus: 'proposal_created',
        executionState: 'approved_for_apply',
      })
    ).toBe('approved_for_apply');
    expect(
      deriveArtifactRunStatusFromExecutionState({
        persistedStatus: 'proposal_created',
        executionState: 'applying',
      })
    ).toBe('applying');
    expect(
      deriveArtifactRunStatusFromExecutionState({
        persistedStatus: 'proposal_created',
        executionState: 'rejected',
      })
    ).toBe('rejected');
    expect(
      deriveArtifactRunStatusFromExecutionState({
        persistedStatus: 'completed',
        executionState: 'approved_for_apply',
      })
    ).toBe('completed');
  });

  it('derives cancelled terminal state from execution cancellation', () => {
    expect(
      deriveArtifactRunStatusFromExecutionState({
        persistedStatus: 'proposal_created',
        executionState: 'cancelled',
      })
    ).toBe('cancelled');
    expect(
      deriveArtifactRunStatusFromExecutionState({
        persistedStatus: 'cancelled',
        executionState: 'approved_for_apply',
      })
    ).toBe('cancelled');
    expect(
      deriveArtifactRunStatusFromExecutionState({
        persistedStatus: 'cancelled',
        executionState: null,
      })
    ).toBe('cancelled');
  });

  it('derives validation stage separately from review semantics', () => {
    expect(
      deriveArtifactValidationSnapshot({
        artifact: {
          titleSnapshot: 'Board report',
          contextSnapshotId: 'ctx-1',
          executionRunId: 'exec-1',
          sourceInitiativeId: null,
          originSummary: { sourceRefs: [{ artifactId: 'src-1' }] },
        },
        executionState: 'completed',
      }).state
    ).toBe('validated');

    expect(
      deriveArtifactValidationSnapshot({
        artifact: {
          titleSnapshot: 'Board report',
          contextSnapshotId: 'ctx-1',
          executionRunId: 'exec-1',
          sourceInitiativeId: null,
          originSummary: { sourceRefs: [{ artifactId: 'src-1' }] },
        },
        executionState: 'applying',
      }).state
    ).toBe('pending');

    expect(
      deriveArtifactValidationSnapshot({
        artifact: {
          titleSnapshot: '',
          contextSnapshotId: null,
          executionRunId: null,
          sourceInitiativeId: null,
          originSummary: null,
        },
      }).state
    ).toBe('attention_required');
  });
});
