#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

import { meanLuma } from './lib/meanLuma.mjs';

export const DEFAULT_ROW_SELECTOR = 'tbody tr';
export const DEFAULT_PREVIEW_SELECTOR = '[data-preview-pane]';
export const LIGHT_LUMA_MIN = 150;

export function classifyPreviewPositioning({ position, inset, zIndex }) {
  const positionedAsOverlay = position === 'fixed' || position === 'absolute';
  const fillsViewport = inset === '0px' || inset === '0px 0px 0px 0px';
  const highStack = Number.parseInt(zIndex, 10) >= 40;
  return positionedAsOverlay && (fillsViewport || highStack) ? 'overlay' : 'side-panel';
}

export function validateCaptureState({ mode, previewVisible }) {
  if (mode === 'before-click' && previewVisible) {
    throw new Error('Mutacja niewiarygodna: naiwny kadr zawiera podgląd przed kliknięciem.');
  }
  if (mode === 'after-click' && !previewVisible) {
    throw new Error('Brak podglądu po kliknięciu i oczekiwaniu na selektor wyniku.');
  }
  return true;
}

function option(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

async function inspectPreview(page, selector) {
  return page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      position: style.position,
      inset: style.inset,
      zIndex: style.zIndex,
    };
  });
}

async function shootTheme({ browser, baseUrl, screen, theme, outDir, rowSelector, previewSelector, mode }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost') || url.startsWith('data:') || url.startsWith('blob:')) {
      return route.continue();
    }
    return route.abort();
  });

  const url = `${baseUrl}/?screen=${encodeURIComponent(screen)}&lang=pl&theme=${theme}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.locator(rowSelector).first().waitFor({ state: 'visible', timeout: 20_000 });

  let previewVisible = await page.locator(previewSelector).first().isVisible().catch(() => false);
  let positioning = null;
  let classification = 'unknown';

  if (mode === 'after-click') {
    await page.locator(rowSelector).first().click();
    await page.locator(previewSelector).first().waitFor({ state: 'visible', timeout: 20_000 });
    previewVisible = true;
    positioning = await inspectPreview(page, previewSelector);
    classification = classifyPreviewPositioning(positioning);
  }

  validateCaptureState({ mode, previewVisible });
  const suffix = mode === 'after-click' ? 'po-kliknieciu' : 'przed-kliknieciem';
  const output = path.join(outDir, `${screen}-${suffix}-${theme}.png`);
  await page.screenshot({ path: output, fullPage: false });
  const luma = await meanLuma(output);
  if (theme === 'light' && luma <= LIGHT_LUMA_MIN) {
    throw new Error(`Bezpiecznik jasności: light luma ${luma.toFixed(1)} <= ${LIGHT_LUMA_MIN}.`);
  }

  await context.close();
  return { theme, output, luma, previewVisible, positioning, classification };
}

export async function run() {
  const outDir = option('out', '/private/tmp/cx-day243-podglad-artefakty');
  const screen = option('screen', 'drd-library-entry');
  const rowSelector = option('row', DEFAULT_ROW_SELECTOR);
  const previewSelector = option('preview', DEFAULT_PREVIEW_SELECTOR);
  const mode = option('mode', 'after-click');
  const baseLight = option('base-light', 'http://127.0.0.1:5198');
  const baseDark = option('base-dark', 'http://127.0.0.1:5199');
  if (!['before-click', 'after-click'].includes(mode)) throw new Error(`Nieznany tryb: ${mode}`);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const light = await shootTheme({ browser, baseUrl: baseLight, screen, theme: 'light', outDir, rowSelector, previewSelector, mode });
    const dark = await shootTheme({ browser, baseUrl: baseDark, screen, theme: 'dark', outDir, rowSelector, previewSelector, mode });
    const classification = light.classification === dark.classification ? light.classification : 'inconsistent';
    const captureCountRequired = classification === 'overlay' ? 4 : 2;
    const manifest = { mode, screen, classification, captureCountRequired, captures: [light, dark] };
    const manifestPath = path.join(outDir, `${screen}-${mode}-manifest.json`);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await run();
}
