import { describe, expect, it } from 'vitest';

import {
  ArtifactPlanningRequestSchema,
  RegisterArtifactOriginParamsSchema,
} from '../../../../../server/src/types/artifactRegistry.js';
import {
  deriveArtifactValidationSnapshot,
  deriveArtifactRunStatusFromExecutionState,
  deriveArtifactVisibilityScope,
  mapArtifactRegistryListRow,
  mapPresentationStatusToDeliveryState,
  mapReportStatusToDeliveryState,
} from '../../../../../server/src/services/v8/artifactRegistryService.js';
import { resolveDeckContentCoherence } from '../../../../../server/src/services/presentationDeckDocumentService.js';

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

  it('maps presentation slide counts from canonical deck content without phantom slides', () => {
    const makeRow = (deckJson: string | null) => ({
      artifact_id: 'artifact-1',
      organization_id: 'org-1',
      output_type: 'presentation',
      artifact_family: 'presentation',
      delivery_state: 'ready',
      title_snapshot: 'Board deck',
      owner_user_id: 'user-1',
      canonical_home: null,
      visibility_scope: 'private',
      project_id: null,
      context_snapshot_id: null,
      execution_run_id: null,
      template_family_ref: null,
      source_initiative_id: null,
      ai_governance_preset_ref: null,
      origin_summary_json: null,
      is_draft: 0,
      created_by: 'user-1',
      created_at: '2026-08-28T00:00:00.000Z',
      last_transition_at: '2026-08-28T00:00:00.000Z',
      origin_runtime: 'presentation',
      origin_record_id: 'deck-1',
      report_title: null,
      report_status: null,
      report_type: null,
      report_source_refs_json: null,
      report_pdf_path: null,
      report_pptx_path: null,
      latest_completed_export_format: null,
      presentation_title: 'Board deck',
      presentation_status: 'ready',
      presentation_mode: 'briefing',
      presentation_slide_count: 11,
      presentation_deck_json: deckJson,
      presentation_has_unified_json: 0,
      presentation_unified_json: null,
      presentation_export_format: null,
      presentation_source_refs_json: null,
      publish_state: null,
      publish_reviewers: null,
      review_gate_count: 0,
      owner_name: null,
    });

    const canonical = makeRow(JSON.stringify({ cards: [{ card_id: '1' }, { card_id: '2' }] }));
    expect(
      resolveDeckContentCoherence({
        id: canonical.origin_record_id,
        organization_id: canonical.organization_id,
        title: canonical.presentation_title,
        status: canonical.presentation_status,
        slide_count: canonical.presentation_slide_count,
        deck_json: canonical.presentation_deck_json,
        unified_json: canonical.presentation_unified_json,
      })
    ).toMatchObject({
      cardCount: 2,
      declaredSlideCount: 11,
      hasCanonicalContent: true,
      coherent: false,
    });
    expect(mapArtifactRegistryListRow(canonical as never)).toMatchObject({
      slideCount: 2,
      declaredSlideCount: 11,
      contentState: 'canonical',
    });

    for (const unusableDeckJson of ['{malformed', '{}', JSON.stringify({ cards: [] }), null]) {
      expect(mapArtifactRegistryListRow(makeRow(unusableDeckJson) as never)).toMatchObject({
        slideCount: 0,
        declaredSlideCount: 11,
        contentState: 'missing',
      });
    }
  });

  it('derives conservative default visibility for backfill and new artifacts', () => {
    expect(
      deriveArtifactVisibilityScope({
        outputType: 'report',
        projectId: 'proj-1',
        ownerUserId: 'user-1',
      })
    ).toBe('project');
    expect(
      deriveArtifactVisibilityScope({
        outputType: 'report',
        ownerUserId: 'user-1',
      })
    ).toBe('private');
    expect(
      deriveArtifactVisibilityScope({
        outputType: 'presentation',
        isBackfill: true,
      })
    ).toBe('private');
    expect(
      deriveArtifactVisibilityScope({
        outputType: 'sheet',
        ownerUserId: 'user-1',
      })
    ).toBe('private');
    expect(
      deriveArtifactVisibilityScope({
        outputType: 'sheet',
      })
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
