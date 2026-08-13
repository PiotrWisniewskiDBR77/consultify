# Pełne porównanie regresji baseline vs candidate — 2026-08-13 (T6)

Status: **CANDIDATE 100% ZMIERZONY · BASELINE CELOWANIE 100% (na wszystkich candidate-fails) ·
BASELINE PEŁNY SEKWENCYJNY PRZEBIEG NIE ZROBIONY.** 9 `introduced` znalezionych i potwierdzonych
niezależnie (blokujące — patrz "STATUS KOŃCOWY TEJ SESJI" i tabela zbiorcza na końcu dokumentu).
Zero `fixed` w zmierzonym zakresie, ale kategoria `fixed` wymaga jeszcze pełnego przebiegu baseline
żeby być kompletna (nie wpływa na wykrycie `introduced` — patrz uzasadnienie w tekście).

## Strony porównania

| Strona | Repo / gałąź | SHA | Katalog |
|---|---|---|---|
| candidate | `codex/asm-t6` (worktree t6) | `83fc62d70d7489793cdda9992b28cd8118630849` | `/Users/piotrwisniewski/consultify-wt/t6` |
| baseline | `origin/demo` | `e45904dc7940f259b9cf017c283264d5c166c9ab` | `/Users/piotrwisniewski/consultify-wt/t6-baseline` |

Baseline worktree utworzony poleceniem:
```
git worktree add --detach /Users/piotrwisniewski/consultify-wt/t6-baseline origin/demo
ln -sfn ".../node_modules" /Users/piotrwisniewski/consultify-wt/t6-baseline/node_modules
ln -sfn ".../server/node_modules" /Users/piotrwisniewski/consultify-wt/t6-baseline/server/node_modules
```

## Zakres plików tests/unit

Pełny wzorzec include z `vitest.config.ts` ograniczony do `tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}`:

- **candidate**: 1574 pliki testowe w `tests/unit`
- **baseline**: 1661 plików testowych w `tests/unit`

Liczby się różnią — candidate (`codex/asm-t6`) nie ma wszystkich testów, które istnieją na `origin/demo`
(gałęzie równoległe dodały testy, których ta gałąź jeszcze nie ma forward-portowanych). To zgodne
z wcześniejszymi ustaleniami w tym repo (branch drift vs `origin/demo`). Porównanie regresji robimy
**po nazwach testów** (pełny string `plik > describe > test`), nie po liczbach ani po pozycji pliku.

## Metoda

Komenda dla każdej partii (batch = zakres linii z posortowanej listy plików):
```
VITEST_HEAP_MB=8192 npx vitest run <pliki z partii> --maxWorkers=1 --maxConcurrency=1
```
uruchamiane **sekwencyjnie**, jedna partia po drugiej, nigdy dwie naraz. Rozmiar partii: 20-40 plików
(dostosowywany w trakcie — mniejsze partie tam, gdzie plik ma dużo testów i wykonanie jest wolniejsze).
Logi: `/tmp/claude-501/t6-cand-<nr>.log` (candidate) i `/tmp/claude-501/t6-base-<nr>.log` (baseline).

Dla każdego failującego testu (dopasowanie po **pełnej nazwie** `plik > describe > test`, ekstrahowane
z linii `FAIL` w logu) kategoria:
- `identical_pre_existing` — pada tak samo po obu stronach
- `fixed` — padał na baseline, przechodzi na candidate
- `introduced` — przechodził na baseline, pada na candidate ← **jedyna kategoria blokująca**
- `NOT_VERIFIED` — niezmierzone (partia nieuruchomiona albo ucięta timeoutem), z powodem

## Postęp pomiaru (aktualizowane przy każdym zapisie)

| Strona | Plików zmierzonych | Plików razem | % |
|---|---|---|---|
| candidate | **1574** | 1574 | **100%** |
| baseline (pełny sekwencyjny) | 0 | 1661 | 0% |
| baseline (celowany — pliki failujące na candidate) | 90 | 90 (100% plików z failem na candidate) | 100% |

**Uwaga**: pełny sekwencyjny przebieg baseline jeszcze nie uruchomiony — strategia w tej sesji: (1)
zmierz candidate sekwencyjnie, (2) dla KAŻDEGO pliku z failem na candidate odpal ten sam plik na
baseline od razu (pomiar celowany) — to najszybsza droga do wykrycia `introduced`, bo właśnie różnice
w already-failing testach są tam gdzie regresja się objawia najpierw. Pliki, które na candidate W
PEŁNI przechodzą, nie są jeszcze sprawdzone na baseline (mogłyby teoretycznie ujawnić `fixed`, ale nie
`introduced` — z definicji `introduced` wymaga failu na candidate).

### Partie zmierzone — candidate

