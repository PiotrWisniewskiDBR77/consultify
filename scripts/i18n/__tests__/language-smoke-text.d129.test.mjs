/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';

import { collectLanguageSmokeText, countPolishDiacritics } from '../language-smoke-text.mjs';

afterEach(() => {
  document.body.replaceChildren();
});

describe('D-129 — polish-diacritics smoke excludes personal data fields', () => {
  it('excludes respondentName=Wisniewski while retaining a genuine Polish UI literal', () => {
    document.body.innerHTML = `
      <table>
        <thead><tr><th data-language-field="respondentName">Person</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Wisniewski</td><td>Zażółć gęślą jaźń</td></tr>
          <tr><td>Piotr Wiśniewski</td><td>Ready</td></tr>
        </tbody>
      </table>
    `;

    const text = collectLanguageSmokeText();

    expect(text).not.toContain('Wisniewski');
    expect(text).not.toContain('Wiśniewski');
    expect(text).toContain('Zażółć gęślą jaźń');
    expect(countPolishDiacritics(text)).toBe(9);
  });

  it('keeps an unmarked Polish literal even when it looks like ordinary screen text', () => {
    document.body.innerHTML = '<p>Proszę wybrać właściwą odpowiedź</p>';

    const text = collectLanguageSmokeText();

    expect(text).toContain('Proszę wybrać właściwą odpowiedź');
    expect(countPolishDiacritics(text)).toBeGreaterThan(0);
  });
});
