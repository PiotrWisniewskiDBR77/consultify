/**
 * J17 — BRAMKA ŹRÓDŁOWA (ratchet): nowa odpowiedź błędu z serwera nie ma prawa
 * wieźć zdania po polsku bez kodu.
 *
 * DLACZEGO TEST ŹRÓDŁOWY, A NIE SCENARIUSZOWY: test scenariuszowy sprawdza
 * JEDNĄ trasę i przechodzi na zielono po skasowaniu zabezpieczenia w drugiej.
 * Tu skanujemy CAŁE `server/src/routes/**` + `server/src/middleware/**`, więc
 * dopisanie `res.status(400).json({ error: 'Nie można' })` gdziekolwiek daje
 * czerwony wynik natychmiast.
 *
 * RATCHET: dług zastany jest zamrożony w `serverErrorCodeRatchet.dlug.json`
 * (lista `plik:linia:tekst`). Test pada, gdy pojawi się naruszenie SPOZA tej
 * listy. Wpis wolno z listy USUNĄĆ (naprawa), nigdy dopisać nowy.
 *
 * MUTACJA DOWODOWA: dopisz w dowolnym routerze
 *   res.status(400).json({ error: 'Nie można' });
 * — test staje się czerwony.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DLUG_PLIK = path.join(
  ROOT,
  'tests/unit/i18n/serverErrorCodeRatchet.dlug.json'
);

const KATALOGI = ['server/src/routes', 'server/src/middleware'];

/** Litery i słowa, które w praktyce nie występują w angielskim komunikacie. */
const POLSKIE_ZNAKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const POLSKIE_SLOWA =
  /\b(nie|sie|jest|brak|blad|wymagany|wymagane|musi|zostal|zostala|zostalo|udalo|prosze|dane|nowy|tylko)\b/i;

export function jestPolskie(tekst: string): boolean {
  if (POLSKIE_ZNAKI.test(tekst)) return true;
  // bez diakrytyków też się zdarza („Nie udalo sie zapisac wniosku")
  return POLSKIE_SLOWA.test(tekst) && /\s/.test(tekst);
}

function listujPliki(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listujPliki(p);
    if (!e.name.endsWith('.ts')) return [];
    if (/\.(test|spec)\.ts$/.test(e.name)) return [];
    return [p];
  });
}

/** Wycina literał obiektu zaczynający się na `{` pod indeksem `start`. */
function wytnijObiekt(src: string, start: number): string {
  let glebokosc = 0;
  for (let i = start; i < src.length && i < start + 20000; i += 1) {
    const c = src[i];
    if (c === '{') glebokosc += 1;
    else if (c === '}') {
      glebokosc -= 1;
      if (glebokosc === 0) return src.slice(start, i + 1);
    }
  }
  return src.slice(start, start + 2000);
}

export function znajdzNaruszenia(rootDir: string = ROOT): string[] {
  const naruszenia: string[] = [];
  const pliki = KATALOGI.flatMap((k) => listujPliki(path.join(rootDir, k)));

  for (const plik of pliki) {
    const src = fs.readFileSync(plik, 'utf8');
    const rel = path.relative(rootDir, plik);
    const re = /res\s*\.\s*status\(\s*(\d{3})[^)]*\)\s*\.\s*json\(\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const status = Number(m[1]);
      if (status < 400) continue;
      const obiekt = wytnijObiekt(src, src.indexOf('{', m.index + m[0].length - 1));
      if (/\b(errorCode|code)\s*:/.test(obiekt)) continue;

      const zdania = [...obiekt.matchAll(/\b(?:error|message)\s*:\s*(["'`])([^"'`]{4,300})\1/g)];
      for (const z of zdania) {
        const tekst = z[2];
        if (/^[A-Z0-9_.:-]+$/.test(tekst)) continue; // to już kod, nie zdanie
        if (!jestPolskie(tekst)) continue;
        const linia = src.slice(0, m.index).split('\n').length;
        naruszenia.push(`${rel}:${linia}:${tekst}`);
      }
    }
  }
  return naruszenia.sort();
}

describe('J17 — serwer nie wysyła polskiego zdania bez kodu błędu', () => {
  const zamrozone = new Set(JSON.parse(fs.readFileSync(DLUG_PLIK, 'utf8')).dlug);

  it('skaner w ogóle coś widzi (bezpiecznik: brak pomiaru to nie wynik)', () => {
    const pliki = KATALOGI.flatMap((k) => listujPliki(path.join(ROOT, k)));
    assert.ok(pliki.length > 100, `skaner znalazł tylko ${pliki.length} plików serwera`);
  });

  it('skaner rozpoznaje polskie zdanie także bez diakrytyków', () => {
    assert.equal(jestPolskie('Nie udalo sie zapisac wniosku'), true);
    assert.equal(jestPolskie('Nie udało się pobrać folderów'), true);
    assert.equal(jestPolskie('Folders could not be loaded.'), false);
    assert.equal(jestPolskie('VAULT_SCOPE_INVALID'), false);
  });

  it('zero naruszeń spoza zamrożonej listy długu', () => {
    const nowe = znajdzNaruszenia().filter((n) => !zamrozone.has(n));
    assert.deepEqual(
      nowe,
      [],
      `Nowe polskie zdanie z serwera bez kodu błędu (${nowe.length}):\n` +
        nowe.join('\n') +
        '\n\nNapraw: dodaj `errorCode` (patrz server/src/utils/apiError.ts) i wpis ' +
        'w `errors.*` w public/locales/{pl,en}/translation.json.'
    );
  });

  it('lista długu nie zawiera wpisów już naprawionych (ratchet idzie w dół)', () => {
    const aktualne = new Set(znajdzNaruszenia());
    const martwe = [...zamrozone].filter((n) => !aktualne.has(n));
    assert.deepEqual(
      martwe,
      [],
      `Te wpisy długu już nie istnieją — usuń je z ${path.basename(DLUG_PLIK)}:\n` +
        martwe.join('\n')
    );
  });
});
