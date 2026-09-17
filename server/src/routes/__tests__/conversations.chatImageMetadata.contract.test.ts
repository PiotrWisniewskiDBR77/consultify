import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AddMessageSchema, MAX_PERSISTED_CHAT_IMAGE_BYTES } from '../conversations.routes.js';

function imagePayload(decodedBytes: number) {
  const base64 = Buffer.alloc(decodedBytes, 0xa5).toString('base64');
  return {
    name: 'boundary.png',
    mimeType: 'image/png' as const,
    dataUrl: `data:image/png;base64,${base64}`,
    width: 2048,
    height: 2048,
    size: decodedBytes,
  };
}

function messageWithImages(images: unknown) {
  return {
    role: 'user' as const,
    content: 'Please inspect this image.',
    metadata: {
      images,
      sourceLedger: { preserved: true },
    },
  };
}

describe('conversation message persisted image metadata contract', () => {
  beforeEach(() => {
    vi.stubEnv('ENABLE_CHAT_IMAGES', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('preserves the former open metadata.images contract while the feature is OFF', () => {
    vi.stubEnv('ENABLE_CHAT_IMAGES', 'false');
    const legacyImages = [{ legacyId: 'old-shape' }, { another: 'entry' }];

    const result = AddMessageSchema.safeParse(messageWithImages(legacyImages));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.metadata?.images).toEqual(legacyImages);
  });

  it('accepts one image at the exact 5 MiB decoded boundary and preserves other metadata', () => {
    const result = AddMessageSchema.safeParse(
      messageWithImages([imagePayload(MAX_PERSISTED_CHAT_IMAGE_BYTES)])
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.metadata?.sourceLedger).toEqual({ preserved: true });
    expect((result.data.metadata?.images as Array<{ size: number }>)[0].size).toBe(
      MAX_PERSISTED_CHAT_IMAGE_BYTES
    );
  });

  it('rejects a decoded image one byte above the 5 MiB boundary', () => {
    const result = AddMessageSchema.safeParse(
      messageWithImages([imagePayload(MAX_PERSISTED_CHAT_IMAGE_BYTES + 1)])
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.some((issue) => issue.path.join('.').startsWith('metadata.images'))
    ).toBe(true);
  });

  it('rejects more than one persisted image', () => {
    const image = imagePayload(16);
    const result = AddMessageSchema.safeParse(messageWithImages([image, image]));

    expect(result.success).toBe(false);
  });

  it.each([
    ['MIME mismatch', { ...imagePayload(16), mimeType: 'image/jpeg' }],
    ['invalid base64', { ...imagePayload(16), dataUrl: 'data:image/png;base64,not-base64!' }],
    ['size mismatch', { ...imagePayload(16), size: 15 }],
    ['invalid dimensions', { ...imagePayload(16), width: 0 }],
  ])('rejects %s', (_label, image) => {
    expect(AddMessageSchema.safeParse(messageWithImages([image])).success).toBe(false);
  });

  it('keeps the generic metadata contract when the images key is absent', () => {
    const result = AddMessageSchema.safeParse({
      role: 'ai',
      content: 'Answer',
      metadata: {
        citations: [{ id: 'source-1' }],
        arbitraryNestedValue: { still: ['accepted'] },
      },
    });

    expect(result.success).toBe(true);
  });
});
