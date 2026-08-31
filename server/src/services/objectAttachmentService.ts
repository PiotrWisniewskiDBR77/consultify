import crypto from 'crypto';
import path from 'path';

import * as queryHelpers from '../utils/queryHelpers.js';
import { getStorage } from './storage/index.js';

export type AttachmentObjectType = 'task' | 'decision';

export interface ObjectAttachment {
  id: string;
  objectType: AttachmentObjectType;
  objectId: string;
  organizationId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  createdBy: string | null;
  createdAt: string;
}

export interface UploadedObjectAttachment {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export class ObjectAttachmentError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set<AttachmentObjectType>(['task', 'decision']);

const selectFields = `
  id,
  object_type as "objectType",
  object_id as "objectId",
  organization_id as "organizationId",
  file_name as "fileName",
  mime_type as "mimeType",
  size_bytes as "sizeBytes",
  storage_key as "storageKey",
  created_by as "createdBy",
  created_at as "createdAt"`;

function safeFilename(name: string): string {
  const normalized = path
    .basename(name)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 200);
  return normalized || 'attachment';
}

function storageKey(input: {
  organizationId: string;
  objectType: AttachmentObjectType;
  objectId: string;
  fileName: string;
}): string {
  const safeOrg = input.organizationId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeObjectId = input.objectId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `object-attachments/${safeOrg}/${input.objectType}/${safeObjectId}/${crypto.randomUUID()}-${safeFilename(input.fileName)}`;
}

export function parseObjectType(value: unknown): AttachmentObjectType {
  const normalized = String(value || '').toLowerCase() as AttachmentObjectType;
  if (!ALLOWED_TYPES.has(normalized)) {
    throw new ObjectAttachmentError(400, 'OBJECT_ATTACHMENT_TYPE_INVALID', 'Invalid object type');
  }
  return normalized;
}

async function requireObjectAccess(input: {
  objectType: AttachmentObjectType;
  objectId: string;
  organizationId: string;
  userId: string;
}): Promise<void> {
  const table = input.objectType === 'task' ? 'tasks' : 'decisions';
  const participantColumns =
    input.objectType === 'task'
      ? 'assignee_id as "participantOne", reporter_id as "participantTwo"'
      : 'decision_maker_id as "participantOne", created_by as "participantTwo"';
  const row = await queryHelpers.queryOne<{
    organizationId: string;
    participantOne: string | null;
    participantTwo: string | null;
  }>(
    `SELECT organization_id as "organizationId", ${participantColumns}
       FROM ${table}
      WHERE id = ?
      LIMIT 1`,
    [input.objectId]
  );

  if (!row || String(row.organizationId) !== input.organizationId) {
    throw new ObjectAttachmentError(404, 'OBJECT_ATTACHMENT_OBJECT_NOT_FOUND', 'Object not found');
  }
  if (![row.participantOne, row.participantTwo].some((id) => String(id || '') === input.userId)) {
    throw new ObjectAttachmentError(403, 'OBJECT_ATTACHMENT_FORBIDDEN', 'Forbidden');
  }
}

export async function listObjectAttachments(input: {
  objectType: AttachmentObjectType;
  objectId: string;
  organizationId: string;
  userId: string;
}): Promise<ObjectAttachment[]> {
  await requireObjectAccess(input);
  return queryHelpers.queryAll<ObjectAttachment>(
    `SELECT ${selectFields}
       FROM object_attachments
      WHERE object_type = ? AND object_id = ? AND organization_id = ?
      ORDER BY created_at ASC`,
    [input.objectType, input.objectId, input.organizationId]
  );
}

export async function addObjectAttachment(
  input: {
    objectType: AttachmentObjectType;
    objectId: string;
    organizationId: string;
    userId: string;
  },
  file: UploadedObjectAttachment
): Promise<ObjectAttachment> {
  await requireObjectAccess(input);
  if (!file.buffer?.length || file.size <= 0) {
    throw new ObjectAttachmentError(400, 'OBJECT_ATTACHMENT_FILE_REQUIRED', 'File required');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new ObjectAttachmentError(413, 'OBJECT_ATTACHMENT_TOO_LARGE', 'File too large');
  }

  const key = storageKey({ ...input, fileName: file.originalname });
  const storage = getStorage();
  await storage.putObject({ key, body: file.buffer, contentType: file.mimetype });
  try {
    const inserted = await queryHelpers.queryOne<ObjectAttachment>(
      `INSERT INTO object_attachments
        (object_type, object_id, organization_id, file_name, mime_type, size_bytes, storage_key, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING ${selectFields}`,
      [
        input.objectType,
        input.objectId,
        input.organizationId,
        safeFilename(file.originalname),
        file.mimetype || 'application/octet-stream',
        file.size,
        key,
        input.userId,
      ]
    );
    if (!inserted) throw new Error('Attachment insert returned no row');
    return inserted;
  } catch (error) {
    await storage.delete(key);
    throw error;
  }
}

export async function getObjectAttachment(input: {
  objectType: AttachmentObjectType;
  objectId: string;
  attachmentId: string;
  organizationId: string;
  userId: string;
}): Promise<{
  attachment: ObjectAttachment;
  object: Awaited<ReturnType<ReturnType<typeof getStorage>['getObject']>>;
}> {
  await requireObjectAccess(input);
  const attachment = await queryHelpers.queryOne<ObjectAttachment>(
    `SELECT ${selectFields}
       FROM object_attachments
      WHERE id = ? AND object_type = ? AND object_id = ? AND organization_id = ?
      LIMIT 1`,
    [input.attachmentId, input.objectType, input.objectId, input.organizationId]
  );
  if (!attachment) {
    throw new ObjectAttachmentError(404, 'OBJECT_ATTACHMENT_NOT_FOUND', 'Attachment not found');
  }
  return { attachment, object: await getStorage().getObject(attachment.storageKey) };
}

export async function deleteObjectAttachment(input: {
  objectType: AttachmentObjectType;
  objectId: string;
  attachmentId: string;
  organizationId: string;
  userId: string;
}): Promise<void> {
  await requireObjectAccess(input);
  const attachment = await queryHelpers.queryOne<ObjectAttachment>(
    `SELECT ${selectFields}
       FROM object_attachments
      WHERE id = ? AND object_type = ? AND object_id = ? AND organization_id = ?
      LIMIT 1`,
    [input.attachmentId, input.objectType, input.objectId, input.organizationId]
  );
  if (!attachment) {
    throw new ObjectAttachmentError(404, 'OBJECT_ATTACHMENT_NOT_FOUND', 'Attachment not found');
  }
  await getStorage().delete(attachment.storageKey);
  await queryHelpers.queryRun(
    `DELETE FROM object_attachments
      WHERE id = ? AND object_type = ? AND object_id = ? AND organization_id = ?`,
    [input.attachmentId, input.objectType, input.objectId, input.organizationId]
  );
}
