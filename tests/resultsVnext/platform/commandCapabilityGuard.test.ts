import { describe, expect, it } from 'vitest';

import {
  assertCommandCapability,
  CommandCapabilityDeniedError,
  evaluateCommandAccess,
  type CommandAccessContext,
} from '../../../server/src/services/resultsVnext/platform/commandCapabilityGuard.js';

/**
 * RN-G5 — unit tests for the command-layer capability guard.
 *
 * This is the ONE module every gated write command in
 * `server/src/services/resultsVnext/**` calls before mutating anything —
 * see that file's own header comment for the full design rationale (why
 * ALLOW/DENY here, why maker-checker stays a separate, additional check run
 * AFTER this one, why the thrown error never leaks resource existence).
 * These tests cover the six scenarios the RN-G5 task brief names explicitly:
 * superadmin passes, admin passes, the record's owner passes, the record's
 * manager passes, an unrelated org member is denied, and a member with an
 * explicit capability grant passes.
 */

const CAPABILITY = 'results.kpi.deviation.approve_plan';

function access(overrides: Partial<CommandAccessContext> = {}): CommandAccessContext {
  return {
    capabilities: [],
    platformRole: null,
    ...overrides,
  };
}

describe('resultsVnext/platform/commandCapabilityGuard', () => {
  describe('evaluateCommandAccess', () => {
    it('DENYs a stale/untyped caller with no access context instead of throwing', () => {
      expect(
        evaluateCommandAccess({
          access: undefined as unknown as CommandAccessContext,
          actorUserId: 'user-owner',
          capability: CAPABILITY,
          responsibleUserIds: ['user-owner'],
        })
      ).toBe('DENY');
    });
    it('ALLOWs a SUPERADMIN regardless of capabilities or record ownership', () => {
      const decision = evaluateCommandAccess({
        access: access({ platformRole: 'SUPERADMIN', capabilities: [] }),
        actorUserId: 'user-stranger',
        capability: CAPABILITY,
        responsibleUserIds: ['user-owner', 'user-manager'],
      });
      expect(decision).toBe('ALLOW');
    });

    it("ALLOWs an OWNER/ADMIN holding the '*' wildcard capability", () => {
      const decision = evaluateCommandAccess({
        access: access({ capabilities: ['*'] }),
        actorUserId: 'user-stranger',
        capability: CAPABILITY,
        responsibleUserIds: ['user-owner', 'user-manager'],
      });
      expect(decision).toBe('ALLOW');
    });

    it('ALLOWs the record owner even without the capability', () => {
      const decision = evaluateCommandAccess({
        access: access({ capabilities: [] }),
        actorUserId: 'user-owner',
        capability: CAPABILITY,
        responsibleUserIds: ['user-owner', 'user-manager'],
      });
      expect(decision).toBe('ALLOW');
    });

    it('ALLOWs the record manager even without the capability', () => {
      const decision = evaluateCommandAccess({
        access: access({ capabilities: [] }),
        actorUserId: 'user-manager',
        capability: CAPABILITY,
        responsibleUserIds: ['user-owner', 'user-manager'],
      });
      expect(decision).toBe('ALLOW');
    });

    it('ALLOWs a regular member holding an explicit capability grant', () => {
      const decision = evaluateCommandAccess({
        access: access({ capabilities: [CAPABILITY] }),
        actorUserId: 'user-stranger',
        capability: CAPABILITY,
        responsibleUserIds: ['user-owner', 'user-manager'],
      });
      expect(decision).toBe('ALLOW');
    });

    it('ALLOWs via a `.scoped`/`.own`/`.assigned`/`.delegated` capability suffix (hasEffectiveCapability contract)', () => {
      const decision = evaluateCommandAccess({
        access: access({ capabilities: [`${CAPABILITY}.scoped`] }),
        actorUserId: 'user-stranger',
        capability: CAPABILITY,
      });
      expect(decision).toBe('ALLOW');
    });

    it('DENYs an unrelated org member with no capability and no record relationship', () => {
      const decision = evaluateCommandAccess({
        access: access({ capabilities: [] }),
        actorUserId: 'user-stranger',
        capability: CAPABILITY,
        responsibleUserIds: ['user-owner', 'user-manager'],
      });
      expect(decision).toBe('DENY');
    });

    it('DENYs when responsibleUserIds is omitted and the actor has no capability', () => {
      const decision = evaluateCommandAccess({
        access: access({ capabilities: [] }),
        actorUserId: 'user-owner',
        capability: CAPABILITY,
      });
      expect(decision).toBe('DENY');
    });

    it('ignores null/undefined/empty-string entries in responsibleUserIds (a domain with no manager set)', () => {
      const decision = evaluateCommandAccess({
        access: access({ capabilities: [] }),
        actorUserId: 'user-owner',
        capability: CAPABILITY,
        responsibleUserIds: [null, undefined, '', 'user-owner'],
      });
      expect(decision).toBe('ALLOW');
    });

    it('does not ALLOW an empty-string actorUserId to match an empty-string responsible entry', () => {
      const decision = evaluateCommandAccess({
        access: access({ capabilities: [] }),
        actorUserId: '',
        capability: CAPABILITY,
        responsibleUserIds: [''],
      });
      expect(decision).toBe('DENY');
    });

    it('a capability held for a DIFFERENT command does not ALLOW this one', () => {
      const decision = evaluateCommandAccess({
        access: access({ capabilities: ['results.kpi.deviation.close'] }),
        actorUserId: 'user-stranger',
        capability: CAPABILITY,
        responsibleUserIds: ['user-owner'],
      });
      expect(decision).toBe('DENY');
    });
  });

  describe('assertCommandCapability', () => {
    it('does not throw when the decision is ALLOW', () => {
      expect(() =>
        assertCommandCapability({
          access: access({ capabilities: ['*'] }),
          actorUserId: 'user-stranger',
          capability: CAPABILITY,
        })
      ).not.toThrow();
    });

    it('throws CommandCapabilityDeniedError when the decision is DENY', () => {
      expect(() =>
        assertCommandCapability({
          access: access({ capabilities: [] }),
          actorUserId: 'user-stranger',
          capability: CAPABILITY,
          responsibleUserIds: ['user-owner'],
        })
      ).toThrow(CommandCapabilityDeniedError);
    });

    it('the thrown error never leaks the capability-holder identity, owner id, or record existence', () => {
      try {
        assertCommandCapability({
          access: access({ capabilities: [] }),
          actorUserId: 'user-stranger',
          capability: CAPABILITY,
          responsibleUserIds: ['user-owner-secret', 'user-manager-secret'],
        });
        throw new Error('expected assertCommandCapability to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(CommandCapabilityDeniedError);
        const denied = err as CommandCapabilityDeniedError;
        expect(denied.code).toBe('COMMAND_CAPABILITY_DENIED');
        expect(denied.message).toBe('You are not authorized to perform this action.');
        expect(JSON.stringify(denied.details)).not.toContain('user-owner-secret');
        expect(JSON.stringify(denied.details)).not.toContain('user-manager-secret');
        // The capability string itself is fine to include — it identifies
        // the ACTION attempted, not the resource or who could perform it.
        expect(denied.details).toEqual({ capability: CAPABILITY });
      }
    });
  });
});
