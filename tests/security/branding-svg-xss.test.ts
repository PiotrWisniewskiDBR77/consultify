/**
 * M23 L-09 — Stored-XSS hardening for branding SVG logo uploads.
 *
 * Branding logos are served same-origin from /uploads/branding/* and can be
 * opened directly, so an uploaded SVG carrying <script>, on*-handlers,
 * <foreignObject>, javascript: URIs, or an external <use href> would execute
 * in our origin. The upload handler in
 * server/src/routes/organization/branding.routes.ts sanitizes SVG contents
 * with DOMPurify before persisting them.
 *
 * This test pins the DOMPurify configuration used by the route
 * (sanitizeSvgMarkup) and proves the dangerous vectors are neutralized.
 * If the route's config drifts, keep this in sync.
 */
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const purifyWindow = new JSDOM('').window;
const svgPurifier = createDOMPurify(purifyWindow as unknown as Parameters<typeof createDOMPurify>[0]);

// Mirrors sanitizeSvgMarkup() in branding.routes.ts
const sanitizeSvgMarkup = (raw: string): string =>
  svgPurifier.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'a', 'use', 'image'],
    FORBID_ATTR: ['xlink:href', 'href'],
  });

const SCRIPT_VECTOR =
  /<script|<\/script|on\w+\s*=|javascript:|<foreignObject|<iframe|data:text\/html/i;

describe('branding SVG sanitization (M23 L-09 stored XSS)', () => {
  it('strips an inline <script>alert(document.cookie)</script>', () => {
    const raw =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script><rect width="10" height="10"/></svg>';
    const clean = sanitizeSvgMarkup(raw);
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toContain('alert(document.cookie)');
    // benign content survives
    expect(clean).toContain('<rect');
  });

  it('removes on* event-handler attributes (onload/onclick)', () => {
    const raw =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect onclick="evil()" width="10" height="10"/></svg>';
    const clean = sanitizeSvgMarkup(raw);
    expect(clean).not.toMatch(/onload\s*=/i);
    expect(clean).not.toMatch(/onclick\s*=/i);
  });

  it('drops <foreignObject> (HTML/script smuggling)', () => {
    const raw =
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(2)</script></body></foreignObject></svg>';
    const clean = sanitizeSvgMarkup(raw);
    expect(clean).not.toMatch(/<foreignObject/i);
    expect(clean).not.toMatch(/<script/i);
  });

  it('strips javascript: URIs in links', () => {
    const raw =
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(3)"><text>x</text></a></svg>';
    const clean = sanitizeSvgMarkup(raw);
    expect(clean).not.toContain('javascript:');
  });

  it('removes external <use href> references', () => {
    const raw =
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/x.svg#a"/></svg>';
    const clean = sanitizeSvgMarkup(raw);
    expect(clean).not.toContain('evil.example');
  });

  it('leaves no script-execution vector across a combined payload', () => {
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" onload="x()">
      <script>fetch('/api/me').then(r=>r.text()).then(alert)</script>
      <foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>
      <a href="javascript:alert(2)"><text>click</text></a>
      <set attributeName="onload" to="alert(3)"/>
      <rect width="10" height="10"/>
    </svg>`;
    const clean = sanitizeSvgMarkup(raw);
    expect(clean).not.toMatch(SCRIPT_VECTOR);
    expect(clean).toContain('<rect');
  });
});
