# RN-G6-C1 — złota ścieżka KPI, real app + real dane

**Cel.** Dwadzieścia kroków złotej ścieżki KPI przeklikane na REALNEJ
aplikacji (backend `:3097`, frontend `:3197`) przeciw REALNEMU PostgreSQL 17
(`:55821`, baza `rn_g6_runtime`) — pierwszy w tym programie dowód, że da się
(albo NIE da się) przejść pełny cykl życia KPI przez UI, a nie tylko przez
dev-render/testy jednostkowe.

Worktree: `/Users/piotrwisniewski/rn-g2-lanes/g6-kpi`, gałąź `rn-g6-kpi`.
HEAD startowy: `747d658c2d`. Środowisko (backend/frontend/Postgres) fizycznie
żyje w sąsiednim worktree `g6-runtime` — WSPÓŁDZIELONE między torami RN-G6
(patrz F0).

Skrypt dowodowy: `scripts/rn-g6-kpi-golden-flow.mjs` (Playwright, commituje
się razem z tym raportem). Zrzuty: `docs/qa/screens/rn-g6-kpi/*.png`. Surowy
JSON każdego kroku (zrzut, błędy konsoli, wywołania API ≥400): odpowiedni
`*-report.json` w tym samym katalogu.

---

## F0 — środowisko WSPÓŁDZIELONE: backend padał dwukrotnie z SIGTERM z zewnątrz

