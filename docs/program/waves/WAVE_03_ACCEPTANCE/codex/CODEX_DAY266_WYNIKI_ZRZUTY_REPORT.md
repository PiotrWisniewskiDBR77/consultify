# CODEX DAY266 — WYNIKI — RAPORT ZRZUTÓW POD WERDYKT

## Stan wejściowy

- Gałąź: `codex/day266-wyniki-zrzuty-20260901`; baza: `df7f13056f`.
- Globalny marker `7a733cb63d`: `GLOBAL MARKER OK`.
- Marker instrukcji `df7f13056f`: `INSTRUCTION MARKER OK`.
- `git rev-parse HEAD` przed pracą: `df7f13056fa24995be07f64b0e8c877b3faeab45`.
- `git status --short | head -3` przed pracą: brak wyjścia.
- Dysk na wejściu po utworzeniu worktree: `8.1Gi` wolnego (> 5 GB).
- Porty 6272, 5252 i 5253: wolne przed startem.
- Migracje PostgreSQL (`pgvector/pgvector:pg16`, `127.0.0.1:6272/cx266`): pierwszy przebieg zakończony `Postgres migrations complete`; drugi przebieg: `Applying migrations: 0`, `Postgres migrations complete`.

## R1 — inwentarz i tezy wejściowe

Pomiar potwierdził sześć deklarowanych kart w `ResultsHub.tsx:521-548`. `grep ResultsHub dev-render/main.tsx` przed zmianą nie zwrócił trafień. Cztery istniejące wejścia harnessu były zarejestrowane w `dev-render/main.tsx:751,801,2172,2177`, ale każde montowało fragment domenowy, a nie pełny hub, dlatego dodano osobny ekran zamiast poszerzać istniejący dowód o innym celu.

| Zakładka | Render / typ | Pusty i pełny | Light/dark | Podgląd |
|---|---|---|---|---|
| `results_kpi` | `ResultsHub.tsx:2431-2438`, lista `StandardTable` + `StandardPreview` (`:1589,1801`) | sfotografowane | tak | NIEZWERYFIKOWANE: brak kliknięcia wiersza |
| `results_reports` | `ResultsHub.tsx:2299`, workspace raportowy | sfotografowane | tak | nie dotyczy głównego widoku |
| `results_benefits_inbox` | `ResultsHub.tsx:2256`, inbox | sfotografowane | tak | NIEZWERYFIKOWANE: brak kliknięcia wiersza |
| `roi` | `ResultsHub.tsx:2339`, workspace śledzenia ROI | sfotografowane | tak | NIEZWERYFIKOWANE: brak kliknięcia wiersza |
| `roi_analysis` | `ResultsHub.tsx:2254`, workspace obliczeniowy | sfotografowane | tak | nie jest listą |
| `results_strategic` | `ResultsHub.tsx:2258`, workspace strategiczny | sfotografowane | tak | nie jest listą |

`StandardPreview` nie zawiera `fixed`, `absolute`, `inset-0`, `z-50` ani arbitralnego `z-[…]`; rodzina Results używa go w 4 plikach: `ResultsHub.tsx`, `ResultsOkrSetsTable.tsx`, `ResultsRoiReviewsTable.tsx`, `ResultsScorecardsTable.tsx`. Jest to panel w układzie, nie nakładka.

## R2 — realny hub i profil widoczności

Dodany ekran `day266-wyniki-hub-zrzuty.tsx` montuje dynamicznie prawdziwy `src/components/Results/ResultsHub.tsx`. Parametr `demoAcceptance=on|off` jest domyślnie OFF i jest rozstrzygany przez kanoniczne `isDemoAcceptanceProfileEnabled` z `src/utils/demoAcceptanceProfile.ts:27`; jego wynik ustawia jawne, istniejące query-overrides trzech domen Results VNext. Nie zmieniono żadnej flagi produktowej ani jej wartości domyślnej.

Każdy obraz ma widoczną adnotację: lokalny harness, konto `Piotr Wiśniewski`, rola `ADMIN`, `demoON`/`demoOFF`, `ready`/`empty`. `ff_resultsThreePairs=0` izoluje żądane sześć zakładek. Stan pusty używa kanonicznego owner-review fail-closed i pustych odpowiedzi o kształcie eksportów `V8ResultsApi`; pełny korzysta z istniejącego showcase produktu.

Pełny wynik `scripts/dev/check-devrender-main.sh`:

```text
✓ parsuje sie
✓ struktura spisu ekranow poprawna (kazdy wpis domkniety)
✓ wszystkie lazy-importy wskazuja na istniejace pliki
✓ brak zdublowanych kluczy
✓ kazdy leniwy import ma wpis w spisie
✓ kazdy wpis w spisie ma leniwy import
✓ liczba ekranow: 260 (podloga 259)
```

### Kontrola kształtu atrapy

| Domena | Front | Realny kontrakt | Werdykt |
|---|---|---|---|
| KPI | `V8ResultsApi.getKpiCatalog`: `initiatives`, `kpis`, `mappings` | `src/services/api/v8/results.ts:759-768` | zgodny dla stanu empty; ready to istniejący showcase produktu |
| ROI | `getRoiPortfolioSummary` / `getRoiInitiativeDetail` | `src/services/api/v8/results.ts:769-774` | brak nowej atrapy ROI; ekran używa istniejącego runtime/showcase |
| OKR | widoczność sterowana istniejącym `ff_resultsVNextOkr` | kontrakt domenowy poza głównym sześciokartowym hubem | NIEZWERYFIKOWANE w tym zestawie |

## R3 — katalog dowodów

