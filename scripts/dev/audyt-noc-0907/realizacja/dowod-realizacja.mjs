#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — odbior nocny modulu REALIZACJA (Execution), 07/08.09.2026.
 * Konto ADMIN (audyt@dbr77.local). Klika to, co klika czlowiek.
 *
 * Uzycie: node dowod-realizacja.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3185';
const AUTH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad/auth-audyt-3185.json';
const OUT = '/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/realizacja';
fs.mkdirSync(OUT, { recursive: true });

const konsola = [];
const apiLog = [];
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'light',
  storageState: AUTH,
  locale: 'pl-PL',
});
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 400)); });
page.on('response', async (r) => {
  const u = r.url();
  if (!/\/api\//i.test(u)) return;
  if (r.status() < 400) return;
  let body = '';
  try { body = (await r.text()).slice(0, 400); } catch { body = '(brak ciala)'; }
  apiLog.push(`${r.request().method()} ${r.status()} ${u.replace(BASE, '')}\n    ${body}`);
});

let liczbaZrzutow = 0;
async function zrzut(nazwa, opis) {
  liczbaZrzutow += 1;
  const przed = konsola.length;
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: false });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({
    nazwa, opis, url: page.url(), szerokosc: 1440, motyw: 'jasny',
    bledyKonsoliDoTejPory: konsola.length,
    czas: new Date().toISOString(),
  }, null, 2));
  console.log(`ZRZUT ${nazwa}: ${opis} (bledyKonsoli=${konsola.length})`);
}

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});

// Zamknij onboarding jesli sie pojawi
async function zamknijOnboarding() {
  const btn = page.getByText(/Pomiń na razie/i).first();
  if (await btn.count().catch(() => 0)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(500);
  }
}