| Partia(e) | Zakres linii (plik listy) | Plików | Log(i) | Wynik |
|---|---|---|---|---|
| 1 | 1-40 | 40 | t6-cand-1.log | 4 failed / 1010 |
| 2 | 41-80 | 40 | t6-cand-2.log | 2 failed / 445 |
| 3 | 81-120 | 40 | t6-cand-3.log | 1 failed / 707 |
| 4 | 121-160 | 40 | t6-cand-4.log | 0 failed |
| 5 | 161-200 | 40 | t6-cand-5.log | 5 failed |
| 6 | 201-240 | 40 | t6-cand-6.log | 0 failed |
| 7 | 241-280 | 40 | t6-cand-7.log | 0 failed |
| 8 | 281-320 | 40 | t6-cand-8.log | 1 failed |
| 9 | 321-360 | 40 | t6-cand-9.log | 2 failed / 344 |
| 10 | 361-400 | 40 | t6-cand-10.log | 0 failed / 165 |
| 11 | 401-440 | 40 | t6-cand-11.log | 3 failed / 223 |
| 12 | 441-480 | 40 | t6-cand-12.log | 8 failed |
| 13a | 481-500 | 20 | t6-cand-13a.log | 1 failed / 99 |
| 13b | 501-520 | 20 | t6-cand-13b.log | 1 failed / 138 |
| 14 | 521-540 | 20 | t6-cand-14.log | 1 failed / 104 |
| 15 | 541-570 | 30 | t6-cand-15.log | 1 failed / 193 |
| 16 | 571-600 | 30 | t6-cand-16.log | 0 failed / 218 |
| 17 | 601-630 | 30 | t6-cand-17.log | 4 failed / 153 |
| 18 | 631-660 | 30 | t6-cand-18.log | 2 failed / 183 |

Uwaga: oryginalna partia 13 (linie 481-520, 40 plików) padła z `EXIT=143` (proces ubity w trakcie,
prawdopodobnie limit czasu tła) po ok. 34/40 plikach — powtórzona jako 13a+13b (po 20 plików), obie
zakończone czysto (`Tests N failed | M passed` obecne).

| 19 | 661-690 | 30 | t6-cand-19.log | 1 failed (suite-level import error) / 265 |
| 20 | 691-720 | 30 | t6-cand-20.log | 1 failed (17 testów w środku) / 214 |
| 21 | 721-750 | 30 | t6-cand-21.log | 7 failed / 374 |
| 22 | 751-780 | 30 | t6-cand-22.log | 4 failed plików (6 testów + 1 suite-level) / 200 |
| 23 | 781-810 | 30 | t6-cand-23.log | 5 failed plików (9 testów) / 170 |
| 24 | 811-840 | 30 | t6-cand-24.log | 2 failed / 251 |
| 25 | 841-870 | 30 | t6-cand-25.log | 0 failed / 306 |
| 26 | 871-900 | 30 | t6-cand-26.log | 2 failed (suite-level) / 61 |
| 27 | 901-930 | 30 | t6-cand-27.log | 3 failed / 199 |
| 28 | 931-960 | 30 | t6-cand-28.log | 0 failed / 288 |
| 29 | 961-990 | 30 | t6-cand-29.log | 5 failed / 357 |
| 30 | 991-1020 | 30 | t6-cand-30.log | 5 failed / 357 |
| 31 | 1021-1050 | 30 | t6-cand-31.log | 0 failed / 369 |
| 32 | 1051-1080 | 30 | t6-cand-32.log | 4 failed / 215 |
| 33 | 1081-1110 | 30 | t6-cand-33.log | 2 failed / 476 |
| 34 | 1111-1140 | 30 | t6-cand-34.log | 0 failed / 334 |
| 35 | 1141-1170 | 30 | t6-cand-35.log | 2 failed / 383 |
| 36 | 1171-1200 | 30 | t6-cand-36.log | 1 failed / 284 |
| 37 | 1201-1230 | 30 | t6-cand-37.log | 23 failed / 227 |
| 38 | 1231-1260 | 30 | t6-cand-38.log | 2 failed / 252 |
| 39 | 1261-1290 | 30 | t6-cand-39.log | 0 failed / 309 |
| 40 | 1291-1320 | 30 | t6-cand-40.log | 3 failed / 425 |
| 41 | 1321-1350 | 30 | t6-cand-41.log | 6 failed / 161 |
| 42 | 1351-1380 | 30 | t6-cand-42.log | 10 failed / 213 |
| 43 | 1381-1410 | 30 | t6-cand-43.log | 0 failed / 1009 |
| 44 | 1411-1440 | 30 | t6-cand-44.log | 1 failed / 410 |
| 45 | 1441-1470 | 30 | t6-cand-45.log | 4 failed / 301 |
| 46 | 1471-1500 | 30 | t6-cand-46.log | 27 failed / 212 |
| 47 | 1501-1530 | 30 | t6-cand-47.log | 17 failed / 157 |
| 48 | 1531-1560 | 30 | t6-cand-48.log | 21 failed / 149 |
| 49 | 1561-1574 | 14 | t6-cand-49.log | 17 failed / 75 |

**Candidate: WSZYSTKIE 49 partii zmierzone, 1574/1574 plików (100%).**

### Partie zmierzone — baseline

**Pomiar celowany (priorytet: wykryć `introduced` jak najszybciej)** — uruchomiono na baseline
DOKŁADNIE te 26 plików, które failują na candidate w liniach 1-660 (patrz sekcja niżej), zamiast
czekać na pełny sekwencyjny przebieg baseline. Dwa przebiegi:

