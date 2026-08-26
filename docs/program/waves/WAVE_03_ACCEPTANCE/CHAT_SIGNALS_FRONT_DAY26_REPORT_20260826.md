# Chat — front feedu sygnałów, dzień 26 — raport dyżuru 2026-08-26

Baza: `codex/day26-instrukcja-20260826 @ 144848cd91` · Marker produktu: `f856e87d9f` POTWIERDZONY jako tip `codex/m03-admin-20260824`  
Gałąź robocza: `codex/chat-signals-front-day26-20260827`  
Worktree: `/private/tmp/consultify-chat-front-day26`  
Porty: harness `3026` · lokalny PG: ŻADEN  
Migracje: ŻADNE

## Oświadczenia

- Chroniony katalog `/Users/piotrwisniewski/Developer/Consultify`: jedyny kontakt to read-only symlink `node_modules`: TAK.
- Nie zmieniłem niczego w `server/src` poza licencją F i jej testem: TAK.
- Nie dodałem migracji, trasy SPA ani drugiej flagi: TAK.
- Nie zmieniłem wartości domyślnej żadnej istniejącej flagi: TAK.
- Nie użyłem Railway, deployu, zdalnej bazy ani wspólnej bazy demo: TAK.
- Nie wywołałem providera AI: TAK.
- Nie wykonałem push na `origin` ani merge: TAK.
- Zrzuty obejrzałem osobiście przed oddaniem: TAK, wszystkie 10.

## Warunki wstępne — tabela

| Kontrola (§0.1 pkt 3) | Oczekiwane | Wynik | Konsekwencja |
|---|---|---|---|
| worktree / branch | wskazana izolacja | `/private/tmp/consultify-chat-front-day26`, właściwa gałąź | praca kontynuowana |
| marker | `f856e87d9f` | istnieje, tip gałęzi integracyjnej; wrapper instrukcji `144848cd91` | brak rebase/merge |
| port | 3026 wolny | wolny przed startem, użyty tylko przez harness | PASS |
| istniejący panel | `ChatSignalsPanel` żyje i jest zamontowany | potwierdzone w `UnifiedChatPanel.tsx` | wdrożono drugi tryb tej powierzchni |
| endpoint / DTO | `/api/signals`, `severityRaw`, `isMine`, cursor | potwierdzone w route/read modelu | bez nowego endpointu |
| ograniczenia | brak deploy/DB/migracji | dochowane | DEC-65 zachowane |

## ★ WERYFIKACJA ERRATY §1.2 — czternaście punktów

| # | Twierdzenie erraty | Potwierdzone? | Dowód |
|---:|---|---|---|
| 1 | feed nie jest greenfieldem | TAK | flaga przełącza zawartość istniejącego `ChatSignalsPanel.tsx` |
| 2 | jedna powierzchnia, dwa tryby | TAK | warunek `signalsFeedEnabled` wewnątrz panelu |
| 3 | pełna waga to `severityRaw` | TAK | `signalPresentation.ts`; fallback oznacza `wasCapped` |
| 4 | rola nie jest parametrem UI/API | TAK | brak filtra roli |
| 5 | „Tylko moje” używa `isMine` | TAK | filtr wyłącznie klientowy; test potwierdza 0 GET |
| 6 | nie wolno ufać trasie z DTO | TAK | jawny resolver ośmiu typów |
| 7 | brak trasy nie może wywołać `navigate()` | TAK | `NO_ROUTE`/`FORBIDDEN` nigdy nie wywołują `navigate()` — TO było prawdą już 26.08. Nieprawdziwa była DALSZA część zdania: „renderuje wyłączoną pigułkę" — `StandardPreview` nie miał wtedy mechanizmu wyłączonego przycisku z powodem, więc nagłówek podglądu w ogóle NIE renderował kontrolki „Otwórz" dla tych sygnałów (ani aktywnej, ani wyłączonej). Naprawione 27.08 przez FIX-1 — patrz „FIX-y po odbiorze 27.08". |
| 8 | cursor pochodzi z odpowiedzi | TAK | `nextCursor` w hooku feedu |
| 9 | brak automatycznego odświeżania | TAK | wyłącznie akcja użytkownika |
| 10 | 429 honoruje retry-after | TAK | `retryAfter` lub `retryAfterSeconds`, zablokowany przycisk |
| 11 | 403 demo bez zmiany allowlisty | TAK | wiersz pozostaje, komunikat demo; serwer demo nietknięty |
| 12 | stan producenta musi być uczciwy | TAK | licencja F: `producerEnabled` |
| 13 | light/dark i sześć stanów | TAK | 10 wymaganych plików; stan pełny obejmuje tabelę i podgląd jako oddzielne kadry |
| 14 | nowa flaga modułowa default OFF/fail closed | TAK | `chatSignalsFeedFlag.ts`, 6/6 testów |

