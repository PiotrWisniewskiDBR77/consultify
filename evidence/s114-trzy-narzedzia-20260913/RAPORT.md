# S1.14 — Idea · Notes · Documents na ŻYWYM stagingu (przeklikanie ręczne)

> ## ⚠️ SPROSTOWANIE PO NIEZALEŻNEJ WERYFIKACJI (sesja 2, 13.09 wieczór)
> Ten raport został sprawdzony drugą ręką na tym samym buildzie `bc40d5327c`.
> Pełny protokół: **`WERYFIKACJA.md`** (obok tego pliku). Trzy rzeczy zmieniają się w treści poniżej:
>
> 1. **B5 (tabela znika po przeładowaniu) — OBALONY.** Tabela wstawiona, zapisana (`PUT …/content` 200)
>    i **przetrwała przeładowanie**; powtórzone 4×, po pełnym reloadzie 5 tabel i wszystkie markery żywe,
>    w obu widokach (Report i Editor). Najpewniejsze wyjaśnienie obserwacji poprzednika: **ciche
>    niepowodzenie samego wstawienia** (u mnie też wystąpiło raz — `Zastosuj` nic nie wstawił i nie
>    pokazał błędu), a nie utrata zapisanych danych. Liczba blokerów: **6 → 5**.
> 2. **B1 — POTWIERDZONY, ale przyczyna jest INNA i POWAŻNIEJSZA.** To nie „nowa organizacja ma 0 projektów".
>    Utworzyłem projekt (`POST /api/projects` → 201) i ścieżka UI **dalej leci 400**, bo front
>    **nigdy nie wysyła `projectId`** (`src/services/conversionService.ts:93`). Defekt dotyczy
>    **każdej** organizacji, także DBR77 z projektami — nie tylko świeżo założonych.
> 3. **B2 — POTWIERDZONY, z ważnym zastrzeżeniem pomiarowym:** blokada jedzie w strumieniu SSE
>    **przy HTTP 200**. Probe patrzący na kod odpowiedzi ogłosi „Teresa działa" (mój pierwszy tak zrobił).
>
> Potwierdzone bez zmian: **B4, B6** oraz próbka defektów ważnych **W1, W2, W3, W10, W11, D3**.
> Zamknięta luka poprzednika: 4 niekliknięte pozycje menu `/` — **wszystkie 4 działają**.


Data: 2026-09-13, 12:55–16:20 UTC+2. Środowisko: `https://staging.consultify.ai`.
Przeglądarka: Playwright/Chromium headless, 1440×900, `locale=en-US`, motyw z przełącznika
w profilu (NIE `emulateMedia`).

Konto testowe (założone przez `POST /api/auth/register`):
`qa.fable.20260913@dbr77.com`, organizacja **QA Fable 13.09**
`orgId=3af18124-275e-484c-8ca1-b512915423c9`, `userId=90503616-c8bb-46d0-b5d9-552c24f5b060`.
Hasło: `/Users/piotrwisniewski/Developer/consultify-secrets/qa-fable-20260913.txt` (chmod 600).
Organizacja DBR77 **nietknięta** — zero logowań, zero zapisów.

**Zmiana wdrożenia w trakcie testu:** o **13:30 UTC** `/api/health.gitSha` zmienił się
`60051310d7040451df9e3f366c2c6c83e7a2519f` → `bc40d5327c6cf133f8cfd2b0e68a5295fb782189`.
Bloker B1 sprawdzony i powtórzony na OBU buildach.

**Pułapka z pamięci, która NIE wystąpiła:** organizacja NIE była „martwa od rejestracji" —
flagi V8 zasiane poprawnie, `/api/v8/*` odpowiada 200, listy modułów renderują się bez banera
degradacji. Rejestracja + logowanie bez weryfikacji e-mail: OK.

---

## STATYSTYKA

| miara | wartość |
|---|---|
| ekranów zinwentaryzowanych | 9 (lista Idea, preview Idea, warsztat Mind Map, kebab Idea, lista Notatnik, edytor Notatki, start Document Studio, edytor Dokumentu, lista Materials/Documents) |
| klikalnych elementów wypisanych łącznie | **≈ 370** (z tego ~90 globalna powłoka powtarzalna) |
| przycisków klikniętych pojedynczo | **112** |
| przycisków martwych / bez efektu / kończących się cichym błędem | **19** |
| przycisków wyszarzonych z komunikatem deweloperskim | **7** |
| zadań „niełatwych" (3 na narzędzie) | 9 → **5 ZALICZONE, 1 CZĘŚCIOWO, 3 NIE** (po weryfikacji: Documents Z2 podniesione) |
| defektów | **5 BLOKERÓW · 20 WAŻNYCH · 16 DROBNYCH = 41** (po weryfikacji sesji 2: B5 zszedł z BLOKERA do DROBNYCH) |
| zrzutów dowodowych | 148 (`zrzuty/`) |
| plików pobranych i otwartych | 3 (`pobrane/`) |
| żądań 4xx/5xx zarejestrowanych | 400 ×5, 403 ×8, 404 ×3, 409 ×5 |

