import fs from 'fs/promises';
import path from 'path';

import { baseStorageDir } from '../utils/storagePaths.js';

const NOTEBOOK_SOURCE_UPLOAD_DIR = path.join(baseStorageDir(), 'uploads', 'notebook-source-files');

export interface NotebookCaptureMetadataRecord {
  captureSource?: string;
  url?: string;
  emailFrom?: string;
  fileOriginalname?: string;
  fileMimetype?: string;
  storedSourceFile?: boolean;
  sourceFileStorageKey?: string;
  sourceFileSizeBytes?: number;
  [key: string]: unknown;
}

function safeFilename(filename: string): string {
  const cleaned = filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return cleaned || 'source-file';
}

export function parseNotebookCaptureMetadata(
  raw: string | NotebookCaptureMetadataRecord | null | undefined
): NotebookCaptureMetadataRecord | null {
  if (!raw) return null;
  try {
    const parsed =
      typeof raw === 'string' ? (JSON.parse(raw) as NotebookCaptureMetadataRecord) : raw;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function toPublicNotebookCaptureMetadata(
  raw: string | NotebookCaptureMetadataRecord | null | undefined
): NotebookCaptureMetadataRecord | null {
  const parsed = parseNotebookCaptureMetadata(raw);
  if (!parsed) return null;
  const { sourceFileStorageKey: _internalStorageKey, ...publicMetadata } = parsed;
  return Object.keys(publicMetadata).length > 0 ? publicMetadata : null;
}

export async function persistNotebookSourceFile(params: {
  organizationId: string;
  pageId: string;
  fileBuffer: Buffer;
  fileOriginalname: string;
  fileMimetype: string;
}): Promise<NotebookCaptureMetadataRecord> {
  const orgDir = path.join(NOTEBOOK_SOURCE_UPLOAD_DIR, params.organizationId);
  await fs.mkdir(orgDir, { recursive: true });

  const storageKey = path.join(
    params.organizationId,
    `${params.pageId}-${safeFilename(params.fileOriginalname)}`
  );
  const absolutePath = path.join(NOTEBOOK_SOURCE_UPLOAD_DIR, storageKey);
  await fs.writeFile(absolutePath, params.fileBuffer);

  return {
    storedSourceFile: true,
    sourceFileStorageKey: storageKey,
    sourceFileSizeBytes: params.fileBuffer.byteLength,
  };
}

export async function resolveStoredNotebookSourceFile(
  raw: string | NotebookCaptureMetadataRecord | null | undefined
): Promise<{
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
} | null> {
  const metadata = parseNotebookCaptureMetadata(raw);
  if (!metadata?.storedSourceFile || !metadata.sourceFileStorageKey) {
    return null;
  }

  const storageKey = String(metadata.sourceFileStorageKey);
  if (!storageKey || path.isAbsolute(storageKey) || storageKey.includes('..')) {
    return null;
  }

  const filePath = path.join(NOTEBOOK_SOURCE_UPLOAD_DIR, storageKey);
  try {
    await fs.access(filePath);
  } catch {
    return null;
  }

  return {
    filePath,
    fileName: String(metadata.fileOriginalname || 'source-file'),
    mimeType: String(metadata.fileMimetype || 'application/octet-stream'),
    sizeBytes:
      typeof metadata.sourceFileSizeBytes === 'number' ? metadata.sourceFileSizeBytes : null,
  };
}