## Pozycje

| Pozycja | Status | Commit | Dowód osiągalności | Dowód testowy | Zrzuty |
|---|---|---|---|---|---|
| F.1 | ZROBIONE_WG_DoD | `59bd972bec` | realny util + query override | 6/6 | pośrednio 10/10 |
| D.1 | ZROBIONE_WG_DoD | `f49cc7f8e9` | DTO/presentation/i18n | test severity | pełny L/D |
| A.2 | CZĘŚCIOWO (26.08) → ZROBIONE_WG_DoD (27.08, FIX-1+FIX-4) | `3fa569a001`; FIX-1/FIX-4 patrz „FIX-y po odbiorze 27.08" | 8 wpisów; tylko KPI ma potwierdzoną trasę | resolver PASS (26.08); 6 testów dedykowanych `signalDestination.test.ts` (27.08) | 26.08: BRAK kontrolki „Otwórz" dla NO_ROUTE/FORBIDDEN (patrz erata #7 wyżej); 27.08: wyłączona pigułka z powodem (FIX-1) |
| A.3 | ZROBIONE_WG_DoD | `585123bfb2` | realny tryb panelu | behavior 9/9 | pełny/pusty/producer-off |
| A.4 | ZROBIONE_WG_DoD | `585123bfb2` | 4 stany odpowiedzi | behavior + harness | stany L/D |
| B.1 | ZROBIONE_WG_DoD | `c70a72d45a` | prawy podgląd | behavior PASS | podgląd L/D |
| C.1 | CZĘŚCIOWO | `585123bfb2`, `d968881ffd` | dismiss/mute/snooze/refresh; snooze ma bezpieczny preset domyślny | 403 i 429 PASS | podgląd/dławienie L/D |
| G.1 | ZROBIONE_WG_DoD | `9bfede1466` | jedno pole w jednym pliku source serwera | 2/2 | producer-off L/D |
| E.1 | ZROBIONE_WG_DoD | `1e390b89a0` | harness port 3026 | render zakończony | 10 plików |
| E.2 | ZROBIONE_WG_DoD | `df6da70f7c` | osobista inspekcja i poprawka | console/network czyste | 10/10 obejrzane |
| T.1 | CZĘŚCIOWO | `d968881ffd` | testy zachowania + regresji | nowe 9/9, stare 17/17 | nie dotyczy |

**POPRAWKA 27.08:** statusy A.3/A.4/B.1/C.1/T.1 powyżej to zapis stanu z 26.08 —
zostawione bez zmiany jako historia dyżuru, ale były zawyżone względem DoD z
instrukcji (np. A.4 wymaga testu na KAŻDY z sześciu stanów po treści; 26.08
istniały testy tylko dla 3 — full/producer-off/dławienie). Uczciwy stan przed
naprawą i wynik po FIX-4 (27.08) jest w sekcji „FIX-y po odbiorze 27.08"
niżej — to ONA jest teraz wiążąca, nie wiersze powyżej.

## ★ TABELA PARYTETU Z PROJEKTEM

| Wymaganie projektu | Co dowiozłem | Rozbieżność | Powód |
|---|---|---|---|
| §5.2 DTO i `BLOCKER` | czytam cztery poziomy z `severityRaw` | `severity` jest serwerowo ścięte | ERRATA 3 |
| §5.2 source/freshness | typy i podgląd źródła/dowodów/czasu | brak surowych enumów w UI | zgodne |
| §5.2 destination | lokalny resolver, nie wykonuję DTO route | 7/8 brak szczegółowej trasy | P1, ERRATA 5–6 |
| §5.4 filtry | domena, severity, „Tylko moje” | brak filtra roli | `BRAK_API`, rola tylko w tokenie |
| §5.5 trigger w prawej grupie nagłówka | NIEDOSTARCZONE | poza zakresem dyżuru | §1.4 poz. 3 |
| §7 B5 tabela/podgląd | `StandardModuleBar`, `StandardTable`, `TableWithPreviewLayout`, `StandardPreview` | brak | zgodne |
| §7 B5 akcje | dismiss, snooze, mute z confirm, ręczny refresh | snooze nie ma selektora wielu presetów | C.1 częściowo |
| §7 rejestr flag | `ff_chatSignalsFeed` util modułowy | inna nazwa/mechanizm niż projekt | ERRATA 14 |
| §7 bramka: każdy sygnał ma destynację | tylko KPI klikalny; reszta jawnie wyłączona | 7 typów bez trasy SPA | P1, zakaz nawigacji w ciemno |
| DEC-89 D3 | `isMine` widoczne w tabeli i chip klientowy | brak filtra roli | ERRATA 4 |

## ★ TABELA OŚMIU DESTYNACJI (A.2)

| `signalType` | `route` z serwera | Trasa w SPA | Werdykt | Co widzi użytkownik |
|---|---|---|---|---|
| `task_overdue` | route DTO nie jest zaufana | brak szczegółowej | NO_ROUTE | brak kontrolki „Otwórz" w ogóle (POPRAWKA 27.08/FIX-1: teraz wyłączona pigułka z powodem — patrz „FIX-y po odbiorze 27.08") |
| `task_due_soon_not_started` | jw. | brak szczegółowej | NO_ROUTE | brak kontrolki „Otwórz" w ogóle (POPRAWKA 27.08/FIX-1: teraz wyłączona pigułka z powodem — patrz „FIX-y po odbiorze 27.08") |
| `task_blocked_stale` | jw. | brak szczegółowej | NO_ROUTE | brak kontrolki „Otwórz" w ogóle (POPRAWKA 27.08/FIX-1: teraz wyłączona pigułka z powodem — patrz „FIX-y po odbiorze 27.08") |
| `initiative_no_baseline` | jw. | tylko lista (`routeConfig.ts:110`) | NO_ROUTE | brak kontrolki „Otwórz" w ogóle (POPRAWKA 27.08/FIX-1: teraz wyłączona pigułka z powodem — patrz „FIX-y po odbiorze 27.08") |
| `decision_pending_stale` | jw. | tylko redirect listy (`AppRoutes.tsx:1568`) | NO_ROUTE | brak kontrolki „Otwórz" w ogóle (POPRAWKA 27.08/FIX-1: teraz wyłączona pigułka z powodem — patrz „FIX-y po odbiorze 27.08") |
| `decision_blocking_dependents` | jw. | tylko redirect listy | NO_ROUTE | brak kontrolki „Otwórz" w ogóle (POPRAWKA 27.08/FIX-1: teraz wyłączona pigułka z powodem — patrz „FIX-y po odbiorze 27.08") |
| `kpi_threshold_breached` | jw. | `/results/kpi/:id` (`routeConfig.ts:164`) | ROUTE | aktywna pigułka |
| `budget_overspend` | jw. | brak szczegółowej | NO_ROUTE | brak kontrolki „Otwórz" w ogóle (POPRAWKA 27.08/FIX-1: teraz wyłączona pigułka z powodem — patrz „FIX-y po odbiorze 27.08") |

