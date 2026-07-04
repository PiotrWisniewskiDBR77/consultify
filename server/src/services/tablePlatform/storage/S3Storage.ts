/**
 * S3Storage — S3-compatible object storage backend (path-style addressing).
 *
 * Config from env (resolved by createS3StorageFromEnv):
 *   TP_ATTACHMENTS_S3_ENDPOINT   (required) e.g. https://s3.eu-central-1.amazonaws.com
 *   TP_ATTACHMENTS_S3_BUCKET     (required)
 *   TP_ATTACHMENTS_S3_ACCESS_KEY (required)
 *   TP_ATTACHMENTS_S3_SECRET     (required)
 *   TP_ATTACHMENTS_S3_REGION     (optional, default us-east-1)
 *
 * HTTP is performed via an injectable fetch (defaults to global fetch), so the
 * signing + request-shaping logic is unit-testable without a live endpoint.
 */

import { Readable } from 'stream';

import { presignUrl, signRequest, awsUriEncode, type SigV4Config } from './awsSigV4.js';
import type { StorageBackend } from './StorageBackend.js';

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: Buffer;
  }
) => Promise<{
  ok: boolean;
  status: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
}>;

export interface S3StorageOptions {
  endpoint: string; // origin, e.g. https://s3.eu-central-1.amazonaws.com
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
}

export class S3Storage implements StorageBackend {
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly cfg: SigV4Config;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;

  constructor(opts: S3StorageOptions) {
    this.endpoint = opts.endpoint.replace(/\/+$/, '');
    this.bucket = opts.bucket;
    this.cfg = {
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
      region: opts.region || 'us-east-1',
      service: 's3',
    };
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.now = opts.now ?? (() => new Date());
    if (!this.fetchImpl) {
      throw new Error('S3Storage: no fetch implementation available');
    }
  }

  /** Build the path-style object URL for a key. */
  private objectUrl(key: string): string {
    const encodedKey = key.split('/').map((seg) => awsUriEncode(seg)).join('/');
    return `${this.endpoint}/${this.bucket}/${encodedKey}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const url = this.objectUrl(key);
    const headers = signRequest(this.cfg, {
      method: 'PUT',
      url,
      headers: {
        'content-type': contentType || 'application/octet-stream',
        'content-length': String(body.length),
      },
      body,
      now: this.now(),
    });
    const res = await this.fetchImpl(url, { method: 'PUT', headers, body });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`S3 PUT failed (${res.status}) for ${key}: ${detail.slice(0, 500)}`);
    }
  }

  async getBuffer(key: string): Promise<Buffer> {
    const url = this.objectUrl(key);
    const headers = signRequest(this.cfg, {
      method: 'GET',
      url,
      headers: {},
      now: this.now(),
    });
    const res = await this.fetchImpl(url, { method: 'GET', headers });
    if (!res.ok) {
      throw new Error(`S3 GET failed (${res.status}) for ${key}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async get(key: string): Promise<Readable> {
    const buf = await this.getBuffer(key);
    return Readable.from(buf);
  }

  async delete(key: string): Promise<void> {
    const url = this.objectUrl(key);
    const headers = signRequest(this.cfg, {
      method: 'DELETE',
      url,
      headers: {},
      now: this.now(),
    });
    const res = await this.fetchImpl(url, { method: 'DELETE', headers });
    // 204 = deleted, 404 = already gone — both fine.
    if (!res.ok && res.status !== 404) {
      const detail = await res.text().catch(() => '');
      throw new Error(`S3 DELETE failed (${res.status}) for ${key}: ${detail.slice(0, 500)}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    const url = this.objectUrl(key);
    const headers = signRequest(this.cfg, {
      method: 'HEAD',
      url,
      headers: {},
      now: this.now(),
    });
    const res = await this.fetchImpl(url, { method: 'HEAD', headers });
    return res.ok;
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string | null> {
    return presignUrl(this.cfg, this.objectUrl(key), expiresInSeconds, this.now());
  }
}

/**
 * Build an S3Storage from env, or return null if required vars are missing.
 * Never throws on missing config — caller decides fallback.
 */
export function createS3StorageFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: FetchLike
): S3Storage | null {
  const endpoint = env.TP_ATTACHMENTS_S3_ENDPOINT?.trim();
  const bucket = env.TP_ATTACHMENTS_S3_BUCKET?.trim();
  const accessKeyId = env.TP_ATTACHMENTS_S3_ACCESS_KEY?.trim();
  const secretAccessKey = env.TP_ATTACHMENTS_S3_SECRET?.trim();
  const region = env.TP_ATTACHMENTS_S3_REGION?.trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return new S3Storage({
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
    fetchImpl,
  });
}
