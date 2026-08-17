import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  FOCUS_SETTLE_MS,
  measureActiveFocus,
} from '../../e2e/ui-canon-g4/_g4/sweep';

let browser: Awaited<ReturnType<typeof chromium.launch>>;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

describe('UI-G4 focus measurement', () => {
  it('waits through outline transitions instead of recording their 0px start', async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`
      <style>
        button { outline: 0 solid transparent; transition: all 150ms linear; }
        button:focus-visible { outline: 2px solid #5b8def; outline-offset: 2px; }
      </style>
      <button>Focus target</button>
    `);
    await page.keyboard.press('Tab');

    const immediate = await measureActiveFocus(page);
    await page.waitForTimeout(FOCUS_SETTLE_MS);
    const settled = await measureActiveFocus(page);

    expect(immediate?.visibleFocus).toBe(false);
    expect(settled).toMatchObject({ visibleFocus: true, onScreen: true, outlineWidth: '2px' });
    await page.close();
  });

  it('keeps true missing focus negative and preserves typing-editor exceptions', async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent(`
      <style>:focus-visible { outline: none !important; box-shadow: none !important; }</style>
      <button>Missing ring</button><textarea>Frozen editor exception</textarea>
    `);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(FOCUS_SETTLE_MS);
    expect(await measureActiveFocus(page)).toMatchObject({
      visibleFocus: false,
      onScreen: true,
      typingEditor: false,
    });

    await page.keyboard.press('Tab');
    await page.waitForTimeout(FOCUS_SETTLE_MS);
    expect(await measureActiveFocus(page)).toMatchObject({
      visibleFocus: true,
      onScreen: true,
      typingEditor: true,
    });
    await page.close();
  });
});
