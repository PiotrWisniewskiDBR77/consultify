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
| D14 | Wycieki surowych treści błędów w trasach (dyżur 296): WIP Codexa zdjął 341 z 396 wystąpień, ale **35 realnych wycieków HTTP zostało** — wariant `(e as Error)` i pole `details` w `table-platform.routes.ts` (28) i `data-collection.routes.ts` (7), objęte ratchetem 35 w `tests/unit/backend/security/noRawErrorMessage.test.ts`; przy okazji komunikaty domenowe zastąpione angielskim generykiem, bo klasy błędów nie dziedziczą `AppError` | SCALIĆ Z ZASTRZEŻENIEM — 3 dyżury następcze; `docs/program/waves/WAVE_03_ACCEPTANCE/codex/ODBIOR_DYZURU_296_WIP_20260904.md` |

## E. Stan bramek na koniec dnia

240 → **256/336**: pomiar #3 na `fee24bddb0` (po naprawie 24 ekranów kontrastu w podglądzie) —
**G06 PASS 16/16** (2064 kadry, zero długu), wiersze zapisane commitem `02c339c5f1`.
G14: 16 × `PARTIAL / OWNER_DECISION_PENDING`. G16: 16 × `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`.
G15: dyżur 286. G19/G20: po przelocie właściciela po stagingu.

## F. Sesja wieczorna 03.09 (nadzorca #17) — znaleziska i sprostowania

Zegar systemowy: sesja „na 04.09” ruszyła 03.09 o 18:15, gdy pomiar #3 jeszcze biegł. Wszystkie
pozycje poniżej zmierzone własnoręcznie albo przez robotników z komendą w dowodzie.

