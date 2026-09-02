/**
 * PODGLĄD KART MODUŁOWYCH — statyczny plik do OBEJRZENIA przez nadzorcę,
 * zanim cokolwiek trafi na działającą stronę odbioru (:3030).
 *
 * POWÓD ISTNIENIA: właściciel w tej chwili klika na :3030. Reguła nr 3 mówi, że
 * nie jest pierwszym testerem, a nadzorca prosił wprost: „pokaż mi dwa moduły
 * ZANIM zbudujesz pozostałe 14". Ten skrypt renderuje karty do pliku i nie
 * dotyka ani serwera, ani bazy — zero ryzyka dla jego bieżącej pracy.
 *
 * Użycie: node scripts/dev/moduly-podglad.mjs [KOD_MODULU ...]
 */
import fs from 'fs';
import path from 'path';
import { czytajMape, korpus, naprawioneDzis, wstrzymane, nazwyEkranow, oknoDecyzji, kartaModulu } from './lib/kartyModulow.mjs';
import { STYL_MODULOW } from './lib/stylModulow.mjs';

const ROOT = process.cwd();
const chce = process.argv.slice(2);
const mapa = czytajMape(ROOT).filter((s) => /^[0-9]/.test(s.kod));
const wybrane = chce.length ? mapa.filter((s) => chce.includes(s.kod)) : mapa;

const ctx = {
  naprawione: naprawioneDzis(ROOT),
  wstrz: wstrzymane(ROOT),
  nazwy: nazwyEkranow(ROOT),
  kor: korpus(ROOT),
};

const karty = wybrane.map((s) =>
  kartaModulu(s, { ...ctx, okno: oknoDecyzji(ROOT, new Set(s.ekrany.map((e) => e.id))), decyzja: {} })
).join('\n');

const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Karty modułów — podgląd</title><style>${STYL_MODULOW}</style></head><body>
<div class="pasek"><h1>Odbiór modułowy — ${wybrane.length} z 16</h1>
<span class="lic">Jedna karta na moduł. Jedno kliknięcie na moduł. To jest Twoje ostatnie przejście, nie kolejny przegląd ekranów.</span></div>
<main class="mkarty">${karty}</main></body></html>`;

const out = path.join(ROOT, 'evidence/grafika/216-poprawione-dzis/_podglad-modulow.html');
/**
 * Podgląd leży W TYM SAMYM katalogu co zrzuty, więc trasa serwera `/png/<kat>/`
 * zamienia się na ścieżkę względną. Bez tego kadr kontrolny pokazywałby same
 * puste ramki i „obejrzałem" znaczyłoby „obejrzałem brak obrazków" — dokładnie
 * ten rodzaj cichej porażki pomiaru, który opisuje reguła nr 12.
 */
fs.writeFileSync(out, html.replaceAll('/png/216-poprawione-dzis/', './'), 'utf8');
console.log('podgląd →', out);
console.log('modułów:', wybrane.length, '| korpus uwag:', ctx.kor.jest ? 'wczytany' : 'JESZCZE NIE MA (karta mówi to wprost)');
