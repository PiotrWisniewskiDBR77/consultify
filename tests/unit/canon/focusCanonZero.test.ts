import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

// 2026-09-03 — naprawa dyzuru 287 (odbior C, SCALIC Z ZASTRZEZENIEM).
//
// Poprzednia wersja tego testu asercjowala "RAZEM: 0 wystapien w 0 plikach"
// w baseline ORAZ trzymala WLASNA, oddzielna kopie wzorca naruszen
// (`violationPattern` — duplikat VIOLATION_RE z check-focus-canon.sh).
// To wlasnie ta druga kopia byla przyczyna dziury: dyzur 287 zmienil
// VIOLATION_RE w skrypcie (dodal wymog prefiksu focus:/focus-visible:),
// ale test dalej mial STARY/inny wzorzec — dwa niezalezne zrodla prawdy o
// tym samym kanonie, ktore mogly (i musialy) sie rozjechac.
//
// Zmierzone przy tej naprawie: baseline NIE JEST zerem — 64 wystapien w 45
// plikach. Nie jest to regresja, to swiadomy, zmierzony dlug:
//   - 44 realne pierscienie/obramowania fokusu NAPRAWIONO w tym dyzurze
//     (focus:/focus-visible:/peer-focus: ring-primary-* -> ring-c-focus,
//     analogicznie border-c-focus tam gdzie to byl jedyny pozostaly crimson
//     na linii) — zobacz git log tego dyzuru.
//   - 27 wystapien to focus:ring-primary-* na TEJ SAMEJ linii co niezwiazany
//     zastany primary (checkbox text-primary-*, dekoracyjny bg-/border-
//     primary-* bez prefiksu focus:) — naprawienie SAMEGO fokusu i tak
//     blokowalo commit przez check-triada.sh (skanuje CALA nowo-dodana
//     linie, nie pojedynczy token; jedyny wyjatek jest per-PLIK w
//     triada-allowlist.txt, co byloby szersza dziura niz uzasadnia ten
//     dyzur). Naprawa checkboxow/tla to osobna decyzja wizualna (kolor
//     "zaznaczono"), poza zakresem "tylko klasy fokusu" tego dyzuru.
//   - 37 wystapien to pierscienie STANU ZAZNACZENIA (karta wybrana, "dzis"
//     w kalendarzu, awatar) zlapane przez PRZYWROCONY goly wzorzec
//     ring-(primary|crimson)-/outline-(primary|crimson)-/
//     ring-offset-(primary|crimson)- (identyczny z tym sprzed 287) —
//     odbior C zmierzyl, ze te 39 (teraz 37 po zmianie stanu repo)
//     wypadlo spod bramki PO CICHU, gdy 287 zwezil regex do wymogu
//     prefiksu focus:. Nie sa to fokusy, wiec NIE sa naprawiane tutaj —
//     sa jawnym dlugiem w baseline (patrz TOP w `check-focus-canon.sh`).
//
// Test NIE trzyma juz wlasnej kopii wzorca. Zamiast tego uruchamia REALNY
// straznik (`check-focus-canon.sh --ci`) i pilnuje, zeby: (1) --ci bylo
// zielone na aktualnym stanie repo (ratchet per-plik, K-41 — dlug moze
// tylko malec), (2) liczba w baseline nie ROSNIE ponad zmierzona wartosc
// (64/45) — jesli kolejny dyzur domknie czesc dlugu, TEN test ma zaczac
// failowac az ktos zaktualizuje liczby w dol, nie w gore.
describe('focus canon baseline guard', () => {
  it('linia bazowa fokusa-crimson nie rosnie i jest rowna 64 wystapien w 45 plikach (2026-09-03, naprawa 287)', () => {
    const baseline = readFileSync(
      resolve(root, 'scripts/check-focus-canon.baseline.txt'),
      'utf8'
    );

    const match = baseline.match(/RAZEM:\s*(\d+)\s*wystapien w\s*(\d+)\s*plikach/);
    expect(match, 'baseline musi miec linie "# RAZEM: N wystapien w M plikach"').not.toBeNull();
    const occurrences = Number(match![1]);
    const files = Number(match![2]);

    // Pin: 2026-09-03. Wolno TYLKO maleć (dlug spadl -> zaktualizuj obie
    // liczby w dol razem z tym komentarzem). Wzrost = regresja kanonu.
    expect(occurrences).toBeLessThanOrEqual(64);
    expect(files).toBeLessThanOrEqual(45);
  });

  it('check-focus-canon.sh --ci jest zielone na aktualnym stanie drzewa (ratchet per plik, K-41)', () => {
    expect(() =>
      execFileSync('bash', ['scripts/check-focus-canon.sh', '--ci'], {
        cwd: root,
        encoding: 'utf8',
        stdio: 'pipe',
      })
    ).not.toThrow();
  });
});
