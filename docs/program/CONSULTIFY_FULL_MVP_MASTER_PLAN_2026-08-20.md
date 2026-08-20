# Consultify — master plan dojścia do pełnego MVP

Data: 2026-08-20  
Właściciel integracji: główny integrator  
Punkt startowy: czysty `db63ab27e475eb462f97fe054746c3bcc74030f0`  
Cel: `FULL_MVP_OWNER_ACCEPTED`, nie tylko zielony rejestr techniczny

## Definicja pełnego MVP

MVP jest gotowe dopiero wtedy, gdy na jednym zamrożonym SHA:

1. Każdy moduł jest zamontowany, ma realistyczny zestaw danych i przechodzi wymagane stany UI.
2. Piotr odebrał każdą powierzchnię albo jawnie zaakceptował opisane ograniczenie.
3. Krytyczne ścieżki wertykalne zapisują dane, przekazują je między modułami i potwierdzają cold readback w PostgreSQL.
4. Teresa potrafi zaproponować, wyjaśnić i — po wymaganej akceptacji — wykonać te same dozwolone działania, które oferuje UI; nie posiada ukrytych uprawnień.
5. Nie istnieje drugi aktywny writer ani sprzeczny kontrakt dla tej samej operacji.
6. Bezpieczeństwo, tenant isolation, RBAC, audyt, observability, backup/restore i rollback spełniają kontrakt środowiska docelowego.
7. Kandydat przechodzi pełne bramki regresji, staging i owner acceptance bez driftu SHA.

## Żelazny reżim wykonawczy

### Jednostka pracy

Każda paczka musi mieć: `ID`, właściciela, bazowy SHA, maksymalnie 3–8 ścieżek kodu, hipotezę, DoD, test pozytywny, test negatywny, wymagany runtime proof, budżet czasu oraz instrukcję rollback/stop-loss.

### Limit równoległości

- Integrator nie implementuje równolegle więcej niż trzy rozłączne paczki.
- Tylko integrator scala do kandydata.
- Następna fala rusza po fan-in, typecheck/build i testach kontraktów dotkniętych zmianą.
- Brak nowego dowodu przez 90 minut lub dwa powtórzenia tego samego błędu oznacza `STOP-LOSS`, zapis stanu i zmianę strategii — nie dalsze czekanie.

### Statusy

Dozwolone: `READY`, `IN_PROGRESS`, `BLOCKED_WITH_EVIDENCE`, `READY_FOR_OWNER`, `OWNER_CHANGES_REQUESTED`, `OWNER_ACCEPTED`, `APPROVED_OUT`, `REJECTED`, `DONE_CURRENT_SHA`. Status bez SHA i dowodu jest nieważny.

## Faza 0 — zabezpieczenie i pojedynczy kanon

Stan: zasadniczo wykonana.

- Utrzymać `db63ab27e4` jako read-only baseline audytu.
- Utworzyć z niego nowy branch integracyjny pełnego MVP dopiero przed pierwszym portem produktu.
- Nie ruszać chronionych dirty worktree; dopisywać ich wynik klasyfikacji do rejestru odzyskania.
- Nie pushować, nie wdrażać i nie migrować produkcji bez osobnej autoryzacji.

Bramka: czysty kanon, recovery refs zweryfikowane, aktywne środowiska nazwane, brak osieroconych procesów blokujących zasoby.

## Faza 1 — odzyskanie unikalnego kodu i eliminacja duplikatów

### 1A. Inwentaryzacja

Dla dirty worktree oraz niekanonicznych commitów z domen Finance, Results, transformacji, Teresa i UI przygotować tabelę: branch/worktree, base, HEAD, dirty paths, autor/wątek, kontrakt funkcji, odpowiednik w kanonie, testy, rekomendacja.

### 1B. Wykrywanie duplikatów

Sprawdzić w pierwszej kolejności:

- endpointy o tym samym zamiarze biznesowym;
- wielu writerów tej samej encji;
- stare i nowe komponenty pod podobnymi trasami;
- serwisy eksportu i generowania dokumentów;
- adaptery Teresa/UI oraz action registry;
- migracje tworzące konkurujące tabele lub statusy;
- kod istniejący, ale nieosiągalny z routingu lub flag.

### 1C. Portowanie

Portować tylko `UNIQUE_REUSABLE`, po jednej funkcji lub kontrakcie. Każdy port ma test pokazujący brak funkcji przed zmianą i jej działanie po zmianie. Nie scalać całych historycznych branchy.

Bramka: każda krytyczna funkcja ma jednego właściciela, jedną trasę, jednego writera i jeden kontrakt danych; reszta ma dyspozycję `SUPERSEDED`, `APPROVED_OUT` lub jawny backlog.

## Faza 2 — zamknięcie pięciu technicznych luk

Kolejność zależności:

1. `FIN-UI-CANON-001`: odtworzyć `25P02`, ujawnić pierwszy błąd transakcji, dodać preflight/rollback i przejść pełne Statement exact-six oraz downstream.
2. `FIN-MVP-CUTOVER-001`: zinwentaryzować 28 writerów, zmierzyć użycie, wskazać następców; emulować/wycofywać tylko z dowodem parytetu.
3. `RES-MVP-LEGACY-CUTOVER-001`: dla pięciu writerów bez następcy zdecydować: zbudować następcę, zachować jako jawny kanon albo approved-out; potem telemetry window i backfill/readback.
4. `FLOW-TRANSFORM-MVP-001`: zastąpić syntetyczny-only dowód rzeczywistą ścieżką użytkownika i trwałym lineage.
5. `CHAT-NFR-001`: porównać własny DoD z istniejącymi dowodami; uruchomić wyłącznie brakujący test, następnie zaktualizować rekord bez fałszywego awansu.

Bramka: brak `25P02`, false success, podwójnych writerów i syntetycznego-only dowodu w krytycznych ścieżkach.

## Faza 3 — odbiór UI/UX wszystkich modułów

### Zakres

Odbieramy kolejno: Shell/Navigation, Auth/Onboarding, Chat, My Work, Ideas, Assessment, Tools, Initiatives, Execution, Results, Finance, Materials/Artifacts, Meetings, Integrations, Organization, Settings/Admin/Audit/Partners zgodnie z rzeczywiście zamontowanymi rolami i trasami. Inwentaryzacja 16 powierzchni pozostaje punktem odniesienia, ale podział rund może łączyć blisko związane ekrany.

### Jedna runda modułu

1. System uruchamia dokładny SHA na izolowanej bazie i zasila realistyczne dane pokazujące minimum: empty, loading, populated, error, permission denied oraz stany mobile/desktop, light/dark, jeśli dotyczą modułu.
2. System daje Piotrowi link, krótką personę/scenariusz i maksymalnie 10-minutową trasę przejścia.
3. Piotr przechodzi moduł i przesyła komentarze oraz screenshoty.
4. Integrator zapisuje każdą uwagę w rejestrze bez interpretacyjnego gubienia: ID, ekran/URL, screenshot, obserwacja, oczekiwane zachowanie, ważność `P0–P3`, decyzja i status.
5. Agent poprawia wyłącznie zaakceptowany batch; integrator robi review diffu.
6. Playwright lub kontrolowane przejście Chrome odtwarza scenariusz, wykonuje screenshoty before/after, a testy a11y/console/network sprawdzają regresje.
7. System oddaje moduł Piotrowi ponownie z listą zmian i nierozwiązanych punktów.

Maksymalnie trzy rundy. Po rundzie trzeciej nierozwiązany problem dostaje decyzję: blokuje MVP, świadomie ogranicza beta albo trafia po MVP. Nie wolno pozostawić go jako niejawnego „później”.

### Kryterium odbioru modułu

`OWNER_ACCEPTED` wymaga: podpisu Piotra, daty, dokładnego SHA, persony, danych fixture, listy ekranów, zamkniętego rejestru P0/P1 oraz jawnej dyspozycji P2/P3. Sam Playwright nie jest odbiorem właściciela.

## Faza 4 — wertykalne testy współpracy modułów

Każda ścieżka działa na jednym tenantcie testowym, ma kontrolę drugiego tenantu i potwierdza zapis po restarcie procesu:

1. Teresa/Chat → Idea → Assessment → Initiative.
2. Assessment → rekomendacja → decyzja → Initiative/Portfolio.
3. Tool session → output → Document/Table/Presentation → Materials.
4. Initiative → Execution task/milestone → My Work → status → Results.
5. Finance import/model → Statement → decyzja → initiative/budget → report/export.
6. Meeting → note/transcript boundary → task/decision → follow-up.
7. Results → transform → report/presentation → trwały lineage do źródła.
8. Settings/Organization/Admin → role/policy change → natychmiastowy efekt i audit event.
9. Partner → lead/referral → jawnie wyłączona accrual boundary bez false success.
10. Backup/restore → cold readback najważniejszych artefaktów z powyższych przepływów.

Każdy test sprawdza: happy path, deny path, idempotency, retry, duplicate prevention, audit trail, tenant isolation, cold readback i widoczny komunikat błędu.

Bramka: wszystkie wymagane ścieżki przechodzą na tym samym SHA i tej samej wersji migracji; brak mock-only jako jedynego dowodu.

## Faza 5 — Teresa jako warstwa zarządzająca aplikacją

### Kontrakt parytetu

- Każda mutująca akcja dostępna w UI ma wpis w wersjonowanym action registry: rola, zakres tenant, wymagane dane, preview, confirm, idempotency key, receipt, undo/compensation i audit event.
- Teresa nie wywołuje ukrytych writerów i nie omija polityk UI.
- Dla zmian odwracalnych: proposal → preview → approve → execute → receipt.
- Dla destrukcyjnych lub finansowych: dodatkowe jawne potwierdzenie, zakres skutków i brak autonomicznego ponowienia.
- Dla funkcji niedostępnej Teresa mówi, czego nie może zrobić i dlaczego; żadnego false success.