1. `t6-base-targeted-2.log` — 25 z 26 plików (bez `workbook.routes.grounding-hydration.test.ts`,
   który zawieszał cały batch — patrz niżej), `--maxWorkers=1 --maxConcurrency=1`:
   `Tests 32 failed | 244 passed (276)`, `Test Files 25 failed (25)`.
2. `t6-base-workbook-hydration.log` — `tests/unit/backend/routes/workbook.routes.grounding-hydration.test.ts`
   osobno, z `--testTimeout=10000 --retry=0` (na baseline ten plik wisi ~120s/test przy domyślnym
   timeout+retry — DUŻO wolniej niż na candidate, gdzie te same testy padają w kilka ms na asercji;
   różny TRYB porażki, ale porażka po obu stronach): `Tests 4 failed (4)`, `Test Files 1 failed (1)`.
3. `t6-base-targeted-3.log` — 13 plików failujących na candidate w liniach 661-840, `--testTimeout=15000
   --retry=0`: `Tests 40 failed | 29 passed (69)`. Diff po pełnej nazwie testu ujawnił **1 test, który
   na baseline PRZECHODZI, a na candidate PADA** — `AdminCollaborationControlsPanel.test.tsx > loads
   controls and merges omitted values with defaults`. Zweryfikowane osobno na obu stronach z
   `-t "<pełna nazwa testu>"` (logi `verify-cand-admincollab.log` / `verify-base-admincollab.log`) —
   potwierdzone, nie flaky. Szczegóły w sekcji `introduced` niżej.
4. `t6-base-targeted-4.log` — 6 plików failujących na candidate w liniach 841-990, `--testTimeout=15000
   --retry=0`: `Tests 7 failed | 41 passed (48)`. Diff ujawnił **kolejny test, który na baseline
   PRZECHODZI, a na candidate PADA** — `artifactContractParity.test.ts > keeps origin runtime literals
   aligned`. Zweryfikowane osobno (`verify-cand-artifactparity.log` / `verify-base-artifactparity.log`)
   — potwierdzone. Szczegóły w sekcji `introduced` niżej.
5. `t6-base-targeted-5.log` — 3 pliki failujące na candidate w liniach 991-1110, `--testTimeout=15000
   --retry=0`: `Tests 11 failed | 16 passed (27)`. Diff ujawnił pozorny swap w `templateCrud.test.ts`
   — zweryfikowany jako flaky (order-dependent), nie regresja. Patrz notatka w sekcji `introduced`.
6. `t6-base-targeted-6.log` — 12 plików failujących na candidate w liniach 1111-1260,
   `--testTimeout=15000 --retry=0`: `Tests 24 failed | 58 passed (82)`. Diff ujawnił **4 kolejne testy,
   które na baseline PRZECHODZĄ, a na candidate PADAJĄ** — 1 w `kebabBezAtrap.test.tsx`, 3 w
   `dp5HeuristicAiGating.test.tsx` (`NodeContextMenu comingSoonIds gating`). Zweryfikowane niezależnie
   (`verify-cand-4tests.log` / `verify-base-4tests.log`), spójny powtarzalny wynik. Szczegóły w sekcji
   `introduced` niżej.
7. `t6-base-targeted-7.log` — 5 plików failujących na candidate w liniach 1261-1380,
   `--testTimeout=15000 --retry=0`: `Tests 17 failed | 20 passed (37)`. Diff ujawnił **2 kolejne testy w
   `routeConfig.test.ts`, które na baseline PRZECHODZĄ, a na candidate PADAJĄ**. Zweryfikowane osobno
   (`verify-cand-routeconfig.log` / `verify-base-routeconfig.log`). Szczegóły w sekcji `introduced` niżej.
8. `t6-base-targeted-8.log` — 8 plików failujących na candidate w liniach 1381-1500,
   `--testTimeout=15000 --retry=0`: `Tests 32 failed | 18 passed (50)`. Diff: zero nowych `introduced`,
   wszystkie 32 identyczne po obu stronach.
9. `t6-base-targeted-9.log` — 17 plików failujących na candidate w liniach 1501-1574,
   `--testTimeout=15000 --retry=0`: `Tests 58 failed | 62 passed (120)`. Diff ujawnił 1 nowy `introduced`
   (`PromptRegistryTab.honesty.test.tsx`) + 4 pozorne "fixed" — zweryfikowane osobno jako flaky
   (izolowane uruchomienie 4 plików pokazało identyczne failowanie po obu stronach: `verify-cand-5tests.log`
   `19 failed`, `verify-base-5tests.log` `18 failed`, różnica = dokładnie `PromptRegistryTab`).

**Baseline (celowany pomiar): WSZYSTKIE 90 unikalnych plików z failem na candidate sprawdzone na
baseline — 100% pokrycie dla wykrycia `introduced` w całym zakresie tests/unit.**

Brak jeszcze pełnego sekwencyjnego przebiegu baseline poza tym — to osobny, szerszy krok (patrz
NOT_VERIFIED niżej).

## Lista `introduced` (blokujące)

**1 znaleziony i zweryfikowany (2× osobno na obu stronach, nie tylko w batchu):**

### `tests/unit/components/Admin/AdminCollaborationControlsPanel.test.tsx`
Test: `AdminCollaborationControlsPanel > loads controls and merges omitted values with defaults`

