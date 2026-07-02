// @vitest-environment node
/**
 * Unit tests — layeredEdit (F6.2)
 *
 * LE-1: mergeLayers — overrides applied, orphans detected
 * LE-2: regenerate — preserves overrides on surviving blocks (NO clobber)
 * LE-3: recordOverride / clearOverride — immutable
 */

import { describe, expect, it } from 'vitest';
import {
  mergeLayers,
  regenerate,
  recordOverride,
  clearOverride,
} from '../../../server/src/services/deliverables/layeredEdit.js';

type Block = { text: string; bold?: boolean };

describe('layeredEdit', () => {
  // ── LE-1: mergeLayers ──
  it('LE-1.1: overrides shallow-merge onto generated per block', () => {
    const gen = { b1: { text: 'gen 1' }, b2: { text: 'gen 2' } };
    const ov = { b1: { text: 'USER EDIT' } };
    const { effective, orphanedOverrideKeys } = mergeLayers<Block>(gen, ov);
    expect(effective.b1.text).toBe('USER EDIT');
    expect(effective.b2.text).toBe('gen 2');
    expect(orphanedOverrideKeys).toHaveLength(0);
  });

  it('LE-1.2: override for missing block → orphaned, not created', () => {
    const gen = { b1: { text: 'gen 1' } };
    const ov = { bX: { text: 'orphan' } };
    const { effective, orphanedOverrideKeys } = mergeLayers<Block>(gen, ov);
    expect(effective.bX).toBeUndefined();
    expect(orphanedOverrideKeys).toEqual(['bX']);
  });

  it('LE-1.3: partial override merges fields (keeps generated text, adds bold)', () => {
    const gen = { b1: { text: 'keep me' } };
    const ov = { b1: { bold: true } };
    const { effective } = mergeLayers<Block>(gen, ov);
    expect(effective.b1).toEqual({ text: 'keep me', bold: true });
  });

  // ── LE-2: regenerate (the core anti-clobber guarantee) ──
  it('LE-2.1: regeneration preserves user override on surviving block', () => {
    const userOverrides = { b1: { text: 'MY MANUAL EDIT' } };
    // AI regenerated with new text but same blockId b1
    const newGen = { b1: { text: 'fresh AI text' }, b2: { text: 'new block' } };

    const res = regenerate<Block>(newGen, userOverrides);
    // user edit WINS over regenerated content (no clobber)
    expect(res.effective.b1.text).toBe('MY MANUAL EDIT');
    expect(res.effective.b2.text).toBe('new block');
    expect(res.preservedOverrideKeys).toEqual(['b1']);
    expect(res.orphanedOverrideKeys).toHaveLength(0);
  });

  it('LE-2.2: override on removed block is orphaned + dropped from surviving', () => {
    const userOverrides = { b1: { text: 'edit' }, bGone: { text: 'edit on deleted' } };
    const newGen = { b1: { text: 'ai' } }; // bGone no longer generated

    const res = regenerate<Block>(newGen, userOverrides);
    expect(res.preservedOverrideKeys).toEqual(['b1']);
    expect(res.orphanedOverrideKeys).toEqual(['bGone']);
    expect(res.survivingOverrides).toEqual({ b1: { text: 'edit' } });
    expect(res.effective.bGone).toBeUndefined();
  });

  it('LE-2.3: no overrides → regeneration = pure new generated', () => {
    const newGen = { b1: { text: 'a' }, b2: { text: 'b' } };
    const res = regenerate<Block>(newGen, {});
    expect(res.effective).toEqual(newGen);
    expect(res.preservedOverrideKeys).toHaveLength(0);
  });

  // ── LE-3: record / clear (immutable) ──
  it('LE-3.1: recordOverride is immutable + merges patch', () => {
    const o0 = {};
    const o1 = recordOverride<Block>(o0, 'b1', { text: 'x' });
    const o2 = recordOverride<Block>(o1, 'b1', { bold: true });
    expect(o0).toEqual({}); // original untouched
    expect(o2.b1).toEqual({ text: 'x', bold: true });
  });

  it('LE-3.2: clearOverride removes a block override immutably', () => {
    const o1 = { b1: { text: 'x' }, b2: { text: 'y' } };
    const o2 = clearOverride<Block>(o1, 'b1');
    expect(o2).toEqual({ b2: { text: 'y' } });
    expect(o1.b1).toBeDefined(); // original untouched
  });

  it('LE-3.3: clearOverride on missing key returns same ref', () => {
    const o1 = { b1: { text: 'x' } };
    expect(clearOverride<Block>(o1, 'nope')).toBe(o1);
  });
});
