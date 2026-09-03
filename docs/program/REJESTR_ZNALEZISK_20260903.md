---
doc_id: program-rejestr-znalezisk-20260903
status: canonical
data: 2026-09-03
---

# Rejestr znalezisk — 3 września 2026 (sesja nadzorcy #16)

Jeden wiersz na znalezisko. Kolumny: co zmierzono · gdzie · skutek dla użytkownika · stan · commit/ślad.
Stan: **NAPRAWIONE** · **OTWARTE** · **DO DECYZJI** (właściciela) · **OBALONE** (fałszywe znalezisko).
Wszystkie commity na `github-backup/grafika/m03-20260902`.

## A. Znaleziska o procesie i przyrządzie (najważniejsze)

| # | Znalezisko | Skutek | Stan | Ślad |
| --- | --- | --- | --- | --- |
| A1 | Merge `d5e5db8b22` z porannego przekazania zostawił `<<<<<<<`/`=======`/`>>>>>>>` w `src/components/shared/PreviewPane/PreviewAIHintStrip.tsx`; przekazanie ogłosiło „konflikt rozstrzygnięty" | Komponent importowany przez `StandardPreview` i 19 innych — każdy ekran z podglądem nie kompilował się (vite 500); pomiary na tym kodzie dawały liczby | NAPRAWIONE | `199e841582`; pamięć `konflikt-rozstrzygniety-slowem-nie-plikiem` |
| A2 | Realne inicjatywy od 13.08 (`07bc597420`) otwierały nieodebrany `CanonicalInitiativeCardWorkspace`; wyjątek z 23.08 (`5c6d72066f`) dawał zatwierdzony `InitiativeDocumentView` tylko id `init-showcase-*` | Właściciel na stagingu zobaczył „coś zupełnie innego" niż zatwierdził; odbiór 02.09 stał na fiksturze | NAPRAWIONE (DEC-2026-09-03-346: komponent skasowany, bezpiecznik `tests/unit/initiatives/initiativeRecordCanon.test.ts`) | `aed131a2ab`, `d91edbf321`, `49490e8754` |
| A3 | Audyt przewodów 248 zatwierdzonych ekranów: 218 zgodnych, 6 rozjazdów, 2 repliki, 22 warunkowe (flagi OFF) | Odbiór sprawdzał wygląd komponentu, nie przewód lista→realny rekord | ROZJAZDY I REPLIKI NAPRAWIONE; flagi DO DECYZJI | `AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `przewody-odbioru-20260903.md` |
| A4 | `assessment-initiatives-table`, `assessment-reports-table` — harness montował komponenty bez żadnego wołacza w `src/`; `audyty-drd-report` — hub wycofany z montowania; `assessment-list`, `drd-library-entry` — harness składał triadę sam | W zakładce Raportów Oceny kolumna Status była **pusta dla każdego realnego raportu** (fallback chipa działa tylko bez `render`) | NAPRAWIONE (harness na realny hub, produkt wyrównany do zatwierdzonego) | `agent/przewody-harness` → `35afcb15fd` |
| A5 | Martwe komponenty `InitiativesTable.tsx` (728 linii), `ReportsTable.tsx` (876), `AuditsHub.tsx` (1043) + ich testy + 90 martwych kluczy i18n | Zatwierdzone zrzuty stały na kodzie, którego produkt nie woła | NAPRAWIONE (usunięte, bezpiecznik na nieobecność) | `agent/martwe-komponenty` → `ee4594b393` |
| A6 | Przyrząd: `--rozwin-sekcje=1` klikał lejki/kebaby i klik w róg (2,2) zamykał podgląd przed skanem axe (`execution-tab-list`: tekst 1018→648 znaków, naruszenie znikało) | Pierwszy „pomiar finalny" 15 modułów miał ślepą plamę na każdym ekranie listowym | NAPRAWIONE (opt-in `--klik-po-rozwinieciu=1`) | `395417dd50`; pamięć `przyrzad-zamyka-podglad-przed-skanem` |
| A7 | Przyrząd: skan ~150 ms po kliknięciu trafiał w fade-in framer-motion (`AnimatedBlock`); `deck-artifact` 4 fałszywe węzły kontrastu w obu motywach | Fałszywy dług | NAPRAWIONE (opt-in `--osiad-po-rozwinieciu=1500`) | `f533715398` |
| A8 | Po naprawie przyrządu: **24 ekrany w 11 modułach** z `color-contrast` wyłącznie w otwartym podglądzie (37 węzłów) — 33 z nich to tokeny `--c-text-muted`/`--c-danger` na podbarwionym tle komórki | Tekst w zaznaczonym wierszu i podglądzie poniżej 4,5:1 (light) | NAPRAWIONE (nowe wąskie tokeny `--c-text-muted-table`, `--c-danger-table` + `PreviewRelations` + 3 plakietki) | `fee24bddb0`; `a11y-fix-podglad-kontrast-20260903.md` |
| A9 | 20 plików harnessu przybija język polski; 42 ekrany PL=EN, z czego 35 potwierdzone; większość to PRODUKT bez `t()` (cały moduł Finansów, kreator szablonów, powłoka warsztatów metodyk, publiczny widget rezerwacji) + 5 w rundzie 2 (zakładki Realizacji przybite w `ExecutionHub.tsx:2189`) | Użytkownik anglojęzyczny widzi polski interfejs | NAPRAWIONE (34 + 5 ekranów; wyjątek `report-artifact` = dane dokumentu) | `agent/i18n-pl-en`, `agent/i18n-reszta`; `i18n-pl-en-20260903.md` |
| A10 | Robotnik ubił hurtowo `pkill -f grafika-zrzuty` — cztery strumienie pomiaru nadzorcy padły o jednej sekundzie | Pomiar do powtórzenia | NAPRAWIONE procesowo (zakaz `pkill` w każdym zleceniu) | przekazanie |
| A11 | Opus 5: trzykrotnie 529 Overloaded / stall 600 s na robotnikach | Utrata czasu | OBEJŚCIE (robotnicy na Sonnet, wznowienia z transkryptu) | — |
| A12 | JSON konfigów generatora dyżurów i `g06-macierz-wyjatki.json` z polskim cudzysłowem zamykającym ASCII; agregator miał **cichy fallback** na pusty obiekt | Wyjątki „nie działały" bez komunikatu | NAPRAWIONE (regex hurtowy; agregator zatrzymuje się na uszkodzonym pliku) | `e50424f578`; pamięć `polskie-cudzyslowy-w-skryptach` |

## B. Znaleziska produktowe naprawione dziś (skrót; pełne tabele w plikach śladu)

| # | Moduły | Co | Ślad |
| --- | --- | --- | --- |
| B1 | 16 modułów | Dostępność (axe) do zera na pl-1440 + en-1024: kontrast, `button-name`, `label`, `select-name`, `heading-order`, `landmark-unique` (Partner 12/12), `nested-interactive` (ReactFlow, spread nadpisywał `nodesFocusable`), `aria-required-children` (tablist z przyciskiem zamknięcia), `scrollable-region-focusable`, `aria-input-field-name` (CanvasRichEditor), `empty-table-header`, FullCalendar | `evidence/grafika/a11y-fix-*.md` (9 plików) |
| B2 | Serwer | `ai_user_tiers`, `help_categories` tworzone w locie bez migracji (P0 „schemat poza migracjami"); `help.routes` połykał błąd DDL | `SCHEMAT_DATETIME_RESZTA_20260903.md`, `6c7d74d9e5` |
| B3 | 13 Czat | `feed.signals is not iterable` — brak walidacji odpowiedzi w `useSignalsFeed` → fail-closed + test; fixture `work-canvas/drafts` w harnessie | `evidence/g14/G14_13_16_20260903.md` |
| B4 | 14 Admin | Plik-fantom flagi `isCommandCenterEnabled` (rozjazd nazwy) usunięty; fokus crimson → `c-focus` (26 miejsc) | jw. |
| B5 | 06 Realizacja | Dropdown „Wybierz realizację" pokazywał surowy `executionCaseId` → nazwa inicjatywy z `execution-cases` | `evidence/g14/G14_05_08_20260903.md` |
| B6 | 07 Moja Praca | `decision-record`: `escalation` żyło tylko w `localStorage` → kolumna + migracja + endpoint; `DecisionsPanelContent` dołożony do harnessu | jw. |
| B7 | 09–12 | `data-preview-pane` w Wynikach; surowy `initiativeId` w Value Capture; `htmlFor` w kreatorze szablonów; stub `reflection` w harnessie | `evidence/g14/G14_09_12_20260903.md` |
| B8 | 01–04 | Fokus crimson → `c-focus` (5 miejsc Oceny), crimson w Wywiadzie (5) i Organizacji (14 żywych) | `evidence/g14/G14_01_04_20260903.md` |

## C. Znaleziska z analizy G13 OBALONE własnym pomiarem robotników

| # | ID | Co twierdziła analiza | Co pokazał pomiar |
| --- | --- | --- | --- |
| C1 | INT-3 | „sekcje nie rozwijają się" na 4 ekranach Wywiadu | To wyzwalacze menu/kebaby i celowo pojedynczo-rozwijalne drzewo osi DRD — nie defekt |
| C2 | MW-1 | 13 martwych plików kolejek do usunięcia | 12 komponentów ma realne testy jednostkowe i żywy fixture e2e (2 specyfikacje) — nie usunięto |
| C3 | 10-1 | Luka podglądu 263 px w `FinanceHub` | Realna luka 0 px; zalecana naprawa 1:1 dawała 128,5 px luki — wycofana |
| C4 | 11-2 | „6 zwiniętych sekcji" w Materiałach | Menu kebaba, nie akordeon |
| C5 | 13 Czat | `chat-split-teresa-right` crashuje `Invalid hook call` w light | Nieodtworzone w 8 kadrach × 2 pomiary; zostaje jako niereprodukowalne |
| C6 | 14 Admin | `ai_user_tiers` „wywraca cały proces" | `dbRun`/`dbAll` mają `fallback=true`; tylko `.exec()` omija tłumaczenie `DATETIME` — realny P0 to brak tabeli na świeżej bazie, naprawiony migracją |
| C7 | nadzorca | 5 ekranów PL=EN uznanych przez robotnika za „już różne" | Pomiar nadzorcy ×2 przeczył; runda 2 potwierdziła i naprawiła |
| C8 | nadzorca | „Pozostałe pliki z DATETIME padają jak rejestracja" | Tylko ścieżka `.exec()` (robotnik zmierzył mechanizm w `PostgresDatabase.ts:1068`) |

## D. OTWARTE (nienaprawione, z powodem)

| # | Co | Powód / dla kogo |
| --- | --- | --- |
| D1 | 21 zatwierdzonych ekranów za flagami domyślnie OFF (14 Wyników, 6 Finansów, Organizacja redesign) | DO DECYZJI właściciela — dotyczy produkcji |
| D2 | Przebudowy DUŻE: struktura raportu Oceny (ASS-2), biblioteka DRD (ASS-3), prawy panel Idei (MW-4), „Tworzy raport" (INIT-2b), menu kanw Czatu, preferencje Czatu | DO DECYZJI — `DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md` |
| D3 | Crimson poza semantyką krytyczną: 5 325 wystąpień w 609 plikach; pierścień fokusu 193 (dyżur Codexa 287) | Projekt wizualny per moduł, wymaga akceptu na zrzutach |
| D4 | 9 zastanych czerwieni testów (`chatActionHandler.createInitiative` 3, `executionWorkResources` 6) + `AssessmentLibraryTab.day178` | Dyżur Codexa 286 (G15) |
| D5 | `WatchingTab` w Ustawieniach: trasa `/api/settings/watchers` nie istnieje — **korekta z równoległej sesji (pomiar G20, `77661c4de6`): `WatchingTab` jest komponentem NIERENDEROWANYM (martwy komponent, nie martwa trasa)** | Dyżur Codexa 289 (help) |
| D6 | `help_articles`/`help_events`: migracja w innym kształcie niż kod tras (`column "category_id" does not exist`, cicho łapane) | Osobny dyżur |
| D7 | Trasy `/api/v8/finance/*` bez bramki modułu — **korekta z równoległej sesji (pomiar G20, `748e51013b`): 270 tras, nie 34; teza zaniżała 8×** | Dyżur Codexa 288 (jeden middleware na wzorcu, dowód USER/OWNER na realnej bazie) |
| D8 | MW-5 `escalation`: dowód odczytu na zimno nie przeszedł z powodu harnessu testowego | Dyżur 286 lub osobny |
| D9 | `capacity-advisor-a3`: 11 nagłówków tabeli, podgląd, formularz, stany LOADING/ERROR po angielsku | Runda 3 i18n |
| D10 | Paleta 12 kolorów `--c-tag-1..12` z białym tekstem: 10–11 z 12 poniżej progu w obu motywach | Zbyt szeroki promień na jeden dyżur; do decyzji wizualnej |
| D11 | `OrganizationV8CanonPanel.tsx` martwy (zero importerów, 10 wystąpień crimson) | Usunąć osobno |
| D12 | Nazwy sesji DRD renderują się jako „DRD · sess-drd" — kontrakt `MethodSession` nie ma pola nazwy | Zmiana kernela |
| D13 | Szerokość kolumn (ucięte nagłówki) — rodzina `FilterableTable` | W toku w repo głównym |

## E. Stan bramek na koniec dnia

240 → **256/336**: pomiar #3 na `fee24bddb0` (po naprawie 24 ekranów kontrastu w podglądzie) —
**G06 PASS 16/16** (2064 kadry, zero długu), wiersze zapisane commitem `02c339c5f1`.
G14: 16 × `PARTIAL / OWNER_DECISION_PENDING`. G16: 16 × `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`.
G15: dyżur 286. G19/G20: po przelocie właściciela po stagingu.
