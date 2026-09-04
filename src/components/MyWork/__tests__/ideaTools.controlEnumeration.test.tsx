// @vitest-environment node
import { createHash } from 'node:crypto';

import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const HARNESS_URL = process.env.DAY295_IDEA_HARNESS_URL;
const CONTROL_SELECTOR = 'button,[role="button"],[role="menuitem"],[role="tab"],[role="switch"]';

type Control = {
  name: string;
  role: string;
  expanded: string | null;
  hasPopup: string | null;
  disabled: boolean;
  domIndex: number;
};

const contract = {
  'whiteboard-canvas': { minimumBase: 45, unique: 53, menus: 2, sha256: '2a9ac97c55648a317162de79449f6389bca63066b34cface80ecd46a878740fd' },
  'mindmap-canvas': { minimumBase: 57, unique: 65, menus: 2, sha256: 'dc89abd5e1aa49ad2e98d201e7eb5ecd36c57d8aace31dcaa6022656ce2a8b1d' },
  'processflow-canvas': { minimumBase: 63, unique: 81, menus: 3, sha256: 'dfdd6efae65f523fee1bf339b96d22313506839a880fe15c13e92530fe177335' },
  'idea-table': { minimumBase: 21, unique: 27, menus: 5, sha256: '3864b4540d732c2d21cce8c6e4bafa8e7036f6809c96a4aa57e52307a3f7f46a' },
} as const;

async function visibleControls(page: Page): Promise<Control[]> {
  return page.locator(CONTROL_SELECTOR).evaluateAll((elements) => elements
    .filter((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    })
    .map((element) => ({
      name: element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 140) || '',
      role: element.getAttribute('role') || element.tagName.toLowerCase(),
      expanded: element.getAttribute('aria-expanded'),
      hasPopup: element.getAttribute('aria-haspopup'),
      disabled: element.matches(':disabled,[aria-disabled="true"]'),
      domIndex: Array.from(document.querySelectorAll('button,[role="button"],[role="menuitem"],[role="tab"],[role="switch"]')).indexOf(element),
    })));
}

const STABLE_SAMPLE_COUNT = 5;
const STABLE_SAMPLE_INTERVAL_MS = 200;
const INITIAL_SHELL_MAX_CONTROLS = 1;

async function waitForStableControls(page: Page, minimumBase: number): Promise<Control[]> {
  let stableSamples = 0;
  let previousCount: number | undefined;

  await expect.poll(async () => {
    const count = (await visibleControls(page)).length;
    const passedReadinessFloor = count >= minimumBase && count > INITIAL_SHELL_MAX_CONTROLS;
    stableSamples = passedReadinessFloor && count === previousCount ? stableSamples + 1 : 1;
    previousCount = count;
    return passedReadinessFloor && stableSamples >= STABLE_SAMPLE_COUNT;
  }, {
    timeout: 30_000,
    interval: STABLE_SAMPLE_INTERVAL_MS,
    message: `control inventory did not stabilize for ${STABLE_SAMPLE_COUNT} consecutive samples`,
  }).toBe(true);

  return visibleControls(page);
}

describe.runIf(Boolean(HARNESS_URL))('Idea tools — complete DOM control inventory', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('idea-table-timeline-stuck: waits for a stable terminal control inventory', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${HARNESS_URL}/?screen=idea-table-timeline-stuck&lang=pl&theme=light&probeDelay=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    const base = await waitForStableControls(page, 1);
    console.info('DAY337_STABLE_PROBE', base.length);
    expect(base.every(({ name }) => name.length > 0)).toBe(true);
    await page.close();
  }, 60_000);

  for (const [screen, expected] of Object.entries(contract)) {
    it(`${screen}: accounts for the base and opened-menu passes`, async () => {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(`${HARNESS_URL}/?screen=${screen}&lang=pl&theme=light`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      const base = await waitForStableControls(page, expected.minimumBase);
      expect(base.every(({ name }) => name.length > 0)).toBe(true);
      const inventory = [...base];
      let openedMenus = 0;

      for (const trigger of base.filter(({ expanded, hasPopup, disabled }) => expanded === 'false' && hasPopup === 'menu' && !disabled)) {
        const locator = page.locator(CONTROL_SELECTOR).nth(trigger.domIndex);
        await locator.click({ timeout: 5_000 });
        const opened = await visibleControls(page);
        const baseSignatures = new Set(base.map(({ role, name }) => `${role}|${name}`));
        const additions = opened.filter(({ role, name }) => !baseSignatures.has(`${role}|${name}`));
        if (additions.length > 0) {
          openedMenus += 1;
          inventory.push(...additions);
        }
        await page.keyboard.press('Escape');
      }

      const signatures = [...new Set(inventory.map(({ role, name }) => `${role}|${name}`))].sort();
      const signatureHash = createHash('sha256').update(signatures.join('\n')).digest('hex');
      console.info('DAY295_CONTROL_INVENTORY', screen, signatures.length, signatureHash);
      expect(openedMenus).toBe(expected.menus);
      expect(signatures).toHaveLength(expected.unique);
      expect(signatureHash).toBe(expected.sha256);
      await page.close();
    }, 60_000);
  }
});

describe.skipIf(Boolean(HARNESS_URL))('Idea tools — complete DOM control inventory', () => {
  it('requires the owned visual harness instead of silently passing', () => {
    throw new Error('Set DAY295_IDEA_HARNESS_URL=http://127.0.0.1:5268 and run against the owned harness.');
  });
});
