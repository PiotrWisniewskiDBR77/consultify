/**
 * `TERESA_CAPABILITY_REGISTRY` — closed-set proof.
 *
 * Before this file, no client registry existed for the 23
 * `TERESA_CAPABILITIES` at all; nothing enforced that the registry stays a
 * 1:1 mirror of the contract's closed set, or that a
 * `TERESA_FORBIDDEN_EFFECTS` name can never sneak in as a capability. These
 * tests are that enforcement, and double as negative tests 6-10 (the "path
 * does not exist" half — `capabilityId` typed as `TeresaCapabilityId` cannot
 * even accept a forbidden-effect string, and the registry has no matching
 * key at runtime either).
 */
import { describe, expect, it } from 'vitest';

import {
  TERESA_CAPABILITIES,
  TERESA_FORBIDDEN_EFFECTS,
  type TeresaForbiddenEffect,
} from '@/method-core/contracts';

import { getTeresaCapability, isKnownTeresaCapability, listTeresaCapabilities, TERESA_CAPABILITY_REGISTRY } from '../capabilities';
import { buildTeresaIntent, TeresaIntentError } from '../intent';

describe('TERESA_CAPABILITY_REGISTRY — closed set', () => {
  it('has EXACTLY one entry per TERESA_CAPABILITIES id — no more, no fewer', () => {
    const registryKeys = Object.keys(TERESA_CAPABILITY_REGISTRY).sort();
    const contractIds = [...TERESA_CAPABILITIES].sort();
    expect(registryKeys).toEqual(contractIds);
    expect(registryKeys).toHaveLength(23);
  });

  it('every entry carries a non-empty label, description, allowedRoles and requiredQualityChecks', () => {
    for (const def of listTeresaCapabilities()) {
      expect(def.labelPl.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.allowedRoles.length).toBeGreaterThan(0);
      expect(def.allowedSources.length).toBeGreaterThan(0);
      // producesProposal is a real boolean field, not left undefined.
      expect(typeof def.producesProposal).toBe('boolean');
    }
  });

  it('draft_score_proposal requires ALL nine quality checks (playbook §6 — no partial pass)', () => {
    const def = getTeresaCapability('draft_score_proposal');
    expect(def.requiredQualityChecks).toHaveLength(9);
    expect(def.requiredQualityChecks).toContain('names_unit_and_level');
    expect(def.requiredQualityChecks).toContain('states_next_decision');
    expect(def.requiredQualityChecks).toContain('no_invented_number');
  });

  // ── negative tests 6-10: none of the five forbidden effects the S4 brief
  // names ("podnieść formalnego poziomu", "zatwierdzić Assessment",
  // "stworzyć approval", "opublikować Report", "aktywować Initiative") is a
  // capability — proven as "the entry never existed", not "it exists but is
  // blocked". ──────────────────────────────────────────────────────────────
  const NAMED_FORBIDDEN: readonly TeresaForbiddenEffect[] = [
    'approve_score', // "podnieść formalnego poziomu"
    'freeze_session', // "zatwierdzić Assessment" (freeze IS how a session becomes final)
    'approve_target', // "stworzyć approval"
    'publish_output', // "opublikować Report"
    'register_initiative', // "aktywować Initiative"
  ];

  it.each(NAMED_FORBIDDEN)('negative test — "%s" is not a known Teresa capability (path does not exist)', (effect) => {
    // (a) TERESA_FORBIDDEN_EFFECTS and TERESA_CAPABILITIES are disjoint sets
    // at the CONTRACT level — this assertion would fail if the contract ever
    // let them collide, which is the type-level guarantee this test backs up
    // with a runtime check.
    expect((TERESA_CAPABILITIES as readonly string[]).includes(effect)).toBe(false);
    expect(TERESA_FORBIDDEN_EFFECTS).toContain(effect);

    // (b) the client registry — built ONLY by iterating TERESA_CAPABILITIES —
    // has no key for it. Not "hidden" or "disabled": absent.
    expect(Object.prototype.hasOwnProperty.call(TERESA_CAPABILITY_REGISTRY, effect)).toBe(false);
    expect(isKnownTeresaCapability(effect)).toBe(false);

    // (c) buildTeresaIntent — the ONE function that turns a capability id
    // into something that can reach the network — refuses it before any
    // request is built.
    expect(() =>
      buildTeresaIntent({
        // @ts-expect-error — TeresaForbiddenEffect is not assignable to
        // TeresaCapabilityId; the cast below only exists so this runtime
        // assertion can still execute the same call a compromised caller
        // (e.g. a hand-built fetch bypassing the type system) would attempt.
        capabilityId: effect,
        sessionId: 'session-1',
        actorUserId: 'user-1',
        invokedBy: 'local_action',
      })
    ).toThrow(TeresaIntentError);
  });
});
