/**
 * F07 — Output publish → recall flow
 *
 * Services: reportsPresModelService, publishReviewService
 *
 * Flow: createOutputArtifact() → createPublishRecord() → transitionPublishState()
 *       through lifecycle → submitReviewGate() → createCoordinatedPublish()
 *       → recallOutput() → verify full lifecycle with lineage preserved
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock DB layer ──────────────────────────────────────────────────────────

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Real service imports ───────────────────────────────────────────────────

import {
  createCoordinatedPublish,
  createPublishRecord,
  recallOutput,
  submitReviewGate,
  transitionPublishState,
} from '../../../publishReviewService.js';
import { createOutputArtifact } from '../../../reportsPresModelService.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000010';
const REVIEWER_ID = '00000000-0000-4000-8000-000000000020';

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('F07 — Output publish → recall', () => {
  it('canonical flow completes end-to-end', async () => {
    // Step 1: Create output artifact (report)
    const artifact = await createOutputArtifact({
      organizationId: ORG_ID,
      outputType: 'report',
      templateFamilyRef: 'family-001',
      sourceInitiativeId: 'initiative-001',
      aiGovernancePresetRef: 'preset-001',
      createdBy: USER_ID,
    });

    expect(artifact.artifactId).toBeDefined();
    expect(artifact.deliveryState).toBe('draft');
    expect(artifact.outputType).toBe('report');

    // Step 2: Create publish record for the artifact
    const publishRecord = await createPublishRecord({
      artifactId: artifact.artifactId,
      artifactType: 'report',
      organizationId: ORG_ID,
      publishedBy: USER_ID,
      reviewers: [REVIEWER_ID],
    });

    expect(publishRecord.recordId).toBeDefined();
    expect(publishRecord.artifactId).toBe(artifact.artifactId);
    expect(publishRecord.currentState).toBe('private_draft');

    // Step 3a: Transition private_draft → reviewable_share
    mockDbGet.mockResolvedValueOnce({
      record_id: publishRecord.recordId,
      artifact_id: artifact.artifactId,
      artifact_type: 'report',
      organization_id: ORG_ID,
      current_state: 'private_draft',
      published_by: USER_ID,
      published_at: null,
      reviewers: JSON.stringify([REVIEWER_ID]),
      approved_by: null,
      approved_at: null,
      created_at: publishRecord.createdAt,
      updated_at: publishRecord.updatedAt,
    });

    const reviewable = await transitionPublishState({
      recordId: publishRecord.recordId,
      organizationId: ORG_ID,
      newState: 'reviewable_share',
      actor: USER_ID,
    });

    expect(reviewable.currentState).toBe('reviewable_share');

    // Step 3b: Transition reviewable_share → in_review
    mockDbGet.mockResolvedValueOnce({
      record_id: publishRecord.recordId,
      artifact_id: artifact.artifactId,
      artifact_type: 'report',
      organization_id: ORG_ID,
      current_state: 'reviewable_share',
      published_by: USER_ID,
      published_at: null,
      reviewers: JSON.stringify([REVIEWER_ID]),
      approved_by: null,
      approved_at: null,
      created_at: publishRecord.createdAt,
      updated_at: reviewable.updatedAt,
    });

    const inReview = await transitionPublishState({
      recordId: publishRecord.recordId,
      organizationId: ORG_ID,
      newState: 'in_review',
      actor: USER_ID,
    });

    expect(inReview.currentState).toBe('in_review');

    // Step 4: Submit review gate
    mockDbGet.mockResolvedValueOnce({
      record_id: publishRecord.recordId,
      artifact_id: artifact.artifactId,
      artifact_type: 'report',
      organization_id: ORG_ID,
      current_state: 'in_review',
      published_by: USER_ID,
      published_at: null,
      reviewers: JSON.stringify([REVIEWER_ID]),
      approved_by: null,
      approved_at: null,
      created_at: publishRecord.createdAt,
      updated_at: inReview.updatedAt,
    });
    const reviewGate = await submitReviewGate({
      artifactId: artifact.artifactId,
      organizationId: ORG_ID,
      reviewType: 'peer_review',
      reviewerId: REVIEWER_ID,
      result: 'approved',
      comments: 'Looks good',
    });

    expect(reviewGate.gateId).toBeDefined();
    expect(reviewGate.artifactId).toBe(artifact.artifactId);
    expect(reviewGate.result).toBe('approved');
    mockDbAll.mockResolvedValueOnce([
      {
        gate_id: reviewGate.gateId,
        artifact_id: artifact.artifactId,
        organization_id: ORG_ID,
        review_type: reviewGate.reviewType,
        reviewer_id: REVIEWER_ID,
        result: 'approved',
        comments: reviewGate.comments,
        created_at: reviewGate.createdAt,
      },
    ]);

    // Step 5: Transition to approved
    mockDbGet.mockResolvedValueOnce({
      record_id: publishRecord.recordId,
      artifact_id: artifact.artifactId,
      artifact_type: 'report',
      organization_id: ORG_ID,
      current_state: 'in_review',
      published_by: USER_ID,
      published_at: null,
      reviewers: JSON.stringify([REVIEWER_ID]),
      approved_by: null,
      approved_at: null,
      created_at: publishRecord.createdAt,
      updated_at: inReview.updatedAt,
    });

    const approved = await transitionPublishState({
      recordId: publishRecord.recordId,
      organizationId: ORG_ID,
      newState: 'approved',
      actor: REVIEWER_ID,
    });

    expect(approved.currentState).toBe('approved');
    expect(approved.approvedBy).toBe(REVIEWER_ID);

    // Step 6: Create a second artifact (presentation) for coordinated publish
    const pairedArtifact = await createOutputArtifact({
      organizationId: ORG_ID,
      outputType: 'presentation',
      templateFamilyRef: 'family-001',
      sourceInitiativeId: 'initiative-001',
      aiGovernancePresetRef: 'preset-002',
      createdBy: USER_ID,
    });

    // Step 7: Create coordinated publish
    const coordinated = await createCoordinatedPublish({
      primaryArtifactId: artifact.artifactId,
      pairedArtifactId: pairedArtifact.artifactId,
      organizationId: ORG_ID,
      coordinationMode: 'coordinated',
    });

    expect(coordinated.coordinationId).toBeDefined();
    expect(coordinated.primaryArtifactId).toBe(artifact.artifactId);
    expect(coordinated.pairedArtifactId).toBe(pairedArtifact.artifactId);

    // Step 8: Recall the output
    const recall = await recallOutput({
      artifactId: artifact.artifactId,
      organizationId: ORG_ID,
      recalledBy: USER_ID,
      reason: 'Data correction needed',
    });

    expect(recall.recallId).toBeDefined();
    expect(recall.artifactId).toBe(artifact.artifactId);
    expect(recall.postRecallState).toBe('recalled');
    expect(recall.lineagePreserved).toBe(true);

    // Verify end-to-end chain
    expect(artifact.artifactId).toBe(publishRecord.artifactId);
    expect(publishRecord.artifactId).toBe(reviewGate.artifactId);
    expect(recall.artifactId).toBe(artifact.artifactId);
    expect(recall.lineagePreserved).toBe(true);
  });

  it('intermediate outputs satisfy downstream contracts', async () => {
    // Artifact output → publish record input (artifactId)
    const artifact = await createOutputArtifact({
      organizationId: ORG_ID,
      outputType: 'presentation',
      createdBy: USER_ID,
    });

    expect(typeof artifact.artifactId).toBe('string');
    expect(artifact.artifactId.length).toBeGreaterThan(0);

    const publishRecord = await createPublishRecord({
      artifactId: artifact.artifactId,
      artifactType: 'presentation',
      organizationId: ORG_ID,
      publishedBy: USER_ID,
      reviewers: [REVIEWER_ID],
    });

    expect(publishRecord.artifactId).toBe(artifact.artifactId);
    expect(publishRecord.currentState).toBe('private_draft');

    // Review gate output → coordinated publish input (same artifactId)
    mockDbGet.mockResolvedValueOnce({
      record_id: publishRecord.recordId,
      artifact_id: artifact.artifactId,
      artifact_type: 'presentation',
      organization_id: ORG_ID,
      current_state: 'private_draft',
      published_by: USER_ID,
      published_at: null,
      reviewers: JSON.stringify([REVIEWER_ID]),
      approved_by: null,
      approved_at: null,
      created_at: publishRecord.createdAt,
      updated_at: publishRecord.updatedAt,
    });
    const gate = await submitReviewGate({
      artifactId: artifact.artifactId,
      organizationId: ORG_ID,
      reviewType: 'compliance_review',
      reviewerId: REVIEWER_ID,
      result: 'approved',
      comments: null,
    });

    expect(gate.artifactId).toBe(artifact.artifactId);

    // Recall preserves lineage regardless of publish state
    const recall = await recallOutput({
      artifactId: artifact.artifactId,
      organizationId: ORG_ID,
      recalledBy: USER_ID,
      reason: 'Compliance issue discovered',
    });

    expect(recall.lineagePreserved).toBe(true);
    expect(recall.postRecallState).toBe('recalled');
    expect(recall.organizationId).toBe(ORG_ID);
  });
});
