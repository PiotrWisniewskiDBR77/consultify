# Sesja oceny (`assessment-session`) — kontrakt karty N

> Partia P10-B4, pozycja **#21** inwentarza (`INWENTARZ_KART_N_PELNY.md` §2, 04_ASSESSMENT).
> Pomiar na żywo 06.09.2026, worktree `wt-p10b4-ocena`, vite 3111 → API 4100,
> zrzuty `evidence/p10b4/`. Wymogi K1–K30 wg `docs/ssot/KARTA_N_KONTRAKT.md`.

## §0. Tożsamość

| pole | wartość |
|---|---|
| nazwa PL | Sesja oceny |
| moduł | 04_ASSESSMENT (Ocena) |
| archetyp | **D — Matryca** (SPEC-A §13) |
| trasa | `/assessment/:framework/:assessmentId` (`src/routes/AppRoutes.tsx:2297-2300`) |
| jak otworzyć z listy | Ocena → Menu 2 „Procesy" → klik w wiersz (podgląd boczny) → „Otwórz" (zmierzone: `evidence/p10b4/02-sesja-podglad.png` → `03-sesja-drd.png`) |
| komponent | `src/views/AssessmentSessionEditorView.tsx:358` (2907 linii) |
| powłoka dziś | **brak powłoki standardu**; dla DRD widok oddaje cały ekran warsztatowi (`MethodWorkspaceShell`), dla SIRI/ADMA renderuje własny układ |

### §0.1 Rozstrzygnięcie: mnożnik 5 metodyk (decyzja CTO)

Inwentarz liczy „×5 metodyk". Pomiar w kodzie mówi, że **pięć metodyk to trzy różne
ekrany, nie pięć kopii**:

| metodyka | status w rejestrze | co realnie renderuje trasa |
|---|---|---|
| DRD | `available` (`frameworkRegistry.ts:71`) | warsztat metody — patrz `drd-workspace-http.md` (early return `AssessmentSessionEditorView.tsx:1751-1759`) |
| SIRI | `available` (`:87`) | `SIRIAssessmentEditor` (`AssessmentSessionEditorView.tsx:1918`) |
| ADMA | `available` (`:125`) | `ADMAAssessmentEditor` (`:1945`) |
| CMMI | **`coming_soon`** (`:162`) | ekran „Ten framework jest wkrótce dostępny" (`:1800-1820`) — sesji nie da się edytować |
| LEAN | **`coming_soon`** (`:203`) | jw. |

**DECYZJA CTO (do zapisu jako DEC): jeden kontrakt sesji oceny, parametryzowany
metodyką — nie pięć kopii.** Sekcje wspólne (§1) obowiązują każdą metodykę;
różnicę niesie wyłącznie pakiet metody (`pack.manifest`, struktura osi/jednostek/
poziomów) i sekcja „specyficzne dla metodyki". Uzasadnienie pomiarowe: DRD i SIRI
mają wspólny runtime jądra (`method-core`, `drdHttpSessionRuntime.ts` /
`siriHttpSessionRuntime.ts`), a różnią się danymi pakietu, nie kontraktem ekranu.
Koszt pięciu kontraktów = pięć rozjazdów przy każdej zmianie kanonu.

## §1. Sekcje

