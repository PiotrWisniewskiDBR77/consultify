# ASM-IE — prawdziwy E2E w przeglądarce: DRD i SIRI (2026-08-13)

Gałąź: `codex/asm-ie` @ bazowa `74bc2cd782` (+ 3 commity tej sesji, patrz niżej).
Baza: `postgresql://piotrwisniewski@127.0.0.1:5439/consultify_asm_ie` (pełny schemat, dedykowana).
Serwer: prawdziwy Express (`server/src/index.ts`), produkcyjny Gateway — bez `NODE_ENV=test`,
bez `ENABLE_TEST_GATEWAY`, bez supertest. Uruchamiany WYŁĄCZNIE przez `preview_start`
(`scripts/dev/asm-ie-e2e-backend.sh` / `asm-ie-e2e-frontend.sh`).
Przeglądarka: Claude Browser MCP (realne kliknięcia, real DOM), port frontu 5304, port API 3401.

Zero wstawień SQL, żeby ekran coś pokazał. Jedyne bezpośrednie zapisy do bazy poza UI to:
rejestracja **pakietu metodycznego** (`method_packs` — treść metodyki DRD/SIRI, analogiczna do
migracji/danych referencyjnych, NIE danych testowych sesji) przez `scripts/seed-method-packs.ts`
i `scripts/seed-method-packs-siri.ts`. Użytkownik, organizacja, sesja, odpowiedzi — wszystko
przez prawdziwe UI.

## Zmiany w tej sesji (na `codex/asm-ie`)

1. Cherry-pick `6da977e631` (autor: sesja koordynująca, `codex/assessment-complete-20260813`) —
   `scripts/seed-method-packs.ts`: most rejestracji pakietu DRD w `method_packs` (bez tego
   registry jest pusty na świeżej instalacji, `POST /api/method/sessions` nie ma z czego
   utworzyć sesji). NIE podnosi `readiness`.
2. `scripts/seed-method-packs-siri.ts` — analogiczny skrypt dla SIRI (mój, wzorowany na 1).
   Ujawnił: pakiet SIRI ma **0/16 wymiarów z pytaniami**, `readiness=draft`.
3. `scripts/dev/asm-ie-e2e-backend.sh`, `scripts/dev/asm-ie-e2e-frontend.sh` — launch scripts
   pod `preview_start` (CI=true jako legalna furtka na lokalny Postgres, NIE NODE_ENV=test —
   patrz `server/src/config/databaseTargetResolver.ts:allowLocalDatabaseForTests`).

## WYNIK — DRD: ścieżka UI jest ślepym zaułkiem, PRZED utworzeniem jakiejkolwiek sesji

Kroki 2–7 z zadania (utworzenie sesji przez UI → pytania → freeze → output → restart →
reopen) **nie dały się wykonać, bo krok 2 jest zablokowany strukturalnie, nie przypadkowo.**

### Co dokładnie widzi użytkownik

1. Rejestracja nowego konta przez `/register` → działa (org `Fiord Consulting Test 8f2c`,
   user `asm-ie-e2e@example.com`, rola ADMIN). Jeden drobny defekt po drodze: pierwsza próba
   rejestracji z nazwą firmy `"ASM IE E2E Co"` dostała `409 ORGANIZATION_ALREADY_EXISTS`
   względem mojej wcześniej-SQL-owo-utworzonej org `"ASM-IE E2E"` — nazwy różnią się spacją/
   myślnikiem, więc dedup nazw organizacji jest podejrzanie zbyt agresywny (nie zbadane głębiej,
   poza zakresem). UI pokazał tylko generyczne „Registration failed. Please try again." — realna
   przyczyna (konflikt nazwy) była widoczna wyłącznie w sieci, nie w komunikacie.
2. Menu → **Assessment** → ląduje na `/assessment/overview?tab=library`, breadcrumb „Tools ›
   Licensed", zakładka **Library**: tabela DRD/SIRI/ADMA/CMMI/Lean.
3. DRD: status **„Unavailable"**, przycisk **Start jest permanentnie wyszarzony**
   (`disabled`), tooltip: *„No published definition available yet"*. Nad tabelą duży komunikat:
   *„DRD definition catalog — No published DRD definition found yet — Start will be disabled
   until one is published."*
