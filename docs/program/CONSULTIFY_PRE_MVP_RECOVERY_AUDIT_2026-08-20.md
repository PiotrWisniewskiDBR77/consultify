# Consultify — audyt odzyskania i gotowości przed pełnym MVP

Data: 2026-08-20  
Status: `CONTROLLED_RECOVERY / NO_RELEASE_GO`  
Kandydat kanoniczny: `db63ab27e475eb462f97fe054746c3bcc74030f0`  
Branch: `codex/staging-g4-e6ca-20260820`

## Werdykt wykonawczy

Projekt nie wymaga sześciu miesięcy biernego domykania kolejnych numerów zadań. Wymaga zmiany sposobu prowadzenia pracy: z równoległego wytwarzania wielu części i dowodów na jeden kontrolowany strumień integracji, odbioru produktu oraz usuwania luk w realnych ścieżkach użytkownika.

Aktualne `71 DONE_CURRENT_SHA / 11 PARTIAL` jest prawdziwym stanem rejestru 82 zadań, ale nie jest miarą kompletności pełnego MVP. Rejestr zawiera jednocześnie kod, dowody techniczne, zaakceptowane wyłączenia internal beta, ograniczenia środowiskowe i bramkę wydania. Nie wolno zamieniać pozostałych pozycji na `DONE` bez spełnienia ich kontraktów.

Największym problemem nie jest brak pracy agentów. Jest nim koszt koordynacji: za dużo długowiecznych worktree i branchy, rozproszone dowody, ponowne testowanie niezmienionych obszarów oraz brak jednego właściciela fan-in i jednego backlogu odbiorowego.

## Zabezpieczenie wykonane

- Zamrożono aktywne strumienie Moduły, Integracja, Finance i SWOT; odebrano od nich dokładne handoffy.
- Utworzono 39 jawnych referencji odzyskania pod `recovery/pre-mvp-20260820/*`, obejmujących kanon, zamrożony NFR, Finance, SWOT i wszystkie unikalne odłączone HEAD-y.
- Usunięto 59 wyłącznie czystych, nieśledzonych i nieaktywnych worktree z `/private/tmp`; nie użyto `--force`, `reset`, `clean` ani `stash`.
- Zatrzymano 19 starych kontenerów `consultify-*` i 19 starych procesów uruchomionych z nieaktywnych worktree. Zachowano aktualne środowiska Finance, SWOT i kanoniczne.
- Wolne miejsce zwiększono z około 32 GiB do około 111 GiB.
- Zachowano wszystkie wykryte brudne worktree, w tym pięciościeżkowy checkpoint SWOT oraz silnie nieśledzony główny katalog iCloud.

## Potwierdzony stan źródła prawdy

- Kanon jest czysty na `db63ab27e4`; jego rodzicem jest zapis stop-loss Finance `9290b2ac7e`.
- Zamrożony techniczny kandydat NFR to `0115b8bb85`.
- Finance: kod w czystym worktree na `f5c6a7f16f`, lecz nie został przyjęty do kanonu jako produkt. Odbiór Statement zakończył się `HTTP 422 / PostgreSQL 25P02` przed utworzeniem wymaganych sześciu elementów. Status pozostaje `PARTIAL / INTERNAL_BETA_LIMITATION`.
- SWOT: pięć brudnych ścieżek na bazie `8e5c694ec6`; testy skupione były zielone, ale nie ma czystego terminalnego commita ani końcowego odbioru.
- Reporter rejestru na kanonie: dokładnie 82 rekordy, 71 `DONE_CURRENT_SHA`, 11 `PARTIAL`, 0 brakujących i 0 niepoprawnych rekordów.
- Produkcyjne wdrożenie i migracja produkcyjna pozostają `NOT_AUTHORIZED`.

## Pozostałe 11 rekordów — prawdziwa klasyfikacja

### Repozytorium lub dowód wymagający pracy

- `CHAT-NFR-001` — bogaty zestaw testów istnieje, lecz rekord nadal jest `PARTIAL`; trzeba rozstrzygnąć brakujący kontrakt, a nie ponownie uruchamiać wszystko bez hipotezy.
- `FIN-UI-CANON-001` — rzeczywista awaria Statement `25P02`; wymaga diagnostyki pierwszego błędu PostgreSQL, preflightu i pełnego przepływu exact-six.
- `FIN-MVP-CUTOVER-001` — 24 z 52 historycznych drzwi zapisu wycofano, 28 pozostaje otwartych.
- `RES-MVP-LEGACY-CUTOVER-001` — pięciu writerów nie ma kanonicznego następcy; zakaz sztucznego wyłączenia bez telemetrii i reguły migracji.
- `FLOW-TRANSFORM-MVP-001` — dowód polityki jest syntetyczny; brak kompletnego, właścicielskiego przepływu runtime.

