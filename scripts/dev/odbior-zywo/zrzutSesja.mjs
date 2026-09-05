#!/usr/bin/env node
/**
 * PRZYRZĄD (nie produkt) — logika zapisu sesji dla zrzut.mjs, WYDZIELONA żeby
 * dało się ją przetestować jednostkowo bez playwrighta/przeglądarki.
 *
 * BLOKER RAPORT_B #6 (evidence/audyt-mvp-20260906/B/RAPORT_B.md, sekcja
 * „Blokada środowiska" + G6): `zrzut.mjs` zapisywało `ctx.storageState()` z
 * powrotem do pliku sesji za KAŻDYM razem, gdy końcowy URL nie zawierał
 * `/login` — także gdy trafiło na stronę PUBLICZNĄ bez ważnej sesji (np.
 * `/`, `/audits` marketingowe). W środowisku, gdzie kilku agentów naraz
 * współdzieli TEN SAM plik sesji (`ODBIOR_AUTH_STATE`), wystarczyło że
 * JEDEN proces odwiedził publiczną stronę bez tokenu, żeby nadpisać ważną
 * sesję innego agenta pustym/bez-tokenowym stanem — dokładnie to się stało
 * 05.09 (zmierzone: sesja odzyskała ważność, po czym `auth.json` chwilę
 * później znów zawierał stan BEZ klucza `token` w ogóle).
 *
 * NAPRAWA (świadoma zmiana zachowania, nie kosmetyka):
 *   1) Zapis NIGDY nie jest domyślny — tylko z jawną opcją `--zapisz-sesje`.
 *   2) Nawet z tą opcją, zapis następuje TYLKO gdy w KOŃCOWYM stanie
 *      przeglądarki `localStorage.token` (dla origin bazowego) jest
 *      niepuste ORAZ URL końcowy nie jest `/login`.
 *   3) Zapis jest atomowy: plik tymczasowy w tym samym katalogu + `rename`
 *      (rename na tym samym systemie plików jest atomowy — nigdy nie ma
 *      okna, w którym `auth.json` jest częściowo zapisany/pusty).
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Wyciąga wartość `localStorage.token` dla danego originu ze stanu sesji
 * Playwrighta (`{ origins: [{ origin, localStorage: [{name, value}] }] }`).
 * Zwraca pusty string, gdy nie ma originu/klucza/wartości — NIGDY nie rzuca.
 */
export function wyciagnijToken(storageState, origin) {
  try {
    const originy = (storageState && storageState.origins) || [];
    const wpis = originy.find((o) => o && o.origin === origin);
    const token = (wpis && wpis.localStorage || []).find((e) => e && e.name === 'token');
    return (token && token.value) || '';
  } catch {
    return '';
  }
}

/**
 * Czysta decyzja "czy wolno zapisać sesję teraz" — bez efektów ubocznych,
 * łatwa do przetestowania każdym wariantem wejścia.
 *
 * @param {{ zapiszSesje: boolean, urlKoncowy: string, tokenObecny: string }} wejscie
 * @returns {{ wolno: boolean, powod: string }}
 */
export function czyZapisacSesje({ zapiszSesje, urlKoncowy, tokenObecny }) {
  if (!zapiszSesje) {
    return { wolno: false, powod: 'brak jawnej opcji --zapisz-sesje (domyślnie zapis jest WYŁĄCZONY)' };
  }
  if (String(urlKoncowy || '').includes('/login')) {
    return { wolno: false, powod: 'url koncowy to /login — nie ma za co zapisywać' };
  }
  if (!tokenObecny || !String(tokenObecny).trim()) {
    return { wolno: false, powod: 'brak tokenu w localStorage — strona publiczna albo wylogowanie' };
  }
  return { wolno: true, powod: 'zapiszSesje=true, url nie jest /login, token obecny' };
}

/**
 * Zapis atomowy: plik tymczasowy w TYM SAMYM katalogu (żeby rename był na
 * jednym systemie plików) + rename. Nigdy nie zostawia pliku docelowego w
 * stanie połowicznym — albo widać starą, kompletną zawartość, albo nową.
 */
export function zapiszAtomowo(sciezkaPliku, obiekt) {
  const katalog = path.dirname(sciezkaPliku);
  const tmp = path.join(
    katalog,
    `.${path.basename(sciezkaPliku)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  fs.writeFileSync(tmp, JSON.stringify(obiekt, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, sciezkaPliku);
}

/**
 * Orkiestracja wywoływana przez zrzut.mjs po zrobieniu zrzutu: sprawdza czy
 * wolno zapisać, i jeśli tak — przepisuje origin z powrotem na kanoniczny
 * `:3000` (tak jak dotychczasowe zachowanie) i zapisuje atomowo.
 *
 * `writeFn` jest wstrzykiwalne, żeby test jednostkowy mógł podstawić spy
 * zamiast dotykać realnego systemu plików.
 *
 * @returns {{ zapisano: boolean, powod: string }}
 */
export function zapiszSesjeJesliBezpiecznie({
  zapiszSesje,
  urlKoncowy,
  storageState,
  baza,
  authPath,
  kanonicznyOrigin = 'http://localhost:3000',
  writeFn = zapiszAtomowo,
}) {
  const tokenObecny = wyciagnijToken(storageState, baza);
  const decyzja = czyZapisacSesje({ zapiszSesje, urlKoncowy, tokenObecny });
  if (!decyzja.wolno) {
    return { zapisano: false, powod: decyzja.powod };
  }
  const st = { ...storageState };
  st.origins = (st.origins || []).map((o) => ({
    ...o,
    origin: String(o.origin).replace(baza, kanonicznyOrigin),
  }));
  writeFn(authPath, st);
  return { zapisano: true, powod: decyzja.powod };
}
