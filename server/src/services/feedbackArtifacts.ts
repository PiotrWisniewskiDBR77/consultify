/**
 * feedbackArtifacts
 *
 * Local filesystem adapter for Feedback Pipeline V2 artifacts (screenshots).
 * Default directory is `<baseStorageDir>/.feedback-artifacts` (see
 * utils/storagePaths.ts) — plain local disk in dev, and under a mounted
 * Railway Volume in prod once STORAGE_DIR/RAILWAY_VOLUME_MOUNT_PATH is set.
 * NOTE (G2 correction): Railway does NOT persist local container disk across
 * redeploys by default — a prior version of this comment claimed otherwise.
 * Override the whole path with `FEEDBACK_ARTIFACTS_DIR` if needed.
 * Intentionally small surface: we only need write/read of raw bytes per
 * feedback id.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import logger from '../utils/Logger.js';
import { baseStorageDir } from '../utils/storagePaths.js';

export interface StoredArtifact {
  kind: 'screenshot';
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  storedAt: string;
  url: string;
}

function getArtifactsDir(): string {
  const override = process.env.FEEDBACK_ARTIFACTS_DIR;
  if (override && override.trim()) return path.resolve(override.trim());
  // No dedicated override set: fall back to the shared storage base (STORAGE_DIR /
  // RAILWAY_VOLUME_MOUNT_PATH / process.cwd() — see utils/storagePaths.ts) so these
  // screenshots also survive redeploys once a persistent volume is configured.
  return path.join(baseStorageDir(), '.feedback-artifacts');
}

function safeId(id: string): string {
  return String(id).replace(/[^a-zA-Z0-9-_]/g, '');
}

async function ensureDir(): Promise<string> {
  const dir = getArtifactsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

interface DecodedDataUrl {
  mimeType: string;
  buffer: Buffer;
}

export function decodeDataUrl(dataUrl: string): DecodedDataUrl | null {
  const match = /^data:([a-zA-Z0-9./+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
  } catch {
    return null;
  }
}

export async function saveScreenshotFromDataUrl(
  feedbackId: string,
  dataUrl: string,
  meta?: { width?: number; height?: number; maxBytes?: number }
): Promise<StoredArtifact | null> {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return null;

  const maxBytes = meta?.maxBytes ?? 1_200_000;
  if (decoded.buffer.byteLength > maxBytes) {
    logger.warn(
      `[feedbackArtifacts] Screenshot rejected: ${decoded.buffer.byteLength} bytes > ${maxBytes}`
    );
    return null;
  }

  const id = safeId(feedbackId);
  if (!id) return null;

  const dir = await ensureDir();
  const ext = decoded.mimeType.includes('png')
    ? 'png'
    : decoded.mimeType.includes('webp')
      ? 'webp'
      : 'jpg';
  const filename = `${id}.screenshot.${ext}`;
  const filepath = path.join(dir, filename);

  try {
    await fs.writeFile(filepath, decoded.buffer);
  } catch (err) {
    logger.warn('[feedbackArtifacts] Failed to write screenshot:', err);
    return null;
  }

  return {
    kind: 'screenshot',
    filename,
    mimeType: decoded.mimeType,
    sizeBytes: decoded.buffer.byteLength,
    width: meta?.width,
    height: meta?.height,
    storedAt: new Date().toISOString(),
    url: `/api/feedback/${encodeURIComponent(feedbackId)}/artifacts/screenshot`,
  };
}

export async function readScreenshot(feedbackId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
} | null> {
  const id = safeId(feedbackId);
  if (!id) return null;
  const dir = getArtifactsDir();
  for (const ext of ['jpg', 'png', 'webp'] as const) {
    const filepath = path.join(dir, `${id}.screenshot.${ext}`);
    try {
      const buffer = await fs.readFile(filepath);
      const mimeType = ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp';
      return { buffer, mimeType };
    } catch (err: any) {
      if (err && err.code !== 'ENOENT') {
        logger.warn('[feedbackArtifacts] readScreenshot failed:', err);
      }
    }
  }
  return null;
}

export async function deleteArtifactsFor(feedbackId: string): Promise<void> {
  const id = safeId(feedbackId);
  if (!id) return;
  const dir = getArtifactsDir();
  for (const ext of ['jpg', 'png', 'webp'] as const) {
    const filepath = path.join(dir, `${id}.screenshot.${ext}`);
    try {
      await fs.unlink(filepath);
    } catch {
      // ignore missing
    }
  }
}

/**
 * Delete screenshot files older than `maxAgeDays` days. Best-effort; never
 * throws. Called by the periodic pruner bootstrapped from `server/index.ts`.
 * Also acts as a safety net when the volume is NOT a Railway persistent mount
 * (dev, ephemeral staging rebuilds) — keeps the directory bounded.
 */
export async function pruneOldArtifacts(
  maxAgeDays = 30
): Promise<{ scanned: number; deleted: number; errors: number }> {
  const dir = getArtifactsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return { scanned: 0, deleted: 0, errors: 0 };
    logger.warn('[feedbackArtifacts] pruneOldArtifacts readdir failed:', err);
    return { scanned: 0, deleted: 0, errors: 1 };
  }

  const cutoffMs = Date.now() - Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let errors = 0;

  for (const entry of entries) {
    if (
      !entry.endsWith('.screenshot.jpg') &&
      !entry.endsWith('.screenshot.png') &&
      !entry.endsWith('.screenshot.webp')
    ) {
      continue;
    }
    const filepath = path.join(dir, entry);
    try {
      const stat = await fs.stat(filepath);
      if (stat.mtimeMs < cutoffMs) {
        await fs.unlink(filepath);
        deleted++;
      }
    } catch (err) {
      errors++;
      logger.warn('[feedbackArtifacts] pruneOldArtifacts stat/unlink failed:', err);
    }
  }

  if (deleted > 0 || errors > 0) {
    logger.info(
      `[feedbackArtifacts] Pruned ${deleted}/${entries.length} screenshot(s) older than ${maxAgeDays}d (${errors} errors).`
    );
  }
  return { scanned: entries.length, deleted, errors };
}

let pruneTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start a daily prune timer (no-op in test mode). Safe to call multiple times
 * — idempotent. Immediately runs once so staging/prod sees the effect without
 * waiting 24h.
 */
export function startArtifactPruner(opts?: { maxAgeDays?: number; intervalMs?: number }): void {
  if (process.env.NODE_ENV === 'test') return;
  if (pruneTimer) return;
  const maxAgeDays = opts?.maxAgeDays ?? 30;
  const intervalMs = opts?.intervalMs ?? 24 * 60 * 60 * 1000;
  void pruneOldArtifacts(maxAgeDays).catch(() => {});
  pruneTimer = setInterval(() => {
    void pruneOldArtifacts(maxAgeDays).catch(() => {});
  }, intervalMs);
  if (typeof pruneTimer.unref === 'function') pruneTimer.unref();
}
