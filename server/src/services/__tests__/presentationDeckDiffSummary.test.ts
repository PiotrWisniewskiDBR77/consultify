import { describe, expect, it } from 'vitest';

import { buildDeckDiffSummary } from '../presentationDeckDiffSummaryService.js';

describe('buildDeckDiffSummary', () => {
  it('detects added/removed slides', () => {
    const before = {
      cards: [
        { title: 'Intro', bullets: ['a'] },
        { title: 'Risks', bullets: ['x'] },
      ],
    };
    const after = { cards: [{ title: 'Intro', bullets: ['a'] }] };
    const diff = buildDeckDiffSummary(before, after);
    expect(diff.cardsBefore).toBe(2);
    expect(diff.cardsAfter).toBe(1);
    expect(diff.cardsRemoved).toBe(1);
    expect(diff.cardsAdded).toBe(0);
    expect(diff.slides.find((s) => s.index === 1)?.action).toBe('removed');
    expect(diff.slides.find((s) => s.index === 0)?.action).toBe('unchanged');
  });

  it('marks modified slide when title differs', () => {
    const before = { cards: [{ title: 'Old Title', bullets: ['a', 'b'] }] };
    const after = { cards: [{ title: 'New Title', bullets: ['a', 'b'] }] };
    const diff = buildDeckDiffSummary(before, after);
    expect(diff.changedCards).toBe(1);
    const entry = diff.slides[0];
    expect(entry.action).toBe('modified');
    expect(entry.titleBefore).toBe('Old Title');
    expect(entry.titleAfter).toBe('New Title');
    expect(entry.bulletsAdded).toEqual([]);
    expect(entry.bulletsRemoved).toEqual([]);
  });

  it('produces stable bullet diffs', () => {
    const before = { cards: [{ title: 'KPI', bullets: ['rev +10%', 'churn -5%'] }] };
    const after = { cards: [{ title: 'KPI', bullets: ['rev +12%', 'churn -5%', 'arr +8%'] }] };
    const diff = buildDeckDiffSummary(before, after);
    const entry = diff.slides[0];
    expect(entry.action).toBe('modified');
    expect(entry.bulletsAdded.sort()).toEqual(['arr +8%', 'rev +12%']);
    expect(entry.bulletsRemoved).toEqual(['rev +10%']);
  });
});
