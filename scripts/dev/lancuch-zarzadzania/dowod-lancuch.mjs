#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — lancuch zarzadzania inicjatywa (DEC-424) na zywo.
 *
 * Klika dokladnie to, co klika czlowiek: Inicjatywy -> wiersz -> sekcja
 * "Etap inicjatywy" -> przycisk przejscia/flagi -> (czasem) okno powodu.
 * Po kazdym zapisie odswieza strone i sprawdza w bazie, czy stan przetrwal.
 *
 * Uzycie:
 *   node scripts/dev/lancuch-zarzadzania/dowod-lancuch.mjs [BASE] [AUTH_ADMIN] [AUTH_MEMBER] [OUT]
 *
 * Argumenty maja sensowne wartosci domyslne (patrz DEFAULTS ponizej) — mozna
 * uruchomic bez niczego.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const SCRATCH =
  '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';

const rawArgs = process.argv.slice(2);
const flagOd = rawArgs.find((a) => a.startsWith('--od='));
const OD = flagOd ? Number(flagOd.slice('--od='.length)) : 1;
const positional = rawArgs.filter((a) => !a.startsWith('--'));
const [argBase, argAdmin, argMember, argOut] = positional;
const BASE = argBase || 'http://localhost:3160';
const AUTH_ADMIN = argAdmin || `${SCRATCH}/auth-audyt.json`;
const AUTH_MEMBER = argMember || `${SCRATCH}/auth-anna.json`;
const OUT = argOut || '/private/tmp/wt-fable-inicjatywy/evidence/lancuch-zarzadzania';

const ORG_ID = 'cc9db573-260f-4a19-927f-f3cc1fbaea38';
const ADMIN_USER_ID = '76015d70-9117-444f-97a6-4f5eda9d7ad5';
const INI_GLOWNA = 'proba-lancuch-20260907';
const INI_ROLA = 'proba-lancuch-rola';

fs.mkdirSync(OUT, { recursive: true });