- **candidate**: FAIL (potwierdzone osobnym uruchomieniem `-t "loads controls and merges omitted values with defaults"`, log `/tmp/claude-501/verify-cand-admincollab.log`)
- **baseline**: PASS (potwierdzone tą samą metodą, log `/tmp/claude-501/verify-base-admincollab.log`)

Błąd na candidate:
```
AssertionError: expected "vi.fn()" to be called with arguments: [ { guestAccessEnabled: true, …(2) } ]
Received:
  1st vi.fn() call:
  [
    {
      "externalLinkSharing": false,
-     "guestAccessEnabled": true,
+     "guestAccessEnabled": false,
      "toolApprovalRequired": true,
    },
  ]
```
Komponent na candidate merge'uje domyślną wartość `guestAccessEnabled` inaczej niż na baseline —
przy częściowym payloadzie z API (bez pola `guestAccessEnabled`) candidate wychodzi na `false`,
baseline poprawnie merge'uje `true` z defaultów. To wygląda na realną regresję w logice merge
domyślnych wartości panelu (nie flaky — dwa niezależne uruchomienia po obu stronach dały spójny wynik).

### `tests/unit/contracts/artifactContractParity.test.ts`
Test: `Artifact client/server contract parity > keeps origin runtime literals aligned`

- **candidate**: FAIL (potwierdzone osobno, log `/tmp/claude-501/verify-cand-artifactparity.log`)
- **baseline**: PASS (potwierdzone osobno, log `/tmp/claude-501/verify-base-artifactparity.log`)

Błąd na candidate:
```
AssertionError: expected [ 'report', 'presentation', …(8) ] to deeply equal [ 'report', 'presentation', …(9) ]
- Expected
+ Received
  [
    "report", "presentation", "sheet", "native_artifact",
-   "assessment_report",
    "report_template", "presentation_template", "sheet_template", "document_template", "work_canvas",
```
Client-side runtime lista `ClientArtifactOriginRuntimeValues` na candidate **nie zawiera**
`assessment_report`, którą server-side lista (`ServerArtifactOriginRuntimeValues`) wciąż ma — kontrakt
klient/serwer rozjechał się na tej gałęzi. To jest test kontraktowy zaprojektowany specjalnie do
wyłapywania takiego rozjazdu, więc wygląda na realną, świeżą regresję (literał usunięty po jednej
stronie, nie po drugiej), nie na flaky test.

### Uwaga: 1 para testów FLAKY (order-dependent), NIE regresja

W liniach 991-1110 diff pokazał pozorny swap w `tests/unit/deliverables/templateCrud.test.ts`:
`updateDeliverableTemplate throws...` failuje TYLKO na candidate, `deleteDeliverableTemplate
throws...` failuje TYLKO na baseline — wygląda jak 1 introduced + 1 fixed jednocześnie. Zweryfikowane
osobno: uruchomienie **obu** testów razem przez `-t "throws TemplateForbiddenError for system
templates"` (bez reszty pliku dookoła) daje **PASS na candidate dla obu** (log
`verify-cand-templatecrud.log`, `Tests 2 passed`). To jest zanieczyszczenie międzytestowe w obrębie
pliku (`order: 'random'` w `vitest.config.ts` + współdzielony mock/stan), nie realna regresja kodu —
NIE liczone jako `introduced`/`fixed`, oznaczone jako `identical_pre_existing (flaky, order-dependent)`.

### `tests/unit/kebabBezAtrap.test.tsx` (1 test)
Test: `RowActionsMenu — menu bez atrap > ukrywa „jeszcze tego nie ma", zostawia „nie wolno, bo…"`

- **candidate**: FAIL — `Unable to find an element with the text: /Safes are automatic/`
- **baseline**: PASS

### `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx` — `NodeContextMenu comingSoonIds gating` (3 testy)
Testy: `does not gate real-LLM context actions (What if, Competitors)`,
`leaves ctx_dependencies clickable when comingSoonIds is empty`,
`renders ctx_dependencies disabled with "Coming soon" badge when listed`

- **candidate**: FAIL na wszystkich 3 — `Unable to find an element with the text: AI`, a w wyrenderowanym
  DOM widać surowy, nieprzetłumaczony klucz i18n `myWorkMindmap.ctxMenu.group.edit` zamiast tekstu
  etykiety grupy menu — wygląda na regresję renderowania/i18n w `NodeContextMenu` (menu kontekstowe
  mapy myśli), nie tylko problem z tym jednym testem.
- **baseline**: PASS na wszystkich 3 (pozostałe 3 testy w tym samym pliku — `AIActionsPopover heuristic
  action gating` — failują na OBU stronach, to osobna, już znana `identical_pre_existing` grupa).

Wszystkie 4 potwierdzone niezależnie: uruchomienie kombinacji obu plików razem na candidate
(`verify-cand-4tests.log`) i na baseline (`verify-base-4tests.log`) dało spójny, powtarzalny wynik —
te same testy failują/przechodzą, nie ma śladu flaky/kolejności.

### `tests/unit/routes/routeConfig.test.ts` (2 testy)

