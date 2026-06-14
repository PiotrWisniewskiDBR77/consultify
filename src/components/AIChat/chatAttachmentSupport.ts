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
