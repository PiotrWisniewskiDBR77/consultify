# S1.14 — WERYFIKACJA NIEZALEŻNA raportu poprzednika (sesja 2)

Data: 2026-09-13, 17:45+ UTC+2. Konto `qa.fable.20260913@dbr77.com`, org QA Fable 13.09.
Sesja: `k7-storageState-qa.json` (token ważny, `/api/auth/me` 200, `accessLevel: free`).
Build: `/api/health.gitSha = bc40d5327c…` — **ten sam, na którym raportował poprzednik**.

Poprzednik NIE zawiesił się bez śladu: zostawił RAPORT.md (41 defektów), 151 zrzutów,
3 pobrane pliki i ~100 skryptów. Moja rola: sprawdzić jego tezy własnym pomiarem
(pamięć: „premisa z rejestru często fałszywa") i domknąć luki.

## WYNIK WERYFIKACJI BLOKERÓW

| # | teza poprzednika | mój pomiar | werdykt |
|---|---|---|---|
| B1 | Idea→Inicjatywa martwe, bo **nowa organizacja ma 0 projektów** | `POST /api/initiatives` bez projectId → **400 INITIATIVE_PROJECT_REQUIRED**. Utworzyłem projekt (`POST /api/projects` → **201**), po czym `POST /api/initiatives` **z** projectId → **200**. Powtórzyłem ścieżkę UI **przy istniejącym projekcie** → UI dalej leci **400**, `PAGEERROR: projectId is required`. Kod: `src/services/conversionService.ts:93` woła `Api.createInitiative({title,name,description,sourceType,sourceId})` — **`projectId` nie występuje w tym pliku ani razu** | **POTWIERDZONY, ale przyczyna INNA i GORSZA** — to nie brak projektu w nowej organizacji, tylko front, który **nigdy** nie wysyła `projectId`. Ścieżka Idea→Inicjatywa jest martwa dla **KAŻDEJ** organizacji, także takiej z projektami (np. DBR77) |
| B2 | Teresa blokowana `TRIAL_PROFILE_INCOMPLETE` | `POST /api/ai/chat/stream` → **HTTP 200**, ale w strumieniu SSE: `{"error":"Please complete organization setup…","code":"TRIAL_PROFILE_INCOMPLETE"}`, `degraded:{mode:"blocked",reason:"access_policy"}`, `citationsCount:0` | **POTWIERDZONY.** Uwaga metodyczna: status HTTP **200 maskuje blokadę** — probe sprawdzający tylko kod odpowiedzi ogłosiłby „działa" (mój pierwszy probe tak zrobił) |
| B4 | `POST /api/onboarding/context` → 404 | Powtórzone: **404 `API_ROUTE_NOT_FOUND`** | **POTWIERDZONY** |
| B6 | Wersje notatki nie powstają nigdy — brak wołacza POST | Front ma **dokładnie 3** odwołania do trasy wersji, wszystkie w `NotebookVersionHistory.tsx`: komentarz (l. 5), **GET** (l. 103), **POST …/versions/:vid/restore** (l. 136). **Zero** wołaczy `POST …/pages/:id/versions` w całym `src/`. Backend `notebookVersions.routes.ts:191` deklaruje POST | **POTWIERDZONY** — snapshot nie powstaje nigdy, „Restore" nieosiągalny |

| B5 | Documents — **tabela znika po przeładowaniu** (utrata danych) | **NIE POTWIERDZONY — OBALONY.** Własny cykl: wstawiłem tabelę `QAV2MARKER7731\|Value;RowA\|123` → `.ProseMirror table` 1→2, `PUT /api/document-studio/artifact-398b1e53…/content` **200**, po `reload` **tabela i marker są na miejscu**. Powtórzone 4× różnymi wartościami (A/B/C) — wszystkie wstawione i **wszystkie przetrwały**. Po pełnym przeładowaniu: **5 tabel**, markery `QAV2MARKER7731`, `AAA`, `CCC`, `bez zadnego separatora`, `QA EDIT` — **wszystkie obecne w OBU widokach** (Report 10 tabel w DOM, Editor 5) | **OBALONY** — treść tabeli **nie ginie**. Zachowana została też tabela poprzednika `[QA EDIT 1..5]` (5 znaczników żywych 2 h później) |

### Dlaczego poprzednik zobaczył „utratę tabeli" — hipoteza z pomiaru
W moim **pierwszym** podejściu tabela też „nie istniała" po zapisie — ale przyczyną było to,
że **wstawienie w ogóle się nie odbyło**: `Zastosuj` przy nieudanym wyczyszczeniu pola
(`Ctrl+a` zamiast `Meta+a` na macOS) **nic nie wstawił i nie pokazał żadnego błędu** —
`tables 1 → 1`, zero toastów, zero błędów konsoli. Dopiero poprawne wpisanie wartości
dało wstawienie. Czyli: „tabela zniknęła po reloadzie" to najprawdopodobniej
**cicha nieudana operacja wstawienia**, a nie utrata zapisanych danych.
To przesuwa defekt z klasy „utrata danych" (BLOKER) do klasy „cicha porażka operacji" (DROBNY),
ale **nie jest to defekt, który udało mi się wywołać powtarzalnie na poprawnym wejściu**.

## NOWE USTALENIA (nie ma ich u poprzednika)

| # | ekran | ustalenie | waga |
|---|---|---|---|
| N1 | Idea → Inicjatywa | Front **nigdy** nie wysyła `projectId` (`conversionService.ts:93`). Poprzednik przypisał winę brakowi projektów w nowej organizacji; **utworzenie projektu NIE naprawia ścieżki** — UI dalej leci 400. Defekt dotyczy **każdej** organizacji, także DBR77 | zaostrza B1 |
| N2 | Teresa `/api/ai/chat/stream` | Blokada jedzie w **strumieniu SSE przy HTTP 200**. Każdy pomiar patrzący na kod odpowiedzi ogłosi „działa" (mój pierwszy probe tak zrobił). To wzorzec „200 maskuje porażkę" — wart wpisu do pamięci bezpieczników | metodyczna |
| N3 | globalny „Document library" (prawy panel, `DocumentSidePanel.tsx`) | Czyta `Api.getProjectDocuments/getUserDocuments` (`/api/documents` → `[]`), więc pokazuje „No documents yet", podczas gdy w organizacji są **2 realne dokumenty** (`/api/artifacts`). Dwa różne magazyny pod tą samą nazwą „Documents" | DROBNY (uploady vs artefakty — możliwe, że zgodne z projektem; nie mam dowodu intencji) |
| N4 | `/materials`, `/materials/documents` | Bezpośrednie wejście pod te adresy = **„Page not found"**, mimo że moduł nazywa się Materials, a przyciski mówią „Back to Materials". Realny adres to **`/presentations`** | DROBNY |

## FAŁSZYWE ALARMY, KTÓRE SAM PROSTUJĘ
1. „Zakładka Documents w Materials otwiera szufladę uploadów zamiast listy" — **NIEPRAWDA**, to był
   mój błąd: pierwszy klik przechwyciła otwarta szuflada. Po poprawnym kliknięciu lista pokazuje
   **2 dokumenty** (`V-30-tab-Documents.png`). Zgłaszam, bo o włos nie wpisałem produktowi cudzego defektu.
2. Mój pierwszy probe Teresy (`POST` z polem `messages`) dał **400 walidacji** — to był błąd
   kształtu żądania po mojej stronie, nie defekt produktu. Poprawne pole to `message`.

## WERYFIKACJA DEFEKTÓW WAŻNYCH (próbka najcięższych)

| # | teza | mój pomiar | werdykt |
|---|---|---|---|
| W3 | Eksport dokumentu 403 + polski komunikat | Każdy z 3 przycisków osobno: `Markdown` → **403 GET …/export/markdown**, `DOCX` → **403 …/export/docx**, `PDF` → **403 …/export/pdf**. **Żaden plik się nie pobrał** (`download=BRAK` 3/3). Modal miesza języki dosłownie: „**Access required** / **Ta funkcja jest czasowo wyłączona dla triala.** / All limits removed instantly after upgrade / Close / **Skontaktuj się z zespołem**" | **POTWIERDZONY** (3/3), łamanie DEC-461 |
| W10 | Wyszukiwarka notatek ślepa na treść | `Warsaw` (tytuł) → wynik. `dunning`, `Peppol` → **ekran pusty**. Dowód, że słowa SĄ w treści: `GET /api/v8/my-work/notebook/pages/<id>` — `dunning: true`, `Peppol: true` (notatka ~1989 słów) | **POTWIERDZONY** (3/3) |
| W11 | Kebab „Team Chat" robi coś innego i destrukcyjnego | Kliknięcie na pomyśle o `stage=seed` → **`POST /api/my-work/my-ideas/84b0c84c…/convert`** → `stage` **seed → promoted**. Żaden czat się nie otworzył, **zero pytania o potwierdzenie, zero toastu**, adres bez zmian | **POTWIERDZONY** — etykieta nie odpowiada akcji, akcja zmienia stan obiektu bezpowrotnie i po cichu |
| W1/W2 | Polski pasek formatowania + polski dialog tabeli | Widziane własnymi zrzutami: pasek `Tekst H1 H2 H3 • Lista 1. Lista B I U S Highlight … Wyróżnienie Cytat Wykres **Tabela** KPI Ryzyka Roadmapa Obraz Find Replace`; dialog „**Tabela: nagłówki w pierwszym wierszu; pola oddziel |, wiersze oddziel ;**", wartość domyślna „Metryka\|Wartość;Postęp\|72%", przycisk „**Zastosuj**" obok „Cancel" | **POTWIERDZONE** (`V-45`, `V-50`) |
| D3 | Nagłówek kolumny „PRESENTATION" na liście dokumentów | Materials → zakładka Documents (ścieżka `Materials > Documents`, TYPE=Document ×2): pierwsza kolumna nazywa się **PRESENTATION** | **POTWIERDZONY** (`V-30-tab-Documents.png`) |

## LUKA POPRZEDNIKA ZAMKNIĘTA (jego punkt 6 „nie kliknięte z braku czasu")
Menu `/` w edytorze notatki — **4 brakujące pozycje kliknięte pojedynczo, wszystkie działają**:

| pozycja | efekt | dowód |
|---|---|---|
| Warning (callout) | wstawia blok, DOM +137 znaków, zero błędów | `V-81-slash-Warning.png` |
| Toggle (sekcja zwijana) | wstawia blok, DOM +191 | `V-81-slash-Toggle.png` |
| Date | wstawia **„September 13, 2026"** (po angielsku, poprawnie) | `V-81-slash-Date.png` |
| 2 Columns | wstawia układ dwukolumnowy, DOM +636 | `V-81-slash-2Columns.png` |

**Wniosek: w tej grupie nie ma martwych przycisków.** Przy okazji potwierdzony ślad `@Order`
w treści notatki — `@` faktycznie nie otwiera listy obiektów, zostaje surowy tekst (teza poprzednika o braku odnośników stoi).

## STAN KOŃCOWY LICZBOWO (po weryfikacji)

| miara | poprzednik | po mojej weryfikacji |
|---|---|---|
| BLOKERY | 6 | **5** (B5 obalony) |
| z tego zaostrzone | — | **B1** (dotyczy każdej organizacji, nie tylko nowej) |
| defekty WAŻNE sprawdzone wyrywkowo | — | 5/5 potwierdzonych (W1, W2, W3, W10, W11) |
| fałszywe alarmy złapane u siebie | 2 (sam zgłosił) | **2 u mnie** (zakładka Documents, kształt żądania Teresy) |

## ZANIECZYSZCZENIE DANYCH — CO DOŁOŻYŁEM (do posprzątania)
W organizacji QA Fable 13.09 (własna, pusta — **DBR77 i produkcja nietknięte**):
- **1 projekt** `QA verify project` (`90903116-…`) — utworzony, żeby rozstrzygnąć przyczynę B1,
- **1 inicjatywa** `QA verify B1 with project` (`6ec6038f-…`) — dowód, że backend działa z `projectId`,
- **4 tabele testowe** w dokumencie „Board Report" (markery `QAV2MARKER7731`, `AAA`, `CCC`,
  `bez zadnego separatora`) — dowód dla obalenia B5; zostawiam **świadomie**, bo to jedyny
  materialny dowód, że treść tabel przeżywa przeładowanie,
- **2 pomysły przestawione `seed → promoted`** przez kliknięcie „Team Chat" (dowód W11).
