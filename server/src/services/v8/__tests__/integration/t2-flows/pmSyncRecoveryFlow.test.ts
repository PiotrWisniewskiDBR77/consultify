/**
 * F06 — PM sync failure → recovery flow
 *
 * Services: pmSyncTruthService, pmSyncAuthService, replayDeadLetterService, operatorAdminService
 *
 * Flow: setConnectorAuthState() (to degraded) → classifyFailure() → checkEscalationLevel()
 *       → createDeadLetterRecord() → recordFleetHealth() → initiateEmergencyPause()
 *       → verify degraded auth → failure classified → dead-letter created
 *       → fleet health updated → pause active
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

import { initiateEmergencyPause, recordFleetHealth } from '../../../operatorAdminService.js';
import { checkEscalationLevel, classifyFailure } from '../../../pmSyncAuthService.js';
import { getConnectorAuthState, setConnectorAuthState } from '../../../pmSyncTruthService.js';
import { createDeadLetterRecord } from '../../../replayDeadLetterService.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const CONNECTOR_ID = 'jira-connector-1';
const USER_ID = 'user-admin-1';
const PROVIDER_KEY = 'jira';

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('F06 — PM sync failure → recovery', () => {
  it('canonical flow completes end-to-end', async () => {
    // Step 1: Set auth state to degraded (simulating healthy → degraded_reauth_needed)
    mockDbGet.mockResolvedValueOnce({
      record_id: 'prev-record',
      connector_id: CONNECTOR_ID,
      organization_id: ORG_ID,
      auth_state: 'healthy',
      previous_state: 'connected_pending_verification',
      transitioned_at: '2026-03-23T08:00:00.000Z',
      transitioned_by: USER_ID,
      reason: null,
      created_at: '2026-03-23T08:00:00.000Z',
    });

    const authResult = await setConnectorAuthState({
      connectorId: CONNECTOR_ID,
      organizationId: ORG_ID,
      targetState: 'degraded_reauth_needed',
      transitionedBy: USER_ID,
      reason: 'Token expired',
    });

    expect(authResult.authState).toBe('degraded_reauth_needed');
    expect(authResult.previousState).toBe('healthy');
    expect(authResult.connectorId).toBe(CONNECTOR_ID);

    // Step 2: Classify the failure type
    const failureAction = classifyFailure('expired_token');
    expect(failureAction).toBe('reauth_now');

    const transientAction = classifyFailure('network_timeout');
    expect(transientAction).toBe('retry_later');

    // Step 3: Check escalation level — recently degraded → healthy (< 4h)
    mockDbGet.mockResolvedValueOnce({
      auth_state: 'degraded_reauth_needed',
      transitioned_at: new Date().toISOString(),
    });

    const escalation = await checkEscalationLevel(CONNECTOR_ID, ORG_ID);
    expect(escalation).toBe('healthy');

    // Step 4: Create dead-letter record using connector context from step 1
    const deadLetter = await createDeadLetterRecord({
      originalJobRef: 'sync-job-001',
      originalPayloadRef: 'payload-ref-001',
      eventName: 'task.sync',
      connectorId: authResult.connectorId,
      organizationId: authResult.organizationId,
      providerKey: PROVIDER_KEY,
      objectType: 'Task',
      objectRef: 'task-456',
      reason: 'Auth degraded — token expired',
      errorClass: 'auth_failure',
      replayEligibility: 'eligible',
      retryCount: 3,
      lastAttemptAt: new Date().toISOString(),
      correlationId: 'corr-001',
      operatorNote: null,
    });

    expect(deadLetter.deadLetterId).toBeDefined();
    expect(deadLetter.connectorId).toBe(CONNECTOR_ID);
    expect(deadLetter.errorClass).toBe('auth_failure');
    expect(deadLetter.resolutionState).toBe('pending_review');

    // Step 5: Record fleet health with dead-letter count from step 4
    mockDbGet.mockResolvedValueOnce(null);

    const fleetHealth = await recordFleetHealth({
      connectorId: authResult.connectorId,
      organizationId: authResult.organizationId,
      providerKey: PROVIDER_KEY,
      authState: 'degraded_reauth_needed',
      providerTier: 'A',
      lastSyncSuccess: '2026-03-23T07:00:00.000Z',
      lastSyncFailure: new Date().toISOString(),
      stalenessIndicator: 1,
      driftState: 'none',
      deadLetterCount: 1,
      conflictCount: 0,
    });

    expect(fleetHealth.entryId).toBeDefined();
    expect(fleetHealth.authState).toBe('degraded_reauth_needed');
    expect(fleetHealth.deadLetterCount).toBe(1);

    // Step 6: Initiate emergency pause
    const pause = await initiateEmergencyPause({
      organizationId: authResult.organizationId,
      pauseScope: 'provider_type',
      providerKey: PROVIDER_KEY,
      pausedBy: USER_ID,
      reason: 'Auth degraded with dead-letter accumulation',
      blastRadius: 1,
    });

    expect(pause.pauseId).toBeDefined();
    expect(pause.pauseScope).toBe('provider_type');
    expect(pause.providerKey).toBe(PROVIDER_KEY);
    expect(pause.resumedAt).toBeNull();

    // Verify end-to-end chain
    expect(authResult.organizationId).toBe(deadLetter.organizationId);
    expect(authResult.connectorId).toBe(deadLetter.connectorId);
    expect(fleetHealth.organizationId).toBe(pause.organizationId);
  });

  it('intermediate outputs satisfy downstream contracts', async () => {
    // Auth state output → classifyFailure input (error type mapping)
    const authBreakAction = classifyFailure('revoked_token');
    expect(authBreakAction).toBe('reauth_now');

    // Auth state output → checkEscalationLevel input (connector + org)
    mockDbGet.mockResolvedValueOnce({
      auth_state: 'degraded_reauth_needed',
      transitioned_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    });
    const escalationLevel = await checkEscalationLevel(CONNECTOR_ID, ORG_ID);
    expect(escalationLevel).toBe('degraded');

    // Dead-letter output → fleet health input (deadLetterCount is numeric)
    const deadLetter = await createDeadLetterRecord({
      originalJobRef: 'job-002',
      eventName: 'task.sync',
      connectorId: CONNECTOR_ID,
      organizationId: ORG_ID,
      providerKey: PROVIDER_KEY,
      objectType: 'Task',
      objectRef: 'task-789',
      reason: 'Provider outage',
      errorClass: 'provider_outage',
      replayEligibility: 'eligible',
      retryCount: 5,
      lastAttemptAt: new Date().toISOString(),
      correlationId: 'corr-002',
    });

    expect(typeof deadLetter.deadLetterId).toBe('string');
    expect(deadLetter.deadLetterId.length).toBeGreaterThan(0);

    // Fleet health output → emergency pause input (same org)
    mockDbGet.mockResolvedValueOnce(null);
    const health = await recordFleetHealth({
      connectorId: CONNECTOR_ID,
      organizationId: ORG_ID,
      providerKey: PROVIDER_KEY,
      authState: 'degraded_reauth_needed',
      providerTier: 'A',
      stalenessIndicator: 2,
      driftState: 'none',
      deadLetterCount: 2,
      conflictCount: 0,
    });

    expect(health.organizationId).toBe(ORG_ID);

    const pause = await initiateEmergencyPause({
      organizationId: health.organizationId,
      pauseScope: 'all_connectors',
      pausedBy: USER_ID,
      reason: 'Fleet health degraded',
      blastRadius: 5,
    });

    expect(pause.organizationId).toBe(health.organizationId);
    expect(pause.pauseScope).toBe('all_connectors');
  });
});
