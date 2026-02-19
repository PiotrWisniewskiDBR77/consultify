import { describe, expect, it, vi } from 'vitest';

import { asyncHandler, createAsyncHandler } from '../../../../server/src/utils/asyncHandler.ts';

describe('utils/asyncHandler (L1)', () => {
  it('calls next with thrown error', async () => {
    const err = new Error('boom');
    const h = asyncHandler(async () => {
      throw err;
    });
    const next = vi.fn();
    await h({} as any, {} as any, next as any);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('calls next with rejected error', async () => {
    const err = new Error('reject');
    const h = asyncHandler(async () => Promise.reject(err));
    const next = vi.fn();
    await h({} as any, {} as any, next as any);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('passes through resolved handler', async () => {
    const next = vi.fn();
    const h = asyncHandler(async (_req, _res, n) => n());
    await h({} as any, {} as any, next as any);
    expect(next).toHaveBeenCalled();
  });
});

describe('utils/createAsyncHandler (L1)', () => {
  it('writes JSON when result returned and headers not sent', async () => {
    const res: any = { headersSent: false, json: vi.fn() };
    const next = vi.fn();
    const h = createAsyncHandler(async () => ({ ok: true }));
    await h({} as any, res as any, next as any);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not write JSON when headers already sent', async () => {
    const res: any = { headersSent: true, json: vi.fn() };
    const next = vi.fn();
    const h = createAsyncHandler(async () => ({ ok: true }));
    await h({} as any, res as any, next as any);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next on error', async () => {
    const err = new Error('x');
    const res: any = { headersSent: false, json: vi.fn() };
    const next = vi.fn();
    const h = createAsyncHandler(async () => {
      throw err;
    });
    await h({} as any, res as any, next as any);
    expect(next).toHaveBeenCalledWith(err);
  });
});

