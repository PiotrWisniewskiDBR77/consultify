import { describe, expect, it, vi } from 'vitest';

import { runOriginAwareInitiativeSubresource } from '../initiativeOriginSubresources';

const RUNTIME_ORIGIN = 'initiatives-runtime-v1' as const;

describe('P5 — origin gating fan-out karty inicjatywy', () => {
  it('DEMO_STORY z runtime-v1 nie uruchamia zadnego z 11 odczytow planning ani legacy', async () => {
    const planningReads = Array.from({ length: 11 }, () => vi.fn(async () => ({ items: [] })));
    const legacyReads = Array.from({ length: 11 }, () => vi.fn(async () => ({ items: [] })));
    const skipped = Array.from({ length: 11 }, () => vi.fn());

    await Promise.all(
      planningReads.map((planningRead, index) =>
        runOriginAwareInitiativeSubresource(RUNTIME_ORIGIN, {
          load: () => planningRead().catch(() => legacyReads[index]!()),
          onLoaded: vi.fn(),
          onSkipped: skipped[index]!,
          onUnavailable: vi.fn(),
        })
      )
    );

    planningReads.forEach((read) => expect(read).not.toHaveBeenCalled());
    legacyReads.forEach((read) => expect(read).not.toHaveBeenCalled());
    skipped.forEach((fallback) => expect(fallback).toHaveBeenCalledOnce());
  });

  it('nieznane pochodzenie zachowuje dotychczasowy odczyt i fallback legacy', async () => {
    const planningRead = vi.fn(async () => {
      throw new Error('planning unavailable');
    });
    const legacyRead = vi.fn(async () => ({ items: ['legacy'] }));
    const onLoaded = vi.fn();

    await runOriginAwareInitiativeSubresource(undefined, {
      load: () => planningRead().catch(() => legacyRead()),
      onLoaded,
      onSkipped: vi.fn(),
      onUnavailable: vi.fn(),
    });

    expect(planningRead).toHaveBeenCalledOnce();
    expect(legacyRead).toHaveBeenCalledOnce();
    expect(onLoaded).toHaveBeenCalledWith({ items: ['legacy'] });
  });

  /**
   * DOWOD MUTACYJNY: zmiana shouldReadPlanningSubresources tak, aby runtime-v1
   * zwracal true, uruchomi wszystkie spy planningReads i wywali pierwszy test.
   */
  it('v8-planning nadal czyta planning store', async () => {
    const planningRead = vi.fn(async () => ({ items: ['v8'] }));
    const onLoaded = vi.fn();

    await runOriginAwareInitiativeSubresource('v8-planning', {
      load: planningRead,
      onLoaded,
      onSkipped: vi.fn(),
      onUnavailable: vi.fn(),
    });

    expect(planningRead).toHaveBeenCalledOnce();
    expect(onLoaded).toHaveBeenCalledWith({ items: ['v8'] });
  });
});