4. SIRI/ADMA/CMMI/Lean: przycisk Start wyszarzony, tooltip *„Not available in this MVP"* —
   nawet gorzej niż DRD (brak jakiegokolwiek komunikatu o drodze naprzód).
5. **Nie ma żadnego przycisku, linku ani ekranu admina, który pozwoliłby to opublikować.**
   Kliknięcie w dowolnym miejscu tego ekranu nie prowadzi dalej. To jest koniec ścieżki.

### Dlaczego (zweryfikowane czytaniem kodu, nie zgadywaniem)

W tym repo współistnieją **trzy niezależne modele treści DRD**, które się nie stykają:

| Warstwa | Tabela / rejestr | Stan na świeżej instalacji | Kto z niej korzysta |
|---|---|---|---|
| A — katalog V8 (legacy) | `assessment_definitions` | **0 wierszy** | `AssessmentLibraryTab.tsx` — jedyny przycisk Start widoczny w UI |
| B — method-core (nowy silnik) | `method_packs` | Zaseedowany w tej sesji (DRD 2.0.0-methodpack.1, 39/233/699) | `DrdHttpMethodWorkspaceScreen.tsx` przez `POST /api/method/sessions` |
| C — client feature flags | `useFeatureFlags.tsx` registry (`drdMethodWorkspaceSliceV1`, `drdHttpSourceOfTruthV1`) | Oba **`defaultValue: false`** | Bramkują, czy `/assessment/drd/:id` w ogóle omija warstwę A |

`AssessmentLibraryTab.handleStart` (linie ok. 124–158) jawnie sprawdza WYŁĄCZNIE warstwę A
(`if (!row.supported || !drdDefinition) return;`) i **nic nie wie o warstwie B ani C**. Nawet z
zaseedowanym pakietem method-core, przycisk Start w jedynym widocznym miejscu UI zostaje
wyszarzony na zawsze, bo `assessment_definitions` jest i pozostanie puste.

Serwerowe endpointy do publikacji warstwy A **istnieją** (`POST /definitions/:id/draft`,
`POST /definitions/:id/publish`, `server/src/routes/v8/assessment.routes.ts:568,603`,
wymagają roli global-admin) — ale **zero komponentu frontendowego je woła**. To kolejny
przypadek „kod jest, podłączeń nie ma" (wzorzec ×7 z audytu Dokumentów 2026-07-28).

Nawet gdyby warstwa A była opublikowana: warstwa C (`drdMethodWorkspaceSliceV1` /
`drdHttpSourceOfTruthV1`) i tak musi być włączona, żeby sesja poszła przez serwer zamiast
`localStorage`-only legacy runtime — a **jedyny w produkcie ekran „Feature Flags"
(Settings → Developer Mode → Feature Flags) jest tekstowo opisany jako „managed by
administrators and cannot be changed here" i w tej chwili jest zepsuty**: „Feature flags
unavailable — Failed to fetch feature flags." `allowLocalOverride: true` w kodzie
(`useFeatureFlags.tsx`) nie ma ŻADNEJ powierzchni UI, która by z tego skorzystała — zakładka
„Beta Features" pokazuje „No beta features available right now."

**Wniosek: na świeżej instalacji nie istnieje SEKWENCJA KLIKNIĘĆ, która utworzy sesję DRD.**
Nie „trudna", nie „ukryta za wieloma krokami" — nieosiągalna żadną ścieżką klikania w
obecnym stanie kodu. To defekt pierwszej wagi (P0), nie kwestia konfiguracji środowiska
testowego: te same trzy warstwy i ten sam pusty `assessment_definitions` będą na każdej
świeżej instalacji, łącznie z prawdziwym onboardingiem klienta.

### Nie obszedłem tego SQL-em / bezpośrednim wywołaniem serwera

