import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const NOTEBOOK_ATTACHMENT_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'notebook-attachments');
const MAX_NOTEBOOK_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.sh',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.pif',
  '.vbs',
  '.vbe',
  '.wsf',
  '.wsh',
  '.ps1',
  '.psm1',
]);

export interface NotebookAttachmentRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string;
  storageKey?: string;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-') || 'attachment';
}

export function parseNotebookAttachments(
  raw: string | NotebookAttachmentRecord[] | null | undefined
): NotebookAttachmentRecord[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed)
      ? parsed.filter(Boolean).map((item) => ({
          id: String(item.id || ''),
          name: String(item.name || ''),
          type: String(item.type || 'application/octet-stream'),
          size: Number(item.size || 0),
          uploadedAt: String(item.uploadedAt || ''),
          uploadedBy: item.uploadedBy ? String(item.uploadedBy) : undefined,
          storageKey: item.storageKey ? String(item.storageKey) : undefined,
        }))
      : [];
  } catch {
    return [];
  }
}

export function toPublicNotebookAttachments(
  raw: string | NotebookAttachmentRecord[] | null | undefined
): NotebookAttachmentRecord[] {
  return parseNotebookAttachments(raw).map(
    ({ storageKey: _storageKey, ...attachment }) => attachment
  );
}

function validateNotebookAttachment(file: {
  originalname: string;
  mimetype: string;
  size: number;
}): void {
  if (!file.originalname.trim()) {
    throw new Error('Attachment filename is required');
  }
  if (file.size <= 0) {
    throw new Error('Attachment file is empty');
  }
  if (file.size > MAX_NOTEBOOK_ATTACHMENT_SIZE) {
    throw new Error('Attachment exceeds maximum size of 25MB');
  }
  const extension = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(extension)) {
    throw new Error(`Attachment type not allowed: ${extension}`);
  }
}

export async function persistNotebookAttachment(params: {
  organizationId: string;
  pageId: string;
  fileBuffer: Buffer;
  fileOriginalname: string;
  fileMimetype: string;
  userId?: string;
}): Promise<NotebookAttachmentRecord> {
  validateNotebookAttachment({
    originalname: params.fileOriginalname,
    mimetype: params.fileMimetype,
    size: params.fileBuffer.byteLength,
  });

  const attachmentId = uuidv4();
  const orgDir = path.join(NOTEBOOK_ATTACHMENT_UPLOAD_DIR, params.organizationId, params.pageId);
  await fs.mkdir(orgDir, { recursive: true });

  const storageKey = path.join(
    params.organizationId,
    params.pageId,
    `${attachmentId}-${sanitizeFilename(params.fileOriginalname)}`
  );
  const absolutePath = path.join(NOTEBOOK_ATTACHMENT_UPLOAD_DIR, storageKey);
  await fs.writeFile(absolutePath, params.fileBuffer);

  return {
    id: attachmentId,
    name: params.fileOriginalname,
    type: params.fileMimetype || 'application/octet-stream',
    size: params.fileBuffer.byteLength,
    uploadedAt: new Date().toISOString(),
    uploadedBy: params.userId,
    storageKey,
  };
}

export async function resolveNotebookAttachmentFile(
  raw: string | NotebookAttachmentRecord[] | null | undefined,
  attachmentId: string
): Promise<{
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
} | null> {
  const match = parseNotebookAttachments(raw).find((attachment) => attachment.id === attachmentId);
  if (!match?.storageKey) return null;
  if (path.isAbsolute(match.storageKey) || match.storageKey.includes('..')) {
    return null;
  }

  const filePath = path.join(NOTEBOOK_ATTACHMENT_UPLOAD_DIR, match.storageKey);
  try {
    await fs.access(filePath);
  } catch {
    return null;
  }

  return {
    filePath,
    fileName: match.name || 'attachment',
    mimeType: match.type || 'application/octet-stream',
    sizeBytes: match.size || 0,
  };
}

export async function deleteNotebookAttachmentFile(
  raw: string | NotebookAttachmentRecord[] | null | undefined,
  attachmentId: string
): Promise<NotebookAttachmentRecord[]> {
  const attachments = parseNotebookAttachments(raw);
  const target = attachments.find((attachment) => attachment.id === attachmentId);
  if (target?.storageKey) {
    const filePath = path.join(NOTEBOOK_ATTACHMENT_UPLOAD_DIR, target.storageKey);
    await fs.unlink(filePath).catch(() => undefined);
  }
  return attachments.filter((attachment) => attachment.id !== attachmentId);
}
