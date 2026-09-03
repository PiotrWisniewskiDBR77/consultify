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