Katalog: `/private/tmp/cx-day266-wyniki-zrzuty-artefakty`.

- 48 PNG: 6 zakładek × 2 stany × 2 motywy × 2 profile.
- Manifest: `SHA256SUMS.txt`; wszystkie 48 plików ma unikalny SHA-256.
- Nazwa każdego pliku: `<tab>-<ready|empty>-<light|dark>-<demoOFF|demoON>.png`.
- Różnice ready/empty zostały potwierdzone osobnymi SHA dla każdej z sześciu zakładek.
- Kontrola par: `pair-checks.txt`; light luma 247.4–248.4, dark 17.9–23.8, różnica 224.5–230.6, wszystkie zmierzone pary przeszły próg 150.
- Dla `roi_analysis-ready` `checkScreenshotPairState` uruchomiono z `requiresResultMarker=true`; marker stanu istniał w obu wariantach. Nie jest to jednak dowód dwóch selektorów wyniku wewnątrz workspace — ten punkt pozostaje nieweryfikowany.

Opis obrazu: pełny lokalny ResultsHub z Menu 2/3, właściwą zakładką, treścią realnego komponentu oraz stałym paskiem kontekstu dowodowego u góry; wariant ciemny ma tę samą scenę i stan co jasny.

### Dowód realności

Import prowadzi bezpośrednio do `../../src/components/Results/ResultsHub`; test kontraktu zabrania reimplementacji. Nie wykonano wymaganej czasowej mutacji tekstu `ResultsHub.tsx`, ponieważ plik jest w tabeli licencji wyłącznie do odczytu. Bezpieczniejsza interpretacja: dostarczono dowód importu i różne renderowane zakładki, ale mutacyjny dowód R3.6 oznaczono jako NIEZWERYFIKOWANY.

## Pomiar testów

Polecenie z instrukcji dla `scripts/dev/__tests__/day266-wyniki-zrzuty-werdykt.test.mjs` nie uruchamia przypadków w zastanym `vitest.config.ts`: reporter zwraca `numTotalTests: 0`, a verbose: `No test files found`; config nie obejmuje `scripts/dev/__tests__/**/*.mjs`. To nie jest PASS. Nie zmieniono globalnego configu (`Z18`). Pełne nazwy planowanych przypadków istnieją w pliku, ale nie są przedstawiane jako wykonane. `przed-nazwy.txt` / `po-nazwy.txt` nie stanowią dowodu zielonej suity.

Pułapki Z33: pakiet jest czysto statyczny i nie dotyka Gateway, DB, autoryzacji ani beta-visibility; `ENABLE_V8_GLOBAL`, `ENABLE_TEST_AUTH_BYPASS`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE` i `DB_TYPE` nie leżą na jego ścieżce. Brak uruchomionych testów pozostaje brakiem pomiaru, niezależnie od tego.

## Z30 — bezpieczeństwo wysyłki

`env | grep -iE '^(SMTP_|RESEND|SENDGRID|MAIL)'` → `BRAK ZMIENNYCH POCZTY`. Zapytanie `settings WHERE key LIKE 'smtp%'` → `0 rows`. Grep drenów w `server/src/Gateway.ts` → brak trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Twierdzenia niezweryfikowane

- Kliknięcie wiersza i otwarty `StandardPreview` w kadrze dla wszystkich listowych kart.
- Dwa niezależne selektory właściwego wyniku wewnątrz `roi_analysis`.
- Mutacja produkcyjnego `ResultsHub.tsx` w obie strony (konflikt z licencją tylko-do-odczytu).
- Pełna zgodność kształtu danych OKR oraz realny HTTP/ApiGateway/Postgres — ten dyżur jest harnessowo-zrzutowy i nie dodaje backendu.
- Wykonana zielona suita Vitest; zastany include daje zero przypadków.

## Lista niefotografowalnych

- Otwarty podgląd: automat przechwytujący nie ma bezpiecznego, stabilnego selektora wiersza wspólnego dla wszystkich list; nie klikano na ślepo.
- Wewnętrzny wynik asynchroniczny ROI Analysis: brak potwierdzonych dwóch selektorów wyniku; obraz jest materiałem widoku, nie dowodem zakończonego obliczenia.

## Korekty wobec instrukcji

1. Instrukcja wymaga modyfikacji `ResultsHub.tsx` dla dowodu realności, a tabela licencji oznacza `src/components/Results/**` jako zakaz zapisu. Zastosowano bezpieczniejszą interpretację: nie zmieniono pliku produktu; brak mutacyjnego dowodu opisano jawnie.
2. Instrukcja podaje gotową komendę Vitest dla pliku `.mjs`, lecz zastany `vitest.config.ts` nie obejmuje `scripts/dev/__tests__`. Wynik to zero testów, nie PASS; globalnego configu nie zmieniono.
3. `check-devrender-main.sh` sam podnosi plik podłogi z 259 do 260, ale plik nie jest w licencji zapisu. Zmianę podłogi cofnięto; pełny wynik strażnika zachowano poza repo.
4. Tezy 24/33 (gołe repo) i 0/33 (realne demo) są cytowane oddzielnie. Zrzuty nie pochodzą z żadnego z tych środowisk: to jawnie opisany lokalny harness z profilem demoOFF/demoON.

## Werdykt

Materiał częściowy pod decyzję właściciela: komplet 48 rozróżnialnych zrzutów sześciu realnych kart, stanów, motywów i profili został wykonany; brak klikniętych podglądów, selektorów wyniku ROI Analysis, mutacji R3.6 i wykonalnej suity uniemożliwia oznaczenie pełnego DoD.
