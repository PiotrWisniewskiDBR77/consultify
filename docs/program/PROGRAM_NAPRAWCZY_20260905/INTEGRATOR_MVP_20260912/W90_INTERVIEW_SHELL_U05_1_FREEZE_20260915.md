# INTERVIEW-SHELL U05-1 — freeze DEC-535

**Werdykt:** rdzeń jednej powłoki sesji jest READY FOR CTO REVIEW; zatwierdzanie odpowiedzi jest stanem pytania, a stara lista `Answer approval` nie występuje w żadnym stanie powłoki.

## Dostarczone zachowanie

- Jedna dedykowana powłoka dla `in_progress`, `submitted`, `approved` i `completed`, niezależnie od roli.
- Menu 1 zawiera Back, tytuł, lifecycle, `Template · Assignee · Due`, postęp, najwyżej jeden primary oraz kebab. Usunięto przejście `List` do drugiej powierzchni N-karty.
- Stan `Pending approval / Approved / Sent back / AI review` jest widoczny przy pytaniu i w nawigatorze.
- Manager zatwierdza lub odsyła pojedynczą odpowiedź z dialogiem powodu; decyzje mają neutralne CTA. Nagłówek pozwala zatwierdzić wszystkie oczekujące jednym wołaniem API.
- `AI quality review` jest jednym wierszem z akcją Refresh. Błąd projekcji jest widoczny, a zapis pozostaje fail-closed.
- Automatyczne przewijanie aktywnego pytania zmienia wyłącznie `scrollTop` nawigatora; nie może przesunąć powłoki ukrytym overflow.
- Przycisk Next ma kontrast w jasnym motywie (`bg-c-text text-c-surface`).

## Dowody

- Macierz: 4 lifecycle × 4 liczby zatwierdzeń × 2 role = 32 kombinacje; zawsze jedna powłoka i question runtime, stara sekcja nie istnieje.
- Testy delty i importerów: 7 plików / 52 testy PASS, `--retry=0`, jeden worker.
- Testy celowane po ostatniej korekcie: 2 pliki / 30 testów PASS.
- Esbuild: 3/3 entrypointy PASS.
- Front TSC, pełny przebieg bez limitu, ten sam `node_modules`: baza `9cf10528e3` = 169 (Wpis 96), kandydat = 169, delta 0; zero diagnostyk w zmienionych ścieżkach.
- Server TSC: baza = 0, kandydat = 0.
- Zrzuty obejrzane: `evidence/interview-shell-u05-1/zywy-submitted-en-light-1440x900.png` i `zywy-approved-en-light-1440x900.png`; oba 1440×900, EN light, bez starego panelu, bez poziomego overflow. Łącznie poniżej 400 KB.

## Granice

Brak migracji, flag, zapisów stagingowych, deployu i zmian Railway. U05-2 (lista sesji) i U05-3 (prawy panel, edytor szablonów, Executive Summary) pozostają osobnymi paczkami. Po tym freeze kolejka A przechodzi do DRD-2 zgodnie z Wpisem 99.
