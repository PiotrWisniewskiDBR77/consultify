import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities, deepDecodeHtmlEntities } from '../../server/src/utils/htmlEntities';

// Replica of server/src/utils/security.utils.ts `sanitizeString` — the escaping
// the global input-sanitization middleware applies to every request-body string.
const HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#96;',
};
const sanitize = (s: string) => s.replace(/[&<>"'`]/g, (c) => HTML[c]);

describe('decodeHtmlEntities (Z139 — reverse of input sanitizer)', () => {
  const orig = 'Date & Time <b> "x" `code` it\'s';

  it('reverses a single sanitizer pass exactly', () => {
    expect(decodeHtmlEntities(sanitize(orig))).toBe(orig);
  });

  it('heals N-times accumulated corruption (what is already in the DB)', () => {
    expect(decodeHtmlEntities(sanitize(sanitize(orig)))).toBe(orig);
    expect(decodeHtmlEntities(sanitize(sanitize(sanitize(orig))))).toBe(orig);
  });

  it('is idempotent on plain text', () => {
    expect(decodeHtmlEntities(orig)).toBe(orig);
    expect(decodeHtmlEntities('no entities here')).toBe('no entities here');
  });

  it('returns non-strings as empty string', () => {
    expect(decodeHtmlEntities(null)).toBe('');
    expect(decodeHtmlEntities(undefined)).toBe('');
    expect(decodeHtmlEntities(42 as unknown)).toBe('');
  });
});

describe('deepDecodeHtmlEntities (structured rich-text / TipTap doc)', () => {
  it('decodes string leaves and preserves structure', () => {
    const escaped = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: sanitize('A & B "q"') }] }],
    };
    const decoded = deepDecodeHtmlEntities(escaped);
    expect(decoded.type).toBe('doc');
    expect(decoded.content[0].content[0].text).toBe('A & B "q"');
  });

  it('decoded doc re-serializes to valid JSON even when text contains quotes', () => {
    const escaped = { text: sanitize('has "quotes" & <tags>') };
    const decoded = deepDecodeHtmlEntities(escaped);
    const roundTripped = JSON.parse(JSON.stringify(decoded));
    expect(roundTripped.text).toBe('has "quotes" & <tags>');
  });

  it('leaves non-string scalars untouched', () => {
    expect(deepDecodeHtmlEntities({ n: 5, b: true, z: null })).toEqual({ n: 5, b: true, z: null });
  });
});