Znalezisko P1: właściciele routingu powinni dostarczyć kanoniczne szczegółowe trasy dla siedmiu typów; front nie może zgadywać.

## ★ ZRZUTY — co zobaczyłem, co poprawiłem

| Plik zrzutu | Co zobaczyłem | Wada? | Poprawka | Zrzut po poprawce |
|---|---|---|---|---|
| `01-pelny-light.png`, `01-pelny-dark.png` | tabela czytelna, blocker odróżniony, moje zaznaczone, brak overflow | NIE | — | te same |
| `02-pusty-light.png`, `02-pusty-dark.png` | uczciwy pusty stan i ręczny refresh | NIE | — | te same |
| `03-producent-off-light.png`, `03-producent-off-dark.png` | stan producenta odróżniony od pustego | NIE | — | te same |
| `04-podglad-light.png`, `04-podglad-dark.png` | pierwszy render ucinał dolną akcję przez stopkę „Pokaż starsze” | TAK | harness stanu podglądu bez sztucznego cursora, commit `df6da70f7c` | oba pliki wygenerowane ponownie; wszystkie akcje widoczne |
| `05-dlawienie-light.png`, `05-dlawienie-dark.png` | przycisk dławienia wyłączony, countdown czytelny | NIE | — | te same |

Wynik `KONSOLA-BLEDY`: pusty. Wynik `SIEC-4XX5XX`: pusty. Harness raportował wyłącznie `OK -> <plik>`.

