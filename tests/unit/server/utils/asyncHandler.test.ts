import { describe, expect, it, vi } from 'vitest';

import { asyncHandler, createAsyncHandler } from '../../../../server/src/utils/asyncHandler.js';

describe('server utils/asyncHandler', () => {
  it('asyncHandler calls the wrapped handler and does not call next on success', async () => {
    const next = vi.fn();
    const handler = vi.fn(async () => undefined);
    const wrapped = asyncHandler(handler as any);

    await wrapped({} as any, {} as any, next as any);
    expect(handler).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('asyncHandler forwards thrown errors to next', async () => {
    const err = new Error('boom');
    const next = vi.fn();
    const wrapped = asyncHandler((() => {
      throw err;
    }) as any);

    await wrapped({} as any, {} as any, next as any);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('asyncHandler forwards rejected promises to next', async () => {
    const err = new Error('reject');
    const next = vi.fn();
    const wrapped = asyncHandler((async () => {
      throw err;
    }) as any);

    await wrapped({} as any, {} as any, next as any);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('createAsyncHandler sends JSON when result is returned and headers not sent', async () => {
    const next = vi.fn();
    const res = { headersSent: false, json: vi.fn() };
    const wrapped = createAsyncHandler(async () => ({ ok: true }));
    await wrapped({} as any, res as any, next as any);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('createAsyncHandler does not send JSON when result is undefined', async () => {
    const next = vi.fn();
    const res = { headersSent: false, json: vi.fn() };
    const wrapped = createAsyncHandler(async () => undefined);
    await wrapped({} as any, res as any, next as any);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('createAsyncHandler forwards errors to next', async () => {
    const err = new Error('x');
    const next = vi.fn();
    const res = { headersSent: false, json: vi.fn() };
    const wrapped = createAsyncHandler(async () => {
      throw err;
    });
    await wrapped({} as any, res as any, next as any);
    expect(next).toHaveBeenCalledWith(err);
  });
});
