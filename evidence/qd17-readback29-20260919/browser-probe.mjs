// QD17 READBACK-29 — instrument B: przeglądarka na ŻYWYM stagingu (deployment 31).
// Dla każdej paczki FRONTOWEJ wdrożenia 29: jeden realny ekran EN 1440×900, zrzut,
// lista XHR z kodami, błędy konsoli oraz asercje DOM na konkretne zmiany z delty.
// ZERO zapisów: tylko nawigacja i odczyt DOM. Reguła 10: hasło z DOSTEP.md w runtime.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://staging.consultify.ai';
const OUT = path.join(__dirname, 'zrzuty');
const LOG = path.join(__dirname, 'przegladarka-na-zywo.txt');
fs.mkdirSync(OUT, { recursive: true });

function creds(rel) {
  const d = fs.readFileSync(process.env.HOME + rel, 'utf8');
  const email = (d.match(/E-?mail:\s*`?([^\s`]+@[^\s`]+)`?/i) || [])[1];
  const pass = process.env.CTO_TEST_PASSWORD || (d.match(/Has[łl]o[^:\n]*:\s*`([^`]+)`/i) || [])[1];
  if (!email || !pass) throw new Error('PARSE_FAIL ' + rel);
  return { email, pass };
}
const { email, pass } = creds('/Developer/cto-codex/irina-20260914/DOSTEP.md');

// obiekty Northwind do deep-linków (te same, których używały readbacki CTO)
const MEETING_ID = 'c0f1e001-7a11-4f01-9c01-0f0a1b2c3e01';
const PROJECT_ID = '6174636d-c4f2-552d-9a5a-d2695738f9bc';
const INITIATIVE_ID = 'cf84cf02-2e86-4458-8743-2a787a5527b1';

const SCREENS = [
  { id: '01-interview', url: '/interview', paczka: 'interview (IS-2a, IS-3a/b, AIR-1a/1b, D-44, D-21, K-16, U-79)' },
  { id: '02-assessment', url: '/assessment', paczka: 'assessment K-22 (kolumna Wynik) + drd K-24a/D-29' },
  { id: '03-assessment-outputs', url: '/assessment?tab=outputs', paczka: 'OP-1 output badges with preview' },
  { id: '04-audits', url: '/audit-programs', paczka: 'audits OP-2a/OP-2b, D-91 licznik kryteriów' },
  { id: '05-initiatives', url: '/initiatives', paczka: 'initiatives H1c, ST-3, D-77, DEC-537, A7-M1, D-20, menu2 a0a5d965' },
  { id: '06-initiatives-1280', url: '/initiatives', width: 1280, paczka: 'menu2 D-20/D-112 — Menu 2 w jednym wierszu od 1280px' },
  { id: '07-initiative-object', url: `/initiatives/${INITIATIVE_ID}`, paczka: 'initiatives H1c phase pill + PMO U-35/v4d preflight' },
  { id: '08-projects', url: '/projects', paczka: 'projects PJ-1 deep link + PROJECT-1-P2 switcher' },
  { id: '09-project-object', url: `/projects/${PROJECT_ID}`, paczka: 'PJ-1 ekran obiektu projektu (U-57 scoped tasks)' },
  { id: '10-execution', url: '/execution', paczka: 'execution D-55 owner fallback, R-E3A/R-E3B work risk boundary' },
  { id: '11-execution-resources-retired', url: '/execution/resources', paczka: 'execution 566f256c — retired deep link → canonical list' },
  { id: '12-rollout-retired', url: '/rollout', paczka: 'execution — retired ROLLOUT → canonical list' },
  { id: '13-meetings', url: '/meetings', paczka: 'meetings MTG-2a/2b/2c + lifecycle authz 7aec15cbed' },
  { id: '14-meeting-protocol', url: `/meetings/${MEETING_ID}/protocol`, paczka: 'MTG-2a v2 protokół + etykieta SOURCE per blok' },
  { id: '15-presentations', url: '/presentations', paczka: 'materials U-44/D-87, RD-2 v2 deck shell, filtr źródła w menu 2' },
  { id: '16-my-work', url: '/my-work', paczka: 'my-work K-26 cykle statusów, K-27 inline edit, K-29 drag&drop' },
  { id: '17-discovery-tools', url: '/discovery-tools', paczka: 'tools K-09 fail Dynamic SWOT draft timeout' },
  { id: '18-settings-profile', url: '/settings/profile', paczka: 'settings K-13 komunikat mismatch nazywa pole' },
  { id: '19-chat', url: '/chat', paczka: 'AIR-1b shared display + 64401abc WorkCanvasDocumentPanel' },
  { id: '20-admin-people', url: '/admin/people', paczka: 'sidebar K-18 role gate + D-28 shared relation fallback' },
  { id: '21-documents-deeplink', url: '/documents/00000000-0000-4000-8000-000000000000', paczka: 'DOC-0 D-102 honest deep-link failure (oczekiwany czytelny komunikat, nie pusty ekran)' },
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
const page = await context.newPage();

const lines = [];
const log = (s) => { lines.push(s); console.log(s); };

// --- logowanie przez fetch w stronie (ten sam wzorzec co smoke CTO) ----------
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
const login = await page.evaluate(
  async ([em, pw]) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: em, password: pw }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.token) {
      localStorage.setItem('token', j.token);
      localStorage.setItem('i18nextLng', 'en');
    }
    return { http: r.status, ok: Boolean(j.token), org: j.user?.organizationId ?? null, role: j.user?.role ?? null };
  },
  [email, pass],
);
log('# QD17 READBACK-29 — instrument B: przeglądarka (EN, 1440×900) na żywym stagingu');
log(`# login HTTP=${login.http} token=${login.ok} rola=${login.role} orgAktywna=${login.org} (Northwind=468b234c-66c4-54e1-b626-5e0fb3a92f6a)`);
log('# ZERO zapisów: tylko nawigacja + odczyt DOM; switch-organization NIE wywołane.');
log('');

const I18N_KEY_RE = /\b[a-z]{2,}\.[a-zA-Z]{2,}\.[a-zA-Z]{2,}\b/g;
const PL_RE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

for (const s of SCREENS) {
  const width = s.width || 1440;
  await page.setViewportSize({ width, height: 900 });

  const xhr = [];
  const consoleErrors = [];
  const pageErrors = [];
  const onResp = (r) => {
    const u = r.url();
    if (!u.includes('/api/')) return;
    xhr.push(`${r.status()} ${r.request().method()} ${u.replace(BASE, '')}`);
  };
  const onConsole = (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 220)); };
  const onPageError = (e) => pageErrors.push(String(e).slice(0, 220));
  page.on('response', onResp);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  let finalUrl = '';
  let navError = '';
  try {
    await page.goto(BASE + s.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    finalUrl = page.url().replace(BASE, '');
  } catch (e) {
    navError = String(e).slice(0, 200);
  }

  const dom = await page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    const texts = [...document.querySelectorAll('body *')]
      .filter(vis)
      .filter((el) => el.children.length === 0)
      .map((el) => (el.textContent || '').trim())
      .filter((t) => t.length > 0 && t.length < 300);
    const navs = [...document.querySelectorAll('nav[aria-label]')].map((n) => n.getAttribute('aria-label'));
    const tabs = [...document.querySelectorAll('[role="tab"]')].filter(vis).map((t) => ({
      label: (t.textContent || '').trim(),
      rect: t.getBoundingClientRect(),
    }));
    const rows = document.querySelectorAll('table tbody tr').length;
    const headers = [...document.querySelectorAll('table thead th')].map((h) => (h.textContent || '').trim()).filter(Boolean);
    // Menu 2: ile DISTINCT wierszy (top) zajmują widoczne zakładki
    const tops = [...new Set(tabs.map((t) => Math.round(t.rect.top)))].sort((a, b) => a - b);
    const rowGroups = tops.map((top) => tabs.filter((t) => Math.round(t.rect.top) === top));
    const widest = rowGroups.length ? Math.max(...rowGroups.map((g) => g.length)) : 0;
    // przycięte zakładki: scrollWidth > clientWidth na widocznym elemencie
    const clipped = tabs
      .filter((t) => t.label)
      .map((t) => ({ label: t.label, w: Math.round(t.rect.width) }));
    return {
      title: document.title,
      textCount: texts.length,
      texts: texts.slice(0, 400),
      navAriaLabels: navs,
      tabCount: tabs.length,
      tabRowCount: rowGroups.length,
      tabRowWidths: rowGroups.map((g) => g.length),
      widestTabRow: widest,
      tabs: clipped,
      tableRows: rows,
      tableHeaders: headers,
      bodyLang: document.documentElement.lang,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    };
  }).catch((e) => ({ error: String(e).slice(0, 200) }));

  const rawKeys = [...new Set((dom.texts || []).join(' \n').match(I18N_KEY_RE) || [])].slice(0, 12);
  const plLits = [...new Set((dom.texts || []).filter((t) => PL_RE.test(t)))].slice(0, 8);
  const badXhr = xhr.filter((x) => Number(x.slice(0, 3)) >= 400);
  const i18nextLeak = (dom.navAriaLabels || []).filter((l) => /returned an object instead of string|key '.*' returned/i.test(l || ''));

  const shot = path.join(OUT, `${s.id}.png`);
  await page.screenshot({ path: shot, fullPage: false }).catch(() => {});

  log(`### ${s.id}  ${s.url}${s.width ? `  @${s.width}px` : ''}`);
  log(`    paczka: ${s.paczka}`);
  log(`    url-po-nawigacji: ${finalUrl || '(brak)'}${navError ? '  BLAD-NAWIGACJI: ' + navError : ''}`);
  log(`    title: ${dom.title || '-'}  lang=${dom.bodyLang || '-'}  wierszy-tabeli=${dom.tableRows ?? '-'}  zakladek=${dom.tabCount ?? '-'}  wierszy-zakladek=${dom.tabRowCount ?? '-'} (najszerszy=${dom.widestTabRow ?? '-'})`);
  log(`    poziomy-przewijanie: scrollWidth=${dom.scrollW} clientWidth=${dom.clientW} przesciecie-poziome=${dom.scrollW > dom.clientW}`);
  log(`    xhr-razem=${xhr.length}  xhr-4xx5xx=${badXhr.length}${badXhr.length ? ' -> ' + badXhr.slice(0, 10).join(' | ') : ''}`);
  log(`    bledy-konsoli=${consoleErrors.length}${consoleErrors.length ? ' -> ' + consoleErrors.slice(0, 4).join(' || ') : ''}`);
  log(`    bledy-strony=${pageErrors.length}${pageErrors.length ? ' -> ' + pageErrors.slice(0, 3).join(' || ') : ''}`);
  log(`    nav-aria-label(D-43)=${JSON.stringify(dom.navAriaLabels || [])} przeciek-i18next=${i18nextLeak.length}`);
  log(`    surowe-klucze-i18n=${rawKeys.length}${rawKeys.length ? ' -> ' + rawKeys.join(', ') : ''}`);
  log(`    literaly-PL=${plLits.length}${plLits.length ? ' -> ' + JSON.stringify(plLits) : ''}`);
  log(`    naglowki-tabeli: ${JSON.stringify((dom.tableHeaders || []).slice(0, 20))}`);
  log(`    zakladki: ${JSON.stringify((dom.tabs || []).slice(0, 24))}`);
  log(`    zrzut: zrzuty/${s.id}.png`);
  log('');

  page.off('response', onResp);
  page.off('console', onConsole);
  page.off('pageerror', onPageError);
}

await browser.close();
fs.writeFileSync(LOG, lines.join('\n') + '\n');
log('# koniec instrumentu B');
