# Finance v3 — raport dla Codex (2026-08-11)

Raport z dwóch kolejnych sesji orkiestracyjnych. Przeznaczenie: **niezależny odbiór**.
Napisany tak, żeby dało się go obalić — każda liczba ma podaną komendę i SHA.

**Status ogólny: `PARTIAL` — NIE `READY`.**
Program ma dziś działający, przetestowany backend z powierzchnią HTTP i zalążkiem warstwy UI,
ale **nie ma kompletnego produktu** i **nie przeszedł warstw 4–5 protokołu odbioru**.

---

## 1. CO JEST PRZEDMIOTEM ODBIORU

| | |
|---|---|
| Gałąź | `codex/finance-v3-complete-product-integration` |
| Candidate SHA (kod) | **`45c39d68d0`** |
| Poprzedni, w pełni zmierzony candidate | **`4489fdcab8`** (protokół `_evidence_run_accept`) |
| Worktree | `~/consultify-wt/fv3-product` |
| Zamrożone, nietknięte | `codex/finance-v3-closeout-fanin` @ `19b4b06934` |

**NOT PUSHED · NOT MERGED · NOT DEPLOYED · STAGING NOT VERIFIED · PRODUCTION NOT VERIFIED.**

---

## 2. DOWODY NA JEDNYM SHA (`4489fdcab8`)

Pełny przebieg, jedna konfiguracja, świeży efemeryczny PostgreSQL 15.
Surowe logi: `docs/validation/finance-v3/generated/gate-d/_evidence_run_accept/raw/`.

| # | Bramka | Wynik |
|---|---|---|
| 02 | Migracje STRICT, świeża baza (**bez `--safe`**) | **exit 0, 637**, 1580 tabel (public 1459 + v8 121) |
| 03 | `src/services/finance` | **47 plików / 722 testy**, exit 0 |
| 03b | **Kontrola negatywna bramki DB** | 19 passed \| 28 skipped → **319 z 722 to testy realnej bazy** |
| 04 | `src/services/finance/canonical` | **37 plików / 454 testy**, exit 0 |
| 05 | `tests/resultsVnext/roi` | **37 / 120**, exit 0 |
| 06 | `tests/resultsVnext` | **55 / 278**, exit 0 |
| 07 | `tsc --noEmit -p server/tsconfig.json` | **exit 0, zero linii** |
| 08 | Dług typów w plikach testowych | **`EVIDENCE_MISSING`** — patrz §6 |

**Krok 03b jest kluczowy dla wiarygodności:** dowodzi, że zieleń nie pochodzi z atrapy.
Bez bramki 319 testów jest **pomijanych** i nigdy nie raportuje `passed`.

**Pakiety ROI-E007 (`roi` 120, `resultsVnext` 278) nie zmieniły się przez całą pracę** —
zaakceptowana praca właściciela przeszła przez trzy fale i ~20 agentów bez zadrapania.

Na `45c39d68d0` (po dołożeniu warstwy API i UI) potwierdzone niezależnie:
migracje **exit 0 / 637**, `tsc -p server` **exit 0 zero linii**.

---

## 3. CO ZOSTAŁO NAPRAWIONE — 13 klas defektów

### Bezpieczeństwo najemcy (klasa zamknięta strukturalnie)

| Id | Waga | Defekt | Dowód naprawy |
|---|---|---|---|
| W9-C-5 | **P0** | `getJob`/`cancelJob`/`failJob` bez `organizationId` — org A **anulowała compute** org B | org-scoping + predykat SQL; weryfikacja niezależnym probem |
| W9-C-4 | **P0** | `writeSensitivityGrid` — org A **kasowała 25 komórek** org B, bez śladu audytowego | weryfikacja właściciela + predykaty; **obrona dwuwarstwowa udowodniona** |
| W9-C-7 | strukturalne | tabele-dzieci z `organization_id` bez złożonego FK | nowa migracja, **6 tabel** |
| W9-C-1/2/3 | P1 | `loadContext`/`runPreflight`/`findOrCreateMethod` czytały cudze dane | org-scoping, typowana odmowa |
| **NEW-3** | **P1, mutacja** | **`claim()` w self-claim zabierał zadanie cudzej organizacji pod ZWYKŁYM równoległym użyciem** | nowa `claimById()`, 5 miejsc przestawione; `claim()` celowo nietknięty pod przyszłą pulę |
| NEW-2 | P2 | `resolveSourceStatementPackVersion()` bez predykatu org | naprawione |
| — | strukturalne | `finance_comment_assignments`, `finance_post_investment_reviews` | +2 złożone FK |

