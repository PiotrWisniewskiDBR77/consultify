/**
 * P01 Provider Catalog State — Unit Tests
 *
 * Validates the lifecycle grammar, state transitions, and
 * provider catalog state management in pmSyncTruthService.
 */
import { describe, it, expect } from 'vitest';

describe('Provider catalog state lifecycle grammar', () => {
  it('exports PROVIDER_STATE_TRANSITIONS with all declared states', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    const transitions = mod.PROVIDER_STATE_TRANSITIONS;
    expect(transitions).toBeDefined();

    const expectedStates = [
      'draft',
      'connected',
      'degraded',
      'requires_action',
      'recovered',
      'blocked',
    ];
    for (const state of expectedStates) {
      expect(transitions[state]).toBeDefined();
    }
  });

  it('validates legal transitions with isValidProviderStateTransition', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    const isValid = mod.isValidProviderStateTransition;
    expect(isValid).toBeDefined();

    expect(isValid('draft', 'connected')).toBe(true);
    expect(isValid('connected', 'degraded')).toBe(true);
    expect(isValid('degraded', 'requires_action')).toBe(true);
    expect(isValid('requires_action', 'recovered')).toBe(true);
    expect(isValid('recovered', 'connected')).toBe(true);

    // Invalid transitions
    expect(isValid('connected', 'draft')).toBe(false);
    expect(isValid('recovered', 'blocked')).toBe(false);
  });

  it('exports setProviderCatalogState, getProviderCatalogState, listProviderCatalogStates', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    expect(typeof mod.setProviderCatalogState).toBe('function');
    expect(typeof mod.getProviderCatalogState).toBe('function');
    expect(typeof mod.listProviderCatalogStates).toBe('function');
  });
});

describe('Provider lifecycle state type coverage', () => {
  it('PROVIDER_STATE_TRANSITIONS covers all 6 declared lifecycle states', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    const transitions = mod.PROVIDER_STATE_TRANSITIONS;
    const states = Object.keys(transitions);
    expect(states).toHaveLength(6);
    expect(states.sort()).toEqual([
      'blocked',
      'connected',
      'degraded',
      'draft',
      'recovered',
      'requires_action',
    ]);
  });

  it('blocked state can recover to connected or draft', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    const transitions = mod.PROVIDER_STATE_TRANSITIONS;
    expect(transitions['blocked']).toContain('connected');
    expect(transitions['blocked']).toContain('draft');
  });
});
