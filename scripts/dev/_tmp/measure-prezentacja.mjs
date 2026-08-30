/* eslint-disable */
/**
 * Pomiar prawego panelu i płótna slajdu (tor grafika, 2026-08-30).
 * node scripts/dev/_tmp/measure-prezentacja.mjs "<url>"
 */
import { chromium } from 'playwright';

const url = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.route('**/*', (r) => {
  const u = r.request().url();
  return u.startsWith('http://127.0.0.1') ||
    u.startsWith('http://localhost') ||
    u.startsWith('data:') ||
    u.startsWith('blob:')
    ? r.continue()
    : r.abort();
});
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await p.waitForTimeout(3500);
const out = await p.evaluate(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const canvas = document.querySelector('[data-testid="mels-canvas"]');
  const slide = document.querySelector('[data-testid="deck-card-canvas"], .deck-card-canvas');
  return {
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    teresa: box('[data-testid="artifact-studio-global-teresa"]'),
    artifactRightPanel: box('[data-testid="artifact-studio-right-panel"]'),
    rightRail: box('[data-testid="mels-right-rail"]'),
    legacyRightRail: box('aside[data-testid*="right"]'),
    leftRail: box('[data-testid="mels-left-rail"]'),
    canvas: canvas
      ? {
          x: Math.round(canvas.getBoundingClientRect().x),
          w: Math.round(canvas.getBoundingClientRect().width),
        }
      : null,
    slide: slide
      ? {
          x: Math.round(slide.getBoundingClientRect().x),
          w: Math.round(slide.getBoundingClientRect().width),
        }
      : null,
    menu3: box('[data-testid="artifact-menu3"]'),
    menu3Buttons: [
      ...document.querySelectorAll('[data-testid="artifact-menu3"] button'),
    ].map((e) => e.textContent.trim()).filter(Boolean),
    asides: [...document.querySelectorAll('aside')].map((a) => ({
      testid: a.getAttribute('data-testid'),
      label: a.getAttribute('aria-label'),
      x: Math.round(a.getBoundingClientRect().x),
      w: Math.round(a.getBoundingClientRect().width),
    })),
  };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