**NEW-3 zasługuje na osobną uwagę:** pierwotny pomiar uznał `claim()` za celowo międzyorganizacyjny,
powołując się na ADR WP-B04 (pula workerów bierze po `job_type`). **Ale puli workerów nie ma** —
cztery serwisy robią self-claim. Założenie ADR nie było spełnione, a self-claim odziedziczył
semantykę, która do niego nie pasuje. **Gdy ADR uzasadnia zachowanie architekturą, sprawdź,
czy ta architektura istnieje.**

### Poprawność obliczeń

- **W10-D01** — `content_semantic_hash`/`compute_run_id` NULL wszędzie. Naprawione + **dwa
  dodatkowe bugi**: `approveVersion()` nie kopiował hasha na wersję biznesową, `reopenVersion()`
  nie miał `compute_run_id` w kolumnach INSERT.
  **Unikalność snapshotu ożyła** — constraint istniał od migracji b06, był martwy **wyłącznie
  przez NULL** (w Postgresie NULL nie koliduje w UNIQUE).
- **★ Hash semantyczny był NIEDETERMINISTYCZNY.** 10 przebiegów tej samej, niezmienionej
  Analysis → **6–7 różnych `content_semantic_hash`**. Wycena → 3 różne bity przy **bajtowo
  identycznych** zapisanych wejściach. Przyczyna: zapytania bez `ORDER BY`; zwykły `UPDATE`
  przestawia fizyczną kolejność już po 1–3 iteracjach, a **dodawanie float nie jest łączne**.
  Naprawa: sortowanie **w pamięci przed hashowaniem/sumowaniem**, bez zmiany SQL.
  **Waga biznesowa: zero** (~1e-9, poniżej progu zaokrąglenia). **Waga dowodowa: wysoka** —
  bez tego mechanizm W10-D01 działał tylko pozornie.
  **Rozróżnienie do utrzymania:** „DCF 0,000000% do oracle" to twierdzenie o **dokładności
  jednego przebiegu**, nie o **powtarzalności między przebiegami**. Pierwsze było prawdziwe,
  gdy drugie było fałszywe.
- **Pakiet A** — 25 zapytań w audycie, 5 naprawionych (w tym 2 nowe w `predictionPreflightService`),
  20 świadomie zostawionych. Decyzja o kolejności zdarzeń finansowania
  (`DISCRETIONARY_REPAYMENT` przed `FACILITY_DRAWDOWN`) zaimplementowana jako **nazwana,
  eksportowana stała** — audytowalna.

### Kolejka i integralność operacyjna
- **W9-B-2 „fałszywy sukces"** — 4 silniki ignorowały wynik `completeJobSuccess()` i meldowały
  sukces, gdy wyniku w bazie nie było. Rozstrzygnięcie: `NOT_RUNNING` → twardy błąd,
  `OUTPUT_ALREADY_COMMITTED` → idempotentny sukces.
- **EM-1…EM-4, EM-6, W9-B-1** — heartbeat, **reaper realnie podpięty w `Scheduler.ts`**
  (cron co minutę, domyślnie ON), kill switch, limit współbieżności per org, exception ledger
  przy dead-letterze, domknięcie księgowania anulowania.
- **F-2** — backfill niebezpieczny przy równoległym uruchomieniu. **Ciche zdublowanie
  ZREPRODUKOWANE** (dwie sesje `psql`, oba `COMMIT`, dwa wiersze z identycznym kluczem, zero błędu).
  Naprawa dwuwarstwowa: `pg_try_advisory_lock` + częściowy indeks unikalny.
