# Ready-to-paste Claude launch prompt — Ideas complete transformation

Pracujesz na dokładnym working tree przekazanym do zadania. Twoim terminalnym celem jest wdrożenie i doprowadzenie do finalnego odbioru kompletnego programu przebudowy Consultify Ideas.

Najpierw przeczytaj W CAŁOŚCI:

1. `docs/qa/ideas-manual-audit-2026-08-09/09_IDEAS_COMPLETE_TRANSFORMATION_PROGRAM_FOR_CLAUDE.md`
2. `docs/qa/ideas-manual-audit-2026-08-09/11_IDEAS_EPICS_DOD_AND_FINAL_ACCEPTANCE_PROTOCOL.md`
3. `docs/qa/ideas-manual-audit-2026-08-09/08_P1_P3_EXECUTION_PLAN_FOR_CLAUDE.md`
4. wszystkie źródła wskazane w sekcji 1 dokumentu `09` i sekcji 2 dokumentu `11`.

Dokument `09` jest nadrzędnym programem celu. Dokument `11` jest normatywnym kontraktem epików, Definition of Done, testów funkcjonalnych, graficznych i customer experience oraz przekazania do niezależnego odbioru Codex. Dokument `08` jest szczegółowym pakietem wszystkich P1–P3. Kanon `docs/standards/idea-workspace/01_MODEL_I_ZASADY.md` oraz aktualna decyzja nawigacyjna z rozdziału 13 rozstrzygają konflikt starszych materiałów.

Ustaw aktywny cel w swoim systemie pracy:

> Przebudować Consultify Ideas w jeden kompletny, spójny, kompetentny biznesowo i finansowo system czterech reprezentacji jednej Idei; wdrożyć wszystkie P1–P3, program 09 i epiki E00–E15 z dokumentu 11; naprawiać defekty napotkane w tym zakresie; wykonać testy, runtime readback, dowody wizualne i finalny check dla jednego dokładnego candidate SHA; pracować aż do READY_FOR_CODEX_REVIEW albo literalnego, udokumentowanego BLOCKED_EXTERNAL wymagającego decyzji właściciela lub zewnętrznej autoryzacji.

Zasady wykonania:

- zacznij od bramki wersji, HEAD, dirty state, owner/allowlist i runtime badge;
- nie resetuj, nie czyść, nie stashuj ani nie nadpisuj cudzych zmian;
- prowadź jeden aktualny plan oraz ledger wykonania;
- stosuj uniwersalny DoD dokumentu `11` do każdego wymagania i nie zamykaj epiku częściowym dowodem;
- implementuj, testuj i retestuj; to nie jest audyt read-only;
- naprawiaj błędy znalezione w zdefiniowanym zakresie i kontynuuj;
- nie uznawaj kodu, mocka, testu jednostkowego, type-checka, screenshotu ani self-reportu za samodzielny dowód pełnego działania;
- dowód runtime i readback muszą odpowiadać temu samemu SHA;
- brak dowodu = `NOT VERIFIED`; nie zgaduj;
- nie wykonuj nieautoryzowanych operacji produkcyjnych, destrukcyjnych danych zewnętrznych, deployu, commitu ani pushu;
- gdy wymagane są nieodwracalne decyzje właścicielskie, dokończ wszystkie niezależne prace i eskaluj najmniejszą konkretną decyzję;
- `READY_FOR_REVIEW` nie jest zakończeniem.
- `READY_FOR_CODEX_REVIEW` wolno nadać dopiero po dwóch kolejnych pełnych rundach bez nowego P0/P1 i skompletowaniu handoffu z sekcji 9 dokumentu `11`.

Wymagany rezultat:

- wszystkie programy A–H wykonane;
- wszystkie otwarte P1–P3 zamknięte lub literalnie zablokowane;
- cztery sceny narzędzi i pełna golden journey przechodzą od zera do reopen/readback;
- kompetencje biznesowe i finansowe mają realny model danych, obliczenia, lineage i downstream conversion/readback;
- grafika, light/dark, PL/EN, viewporty, 200% zoom, klawiatura i accessibility przechodzą macierz;
- komplet artefaktów z sekcji 16 zapisany w nowym datowanym folderze;
- wszystkie epiki E00–E15 mają wynik i dowody, a każdy `NOT VERIFIED` jest jawnie wykazany;
- finalny pakiet otrzymuje status `READY_FOR_CODEX_REVIEW`; ostateczne `ACCEPT`, `ACCEPT WITH NAMED LIMITATION` albo `DO NOT ACCEPT` nadaje Codex po niezależnym review.

Nie zatrzymuj się po szybkim smoke teście ani po pierwszej fali. Kontynuuj tak długo, jak istnieje bezpieczny krok prowadzący do osiągnięcia celu.
