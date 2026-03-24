import { describe, expect, it } from 'vitest';

import {
  ArtifactPlanningRequestSchema,
  RegisterArtifactOriginParamsSchema,
} from '../../../../../server/src/types/artifactRegistry.js';
import {
  deriveArtifactVisibilityScope,
  mapPresentationStatusToDeliveryState,
  mapReportStatusToDeliveryState,
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
});
