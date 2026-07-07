/**
 * Storage abstraction — provider-agnostic object storage seam.
 *
 * WHY THIS EXISTS (systemic P0):
 * User uploads (Whiteboard images, Table/`tablePlatform` attachments, …) are
 * written to the LOCAL disk of the Railway container. Railway's filesystem is
 * ephemeral: every redeploy wipes it, so uploaded files silently disappear.
 *
 * This module introduces a single seam so that moving to durable object
 * storage (S3 / Cloudflare R2) is CONFIGURATION, not a rewrite. All physical
 * object reads/writes/deletes for user uploads should flow through a
 * {@link StorageAdapter}. Today the default adapter is {@link LocalDiskAdapter},
 * which reproduces the exact current on-disk behavior. Flipping
 * `STORAGE_PROVIDER=s3` (with the R2/S3 env vars set) switches every call-site
 * at once with no code change.
 *
 * A "key" is the provider-relative object identifier — e.g.
 * `2026/07/uuid-file.png` or `whiteboard/<orgId>/<uuid>.png`. It is stored in
 * the DB (`tp_attachments.storage_key`) and is identical across providers, so
 * existing rows keep resolving after a provider switch.
 */

import type { Readable } from 'stream';

/** Input payload for a write. `body` is the full object bytes. */
export interface PutObjectInput {
  /** Provider-relative object key, e.g. `2026/07/uuid-name.png`. */
  key: string;
  /** Object bytes. */
  body: Buffer;
  /** MIME type; used by S3 as Content-Type. Optional for local disk. */
  contentType?: string;
}

export interface PutObjectResult {
  key: string;
}

/** Metadata + a readable stream for a fetched object. */
export interface GetObjectResult {
  stream: Readable;
  /** Byte length when known (local: fs stat; s3: ContentLength). */
  size?: number;
  contentType?: string;
}

/**
 * Options for {@link StorageAdapter.getUrl}.
 * `expiresInSeconds` only affects providers that issue signed URLs (S3/R2);
 * the local adapter ignores it and returns a static path.
 */
export interface GetUrlOptions {
  expiresInSeconds?: number;
}

/**
 * Provider-agnostic object storage.
 *
 * Implementations MUST be safe to construct without network access and MUST
 * NOT require secrets at import time (secrets are read lazily on first use),
 * so the module compiles and boots even when a provider is unconfigured.
 */
export interface StorageAdapter {
  /** Human-readable provider id, e.g. `local` or `s3`. */
  readonly provider: string;

  /** Write the full object bytes at `key`. Overwrites if it already exists. */
  putObject(input: PutObjectInput): Promise<PutObjectResult>;

  /** Fetch an object as a stream. Rejects if the key does not exist. */
  getObject(key: string): Promise<GetObjectResult>;

  /** Whether an object exists at `key`. */
  exists(key: string): Promise<boolean>;

  /**
   * Resolve a URL a browser can use to fetch the object.
   * - local: a static path under the `/uploads` express.static mount.
   * - s3/r2: a pre-signed GET URL (honors `expiresInSeconds`).
   */
  getUrl(key: string, options?: GetUrlOptions): Promise<string>;

  /** Delete an object. Idempotent: a missing key resolves without error. */
  delete(key: string): Promise<void>;
}
