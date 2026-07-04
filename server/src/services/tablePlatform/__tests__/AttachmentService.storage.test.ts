/**
 * Storage backend tests for Table Platform attachments.
 *
 * Coverage:
 *   - LocalDiskStorage: put/get/getBuffer/exists/delete roundtrip in a tmp dir,
 *     missing-object behaviour, getSignedUrl → null.
 *   - S3Storage: put/get/delete/exists via a mocked FetchLike; verifies method,
 *     URL shape (path-style), and that a valid SigV4 Authorization header is set.
 *   - createStorageBackend: env-driven selection (local default, s3 when
 *     configured, graceful fallback to local when s3 config incomplete).
 *   - awsSigV4: deterministic signature + presign URL shape.
 */

import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { presignUrl, signRequest, awsUriEncode } from '../storage/awsSigV4.js';
import { createStorageBackend } from '../storage/index.js';
import { LocalDiskStorage } from '../storage/LocalDiskStorage.js';
import { S3Storage, createS3StorageFromEnv, type FetchLike } from '../storage/S3Storage.js';
import { resolveStorageKind } from '../storage/StorageBackend.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// LocalDiskStorage
// ---------------------------------------------------------------------------

describe('LocalDiskStorage', () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = path.join(os.tmpdir(), `tp-attach-test-${randomUUID()}`);
    await fs.mkdir(baseDir, { recursive: true });
  });

  afterAll(async () => {
    // best effort — each test uses a unique dir
  });

  it('roundtrips put → getBuffer', async () => {
    const store = new LocalDiskStorage(baseDir);
    const key = '2026/07/abc-hello.txt';
    const body = Buffer.from('hello world', 'utf8');

    await store.put(key, body, 'text/plain');
    const got = await store.getBuffer(key);
    expect(got.toString('utf8')).toBe('hello world');
  });

  it('roundtrips put → get (stream)', async () => {
    const store = new LocalDiskStorage(baseDir);
    const key = 'nested/dir/file.bin';
    const body = Buffer.from([1, 2, 3, 4, 5]);

    await store.put(key, body, 'application/octet-stream');
    const stream = await store.get(key);
    const got = await streamToBuffer(stream);
    expect(Array.from(got)).toEqual([1, 2, 3, 4, 5]);
  });

  it('exists reflects presence', async () => {
    const store = new LocalDiskStorage(baseDir);
    expect(await store.exists('missing/key.txt')).toBe(false);
    await store.put('present.txt', Buffer.from('x'), 'text/plain');
    expect(await store.exists('present.txt')).toBe(true);
  });

  it('get throws for missing object', async () => {
    const store = new LocalDiskStorage(baseDir);
    await expect(store.get('nope.txt')).rejects.toThrow(/not found/i);
  });

  it('delete removes object and is idempotent for missing key', async () => {
    const store = new LocalDiskStorage(baseDir);
    await store.put('gone.txt', Buffer.from('bye'), 'text/plain');
    await store.delete('gone.txt');
    expect(await store.exists('gone.txt')).toBe(false);
    // second delete (already gone) must not throw
    await expect(store.delete('gone.txt')).resolves.toBeUndefined();
  });

  it('getSignedUrl returns null (no native presign)', async () => {
    const store = new LocalDiskStorage(baseDir);
    expect(await store.getSignedUrl('any/key', 900)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// awsSigV4
// ---------------------------------------------------------------------------

describe('awsSigV4', () => {
  const cfg = {
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1',
    service: 's3',
  };
  const fixedNow = new Date('2026-07-04T12:00:00.000Z');

  it('awsUriEncode encodes reserved chars but preserves unreserved', () => {
    expect(awsUriEncode('abc-_.~')).toBe('abc-_.~');
    expect(awsUriEncode('a b')).toBe('a%20b');
    expect(awsUriEncode('a/b')).toBe('a%2Fb');
    expect(awsUriEncode('a/b', false)).toBe('a/b');
  });

  it('signRequest produces a deterministic SigV4 Authorization header', () => {
    const headers = signRequest(cfg, {
      method: 'PUT',
      url: 'https://s3.amazonaws.com/mybucket/2026/07/file.txt',
      headers: { 'content-type': 'text/plain' },
      body: Buffer.from('data'),
      now: fixedNow,
    });
    expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
    expect(headers.Authorization).toContain('SignedHeaders=');
    expect(headers.Authorization).toContain('Signature=');
    expect(headers['x-amz-date']).toBe('20260704T120000Z');
    expect(headers['x-amz-content-sha256']).toMatch(/^[0-9a-f]{64}$/);
    // Signature is 64 hex chars
    const sig = headers.Authorization.match(/Signature=([0-9a-f]+)/)?.[1];
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signRequest is stable for identical inputs', () => {
    const args = {
      method: 'GET',
      url: 'https://s3.amazonaws.com/mybucket/k',
      headers: {},
      now: fixedNow,
    } as const;
    const a = signRequest(cfg, { ...args });
    const b = signRequest(cfg, { ...args });
    expect(a.Authorization).toBe(b.Authorization);
  });

  it('presignUrl builds a query-signed URL with required X-Amz params', () => {
    const url = presignUrl(cfg, 'https://s3.amazonaws.com/mybucket/k.txt', 900, fixedNow);
    expect(url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(url).toContain('X-Amz-Credential=');
    expect(url).toContain('X-Amz-Date=20260704T120000Z');
    expect(url).toContain('X-Amz-Expires=900');
    expect(url).toContain('X-Amz-SignedHeaders=host');
    expect(url).toMatch(/X-Amz-Signature=[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// S3Storage (mocked fetch)
// ---------------------------------------------------------------------------

describe('S3Storage', () => {
  const fixedNow = () => new Date('2026-07-04T12:00:00.000Z');

  interface Call {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: Buffer;
  }

  function makeFetch(
    responder: (call: Call) => { ok: boolean; status: number; body?: Buffer; text?: string }
  ): { fetch: FetchLike; calls: Call[] } {
    const calls: Call[] = [];
    const fetch: FetchLike = async (url, init) => {
      const call: Call = { url, method: init.method, headers: init.headers, body: init.body };
      calls.push(call);
      const r = responder(call);
      return {
        ok: r.ok,
        status: r.status,
        arrayBuffer: async () => {
          const b = r.body ?? Buffer.alloc(0);
          return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
        },
        text: async () => r.text ?? '',
      };
    };
    return { fetch, calls };
  }

  function makeStore(fetchImpl: FetchLike): S3Storage {
    return new S3Storage({
      endpoint: 'https://s3.eu-central-1.example.com',
      bucket: 'attachments',
      accessKeyId: 'AKID',
      secretAccessKey: 'SECRET',
      region: 'eu-central-1',
      fetchImpl,
      now: fixedNow,
    });
  }

  it('put issues a signed PUT to path-style URL', async () => {
    const { fetch, calls } = makeFetch(() => ({ ok: true, status: 200 }));
    const store = makeStore(fetch);
    await store.put('2026/07/id-file.txt', Buffer.from('hello'), 'text/plain');

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toBe(
      'https://s3.eu-central-1.example.com/attachments/2026/07/id-file.txt'
    );
    expect(calls[0].headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\//);
    expect(calls[0].headers['content-type']).toBe('text/plain');
    expect(calls[0].body?.toString('utf8')).toBe('hello');
  });

  it('put throws on non-ok status', async () => {
    const { fetch } = makeFetch(() => ({ ok: false, status: 403, text: 'AccessDenied' }));
    const store = makeStore(fetch);
    await expect(store.put('k', Buffer.from('x'), 'text/plain')).rejects.toThrow(/S3 PUT failed \(403\)/);
  });

  it('getBuffer returns the object body from a signed GET', async () => {
    const { fetch, calls } = makeFetch(() => ({
      ok: true,
      status: 200,
      body: Buffer.from('payload'),
    }));
    const store = makeStore(fetch);
    const buf = await store.getBuffer('2026/07/x.bin');
    expect(buf.toString('utf8')).toBe('payload');
    expect(calls[0].method).toBe('GET');
    expect(calls[0].headers.Authorization).toContain('AWS4-HMAC-SHA256');
  });

  it('get returns a readable stream of the body', async () => {
    const { fetch } = makeFetch(() => ({ ok: true, status: 200, body: Buffer.from('streamed') }));
    const store = makeStore(fetch);
    const stream = await store.get('k');
    const got = await streamToBuffer(stream);
    expect(got.toString('utf8')).toBe('streamed');
  });

  it('delete treats 404 as success', async () => {
    const { fetch, calls } = makeFetch(() => ({ ok: false, status: 404 }));
    const store = makeStore(fetch);
    await expect(store.delete('missing')).resolves.toBeUndefined();
    expect(calls[0].method).toBe('DELETE');
  });

  it('delete throws on other errors', async () => {
    const { fetch } = makeFetch(() => ({ ok: false, status: 500, text: 'boom' }));
    const store = makeStore(fetch);
    await expect(store.delete('k')).rejects.toThrow(/S3 DELETE failed \(500\)/);
  });

  it('exists is true on ok HEAD, false otherwise', async () => {
    const okStore = makeStore(makeFetch(() => ({ ok: true, status: 200 })).fetch);
    expect(await okStore.exists('k')).toBe(true);
    const missStore = makeStore(makeFetch(() => ({ ok: false, status: 404 })).fetch);
    expect(await missStore.exists('k')).toBe(false);
  });

  it('getSignedUrl returns a presigned GET URL', async () => {
    const store = makeStore(makeFetch(() => ({ ok: true, status: 200 })).fetch);
    const url = await store.getSignedUrl('2026/07/x.txt', 900);
    expect(url).toContain('https://s3.eu-central-1.example.com/attachments/2026/07/x.txt');
    expect(url).toContain('X-Amz-Signature=');
  });

  it('createS3StorageFromEnv returns null when config incomplete', () => {
    expect(createS3StorageFromEnv({ TP_ATTACHMENTS_S3_ENDPOINT: 'https://x' } as any)).toBeNull();
  });

  it('createS3StorageFromEnv builds a store when config complete', () => {
    const store = createS3StorageFromEnv(
      {
        TP_ATTACHMENTS_S3_ENDPOINT: 'https://s3.example.com',
        TP_ATTACHMENTS_S3_BUCKET: 'b',
        TP_ATTACHMENTS_S3_ACCESS_KEY: 'k',
        TP_ATTACHMENTS_S3_SECRET: 's',
      } as any,
      makeFetch(() => ({ ok: true, status: 200 })).fetch
    );
    expect(store).toBeInstanceOf(S3Storage);
  });
});

// ---------------------------------------------------------------------------
// Backend selection
// ---------------------------------------------------------------------------

describe('createStorageBackend selection', () => {
  const localBaseDir = path.join(os.tmpdir(), 'tp-attach-sel');

  it('resolveStorageKind defaults to local', () => {
    expect(resolveStorageKind({} as any)).toBe('local');
    expect(resolveStorageKind({ TP_ATTACHMENTS_STORAGE: 'LOCAL' } as any)).toBe('local');
    expect(resolveStorageKind({ TP_ATTACHMENTS_STORAGE: 's3' } as any)).toBe('s3');
    expect(resolveStorageKind({ TP_ATTACHMENTS_STORAGE: 'S3' } as any)).toBe('s3');
    expect(resolveStorageKind({ TP_ATTACHMENTS_STORAGE: 'bogus' } as any)).toBe('local');
  });

  it('returns LocalDiskStorage by default (no flag)', () => {
    const store = createStorageBackend({ localBaseDir, env: {} as any });
    expect(store).toBeInstanceOf(LocalDiskStorage);
  });

  it('returns S3Storage when flag=s3 and config present', () => {
    const store = createStorageBackend({
      localBaseDir,
      env: {
        TP_ATTACHMENTS_STORAGE: 's3',
        TP_ATTACHMENTS_S3_ENDPOINT: 'https://s3.example.com',
        TP_ATTACHMENTS_S3_BUCKET: 'b',
        TP_ATTACHMENTS_S3_ACCESS_KEY: 'k',
        TP_ATTACHMENTS_S3_SECRET: 's',
      } as any,
    });
    expect(store).toBeInstanceOf(S3Storage);
  });

  it('falls back to LocalDiskStorage when flag=s3 but config incomplete', () => {
    const store = createStorageBackend({
      localBaseDir,
      env: { TP_ATTACHMENTS_STORAGE: 's3' } as any,
    });
    expect(store).toBeInstanceOf(LocalDiskStorage);
  });
});
