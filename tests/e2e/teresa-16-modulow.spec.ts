import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3108';
const authPath = process.env.ODBIOR_AUTH_STATE || '/private/tmp/stanowisko-noc/auth-teresa16.json';
const outDir = path.resolve(process.cwd(), process.env.TERESA16_OUT || 'evidence/teresa-16/initial');
const storageState = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const source = (storageState.origins || []).find((origin: any) =>
  (origin.localStorage || []).some((entry: any) => entry.name === 'token' && entry.value)
);
if (!source) throw new Error(`Brak tokenu w ${authPath}`);
storageState.origins = [{ ...source, origin: baseURL }];

type ModuleCase = {
  module: string;
  route: string;
  entry: RegExp | null;
  entrySelector?: string;
  emptyExpected?: boolean;
  stopReason?: string;
};

const modules: ModuleCase[] = [
  { module: 'Czat', route: '/chat', entry: null },
  { module: 'Moja Praca', route: '/my-work', entry: /^Teresa$/ },
  { module: 'Wywiad', route: '/interview', entry: /^Teresa$/ },
  { module: 'Narzędzia', route: '/discovery-tools', entry: /^(Teresa|Zapytaj Teresę)/, emptyExpected: true },
  { module: 'Ocena', route: '/assessment', entry: /^(Teresa|Zapytaj Teresę)/ },
  { module: 'Inicjatywy', route: '/initiatives', entry: /^(Teresa|Zapytaj Teresę)/ },
  { module: 'Realizacja', route: '/execution', entry: /^(Teresa|Zapytaj Teresę)/ },
  { module: 'Wyniki', route: '/results/kpi/ed531550-a7bc-54bb-bbfc-71f2daa14d7f', entry: /^Zapytaj Teresę o ten miernik$/ },
  { module: 'Finanse', route: '/finance', entry: /^AI$/, entrySelector: 'button[title*="czat AI"], button[title*="AI Chat"]' },
  { module: 'Materiały', route: '/presentations', entry: /^Teresa$/ },
  { module: 'Audyty', route: '/audit-programs', entry: /^Teresa$/, emptyExpected: true },
  { module: 'Spotkania', route: '/meetings', entry: /^Teresa$/, emptyExpected: true },
  { module: 'Administracja', route: '/admin', entry: /^(Teresa|Zapytaj Teresę)/, stopReason: 'brak ekranu-artefaktu z prawym panelem; moduł nadzoruje AI' },
  { module: 'Ustawienia', route: '/settings/profile', entry: /^(Teresa|Zapytaj Teresę)/, stopReason: 'brak ekranu-artefaktu z prawym panelem; ekran konfiguracji' },
  { module: 'Organizacja', route: '/organization', entry: /^Zapytaj Teresę o kontekst organizacji$/ },
  { module: 'Partner', route: '/partner/dashboard', entry: /^(Teresa|Zapytaj Teresę)/, emptyExpected: true, stopReason: 'brak ekranu-artefaktu z prawym panelem; portal poza rdzeniem MVP' },
];

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseSse(raw: string) {
  let answer = '';
  let ledger: any = null;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const event = JSON.parse(line.slice(6));
      if (typeof event.text === 'string') answer += event.text;
      if (event.type === 'source_ledger') ledger = event;
    } catch { /* keep measuring */ }
  }
  if (/Ã|Å|Ä|â€/.test(answer)) answer = Buffer.from(answer, 'latin1').toString('utf8');
  const polishTokens = (answer.match(/\b(i|oraz|jest|są|brak|dane|moduł|widzę|w|na|do|z)\b/gi) || []).length;
  const polishChars = (answer.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
  return {
    answer: answer.trim(),
    language: answer && (polishChars > 0 || polishTokens >= 3) ? 'pl' : answer ? 'unknown' : 'none',
    used_sources: Array.isArray(ledger?.used_sources) ? ledger.used_sources.length : 0,
    sources: ledger?.used_sources || [],
    degraded: ledger?.degraded || [],
  };
}

