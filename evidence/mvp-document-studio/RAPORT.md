# Materiały → Dokumenty → „Czysto" — naprawa blokera B3 (06.09)

Gałąź `mvp/document-studio-czysto` (baza `codex/m03-admin-20260824` @ `6fa7db5ed1`).
Środowisko pomiaru: lokalne stanowisko NOC — baza `consultify_noc` (54400),
własny serwer z tej gałęzi (4140), własny vite (3099), konto `audyt@dbr77.local`.

## 1. Łańcuch przyczyny (zmierzony, nie wywnioskowany)

Klik „Nowy dokument" → „Czysto" (`/document-studio?entry=blank`)
→ efekt `docEntryMode==='blank'` → `handleCreateEmptyDoc`
→ `runStreamingGeneration` → SSE `POST /document-studio/generate/stream`
z `AbortController` → efekt sprzątający na odmontowaniu
(`DocumentStudioView.tsx` ~292: `streamAbortControllerRef.current?.abort()`).

React **StrictMode** (`src/index.tsx:119/134/147`) odpala mount → cleanup → mount
w jednym commicie, więc `abort()` padał **zanim fetch wystartował**.

Pomiar sieci (Playwright, przechwycone wszystkie żądania `/api/`):
**ZERO żądań do `/api/document-studio/generate*`** — jedyne wywołanie tego
modułu to `GET /document-studio/templates?status=approved` (200).
`catch` widział `signal.aborted` → `setPhase(knownOutline ? 'outline' : 'intake')`
= `'outline'`, przy `outline` w stanie równym `null` → ostatnia gałąź ternary
(`DocumentStudioView.tsx:1156` przed naprawą) → **niemy** napis
„Brak wczytanego dokumentu." (`documentStudio.view.noDocument`), `error === null`,
zero błędów konsoli. Ref-guard fire-once blokował drugą próbę.

Serwer był sprawny cały czas — sonda `POST /api/document-studio/generate`
(`useLlm:false`, jednosekcyjny outline) zwracała 200 z gotowym artefaktem.
Przyczyna była wyłącznie po stronie klienta.

## 2. Naprawa

- `handleCreateEmptyDoc` idzie synchronicznym `POST /document-studio/generate`
  (bez `AbortSignal`) — pusty dokument nie ma czego streamować;
- porażka → wspólny `BlankCreationState` (jak Prezentacje/Excele): polski
  komunikat + „Spróbuj ponownie" + „Wróć do Materiałów";
- ostatnia gałąź ternary przestała być ślepym zaułkiem — karta z komunikatem PL
  i dwoma wyjściami (`documentStudio.view.noDocumentActionable`);
- **drugi defekt, znaleziony przy dowodzie**: zmiana nazwy dokumentu zapisywała
  się w schemacie (toast „Tytuł zapisany"), ale lista Materiałów dalej pokazywała
  „Nowy dokument" — `v8_output_artifacts.title_snapshot` dostawał tytuł tylko raz,
  przy rejestracji. Dodane `refreshArtifactTitleForOrigin` (patchuje WYŁĄCZNIE
  `title_snapshot`, żeby nie przepisać `owner_user_id`) wołane fail-open z
  `PUT /document-studio/:artifactId/content`.

## 3. Dowód mutacyjny

`src/components/DocumentStudio/__tests__/DocumentStudioView.blank.test.tsx` — 3/3 zielone.
Przywrócenie starej ścieżki (`runStreamingGeneration`) → **2 z 3 padają**
(StrictMode-create i stan porażki). Trzeci test (odmontowanie nie unieważnia
żądania) przechodzi w obu wariantach — nie różnicuje, zostawiony jako kontrakt.

## 4. Dowód na żywo (zrzuty, `bledyKonsoli=0` w każdym)

| Plik | Co widać |
|---|---|
| `01-lista-dokumentow.png` | Materiały → Dokumenty, przycisk „Nowy dokument" |
| `02-brama-trybow.png` | brama „Jak chcesz zacząć?" — Czysto / Z AI / Z wzorca |
| `03-edytor-otwarty.png` | po „Czysto": edytor TipTap, konspekt „1 sekcja", pasek narzędzi |
| `04-tytul-i-akapit.png` | tytuł „Notatka z przejścia MVP", wpisany akapit, toast „Tytuł zapisany" |
| `05-lista-z-dokumentem.png` | lista Dokumentów z nową nazwą na pierwszej pozycji |
| `06-otwarty-z-listy.png` | otwarty z listy — tytuł i treść na miejscu |
| `06-otwarty-ponownie.png` | wejście po adresie `/document-studio/<id>` — treść przetrwała autozapis |
| `07-tryb-z-wzorca.png`, `08-tryb-z-ai.png` | pozostałe dwa tryby launchera |
| `09-materialy-wszystkie.png`, `10-nowy-output-menu.png` | rodziny materiałów i menu „Nowy materiał" |
| `11-lista-po-sprzataniu.png` | baza po usunięciu rekordów testowych (14 seedowych, zero moich) |

## 5. Pozostałe tryby i sąsiedztwo

- **„Z wzorca"** (`?entry=template`) — otwiera formularz Trybu 3 z listą
  zatwierdzonych szablonów, bez błędów; **pełnej generacji z szablonu nie
  przechodziłem** (poza zakresem, wymaga LLM).
- **„Z AI"** (`?entry=ai`) — otwiera panel „Twój dokument pojawi się tutaj" +
  czat Teresy; **generacji nie uruchamiałem**.
- **Notatka / mapa myśli / whiteboard NIE są osiągalne z Materiałów.** Menu
  „Nowy materiał" oferuje wyłącznie Dokument / Prezentacja / Arkusz, a liczniki
  rodzin to Dokument / Prezentacja / Tabela. Mapa myśli i whiteboard mieszkają
  poza tym modułem (Moja praca / czat: `/tabele`, `/excele`, IdeaMapWorkspace).

## 6. Domknięcie

- esbuild: `DocumentStudioView.tsx`, `artifactRegistryService.ts`,
  `document-studio.routes.ts` — czyste; `node --check` na `zrzut.mjs` — czysty.
- `tsc` serwera (`server/tsconfig.json`) — 0 błędów.
- `scripts/check-list-canon.sh`, `scripts/check-artefakt.sh` — bez nowych naruszeń.
- vitest `src/components/DocumentStudio/__tests__/`: 95 zielonych, 1 czerwony
  (`DocumentStudioDocumentPanel > uses the Artifact Studio shell…`) — **czerwień
  ZASTANA**: ten sam test pada na nietkniętej bazie `/private/tmp/m03`.
- Migracje: **0 zmodyfikowanych** (moje commity nie dotykają `server/migrations/`).
- Dane demo: 13 rekordów testowych utworzonych w trakcie pomiaru **usuniętych**
  z bazy wraz z indeksem, linkami pochodzenia, overlayem i rodowodem
  (`11-lista-po-sprzataniu.png`).

## 7. Czego NIE zrobiłem

- Nie testowałem generacji „Z AI" ani pełnej generacji „Z wzorca".
- Nie dodałem testu jednostkowego dla `refreshArtifactTitleForOrigin` — ten
  defekt ma dowód end-to-end na żywo (05/06), nie ma dowodu mutacyjnego.
- Nie sprawdzałem, czy identyczny cichy fail z abortem dotyka innych wołaczy
  `runStreamingGeneration` (tryb 1 i 3 mają `outline` w stanie, więc wracają na
  ekran konspektu — ale przy anulowaniu też robią to bez słowa).
