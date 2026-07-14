/**
 * O5.5 — AI Prompt Registry mechanics.
 *
 * Covers the runtime layer added on top of the code-level prompt index:
 *  - registry inventory (>= 10 registered assets, unique ids)
 *  - getPrompt adapter (managed template vs inline fallback)
 *  - checksum drift detection (pure hash + verify ok/drifted/unverifiable)
 *  - admin summary omits prompt bodies
 */
import { describe, expect, it } from 'vitest';

import {
  computePromptChecksum,
  getAllPromptAssets,
  getPrompt,
  getPromptAsset,
  getPromptRegistrySummary,
  PROMPT_REGISTRY,
  verifyAllPromptChecksums,
  verifyPromptChecksum,
} from '../../src/ai/promptRegistry.js';

describe('promptRegistry — inventory', () => {
  it('registers at least 10 prompt assets', () => {
    expect(PROMPT_REGISTRY.length).toBeGreaterThanOrEqual(10);
  });

  it('has unique, non-empty ids and required metadata', () => {
    const ids = PROMPT_REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of PROMPT_REGISTRY) {
      expect(entry.id).toBeTruthy();
      expect(entry.path).toBeTruthy();
      expect(entry.owner).toBeTruthy();
      expect(entry.version).toBeTruthy();
      expect(entry.description).toBeTruthy();
    }
  });

  it('getAllPromptAssets returns a defensive copy', () => {
    const copy = getAllPromptAssets();
    copy.push({
      id: 'temp',
      module: 'persona',
      version: '0',
      owner: 'content-quality',
      path: 'x',
      description: 'x',
      languages: ['en'],
      lastReviewed: '2026-01-01',
    });
    expect(getAllPromptAssets().find((e) => e.id === 'temp')).toBeUndefined();
  });
});

describe('promptRegistry — getPrompt adapter', () => {
  it('returns the managed template for an entry that centralizes one', () => {
    const managed = PROMPT_REGISTRY.find((e) => e.resolve);
    expect(managed).toBeDefined();
    const out = getPrompt(managed!.id, 'INLINE_FALLBACK');
    expect(out).toBe(managed!.resolve!());
    expect(out).not.toBe('INLINE_FALLBACK');
  });

  it('falls back to an inline string when the id is unmanaged/unknown', () => {
    expect(getPrompt('does-not-exist', 'INLINE')).toBe('INLINE');
  });

  it('falls back to a lazy inline thunk', () => {
    let called = 0;
    const out = getPrompt('does-not-exist', () => {
      called += 1;
      return 'LAZY';
    });
    expect(out).toBe('LAZY');
    expect(called).toBe(1);
  });

  it('returns undefined when neither managed nor fallback exists', () => {
    expect(getPrompt('does-not-exist')).toBeUndefined();
  });

  it('prefers the managed template over any inline fallback', () => {
    const managed = PROMPT_REGISTRY.find((e) => e.resolve)!;
    expect(getPrompt(managed.id, () => 'SHOULD_NOT_WIN')).toBe(managed.resolve!());
  });
});

describe('promptRegistry — checksum drift detection', () => {
  it('computePromptChecksum is pure and prefixed', () => {
    const a = computePromptChecksum('hello world');
    const b = computePromptChecksum('hello world');
    expect(a).toBe(b);
    expect(a.startsWith('sha256:')).toBe(true);
  });

  it('detects a change in text as a different checksum', () => {
    const before = computePromptChecksum('prompt v1');
    const after = computePromptChecksum('prompt v1 — edited');
    expect(before).not.toBe(after);
  });

  it('verifies a managed entry as ok when its snapshot matches', () => {
    const managed = PROMPT_REGISTRY.find((e) => e.resolve && e.checksum)!;
    const result = verifyPromptChecksum(managed.id);
    expect(result.status).toBe('ok');
    expect(result.actual).toBe(managed.checksum);
  });

  it('reports drifted when the stored checksum no longer matches the live text', () => {
    const managed = PROMPT_REGISTRY.find((e) => e.resolve && e.checksum)!;
    const original = managed.checksum;
    // Simulate source drift by corrupting the stored snapshot.
    managed.checksum = 'sha256:deadbeef';
    try {
      const result = verifyPromptChecksum(managed.id);
      expect(result.status).toBe('drifted');
      expect(result.actual).not.toBe('sha256:deadbeef');
    } finally {
      managed.checksum = original;
    }
  });

  it('reports unverifiable for pointer-only entries and unknown ids', () => {
    const pointerOnly = PROMPT_REGISTRY.find((e) => !e.resolve)!;
    expect(verifyPromptChecksum(pointerOnly.id).status).toBe('unverifiable');
    expect(verifyPromptChecksum('nope').status).toBe('unverifiable');
  });

  it('verifyAllPromptChecksums covers every checksummed entry and all pass', () => {
    const results = verifyAllPromptChecksums();
    const checksummed = PROMPT_REGISTRY.filter((e) => e.resolve && e.checksum);
    expect(results.length).toBe(checksummed.length);
    expect(results.every((r) => r.status === 'ok')).toBe(true);
  });
});

describe('promptRegistry — admin summary', () => {
  it('exposes metadata + checksum status but never prompt bodies', () => {
    const rows = getPromptRegistrySummary();
    expect(rows.length).toBe(PROMPT_REGISTRY.length);
    const managedRow = rows.find((r) => r.managed)!;
    expect(managedRow.checksumStatus).toBe('ok');
    // No row leaks a resolve() output or a `template`/`body` field.
    for (const row of rows) {
      expect(Object.prototype.hasOwnProperty.call(row, 'resolve')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(row, 'template')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(row, 'body')).toBe(false);
    }
  });

  it('summary managed/checksum status agrees with the registry', () => {
    const rows = getPromptRegistrySummary();
    for (const entry of PROMPT_REGISTRY) {
      const row = rows.find((r) => r.id === entry.id)!;
      expect(row.managed).toBe(Boolean(entry.resolve));
      expect(row).toMatchObject({ id: entry.id, owner: entry.owner, version: entry.version });
      expect(getPromptAsset(entry.id)).toBeDefined();
    }
  });
});
