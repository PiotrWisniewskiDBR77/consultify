/**
 * Storage seam — behavior-preservation contract for the default (local) path,
 * the traversal guard, and the provider factory. These are the guarantees that
 * make flipping STORAGE_PROVIDER=s3 a config change, not a rewrite.
 */
import { existsSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { LocalDiskAdapter } = await import(
  '../../../../server/src/services/storage/LocalDiskAdapter.ts'
);
const storageIndex = await import('../../../../server/src/services/storage/index.ts');
const { getStorage, __resetStorageForTests, S3Adapter } = storageIndex;

let baseDir: string;

beforeEach(async () => {
  baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-seam-'));
  __resetStorageForTests();
  delete process.env.STORAGE_PROVIDER;
  delete process.env.UPLOADS_BASE_DIR;
});

afterEach(async () => {
  await fs.rm(baseDir, { recursive: true, force: true }).catch(() => {});
  __resetStorageForTests();
});

describe('LocalDiskAdapter', () => {
  it('round-trips put/get/exists/delete under the base dir', async () => {
    const a = new LocalDiskAdapter({ baseDir });
    const key = 'attachments/2026/07/abc-file.png';
    const body = Buffer.from('hello-bytes');

    await a.putObject({ key, body, contentType: 'image/png' });

    // Physically lands at baseDir/<key> — identical to the pre-seam layout.
    expect(existsSync(path.join(baseDir, 'attachments', '2026', '07', 'abc-file.png'))).toBe(true);

    expect(await a.exists(key)).toBe(true);

    const got = await a.getObject(key);
    const chunks: Buffer[] = [];
    for await (const c of got.stream) chunks.push(Buffer.from(c));
    expect(Buffer.concat(chunks).toString()).toBe('hello-bytes');
    expect(got.size).toBe(body.length);

    await a.delete(key);
    expect(await a.exists(key)).toBe(false);
  });

  it('delete is idempotent for a missing key', async () => {
    const a = new LocalDiskAdapter({ baseDir });
    await expect(a.delete('attachments/nope.png')).resolves.toBeUndefined();
  });

  it('getUrl returns the /uploads static path (default prefix)', async () => {
    const a = new LocalDiskAdapter({ baseDir });
    expect(await a.getUrl('whiteboard/org-1/x.png')).toBe('/uploads/whiteboard/org-1/x.png');
  });

  it('getUrl honors a custom prefix', async () => {
    const a = new LocalDiskAdapter({ baseDir, urlPrefix: '/assets/' });
    expect(await a.getUrl('a/b.png')).toBe('/assets/a/b.png');
  });

  it('rejects path traversal outside the base dir', async () => {
    const a = new LocalDiskAdapter({ baseDir });
    await expect(
      a.putObject({ key: '../escape.png', body: Buffer.from('x') })
    ).rejects.toThrow(/traversal/i);
    expect(await a.exists('../escape.png')).toBe(false);
  });
});

describe('getStorage factory', () => {
  it('defaults to the local adapter when STORAGE_PROVIDER is unset', () => {
    process.env.UPLOADS_BASE_DIR = baseDir;
    const s = getStorage();
    expect(s.provider).toBe('local');
  });

  it('is a stable singleton within a process', () => {
    expect(getStorage()).toBe(getStorage());
  });

  it('selects the S3 adapter for STORAGE_PROVIDER=s3 (constructs without secrets)', () => {
    process.env.STORAGE_PROVIDER = 's3';
    __resetStorageForTests();
    const s = getStorage();
    expect(s.provider).toBe('s3');
    expect(s).toBeInstanceOf(S3Adapter);
  });
});

describe('S3Adapter (no SDK / no secrets required to construct)', () => {
  it('constructs without env or SDK present', () => {
    expect(() => new S3Adapter()).not.toThrow();
  });

  it('getUrl uses S3_PUBLIC_URL_BASE without touching the SDK', async () => {
    process.env.S3_PUBLIC_URL_BASE = 'https://cdn.example.com';
    const a = new S3Adapter();
    expect(await a.getUrl('attachments/2026/07/a b.png')).toBe(
      'https://cdn.example.com/attachments/2026/07/a%20b.png'
    );
    delete process.env.S3_PUBLIC_URL_BASE;
  });
});
