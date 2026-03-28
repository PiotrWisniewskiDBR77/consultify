/**
 * F10 — MyWork cross-surface flow
 *
 * Services: myWorkRoofService, executionVisibilityService, concurrentEditingService
 *
 * Flow: setCanonicalObjectState() → getSurfaceProjection() for multiple surfaces
 *       → emitSignal() → recordInboxMaterialization()
 *       → verify canonical state → projections → signal → inbox chain,
 *       with latency band classification
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

import { acquireLock, releaseLock } from '../../../concurrentEditingService.js';
import { emitSignal } from '../../../executionVisibilityService.js';
import {
  getSurfaceProjection,
  recordInboxMaterialization,
  setCanonicalObjectState,
} from '../../../myWorkRoofService.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000010';
const OBJECT_ID = '00000000-0000-4000-8000-000000000030';

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('F10 — MyWork cross-surface', () => {
  it('canonical flow completes end-to-end', async () => {
    // Step 1: Set canonical object state with surface projections
    const canonicalState = await setCanonicalObjectState({
      objectId: OBJECT_ID,
      objectType: 'task',
      organizationId: ORG_ID,
      canonicalState: 'in_progress',
      surfaceProjections: {
        home: {
          surface: 'home',
          displayState: 'active',
          isStale: false,
          lastRefreshedAt: new Date().toISOString(),
        },
        inbox: {
          surface: 'inbox',
          displayState: 'unread',
          isStale: false,
          lastRefreshedAt: new Date().toISOString(),
        },
        calendar: {
          surface: 'calendar',
          displayState: 'scheduled',
          isStale: false,
          lastRefreshedAt: new Date().toISOString(),
        },
      },
    });

    expect(canonicalState.objectId).toBe(OBJECT_ID);
    expect(canonicalState.canonicalState).toBe('in_progress');
    expect(canonicalState.surfaceProjections).toBeDefined();
    expect(Object.keys(canonicalState.surfaceProjections)).toHaveLength(3);

    // Step 2: Get surface projections for multiple surfaces
    // Mock the DB get to return the canonical state for each projection query
    const mockCanonicalRow = {
      object_id: OBJECT_ID,
      object_type: 'task',
      organization_id: ORG_ID,
      canonical_state: 'in_progress',
      last_updated_at: canonicalState.lastUpdatedAt,
      surface_projections: JSON.stringify(canonicalState.surfaceProjections),
    };

    mockDbGet.mockResolvedValueOnce(mockCanonicalRow);
    const homeProjection = await getSurfaceProjection(OBJECT_ID, 'home', ORG_ID);
    expect(homeProjection).not.toBeNull();
    expect(homeProjection!.surface).toBe('home');
    expect(homeProjection!.displayState).toBe('active');

    mockDbGet.mockResolvedValueOnce(mockCanonicalRow);
    const inboxProjection = await getSurfaceProjection(OBJECT_ID, 'inbox', ORG_ID);
    expect(inboxProjection).not.toBeNull();
    expect(inboxProjection!.surface).toBe('inbox');
    expect(inboxProjection!.displayState).toBe('unread');

    mockDbGet.mockResolvedValueOnce(mockCanonicalRow);
    const calendarProjection = await getSurfaceProjection(OBJECT_ID, 'calendar', ORG_ID);
    expect(calendarProjection).not.toBeNull();
    expect(calendarProjection!.surface).toBe('calendar');

    // Step 3: Emit execution signal (task overdue)
    const signal = await emitSignal({
      signalType: 'overdue_tasks_count',
      sourceObjectType: 'task',
      sourceObjectId: OBJECT_ID,
      organizationId: ORG_ID,
      severity: 'warning',
      payload: {
        previousState: 'not_started',
        newState: 'in_progress',
        changedBy: USER_ID,
      },
    });

    expect(signal.signalId).toBeDefined();
    expect(signal.sourceObjectId).toBe(OBJECT_ID);
    expect(signal.signalType).toBe('overdue_tasks_count');
    expect(signal.severity).toBe('warning');

    // Step 4: Record inbox materialization with latency tracking
    const materialization = await recordInboxMaterialization({
      eventSourceRef: signal.signalId,
      inboxItemId: `inbox-item-${OBJECT_ID}`,
      userId: USER_ID,
      organizationId: ORG_ID,
      latencyMs: 1200,
    });

    expect(materialization.materializationId).toBeDefined();
    expect(materialization.eventSourceRef).toBe(signal.signalId);
    expect(materialization.latencyMs).toBe(1200);
    expect(materialization.latencyBand).toBe('near_realtime');

    // Verify end-to-end chain
    expect(canonicalState.objectId).toBe(signal.sourceObjectId);
    expect(signal.signalId).toBe(materialization.eventSourceRef);
    expect(canonicalState.organizationId).toBe(signal.organizationId);
    expect(signal.organizationId).toBe(materialization.organizationId);
  });

  it('intermediate outputs satisfy downstream contracts', async () => {
    // Canonical state output → surface projection input (objectId + org)
    const state = await setCanonicalObjectState({
      objectId: '00000000-0000-4000-8000-000000000031',
      objectType: 'task',
      organizationId: ORG_ID,
      canonicalState: 'completed',
      surfaceProjections: {
        home: {
          surface: 'home',
          displayState: 'completed',
          isStale: false,
          lastRefreshedAt: new Date().toISOString(),
        },
      },
    });

    expect(typeof state.objectId).toBe('string');
    expect(state.surfaceProjections.home).toBeDefined();
    expect(state.surfaceProjections.home.surface).toBe('home');

    // Signal output → inbox materialization input (signalId as eventSourceRef)
    const signal = await emitSignal({
      signalType: 'stale_items_count',
      sourceObjectType: 'task',
      sourceObjectId: state.objectId,
      organizationId: state.organizationId,
      severity: 'info',
      payload: { completedAt: new Date().toISOString() },
    });

    expect(typeof signal.signalId).toBe('string');
    expect(signal.signalId.length).toBeGreaterThan(0);

    // Latency band classification: near_realtime ≤ 5000ms
    const nearRealtime = await recordInboxMaterialization({
      eventSourceRef: signal.signalId,
      inboxItemId: 'inbox-002',
      userId: USER_ID,
      organizationId: ORG_ID,
      latencyMs: 3000,
    });
    expect(nearRealtime.latencyBand).toBe('near_realtime');

    // Latency band classification: operational ≤ 60000ms
    const operational = await recordInboxMaterialization({
      eventSourceRef: signal.signalId,
      inboxItemId: 'inbox-003',
      userId: USER_ID,
      organizationId: ORG_ID,
      latencyMs: 30000,
    });
    expect(operational.latencyBand).toBe('operational');

    // Latency band classification: degraded > 60000ms
    const degraded = await recordInboxMaterialization({
      eventSourceRef: signal.signalId,
      inboxItemId: 'inbox-004',
      userId: USER_ID,
      organizationId: ORG_ID,
      latencyMs: 120000,
    });
    expect(degraded.latencyBand).toBe('degraded');

    // Concurrent editing lock can be acquired on the same object
    mockDbGet.mockResolvedValueOnce(null);
    const lock = await acquireLock({
      organizationId: ORG_ID,
      lockType: 'optimistic_row',
      lockScope: `task:${state.objectId}:status`,
      holderId: USER_ID,
      holderClientId: 'client-001',
      roomId: 'room-task-002',
      ttl: 30000,
    });

    expect(lock.lockId).toBeDefined();
    expect(lock.lockScope).toContain(state.objectId);
    expect(lock.organizationId).toBe(state.organizationId);
  });
});
