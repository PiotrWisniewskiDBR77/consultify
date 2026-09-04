# CODEX DAY 316 — prezentacja błędów frontu

Status: `PARTIAL` — rdzeń R1–R6 wykonany i wypchnięty; ogon 308 widocznych miejsc nie został podmieniony. Brak wpisu `FIXED` bez dowodu mutacyjnego.

## Stan wejściowy i warunek startu

Warunek startu wznowionego dyżuru sprawdziłem na bieżącym markerze wydanym w tej instrukcji, nie na historycznym markerze dyżuru 300.

```text
bc18bc7acac2ec825ebb3db2f1309738ab034d58
      73
server/src/middleware/appErrorMapper.ts:85:export function mapAppErrorResponse(
```

Wynik procedury markera i sanity, dosłownie:

```text
MARKER OK
bc18bc7acac2ec825ebb3db2f1309738ab034d58
```

Tip `github-backup/grafika/m03-20260902` jest nowszy od markera. Pracę rozpocząłem dokładnie z markera; scalenie nowszego tipa pozostaje po stronie nadzorcy.

## Korekty wobec instrukcji

- Zakres `src/services src/api src/hooks src/components`: 642 trafienia — zgodnie z instrukcją.
- Całe `src`: 786 trafień, nie 790. Wiążący jest pomiar `git grep -nE 'data\\.error|err\\.message|error\\.message' -- src | wc -l` wykonany na `bc18bc7...`.
- Teza, że przeglądarka zignoruje ustawione przez front `Accept-Language`, została obalona w użytym realnym Chromium: lokalny harness na 5472 otrzymał `{"acceptLanguage":"pl","appLanguage":"pl"}` po `fetch` ustawiającym oba nagłówki na `pl`.
- Teza „około 204 komunikaty są po angielsku” jest zbyt mocna: wywołań jest dokładnie 204, lecz analiza AST potwierdza bezpośrednio 156 angielskich literałów; po rozwiązaniu dwóch stałych dochodzi sześć dalszych angielskich wywołań, czyli potwierdzone minimum 162/204 (79,4%).

## R1 — mianownik i klasyfikacja

Mój mianownik to 642 trafienia w czterech jawnie wskazanych katalogach. Jest odtwarzalny dokładną komendą instrukcji, obejmuje warstwy HTTP i konsumentów UI objęte licencją, a jednocześnie nie miesza 144 dodatkowych trafień z pozostałych części `src`.

Pełna klasyfikacja per trafienie znajduje się w `REJESTR_FRONT_BLEDY_20260904.md`. Klasyfikację wykonano konserwatywnie: teren dyżurów 314/315 zawsze ma pierwszeństwo; logowanie i sterowanie nie są zmieniane; do `NA EKRAN` zaliczono bezpośrednie ujścia UI oraz błędy propagowane przez licencjonowane klienty HTTP do takich ujść.

Wynik klasyfikacji zostanie utrwalony liczbami z wygenerowanego rejestru w commicie R1; pojedyncze trafienie w `src/services/api/baseClient.ts` Git rozpoznał jako plik binarny z powodu bajtu NUL i oznaczyłem je jawnie jako wymagające osobnego audytu, zamiast wymyślać numer linii.

### Który `ErrorState` jest montowany

Realnie montowany jest `src/components/ui/primitives/ErrorState.tsx`. Dowód dla ścieżki raportów: `src/routes/AppRoutes.tsx:219-220` ładuje `ReportsHub`, `AppRoutes.tsx:2630` renderuje `<ManagementReportsHub />`, `ReportsHub.tsx:56` importuje prymityw, a `ReportsHub.tsx:739` renderuje `<ErrorState message={loadError} retry={loadData} />`. Drugi komponent (`shared/states/ErrorState.tsx`) nie ma produkcyjnego importera; jedyne trafienie ścieżki jest komentarzem w cudzym terenie `MyWork/IdeasTableContent.tsx:570`.

Zgodnie z tabelą licencji warunkowa licencja prezentacji przechodzi więc na `src/components/ui/primitives/ErrorState.tsx`; komponentu `shared/states/ErrorState.tsx` nie zmieniam i nie tworzę trzeciego.

## Środowisko dowodowe

- Dysk na starcie: 61 GiB wolne; po checkout: 58 GiB.
- Porty 5472 i 6332: brak nasłuchu przed startem.
- Kontener: `cx-day316-pg`, baza `cx316`, port hosta 6332, obraz `pgvector/pgvector:pg16`.
- Pierwszy przebieg migracji zakończony `Postgres migrations complete`; drugi: `Applying migrations: 0`; tabela `schema_migrations`: 891 wierszy.
- Bazowy pomiar nazw: 50 pełnych nazw w `/private/tmp/cx-day316-front-bledy-artefakty/przed-nazwy.txt`.

