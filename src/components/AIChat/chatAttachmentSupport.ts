export const SUPPORTED_CHAT_ATTACHMENT_EXTENSIONS = [
  'pdf',
  'txt',
  'md',
  'json',
  'csv',
  'docx',
] as const;

export const SUPPORTED_CHAT_ATTACHMENT_ACCEPT = SUPPORTED_CHAT_ATTACHMENT_EXTENSIONS.map(
  (ext) => `.${ext}`
).join(',');

export const SUPPORTED_CHAT_ATTACHMENT_LABEL = 'PDF, DOCX, TXT, MD, CSV, JSON';

// M01-P04A — size half of the format/size matrix (packet §3.3). Must match
// server/src/routes/ai.routes.ts's `attachmentsUpload` multer limit (25MB)
// exactly: this is a client-side PRE-check that saves a wasted upload
// round-trip and gives a specific "too large" message instead of a generic
// upload-error toast, not a substitute for the real server-side enforcement
// (ai.routes.ts multer + conversations.routes.ts resolveAttachmentStatus()).
export const MAX_CHAT_ATTACHMENT_BYTES = 25 * 1024 * 1024;

type AttachmentLike = {
  name?: string | null;
  type?: string | null;
  mimeType?: string | null;
  isFolder?: boolean | null;
};

export function isSupportedChatAttachment(file: AttachmentLike): boolean {
  if (file?.isFolder) return true;

  const mimeType = String(file?.type || file?.mimeType || '')
    .trim()
    .toLowerCase();
  const extension = String(file?.name || '')
    .split('.')
    .pop()
    ?.trim()
    .toLowerCase();

  if (mimeType === 'application/pdf') return true;
  if (mimeType === 'application/json') return true;
  if (mimeType === 'text/csv') return true;
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return true;
  if (mimeType.startsWith('text/')) return true;

  return SUPPORTED_CHAT_ATTACHMENT_EXTENSIONS.includes(
    (extension || '') as (typeof SUPPORTED_CHAT_ATTACHMENT_EXTENSIONS)[number]
  );
}

/** Size half of the matrix check — see MAX_CHAT_ATTACHMENT_BYTES. */
export function isChatAttachmentSizeOk(file: { size?: number | null }): boolean {
  const size = Number(file?.size);
  if (!Number.isFinite(size) || size <= 0) return true; // unknown size (e.g. folders) — not a size rejection
  return size <= MAX_CHAT_ATTACHMENT_BYTES;
}

/**
 * Single entry point for the composer's pre-upload matrix check — returns the
 * honest rejection reason (never a generic catch-all), or null when the file
 * is within the documented format/size matrix. Format is checked before size
 * so an unsupported binary that also happens to be huge reports the more
 * actionable reason first.
 */
export function getChatAttachmentRejectionReason(
  file: AttachmentLike & { size?: number | null }
): 'UNSUPPORTED_FORMAT' | 'SIZE_LIMIT_EXCEEDED' | null {
  if (!isSupportedChatAttachment(file)) return 'UNSUPPORTED_FORMAT';
  if (!isChatAttachmentSizeOk(file)) return 'SIZE_LIMIT_EXCEEDED';
  return null;
}
