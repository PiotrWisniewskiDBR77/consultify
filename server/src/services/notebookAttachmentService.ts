import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../utils/queryHelpers.js';
import { baseStorageDir } from '../utils/storagePaths.js';
import {
  P07_ATTACHMENT_ERROR_TAXONOMY,
  type P07AttachmentError,
  type P07AttachmentState,
} from './v8/notebookCanon.js';

const NOTEBOOK_ATTACHMENT_UPLOAD_DIR = path.join(
  baseStorageDir(),
  'uploads',
  'notebook-attachments'
);
const MAX_NOTEBOOK_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const NOTEBOOK_ATTACHMENT_MUTATION_MAX_RETRIES = 3;
const NOTEBOOK_ATTACHMENT_STAGING_DIR = path.join(
  NOTEBOOK_ATTACHMENT_UPLOAD_DIR,
  '.staging-delete'
);
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
  status: P07AttachmentState;
}

export class NotebookAttachmentMutationError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'NotebookAttachmentMutationError';
    this.status = status;
    this.code = code;
  }
}

export class AttachmentLifecycleError extends NotebookAttachmentMutationError {
  errorType: P07AttachmentError;
  retryable: boolean;
  userMessage: string;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    errorType: P07AttachmentError;
    retryable: boolean;
    userMessage: string;
  }) {
    super(params.status, params.code, params.message);
    this.name = 'AttachmentLifecycleError';
    this.errorType = params.errorType;
    this.retryable = params.retryable;
    this.userMessage = params.userMessage;
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-') || 'attachment';
}

function resolveAttachmentAbsolutePath(storageKey: string): string | null {
  if (!storageKey || path.isAbsolute(storageKey) || storageKey.includes('..')) {
    return null;
  }
  return path.join(NOTEBOOK_ATTACHMENT_UPLOAD_DIR, storageKey);
}

function serializeNotebookAttachments(attachments: NotebookAttachmentRecord[]): string {
  return JSON.stringify(
    parseNotebookAttachments(attachments).map(({ status: _status, ...rest }) => rest)
  );
}

async function cleanupStoredAttachment(attachment: NotebookAttachmentRecord): Promise<void> {
  if (!attachment.storageKey) return;
  const filePath = resolveAttachmentAbsolutePath(attachment.storageKey);
  if (!filePath) return;
  await fs.unlink(filePath).catch(() => undefined);
}

async function cleanupStoredAttachments(attachments: NotebookAttachmentRecord[]): Promise<void> {
  await Promise.all(attachments.map((attachment) => cleanupStoredAttachment(attachment)));
}

async function loadPageAttachments(pageId: string): Promise<NotebookAttachmentRecord[]> {
  const row = await queryHelpers.queryOne<{ attachmentsJson?: string | null }>(
    `SELECT attachments_json as "attachmentsJson"
     FROM notebook_pages
     WHERE id = ?
     LIMIT 1`,
    [pageId]
  );
  if (!row) {
    throw new NotebookAttachmentMutationError(
      404,
      'NOTEBOOK_PAGE_NOT_FOUND',
      'Notebook page not found'
    );
  }
  return parseNotebookAttachments(row.attachmentsJson);
}

async function compareAndSwapPageAttachments(
  pageId: string,
  previousAttachments: NotebookAttachmentRecord[],
  nextAttachments: NotebookAttachmentRecord[]
): Promise<boolean> {
  const result = await queryHelpers.queryRun(
    `UPDATE notebook_pages
     SET attachments_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND COALESCE(attachments_json, '[]')::jsonb = ?::jsonb`,
    [
      serializeNotebookAttachments(nextAttachments),
      pageId,
      serializeNotebookAttachments(previousAttachments),
    ]
  );
  return Number(result?.changes || 0) > 0;
}

async function stageAttachmentDeletion(target: NotebookAttachmentRecord): Promise<{
  finalize: () => Promise<void>;
  restore: () => Promise<void>;
}> {
  if (!target.storageKey) {
    return {
      finalize: async () => undefined,
      restore: async () => undefined,
    };
  }

  const sourcePath = resolveAttachmentAbsolutePath(target.storageKey);
  if (!sourcePath) {
    return {
      finalize: async () => undefined,
      restore: async () => undefined,
    };
  }

  const stagedPath = path.join(
    NOTEBOOK_ATTACHMENT_STAGING_DIR,
    `${target.id}-${Date.now()}-${path.basename(target.storageKey)}`
  );

  try {
    await fs.mkdir(path.dirname(stagedPath), { recursive: true });
    await fs.rename(sourcePath, stagedPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'ENOENT') {
      throw error;
    }
    return {
      finalize: async () => undefined,
      restore: async () => undefined,
    };
  }

  return {
    finalize: async () => {
      await fs.unlink(stagedPath).catch(() => undefined);
    },
    restore: async () => {
      await fs.mkdir(path.dirname(sourcePath), { recursive: true });
      await fs.rename(stagedPath, sourcePath).catch(async (error) => {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code === 'ENOENT') {
          return;
        }
        throw error;
      });
    },
  };
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
          status: (item.status as P07AttachmentState) || 'available',
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

