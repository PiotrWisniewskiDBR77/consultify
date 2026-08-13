/**
 * @vitest-environment jsdom
 *
 * toolSessionRecoveryDraft — unit tests.
 *
 * These drafts are NEVER the source of truth (see the file header of
 * toolSessionRecoveryDraft.ts) — this suite locks in the three outcomes
 * `evaluateRecoveryDraft` can produce once a server load returns, and the
 * read/write/clear plumbing around them (namespacing per toolId, fail-soft
 * on bad JSON, no cross-session bleed).
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearRecoveryDraft,
  evaluateRecoveryDraft,
  readRecoveryDraft,
  writeRecoveryDraft,
} from '../toolSessionRecoveryDraft';

beforeEach(() => {
  window.localStorage.clear();
});

describe('writeRecoveryDraft / readRecoveryDraft / clearRecoveryDraft', () => {
  it('round-trips a draft, namespaced under the toolId', () => {
    writeRecoveryDraft('tool-1', { baseUpdatedAt: '2026-08-13T00:00:00.000Z', data: { a: 1 } });
    const draft = readRecoveryDraft('tool-1');
    expect(draft?.toolId).toBe('tool-1');
    expect(draft?.data).toEqual({ a: 1 });
    expect(draft?.baseUpdatedAt).toBe('2026-08-13T00:00:00.000Z');
    expect(typeof draft?.savedAt).toBe('string');
  });

  it('keeps drafts for different tool ids from colliding', () => {
    writeRecoveryDraft('tool-1', { baseUpdatedAt: null, data: { a: 1 } });
    writeRecoveryDraft('tool-2', { baseUpdatedAt: null, data: { a: 2 } });
    expect(readRecoveryDraft('tool-1')?.data).toEqual({ a: 1 });
    expect(readRecoveryDraft('tool-2')?.data).toEqual({ a: 2 });
  });

  it('returns null when there is no draft, or a null/missing toolId', () => {
    expect(readRecoveryDraft('nope')).toBeNull();
    expect(readRecoveryDraft(null)).toBeNull();
    expect(readRecoveryDraft(undefined)).toBeNull();
  });

  it('is fail-soft against corrupted JSON already sitting in localStorage', () => {
    window.localStorage.setItem('consultify:toolSession:recoveryDraft:v1:tool-1', '{not json');
    expect(readRecoveryDraft('tool-1')).toBeNull();
  });

  it('clearRecoveryDraft removes only the targeted toolId', () => {
    writeRecoveryDraft('tool-1', { baseUpdatedAt: null, data: { a: 1 } });
    writeRecoveryDraft('tool-2', { baseUpdatedAt: null, data: { a: 2 } });
    clearRecoveryDraft('tool-1');
    expect(readRecoveryDraft('tool-1')).toBeNull();
    expect(readRecoveryDraft('tool-2')?.data).toEqual({ a: 2 });
  });
});

describe('evaluateRecoveryDraft', () => {
  it('"none" when there is no draft', () => {
    expect(evaluateRecoveryDraft(null, { updatedAt: '2026-08-13T00:00:00.000Z', data: {} })).toBe(
      'none'
    );
  });

  it('"none" when the draft is identical to the server state', () => {
    const draft = {
      toolId: 't1',
      baseUpdatedAt: '2026-08-13T00:00:00.000Z',
      data: { a: 1 },
      savedAt: '2026-08-13T00:00:05.000Z',
    };
    expect(
      evaluateRecoveryDraft(draft, { updatedAt: '2026-08-13T00:00:00.000Z', data: { a: 1 } })
    ).toBe('none');
  });

  it('"discard-stale" when the server moved on since the draft was taken', () => {
    const draft = {
      toolId: 't1',
      baseUpdatedAt: '2026-08-13T00:00:00.000Z',
      data: { a: 'unsynced-local-edit' },
      savedAt: '2026-08-13T00:00:05.000Z',
    };
    // Server's updatedAt is AFTER the draft's base -- someone/something
    // else wrote a newer version since this draft was taken locally.
    expect(
      evaluateRecoveryDraft(draft, {
        updatedAt: '2026-08-13T00:05:00.000Z',
        data: { a: 'server-value' },
      })
    ).toBe('discard-stale');
  });

  it('"offer-recovery" when the server has not moved on but the draft differs (genuine unsynced work)', () => {
    const draft = {
      toolId: 't1',
      baseUpdatedAt: '2026-08-13T00:00:00.000Z',
      data: { a: 'unsynced-local-edit' },
      savedAt: '2026-08-13T00:00:05.000Z',
    };
    // Server is unchanged since the draft's base -- the difference can only
    // be this draft's own genuinely-unsynced edit.
    expect(
      evaluateRecoveryDraft(draft, {
        updatedAt: '2026-08-13T00:00:00.000Z',
        data: { a: 'server-value' },
      })
    ).toBe('offer-recovery');
  });

  it('"offer-recovery" (fail-safe) when the draft has no parseable base timestamp', () => {
    const draft = {
      toolId: 't1',
      baseUpdatedAt: null,
      data: { a: 'unsynced' },
      savedAt: '2026-08-13T00:00:05.000Z',
    };
    expect(
      evaluateRecoveryDraft(draft, { updatedAt: '2026-08-13T00:05:00.000Z', data: { a: 'server' } })
    ).toBe('offer-recovery');
  });
});