- **Determinizm backfillu udowodniony** — 2 przebiegi, 22 tabele, bajtowo identyczne.
  **Przy okazji: sam generator danych używał `Math.random()`/`new Date()`**, więc pierwotny
  „dry run" nigdy nie był powtarzalny.

### Warstwa dostępowa
- **Powierzchnia HTTP: 2 → 32 endpointy** (`/api/v8/finance-v2/*`): artefakty, wersje, przejścia
  lifecycle, compute jobs, capabilities, statements, analysis, baseline, prediction
  (**`preflight` i `calculate` OSOBNO** — DEC-FIN-004), lineage, freshness, exceptions.
  Macierze cross-tenant **8/8** i **10/10**, każdy przypadek z **niezależnym odczytem SQL**.

---

## 4. CO JEST UCZCIWIE NIEDOMKNIĘTE

| Pozycja | Klasa | Przyczyna |
|---|---|---|
| **FC-09, FC-10** (16 warunków) | `BLOCKED_EXTERNAL` | Brak warstwy UI. Program to adresuje, ale piony D–H **nie są ukończone** |
| **FC-12** (6 warunków) | `BLOCKED_EXTERNAL` | Wymaga **niezależnego recenzenta CFO** |
| **Aktywacja RLS** | `BLOCKED_EXTERNAL` | Polityki napisane, przetestowane trzema stanami — ale **jedyna rola to `postgres`, superuser z `rolbypassrls`, właściciel wszystkich tabel. Superuser omija RLS ZAWSZE, nawet z `FORCE`.** Wymaga least-privileged roli na Railway |
| **Cutover / rollback / shadow parity** | `BLOCKED_EXTERNAL` | Brak stagingu. **Zero prób w całym korpusie** |
| **SLO produkcyjne p50/p95/p99** | `EVIDENCE_MISSING` | Dwa przebiegi tego samego kodu różniły się **9,3×** (load do 168). Zadeklarowano wyłącznie **próg regresyjny CI** z mnożnikiem 5×, uzasadnionym granicą zapłonu 4,3–4,6× |
| **EM-5 pula workerów** | `EVIDENCE_MISSING` | `compute_jobs` **nie ma kolumny payloadu** — nie da się odtworzyć parametrów cudzego zadania |
| **Happy path `baseline/compute` i `prediction/calculate`** | `EVIDENCE_MISSING` | Testowano tylko ścieżki błędów; fikstura solvera przekraczała budżet |
| **Pakiet A** | `PARTIAL` | Brak fikstury e2e dla `runOverlayCompute`/`runPreflight` — **nie ma jej nigdzie w repo** |
| **Dług typów w testach** | `EVIDENCE_MISSING` | Pomiar źle skonstruowany 3× — patrz §6 |
| **Warstwa 4 (Playwright) i 5 (odbiór ekspercki)** | `BLOCKED_EXTERNAL` | Bez UI i recenzenta |

**Ustalenie zmieniające kalkulację ryzyka:** **Finance v3 nie istnieje na żadnej żywej bazie.**
`information_schema` na PROD/DEMO/DEV: **0 / 2 / 1** tabel `finance\_%`, przy czym te 2 na DEMO
to stary, niezwiązany moduł. `finance_analysis_kpi_values`, `finance_working_revisions`,
`compute_job_outputs` — **nie ma ich nigdzie**. Liczba zapisanych hashy, które naprawy mogłyby
unieważnić, wynosi **ZERO**.

---

## 5. STAN UI — 0 z 22 wymagań właścicielskich spełnionych w pełni

Inwentaryzacja (pakiet M): 66 komponentów Finance/Economics.
**`FinanceHub` (lista + preview) JEST zgodny z TRIADA. Wszystkie 5 workspace'ów szczegółu
jest bespoke — zero komponentów standardu.**
Frontend wołał **wyłącznie legacy** `/api/v8/finance` — zero odwołań do kanonicznego API.
**Martwy kod:** 19/20 `Economics/panels/`, 9/9 `Economics/charts/` — zero mountów produkcyjnych;
w `dev-render` był komentarz **fałszywie** twierdzący, że dwa panele są „wired to real data".

