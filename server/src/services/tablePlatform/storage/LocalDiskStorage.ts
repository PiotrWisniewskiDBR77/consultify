/**
 * LocalDiskStorage — writes attachment objects to the local filesystem.
 * Preserves the pre-existing behaviour of AttachmentService (default backend).
 */

import { createReadStream, existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';

import type { StorageBackend } from './StorageBackend.js';

export class LocalDiskStorage implements StorageBackend {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private full(key: string): string {
    return path.join(this.baseDir, key);
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<void> {
    const fullPath = this.full(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, body);
  }

  async get(key: string): Promise<Readable> {
    const fullPath = this.full(key);
    if (!existsSync(fullPath)) {
      throw new Error(`Object not found: ${key}`);
    }
    return createReadStream(fullPath);
  }

  async getBuffer(key: string): Promise<Buffer> {
    return fs.readFile(this.full(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.full(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    return existsSync(this.full(key));
  }

  // Local disk has no native pre-signing; caller uses the HMAC token route.
  async getSignedUrl(_key: string, _expiresInSeconds: number): Promise<string | null> {
    return null;
  }
}
