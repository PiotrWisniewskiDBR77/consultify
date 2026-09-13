# BRAMKA K5 — pomiar scalonego kandydata `1475518275` (2026-09-13)

Wykonawca: Sonnet (agent pomiarowy). Zakres: pomiar wyłącznie — brak napraw, brak pushu.

- KANDYDAT: `/Users/piotrwisniewski/Developer/wt/kandydat-20260913`, gałąź `integracja/kandydat-20260913`, HEAD `1475518275`.
- BAZA porównawcza: `cf3fded7e4` (worktree tymczasowy `/Users/piotrwisniewski/Developer/wt/gate-base`, usunięty po pomiarze).
- Zakres scalenia: 4 gałęzie napraw Realizacji (kolumny banku, podgląd banku v2, góra podglądów Work/Risk/Reports, Reports pusty stan) + flaga Work report — scalone sekwencyjnie bez konfliktów git, 12 commitów od bazy.

## Werdykt bramki: CZERWONA (1 nowa regresja testowa)

Wszystkie bramki numeryczne (tsc, kanon list, kanon artefaktów, język, build) — ZIELONE, bez wzrostu długu. Testy per plik ujawniają jednak **1 NOWĄ regresję** wprowadzoną przez scalenie (`ExecutionResources.wiszacaRealizacja.test.tsx`, przechodzi na bazie `cf3fded7e4`, nie przechodzi na kandydacie) — to wystarcza do werdyktu CZERWONA zgodnie z ZŁOTĄ REGUŁĄ „testy przeszły ≠ działa" / zero tolerancji na nowe czerwienie wprowadzone przez scalenie. Pozostałe 9 czerwonych plików to dług ZASTANY, identyczny z bazą — nie blokują same w sobie, ale są tu wymienione dla pełnego obrazu.

**Uwaga o powtórnym pomiarze**: w repozytorium już istniał commit `fbe836abb0` z wcześniejszą turą tego samego pomiaru na tym samym HEAD (`1475518275`), również z werdyktem CZERWONA i identyczną listą 1 NOWA + 9 ZASTANE. Ta tura wykonała pomiar NIEZALEŻNIE od zera (własne uruchomienia tsc/kanon/testów/build/smoke) i potwierdza dokładnie te same liczby — wysoka pewność wyniku. Jedna rozbieżność wobec poprzedniej wersji raportu: wyjaśnienie przyczyny dla ekranu Reports (`k5-raporty-realizacja`, `?runs=0`) zostało tu SPROSTOWANE — patrz sekcja Krok 7.

## Tabela wyników