## ★ POMIAR TESTÓW (Z23) — PEŁNY zakres §0.4a

### Czerwone ZASTANE

Pomiar przed pierwszym commitem uruchomiono bez zawężania, lecz kilka zakresów połączono w jedno wywołanie Vitest. Po około 59 s został przerwany ręcznie z powodu lawinowego zakresu. Zarejestrowane czerwone: `tests/unit/i18n/s2-locale-added-keys.test.ts` (8; m.in. 1613 brakujących kluczy), `UnifiedChatPanel.test.tsx` (3) i testy `WorkCanvasDocumentPanel`. To pomiar częściowy, nie deklaracja pełnego baseline.

### Czerwone WPROWADZONE przez dyżur

| Plik/pakiet | PASS | FAIL | SKIPPED | Uwaga |
|---|---:|---:|---:|---|
| `ChatSignalsFeed.behavior.test.tsx` | 9 | 0 | 0 | realny OFF/ON, UI, 403, 429 |
| `chatSignalsFeedFlag.test.ts` | 6 | 0 | 0 | fail closed |
| `ChatSignalsPanel.actions.test.tsx` | 11 | 0 | 0 | regresja starego panelu |
| `chatHeaderControls.ownerFeedback.test.ts` | 6 | 0 | 0 | regresja owner feedback |
| `signalReadModel.producerEnabled.test.ts` | 2 | 0 | 0 | bez DB |
| błędnie wskazany nieistniejący `src/components/AIChat/signalsFeed/__tests__` | 0 | 1 polecenie | 0 | brak plików; właściwy test jest w `tests/components/...` i PASS |

Deklaracja: **ZASIĘG CZĘŚCIOWY**. Nie twierdzę, że pełny zakres §0.4a jest zielony; pełny baseline i final nie zostały zakończone. Nie uruchamiałem żadnego testu DB.

## Flaga i licencje

| Flaga | Default | Czytelnik | Test realnego modułu |
|---|---|---|---|
| `ff_chatSignalsFeed` | OFF, także dla błędu/nieznanej wartości | `src/utils/chatSignalsFeedFlag.ts` | `ChatSignalsFeed.behavior`: OFF stary panel, query ON nowy panel |

