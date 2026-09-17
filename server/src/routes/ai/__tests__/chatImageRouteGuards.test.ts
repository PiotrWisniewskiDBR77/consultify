import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLegacyChatImageGateResult, guardLegacyChatImages } from '../chatImageRouteGuards.js';

describe('legacy /api/ai/chat image guard', () => {
  const previousFlag = process.env.ENABLE_CHAT_IMAGES;

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.ENABLE_CHAT_IMAGES;
    else process.env.ENABLE_CHAT_IMAGES = previousFlag;
  });

  it.each([
    ['images', { images: [{ dataUrl: 'data:image/png;base64,AA==' }] }],
    ['chatImages', { chatImages: [{ dataUrl: 'data:image/png;base64,AA==' }] }],
    ['context.images', { context: { images: [{ dataUrl: 'data:image/png;base64,AA==' }] } }],
    [
      'context.chatImages',
      { context: { chatImages: [{ dataUrl: 'data:image/png;base64,AA==' }] } },
    ],
  ])('blocks raw %s while the feature is OFF', (_alias, body) => {
    expect(getLegacyChatImageGateResult(body, false)).toEqual({
      status: 404,
      body: { code: 'CHAT_IMAGES_DISABLED', error: 'CHAT_IMAGES_DISABLED' },
    });
  });

  it('rejects images explicitly on the legacy route while the feature is ON', () => {
    expect(
      getLegacyChatImageGateResult(
        { context: { images: [{ dataUrl: 'data:image/png;base64,AA==' }] } },
        true
      )
    ).toEqual({
      status: 422,
      body: {
        code: 'CHAT_IMAGES_UNSUPPORTED_ON_LEGACY_CHAT',
        error: 'CHAT_IMAGES_UNSUPPORTED_ON_LEGACY_CHAT',
      },
    });
  });

  it.each([
    ['plain text', { message: 'Plain text question' }],
    ['empty aliases', { message: 'Plain text question', images: [], context: { chatImages: [] } }],
  ])('preserves %s requests', (_case, body) => {
    expect(getLegacyChatImageGateResult(body, false)).toBeNull();
    expect(getLegacyChatImageGateResult(body, true)).toBeNull();
  });

  it('calls next for text and answers before downstream validation for an image', () => {
    const next = vi.fn();
    const status = vi.fn();
    const json = vi.fn();
    status.mockReturnValue({ json });

    process.env.ENABLE_CHAT_IMAGES = 'false';
    guardLegacyChatImages(
      { body: { message: 'Plain text question' } } as never,
      { status } as never,
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();

    next.mockClear();
    guardLegacyChatImages(
      { body: { message: 'Look', images: [{}] } } as never,
      { status } as never,
      next
    );
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      code: 'CHAT_IMAGES_DISABLED',
      error: 'CHAT_IMAGES_DISABLED',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
