/**
 * LocalDiskAdapter — the DEFAULT storage adapter.
 *
 * Reproduces the exact current behavior: objects live under a base directory
 * on the local filesystem, keyed by their provider-relative `key`. This is the
 * same layout the codebase used before the storage seam existed (e.g.
 * `uploads/attachments/<year>/<month>/<uuid>-name`), so switching a call-site
 * to route through this adapter is behavior-preserving.
 *
 * Keys are treated as POSIX-style relative paths and are resolved *under* the
 * base directory. A guard rejects any key that would escape the base dir
 * (path traversal), which is strictly safer than the previous raw
 * `path.join(UPLOAD_DIR, storageKey)` — the callers already produce sanitized
 * keys, so well-behaved inputs are unaffected.
 */

import { createReadStream, existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import type {
  GetObjectResult,
  GetUrlOptions,
  PutObjectInput,
  PutObjectResult,
  StorageAdapter,
} from './types.js';

export interface LocalDiskAdapterOptions {
  /** Absolute base directory that objects are stored under. */
  baseDir: string;
  /**
   * Public URL prefix used by {@link getUrl}. The key is appended to it.
   * Defaults to `/uploads` (the existing express.static mount). Should NOT end
   * with a trailing slash.
   */
  urlPrefix?: string;
}

/** Resolve `key` under `baseDir`, rejecting traversal outside the base. */
function resolveSafe(baseDir: string, key: string): string {
  // Normalize to the host path separator; keys are authored POSIX-style.
  const normalizedKey = key.split('/').join(path.sep);
  const full = path.resolve(baseDir, normalizedKey);
  const baseResolved = path.resolve(baseDir);
  if (full !== baseResolved && !full.startsWith(baseResolved + path.sep)) {
    throw new Error(`Invalid storage key (path traversal): ${key}`);
  }
  return full;
}

export class LocalDiskAdapter implements StorageAdapter {
  readonly provider = 'local';
  private readonly baseDir: string;
  private readonly urlPrefix: string;

  constructor(options: LocalDiskAdapterOptions) {
    this.baseDir = options.baseDir;
    this.urlPrefix = (options.urlPrefix ?? '/uploads').replace(/\/+$/, '');
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const full = resolveSafe(this.baseDir, input.key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, input.body);
    return { key: input.key };
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const full = resolveSafe(this.baseDir, key);
    if (!existsSync(full)) {
      throw new Error(`Object not found: ${key}`);
    }
    const stat = await fs.stat(full);
    return {
      stream: createReadStream(full),
      size: stat.size,
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      const full = resolveSafe(this.baseDir, key);
      return existsSync(full);
    } catch {
      return false;
    }
  }

  async getUrl(key: string, _options?: GetUrlOptions): Promise<string> {
    // Static path served by the existing `/uploads` express.static mount.
    // Local disk cannot sign URLs, so options.expiresInSeconds is ignored.
    const encoded = key
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    return `${this.urlPrefix}/${encoded}`;
  }

  async delete(key: string): Promise<void> {
    const full = resolveSafe(this.baseDir, key);
    try {
      await fs.unlink(full);
    } catch (err) {
      // Idempotent: a missing object is a successful delete.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  /** Absolute on-disk path for a key (local-only helper for legacy callers). */
  resolvePath(key: string): string {
    return resolveSafe(this.baseDir, key);
  }
}
