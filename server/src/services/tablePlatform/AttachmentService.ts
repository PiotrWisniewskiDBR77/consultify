/**
 * Table Platform Attachment Service
 * Real file upload/download/delete routed through the provider-agnostic
 * storage seam ({@link getStorage} in services/storage). Default provider is
 * local disk (behavior-preserving); flipping STORAGE_PROVIDER=s3 moves these
 * uploads to durable S3/R2 storage with no code change here.
 */

import crypto from 'crypto';
import path from 'path';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import { getStorage } from '../../services/storage/index.js';
import logger from '../../utils/Logger.js';
import auditService from './AuditService.js';
import { NotFoundError, ValidationError } from './ErrorHandling.js';

/**
 * Seam key prefix. Historic `storage_key` values in `tp_attachments` are of the
 * form `<year>/<month>/<uuid>-name` and were resolved against
 * `uploads/attachments`. The storage seam is rooted at `uploads/`, so we map a
 * DB storage_key to its seam key by prepending `attachments/`. Existing rows
 * keep resolving unchanged (same on-disk path); DB values are untouched.
 */
const ATTACHMENT_KEY_PREFIX = 'attachments';
const toStorageKey = (dbKey: string): string => `${ATTACHMENT_KEY_PREFIX}/${dbKey}`;

const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10) * 1024 * 1024;
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50MB per file
const MAX_RECORD_ATTACHMENTS_SIZE = 200 * 1024 * 1024; // 200MB per record
const ATTACHMENT_SECRET = process.env.ATTACHMENT_SECRET || 'dev-secret';
const DOWNLOAD_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const ALLOWED_MIME_PATTERNS = [
  /^image\/.+/,
  /^application\/pdf$/,
  /^text\/csv$/,
  /^text\/plain$/,
  /^application\/json$/,
  /^application\/vnd\.openxmlformats-officedocument\..+/,
  /^application\/vnd\.ms-excel$/,
  /^application\/vnd\.ms-powerpoint$/,
  /^application\/msword$/,
];

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

export interface AttachmentMeta {
  id: string;
  record_id: string;
  field_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  thumbnails: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  download_url?: string;
}

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 200);
}

function generateStorageKey(originalname: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const uniqueId = crypto.randomUUID();
  const safeName = sanitizeFilename(originalname);
  return `${year}/${month}/${uniqueId}-${safeName}`;
}

// Directory pre-creation is now the storage adapter's responsibility
// (LocalDiskAdapter.putObject mkdirs recursively per key; S3/R2 has no dirs).
// Kept as a no-op so the public init() contract is preserved.
async function ensureUploadDir(): Promise<void> {
  return;
}