**Werdykt per narzędzie (PO WERYFIKACJI sesji 2): Idea — 1 BLOKER (+3 wspólne), Notes — 1 BLOKER (+3 wspólne),
Documents — 0 BLOKERÓW własnych (+3 wspólne; B5 obalony).** Trzy blokery (B2–B4) są wspólne dla całej aplikacji:
Teresa nie działa dla nowej organizacji i nie ma sposobu, żeby to odblokować z UI.

---

## TABELA DEFEKTÓW

| # | narzędzie | ekran / przycisk | co robi vs co powinien | waga | dowód | powtarzalność |
|---|---|---|---|---|---|---|
| B1 | Idea | preview → CREATE: `Initiative`, `Report`, `Presentation`, `Financial Model`, `Budget`, `Valuation`, `Financial Analysis` (7 przycisków) + kebab `Initiative` | Po „Confirm & create" popover znika i **nic się nie dzieje**. Powinna powstać inicjatywa/artefakt. W rzeczywistości: `POST /api/tools` 200 (osierocona sesja), `POST /api/initiatives` **400**, `PAGEERROR: Error: projectId is required — every initiative must belong to a project`. Nowa organizacja ma **0 projektów** (`GET /api/projects` → `[]`), więc ścieżka Idea→Inicjatywa jest martwa dla każdej nowej organizacji. **Zero komunikatu dla użytkownika.** | **BLOKER** | `zrzuty/I-30-po-promote.png`, `I-31-po-confirm.png`; `400 POST /api/initiatives`; konsola: `projectId is required` | 5/5 (Initiative, Report, Presentation, Financial Model, Budget), na buildach 60051310d7 **i** bc40d5327c |
| B2 | wspólne (Idea/Notes/Documents) | Teresa (czat AI) — panel boczny i `/chat` | Każde pytanie → `⚠️ Access blocked (TRIAL_PROFILE_INCOMPLETE)`. Przyczyna zmierzona w kodzie: `accessPolicyService.ts:400-417` daje **3 darmowe wywołania AI** przed wymuszeniem setupu; edytor Notatnika sam z siebie wysyła `POST /api/ai/chat/stream` przy pisaniu (bez prośby użytkownika) i **zużywa limit, zanim użytkownik zada pierwsze pytanie**. | **BLOKER** | `zrzuty/T-01-odpowiedz.png`, `T-10-teresa-panel-idea.png`; `Stream error from server: … TRIAL_PROFILE_INCOMPLETE`; `bag.req` z edytora notatki pokazuje `POST /api/ai/chat/stream` | 3/3 |
| B3 | wspólne | modal „Access required" → CTA **Complete Setup** → `/setup/organization` | Kreator nazywa się „Create a space for your team" i **tworzy DRUGĄ organizację** (`POST /api/organizations` → `c56e8bd5-3295-4366-b150-72e978fb8f18`, ta sama nazwa „QA Fable 13.09"), zamiast domknąć setup bieżącej. Po jego przejściu Teresa **nadal** blokowana. | **BLOKER** | `zrzuty/T-03-setup-wizard.png`, `T-05-po-setup.png`; `POST /api/organizations`, `PUT /api/organizations/c56e8bd5…`; retest Teresy po setupie → ten sam blok | 1/1 (nie powtarzam — tworzy kolejne organizacje) |
| B4 | wspólne | `/setup/onboarding` → **Generate My Strategy** | `POST /api/onboarding/context` → **404 `API_ROUTE_NOT_FOUND`**. Trasa nie istnieje w `server/src` (grep: wołacze tylko w `src/services/api.ts:10558` i `src/services/api/users.api.ts:95`, zero definicji serwerowej). Onboarding, który jako jedyny mógłby ustawić `onboarding_status='ORG_SETUP_COMPLETED'`, **nie da się dokończyć**. | **BLOKER** | `zrzuty/T-09-po-onboarding.png`; `404 POST /api/onboarding/context`; konsola `ApiError: The requested API endpoint does not exist` | 1/1 |
| ~~B5~~ | Documents | edytor + Wstaw: Tabela | **OBALONE W WERYFIKACJI (sesja 2) - NIE NAPRAWIAC NA TEJ PODSTAWIE.** Ponowny pomiar: tabela wstawiona, PUT .../content 200, **po przeladowaniu obecna**; 4 powtorzenia, po pelnym reloadzie 5 tabel, markery QAV2MARKER7731 / AAA / CCC zywe w widoku Report i Editor. Zostaje realny, mniejszy defekt: **przycisk Zastosuj potrafi nic nie wstawic bez zadnego komunikatu**. Oryginalna teza: tabela znika po przeladowaniu (utrata danych). | ~~BLOKER~~ -> **DROBNY (cicha porazka operacji)** | zrzuty/V-51-wstawiona.png, V-52-po-reload.png, V-56-persist-final.png; WERYFIKACJA.md | **0/5 - nie udalo sie odtworzyc** |
| B6 | Notes | menu notatki → **Version history** | Zawsze „No saved versions yet" mimo ~1000 słów edycji i dziesiątek `PUT`. `GET /api/v8/notebook/pages/:id/versions` → `{"data":[],"count":0}`. **W całym `src/` nie ma ani jednego wołacza `POST …/versions`** — jest tylko GET (`NotebookVersionHistory.tsx:103`) i `POST …/versions/:vid/restore` (linia 137). Backend `server/src/routes/v8/notebookVersions.routes.ts:7` deklaruje POST, ale front go nigdy nie woła → wersje nie powstają nigdy, „Restore" jest nieosiągalne. | **BLOKER** (wymóg „wersje/historia") | `zrzuty/N-M-Version_history.png`; odpowiedź API; grep bez wołacza | 2/2 |
| W1 | Documents | pasek formatowania edytora (16 etykiet) | Po **polsku** w angielskim UI: `Tekst`, `Nagłówek 1/2/3`, `Lista punktowana`, `Lista numerowana`, `Pogrubienie (Ctrl/Cmd+B)`, `Kursywa`, `Wyrównaj: do lewej/wyśrodkuj/do prawej`, `Wstaw: Wyróżnienie/Cytat/Wykres/Tabela/KPI/Ryzyka/Roadmapa/Obraz` — obok angielskich `Highlight`, `Link`, `Find`, `Replace`. DEC-461. | WAŻNY | `zrzuty/D-05-editor.png` (widoczne w pasku: Tekst, Lista, Wyróżnienie, Cytat, Wykres, Tabela, Ryzyka, Roadmapa, Obraz) | 3/3 |
| W2 | Documents | dialog wstawiania tabeli | Cały po polsku: tytuł „Tabela: nagłówki w pierwszym wierszu; pola oddziel \|, wiersze oddziel ;", wartość domyślna „Metryka\|Wartość;Postęp\|72%", przycisk „**Zastosuj**" obok angielskiego „Cancel". Dodatkowo: tabela wstawiana przez składnię `\|` i `;` w polu tekstowym, nie przez interfejs tabeli. | WAŻNY | `zrzuty/D-07-tabela.png` | 2/2 |
| W3 | Documents | `Markdown`, `DOCX`, `PDF`, `Export DOCX`, `Share` | Wszystkie **403 `TRIAL_EXPORT_DISABLED`**. Komunikat pokazany użytkownikowi jest **po polsku**: modal „Access required / Ta funkcja jest czasowo wyłączona dla triala." + CTA „**Skontaktuj się z zespołem**" (crimsonowy przycisk). Baner miesza języki: „Ta funkcja jest czasowo wyłączona dla triala. Try again. If the problem continues, report it using the identifier below." — **a żadnego identyfikatora pod spodem nie ma**. Serwer zwraca `messageEn`, ale UI bierze polskie `message`. Niespójność polityki: eksport TEJ SAMEJ treści z Notatnika działa bez ograniczeń. | WAŻNY | `zrzuty/D-12-docx-403.png`; body 403 z `messageEn` | 5/5 (md, docx, pdf, Export DOCX, Share) |
| W4 | Idea | prawy panel artefaktu (nagłówek + Label) | Nagłówek panelu „**Element bez nazwy**" — polski string w EN UI. Klucz `myWork.ideaInspector.untitledElement` **nie istnieje ani w `public/locales/en`, ani w `pl`** → działa hardkodowany polski default z `IdeaElementInspector.tsx:465/568/926`. Obok: pole `Label` pokazuje surowy identyfikator `node-1789305145796-e18cf3` zamiast etykiety. | WAŻNY | `zrzuty/I-17-mapa-12-wezlow.png`; grep kluczy i18n | 2/2 |
| W5 | Documents | wygenerowany dokument (Board Report) | Treść zawiera **surowe encje HTML** renderowane dosłownie: `plant&#x27;s`, `&quot;For Information&quot;` (3+ miejsca) oraz **niewypełnione szablony**: „This section is awaiting content — &quot;For Information&quot;." (sekcja 3), 6× „(assumption)" zamiast liczb w sekcji 4, „Risk 1 / Risk 2 / TBD / Mitigation plan TBD" w tabeli ryzyk, terminy „November 15, **2023**", „January 31, **2024**" w dokumencie datowanym 13 September **2026**. | WAŻNY | `zrzuty/D-18-encja.png`, `D-04-wygenerowany.png` | 1/1 (jeden wygenerowany dokument) |
| W6 | Idea | More tools → **Embed externally** | Toast „Embed code copied!", w schowku `<iframe src="https://staging.consultify.ai/embed/idea/<id>" …>`. Trasa `/embed/idea/:id` **nie istnieje** — w przeglądarce „Page not found". W kodzie string budujący URL jest jedynym wystąpieniem (`useMindMapQuickActions.ts:1347`), brak routingu. Funkcja-fantom z komunikatem sukcesu. | WAŻNY | `zrzuty/I-MT2-Embed_externally.png`, `I-EMBED.png`; zawartość schowka | 2/2 |
| W7 | Idea | More tools → **Share** | Kopiuje wyłącznie wewnętrzny adres warsztatu. Otwarcie go w kontekście anonimowym → przekierowanie na `/login?redirect=…`. Brak okna udostępniania, brak nadania uprawnień, brak publicznego tokenu. Dla MVP „udostępnianie mapy" nie istnieje. | WAŻNY | `zrzuty/I-SHARE-ANON.png`; URL po przekierowaniu | 2/2 |
| W8 | Notes | menu notatki → **Share** | Otwiera klienta pocztowego (`mailto:`), toast „Email client opened". Brak udostępniania w aplikacji, brak uprawnień, brak linku. | WAŻNY | `zrzuty/N-M-Share.png` | 2/2 |
| W9 | Notes | menu notatki → CONVERT TO: `Initiative`, `Task`, `Decision` | Wyszarzone, pod każdym komunikat deweloperski pokazany użytkownikowi: „**Unavailable until the server can return a durable action receipt**". Trzy z siedmiu konwersji martwe. | WAŻNY | `zrzuty/N-12-note-menu.png` | 3/3 |
| W10 | Notes | „Search notes…" w bibliotece notatnika | Szuka **tylko po tytule**. `Warsaw` (w tytule) → trafienie. `Peppol`, `dunning` (w treści, obecne w notatce) → lista pusta z ekranem pierwszego uruchomienia „**No pages yet / Create your first page**" zamiast „brak wyników". Dodatkowo licznik nagłówka pokazuje „**0 pages**", a chip obok „All (**1**)". | WAŻNY | `zrzuty/N-18-search-Warsaw.png` vs `N-18-search-dunning.png` | 3/3 |
| W11 | Idea | kebab wiersza → **Team Chat** | Nie otwiera żadnego czatu zespołowego. Wysyła `POST /api/my-work/my-ideas/:id/convert`, toast „Done" i **zmienia etap pomysłu Spark → Promoted**. Etykieta nie odpowiada akcji, a akcja jest destrukcyjna (zmienia stan obiektu bez potwierdzenia). | WAŻNY | `zrzuty/K-Team_Chat.png` (kolumna Stage „Promoted", licznik „Promoted 1") | 1/1 |
| W12 | Idea | warsztat → **Undo / Redo** | Trwale wyszarzone. Po przesunięciu węzła (pozycja 304,448 → 464,328, zapisana), po zmianie nazwy i po skasowaniu 3 węzłów **Undo nadal `disabled`**. Jednocześnie dialog kasowania ostrzega „This cannot be undone after sync." — czyli cofania nie ma w ogóle. | WAŻNY | `zrzuty/I-23-po-drag.png`, `I-24-po-undo.png`; `Undo disabled? true` | 3/3 |
| W13 | Idea | warsztat → dodawanie węzłów (Tab) + zmiana nazwy (F2) | Przy szybkiej serii (11 węzłów) **5× `409 POST /api/my-work/my-ideas/:id/map/sync`** w sesji JEDNEGO użytkownika (klient ściga się z własnym autozapisem) i część nazw ginie — węzły zostają jako „Click to type…". Użytkownik nie widzi żadnego komunikatu. Zmiana nazwy przez zaznaczenie + przycisk `Rename (F2)` z paska działa niezawodnie (3/3 przetrwały reload). | WAŻNY | log `NET: 409 ×5`; `zrzuty/I-17-mapa-12-wezlow.png` (kilkanaście węzłów „Click to type…") | 1 seria, 5 wystąpień |
| W14 | Documents | ekran startowy → kafel **From a template** | Prowadzi na ekran zatytułowany „**Generate without template**" z listą ustawioną na „No template — Mode 1 (free generation)". Wybór trybu z kafla jest ignorowany — trzeba ręcznie wybrać szablon z 44-pozycyjnej listy. | WAŻNY | `zrzuty/D-02-from-template.png` | 2/2 |
| W15 | Documents | generacja → pole **Language** | Domyślna wartość `pl` („Polish") w angielskim interfejsie. Zgodnie z DEC-461 domyślny język musi być angielski. | WAŻNY | odczyt `select.value === 'pl'`; `zrzuty/D-02-from-template.png` | 2/2 |
| W16 | Notes | menu notatki → Report → **Create deliverable** | `POST /api/v8/my-work/notebook/pages/:id/convert` kończy się 200 i dokument **naprawdę powstaje** (widoczny w Materials → Documents), ale UI nie pokazuje toastu, nie nawiguje do niego i nie daje linku. Użytkownik nie wie, że coś się stało. | WAŻNY | `zrzuty/N-19-report-utworzony.png` (bez zmian) vs `N-20-materials-po-convert.png` (2 dokumenty) | 1/1 |
| W17 | Idea | warsztat → prawy panel po zmianie nazwy węzła | Toast „Renamed", węzeł na płótnie ma nową nazwę, a nagłówek panelu i pole `Label` **nadal pokazują starą** („New idea"). | WAŻNY | `zrzuty/I-16-po-rename.png` | 2/2 |
| W18 | Idea | lewy rail → **Present** | Tryb prezentacji nie zajmuje ekranu: lewy rail narzędzi i prawy panel accordion zostają na wierzchu i zasłaniają slajd; kontrolka „Previous" jest ucięta dolną krawędzią. Etykiety gałęzi („Problem (4)", „Risks (1)") i ikona są crimsonowe — czerwień poza semantyką krytyczną. | WAŻNY | `zrzuty/I-R-Present.png` | 1/1 |
| W19 | Idea | warsztat → **Process Flow** | Lewy rail narzędzi nachodzi na pasek „End / Insert / Split / More" (przycisk „End" wpół zasłonięty) i na etykietę toru („…rocess"). | WAŻNY | `zrzuty/I-TOOL-Process_Flow.png` | 2/2 |
| W20 | Idea | warsztat → prawy panel, 3 przyciski przy „Drill down / AI summary / AI advice" | Trwale wyszarzone, `title="This action is waiting for its scope to be defined"` — tekst deweloperski w produkcie. | WAŻNY | inwentarz `I-12`; `zrzuty/I-12-workspace-mindmap.png` | 3/3 |
| D1 | Notes | Expand into document → nagłówek Canvasa | Polska typografia w EN: `Source: note „Order-to-Cash Diagnostic - Warsaw Plant"` (cudzysłów dolny/otwierający). | DROBNY | `zrzuty/N-M-Expand_into_document.png` | 1/1 |
| D2 | Notes | toast klasyfikatora | „This note looks like **decision**. Convert?" — brak przedimka, zdanie niegramatyczne. | DROBNY | `zrzuty/N-18-search-dunning.png` | 2/2 |
| D3 | Documents | Materials → zakładka Documents | Nagłówek pierwszej kolumny brzmi „**PRESENTATION**" mimo że lista pokazuje dokumenty. | DROBNY | `zrzuty/D-17-materials-documents2.png` | 2/2 |
| D4 | Idea | lista + preview | Data w tabeli `13/09/2026` (DD/MM), w preview i panelu `9/13/2026` / `9/13/2026 08:06 AM` (MM/DD) — dwa formaty w jednej parze ekranów, żaden nie jest jednoznaczny dla EN. | DROBNY | `zrzuty/I-10-lista-z-ideą.png`, `I-11-po-single-click.png` | 2/2 |
| D5 | Idea | dialog „New Idea" → Start | Przed zapisaniem pomysłu leci `GET /api/my-work/my-ideas/new-idea-1789304805478/conversions` → **404** (żądanie o tymczasowy, nieistniejący identyfikator). | DROBNY | log `404 GET …/new-idea-…/conversions` | 2/2 |
| D6 | Idea | „Blank canvas" | Nie jest pusty — zasiewa 5 gałęzi (Problem / Options / Evidence / Risks / Experiments). Opis kafla mówi „Open a calm workspace with your chosen starting system", ale nazwa „Blank" myli. | DROBNY | `zrzuty/I-12-workspace-mindmap.png` | 1/1 |
| D7 | Idea | węzły mapy | Każdy węzeł ma niewyjaśnioną crimsonową kropkę w prawym górnym rogu (bez legendy, bez tooltipa). Czerwień poza semantyką krytyczną. | DROBNY | `zrzuty/I-12-workspace-mindmap.png` | 3/3 |
| D8 | Idea | lewy rail → **Comments** | Jedyny przycisk railu bez widocznego efektu (DOM +90 znaków — rozwija sekcję COMMENTS poniżej widocznego obszaru prawego panelu). Użytkownik widzi „nic". | DROBNY | `zrzuty/I-R-Comments.png` | 2/2 |
| D9 | Documents | Menu 1 + treść raportu | Tekst deweloperski w produkcie: „**Modes 1, 2, 3 · Word/PDF artifact runtime**" w prawym rogu Menu 1; surowa etykieta bloku „**KEY_MESSAGE**" wyrenderowana w dokumencie. | DROBNY | `zrzuty/D-01-lista.png`, `D-04-wygenerowany.png` | 3/3 |
| D10 | Documents | kebab wiersza w Materials | Pozycja trwale wyszarzona: „**Deleting is not available yet**". Niezaimplementowana funkcja wystawiona jako martwa pozycja menu. | DROBNY | inwentarz `DOCS KEBAB`; `zrzuty/K-3-documents-kebab.png` | 1/1 |
| D11 | Idea + Notes | kebab wiersza | Łamie §6.4 kanonu. Notatnik: tylko 4 pozycje (Open / Open preview / Edit / Delete) — brak Zmień nazwę, Powiel, Eksport, Udostępnij, Kopiuj link, Archiwizuj, AI. Idea: 13 pozycji, ale w złej kolejności — Podgląd i Edytuj **na końcu**, po blokach konwersji; brak Zmień nazwę/Powiel/Eksport/Kopiuj link/Archiwizuj; jedna pozycja wyszarzona („No folder"). | DROBNY | `zrzuty/K-1-ideas-kebab.png`, `K-2-notebook-kebab.png` | 2/2 |
| D12 | Idea | Version History + kasowanie węzła | Dialog potwierdzenia „Delete nodes?" otwiera się **na wierzchu** otwartego modala Version History (dwa modale jeden na drugim, dolny nadal aktywny wizualnie). | DROBNY | `zrzuty/I-SNAP-5-lista.png` | 1/1 |
| D13 | Notes | panel Connection graph | Nagłówek „Connection graph" zdublowany (nagłówek panelu + nagłówek sekcji). | DROBNY | `zrzuty/N-M-Connection_graph.png` | 2/2 |
| D14 | Idea | liczniki gałęzi mapy | Rozjeżdżają się ze stanem: „Evidence 0 nodes" mimo dzieci, „Risks 1 node" przy dwóch dzieciach. | DROBNY | log `NODES` po reloadzie; `zrzuty/I-18-po-reload.png` | 2/2 |
| D15 | Idea | kebab → **AI Chat** / **AI Insights** | Otwierają panel Teresy z poprawnym chipem kontekstu „AI sees: Idea: Order-to-Cash Diagnostic - Warsaw Plant" (mechanika kontekstu **jest**), ale każde pytanie kończy się blokadą z B2. Funkcja niedostępna mimo poprawnego przygotowania. | DROBNY (skutek B2) | `zrzuty/K-AI_Chat.png`, `T-10-teresa-panel-idea.png` | 2/2 |

---

## TABELA ZADAŃ (3 × narzędzie)

| narzędzie | zadanie | wynik | zrzut |
|---|---|---|---|
| **Idea** | **Z1.** Mapa myśli 3 poziomów, 12+ węzłów, przesunięcie węzła, zmiana nazwy, odtworzenie po przeładowaniu | **CZĘŚCIOWO** — zbudowano 33 węzły na 3+ poziomach, wszystkie przetrwały reload; drag (304,448→464,328) i zmiana nazwy przez pasek przetrwały reload. Ale szybka seria Tab+F2 gubi nazwy i generuje 5× 409 (W13), a Undo/Redo nie działa (W12) | `I-17`, `I-18`, `I-22`, `I-23` |
| **Idea** | **Z2.** Snapshot → skasowanie 9 węzłów → przywrócenie wersji | **ZALICZONE** — „Baseline 13 nodes" zapisany (`POST …/map/snapshots`), 33→23 węzły po kasowaniu, Restore przywrócił **23→33** | `I-SNAP-4`, `I-SNAP-6`, `I-SNAP-8` |
| **Idea** | **Z3.** Przełączenie narzędzia (Table / Process Flow / Whiteboard) na tym samym pomyśle + promocja do Inicjatywy | **NIE** — przełączanie narzędzi działa (wspólny graf widoczny jako 34 wiersze w Idea Table, jako kroki w Process Flow), ale promocja do Inicjatywy = **BLOKER B1** | `I-TOOL-Table`, `I-TOOL-Process_Flow`, `I-31` |
| **Notes** | **Z1.** Notatka z nagłówkami i listami, sprawdzenie po przeładowaniu | **ZALICZONE** — **1005 słów**, 9 nagłówków H2, 9 pozycji list; po reloadzie **1005 słów** bez utraty (cel 1500 nie osiągnięty — świadome skrócenie, żeby zmieścić się w czasie) | `N-11`, `N-12` |
| **Notes** | **Z2.** Eksport do pliku i otwarcie pliku (czy nie jest pusty) | **ZALICZONE** — `.md` 6 361 B (pełny tekst, nagłówki `##`, listy `-`), `.pdf` 105 499 B / **2 strony pełnego, sformatowanego tekstu** (otwarte i obejrzane), `.docx` 10 431 B / **30 runów tekstu** w `word/document.xml` | `pobrane/Order-to-Cash-Diagnostic-Warsaw-Plant.{md,pdf,docx}` |
| **Notes** | **Z3.** Wersje/historia + wyszukiwanie + wstawienie odnośnika do inicjatywy/spotkania | **NIE** — wersje nie powstają nigdy (**B6**); wyszukiwarka ślepa na treść (**W10**); `@` w edytorze **nie otwiera żadnej listy** obiektów — nie ma sposobu wstawienia odnośnika do inicjatywy ani spotkania (menu `/` ma 24 pozycje, żadna nie linkuje do istniejącego obiektu) | `N-M-Version_history`, `N-18-search-dunning`, `N-14-at-mention` |
| **Documents** | **Z1.** Dokument z szablonu (plan → generacja, 7 sekcji) | **ZALICZONE z zastrzeżeniami** — plan 7 sekcji i pełna generacja treści po angielsku, artefakt `artifact-398b1e53…` widoczny w Materials. Zastrzeżenia: encje HTML i placeholdery (**W5**), kafel „From a template" nie wybiera szablonu (**W14**) | `D-03-plan`, `D-04-wygenerowany`, `D-18-encja` |
| **Documents** | **Z2.** Edycja 5 sekcji + wstawienie tabeli + zapis | **ZALICZONE** (podniesione z CZĘŚCIOWO po weryfikacji sesji 2) — 5 edycji (`[QA EDIT 1..5]`) zapisane przez `PUT …/content` i **wszystkie 5 przetrwały reload**; tabela wstawiona i **przetrwała reload** (B5 obalony w sesji 2 — patrz WERYFIKACJA.md), wiec zadanie **ZALICZONE** | `D-06-po-edycjach`, `D-09-tabela-wstawiona`, `D-11-po-reload-editor` |
| **Documents** | **Z3.** Eksport do pliku (DOCX/PDF) + otwarcie pliku + udostępnienie/uprawnienia | **NIE** — wszystkie 5 ścieżek (`Markdown`, `DOCX`, `PDF`, `Export DOCX`, `Share`) kończą się **403 TRIAL_EXPORT_DISABLED** z polskim komunikatem (**W3**). Żaden plik się nie pobrał, uprawnień nie da się sprawdzić | `D-12-docx-403`, `D-B-Share` |

---

## TABELA INWENTARZA PRZYCISKÓW

„działa" = kliknięcie dało nawigację, dialog, menu lub zapis; „martwy/cichy" = brak jakiegokolwiek
efektu albo 4xx bez komunikatu; „wyszarzony" = `disabled` z komunikatem deweloperskim.

| ekran | klikalnych | kliknięte pojedynczo | działa | martwy / cichy błąd | wyszarzony |
|---|---|---|---|---|---|
| Idea — lista `/my-work/ideas` (Menu 1+2+3, tabela, pstryczek widoku, filtry) | 45 (w tym 19 globalnej powłoki) | 26 | 26 | 0 | 0 |
| Idea — preview wiersza (single-click) | 22 | 22 | 15 | **7** (CREATE: Initiative/Report/Presentation/Financial Model/Budget/Valuation/Financial Analysis → B1) | 0 |
| Idea — kebab wiersza | 13 | 13 | 11 | **1** (Team Chat robi coś innego — W11) | 1 („No folder") |
| Idea — warsztat Mind Map (Menu 1/3, lewy rail 12, dolny pasek, prawy panel 6 sekcji) | 96 | 24 | 20 | **1** (Comments bez efektu — D8) | **3** („waiting for its scope") + Undo + Redo |
| Idea — paleta „More tools" | 14 | 11 | 9 | **2** (Share bez realnego udostępniania W7, Embed → 404 W6) | 0 |
| Notes — lista notatników | 46 (19 powłoki) | 14 | 14 | 0 | 0 |
| Notes — edytor notatki (Menu 1/2, rail, panel) | 58 | 12 | 11 | 0 | **1** (Capture) |
| Notes — menu notatki (kebab artefaktu) | 22 | 13 | 10 | **1** (Create deliverable bez informacji zwrotnej W16) | **3** (Initiative/Task/Decision — W9) |
| Notes — menu `/` w edytorze | 24 | 3 | 3 (Create Task i Save as Idea utworzyły realne obiekty) | 0 | 0 |
| Documents — ekran startowy + Menu 1 | 36 | 8 | 7 | **1** („From a template" → ekran bez szablonu, W14) | 1 (Generate) |
| Documents — edytor (pasek 40+, outline, prawy rail 5 ikon, Menu 1) | 93 | 14 | 9 | **5** (Markdown/DOCX/PDF/Export DOCX/Share → 403, W3) | Undo, Redo, „Open in Sheets Builder" |
| Documents — lista Materials + kebab | 41 | 10 | 9 | 0 | 1 („Deleting is not available yet") |
| **RAZEM** | **≈ 370** (≈ 280 unikatowych) | **112** | **93** | **19** | **7 + 5 stale wyszarzonych Undo/Redo/Sheets** |

---

## POŁĄCZENIE Z RESZTĄ APLIKACJI (punkt 3 zadania)

| ścieżka | wynik | dowód |
|---|---|---|
| Idea → Idea Table / Process Flow / Whiteboard (ten sam graf) | **DZIAŁA** — 34 wiersze w tabeli = węzły mapy; Process Flow „Steps 33, Lanes 1" | `I-TOOL-Table`, `I-TOOL-Process_Flow` |
| Idea → Moja praca / lista pomysłów po przeładowaniu | **DZIAŁA** — 2 pomysły, etap, narzędzie, data | `I-10`, `N-15` |
| Idea → Inicjatywa (i 6 innych artefaktów) | **NIE DZIAŁA** — B1 | `I-31` |
| Notatka → Zadanie (`/` → Create Task) | **DZIAŁA** — zadanie „Order-to-Cash Diagnostic - Warsaw Plant" widoczne w My Work → Tasks (To Do, Medium, QA Fable) | log `TASKS` |
| Notatka → Pomysł (`/` → Save as Idea) | **DZIAŁA** — pomysł widoczny w My Work → Ideas (ALL 2) | log `IDEAS` |
| Notatka → Raport (menu → Report → Create deliverable) | **DZIAŁA MECHANICZNIE, MILCZY W UI** — dokument powstał i jest w Materials → Documents (2 pozycje), ale użytkownik nie dostaje ani toastu, ani linku (W16) | `N-20` |
| Notatka → Canvas (Expand into document) | **DZIAŁA** — pełna treść przeniesiona do edytora Canvas w AI Chat, ze wskazaniem źródła | `N-M-Expand_into_document` |
| Notatka → graf powiązań (Connection graph) | **DZIAŁA (pusty)** — `GET /api/my-work/link-graph/backlinks` 200, „No topics or backlinks for this note yet" | `N-M-Connection_graph` |
| Dokument → Materials / Documents | **DZIAŁA** — „Board Report" i „Order-to-Cash Diagnostic - Warsaw Plant" na liście, z właścicielem i widocznością | `D-17` |
| **Teresa widzi notatkę / dokument jako źródło** | **NIE DA SIĘ SPRAWDZIĆ** — kontekst jest przygotowany poprawnie (chip „AI sees: Idea: …"), ale KAŻDE pytanie kończy się `Access blocked (TRIAL_PROFILE_INCOMPLETE)`; jedyna oferowana ścieżka odblokowania jest zepsuta (B3+B4) | `T-01`, `T-10`, `T-05`, `T-09` |
| Link z inicjatywy → narzędzie i z powrotem | **NIE DA SIĘ SPRAWDZIĆ** — nie da się utworzyć żadnej inicjatywy (B1) | — |
| Wstawienie odnośnika do inicjatywy/spotkania w notatce | **NIE ISTNIEJE** — `@` nie otwiera listy obiektów; menu `/` (24 pozycje) nie ma pozycji linkującej do istniejącego obiektu | `N-14-at-mention` |

---

## MOTYW CIEMNY

Przełączony przyciskiem **Dark** w menu profilu (`html.dark`, NIE `emulateMedia`).
Bez rażących defektów kontrastu na trzech głównych ekranach; wszystkie napisy czytelne.

| narzędzie | zrzut | uwagi |
|---|---|---|
| Idea — warsztat Mind Map | `zrzuty/DARK-1-idea-mindmap.png` | poprawny; kolory gałęzi zachowane |
| Notes — edytor notatki | `zrzuty/DARK-2-notes.png` | poprawny |
| Documents — Board Report | `zrzuty/DARK-3-document.png` | poprawny; CTA „Share" odwrócony neutralny (zgodnie z kanonem) |

---

## CZEGO NIE DAŁO SIĘ KLIKNĄĆ I DLACZEGO (uczciwie)

1. **Teresa — wszystkie pytania.** Zablokowana przez B2–B4. Nie obchodziłem blokady zapisem
   `onboarding_status` w bazie, bo to zatarłoby dowód; zamiast tego przeszedłem oferowaną ścieżkę
   UI i udokumentowałem, że jest zepsuta.
2. **Eksport i udostępnianie dokumentu** — 403 `TRIAL_EXPORT_DISABLED` (polityka triala, nie awaria).
   Nie podnosiłem typu organizacji w bazie.
3. **Wszystko, co wymaga inicjatywy lub projektu** (link inicjatywa↔notatka, artefakty Execution,
   powrót z inicjatywy do narzędzia) — nie da się utworzyć ani projektu, ani inicjatywy (B1).
4. **Sekcja „Verification & review" i „Sources & attachments"** w menu notatki — otwarte,
   ale bez danych do zweryfikowania (świeża organizacja, zero źródeł); nie oceniam.
5. **„Delete note", „Delete" w kebabach, „Start over"** — pominąłem świadomie, żeby nie skasować
   dowodów w trakcie sesji.
6. **Pozostałe 4 pozycje menu `/` z 24** (Callout, Toggle, 2 Columns, Date) oraz część chipów
   formatowania w edytorze dokumentu — nie kliknięte pojedynczo z braku czasu; nie twierdzę,
   że działają.
7. **Drugi kreator „Generate My Strategy"** — wypełniony i wysłany raz; nie powtarzałem,
   bo pierwszy przebieg utworzył już duplikat organizacji.
8. **Fałszywy alarm, który sam prostuję:** „Share" w Idea raportowałem wstępnie jako
   „Copy failed" — to był artefakt harnessu (brak uprawnienia do schowka w headless).
   Po nadaniu `clipboard-write` Share kopiuje poprawnie; defekt W7 dotyczy czegoś innego
   (kopiuje adres wewnętrzny, nie udostępnia).
9. **Drugi fałszywy alarm:** „Save current state" w Version History mapy wyglądał na martwy
   (zero żądań) — w rzeczywistości otwiera pole nazwy; po wpisaniu nazwy zapis działa.
   Nie jest defektem.

## ZANIECZYSZCZENIE DANYCH (do posprzątania)

W organizacji QA Fable 13.09 zostały: 2 pomysły, 1 notatnik z 1 notatką, 2 dokumenty,
1 zadanie, **5 osieroconych rekordów `POST /api/tools`** (z nieudanych konwersji B1)
oraz **duplikat organizacji `c56e8bd5-3295-4366-b150-72e978fb8f18`** utworzony przez B3.
Organizacja DBR77 i produkcja nietknięte.
