/**
 * Z139 (data-integrity) — full-scope regression test.
 *
 * Proves the GLOBAL sanitizer (security.utils.ts `sanitizeString`/`sanitizeObject`,
 * run by `inputSanitizationMiddleware` on every request body/query/param string,
 * for EVERY module — not just Notebook/WorkCanvas) no longer compounds escaping
 * across repeated saves.
 *
 * Scenario this reproduces: a title/description field is saved once (sanitizer
 * escapes it), the client echoes the now-escaped value back verbatim on the next
 * PATCH/save (e.g. an edit form that doesn't decode on load), and the sanitizer
 * used to escape it AGAIN — compounding without bound on every edit cycle.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeObject } from '../../server/src/utils/security.utils';

describe('Z139 — sanitizeString/sanitizeObject idempotency (full scope, not just rich-text)', () => {
  const title = 'R&D Report <Draft> "Q3" \'26';

  it('single save: escapes exactly once (unchanged behavior for fresh input)', () => {
    const saved = sanitizeString(title);
    expect(saved).toBe('R&amp;D Report &lt;Draft&gt; &quot;Q3&quot; &#x27;26');
  });

  it('re-save of an already-escaped value (simulating an edit form round-trip) does NOT compound', () => {
    const savedOnce = sanitizeString(title);
    const savedTwice = sanitizeString(savedOnce);
    const savedThrice = sanitizeString(savedTwice);

    // All converge to the SAME single-escaped canonical form — no growth.
    expect(savedTwice).toBe(savedOnce);
    expect(savedThrice).toBe(savedOnce);
    expect(savedOnce).not.toContain('&amp;amp;');
  });

  it('heals data that is ALREADY double/triple-escaped in the DB on the next save', () => {
    const doubleEscaped = 'R&amp;amp;D Report &amp;lt;Draft&amp;gt;';
    const tripleEscaped = 'R&amp;amp;amp;D Report &amp;amp;lt;Draft&amp;amp;gt;';

    expect(sanitizeString(doubleEscaped)).toBe('R&amp;D Report &lt;Draft&gt;');
    expect(sanitizeString(tripleEscaped)).toBe('R&amp;D Report &lt;Draft&gt;');
  });

  it('still neutralizes a genuine XSS payload on first save (security unchanged)', () => {
    const payload = '<script>alert(1)</script>';
    const sanitized = sanitizeString(payload);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
  });

  it('re-saving an escaped XSS payload still yields a safe, non-compounding, single-escaped string', () => {
    const payload = '<script>alert(1)</script>';
    const savedOnce = sanitizeString(payload);
    const savedTwice = sanitizeString(savedOnce);
    expect(savedTwice).toBe(savedOnce);
    expect(savedTwice).not.toContain('<script>');
    expect(savedTwice).not.toContain('&amp;lt;script&amp;gt;'); // would indicate compounding
  });

  it('sanitizeObject applies the idempotency guard across nested title/description fields (generic module shape)', () => {
    const record = {
      title: 'AT&T Initiative',
      description: 'Q3 <Plan> "final"',
      raid: { risk: 'Cost > Budget & <urgent>' },
    };

    const afterFirstSave = sanitizeObject(record);
    const afterSecondSave = sanitizeObject(afterFirstSave);

    expect(afterSecondSave).toEqual(afterFirstSave);
    expect((afterSecondSave as typeof record).title).not.toContain('&amp;amp;');
    expect((afterSecondSave as typeof record).raid.risk).not.toContain('&amp;amp;');
  });

  it('plain text without entities is unaffected (no false-positive decoding)', () => {
    expect(sanitizeString('Quarterly Results 2026')).toBe('Quarterly Results 2026');
    expect(sanitizeString('100% growth')).toBe('100% growth');
  });
});
