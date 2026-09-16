import { describe, expect, it } from 'vitest';

import { safeSimpleMarkdown } from '../../src/utils/safeSimpleMarkdown';

function renderMarkdown(markdown: string): HTMLDivElement {
  const container = document.createElement('div');
  container.innerHTML = safeSimpleMarkdown(markdown);
  return container;
}

describe('safeSimpleMarkdown URL and attribute policy', () => {
  it('removes an injected event handler while retaining the safe URL', () => {
    const container = renderMarkdown('[x](https://safe.test/" onmouseover="alert(1))');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://safe.test/');
    expect(link?.hasAttribute('onmouseover')).toBe(false);
  });

  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)'])(
    'rejects executable link protocol %s',
    (url) => {
      const container = renderMarkdown(`[x](${url})`);
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      expect(link?.hasAttribute('href')).toBe(false);
    }
  );

  it('retains an ordinary HTTPS link', () => {
    const container = renderMarkdown('[docs](https://safe.test/docs)');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://safe.test/docs');
  });
});
