/**
 * A6 "Whiteboard finish" — direct unit test for the whiteboard image upload
 * multer fileFilter, calling the exported filter function itself. This
 * bypasses tests/setup.ts's global `vi.mock('multer', ...)` stand-in (which
 * doesn't invoke fileFilter/limits at all), so this is the one place the
 * real mime-allowlist logic is verified.
 */
import { describe, expect, it } from 'vitest';

import {
  ALLOWED_IMAGE_MIME_TYPES,
  whiteboardImageFileFilter,
} from '../../../../server/src/routes/my-work/whiteboard-uploads.routes.ts';

function runFilter(mimetype: string): Promise<{ accepted: boolean; error: Error | null }> {
  return new Promise((resolve) => {
    whiteboardImageFileFilter({}, { mimetype } as any, (error, acceptFile) => {
      resolve({ accepted: acceptFile, error });
    });
  });
}

describe('whiteboardImageFileFilter', () => {
  it('allows png, jpeg, gif, webp', async () => {
    for (const mime of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
      const result = await runFilter(mime);
      expect(result.accepted).toBe(true);
      expect(result.error).toBeNull();
    }
  });

  it('rejects image/svg+xml (XSS hardening)', async () => {
    const result = await runFilter('image/svg+xml');
    expect(result.accepted).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('rejects non-image mime types', async () => {
    for (const mime of ['text/plain', 'application/pdf', 'application/javascript']) {
      const result = await runFilter(mime);
      expect(result.accepted).toBe(false);
    }
  });

  it('ALLOWED_IMAGE_MIME_TYPES does not include svg', () => {
    expect(ALLOWED_IMAGE_MIME_TYPES.has('image/svg+xml')).toBe(false);
  });

  it('ALLOWED_IMAGE_MIME_TYPES matches the documented whitelist exactly', () => {
    expect([...ALLOWED_IMAGE_MIME_TYPES].sort()).toEqual(
      ['image/gif', 'image/jpeg', 'image/png', 'image/webp'].sort()
    );
  });
});