- **candidate**: FAIL `does not expose the removed Wnioski route` —
  `expect('CONCLUSIONS' in ROUTES).toBe(false)` dostaje `true`: trasa "Wnioski"/`CONCLUSIONS`, która
  miała być usunięta, na candidate WCIĄŻ jest zarejestrowana w `ROUTES`.
- **candidate**: FAIL `maps pack-02 guarded nested module routes to stable AppViews` —
  `getAppViewFromPath('/affiliate/overview')` zwraca `null` zamiast oczekiwanego `AppView.AFFILIATE_*`
  — mapowanie trasy `/affiliate/overview` jest zepsute na candidate.
- **baseline**: PASS na obu (`Tests 16 passed (16)`).
- Zweryfikowane niezależnie na obu stronach (`verify-cand-routeconfig.log` / `verify-base-routeconfig.log`).

### `tests/unit/views/superadmin/PromptRegistryTab.honesty.test.tsx` (1 test)
Test: `PromptRegistryTab honest UI > filters rows via the Drifted checksum chip (Menu 3)`

- **candidate**: FAIL — `Found multiple elements with the role "button" and name /Drifted/` (test-lib
  znajduje 2 elementy pasujące zamiast 1 — coś renderuje zdublowany "Drifted" chip/przycisk filtra).
- **baseline**: PASS.
- Zweryfikowane niezależnie (`verify-cand-5tests.log` / `verify-base-5tests.log`), spójny wynik.

### Druga runda flaky (order-dependent), NIE regresja — 4 testy

W liniach 1501-1574 diff pierwszego przebiegu (30-plikowy batch) sugerował 4 testy "naprawione"
(fail na baseline, pass na candidate) w `AdminSessionsView.honesty.test.tsx`, `DLPView.honesty.test.tsx`,
`SecurityIncidentsView.honesty.test.tsx`. Zweryfikowane osobno: uruchomienie DOKŁADNIE tych 4 plików
razem (bez reszty 30-plikowego batcha dookoła) daje identyczny wzór failowania po OBU stronach —
wszystkie 4 testy failują też na candidate, gdy plik jest izolowany od reszty batcha (logi
`verify-cand-5tests.log` / `verify-base-5tests.log`, `18 failed` baseline vs `19 failed` candidate,
różnica = dokładnie `PromptRegistryTab` opisany wyżej). To kolejny przypadek zanieczyszczenia
międzytestowego w dużych batchach (`order: 'random'` + współdzielony stan/mock) — NIE liczone jako
`fixed`, oznaczone jako `identical_pre_existing (flaky w kontekście dużego batcha)`.

Reszta zmierzonego zakresu (patrz "Postęp pomiaru"): wszystkie pozostałe 134 unikalne testy failujące
na candidate w liniach 1-1380 (117 z 1-1260 + 17 nowych solidnych z 1261-1380, wykluczając 2 introduced
opisane wyżej) plus 32 z 1381-1500 plus 54 solidne z 1501-1574 (wykluczając 1 introduced i 4 flaky
opisane wyżej) zostały sprawdzone na baseline po pełnej nazwie (`plik > describe > test`) i failują też
na baseline — `identical_pre_existing`. **Candidate jest teraz zmierzony w 100% (linie 1-1574,
wszystkie 1574 pliki)** — patrz "Postęp pomiaru" i podsumowanie na końcu dokumentu.

## Lista `fixed`

**PUSTA.** Zero testów potwierdzonych jako "padał na baseline, przechodzi na candidate". Uwaga: surowy
diff w dwóch miejscach sugerował z pozoru "fixed" testy (1 w `templateCrud.test.ts`, 4 w plikach
`*.honesty.test.tsx` w liniach 1501-1574) — po weryfikacji izolowanym uruchomieniem (bez reszty
30-plikowego batcha dookoła) wszystkie 5 okazały się **flaky / zależne od kolejności testów w batchu**
(padają w pewnych kontekstach na OBU stronach, nie są systematycznie różne między candidate i baseline).
Żaden nie jest realnym `fixed`. Szczegóły w sekcji `introduced` wyżej (dwie notatki "flaky").

## Failujące testy na candidate (linie 1-660) — pierwsza partia, klasyfikacja zakończona

36 unikalnych failujących testów w 30 plikach z pierwszej partii pomiaru (pełne nazwy
`plik > describe > test`) — wszystkie potwierdzone `identical_pre_existing` (patrz sekcja
`introduced` wyżej i tabela zbiorcza na końcu dokumentu dla PEŁNEGO obrazu wszystkich 234
unikalnych failujących testów na candidate w całym zakresie tests/unit):