const attachmentService = {
  /**
   * Validate file before upload: size, MIME type, extension.
   */
  validateFile(file: UploadedFile): void {
    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(
        `File too large: ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new ValidationError(`File type not allowed: ${ext}`);
    }

    const mimeAllowed = ALLOWED_MIME_PATTERNS.some((pattern) => pattern.test(file.mimetype));
    if (!mimeAllowed) {
      throw new ValidationError(`MIME type not allowed: ${file.mimetype}`);
    }
  },

  /**
   * Validate total attachment size for a record before uploading a new file.
   */
  async validateAttachmentSize(recordId: string, newFileSize: number): Promise<void> {
    if (newFileSize > MAX_ATTACHMENT_SIZE) {
      throw new ValidationError(`File exceeds maximum size of 50MB`);
    }

    const db = getDatabase();
    const result = await db.query(
      'SELECT COALESCE(SUM(size_bytes), 0) as total FROM tp_attachments WHERE record_id = $1',
      [recordId]
    );
    const currentTotal = parseInt((result.rows[0] as { total: string }).total, 10);

    if (currentTotal + newFileSize > MAX_RECORD_ATTACHMENTS_SIZE) {
      throw new ValidationError(
        `Record attachments would exceed 200MB limit (current: ${Math.round(currentTotal / 1024 / 1024)}MB)`
      );
    }
  },

  /**
   * Generate a pre-signed download URL with HMAC token.
   */
  async getDownloadUrl(
    attachmentId: string,
    userId: string
  ): Promise<{ url: string; expiresAt: string }> {
    const attachment = await this.getAttachment(attachmentId);
    if (!attachment) {
      throw new NotFoundError('attachment', attachmentId);
    }

    const expiresAt = Date.now() + DOWNLOAD_TOKEN_TTL_MS;
    const payload = JSON.stringify({ attachmentId, userId, expiresAt });
    const payloadB64 = Buffer.from(payload).toString('base64url');
    const signature = crypto
      .createHmac('sha256', ATTACHMENT_SECRET)
      .update(payloadB64)
      .digest('base64url');
    const token = `${payloadB64}.${signature}`;

    return {
      url: `/api/table-platform/attachments/download/${token}`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  },

  /**
   * Verify an HMAC-signed download token. Returns payload if valid, null otherwise.
   */
  verifyDownloadToken(token: string): { attachmentId: string; userId: string } | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', ATTACHMENT_SECRET)
      .update(payloadB64)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
      if (!payload.attachmentId || !payload.userId || !payload.expiresAt) return null;
      if (Date.now() > payload.expiresAt) return null;
      return { attachmentId: payload.attachmentId, userId: payload.userId };
    } catch {
      return null;
    }
  },

  /**
   * Generate thumbnails for image attachments.
   * Uses sharp if available; otherwise stores placeholder paths for frontend fallback.
   */
  async generateThumbnail(attachmentId: string, sourceBuffer: Buffer, storageKey: string, mimeType: string): Promise<void> {
    if (!IMAGE_MIME_TYPES.has(mimeType)) return;

    const db = getDatabase();
    const ext = path.extname(storageKey);
    const base = storageKey.slice(0, -ext.length);
    const smallKey = `${base}_thumb_sm${ext}`;
    const largeKey = `${base}_thumb_lg${ext}`;

    const storage = getStorage();
    let smallPath = smallKey;
    let largePath = largeKey;
    try {
      const sharp = (await import('sharp')).default;

      const smallBuf = await (sharp(sourceBuffer).resize(100, 100, { fit: 'inside' }) as any).toBuffer();
      const largeBuf = await (sharp(sourceBuffer).resize(400, 400, { fit: 'inside' }) as any).toBuffer();

      await storage.putObject({ key: toStorageKey(smallKey), body: smallBuf, contentType: mimeType });
      await storage.putObject({ key: toStorageKey(largeKey), body: largeBuf, contentType: mimeType });
      // Persist resolvable URLs (works for both local and signed-S3 providers).
      smallPath = await storage.getUrl(toStorageKey(smallKey));
      largePath = await storage.getUrl(toStorageKey(largeKey));

      logger.info('[AttachmentService] Thumbnails generated', { attachmentId });
    } catch {
      logger.info('[AttachmentService] sharp unavailable, storing placeholder thumbnail paths', {
        attachmentId,
      });
    }

    await db.query(
      `UPDATE tp_attachments SET metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{thumbnails}',
        $2::jsonb
      ) WHERE id = $1`,
      [attachmentId, JSON.stringify({ small: smallPath, large: largePath })]
    );
  },

  /**
   * Upload a file to local storage and register in DB.
   */
  async uploadFile(
    recordId: string,
    fieldId: string,
    file: UploadedFile,
    userId?: string
  ): Promise<AttachmentMeta> {
    await ensureUploadDir();
    this.validateFile(file);
    await this.validateAttachmentSize(recordId, file.size);

    const db = getDatabase();
    const storage = getStorage();
    const id = uuidv4();
    const storageKey = generateStorageKey(file.originalname);

    try {
      await storage.putObject({
        key: toStorageKey(storageKey),
        body: file.buffer,
        contentType: file.mimetype,
      });
    } catch (err) {
      logger.error('[AttachmentService] Failed to write file to storage', {
        storageKey,
        error: (err as Error).message,
      });
      throw new Error(`Failed to store file: ${(err as Error).message}`);
    }

    try {
      await db.query(
        `INSERT INTO tp_attachments (id, record_id, field_id, file_name, mime_type, size_bytes, storage_key, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          recordId,
          fieldId,
          file.originalname,
          file.mimetype,
          file.size,
          storageKey,
          userId ?? null,
        ]
      );

      await this.appendAttachmentToRecord(recordId, fieldId, id);

      const row = (await db.query('SELECT * FROM tp_attachments WHERE id = $1', [id])).rows[0];
      await auditService.logEvent('create', 'attachment', id, userId, undefined, row, undefined);

      this.generateThumbnail(id, file.buffer, storageKey, file.mimetype).catch((err) => {
        logger.warn('[AttachmentService] Thumbnail generation failed', {
          attachmentId: id,
          error: (err as Error).message,
        });
      });

      return {
        ...(row as object),
        download_url: this.generateDownloadUrl(id),
      } as AttachmentMeta;
    } catch (err) {
      try {
        await storage.delete(toStorageKey(storageKey));
      } catch {
        /* best effort cleanup */
      }
      logger.error('[AttachmentService] Failed to register attachment in DB', {
        error: (err as Error).message,
      });
      throw err;
    }
  },

  /**
   * Download a file: returns a readable stream + metadata.
   */
  async downloadFile(
    attachmentId: string
  ): Promise<{ stream: Readable; filename: string; mimetype: string; size: number }> {
    const attachment = await this.getAttachment(attachmentId);
    if (!attachment) {
      throw new NotFoundError('attachment', attachmentId);
    }

    const storage = getStorage();
    let obj;
    try {
      obj = await storage.getObject(toStorageKey(attachment.storage_key));
    } catch (err) {
      logger.error('[AttachmentService] File missing from storage', {
        storageKey: attachment.storage_key,
        error: (err as Error).message,
      });
      throw new NotFoundError('attachment file', attachmentId);
    }

    return {
      stream: obj.stream,
      filename: attachment.file_name,
      mimetype: attachment.mime_type,
      size: Number(attachment.size_bytes),
    };
  },

  /**
   * Delete a file from disk and DB, and remove its ID from the record's data JSONB.
   */
  async deleteFile(attachmentId: string, deletedBy?: string): Promise<boolean> {
    const db = getDatabase();
    const before = (await db.query('SELECT * FROM tp_attachments WHERE id = $1', [attachmentId]))
      .rows[0] as { storage_key: string; record_id: string; field_id: string } | undefined;
    if (!before) return false;

    try {
      await getStorage().delete(toStorageKey(before.storage_key));
    } catch (err) {
      logger.warn('[AttachmentService] Could not delete file from storage', {
        storageKey: before.storage_key,
        error: (err as Error).message,
      });
    }

    await db.query('DELETE FROM tp_attachments WHERE id = $1', [attachmentId]);
    await this.removeAttachmentFromRecord(before.record_id, before.field_id, attachmentId);
    await auditService.logEvent(
      'delete',
      'attachment',
      attachmentId,
      deletedBy,
      before,
      undefined,
      undefined
    );
    return true;
  },

  /**
   * Legacy create (DB-only, no file). Kept for backward compatibility.
   */
  async createAttachment(
    recordId: string,
    fieldId: string,
    fileName: string,
    mimeType: string,
    sizeBytes: number,
    storageKey: string,
    uploadedBy?: string
  ): Promise<any> {
    const db = getDatabase();
    const id = uuidv4();
    try {
      await db.query(
        `INSERT INTO tp_attachments (id, record_id, field_id, file_name, mime_type, size_bytes, storage_key, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, recordId, fieldId, fileName, mimeType, sizeBytes, storageKey, uploadedBy ?? null]
      );
      const row = (await db.query('SELECT * FROM tp_attachments WHERE id = $1', [id])).rows[0];
      await auditService.logEvent(
        'create',
        'attachment',
        id,
        uploadedBy,
        undefined,
        row,
        undefined
      );
      return row ?? null;
    } catch (e) {
      logger.error('[AttachmentService] createAttachment failed', { error: (e as Error).message });
      throw e;
    }
  },

  async getAttachments(recordId: string, fieldId?: string): Promise<AttachmentMeta[]> {
    const db = getDatabase();
    try {
      let sql = 'SELECT * FROM tp_attachments WHERE record_id = $1';
      const params: unknown[] = [recordId];
      if (fieldId) {
        sql += ' AND field_id = $2';
        params.push(fieldId);
      }
      sql += ' ORDER BY created_at DESC';
      const result = await db.query(sql, params);
      return result.rows.map((row: any) => ({
        ...row,
        download_url: this.generateDownloadUrl(row.id),
      }));
    } catch (e) {
      logger.error('[AttachmentService] getAttachments failed', { error: (e as Error).message });
      throw e;
    }
  },

  async getAttachment(attachmentId: string): Promise<any> {
    const db = getDatabase();
    try {
      const result = await db.query('SELECT * FROM tp_attachments WHERE id = $1', [attachmentId]);
      return result.rows[0] ?? null;
    } catch (e) {
      logger.error('[AttachmentService] getAttachment failed', { error: (e as Error).message });
      throw e;
    }
  },

  async deleteAttachment(attachmentId: string, deletedBy?: string): Promise<boolean> {
    return this.deleteFile(attachmentId, deletedBy);
  },

  async listAttachmentsByTable(tableId: string, limit = 100, offset = 0): Promise<any[]> {
    const db = getDatabase();
    try {
      const result = await db.query(
        `SELECT a.* FROM tp_attachments a
         INNER JOIN tp_records r ON a.record_id = r.id
         WHERE r.table_id = $1
         ORDER BY a.created_at DESC
         LIMIT $2 OFFSET $3`,
        [tableId, limit, offset]
      );
      return result.rows.map((row: any) => ({
        ...row,
        download_url: this.generateDownloadUrl(row.id),
      }));
    } catch (e) {
      logger.error('[AttachmentService] listAttachmentsByTable failed', {
        error: (e as Error).message,
      });
      throw e;
    }
  },

  /**
   * Get enriched attachment metadata for a set of attachment IDs.
   * Used by RecordsService to inline metadata into record responses.
   */
  async getAttachmentsByIds(ids: string[]): Promise<AttachmentMeta[]> {
    if (!ids.length) return [];
    const db = getDatabase();
    try {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const result = await db.query(
        `SELECT * FROM tp_attachments WHERE id IN (${placeholders}) ORDER BY created_at DESC`,
        ids
      );
      return result.rows.map((row: any) => ({
        ...row,
        download_url: this.generateDownloadUrl(row.id),
      }));
    } catch (e) {
      logger.error('[AttachmentService] getAttachmentsByIds failed', {
        error: (e as Error).message,
      });
      throw e;
    }
  },

  generateDownloadUrl(attachmentId: string): string {
    return `/api/table-platform/attachments/${attachmentId}/download`;
  },

  /**
   * Append an attachment ID to the record's data JSONB for the given field.
   */
  async appendAttachmentToRecord(
    recordId: string,
    fieldId: string,
    attachmentId: string
  ): Promise<void> {
    const db = getDatabase();
    try {
      const result = await db.query('SELECT data FROM tp_records WHERE id = $1', [recordId]);
      const row = result.rows[0] as { data: Record<string, unknown> } | undefined;
      if (!row) return;
      const data: Record<string, unknown> = row.data ?? {};
      const current = Array.isArray(data[fieldId]) ? (data[fieldId] as string[]) : [];
      if (!current.includes(attachmentId)) {
        current.push(attachmentId);
      }
      data[fieldId] = current;
      await db.query('UPDATE tp_records SET data = $2, updated_at = NOW() WHERE id = $1', [
        recordId,
        JSON.stringify(data),
      ]);
    } catch (e) {
      logger.warn('[AttachmentService] appendAttachmentToRecord failed', {
        recordId,
        fieldId,
        error: (e as Error).message,
      });
    }
  },

  /**
   * Remove an attachment ID from the record's data JSONB for the given field.
   */
  async removeAttachmentFromRecord(
    recordId: string,
    fieldId: string,
    attachmentId: string
  ): Promise<void> {
    const db = getDatabase();
    try {
      const result = await db.query('SELECT data FROM tp_records WHERE id = $1', [recordId]);
      const row = result.rows[0] as { data: Record<string, unknown> } | undefined;
      if (!row) return;
      const data: Record<string, unknown> = row.data ?? {};
      const current = Array.isArray(data[fieldId]) ? (data[fieldId] as string[]) : [];
      const filtered = current.filter((id) => id !== attachmentId);
      data[fieldId] = filtered;
      await db.query('UPDATE tp_records SET data = $2, updated_at = NOW() WHERE id = $1', [
        recordId,
        JSON.stringify(data),
      ]);
    } catch (e) {
      logger.warn('[AttachmentService] removeAttachmentFromRecord failed', {
        recordId,
        fieldId,
        error: (e as Error).message,
      });
    }
  },

  /** Call at server startup to ensure the upload directory exists. */
  async init(): Promise<void> {
    await ensureUploadDir();
  },
};

export default attachmentService;
