import { describe, expect, it, vi } from 'vitest';

import { asyncHandler } from '../../../../server/src/utils/ErrorHandler.ts';

describe('asyncHandler', () => {
  it('forwards async errors to next()', async () => {
    const next = vi.fn();
    const handler = asyncHandler(async () => {
      throw new Error('boom');
    });

    handler({} as any, {} as any, next as any);
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect((next.mock.calls[0]?.[0] as Error).message).toBe('boom');
  });
});
