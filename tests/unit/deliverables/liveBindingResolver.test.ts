// @vitest-environment node
/**
 * W6.5 — liveBindingResolver: polityka świeżości żywych powiązań danych.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveBindingFreshness,
  planRefresh,
  markFetched,
  annotateDatasetFreshness,
  type MaterialBinding,
} from '../../../server/src/services/deliverables/liveBindingResolver';

const NOW = 1_000_000_000_000; // stały „teraz" (ms)

function binding(over: Partial<MaterialBinding> = {}): MaterialBinding {
  return {
    id: 'b1', kind: 'connector', ref: 'postgres',
    lastFetchedAt: NOW - 60_000, // 60s temu
    policy: { ttlSeconds: 300, mode: 'on_open' },
    ...over,
  };
}

describe('W6.5 — resolveBindingFreshness', () => {
  it('świeże (wiek < ttl) → nie odświeżaj', () => {
    const f = resolveBindingFreshness(binding(), NOW);
    expect(f.isStale).toBe(false);
    expect(f.needsRefresh).toBe(false);
    expect(f.reason).toBe('fresh');
    expect(f.ageSeconds).toBe(60);
  });

  it('nieświeże (wiek > ttl) w trybie on_open → odśwież', () => {
    const f = resolveBindingFreshness(binding({ lastFetchedAt: NOW - 600_000 }), NOW); // 600s
    expect(f.isStale).toBe(true);
    expect(f.needsRefresh).toBe(true);
    expect(f.reason).toBe('ttl_expired');
  });

  it('nigdy nie pobrano → never_fetched, odśwież (nie-manual)', () => {
    const f = resolveBindingFreshness(binding({ lastFetchedAt: null }), NOW);
    expect(f.reason).toBe('never_fetched');
    expect(f.needsRefresh).toBe(true);
    expect(f.ageSeconds).toBe(Infinity);
  });

  it('tryb manual: nieświeże ale NIE odświeża automatycznie', () => {
    const f = resolveBindingFreshness(binding({ lastFetchedAt: NOW - 600_000, policy: { ttlSeconds: 300, mode: 'manual' } }), NOW);
    expect(f.isStale).toBe(true);
    expect(f.needsRefresh).toBe(false);
    expect(f.reason).toBe('manual_mode');
  });

  it('tryb manual + nigdy nie pobrano → nie odświeża auto', () => {
    const f = resolveBindingFreshness(binding({ lastFetchedAt: null, policy: { ttlSeconds: 300, mode: 'manual' } }), NOW);
    expect(f.needsRefresh).toBe(false);
  });

  it('tryb scheduled nieświeże → odśwież', () => {
    const f = resolveBindingFreshness(binding({ lastFetchedAt: NOW - 600_000, policy: { ttlSeconds: 300, mode: 'scheduled' } }), NOW);
    expect(f.needsRefresh).toBe(true);
  });

  it('niepoprawne wejście → invalid, nie odświeża (bezpiecznie)', () => {
    // @ts-expect-error celowo brak policy
    const f = resolveBindingFreshness({ id: 'x', kind: 'connector', ref: 'y' }, NOW);
    expect(f.reason).toBe('invalid');
    expect(f.needsRefresh).toBe(false);
  });

  it('ISO timestamp obsłużony', () => {
    const iso = new Date(NOW - 60_000).toISOString();
    const f = resolveBindingFreshness(binding({ lastFetchedAt: iso }), NOW);
    expect(f.ageSeconds).toBe(60);
    expect(f.isStale).toBe(false);
  });

  it('ttl=0 → wszystko starsze niż 0s jest nieświeże', () => {
    const f = resolveBindingFreshness(binding({ lastFetchedAt: NOW - 1000, policy: { ttlSeconds: 0, mode: 'on_open' } }), NOW);
    expect(f.isStale).toBe(true);
    expect(f.needsRefresh).toBe(true);
  });
});

describe('W6.5 — planRefresh', () => {
  it('zwraca tylko powiązania wymagające odświeżenia', () => {
    const plan = planRefresh([
      binding({ id: 'fresh', lastFetchedAt: NOW - 10_000 }),
      binding({ id: 'stale', lastFetchedAt: NOW - 600_000 }),
      binding({ id: 'manual', lastFetchedAt: NOW - 600_000, policy: { ttlSeconds: 300, mode: 'manual' } }),
    ], NOW);
    expect(plan.all).toHaveLength(3);
    expect(plan.toRefresh.map((f) => f.id)).toEqual(['stale']);
  });

  it('onlyMode filtruje po trybie (np. przy otwarciu tylko on_open)', () => {
    const plan = planRefresh([
      binding({ id: 'a', lastFetchedAt: null, policy: { ttlSeconds: 300, mode: 'on_open' } }),
      binding({ id: 'b', lastFetchedAt: null, policy: { ttlSeconds: 300, mode: 'scheduled' } }),
    ], NOW, { onlyMode: 'on_open' });
    expect(plan.all).toHaveLength(1);
    expect(plan.toRefresh.map((f) => f.id)).toEqual(['a']);
  });

  it('pusta lista → pusty plan', () => {
    expect(planRefresh([], NOW).toRefresh).toEqual([]);
  });
});

describe('W6.5 — markFetched + annotate', () => {
  it('markFetched ustawia lastFetchedAt bez mutacji wejścia', () => {
    const b = binding({ lastFetchedAt: NOW - 600_000 });
    const updated = markFetched(b, NOW);
    expect(updated.lastFetchedAt).toBe(NOW);
    expect(b.lastFetchedAt).toBe(NOW - 600_000); // oryginał nietknięty
    // po markFetched świeże
    expect(resolveBindingFreshness(updated, NOW).isStale).toBe(false);
  });

  it('annotateDatasetFreshness dołącza metadane', () => {
    const ds = { columns: ['a'], rows: [{ a: 1 }], rowCount: 1, source: { kind: 'connector' as const, ref: 'postgres' } };
    const f = resolveBindingFreshness(binding(), NOW);
    const annotated = annotateDatasetFreshness(ds, f);
    expect(annotated.freshness.reason).toBe('fresh');
    expect(annotated.columns).toEqual(['a']);
  });
});