W trakcie tej sesji backend na `:3097` (worktree `g6-runtime`, PID zmieniał
się po każdym restarcie) otrzymał **SIGTERM z zewnątrz dwa razy**
(`18:19:25` i ponownie `18:25:59`, 39 sekund po moim własnym restarcie) —
NIE od tej sesji. Log (`[Shutdown] Received SIGTERM, initiating graceful
shutdown...`) potwierdza czysty, zamierzony sygnał, nie crash. Wniosek: inny
tor/sesja RN-G6 restartuje TEN SAM współdzielony backend niezależnie od tej
sesji, bez koordynacji. Za każdym razem powodowało to serię 500 na
`POST /api/auth/login` i innych trasach dla mojej sesji w trakcie
przechodzenia złotej ścieżki. Naprawiono zgodnie z poleceniem zadania
("jeżeli backend nie odpowiada — uruchom ponownie, nie zabijaj cudzych
procesów") — backend wznawiany dokładnym poleceniem z
`RN_G6_RUNTIME_ENVIRONMENT.md` §3.1, Postgres (PID `38806`) NIGDY nie
dotknięty. **To NIE jest defekt produktu** — to niestabilność środowiska
testowego współdzielonego między torami. Wymieniam to jawnie, bo część
"błędów 500" w surowych logach network poniżej pochodzi z TYCH okien
niedostępności backendu, nie z realnych defektów commandów — odróżnione w
tabeli kroków przez `notes`.

---

## F1 — KRYTYCZNE: KAŻDY zapis w Results Next vNext 500-uje na świeżej sesji przeglądarki

**To jest najważniejsze znalezisko tej sesji.**

### Reprodukcja
1. Wyczyszczono `sessionStorage`/`localStorage`, zalogowano się jako
   `rn-g6-user-a-owner`, otwarto `/results/kpi?ff_resultsVNextKpi=1`.
2. Wypełniono formularz "New KPI", kliknięto zapis.
3. Odpowiedź: **`POST /api/vnext/results/kpi` → 500**,
   `{"error":"Internal server error","code":"KPI_INTERNAL_ERROR"}`.
4. Log backendu: `[resultsVnext/kpi.routes] createKpiDraft failed
   {"error":"invalid input syntax for type uuid: \"rdapdtb8bljfysmfqa6nhk\"​"}`.
5. `sessionStorage.getItem('correlationId')` w przeglądarce = dokładnie ten
   sam string `"rdapdtb8bljfysmfqa6nhk"`.

### Przyczyna źródłowa (zacytowana plik:linia)
- `src/services/apiUtils.ts:10-14` — przy pierwszym załadowaniu apki generuje
  **jeden, sesyjny, aplikacyjny** `X-Correlation-ID`:
  ```js
  correlationId = Math.random().toString(36).substring(2, 15) +
                  Math.random().toString(36).substring(2, 15);
  ```
  To NIE jest UUID — to ciąg alfanumeryczny base36 bez myślników, używany do
  logowania (`api_logs`, kolumna `TEXT`) w CAŁEJ aplikacji.
- `server/src/routes/resultsVnext/kpi.routes.ts:181-186` (i identyczne
  bliźniacze funkcje w `kpiDeviation.routes.ts`, `kpiScorecard.routes.ts`,
  `kpiPerspectives.routes.ts`, `roi.routes.ts`, `okr.routes.ts`) —
  `getCorrelationId(req)` odczytuje ten sam nagłówek i przekazuje go **wprost**
  do komendy zapisu jako `correlationId`.
- `server/src/services/resultsVnext/kpi/kpiDefinitionCommands.ts` (7 miejsc,
  np. linia 467) — `correlationId: correlationId ?? randomUUID()`. Operator
  `??` **nie uruchamia się**, bo string jest niepusty — fallback na
  `randomUUID()` działa WYŁĄCZNIE gdy pole jest `undefined`/`null`, nigdy gdy
  jest złego formatu.
- `server/migrations/20260809_rvn_platform_events_outbox.sql:23` —
  `rvn_platform_events.correlation_id` to `UUID NOT NULL` (bez `DEFAULT`).
  Postgres odrzuca zapis błędem `22P02 invalid input syntax for type uuid`,
  `handleKpiRouteError` mapuje to na generyczne 500.

### Skala
Ten sam wzorzec (`getCorrelationId(req)` → `correlationId` → INSERT do
`rvn_platform_events`) występuje w **każdym** route pliku domeny Results Next
vNext:
```
kpi.routes.ts            11 wywołań
kpiDeviation.routes.ts    11 wywołań
kpiScorecard.routes.ts     7 wywołań
kpiPerspectives.routes.ts  4 wywołania
roi.routes.ts             49 wywołań
okr.routes.ts             42 wywołania
```
Generator `Math.random().toString(36)` **nigdy** nie produkuje myślników w
pozycjach UUID — błąd jest **deterministyczny, nie probabilistyczny**: na
100% świeżych sesji (czysta karta/incognito/nowa zakładka — `sessionStorage`
jest per-tab) PIERWSZY zapis w CAŁEJ domenie KPI/ROI/OKR musi się wywalić.
Ponowne kliknięcie "Spróbuj ponownie" nigdy nie pomoże — ten sam zepsuty
`sessionStorage.correlationId` jest używany do każdej kolejnej próby w tej
samej karcie.

### Dlaczego nikt tego wcześniej nie złapał
Cały dotychczasowy dowód UI tego programu szedł przez `dev-render` (harness
z podstawioną warstwą sieciową — realny `fetch`/`X-Correlation-ID` nigdy nie
powstaje) albo przez testy `*.realdb.test.ts`, które wołają komendy
bezpośrednio z poprawnym, ręcznie skonstruowanym `correlationId` — żadna z
tych ścieżek nigdy nie przechodziła przez `apiUtils.ts`'s realny nagłówek.
Ta sesja jest — zgodnie z celem zadania — **pierwszym realnym przebiegiem
przeglądarki przez prawdziwy endpoint zapisu** w tym programie.

### Obejście zastosowane w tej sesji (JAWNIE ujawnione, NIE zmiana kodu)
`scripts/rn-g6-kpi-golden-flow.mjs` woła
`context.addInitScript(() => sessionStorage.setItem('correlationId',
crypto.randomUUID()))` przed załadowaniem aplikacji — naprawia WYŁĄCZNIE
wartość w `sessionStorage` tej jednej sesji Playwright, żeby dało się
przejść resztę złotej ścieżki. **Kod produkcyjny NIEZMIENIONY.** Realny
użytkownik w świeżej karcie pozostaje CAŁKOWICIE zablokowany, bez żadnego
zrozumiałego komunikatu (widzi tylko "Something went wrong completing this
action. Please try again.").

### Sugerowana naprawa (NIE wykonana w tej sesji — poza zakresem/zakazem zmiany kodu produkcyjnego)
`resolveIdempotencyKey`-podobny wzorzec: w `getCorrelationId(req)` albo w
`correlationId ?? randomUUID()` dodać walidację formatu UUID i fallback na
`randomUUID()` również dla NIEPUSTEGO-ale-złego-formatu stringa, nie tylko
dla `undefined`.

---

## F1B — KRYTYCZNE: maker-checker (Zatwierdź/Odrzuć definicję) NIEUŻYWALNY dla prawdziwego drugiego aktora

**Drugie najważniejsze znalezisko, bezpośrednio uderzające w krok 6 tego zadania.**

### Reprodukcja
1. Owner (`rn-g6-user-a-owner`) utworzył KPI-G6-002, zgłosił v1 do
   zatwierdzenia (real POST 201, `pending_approval`).
2. Admin (`rn-g6-user-a-admin`) — INNY aktor, INNA sesja przeglądarki,
   dokładnie tak jak w prawdziwym maker-checker — otworzył ten sam wiersz w
   zakładce "Org".
3. Przyciski **"Approve" i "Reject" są WYŁĄCZONE (`disabled=true`)** —
   niemożliwe do kliknięcia, zweryfikowane bezpośrednio przez DOM
   (`button.disabled === true`).
4. Kebab (row menu) **pokazuje uczciwy powód**: *"No definition-version data
   in this session — no GET returns the version (backend gap). Only
   available where the draft was created/edited in this tab."* — zrzut
   `docs/qa/screens/rn-g6-kpi/06b-reject-disabled-kebab-honest-reason.png`.
5. **Panel podglądu (prawa kolumna) — te same przyciski Approve/Reject NIE
   pokazują ŻADNEGO powodu** — ani `title`, ani `aria-describedby`, ani
   widocznego tekstu w DOM (zweryfikowano `outerHTML`) — zrzut
   `docs/qa/screens/rn-g6-kpi/06a-reject-disabled-preview-panel-no-reason.png`.
   To znaczy: TA SAMA blokada ma DWIE różne prezentacje w tym samym ekranie —
   jedna zgodna z D06 ("visible, disabled, with a reason"), druga NIE.

### Przyczyna źródłowa (zacytowana plik:linia)
`src/components/ResultsVNext/ResultsKpiRegistryPage.tsx`, nagłówek pliku
(ok. linii 62-79) i `buildDefinitionActions` (ok. linii 251-334):
> `knownVersions` ... there is no GET anywhere that returns a
> `rvn_kpi_definition_versions` row ... only ever knowable from THIS
> client's own prior write response for that exact version ... populated
> ONLY by create/edit/submit/approve/reject's own return values, NEVER
> guessed or defaulted ... This is a real backend-gap consequence, not a UI
> shortcut.

Innymi słowy: **Approve/Reject działają WYŁĄCZNIE dla aktora, który sam w
tej samej karcie przeglądarki właśnie utworzył/edytował/zgłosił tę wersję.**
Każdy inny — a maker-checker Z DEFINICJI wymaga innego — widzi trwale
zablokowane przyciski. Nie jest to race condition ani wolne ładowanie:
poczekano pełne 30 sekund (58 prób kliknięcia) bez zmiany stanu.

### Skutek dla tego zadania
Krok 6 ("odrzucenie przez recenzenta — drugi aktor — maker-checker!") jest
**niewykonalny przez UI tak, jak jest teraz zbudowany**, dla dowolnej pary
realnych, osobnych sesji przeglądarki. Jedyny sposób, żeby przycisk
zadziałał, to gdyby TEN SAM aktor, który stworzył KPI, sam je odrzucił —
co z kolei złamałoby regułę samo-zatwierdzenia (`SelfApprovalDeniedError`,
zresztą nie dotyczy explicit `reject`, ale i tak nie jest to prawdziwy
drugi aktor). **Nie próbowano obejść tego wywołaniem API z pominięciem UI**
(byłoby to sprzeczne z celem zadania — "zobaczyć produkt oczami
użytkownika").

### Kontrast: ta sama klasa maker-checker DZIAŁA poprawnie gdzie indziej
Zatwierdzenie **planu działania korygującego** (Deviation Case, Faza 4) użyto
z powodzeniem przez dwóch prawdziwych, osobnych aktorów w tej samej sesji
(patrz krok 13b w tabeli) — bo tamten ekran pobiera `kase` przez prawdziwy
`GET /deviation-cases/:caseId`, nie przez pamięć sesji. To dowodzi, że wzorzec
"prawdziwy GET → prawdziwy maker-checker" jest w tym kodzie ZNANY i
działający — brakuje go tylko na poziomie definicji KPI.

---

## F8 — nawigacja wewnętrzna do sprawy odchylenia GUBI flagę feature-flag

`KpiToolPage.tsx`, sekcja Deviations (ok. linii 621-631): kliknięcie wiersza
sprawy woła `navigate(`${TOOL_PATH}/deviation-cases/${caseId}`)` **bez
przeniesienia `?ff_resultsVNextKpi=1`**. Ponieważ to nawigacja
klient-side (SPA, nie pełny reload), a flaga rozstrzyga się z kolejności
query → localStorage → env → default `false`, i flaga NIGDY nie trafia do
localStorage automatycznie — po kliknięciu w prawdziwym UI ekran sprawy
odchylenia renderuje **"Deviation case — not yet enabled"** (zrzut
`docs/qa/screens/rn-g6-kpi/11-deviation-case-opened.png`), mimo że użytkownik
WŁAŚNIE był na ekranie z aktywną flagą. Obejście w tej sesji: nawigacja
bezpośrednia (`page.goto` z pełnym URL + flagą) zamiast kliknięcia linku —
DZIAŁA (dowód: krok 11b+ w tabeli), ale prawdziwy użytkownik klikający link
w UI tego nie zrobi.

---

## F9 — po zatwierdzeniu planu przez recenzenta właściciel NIE MA JAK bezpiecznie odświeżyć ekranu

Ten sam wzorzec co F1B, ale dla **działań korygujących**
(`rvn_kpi_corrective_actions`): `KpiDeviationCaseSubview.tsx` (Faza 3, box
ostrzegawczy) — *"No read endpoint exists for the corrective-action list
... the list below shows ONLY actions added in this browser session, not
the full database history."* Reprodukcja: właściciel dodał działanie i
złożył plan (real POST, real DB row) → recenzent (inna sesja) zatwierdził
plan (real POST, `case.status` → `approved` w bazie) → właściciel, żeby
zobaczyć nowy status sprawy, MUSI przeładować stronę (jedyny sposób —
`loadCase()` odpala się tylko przy mouncie) → przeładowanie **kasuje**
lokalną (jedyną!) listę działań, więc przełącznik statusu działania
("Active", potrzebny do przejścia `approved → executing`, decyzja #8) **znika
z ekranu**, mimo że działanie realnie istnieje w bazie. Zrzut:
`docs/qa/screens/rn-g6-kpi/13c-action-set-active-executing.png` — ten sam
box "No read endpoint..." zamiast listy działań ze statusem. Skutek: kroki
14-15 (obserwacja odbudowy, weryfikacja skuteczności) są w tej sesji
zablokowane tym samym backend-gap co F1B/F1, tylko o jedną warstwę głębiej.

---

## F10 — publikacja migawki karty wyników: 500 przy odczycie historii migawek z powodu ZDEFORMOWANEGO payloadu jednej z zasianych migawek

### Reprodukcja
1. Właściciel utworzył nową migawkę-szkic (`POST .../review-snapshots` → 201,
   real `snapshot_id` `65452e20-6da6-4e47-b978-ef5cb71bf69e`, status `draft`).
2. UI od razu odpytuje `GET .../review-snapshots?limit=100&offset=0`, żeby
   pokazać listę (włącznie z nową migawką) do wyboru "Publish" — **ta trasa
   zwraca 500** trzykrotnie z rzędu (przy każdej próbie odświeżenia):
   `{"error":"Internal server error"}`, log backendu: `[resultsVnext/kpiScorecard.routes]
   listReviewSnapshots failed {"error":"Cannot read properties of undefined
   (reading 'filter')"}`.
3. Efekt: zakładka "Review snapshots" tej karty wyników jest **trwale
   niedostępna** (każdy odczyt crashuje) — właściciel nie może dotrzeć do
   przycisku "Publish" dla WŁASNEJ, poprawnie utworzonej migawki-szkicu.

### Przyczyna źródłowa (zacytowana plik:linia)
`server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts:153` —
`redactSnapshotPayloadForReader`:
```ts
if (!row.snapshot_payload) return row;
const filteredItems = row.snapshot_payload.items.filter(...)   // linia 153
```
Odczyt bezpośredni z bazy potwierdza przyczynę: pre-istniejąca (zasiana),
już OPUBLIKOWANA migawka tej samej karty (`snapshot_id 5ec8a662-…`, zasiana
`server/scripts`/`scripts/rn-g6-seed-runtime-dataset.ts` przed tą sesją) ma
`snapshot_payload = {"note": "..."}`  — **BEZ klucza `items`** w ogóle
(`jsonb_object_keys` zwraca wyłącznie `note`). Guard `if (!row.snapshot_payload)`
przepuszcza ten wiersz (payload nie jest `null`), ale
`row.snapshot_payload.items` jest `undefined`, więc `.filter(...)` rzuca
`TypeError`. `listReviewSnapshots` (linia ok. 391-405) woła tę funkcję dla
KAŻDEGO wiersza w wyniku, gdy CHOĆ JEDEN wiersz ma niepusty payload
(`hasAnyPayload`) — jeden zdeformowany wiersz zatruwa całą listę, blokując
też dostęp do poprawnych migawek (w tym tej nowo utworzonej).

### Kwalifikacja
Korzeń leży w KSZTAŁCIE danych zasianych `scripts/rn-g6-seed-runtime-dataset.ts`
surowym SQL (ten skrypt sam siebie dokumentuje: "NIE przechodzi przez
`server/src/services/resultsVnext/**`, więc nie udowadnia, że reguły
biznesowe API akceptują ten kształt danych") — realna migawka utworzona
przez `publishSnapshot`'a komendę zawsze miałaby `{items, statusCounts}`.
**Mimo to jest to realny, dziś odtwarzalny defekt produkcyjnego kodu**:
`redactSnapshotPayloadForReader` powinien się bronić przed brakującym/
niekompletnym kształtem payloadu (np. `row.snapshot_payload.items ?? []`)
zamiast crashować całą listę — jeden zły wiersz historyczny nie powinien
nigdy blokować odczytu pozostałych, poprawnych wierszy.

---

## Pozostałe znaleziska (potwierdzone czytaniem kodu, do zweryfikowania na ekranie w tabeli kroków)

- **F2 — brak historii/rodowodu KPI w całej domenie.** `KpiToolPage.tsx`
  (sekcja "History / lineage", ok. linii 833-849) renderuje na stałe
  `GapNotice`: *"No GET exists for KPI history/events anywhere in the domain
  (checked kpi.routes.ts, kpiDeviation.routes.ts, kpiScorecard.routes.ts) —
  events exist in rvn_platform_events, but no route reads them."* Krok 19
  ("historia") żądania zadania jest w tym SHA **strukturalnie niemożliwy do
  spełnienia przez UI** — to nie błąd, to udokumentowany w kodzie brak.
- **F3 — zakładka "Contract" na ekranie KPI nie pokazuje nazwy/jednostki/celu/progów.**
  Tamże (ok. linii 552-573): *"No GET returns the joined definition version
  ... Below are only the fields reachable from GET /kpi/:kpiId"* — realnie
  widać tylko kod KPI, status cyklu życia i skrócone ID bieżącej wersji.
  Historia P0-A ("v1 odrzucona z powodem, v2 zatwierdzona") NIE ma
  dedykowanego widoku w KPI Tool — jedyne miejsce, gdzie widać cokolwiek z
  tego, to rejestr (`ResultsKpiRegistryPage.tsx`) i to tylko przez stan
  `knownVersions` używany do sterowania przyciskami, nie jako czytelna lista.
- **F4 — brak UI do tworzenia nowej karty wyników.** Zakładka "Scorecards"
  rejestru KPI (`ResultsKpiRegistryPage.tsx`, branch `tab === 'scorecards'`)
  nie ma `breadcrumbCta` — brak przycisku "New scorecard" mimo że
  `createScorecard`/`POST /api/vnext/results/kpi/scorecards` istnieje po
  stronie serwera. Krok 16 w tej sesji używa dlatego ISTNIEJĄCEJ, zasianej
  karty (`a7a84b5c-…`), nie tworzy nowej od zera.
- **F5 — "Dodaj KPI do karty wyników" to gołe pole tekstowe UUID, bez wyszukiwarki.**
  `KpiScorecardItemDialogs.tsx` (`kpi-scorecard-add-item-kpi`) to zwykły
  `<input type="text">` z placeholderem "paste the KPI id (UUID)" — brak
  jakiegokolwiek pickera/autouzupełniania KPI po kodzie/nazwie. Działa, ale
  wymaga, żeby użytkownik ręcznie skądś skopiował UUID.
- **F6 — brak eksplicytnego pola "kadencja"/"właściciel" w formularzu KPI.**
  Formularz "New KPI" (`KpiDraftFormModal.tsx`) nie ma pola kadencji
  pomiaru — kolumna `measurement_frequency_days` istnieje w schemacie
  (`rvn_kpi_definition_versions`) ale nie jest ustawiana przez ŻADEN
  formularz w tej domenie (sprawdzono grep całego `src/components/ResultsVNext/`
  — "cadence"/"kadencja" istnieje wyłącznie po stronie ROI benefit lines, nie
  KPI). Pole "Owner" nie ma pickera — właściciel domyślnie = twórca
  (`ownerUserId ?? createdBy`, `kpiDefinitionCommands.ts` ok. linii 388).

---

## Tabela dwudziestu kroków

Aktor "owner" = `rn-g6-user-a-owner` (Zofia Baran-Sikorska), "admin"
(recenzent) = `rn-g6-user-a-admin` (Anna Kowalska-Wróbel), "org B" =
`rn-g6-user-b-admin` (Marek Zieliński). Baseline sieci: **1 błąd konsoli / 1
odpowiedź ≥400 na każdym ekranie** to zawsze ten sam, pre-istniejący,
niepowiązany `GET /api/v8/admin/flags → 404` (potwierdzone wcześniej w
`RN_G6_B3_ROUTE_INVENTORY.md`) — odnotowany jako "baseline" poniżej i NIE
liczony osobno; wiersze z odchyleniem od baseline mają liczby wprost.

| # | Krok | Wykonany? | Co zobaczyłem | Realne ID | Zrzut | Błędy konsoli | Odpowiedzi ≥400 |
|---|---|---|---|---|---|---|---|
| 1 | Wejście do rejestru `/results/kpi` | TAK | Realny `StandardTable`, 0/0 (widok "My", świeża sesja) | — | `01-registry-entry-owner.png` | baseline | baseline |
| 2 | Utworzenie KPI (otwarcie formularza) | TAK | Modal "New KPI" | — | `02-new-kpi-modal-empty.png` | 0 | 0 |
| 3 | Definicja: kod/nazwa/jednostka/geometria/progi/opis | TAK | Formularz wypełniony (kadencja/owner — brak pola, patrz F6) | — | `03-new-kpi-modal-filled.png` | 0 | 0 |
| 4 | Zapis szkicu | TAK — **dopiero po obejściu F1** | `POST /api/vnext/results/kpi` → 201, KPI-G6-002 utworzone, wersja 1 draft | `kpiId 37d051ce-ab93-47ea-bd5a-a5b61b99e30b` | `04-kpi-created-draft-v1.png` | 0 | 0 |
| 5 | Zgłoszenie do zatwierdzenia | TAK | `submitDefinition` → 200/201, status `pending_approval`, wersja 1 `submitted` | — | `05-submitted-pending-approval.png` | 0 | 0 |
| 6 | **Odrzucenie przez recenzenta (drugi aktor)** | **NIE — ZABLOKOWANE (F1B)** | Admin otwiera Org→KPI-G6-002: przyciski Approve/Reject trwale wyszarzone (30s/58 prób), kebab pokazuje uczciwy powód, panel podglądu — bez powodu | — | `06b-reject-disabled-kebab-honest-reason.png`, `06a-reject-disabled-preview-panel-no-reason.png` | baseline | baseline |
| 7 | Kolejna wersja robocza po odrzuceniu | **NIE — niewykonalny, bo krok 6 nigdy się nie zdarzył** | v1 pozostaje `submitted` na zawsze (potwierdzone SELECT-em) — `reviseDefinition` wymaga `approval_status='rejected'`, którego nigdy nie osiągnięto | — | — | — | — |
| 8 | Zarejestrowanie pomiaru | TAK | `95`, Critical, Unverified — zarejestrowany mimo że definicja jest wciąż `pending_approval`/`submitted` (recordMeasurement nie wymaga zatwierdzonej wersji) | `measurement ffc230fe-…` | `08-measurement-recorded-critical.png` | baseline | baseline |
| 9 | Korekta pomiaru | TAK | `95 → 92`, nowy wiersz `correction_of_measurement_id` wskazuje oryginał (append-only, potwierdzone SELECT-em) | `measurement 7d6387af-…` | `09-measurement-corrected.png` | 0 | 0 |
| 10 | Weryfikacja i spór | TAK (weryfikacja trafiła w INNY wiersz niż zamierzony — błąd skryptu, nie produktu) | Weryfikacja: wiersz `92/lipiec` → `verified`. Spór: osobny pomiar `200/maj` → `disputed`, oba append-only | `measurement 2c157859-…` (verified), `measurement c6fe2e55-…` (disputed) | `10a-measurement-verified.png`, `10b-measurement-disputed-fixed.png` | baseline | baseline |
| 11 | Sprawa odchylenia | TAK, ale **F8** (nawigacja z linku w UI gubi flagę → "not yet enabled"); obejście: nawigacja bezpośrednia z flagą | Sprawa auto-utworzona przez krytyczny pomiar (decyzja #3), status `open` | `case 831b9ccf-717d-4b3d-90cf-5956acc955a0` | `11-deviation-case-opened.png` (pokazuje F8) | — | — |
| — | *(brakujący krok, dopisany po odkryciu)* Potwierdzenie sprawy | TAK | "Acknowledge" — `open → analysis_required` (Faza 1, wymagana PRZED analizą przyczyny, pominięta w pierwotnym 20-punktowym opisie zadania) | — | `11b-case-acknowledged.png` | baseline | baseline |
| 12 | Przyczyna źródłowa | TAK | "Opóźnienie dostawcy komponentów krytycznych..." / `supplier_delay`, `analysis_required → plan_required` | — | `12-root-cause-submitted.png` | 0 | 0 |
| 13 | Działanie korygujące | TAK | Dodano działanie + złożono plan, `plan_required → plan_submitted` | `action c0988099-…` | `13a-corrective-action-plan-submitted.png` | 0 | 0 |
| — | *(most, maker-checker realny drugi aktor)* Zatwierdzenie planu | **TAK — PRAWDZIWY sukces maker-checker!** | Admin (inna sesja) zatwierdził plan, `plan_submitted → approved`, `row_version` 4→5 | — | `13b-corrective-plan-approved.png` | baseline | baseline |
| 14 | Obserwacja odbudowy | **NIE — ZABLOKOWANE (F9)** | Po powrocie właściciela (przeładowanie, żeby zobaczyć nowy status) lista działań znika (brak GET) — selektor pomiaru do odbudowy trwale wyłączony | — | `14-fixup.png` | baseline | baseline |
| 15 | Weryfikacja skuteczności | **NIE — ZABLOKOWANE (F9, kaskada z 14)** | Pole wyniku weryfikacji trwale wyłączone, przycisk zamknięcia sprawy niedostępny | — | `15-fixup.png` | baseline | baseline |
| 16 | Karta wyników | TAK | KPI-G6-002 dodane jako pozycja "Supporting" do istniejącej, zasianej karty (brak UI tworzenia NOWEJ karty — F4) | `scorecard item 2e4cf2c7-60ea-48e8-b1b5-6bff0edb9b5e` | `16-scorecard-item-added.png` | baseline | baseline |
| 17 | Publikacja migawki | **CZĘŚCIOWO — szkic utworzony, publikacja ZABLOKOWANA (F10)** | `POST .../review-snapshots` → 201 (realny szkic, `17a-snapshot-created-draft.png`), ale kolejny `GET` listy migawek → 500 (zdeformowany payload STAREJ, zasianej migawki) uniemożliwia dotarcie do przycisku "Publish" | `snapshot 65452e20-6da6-4e47-b978-ef5cb71bf69e` (status `draft`, nigdy nie opublikowany) | `17-fixup.png` (stan po 500) | 7 | **4** (3× 500 na `review-snapshots` + baseline) |
| 18 | Migawka pod kątem czytelnika o węższym dostępie | TAK (fail-closed na granicy organizacji, NIE ten sam scenariusz co P0-C wewnątrz-organizacyjny — patrz "czego to nie dowodzi") | Org B admin, bezpośredni URL do karty org A: `GET .../scorecards/:id` → **404** dwukrotnie, ekran "You don't have access to this record — No visibility record exists... treated as denied by default" | — | `18-narrower-reader-org-b-clean.png` | 0 | 2 (oba 404, oczekiwane) |
| 19 | Historia | TAK — **potwierdza F2**: funkcja strukturalnie nieistniejąca | Zakładka "History / lineage" na stałe pokazuje GapNotice: "No GET exists for KPI history/events anywhere in the domain ... events exist in rvn_platform_events, but no route reads them." | — | `19-history-tab.png` | baseline | baseline |
| 20a | F5 na ekranie rekordu | TAK | Po przeładowaniu: dane realne, niezmienione (pomiar 92/critical/verified, status Pending approval), zakładka wraca do domyślnej "Performance" (oczekiwane — stan zakładki żyje w React, nie w URL) | — | `20a-f5-reload.png` | baseline | baseline |
| 20b | Zimny deep link (świeża sesja) | TAK | Świeża karta bez ciasteczek → `/login?redirect=%2Fresults%2Fkpi%2F37d051ce…%3Fff_resultsVNextKpi%3D1` → po zalogowaniu ląduje DOKŁADNIE na zapisanym rekordzie, nie na liście | — | `20b-cold-deeplink-post-login.png` | baseline | baseline |

**Wynik: 14/20 kroków wykonanych w pełni, 1 częściowo (17), 1 wykonany z
odchyleniem (10 — zweryfikowano zły wiersz), 4 trwale zablokowane realnymi
defektami produktu (6, 7 — kaskada z F1B; 14, 15 — kaskada z F9).**

---

## Realne identyfikatory

- KPI: `37d051ce-ab93-47ea-bd5a-a5b61b99e30b` (kod `KPI-G6-002`), organizacja `rn-g6-org-przemysl`
- Definicja v1: `3ec618fe-6f90-4cb6-9917-c70b921c3bac` (`approval_status='submitted'`, nigdy nie odrzucona ani zatwierdzona — patrz F1B)
- Pomiary: `ffc230fe-0024-40e2-8c44-f7e2c6bdef56` (95, oryginał) → `7d6387af-3a39-451d-8b16-9d83d929ff17` (92, korekta) → `2c157859-5ec8-4888-abaa-cc8a9bb99d89` (92, zweryfikowany); `c8d05778-2ecf-4a23-a43c-66e63d163a94` (40, on_target); `b9d9c439-b73c-4833-a23c-05753840f78d` (200, oryginał) → `c6fe2e55-3596-4906-82f2-63f60086ac5f` (200, zakwestionowany)
- Sprawa odchylenia: `831b9ccf-717d-4b3d-90cf-5956acc955a0` (status `approved`, `row_version=5`)
- Działanie korygujące: `c0988099-c511-475c-a79a-1d9eda6d69ed` (status `planned`, nie ruszone dalej — F9)
- Pozycja karty wyników: `2e4cf2c7-60ea-48e8-b1b5-6bff0edb9b5e` (karta `a7a84b5c-cfae-4680-8680-a7a84bcfaea3`, rola `supporting`)
- Migawka-szkic: `65452e20-6da6-4e47-b978-ef5cb71bf69e` (status `draft`, nigdy nie opublikowana — F10)

---

## Readback z bazy (SELECT bezpośrednio na Postgres, nie z ekranu)

Wszystkie potwierdzone `psql -h /tmp/rn-g6-sock -p 55821 -U postgres -d rn_g6_runtime`:

```
KPI:      status=pending_approval, owner=rn-g6-user-a-owner, current_version=3ec618fe…, row_version=1
Wersja 1: version_number=1, approval_status=submitted, target_value=45, warning_high=60,
          critical_high=90, rejected_by=NULL, rejected_at=NULL  ← NIGDY nie odrzucona (F1B)
Pomiary:  6 wierszy, append-only, łańcuch korekt/weryfikacji/sporu potwierdzony
          przez correction_of_measurement_id (patrz "Realne identyfikatory")
Sprawa:   status=approved, severity=critical, root_cause_category=supplier_delay,
          plan_submitted_by=rn-g6-user-a-owner, row_version=5 (4 przejścia: acknowledge→
          root cause→plan submit→plan approve, każde +1)
Działanie: status=planned (nie przeszło do active/completed — F9)
Migawka:  szkic 65452e20…, status=draft (opublikowana pozostała stara: 5ec8a662…,
          payload={"note": "..."} BEZ klucza "items" — źródło F10)
```

---

## Krok 7 — dowód kopiowania pól (P0-A)

**Nie zweryfikowane — krok niewykonalny.** `reviseDefinition` (P0-A) wymaga
`known.approvalStatus === 'rejected'` — warunek nigdy nieosiągnięty, bo krok
6 (odrzucenie) jest zablokowany przez F1B. SELECT na
`rvn_kpi_definition_versions` potwierdza: dla `kpi_id 37d051ce-…` istnieje
DOKŁADNIE JEDNA wersja (`version_number=1`, `approval_status='submitted'`) —
żadna wersja 2 nigdy nie powstała. P0-A jako mechanizm bazodanowy/backendowy
NIE był bezpośrednio testowany w tej sesji (jego własny testowy pakiet
`tests/resultsVnext/kpi/*.realdb.test.ts` z docs jest poza zakresem tej
sesji per allowlist zadania) — ale jego JEDYNA ścieżka wejścia przez realny
UI jest zablokowana przez F1B, więc realny użytkownik nigdy go nie użyje.

---

## Krok 18 — czytelnik o węższym dostępie (P0-C)

Zademonstrowano WYŁĄCZNIE izolację na granicy organizacji: org B admin
(`rn-g6-user-b-admin`), zupełnie inna organizacja, próbujący otworzyć
bezpośrednim URL-em kartę wyników org A (`a7a84b5c-…`) — dostaje **404** na
`GET /api/vnext/results/kpi/scorecards/:id` (dwukrotnie, zweryfikowane w
network log skryptu) i uczciwy, uspokajający ekran: *"You don't have access
to this record — No visibility record exists for this item — treated as
denied by default."* Zero wycieku (nawet licznik `Primary`/`Supporting`
pokazuje 0, nie prawdziwą liczbę pozycji karty). To jest fail-closed
najsilniejszej postaci — nie tylko redakcja treści, ale całkowita odmowa
istnienia zasobu.

**To NIE jest ten sam scenariusz co P0-C opisuje jako główny cel**
(`RN_G6_P0C_SNAPSHOT_FILTERING.md` §4 — "zwykły czytelnik z częściowym
dostępem" / "czytelnik który utracił dostęp PO publikacji", W TEJ SAMEJ
organizacji, przez RESTRICTED ACL na poziomie pojedynczego KPI wewnątrz
migawki). Seed danych używa `OPEN_ORG` dla WSZYSTKICH zasobów org A (patrz
`scripts/rn-g6-seed-runtime-dataset.ts` linia ok. 148-177) — nie istnieje w
bazie żaden scenariusz "ten sam org, węższy ACL" do odtworzenia przez UI bez
zmiany danych (a zmiana danych wprost w bazie jest zabroniona przez brief
zadania). Ta drobnoziarnista ścieżka pozostaje zweryfikowana WYŁĄCZNIE przez
`tests/resultsVnext/kpi/kpiScorecardListSnapshotsNonLeak.realdb.test.ts`
(cytowane w `RN_G6_P0C_SNAPSHOT_FILTERING.md`), nie przez ten raport.

---

## Krok 20 — F5 i zimny deep link (osobno)

**F5** (`20a-f5-reload.png`): przeładowano `/results/kpi/37d051ce-…?ff_resultsVNextKpi=1`
w trakcie oglądania rekordu. Po przeładowaniu: te same realne dane (pomiar
92/critical/verified, status "Pending approval", `Current definition version
3ec618fe…`), zakładka wraca na domyślną "Performance" (stan zakładki żyje w
Reactcie, nie w URL — oczekiwane, nie defekt). Zero utraty danych.

**Zimny deep link** (`20b-cold-deeplink-post-login.png`): FABRYCZNIE ŚWIEŻA
karta przeglądarki (nowy `BrowserContext`, zero ciasteczek/`sessionStorage`)
→ `page.goto()` bezpośrednio na URL rekordu → aplikacja poprawnie przekierowuje
na `/login?redirect=%2Fresults%2Fkpi%2F37d051ce-ab93-47ea-bd5a-a5b61b99e30b%3Fff_resultsVNextKpi%3D1`
(potwierdzone dosłownym URL-em w logu skryptu) → po zalogowaniu ląduje
DOKŁADNIE na zapisanym rekordzie KPI, nie na liście/rejestrze. To jest
poprawne zachowanie post-login-redirect, zweryfikowane end-to-end.

---

## Wszystkie znaleziska — skrót z dosłownymi komunikatami

| ID | Waga | Skrót | Dosłowny komunikat / dowód |
|---|---|---|---|
| F0 | operacyjne | Współdzielone środowisko restartowane z zewnątrz 2×/sesję | `[Shutdown] Received SIGTERM, initiating graceful shutdown...` (18:19:25, 18:25:59 — 39s po własnym restarcie) |
| **F1** | **KRYTYCZNE** | Każdy zapis RN vNext 500-uje na świeżej sesji | `{"error":"Internal server error","code":"KPI_INTERNAL_ERROR"}`; backend: `invalid input syntax for type uuid: "rdapdtb8bljfysmfqa6nhk"` |
| **F1B** | **KRYTYCZNE** | Maker-checker (Approve/Reject definicji) niedziałający dla realnego drugiego aktora | Przyciski `disabled=true` 30s/58 prób; kod: *"no GET returns the version (backend gap)"* |
| F2 | wysoka | Brak historii/rodowodu KPI w całej domenie | *"No GET exists for KPI history/events anywhere in the domain ... but no route reads them."* |
| F3 | średnia | Zakładka "Contract" nie pokazuje nazwy/jednostki/celu | *"No GET returns the joined definition version ... Below are only the fields reachable from GET /kpi/:kpiId."* |
| F4 | niska | Brak UI tworzenia nowej karty wyników | Brak `breadcrumbCta` w zakładce Scorecards mimo istniejącego `createScorecard` API |
| F5 | niska | "Dodaj KPI do karty" = gołe pole UUID | `placeholder="paste the KPI id (UUID)"`, zwykły `<input type="text">` |
| F6 | niska | Brak pola kadencji/właściciela w formularzu KPI | `measurement_frequency_days` nigdy niepisany przez żaden formularz UI |
| F8 | wysoka | Nawigacja do sprawy odchylenia gubi flagę | Ekran "Deviation case — not yet enabled" mimo aktywnej flagi chwilę wcześniej |
| F9 | wysoka | Po zatwierdzeniu planu właściciel traci widok listy działań | *"No read endpoint exists for the corrective-action list ... shows ONLY actions added in this browser session"* |
| F10 | wysoka | 500 na liście migawek przez zdeformowany payload starej migawki | `Cannot read properties of undefined (reading 'filter')`; zasiana migawka ma `payload={"note":...}` bez `items` |

---

## Czego ten raport NIE dowodzi

- Nie jest to 40-punktowa lista czekowania TRIADA/SPEC-A (menu/kebab/
  dark+light) — to dowód FUNKCJONALNY (czy da się kliknąć przepływ
  end-to-end na realnych danych), nie odbiór wizualny.
- Krok 18 (P0-C) dowodzi WYŁĄCZNIE izolacji między organizacjami
  (fail-closed dla obcej organizacji), NIE drobnoziarnistej redakcji
  wewnątrz-organizacyjnej — patrz uzasadnienie w sekcji kroku 18 powyżej.
- Krok 7 (P0-A) NIE został zweryfikowany wcale — jedyna ścieżka wejścia
  (odrzucenie) jest zablokowana przez F1B. Ten raport nie mówi nic o tym,
  czy `reviseDefinition` sam w sobie działa poprawnie (to inny zakres —
  testy `*.realdb.test.ts` cytowane w `RN_G6_P0A_KPI_REVISION_CONTRACT.md`).
- Obejście F1 (naprawiony `sessionStorage.correlationId` w skrypcie
  dowodowym, `context.addInitScript`) oznacza, że KAŻDY krok od 2 wzwyż
  został zweryfikowany z RĘCZNIE NAPRAWIONYM klientem. Realny użytkownik na
  świeżej karcie/incognito nie dojdzie nawet do końca kroku 2 — zobaczy
  wyłącznie "Something went wrong completing this action. Please try
  again." bez żadnej wskazówki, że problem jest w jego przeglądarce, nie w
  jego danych, i że retry NIGDY nie pomoże w tej samej karcie.
- Nie testowano ROI ani OKR (poza zakresem tego zadania — tylko KPI) — ale
  F1 dotyczy identycznie obu tych domen (patrz liczba wywołań
  `getCorrelationId` w `roi.routes.ts`/`okr.routes.ts` w sekcji F1).
- Krok 10 (weryfikacja) trafiła w INNY pomiar niż zamierzony (błąd sortowania
  w skrypcie dowodowym, nie w produkcie) — mechanizm weryfikacji sam w sobie
  zadziałał poprawnie, tylko na niezamierzonym wierszu.

## Czy ruszono coś poza allowlistą

Zmienione/utworzone pliki: `scripts/rn-g6-kpi-golden-flow.mjs`,
`scripts/rn-g6-kpi-golden-flow-fixup.mjs`, `scripts/rn-g6-kpi-f1b-capture.mjs`,
`scripts/rn-g6-kpi-step18-clean.mjs`, `docs/qa/screens/rn-g6-kpi/**`, ten
raport — wszystkie w allowlist zadania (`scripts/rn-g6-kpi-*` +
`docs/qa/screens/rn-g6-kpi/**` + ten plik). Backend/frontend restartowane
wyłącznie precyzyjnymi PID-ami własnych procesów (patrz F0), zgodnie z
runbookiem — nigdy `pkill -f`. Postgres (PID `38806`) nigdy nie dotknięty.
Pięć zakazanych plików równoległej sesji
(`server/src/database/PostgresDatabase.ts`, trzy `*.realdb.test.ts`,
migracja `20260810_fix_initiatives_status_default.sql`) — nigdy otwarte ani
zmienione. Zero zmian w kodzie produkcyjnym, zero push/merge/deploy, zero
domyślnych flag zmienionych, zero podagentów.
