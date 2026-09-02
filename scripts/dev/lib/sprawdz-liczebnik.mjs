/**
 * BEZPIECZNIK: kopia liczebnika w scripts/dev nie może rozjechać się z produktem.
 *
 * Nie porównuje tekstu implementacji (to by pękało przy każdym komentarzu), tylko
 * ZACHOWANIE — na przypadkach wyciągniętych WPROST z testu produktu. Gdy ktoś
 * zmieni regułę w `src/utils/liczebnik.ts` i dopisze przypadek do jej testu,
 * ten sprawdzian pęknie natychmiast.
 *
 * Uruchomienie: node scripts/dev/lib/sprawdz-liczebnik.mjs   (kod wyjścia 1 = rozjazd)
 */
import fs from 'fs';
import { liczebnik } from './liczebnik.mjs';

const TEST = 'tests/unit/utils/liczebnik.test.ts';
const txt = fs.readFileSync(TEST, 'utf8');
const formy = txt.match(/TEST_FORMS[^=]*=\s*\[([^\]]+)\]/);
if (!formy) { console.error('BŁĄD: nie znalazłem TEST_FORMS w', TEST); process.exit(1); }
const F = formy[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));

const przypadki = [...txt.matchAll(/liczebnik\(\s*(-?[\d.]+)\s*,\s*TEST_FORMS\s*\)\)\.toBe\(\s*'([^']*)'\s*\)/g)]
  .map((m) => [Number(m[1]), m[2]]);

if (przypadki.length < 8) {
  console.error(`BŁĄD: wyciągnąłem tylko ${przypadki.length} przypadków z ${TEST} — spodziewam się co najmniej 8.`);
  console.error('To nie jest „test przeszedł". Pusty odczyt NIE jest wynikiem — popraw wzorzec albo ścieżkę.');
  process.exit(1);
}

let zle = 0;
for (const [n, oczekiwane] of przypadki) {
  const mam = liczebnik(n, F);
  if (mam !== oczekiwane) { console.error(`ROZJAZD: liczebnik(${n}) = "${mam}", produkt oczekuje "${oczekiwane}"`); zle++; }
}
console.log(zle
  ? `NIEZGODNOŚĆ na ${zle} z ${przypadki.length} przypadków — kopia w scripts/dev odstaje od src/utils/liczebnik.ts`
  : `ZGODNE: ${przypadki.length} przypadków z ${TEST} przechodzi na kopii w scripts/dev.`);
process.exit(zle ? 1 : 0);
