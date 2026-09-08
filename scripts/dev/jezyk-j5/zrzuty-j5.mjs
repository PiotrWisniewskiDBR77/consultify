/**
 * DOWÓD WIZUALNY paczki J5 — moduł 05 OCENA (Assessment), EN i PL.
 *
 * Wzór 1:1: scripts/dev/jezyk-j7/zrzuty-j7.mjs (paczka J7b) — ten sam przyrząd,
 * te same wiadra (UI vs DANE), ta sama miara „obce słowa w interfejsie".
 * Stanowisko: API 4197 / Vite 3215 / baza consultify_kopia_final.
 *
 * Uruchomienie:
 *   node scripts/dev/jezyk-j5/zrzuty-j5.mjs przed|po
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const FAZA = process.argv[2] === 'po' ? 'po' : 'przed';
/**
 * JEDEN JĘZYK NA PRZEBIEG. Powód: język interfejsu potrafi przeskoczyć na
 * polski w trakcie sesji przeglądarki (wyścig bootstrapu — patrz README
 * paczki, STOP #2). Przebieg, w którym choć jeden ekran wyszedł w złym
 * języku, kończy się kodem 2 i musi zostać POWTÓRZONY: zrzut zrobiony w złym
 * języku jest bezwartościowy jako dowód.
 */
const JEZYKI = process.argv[3] ? [process.argv[3]] : ['en', 'pl'];
let zlyJezyk = 0;
// Port 3215 z pierwotnego zlecenia był ZAJĘTY przez Vite innej paczki
// (worktree `wt/j9-finanse`) — pierwsze przebiegi J5 fotografowały CUDZĄ
// aplikację i pokazywały „polski raport przy koncie EN", którego w tym
// worktree nie ma. Stąd 3216 i twarda kontrola pochodzenia niżej.
const BASE = process.env.J5_BASE || 'http://127.0.0.1:3216';
const OUT = path.resolve(process.cwd(), 'evidence/jezyk-j5', FAZA);
fs.mkdirSync(OUT, { recursive: true });

