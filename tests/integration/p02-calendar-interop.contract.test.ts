/**
 * P02 Calendar Interoperability — contract tests against service + canon (§2.3).
 */
import { describe, expect, it } from 'vitest';

import {
  CalendarProviderValues,
  DeclaredModeValues,
  EffectiveModeValues,
  PermissionGradientValues,
  SourceLifecycleStateValues,
  ItemTypeValues,
  SourceSystemValues,
  VisibilityClassValues,
  EditAuthorityValues,
  SyncStateValues,
  computeEffectiveMode,
  mapProviderError,
} from '../../server/src/services/v8/calendarInteropService.js';

import {
  P02_DECLARED_PROVIDERS,
  P02_RECURRENCE_DOCTRINE,
  P02_CONFLICT_WRITES_MODEL,
  P02_PERMISSION_GRADIENTS,
  P02_LIFECYCLE_STATES,
  P02_LIFECYCLE_TRANSITIONS,
  P02_ERROR_POSTURE,
  P02_ACCEPTANCE_CHECKLIST,
  P02_ANTI_DUPLICATE_RULES,
  P02_PERMISSION_UI_RULES,
  P02_P01_BRIDGE,
  P02_ADAPTER_REGISTRY,
  P02_ADAPTER_INTERFACE,
  P02_SYNC_RUNTIME,
  P02_FRONTEND_CONTRACT,
  P02_ITEM_TYPES,
  P02_ACCEPTANCE_CHECKLIST_EXTENDED,
} from '../../server/src/services/v8/calendarInteropCanon.js';