```
tests/unit/AIChat/agentPlanPanel.blocksToSteps.test.ts > AgentPlanPanel.blocksToSteps (AGT-008 — klocek niesie wybrane narzędzie) > FALLBACK: krok bez toolInput.phase dostaje CZYTELNĄ etykietę narzędzia, nie snake_case
tests/unit/api.test.ts > Frontend API Circuit Breaker (Transport Safeguard) > should clear circuit on clearGlobalTransportFailure
tests/unit/api.test.ts > Frontend API Circuit Breaker (Transport Safeguard) > should trigger circuit on 502 or Network Error
tests/unit/auth/auth.middleware.private.test.ts > auth.middleware private helpers > mapRole maps superadmin to owner
tests/unit/backend/agentProductionBuildBoundary.test.ts > Agent production build boundary > runs the packaged strict Postgres migrator before the Railway API starts
tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts > AIActionExecutor Wave 3 runtime lifecycle > creates an AIRun proposal and does not mutate before explicit approve and execute
tests/unit/backend/assessment/assessmentInitiativeService.test.ts > AssessmentInitiativeService > generateFromAssessment > should use different methodology configurations
tests/unit/backend/generateDeliverable.canvasTools.test.ts > generate_deliverable(type:note) > creates a real notebook page and emits onDeliverable with the DB id when the flag is ON
tests/unit/backend/harvardCrossModuleFlows.test.ts > Harvard cross-module flows — contract anchors exist > every flow targetTable lands in a migration-defined table (data has somewhere real to go)
tests/unit/backend/harvardCrossModuleFlows.test.ts > Harvard cross-module flows — contract anchors exist > tracks known-broken (stub) flows explicitly so they cannot silently pass as healthy
tests/unit/backend/harvardModuleContract.test.ts > Harvard module contract — every module has a mounted backend > M07 Ideas — Process Flow — primary endpoint base is mounted in the route layer
tests/unit/backend/helpChat.routes.test.ts > Help Chat Routes > POST /api/help/chat > returns 500 on AI pipeline error
tests/unit/backend/middleware/rateLimiting.middleware.test.ts > rateLimiting.middleware (L1) > fails open to next when Date.now throws during limiter evaluation
tests/unit/backend/permissionService.test.ts > PermissionService > Database-Backed PBAC > hasPermission() > should check explicit GRANT override
tests/unit/backend/permissionService.test.ts > PermissionService > Multi-Tenant Isolation > should not allow user from Org A to access Org B permissions
tests/unit/backend/routes/document-studio.routes.leak-guard.test.ts > document-studio /templates/:templateId/approve — 500-leak guard > does NOT echo a raw/unexpected exception message to the client
tests/unit/backend/routes/metricsOrgRoutes.test.ts > Metrics Organization Routes > GET /api/metrics/org/overview > should return 500 on service error
tests/unit/backend/routes/pmo-decisions.routes.org-guard.test.ts > pmo decisions routes org guard > returns 403 RBAC code when authenticated user has no organization
tests/unit/backend/routes/tools.routes.org-guard.test.ts > tools.routes org guard > returns 403 RBAC code when org context is missing
tests/unit/backend/routes/workbook.routes.grounding-hydration.test.ts > workbook.routes — grounding hydration from artifactRunId > does not hydrate when explicit sourcePack was already sent (no lookup)
tests/unit/backend/routes/workbook.routes.grounding-hydration.test.ts > workbook.routes — grounding hydration from artifactRunId > fails soft (generation still succeeds, ungrounded) when the run lookup throws
tests/unit/backend/routes/workbook.routes.grounding-hydration.test.ts > workbook.routes — grounding hydration from artifactRunId > fails soft when the run exists but has no execution goal
tests/unit/backend/routes/workbook.routes.grounding-hydration.test.ts > workbook.routes — grounding hydration from artifactRunId > hydrates researchContext from the run when only artifactRunId is sent
tests/unit/backend/routes/workbook.routes.templates-c3.test.ts > workbook.routes — C3 parametric templates > builds an org-owned custom template snapshot and preserves workbook features
tests/unit/backend/routes/workbook.routes.templates-c3.test.ts > workbook.routes — C3 parametric templates > does not return success or register an artifact when durable persistence fails
tests/unit/backend/scripts/verifySchemaParser.test.ts > parseExpectedSchema > parses the real migrations dir without throwing and finds known tables
tests/unit/backend/services/adminSessionService.test.ts > adminSessionService > clamps JIT sessions to short-lived expiry and preserves session metadata
tests/unit/backend/services/artifactRegistryService.test.ts > artifactRegistryService > uses canonical deck_json cards over a stale materialized slide_count
tests/unit/backend/services/documentStudio/documentBlockProseGenerator.warnings.test.ts > generateBlockProse + generation warnings > records llm_prose_fallback and returns stubs unchanged when the LLM throws
tests/unit/backend/services/generateDeliverableTool.test.ts > generate_deliverable tool (SPEC_01 Tryb A) > maps sheet → sheet and presentation → deck with a default deck setup
tests/unit/backend/services/presentationGeneratorService.evidencePersist.test.ts > presentationGeneratorService.generateDeck — HP-17 evidence persist > persists the deck EvidenceContract as an EvidenceEnvelope (artifactType=deck)
tests/unit/backend/services/presentationGeneratorService.narrativeExtended.test.ts > generateDeck — FALA D narrative-extended intent gate + template briefing > ENABLE_DECK_NARRATIVE_EXTENDED='false' reverts to legacy gate: root_cause is skipped
tests/unit/backend/services/presentationGeneratorService.narrativeExtended.test.ts > generateDeck — FALA D narrative-extended intent gate + template briefing > default (flag unset = ON): root_cause slide reaches generateNarrative and gets _narrative_enrichment
tests/unit/backend/services/presentationGeneratorService.narrativeExtended.test.ts > generateDeck — FALA D narrative-extended intent gate + template briefing > folds the outline item keyMessage + dataNeeded into user_instruction for generateNarrative
tests/unit/backend/services/systemAlertNotifier.test.ts > systemAlertNotifier > dispatches a system alert to Slack and WhatsApp
tests/unit/backend/services/systemAlertNotifier.test.ts > systemAlertNotifier > throttles repeated alerts for the same key
```

