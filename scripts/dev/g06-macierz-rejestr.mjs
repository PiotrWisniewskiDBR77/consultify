// G06 — zapis wyniku pełnej macierzy do wierszy `| G06 |` w MODULE_ACCEPTANCE.md 16 modułów.
//
// Źródło: agregat.json z g06-macierz-agreguj.mjs. Bramka dostaje `PASS` WYŁĄCZNIE gdy dla
// WSZYSTKICH ekranów A/B modułu: 8/8 kadrów, 0 kadrów z realnym naruszeniem a11y, 0 realnych
// błędów konsoli (404 harnessu i komunikaty pochodne braku backendu nie liczą się), 0 kadrów
// ze złym statusem, 0 ekranów PL=EN, 0 złych par jasny/ciemny, 0 ekranów bez tekstu.
// W przeciwnym razie `NOT_STARTED` z policzonym długiem. Poprzednia notatka zostaje
// skrócona do jednego zdania „Poprzedni stan" (pełna historia jest w git).
//
// Użycie: node scripts/dev/g06-macierz-rejestr.mjs --agregat=<agregat.json> --marker=<sha> \
//         --dowody=<ścieżka katalogu dowodów w repo> [--png=<ścieżka PNG poza repo>] [--na-sucho=1]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const AGREGAT = arg('agregat', '');
const MARKER = arg('marker', '');
const DOWODY = arg('dowody', '');
const PNG = arg('png', '');
const NA_SUCHO = arg('na-sucho', '0') === '1';
if (!AGREGAT || !MARKER || !DOWODY) {
  console.error('Podaj --agregat=, --marker=, --dowody=');
  process.exit(2);
}
const agregat = JSON.parse(fs.readFileSync(AGREGAT, 'utf8'));
const DATA = new Date().toISOString().slice(0, 10);

for (const [mod, { suma, ekrany }] of Object.entries(agregat)) {
  const plik = path.join(REPO, 'docs/program/waves/WAVE_03_ACCEPTANCE/modules', mod, 'MODULE_ACCEPTANCE.md');
  if (!fs.existsSync(plik)) {
    console.log(`★ ${mod}: brak ${plik}`);
    continue;
  }
  const tresc = fs.readFileSync(plik, 'utf8');
  // Format wiersza bywa `| G06  |` z dwiema spacjami — wzorzec luźny (lekcja z 03.09).
  const re = /^\|\s*G06\s*\|([^|]*)\|\s*`([A-Z_]+)`\s*\|(.*)\|\s*$/m;
  const m = tresc.match(re);
  if (!m) {
    console.log(`★ ${mod}: nie znaleziono wiersza G06`);
    continue;
  }
  const [, opis, poprzedniStatus, poprzedniaNotatka] = m;
  const dlug = [];
  if (suma.ekranyNiepelne.length) dlug.push(`niepełna macierz: ${suma.ekranyNiepelne.join(', ')}`);
  if (suma.ekranyZa11y) dlug.push(`realne naruszenia a11y na ${suma.ekranyZa11y}/${suma.ekrany} ekranach (${Object.entries(suma.a11yIds).map(([k, v]) => `${k}×${v}`).join(', ')})`);
  if (suma.ekranyZinnymiBledami) dlug.push(`realne błędy konsoli na ${suma.ekranyZinnymiBledami} ekranach`);
  if (suma.ekranyZeZlymStatusem) dlug.push(`zły status renderu na ${suma.ekranyZeZlymStatusem} ekranach`);
  if (suma.ekranyPlRownaEn.length) dlug.push(`PL=EN na ${suma.ekranyPlRownaEn.length} ekranach (${suma.ekranyPlRownaEn.join(', ')})`);
  if (suma.ekranyZlaPara.length) dlug.push(`zła para jasny/ciemny: ${suma.ekranyZlaPara.join(', ')}`);
  if (suma.ekranyBezTekstu.length) dlug.push(`bez tekstu: ${suma.ekranyBezTekstu.join(', ')}`);
  const status = dlug.length ? 'NOT_STARTED' : 'PASS';
  const wyjatki = (suma.wyjatki || []).length ? `Wyjątki uzasadnione (nie blokują, wypisane): ${suma.wyjatki.join('; ')}. ` : '';
  const ekranyZDlugiem = Object.entries(ekrany)
    .filter(([, e]) => e.a11yKadry || e.inneBledy.length || e.zleStatusy.length || e.plRownaEn || e.paryZle.length || e.brakTekstu)
    .map(([n, e]) => `\`${n}\`${e.a11yKadry ? ` a11y ${e.a11yKadry}/${e.kadry}` : ''}${e.plRownaEn ? ' PL=EN' : ''}${e.paryZle.length ? ' para' : ''}${e.brakTekstu ? ' bez tekstu' : ''}`)
    .join('; ');
  const notatka =
    `ZMIERZONE ${DATA} PEŁNĄ MACIERZĄ na markerze \`${MARKER}\` (nadzorca; \`scripts/dev/g06-macierz-uruchom.mjs\` → kanoniczny \`grafika-zrzuty.mjs\` z domyślnym klikiem w wiersz, ` +
    `\`--rozwin-sekcje=1 --a11y=1\`, skan na \`#dev-render-root\`): ${suma.ekrany} ekranów A/B × 8 kadrów (PL/EN × jasny/ciemny × 1440/1024) = ${suma.kadry} kadrów. ` +
    `Odjęte WYŁĄCZNIE trzy reguły hosta (\`landmark-one-main\`, \`page-has-heading-one\`, \`region\`); 404 na \`/api/*\` i komunikaty pochodne braku backendu liczone osobno (${suma.ekranyZKonsolaPochodna} ekranów), nie jako defekt. ` +
    (dlug.length
      ? `**Dług: ${dlug.join('; ')}.** Ekrany: ${ekranyZDlugiem}. Bramka nie może paść, dopóki dług nie zejdzie do zera w pomiarze kontrolnym. `
      : `**Zero realnych naruszeń a11y, zero realnych błędów konsoli, zero złych statusów, PL≠EN na każdym ekranie, pary jasny/ciemny poprawne.** `) +
    wyjatki +
    `Manifesty w repo: \`${DOWODY}/${mod}/\`; agregat: \`${DOWODY}/AGREGAT.md\`${PNG ? `; PNG poza repo: \`${PNG}/${mod}/\`` : ''}. ` +
    `Poprzedni stan bramki: \`${poprzedniStatus}\` (notatka z poprzedniego pomiaru w historii git tego pliku).`;
  const nowyWiersz = `| G06 |${opis}| \`${status}\` | ${notatka} |`;
  console.log(`${mod}: ${poprzedniStatus} → ${status}${dlug.length ? ` (${dlug.length} pozycji długu)` : ''}`);
  if (!NA_SUCHO) fs.writeFileSync(plik, tresc.replace(re, nowyWiersz.replace(/\$/g, '$$$$')));
}
