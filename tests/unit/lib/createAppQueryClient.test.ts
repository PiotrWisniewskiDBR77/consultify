import { describe, expect, it } from 'vitest';

import { createAppQueryClient } from '@/lib/createAppQueryClient';

describe('createAppQueryClient', () => {
  it('sets deterministic query and mutation defaults for runtime reliability', () => {
    const client = createAppQueryClient();
    const defaults = client.getDefaultOptions();

    expect(defaults.queries?.retry).toBe(1);
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.networkMode).toBe('online');
    expect(defaults.mutations?.retry).toBe(0);
    expect(defaults.mutations?.networkMode).toBe('online');
  });
});