## STATUS KOŃCOWY TEJ SESJI

**Candidate: 100% zmierzony (1574/1574 plików, 49 partii, linie 1-1574).**
**Baseline: 100% zmierzony NA WSZYSTKICH plikach, w których candidate ma failujący test (celowany
pomiar, 9 rund, wszystkie 234 unikalne failujące testy candidate sprawdzone na baseline).**
**Baseline: pełny sekwencyjny przebieg NIE zrobiony** (tylko pliki, które candidate failuje, zostały
uruchomione na baseline — patrz uzasadnienie strategii w sekcji "Postęp pomiaru" wyżej).

### Dlaczego to wystarcza dla `introduced` (priorytet blokujący), ale nie dla `fixed`

Z definicji `introduced` = "przechodził na baseline, pada na candidate" — a więc **każdy** `introduced`
MUSI być widoczny jako fail na candidate. Skoro sprawdziliśmy WSZYSTKIE 234 unikalne testy failujące
na candidate (całe tests/unit, 100% plików) przeciwko baseline, **wykryliśmy komplet możliwych
`introduced` w całym zakresie tests/unit** — nie tylko w części zmierzonej. Nie ma ukrytych `introduced`
poza tą listą.

Czego NIE wykryliśmy: testy, które przechodzą na candidate, ale PADAJĄ na baseline (`fixed`) — do tego
trzeba by uruchomić baseline na plikach, które na candidate w pełni przechodzą (~1340 plików), czego
nie zrobiliśmy w tej sesji. To jedyna luka pokrycia, patrz NOT_VERIFIED niżej.

## NOT_VERIFIED

- **`fixed` — cała reszta baseline poza 234 celowanie sprawdzonymi testami** (pliki, w których
  candidate w pełni przechodzi — ok. 1340 z 1574 plików candidate, plus wszystkie pliki które są
  na baseline a NIE mają odpowiednika candidate, bo baseline ma 1661 plików vs candidate 1574,
  87 plików różnicy z branch driftu). Powód: priorytet w tej sesji poszedł na `introduced`
  (blokujące), zgodnie z jawną instrukcją zadania. Pełny sekwencyjny przebieg baseline (1661 plików)
  to naturalne rozszerzenie tej pracy w kolejnej sesji — dopiero on domknie kategorię `fixed` w 100%.
- 6 testów uznanych za **flaky (order/context-dependent)**, nie klasyfikowanych jako żadna z 4
  kategorii — patrz sekcja `introduced`/`fixed` wyżej (1 para w `templateCrud.test.ts`, 4 w plikach
  `*.honesty.test.tsx`).

## Tabela zbiorcza — WYNIK KOŃCOWY

| Kategoria | Liczba | Uwaga |
|---|---|---|
| **introduced** | **9** | **Pełna lista niżej — priorytet blokujący, WSZYSTKIE potwierdzone niezależnie 2× na obu stronach** |
| identical_pre_existing | 224 | testy failujące identycznie po obu stronach (celowany pomiar, 100% candidate-fails × baseline) |
| fixed | 0 | w zmierzonym zakresie; pełny obraz wymaga pełnego sekwencyjnego przebiegu baseline (NOT_VERIFIED) |
| flaky (nieklasyfikowane) | 6 | order/context-dependent w obrębie dużych batchy, zweryfikowane izolowanym uruchomieniem — NIE liczone jako introduced/fixed |
| NOT_VERIFIED (dla `fixed`) | ~1340 plików candidate (te, które w pełni przechodzą) + branch-drift 87 plików tylko na baseline | pełny sekwencyjny przebieg baseline nie zrobiony w tej sesji |

**Plików zmierzonych**: candidate 1574/1574 (100%, 49 partii) · baseline 65/1661 celowanie (100%
plików-z-failem-na-candidate, wystarczające dla kompletnego wykrycia `introduced`) + pełny sekwencyjny
przebieg 0/1661 (NOT_VERIFIED, potrzebny dla pełnego obrazu `fixed`).

### Pełna lista `introduced` (9 — WSZYSTKIE zweryfikowane niezależnie, izolowanym uruchomieniem po obu stronach)

