// HOTFIX assignee_id (2026-09-11) — dowód na żywo PRZED/PO.
// Użycie: node scripts/dev/hotfix-assignee-zrzut.mjs <przed|po>
//
// Scenariusz: Moja Praca -> Zadania -> otwórz zadanie przypisane do konta
// audytora -> zmień tytuł -> zapisz -> location.reload() -> sprawdź, czy
// zadanie nadal widoczne na liście (scope "moje zadania" filtruje po
// assignee_id, więc zerowanie tej kolumny usuwa zadanie z listy).
import { chromium } from 'playwright';

const label = process.argv[2] || 'po';
const base = 'http://localhost:3259';
const TASK_ID = 'ecfd6fb1-af57-4e2c-8c32-1c3bbb72bc38';
const NEW_TITLE = `HOTFIX dowod: zadanie audytora (zapis ${label} ${new Date().toISOString()})`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.emulateMedia({ colorScheme: 'dark' });

await page.goto(base);
const loginRes = await page.evaluate(async () => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'audyt@dbr77.local', password: 'AudytDBR77!2026' }),
  });
  const data = await res.json();
  localStorage.setItem('token', data.token);
  localStorage.setItem('refreshToken', data.refreshToken || '');
  localStorage.setItem('user', JSON.stringify(data.user));
  return { status: res.status, email: data.user?.email };
});
console.log('login', loginRes);

await page.goto(`${base}/my-work`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const skip = page.getByText('Skip for now');
if (await skip.count()) {
  await skip.first().click();
  await page.waitForTimeout(300);
}

// Karta "Tasks" w Menu 2 My Work.
const tasksTab = page.getByRole('button', { name: /^Tasks$/ });
if (await tasksTab.count()) {
  await tasksTab.first().click();
  await page.waitForTimeout(1000);
}

// --- Zrzut 1: lista PRZED edycją (zadanie widoczne) ---
await page.waitForSelector('text=HOTFIX dowod', { timeout: 15000 });
await page.screenshot({
  path: `evidence/hotfix-assignee/${label}-1-lista-przed-edycja.png`,
  fullPage: false,
});
console.log('lista przed edycja: zadanie widoczne');

// Otwórz zadanie — SPEC-A: pojedynczy klik = preview, podwójny = pełny widok.
await page.getByText('HOTFIX dowod', { exact: false }).first().dblclick();
await page.getByRole('button', { name: /HOTFIX dowod/ }).first().waitFor({ timeout: 15000 });
await page.waitForTimeout(1000);

await page.screenshot({
  path: `evidence/hotfix-assignee/${label}-1b-po-otwarciu-debug.png`,
  fullPage: false,
});

// NModeHeader (SPEC-A/A1): tytuł to tekst -> klik zamienia w <input> -> blur/Enter = autosave.
// UWAGA: pierwszy match roli "button" o tej nazwie to "Close" na pigułce
// karty w Menu 1 ("Close: HOTFIX dowod..."); właściwy przycisk tytułu (klasa
// text-xl font-bold z NModeHeader) jest OSTATNI.
const titleButton = page.getByRole('button', { name: /HOTFIX dowod/ });
await titleButton.last().click();
// Po kliknięciu w przycisk tytułu, input pojawia się w tym samym miejscu (autoFocus).
const activeInput = page.locator(':focus');
await activeInput.fill(NEW_TITLE);
await page.waitForTimeout(200);

await page.screenshot({
  path: `evidence/hotfix-assignee/${label}-2-karta-przed-zapisem.png`,
  fullPage: false,
});

// Blur (Enter) -> autosave on blur (Canon A1).
await activeInput.press('Enter');
await page.waitForTimeout(2000);

await page.screenshot({
  path: `evidence/hotfix-assignee/${label}-3-karta-po-zapisie.png`,
  fullPage: false,
});
console.log('zapisano tytul:', NEW_TITLE);

// location.reload() — kluczowy krok odbioru.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

await page.screenshot({
  path: `evidence/hotfix-assignee/${label}-4-po-reload-karta-lub-404.png`,
  fullPage: false,
});

// Wróć na listę Zadań i sprawdź, czy zadanie nadal widoczne.
await page.goto(`${base}/my-work`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const tasksTab2 = page.getByRole('button', { name: /^Tasks$/ });
if (await tasksTab2.count()) {
  await tasksTab2.first().click();
  await page.waitForTimeout(1000);
}

// UWAGA: `getByText('HOTFIX dowod')` łapie też pigułkę zamkniętej karty w
// Menu 1 ("HOTFIX dowod: zadanie a... ⏺ X"), która zostaje w DOM nawet gdy
// treść listy mówi "No tasks yet" — fałszywy pozytyw. Licz TYLKO poza pigułką
// karty (poza paskiem zakładek na górze listy).
const noTasksYet = await page.getByText('No tasks yet').count();
const stillVisible = noTasksYet > 0 ? 0 : await page.getByText('HOTFIX dowod', { exact: false }).count();
console.log('"No tasks yet" widoczne:', noTasksYet > 0);
console.log('WIDOCZNE PO RELOAD (liczba dopasowan, po korekcie):', stillVisible);

await page.screenshot({
  path: `evidence/hotfix-assignee/${label}-5-lista-po-reload.png`,
  fullPage: false,
});

await browser.close();
console.log(`GOTOWE (${label}). Widoczne po reload: ${stillVisible > 0 ? 'TAK' : 'NIE'}`);
