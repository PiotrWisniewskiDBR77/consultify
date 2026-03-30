import { describe, expect, it } from 'vitest';

import {
  parseRapTabFromQuery,
  presentationsTabQueryForHomeBridge,
  RAP_TAB_TO_QUERY,
} from '../../../../src/components/ReportsAndPresentations/outputsLibraryTabQuery';
import type { RapTab } from '../../../../src/components/ReportsAndPresentations/types';

describe('outputsLibraryTabQuery', () => {
  it('parses My Work bridge query values to the hub tab ids', () => {
    expect(parseRapTabFromQuery('all')).toBe('outputs_all');
    expect(parseRapTabFromQuery('mine')).toBe('outputs_mine');
    expect(parseRapTabFromQuery('needs_review')).toBe('outputs_review');
    expect(parseRapTabFromQuery('review')).toBe('outputs_review');
  });

  it('round-trips outputs queue tabs through RAP_TAB_TO_QUERY', () => {
    const queues: RapTab[] = ['outputs_all', 'outputs_mine', 'outputs_review'];
    for (const tab of queues) {
      const q = RAP_TAB_TO_QUERY[tab];
      expect(parseRapTabFromQuery(q)).toBe(tab);
    }
  });

  it('exposes the same strings My Work uses for /presentations?tab=', () => {
    expect(presentationsTabQueryForHomeBridge('outputs_all')).toBe(RAP_TAB_TO_QUERY.outputs_all);
    expect(presentationsTabQueryForHomeBridge('outputs_mine')).toBe(RAP_TAB_TO_QUERY.outputs_mine);
    expect(presentationsTabQueryForHomeBridge('outputs_review')).toBe(
      RAP_TAB_TO_QUERY.outputs_review
    );
  });

  it('maps legacy reports document lane alias', () => {
    expect(parseRapTabFromQuery('reports')).toBe('outputs_documents');
  });
});
