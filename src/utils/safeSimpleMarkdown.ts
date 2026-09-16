import DOMPurify from 'dompurify';

const MARKDOWN_TAGS = ['h1', 'h2', 'h3', 'strong', 'em', 'code', 'blockquote', 'li', 'ul', 'a', 'br'];
const MARKDOWN_ATTRIBUTES = ['href', 'target', 'rel'];

/**
 * Render the deliberately small markdown subset used by idea-node drawers.
 *
 * Text is escaped before markdown expansion, then the generated HTML is
 * sanitized for its final DOM context. The final pass is mandatory: markdown
 * link destinations become attribute values, so quote characters that are
 * valid user data must never be able to create a second HTML attribute.
 */
export function safeSimpleMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br/>');

  html = html.replace(
    /(<li>.*?<\/li>(?:<br\/>)?)+/g,
    (match) => `<ul>${match.replace(/<br\/>/g, '')}</ul>`
  );

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: MARKDOWN_TAGS,
    ALLOWED_ATTR: MARKDOWN_ATTRIBUTES,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
