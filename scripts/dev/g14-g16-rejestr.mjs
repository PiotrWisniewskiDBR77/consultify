// G14/G16 — zapis stanu bramek „naprawa ze śladem" i „pakiet przed/po do retestu właściciela"
// w wierszach `| G14 |` i `| G16 |` MODULE_ACCEPTANCE.md 16 modułów, na podstawie plików śladu
// dyżurów z 03.09 (evidence/g14/*.md, evidence/grafika/a11y-fix-*.md, i18n, przewody, macierz G06).
//
// Status G14 = `PARTIAL / OWNER_DECISION_PENDING`, dopóki właściciel nie rozstrzygnie pozycji DUŻE
// z docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md (wtedy PASS z numerem DEC-…).
// Status G16 = `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING` — pakiet jest, retest właściciela
// to jego przelot po stagingu na realnych danych (DEC-2026-09-03-346: rekord odbiera się z listy).
//
// Użycie: node scripts/dev/g14-g16-rejestr.mjs --marker=<sha> [--na-sucho=1]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const arg = (name, def) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const MARKER = arg('marker', '');
const NA_SUCHO = arg('na-sucho', '0') === '1';
if (!MARKER) {
  console.error('Podaj --marker=');
  process.exit(2);
}
const DATA = new Date().toISOString().slice(0, 10);
const MODULY = [
  '01_ORGANIZATION', '02_INTERVIEW', '03_TOOLS', '04_ASSESSMENT', '05_INITIATIVES', '06_EXECUTION',
  '07_MY_WORK_AGENT', '08_MEETINGS', '09_RESULTS', '10_FINANCE', '11_MATERIALS', '12_AUDITS',
  '13_CHAT', '14_ADMIN', '15_SETTINGS', '16_PARTNER',
];
const sladG14 = (mod) => {
  const n = Number(mod.slice(0, 2));
  return n <= 4 ? 'evidence/g14/G14_01_04_20260903.md' : n <= 8 ? 'evidence/g14/G14_05_08_20260903.md' : n <= 12 ? 'evidence/g14/G14_09_12_20260903.md' : 'evidence/g14/G14_13_16_20260903.md';
};
const istnieje = (p) => fs.existsSync(path.join(REPO, p));
const pakiety = (mod) => {
  const out = [];
  const kandydaci = [
    `evidence/grafika/a11y-fix-${mod}-20260903.md`,
    `evidence/grafika/a11y-fix-${mod}-20260903-reszta.md`,
    'evidence/grafika/i18n-pl-en-20260903.md',
    'evidence/grafika/przewody-odbioru-20260903.md',
    'evidence/grafika/g06-macierz-final-20260903/AGREGAT.md',
    'docs/program/waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md',
  ];
  for (const k of kandydaci) if (istnieje(k)) out.push(k);
  return out;
};

for (const mod of MODULY) {
  const plik = path.join(REPO, 'docs/program/waves/WAVE_03_ACCEPTANCE/modules', mod, 'MODULE_ACCEPTANCE.md');
  let tresc = fs.readFileSync(plik, 'utf8');
  const slad = sladG14(mod);
  const sladJest = istnieje(slad);
  const pak = pakiety(mod);
  const zamien = (id, status, notatka) => {
    const re = new RegExp(`^\\|\\s*${id}\\s*\\|([^|]*)\\|\\s*\`?([^|\`]*)\`?\\s*\\|(.*)\\|\\s*$`, 'm');
    const m = tresc.match(re);
    if (!m) {
      console.log(`★ ${mod}: brak wiersza ${id}`);
      return;
    }
    const [, opis, poprzedni] = m;
    const nowy = `| ${id} |${opis}| \`${status}\` | ${notatka} Poprzedni stan bramki: \`${poprzedni.trim()}\` (poprzednia notatka w historii git). |`;
    tresc = tresc.replace(re, nowy.replace(/\$/g, '$$$$'));
    console.log(`${mod} ${id}: ${poprzedni.trim()} → ${status}`);
  };
  zamien(
    'G14',
    'PARTIAL / OWNER_DECISION_PENDING',
    `${DATA} (nadzorca, marker \`${MARKER}\`): dyżur agentowy G14 dla tego modułu zakończony — ślad znalezisko→status→commit→dowód w \`${slad}\`${sladJest ? '' : ' (★ plik nie znaleziony — sprawdź)'}. ` +
      `Każde znalezisko z ANALIZA_G13 ma jeden z czterech statusów: NAPRAWIONE (commit SHA), POTWIERDZONE WCZEŚNIEJ (commit innego dyżuru z 03.09: dostępność \`evidence/grafika/a11y-fix-*.md\`, język \`i18n-pl-en-20260903.md\`, przewody \`przewody-odbioru-20260903.md\`), POMINIĘTE z powodem, NIEPOTWIERDZONE/obalone własnym pomiarem. ` +
      `Bramka nie może paść na PASS, dopóki właściciel nie rozstrzygnie pozycji DUŻE i wymagających decyzji produktowej — lista z rekomendacją CTO: \`docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md\`; po decyzji każda pozycja dostaje numer DEC i status „w budowie" albo „odłożone", i dopiero wtedy PASS.`
  );
  zamien(
    'G16',
    'TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING',
    `${DATA} (nadzorca, marker \`${MARKER}\`): pakiet przed/po tego modułu = ${pak.length ? pak.map((p) => `\`${p}\``).join(', ') : 'brak plików'}; zrzuty PRZED/PO poza repo w katalogach \`/private/tmp/ag-*-artefakty/\` wskazanych w plikach śladu; manifesty pełnej macierzy G06 w \`evidence/grafika/g06-macierz-final-20260903/${mod}/\`. ` +
      `Retest właściciela = przelot po stagingu na REALNYCH danych, moduł po module, z otwarciem realnego rekordu z listy (DEC-2026-09-03-346: odbiór na fiksturze pokazowej nie jest odbiorem). Wdrożenie na staging czeka na słowo właściciela (uruchamia je promocja na \`develop\`).`
  );
  if (!NA_SUCHO) fs.writeFileSync(plik, tresc);
}