test.use({ storageState, viewport: { width: 1440, height: 1000 } });
test.setTimeout(16 * 75_000);

test('pomiar 16 modułów Teresy', async ({ page }) => {
  fs.mkdirSync(outDir, { recursive: true });
  const results: any[] = [];
  const consoleErrors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  for (const item of modules) {
    const result: any = { module: item.module, route: item.route, entry: item.entry ? String(item.entry) : 'Czat główny', status: 'FAIL', stopReason: item.stopReason || null };
    const beforeErrors = consoleErrors.length;
    try {
      await page.goto(baseURL + item.route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(8_000);
      result.finalRoute = new URL(page.url()).pathname + new URL(page.url()).search;
      if (item.entry) {
        const entry = item.entrySelector ? page.locator(item.entrySelector).first() : page.getByRole('button', { name: item.entry }).first();
        if (!(await entry.isVisible().catch(() => false))) {
          result.failure = item.stopReason ? 'brak wejścia, poza MVP' : 'brak wejścia Teresy';
          if (item.stopReason) result.status = 'STOP';
          throw new Error(result.failure);
        }
        result.entry = (await entry.innerText()).trim();
        await entry.click();
      }
      const input = page.locator('textarea[data-testid="chat-input"]:visible').first();
      await expect(input).toBeVisible({ timeout: 15_000 });
      result.unifiedChatPanelDomCount = await page.locator('textarea[data-testid="chat-input"]').count();
      await input.fill('Podsumuj, co tu widzisz.');
      const responsePromise = page.waitForResponse((r) => r.url().includes('/api/ai/chat/stream') && r.request().method() === 'POST', { timeout: 60_000 });
      await page.locator('[data-testid="chat-send-btn"]:visible').click();
      const response = await responsePromise;
      await response.finished();
      const parsed = parseSse(await response.text());
      Object.assign(result, parsed);
      result.first200 = parsed.answer.slice(0, 200).replace(/\s+/g, ' ');
      result.status = parsed.language === 'pl' && (item.emptyExpected || parsed.used_sources > 0) && result.unifiedChatPanelDomCount === 1 ? 'PASS' : 'FAIL';
      if (item.emptyExpected && parsed.used_sources === 0 && !/brak|nie ma|nie widzę|niedostępn/i.test(parsed.answer)) result.status = 'FAIL';
      await page.getByText(/Źródła:\s*\d+/i).last().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    } catch (error: any) {
      result.failure ||= String(error?.message || error).split('\n')[0];
    }
    result.bledyKonsoli = consoleErrors.slice(beforeErrors);
    if (result.bledyKonsoli.length > 0 && result.status !== 'STOP') result.status = 'FAIL';
    await page.screenshot({ path: path.join(outDir, `${String(results.length + 1).padStart(2, '0')}-${slug(item.module)}.png`) }).catch(() => {});
    fs.writeFileSync(path.join(outDir, `${String(results.length + 1).padStart(2, '0')}-${slug(item.module)}.json`), JSON.stringify(result, null, 2));
    results.push(result);
  }
  fs.writeFileSync(path.join(outDir, 'wyniki.json'), JSON.stringify(results, null, 2));
  const rows = results.map((r, i) => `| ${i + 1} | ${r.module} | \`${r.finalRoute || r.route}\` | ${String(r.entry).replaceAll('|', '\\|')} | ${r.language || '—'} | ${r.used_sources ?? 0} | ${r.unifiedChatPanelDomCount ?? 0} | ${r.bledyKonsoli?.length || 0} | ${r.status} | ${String(r.first200 || r.failure || '').replaceAll('|', '\\|').replaceAll('\n', ' ')} |`);
  fs.writeFileSync(path.join(outDir, 'RAPORT.md'), `# Teresa — pomiar 16 modułów\n\n| # | Moduł | Trasa | Wejście | Język | used_sources | UnifiedChatPanel DOM | Błędy konsoli | Stan | Odpowiedź / blokada |\n|---:|---|---|---|---:|---:|---:|---:|---|---|\n${rows.join('\n')}\n`);
});