const sql = (q) =>
  execSync(
    `docker exec consultify-pg18 psql -U postgres -d consultify_kopia_final -Atc "${q.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8' }
  ).trim();

// --- wiadro DANE: wartości z bazy, nie z interfejsu -----------------------
const DANE = new Set();
for (const q of [
  'select name from assessments',
  'select description from assessments',
  'select title from assessment_reports',
  'select name from assessment_reports',
  'select title from initiatives',
  'select name from initiatives',
  'select scope from method_outputs',
  // Treść ZAMROŻONYCH rekordów jądra: `limitations` i nazwy jednostek
  // zapisane w Outpucie w chwili zamrożenia, oraz komentarze zatwierdzeń.
  // To są DANE historyczne — z definicji niezmienne, więc polski tekst
  // zamrożony przed naprawą serwera zostaje po polsku także dla konta EN
  // i NIE jest defektem interfejsu (patrz README paczki, sekcja „Co zostaje").
  "select jsonb_array_elements_text(limitations_json::jsonb) from method_outputs",
  'select unit_name from method_findings',
  'select business_meaning from method_findings',
  'select recommendation from method_findings',
  'select comment from method_approvals',
  "select coalesce(display_name, first_name || ' ' || last_name) from users",
  'select first_name from users',
  'select last_name from users',
  'select name from organizations',
]) {
  try {
    for (const v of sql(q).split('\n')) {
      const s = v.trim();
      if (s) DANE.add(s.toLowerCase());
    }
  } catch {
    /* tabela/kolumna może nie istnieć w tej kopii — wiadro DANE jest wtedy węższe,
       co ZAWYŻA wynik UI, nigdy go nie zaniża. */
  }
}
const DANE_LISTA = [...DANE];

function czyDane(linia) {
  const l = linia.toLowerCase().trim();
  if (!l) return false;
  if (DANE.has(l)) return true;
  const ucieta = l.replace(/(\.\.\.|…)$/, '').trim();
  if (ucieta.length >= 8 && DANE_LISTA.some((d) => d.startsWith(ucieta))) return true;
  return DANE_LISTA.some((d) => d.length >= 12 && l.includes(d));
}

const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const PL_SLOWA = new Set([
  'nie','tak','jest','są','brak','oraz','albo','lub','dla','przez','wszystkie','wszystkich','nowy','nowa','nowe',
  'zapisz','utwórz','utworz','zamknij','wybierz','sprawdź','sprawdz','pokaż','pokaz','dodaj','usuń','usun',
  'raport','raporty','poziom','poziomy','okres','autor','stan','danych','ocena','oceny','ocenę','wynik','wyniki',
  'dowód','dowod','dowody','obszar','obszary','jednostka','jednostki','macierz','sesja','sesji','wniosek','wnioski',
  'zadanie','zadania','właściciel','wlasciciel','anuluj','wróć','wroc','ładowanie','ladowanie','trwa','od','do',
  'sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','paz','lis','gru',
  'rekomendacje','rekomendacja','zamrożony','zamrozony','luka','luki','cel','metodyka','pewność','pewnosc',
]);
const EN_SLOWA = new Set([
  'the','and','for','with','from','all','new','close','save','create','delete','edit','open','level','levels',
  'report','reports','period','author','assessment','assessments','evidence','area','areas','unit','units',
  'matrix','session','sessions','finding','findings','gap','gaps','target','current','score','result','results',
  'of','as','no','yes','add','review','published','draft','done','pending','loading','back','next','previous',
  'feb','apr','jun','jul','aug','sep','oct','nov','dec',
]);
const NEUTRALNE = new Set(['status','kpi','raid','sla','ok','pmo','roi','ai','drd','siri','adma','cmmi','lean','output','outputu','outputy','pdf','docx','pptx','crm','erp','fte','id']);

function liniePodejrzane(text, lang) {
  const wynik = { ui: [], dane: [] };
  for (const raw of text.split('\n')) {
    const linia = raw.trim();
    if (!linia) continue;
    const czysty = linia.replace(/https?:\/\/\S+/g, ' ');
    const slowa = czysty.split(/[^A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]+/).filter(Boolean);
    const trafienia = [];
    if (lang === 'en') {
      for (const w of slowa) {
        const l = w.toLowerCase();
        if (NEUTRALNE.has(l)) continue;
        if (DIAKRYTYKI.test(w) || PL_SLOWA.has(l)) trafienia.push(w);
      }
    } else {
      if (DIAKRYTYKI.test(czysty)) continue; // linia z polskimi znakami = polska
      for (const w of slowa) {
        const l = w.toLowerCase();
        if (NEUTRALNE.has(l)) continue;
        if (EN_SLOWA.has(l)) trafienia.push(w);
      }
    }
    if (!trafienia.length) continue;
    (czyDane(linia) ? wynik.dane : wynik.ui).push({ linia, trafienia: [...new Set(trafienia)] });
  }
  return wynik;
}

/**
 * Przełączenie języka MUSI iść przez pełne przelogowanie.
 *
 * Zmierzone w tej paczce: samo `localStorage.setItem('i18nextLng', …)` nie
 * wystarcza — aplikacja po nawigacji nadpisuje ten klucz językiem konta ze
 * SWOJEGO magazynu (`consultify-storage`), zapisanego w chwili logowania. Bez
 * przelogowania pierwszy przebieg pokazał raport po polsku przy koncie 'en'
 * i wyglądało to na defekt modułu, a było wadą przyrządu.
 */
async function zalogujWJezyku(p, lang) {
  sql(`UPDATE users SET language='${lang}' WHERE email='audyt@dbr77.local'`);
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate((l) => {
    localStorage.clear();
    sessionStorage.clear();
    // Stan WYJŚCIOWY przeglądarki, nie ingerencja po fakcie: prawdziwa
    // przeglądarka użytkownika też pamięta jego wybór języka. Zgodność tej
    // warstwy z językiem konta usuwa wyścig bootstrapu (detektor i konto
    // mówią to samo), zamiast go maskować.
    localStorage.setItem('i18nextLng', l);
  }, lang);
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  await p.locator('input[type="email"]').first().fill('audyt@dbr77.local');
  await p.locator('input[type="password"]').first().fill('AudytDBR77!2026');
  await p.locator('input[type="password"]').first().press('Enter');
  await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 40000 });
  await p.waitForTimeout(3000);
  // ŚWIADOMIE nie dotykamy tu `i18nextLng` ani `consultify-storage`: aplikacja
  // ustawia język sama z konta (`syncLanguageFromAccount`), a ręczne
  // nadpisywanie jej magazynu po zalogowaniu wywracało ten mechanizm przy
  // kolejnych nawigacjach — zmierzone w tej paczce (zrzuty „EN" wychodziły
  // polskie od trzeciego ekranu). Motyw jasny ustawia `addInitScript` przed
  // pierwszym wczytaniem strony.
  // Po zalogowaniu detektor przez chwilę trzyma jeszcze język POPRZEDNIEJ
  // sesji, zanim `syncLanguageFromAccount` zastosuje język konta — czekamy na
  // faktyczne przełączenie zamiast fotografować stan przejściowy.
  let realny = null;
  for (let proba = 0; proba < 15; proba += 1) {
    realny = await p.evaluate(() => localStorage.getItem('i18nextLng'));
    if (String(realny || '').toLowerCase().startsWith(lang)) break;
    await p.waitForTimeout(1000);
  }
  if (!String(realny || '').toLowerCase().startsWith(lang)) {
    throw new Error(`przyrzad: jezyk interfejsu to "${realny}", oczekiwano "${lang}" — zrzuty byłyby fałszywe`);
  }
  console.log(`== jezyk interfejsu: ${realny}`);
}

/**
 * USTABILIZUJ JĘZYK przed zrzutem.
 *
 * Zmierzone w tej paczce: język interfejsu potrafi PRZESKOCZYĆ na polski po
 * kolejnych nawigacjach mimo konta `language='en'` i pustego domyślnego języka
 * organizacji — ten sam ekran wychodził raz angielski, raz polski (wyścig
 * bootstrapu i ładowania 1,9 MB paczki tłumaczeń, opisany w `src/i18n.ts`
 * i `services/languagePreference.ts`). Bez tej pętli zrzuty mierzyłyby los,
 * nie produkt. Pętla NIE maskuje defektu — przeskok jest raportowany niżej
 * jako STOP w README paczki.
 */
async function ustabilizujJezyk(p, lang) {
  // TYLKO czekanie — bez `setItem`/`reload`. Ręczne dopisywanie do magazynu
  // i przeładowania SAME wywoływały wyścig bootstrapu (zmierzone: przy
  // czystym przebiegu bez tych ingerencji język trzyma się konta przez
  // wszystkie zakładki, z nimi — przeskakiwał na polski od trzeciego ekranu).
  for (let proba = 0; proba < 8; proba += 1) {
    const teraz = await p.evaluate(() => localStorage.getItem('i18nextLng') || '');
    if (String(teraz).toLowerCase().startsWith(lang)) return true;
    await p.waitForTimeout(1000);
  }
  return false;
}

async function zrzut(p, nazwa, lang) {
  const stabilny = await ustabilizujJezyk(p, lang);
  if (!stabilny) console.log(`  ! ${nazwa}: NIE udało się ustabilizować języka na "${lang}"`);
  await p.waitForTimeout(2000);
  // Realny język interfejsu W CHWILI ZRZUTU — bez tego nie wiadomo, czy
  // polskie słowa na zrzucie „EN" to defekt modułu, czy przyrząd zrobił
  // zdjęcie polskiego interfejsu (pułapka „przyrząd pokazuje nie produkt").
  const htmlLang = await p.evaluate(
    () => document.documentElement.lang || localStorage.getItem('i18nextLng') || ''
  );
  if (!String(htmlLang).toLowerCase().startsWith(lang)) {
    zlyJezyk += 1;
    console.log(`  ! ${nazwa}: jezyk w chwili zrzutu = "${htmlLang}", oczekiwano "${lang}"`);
  }
  const text = await p.evaluate(() => document.body.innerText);
  const plik = path.join(OUT, `${nazwa}-${lang}.png`);
  await p.screenshot({ path: plik, fullPage: false });
  const w = liniePodejrzane(text, lang);
  const meta = {
    ekran: nazwa,
    jezyk: lang,
    jezykRealny: htmlLang,
    url: p.url(),
    obcychSlowUI: w.ui.reduce((a, x) => a + x.trafienia.length, 0),
    obcychLiniiUI: w.ui.length,
    ui: w.ui,
    dane: w.dane.slice(0, 40),
  };
  fs.writeFileSync(`${plik}.json`, JSON.stringify(meta, null, 1));
  console.log(`${nazwa}-${lang}: obce slowa UI=${meta.obcychSlowUI} (linii ${meta.obcychLiniiUI}), DANE=${w.dane.length}`);
  return meta;
}

async function klik(p, locator, opis) {
  try {
    const el = locator.first();
    await el.waitFor({ state: 'visible', timeout: 6000 });
    await el.click({ force: true });
    await p.waitForTimeout(1500);
    return true;
  } catch {
    console.log(`  ! nie kliknięto: ${opis}`);
    return false;
  }
}

const OUTPUT_ID = process.env.J5_OUTPUT_ID || '92f3bd7f-7048-44c8-a023-392b982c52ee';

// Kontrola pochodzenia: serwer pod BASE musi podawać plik tłumaczeń TEGO
// worktree. Bez tej bramki przyrząd mierzy inne drzewo kodu.
{
  const res = await fetch(`${BASE}/locales/en/translation.json`);
  const en = await res.json();
  const probka = en?.assessment?.report?.props?.sessionOwner;
  if (probka !== 'Session owner') {
    throw new Error(
      `przyrzad: ${BASE} serwuje CUDZE tlumaczenia (assessment.report.props.sessionOwner=${JSON.stringify(probka)}) — zrzuty nie dotyczyłyby tego worktree`
    );
  }
}

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const p = await c.newPage();
// Motyw jasny PRZED pierwszym renderem — zapis do magazynu aplikacji po
// zalogowaniu wywracał synchronizację języka (patrz `zalogujWJezyku`).
await p.addInitScript(() => {
  const K = 'consultify-storage';
  try {
    const r = localStorage.getItem(K);
    const o = r ? JSON.parse(r) : { state: {}, version: 0 };
    o.state = { ...(o.state || {}), theme: 'light' };
    localStorage.setItem(K, JSON.stringify(o));
  } catch {
    /* pusty magazyn przy pierwszym wejściu — motyw domyślny wystarczy */
  }
});
await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await p.locator('input[type="email"]').first().fill('audyt@dbr77.local');
await p.locator('input[type="password"]').first().fill('AudytDBR77!2026');
await p.locator('input[type="password"]').first().press('Enter');
await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 40000 });
await p.waitForTimeout(1500);


const idz = async (sciezka) => {
  await p.goto(`${BASE}${sciezka}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
};

