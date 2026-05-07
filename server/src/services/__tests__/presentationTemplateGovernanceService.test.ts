import { describe, expect, it } from 'vitest';

import {
  assertEditableLifecycle,
  computeLineageForClone,
  evaluateLifecycleTransition,
  type TemplateLifecycleState,
} from '../presentationTemplateGovernanceService.js';

// ---------------------------------------------------------------------------
// evaluateLifecycleTransition
// ---------------------------------------------------------------------------

describe('evaluateLifecycleTransition - happy path transitions', () => {
  it('allows draft -> approved when actor has template_approve (ADMIN)', () => {
    const result = evaluateLifecycleTransition({
      currentState: 'draft',
      targetState: 'approved',
      actorRole: 'ADMIN',
    });
    expect(result.status).toBe('allowed');
    expect(result.requiredCapability).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it('allows draft -> deprecated when actor has template_approve and reason is provided', () => {
    const result = evaluateLifecycleTransition({
      currentState: 'draft',
      targetState: 'deprecated',
      actorRole: 'OWNER',
      reason: 'Replaced by v2 of this template family',
    });
    expect(result.status).toBe('allowed');
    expect(result.warnings).not.toContain('deprecation_without_reason');
  });

  it('allows approved -> deprecated for OWNER with capability', () => {
    const result = evaluateLifecycleTransition({
      currentState: 'approved',
      targetState: 'deprecated',
      actorRole: 'OWNER',
      reason: 'Superseded',
    });
    expect(result.status).toBe('allowed');
  });
});

describe('evaluateLifecycleTransition - capability gating', () => {
  it('blocks draft -> approved without template_approve capability', () => {
    const result = evaluateLifecycleTransition({
      currentState: 'draft',
      targetState: 'approved',
      actorRole: 'USER',
    });
    expect(result.status).toBe('blocked');
    expect(result.requiredCapability).toBe('template_approve');
    expect(result.reason).toMatch(/template_approve/);
  });

  it('treats unknown actor roles as having no capability', () => {
    const result = evaluateLifecycleTransition({
      currentState: 'draft',
      targetState: 'approved',
      actorRole: 'TOTALLY_UNKNOWN_ROLE',
    });
    expect(result.status).toBe('blocked');
    expect(result.requiredCapability).toBe('template_approve');
  });

  it('approves transitions for OWNER, ADMIN, and SUPERADMIN roles', () => {
    for (const role of ['OWNER', 'ADMIN', 'SUPERADMIN', 'super_admin']) {
      const result = evaluateLifecycleTransition({
        currentState: 'draft',
        targetState: 'approved',
        actorRole: role,
      });
      expect(result.status).toBe('allowed');
    }
  });

  it('blocks transitions for USER, PROJECT_MANAGER, and VIEWER roles', () => {
    for (const role of ['USER', 'PROJECT_MANAGER', 'VIEWER', 'TEAM_MEMBER', 'GUEST']) {
      const result = evaluateLifecycleTransition({
        currentState: 'draft',
        targetState: 'approved',
        actorRole: role,
      });
      expect(result.status).toBe('blocked');
      expect(result.requiredCapability).toBe('template_approve');
    }
  });
});

describe('evaluateLifecycleTransition - structurally disallowed transitions', () => {
  it('blocks approved -> draft (must clone instead)', () => {
    const result = evaluateLifecycleTransition({
      currentState: 'approved',
      targetState: 'draft',
      actorRole: 'ADMIN',
    });
    expect(result.status).toBe('blocked');
    expect(result.reason).toMatch(/Clone/i);
    // No capability hint here — even SUPERADMIN cannot do it.
    expect(result.requiredCapability).toBeUndefined();
  });

  it('blocks deprecated -> approved (deprecated is terminal; clone instead)', () => {
    const result = evaluateLifecycleTransition({
      currentState: 'deprecated',
      targetState: 'approved',
      actorRole: 'OWNER',
    });
    expect(result.status).toBe('blocked');
    expect(result.reason).toMatch(/clone/i);
  });

  it('blocks deprecated -> draft (deprecated is terminal)', () => {
    const result = evaluateLifecycleTransition({
      currentState: 'deprecated',
      targetState: 'draft',
      actorRole: 'SUPERADMIN',
    });
    expect(result.status).toBe('blocked');
  });

  it('blocks same-state transitions with "Already in <state>" reason', () => {
    const states: TemplateLifecycleState[] = ['draft', 'approved', 'deprecated'];
    for (const state of states) {
      const result = evaluateLifecycleTransition({
        currentState: state,
        targetState: state,
        actorRole: 'ADMIN',
      });
      expect(result.status).toBe('blocked');
      expect(result.reason).toBe(`Already in ${state}`);
    }
  });
});

describe('evaluateLifecycleTransition - warnings & soft signals', () => {
  it('emits deprecation_without_reason warning when transitioning to deprecated without a reason', () => {
    const result = evaluateLifecycleTransition({
      currentState: 'approved',
      targetState: 'deprecated',
      actorRole: 'ADMIN',
      // reason intentionally omitted
    });
    expect(result.status).toBe('allowed');
    expect(result.warnings).toContain('deprecation_without_reason');
  });

  it('does not warn when deprecation reason is a non-trivial string', () => {
    const result = evaluateLifecycleTransition({
      currentState: 'approved',
      targetState: 'deprecated',
      actorRole: 'ADMIN',
      reason: 'Superseded by Initiative Kickoff Deck v2',
    });
    expect(result.warnings).not.toContain('deprecation_without_reason');
  });

  it('treats whitespace-only reason as missing for deprecation warning purposes', () => {
    const result = evaluateLifecycleTransition({
      currentState: 'approved',
      targetState: 'deprecated',
      actorRole: 'ADMIN',
      reason: '   \n\t   ',
    });
    expect(result.warnings).toContain('deprecation_without_reason');
  });
});

describe('evaluateLifecycleTransition - defensive parsing', () => {
  it('never throws on malformed input shapes', () => {
    const malformedInputs: any[] = [
      undefined,
      null,
      {},
      { currentState: 'unknown', targetState: 'approved', actorRole: 'ADMIN' },
      { currentState: 'draft', targetState: 'banana', actorRole: 'ADMIN' },
      { currentState: 42, targetState: 'approved', actorRole: 'ADMIN' },
      { currentState: 'draft', targetState: 'approved', actorRole: null },
      { currentState: 'draft', targetState: 'approved' },
    ];
    for (const input of malformedInputs) {
      expect(() => evaluateLifecycleTransition(input)).not.toThrow();
      const result = evaluateLifecycleTransition(input);
      expect(['allowed', 'blocked']).toContain(result.status);
    }
  });

  it('produces JSON-serializable results with no Date / Map / Set', () => {
    const result = evaluateLifecycleTransition({
      currentState: 'draft',
      targetState: 'approved',
      actorRole: 'ADMIN',
    });
    const json = JSON.stringify(result);
    expect(typeof json).toBe('string');
    const round = JSON.parse(json);
    expect(round).toEqual(result);

    function assertPlain(value: unknown): void {
      if (value === null || typeof value !== 'object') return;
      expect(value instanceof Date).toBe(false);
      expect(value instanceof Map).toBe(false);
      expect(value instanceof Set).toBe(false);
      if (Array.isArray(value)) {
        for (const item of value) assertPlain(item);
      } else {
        for (const v of Object.values(value as Record<string, unknown>)) assertPlain(v);
      }
    }
    assertPlain(result);
  });
});

// ---------------------------------------------------------------------------
// computeLineageForClone
// ---------------------------------------------------------------------------

describe('computeLineageForClone', () => {
  it('treats parent as the lineage root when parent has no recorded root', () => {
    const out = computeLineageForClone({
      parentTemplate: { id: 'tpl-root-1', lineageRootId: null, lineageVersion: 1 },
    });
    expect(out.lineageParentId).toBe('tpl-root-1');
    expect(out.lineageRootId).toBe('tpl-root-1');
    expect(out.lineageVersion).toBe(2);
  });

  it('increments lineageVersion by exactly one', () => {
    const out = computeLineageForClone({
      parentTemplate: { id: 'tpl-v3', lineageRootId: 'tpl-root', lineageVersion: 3 },
    });
    expect(out.lineageVersion).toBe(4);
  });

  it('propagates lineageRootId through a multi-step clone chain', () => {
    const v2 = computeLineageForClone({
      parentTemplate: { id: 'tpl-root', lineageRootId: null, lineageVersion: 1 },
    });
    expect(v2.lineageRootId).toBe('tpl-root');

    const v3 = computeLineageForClone({
      parentTemplate: { id: 'tpl-v2', lineageRootId: v2.lineageRootId, lineageVersion: v2.lineageVersion },
    });
    expect(v3.lineageRootId).toBe('tpl-root');
    expect(v3.lineageParentId).toBe('tpl-v2');
    expect(v3.lineageVersion).toBe(3);

    const v4 = computeLineageForClone({
      parentTemplate: { id: 'tpl-v3', lineageRootId: v3.lineageRootId, lineageVersion: v3.lineageVersion },
    });
    expect(v4.lineageRootId).toBe('tpl-root');
    expect(v4.lineageVersion).toBe(4);
  });

  it('coerces malformed lineageVersion values to a sane integer >= 1', () => {
    const outWithNaN = computeLineageForClone({
      parentTemplate: { id: 'tpl', lineageRootId: 'tpl', lineageVersion: NaN as unknown as number },
    });
    expect(outWithNaN.lineageVersion).toBe(2);

    const outWithFloat = computeLineageForClone({
      parentTemplate: { id: 'tpl', lineageRootId: 'tpl', lineageVersion: 4.7 },
    });
    expect(outWithFloat.lineageVersion).toBe(5);

    const outWithNegative = computeLineageForClone({
      parentTemplate: { id: 'tpl', lineageRootId: 'tpl', lineageVersion: -3 },
    });
    expect(outWithNegative.lineageVersion).toBe(2);
  });

  it('produces JSON-serializable output', () => {
    const out = computeLineageForClone({
      parentTemplate: { id: 'tpl-x', lineageRootId: 'tpl-root', lineageVersion: 5 },
    });
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });
});

// ---------------------------------------------------------------------------
// assertEditableLifecycle
// ---------------------------------------------------------------------------

describe('assertEditableLifecycle - PUT /templates/:id guard', () => {
  it('allows edits when lifecycle_state is draft', () => {
    const out = assertEditableLifecycle({ lifecycle_state: 'draft' });
    expect(out.allowed).toBe(true);
    expect(out.state).toBe('draft');
  });

  it('blocks edits when lifecycle_state is approved (must clone)', () => {
    const out = assertEditableLifecycle({ lifecycle_state: 'approved' });
    expect(out.allowed).toBe(false);
    expect(out.state).toBe('approved');
    expect(out.reason).toMatch(/clone/i);
  });

  it('blocks edits when lifecycle_state is deprecated', () => {
    const out = assertEditableLifecycle({ lifecycle_state: 'deprecated' });
    expect(out.allowed).toBe(false);
    expect(out.state).toBe('deprecated');
  });

  it('defaults to draft (allowed) when lifecycle_state column is missing — schema-tolerant', () => {
    expect(assertEditableLifecycle({}).allowed).toBe(true);
    expect(assertEditableLifecycle({ lifecycle_state: undefined }).allowed).toBe(true);
    expect(assertEditableLifecycle(null).allowed).toBe(true);
    expect(assertEditableLifecycle({ lifecycle_state: 'banana' }).allowed).toBe(true);
  });
});