| # | Znalezisko | Skutek | Stan | Ślad |
| --- | --- | --- | --- | --- |
| F1 | Pomiar #3 G06 na `fee24bddb0` skończony 19:04: 16 modułów, 72 kombinacje, zero realnych naruszeń a11y, zero realnych błędów konsoli, zero PL=EN, zero złych par | **G06 PASS 16/16**; licznik 245 → 256/336 | ZAMKNIĘTE | `evidence/grafika/g06-macierz-final-20260903/` (nadpisane manifesty), `fa54b11b53`, wiersze G06 z flagami przyrządu |
| F2 | Ślepa plama przyrządu nr 3: `--rozwin-sekcje=1` chowa rząd chipów statusu Menu 3 na `assessment-list` (tekst 1562 → 1444 znaki); `execution-tab-list` czysty (1018 = 1018); kontrola bez opcji: 0 naruszeń na obu | Zero z F1 ma nazwaną granicę: chipy statusu Oceny nie były skanowane w pomiarze #3; bez ukrytego długu na zmierzonej próbce | W TOKU (robotnik: pomiar całej macierzy z/bez opcji + opt-in `--cofnij-jesli-skraca`) | `agent/slepa-plama-20260903` |
| F3 | D7 zaniżone ~8×: nie 34 trasy odczytowe, lecz **270 tras (91 GET + 179 zapis) w 7 prefiksach** `/api/v8/finance*` bez `createModuleGate` (`v8/index.ts:120-131`); 64 zapisy bez bramki i bez odczytu członkostwa; `financeStatementMountedSurface.ts:78-98` omija `v8FeatureGate`; org scoping poprawny (0 trafień) | Zamknięty moduł Finansów otwarty dla każdego zalogowanego użytkownika (pomiar statyczny, nie runtime) | DO DYŻURU **Codex 288** (dowód USER/OWNER na realnej bazie, jeden middleware na wzorcu, bezpiecznik w rejestrze mountów) | `G20_BLOKERY_P0P1_20260903.md` T1 |
| F4 | D5 w połowie fałszywe: `WatchingTab` żyje w `NotificationSettingsV2/**` (8 plików + hook, 3 wołania nieistniejącej trasy), a katalog nie ma ANI JEDNEGO importera — Ustawienia renderują v1 (`SettingsView.tsx:433`) | To „zbudowane, niepodłączone”, nie „martwa trasa pod żywą zakładką”; użytkownik tego nie widzi | SPROSTOWANE; usunąć czy podłączyć = decyzja właściciela (lista decyzji, poz. A5) | `G20_BLOKERY_P0P1_20260903.md` T2; pamięć `martwe-poddrzewo-niewidoczne-per-plik` |
| F5 | D6 potwierdzone i rozszerzone: 5 kolumn rozjechanych (`help_articles.category_id/body/status`, `help_events.article_id/metadata`), 5 cichych `catch` (`help.routes.ts:187,199,216,224,274-278`), `:274-278` zwraca `200 stored:false` przy utracie zdarzenia; trzeci rozjazd: front wysyła `{playbookKey, context}`, trasa czyta `{articleId, metadata}` (`HelpContext.tsx:299`) | Pomoc kontekstowa cicho pusta | DO DYŻURU **Codex 289** | jw. |
| F6 | Numeracja `KOLEJKA_CODEX_INTEGRACJA.md` rozjechała się z wydanymi instrukcjami już przy 286/287 | Ryzyko pomyłki numerów | NAPRAWIONE notą: numer nadaje plik instrukcji; tematy z kolejki od 292 | `KOLEJKA_CODEX_INTEGRACJA.md` (nota na górze) |
| F7 | Rozliczenie P0/P1: **121 unikalnych pozycji** (68 P0, 53 P1), nie 22/38 z rejestru głównego; 33 naprawione (każdy cytowany commit jest przodkiem HEAD), 43 otwarte, 8 nieweryfikowalne statycznie, 1 zdezaktualizowana, 36 z rejestrów Oceny i Narzędzi poza każdym licznikiem; rozjazd master↔moduły 61 pozycji; kolizja ID `ASM-OWN-001..028` (dwa różne zbiory pod tymi samymi numerami) | Bramka G20 „zero open P0/P1” mierzyła twierdzenie, nie stan | ZMIERZONE; reguła liczenia = decyzja (lista decyzji, poz. E) | `ROZLICZENIE_P0P1_20260903.md` |
| F8 | Krzyżowanie 79 otwartych z ledgerem decyzji i korpusem: 3 naprawione, 14 zamknięte decyzją, 6 odłożone decyzją, 8 do rozmowy, **48 bez żadnej decyzji** — to życzenia produktowe właściciela z przeglądów 22–23.08 (nawigator Wywiadu, model sesji Dynamic SWOT, model spotkań Kalendarza, standard kart N-Type…), nie defekty kodu | G20 nie przejdzie bez decyzji „teraz / po MVP” per rodzina | PAKIET DECYZJI W PRZYGOTOWANIU (`DECYZJE_WLASCICIELA_P0P1_20260904.md`) | `ROZLICZENIE_P0P1_DECYZJE_20260903.md` |
| F9 | G19: definicja nieostra (4 zdania w 3 plikach); 16 odbiorów na SHA z jednego okna 5 h 02.09 → obowiązek regresji JEDEN; macierz G06 pokrywa 22/23 zmienionych komponentów UI; poza nią: 3 middleware + 12 tras, `AIConsultantPanel` (ekran poza macierzą), locales; 8/23 komponentów ma test | G19 to pół dnia dowodów, nie 16 regresji | DO DYŻURU **Codex 290** (gotowe zdania do 16 wierszy) | `G19_INWENTARZ_OBOWIAZKOW_20260903.md` |
| F10 | 8 pozycji P0/P1 „nieweryfikowalnych statycznie” (rodzina Oceny 404 za proxy, Wyniki odczyt na zimno, 11 inicjatyw demo, Realizacja „pending checkpoint”, Wywiad AI fill) + D8 `escalation` | Nie da się ich ani zamknąć, ani odłożyć bez uruchomienia | DO DYŻURU **Codex 291** | `ROZLICZENIE_P0P1_20260903.md` |
| F11 | D9 język: rodzina doradcy obciążenia — `capacity-advisor-a3` 48 → 13 linii EN w PL, `plan-scenario-d1` 25 → 15 (reszta = dane/ID), +44 kluczy pl/en, `formatDate` bez `pl-PL` na sztywno | Użytkownik anglojęzyczny widzi angielski doradca | NAPRAWIONE | `evidence/grafika/i18n-r3-capacity-20260903.md`, scalenie `agent/i18n-r3-20260903` |
| F12 | D11 `OrganizationV8CanonPanel.tsx` usunięty + bezpiecznik (6/6); rodzina: **238 komponentów bez importera** (nie „kilkadziesiąt”): 45 `settings/*` = dług decyzyjny z `SETTINGS_DAY55_REPORT`, 20 `SuperAdmin/*`, 17 z testami w `tests/components/**`; metoda per-plik NIE widzi martwych poddrzew (F4) | Zatwierdzone zrzuty nie stoją na tym kodzie, ale kod zostaje | D11 NAPRAWIONE; 237 zinwentaryzowanych, do osobnego dyżuru z pomiarem od korzenia | `evidence/grafika/martwe-komponenty-r2-20260903.md`, `scripts/dev/find-dead-components2.py` |
| F13 | Ratunek dowodów: 13 plików `evidence-bramki` (pary red/green + 3 dowody mutacyjne bramek bezpieczeństwa) i 6 PNG cytowanych w `EKRANY_DOLOZONE_DO_HARNESSU_20260903.md` istniały tylko w worktree poza repo; dyżur 282 (przepływy międzymodułowe) porzucony bez pomiaru (96 linii WIP, zero raportu) | Dowód poza repo wyparowuje | URATOWANE (`evidence/ratunek-20260903/`), 4 worktree usunięte, WIP 282 zarchiwizowany w scratchpadzie nadzorcy | `d03254ce4b`, `52aa5ee9f2` |
| F14 | Osiem procesów vite z usuniętych katalogów robotników (porty 3022/3025/3027/5296/5331/5333/5341) żyło po wczorajszym dniu | Pamięć i porty | UBITE po PID | — |
| F15 | Staging (`0eff12615b`) jest **507 commitów** za linią dowodów; `MASTER_STATUS_REGISTER.md` pokazuje `G18 PASS 16/16` i jednocześnie „Finally closed modules: 2 of 16”; pole „P2/P3 dispositions complete” z szablonu nie istnieje w 15/16 kart | Przelot właściciela (G16) odbywa się na kodzie sprzed 507 commitów, dopóki nie padnie „wdrażaj” | OTWARTE (słowo właściciela) | `G19_INWENTARZ_OBOWIAZKOW_20260903.md` R5 |

## G. Stan bramek po sesji wieczornej

**256/336**. G06 16/16 PASS. G14 16 × `PARTIAL / OWNER_DECISION_PENDING` (lista decyzji). G16 16 ×
`OWNER_RETEST_PENDING` (staging po „wdrażaj”). G15 → Codex 286. G19 → Codex 290 (+ przelot właściciela).
G20 → Codex 288/291 + pakiet decyzji P0/P1 + zamrożony marker. Wydane dziś wieczorem: Codex 288, 289, 290, 291.