**Dostarczono (pakiet C, za flagą `financeWorkspacePlatformV1`, `defaultValue: false`,
zero importerów produkcyjnych):** klient API, `FinanceWorkspaceBar`, Focus Mode
(dowód Playwright: **draft przetrwał bajtowo** przez cykl focus/`Esc`), `FinanceErrorBoundary`.
Twarde kryterium paska **spełnione**: 60 znaków przy 1280 px bez nakładania, ≤5 kontrolek.

**Odbiór wizualny przez orkiestratora wykrył sześć naruszeń kanonu, których nie było
w żadnym raporcie tekstowym** — m.in. oś czasu zdarzeń w modelu **no-decision**, akcję wyceny
w pasku Models, cztery widoki zamiast dwóch, mieszankę językową i ~50% martwej przestrzeni.

---

## 6. GDZIE POMIAR ZAWIÓDŁ — zgłoszone, nie ukryte

**Krok 08 (dług typów w plikach testowych) był źle skonstruowany trzykrotnie:**
1. 2274 „błędy" — **wszystkie `TS6059`**, czysty artefakt dziedziczonego `rootDir: server`.
2. Po poprawce **exit 134 (SIGABRT/OOM)** — przy zerze błędów **wygląda jak sukces**.
3. Po obu poprawkach 7218 błędów — **nieporównywalne**, bo zakres objął całe drzewo testowe
   repo i brakowało globali vitest.

**Wiarygodna delta: `353 → 48`** z `W9_TYPEDEBT_B_VERIFICATION_report.md`.
**Fakt niezależny od porównania: całe drzewo testowe repo nie jest typecheckowane przez nic** —
`server/tsconfig.json` wyklucza `**/*.test.ts`, a vitest używa esbuilda. To nie teoria:
w tej pracy zmiana sygnatury złamała test z innego strumienia i **`tsc` tego nie zauważył**.

---

## 7. CZEGO SZUKAĆ, ŻEBY TEN RAPORT OBALIĆ

Sugerowane wektory ataku dla niezależnego recenzenta:

1. **Uruchom pełny przebieg samodzielnie** — `single_sha_evidence_run.sh <PORT> <TAG>`
   na `45c39d68d0`. Skrypt ma twardą bramkę „brudne drzewo = przerwij".
2. **Zweryfikuj krok 03b.** Jeśli liczba testów realnej bazy nie zgadza się z 319, zieleń może
   pochodzić z atrapy.
3. **Zaatakuj macierze cross-tenant własnym probem**, nie testami autorów — tak wyszedł NEW-3.
4. **Sprawdź, czy `claim()` nadal ma nietkniętą semantykę** i czy `claimById()` faktycznie
   ogranicza self-claim.
5. **Spróbuj odtworzyć plug w Baseline** — model z ujemną kasą **musi** pokazać ujemną kasę
   i alarm, nie zbilansować się cicho.
6. **Sprawdź `N/A` vs `PLN 0`** w wycenie — metoda bez kompletnych danych.
7. **Powtórz rachunek permutacyjny** dla hashy — i pamiętaj, że **powtarzanie przebiegów
   nie jest dowodem**, bo Postgres nie ma obowiązku rozjechać się na żądanie.
8. **Zweryfikuj commity `wip(...)`** na czterech gałęziach fali C — są **jawnie niezweryfikowane**
   i nie powinny być traktowane jak dostarczona praca.

---

## 8. REKOMENDACJA

**Nie nadawać statusu terminalnego.** Program jest w stanie `PARTIAL`:
backend ma pokrycie dowodowe warstw 1–3 na jednym SHA, warstwa API istnieje,
platforma UI ma fundament — ale **pięć pionów produktowych nie jest ukończonych**,
**0 z 22 wymagań właścicielskich nie jest spełnione w pełni**, a warstwy 4–5 protokołu
odbioru są nieosiągalne bez UI i zewnętrznego recenzenta.

Właściwy następny krok to **domknięcie fali C i pionów D–H**, potem **odbiór wizualny
przez właściciela ekran po ekranie** (reguła #7 CLAUDE.md — nigdy hurtem), i dopiero
wtedy pełny przebieg na nowym candidate SHA.