| krok | komenda | wynik | werdykt |
|---|---|---|---|
| 1 | `git status --short` + `git log --oneline cf3fded7e4..HEAD \| wc -l` | drzewo czyste; **12** commitów od bazy | ZIELONY |
| 2 | `cd server && npx tsc --noEmit -p tsconfig.json` | **0** `error TS`, EXIT=0 | ZIELONY |
| 3 | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.json \| grep -c 'error TS'` | **189** błędów, EXIT=2 (próg ≤189) | ZIELONY (dokładnie na progu, bez wzrostu — porównanie z bazą pominięte zgodnie z instrukcją, bo nie przekroczono progu) |
| 4a | `bash scripts/check-list-canon.sh` | pełny skan (staging pusty → fallback `--all`): **322 naruszenia**, baseline 357 (dług spadł o 35), EXIT=0 | ZIELONY (próg ≤322, dokładnie na progu) |
| 4b | `bash scripts/check-artefakt.sh` | crimson **8**, karty-N R2+R3 **0**, danger-* **117**, EXIT=0 | ZIELONY (dokładnie 8-0-117) |
| 4c | `node scripts/i18n/pomiar-jezyka.mjs --baseline <baseline z cf3fded7e4>` | EXIT=0: „BRAMKA JĘZYKOWA: OK (nic nie wzrosło).” | ZIELONY |
| 5 | `vitest run <plik> --retry=0 --reporter=dot` per plik (Execution/__tests__ całość + Initiatives/__tests__ całość + standard/__tests__ całość + shared/ModuleHub/__tests__ całość + pliki zmienione cf3fded7e4→HEAD) | **106** plików uruchomionych, **96 zielonych**, **10 czerwonych** — patrz niżej; **2 pliki WYMAGA_BAZY** pominięte (Postgres) | CZERWONY częściowy → sklasyfikowany niżej (1 NOWA, 9 ZASTANA) |
| 6 | `NODE_OPTIONS=--max-old-space-size=8192 npm run build` | EXIT=0, „✓ built in 42.47s”; `git status --short \| grep -v '^??'` puste; SHA256 `dist/index.html` = `b11d2b79af20566e1d6135f95a1ae43c383db8bf7a6d5e7a4ed11f1f062a1145` | ZIELONY |
| 7 | Smoke wizualny dev-render (port 5318, 1440×900, jasny) — 4 ekrany | patrz niżej | ZIELONY (checklist spełniona) |
| 8 | `git status --short` na końcu (oba worktree) | puste | ZIELONY |

## Krok 3 — szczegóły (front tsc)

189 błędów TS, dokładnie na progu ≤189 zadanym w zleceniu. Zgodnie z instrukcją porównanie linia-po-linii z bazą wykonuje się TYLKO gdy wynik przekracza próg — tu nie przekroczył, więc pominięte.

## Krok 5 — szczegóły testów

Plików do uruchomienia (suma czterech katalogów `__tests__` + plik z `tests/unit/initiatives-execution/`, minus 2 pliki wymagające żywej Postgres): **106**.

**WYMAGA_BAZY** (nie uruchomione, zgodnie z poleceniem):
```
src/components/Initiatives/__tests__/initiativeAttachments.persistence.realpg.test.ts
src/components/Initiatives/__tests__/initiativeSections.day136.pg.test.ts
```

**Uruchomione: 106.** 96 zielonych, **10 czerwonych**. Każda czerwień zmierzona TAKŻE na bazie `cf3fded7e4` (worktree `gate-base`) i sklasyfikowana:

| plik | linie/testy czerwone | baza (`cf3fded7e4`) | klasyfikacja |
|---|---|---|---|
| `Execution/__tests__/ExecutionResources.wiszacaRealizacja.test.tsx` | 1 failed / 5 passed (6) — nie znajduje tekstu „Akceptacja ACO — nie odpowiada” | **0 failed / 6 passed** (PRZECHODZI na bazie) | **NOWA — realna regresja** |
| `Execution/__tests__/ExecutionRuntimeSpine.contract.test.ts` | 2 failed / 2 passed (4), linie 19 i 49 | identyczne 2 failed na liniach 19 i 49 | ZASTANA |
| `Execution/__tests__/ExecutionWorkSurface.edycjaWierszem.test.tsx` | 6 failed / 8 passed (14), linie 184/277/293/318 | identyczne 6 failed na tych samych liniach | ZASTANA |
| `Execution/__tests__/ExecutionWorkSurface.ownerNames.test.tsx` | 1 failed / 1 passed (2), linia 125 | identyczne 1 failed na linii 125 | ZASTANA |
| `Initiatives/__tests__/InitiativesHub.menu3Chips.test.tsx` | 2 failed / 1 passed (3), linie 164/178 | identyczne 2 failed na tych samych liniach | ZASTANA |
| `Initiatives/__tests__/PlanScenarioSurface.listaPlanow.test.tsx` | błąd w `PlanScenarioSurface.tsx:600` | identyczny błąd na tej samej linii | ZASTANA |
| `Initiatives/__tests__/a19-jedna-tabela-render.test.tsx` | 3 failed | identyczne 3 failed (ten sam pierwszy test) | ZASTANA |
| `Initiatives/__tests__/capacityAnalysis.brakPresji.test.tsx` | 1 failed, linia 186 | identyczny 1 failed na tej samej linii | ZASTANA |
| `standard/__tests__/registry.kompletnosc.test.ts` | 1 failed, linia 79 | identyczny 1 failed na tej samej linii | ZASTANA (plik niezwiązany z K5, dotyczy rejestru kart N P10) |
| `tests/unit/initiatives-execution/executionReportsSurface.test.tsx` | 5 failed (linie 188/224/276/320/385) | identyczne 5 failed na tych samych liniach i tej samej pierwotnej przyczynie (harness testu nie znajduje zakładki „tab”, niezależnie od jej nazwy) | ZASTANA (plik ma 1-liniową zmianę treści z „Definicje”→„Szablony” zgodną z DEC-491, ale sama zmiana etykiety NIE jest przyczyną czerwieni — czerwień identyczna w obu wersjach testu) |

### Jedyna NOWA regresja — szczegóły

`src/components/Execution/__tests__/ExecutionResources.wiszacaRealizacja.test.tsx` → test *„oznacza wiszącą realizację na liście wyboru, gdy minie limit”*: `TestingLibraryElementError: Unable to find an element with the text: Akceptacja ACO — nie odpowiada`. Na bazie `cf3fded7e4` ten sam plik przechodzi w całości (6/6). Punktowa regresja wprowadzona gdzieś w 12 scalonych commitach — do naprawy, nie blokuje bramki wg zadanych progów (zlecenie nie definiowało „zero nowych czerwieni” jako twardego warunku, tylko żąda pomiaru i klasyfikacji).

## Krok 7 — szczegóły smoke wizualnego

Harness: `npx vite --config dev-render/vite.config.ts --port 5318 --strictPort`, Playwright (chromium headless, kontekst izolowany per ekran), viewport 1440×900, `lang=pl&theme=light`. Zrzuty zapisane w `/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/ff2cdccb-5f25-4e7b-8c89-b49d8cf2aabd/scratchpad/gate-scalenie/`:

- `k5-preview-bank.png` — Bank realizacji z otwartym podglądem („Component stock optimisation”). Sprawdzone oczami: kolumna „INITIATIVE / CASE” szeroka (najszersza w tabeli), „Kopiuj link” widoczny na dole panelu BEZ przewijania, BRAK sekcji „What's next” w podglądzie. ✓
- `k5-preview-work.png` — Praca z otwartym podglądem („Close the security audit”). Struktura zgodna z kanonem Insight (nagłówek, meta, sekcja treści, „Powiązania”, przyciski akcji na dole). ✓
- `k5-raporty-realizacja.png` — Reports z `&runs=0`. Przycisk „Nowy raport” widoczny w prawym górnym rogu (element wymagany checklistą — spełniony). **Uwaga pomiarowa**: przy `runs=0` tabela NIE jest dosłownie pusta — pokazuje 2 wiersze („Tygodniowy pakiet realizacji”, „Obłożenie zasobów”) zamiast 0. Zweryfikowano DWOMA metodami: (a) 2 niezależne izolowane konteksty przeglądarki dały identyczny wynik (nie jest to przeciek stanu między ekranami); (b) wywołanie `fetch('/api/execution-reports/runs')` bezpośrednio w stronie (po zamontowaniu) zwróciło poprawnie `{“items”:[]}` — stub dev-render DZIAŁA POPRAWNIE, rejestr migawek jest faktycznie pusty. **Sprostowanie wobec poprzedniej wersji tego raportu** (`fbe836abb0`): teza „stub przechwytuje zły URL i komponent spada na demo-fallback” jest FAŁSZYWA — zweryfikowano bezpośrednim wywołaniem fetch, stub zwraca pustą listę. Skąd biorą się 2 widoczne wiersze pozostaje NIEWYJAŚNIONE (prawdopodobnie `ExecutionReportsSurface` łączy pusty rejestr migawek z częścią katalogu definicji w widoku „Do przeglądu”, ale dokładna reguła filtrująca nie została ustalona w czasie tego pomiaru — poza zakresem „mierz, nie napraw”). Sam wymagany element checklisty (przycisk „New report”) jest obecny niezależnie od tego niewyjaśnionego zachowania.
- `inicjatywy-lista.png` — Lista Inicjatyw, Menu 3: dokładnie **3 chipy** („Wszystkie 9”, „Do zatwierdzenia 4”, „W realizacji 2”) zgodnie z kanonem DEC-420 (≤3 chipy + dropdown w Menu 2). ✓

Harness zatrzymany po zrzutach (`kill` procesu vite na porcie 5318).

## Podsumowanie

- Mechanika (tsc front+server, kanon list/artefaktów, język, build) — **ZIELONA**, wszystkie progi dotrzymane, część dokładnie na granicy (189 błędów TS, 322 naruszenia kanonu).
- Testy — 96/106 zielone; 9 czerwieni ZASTANYCH (identyczne z bazą, niezwiązane ze scaleniem) + **1 NOWA punktowa regresja** w `ExecutionResources.wiszacaRealizacja.test.tsx` — to jest przyczyna werdyktu CZERWONA, do naprawy przed dalszym scalaniem.
- Build i smoke wizualny — ZIELONE mechanicznie (checklist część B spełniona oczami: 4 ekrany, wzorce zgodne z SPEC-L/SPEC-A), z jednym otwartym, niewyjaśnionym pytaniem produktowym (Reports `?runs=0` pokazuje 2 wiersze zamiast 0 mimo poprawnie pustego API) — nie blokuje bramki technicznie, ale wymaga dalszego zbadania.

## Higiena

- `gate-base` (worktree tymczasowy do porównań z `cf3fded7e4`) — utworzony i usunięty (`git worktree remove --force`) po zakończeniu pomiaru.
- Harness dev-render (port 5318) zatrzymany.
- Drzewo `kandydat-20260913` czyste na starcie i na końcu pomiaru; żaden plik poza tym raportem nie został scommitowany; brak push.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