const raport = [];
for (const lang of JEZYKI) {
  await zalogujWJezyku(p, lang);

  // 1. Lista ocen (zakładka Procesy = lista sesji ocen)
  await idz('/assessment/overview?tab=processes');
  raport.push(await zrzut(p, '01-lista-ocen', lang));

  // 2. Podgląd wiersza listy
  await klik(p, p.locator('main table tbody tr').first().locator('td').first(), 'wiersz listy');
  raport.push(await zrzut(p, '02-lista-podglad', lang));

  // 3. Biblioteka / szablony
  await idz('/assessment/overview?tab=library');
  raport.push(await zrzut(p, '03-biblioteka', lang));

  // 4. Raporty
  await idz('/assessment/overview?tab=reports');
  raport.push(await zrzut(p, '04-raporty', lang));

  // 5. Wnioski (Outputy) — generator wniosków
  await idz('/assessment/overview?tab=outputs');
  raport.push(await zrzut(p, '05-wnioski', lang));

  // 6. Inicjatywy z oceny
  await idz('/assessment/overview?tab=initiatives');
  raport.push(await zrzut(p, '06-inicjatywy', lang));

  // 7. Zamrożony Output — RAPORT (rdzeń paczki: scope/limitations z serwera)
  await idz(`/assessment/outputs/${OUTPUT_ID}/report`);
  await p.waitForTimeout(2000);
  raport.push(await zrzut(p, '07-raport-zamrozonego-outputu', lang));

  // 8. Ten sam raport, przewinięty do rozdziałów osi i stopki
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1500);
  raport.push(await zrzut(p, '08-raport-stopka', lang));

  // 9. Prezentacja zamrożonego Outputu
  await idz(`/assessment/outputs/${OUTPUT_ID}/presentation`);
  await p.waitForTimeout(2500);
  raport.push(await zrzut(p, '09-prezentacja', lang));

  // 10. Sesja DRD (edytor sesji oceny)
  const idOceny = sql("select id from assessments where framework_type='DRD' order by created_at desc limit 1");
  if (idOceny) {
    await idz(`/assessment/DRD/${idOceny}`);
    await p.waitForTimeout(2500);
    raport.push(await zrzut(p, '10-sesja-drd', lang));
  }

  // 11. Modal nowej oceny
  await idz('/assessment/overview?tab=processes');
  await klik(
    p,
    p.getByRole('button', { name: /New assessment|Nowa ocena/i }),
    'CTA nowej oceny'
  );
  raport.push(await zrzut(p, '11-nowa-ocena-modal', lang));
}

const suma = { faza: FAZA, ekrany: raport.length };
for (const lang of JEZYKI) {
  const w = raport.filter((r) => r.jezyk === lang);
  suma[lang] = {
    obcychSlowUI: w.reduce((a, x) => a + x.obcychSlowUI, 0),
    ekranyZTrafieniami: w.filter((x) => x.obcychSlowUI > 0).map((x) => x.ekran),
  };
}
const plikSumy = path.join(OUT, `_podsumowanie-${JEZYKI.join('-')}.json`);
fs.writeFileSync(plikSumy, JSON.stringify({ suma, raport }, null, 1));
console.log('\nSUMA', JSON.stringify(suma, null, 1));
await b.close();
if (zlyJezyk > 0) {
  console.log(`PRZEBIEG ODRZUCONY: ${zlyJezyk} zrzutow w zlym jezyku — powtorz.`);
  process.exit(2);
}
