/**
 * feedbackArtifacts
 *
 * Local filesystem adapter for Feedback Pipeline V2 artifacts (screenshots).
 * Default directory is `<cwd>/.feedback-artifacts` so it works in dev and on
 * Railway (which maps a persistent volume at `/app` — override with
 * `FEEDBACK_ARTIFACTS_DIR`). Intentionally small surface: we only need
 * write/read of raw bytes per feedback id.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import logger from '../utils/Logger.js';

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

const DEFAULT_DIR = path.resolve(process.cwd(), '.feedback-artifacts');

function getArtifactsDir(): string {
  const override = process.env.FEEDBACK_ARTIFACTS_DIR;
  if (override && override.trim()) return path.resolve(override.trim());
  return DEFAULT_DIR;
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
      const mimeType =
        ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp';
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
