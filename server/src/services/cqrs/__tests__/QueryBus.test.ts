import { describe, expect, it } from 'vitest';

import { QueryBus } from '../QueryBus.js';

class SpyQuery {
  constructor(public readonly id: string) {}
}

describe('QueryBus', () => {
  it('returns data from handler', async () => {
    const bus = new QueryBus();
    bus.register(SpyQuery, {
      execute: async (query: SpyQuery) => ({ id: query.id, status: 'ok' }),
    });

    const result = await bus.execute<{ id: string; status: string }>(new SpyQuery('q1'));
    expect(result).toEqual({ id: 'q1', status: 'ok' });
  });
});
