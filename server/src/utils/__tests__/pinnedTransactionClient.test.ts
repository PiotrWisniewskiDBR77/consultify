import { describe, expect, it } from 'vitest';

import { createPinnedClientContext } from '../pinnedTransactionClient.js';
import type { PgTransactionClient } from '../queryHelpers.js';

const fakeClient = (label: string): PgTransactionClient => ({
  query: async () => ({ rows: [{ label }] as never[], rowCount: 1 }),
});

describe('U02 pinned transaction client', () => {
  it('exposes no client outside a donated transaction', async () => {
    const ctx = createPinnedClientContext('demo');
    expect(ctx.current()).toBeNull();
    expect(ctx.isPinned()).toBe(false);
    expect(() => ctx.require()).toThrow('demo_transaction_context_missing');
  });

  it('pins the donated client for the whole async subtree', async () => {
    const ctx = createPinnedClientContext('demo');
    const client = fakeClient('outer');
    const seen = await ctx.withClient(client, async () => {
      await Promise.resolve();
      return ctx.require();
    });
    expect(seen).toBe(client);
    // and releases it afterwards
    expect(ctx.isPinned()).toBe(false);
  });

  it('is re-entrant for the same client so nested owner calls never open a second transaction', async () => {
    const ctx = createPinnedClientContext('demo');
    const client = fakeClient('outer');
    const seen = await ctx.withClient(client, () =>
      ctx.withClient(client, async () => ctx.require())
    );
    expect(seen).toBe(client);
  });

  it('refuses to interleave a second, different transaction on one async context', async () => {
    const ctx = createPinnedClientContext('demo');
    await expect(
      ctx.withClient(fakeClient('a'), () => ctx.withClient(fakeClient('b'), async () => 'never'))
    ).rejects.toThrow('demo_transaction_client_conflict');
  });

  it('keeps separate owner modules independent', async () => {
    const reports = createPinnedClientContext('reports');
    const decks = createPinnedClientContext('decks');
    const client = fakeClient('shared');
    await reports.withClient(client, async () => {
      expect(reports.isPinned()).toBe(true);
      expect(decks.isPinned()).toBe(false);
    });
  });
});
