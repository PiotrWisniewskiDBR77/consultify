/**
 * POMIAR JĘZYKA — cały zbiór ekranów Organizacji (wariant DOMYŚLNY, flaga OFF).
 *
 * Po co osobne narzędzie, skoro są zrzuty: oglądanie zrzutów to PRÓBKA i oko
 * przywyka (patrz lekcja „Próbka zamiast zbioru"). Tu zbieram WIDOCZNY tekst
 * z każdego z 20 ekranów i mechanicznie szukam angielskich słów — bez oceny
 * ludzkiej, więc nie da się przeoczyć ekranu, na który nie spojrzałem.
 *
 * Nie zastępuje zrzutów (CLAUDE.md §7) — uzupełnia je o pokrycie 100%.
 */
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3020';
const EKRANY = fs.readFileSync('/private/tmp/org-ekrany.txt', 'utf8').trim().split('\n');

// Słowa angielskie, które NIE są dopuszczalne jako nazwy własne/branżowe w PL UI.
const ANG = /\b(Add|Item|Items|No items yet|Select|Export|Print|Share|Target|Current|Challenge|Symptom|Severity|Notes|Context|Actions|Evidence|Objectives|Primary|Secondary|Priorities|Success|Metrics|Baseline|Timeframe|Scope|Included|Excluded|Transformation|Archetype|Collaboration|Steering|Governance|Declared|Challenges|Official|problems|reported|client|symptoms|Diagnostic|Questions|Suggested|Obstacles|Risk|Assessment|Logic|Hidden|Risks|Threats|Strategic|Advantages|Strengths|Opportunities|Recommended|scenario|Company Name|employees|revenue|Functional Area|Upload|Supporting Documents|Recommended for|What should I upload)\b/g;

const browser = await chromium.launch();
const raport = [];
for (const e of EKRANY) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/?screen=${e}&lang=pl&theme=light&uwagi=0`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    // Pomijam lewy pas nawigacji? NIE — on też jest produktem. Biorę całość main.
    const txt = await page.evaluate(() => document.body.innerText);
    const hits = [...new Set(txt.match(ANG) || [])];
    raport.push({ ekran: e, trafienia: hits, dlugosc: txt.length });
    console.log(`${e.padEnd(34)} znaki=${String(txt.length).padStart(5)}  ANG=${hits.length ? hits.join(' | ') : '—'}`);
  } catch (err) {
    console.log(`${e.padEnd(34)} BŁĄD: ${String(err).slice(0, 100)}`);
    raport.push({ ekran: e, blad: String(err).slice(0, 200) });
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync('/private/tmp/org-jezyk-raport.json', JSON.stringify(raport, null, 2));