describe('P02 Calendar Interop contract', () => {
  describe('§2.3.1 Provider declaration', () => {
    it('declares exactly google, microsoft, caldav', () => {
      expect(Object.keys(P02_DECLARED_PROVIDERS).sort()).toEqual(['caldav', 'google', 'microsoft']);
    });

    it('CalDAV is read-only, not bidirectional', () => {
      expect(P02_DECLARED_PROVIDERS.caldav.write).toBe(false);
      expect(P02_DECLARED_PROVIDERS.caldav.bidir).toBe(false);
    });

    it('Google and Microsoft allow write and bidir', () => {
      expect(P02_DECLARED_PROVIDERS.google.write).toBe(true);
      expect(P02_DECLARED_PROVIDERS.google.bidir).toBe(true);
      expect(P02_DECLARED_PROVIDERS.microsoft.write).toBe(true);
      expect(P02_DECLARED_PROVIDERS.microsoft.bidir).toBe(true);
    });
  });

  describe('§2.3.2 Canonical time model', () => {
    it('CalendarProviderValues has exactly 3 entries', () => {
      expect(CalendarProviderValues).toHaveLength(3);
    });

    it('ItemTypeValues has exactly 11 entries (SSOT-complete per §2.3.2)', () => {
      expect(ItemTypeValues).toHaveLength(11);
      expect(ItemTypeValues).toEqual([
        'task_due',
        'task_window',
        'initiative_milestone',
        'decision_deadline',
        'meeting',
        'external_event',
        'assignment',
        'adjustment',
        'approval_window',
        'escalation_window',
        'focus_block',
      ]);
    });

    it('SourceSystemValues has exactly 4 entries', () => {
      expect(SourceSystemValues).toHaveLength(4);
    });

    it('SyncStateValues has exactly 5 entries', () => {
      expect(SyncStateValues).toHaveLength(5);
      expect(SyncStateValues).toEqual(['in_sync', 'pending', 'conflict', 'blocked', 'stale']);
    });

    it('exports supporting enum tuples used by the model', () => {
      expect(DeclaredModeValues.length).toBeGreaterThan(0);
      expect(EffectiveModeValues.length).toBeGreaterThan(0);
      expect(PermissionGradientValues.length).toBeGreaterThan(0);
      expect(SourceLifecycleStateValues.length).toBeGreaterThan(0);
      expect(VisibilityClassValues.length).toBeGreaterThan(0);
      expect(EditAuthorityValues.length).toBeGreaterThan(0);
    });
  });

  describe('§2.3.3 Recurrence doctrine', () => {
    it('has five boolean rules all true and window_only materialization', () => {
      expect(P02_RECURRENCE_DOCTRINE.seriesMasterNotInstance).toBe(true);
      expect(P02_RECURRENCE_DOCTRINE.noInstanceExplosion).toBe(true);
      expect(P02_RECURRENCE_DOCTRINE.noSilentLoss).toBe(true);
      expect(P02_RECURRENCE_DOCTRINE.correctMapping).toBe(true);
      expect(P02_RECURRENCE_DOCTRINE.cancellationTruth).toBe(true);
      expect(P02_RECURRENCE_DOCTRINE.materializationRule).toBe('window_only');
    });
  });

  describe('§2.3.4 Conflict-safe writes', () => {
    it('requires conditional writes and treats conflict as product state', () => {
      expect(P02_CONFLICT_WRITES_MODEL.conditionalWritesRequired).toBe(true);
      expect(P02_CONFLICT_WRITES_MODEL.conflictIsProductState).toBe(true);
      expect(P02_CONFLICT_WRITES_MODEL.noSilentOverwrite).toBe(true);
    });
  });

  describe('§2.3.5 Permission gradients', () => {
    it('declares exactly four gradients in order', () => {
      expect([...P02_PERMISSION_GRADIENTS]).toEqual(['free_busy', 'read', 'write', 'delegate']);
    });

    it('maps UI rules for free_busy, read, write, delegate', () => {
      expect(P02_PERMISSION_UI_RULES.free_busy.canSeeDetails).toBe(false);
      expect(P02_PERMISSION_UI_RULES.free_busy.canEdit).toBe(false);
      expect(P02_PERMISSION_UI_RULES.read.canSeeDetails).toBe(true);
      expect(P02_PERMISSION_UI_RULES.read.canEdit).toBe(false);
      expect(P02_PERMISSION_UI_RULES.write.canSeeDetails).toBe(true);
      expect(P02_PERMISSION_UI_RULES.write.canEdit).toBe(true);
      expect(P02_PERMISSION_UI_RULES.delegate.canSeeDetails).toBe(true);
      expect(P02_PERMISSION_UI_RULES.delegate.canEdit).toBe(true);
    });
  });

  describe('§2.3.6 Lifecycle states', () => {
    it('declares exactly five lifecycle states', () => {
      expect(P02_LIFECYCLE_STATES).toHaveLength(5);
      expect([...P02_LIFECYCLE_STATES]).toEqual([
        'connected',
        'degraded',
        'requires_action',
        'blocked',
        'recoverable',
      ]);
    });

    it('allows connected → degraded | requires_action | blocked', () => {
      expect(P02_LIFECYCLE_TRANSITIONS.connected).toEqual(expect.arrayContaining(['degraded', 'requires_action', 'blocked']));
      expect(P02_LIFECYCLE_TRANSITIONS.connected).toHaveLength(3);
    });

    it('allows blocked → requires_action only', () => {
      expect(P02_LIFECYCLE_TRANSITIONS.blocked).toEqual(['requires_action']);
    });
  });

  describe('§2.3.7 Anti-duplicate', () => {
    it('defines at least three rules; first mentions export-only pretending sync', () => {
      expect(P02_ANTI_DUPLICATE_RULES.length).toBeGreaterThanOrEqual(3);
      expect(P02_ANTI_DUPLICATE_RULES[0].toLowerCase()).toContain('export-only pretending sync');
    });
  });

  describe('§2.3.8 Error posture', () => {
    it('lists exactly eight scenarios', () => {
      expect(P02_ERROR_POSTURE).toHaveLength(8);
    });

    it('maps OAuth expired, etag conflict, and rate limit in canon', () => {
      const oauth = P02_ERROR_POSTURE.find((e) => e.scenario.includes('OAuth'));
      expect(oauth?.sourceState).toBe('requires_action');

      const etag = P02_ERROR_POSTURE.find((e) => e.scenario.toLowerCase().includes('etag'));
      expect(etag?.itemState).toBe('conflict');

      const rate = P02_ERROR_POSTURE.find((e) => e.scenario.includes('Rate limit'));
      expect(rate?.sourceState).toBe('degraded');
    });
  });

  describe('§2.3.9 Acceptance checklist', () => {
    it('has at least ten items and all are testable', () => {
      expect(P02_ACCEPTANCE_CHECKLIST.length).toBeGreaterThanOrEqual(10);
      for (const row of P02_ACCEPTANCE_CHECKLIST) {
        expect(row.testable).toBe(true);
      }
    });
  });

  describe('computeEffectiveMode', () => {
    type SourceModeInput = Parameters<typeof computeEffectiveMode>[0];
    const pick = (partial: SourceModeInput) => partial;

    it('forces read when lifecycle is blocked, regardless of declared mode', () => {
      expect(computeEffectiveMode(pick({ declaredMode: 'write', permissionGradient: 'write', lifecycleState: 'blocked' }))).toBe(
        'read',
      );
      expect(computeEffectiveMode(pick({ declaredMode: 'bidir', permissionGradient: 'delegate', lifecycleState: 'blocked' }))).toBe(
        'read',
      );
    });

    it('forces read when lifecycle is requires_action', () => {
      expect(computeEffectiveMode(pick({ declaredMode: 'bidir', permissionGradient: 'delegate', lifecycleState: 'requires_action' }))).toBe(
        'read',
      );
    });

    it('connected + write gradient + write declared → write', () => {
      expect(computeEffectiveMode(pick({ declaredMode: 'write', permissionGradient: 'write', lifecycleState: 'connected' }))).toBe(
        'write',
      );
    });

    it('connected + read gradient + bidir declared → read (capped by gradient)', () => {
      expect(computeEffectiveMode(pick({ declaredMode: 'bidir', permissionGradient: 'read', lifecycleState: 'connected' }))).toBe(
        'read',
      );
    });

    it('free_busy gradient → always read', () => {
      expect(computeEffectiveMode(pick({ declaredMode: 'bidir', permissionGradient: 'free_busy', lifecycleState: 'connected' }))).toBe(
        'read',
      );
      expect(computeEffectiveMode(pick({ declaredMode: 'write', permissionGradient: 'free_busy', lifecycleState: 'connected' }))).toBe(
        'read',
      );
    });
  });

  describe('mapProviderError', () => {
    it('maps stable contract error codes to source and item posture', () => {
      expect(mapProviderError('oauth_expired').sourceState).toBe('requires_action');
      expect(mapProviderError('etag_mismatch').itemState).toBe('conflict');
      expect(mapProviderError('rate_limited').sourceState).toBe('degraded');
      expect(mapProviderError('cursor_invalid').sourceState).toBe('recoverable');
      expect(mapProviderError('permanent_auth_failure').sourceState).toBe('blocked');
    });
  });

  // === P02-D through P02-J contract tests ===

  describe('§2.3.10 P01 Integration Bridge', () => {
    it('declares P01 bridge with all required fields', () => {
      expect(P02_P01_BRIDGE.connectionRef).toContain('connectionId');
      expect(P02_P01_BRIDGE.tokenLifecycle).toContain('pmSyncRefreshExecutionService');
      expect(P02_P01_BRIDGE.oauthFlow).toContain('integrationOAuthEngine');
      expect(P02_P01_BRIDGE.providerCatalog).toContain('google_calendar');
      expect(P02_P01_BRIDGE.providerCatalog).toContain('outlook_calendar');
      expect(P02_P01_BRIDGE.providerCatalog).toContain('apple_calendar');
    });
  });

  describe('§2.3.11 Provider Adapter Contract', () => {
    it('has adapter entries for all 3 providers', () => {
      expect(P02_ADAPTER_REGISTRY.google).toBeDefined();
      expect(P02_ADAPTER_REGISTRY.microsoft).toBeDefined();
      expect(P02_ADAPTER_REGISTRY.caldav).toBeDefined();
    });

    it('CalDAV adapter is read-only', () => {
      expect(P02_ADAPTER_REGISTRY.caldav).toContain('read-only');
    });

    it('adapter interface declares required methods', () => {
      expect(P02_ADAPTER_INTERFACE).toContain('listCalendars(connection): ProviderCalendarRef[]');
      expect(P02_ADAPTER_INTERFACE).toContain('fetchEvents(connection, window, cursor?): FetchEventsResult');
    });
  });

  describe('§2.3.12 Sync Runtime Contract', () => {
    it('cron interval is 5 minutes', () => {
      expect(P02_SYNC_RUNTIME.cronInterval).toBe('*/5 * * * *');
    });

    it('declares webhook routes for Google and Microsoft', () => {
      expect(P02_SYNC_RUNTIME.webhookRoutes).toContain('/api/v8/calendar/webhooks/google');
      expect(P02_SYNC_RUNTIME.webhookRoutes).toContain('/api/v8/calendar/webhooks/microsoft');
    });

    it('uses RRULE-based recurrence engine', () => {
      expect(P02_SYNC_RUNTIME.recurrenceEngine).toContain('rrule');
    });
  });

  describe('§2.3.13 Frontend Contract', () => {
    it('extends /my-work/calendar/unified with P02 metadata', () => {
      expect(P02_FRONTEND_CONTRACT.apiSurface).toContain('/api/v8/my-work/calendar/unified');
    });

    it('enforces permission gradients in UI', () => {
      expect(P02_FRONTEND_CONTRACT.permissionEnforcement).toContain('P02_PERMISSION_UI_RULES');
    });

    it('gates edit affordance based on editAuthority + effectiveMode', () => {
      expect(P02_FRONTEND_CONTRACT.editAffordanceGating).toContain('editAuthority=none');
    });
  });

  describe('Extended ItemTypeValues (SSOT completeness)', () => {
    it('includes all 11 item types from SSOT', () => {
      const required = [
        'task_due', 'task_window', 'initiative_milestone', 'decision_deadline', 'meeting',
        'external_event', 'assignment', 'adjustment', 'approval_window',
        'escalation_window', 'focus_block',
      ];
      for (const t of required) {
        expect(ItemTypeValues).toContain(t);
      }
    });

    it('P02_ITEM_TYPES canon matches service ItemTypeValues', () => {
      expect([...P02_ITEM_TYPES].sort()).toEqual([...ItemTypeValues].sort());
    });
  });

  describe('Extended acceptance checklist', () => {
    it('has at least 15 acceptance points', () => {
      expect(P02_ACCEPTANCE_CHECKLIST_EXTENDED.length).toBeGreaterThanOrEqual(15);
    });

    it('includes AC-12 through AC-15 for runtime deliverables', () => {
      const ids = P02_ACCEPTANCE_CHECKLIST_EXTENDED.map(ac => ac.id);
      expect(ids).toContain('AC-12');
      expect(ids).toContain('AC-13');
      expect(ids).toContain('AC-14');
      expect(ids).toContain('AC-15');
    });
  });
});