### Z30 — brak wysyłki

`env` zwrócił `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; `Gateway.ts` nie zawiera uruchomienia drenów.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R2 — jedno źródło tekstów

Dodano `src/services/errors/appErrorCopy.ts`: siedem kodów kanonicznych, bezpieczny fallback nieznanego kodu do `INTERNAL`, odczyt koperty bez pokazywania `message` oraz format identyfikatora zgłoszenia. `errors.app` zawiera oddzielne wartości PL/EN. Realnie montowany `ui/primitives/ErrorState` przyjmuje kopertę w `source`, pokazuje zdanie, działanie i zaznaczalny `correlationId`; nie przyjmuje ani nie renderuje surowego komunikatu z koperty.

Dowód zielony: 11/11 pełnych przypadków w `/private/tmp/cx-day316-front-bledy-artefakty/r2-restored-green.json`. Dowód mutacyjny: po przemianowaniu polskiego bloku `errors` test był czerwony 5/11 PASS, 6/11 FAIL (`r2-red.json`); po przywróceniu kopii wrócił do 11/11 PASS. Mutacja została cofnięta przed commitem.

## R3 — podmiana wołaczy

### Grupa A — transport HTTP

`src/services/api.ts`: `ApiError` przenosi typowane `errorCode`, `correlationId`, `status` i pełną kopertę diagnostyczną w `data`, lecz jego `message` jest bezpiecznym tekstem lokalnym, a nie `data.error`. Centralny parser odpowiedzi oraz 48 prostych miejsc `throw new Error(data.error || fallback)` używają tego kontraktu. Nie zmieniono logiki autoryzacji, retry ani streamingu. Trafienia rodziny: PRZED 68, PO 20; pozostałe 20 to jawnie sklasyfikowane sterowanie, logowanie lub cudzy teren strumienia AI.

### Grupa B — pięciu głównych konsumentów

PRZED → PO: `useReportBuilder.ts` 27→0; `DocumentStudioDocumentPanel.tsx` 23→0; `useReportSections.ts` 11→0; `DocumentStudioTemplateArchitectView.tsx` 10→1 (pozostawione sterowanie po kodzie biznesowym); `PresentationTemplateArchitectView.tsx` 9→0. Każdy widoczny stan korzysta z `getAppErrorLine(t, err)`, więc nie interpoluje surowego `message`.

Każdy zmieniony plik przeszedł osobny bundle `esbuild`; ostrzeżenia `import.meta` z formatu IIFE zostały wyeliminowane kontrolnym przebiegiem ESM dla dużych komponentów. ESLint dla trzech komponentów: 0 błędów, 12 zastanych ostrzeżeń.

Ogon nie został jeszcze podmieniony; pozostaje jawnie policzony po zakończeniu rdzenia.

## R4 — bezpiecznik surowego JSX

`tests/unit/frontend/noRawErrorInJsx.test.ts` obejmuje sześć jawnych plików rdzenia. Linia bazowa wynosi 0 osobno dla każdego pliku; strażnik nie jest pusty, bo odczytuje i sprawdza sześć produkcyjnych źródeł. Wykrywa interpolację `data.error`, `err.message` albo `error.message` wewnątrz klamer JSX, pozostawiając diagnostyczne logowanie i sterowanie poza zakresem.

Dowód zielony: 7/7 przypadków (`r4-green-2.json`). Mutacja dodała poprawne składniowo `<span>{err.message}</span>` do objętego `PresentationTemplateArchitectView.tsx`; dokładnie jego przypadek spadł, wynik 6/7 PASS i 1/7 FAIL (`r4-red.json`). Po przywróceniu pliku przez `cp` wynik wrócił do 7/7 PASS (`r4-restored-green.json`). Mutacja została cofnięta, a produktowy diff po cofnięciu nie zawiera sondy.

## R5 — dowód widoku użytkownika

Test renderujący montuje realny `src/components/ui/primitives/ErrorState.tsx` przez prawdziwy `I18nextProvider`. Dla `NOT_FOUND`, `FORBIDDEN` i `INTERNAL` asercje dotyczą widocznego polskiego zdania, podpowiedzi działania oraz tekstu `Identyfikator zgłoszenia: corr-…`; nie sprawdzają jedynie obecności propsa.

Wynik: 14/14 przypadków pakietu zielonych (`/private/tmp/cx-day316-front-bledy-artefakty/r5-render-final.json`), w tym trzy pełne przypadki renderu. ESLint zmienionego testu: 0 błędów i 0 ostrzeżeń.

## R6 — warunek brzegowy języka

### 1. `new AppError(...)`

Pełny pomiar AST objął wszystkie pliki `server/src` poza zakazanym `_backup`: dokładnie 204 wywołania. Surowy wynik: 156 literalnych/template angielskich (76,5%) oraz 48 dynamicznych (23,5%). Audyt 48 dynamicznych rozstrzygnął dodatkowo sześć wywołań stałych jako EN (`QUEUE_UNAVAILABLE_MESSAGE` ×1, `MEGATREND_UNAVAILABLE_MESSAGE` ×5), jedną ekspresję PL, jedną dwujęzyczną, dwa wywołania z liczbą `500` w pozycji komunikatu oraz 38 zależnych od błędu/argumentu runtime. Potwierdzone minimum EN to zatem 162/204 = 79,4%; dokładnego odsetka nie wolno podać bez danych runtime dla pozostałych 38. Artefakt: `/private/tmp/cx-day316-front-bledy-artefakty/r6-app-errors.json`.

Dodatkowe znalezisko tylko do rekomendacji: `server/src/services/stageGateService.ts:446,453` wywołuje `new AppError(500, 'Failed…', code)`, podczas gdy konstruktor oczekuje najpierw komunikatu; mapper może więc wysłać użytkownikowi tekst `500`.

### 2. Realny `Accept-Language`

Uruchomiłem lokalny harness HTTP na wyłącznym porcie 5472. Strona w realnym Codex In-app Chromium wykonała `fetch('/echo', {headers: {'Accept-Language': 'pl', 'X-App-Language': 'pl'}})`. Widoczny wynik DOM był dokładnie `{"acceptLanguage":"pl","appLanguage":"pl"}`. W tym środowisku oba nagłówki realnie doszły; komentarz `api.ts` o bezwarunkowym ignorowaniu `Accept-Language` nie opisuje tego przebiegu. Harness został zatrzymany po pomiarze.

### 3. Odsetek polskich komunikatów bez dyżuru 321

Po R3 rodzina trafień spadła 642→515 w zadanych katalogach i 786→659 w całym `src`, czyli rdzeń usunął 127 surowych ujść. Dla tych 127/127 objętych ujść tekst pochodzi z frontowego `errors.app` i przy polskim UI jest polski niezależnie od surowego języka serwera: 100% objętego rdzenia. W pełnej klasyfikacji R1 było 435 pozycji `NA EKRAN`; 127/435 = 29,2% widocznych miejsc ma obecnie udowodnioną podmianę, a 308 pozostaje w ogonie lub cudzym terenie. Odsetek realnych zdarzeń użytkowników jest `NOT_PROVEN`, bo repo nie zawiera rozkładu ruchu/błędów per ujście.

**Zdanie cytowalne:** Bez dyżuru 321 użytkownik z polskim UI zobaczy polski komunikat w 100% objętego rdzenia (127/127 usuniętych surowych ujść), lecz dla całego mianownika udowodnione jest tylko 127/435 = 29,2% widocznych miejsc; globalny odsetek zdarzeń pozostaje `NOT_PROVEN`.

### Rekomendacja dla dyżuru 321 — diff nienałożony

```diff
diff --git a/server/src/middleware/appErrorMapper.ts b/server/src/middleware/appErrorMapper.ts
@@
-  const message = operational ? raw : MESSAGES[language][mappedCode];
+  // Public response is always canonical and localized. Keep raw text only in
+  // structured logs and development-only `debug` below.
+  const message = MESSAGES[language][mappedCode];
```

Dyżur 321 powinien osobno poprawić kolejność argumentów dwóch wywołań w `stageGateService.ts` i dodać kontrakt, że operacyjny `AppError` z niestandardowym `errorCode` nadal dostaje kanoniczny tekst według sklasyfikowanego statusu. Niczego w `server/src` nie zmieniłem.

## R7 — podsumowanie i zasięg testów

### PRZED → PO i commity

| Pozycja / grupa | PRZED → PO | Commit |
| --- | --- | --- |
| R1 — mianownik i klasyfikacja | brak rejestru → 642 wiersze | `423225cbc2` |
| R2 — kopia i prezentacja | 0 kluczy `errors.app` → 7 kodów + identyfikator PL/EN | `91fe2b95f7` |
| R3A — klient HTTP | 68 → 20 trafień rodziny | `1ab8e6529c` |
| R3B — pięciu konsumentów | 80 → 1 trafienie sterujące | `c34a88e077` |
| R4 — ratchet JSX | brak → 6 plików, baseline 0 per plik | `790e757bcf` |
| R5 — realny render | brak → 3 kody z PL + correlationId | `3e2383dded` |
| R6 — język | przypuszczenie → pomiar 204 + browser header | `cd8e667ff5` |

Cały zadany mianownik: 642→515. Całe `src`: 786→659. Ogon widoczny według klasyfikacji R1: 435−127 = 308 pozycji bez udowodnionej podmiany; w tej liczbie są także kolizje zasobowe 314/315. To jest powód statusu `PARTIAL`, nie ukryty sukces.

### §0.4a — pełne nazwy

- PRZED: 50 pełnych nazw, SHA-256 `9259cf9175b4aeb9b8b99868322f7e37ffb165faa0921a6d731833a6618fa2d1`.
- PO: 71 pełnych nazw, SHA-256 `a787a18e6fa1494bd70ac9fa717c7b8c6cce9e3d4a5bbb601a5145fb6eea6e03`.
- Diff: 21 nazw dodanych, 0 znikniętych, SHA-256 `38d1803c0c89cca9835c3c9ab10a6de9e66316d7a6f3894868c263dce248156b`.
- Pełny przebieg PO: 19/19 suit i 71/71 testów PASS, `--retry=0`.

Pliki: `/private/tmp/cx-day316-front-bledy-artefakty/przed-nazwy.txt`, `po-nazwy.txt`, `nazwy.diff`, `po.json`.

### Artefakty dowodów mutacyjnych

- R2 czerwony `bc89610d22879e727deee476753c6b0270394f55c4ea8953006a6f8095a27b7e`; zielony po cofnięciu `54f07873993c9328840908b990a9f01a28e63dd41d013731669c785b2b881c19`.
- R4 czerwony `1e4e47b83f3e95ecc5362de3313f51f4ad4f0d80ecf95915309407746bd4f4da`; zielony po cofnięciu `7155ad058aad4366f80e82253c94b37bc541d8ca381382c84c1fa8d5857c4aaa`.
- R5 render `848319e81d59fcd20401ffbea0b4a3b8474dae71f7c41e27fc26187dd67651fe`.
- R6 AST `4d899a4a70ca82f290e458da37341424f2b74772c803f6941d8400c15fb9b8cd`.

### Pułapki środowiska a dowody

Pakiety R2/R4/R5 są czysto jednostkowe i uruchomiono je wariantem C (`RUN_DB_TESTS=0 MOCK_DB=true`), więc nie dowodzą egzekucji DB, `ApiGateway`, auth ani bramek (a)–(d). Pułapkę (e) wyłączono pomiarem na bieżącym markerze: 73 pliki mappera. Pułapki (f) i (g) zmierzono osobno w R6. Pułapki (h) i (i) zamknięto odpowiednio ścieżką realnego montażu `ErrorState` oraz asercją konkretnych wartości PL z mutacją zasobu. `junit.xml` z bazowego przebiegu nie został dodany do repo.

### Pliki zmienione względem markera

14 plików: dwa dokumenty, dwa zasoby lokalizacji, sześć plików rdzenia R3, montowany `ErrorState`, źródło tekstów i dwa testy. Dokładna lista pochodzi z `git diff --name-only bc18bc7...HEAD`; żadnego pliku `server/src` ani globalnej infrastruktury testowej nie zmieniono.

W TOKU.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie prześledziłem runtime każdej z 308 pozostawionych pozycji `NA EKRAN`; ich klasyfikacja jest konserwatywnym audytem statycznym, nie dowodem renderu każdej trasy.
- Dokładny odsetek językowy 38 dynamicznych argumentów `new AppError(...)` pozostaje `UNKNOWN`; zależy od wartości runtime.
- Globalny, ważony ruchem odsetek błędów widzianych po polsku jest `NOT_PROVEN`, ponieważ brak telemetrii częstości per ujście.
- Nie wykonałem produkcyjnego HTTP/JWT/PG dla ekranów, ponieważ pozycje R2/R4/R5 są kontraktami frontowymi, a R6 wymagał wyłącznie realnego nagłówka przeglądarki; wyników jednostkowych nie przedstawiam jako dowodu backendu.
- Nie podmieniłem ogona 308 widocznych pozycji; status całości pozostaje `PARTIAL`.