## H. Noc 03.09 — decyzje, wdrożenie, 8 scaleń

Zakres: po `58ef0771d7` (pierwszy deploy stagingu, potwierdzony `/api/health`) do `53c3da2918`
(HEAD tej sesji). Licznik zmierzony sam (komenda z §E) → **272/336** (skok +16 = G14 16/16 PASS
po DEC-347…385).

| # | Znalezisko | Skutek | Stan | Ślad |
| --- | --- | --- | --- | --- |
| H1 | Trzy pozycje z pakietu P0/P1 (`ASM-OWN-005`, `ASM-OWN-020`) i dwie rodziny (`R-12` triage, `R-8` kafel „MOJA PRACA”) **obalone pomiarem**: triage już podłączony z kebaba Skrzynki od 16.07 (`InboxTriage.tsx` = martwy równoległy duplikat łamiący kanon), element „MOJA PRACA” nie istnieje w obecnym buildzie | Pakiet decyzji P0/P1 stał częściowo na nieaktualnych rejestrach z 22–23.08; decyzja właściciela zostaje w ledgerze, wykonawca nie naprawia nieistniejącego kodu | ZMIERZONE, zero zmian kodu | `f0e697891f`, `648f8f7ea6`, `984d3658fd` (Merge `agent/mw-triage-kafel-20260903`) |
| H2 | `git stash` w hubie `m03` współdzielony między wszystkimi worktree naraz — jeden robotnik (legenda stanów Oceny) zdjął cudzy wpis (`CalendarView`), inny robotnik stracił niecommitowany fix | Reguła `Z27` (istnieje od dyżuru 33) złamana mimo istnienia | DOPISANE wprost do instrukcji Codex 290+ i do pamięci nadzorcy (`zasady-pracy-nadzorcy`) | `6b1ce5c7ea` (Merge `agent/ocena-legenda-stanow-20260903`) |
| H3 | Ochrona gałęzi `develop` (PR + check „PR Gate”, zakaz merge-commitów) zablokowała pierwszą próbę deployu wprost na `develop` | Ścieżka `staging` + `workflow_dispatch environment=staging` (`.github/workflows/railway-deploy.yml`, job `deploy-staging`) jest teraz kanoniczna dla deployu na staging | ZMIERZONE (`gh run list --branch staging`: run `33794221002` `success`, `headSha 58ef0771d7`) | `.github/workflows/railway-deploy.yml` |
| H4 | Flagi domyślnie ON po DEC-347…350/R-11: Wyniki 5 domen (`resultsVNextFeatureFlags.ts`), Finanse 6 paneli (`useFinance*Flag.ts`), Organizacja `orgRedesignV1`, kreator wywiadu `interview-creator-shell`, Notatnik Praca/Kontekst | Reguła 7 kodeksu (po akcepcie flaga domyślna) zastosowana do 5 rodzin naraz w jednym scaleniu, z bezpiecznikiem | 21/21 testów PASS | `1c8d93f253` (Merge `agent/flagi-on-20260903`), `133b51d3c6` (test bezpiecznika) |
| H5 | `ASM-OWN-013`: globalna legenda stanów usunięta z `LiveMatrix` (DRD/SIRI); etykiety chipów przeniesione do `aria-label` żeby nie stracić dostępności | Ekran Oceny czystszy, informacja o stanie nie zniknęła, tylko zmieniła nośnik | 10/10 testów PASS | `6b1ce5c7ea`, dowód `50028f4101` |
| H6 | Prototyp raportu Oceny DRD jako plik (21 stron DOCX/PDF: wstęp → 7 osi po 2 strony → odpowiedzi/wnioski → podsumowanie; SIRI szkielet 2 strony) zbudowany PRZED silnikiem, zgodnie z regułą „szablony/dokumenty" (pamięć: żaden dobry dokument z szablonu nigdy dotąd nie powstał) | Właściciel ocenił gotowy plik, nie kod: „Ten raport jest po prostu fantastyczny” (DEC-385), 7 pytań projektowych rozstrzygnięte wg rekomendacji CTO | ZAAKCEPTOWANE bez zastrzeżeń; silnik = dyżur Codex 298 | `ff16eb1d2b`, `ebfcf3d580` (Merge `agent/raport-oceny-prototyp-20260903`), `717254633f` |
| H7 | Drobiazgi Mojej Pracy: sygnalizacja przewijania dołożona do 3 żywych pasków (`ActionRequiredStrip`, `TableTabStrip`, `CalendarView`) i kontrast tekstu w wierszach ukończonych na Zadaniach (`opacity-60`) | 5 węzłów a11y → 0 w 8 kadrach; `QuickFilterBar`/`TaskFiltersBar` potwierdzone jako martwe przy okazji | NAPRAWIONE | `a16bea9ca5`, `53c3da2918` (Merge `agent/mw-drobiazgi-20260903`) |
| H8 | Drugi redeploy stagingu (flagi ON + 8 scaleń nocnych, `headSha 53c3da2918`) uruchomiony jako workflow run `33799377961`; w chwili pomiaru nadzorcy (03.09, okno 20:00–20:03 UTC) run **wciąż `in_progress`**, `/api/health` na staging nadal zwracał `gitSha` pierwszego deployu (`58ef0771d7`) | Brief nocny zakładał drugi deploy jako gotowy „ok. 23:20”; pomiar `gh run list` pokazuje `createdAt 19:56:51Z` (ok. 21:56 lokalnie) i status niedokończony — **rozbieżność ~1,5 h w czasie i status niepotwierdzony w sukcesie** | OTWARTE — następny nadzorca musi zrobić świeży `curl .../api/health` przed przelotem G16 | `gh run list --branch staging`, `PRZEKAZANIE_20260904.md` §1/§3b |

