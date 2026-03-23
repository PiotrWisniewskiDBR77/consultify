/**
 * F01 — Chat → Execution full handoff flow integration test
 *
 * Flow: User message → classifyIntent() returns governed_work →
 *       captureSnapshot() → createRun() → initiateHandoff() →
 *       createChatActionProposal() → verify handoff record links snapshot + run + proposal
 *
 * Services: contextSnapshotService, executionSpineService, chatExecutionService
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { captureSnapshot } from '../../../contextSnapshotService.js';
import { createRun } from '../../../executionSpineService.js';
import {
  classifyIntent,
  initiateHandoff,
  createChatActionProposal,
} from '../../../chatExecutionService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const WORKSPACE_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const CONVERSATION_ID = '00000000-0000-4000-8000-000000000020';
const MESSAGE_ID = '00000000-0000-4000-8000-000000000040';

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
});

describe('F01 — Chat → Execution full handoff flow', () => {
  it('canonical flow completes end-to-end', async () => {
    // Step 1: Classify intent — governed work message
    const intent = await classifyIntent(
      'Create a report from this note and add risk slides',
      '00000000-0000-4000-8000-000000000099',
      ORG_ID,
    );
    expect(intent.intentType).toBe('governed_work');
    expect(intent.suggestedAction).toBe('initiate_execution');

    // Step 2: Capture a context snapshot
    const snapshot = await captureSnapshot({
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      artifactRefs: [],
      effectiveScopeRef: 'scope:default',
      resolvedRoleRef: 'role:admin',
      initiatorUserId: USER_ID,
      consumerClass: 'chat',
      privacyMode: false,
      sourceContextRefs: [],
      conversationId: CONVERSATION_ID,
    });
    expect(snapshot.snapshotId).toBeDefined();
    expect(snapshot.organizationId).toBe(ORG_ID);
    expect(snapshot.conversationId).toBe(CONVERSATION_ID);

    // Step 3: Create an execution run using the snapshot
    const run = await createRun({
      organizationId: ORG_ID,
      contextSnapshotId: snapshot.snapshotId,
      initiatorUserId: USER_ID,
      goal: 'Create a report from this note and add risk slides',
    });
    expect(run.runId).toBeDefined();
    expect(run.contextSnapshotId).toBe(snapshot.snapshotId);
    expect(run.state).toBe('drafting');

    // Step 4: Initiate handoff — links conversation → snapshot → run
    // Mock getSnapshot to return our snapshot, and createRun to return our run
    mockDbGet.mockResolvedValueOnce(null); // getSnapshot internal call returns row
    // initiateHandoff calls getSnapshot internally, so we mock the contextSnapshotService
    // Since initiateHandoff imports contextSnapshotService directly, and we already
    // have the real captureSnapshot working (with mocked DB), we need to mock
    // the getSnapshot DB call to return the snapshot we captured.
    mockDbGet.mockReset();
    mockDbGet.mockImplementation(
      (sql: string, _params?: unknown[]) => {
        if (typeof sql === 'string' && sql.includes('v8_context_snapshots')) {
          return Promise.resolve({
            snapshot_id: snapshot.snapshotId,
            snapshot_version: 1,
            captured_at: snapshot.capturedAt,
            workspace_id: WORKSPACE_ID,
            organization_id: ORG_ID,
            project_id: null,
            conversation_id: CONVERSATION_ID,
            execution_run_id: null,
            artifact_refs: '[]',
            effective_scope_ref: 'scope:default',
            resolved_role_ref: 'role:admin',
            initiator_user_id: USER_ID,
            consumer_class: 'chat',
            privacy_mode: 0,
            source_context_refs: '[]',
            drift_events: '[]',
            created_at: snapshot.capturedAt,
          });
        }
        return Promise.resolve(null);
      },
    );

    const handoff = await initiateHandoff({
      conversationId: CONVERSATION_ID,
      contextSnapshotId: snapshot.snapshotId,
      userId: USER_ID,
      organizationId: ORG_ID,
      goal: 'Create a report from this note and add risk slides',
    });

    expect(handoff.handoffId).toBeDefined();
    expect(handoff.conversationId).toBe(CONVERSATION_ID);
    expect(handoff.contextSnapshotId).toBe(snapshot.snapshotId);
    expect(handoff.executionRunId).toBeDefined();
    expect(handoff.organizationId).toBe(ORG_ID);
    expect(handoff.initiatorUserId).toBe(USER_ID);
    expect(handoff.intentClassification.intentType).toBe('governed_work');

    // Step 5: Create a chat action proposal linked to the handoff
    const proposal = await createChatActionProposal({
      conversationId: CONVERSATION_ID,
      messageId: MESSAGE_ID,
      underlyingProposalId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
      organizationId: ORG_ID,
      displaySummary: 'Create report with risk slides from note',
      renderingHints: {
        style: 'card_expanded',
        showPreview: true,
        showRiskBadge: true,
        collapsible: true,
        expirationWarning: false,
      },
    });

    expect(proposal.chatProposalId).toBeDefined();
    expect(proposal.conversationId).toBe(CONVERSATION_ID);
    expect(proposal.organizationId).toBe(ORG_ID);

    // Verify the full chain: handoff links snapshot + run, proposal links to conversation
    expect(handoff.contextSnapshotId).toBe(snapshot.snapshotId);
    expect(handoff.executionRunId).toBeDefined();
    expect(proposal.conversationId).toBe(handoff.conversationId);
  });

  it('intermediate outputs satisfy downstream contracts', async () => {
    // classifyIntent output has fields needed by initiateHandoff
    const intent = await classifyIntent(
      'Build a deck from this initiative',
      '00000000-0000-4000-8000-000000000099',
      ORG_ID,
    );
    expect(intent).toHaveProperty('intentType');
    expect(intent).toHaveProperty('confidence');
    expect(intent).toHaveProperty('suggestedAction');
    expect(intent).toHaveProperty('classifiedAt');
    expect(typeof intent.intentType).toBe('string');
    expect(typeof intent.confidence).toBe('number');

    // captureSnapshot output has snapshotId needed by createRun and initiateHandoff
    const snapshot = await captureSnapshot({
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      artifactRefs: [],
      effectiveScopeRef: 'scope:default',
      resolvedRoleRef: 'role:admin',
      initiatorUserId: USER_ID,
      consumerClass: 'chat',
      privacyMode: false,
      sourceContextRefs: [],
    });
    expect(snapshot).toHaveProperty('snapshotId');
    expect(snapshot).toHaveProperty('organizationId');
    expect(typeof snapshot.snapshotId).toBe('string');
    expect(snapshot.snapshotId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // createRun output has runId needed by initiateHandoff
    const run = await createRun({
      organizationId: ORG_ID,
      contextSnapshotId: snapshot.snapshotId,
      initiatorUserId: USER_ID,
      goal: 'Build a deck',
    });
    expect(run).toHaveProperty('runId');
    expect(run).toHaveProperty('contextSnapshotId');
    expect(run).toHaveProperty('state');
    expect(typeof run.runId).toBe('string');
    expect(run.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // createChatActionProposal requires conversationId, messageId, underlyingProposalId, organizationId
    const proposalParams = {
      conversationId: CONVERSATION_ID,
      messageId: MESSAGE_ID,
      underlyingProposalId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
      organizationId: ORG_ID,
      displaySummary: 'Test proposal',
      renderingHints: {
        style: 'card_expanded' as const,
        showPreview: true,
        showRiskBadge: false,
        collapsible: true,
        expirationWarning: false,
      },
    };
    const proposal = await createChatActionProposal(proposalParams);
    expect(proposal).toHaveProperty('chatProposalId');
    expect(proposal).toHaveProperty('conversationId');
    expect(proposal).toHaveProperty('underlyingProposalId');
  });
});