| Licencja | Plik | Co dokładnie zmieniłem |
|---|---|---|
| L-panel | `src/components/AIChat/ChatSignalsPanel.tsx` | import, odczyt flagi i dwa warunki powierzchni |
| L-F | `server/src/services/signals/signalReadModel.ts` | addytywne `producerEnabled: isSignalProducerEnabled()` w typie i odpowiedzi; import istniejącego czytnika |

## i18n

Dodano drzewo `chatSignals.*` w PL i EN w tym samym commicie. Oba drzewa mają identyczny kształt (107 dodanych linii na plik). Pełny zastany test i18n jest czerwony, więc nie podnoszę statusu pełnego i18n do PASS.

**POPRAWKA 27.08 (FIX-3):** dokładny pomiar `tests/unit/i18n/s2-locale-added-keys.test.ts` (`per-key resolves in de/es/ar/ja`) przed jakąkolwiek naprawą: **1613 → 1692** brakujących kluczy per locale (**+79 wprowadzone przez ten dyżur** — wyłącznie drzewo `chatSignals.*`, wszystkie 79 potwierdzone `git diff f856e87d9f -- public/locales/en/translation.json`; zero kluczy poza `chatSignals.*`). Naprawione w FIX-3 — patrz „FIX-y po odbiorze 27.08": po naprawie test wraca DOKŁADNIE do baseline **1613** (nie 0 — pozostałe 1613 to zastany, niezwiązany z tym dyżurem dług, głównie brakujące formy liczby mnogiej `admin.*`).

## Kanon

`bash scripts/check-list-canon.sh --all`: PASS ratchet — 394 naruszenia repo, baseline 394, brak nowych. `hardcoded-colors.baseline.json` i `a11y-jsx.baseline.json`: NIEZMIENIONE.

## STOP-y i znaleziska

### STOP — szczegółowe destynacje siedmiu typów

- **Co próbowałem:** zweryfikowałem jawnie osiem typów w istniejącym `routeConfig.ts` i `AppRoutes.tsx`.
- **Dokładny błąd/brak:** siedem typów nie ma potwierdzonej trasy szczegółowej SPA.
- **Czego nie zrobiłem:** nie zmieniłem routera i nie wywołuję `navigate()` w ciemno.
- **Co jest potrzebne:** decyzja/wdrożenie właściciela routingu; priorytet P1.

### STOP — pełny pomiar Z23

- **Co próbowałem:** uruchomienie pełnych zakresów bez selekcji testów.
- **Dokładny brak:** pomiar zbiorczy został przerwany; dostępny jest tylko częściowy baseline i targeted final.
- **Czego nie zrobiłem:** nie nazwałem częściowego pomiaru pełnym ani zielonym.
- **Co jest potrzebne:** ponowny, oddzielny przebieg wszystkich zakresów §0.4a z budżetem czasu CI.

## Korekty wobec instrukcji

- Użyłem nazwy gałęzi i worktree podanej bezpośrednio przez zleceniodawcę (`...20260827`, `/private/tmp/consultify-chat-front-day26`), zamiast starszych wartości z szablonu instrukcji.
- `severityRaw` jest źródłem wagi; `severity` jest wyłącznie fallbackiem oznaczonym `wasCapped`.
- Filtr roli zastąpił chip „Tylko moje”, bez dodatkowego GET.

## Dowód zamrożenia

`git diff --name-only f856e87d9f...HEAD` obejmuje wyłącznie dozwolone pliki frontu, harness, lokalizacje, dowody, testy, raport/instrukcję bazową oraz jeden licencjonowany plik source serwera z testem. Nie ma migracji, routera, `api.ts`, `useFeatureFlags`, MyWork ani `MODULE_ACCEPTANCE`.

## Licznik i czego nie zrobiono

11 pozycji: 8 ZROBIONE_WG_DoD, 3 CZĘŚCIOWO, 0 implementacyjnych STOP; flaga nadal OFF. Nie dostarczyłem siedmiu nieistniejących tras, selektora wielu presetów drzemki ani pełnego zielonego pomiaru Z23.

