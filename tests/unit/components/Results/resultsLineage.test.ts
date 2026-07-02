/**
 * H2.8 lineage helpers: dedup initiative options + build deduped linked
 * initiatives with a resolved label (no duplicate "Optymalizacja kosztów..." x3,
 * no bare "unknown").
 */
import { describe, expect, it } from 'vitest';

import {
  buildLinkedInitiatives,
  dedupeInitiativeOptions,
} from '../../../../src/components/Results/resultsLineage';

describe('dedupeInitiativeOptions', () => {
  it('removes duplicate ids, keeping first-seen order', () => {
    const out = dedupeInitiativeOptions([
      { id: 'a', name: 'Optymalizacja kosztów' },
      { id: 'a', name: 'Optymalizacja kosztów' },
      { id: 'a', name: 'Optymalizacja kosztów' },
      { id: 'b', name: 'Druga inicjatywa' },
    ]);
    expect(out).toEqual([
      { id: 'a', name: 'Optymalizacja kosztów' },
      { id: 'b', name: 'Druga inicjatywa' },
    ]);
  });

  it('falls back from name to title and skips id-less rows', () => {
    const out = dedupeInitiativeOptions([
      { id: 'a', title: 'Title Only' },
      { name: 'no id' } as any,
      null,
      undefined,
    ]);
    expect(out).toEqual([{ id: 'a', name: 'Title Only' }]);
  });
});

describe('buildLinkedInitiatives', () => {
  it('dedups linked initiatives by initiative_id', () => {
    const out = buildLinkedInitiatives(
      [
        { id: 'm1', initiative_id: 'a', initiative_name: 'Optymalizacja kosztów' },
        { id: 'm2', initiative_id: 'a', initiative_name: 'Optymalizacja kosztów' },
        { id: 'm3', initiative_id: 'a', initiative_name: 'Optymalizacja kosztów' },
      ],
      [],
      'Unknown'
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ initiativeId: 'a', mappingId: 'm1', label: 'Optymalizacja kosztów' });
  });

  it('resolves a null mapping name from the initiatives list before "Unknown"', () => {
    const out = buildLinkedInitiatives(
      [{ id: 'm1', initiative_id: 'a', initiative_name: null }],
      [{ id: 'a', name: 'Resolved Name' }],
      'Unknown'
    );
    expect(out[0].label).toBe('Resolved Name');
  });

  it('uses the Unknown fallback when no name is resolvable', () => {
    const out = buildLinkedInitiatives(
      [{ id: 'm1', initiative_id: 'ghost', initiative_name: '  ' }],
      [{ id: 'a', name: 'Other' }],
      'Unknown'
    );
    expect(out[0].label).toBe('Unknown');
  });
});
