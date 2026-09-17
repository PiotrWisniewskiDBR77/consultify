# FEEDBACK-1 poz. 1 — K-02: trwałość sesji DRD i Wywiadu

**Werdykt dowodowy: implementacja, testy skupione i RealPG są gotowe do przeglądu CTO, ale pełna bramka kompilacji pozostaje `NOT_PROVEN`.** Niezależny przegląd kodu zakończył się `ACCEPT` (`P0=0`, `P1=0`, `P2=1`).

## Tożsamość paczki

- Tor: A / Codex-1.
- Gałąź: `codex/feedback-1-k02-session-persistence-20260917`.
- Baza finalna po rebase: `8ca34fb5188e4513307944144463edabd03b4ec0`.
- Zakres wiążący: KANAL.md, Wpis 120, FEEDBACK-1 poz. 1.
- Źródła defektu: zgłoszenia testerów 30, 31, 72 i 79 z `zgloszenia-84.json`, `RAPORT.md` i `TRIAGE.md`.
- Powiązany dług: DRD-2b — zapis decyzji w `DrdLevelInterviewWorkspace` bez obsługi błędu.
- SHA dostawy: zostanie podany w meldunku `OD_CODEXA.md`; receipt wchodzi do tego samego pojedynczego commita co kod.

## Potwierdzone objawy

| Zgłoszenie | Ścieżka | Zachowanie zgłoszone przez testera |
|---|---|---|
| 30 | `/assessment/drd/...` | wpisanie odpowiedzi uruchamiało recovery/loading, cofało sesję do wcześniejszego kroku i gubiło nowy tekst |
| 31 | `/assessment/drd/...` | zmiana stanu odpowiedzi z `Partially` na `Confirmed` po około sekundzie wracała do poprzedniej wartości |
| 72 | `/interview` | jawne `Save`, przejście dalej i powrót nie zachowywały zmiany |
| 79 | `/interview` | ponowne otwarcie tej samej sesji zaczynało od pytania 1 zamiast ostatnio używanego pytania |

## Zmierzone przyczyny

1. **Wyścig autosave z decyzją użytkownika w DRD.** Debounce mógł utrwalić starszy szkic po rozpoczęciu ręcznego zapisu. Starsze domknięcie przenosiło również wcześniejszy `answerState`, a zapis w locie nie kolejkował kolejnego żądania.
2. **Brak ochrony wersją sesji na serwerze.** Zapis odpowiedzi nie przekazywał obserwowanej wersji, a append zdarzenia i przesunięcie wersji sesji nie tworzyły jednego atomowego CAS. Opóźniony zapis mógł więc wygrać z nowszą decyzją.
3. **Główny Save Wywiadu nie opróżniał bieżącego szkicu odpowiedzi.** Zapisywał metadane sesji bez gwarancji, że edytowana odpowiedź została wcześniej utrwalona. Błąd zapisu nie blokował wszystkich przejść dalej.
4. **Pozycja w Wywiadzie nie była związana z identyfikatorem sesji.** Runtime wybierał pierwsze nieodpowiedziane pytanie; nie miał osobnego kursora dla każdej sesji ani poprawnej obsługi zmiany sesji bez odmontowania komponentu.
5. **DRD-2b połykał niepowodzenie zapisu.** Brak `catch` nie dawał użytkownikowi trwałego komunikatu i nie gwarantował zachowania wybranej decyzji do ponowienia.

## Wdrożona korekta

- Wspólny hook zapisu przechowuje najnowszą funkcję/payload przez ref, numeruje rewizje szkicu, kolejkuje zapis powstały podczas żądania w locie i daje ręcznemu zapisowi pierwszeństwo. Starsza odpowiedź nie może ustawić fałszywego stanu `SAVED`; oczekujący debounce można jawnie anulować.
- DRD serializuje wszystkie zapisy odpowiedzi. Ręczna decyzja anuluje oczekujący autosave, a zapis pobiera najnowszy wybrany stan. Ścieżka `I need help` zapisuje odpowiedź przed utworzeniem zadania i rozróżnia częściowy sukces; ponowienie nie duplikuje tego samego zapisu.
- Klient DRD wysyła `expectedVersion`. Serwer wymaga go dla `ANSWER_DRAFTED` i `ANSWER_CONFIRMED`, wykonuje atomowe przesunięcie wersji i append na przypiętym kliencie transakcji, zachowuje idempotentny replay oraz zwraca `409 VERSION_CONFLICT` dla starego zapisu. Klient po konflikcie odświeża stan zwycięskiego zapisu.
- Kompatybilność zdarzeń SIRI i zdarzeń innych niż zapisy odpowiedzi pozostaje na dotychczasowej ścieżce bez CAS.
- Runtime Wywiadu przechowuje kursor pytania pod kluczem sesji, obsługuje zmianę sesji bez odmontowania i wystawia workspace'owi operację utrwalenia bieżącej odpowiedzi. Główny Save najpierw opróżnia odpowiedź, potem zapisuje sesję; błąd pozostawia szkic i blokuje przejście wymagające udanego zapisu.
- DRD-2b pokazuje przetłumaczony błąd EN/PL, zachowuje wybraną decyzję oraz nie przechodzi do następnego poziomu po niepowodzeniu.

