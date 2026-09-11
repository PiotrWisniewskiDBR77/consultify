// Pomiar wydajności ekranów flagowych na live stagingu (TYLKO ODCZYT).
// Uruchomienie: node evidence/perf-2c/measure.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const SESSION_PATH = process.env.SESSION_PATH;
const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
const BASE = session.base;

const ROUTES = [
  ['Chat', '/chat'],
  ['My Work', '/my-work'],
  ['Interview', '/interview'],
  ['Tools', '/discovery-tools'],
  ['Assessment', '/assessment/overview'],
  ['Audits', '/audit-programs'],
  ['Initiatives', '/initiatives'],
  ['Execution', '/execution'],
  ['Results (Wyniki)', '/results/kpi'],
  ['Finance', '/finance'],
  ['Materials', '/presentations'],
  ['Admin', '/admin'],
  ['Organization', '/organization/profile'],
  ['Internal Tools (AI OS)', '/ai'],
  ['Settings', '/settings/profile'],
  ['Partner Portal', '/partner'],
];

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function injectAuth(page) {
  await page.addInitScript(
    ({ token, refreshToken, user }) => {
      try {
        window.localStorage.setItem('token', token);
        window.localStorage.setItem('refreshToken', refreshToken);
        window.localStorage.setItem('user', JSON.stringify(user));
      } catch (e) {}
    },
    { token: session.token, refreshToken: session.refreshToken, user: session.user }
  );
}

async function measureOnce(context, route) {
  const page = await context.newPage();
  const apiCalls = [];
  const consoleErrors = [];
  const failed5xx = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });

  page.on('response', (res) => {
    try {
      const url = res.url();
      if (url.includes('/api/')) {
        const status = res.status();
        const timing = res.request().timing();
        apiCalls.push({
          url: url.replace(BASE, ''),
          status,
          durMs: timing ? Math.round(timing.responseEnd - timing.requestStart) : null,
        });
        if (status >= 500) failed5xx.push({ url: url.replace(BASE, ''), status });
      }
    } catch (e) {}
  });

  const t0 = Date.now();
  let navError = null;
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 20000 });
  } catch (e) {
    navError = String(e.message || e).slice(0, 200);
  }
  const networkIdleMs = Date.now() - t0;

  // LCP via PerformanceObserver (best-effort, page may have navigated already)
  let lcp = null;
  try {
    lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        try {
          const entries = performance.getEntriesByType('largest-contentful-paint');
          if (entries.length) {
            resolve(Math.round(entries[entries.length - 1].startTime));
            return;
          }
          const po = new PerformanceObserver((list) => {
            const es = list.getEntries();
            if (es.length) resolve(Math.round(es[es.length - 1].startTime));
          });
          po.observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => resolve(null), 500);
        } catch (e) {
          resolve(null);
        }
      });
    });
  } catch (e) {}

  await page.close();

  return {
    route,
    networkIdleMs,
    navError,
    lcp,
    apiCallCount: apiCalls.length,
    apiCalls,
    consoleErrorCount: consoleErrors.length,
    consoleErrors: consoleErrors.slice(0, 10),
    failed5xx,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const [name, route] of ROUTES) {
    console.log(`=== ${name} (${route}) ===`);
    const runs = [];

    // Cold run: fresh context (no cache)
    const ctxCold = await browser.newContext();
    await ctxCold.addInitScript(
      ({ token, refreshToken, user }) => {
        try {
          window.localStorage.setItem('token', token);
          window.localStorage.setItem('refreshToken', refreshToken);
          window.localStorage.setItem('user', JSON.stringify(user));
        } catch (e) {}
      },
      { token: session.token, refreshToken: session.refreshToken, user: session.user }
    );
    try {
      const r = await measureOnce(ctxCold, route);
      r.cache = 'cold';
      runs.push(r);
      console.log(`  cold: ${r.networkIdleMs}ms, LCP=${r.lcp}, api=${r.apiCallCount}, 5xx=${r.failed5xx.length}, err=${r.navError || 'none'}`);
    } catch (e) {
      console.log('  cold FAILED', e.message);
    }
    await ctxCold.close();

    // Warm runs: reuse one context for 2 navigations (cache stays warm)
    const warmContext = await browser.newContext();
    await warmContext.addInitScript(
      ({ token, refreshToken, user }) => {
        try {
          window.localStorage.setItem('token', token);
          window.localStorage.setItem('refreshToken', refreshToken);
          window.localStorage.setItem('user', JSON.stringify(user));
        } catch (e) {}
      },
      { token: session.token, refreshToken: session.refreshToken, user: session.user }
    );
    // prime cache
    try {
      await measureOnce(warmContext, route);
    } catch (e) {}
    for (let i = 0; i < 2; i++) {
      try {
        const r = await measureOnce(warmContext, route);
        r.cache = 'warm';
        runs.push(r);
        console.log(`  warm${i + 1}: ${r.networkIdleMs}ms, LCP=${r.lcp}, api=${r.apiCallCount}, 5xx=${r.failed5xx.length}, err=${r.navError || 'none'}`);
      } catch (e) {
        console.log(`  warm${i + 1} FAILED`, e.message);
      }
    }
    await warmContext.close();

    const idleTimes = runs.map((r) => r.networkIdleMs);
    const lcps = runs.map((r) => r.lcp).filter((x) => x != null);
    results[name] = {
      route,
      runs,
      medianNetworkIdleMs: median(idleTimes),
      medianLcp: lcps.length ? median(lcps) : null,
    };
  }

  await browser.close();
  fs.writeFileSync(
    process.env.OUT_PATH,
    JSON.stringify(results, null, 2)
  );
  console.log('DONE, wrote', process.env.OUT_PATH);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
