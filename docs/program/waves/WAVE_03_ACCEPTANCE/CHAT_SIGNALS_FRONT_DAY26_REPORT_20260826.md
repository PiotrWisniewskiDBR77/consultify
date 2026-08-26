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
| 7 | brak trasy nie może wywołać `navigate()` | TAK | `NO_ROUTE` renderuje wyłączoną pigułkę |
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
| A.2 | CZĘŚCIOWO | `3fa569a001` | 8 wpisów; tylko KPI ma potwierdzoną trasę | resolver PASS | pigułki w podglądzie |
| A.3 | ZROBIONE_WG_DoD | `585123bfb2` | realny tryb panelu | behavior 9/9 | pełny/pusty/producer-off |
| A.4 | ZROBIONE_WG_DoD | `585123bfb2` | 4 stany odpowiedzi | behavior + harness | stany L/D |
| B.1 | ZROBIONE_WG_DoD | `c70a72d45a` | prawy podgląd | behavior PASS | podgląd L/D |
| C.1 | CZĘŚCIOWO | `585123bfb2`, `d968881ffd` | dismiss/mute/snooze/refresh; snooze ma bezpieczny preset domyślny | 403 i 429 PASS | podgląd/dławienie L/D |
| G.1 | ZROBIONE_WG_DoD | `9bfede1466` | jedno pole w jednym pliku source serwera | 2/2 | producer-off L/D |
| E.1 | ZROBIONE_WG_DoD | `1e390b89a0` | harness port 3026 | render zakończony | 10 plików |
| E.2 | ZROBIONE_WG_DoD | `df6da70f7c` | osobista inspekcja i poprawka | console/network czyste | 10/10 obejrzane |
| T.1 | CZĘŚCIOWO | `d968881ffd` | testy zachowania + regresji | nowe 9/9, stare 17/17 | nie dotyczy |

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
| `task_overdue` | route DTO nie jest zaufana | brak szczegółowej | NO_ROUTE | wyłączona pigułka |
| `task_due_soon_not_started` | jw. | brak szczegółowej | NO_ROUTE | wyłączona pigułka |
| `task_blocked_stale` | jw. | brak szczegółowej | NO_ROUTE | wyłączona pigułka |
| `initiative_no_baseline` | jw. | tylko lista (`routeConfig.ts:110`) | NO_ROUTE | wyłączona pigułka |
| `decision_pending_stale` | jw. | tylko redirect listy (`AppRoutes.tsx:1568`) | NO_ROUTE | wyłączona pigułka |
| `decision_blocking_dependents` | jw. | tylko redirect listy | NO_ROUTE | wyłączona pigułka |
| `kpi_threshold_breached` | jw. | `/results/kpi/:id` (`routeConfig.ts:164`) | ROUTE | aktywna pigułka |
| `budget_overspend` | jw. | brak szczegółowej | NO_ROUTE | wyłączona pigułka |

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

Gotowe do polish-passu nadzorcy.
