/**
 * Storage backend abstraction for Table Platform attachments.
 *
 * Two implementations:
 *   - LocalDiskStorage: existing behaviour, writes to UPLOAD_DIR on local FS (default).
 *   - S3Storage:        S3-compatible object storage (Railway-safe, survives redeploys).
 *
 * Backend selection is driven by env TP_ATTACHMENTS_STORAGE (=s3|local, default local),
 * so behaviour is UNCHANGED unless the flag is explicitly set to s3.
 *
 * The S3 implementation is a minimal SigV4 REST client built on node's `crypto`
 * (no @aws-sdk dependency) — keeps the dependency footprint at zero for a feature
 * that is opt-in and behind a flag.
 */

import { Readable } from 'stream';

export interface StorageBackend {
  /** Store an object under `key`. */
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Return the object body as a readable stream. Throws if missing. */
  get(key: string): Promise<Readable>;
  /** Return the object body as a Buffer. Throws if missing. */
  getBuffer(key: string): Promise<Buffer>;
  /** Delete an object. Best-effort: missing object is not an error. */
  delete(key: string): Promise<void>;
  /** True if the object exists. */
  exists(key: string): Promise<boolean>;
  /**
   * Return a URL that grants temporary read access to the object without
   * further auth. For local disk there is no native pre-signing, so callers
   * fall back to the app-level HMAC token route (returns null here).
   */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string | null>;
}

export type StorageKind = 's3' | 'local';

export function resolveStorageKind(env: NodeJS.ProcessEnv = process.env): StorageKind {
  const raw = (env.TP_ATTACHMENTS_STORAGE || 'local').trim().toLowerCase();
  return raw === 's3' ? 's3' : 'local';
}
