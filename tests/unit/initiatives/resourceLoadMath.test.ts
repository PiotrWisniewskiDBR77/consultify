/**
 * resourceLoadMath — portfolio resource-load aggregation (HARVARD #90 · UI-T11).
 *
 * Root cause fixed here: utilizationPercent used to be `ownedCount * 100`, so an
 * owner of 45 initiatives showed "4500% Overallocated". These tests pin the new
 * bounded, unit-consistent behaviour: real overload (200%) stays visible, the
 * 4500% artefact is impossible, terminal/draft work is excluded from load, and
 * empty/edge inputs never yield NaN/Infinity.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONCURRENT_CAPACITY,
  UTILIZATION_DISPLAY_CAP,
  classifyLoad,
  computeUtilizationPercent,
  formatUtilizationPercent,
  isActiveLoadStatus,
} from '@/components/Initiatives/Analysis/resourceLoadMath';

describe('isActiveLoadStatus', () => {
  it('counts in-flight statuses as active load', () => {
    for (const s of ['REVIEW', 'PROMOTED', 'PLANNING', 'APPROVED', 'SCHEDULED', 'EXECUTING', 'BLOCKED']) {
      expect(isActiveLoadStatus(s)).toBe(true);
    }
  });

  it('excludes terminal and pre-active statuses from load', () => {
    for (const s of ['DRAFT', 'PENDING_REVIEW', 'DONE', 'TRACKING', 'CANCELLED', 'ARCHIVED']) {
      expect(isActiveLoadStatus(s)).toBe(false);
    }
  });

  it('is case-insensitive and treats unknown/empty as active (never silently drop work)', () => {
    expect(isActiveLoadStatus('cancelled')).toBe(false);
    expect(isActiveLoadStatus('executing')).toBe(true);
    expect(isActiveLoadStatus('')).toBe(true);
    expect(isActiveLoadStatus(null)).toBe(true);
    expect(isActiveLoadStatus(undefined)).toBe(true);
    expect(isActiveLoadStatus('SOME_FUTURE_STATUS')).toBe(true);
  });
});

describe('computeUtilizationPercent', () => {
  it('returns 0 for an owner with no active initiatives (0/0 → 0, never NaN)', () => {
    expect(computeUtilizationPercent(0)).toBe(0);
    expect(Number.isNaN(computeUtilizationPercent(0))).toBe(false);
  });

  it('maps capacity-worth of active initiatives to exactly 100%', () => {
    expect(computeUtilizationPercent(DEFAULT_CONCURRENT_CAPACITY)).toBe(100);
  });

  it('keeps real overload visible (2× capacity → 200%)', () => {
    expect(computeUtilizationPercent(DEFAULT_CONCURRENT_CAPACITY * 2)).toBe(200);
  });

  it('surfaces mild overload just past a full load without capping it away', () => {
    // capacity=3 → 4 active = 133% (rounded). Must stay > 100 (visible overload).
    const util = computeUtilizationPercent(4, 3);
    expect(util).toBeGreaterThan(100);
    expect(util).toBe(133);
  });

  it('caps the pathological "4500%" artefact at the display ceiling', () => {
    // The old formula: 45 initiatives × 100 = 4500. New: bounded to the ceiling.
    expect(computeUtilizationPercent(45)).toBe(UTILIZATION_DISPLAY_CAP);
    expect(computeUtilizationPercent(1000)).toBe(UTILIZATION_DISPLAY_CAP);
  });

  it('never divides by zero even if a caller passes a 0 or negative capacity', () => {
    expect(computeUtilizationPercent(2, 0)).toBe(200); // capacity coerced to 1
    expect(computeUtilizationPercent(2, -5)).toBe(200);
    expect(Number.isFinite(computeUtilizationPercent(2, 0))).toBe(true);
  });

  it('clamps negative / non-finite active counts to 0 (Infinity/NaN → 0, never a huge %)', () => {
    expect(computeUtilizationPercent(-3)).toBe(0);
    expect(computeUtilizationPercent(Number.NaN)).toBe(0);
    // Non-finite is treated as "no data" → 0, so a bad input can never resurface
    // as an absurd utilization figure.
    expect(computeUtilizationPercent(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('classifyLoad', () => {
  it('flags > 100% as overallocated (150% is real, must show)', () => {
    expect(classifyLoad(150)).toBe('overallocated');
    expect(classifyLoad(101)).toBe('overallocated');
    expect(classifyLoad(UTILIZATION_DISPLAY_CAP)).toBe('overallocated');
  });

  it('flags a partly-loaded owner (>0, <50%) as underutilized', () => {
    expect(classifyLoad(33)).toBe('underutilized');
    expect(classifyLoad(49)).toBe('underutilized');
  });

  it('treats a fully-but-not-over loaded owner as ok', () => {
    expect(classifyLoad(50)).toBe('ok');
    expect(classifyLoad(100)).toBe('ok');
  });

  it('treats an idle owner (0%) as ok, not underutilized', () => {
    expect(classifyLoad(0)).toBe('ok');
  });
});

describe('formatUtilizationPercent', () => {
  it('renders an integer percent with a trailing %', () => {
    expect(formatUtilizationPercent(133, 'en')).toBe('133%');
    expect(formatUtilizationPercent(0, 'en')).toBe('0%');
  });

  it('rounds and never emits NaN%', () => {
    expect(formatUtilizationPercent(99.6, 'en')).toBe('100%');
    expect(formatUtilizationPercent(Number.NaN, 'en')).toBe('0%');
  });
});

/**
 * End-to-end shape of the fix, mirroring the hook's aggregation over ownership:
 * an owner of many initiatives where only a few are active must NOT read 4500%.
 */
describe('aggregation semantics (mirrors usePortfolioAnalysisData)', () => {
  const activeCountFor = (statuses: string[]) =>
    statuses.filter((s) => isActiveLoadStatus(s)).length;

  it('excludes DRAFT/CANCELLED from the load so a big backlog does not inflate util', () => {
    // 45 owned, but 43 DRAFT + 2 EXECUTING → only 2 active.
    const statuses = [
      ...Array(43).fill('DRAFT'),
      'EXECUTING',
      'EXECUTING',
    ];
    const util = computeUtilizationPercent(activeCountFor(statuses));
    // 2 active / capacity 3 ≈ 67% — a sane "ok", not 4500%.
    expect(util).toBe(67);
    expect(classifyLoad(util)).toBe('ok');
  });

  it('a genuinely overloaded owner (6 active) still reads as overallocated 200%', () => {
    const statuses = Array(6).fill('EXECUTING');
    const util = computeUtilizationPercent(activeCountFor(statuses));
    expect(util).toBe(200);
    expect(classifyLoad(util)).toBe('overallocated');
  });

  it('an owner with zero initiatives yields a well-formed 0% / ok (empty set)', () => {
    const util = computeUtilizationPercent(activeCountFor([]));
    expect(util).toBe(0);
    expect(classifyLoad(util)).toBe('ok');
    expect(formatUtilizationPercent(util, 'pl')).toBe('0%');
  });
});
