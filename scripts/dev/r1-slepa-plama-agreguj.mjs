// R1 — agregacja wyników pomiaru rodziny „ślepa plama rozwijania".
// Czyta wszystkie wynik-a-*.json / wynik-b-*.json spod --wyjscie i produkuje
// tabelę markdown: ekran | tekst(a) | tekst(b) | różnica | a11y(a) | a11y(b) | co znika (diff pierwsze 3 linie).
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const WYJSCIE = arg('wyjscie', '');
if (!WYJSCIE) { console.error('Podaj --wyjscie=...'); process.exit(2); }

function linieUnikalneDlaA(tekstA, tekstB) {
  const linieB = new Set(tekstB.split('\n').map((l) => l.trim()).filter(Boolean));
  const linieA = tekstA.split('\n').map((l) => l.trim()).filter(Boolean);
  return linieA.filter((l) => !linieB.has(l));
}

const moduly = fs.readdirSync(WYJSCIE, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const wiersze = [];
let ekranowSlepaPlama = 0;
let ekranowRazem = 0;

for (const mod of moduly) {
  const katalog = path.join(WYJSCIE, mod);
  const plikiA = fs.readdirSync(katalog).filter((f) => /^wynik-a-bez-rozwin.*\.json$/.test(f));
  for (const plikA of plikiA) {
    const sufiks = plikA.replace(/^wynik-a-bez-rozwin/, '').replace(/\.json$/, '');
    const plikB = `wynik-b-z-rozwin${sufiks}.json`;
    const pathA = path.join(katalog, plikA);
    const pathB = path.join(katalog, plikB);
    if (!fs.existsSync(pathB)) { console.error(`★ BRAK pary dla ${mod}${sufiks}: ${plikB}`); continue; }
    const dataA = JSON.parse(fs.readFileSync(pathA, 'utf8'));
    const dataB = JSON.parse(fs.readFileSync(pathB, 'utf8'));
    const mapaB = new Map(dataB.wyniki.map((w) => [w.ekran, w]));
    for (const wA of dataA.wyniki) {
      const wB = mapaB.get(wA.ekran);
      if (!wB) { console.error(`★ BRAK ekranu ${wA.ekran} w wariancie (b) — ${mod}${sufiks}`); continue; }
      ekranowRazem++;
      const dlugA = wA.tekst.length;
      const dlugB = wB.tekst.length;
      const roznica = dlugB - dlugA;
      const a11yA = (wA.a11yNaruszenia || []).length;
      const a11yB = (wB.a11yNaruszenia || []).length;
      const jestSlepaPlama = dlugB < dlugA;
      if (jestSlepaPlama) ekranowSlepaPlama++;
      const znikaja = jestSlepaPlama ? linieUnikalneDlaA(wA.tekst, wB.tekst).slice(0, 3) : [];
      wiersze.push({ mod, ekran: wA.ekran, dlugA, dlugB, roznica, a11yA, a11yB, jestSlepaPlama, znikaja });
    }
  }
}

wiersze.sort((x, y) => x.roznica - y.roznica);

const dataStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
let md = `# Ślepa plama pętli rozwijania — pomiar R1 (dyżur agent/slepa-plama-20260903)\n\n`;
md += `Metoda: dla każdego ekranu z \`g06-macierz-ekrany.json\` (wszystkie 16 modułów, ${ekranowRazem} ekranów) dwa przebiegi \`grafika-zrzuty.mjs\` (pl, light, 1440, a11y=1):\n`;
md += `- (a) BEZ \`--rozwin-sekcje\`\n`;
md += `- (b) Z \`--rozwin-sekcje=1 --klik-po-rozwinieciu=1 --osiad-po-rozwinieciu=1500\` (BEZ nowej naprawy \`--cofnij-jesli-skraca\`)\n\n`;
md += `Ślepa plama = tekst(b) < tekst(a) — rozwijanie sekcji ZMNIEJSZYŁO widoczny tekst zamiast go dołożyć.\n\n`;
md += `**Wynik: ${ekranowSlepaPlama} / ${ekranowRazem} ekranów ma ślepą plamę.**\n\n`;
md += `| moduł | ekran | tekst(a) | tekst(b) | różnica | a11y(a) | a11y(b) | ślepa plama | co znika (pierwsze 3 linie) |\n`;
md += `|---|---|---|---|---|---|---|---|---|\n`;
for (const w of wiersze) {
  md += `| ${w.mod} | ${w.ekran} | ${w.dlugA} | ${w.dlugB} | ${w.roznica} | ${w.a11yA} | ${w.a11yB} | ${w.jestSlepaPlama ? '★ TAK' : 'nie'} | ${w.znikaja.map((l) => l.replace(/\|/g, '\\|')).join(' / ')} |\n`;
}

const wyjscieMd = arg('wynik-md', '');
if (wyjscieMd) {
  fs.mkdirSync(path.dirname(wyjscieMd), { recursive: true });
  fs.writeFileSync(wyjscieMd, md);
  console.log(`Zapisano ${wyjscieMd}`);
}
console.log(`\nRAZEM: ${ekranowSlepaPlama} / ${ekranowRazem} ekranów ze ślepą plamą.\n`);
console.log(md.split('\n').filter((l) => l.includes('★ TAK')).join('\n'));