Zgodnie z poleceniem NIE wstawiłem rekordu do `assessment_definitions` ręcznie i NIE
przełączyłem flag przez `localStorage` z poziomu konsoli devtoola, żeby „przepchnąć" test
dalej — to byłoby dokładnie to, czego zabronił właściciel produktu („nie zaliczaj... jako
browser E2E"). Zamiast tego zatrzymałem się na udokumentowanym realnym stanie UI.

## WYNIK — SIRI: gorzej niż DRD, blokada podwójna

- Przycisk Start: „Not available in this MVP" (nie ma nawet iluzji ścieżki).
- Nawet gdyby ktoś odblokował warstwę A+C: pakiet SIRI zaseedowany w tej sesji ma
  `readiness=draft`, **0 z 16 wymiarów ma jakiekolwiek pytania**
  (`compileSiriPack()` raport: *„96/96 band descriptors carry EVIDENCE_MISSING... 0/16
  dimensions have dedicated questions"*). Ścieżka „odpowiedzi twierdzące/przeczące/nie wiem"
  jest niewykonalna dla SIRI niezależnie od bramek UI — treści pytań po prostu nie ma w
  repozytorium. To nie defekt UI, to stan metodyki.

## Kroki 4–7 zadania (freeze / output / restart / reopen)

**Nie wykonane** — nie da się dojść do nich bez sesji, a sesji nie da się utworzyć przez
klikanie. Nie fabrykowałem sesji SQL-em ani supertest-em, żeby te kroki „zaliczyć" —
opisuję to wprost jako niedokończone, zgodnie z poleceniem.

## Co jednak zweryfikowano realnie (poza gwarantowaną ścieżką)

### Restart procesu serwera — PID
- PID przed ubiciem: **90251** (pierwszy start), potem **95363** (po dodaniu
  `ENABLE_V8_GLOBAL=true` i restarcie).
- Ubity (`preview_stop` + potwierdzenie `lsof -iTCP:3401` → brak wyniku, port wolny).
- Nowy PID po starcie: **84945** (potwierdzone `lsof -iTCP:3401 -sTCP:LISTEN`).
- Aplikacja we frontendzie po restarcie: sesja użytkownika (cookie/token) przetrwała,
  `GET /api/auth/me` → 200, ekran Assessment wrócił do tego samego stanu (katalog z
  Start disabled) bez błędów w konsoli poza akumulowanym buforem starych wpisów.

### Serwer pada w trakcie interakcji
- Backend ubity (`preview_stop`), kliknięcie „Try again" na ekranie Library.
- UI pokazał: nagłówek **„DRD definition catalog"**, komunikat **„HTTP 500 Internal Server
  Error"**, przycisk **„Try again"** — czytelny komunikat błędu, przycisk odzyskania, brak
  białego ekranu / nieobsłużonego wyjątku / pustej strony. To jest DOBRZE zaimplementowana
  ścieżka błędu.

### Pusty stan (zero sesji)
- Efektywnie już udokumentowany: katalog Library z 5 frameworkami, wszystkie „Unavailable"/
  „Coming soon"/„Not available in this MVP" — to JEST stan pustki dla świeżej organizacji,
  tyle że bez żadnego wyjścia (patrz sekcja DRD wyżej).

### Nawigacja klawiaturą — pierścień fokusa
Zweryfikowane **czytaniem źródła** (nie tylko pomiarem na żywo — pane przeglądarki miało
powtarzające się problemy ze współdzieleniem między równoległymi sesjami, timeouty na
`computer{action:"key"}"`, co ograniczyło liczbę bezpośrednich pomiarów pikselowych w tej
turze): `src/components/shared/ModuleHub/FilterableTable.tsx` (komponent tabel współdzielony
przez większość ekranów listowych produktu, w tym zamierzenie Assessment):
- Przycisk sortowania nagłówka kolumny (linia ok. 965–971, `aria-label="Sort by {column}"`):
  **brak jakiejkolwiek klasy `focus-visible`** — `className="inline-flex items-center gap-1
  uppercase tracking-wider transition-colors hover:text-c-text-secondary"`. Przy fokusie
  klawiaturą przeglądarka narysuje własny domyślny outline (w Chromium bursztynowy,
  ok. rgb(229,151,0) wg wcześniejszego pomiaru zespołu — patrz komentarz w tym samym pliku,
  linia ok. 1221–1226, który dokumentuje dokładnie ten sam zmierzony kolor dla INNEGO elementu
  tego komponentu, już naprawionego).
- Przycisk „Columns" (okrągły, linia ok. 1084–1092, `h-7 w-7 rounded-full`): też **brak
  `focus-visible`**.
- Kontrast: wiersz tabeli (linia ok. 1227) i separator resize kolumny (linia ok. 512) MAJĄ
  poprawne `focus-visible:ring-2 focus-visible:ring-c-focus` — więc naprawa jest częściowa,
  niespójna w obrębie jednego pliku.
- Przycisk sortowania jest w kolejności Tab pierwszym interaktywnym elementem w treści tabeli
  na ekranach, gdzie kolumny są `sortable` — czyli to dokładnie ten sam defekt, który koordynator
  sesji równoległej zgłosił jako naprawiony commitem `236d6ceb86` na
  `codex/assessment-complete-20260813`. **Ta naprawa NIE jest scalona do `codex/asm-ie`** —
  celowo jej nie merge'owałem (poza moim write-setem `tests/e2e/**` + `docs/qa/**`, zadanie:
  mierzyć i zgłaszać, nie naprawiać kodu w `src/`). Na ekranach Assessment akurat wykorzystywana
  tabela (`AssessmentLibraryTab`) NIE deklaruje kolumn jako `sortable`, więc na SAMYM ekranie
  Assessment ten konkretny przycisk się nie renderuje — ale komponent jest współdzielony, więc
  defekt dotyczy każdego innego ekranu z sortowalną kolumną (My Work, Initiatives itd.), dopóki
  fix nie zostanie scalony.

### Powierzchnia „assessment-five-surfaces" (pytanie poboczne koordynatora)
Sprawdzone w PRAWDZIWEJ aplikacji (nie w harnessie dev-render): wszystkie 5 zakładek
AssessmentHub (Library, Processes, Outputs, Reports, Initiatives) klikniętych po kolei,
konsola i sieć czytane po każdym kliknięciu. **Brak błędu parsowania JSON w żadnej z nich.**
Wszystkie żądania sieciowe zwracały `200 OK` / poprawny JSON. Nie zidentyfikowałem źródłowego
requestu odpowiadającego za wcześniej zaobserwowane 403 (bufor sieci w tej sesji nie zawierał
już wystarczająco starych wpisów, żeby to ustalić z pewnością — to jedyny otwarty wątek z tej
pobocznej prośby). Wniosek dla oceny „13/30": **błąd JSON zaobserwowany w harnessie nie
reprodukuje się w realnej aplikacji na tych 5 zakładkach — wygląda na defekt harnessu
(niepokryty monkey-patch `Api`), nie produktu.** To jest wniosek z ograniczoną pewnością
(nie namierzyłem dokładnego brakującego wywołania w harnessie), ale sam fakt braku
reprodukcji w produkcie jest solidny.

## Błędy konsoli / HTTP ≥400 zaobserwowane w tej sesji

- `401` na `/api/...` przed zalogowaniem — oczekiwane.
- `409` przy pierwszej próbie rejestracji (konflikt nazwy organizacji, patrz wyżej) — realny,
  drobny defekt UX (komunikat nie tłumaczy przyczyny).
- `404` na `/api/v8/*` **przed** dodaniem `ENABLE_V8_GLOBAL=true` do mojego backendu — mój błąd
  konfiguracji uruchomieniowej, naprawiony restartem; nie defekt produktu.
- `403` (x2), powtarzające się przy każdym boot — źródło nie ustalone jednoznacznie w tej
  sesji (patrz wyżej), prawdopodobnie `/api/v8/admin/flags` lub `/api/feature-flags`
  przy pierwszym niezalogowanym renderze; do potwierdzenia w kolejnej turze.
- `500` — celowo wywołane (backend ubity), oczekiwane i poprawnie obsłużone przez UI.

## Pliki tej sesji

- `scripts/seed-method-packs.ts` (cherry-pick `6da977e631`)
- `scripts/seed-method-packs-siri.ts` (nowy, mój)
- `scripts/dev/asm-ie-e2e-backend.sh`, `scripts/dev/asm-ie-e2e-frontend.sh` (nowe, moje)
- `docs/qa/ASM_IE_BROWSER_E2E_DRD_SIRI_2026-08-13.md` (ten plik)

Kod produkcyjny (`src/`, `server/src/` poza wymienionym cherry-pickiem) — **nietknięty**,
zgodnie z zadaniem.
