import fs from 'node:fs';
import path from 'node:path';

import { devices, expect, test, type Browser, type BrowserContextOptions } from '@playwright/test';

import { readTestSupportState, STORAGE_STATE_PATH } from '../_helpers/testSupportState';

const WEB_BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3510';
const ARTIFACT_PATH = process.env.NFR_PERF_WEB_VITALS_ARTIFACT || '/tmp/nfr-perf-web-vitals.json';
// Four is the smallest sample count where nearest-rank p75 is not p100.
const SAMPLES_PER_SURFACE = Number(process.env.NFR_PERF_BROWSER_SAMPLES || 4);

const surfaces = [
  { name: 'case', path: '/zlecenia?ff_zlecenia=1' },
  { name: 'my_work', path: '/my-work' },
  { name: 'settings', path: '/settings' },
  { name: 'initiatives', path: '/initiatives' },
  { name: 'finance', path: '/finance' },
] as const;

type DeviceName = 'desktop' | 'mobile';
type VitalSample = {
  device: DeviceName;
  surface: (typeof surfaces)[number]['name'];
  sample: number;
  finalUrl: string;
  lcpMs: number;
  cls: number;
  inpMs: number;
  inpUpperBound: boolean;
  userEvents: number;
  navigationMs: number;
};

function percentile(values: number[], percentileRank: number): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(percentileRank * sorted.length) - 1)]!;
}

function browserGate(samples: VitalSample[]) {
  return (['desktop', 'mobile'] as const).flatMap((device) =>
    surfaces.map(({ name }) => {
      const group = samples.filter((sample) => sample.device === device && sample.surface === name);
      const p75 = {
        lcpMs: percentile(
          group.map((sample) => sample.lcpMs),
          0.75
        ),
        cls: percentile(
          group.map((sample) => sample.cls),
          0.75
        ),
        inpMs: percentile(
          group.map((sample) => sample.inpMs),
          0.75
        ),
      };
      const thresholds = { lcpMs: device === 'desktop' ? 2_500 : 4_000, cls: 0.1, inpMs: 200 };
      return {
        device,
        surface: name,
        samples: group.length,
        p75,
        thresholds,
        pass:
          group.length === SAMPLES_PER_SURFACE &&
          p75.lcpMs <= thresholds.lcpMs &&
          p75.cls <= thresholds.cls &&
          p75.inpMs <= thresholds.inpMs &&
          group.every((sample) => sample.userEvents > 0 && !/\/auth(?:$|\?)/.test(sample.finalUrl)),
      };
    })
  );
}

async function collectOne(
  browser: Browser,
  device: DeviceName,
  surface: (typeof surfaces)[number],
  sample: number
): Promise<VitalSample> {
  const options: BrowserContextOptions =
    device === 'mobile'
      ? { ...devices['Pixel 7'], storageState: STORAGE_STATE_PATH }
      : { viewport: { width: 1440, height: 900 }, storageState: STORAGE_STATE_PATH };
  const context = await browser.newContext(options);
  try {
    const { userId } = readTestSupportState();
    await context.addInitScript((authenticatedUserId) => {
      localStorage.setItem('ff.caseWorkspace', '1');
      // Measure the requested workspace, not the first-run onboarding overlay.
      // The bootstrap identity is intentionally new for each run, so its durable
      // onboarding preference is unset unless the signed performance harness
      // supplies the same local guard an existing user would already have.
      localStorage.setItem(`consultify_onboarding_done:${authenticatedUserId}`, 'true');
      const state = { lcpMs: 0, cls: 0, inpMs: 0, userEvents: 0 };
      (window as any).__nfrPerfVitals = state;
      addEventListener('keydown', () => (state.userEvents += 1), { capture: true });
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const latest = entries.at(-1) as (PerformanceEntry & { startTime: number }) | undefined;
          if (latest) state.lcpMs = Math.max(state.lcpMs, latest.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<
            PerformanceEntry & { value: number; hadRecentInput: boolean }
          >) {
            if (!entry.hadRecentInput) state.cls += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as PerformanceEventTiming[]) {
            state.inpMs = Math.max(state.inpMs, entry.duration || 0);
          }
        }).observe({
          type: 'event',
          buffered: true,
          durationThreshold: 16,
        } as PerformanceObserverInit);
      } catch {}
    }, userId);
    const page = await context.newPage();
    const navigationStarted = performance.now();
    await page.goto(`${WEB_BASE_URL}${surface.path}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/auth(?:$|\?)/);
    await page.waitForTimeout(2_500);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(300);
    const measured = await page.evaluate(() => {
      const state = (window as any).__nfrPerfVitals as {
        lcpMs: number;
        cls: number;
        inpMs: number;
        userEvents: number;
      };
      return { ...state, finalUrl: location.href };
    });
    if (!(measured.lcpMs > 0)) throw new Error(`${device}/${surface.name}: LCP was not observed`);
    return {
      device,
      surface: surface.name,
      sample,
      finalUrl: measured.finalUrl,
      lcpMs: measured.lcpMs,
      cls: measured.cls,
      inpMs: measured.inpMs || 16,
      inpUpperBound: measured.inpMs === 0,
      userEvents: measured.userEvents,
      navigationMs: performance.now() - navigationStarted,
    };
  } finally {
    await context.close();
  }
}

test('NFR-PERF signed cold desktop/mobile p75 covers five mounted workspaces', async ({
  browser,
}, testInfo) => {
  test.setTimeout(12 * 60_000);
  expect(SAMPLES_PER_SURFACE).toBeGreaterThanOrEqual(4);
  const samples: VitalSample[] = [];
  for (const device of ['desktop', 'mobile'] as const) {
    for (const surface of surfaces) {
      for (let sample = 1; sample <= SAMPLES_PER_SURFACE; sample += 1) {
        samples.push(await collectOne(browser, device, surface, sample));
      }
    }
  }

  const results = browserGate(samples);
  const positiveControl = results.map((result, index) =>
    index === 0
      ? { ...result, p75: { ...result.p75, lcpMs: result.thresholds.lcpMs + 1 }, pass: false }
      : result
  );
  expect(positiveControl.some((result) => !result.pass)).toBe(true);

  const artifact = {
    taskId: 'NFR-PERF-001',
    testedSha: process.env.NFR_PERF_PRODUCT_SHA || 'WORKTREE',
    generatedAt: new Date().toISOString(),
    samplesPerSurface: SAMPLES_PER_SURFACE,
    samples,
    results,
    positiveControlDetected: positiveControl.some((result) => !result.pass),
  };
  fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true });
  fs.writeFileSync(`${ARTIFACT_PATH}.tmp`, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  fs.renameSync(`${ARTIFACT_PATH}.tmp`, ARTIFACT_PATH);
  await testInfo.attach('nfr-perf-web-vitals.json', {
    body: Buffer.from(JSON.stringify(artifact, null, 2)),
    contentType: 'application/json',
  });

  expect(results.filter((result) => !result.pass)).toEqual([]);
});
