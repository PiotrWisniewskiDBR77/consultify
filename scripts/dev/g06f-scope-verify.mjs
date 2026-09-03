// K1 — weryfikacja, ktore reguly axe realnie znikaja po zawezeniu do
// #dev-render-root, konkretnie dla modulow 13/14/15/16 (dyzur 2026-09-03).
// Sprawdza axe.run(document) vs axe.run('#dev-render-root') na probce
// ekranow, ze szczegolnym naciskiem na trzy NIEPOTWIERDZONE reguly z briefu:
// heading-order, landmark-unique, landmark-no-duplicate-banner.
// Tymczasowy skrypt weryfikacyjny — nie wpiety w CI, bezpieczny do usuniecia.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const AXE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const BASE = 'http://localhost:5320/index.html';

const SCREENS = [
  // 13_CHAT sample
  { mod: '13_CHAT', id: 'teresa-confirm-chip', url: `${BASE}?screen=teresa-confirm-chip&lang=pl&theme=light` },
  { mod: '13_CHAT', id: 'chat-signals-feed', url: `${BASE}?screen=chat-signals-feed&lang=pl&theme=light` },
  // 14_ADMIN sample
  { mod: '14_ADMIN', id: 'admin-command-overview', url: `${BASE}?screen=admin-command-overview&lang=pl&theme=light` },
  { mod: '14_ADMIN', id: 'admin-team-members', url: `${BASE}?screen=admin-team-members&lang=pl&theme=light` },
  // 15_SETTINGS sample
  { mod: '15_SETTINGS', id: 'ustawienia-personalne', url: `${BASE}?screen=ustawienia-personalne&lang=pl&theme=light` },
  { mod: '15_SETTINGS', id: 'calendar-sync-settings', url: `${BASE}?screen=calendar-sync-settings&lang=pl&theme=light` },
  { mod: '15_SETTINGS', id: 'ustawienia-wyglad', url: `${BASE}?screen=ustawienia-wyglad&grupa=wyglad&lang=pl&theme=light` },
  // 16_PARTNER sample — the three screens claimed "clean" after noise removal
  { mod: '16_PARTNER', id: 'partner-start-active', url: `${BASE}?screen=partner-start-active&lang=pl&theme=light` },
  { mod: '16_PARTNER', id: 'partner-start-error', url: `${BASE}?screen=partner-start-error&lang=pl&theme=light` },
  { mod: '16_PARTNER', id: 'partner-start-unconnected', url: `${BASE}?screen=partner-start-unconnected&lang=pl&theme=light` },
  { mod: '16_PARTNER', id: 'partner-dashboard', url: `${BASE}?screen=partner-dashboard&lang=pl&theme=light` },
  // 14_ADMIN — five "command" screens sharing a reported label defect (check post-285)
  { mod: '14_ADMIN', id: 'admin-command-agent-trace', url: `${BASE}?screen=admin-command-agent-trace&lang=pl&theme=light` },
  { mod: '14_ADMIN', id: 'admin-command-ai-policy', url: `${BASE}?screen=admin-command-ai-policy&lang=pl&theme=light` },
  { mod: '14_ADMIN', id: 'admin-command-audit', url: `${BASE}?screen=admin-command-audit&lang=pl&theme=light` },
  { mod: '14_ADMIN', id: 'admin-command-residency', url: `${BASE}?screen=admin-command-residency&lang=pl&theme=light` },
  { mod: '14_ADMIN', id: 'admin-command-retention', url: `${BASE}?screen=admin-command-retention&lang=pl&theme=light` },
];

const WATCH_RULES = ['heading-order', 'landmark-unique', 'landmark-no-duplicate-banner', 'landmark-one-main', 'page-has-heading-one', 'region'];

async function scan(page, target) {
  await page.evaluate(AXE_SRC);
  return page.evaluate(async (t) => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(t, { resultTypes: ['violations'] });
    return r.violations.map((v) => ({
      id: v.id,
      nodeCount: v.nodes.length,
      nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target, html: n.html.slice(0, 200) })),
    }));
  }, target);
}

async function main() {
  const browser = await chromium.launch();
  const results = [];
  for (const s of SCREENS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(s.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
    let full = [];
    let scoped = [];
    let err = null;
    try {
      await page.evaluate(AXE_SRC);
      full = await page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        const r = await axe.run(document, { resultTypes: ['violations'] });
        return r.violations.map((v) => ({ id: v.id, nodeCount: v.nodes.length }));
      });
    } catch (e) {
      err = 'full:' + String(e);
    }
    try {
      const hasRoot = await page.evaluate(() => !!document.querySelector('#dev-render-root'));
      scoped = hasRoot ? await scan(page, '#dev-render-root') : [{ id: 'NO_ROOT_SELECTOR', nodeCount: 0 }];
    } catch (e) {
      err = (err ? err + ' | ' : '') + 'scoped:' + String(e);
    }
    const fullIds = full.map((v) => v.id);
    const scopedIds = scoped.map((v) => v.id);
    const watchHits = WATCH_RULES.filter((r) => scopedIds.includes(r));
    results.push({ mod: s.mod, id: s.id, fullIds, scopedIds, watchHitsInScoped: watchHits, err });
    console.log(s.mod, s.id, 'FULL:', fullIds.join(',') || '(none)', '| SCOPED:', scopedIds.join(',') || '(none)', err ? `ERR:${err}` : '');
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, '../../g06f-scope-verify-results.json'), JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