| H9 | Drugi redeploy stagingu potwierdzony: run `33799377961` success, `gitSha 53c3da2918` w `/api/health` (20:06Z) | Przelot właściciela odbywa się na kodzie z flagami ON | ZAMKNIĘTE (H8 nieaktualne) | czuwaczka nadzorcy |

## I. Odbiory Codexa 03.09 noc

Trzy sesje odbioru adwersaryjnego (Opus, „odbiór A/B/C”) zmierzyły własnoręcznie dziewięć dyżurów
Codexa wydanych wieczorem 03.09, każdy na osobnym worktree z realnym PostgreSQL. Werdykty i
scalenia poniżej pochodzą z tych trzech dokumentów, nie z raportów własnych Codexa.

| Dyżur | Werdykt odbioru | Co scalone | Rozbieżność odbiorcy (cytat) | Stan D-pozycji |
| --- | --- | --- | --- | --- |
| 286 (G15 samokontrola) | SCALIĆ Z ZASTRZEŻENIEM | TAK — na HEAD, `465ec539b7` | Odbiorca skorygował klasyfikację 13 czerwieni z `NOWA` na `ZASTANA`: baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pomiar na niej dawał `Test Files failed` / `0 tests`, co raport Codexa odczytał jako „bazę zieloną”. Cytat: „teza instrukcji («dziewięć czerwieni zastanych, w tym sześć `executionWorkResources`») była **prawdziwa**, a «pierwsze znalezisko» raportu — jej obalenie — jest **fałszywe**”. | D4 skorygowane i przeniesione do 16 wierszy `G15` w `modules/*/MODULE_ACCEPTANCE.md` (patrz commity `docs(wave3-acceptance): <moduł> — wpisz G15/G19…`, 03.09 noc) |
| 287 (fokus `c-focus`) | SCALIĆ Z ZASTRZEŻENIEM | NIE — W NAPRAWIE (6 konfliktów + czerwony test) | Spadek realny (193→84 wystąpień w pomiarze odbiorcy), ale gałąź wnosi czerwony test i ma 6 konfliktów z linią integracyjną. Cytat: „Na zacommitowanym HEAD ten test jest CZERWONY (zmierzone: `1 failed`). Raport nigdzie nie mówi wprost «gałąź, którą oddaję, ma failujący test»”. | **D3 fokus: 193→84, W NAPRAWIE** — bramka `check-focus-canon --ci` zielona przy baseline 83/35 (nie 0); warunek scalenia: rozwiązać 6 konfliktów i naprawić `tests/unit/canon/focusCanonZero.test.ts` |
| 288 (bramka finansów) | SCALIĆ Z ZASTRZEŻENIEM | NIE — W NAPRAWIE (2 testy czerwone) | Bramka działa i potwierdzona na 8 trasach z 7 prefiksów w obie strony (USER 403 `BETA_LOCKED` 8/8, OWNER 0/8 zablokowany), ale gałąź zostawia 2 testy czerwone, które na HEAD są zielone. Cytat: „HEAD 23/23 PASS, gałąź 288 21 PASS / 2 FAIL… W raporcie nie ma tego ani w sekcji STOP, ani w «TWIERDZENIA NIEZWERYFIKOWANE»”. | **D7 W NAPRAWIE** — para USER/OWNER 8/8 potwierdzona przez odbiór, ale warunek scalenia: naprawić 2 przypadki `financeStatementMountedSurface.test.ts` (stub bez roli); 266/270 tras nadal bez indywidualnego pomiaru |
| 289 (martwe trasy / help) | SCALIĆ | TAK — na HEAD, `a905bce0aa` | Jedyny z trójki 288/289/296, który po własnym pomiarze odbiorcy spełnia rdzeń instrukcji — schemat po pełnym łańcuchu migracji od zera zgadza się z kodem, dwie niezależne mutacje dają czerwień. Drobna rozbieżność (R-4): instrukcja cytowała nieistniejący plik `src/components/settings/SettingsView.tsx` (realny: `src/views/SettingsView.tsx`). | **D5 ZAMKNIĘTE** (martwy komponent `WatchingTab`/`NotificationSettingsV2` usunięty, `e6c236c0dd`, zero importerów potwierdzone niezależnie) · **D6 NAPRAWIONE** (289: 5 kolumn migracją addytywną `20260904_help_shape_alignment.sql`, 2 niezależne mutacje na czerwono) |
| 290 (G19 regresja współdzielona) | SCALIĆ Z ZASTRZEŻENIEM | TAK — na HEAD, `0250f90ea3` | Raport twierdził blok 3 = `11/18 PASS` (7 FAIL), ale to sygnatura zanieczyszczonej bazy dyżuru (`ORG_MEMBERSHIP_REVOKED`, podwójne `500`), nie stan kodu — na czystej bazie odbiorca zmierzył `16/18` dwukrotnie. Cytat: „liczba «11/18» wchodzi do 16 zdań `G19` i musi zostać poprawiona na **16/18**”. | Zdania przeniesione do 16 wierszy `G19` (status `NOT_PROVEN / OWNER_RETEST_PENDING` — Codex zaproponował `TECHNICAL_REGRESSION_PASS`, odbiorca to **odrzucił**: „Wariant 1 pozostaje niedostępny”) |
| 291 (runtime dowody P0/P1) | SCALIĆ | TAK — na HEAD, `7f5873f39e` | Trzy niezależnie sprawdzone twierdzenia trzymają się kodu (grep + `git cat-file`); jedyny werdykt „naprawione” (D8) ma pełną parę dowodową łącznie z zimnym odczytem. Cytat: „ta sama trasa ma w repo **czerwony** test `day277-decyzje-zapis.pg.test.ts` (0/2)… wiersz rejestru musi nieść zdanie o czerwonym teście, inaczej rejestr mówi «naprawione», gdy bramka testowa świeci na czerwono”. | **D8 NAPRAWIONE / VERIFIED_RUNTIME** z zastrzeżeniem: PUT/GET escalation 200/404 poprawne (owner/obcy), ale repo ma czerwony test `server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts` (0/2, przestarzały payload wobec pola `escalation`) — do zamknięcia `G20` wymagana poprawka tego testu |
| 292 (macierz akcji Wywiadu) | SCALIĆ Z ZASTRZEŻENIEM | TAK — na HEAD, `130cb3db12` | Kod R2–R4 realny i podłączony do istniejących handlerów Huba (zero atrap — przycisk powstaje tylko gdy przekazano handler), ale dyżur niedokończony: brak R5 (zrzutów) i R6 (raportu). Cytat: „## Stan PO — Do uzupełnienia po R2–R5 wraz z commitami, dowodem handlerów i zrzutami.” Sekcja nigdy nie została uzupełniona. | `INT-MENU-OWN-001` — MECHANIKA WYKONANA, ODBIÓR NIEDOMKNIĘTY (nie jest pozycją D; zdanie gotowe w `ODBIOR_DYZUROW_287_292_294_20260903.md`) |
| 294 (Czat: trzy defekty) | SCALIĆ | TAK — na HEAD, `f46cd67b02` | Dwa pliki dokumentacji, zero kodu produktu — i uczciwie nazwane. Cytat: „PARTIAL / DWA TWIERDZENIA OBALONE / JEDEN STOP MERYTORYCZNY”. Korekta odbiorcy: dyktowanie głosowe jest rozproszone na **7 plików + 3 hooki**, nie „trzy wejścia Mojej Pracy” jak sugerowało zdanie podsumowujące raportu. | `CHAT-OWN-002`/`CHAT-OWN-003` ZAMKNIĘTE, `CHAT-OWN-015` OTWARTE/STOP MERYTORYCZNY POSZERZONY (nie są pozycjami D; zdania gotowe w `ODBIOR_DYZUROW_287_292_294_20260903.md`) |
| 296 (wycieki błędów tras) | SCALIĆ Z ZASTRZEŻENIEM — DYŻUR NIEWYKONANY | NIE — materiał wejściowy tylko (merge-clean, addytywny) | R1–R2 wykonane, R3–R6 nie: **0 z 294** miejsc zamienione, bezpiecznika nie ma, raportu nie ma, mapper ma zero wołaczy produkcyjnych. Cytat: „to jest «biblioteka bez wywołania» (jedenasty kształt fałszywego gotowe): zielone testy, dowód jakości kodu, zero konsumentów”. | **296 NIEWYKONANY — mapper bez wołaczy, 0/294** zamienionych; rodzina wycieków błędów pozostaje otwarta w całości, dyżur do wznowienia od R3 |