| sekcja | po co użytkownikowi | źródło danych (API pole → writer) | reguła pustki | kolejność | S/L |
|---|---|---|---|---|---|
| Pasek stanu źródła i zapisu | wie, czy patrzy na dane z serwera czy na szkic lokalny | `state.status` → `POST /sessions/:id/events` (`server/src/routes/method-core.routes.ts:1065`) | zawsze widoczna | 1 | L |
| Nagłówek sesji (metoda · nazwa · wersja pakietu) | tożsamość rekordu | `GET /sessions/:id` (`:839`) | zawsze | 2 | L |
| Postęp gotowości (`x/39 jednostek · y bez dowodu`) | ile zostało do zamrożenia | `MethodReadiness` liczone z eventów | zawsze | 3 | L |
| Drzewo jednostek (nawigator) | wybór osi/obszaru, stan odpowiedzi kolorem | eventy `ANSWER_*` → `POST /sessions/:id/events` | zawsze | 4 | L |
| Wywiad — pytanie, „Dlaczego pytamy", dowody, odpowiedź | rdzeń pracy | `answers` z event-store → `POST /sessions/:id/events` | zawsze | 5 | L |
| Macierz (obszary × poziomy) | obraz dojrzałości | ten sam event-store, projekcja `drdWorkspaceViewModel.ts` | zawsze | 6 | L |
| Raport (zakładka) | wgląd w dokument bez opuszczania sesji | `GET /sessions/:id/assessment-report-contract` (`:535`) | zawsze | 7 | L |
| Pominięcia z uzasadnieniem | ślad audytu decyzji „pomijam" | `POST /sessions/:id/assessment-skip-reasons` (`:466`) | brak pominięć → sekcja znika | 8 | L |
| Wynik zamrożony (Output · Raport · Inicjatywa) | co powstało z sesji | `POST /sessions/:id/freeze` (`:1505`), `/outputs/:id/report` (`:1789`) | tylko dla `frozen`/`closed` (`DrdHttpMethodWorkspaceScreen.tsx:1151`) | 9 | L |
| Specyficzne dla metodyki | osie/wymiary danego pakietu | `GET /packs` (`:599`) | brak pakietu → sesja się nie otwiera | 10 | L |

## §2. Prawy panel

