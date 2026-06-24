/**
 * Uspójnienie F5.1 + F5.2 — initiativeLineageService.
 *
 * Tested contract:
 *   getInitiativeLineage:
 *     (a) builds the chain source → initiative → execution → benefits,
 *     (b) null source + no downstream for an early-stage (DRAFT) initiative,
 *     (c) 404-equivalent (null) when initiative does not resolve in org,
 *     (d) fail-safe: missing benefits_register table ⇒ no benefits branch (no throw).
 *   getInitiativeFunnel:
 *     (e) aggregates byStatus + bySource + conversion (created/inExecution/tracking/%),
 *     (f) empty orgId ⇒ zeroed funnel.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockGetTableColumns = vi.fn();

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

import {
  getInitiativeFunnel,
  getInitiativeLineage,
} from '../../../server/src/services/initiative/initiativeLineageService.js';

const ORG = 'org-1';

function cols(names: string[]) {
  return names.map((name) => ({ name }));
}

describe('getInitiativeLineage (F5.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(a) builds source → initiative → execution → benefits chain', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'init-1',
      title: 'Automatyzacja raportów',
      status: 'EXECUTING',
      source_type: 'insight',
      source_id: 'ins-9',
    });
    // benefits_register exists with required columns
    mockGetTableColumns.mockResolvedValueOnce(cols(['initiative_id', 'organization_id', 'kpi_name']));
    mockQueryAll.mockResolvedValueOnce([{ kpi: 'Czas raportu' }, { kpi: '' }]);

    const res = await getInitiativeLineage(ORG, 'init-1');

    expect(res).not.toBeNull();
    expect(res!.source).toEqual({ type: 'insight', id: 'ins-9' });
    expect(res!.initiative).toEqual({
      id: 'init-1',
      title: 'Automatyzacja raportów',
      status: 'EXECUTING',
    });
    expect(res!.downstream.executionStatus).toBe('executing');
    // empty kpi filtered out
    expect(res!.downstream.benefits).toEqual([{ kpi: 'Czas raportu' }]);
  });

  it('(b) DRAFT initiative ⇒ null source, no executionStatus/benefits', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'init-2',
      title: 'Pomysł wczesny',
      status: 'DRAFT',
      source_type: null,
      source_id: null,
    });
    // benefits table absent
    mockGetTableColumns.mockResolvedValueOnce([]);

    const res = await getInitiativeLineage(ORG, 'init-2');

    expect(res!.source).toBeNull();
    expect(res!.downstream.executionStatus).toBeUndefined();
    expect(res!.downstream.benefits).toBeUndefined();
  });

  it('(c) returns null when initiative does not resolve in org', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const res = await getInitiativeLineage(ORG, 'nope');
    expect(res).toBeNull();
    expect(mockGetTableColumns).not.toHaveBeenCalled();
  });

  it('(d) fail-safe: getTableColumns throws ⇒ no benefits, no throw', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'init-3',
      title: 'W realizacji',
      status: 'EXECUTING',
      source_type: 'idea',
      source_id: 'idea-1',
    });
    mockGetTableColumns.mockRejectedValueOnce(new Error('no such table'));

    const res = await getInitiativeLineage(ORG, 'init-3');

    expect(res!.downstream.executionStatus).toBe('executing');
    expect(res!.downstream.benefits).toBeUndefined();
  });
});

describe('getInitiativeFunnel (F5.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(e) aggregates byStatus, bySource and conversion', async () => {
    // status GROUP BY
    mockQueryAll.mockResolvedValueOnce([
      { status: 'DRAFT', cnt: 4 },
      { status: 'EXECUTING', cnt: 3 },
      { status: 'BLOCKED', cnt: 1 },
      { status: 'DONE', cnt: 2 },
    ]);
    // source_type column exists
    mockGetTableColumns.mockResolvedValueOnce(cols(['source_type']));
    // source GROUP BY
    mockQueryAll.mockResolvedValueOnce([
      { source_type: 'insight', cnt: 6 },
      { source_type: 'idea', cnt: 4 },
    ]);

    const res = await getInitiativeFunnel(ORG);

    expect(res.byStatus).toEqual({ DRAFT: 4, EXECUTING: 3, BLOCKED: 1, DONE: 2 });
    expect(res.bySource).toEqual({ insight: 6, idea: 4 });
    // created = 10; inExecution = EXECUTING(3)+BLOCKED(1) = 4; tracking = DONE(2) -> delivered
    expect(res.conversion.created).toBe(10);
    expect(res.conversion.inExecution).toBe(4);
    expect(res.conversion.tracking).toBe(2);
    expect(res.conversion.conversionPct).toBe(20);
  });

  it('(f) empty orgId ⇒ zeroed funnel, no DB access', async () => {
    const res = await getInitiativeFunnel('');
    expect(res.conversion).toEqual({ created: 0, inExecution: 0, tracking: 0, conversionPct: 0 });
    expect(res.byStatus).toEqual({});
    expect(res.bySource).toEqual({});
    expect(mockQueryAll).not.toHaveBeenCalled();
  });
});