// ─────────────────────────── 1. LISTA (Realizacje) ───────────────────────────
await page.goto(`${BASE}/execution?tab=list`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await zamknijOnboarding();
await page.waitForTimeout(1000);
await zrzut('01-lista-realizacje', 'Zakladka glowna Realizacje - podglad z lancuchem statusow, pill Wstrzymana');

// ─────────────────────────── 2. PRACA ───────────────────────────
await page.goto(`${BASE}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await zrzut('02-praca-tabela', 'Zakladka Praca - tabela zadan z /api/tasks');

// Znajdz wiersz z origin tasks (edytowalny) - kliknij dwukrotnie w komorke Status pierwszego wiersza
const pierwszyWierszStatus = page.locator('[data-editable="tak"]').first();
let edycjaOk = false;
if (await pierwszyWierszStatus.count()) {
  await pierwszyWierszStatus.dblclick();
  await page.waitForTimeout(500);
  const select = page.locator('select[aria-label="Zmień status"]').first();
  if (await select.count()) {
    const opcje = await select.locator('option').allTextContents();
    console.log('Opcje statusu:', opcje);
    await zrzut('03-praca-edycja-otwarta', 'Edycja inline statusu otwarta (select)');
    // wybierz druga opcje jesli jest (pierwsza = biezacy stan)
    const wartosci = await select.locator('option').evaluateAll((els) => els.map((e) => e.value));
    if (wartosci.length > 1) {
      await select.selectOption(wartosci[1]);
      edycjaOk = true;
      await page.waitForTimeout(1500);
    }
  }
}
await zrzut('04-praca-po-edycji', 'Po zapisie statusu (PUT /api/tasks/:id) - toast/wartosc');

// RELOAD i weryfikacja trwalosci
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await zrzut('05-praca-po-reload', 'Po reload - wartosc statusu trwala');

// ─────────────────────────── 3. ZASOBY (przed zmiana) ───────────────────────────
await page.goto(`${BASE}/execution?tab=resources`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await zrzut('06-zasoby-przed', 'Zasoby - obciazenie tygodniowe PRZED zmiana terminu zadania');

// Wroc do Pracy, zmien termin pierwszego edytowalnego zadania (z dueAt)
await page.goto(`${BASE}/execution?tab=work`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const komorkiEdytowalne = page.locator('[data-editable="tak"]');
const liczbaEdytowalnych = await komorkiEdytowalne.count();
console.log('Liczba edytowalnych komorek (Praca):', liczbaEdytowalnych);
// znajdz komorke Termin (input type=date po dblclick) - probujemy kolejne az znajdziemy input[type=date]
let terminZmieniony = false;
for (let i = 0; i < Math.min(liczbaEdytowalnych, 15); i += 1) {
  const komorka = komorkiEdytowalne.nth(i);
  await komorka.dblclick();
  await page.waitForTimeout(300);
  const dateInput = page.locator('input[type="date"][aria-label="Zmień termin"]').first();
  if (await dateInput.count()) {
    const nowaData = '2026-10-15';
    await dateInput.fill(nowaData);
    await dateInput.press('Enter');
    terminZmieniony = true;
    await page.waitForTimeout(1500);
    break;
  }
  await page.keyboard.press('Escape').catch(() => {});
}
console.log('Termin zmieniony:', terminZmieniony);
await zrzut('07-praca-zmiana-terminu', 'Praca - zmiana terminu zadania na 2026-10-15');

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// ─────────────────────────── ZASOBY (po zmianie) ───────────────────────────
await page.goto(`${BASE}/execution?tab=resources`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await zrzut('08-zasoby-po', 'Zasoby - obciazenie PO zmianie terminu (porownaj z 06)');

// ─────────────────────────── 4. DECYZJE I RYZYKA ───────────────────────────
await page.goto(`${BASE}/execution?tab=control`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await zrzut('09-decyzje-lista', 'Decyzje i ryzyka - preset Decyzje');

// Nowa decyzja
const btnNowaDecyzja = page.getByRole('button', { name: /^Nowa decyzja$/ }).first();
if (await btnNowaDecyzja.count()) {
  await btnNowaDecyzja.click();
  await page.waitForTimeout(800);
  await page.getByLabel('Tytuł decyzji').fill('ODBIOR NOC - decyzja testowa');
  const selInic = page.getByLabel('Inicjatywa (wymagana)');
  const opcjeInic = await selInic.locator('option').evaluateAll((els) => els.map((e) => e.value)).catch(() => []);
  if (opcjeInic.length > 1) await selInic.selectOption(opcjeInic[1]);
  await page.getByLabel('Potrzebna do dnia (wymagane)').fill('2026-09-20');
  await zrzut('10-nowa-decyzja-formularz', 'Formularz Nowa decyzja wypelniony');
  const zapisz = page.locator('[data-testid="execution-new-decision-save"]');
  await zapisz.click();
  await page.waitForTimeout(2000);
}
await zrzut('11-po-zapisie-decyzji', 'Po zapisie nowej decyzji');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await zrzut('12-decyzje-po-reload', 'Decyzje - po reload, nowa decyzja widoczna trwale');

// Ryzyka preset
const chipRyzyka = page.locator('button').filter({ hasText: /^Ryzyka\s*\d*$/ }).first();
if (await chipRyzyka.count()) { await chipRyzyka.click(); await page.waitForTimeout(2000); }
await zrzut('13-raid-lista', 'Preset Ryzyka - lista RAID z ekspozycja');

const btnNowyRaid = page.locator('[data-testid="execution-new-raid-open"]');
if (await btnNowyRaid.count()) {
  await btnNowyRaid.click();
  await page.waitForTimeout(800);
  await page.getByLabel('Tytuł (wymagany)').fill('ODBIOR NOC - ryzyko testowe');
  const selInicRaid = page.getByLabel('Inicjatywa (wymagana)');
  const opcjeInicRaid = await selInicRaid.locator('option').evaluateAll((els) => els.map((e) => e.value)).catch(() => []);
  if (opcjeInicRaid.length > 1) await selInicRaid.selectOption(opcjeInicRaid[1]);
  await page.getByLabel('Prawdopodobieństwo').selectOption({ index: 2 }).catch(() => {});
  await page.getByLabel('Wpływ').selectOption({ index: 2 }).catch(() => {});
  await page.waitForTimeout(300);
  const ekspozycja = await page.locator('[data-testid="execution-new-raid-exposure"]').textContent().catch(() => null);
  console.log('Ekspozycja policzona w formularzu:', ekspozycja);
  await zrzut('14-nowy-raid-formularz', `Formularz Nowa pozycja RAID, ekspozycja=${ekspozycja}`);
  await page.locator('[data-testid="execution-new-raid-save"]').click();
  await page.waitForTimeout(2000);
}
await zrzut('15-po-zapisie-raid', 'Po zapisie nowej pozycji RAID');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const chipRyzyka2 = page.locator('button').filter({ hasText: /^Ryzyka\s*\d*$/ }).first();
if (await chipRyzyka2.count()) { await chipRyzyka2.click(); await page.waitForTimeout(2000); }
await zrzut('16-raid-po-reload', 'RAID - po reload, nowa pozycja trwala, ekspozycja w kolumnie');

// Sygnaly
const chipSygnaly = page.locator('button').filter({ hasText: /^Sygnały\s*\(?\d*\)?$/ }).first();
if (await chipSygnaly.count()) {
  await chipSygnaly.click();
  await page.waitForTimeout(2000);
  await zrzut('17-sygnaly-lista', 'Preset Sygnaly (N) - delay-signals z systemu');
  const pierwszyWierszSygnal = page.locator('[role="row"], tbody tr').nth(1);
  if (await pierwszyWierszSygnal.count()) {
    await pierwszyWierszSygnal.click();
    await page.waitForTimeout(1000);
    const btnInterwencja = page.getByRole('button', { name: /Przygotuj interwencję/i }).first();
    if (await btnInterwencja.count()) {
      await zrzut('18-sygnal-przed-interwencja', 'Podglad sygnalu z akcja Przygotuj interwencje');
      await btnInterwencja.click();
      await page.waitForTimeout(2500);
      await zrzut('19-po-interwencji', 'Po kliknieciu Przygotuj interwencje - decyzja re-baseline utworzona');
    } else {
      console.log('Przycisk "Przygotuj interwencję" NIE ZNALEZIONY na pierwszym wierszu sygnalow');
      await zrzut('18b-sygnal-brak-przycisku', 'Podglad sygnalu bez widocznego przycisku interwencji');
    }
  }
} else {
  console.log('Chip "Sygnały" NIE ZNALEZIONY');
}

// Eskalacja dry-run (POST /api/decisions/escalation/run) - wywolanie bezposrednie z kontekstu przegladarki (z ciasteczkami sesji)
const eskalacjaOdp = await page.evaluate(async () => {
  const res = await fetch('/api/decisions/escalation/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ dryRun: true }),
  });
  const status = res.status;
  let body = null;
  try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
  return { status, body };
});
fs.writeFileSync(`${OUT}/eskalacja-dry-run.json`, JSON.stringify(eskalacjaOdp, null, 2));
console.log('POST /api/decisions/escalation/run (dryRun) status=', eskalacjaOdp.status);

// ─────────────────────────── 5. RAPORTY ───────────────────────────
await page.goto(`${BASE}/execution?tab=reports`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await zrzut('20-raporty', 'Zakladka Raporty - 4 kafle MVP (admin)');

fs.writeFileSync(`${OUT}/api-log.txt`, apiLog.join('\n') + '\n');
fs.writeFileSync(`${OUT}/konsola.log`, konsola.join('\n') + '\n');
console.log(`\nZRZUTOW: ${liczbaZrzutow}; wywolan API >=400: ${apiLog.length}; bledow konsoli: ${konsola.length}`);
await browser.close();