export function classifyAttachmentError(
  error: Error,
  file: { originalname: string; mimetype: string; size: number }
): { errorType: P07AttachmentError; retryable: boolean; userMessage: string } {
  const extension = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(extension)) {
    return { errorType: 'type_unsupported', ...P07_ATTACHMENT_ERROR_TAXONOMY.type_unsupported };
  }
  if (file.size > MAX_NOTEBOOK_ATTACHMENT_SIZE) {
    return { errorType: 'size_limit', ...P07_ATTACHMENT_ERROR_TAXONOMY.size_limit };
  }

  const errno = (error as NodeJS.ErrnoException)?.code;

  if (errno === 'ENOSPC') {
    return {
      errorType: 'storage_unavailable',
      ...P07_ATTACHMENT_ERROR_TAXONOMY.storage_unavailable,
    };
  }
  if (errno === 'EACCES' || errno === 'EPERM') {
    return { errorType: 'permission_denied', ...P07_ATTACHMENT_ERROR_TAXONOMY.permission_denied };
  }
  if (errno === 'ENOENT' || errno === 'EIO') {
    return { errorType: 'processing_failed', ...P07_ATTACHMENT_ERROR_TAXONOMY.processing_failed };
  }
  if (
    errno === 'ETIMEDOUT' ||
    errno === 'ECONNRESET' ||
    errno === 'ECONNABORTED' ||
    error.message.toLowerCase().includes('timeout') ||
    error.message.toLowerCase().includes('network')
  ) {
    return { errorType: 'network_timeout', ...P07_ATTACHMENT_ERROR_TAXONOMY.network_timeout };
  }

  return { errorType: 'unknown', ...P07_ATTACHMENT_ERROR_TAXONOMY.unknown };
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
    throw new AttachmentLifecycleError({
      status: 400,
      code: 'NOTEBOOK_ATTACHMENT_SIZE_LIMIT',
      message: 'Attachment exceeds maximum size of 25MB',
      errorType: 'size_limit',
      retryable: false,
      userMessage: P07_ATTACHMENT_ERROR_TAXONOMY.size_limit.userMessage,
    });
  }
  const extension = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(extension)) {
    throw new AttachmentLifecycleError({
      status: 400,
      code: 'NOTEBOOK_ATTACHMENT_TYPE_BLOCKED',
      message: `Attachment type not allowed: ${extension}`,
      errorType: 'type_unsupported',
      retryable: false,
      userMessage: P07_ATTACHMENT_ERROR_TAXONOMY.type_unsupported.userMessage,
    });
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
  const fileDescriptor = {
    originalname: params.fileOriginalname,
    mimetype: params.fileMimetype,
    size: params.fileBuffer.byteLength,
  };

  const attachmentId = uuidv4();
  const record: NotebookAttachmentRecord = {
    id: attachmentId,
    name: params.fileOriginalname,
    type: params.fileMimetype || 'application/octet-stream',
    size: params.fileBuffer.byteLength,
    uploadedAt: new Date().toISOString(),
    uploadedBy: params.userId,
    status: 'queued',
  };

  try {
    validateNotebookAttachment(fileDescriptor);
  } catch (error) {
    record.status = 'blocked_policy';
    throw error;
  }

  record.status = 'uploading';

  const orgDir = path.join(NOTEBOOK_ATTACHMENT_UPLOAD_DIR, params.organizationId, params.pageId);
  await fs.mkdir(orgDir, { recursive: true });

  const storageKey = path.join(
    params.organizationId,
    params.pageId,
    `${attachmentId}-${sanitizeFilename(params.fileOriginalname)}`
  );
  const absolutePath = path.join(NOTEBOOK_ATTACHMENT_UPLOAD_DIR, storageKey);

  try {
    await fs.writeFile(absolutePath, params.fileBuffer);
  } catch (writeError) {
    record.status = 'failed';
    const classified = classifyAttachmentError(
      writeError instanceof Error ? writeError : new Error(String(writeError)),
      fileDescriptor
    );
    throw new AttachmentLifecycleError({
      status: 500,
      code: 'NOTEBOOK_ATTACHMENT_WRITE_FAILED',
      message: classified.userMessage,
      ...classified,
    });
  }

  record.status = 'available';
  record.storageKey = storageKey;

  return record;
}

