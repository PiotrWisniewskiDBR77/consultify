import { describe, expect, it } from 'vitest';
import {
  IN_CONTEXT_ITEM_TYPES,
  NAVIGATE_ITEM_TYPES,
  resolveOpenItemRoute,
} from '../../src/components/MyWork/openItemRouting';

/**
 * DP-2 "global IDE-tabs doc" contract — closes BOTH M03 L-08 and M13 L-07
 * (same feature: the #10 live note "opening an initiative hard-navigates").
 * Clicking an initiative opens IN-CONTEXT (document overlay / dynamic tab),
 * NOT a hard navigate(). Heavy artifact types still navigate away.
 *
 * This guards the SSOT used by the MyWorkHub `mywork-open-item` handler and the
 * calendar `onInitiativeClick` wiring, without mounting the ~9k-line component.
 */
describe('mywork-open-item routing (M03 L-08 / M13 L-07 / DP-2)', () => {
  it('routes initiative IN-CONTEXT, not navigate (M03 L-08 + M13 L-07)', () => {
    expect(resolveOpenItemRoute('initiative')).toBe('in-context');
  });

  it('keeps task/decision/idea/notification/notebook in-context (unchanged)', () => {
    for (const type of ['task', 'decision', 'idea', 'notification', 'notebook']) {
      expect(resolveOpenItemRoute(type)).toBe('in-context');
    }
  });

  it('still navigates heavy artifact types away from My Work', () => {
    for (const type of [
      'report',
      'presentation',
      'budget',
      'valuation',
      'financial_model',
      'analysis',
      'assessment',
      'meeting',
      'tool',
    ]) {
      expect(resolveOpenItemRoute(type)).toBe('navigate');
    }
  });

  it('initiative is in the in-context set and absent from the navigate set', () => {
    expect(IN_CONTEXT_ITEM_TYPES).toContain('initiative');
    expect(NAVIGATE_ITEM_TYPES as readonly string[]).not.toContain('initiative');
  });

  it('the two route sets do not overlap', () => {
    const navSet = new Set<string>(NAVIGATE_ITEM_TYPES);
    for (const type of IN_CONTEXT_ITEM_TYPES) {
      expect(navSet.has(type)).toBe(false);
    }
  });

  it('unknown types default to in-context (safe: stay in My Work)', () => {
    expect(resolveOpenItemRoute('totally-unknown-type')).toBe('in-context');
  });
});
