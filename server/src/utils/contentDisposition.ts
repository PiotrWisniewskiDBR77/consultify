function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Builds an RFC 6266/RFC 5987 attachment header that is safe for Node's
 * latin1-only response headers while preserving the original UTF-8 title for
 * capable clients.
 */
export function buildAttachmentContentDisposition(
  title: unknown,
  extension: string,
  fallbackTitle = 'report'
): string {
  const normalizedExtension = String(extension || '')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase();
  if (!normalizedExtension) {
    throw new Error('ATTACHMENT_EXTENSION_REQUIRED');
  }

  const titleWithoutControlCharacters = Array.from(String(title || ''))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? ' ' : character;
    })
    .join('');
  const unicodeTitle =
    titleWithoutControlCharacters.replace(/[\\/]/g, '_').replace(/\s+/g, ' ').trim() ||
    fallbackTitle;
  const asciiTitle =
    unicodeTitle
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/["\\/;]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160) || fallbackTitle;
  const unicodeFileName = `${unicodeTitle}.${normalizedExtension}`;

  return `attachment; filename="${asciiTitle}.${normalizedExtension}"; filename*=UTF-8''${encodeRfc5987Value(unicodeFileName)}`;
}
