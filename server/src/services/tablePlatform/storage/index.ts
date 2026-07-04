/**
 * Storage backend factory for Table Platform attachments.
 *
 * Selection: env TP_ATTACHMENTS_STORAGE = s3 | local (default local).
 * When s3 is requested but config is incomplete, we fall back to local disk
 * and log a warning — never crash the service on misconfiguration.
 */

import logger from '../../../utils/Logger.js';

import { LocalDiskStorage } from './LocalDiskStorage.js';
import { createS3StorageFromEnv, type FetchLike } from './S3Storage.js';
import { resolveStorageKind, type StorageBackend } from './StorageBackend.js';

export * from './StorageBackend.js';
export { LocalDiskStorage } from './LocalDiskStorage.js';
export { S3Storage, createS3StorageFromEnv } from './S3Storage.js';

export interface CreateStorageOptions {
  /** Base dir for LocalDiskStorage. */
  localBaseDir: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
}

export function createStorageBackend(opts: CreateStorageOptions): StorageBackend {
  const env = opts.env ?? process.env;
  const kind = resolveStorageKind(env);

  if (kind === 's3') {
    const s3 = createS3StorageFromEnv(env, opts.fetchImpl);
    if (s3) {
      logger.info('[AttachmentStorage] Using S3-compatible backend', {
        bucket: env.TP_ATTACHMENTS_S3_BUCKET,
      });
      return s3;
    }
    logger.warn(
      '[AttachmentStorage] TP_ATTACHMENTS_STORAGE=s3 but S3 config incomplete — falling back to local disk'
    );
  }

  return new LocalDiskStorage(opts.localBaseDir);
}
