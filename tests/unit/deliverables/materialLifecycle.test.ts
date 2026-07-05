// @vitest-environment node
/**
 * Unit tests — materialLifecycle (F6.1)
 *
 * LC-1: legal happy-path transitions
 * LC-2: sent = terminal lock
 * LC-3: illegal transitions rejected
 * LC-4: editability / lock predicates
 */

import { describe, expect, it } from 'vitest';
import {
  transition,
  canTransition,
  nextStates,
  isLocked,
  isEditable,
  isMaterialState,
  MATERIAL_STATES,
} from '../../../server/src/services/deliverables/materialLifecycle.js';

describe('materialLifecycle', () => {
  // ── LC-1: happy path ──
  it('LC-1.1: draft → review → authorized → sent all legal', () => {
    expect(transition('draft', 'review').ok).toBe(true);
    expect(transition('review', 'authorized').ok).toBe(true);
    expect(transition('authorized', 'sent').ok).toBe(true);
  });

  it('LC-1.2: returns the new state on success', () => {
    const r = transition('review', 'authorized');
    expect(r).toMatchObject({ ok: true, state: 'authorized' });
    expect(r.error).toBeUndefined();
  });

  it('LC-1.3: return-to-edit paths legal (review→draft, authorized→review/draft)', () => {
    expect(transition('review', 'draft').ok).toBe(true);
    expect(transition('authorized', 'review').ok).toBe(true);
    expect(transition('authorized', 'draft').ok).toBe(true);
  });

  // ── LC-2: sent = lock ──
  it('LC-2.1: sent is terminal — no transitions out', () => {
    expect(nextStates('sent')).toHaveLength(0);
    expect(transition('sent', 'draft').ok).toBe(false);
    expect(transition('sent', 'review').ok).toBe(false);
    expect(transition('sent', 'authorized').ok).toBe(false);
  });

  it('LC-2.2: sent transition error mentions lock', () => {
    const r = transition('sent', 'draft');
    expect(r.ok).toBe(false);
    expect(r.state).toBe('sent'); // unchanged
    expect(r.error).toMatch(/lock/i);
  });

  // ── LC-3: illegal transitions ──
  it('LC-3.1: cannot skip states (draft→authorized, draft→sent)', () => {
    expect(transition('draft', 'authorized').ok).toBe(false);
    expect(transition('draft', 'sent').ok).toBe(false);
    expect(transition('review', 'sent').ok).toBe(false);
  });

  it('LC-3.2: same-state transition rejected', () => {
    expect(transition('draft', 'draft').ok).toBe(false);
    expect(transition('draft', 'draft').error).toMatch(/already/i);
  });

  it('LC-3.3: unknown states rejected gracefully (no throw)', () => {
    expect(transition('bogus' as any, 'draft').ok).toBe(false);
    expect(transition('draft', 'bogus' as any).ok).toBe(false);
    expect(canTransition('x' as any, 'y' as any)).toBe(false);
  });

  // ── LC-4: predicates ──
  it('LC-4.1: isLocked only for sent', () => {
    expect(isLocked('sent')).toBe(true);
    expect(isLocked('draft')).toBe(false);
    expect(isLocked('authorized')).toBe(false);
  });

  it('LC-4.2: isEditable for draft/review only', () => {
    expect(isEditable('draft')).toBe(true);
    expect(isEditable('review')).toBe(true);
    expect(isEditable('authorized')).toBe(false);
    expect(isEditable('sent')).toBe(false);
  });

  it('LC-4.3: isMaterialState guard + canonical states', () => {
    expect(MATERIAL_STATES).toEqual(['draft', 'review', 'authorized', 'sent']);
    expect(isMaterialState('draft')).toBe(true);
    expect(isMaterialState('nope')).toBe(false);
    expect(isMaterialState(7)).toBe(false);
  });
});
