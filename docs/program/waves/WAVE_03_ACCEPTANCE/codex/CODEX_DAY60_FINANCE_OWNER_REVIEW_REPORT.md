# Dyżur 60 — Finanse — pakiet odbioru właściciela G07–G10

## Karta przeglądu dla Piotra

Finanse mają prowadzić użytkownika przez jeden spójny łańcuch: od sprawozdania finansowego, przez analizę historyczną i model bazowy, do prognozy oraz wyceny przedsiębiorstwa. Na badanym markerze nawigacja i montowanie produktu obejmują pięć przestrzeni: Sprawozdania, Analiza, Model bazowy, Prognoza i Wycena.

Docelowa główna ścieżka zaczyna się od wyboru sprawozdania, następnie przechodzi przez analizę, model bazowy i prognozę, a kończy na wycenie oraz podglądzie szczegółów i bezpiecznym otwarciu menu wiersza. W tym dyżurze udało się potwierdzić strukturę tej ścieżki w markerze oraz osiągalność wszystkich pięciu rodzin przez prawdziwą lokalną bramę aplikacji. Nie udało się jednak wejść do modułu jako uwierzytelniony właściciel, ponieważ wymagany pakiet danych nie mógł zostać utworzony bez jedynego autoryzowanego dokumentu źródłowego.

Poza MVP świadomie pozostają: produkcyjne uruchomienie, dane od zewnętrznych dostawców, mobilny odbiór, usunięcie późniejszych warstw zgodności oraz decyzja właściciela o akceptacji. Ten pakiet nie potwierdza jakości ekranów ani gotowości do wydania. Do pierwszego właściwego oglądu potrzebne jest przywrócenie dokładnego dokumentu źródłowego i powtórzenie macierzy wizualnej.

## Rodowód i środowisko

- Instrukcja: commit `9ff0b3749d45928cf9137a778eae47201cca8719`.
- Marker i HEAD: `5e30cb9bf66c8e75481ba723debdd04f3c1a6893`.
- Gałąź: `codex/finance-day60-owner-review-20260828`.
- Worktree: `/private/tmp/consultify-finance-day60-review`.
- Artefakty surowe: `/private/tmp/cx-day60-finance-review`.
- PostgreSQL: kontener `cx-day60-pg`, loopback `127.0.0.1:5932`, DB `consultify_day60_finance_review`, PostgreSQL `16.15`.
- Fingerprint bez sekretu: `consultify_day60_finance_review|postgres|PostgreSQL 16.15`; udane migracje w ledgerze: `858`.
- Gateway: prawdziwy `ApiGateway.getInstance().initializeRoutes(app)` na `127.0.0.1:3990`; bez pełnego `server/src/index.ts`.
- Środowisko: `RUN_DB_TESTS=1`, `MOCK_DB=false`, `NODE_ENV=test`, `DISABLE_SCHEDULER=true`; zmienne SMTP/Resend/SendGrid usunięte.
- `settings`: tabela istnieje; zapytanie o klucze/kategorie SMTP, Resend, SendGrid, mail i email zwróciło zero wierszy.
- Drenaż outboxu: nie uruchomiono; skan procesów nie wykazał repozytoryjnego schedulera/outbox workera. Pełnego serwera nie uruchomiono.

## Komendy i wyniki

| Czynność | Wynik |
| --- | --- |
| kontrola wolnego miejsca | exit `0`, około `75 GiB` wolne |
| fetch `github-backup --prune` i odczyt instrukcji | exit `0` |
| utworzenie worktree z markera | exit `0`, HEAD zgodny |
| `docker run ... pgvector/pgvector:pg16` | exit `0` |
| pierwszy `npx tsx server/scripts/migrate.postgres.ts` | exit `0`, zastosowano `858` migracji |
| drugi przebieg migratora | exit `0`, `Applying migrations: 0` |
| `seed-wave3-finance-owner-review.ts seed` | exit `1`, `official Finance PDF is required` |
| minimalny realny Gateway | nasłuch na `3990`, DB identity `127.0.0.1:5932/consultify_day60_finance_review` |
| pięć anonimowych odczytów rejestrów | każde HTTP `401`, `No token provided` |

Logi i SHA-256: `migrate-1.log` `ee2a5871…`, `migrate-2.log` `48c52313…`, `seed.log` `69a66ad…`, `gateway.log` `4dcd7bc5…`; pełne pliki są w katalogu artefaktów.

## Mianownik ekranów

Routing markera montuje wspólny rejestr `/finance` oraz pięć typów szczegółów. Nie znaleziono szóstego niezależnego ekranu rejestru.

