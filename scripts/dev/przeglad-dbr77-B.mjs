#!/usr/bin/env node
/**
 * Przegląd Inicjatyw na danych DBR77 — SCENARIUSZ B.
 * Łańcuch DRAFT->PENDING_APPROVAL->(blokada APPROVE), HOLD/RESUME na IN_EXECUTION,
 * Plan, Obciążenie, para negatywna MEMBER.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const SCRATCH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const BASE = 'http://localhost:3188';
const AUTH_ADMIN = `${SCRATCH}/auth-audyt-state.json`;
const AUTH_MEMBER = `${SCRATCH}/auth-member-state.json`;
const OUT = '/private/tmp/wt-rev-ini/evidence/przeglad-dbr77/inicjatywy';
fs.mkdirSync(OUT, { recursive: true });

const DB = 'consultify_kopia_ini';
function sql(query) {
  const escaped = query.replace(/'/g, "'\\''");
  const out = execSync(`docker exec consultify-pg18 psql -U postgres -d ${DB} -Atc '${escaped}'`, { encoding: 'utf8' });
  return out.trim();
}
function sqlExec(query) {
  const escaped = query.replace(/'/g, "'\\''");
  execSync(`docker exec consultify-pg18 psql -U postgres -d ${DB} -v ON_ERROR_STOP=1 -c '${escaped}'`, { encoding: 'utf8' });
}

const DRAFT_ID = 'd1b3751e-d2aa-4957-8967-10254e7628c3'; // Automatyzacja optymalizacji przezbrojeń
const DRAFT_NAZWA = 'Automatyzacja optymalizacji przezbrojeń';
const HOLD_ID = 'd3bc32b2-ca68-456f-8af9-a432d6f10442'; // Transformacja DevOps, IN_EXECUTION, on_hold=false
const HOLD_NAZWA = 'Transformacja DevOps';

const konsola = [];
const apiLogLines = [];
function logApi(response) {
  const u = response.url();
  if (!/\/api\//.test(u)) return;
  return response.text().catch(() => '(brak ciala)').then((body) => {
    const status = response.status();
    if (status >= 400) {
      apiLogLines.push(`${new Date().toISOString()} ${response.request().method()} ${status} ${u.replace(BASE, '')}\n    ${body.slice(0, 400)}`);
    }
  });
}

let page, context, browser;
let oryginalnyAutorDraft = null;

function stanInicjatywy(id) {
  const row = sql(`SELECT status, on_hold FROM initiatives WHERE id='${id}'`);
  return row || '(brak)';
}

async function zrzut(nazwa, opis, extra = {}) {
  const sciezka = `${OUT}/${nazwa}.png`;
  try {
    const sekcja = page.getByTestId('initiative-lifecycle-actions')
      .or(page.getByTestId('initiative-lifecycle-empty'))
      .or(page.getByTestId('initiative-lifecycle-terminal'))
      .or(page.getByTestId('initiative-lifecycle-load-error'))
      .first();
    if (await sekcja.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sekcja.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
  } catch {}
  await page.screenshot({ path: sciezka, fullPage: true });
  const dane = { nazwa, opis, url: page.url(), bledyKonsoli: [...konsola], czas: new Date().toISOString(), ...extra };
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify(dane, null, 2));
  console.log(`ZRZUT ${nazwa}: ${sciezka} (bledyKonsoli=${konsola.length})`);
}

async function zamknijOnboardingJesliJest() {
  const pomin = page.getByText('Pomiń na razie', { exact: true });
  const widoczny = await pomin.first().isVisible({ timeout: 2000 }).catch(() => false);
  if (widoczny) { await pomin.first().click({ force: true }); await page.waitForTimeout(500); }
}
async function ustawMotywJasny() {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const KEY = 'consultify-storage';
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...(parsed.state || {}), theme: 'light' };
    localStorage.setItem(KEY, JSON.stringify(parsed));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await zamknijOnboardingJesliJest();
}

async function otworzWedlugNazwy(pelnaNazwa, zakresWszystkie = true) {
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await zamknijOnboardingJesliJest();
  if (zakresWszystkie) {
    const radio = page.getByRole('radio', { name: 'Wszystkie' });
    if (await radio.count()) { await radio.first().click(); await page.waitForTimeout(1200); }
  }
  await zamknijOnboardingJesliJest();
  const searchToggle = page.locator('button[aria-label="Szukaj"]');
  if (await searchToggle.count()) {
    const expanded = await searchToggle.first().getAttribute('aria-expanded');
    if (expanded !== 'true') { await searchToggle.first().click(); await page.waitForTimeout(500); }
  }
  const search = page.locator('#modulehub-command-search');
  await search.waitFor({ timeout: 10000 });
  await search.fill(pelnaNazwa);
  await page.waitForTimeout(1800);
  await zamknijOnboardingJesliJest();
  const wiersz = page.locator('table tbody tr, [role="row"]', { hasText: pelnaNazwa }).first();
  await wiersz.waitFor({ timeout: 15000 });
  await wiersz.click();
  await page.waitForTimeout(2000);
  await zamknijOnboardingJesliJest();
}

async function kliknijAkcje(testId) {
  await zamknijOnboardingJesliJest();
  const przycisk = page.locator(`[data-testid="${testId}"]`);
  await przycisk.waitFor({ timeout: 15000 });
  await przycisk.scrollIntoViewIfNeeded();
  const disabled = await przycisk.isDisabled().catch(() => null);
  if (!disabled) await przycisk.click({ force: true });
  return disabled;
}
async function kliknijAkcjeZPowodem(testId, powod) {
  await zamknijOnboardingJesliJest();
  const przycisk = page.locator(`[data-testid="${testId}"]`);
  await przycisk.waitFor({ timeout: 15000 });
  await przycisk.scrollIntoViewIfNeeded();
  await przycisk.click({ force: true });
  await page.waitForTimeout(800);
  const poleP = page.locator('[data-testid="initiative-reason-input"]');
  await poleP.waitFor({ timeout: 10000 });
  await poleP.fill(powod);
  await page.waitForTimeout(400);
  const potwierdzBtn = page.locator('[data-testid="initiative-reason-confirm"]');
  await potwierdzBtn.click({ force: true });
  await page.waitForTimeout(2500);
}

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_ADMIN, locale: 'pl-PL' });
  page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });
  page.on('response', (r) => { logApi(r); });

  await ustawMotywJasny();

  console.log('=== stan poczatkowy w bazie ===');
  console.log('DRAFT:', stanInicjatywy(DRAFT_ID));
  console.log('HOLD :', stanInicjatywy(HOLD_ID));

  console.log('=== 10: DRAFT — podglad poczatkowy (jako ADMIN, NIE autor) ===');
  konsola.length = 0;
  await otworzWedlugNazwy(DRAFT_NAZWA);
  await zrzut('10-lancuch-01-draft-start', `Podglad DRAFT "${DRAFT_NAZWA}" — ADMIN, ale NIE autor inicjatywy (created_by=Piotr) — oczekiwane "Nie masz uprawnien" (authorOnly), NIE regres`, { stanBazy: stanInicjatywy(DRAFT_ID) });

  console.log('=== 10b: tymczasowe uczynienie audyt-admina autorem (SQL), zeby przetestowac SAM MECHANIZM lancucha ===');
  oryginalnyAutorDraft = sql(`SELECT created_by FROM initiatives WHERE id='${DRAFT_ID}'`);
  console.log('  oryginalny created_by:', oryginalnyAutorDraft);
  sqlExec(`UPDATE initiatives SET created_by='audyt-dbr77-admin-20260908', updated_at=now() WHERE id='${DRAFT_ID}'`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await zamknijOnboardingJesliJest();
  await otworzWedlugNazwy(DRAFT_NAZWA);
  await zrzut('10b-lancuch-01b-draft-jako-autor', `Ta sama inicjatywa, created_by tymczasowo=audyt-admin (test mechanizmu) — Przeslij do zatwierdzenia powinno byc widoczne`, { stanBazy: stanInicjatywy(DRAFT_ID) });

  console.log('=== 11: Przeslij do zatwierdzenia ===');
  const disabledPrzeslij = await kliknijAkcje('initiative-lifecycle-transition:PENDING_APPROVAL');
  console.log('  disabled przed klikiem:', disabledPrzeslij);
  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await zamknijOnboardingJesliJest();
  await otworzWedlugNazwy(DRAFT_NAZWA);
  await zrzut('11-lancuch-02-po-przeslaniu', `Po "Przeslij do zatwierdzenia" (disabled=${disabledPrzeslij})`, { stanBazy: stanInicjatywy(DRAFT_ID) });

  console.log('=== 12: Zatwierdz — oczekiwana blokada ===');
  const zatwBtn = page.locator('[data-testid="initiative-lifecycle-transition:APPROVED"]');
  const zatwCount = await zatwBtn.count();
  let zatwDisabled = null;
  let zatwPowod = '(przycisk nie istnieje w ogole)';
  if (zatwCount) {
    zatwDisabled = await zatwBtn.isDisabled().catch(() => null);
    if (zatwDisabled) {
      zatwPowod = await page.locator('[data-testid="initiative-lifecycle-reason-transition:APPROVED"]').textContent().catch(() => '(brak powodu na ekranie)');
    }
  }
  console.log('  "Zatwierdz" — disabled:', zatwDisabled, 'powod:', zatwPowod);
  await zrzut('12-lancuch-03-zatwierdz-zablokowany', `"Zatwierdz inicjatywe" — disabled=${zatwDisabled}. Powod: ${zatwPowod}`, { stanBazy: stanInicjatywy(DRAFT_ID) });

  console.log('=== 13: przywrocenie DRAFT + oryginalnego autora po dowodzie (SQL) ===');
  const przedPrzywroceniem = stanInicjatywy(DRAFT_ID);
  const autorSql = oryginalnyAutorDraft ? `'${oryginalnyAutorDraft}'` : 'NULL';
  sqlExec(`UPDATE initiatives SET status='DRAFT', created_by=${autorSql}, updated_at=now() WHERE id='${DRAFT_ID}'`);
  console.log(`  przywrocono status: ${przedPrzywroceniem} -> ${stanInicjatywy(DRAFT_ID)}, created_by -> ${oryginalnyAutorDraft || '(NULL)'}`);

  console.log('=== 20: HOLD/RESUME na IN_EXECUTION ===');
  konsola.length = 0;
  await otworzWedlugNazwy(HOLD_NAZWA);
  await zrzut('20-hold-01-in-execution-start', `Podglad IN_EXECUTION "${HOLD_NAZWA}" przed Wstrzymaj`, { stanBazy: stanInicjatywy(HOLD_ID) });

  console.log('=== 21: Wstrzymaj (z powodem) ===');
  await kliknijAkcjeZPowodem('initiative-lifecycle-flag:HOLD', 'Przeglad DBR77 — dowod dzialania flagi HOLD/RESUME (cofniete po zrzucie).');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await zamknijOnboardingJesliJest();
  await otworzWedlugNazwy(HOLD_NAZWA);
  await zrzut('21-hold-02-wstrzymana', 'Po "Wstrzymaj" i odswiezeniu — pigulka "Wstrzymana"', { stanBazy: stanInicjatywy(HOLD_ID) });

  console.log('=== 22: Wznow ===');
  const disabledWznow = await kliknijAkcje('initiative-lifecycle-flag:RESUME');
  console.log('  disabled przed klikiem Wznow:', disabledWznow);
  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await zamknijOnboardingJesliJest();
  await otworzWedlugNazwy(HOLD_NAZWA);
  await zrzut('22-hold-03-wznowiona', 'Po "Wznow" i odswiezeniu — z powrotem "W realizacji"', { stanBazy: stanInicjatywy(HOLD_ID) });

  const stanKoncowyHold = stanInicjatywy(HOLD_ID);
  if (!/^IN_EXECUTION\|f$/.test(stanKoncowyHold)) {
    console.log('  UWAGA: stan koncowy HOLD nie wrocil do bazowego, przywracam SQL-em:', stanKoncowyHold);
    sqlExec(`UPDATE initiatives SET on_hold=false, status='IN_EXECUTION', updated_at=now() WHERE id='${HOLD_ID}'`);
  }
  console.log('  stan koncowy po chain B:', stanInicjatywy(HOLD_ID));

  console.log('=== 30: zakladka Plan ===');
  konsola.length = 0;
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await zamknijOnboardingJesliJest();
  const planTab = page.getByRole('tab', { name: /^Plan$/ });
  await planTab.click();
  await page.waitForTimeout(3000);
  await zamknijOnboardingJesliJest();
  await zrzut('30-plan-lista', 'Zakladka Plan — lista planow DBR77');

  console.log('=== 31: LLM providers health (kontekst dla generatora) ===');
  const health = execSync(`curl -s -m 10 -H "Authorization: Bearer ${JSON.parse(fs.readFileSync('/private/tmp/wt-rev-ini/auth-audyt.json','utf8')).token}" http://127.0.0.1:4168/api/llm/providers/health`, { encoding: 'utf8' });
  fs.writeFileSync(`${OUT}/31-llm-health.json`, health);
  console.log('  overall:', JSON.parse(health).overall);

  console.log('=== 32: "Nowy plan" — czy otwiera formularz ===');
  const nowyPlanBtn = page.getByText('Nowy plan', { exact: false }).first();
  const nowyPlanIstnieje = await nowyPlanBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (nowyPlanIstnieje) {
    await nowyPlanBtn.click({ force: true });
    await page.waitForTimeout(2000);
    await zamknijOnboardingJesliJest();
    await zrzut('32-plan-nowy-formularz', '"Nowy plan" kliknieto — formularz/generator');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    console.log('  BRAK przycisku "Nowy plan" w widoku');
  }

  console.log('=== 40: zakladka Obciazenie ===');
  konsola.length = 0;
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await zamknijOnboardingJesliJest();
  const capacityTab = page.getByRole('tab', { name: /Obci.*enie/ });
  await capacityTab.click();
  await page.waitForTimeout(3000);
  await zamknijOnboardingJesliJest();
  await zrzut('40-obciazenie-lista', 'Zakladka Obciazenie — lista analiz DBR77');

  console.log('=== 50: para negatywna MEMBER ===');
  await context.close();
  const contextMember = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH_MEMBER, locale: 'pl-PL' });
  page = await contextMember.newPage();
  konsola.length = 0;
  page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });
  page.on('response', (r) => { logApi(r); });
  await ustawMotywJasny();
  await otworzWedlugNazwy(HOLD_NAZWA);
  await page.waitForTimeout(1200);
  await zrzut('50-member-brak-przyciskow', `Konto MEMBER — podglad "${HOLD_NAZWA}" — sprawdz brak przyciskow zarzadzania`);
  await contextMember.close();

  await browser.close();
  fs.writeFileSync(`${OUT}/api-log-B.txt`, apiLogLines.join('\n\n') + '\n');
  console.log('GOTOWE scenariusz B.');
}

main().catch(async (err) => {
  console.error('AWARIA GLOWNA B:', err);
  try {
    if (page) await zrzut('99-awaria-glowna-B', `Nieprzechwycony blad: ${String(err?.message || err).slice(0, 300)}`);
  } catch (e2) { console.error('zrzut awarii nie powiodl sie:', e2); }
  try { if (browser) await browser.close(); } catch (e4) {}
  // bezpieczne przywrocenie stanu bazy w razie awarii w polowie lancucha
  try {
    const autorSql = oryginalnyAutorDraft ? `'${oryginalnyAutorDraft}'` : 'NULL';
    sqlExec(`UPDATE initiatives SET status='DRAFT', created_by=${autorSql}, updated_at=now() WHERE id='${DRAFT_ID}'`);
    sqlExec(`UPDATE initiatives SET on_hold=false, status='IN_EXECUTION', updated_at=now() WHERE id='${HOLD_ID}' AND (on_hold=true OR status<>'IN_EXECUTION')`);
  } catch (e3) { console.error('przywrocenie bazy nie powiodlo sie:', e3); }
  fs.writeFileSync(`${OUT}/api-log-B.txt`, apiLogLines.join('\n\n') + '\n');
  process.exitCode = 1;
});
