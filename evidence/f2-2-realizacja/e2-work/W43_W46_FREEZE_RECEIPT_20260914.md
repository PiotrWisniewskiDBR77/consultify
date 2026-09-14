# S4 F2-2 Praca — Wpisy 43–46 freeze receipt

**Werdykt: READY_FOR_EXACT_SHA_INDEPENDENT_REVIEW po rebase na `eba9d72ad9c730728b212ee7826164519e4d095c`; bez migracji i bez deployu.**

- Shared `buildExecutionBankRows` znów domyślnie używa `LEGACY`. ExecutionHub jawnie wybiera `INITIATIVE` przy aktywnym wariancie czterech przycisków, a dwa testowe wywołania wymagające projekcji inicjatywy również przekazują tryb jawnie.
- Trzy wymagane regresje: 3/3 pliki, 20/20 testów PASS z `--retry=0` (K5 7, value-cleared 1, change/progress RealPG 12). Fixture czasu RealPG ustawia deterministyczne czasy wyłącznie własnych rekordów testowych; asercje kontraktu pozostały bez zmian.
- Pełny post-rebase gate: 35 plików uruchomionych osobno, 254 testy PASS. Trzy odziedziczone czerwienie pozostają identyczne względem punktu startowego i nie należą do S4: `ExecutionHub.k5Naprawy` 5/6 (`StandardPreview` licznik słów — właściciel D), `ExecutionHub.daneRealne.source` 11/12 oraz `ExecutionHub.kokpitRaidOblozenie.source` 7/8 (kruche kontrole bloków źródła). Nie zmieniono ich asercji ani kodu auth/UI w ich zakresie.
- Real PostgreSQL 18 `cx-s4-w43-pg` na `127.0.0.1:5290`, baza `consultify_s4_w43`: 4/4 pliki i 22/22 testy PASS przez rzeczywisty Gateway/JWT/PG. Brak URL staging/demo.
- Frontend TypeScript, heap 8 GiB: baza `eba9d72ad9` = 189 diagnostyk, kandydat = 177, delta -12; żadna diagnostyka nie wskazuje zmienionych użyć StandardTable/StandardPreview. Server TypeScript heap 8 GiB: exit 0.
- Production build z heap 8 GiB, bez pipe: exit 0, 10 747 modułów. Pierwsza próba bez zwiększonego heapu osiągnęła 10 746 modułów i zakończyła się OOM przy domyślnych 4 GiB; nie jest przedstawiana jako dowód sukcesu.
- UI: osiem pełnych zrzutów ExecutionHub, `ready/empty × en/pl × light/dark`, 0 błędów console/page/HTTP. Fixture `ready` ma 3 zdarzenia previous week, 3 next week oraz 6 w next month; pierwszy EN light sprawdza obecność kolumny `Project` przed zapisem obrazu.
- Canon: test akcji obejmuje Open/Preview, Escalate, Delegate i Change resources oraz kanoniczny empty state; 5/5 PASS. `check-list-canon` 349/349, `check-artefakt` 8-0-117, pomiar języka exit 0 bez wzrostu, duplicate i18n EN 0 / PL 0, `git diff --check` PASS.
- Po rebase zachowano kontrakt Q2 E4 (ukrycie martwego presetu definitions) oraz S4 (Work report aktywowany przez `execReportsIntelligence` lub `workAnalysis`). Detektor markerów konfliktu: pusty.
- Zastane `StandardPreview` Property/Value i raw `work-intelligence` pozostają przypisane do instancji D zgodnie Wpisem 43 i nie zostały zmienione w S4.
