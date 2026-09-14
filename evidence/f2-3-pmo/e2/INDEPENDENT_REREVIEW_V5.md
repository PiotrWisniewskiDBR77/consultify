# F2-3 PMO E2 — piąty świeży niezależny rereview

**Werdykt: HOLD. Jedyna funkcjonalna delta po V4 usuwa naruszenie strażnika akcji, ale wprowadza P1: przyciski „Cancel” i X są teraz domyślnymi submitterami formularza, więc anulowanie z wypełnioną nazwą tworzy projekt.**

Rereview wykonano 2026-09-13 na gałęzi `codex/pmo-projekty-role-statusy-20260913`, przy bazie i niezmienionym HEAD `ba25e564592f4a803ecf53edf81b7d8c84524426`. SHA-256 dokładnego manifestu V5 wynosi `f3689221dfb88f9016ade727853dd9a8b57108bc746d7d65d99d9e70b9db1673`; wszystkie 74/74 wpisów przeszły świeże `shasum -a 256 -c`, dryf wynosi 0. Ten raport jest oddzielnym artefaktem review i nie należy do manifestu autora.

## P1 — anulowanie tworzy projekt

Post-V4 delta zamieniła kontener modala na `<form onSubmit>` i prawidłowo ustawiła właściwy przycisk Create na `type="submit"`. Dwa pozostałe przyciski wewnątrz tego samego formularza pozostały jednak bez jawnego `type="button"`:

- X w `CreateProjectModal.tsx:97-102`,
- Cancel w `CreateProjectModal.tsx:175-181`.

Zgodnie z natywną semantyką HTML oba mają domyślny typ `submit`. Świeży niezależny test zachowania zamontował produkcyjny `CreateProjectModal`, wpisał poprawną nazwę i kliknął „Cancel”; mock produkcyjnego wywołania `Api.createProject` został wywołany dokładnie 1 raz. To potwierdza rzeczywistą regresję React/DOM, a nie tylko wniosek ze źródła. Test obserwacyjny został usunięty po biegu i nie zmienił kandydata.

Wymagana poprawka jest ograniczona: oba przyciski zamknięcia muszą mieć `type="button"`, a trwały test produkcyjnego komponentu powinien potwierdzić, że Cancel i X nie wywołują `Api.createProject`, podczas gdy Enter oraz przycisk Create wywołują je dokładnie raz. Po poprawce potrzebny jest nowy manifest i świeży rereview.

## Zielone bramki V5

- Manifest: 74/74 PASS, dryf 0.
- Świeży focused unit/behavior/i18n/flag: 5 plików, 14/14 PASS, retry 0. Obecny denominator nie montuje `CreateProjectModal` i dlatego nie wykrywa regresji anulowania.
- `check-action-coverage.sh src/components/MyWork/CreateProjectModal.tsx`: PASS, 1 plik, 0 nowych naruszeń, baseline 0.
- `check-actions.sh --verbose`: PASS — 234 akcje, 124 stringi runtime, 7 zdarzeń, 4 metody API; staged MyWork coverage 4 pliki, 0 nowych naruszeń.
- Post-delta build z zamrożonego dowodu: PASS, 10 715 modułów, 35.60 s. Plik ma SHA-256 `2e0ba10505fefbab78110423a21853038bd4a7754b36cad4a9dd0c6c1f5b1b88`, zgodne z manifestem V5.
- Pełny frontend TypeScript pozostaje neutralną deltą: baza i kandydat mają identyczny plik wynikowy, po 189 diagnostyk `error TS`, SHA-256 `47bd5cef37ba70021bf6936106633cfd6ed97f64514f8b3dc9fc86375d3b68a5`; wynik kandydata jest zgodny z manifestem V5. Nie jest to twierdzenie o zielonym repo.
- `git diff --check`: PASS. Nie rozpoczęto E3, migracji ani deployu.

Zielone bramki techniczne nie zamykają regresji zachowania anulowania. E2 pozostaje **HOLD** do czasu naprawy P1, trwałego testu oraz świeżego manifestu i niezależnego rereview.
