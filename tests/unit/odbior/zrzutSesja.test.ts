/**
 * BLOKER audytu evidence/audyt-mvp-20260906/B/RAPORT_B.md (defekt #6, sekcja
 * „Blokada środowiska" + wiersz G6): `scripts/dev/odbior-zywo/zrzut.mjs`
 * zapisywało sesję z powrotem do ODBIOR_AUTH_STATE za KAŻDYM razem, gdy
 * końcowy URL nie zawierał `/login` — także gdy trafiło na stronę PUBLICZNĄ
 * bez ważnej sesji. Przy kilku agentach współdzielących JEDEN plik sesji
 * wystarczyło, że jeden proces odwiedził stronę publiczną bez tokenu, żeby
 * nadpisać ważną sesję innego agenta.
 *
 * Naprawa (scripts/dev/odbior-zywo/zrzutSesja.mjs): zapis NIGDY nie jest
 * domyślny (tylko z `--zapisz-sesje`), i nawet wtedy następuje TYLKO gdy stan
 * ma niepusty token dla originu bazowego ORAZ url końcowy nie jest `/login`.
 * Zapis jest atomowy (plik tymczasowy w tym samym katalogu + rename).
 *
 * Mutacja: przywrócenie starego zachowania (`czyZapisacSesje` ignorujące
 * `zapiszSesje`/token, zapisujące zawsze gdy url != /login) wywala testy
 * poniżej — patrz komentarz przy każdym teście.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  czyZapisacSesje,
  wyciagnijToken,
  zapiszAtomowo,
  zapiszSesjeJesliBezpiecznie,
} from '../../../scripts/dev/odbior-zywo/zrzutSesja.mjs';

const BAZA = 'http://localhost:3011';

const stanZTokenem = (token = 'abc123') => ({
  origins: [
    {
      origin: BAZA,
      localStorage: [{ name: 'token', value: token }],
    },
  ],
});

const stanBezTokenu = () => ({
  origins: [
    {
      origin: BAZA,
      localStorage: [{ name: 'inny_klucz', value: 'x' }],
    },
  ],
});

describe('wyciagnijToken', () => {
  it('zwraca wartość tokenu dla dopasowanego originu', () => {
    expect(wyciagnijToken(stanZTokenem('sekret'), BAZA)).toBe('sekret');
  });

  it('zwraca pusty string, gdy origin/klucz/wartość nie istnieją — nigdy nie rzuca', () => {
    expect(wyciagnijToken(stanBezTokenu(), BAZA)).toBe('');
    expect(wyciagnijToken({}, BAZA)).toBe('');
    expect(wyciagnijToken(null, BAZA)).toBe('');
    expect(wyciagnijToken(undefined, BAZA)).toBe('');
    expect(wyciagnijToken(stanZTokenem('x'), 'http://inny-origin')).toBe('');
  });
});

describe('czyZapisacSesje — domyślnie WYŁĄCZONY zapis (BLOKER RAPORT_B #6)', () => {
  it('odmawia, gdy brak jawnej opcji --zapisz-sesje, NAWET z ważnym tokenem i url != /login', () => {
    const decyzja = czyZapisacSesje({
      zapiszSesje: false,
      urlKoncowy: 'http://localhost:3011/my-work',
      tokenObecny: 'abc123',
    });
    expect(decyzja.wolno).toBe(false);
  });

  it('odmawia, gdy url końcowy to /login (nawet z --zapisz-sesje)', () => {
    const decyzja = czyZapisacSesje({
      zapiszSesje: true,
      urlKoncowy: 'http://localhost:3011/login?redirect=%2Fmy-work',
      tokenObecny: 'abc123',
    });
    expect(decyzja.wolno).toBe(false);
  });

  it(
    'odmawia, gdy nie ma tokenu — DOKŁADNIE scenariusz z RAPORT_B: strona publiczna ' +
      'bez ważnej sesji, url != /login, ale brak tokenu',
    () => {
      const decyzja = czyZapisacSesje({
        zapiszSesje: true,
        urlKoncowy: 'http://localhost:3011/',
        tokenObecny: '',
      });
      expect(decyzja.wolno).toBe(false);
    }
  );

  it('pozwala TYLKO gdy wszystkie trzy warunki spełnione: flaga + token + url != /login', () => {
    const decyzja = czyZapisacSesje({
      zapiszSesje: true,
      urlKoncowy: 'http://localhost:3011/my-work',
      tokenObecny: 'abc123',
    });
    expect(decyzja.wolno).toBe(true);
  });
});

describe('zapiszSesjeJesliBezpiecznie — orkiestracja end-to-end (bez realnego systemu plików)', () => {
  it('NIE wywołuje writeFn, gdy --zapisz-sesje nie podano (domyślne zachowanie)', () => {
    const writeFn = vi.fn();
    const wynik = zapiszSesjeJesliBezpiecznie({
      zapiszSesje: false,
      urlKoncowy: 'http://localhost:3011/my-work',
      storageState: stanZTokenem(),
      baza: BAZA,
      authPath: '/tmp/auth.json',
      writeFn,
    });
    expect(wynik.zapisano).toBe(false);
    expect(writeFn).not.toHaveBeenCalled();
  });

  it(
    'NIE wywołuje writeFn, gdy strona publiczna bez tokenu — DOKŁADNIE scenariusz ' +
      'RAPORT_B (nadpisanie cudzej ważnej sesji)',
    () => {
      const writeFn = vi.fn();
      const wynik = zapiszSesjeJesliBezpiecznie({
        zapiszSesje: true,
        urlKoncowy: 'http://localhost:3011/',
        storageState: stanBezTokenu(),
        baza: BAZA,
        authPath: '/tmp/auth.json',
        writeFn,
      });
      expect(wynik.zapisano).toBe(false);
      expect(writeFn).not.toHaveBeenCalled();
    }
  );

  it('wywołuje writeFn z originem przepisanym na kanoniczny :3000, gdy wszystko dozwolone', () => {
    const writeFn = vi.fn();
    const wynik = zapiszSesjeJesliBezpiecznie({
      zapiszSesje: true,
      urlKoncowy: 'http://localhost:3011/my-work',
      storageState: stanZTokenem('rotowany-token'),
      baza: BAZA,
      authPath: '/tmp/auth.json',
      writeFn,
    });
    expect(wynik.zapisano).toBe(true);
    expect(writeFn).toHaveBeenCalledTimes(1);
    const [sciezka, zapisanyObiekt] = writeFn.mock.calls[0];
    expect(sciezka).toBe('/tmp/auth.json');
    expect(zapisanyObiekt.origins[0].origin).toBe('http://localhost:3000');
    expect(zapisanyObiekt.origins[0].localStorage[0].value).toBe('rotowany-token');
  });
});

describe('zapiszAtomowo — plik tymczasowy + rename, nigdy stan połowiczny', () => {
  it('pisze do pliku tymczasowym obok docelowego i dopiero potem podmienia (rename)', async () => {
    const os = await import('node:os');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zrzut-sesja-test-'));
    const docelowy = path.join(dir, 'auth.json');
    fs.writeFileSync(docelowy, JSON.stringify({ stary: true }));

    zapiszAtomowo(docelowy, { nowy: true, origins: [] });

    // Docelowy plik ma NOWĄ zawartość — rename się wykonał.
    const tresc = JSON.parse(fs.readFileSync(docelowy, 'utf8'));
    expect(tresc).toEqual({ nowy: true, origins: [] });

    // Żaden plik tymczasowy nie został po sobie — rename go skonsumował.
    const pliki = fs.readdirSync(dir);
    expect(pliki).toEqual(['auth.json']);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