export async function addNotebookAttachmentsToPage(params: {
  organizationId: string;
  pageId: string;
  files: Array<{
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }>;
  userId?: string;
}): Promise<NotebookAttachmentRecord[]> {
  const uploaded: NotebookAttachmentRecord[] = [];

  try {
    for (const file of params.files) {
      let lastLifecycleError: AttachmentLifecycleError | undefined;

      for (
        let retryAttempt = 0;
        retryAttempt < NOTEBOOK_ATTACHMENT_MUTATION_MAX_RETRIES;
        retryAttempt += 1
      ) {
        try {
          const attachment = await persistNotebookAttachment({
            organizationId: params.organizationId,
            pageId: params.pageId,
            fileBuffer: file.buffer,
            fileOriginalname: file.originalname,
            fileMimetype: file.mimetype,
            userId: params.userId,
          });
          uploaded.push(attachment);
          lastLifecycleError = undefined;
          break;
        } catch (error) {
          if (error instanceof AttachmentLifecycleError && error.retryable) {
            lastLifecycleError = error;
            continue;
          }
          if (error instanceof AttachmentLifecycleError) {
            throw error;
          }
          const classified = classifyAttachmentError(
            error instanceof Error ? error : new Error(String(error)),
            { ...file, size: file.buffer.length }
          );
          throw new AttachmentLifecycleError({
            status: 500,
            code: 'NOTEBOOK_ATTACHMENT_PERSIST_FAILED',
            message: classified.userMessage,
            ...classified,
          });
        }
      }

      if (lastLifecycleError) throw lastLifecycleError;
    }

    for (let attempt = 0; attempt < NOTEBOOK_ATTACHMENT_MUTATION_MAX_RETRIES; attempt += 1) {
      const currentAttachments = await loadPageAttachments(params.pageId);
      if (currentAttachments.length + uploaded.length > 10) {
        throw new NotebookAttachmentMutationError(
          400,
          'NOTEBOOK_ATTACHMENT_LIMIT_EXCEEDED',
          'Attachment limit exceeded'
        );
      }

      const nextAttachments = [...currentAttachments, ...uploaded];
      if (await compareAndSwapPageAttachments(params.pageId, currentAttachments, nextAttachments)) {
        return nextAttachments;
      }
    }

    throw new NotebookAttachmentMutationError(
      409,
      'NOTEBOOK_ATTACHMENT_WRITE_CONFLICT',
      'Attachment upload conflicted with another notebook update'
    );
  } catch (error) {
    await cleanupStoredAttachments(uploaded);
    throw error;
  }
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
  const filePath = resolveAttachmentAbsolutePath(match.storageKey);
  if (!filePath) return null;
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
  if (target) {
    await cleanupStoredAttachment(target);
  }
  return attachments.filter((attachment) => attachment.id !== attachmentId);
}

export async function removeNotebookAttachmentFromPage(params: {
  pageId: string;
  attachmentId: string;
}): Promise<NotebookAttachmentRecord[]> {
  for (let attempt = 0; attempt < NOTEBOOK_ATTACHMENT_MUTATION_MAX_RETRIES; attempt += 1) {
    const currentAttachments = await loadPageAttachments(params.pageId);
    const target = currentAttachments.find((attachment) => attachment.id === params.attachmentId);
    if (!target) {
      throw new NotebookAttachmentMutationError(
        404,
        'NOTEBOOK_ATTACHMENT_NOT_FOUND',
        'Attachment not found'
      );
    }

    const remainingAttachments = currentAttachments.filter(
      (attachment) => attachment.id !== params.attachmentId
    );
    const stagedDeletion = await stageAttachmentDeletion(target);

    try {
      if (
        await compareAndSwapPageAttachments(params.pageId, currentAttachments, remainingAttachments)
      ) {
        await stagedDeletion.finalize();
        return remainingAttachments;
      }
    } catch (error) {
      await stagedDeletion.restore();
      throw error;
    }

    await stagedDeletion.restore();
  }

  throw new NotebookAttachmentMutationError(
    409,
    'NOTEBOOK_ATTACHMENT_WRITE_CONFLICT',
    'Attachment delete conflicted with another notebook update'
  );
}