| ekran | route | stan | pokrycie |
| --- | --- | --- | --- |
| Statement | `/finance?tab=statements`, `/finance/statements/:id` | `EVIDENCE_MISSING` | route i Gateway potwierdzone; UI nieuruchomione |
| Analysis | `/finance?tab=analysis`, `/finance/analyses/:id` | `EVIDENCE_MISSING` | route i Gateway potwierdzone; UI nieuruchomione |
| Baseline | `/finance?tab=models`, `/finance/models/:id` | `EVIDENCE_MISSING` | route i Gateway potwierdzone; UI nieuruchomione |
| Prediction | `/finance?tab=prediction`, `/finance/predictions/:id` | `EVIDENCE_MISSING` | route i Gateway potwierdzone; UI nieuruchomione |
| Valuation | `/finance?tab=valuation`, `/finance/valuations/:id` | `EVIDENCE_MISSING` | route i Gateway potwierdzone; UI nieuruchomione |

Mianownik wizualny wynosi `5 ekranów × 2 motywy × 2 stany danych = 20` podstawowych zrzutów, przed dodatkowymi ujęciami kebaba, podglądu i karty.

## Manifest zrzutów G08 + G10

Liczba wykonanych i zakwalifikowanych zrzutów: `0`.

Nie uruchomiono zastępczego mocka ani sample-data. Brak autoryzowanego PDF zatrzymał seeder przed utworzeniem danych, użytkownika i FINAL manifestu. Świeża DB była realnym pustym stanem danych, lecz bez uwierzytelnionej sesji nie można było wyrenderować ekranów Finance. Własna inspekcja obrazów: `N/A — nie powstał żaden obraz`. Kebab, podgląd i karta: `NOT_PROVEN`.

## G09 — rzeczywista ścieżka CX

| krok | działanie | route/żądanie | metoda / HTTP | organizacja/użytkownik | wynik widoczny |
| --- | --- | --- | --- | --- | --- |
| 1 | wejście do warstwy danych Statement | `/api/v8/finance-v2/artifacts?artifactType=STATEMENT_PACK` | GET / `401` | brak tokenu; fixture niepowstał | `No token provided` |
| 2 | Analysis | `artifactType=HISTORICAL_ANALYSIS` | GET / `401` | jak wyżej | `No token provided` |
| 3 | Baseline | `artifactType=BASELINE_MODEL` | GET / `401` | jak wyżej | `No token provided` |
| 4 | Prediction | `artifactType=PREDICTION_SCENARIO` | GET / `401` | jak wyżej | `No token provided` |
| 5 | Valuation | `artifactType=VALUATION_CASE` | GET / `401` | jak wyżej | `No token provided` |
| 6 | podgląd/karta/kebab | zależne od danych i sesji | `NOT_STARTED` | `EVIDENCE_MISSING` | brak uprawnionego obejścia |

To dowodzi osiągalności prawdziwego Gateway i aktywnej bariery autoryzacji, ale nie spełnia wymogu uwierzytelnionego przejścia G09.

## Znaleziska i STOP

### `FIN-D60-001` — brak jedynego autoryzowanego PDF blokuje fixture odbiorczy

- Objaw: seeder kończy się kodem `1`: `[W3 Finance fixture] BLOCKED: official Finance PDF is required`.
- Reprodukcja: uruchomić istniejący seeder z wymaganą ścieżką `/Users/piotrwisniewski/Desktop/CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf`; plik nie istnieje.
- Lokalizacja: `server/scripts/seed-wave3-finance-owner-review.ts:21,49-53`; kwalifikowana ścieżka jest zapisana w rejestrze modułu.
- Dowód: `/private/tmp/cx-day60-finance-review/seed.log`, SHA-256 `69a66ad1664e3b423a9e3745842dc8e2fd2181a798f07326741de0bc9ba97b3f`.
- Wpływ: brak pełnego stanu, uwierzytelnionego użytkownika, macierzy 20 zrzutów i kompletnego G09.
- Najwęższe rozstrzygnięcie: przywrócić dokładny PDF o allowlistowanym SHA-256 `e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e`; nie jest potrzebna naprawa kodu.

### `FIN-D60-002` — instrukcja nazywa DB inaczej niż kontrakt seedera

- Objaw: instrukcja rezerwuje `consultify_day60_finance_review`, a seeder dopuszcza wyłącznie `consultify_w3_finance_owner_*`.
- Reprodukcja i lokalizacja: porównać instrukcję z `server/scripts/seed-wave3-finance-owner-review.ts:45-47`.
- Dowód: source marker; kontrola fail-closed przeprowadzona przed zapisem fixture.
- Wpływ: pełny stan wymagałby drugiej, jawnie nazwanej DB na tym samym lokalnym PG. Zależna część nie została wykonana z powodu wcześniejszego braku PDF.
- Najwęższe rozstrzygnięcie: przy ponownym dyżurze potwierdzić nazwę `consultify_w3_finance_owner_day60` jako DB pełnego stanu, pozostawiając świeżą DB instrukcji jako stan pusty.

## Wynik G07–G10

| pozycja | wynik | czego brakuje |
| --- | --- | --- |
| G07 | `PARTIAL / OWNER_REPLAY_BLOCKED` | runtime-backed, obejrzana karta właściciela |
| G08 | `PARTIAL / EVIDENCE_MISSING` | 20 podstawowych zrzutów oraz wymagane ujęcia interakcji |
| G09 | `PARTIAL / STOP` | uwierzytelniony użytkownik i pełne przejście UI/HTTP |
| G10 | `PARTIAL / EVIDENCE_MISSING` | jasny/ciemny, pusty/pełny dla wszystkich pięciu ekranów |

