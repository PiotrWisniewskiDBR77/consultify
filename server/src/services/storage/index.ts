/**
 * Storage seam entry point + provider factory.
 *
 * Call sites should import {@link getStorage} and use the returned
 * {@link StorageAdapter} for all user-upload object I/O. The concrete provider
 * is chosen ONCE, here, from env:
 *
 *   STORAGE_PROVIDER=local   (default) → {@link LocalDiskAdapter}
 *   STORAGE_PROVIDER=s3               → {@link S3Adapter} (S3 / Cloudflare R2)
 *
 * KEY CONTRACT
 * ------------
 * Keys are provider-relative paths ROOTED AT the `uploads/` tree, e.g.
 *   attachments/2026/07/<uuid>-name.png
 *   whiteboard/<orgId>/<uuid>.png
 *
 * For the local adapter the base dir is `<cwd>/uploads`, so a key resolves to
 * `<cwd>/uploads/<key>` — identical to the pre-seam layout — and getUrl()
 * returns `/uploads/<key>`, matching the existing express.static mount in
 * server/src/index.ts. This means the seam is behavior-preserving today and a
 * future S3/R2 switch reuses the exact same keys already stored in the DB.
 *
 * DEFAULT BEHAVIOR IS UNCHANGED: with no STORAGE_PROVIDER set, everything runs
 * on local disk exactly as before.
 */

import path from 'path';

import logger from '../../utils/Logger.js';
import { LocalDiskAdapter } from './LocalDiskAdapter.js';
import { S3Adapter } from './S3Adapter.js';
import type { StorageAdapter } from './types.js';

export type { StorageAdapter, PutObjectInput, GetObjectResult, GetUrlOptions } from './types.js';
export { LocalDiskAdapter } from './LocalDiskAdapter.js';
export { S3Adapter } from './S3Adapter.js';

/**
 * Absolute base directory for the local `uploads/` tree. Matches the historic
 * `path.join(process.cwd(), 'uploads', ...)` roots used across the codebase.
 * Overridable via UPLOADS_BASE_DIR for tests / non-standard deployments.
 */
export function getUploadsBaseDir(): string {
  return process.env.UPLOADS_BASE_DIR || path.join(process.cwd(), 'uploads');
}

/** Public URL prefix for locally-served uploads (express.static mount). */
const LOCAL_URL_PREFIX = '/uploads';

let cached: StorageAdapter | undefined;

function build(): StorageAdapter {
  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

  switch (provider) {
    case 's3':
    case 'r2': {
      logger.info('[storage] Using S3-compatible storage adapter', {
        endpoint: process.env.S3_ENDPOINT || '(aws default)',
        bucket: process.env.S3_BUCKET || '(unset)',
      });
      return new S3Adapter();
    }
    case 'local':
    default: {
      const baseDir = getUploadsBaseDir();
      logger.info('[storage] Using local disk storage adapter', { baseDir });
      return new LocalDiskAdapter({ baseDir, urlPrefix: LOCAL_URL_PREFIX });
    }
  }
}

/**
 * Return the process-wide storage adapter, constructing it on first use.
 * The provider is fixed for the process lifetime.
 */
export function getStorage(): StorageAdapter {
  if (!cached) {
    cached = build();
  }
  return cached;
}

/** Test-only: reset the cached adapter so a new provider env can take effect. */
export function __resetStorageForTests(): void {
  cached = undefined;
}