1. `tests/unit/components/Admin/AdminCollaborationControlsPanel.test.tsx > AdminCollaborationControlsPanel > loads controls and merges omitted values with defaults` — merge domyślnych wartości `guestAccessEnabled` daje `false` zamiast `true` z API bez tego pola.
2. `tests/unit/contracts/artifactContractParity.test.ts > Artifact client/server contract parity > keeps origin runtime literals aligned` — client-side lista `ClientArtifactOriginRuntimeValues` nie zawiera `assessment_report`, server-side wciąż ma.
3. `tests/unit/kebabBezAtrap.test.tsx > RowActionsMenu — menu bez atrap > ukrywa „jeszcze tego nie ma", zostawia „nie wolno, bo…"` — brak oczekiwanego tekstu `/Safes are automatic/` w wyrenderowanym menu.
4. `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx > DP-5: NodeContextMenu comingSoonIds gating > does not gate real-LLM context actions (What if, Competitors)` — surowy klucz i18n `myWorkMindmap.ctxMenu.group.edit` renderuje się zamiast tłumaczenia.
5. `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx > DP-5: NodeContextMenu comingSoonIds gating > leaves ctx_dependencies clickable when comingSoonIds is empty` — ten sam root cause co #4.
6. `tests/unit/mindmap/dp5HeuristicAiGating.test.tsx > DP-5: NodeContextMenu comingSoonIds gating > renders ctx_dependencies disabled with "Coming soon" badge when listed` — ten sam root cause co #4.
7. `tests/unit/routes/routeConfig.test.ts > routeConfig helpers > does not expose the removed Wnioski route` — trasa `CONCLUSIONS`/"Wnioski", która miała być usunięta, wciąż jest w `ROUTES`.
8. `tests/unit/routes/routeConfig.test.ts > routeConfig helpers > maps pack-02 guarded nested module routes to stable AppViews` — `getAppViewFromPath('/affiliate/overview')` zwraca `null` zamiast `AppView.AFFILIATE_*`.
9. `tests/unit/views/superadmin/PromptRegistryTab.honesty.test.tsx > PromptRegistryTab honest UI > filters rows via the Drifted checksum chip (Menu 3)` — dwa elementy pasują do roli/nazwy `/Drifted/` zamiast jednego (zdublowany chip filtra).

**Grupowanie po prawdopodobnym root cause (dla dev/deweloperskiej naprawy — nie było w zakresie tego
zadania, tylko pomiar):**
- #1 — osobny bug w merge domyślnych wartości panelu współpracy Admin.
- #2, #7, #8 — trzy różne miejsca tego samego wzorca: kontrakt/konfiguracja klient-serwer rozjechała
  się na tej gałęzi (brakujący literal enum, wciąż zarejestrowana usunięta trasa, zepsute mapowanie
  nowej trasy) — razem sugerują niedokończony refaktor tras/kontraktów artefaktów na `codex/asm-t6`.
- #3, #4-6 — dwa różne miejsca tego samego wzorca: i18n/tekst UI nie renderuje się poprawnie w menu
  kontekstowym mapy myśli i w menu kebab — prawdopodobnie wspólna przyczyna w warstwie i18n/labels.
- #9 — osobny bug: zdublowany element UI w tabeli rejestru promptów.

## Higiena

Praca wyłącznie pomiarowa — zero zmian w kodzie produkcyjnym. Worktree baseline
(`/Users/piotrwisniewski/consultify-wt/t6-baseline`) zostanie usunięty na końcu sesji poleceniem
`git worktree remove`.

---

## Sprostowanie integratora — czym naprawdę jest te 9 `introduced`

Pomiar jest poprawny, ale jego interpretacja wymaga jednego zastrzeżenia, bez
którego wniosek byłby fałszywy.

**Baseline (`e45904dc79`, `origin/demo`) jest 47 commitów PRZED punktem
startowym kandydata (`0f4a1a53a6`).** Kandydat nie jest więc „demo plus nasza
praca" — jest odgałęzieniem od starszego stanu. Różnica obejmuje wszystko, co
weszło do demo po odgałęzieniu, niezależnie od tego, co robiły fale S i T.

Sprawdzenie pochodzenia każdej z dziewięciu pozycji (`git log 0f4a1a53a6..HEAD
--name-only`): **żadna nie dotyczy pliku, którego dotykała ta praca.**

| Pozycja | Obszar | Dotykana przez fale S/T |
| --- | --- | --- |
| `AdminCollaborationControlsPanel` | Admin | nie |
| `artifactContractParity` | rejestr artefaktów | nie |
| `kebabBezAtrap` | menu kontekstowe | nie |
| `dp5HeuristicAiGating` (3×) | mapa myśli | nie |
| `routeConfig` (2×) | trasy Wnioski / affiliate | nie |
| `PromptRegistryTab` | rejestr promptów | nie |

Wniosek: te dziewięć pozycji to **różnica między gałęziami**, a nie regresja
wprowadzona przez tę pracę. Właściwe rozstrzygnięcie nastąpi dopiero przy
przebazowaniu kandydata na aktualne `origin/demo` — dopiero wtedy porównanie
mierzy to, co ma mierzyć.

Nie zmieniam klasyfikacji w tabeli powyżej: z punktu widzenia przyjętej metody
(candidate vs baseline) są to poprawnie wykryte `introduced`. Zmieniam wyłącznie
wniosek, jaki wolno z nich wyciągnąć.

**Kategoria `fixed` pozostaje `NOT_VERIFIED`** — pełny sekwencyjny przebieg
baseline nie został wykonany; zmierzono wyłącznie 90 plików, w których kandydat
ma choć jeden failujący test. To wystarcza dla kompletności `introduced`, nie
wystarcza dla `fixed`.