| sekcja panelu | status | uzasadnienie / stan zastany |
|---|---|---|
| Akcje | **obowiązkowa — DZIŚ BRAK** | akcje cyklu życia („Wyślij do przeglądu", „Odeślij do pracy", „Zamroź") leżą w szufladzie „Ustawienia" (`MethodWorkspaceShell.tsx:336-400`, zrzut `11-sesja-ustawienia.png`), nie w panelu |
| Właściwości (tabela) | **obowiązkowa — DZIŚ BRAK** | dane są (metoda, wersja pakietu, wersja sesji, źródło, dowody, blokery), ale jako czterokolumnowy pasek poziomy, nie tabela „Właściwość \| Wartość" |
| Powiązania | obowiązkowa — brak | Output/raport/inicjatywa z tej sesji istnieją (`/sessions/:id/lineage`, `:2086`) i nie są pokazane |
| Źródła i założenia | **obowiązkowa** (karta ma AI) — brak | „Pracuj z AI" pisze do pola odpowiedzi; skąd wzięła treść, nie widać |
| Komentarze | warunkowa — pominięta | dyskusja o odpowiedzi toczy się w doku Teresy (Menu 1); powód do zapisania w kontrakcie |
| Historia | obowiązkowa — brak | event-store JEST dziennikiem zmian (`GET /sessions/:id/events`, `:1049`) — panel go nie pokazuje |

Wymagany porządek wierszy Właściwości (K7): Status sesji → Właściciel → Metodyka
i wersja pakietu → Okres/termin → Źródło danych (SERWER/SZKIC) → Utworzono → Zaktualizowano.

## §3. Menu 5 i nawigacja

* **Menu 5 dziś nie istnieje jako pasek.** Trzy elementy kanonu są rozrzucone:
  „Pracuj z AI" siedzi w Menu 4 (`MethodWorkspaceShell.tsx:274`), przełącznik
  Wywiad/Macierz/Raport jest osobnym `role="tablist"` (`:470-490`), „Sekcje ▾" nie ma.
* **Docelowo:** pasek pod Menu 4 — „Sekcje ▾" (widoczność sekcji z §1) · „Edycja/Podgląd" ·
  „Pracuj z AI ▾". Przełącznik Wywiad/Macierz/Raport zostaje jako tryb centrum (archetyp D),
  bo to nie są sekcje dokumentu, tylko trzy ujęcia tych samych danych.
* **Edycja/Podgląd wg prawa (K14):** prawo = rola procesowa z prawem zapisu
  (`canWrite`, pochodna `state.roles`); sesja `frozen`/`closed` i konto bez roli →
  przełącznik się NIE renderuje, powód idzie tekstem („Sesja jest tylko do odczytu —
  brak roli z prawem zapisu", literał już istnieje w `DrdHttpMethodWorkspaceScreen.tsx:1294`).
* **Sticky (K15):** nagłówek i pasek trybów są dziś przyklejone ✓ (zmierzone: przewinięcie
  listy pytań nie rusza nagłówka).
* **Drabina S/L (K16):** klasa **L** — 10 sekcji, pełna strona. Zgodne.
* **„Otwórz" z podglądu ✓** — zmierzone, dwa kliknięcia z listy (K26 spełnione).

## §4. AI

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Wywiad — pole „Twoja odpowiedź" | ocena gotowości sesji z `MethodReadiness` + 6 pytań Teresy (`DrdHttpMethodWorkspaceScreen.tsx:981`) | propozycja treści do pola bieżącego pytania, generator `generujTrescPola` (`POST /ai/refine-text`) | to samo dla wszystkich pytań bieżącej jednostki | — |
| Stan odpowiedzi (Potwierdzone/Częściowo/Nie) | czyta | **nie wolno** | **nie wolno** | ✓ AI nie przestawia pigułki stanu za człowieka (`:1023-1029`) |
| Dowody | czyta liczbę | nie | nie | ✓ dowód wnosi człowiek |
| Pominięcia i uzasadnienia | czyta | nie | nie | ✓ ślad audytu |
| Macierz / poziomy | czyta | nie | nie | ✓ wyliczenie, nie treść |
| Wynik zamrożony | czyta | nie | nie | ✓ niezmienny |

Zawsze propozycja → „Zatwierdź" (`zastosujPropozycje`, `:1042-1051`); Teresa wyłącznie
z Menu 1 (`useOpenChatWithContext`, `:723-775`) ✓ K27. Rubryka `cardAnalysisRubric.ts`
nie zna typu `assessment-session` — wiersz do dopisania (patrz §7 L6).

## §5. Czytelność

* `primary-[0-9]`: **0** w `AssessmentSessionEditorView.tsx`, `DrdHttpMethodWorkspaceScreen.tsx`,
  `MethodWorkspaceShell.tsx` ✓ K17. Fokus wyłącznie `ring-c-focus` ✓ K18.
* **Angielskie literały do usunięcia (K25):** `DrdSourceIndicator.tsx:24-26`
  (`SERVER`/`RECOVERY_DRAFT`/`DEMO_LOCAL` — nazwy enuma na ekranie, widoczne na
  `03-sesja-drd.png`); `MethodWorkspaceShell.tsx` „Tryb pracy: **human led** / **AI assisted**"
  (widoczne na `11-sesja-ustawienia.png`); `AssessmentSessionEditorView.tsx:1745`
  („Invalid assessment URL."), `:1767` („Loading assessment…"), `:1782` i `:2038`
  („Back to Assessment"), `:1816` („Wróć do **Assessment**" — polski z angielskim słowem).
* **K28:** tytuł sesji niesie skrót UUID („Sesja 2d1fc7a8"), podgląd z listy pokazuje
  pełny UUID autora (`02-sesja-podglad.png`). Pełny `session.id` jest schowany w
  `<details> Szczegóły techniczne` ✓ (wzór do powtórzenia w pozostałych miejscach).
* 1440 ✓ (zmierzone). 1280 — niemierzone, do sprawdzenia przy naprawie.
* K29: `bledyKonsoli = 0` na `03`/`04`/`11` ✓.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | stan | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak `KanonicznaKarta`/`StandardSekcjaDef` dla tej karty |
| K2 kontrakt steruje renderem | ✗ | sekcje zaszyte w JSX |
| K3 źródło per sekcja | ~ | wszystkie sekcje mają writer (event-store), ale nigdzie nie spisany |
| K4 reguła pustki | ~ | pominięcia i wynik zamrożony znikają ✓; postęp/dowody pokazują „0/39" zamiast znikać |
| K5 etykiety wg kontraktu | ✗ | brak katalogu |
| K6 Akcje | ✗ | w szufladzie Ustawienia |
| K7 Właściwości jako tabela | ✗ | pasek 4-kolumnowy, `MethodWorkspaceShell.tsx:340` |
| K8 Powiązania | ✗ | brak |
| K9 Źródła i założenia | ✗ | brak, mimo AI |
| K10 Komentarze/Historia | ✗ | brak obu |
| K11 jeden prawy panel | ✗ | zero paneli |
| K12 Menu 5 | ✗ | brak paska; elementy rozrzucone |
| K13 lewy spis sekcji | ~ | jest drzewo JEDNOSTEK, nie spis sekcji; etykiety ucinane („Technologia Proceso…", `03-sesja-drd.png`) |
| K14 Edycja/Podgląd wg prawa | ~ | `canWrite` istnieje, przełącznika nie ma |
| K15 sticky | ✓ | zmierzone |
| K16 klasa S/L | ✓ | L, zgodna |
| K17 zero `primary-*` | ✓ | grep = 0 |
| K18 fokus `c-focus` | ✓ | grep = 0 naruszeń |
| K19 pasek modułu z pigułką | ✗ | Menu 2 znika po wejściu (`03-sesja-drd.png` vs `01-procesy.png`) |
| K20 1440/1280 | ~ | 1440 ✓, 1280 niemierzone |
| K21 „Pracuj z AI" ×3 | ✓ | `04-sesja-drd-ai.png` — Analizuj · Uzupełnij tę sekcję · Uzupełnij cały dokument |
| K22 propozycja → Zatwierdź | ✓ | `DrdHttpMethodWorkspaceScreen.tsx:1044-1053` |
| K23 po polsku i wg uprawnień | ✓ | `powodTylkoOdczyt` + `isPolish` |
| K24 deklaracja per typ | ✗ | brak wiersza w `cardAnalysisRubric.ts` |
| K25 i18n | ✗ | 6 miejsc z §5 |
| K26 podgląd → „Otwórz" | ✓ | zmierzone |
| K27 Teresa tylko Menu 1 | ✓ | `useOpenChatWithContext:723` |
| K28 zero identyfikatorów | ~ | skrót UUID w tytule; pełny UUID w podglądzie listy |
| K29 zero błędów konsoli | ✓ | 3 zrzuty, `bledyKonsoli = []` |
| K30 odbiór na zrzucie | ✓ | `04-sesja-drd-ai.png` |

**Wynik: ✓ 11 · ~ 6 · ✗ 13 z 30.**
(✓ K15 K16 K17 K18 K21 K22 K23 K26 K27 K29 K30 · ~ K3 K4 K13 K14 K20 K28 ·
✗ K1 K2 K5 K6 K7 K8 K9 K10 K11 K12 K19 K24 K25)

## §7. Luki → naprawa

| # | luka | rozmiar | decyzja właściciela? |
|---|---|---|---|
| L1 | prawy panel wg K6–K11 (Akcje z szuflady, tabela Właściwości, Powiązania z `lineage`, Źródła i założenia, Historia z event-store) | **L** | nie |
| L2 | Menu 5 jako pasek (Sekcje ▾ · Edycja/Podgląd · Pracuj z AI) — przenieść AI z Menu 4 | M | nie |
| L3 | pasek modułu z pigułką otwartej karty (K19) — dziś wyjście z sesji tylko „Wyjdź" | M | nie |
| L4 | katalog sekcji `assessmentSessionCardContract.ts` sterujący renderem (K1+K2) | L | nie |
| L5 | 6 angielskich literałów z §5 + skrócenie etykiet drzewa bez ucinania (K13) | S | nie |
| L6 | wiersz `assessment-session` w `cardAnalysisRubric.ts` + wpis w `REJESTR_KART_N` (warunek wołania silnika AI) | S | nie |
| L7 | CMMI/LEAN: ekran „wkrótce" jest uczciwy, ale wisi pod trasą sesji — do decyzji, czy zostaje | S | **TAK — jedyne pytanie tej karty** |

**Pytanie do właściciela (1):** CMMI i LEAN mają dziś status „wkrótce" i po wejściu w sesję
pokazują komunikat zamiast ekranu. Czy w MVP zostają widoczne w Bibliotece jako „Planowane"
(rekomendacja CTO — uczciwie mówią, czego nie ma), czy znikają z listy do czasu wdrożenia?

## §8. Aliasy

Brak. Trasa `/assessment/drd|siri|adma|cmmi|lean` (`AppRoutes.tsx:2320-2350`) to filtry
listy, nie karta.