### Scenariusze odbiorowe Teresy

- zarządzenie pełną ścieżką Idea → Initiative → Execution → Results;
- utworzenie/aktualizacja artefaktów Document/Table/Presentation z lineage;
- zarządzanie zadaniami, decyzjami, właścicielami i terminami;
- odczyt i wyjaśnienie Finance bez ominięcia ograniczenia Statement;
- respektowanie RBAC, tenant boundary, policy gate i approved-out;
- przerwanie, wznowienie i odczyt receipt po restarcie;
- zgodność rezultatu działania wywołanego przez Teresę i przez UI.

Bramka: macierz UI action ↔ Teresa action ma 100% pokrycia dla zakresu MVP lub jawne `NOT_SUPPORTED_IN_MVP`; wszystkie mutacje mają receipts i audit trail.

## Faza 6 — polityki, środowisko i bezpieczny zakres

- `MAT-POL-001`: do MVP dopuścić wyłącznie materiały z udokumentowaną proweniencją; pozostałe fail-closed.
- `AUD-POL-001`: wdrożyć dokładnie zaakceptowany restricted scope i sprawdzić, że preset poza zakresem nie jest oferowany jako aktywny.
- `SET-MVP-DELETE-001` i `PRT-MVP-ACCRUAL-001`: utrzymać approved-out, ale sprawdzić komunikaty, brak writerów i brak false success.
- `ADM-MVP-BACKUP-001`: staging restore jest obowiązkowy; produkcyjna konfiguracja wymaga właściciela środowiska i osobnej autoryzacji.

Bramka: wszystkie ograniczenia są widoczne w produkcie, dokumentacji i zachowaniu Teresy; użytkownik nie otrzymuje pozoru wykonania.

## Faza 7 — kandydat, regresja i wydanie

1. Zamrozić jeden release candidate SHA.
2. Fresh PostgreSQL: pełna migracja, repeat=0, drift=0.
3. Root/server typecheck, build, skupione testy i pełna regresja proporcjonalna do zmian.
4. Powtórzyć wszystkie wertykalne ścieżki i minimalny smoke 16 powierzchni.
5. NFR: obciążenie, cold Web Vitals, błędy, command reconciliation.
6. Dwie obserwacje staging, alert exercise i rollback rehearsal.
7. Finalny owner click-gate na dokładnym SHA.
8. Dopiero potem osobna decyzja `GO/STOP` dla produkcji z właścicielem deployu i rollbacku.

## Kolejność najbliższej pracy

### Wave A — teraz

- dokończyć klasyfikację worktree/branchy tylko dla pięciu luk technicznych i Teresy;
- odtworzyć Finance `25P02` na nazwanej bazie disposable i znaleźć pierwszy błąd;
- skonfrontować `CHAT-NFR-001` z jego DoD;
- przygotować action-registry parity inventory Teresa ↔ UI.

### Wave B

- małe porty `UNIQUE_REUSABLE` z odzyskanych branchy;
- zamknięcie Finance/Results writers i realnego transform flow;
- pełny fan-in oraz focused integration gate.

### Wave C

- odbiór UI/UX modułami w 2–3 rundach;
- równolegle tylko automatyzacja scenariusza aktualnie odbieranego, nie nowa funkcjonalność.

### Wave D

- dziesięć testów wertykalnych;
- Teresa parity i lifecycle;
- korekty z pełnego przepływu.

### Wave E

- polityki/środowisko, pełna regresja, staging, owner click-gate i decyzja wydaniowa.

## Szacunek zarządczy

Nie ma podstaw, by dziś prognozować sześć miesięcy. Po trzech pierwszych dniach Wave A będziemy mieli mierzalną prędkość i rzeczywisty critical path. Roboczo należy planować 3–6 tygodni do mocnego internal-beta MVP, jeśli luki Finance/legacy nie ujawnią błędu architektonicznego i Piotr odbiera moduły bez wielodniowych przerw. Szacunek zostanie przeliczony po pierwszej pełnej rundzie UI i dwóch zamkniętych przepływach wertykalnych.

## Codzienny raport integratora

Raport ma mieć najwyżej jedną stronę:

- dokładny kanoniczny SHA i stan clean/dirty;
- co weszło do kanonu od poprzedniego raportu;
- dowody, które naprawdę przeszły;
- nowe błędy i ich pierwszy znany root cause;
- decyzje oczekujące od Piotra;
- aktywne paczki z właścicielem i limitem czasu;
- następne 24 godziny;
- licznik: moduły `OWNER_ACCEPTED`, wertykale `PASS`, Teresa actions z parytetem, otwarte P0/P1 oraz pozostałe `PARTIAL`.

Nie raportujemy „agent nadal pracuje” jako postępu. Postęp oznacza nowy commit, nowy dowód, nową diagnozę albo jawną decyzję stop-loss.