const DB = 'consultify_fable';
function sql(query) {
  const escaped = query.replace(/'/g, "'\\''");
  const out = execSync(
    `docker exec consultify-noc-pg psql -U postgres -d ${DB} -Atc '${escaped}'`,
    { encoding: 'utf8' }
  );
  return out.trim();
}
function sqlExec(query) {
  // Dla wielo-instrukcyjnych DELETE/UPDATE bez oczekiwania na jedna kolumne wyniku.
  const escaped = query.replace(/'/g, "'\\''");
  execSync(`docker exec consultify-noc-pg psql -U postgres -d ${DB} -v ON_ERROR_STOP=1 -c '${escaped}'`, {
    encoding: 'utf8',
  });
}

function statusWBazie(id) {
  const row = sql(
    `SELECT status || '|' || on_hold::text FROM initiatives WHERE id='${id}'`
  );
  const [status, onHold] = row.split('|');
  return { status: status || '(brak)', onHold: onHold === 't' || onHold === 'true' };
}

// Wiersz w initiative_lifecycle_gate_decisions jest NIEMUTOWALNY (trigger
// `initiative_lifecycle_gate_decisions_immutable` odrzuca kazdy UPDATE/DELETE).
// Na potrzeby powtarzalnosci dowodu (reset na starcie, sprzatanie na koncu)
// tymczasowo wylaczamy ten trigger — tylko na naszej prywatnej kopii bazy
// (consultify_fable) i tylko na czas jednej operacji sprzatajacej.
function bezNiemutowalnosciDecyzji(fn) {
  sqlExec(
    `ALTER TABLE initiative_lifecycle_gate_decisions DISABLE TRIGGER initiative_lifecycle_gate_decisions_immutable`
  );
  try {
    fn();
  } finally {
    sqlExec(
      `ALTER TABLE initiative_lifecycle_gate_decisions ENABLE TRIGGER initiative_lifecycle_gate_decisions_immutable`
    );
  }
}

// --- KROK 0: reset stanu poczatkowego inicjatywy glownej -------------------
// UWAGA (naprawa 07.09 v2): baza jest CZYSTA (0 wierszy proba-lancuch-%) —
// wiersz INI_GLOWNA NIE istnieje z gory (poprzedni przebieg skasowal go w
// sprzataniu koncowym, bo skrypt tylko go UPDATE'owal, nigdy nie tworzyl).
// Skrypt musi sam go zasiac: DELETE (na wypadek wznowienia) + INSERT od zera.
function resetInicjatywaGlowna() {
  bezNiemutowalnosciDecyzji(() => {
    sqlExec(`DELETE FROM initiative_lifecycle_gate_decisions WHERE initiative_id='${INI_GLOWNA}'`);
  });
  sqlExec(`DELETE FROM initiative_handoffs WHERE initiative_id='${INI_GLOWNA}'`);
  sqlExec(`DELETE FROM initiative_milestones WHERE initiative_id='${INI_GLOWNA}'`);
  sqlExec(`DELETE FROM initiative_status_history WHERE initiative_id='${INI_GLOWNA}'`);
  sqlExec(`DELETE FROM initiative_history WHERE initiative_id='${INI_GLOWNA}'`);
  // Lancuch FK decyzji GO (transformation_cases -> v8_agent_proposal_versions ->
  // v8_agent_proposal_scope_reviews) — resztki po poprzednim biegu.
  sqlExec(`DELETE FROM v8_agent_proposal_scope_reviews WHERE review_id='proba-lancuch-receipt'`);
  sqlExec(
    `DELETE FROM v8_agent_proposal_versions WHERE proposal_version_id='proba-lancuch-propver-1'`
  );
  sqlExec(`DELETE FROM transformation_cases WHERE transformation_case_id='proba-lancuch-case'`);
  sqlExec(`DELETE FROM initiatives WHERE id='${INI_GLOWNA}'`);
  // Nazwa MUSI byc rozlaczna od nazwy inicjatywy "roli" (krok 15) — kolizja
  // lokatora hasText w przebiegu 1 (obie zawieraly "PRÓBA ŁAŃCUCHA 07.09").
  sqlExec(
    `INSERT INTO initiatives (id, organization_id, project_id, name, title, status, created_by, description, created_at, updated_at) VALUES (` +
      `'${INI_GLOWNA}', '${ORG_ID}', '11111111-2222-4333-8444-555555555555', 'PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania', ` +
      `'PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania', 'DRAFT', '${ADMIN_USER_ID}', ` +
      // Opis jest częścią warunku CARD_COMPLETE — bez niego krok 02 nigdy nie aktywuje przycisku
      // (przebieg 2 stanął dokładnie na tym: INSERT bez description, PATCH nigdy nie poszedł).
      `'Inicjatywa próbna do dowodu łańcucha statusów (szkic → do zatwierdzenia → zatwierdzona → w realizacji → zamknięta).', now(), now())`
  );
}

// Decyzja GO wymaga trzech wierszy nadrzednych (FK, NOT NULL): sprawy
// transformacji, wersji propozycji agenta i jej recenzji zakresu. Tresc tych
// wierszy jest bez znaczenia dla warunku merytorycznego (kod serwera sprawdza
// tylko decision_status/deadline_at/version na samej decyzji) — istnieja
// wylacznie zeby FK nie odrzucil zapisu. Wszystkie id z prefiksem
// `proba-lancuch-`, sprzatane na koncu.
function wstawPrerekwizytyDecyzjiGo() {
  sqlExec(
    `INSERT INTO transformation_cases (
       transformation_case_id, organization_id, initiated_by_user_id, mandate,
       lineage_id, idempotency_key
     ) VALUES (
       'proba-lancuch-case', '${ORG_ID}', '${ADMIN_USER_ID}', 'Dowod na zywo — lancuch zarzadzania inicjatywa',
       'proba-lancuch-lineage', 'proba-lancuch-tc-idem'
     )`
  );
  sqlExec(
    `INSERT INTO v8_agent_proposal_versions (
       proposal_version_id, proposal_id, organization_id, canonical_run_id,
       proposal_version, plan_version, context_digest, before_json, after_json,
       approval_scopes_json, reviewer_authority_json, expires_at, status, created_by_user_id
     ) VALUES (
       'proba-lancuch-propver-1', 'proba-lancuch-prop-1', '${ORG_ID}', 'proba-lancuch-run-1',
       1, 1, 'proba-lancuch-digest', '{}'::jsonb, '{}'::jsonb,
       '[]'::jsonb, '{}'::jsonb, now() + interval '30 days', 'approved', '${ADMIN_USER_ID}'
     )`
  );
  sqlExec(
    `INSERT INTO v8_agent_proposal_scope_reviews (
       review_id, proposal_version_id, scope_key, decision, reason, reviewed_by_user_id
     ) VALUES (
       'proba-lancuch-receipt', 'proba-lancuch-propver-1', 'proba-lancuch-authority',
       'approved', 'Dowod na zywo — recenzja zakresu', '${ADMIN_USER_ID}'
     )`
  );
}

function wstawDecyzjeGo() {
  wstawPrerekwizytyDecyzjiGo();
  sqlExec(
    `INSERT INTO initiative_lifecycle_gate_decisions (
       decision_id,organization_id,initiative_id,transformation_case_id,pmo_domain,
       version,decision_status,source_digest,source_case_version,baseline_refs_json,
       a05_proposal_version_id,a05_approval_receipt_ref,human_actor_user_id,
       human_authority_ref,rationale,deadline_at,idempotency_key,input_digest,
       supersedes_decision_id,decided_at
     ) VALUES (
       'proba-lancuch-go-1','${ORG_ID}','${INI_GLOWNA}','proba-lancuch-case','GOVERNANCE_DECISION_MAKING',
       1,'approved','${'a'.repeat(64)}',1,'["proba-lancuch-baseline"]'::jsonb,
       'proba-lancuch-propver-1','proba-lancuch-receipt','${ADMIN_USER_ID}',
       'proba-lancuch-authority','Dowod na zywo — decyzja GO', now() + interval '30 days',
       'proba-lancuch-idem-1','${'b'.repeat(64)}',
       NULL, now()
     )`
  );
}

function wstawHandoffIDaty() {
  sqlExec(
    `UPDATE initiatives SET planned_start_date=current_date::text, ` +
      `planned_end_date=(current_date + 90)::text WHERE id='${INI_GLOWNA}'`
  );
  sqlExec(
    `INSERT INTO initiative_handoffs (
       id,organization_id,initiative_id,from_status,to_status,boundary,from_module,to_module,
       readiness_allowed,readiness_missing,readiness_reasons,actor_id,created_at
     ) VALUES (
       'proba-lancuch-handoff-1','${ORG_ID}','${INI_GLOWNA}','APPROVED','IN_EXECUTION',
       'INITIATIVES_TO_EXECUTION','initiatives','execution',
       TRUE, NULL, NULL, '${ADMIN_USER_ID}', now()
     )`
  );
  sqlExec(
    `INSERT INTO initiative_milestones (
       id, initiative_id, organization_id, name, target_date, status, order_index, is_gate
     ) VALUES (
       'proba-lancuch-ms-1', '${INI_GLOWNA}', '${ORG_ID}', 'Kamień próbny', current_date + 30, 'PLANNED', 1, 0
     )`
  );
}

function wstawInicjatyweRola() {
  sqlExec(`DELETE FROM initiatives WHERE id='${INI_ROLA}'`);
  const cols = sql(
    `SELECT string_agg(column_name, ',') FROM information_schema.columns WHERE table_name='initiatives'`
  );
  // Wstawiamy minimalny zestaw kolumn, ktore na pewno istnieja (sprawdzone wyzej).
  sqlExec(
    `INSERT INTO initiatives (id, organization_id, name, title, status, created_by, owner_business_id, description) ` +
      `VALUES ('${INI_ROLA}', '${ORG_ID}', 'PRÓBA ROLI 07.09 — bez uprawnień', 'PRÓBA ROLI 07.09 — bez uprawnień', 'PENDING_APPROVAL', '${ADMIN_USER_ID}', '${ADMIN_USER_ID}', 'Dowod na zywo — para negatywna roli')`
  );
}

function sprzataniaKoncowe() {
  const ids = [INI_GLOWNA, INI_ROLA];
  const idList = ids.map((i) => `'${i}'`).join(',');
  const tablesRaw = sql(
    `SELECT string_agg(table_name, '|') FROM information_schema.columns WHERE column_name='initiative_id'`
  );
  const tables = Array.from(new Set((tablesRaw || '').split('|').filter(Boolean)));
  bezNiemutowalnosciDecyzji(() => {
    for (const table of tables) {
      try {
        sqlExec(`DELETE FROM ${table} WHERE initiative_id IN (${idList})`);
      } catch (e) {
        console.log(`  (pominieto ${table}: ${String(e.message || e).slice(0, 120)})`);
      }
    }
  });
  // Lancuch FK decyzji GO (kolejnosc: dziecko -> rodzic -> dziadek).
  try {
    sqlExec(`DELETE FROM v8_agent_proposal_scope_reviews WHERE review_id='proba-lancuch-receipt'`);
  } catch (e) {
    console.log(`  (pominieto v8_agent_proposal_scope_reviews: ${String(e.message || e).slice(0, 120)})`);
  }
  try {
    sqlExec(
      `DELETE FROM v8_agent_proposal_versions WHERE proposal_version_id='proba-lancuch-propver-1'`
    );
  } catch (e) {
    console.log(`  (pominieto v8_agent_proposal_versions: ${String(e.message || e).slice(0, 120)})`);
  }
  try {
    sqlExec(`DELETE FROM transformation_cases WHERE transformation_case_id='proba-lancuch-case'`);
  } catch (e) {
    console.log(`  (pominieto transformation_cases: ${String(e.message || e).slice(0, 120)})`);
  }
  try {
    sqlExec(`DELETE FROM initiatives WHERE id IN (${idList})`);
  } catch (e) {
    console.log(`  (pominieto initiatives: ${String(e.message || e).slice(0, 120)})`);
  }
}

// --- Playwright harness ------------------------------------------------
const konsola = [];
const apiLogLines = [];

function logApi(response) {
  const u = response.url();
  if (!/\/api\/initiatives\/.*(status|lifecycle-flag|transition-preflight)/i.test(u)) return;
  return response
    .text()
    .catch(() => '(brak ciala)')
    .then((body) => {
      apiLogLines.push(
        `${new Date().toISOString()} ${response.request().method()} ${response.status()} ${u.replace(BASE, '')}\n    ${body.slice(0, 300)}`
      );
    });
}

let page;
let context;

// Przed KAZDYM zrzutem podgladu przewijamy sekcje "Etap inicjatywy" do widoku
// (jesli jest na ekranie) — inaczej powod blokady (initiative-lifecycle-reason-*)
// bywa ucziety poza fold (defekt zrzutow 01/04/07 w przebiegu 1).
async function przewinSekcjeEtapu() {
  try {
    const sekcja = page
      .getByTestId('initiative-lifecycle-actions')
      .or(page.getByTestId('initiative-lifecycle-empty'))
      .or(page.getByTestId('initiative-lifecycle-terminal'))
      .first();
    const widoczna = await sekcja.isVisible({ timeout: 1000 }).catch(() => false);
    if (widoczna) {
      await sekcja.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
  } catch {
    // brak sekcji na ekranie (np. lista bez otwartego podgladu) — pomijamy.
  }
}

async function zrzut(nazwa, opis, extra = {}) {
  await przewinSekcjeEtapu();
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  const stanBazy = extra.pomijStatusWBazie ? null : statusWBazie(INI_GLOWNA);
  const dane = {
    nazwa,
    opis,
    url: page.url(),
    statusWBazie: stanBazy,
    bledyKonsoli: [...konsola],
    czas: new Date().toISOString(),
    ...extra,
  };
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify(dane, null, 2));
  console.log(
    `ZRZUT ${nazwa}: ${sciezka} (url=${page.url()}, bledyKonsoli=${konsola.length}, statusWBazie=${JSON.stringify(stanBazy)})`
  );
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
  await page.waitForTimeout(1000);
  await zamknijOnboardingJesliJest();
}

// Onboarding "Poznaj Teresę" (Krok 1 z 3) blokuje klikanie w tabeli backdrop-blur
// nakladka — pojawia sie dla kont, ktore nigdy go nie zamknely (np. swiezy login
// Anny). Zamykamy przyciskiem "Pomiń na razie", jesli jest widoczny; brak modala
// nie jest bledem.
async function zamknijOnboardingJesliJest() {
  const pomin = page.getByText('Pomiń na razie', { exact: true });
  const widoczny = await pomin.first().isVisible({ timeout: 2000 }).catch(() => false);
  if (widoczny) {
    await pomin.first().click({ force: true });
    await page.waitForTimeout(500);
  }
}

async function otworzWierszInicjatyw(nazwaSzukana) {
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await zamknijOnboardingJesliJest();
  const wiersz = page.locator('table tbody tr', { hasText: nazwaSzukana }).first();
  await wiersz.waitFor({ timeout: 20000 });
  await wiersz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await wiersz.click();
  await page.waitForTimeout(2500);
}

async function otworzWierszRealizacji(nazwaSzukana) {
  await page.goto(`${BASE}/execution`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await zamknijOnboardingJesliJest();
  const wiersz = page.locator('table tbody tr', { hasText: nazwaSzukana }).first();
  await wiersz.waitFor({ timeout: 20000 });
  await wiersz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await wiersz.click();
  await page.waitForTimeout(2500);
}

async function kliknijAkcje(testId) {
  const przycisk = page.locator(`[data-testid="${testId}"]`);
  await przycisk.waitFor({ timeout: 15000 });
  await przycisk.scrollIntoViewIfNeeded();
  const disabled = await przycisk.isDisabled().catch(() => null);
  await przycisk.click({ force: true });
  return disabled;
}

async function main() {
  const browser = await chromium.launch();

  // ============= KONTEKST ADMIN ==============
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    storageState: AUTH_ADMIN,
    locale: 'pl-PL',
  });
  page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') konsola.push(m.text().slice(0, 300));
  });
  page.on('response', (r) => {
    logApi(r);
  });

  if (OD <= 1) {
    console.log('=== KROK 0: reset stanu bazy ===');
    resetInicjatywaGlowna();
    sqlExec(`DELETE FROM initiatives WHERE id='${INI_ROLA}'`);
  } else {
    console.log(`=== WZNOWIENIE od kroku ${OD} — pomijam reset i kroki 1-13 (juz DOBRE w evidence/) ===`);
    try {
      const prevApiLog = fs.readFileSync(`${OUT}/api-log.txt`, 'utf8');
      if (prevApiLog.trim()) apiLogLines.push(prevApiLog.trim());
    } catch {
      console.log('  (brak wczesniejszego api-log.txt do zachowania — zaczynam od pusta)');
    }
  }

  await ustawMotywJasny();

  if (OD <= 1) {
    // ---- 1. SZKIC — warunek niespelniony (karta niekompletna) ----
    console.log('=== 01: szkic, warunek niespelniony ===');
    konsola.length = 0;
    await otworzWierszInicjatyw('PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania');
    await zrzut('01-szkic-warunek-niespelniony', 'Inicjatywy -> wiersz -> "Prześlij do zatwierdzenia" nieaktywny, powod: karta niekompletna');

    // ---- 2. Uzupelniamy karte (owner + scope), reload, sprawdzamy aktywacje ----
    console.log('=== 02: karta uzupelniona ===');
    sqlExec(
      `UPDATE initiatives SET owner_business_id='${ADMIN_USER_ID}', scope_in='Raportowanie miesięczne' WHERE id='${INI_GLOWNA}'`
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await otworzWierszInicjatyw('PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania');
    await zrzut('02-szkic-gotowy', 'Karta uzupelniona (wlasciciel + zakres) — przycisk "Prześlij do zatwierdzenia" aktywny');

    const disabledPrzeslij = await kliknijAkcje('initiative-lifecycle-transition:PENDING_APPROVAL');
    console.log('  klik "Prześlij do zatwierdzenia" — disabled przed klikiem:', disabledPrzeslij);
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await otworzWierszInicjatyw('PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania');
    await zrzut('03-do-zatwierdzenia', 'Po odswiezeniu — status "Do zatwierdzenia" utrzymal sie w bazie');

    // ---- 3. Zatwierdz — brak decyzji GO ----
    console.log('=== 04: zatwierdz, brak decyzji GO ===');
    await zrzut('04-zatwierdz-brak-decyzji-go', '"Zatwierdź inicjatywę" nieaktywny — brak aktualnej decyzji GO; "Zwróć do szkicu"/"Odrzuć" aktywne');

    wstawDecyzjeGo();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await otworzWierszInicjatyw('PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania');
    await zrzut('05-zatwierdz-aktywny', 'Po wstawieniu decyzji GO — "Zatwierdź inicjatywę" aktywny');

    await kliknijAkcje('initiative-lifecycle-transition:APPROVED');
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await otworzWierszInicjatyw('PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania');
    await zrzut('06-zatwierdzona', 'Po odswiezeniu — status "Zatwierdzona" utrzymal sie w bazie');

    // ---- 4. Start realizacji — brak handoffu ----
    console.log('=== 07: start, brak handoffu ===');
    await zrzut('07-start-brak-handoffu', '"Rozpocznij realizację" nieaktywny — brak handoffu/terminu startu');

    wstawHandoffIDaty();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await otworzWierszInicjatyw('PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania');
    await zrzut('08-start-aktywny', 'Po wstawieniu handoffu i dat — "Rozpocznij realizację" aktywny');

    await kliknijAkcje('initiative-lifecycle-transition:IN_EXECUTION');
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await otworzWierszInicjatyw('PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania');
    await zrzut('09-w-realizacji', 'Po odswiezeniu, w Inicjatywach — status "W realizacji" utrzymal sie w bazie');

    // ---- 5. Realizacja — podglad, wstrzymanie, wznowienie ----
    console.log('=== 10: realizacja, podglad ===');
    await otworzWierszRealizacji('PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania');
    await zrzut('10-realizacja-podglad', 'Ekran Realizacja -> wiersz -> podglad z "Zamknij inicjatywę" i "Wstrzymaj realizację"');

    console.log('=== 11: okno powodu (wstrzymanie) ===');
    const wstrzymajBtn = page.locator('[data-testid="initiative-lifecycle-flag:HOLD"]');
    await wstrzymajBtn.waitFor({ timeout: 15000 });
    await wstrzymajBtn.scrollIntoViewIfNeeded();
    await wstrzymajBtn.click({ force: true });
    await page.waitForTimeout(1200);
    await zrzut('11-okno-powodu', 'Okno powodu dla wstrzymania — pole puste, potwierdzenie nieaktywne', { pomijStatusWBazie: true });

    const poleP = page.locator('[data-testid="initiative-reason-input"]');
    await poleP.waitFor({ timeout: 10000 });
    await poleP.fill('Czekamy na decyzję budżetową');
    await page.waitForTimeout(400);
    const potwierdzBtn = page.locator('[data-testid="initiative-reason-confirm"]');
    await potwierdzBtn.click({ force: true });
    await page.waitForTimeout(2500);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await otworzWierszRealizacji('PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania');
    await zrzut('12-wstrzymana', 'Po odswiezeniu — widac "Wznów realizację" (on_hold=true w bazie)');

    await kliknijAkcje('initiative-lifecycle-flag:RESUME');
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await otworzWierszRealizacji('PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania');
    await zrzut('13-wznowiona', 'Po odswiezeniu — "Wznów realizację" zadzialalo (on_hold=false)');

    // ---- 6. Zamkniecie ----
    console.log('=== 14: zamkniecie ===');
    const zamknijBtn = page.locator('[data-testid="initiative-lifecycle-transition:CLOSED"]');
    const zamknijDisabled = await zamknijBtn.isDisabled().catch(() => null);
    if (zamknijDisabled) {
      const powod = await page
        .locator('[data-testid="initiative-lifecycle-reason-transition:CLOSED"]')
        .textContent()
        .catch(() => '(brak powodu na ekranie)');
      console.log('  "Zamknij inicjatywę" NIEAKTYWNY. Powod:', powod);
      await zrzut('14a-zamknij-zablokowany', `"Zamknij inicjatywę" nieaktywny. Powod: ${powod}`);
    } else {
      await zamknijBtn.click({ force: true });
      await page.waitForTimeout(2500);
    }
  }

  if (OD <= 14) {
    // ---- 6b. Gdzie widac zamknieta inicjatywe (krok 14, po awarii poprzedniego przebiegu) ----
    console.log('=== 14: gdzie widac zamknieta inicjatywe ===');
    konsola.length = 0;
    await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await zamknijOnboardingJesliJest();
    const wierszDomyslny = page.locator('table tbody tr', { hasText: 'PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania' }).first();
    const widocznyDomyslnie = await wierszDomyslny.isVisible().catch(() => false);
    console.log('  Wiersz widoczny w domyslnym zakresie "Aktywne"?', widocznyDomyslnie);
    if (!widocznyDomyslnie) {
      await zrzut(
        '14a-zamknieta-brak-w-aktywnych',
        'Zakres "Aktywne" (domyslny filtr listy) — zamknieta inicjatywa NIE jest widoczna na liscie Inicjatyw'
      );
      const przelacznikWszystkie = page.getByRole('radio', { name: 'Wszystkie' });
      const jestPrzelacznik = await przelacznikWszystkie.isVisible().catch(() => false);
      if (jestPrzelacznik) {
        await przelacznikWszystkie.click();
        await page.waitForTimeout(2000);
      }
    }
    const wierszWszystkie = page.locator('table tbody tr', { hasText: 'PRÓBA ŁAŃCUCHA 07.09 — automatyzacja raportowania' }).first();
    let znalezionoWWszystkich = false;
    try {
      await wierszWszystkie.waitFor({ timeout: 15000 });
      znalezionoWWszystkich = true;
    } catch {
      znalezionoWWszystkich = false;
    }
    if (znalezionoWWszystkich) {
      await wierszWszystkie.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await wierszWszystkie.click();
      await page.waitForTimeout(2000);
      await zrzut(
        '14-zamknieta',
        'Zakres "Wszystkie" -> wiersz zamknietej inicjatywy -> podglad: pill "Zamknięta", sekcja "Etap inicjatywy" bez przyciskow przejsc (status terminalny)'
      );
    } else {
      console.log('  Wiersz NIE znaleziony nawet w zakresie "Wszystkie" — lista w ogole nie pokazuje zamknietych.');
      await zrzut(
        '14-zamknieta-brak-na-liscie',
        'Lista Inicjatyw (zakres "Wszystkie") nie pokazuje zamknietej inicjatywy',
        { pomijStatusWBazie: true }
      );
      await page.goto(`${BASE}/results`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      await zrzut(
        '14b-wyniki-zamknieta',
        'Modul Wyniki (/results) — sprawdzenie czy zamknieta inicjatywa jest tam widoczna, zgodnie z tablica DEC-424',
        { pomijStatusWBazie: true }
      );
    }
  }

  // ---- 7. Para negatywna ROLA ----
  console.log('=== 15: para negatywna rola ===');
  wstawInicjatyweRola();
  await context.close();

  const contextMember = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    storageState: AUTH_MEMBER,
    locale: 'pl-PL',
  });
  page = contextMember.newPage ? await contextMember.newPage() : page;
  konsola.length = 0;
  page.on('console', (m) => {
    if (m.type() === 'error') konsola.push(m.text().slice(0, 300));
  });
  page.on('response', (r) => {
    logApi(r);
  });

  await ustawMotywJasny();
  await otworzWierszInicjatyw('PRÓBA ROLI 07.09 — bez uprawnień');
  await page.waitForTimeout(1500);
  await zrzut('15-rola-brak-przycisku', 'Konto MEMBER bez roli w inicjatywach — sekcja pokazuje "Nie masz uprawnień..." (initiative-lifecycle-empty), zero przyciskow przejsc', { pomijStatusWBazie: true });

  await contextMember.close();

  // ---- 8. Sprzatanie ----
  console.log('=== 16: sprzatanie ===');
  sprzataniaKoncowe();

  await browser.close();

  fs.writeFileSync(`${OUT}/api-log.txt`, apiLogLines.join('\n\n') + '\n');
  console.log('\n=== API LOG (initiatives status/lifecycle-flag/transition-preflight) ===');
  console.log(apiLogLines.join('\n\n'));
  console.log(`\nZapisano log API: ${OUT}/api-log.txt`);
  console.log('GOTOWE.');
}

main().catch(async (err) => {
  console.error('AWARIA GLOWNA:', err);
  try {
    if (page) {
      await zrzut('99-awaria-glowna', `Nieprzechwycony blad skryptu: ${String(err?.message || err).slice(0, 300)}`, {
        pomijStatusWBazie: true,
      });
    }
  } catch (e2) {
    console.error('nie udalo sie zrobic zrzutu awarii:', e2);
  }
  fs.writeFileSync(`${OUT}/api-log.txt`, apiLogLines.join('\n\n') + '\n');
  process.exitCode = 1;
});