G11–G20 pozostają bez zmian. Akceptacji właściciela nie deklarowano.

## Twierdzenia niezweryfikowane

- `NOT_PROVEN`: którykolwiek z pięciu ekranów renderuje się poprawnie na markerze w języku polskim.
- `NOT_PROVEN`: kompletność jasnego i ciemnego motywu oraz pustego i pełnego stanu.
- `NOT_PROVEN`: działanie kebaba, podglądu i karty w runtime.
- `NOT_PROVEN`: uwierzytelniona ścieżka G09 i kody HTTP po zalogowaniu.
- `NOT_PROVEN`: brak kolizji, ucięć, pustych paneli i angielskiej treści w polskim UI.
- `NOT_PROVEN`: owner acceptance, staging, produkcja i wydanie.

## Karta dowodowa

**KARTA DOWODOWA — DYŻUR 60 (FINANSE)**
Gałąź: `codex/finance-day60-owner-review-20260828` · Tip: uzupełniony commitem dyżuru · Marker: `5e30cb9bf66c8e75481ba723debdd04f3c1a6893` · Data: `2026-08-28`

### 1. Rodowód

- Marker jest przodkiem tipa: do potwierdzenia po commicie.
- Kopia zapasowa po pierwszym commicie: push wyłącznie `github-backup`.
- Commitów ponad marker: `1` planowany; plików zmienionych: `3`.

### 2. Rozłączność

- Pliki spoza licencji zapisane w repo: `ŻADNE`.
- Pliki przekrojowe dotknięte: `ŻADNE`.
- Nowe migracje: `ŻADNE`; użyto istniejącego łańcucha `858`, drugi przebieg `0`.
- Port PG / harness: `5932 / 3990`.

### 3. Osiągalność

| klasa dowodu | teza | wejście | mechanizm | skutek | negatywna granica | lokalizacja | wynik |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gateway/DB | pięć rodzin Finance jest zamontowanych przez realny Gateway | 5 anonimowych GET | `ApiGateway.initializeRoutes`, real PG | pięć odpowiedzi `401` | nie dowodzi sesji ani UI | `gateway.log` | `PARTIAL` |
| migracja | świeża DB odpowiada markerowi | dwa przebiegi | repozytoryjny migrator | `858`, następnie `0` | nie dowodzi danych fixture | `migrate-1.log`, `migrate-2.log` | `PASS` |
| fixture | seeder odmawia niekwalifikowanego wejścia | brak PDF | istniejący guard SHA/ścieżki | exit `1` przed seedem | nie dowodzi pełnego stanu | `seed.log` | `BLOCKED` |
| wizualny | pełna macierz ekranów | brak sesji/fixture | N/A | zero obrazów | nie wolno relabelować API jako UI | manifest zrzutów w raporcie | `EVIDENCE_MISSING` |

### 4. Dowód mutacyjny

`N/A — dyżur nie naprawia i nie mutuje produktu`.

### 5. Regres

Nie uruchamiano pakietu regresji: dyżur nie zmienia produktu. `--retry=0`: `N/A`. Nie zgłoszono zielony→czerwony ani czerwony→zielony.

### 6. Zmiany istniejących testów

`ŻADNE`.

### 7. Mianowniki

| liczba | co mierzy | komenda/metoda |
| --- | --- | --- |
| 5 | kanoniczne ekrany Finance | odczyt pięciu detail routes w `AppRoutes.tsx` i pięciu artifact mounts w `FinanceHub.tsx` |
| 20 | podstawowe zrzuty | `5 × 2 motywy × 2 stany` |
| 0 | wykonane zrzuty | lista plików PNG w katalogu artefaktów |
| 858 | udane migracje | SQL `count(*) from schema_migrations where status='success'` |
| 5 | próby GET przez Gateway | pięć jawnych URL-i z tabeli G09 |

### 8. Wygląd

- Zrzuty wykonane: `NIE — EVIDENCE_MISSING`.
- Obejrzane oczami: `N/A`; nie powstały obrazy.
- Stany i język: `NOT_PROVEN`.
- Zmiany widoczne dla użytkownika poza zakresem: `ŻADNE`.

### 9. Status per pozycja

Zgodny z tabelą „Wynik G07–G10” powyżej; każda pozycja jest częściowa i ma wskazany brak.

### 10. Twierdzenia niezweryfikowane

Lista sześciu jawnych `NOT_PROVEN` znajduje się powyżej i nie jest pusta.

### 11. STOP-y

| powód | sprawdzona licencja | potrzeba od nadzorcy |
| --- | --- | --- |
| brak exact-PDF blokuje istniejący seeder | zapis tylko w trzech dokumentach; brak zmian produktu | przywrócenie exact-PDF o wymaganym SHA |
| konflikt nazw DB dla pełnego stanu | brak migracji i ręcznego seedowania | potwierdzenie osobnej nazwy prefixowej przy ponowieniu |
