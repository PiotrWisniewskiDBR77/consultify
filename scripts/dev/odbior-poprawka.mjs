/**
 * ZGŁOSZENIE POPRAWKI — zapala właścicielowi zielony znacznik „obejrzyj ponownie".
 *
 * Pętla, którą to zamyka (ustalona z właścicielem 2026-08-30):
 *   on pisze uwagę → ja naprawiam → robię NOWY zrzut → wołam ten skrypt →
 *   jego strona zapala kartę na zielono SAMA, bez odświeżania, z opisem co zmieniłem.
 *
 * Znacznik gaśnie sam, kiedy właściciel kliknie cokolwiek na tej karcie po
 * poprawce — bo to znaczy, że już ją zobaczył i się odniósł.
 *
 * Użycie:
 *   node scripts/dev/odbior-poprawka.mjs karta-insight "Trzy kolumny zamienione na trzy wiersze z kolorami."
 *
 * WAŻNE: wołaj to DOPIERO po zrobieniu nowego zrzutu. Znacznik czasu poprawki
 * odświeża adres obrazka u właściciela — jeśli zrzut jest stary, zobaczy stan
 * sprzed naprawy i oceni nieaktualny obraz.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BAZA = path.join(ROOT, 'docs/program/grafika/odbior.sqlite');
const STATUS = path.join(ROOT, 'docs/program/grafika/status.json');

const [ekran, ...reszta] = process.argv.slice(2);
const opis = reszta.join(' ').trim();

if (!ekran || !opis) {
  console.error('Użycie: node scripts/dev/odbior-poprawka.mjs <ekran> "<co zmieniłem>"');
  process.exit(1);
}

// Ekran spoza rejestru to zwykle literówka w nazwie — lepiej stanąć niż po cichu
// zapisać poprawkę, której właściciel nigdy nie zobaczy.
const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
const znane = new Set(status.moduly.flatMap((m) => m.ekrany.map((e) => e.id)));
if (!znane.has(ekran)) {
  console.error(`BŁĄD: „${ekran}" nie występuje w rejestrze ekranów. Literówka?`);
  process.exit(1);
}

const db = new DatabaseSync(BAZA);
db.exec(`
  CREATE TABLE IF NOT EXISTS poprawki (
    lp    INTEGER PRIMARY KEY AUTOINCREMENT,
    ekran TEXT NOT NULL,
    opis  TEXT NOT NULL,
    kiedy TEXT NOT NULL
  );
`);
const kiedy = new Date().toISOString();
db.prepare('INSERT INTO poprawki (ekran, opis, kiedy) VALUES (?, ?, ?)').run(ekran, opis, kiedy);

const ile = db.prepare('SELECT COUNT(*) AS n FROM poprawki').get().n;
console.log(`Zapalone: ${ekran} → „${opis}"`);
console.log(`Poprawek w bazie: ${ile}. Właściciel zobaczy to u siebie w ciągu ~6 sekund.`);