**Trzy liczby mianownika dla tej samej rodziny (`error: err.message` w trasach serwera), żadna wcześniej nie uzgodniona z komendą:**

| Źródło | Liczba |
| --- | --- |
| Instrukcja 296 / pomiar nadzorcy w `G20_BLOKERY_P0P1_20260903.md` | 305 miejsc w 69 plikach |
| Rejestr 296 (`REJESTR_WYCIEKI_BLEDOW_TRAS_20260903.md`), pomiar markera `984d3658fd` | 341 miejsc w 71 plikach |
| Odbiór B, komenda wprost z instrukcji odbioru, zmierzona na gałęzi 296 i na HEAD | **294 miejsc w 62 plikach** |

Rozrzut 294–341 na tym samym markerze oznacza, że każda strona liczyła innym wzorcem, a żaden
wcześniejszy dokument nie zapisał komendy obok liczby. **Komenda odbiorcy obowiązuje jako
referencyjna** (zapisana obok wyniku, powtarzalna, zgodna na gałęzi i na HEAD):

```
git grep -cE "error: \(err(or)? as Error\)\.message|error: err(or)?\.message" -- server/src/routes
```

Wynik na 03.09 (obie strony, różnica zero): **62 pliki / 294 wystąpienia**. Dopóki przyszły raport
296 nie zacytuje tej samej komendy przy nowej liczbie, zdanie „294 → 0” pozostaje niemierzalne.

## J. Noc 03.09 część 2 — 8 lekcji metodycznych (odbiory 13 dyżurów, 23:00–00:30)

