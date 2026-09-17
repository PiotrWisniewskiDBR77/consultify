export const SUPPORTED_CHAT_ATTACHMENT_EXTENSIONS = [
  'pdf',
  'txt',
  'md',
  'json',
  'csv',
  'docx',
] as const;

export const SUPPORTED_CHAT_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const;

export const SUPPORTED_CHAT_ATTACHMENT_ACCEPT = SUPPORTED_CHAT_ATTACHMENT_EXTENSIONS.map(
  (ext) => `.${ext}`
).join(',');

export const SUPPORTED_CHAT_IMAGE_ACCEPT = SUPPORTED_CHAT_IMAGE_EXTENSIONS.map(
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
export const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;

export type ChatAttachmentKind = 'document' | 'image';

export type ChatImagePayload = {
  name: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  dataUrl: string;
  width: number;
  height: number;
  size: number;
};

const CHAT_IMAGE_MIME_TYPES = new Set<ChatImagePayload['mimeType']>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Treat persisted message metadata as untrusted input. In particular, never
 * hand an arbitrary data URL to an <img> or the model adapter after reload.
 */
export function normalizeChatImagePayload(value: unknown): ChatImagePayload | null {
  if (!isRecord(value)) return null;

  const mimeType = String(value.mimeType || '')
    .trim()
    .toLowerCase();
  if (!CHAT_IMAGE_MIME_TYPES.has(mimeType as ChatImagePayload['mimeType'])) return null;

  const dataUrl = String(value.dataUrl || '').trim();
  if (!dataUrl.startsWith(`data:${mimeType};base64,`)) return null;

  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;

  const name = String(value.name || '').trim();
  const width = Number(value.width);
  const height = Number(value.height);
  const size = Number(value.size);
  const estimatedDecodedBytes =
    Math.floor((encoded.length * 3) / 4) -
    (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  if (
    !name ||
    name.length > 255 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(size) ||
    width <= 0 ||
    height <= 0 ||
    width > 16384 ||
    height > 16384 ||
    size <= 0 ||
    size > MAX_CHAT_IMAGE_BYTES ||
    estimatedDecodedBytes <= 0 ||
    estimatedDecodedBytes > MAX_CHAT_IMAGE_BYTES
  ) {
    return null;
  }

  return {
    name,
    mimeType: mimeType as ChatImagePayload['mimeType'],
    dataUrl,
    width,
    height,
    size,
  };
}

/** Latest valid image remains scoped to the messages of this conversation. */
export function getLatestConversationChatImage(
  messages: ReadonlyArray<{ role?: unknown; metadata?: unknown }>
): ChatImagePayload | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role !== 'user') continue;
    const metadata = messages[index]?.metadata;
    if (!isRecord(metadata) || !Array.isArray(metadata.images)) continue;
    for (const candidate of metadata.images) {
      const image = normalizeChatImagePayload(candidate);
      if (image) return image;
    }
  }
  return null;
}

/** Build-time, fail-closed feature gate. Missing/empty/anything but `true` is OFF. */
export function isChatImagesEnabled(
  env: Record<string, string | undefined> = import.meta.env as unknown as Record<
    string,
    string | undefined
  >
): boolean {
  return env.VITE_CHAT_IMAGES === 'true';
}

export function getSupportedChatAttachmentAccept(imagesEnabled = isChatImagesEnabled()): string {
  return imagesEnabled
    ? `${SUPPORTED_CHAT_ATTACHMENT_ACCEPT},${SUPPORTED_CHAT_IMAGE_ACCEPT}`
    : SUPPORTED_CHAT_ATTACHMENT_ACCEPT;
}

type AttachmentLike = {
  name?: string | null;
  type?: string | null;
  mimeType?: string | null;
  isFolder?: boolean | null;
};

export function isImageChatAttachment(file: AttachmentLike): boolean {
  const mimeType = String(file?.type || file?.mimeType || '')
    .trim()
    .toLowerCase();
  const extension = String(file?.name || '')
    .split('.')
    .pop()
    ?.trim()
    .toLowerCase();
  return (
    mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension || '')
  );
}

export function isSupportedChatImage(file: AttachmentLike): boolean {
  if (file?.isFolder) return false;

  const mimeType = String(file?.type || file?.mimeType || '')
    .trim()
    .toLowerCase();
  const extension = String(file?.name || '')
    .split('.')
    .pop()
    ?.trim()
    .toLowerCase();

  if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mimeType)) return true;
  return SUPPORTED_CHAT_IMAGE_EXTENSIONS.includes(
    (extension || '') as (typeof SUPPORTED_CHAT_IMAGE_EXTENSIONS)[number]
  );
}

export function getChatAttachmentKind(
  file: AttachmentLike,
  imagesEnabled = isChatImagesEnabled()
): ChatAttachmentKind | null {
  if (imagesEnabled && isSupportedChatImage(file)) return 'image';
  if (isSupportedChatDocument(file)) return 'document';
  return null;
}

function isSupportedChatDocument(file: AttachmentLike): boolean {
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

export function isSupportedChatAttachment(
  file: AttachmentLike,
  imagesEnabled = isChatImagesEnabled()
): boolean {
  return getChatAttachmentKind(file, imagesEnabled) !== null;
}

/** Size half of the matrix check — see MAX_CHAT_ATTACHMENT_BYTES. */
export function isChatAttachmentSizeOk(file: { size?: number | null }): boolean {
  const size = Number(file?.size);
  if (!Number.isFinite(size) || size <= 0) return true; // unknown size (e.g. folders) — not a size rejection
  return size <= MAX_CHAT_ATTACHMENT_BYTES;
}

export function isChatImageSizeOk(file: { size?: number | null }): boolean {
  const size = Number(file?.size);
  if (!Number.isFinite(size) || size <= 0) return true;
  return size <= MAX_CHAT_IMAGE_BYTES;
}

/**
 * Single entry point for the composer's pre-upload matrix check — returns the
 * honest rejection reason (never a generic catch-all), or null when the file
 * is within the documented format/size matrix. Format is checked before size
 * so an unsupported binary that also happens to be huge reports the more
 * actionable reason first.
 */
export function getChatAttachmentRejectionReason(
  file: AttachmentLike & { size?: number | null },
  imagesEnabled = isChatImagesEnabled()
): 'UNSUPPORTED_FORMAT' | 'SIZE_LIMIT_EXCEEDED' | 'IMAGE_SIZE_LIMIT_EXCEEDED' | null {
  const kind = getChatAttachmentKind(file, imagesEnabled);
  if (!kind) return 'UNSUPPORTED_FORMAT';
  if (kind === 'image' && !isChatImageSizeOk(file)) return 'IMAGE_SIZE_LIMIT_EXCEEDED';
  if (kind === 'document' && !isChatAttachmentSizeOk(file)) return 'SIZE_LIMIT_EXCEEDED';
  return null;
}
