// @vitest-environment node
/**
 * Unit tests — materialVersioning (F6.3)
 *
 * MV-1: RBAC permission matrix
 * MV-2: commit/latest/get version
 * MV-3: rollback (forward op, append-only, lock/role guards)
 */

import { describe, expect, it } from 'vitest';
import {
  can,
  commitVersion,
  latestVersion,
  getVersion,
  rollbackTo,
  type MaterialVersion,
} from '../../../server/src/services/deliverables/materialVersioning.js';

const T = '2026-06-25T10:00:00.000Z';

describe('materialVersioning', () => {
  // ── MV-1: RBAC ──
  it('MV-1.1: owner can do everything', () => {
    for (const a of ['edit', 'submit', 'authorize', 'send', 'rollback', 'view'] as const) {
      expect(can('owner', a)).toBe(true);
    }
  });

  it('MV-1.2: editor edits but cannot authorize/send', () => {
    expect(can('editor', 'edit')).toBe(true);
    expect(can('editor', 'authorize')).toBe(false);
    expect(can('editor', 'send')).toBe(false);
  });

  it('MV-1.3: reviewer authorizes but cannot edit; viewer view-only', () => {
    expect(can('reviewer', 'authorize')).toBe(true);
    expect(can('reviewer', 'edit')).toBe(false);
    expect(can('viewer', 'view')).toBe(true);
    expect(can('viewer', 'edit')).toBe(false);
  });

  // ── MV-2: versions ──
  it('MV-2.1: commitVersion appends with monotonic version numbers', () => {
    let h: MaterialVersion<{ t: string }>[] = [];
    h = commitVersion(h, { t: 'v1' }, 'draft', 'u1', T);
    h = commitVersion(h, { t: 'v2' }, 'review', 'u1', T);
    expect(h.map((v) => v.version)).toEqual([1, 2]);
    expect(latestVersion(h)?.snapshot.t).toBe('v2');
  });

  it('MV-2.2: getVersion finds by number, null when absent', () => {
    let h: MaterialVersion<{ t: string }>[] = [];
    h = commitVersion(h, { t: 'v1' }, 'draft', 'u1', T);
    expect(getVersion(h, 1)?.snapshot.t).toBe('v1');
    expect(getVersion(h, 99)).toBeNull();
  });

  it('MV-2.3: commitVersion is immutable (original array untouched)', () => {
    const h0: MaterialVersion<{ t: string }>[] = [];
    const h1 = commitVersion(h0, { t: 'v1' }, 'draft', 'u1', T);
    expect(h0).toHaveLength(0);
    expect(h1).toHaveLength(1);
  });

  // ── MV-3: rollback ──
  it('MV-3.1: rollback creates a NEW version restoring old snapshot (append-only)', () => {
    let h: MaterialVersion<{ t: string }>[] = [];
    h = commitVersion(h, { t: 'good' }, 'draft', 'u1', T);
    h = commitVersion(h, { t: 'bad' }, 'review', 'u1', T);

    const res = rollbackTo(h, 1, 'owner', 'u1', T);
    expect(res.ok).toBe(true);
    expect(res.history).toHaveLength(3); // nothing deleted
    const top = latestVersion(res.history)!;
    expect(top.version).toBe(3);
    expect(top.snapshot.t).toBe('good'); // restored
    expect(top.rolledBackFrom).toBe(1);
  });

  it('MV-3.2: role without rollback permission is rejected', () => {
    let h: MaterialVersion<{ t: string }>[] = [];
    h = commitVersion(h, { t: 'v1' }, 'draft', 'u1', T);
    const res = rollbackTo(h, 1, 'viewer', 'u1', T);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/cannot rollback/i);
    expect(res.history).toHaveLength(1); // unchanged
  });

  it('MV-3.3: cannot rollback when latest is sent (locked)', () => {
    let h: MaterialVersion<{ t: string }>[] = [];
    h = commitVersion(h, { t: 'v1' }, 'authorized', 'u1', T);
    h = commitVersion(h, { t: 'v2' }, 'sent', 'u1', T);
    const res = rollbackTo(h, 1, 'owner', 'u1', T);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/lock/i);
  });

  it('MV-3.4: rollback to missing version fails gracefully', () => {
    let h: MaterialVersion<{ t: string }>[] = [];
    h = commitVersion(h, { t: 'v1' }, 'draft', 'u1', T);
    const res = rollbackTo(h, 42, 'owner', 'u1', T);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });
});
