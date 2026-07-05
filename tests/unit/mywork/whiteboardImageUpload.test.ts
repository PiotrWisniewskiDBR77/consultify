/**
 * A6 "Whiteboard finish" — unit tests for uploadWhiteboardImageWithFallback.
 *
 * Covers the upload/fallback contract used by IdeaWhiteboardTool's paste and
 * drop handlers:
 * - successful upload → { uploaded: true, imageUrl }
 * - any failure (network error, non-2xx, malformed response) → falls back to
 *   the pre-A6 behavior: inline base64 data URI, { uploaded: false, src }
 * - never rejects — callers can always insert a node from the result
 */
import { describe, expect, it, vi } from 'vitest';

const postMultipartMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    postMultipart: (...args: unknown[]) => postMultipartMock(...args),
  },
}));

import { uploadWhiteboardImageWithFallback } from '@/components/MyWork/whiteboard/whiteboardImageUpload';

function makeFile(content = 'fake-image-bytes', name = 'photo.png', type = 'image/png'): File {
  return new File([content], name, { type });
}

describe('uploadWhiteboardImageWithFallback', () => {
  it('returns { uploaded: true, imageUrl } on a successful upload', async () => {
    postMultipartMock.mockResolvedValueOnce({ data: { url: '/uploads/whiteboard/org-1/abc.png', id: 'abc.png' } });

    const result = await uploadWhiteboardImageWithFallback(makeFile());

    expect(result.uploaded).toBe(true);
    expect(result.imageUrl).toBe('/uploads/whiteboard/org-1/abc.png');
    expect(result.src).toBeUndefined();
    expect(postMultipartMock).toHaveBeenCalledWith(
      '/my-work/whiteboard/images',
      expect.any(FormData)
    );
  });

  it('sends the file under the "image" form field', async () => {
    postMultipartMock.mockResolvedValueOnce({ data: { url: '/uploads/whiteboard/org-1/x.png', id: 'x.png' } });

    await uploadWhiteboardImageWithFallback(makeFile('bytes', 'sticker.png'));

    const formData = postMultipartMock.mock.calls[0][1] as FormData;
    const attached = formData.get('image') as File;
    expect(attached).toBeInstanceOf(File);
    expect(attached.name).toBe('sticker.png');
  });

  it('falls back to base64 when the upload rejects (network error)', async () => {
    postMultipartMock.mockRejectedValueOnce(new Error('Network request failed'));

    const result = await uploadWhiteboardImageWithFallback(makeFile('offline-bytes'));

    expect(result.uploaded).toBe(false);
    expect(result.imageUrl).toBeUndefined();
    expect(typeof result.src).toBe('string');
    expect(result.src).toMatch(/^data:image\/png;base64,/);
  });

  it('falls back to base64 when the upload rejects (4xx/5xx surfaced as thrown error)', async () => {
    postMultipartMock.mockRejectedValueOnce(new Error('Request failed with status 413'));

    const result = await uploadWhiteboardImageWithFallback(makeFile());

    expect(result.uploaded).toBe(false);
    expect(result.src).toBeTruthy();
  });

  it('falls back to base64 when the response is missing a url', async () => {
    postMultipartMock.mockResolvedValueOnce({ data: {} });

    const result = await uploadWhiteboardImageWithFallback(makeFile());

    expect(result.uploaded).toBe(false);
    expect(typeof result.src).toBe('string');
  });

  it('never rejects, even when both upload and fallback would otherwise throw synchronously', async () => {
    postMultipartMock.mockRejectedValueOnce(new Error('boom'));

    await expect(uploadWhiteboardImageWithFallback(makeFile())).resolves.toBeDefined();
  });
});
