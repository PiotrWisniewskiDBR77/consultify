# Prompt dla Claude’a — Finance Complete Program

Przejmujesz pełną przebudowę modułu Finance w repozytorium Consultify. Masz doprowadzić istniejący system do profesjonalnego, produkcyjnego stanu funkcjonalnego, finansowego, technicznego i graficznego. To jest jedno kompletne zadanie wykonawcze. Nie oddawaj planu, prototypu, fragmentu, pojedynczego epika ani częściowego handoffu.

## Dokumentacja obowiązkowa

Przed działaniem przeczytaj w całości i w tej kolejności:

1. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
2. `docs/validation/finance-v3/OWNER_REVIEW_REGISTER_2026-08-09.md`
3. `docs/validation/finance-v3/FINANCE_COMPLETION_RECOMMENDATIONS_2026-08-09.md`
4. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
5. `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
6. wszystkie wskazane przez nie kanoniczne dokumenty Statement Ready, Analysis, Modeling, Prediction, Valuation, design system, accessibility, localization, API i migrations.

Nadrzędny jest `FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`. Decyzje właścicielskie i critical addendum mają pierwszeństwo przed historycznym kodem i starszą dokumentacją. Obecny kod jest stanem wyjściowym, nie definicją poprawności.

## Zadanie wykonawcze

1. Wykonaj pełne Gate A, B i C, EPIC-01–EPIC-10 oraz Fale 0–10 opisane w programie.
2. Gate’y traktuj jako wewnętrzne bramki jakości. Zachowuj raporty, lecz nie zatrzymuj zadania i nie oddawaj częściowego wyniku.
3. Zacznij od exact baseline: `pwd`, SHA, branch, dirty worktree, ownerzy zmian, aktywne procesy, środowisko i fingerprint bazy z sekretami zredagowanymi.
4. Nie nadpisuj cudzych zmian. Nie używaj `reset --hard`, broad clean, stash, `git add -A` ani destrukcyjnego usuwania. Stosuj allowlisty i checksumy.
5. Nie zapisuj do produkcyjnej bazy. Guard ma działać na poziomie DB role i aplikacji. Migracje oraz backfill wykonuj najpierw na disposable real Postgres.
6. Zachowaj legacy compatibility przez additive schema, adapters, aliases, deterministic backfill, shadow parity, per-module cutover i rehearsed rollback. Bez big-bang rewrite.
7. Zbuduj jeden canonical Finance Core dla wartości, okresów, jednostek, wersji, working revisions, lifecycle, lineage, freshness, exceptions, compute jobs, comments, review, permissions i audit.
8. Zrealizuj pełny zakres Statements, Analysis, neutralnych Baseline Models, Prediction i Enterprise Valuation, w tym multi-variant cases, Advisor, TRS context, Export i cold reopen.
9. Zrealizuj cały Analyst Productivity Contract: Finance Data Grid, batch/paste, keyboard, Undo/Redo, autosave/conflict, Excel round-trip, Compare, comments/review, saved views, exception inbox i `Why this number?`.
10. Zrealizuj wspólny standard UI/CX: jeden Workspace Bar, focus mode, wspólne components/tokens, wszystkie stany, WCAG AA, spójny locale i visual matrix 1280/1440/1920. Mobile/tablet mają fail-closed capability policy.
11. Usuń i zabezpiecz regresjami silent-zero, readiness bypass, period/unit/source loss, timeout/stale ambiguity, non-atomic approval, global Finance crash i split-brain API.
12. Stosuj najwyższe jednoznaczne standardy rynku bez pytania. Eskaluj wyłącznie decyzje strategiczne, prawne, reputacyjne, kosztowe, dotyczące apetytu na ryzyko albo nieodwracalnej operacji.

## Definicja ukończenia

Nie wolno uznać zadania za ukończone na podstawie kodu, builda, unit tests, mock DB, screenshotów lub self-attestation. Wymagane jest równoczesne:

- PASS EPIC-01–EPIC-10;
- PASS FC-01–FC-12 na jednym exact candidate SHA;
- 100% Requirements Traceability Matrix;
- GoldCo i niezależne known-answer calculations z wartościami pośrednimi;
- realDB/API/job fault/concurrency/tenant evidence;
- pełne Playwright E2E pięciu modułów;
- Visual & CX Acceptance dla wszystkich ekranów, stanów i viewportów;
- accessibility, keyboard, Excel, Compare, comments i performance acceptance;
- migration parity, cutover i rollback rehearsal;
- niezależny CFO, UX oraz design-system review;
- brak otwartych Critical/Material findings bez dozwolonego waivera.

Każdą regresję napraw i uruchom ponownie adekwatny test oraz cały wymagany regression pack. Brak dowodu pozostaje `EVIDENCE_MISSING`, nigdy PASS. Używaj literalnie `UNKNOWN`, `PARTIAL`, `BLOCKED`, `EVIDENCE_MISSING`.

## Blockery

Możesz przerwać wyłącznie przy rzeczywistym zewnętrznym blockerze lub koniecznej decyzji właścicielskiej z kategorii powyżej. Raport `BLOCKED` ma zawierać dowód, trzy wyczerpane drogi rozwiązania, wpływ i jedno minimalne pytanie. Wielkość zadania, brak czasu, złożoność, czerwone testy lub konieczność przebudowy nie są blockerem.

## Jedyny handoff końcowy

Oddaj całość Codexowi dopiero po pełnym self-checku. Handoff musi zawierać:

1. exact SHA, branch, allowlisted diff i status worktree;
2. mapę EPIC-01–EPIC-10 z DoD i dowodami;
3. Requirements Traceability Matrix;
4. migrations/backfill/parity/cutover/rollback evidence;
5. Finance Known-Answer Report i GoldCo workbook comparison;
6. realDB HTTP/SQL readback oraz jobs/fault/concurrency/tenant reports;
7. wyniki unit/integration/contract/Playwright/performance/a11y;
8. Visual & CX Acceptance Report z current-SHA screenshot matrix;
9. exports i cold-reopen evidence;
10. exceptions/waivers i niezależne reviewer sign-offs;
11. deployment/runtime identity oraz instrukcję niezależnego odtworzenia testów;
12. literalne `READY_FOR_CODEX_FINAL_REVIEW` wyłącznie wtedy, gdy każdy wymagany gate ma dowód PASS.

Nie deklaruj `DONE`, `GO` ani `PRODUCTION READY`. Ostateczną decyzję podejmie Codex po niezależnym odtworzeniu dowodów. Dostarcz jeden kompletny, działający i zweryfikowany candidate do tego odbioru.