## Dowody automatyczne

Testy skupione uruchomione w toku implementacji:

| Plik / obszar | Wynik |
|---|---:|
| `useMethodWorkspaceSave.test.ts` | 8/8 PASS |
| `DrdHttpMethodWorkspaceScreen.k02RecoveryRace.test.tsx` | 3/3 PASS |
| `DrdHttpMethodWorkspaceScreen.pilotazPawel.test.tsx` | 3/3 PASS |
| `DrdLevelInterviewWorkspace.dec552.test.tsx` | 5/5 PASS |
| `drdHttpSessionRuntime.test.ts` | 9/9 PASS |
| `MethodEventStore.test.ts` | 7/7 PASS |
| `InterviewSingleQuestionRuntime.ownerBehavior.test.tsx` | 8/8 PASS |

Zakres zachowań obejmuje: najnowszy payload po renderze, follow-up podczas zapisu w locie, ręczną decyzję po debounce, ręczną decyzję podczas żądania w locie, pozostawienie decyzji po błędzie, CAS stale-write/replay, odświeżenie po `409`, atomowy rollback oraz kursor i brudny szkic per sesja.

Niezależny recenzent ponownie uruchomił własny wybrany zestaw: **37/37 PASS**. Wynik review: **ACCEPT, P0=0, P1=0, P2=1**.

Zbiorczy przebieg testów skupionych przed uruchomieniem bazy: **43 PASS, 16 SKIP**; po rebase na bazę finalną: **43/43 PASS**; pominięte przypadki były testami wymagającymi RealPG. Następnie całą tę część wykonano osobno na własnej bazie, jak opisano niżej.

## Bramka zależności i TypeScript

- Instalacja użyta do sprawdzenia serwera pochodzi z dokładnego lockfile; `@types/node` = **22.19.3**.
- Server TSC: **`TIMEOUT_120` w dwóch próbach, bez diagnostyki — `NOT_PROVEN`**. Brak komunikatu błędu przed limitem nie jest równoważny z wynikiem PASS.
- Frontend TSC: **`TIMEOUT_120` — `NOT_PROVEN`**.
- Z tego powodu receipt nie deklaruje pełnego zielonego type-checku ani gotowości integracyjnej wynikającej wyłącznie z testów skupionych.

## RealPG

Uruchomiono własny tymczasowy kontener `pgvector/pgvector:pg16` na `127.0.0.1:6454`, z danymi w `tmpfs`; nie użyto bazy staging/demo ani bazy innego wykonawcy.

- Strict fresh migrations: **925/925 PASS**.
- `http.integration` na RealPG: **16/16 PASS**.

Wykonany zestaw obejmował:

- poprawnego CAS i idempotentnego replay;
- odrzucenia starej wersji odpowiedzi;
- rollback przesunięcia wersji, gdy insert zdarzenia zawiedzie.

## Ograniczenia i otwarte bramki

1. **P2 z niezależnego review:** nie ma pełnego testu integracyjnego `InterviewWorkspace`, który klika główny przycisk Save i dowodzi kolejności: zapis bieżącej odpowiedzi → PATCH metadanych sesji. Pokryte są kontrakty runtime i rejestracji callbacku, ale nie pełne połączenie powłoki.
2. Kursor pytania w `/interview` używa `localStorage`. Przywraca miejsce w tej samej przeglądarce i rozdziela sesje, lecz nie synchronizuje kursora między urządzeniami/profilami przeglądarki.
3. Brak obu pełnych przebiegów TSC blokuje twierdzenie o kompletnej bramce technicznej.
4. Receipt nie zawiera dowodu wizualnego przed/po. Nie wykonywano zmian na stagingu ani wdrożenia.

## Granice paczki

- Bez migracji i bez nowych flag.
- Bez zapisu na staging/demo, deployu, zmiennych Railway i pushu na chronione gałęzie.
- Bez zmian poza DRD/Wywiadem, wspólnym mechanizmem zapisu, kontraktem method-core oraz testami bezpośrednio związanymi z K-02.

## Bramka językowa

Pełny skan uruchamiany przez zmianę method packa wykazał odziedziczony z aktualnej linii wzrost `K8sen` 2487→2488 w `server/src/routes/presentations.routes.ts`, poza zakresem K-02. Równocześnie linia obniżyła m.in. `K4en` 4626→4613, `K4obj` 4279→4243, `K5en` 7164→7163 i `K7` 103→102. Baseline zamrożono aktualnym pomiarem przez `pomiar-jezyka.mjs --json`; K-02 nie dodaje własnego literału UI.