### Świadomie ograniczony zakres internal beta

- `MAT-POL-001` — brak zewnętrznych dowodów praw/licencji dla nowych szablonów.
- `AUD-POL-001` — ograniczony zakres wymaga domknięcia zaakceptowanej implementacji polityki.
- `ADM-MVP-BACKUP-001` — produkcyjny scheduler, trwały storage i rotacja kluczy są działaniami właściciela środowiska.
- `SET-MVP-DELETE-001` — destrukcyjne usuwanie jest świadomie wyłączone; działa tylko request/cancel/status.
- `PRT-MVP-ACCRUAL-001` — naliczanie i wypłaty prowizji są świadomie wyłączone do czasu polityki Commercial + Finance + Legal.

### Bramka wydania

- `REL-001-T01` — nie może być `DONE`, dopóki zależności nie mają prawdziwej dyspozycji i Piotr nie udzieli osobnej autoryzacji wydania.

## Audyt nieużytego i zduplikowanego kodu

Stan repozytorium potwierdza ryzyko odkrywania gotowych, ale niewykorzystanych fragmentów:

- przed porządkami istniało 315 worktree; po bezpiecznym usunięciu 59 czystych pozostało 256;
- wykryto 129 worktree z modyfikacjami śledzonych plików;
- lokalne repozytorium zawiera ponad 1000 branchy, których HEAD nie jest przodkiem aktualnego kanonu;
- dokumentacja sama wskazuje równoległe pipeline'y eksportu, historyczne writery, martwe/niezamontowane powierzchnie oraz różne generacje adapterów.

Tych branchy nie wolno hurtowo scalać ani usuwać. Każdy kandydat przechodzi klasyfikację:

1. `ALREADY_IN_CANON` — semantycznie obecny; branch tylko do archiwizacji po dowodzie.
2. `SUPERSEDED` — zastąpiony nowszym rozwiązaniem; zachować referencję, nie scalać.
3. `UNIQUE_REUSABLE` — unikalna funkcja/test/migracja do osobnego, małego portu.
4. `CONFLICTING_DUPLICATE` — drugi writer, endpoint, komponent lub kontrakt; wymaga decyzji o jednym kanonie.
5. `EVIDENCE_ONLY` — dowody bez zmiany produktu; nie traktować jako produktu.
6. `UNKNOWN_DIRTY` — chronić i eskalować do audytu różnic.

Pierwszeństwo audytu mają obszary z realną luką MVP: Finance Statement, pozostałe writery Finance/Results, transformacje między modułami, Teresa action registry oraz zamontowane powierzchnie UI. Sam wiek brancha lub liczba testów nie są kryterium scalenia.

## Co było prowadzone dobrze

- Dowody są na ogół wiązane z SHA, licznik ma zamknięty mianownik 82 i brak niepoprawnych rekordów.
- Istnieją real-PostgreSQL, negatywne kontrole, RBAC/tenant checks, NFR, rollback rehearsal i jawne ograniczenia fail-closed.
- Finance i SWOT nie zostały sztucznie ogłoszone jako zaakceptowane.

## Co powodowało spowolnienie

- Agenci wykonywali wielogodzinne fale bez krótkiego stop-lossu i bez obowiązkowego raportu przy braku nowej informacji.
- Odpowiedzialność za kod, integrację, dowód i owner acceptance mieszała się w jednym zadaniu.
- Ten sam obszar był ponownie kwalifikowany na wielu SHA zamiast stabilizować jeden kandydat.
- Rejestr zadań stał się zastępczą miarą produktu, mimo że część pozycji oznacza politykę lub wyłączenie funkcji.
- Brakowało żelaznej pętli: realistyczne dane → odbiór Piotra → rejestr usterek → poprawa → automatyczny retest → ponowny odbiór.

## Reguła od teraz

Jeden integrator, jeden czysty kandydat, jeden rejestr luk i najwyżej trzy równoległe, rozłączne paczki wykonawcze. Każda paczka ma limit czasu na uzyskanie nowej informacji, dokładny DoD, listę zmienianych ścieżek, wymagany dowód i instrukcję stop-loss. Nie ma kolejnej fali, dopóki poprzednia nie została scalona albo jawnie odrzucona.