| # | Znalezisko | Skutek | Stan | Ślad |
| --- | --- | --- | --- | --- |
| J1 | Raport Codexa 286 nazwał 13 zastanych czerwieni „nowymi”, bo baza pomiaru `f65c4ff6a0` **nie kompilowała się** — nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110` dawał `Transform failed` przy `numFailedTests: 0`, co raport odczytał jako „baza zielona” | Klasyfikacja ZASTANA/NOWA fałszywa dla całego bloku; odbiorca musiał ją odwrócić przed wpisaniem 16 wierszy `G15` | NAPRAWIONE (odbiorem) | `ODBIOR_DYZUROW_286_290_291_20260903.md` §1.3; `REJESTR_ZNALEZISK_20260903.md` §I wiersz 286 |
| J2 | Dyżur 290 podał blok 3 = `11/18 PASS` zamiast `16/18` — pomiar zrobiony na bazie dzielonej z listenerem, zanieczyszczonej sygnaturą `ORG_MEMBERSHIP_REVOKED` (podwójne `500`), nie stan kodu | 5 z 7 „czerwieni” bloku 3 nie reprodukuje się na czystej bazie; liczba wiążąca do 16 wierszy `G19` to 16/18, nie 11/18 | NAPRAWIONE (odbiorem, dwukrotny pomiar na czystej bazie) | `ODBIOR_DYZUROW_286_290_291_20260903.md` §2.3 |
| J3 | `git merge-tree` w starej formie (bez `--write-tree --messages`) daje **0 znaczników konfliktu** przy realnych konfliktach między gałęzią a linią integracyjną | Kontrola scalenia wyglądała na czystą, choć konflikty istniały — fałszywe „merge-clean” | NAPRAWIONE (procedura odbioru zmieniona) | `ODBIOR_DYZUROW_287_292_294_20260903.md` §„Kontrola scalenia” |
| J4 | `grep -c` na bardzo dużym wyjściu (setki tysięcy linii) zwrócił **pustą odpowiedź zamiast `0`** | Komenda licząca wystąpienia wyglądała na błąd/brak wyniku, mogła zostać odczytana jako „zero potwierdzone”, gdy w rzeczywistości komenda nie dokończyła się poprawnie | OTWARTE (unikać `grep -c` na wielkim wyjściu, weryfikować kod wyjścia) | odbiory nocy część 2, ustne przekazanie nadzorcy |
| J5 | Test enumeracji kontrolek (dyżur 295) zostaje **zielony po wypatroszeniu handlera** — dowodzi efektu tylko dla **12 z 226** sygnatur, resztę przepuszcza bez sprawdzenia efektu | „Zielony test” nie znaczy „kontrolka działa”; mianownik dowodu de facto 12/226, nie cały ekran | OTWARTE — do wzmocnienia w instrukcji 312 pozycja (e) | `ODBIOR_DYZUROW_295_297_298_20260903.md` §„Rozbieżność 1” |
| J6 | Silnik raportu Oceny (dyżur 298): `save()` odrzuca obcego tenanta dopiero przez `get()` **PO** `INSERT` — po usunięciu warunku organizacji w mutacji odbiorcy obcy **nadpisał wiersz**, a `save()` mimo to zgłosiło „refused” (bo odczyt-po-zapisie i tak trafił na własny, świeżo nadpisany rekord) | Test bezpieczeństwa daje fałszywy spokój — blokada nie działa na poziomie zapisu, tylko przypadkiem na poziomie odczytu | OTWARTE — do naprawy w instrukcji 312 pozycja (f) | `ODBIOR_DYZUROW_295_297_298_20260903.md` §„Rozbieżność 3” |
| J7 | Dwóch robotników nocy złamało zakaz `pkill`/`git stash` — i **oba przypadki same to zgłosiły** w swoich raportach, bez próby ukrycia | Bez szkody dla wyniku (zgłoszone, nie zatajone), ale potwierdza że zakaz bywa łamany mimo reguły `Z27` obowiązującej od dyżuru 33 | ZAMKNIĘTE (zgłoszone samodzielnie, brak szkody) | raporty robotników nocy część 2 (ustne przekazanie nadzorcy) |
| J8 | Generator instrukcji dyżurów wkleja **opis zamiast komendy** w sekcji szablonu §0.2c | Wykonawca dostaje słowny opis kroku zamiast gotowej do wklejenia komendy — ryzyko własnej (błędnej) interpretacji zamiast literalnego wykonania | OTWARTE — naprawa szkieletu generatora zaplanowana jako pierwszy krok rana (§6 `PRZEKAZANIE_20260904.md`) | generator instrukcji dyżurów, ustne przekazanie nadzorcy |

**Dziewiąte, dodatkowe znalezisko własne (spoza listy przekazanej ustnie, zmierzone samodzielnie
podczas pisania tego rejestru):** oba łańcuchy nocne A i B (13 pozycji) zakończyły się STOP nie z
powodu braku treści instrukcji, tylko dlatego, że **push instrukcji 299–312 na
`github-backup/grafika/m03-20260902` (23:18–23:20) nastąpił 20–25 minut PO tym, jak łańcuchy już
zgłosiły STOP** (raporty STOP z 22:55–22:57). Świeży `git fetch github-backup --prune` w chwili
pisania tego wpisu potwierdza, że wszystkie 13 instrukcji są teraz obecne na tej gałęzi. Szczegóły,
dowód czasowy i wniosek („uruchomić łańcuchy ponownie”) w `PRZEKAZANIE_20260904.md` §3c.

## K. Incydent 04.09 04:35 — drzewo robocze m03 opróżnione

| # | Znalezisko | Skutek | Stan | Ślad |
| --- | --- | --- | --- | --- |
| K1 | `git status` w `/private/tmp/m03` pokazał **14 139 usuniętych plików śledzonych** (server/migrations 555, codex 314, services 262, tests/acceptance 153…), niezacommitowanych; HEAD i kopia nietknięte (0 0). Wykryte przez bezpiecznik: `initiativeRecordCanon` → `Cannot find module tests/setup.ts` („no tests” ≠ PASS). Przywrócone `git restore --source=HEAD --worktree -- .`, 29/29 testów. Sprawca nieustalony (między 00:25 a 04:35; w tym oknie biegły łańcuchy Codexa B/A i dyżur 312; inne worktree bez braków). | Merge’e docs w tym oknie przeszły, bo nie dotykały usuniętych ścieżek; każdy test uruchamiany z m03 dawałby fałszywe „no tests” | PRZYWRÓCONE; przyczyna OTWARTA | rejestr; reguła: `git status --short \| grep -c "^ D"` przed każdym scaleniem |

## L. Odbiory 302–312 (04.09 02:00–05:30)

Trzy sesje Opus (odbiór E: worktree `ag-odbior-e`; F: `ag-odbior-f`; G: `ag-odbior-g`) + jeden
odbiór WIP (296) na zacommitowanym stanie. Pełne dowody: `ODBIOR_DYZUROW_302_303_20260904.md`,
`ODBIOR_DYZUROW_304_305_306_20260904.md`, `ODBIOR_DYZUROW_307_311_312_20260904.md`,
`ODBIOR_DYZURU_296_WIP_20260904.md`. Skrót z werdyktem w `PRZEKAZANIE_20260904.md` §3d.

| # | Znalezisko | Skutek | Stan | Ślad |
| --- | --- | --- | --- | --- |
| L1 | **302** (B3 prawy panel Idei/Notatnika): 8/8 kadrów bit w bit identycznych z HEAD bez flagi, zero konsumentów produkcyjnych, dowód mutacyjny wartości domyślnej. Z flagą ON treść to 19–34 % dzisiejszego panelu (255–262 znaki vs 761–1344) — odpowiada na „jak” (`UW-07-18`), nie na „co” (`UW-07-17`). Angielskie `IDEA`/`NOTEBOOK` zaszyte poza `copy` | Bezpieczne do scalenia za flagą OFF; 4 pytania TAK/NIE do właściciela zanim ktokolwiek buduje dalej | SCALONE (`b3cd94ae3e`) za flagą OFF; treść czeka na decyzję właściciela | `ODBIOR_DYZUROW_302_303_20260904.md` |
| L2 | **303/B6** (preferencje Czatu — chipy sugestii): funkcja już istnieje (`fcb83a5f7d`, sprzed markera), 4 warstwy potwierdzone z dowodem widoczności (993→1176 znaków po otwarciu „Narzędzia AI”). Ale przełącznik jest **globalny**, właściciel prosił o „kontekstowo … tam, gdzie mamy plus” (`BACKLOG_UWAG_ODBIORU_20260902.md:156`, `TRIAZ_UWAG_20260902.md:170`) | Raport nazwał to „cały odzyskany zakres funkcjonalny” — o jeden krok za daleko; B6 nie może być zamknięte bez odpowiedzi właściciela | SCALONE dokumentacyjnie (`d542b5600c`); **DO DECYZJI** (globalny wystarcza / dopisać per kontekst) | jw. |
| L3 | **304/R-14** (historia Czatu prywatna/organizacyjna): izolacja na `/api/conversations/search` potwierdzona dowodem mutacyjnym odbiorcy (RED na filtrze organizacji wyłączonym), ale zasługa jest kodu zastanego. R2 (resolver widoczności w jednym miejscu — dziś w 3) i R5 (prototyp panelu za flagą + 4 kadry) niewykonane | Rdzeń bezpieczeństwa dowiedziony; reszta zakresu instrukcji nie dowieziona | SCALONE (`1dad1f0abb`), notatka pomiarowa 0 kodu | `ODBIOR_DYZUROW_304_305_306_20260904.md` |
| L4 | **305/R-18/kontrakt kart**: STOP na prototypie (R3/R4) był **nieuzasadniony** — harness (`dev-render/screens/karta-initiative.tsx`) i flaga `ff_initiativeCardContract` (domyślnie OFF) już istniały w repo dla dokładnie wybranego typu. Odbiorca sam zrobił parę PRZED/PO: włączenie kontraktu kasuje **11 z 15 sekcji** karty Initiative (znikają grupy „Decyzje i ryzyko”, „Ludzie”), kod sam oznacza to `DO POTWIERDZENIA PIOTRA`. Rozjazd 7 typów dokumentu vs 11 archetypów §13.1 (przecięcie 4) nierozstrzygnięty | Największe pojedyncze znalezisko nocy część 3 dla produktu — pytanie prosto do właściciela, zrzuty gotowe | SCALONE (`30e85139b9`), dokument nie prototyp; **DO DECYZJI** (czy 4 sekcje zamiast 15 są akceptowalne) | jw.; zrzuty `evidence/grafika/odbior-f-305-kontraktOFF/`, `…kontraktON/` |
| L5 | **306/R-20** (SWOT dwa etapy): fail-closed potwierdzony dowodem mutacyjnym, ale **`src/toolPacks/` (warstwa nowych etapów) nie ma ani jednego konsumenta w runtime** — 4 niezależne sprawdzenia zerowe; flaga ON/OFF daje bitowo identyczne zrzuty, bo realny warsztat SWOT czyta `DiscoveryTools/toolCompletion.ts` (union 5 kroków), nie `toolPacks`. Raport twierdził „nie ma biblioteki bez wywołania” o sąsiednim katalogu (`src/config/swot/`) i uogólnił na własną robotę | 11. kształt fałszywego „gotowe” — o jeden katalog dalej niż patrzył pomiar | SCALONE (`2a0a658a14`) za flagą OFF, bez efektu; przewód do podłączenia jest warunkiem wszystkiego innego (R4/R5) | jw. |
| L6 | **296 WIP** (wycieki błędów tras): wcześniejszy odbiór na `HEAD` dał fałszywe „0/294 niewykonane” — 73 pliki leżały niecommitowane w worktree Codexa (zacommitowane przez odbiorcę). Regex instrukcji: 305→1. Regex szerszy tej samej rodziny: 396→**55**, z czego **35 to realne wycieki HTTP, które zostały** (`table-platform.routes.ts` 28, `data-collection.routes.ts` 7 — poza zakresem dyżuru). Guard 312 miał ślepą plamkę identyczną z regexem codemodu (naprawiona). Klasy błędów domenowych nie dziedziczą `AppError` → ~341 komunikatów biznesowych na generyk angielski; `req`=`undefined` wszędzie → polskie komunikaty nigdy się nie uruchamiają | Bezpieczeństwo poprawione (dyżur usuwa 341/396 wystąpień), ale rodzina niedomknięta + realna regresja UX komunikatów | SCALONE Z ZASTRZEŻENIEM (`b305261454`); ratchet długu 35 wpięty | `ODBIOR_DYZURU_296_WIP_20260904.md`; pamięć `robota-niecommitowana-w-worktree` |
| L7 | **307** (przelot cross-org): dyżur skończył się w trakcie odbioru (04:22→04:35). Mianownik zgodny (2725 tras), objęte 1904, ale **rozstrzygniętych tylko 75 (3,9 %)** — reszta `NIEZWERYFIKOWANA`, potwierdzone niezależnym przelotem 944 tras (identyczny rozkład kodów dla obcego i właściciela — para pusta nie odróżnia izolacji od pustki). Luka `GET /api/pmo/tasks/workload/<cudzy>` (200 zamiast 404 dla obcego) potwierdzona i naprawiona z dowodem mutacyjnym. Bramka finansów `abe50dddc2` **dubluje** `e9a3cfb983` już na HEAD — źródło obu konfliktów scalenia | „1904 objęte” nie może być czytane jako „1904 sprawdzone”; naprawa workload dobra, ale uwięziona za konfliktem | **NIE SCALONE** — 2 konflikty (`financeStatementMountedSurface.ts`, `v8/index.ts`); przy scalaniu zachować HEAD, odrzucić duplikat 307 | `ODBIOR_DYZUROW_307_311_312_20260904.md` |
| L8 | **311** (crimson w Czacie): kod dobry — 674→17 wystąpień `primary-` w `src/components/AIChat`, tylko 7 to realne klasy wizualne, wszystkie fokus/hover (zero semantyki krytycznej ruszone), scalenie nie cofa dyżuru 287. **Ale 10 z 16 par zrzutów PRZED/PO jest bajtowo identycznych, 4 z 8 wybranych ekranów mają zero pikseli crimson przed i po** — zły dobór ekranów do pokazania | Właściciel nie miałby czego ocenić na tym zestawie zrzutów — decyzja C wymaga akceptu na zrzutach | **NIEGOTOWE DO POKAZANIA** — dobrać ekrany z realną masą crimson (`AIActionCard`, `MessageRenderer`, `ResearchProgress`, `AgentSuggestionCard`, `ComparisonMatrixRenderer`, `OrganizationMemoryPanel`, `V8ArtifactRunControl`) i powtórzyć | jw. |
| L9 | **312** (domknięcia po odbiorach): jedyny produkt kodowy całego dyżuru = 1 commit guardu (`89619c1adf`, na gałęzi 296). **5 z 6 pozycji nierozpoczęte** (297, 293, 292 R3–R6, 298, 295); pozycja 296(a) PARTIAL ze STOP-em merytorycznym. STOP potwierdzony żywym pomiarem: **8 tras zwracają 500 zwykłemu użytkownikowi, 3 z nich surowy SQL ze stosem i ścieżką dyskową** (`group_concat` — SQLite na Postgresie; `column "coverage_percent" does not exist` — rozjazd schematu na bazie migrowanej od zera, nie artefakt środowiska). Efekt uboczny: `/api/admin/health-panel/probes` oddaje katalog 20 sond diagnostycznych każdemu zalogowanemu OWNER bez kontroli | Decyzja o niescalaniu WIP 296 (Z1) była słuszna — rodzina wycieków żyje na produkcji | **NIEGOTOWE** — scalać co najwyżej sam raport; 8 tras 500 to osobny dyżur naprawczy | jw. |
| L10 | **Łańcuch A nigdy nie wystartował** (nie „urwał się na 307”): wszystkie 7 pozycji (307/310/309/301/299/308/300) STOP 22:55–22:57 03.09 — instrukcje doszły na `github-backup` dopiero 23:03:47, 8 min PO tym jak łańcuch ich szukał. Dziś ten sam plik na tym samym refie otwiera się bez błędu (sprawdzone). Dyżur 307 w wierszu L7 to osobne, ręczne uruchomienie 01:43–04:35, nie produkt łańcucha | Wniosek operacyjny: łańcuchy nocne muszą sprawdzać obecność instrukcji na refie przed startem, albo startować dopiero po potwierdzonym pushu | DO WKLEJENIA OD NOWA — bez 307: `299, 300, 301, 308, 309, 310` | jw. |