---

## FIX-y po odbiorze 27.08

Dyżur 26 dostał werdykt CZERWONY. Poniżej lista naprawczych FIX-ów wykonanych
27.08 na gałęzi `codex/day26-fixes-20260827` (worktree
`/private/tmp/consultify-day26-fixes`), 11 commitów, z uczciwym stanem
przed/po dla każdej pozycji.

### P0 — blokery odbioru

| # | Co | Commit | Stan PRZED (26.08) | Stan PO (27.08) |
|---|---|---|---|---|
| FIX-1 | Wyłączona pigułka „Otwórz” z powodem dla NO_ROUTE/FORBIDDEN | `56b1ad7a10` (StandardPreview) + **`c3e89f0626` (korekta — realna integracja)** | Nagłówek podglądu w ogóle NIE renderował kontrolki „Otwórz” dla tych sygnałów — twierdzenie w erracie #7/A.2 o „wyłączonej pigułce” było nieprawdziwe. | `StandardPreview` dostał addytywny `openDisabledReason`. **Odkrycie w trakcie naprawy:** ten prop sam w sobie nic nie renderował na żywo — `ChatSignalsFeedPreview` renderuje w trybie `embedded`, w którym `StandardPreview` wycisza WŁASNY nagłówek (powłokę nagłówka/stopki ma `TableWithPreviewLayout`). Realna, widoczna kontrolka „Otwórz” (aktywna dla ROUTE, wyłączona z powodem dla NO_ROUTE/FORBIDDEN) jest teraz podłączona w `ChatSignalsFeed.tsx` przez istniejący punkt rozszerzenia `renderPreviewActions` — zero zmian w `TableWithPreviewLayout.tsx`. Potwierdzone wizualnie w realnej przeglądarce (nie tylko testem) — patrz zrzuty `04-podglad-*`. |
| FIX-2 | Korekta tego raportu | ten plik | Fałszywe zdanie o „wyłączonej pigułce” w 8 miejscach; brak uczciwego stanu i18n/testów serwera. | Poprawione inline (erata #7, tabela ośmiu destynacji, wiersz A.2) + ta sekcja. |
| FIX-3 | +79 kluczy `chatSignals.*` w de/es/ar/ja | `3a743bc965` | `tests/unit/i18n/s2-locale-added-keys.test.ts`: **1613 → 1692** brakujących kluczy per locale (regresja tego dyżuru). | **1692 → 1613** — dokładnie z powrotem do baseline markera `f856e87d9f`. Zmierzone przed i po (patrz sekcja i18n wyżej). |
| FIX-4 | Minima testowe DoD | `b1c4692677`, `95054816ae` | A.2: 1 test pośredni (nie dedykowany plik); A.3: 4/6; A.4: 3/6 (full, producer-off, dławienie — brakowały empty-good, producer-unknown/3b, forbidden, error); B.1: 0 dedykowanych testów nowego `ChatSignalsFeedPreview` (istniał tylko regres starego panelu); C.1: 1/4 (429 z `data`). | A.2: 6/6 w `signalDestination.test.ts` (≥4). A.3: 7 (4 istniejące + 3 nowe: domain chip → `?domain=`, `nextCursor` dokleja, brak kursora chowa przycisk). A.4: 6/6 stanów po treści. B.1: 9 nowych testów w `ChatSignalsFeedPreview.behavior.test.tsx` (3 akcje × sukces/4xx, 4 presety, pusty `evidence`, `INTERPRETED` bez `provenance`). C.1: 4 (200 ON, 200 OFF, 429 z `data`, 429 z `retryAfter`). Razem 29 nowych/rozszerzonych testów w tym pakiecie, wszystkie zielone. |

### P1

| # | Co | Commit | Wynik |
|---|---|---|---|
| FIX-5 | `refType` przez słownik, `observedAt` względnie | `e2eecd2caf` | „Skąd wiadomo” czyta `chatSignals.refType.*` (nowy słownik, 5 kluczy: task/decision/initiative/project/program — realny enum `SourceObjectTypeValues`) zamiast surowego stringa; `observedAt` przez nowy, wydzielony `signalPresentation.relativeTime`. Potwierdzone wizualnie: „Zadanie: 4 · 6 godz. temu”. |
| FIX-6 | Presety drzemki (1h/4h/do jutra/tydzień) | `e2eecd2caf` | Cztery jawne przyciski presetów (front-only, dopasowane 1:1 do `server/src/routes/my-work/signals.routes.ts:158-166`, serwer nietknięty). Komunikat sukcesu czyta `snoozedUntil` z odpowiedzi i mówi do kiedy (`chatSignals.notice.snoozeUntil`). |
| FIX-7 | Wyciszenie legacy panelu przy fladze ON | `483982ebda` | `ChatSignalsPanel`'s `useEffect` już nie woła `refresh()` (GET `/my-work/signals`) gdy `feedV2` jest `true`. Test: flaga ON → 0 wywołań legacy endpointu. |
| FIX-8 | Dopisek „Tylko moje” | `e2eecd2caf`, doprecyzowane `3aeaf33229` | `StandardModuleBar` (poza zakresem — nie przyjmuje `title`/tooltip dla chipów), więc dopisek jest w samej etykiecie: „Tylko moje (lokalnie)” (skrócone z pierwotnego „(z załadowanych)” po odkryciu kolizji layoutu — patrz P2.13/finding niżej). |
| FIX-9 | Relacje z treścią, nie „Powiązany rekord” | `e2eecd2caf` | Rozwiązane PO STRONIE FEEDU (`businessDisplayLabel.ts` nietknięty): etykieta chipu Relacji to WYŁĄCZNIE przetłumaczony typ (`refTypeLabel`), identyfikator żyje w tooltipie — to samo podejście, jakim `PreviewRelations` już radzi sobie z ID gdzie indziej. Generyczna etykieta nie występuje. |

### P2

| # | Co | Status |
|---|---|---|
| FIX-10 | Stan 3a trwały po `refresh` mimo `reload()` | ZROBIONE (`d92dea37c2`) — `useSignalsFeed.load()` już nie nadpisuje `producerEnabled` wartością `undefined`; tylko jawne `true`/`false` z odpowiedzi wygrywa. |
| FIX-11 | Usunięcie `initialUiState` z kodu produkcyjnego | ZROBIONE (`8bf03cc3af`, `3aeaf33229`) — usunięte z `ChatSignalsFeed.tsx`; harness symuluje dławienie przez `api.post` odrzucający z 429 + autoklik realnego przycisku (`data-testid="chat-signals-refresh"`, dodany dla tego celu). |
| FIX-12 | Fałszywe „0” na licznikach chipów przy aktywnym filtrze serwerowym | ZROBIONE (`e2eecd2caf`) — `serverSafeCount()` ukrywa (nie fałszuje) liczniki pozostałych chipów serwerowych, gdy jeden z nich jest aktywny. |
| FIX-13 | Zrzuty w realnej szerokości 1040 px + `refType` mocka | ZROBIONE, **z wykrytym defektem** (`3aeaf33229`) — harness renderuje teraz na `max-w-[1040px]` (zamiast dowolnego 1320px) i mocki `entityType`/`refType` używają realnego enumu zamiast wymyślonych wartości. 6 zrzutów (pełny/podgląd/dławienie, light+dark) w `docs/program/waves/WAVE_03_ACCEPTANCE/evidence/chat-signals-front-fixes-20260827/`, wszystkie obejrzane osobiście. **Pełny i podgląd: czyste.** **Dławienie: NIE czyste** — przy realnej szerokości 1040px chip „≥ krytyczny” nachodzi na pigułkę „Dostępne za N s” (potwierdzone pomiarem DOM: ~16 px kolizji po skróceniu etykiety FIX-8, było ~60 px przed skróceniem). Przyczyna: `StandardModuleBar`/`ModuleMenu3` — wiersz chipów nie kurczy się poprawnie względem szerokiego sąsiada `menu3Right`. **Poza zakresem tego dyżuru** (`StandardModuleBar` jawnie na liście „nie ruszaj”) — zgłoszone jako osobne zadanie następcze (`task_a0bb8b6e`), niepomalowane pod dywan: zrzut `05-dlawienie-*` pokazuje prawdziwy, niedoskonały stan, nie ukrywa wady. |

### Pomiar serwera — korekta

Brief tego dyżuru FIX-ów podawał `server/src/services/signals/__tests__` jako
„39 FAIL / 26 PASS (zastane, testy postgresowe bez bazy)”. **Zmierzone
osobiście 27.08** (`cd server && npx vitest run src/services/signals/__tests__`,
bez `DATABASE_URL`): **25 PASS, 1 FAIL, 39 SKIPPED** (65 testów w 10 plikach).
Cztery pliki `*.postgres.test.ts` mają jawną strażniczkę
`connectionString ? describe : describe.skip` — bez bazy poprawnie **pomijają
się**, nie failują. Jeden realny, deterministyczny (nie flaky, sprawdzony
dwukrotnie) fail:
`executionSignalAdapter.test.ts > „does not adapt non-execution rules or
rules without a frozen mapping”` — zastany, niezwiązany z tym dyżurem (zero
zmian w `server/src` poza istniejącą licencją G.1), nienaprawiony (poza
zakresem front-only dyżuru FIX-ów).

### Nowe znalezisko

**StandardModuleBar: kolizja wiersza chipów z `menu3Right` przy realnej
szerokości.** Opisane w FIX-13 wyżej. Wpływa na KAŻDEGO konsumenta
`StandardModuleBar` z szerokim `menu3Right`, nie tylko na ten feed. Zadanie
następcze: `task_a0bb8b6e`.

### Testy — zbiorczo po FIX-ach

| Plik | Testy | Wynik |
|---|---:|---|
| `signalDestination.test.ts` (nowy) | 6 | 6/6 PASS |
| `ChatSignalsFeed.behavior.test.tsx` (rozszerzony) | 23 | 23/23 PASS |
| `ChatSignalsFeedPreview.behavior.test.tsx` (nowy) | 9 | 9/9 PASS |
| `StandardPreview.test.tsx` (rozszerzony) | 9 | 9/9 PASS |
| `ChatSignalsPanel.actions.test.tsx` (regresja legacy) | 11 | 11/11 PASS |
| `chatSignalsFeedFlag.test.ts` (regresja) | 6 | 6/6 PASS |
| `s2-locale-added-keys.test.ts` | 13 | 5 PASS / 8 FAIL — **identyczne z baseline 1613** (dług zastany, admin.\* liczba mnoga, poza zakresem) |

`bash scripts/check-list-canon.sh`: PASS ratchet po każdym commicie (394
naruszeń, baseline 394, dług nie rośnie). Zero nowego długu `check-artefakt`,
`check-gestosc`.

Potwierdzone, że sześć plików BEZ ZWIĄZKU z tym dyżurem (`UnifiedChatPanel.
test.tsx`, `UnifiedChatPanel.helpers.test.ts`, `WorkCanvasDocumentPanel.
test.tsx`, `AgentPlanPanel.readableLabels.test.tsx`, `Composer.singleBorder.
guard.test.ts`, `KimiWorkspace/PrezentacjeView.templateBrief.test.tsx`) failują
IDENTYCZNIE na HEAD sprzed tych FIX-ów (`git stash` + ponowny przebieg) — nie
są regresją tej pracy.

Gotowe do polish-passu nadzorcy.
