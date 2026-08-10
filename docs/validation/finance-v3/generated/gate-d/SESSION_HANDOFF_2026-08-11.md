# Finance v3 — handoff sesji (2026-08-11)

Dokument przekazania. Napisany przez orkiestratora sesji, która przejęła program po
`SESSION_HANDOFF_2026-08-10.md`, zamknęła dwa P0 wycieku międzytenantowego, W10-D01,
odbiór `w9-typedebt-b` i wykonała **pierwszy w historii programu pełny przebieg
dowodowy na jednym candidate SHA**.

---

## 1. STAN ZAMROŻONY — nie dotykać (bez zmian)

**`codex/finance-v3-closeout-fanin` @ `19b4b06934`** — ROI-E007 Round 1,
zaakceptowany przez właściciela. Status: **ACCEPTED / LOCAL / NOT DEPLOYED**.

**Zweryfikowane w tej sesji:** `19b4b06934` jest nadal przodkiem gałęzi (jej tip to
`36ae9b3665`, jeden commit ponad, wyłącznie raport). Gałąź **nie została w tej sesji
dotknięta**: zero merge'ów, zero pushów, zero połączeń ze staging/demo/produkcją.
Wszystkie pomiary na własnych, efemerycznych klastrach, usuniętych po pracy.

Zakazy obowiązują bezterminowo do odwołania przez właściciela.

---

## 2. CANDIDATE SHA — punkt startu dla następnej sesji

**`8db62fa385`** na gałęzi `codex/finance-v3-wave2-fanin2`.
Worktree: `~/consultify-wt/fv3-fanin2`.

Raport dowodowy leży commitem **dokumentacyjnym** nad nim (`dadc595955`) — ten sam
wzorzec, co na gałęzi zamrożonej. Zweryfikowane: między `8db62fa385` a `dadc595955`
**zero plików kodu**.

### Pełny przebieg na jednym SHA — wyniki

Wszystko poniżej zmierzone w **jednym przebiegu, na jednym SHA, jedną konfiguracją**,
na świeżym efemerycznym klastrze PostgreSQL 15. Surowe logi:
`docs/validation/finance-v3/generated/gate-d/_evidence_run_fanin2/raw/`.

| # | Co | Wynik |
|---|---|---|
| 02 | Migracje STRICT, świeża baza (**bez `--safe`**) | **exit 0**, 635 zastosowanych, **1580 tabel** (public 1459 + v8 121) |
| 03 | `src/services/finance` (z `server/`) | **43 pliki / 712 testów**, exit 0 |
| 03b | **Kontrola negatywna bramki DB** — ten sam zestaw bez `RUN_DB_TESTS`/`MOCK_DB`/`DATABASE_URL` | 16 passed \| 27 skipped → **318 z 712 to testy realnej bazy** |
| 04 | `src/services/finance/canonical` | **33 pliki / 444 testy**, exit 0 |
| 05 | `tests/resultsVnext/roi` (z korzenia) | **37 plików / 120 testów**, exit 0 |
| 06 | `tests/resultsVnext` (z korzenia) | **55 plików / 278 testów**, exit 0 |
| 07 | `tsc --noEmit -p server/tsconfig.json` | **exit 0, zero linii wyjścia** |
| 08 | Dług typów w plikach testowych | **`EVIDENCE_MISSING`** — pomiar źle skonstruowany, patrz §6 |

**Znaczenie kroku 03b:** zieleń z kroku 03 pochodzi z realnej bazy, a nie z atrapy.
318 z 712 testów faktycznie dotyka Postgresa; bez bramki są pomijane, **nigdy nie
raportują `passed`**.

**Postęp względem punktu wyjścia sesji (`1271a0f721`):**
`finance` 638 → **712** · `finance/canonical` 416 → **444** · migracje 632 → **635**.
Przyrost testów to warstwy dowodowe (kolejka, RLS, fałszywy sukces, self-claim, SLO,
known-answer), nie rozdmuchanie.

### ★ ZAKRES TEGO PRZEBIEGU — czytaj, zanim zameldujesz „odbiór"

Protokół §16A ma **pięć warstw**. Ten przebieg domyka **warstwy 1–3**
(statyczna/kontraktowa · finansowa/known-answer · RealDB/API/jobs).

**Warstwa 4 (Playwright browser E2E) i warstwa 5 (odbiór ekspercki: CFO + QA/UX +
design-system) są NIEOSIĄGALNE** — nie ma warstwy UI i nie ma zewnętrznego recenzenta.
To nie jest luka tego przebiegu, tylko stan programu. **FC-09, FC-10 i FC-12 —
23 warunki — pozostają `BLOCKED` niezależnie od tego, jak zielony jest ten przebieg.**

---

## 3. CO ZOSTAŁO NAPRAWIONE (11 klas defektów)

### Wycieki międzytenantowe — zamknięta cała klasa

| Id | Waga | Co było | Stan |
|---|---|---|---|
| W9-C-5 | **P0** | `getJob`/`cancelJob`/`failJob` bez `organizationId` — org A **anulowała compute** org B | naprawione, org-zakresowane, typowana odmowa |
| W9-C-4 | **P0** | `writeSensitivityGrid` — org A **kasowała 25 komórek** org B, bez śladu audytowego | naprawione: weryfikacja właściciela + predykaty org |
| W9-C-7 | strukturalne | tabele-dzieci z `organization_id` bez złożonego FK `(rodzic, organization_id)` | nowa migracja, **6 tabel** |
| W9-C-1/2/3 | P1 | `loadContext` / `runPreflight` / `findOrCreateMethod` czytały cudze dane | naprawione |
| W9-C-6 | P2 | `computeAnalysisKpis()` rzucał gołym `Error` → HTTP 500 zamiast 404 | typowany `{ok:false, code}` |
| **NEW-3** | **P1, mutacja** | **`claim()` w self-claim zabierał zadanie cudzej organizacji pod ZWYKŁYM równoległym użyciem** | nowa `claimById()`, 5 miejsc przestawione; `claim()` celowo nietknięty |
| NEW-2 | P2 | `resolveSourceStatementPackVersion()` czytał `finance_lineage_edges` bez predykatu org | naprawione |
| — | strukturalne | `finance_comment_assignments`, `finance_post_investment_reviews` — ta sama klasa luki | nowa migracja, +2 FK |

### Pozostałe

- **W10-D01** — `content_semantic_hash`/`compute_run_id` NULL wszędzie. Naprawione.
  Przy okazji znaleziono **dwa dodatkowe bugi**: `approveVersion()` nie kopiował hasha
  ani `compute_run_id` na wersję biznesową; `reopenVersion()` w ogóle nie miał
  `compute_run_id` na liście kolumn INSERT.
  **Unikalność snapshotu ożyła** — constraint istniał od migracji b06, był martwy
  wyłącznie przez NULL (w Postgresie NULL nie koliduje w UNIQUE). Duplikat teraz
  odrzucany surowym `23505`.
- **W9-B-2 „fałszywy sukces"** — cztery silniki ignorowały wynik `completeJobSuccess()`
  i meldowały sukces, gdy wyniku w bazie nie było. Naprawione, z rozróżnieniem:
  `NOT_RUNNING` → twardy błąd, `OUTPUT_ALREADY_COMMITTED` → idempotentny sukces.
- **Kolejka zadań (EM-1…EM-4, EM-6, W9-B-1)** — heartbeat, reaper (realnie podpięty
  w `Scheduler.ts`, cron co minutę, domyślnie ON), kill switch, limit współbieżności
  per organizacja, exception ledger przy dead-letterze, domknięcie księgowania anulowania.
- **Determinizm backfillu** — udowodniony. **Przy okazji: sam generator danych używał
  `Math.random()` i `new Date()`**, więc pierwotny „dry run" nigdy nie był powtarzalny.
  Naprawione (seeded PRNG + stały timestamp).
- **Known-answer KPI** — 8/18 → **17/18** (stan zastany był lepszy niż raportowany:
  `DIO`/`DPO` miały już pokrycie z RC-04, nigdy niedoliczone).
- **Defekt interakcji fan-inu** — `findOrCreateMethod` zmieniło kształt zwracanej
  wartości; `coldReopen.pg.test.ts` z innej gałęzi czytał `.id` z unii, dostawał
  `undefined` i wpychał NULL-owy `method_id`. **Każda gałąź osobno zielona, razem
  czerwone.** To jest cała racja bytu reguły jednego SHA.
- **Konflikt semantyczny `NO_CONTENT_HASH`** — stemplowanie hasha przy `createArtifact()`
  zabiło bramkę „nie przypinaj compute do pustego artefaktu". Rozstrzygnięty bramką
  **strukturalną** (`revision_seq > 1 OR compute_run_id IS NOT NULL`), nie porównaniem
  wartości hasha — bo `EXPLICIT_SAVE` z pustym stosem operacji daje ten sam hash.

---

## 4. CO ZNALEZIONO I ŚWIADOMIE ZOSTAWIONO

| Id | Waga | Rzecz | Dlaczego zostało |
|---|---|---|---|
| **F-2** | **P1, zreprodukowany** | Backfill **niebezpieczny przy równoległym uruchomieniu** — brak `pg_advisory_lock`, wyścig TOCTOU w `getOrCreateArtifact()`. Do tego `finance_artifacts.natural_key` **nie ma ograniczenia unikalności**, więc przy innym timingu wyścig mógłby **cicho zdublować artefakt** | wymaga decyzji, czy backfill w ogóle ma chodzić współbieżnie |
| F-1 | P2 | `finance_export_manifests.content_semantic_hash` liczony z `sha256(losowy business_version_id)`, **nie z treści** — sprzeczne z celem WP-B06 „reproducibility" | poza zakresem fali |
| EM-5 | częściowo | **Pula workerów nie istnieje.** Reaper jako pętla tła jest realny, ale nie ma procesu drenującego cudze zadania — bo **`compute_jobs` nie ma kolumny payloadu** i nie da się odtworzyć parametrów domenowych | wymaga decyzji schematu poza ADR WP-B04 |
| EM-9 | **BLOCKED** | **RLS jest dziś inertne.** Jedyna rola w klastrze to `postgres` — superuser z `rolbypassrls`, właściciel wszystkich tabel. **Superuser omija RLS zawsze, nawet z `FORCE`** | wymaga least-privileged roli DB na Railway (`CREATE ROLE` + `GRANT` + zmiana `DATABASE_URL`) |
| — | P1 | Cztery pliki testowe importują symbole **nieistniejące w `server/src`** (`ensureCurrentPptxExport`, `CurrentPptxExportError`, `isArtifactRunLifecycleMaterializable`, `resolvePresentationTemplateArtifactPosture`) — martwe testy | obszar artifact-studio, poza Finance v3; wystawione jako osobne zadanie |
| — | P2 ×3 | Niekompatybilne słowniki `P10_CONFIDENCE_LEVELS` vs `P10ExtendedConfidenceLevel` · rozjazd `workspaceId`/`workspace_id` w `ChatToSchemaService` · kolizja `pdf-parse.d.ts` v1 z zainstalowanym v2.4.5 | dług sprzed programu |
| — | — | Cztery silniki liczą `contentSemanticHash` własnym inline `createHash('sha256')` zamiast wspólnego prymitywu. Dziś algorytm identyczny → brak rozjazdu, ale **`canonicalPayloadHash` NIE sortuje kluczy**, więc nazwa „canonical" jest myląca | zaplanowane, nie wykonane |

---

## 5. STAN BRAMEK — co się zmieniło

| Bramka | Było | Rekomendacja po tej sesji | Uzasadnienie |
|---|---|---|---|
| **FC-01** | `NO-GO` (5 potwierdzonych naruszeń izolacji) | **`GO z zastrzeżeniem`** | wszystkie 5 naruszeń naprawionych i zweryfikowanych niezależnym probem; zastrzeżenie: obrona wyłącznie aplikacyjna + FK, RLS inertne |
| **FC-02.2** | `PARTIAL` | **`PASS` z zakresem „single-writer execution"** | determinizm i idempotencja udowodnione dla trybu, w jakim skrypt realnie działa; współbieżność **udowodniona jako niebezpieczna** |
| **FC-04.3** | `PARTIAL 6/18` | **17/18** | 1 pozycja strukturalnie niedostępna (`DEBT_TO_EBITDA`, RC-09) |
| **FC-05.8** | zaliczone **próżniowo** (NULL == NULL) | realnie zaliczone | hash niepusty, cold reopen 4/4 w osobnym procesie OS |
| **FC-11** | 0 PASS, 7 `EVIDENCE_MISSING` | próg **regresyjny** zadeklarowany; **SLO produkcyjne nadal `EVIDENCE_MISSING`** | dwa własne przebiegi różniły się **9,3×** przy load 168; progu nie da się dziś uczciwie postawić |
| FC-09 / FC-10 / FC-12 | `BLOCKED` | **`BLOCKED` bez zmian** | brak UI (23 warunki), brak recenzenta CFO |

---

## 6. DLACZEGO KROK 08 TO `EVIDENCE_MISSING` — i czego się z tego nauczyć

Pomiar długu typów w plikach testowych **nie udał się** i jest to zapisane wprost,
zamiast zaraportowane jako regresja. Trzy pułapki po kolei:

1. Pierwszy przebieg: **2274 błędy** — wszystkie `TS6059` („plik poza `rootDir`").
   Czysty artefakt konfiguracji: tymczasowy tsconfig dziedziczył `rootDir: server`.
   **Zero realnych błędów typów.**
2. Po poprawce: **exit 134** (SIGABRT = OOM). Przy zerze błędów **wygląda to jak
   sukces** — udokumentowana pułapka tego repo. Wymaga `--max-old-space-size=12288`.
3. Po obu poprawkach: 7218 błędów w 1247 plikach — **też nieporównywalne** z punktem
   odniesienia 353/97, bo (a) zakres objął całe drzewo testowe repo (2293 + 3202 plików),
   (b) konfiguracja nie ładuje globali vitest (281 × `TS2593 Cannot find name 'describe'`).

**Wiarygodny pomiar delty:** `353 → 48` z `W9_TYPEDEBT_B_VERIFICATION_report.md`,
na własnym, zakresowanym tsconfigu weryfikatora.

**Fakt wart odnotowania, niezależny od porównania:** całe drzewo testowe repo
**nie jest typecheckowane przez nic** — `server/tsconfig.json` wyklucza `**/*.test.ts`,
a vitest używa esbuilda. To nie jest teoria: w tej sesji zmiana sygnatury funkcji
złamała test z innego strumienia i **`tsc` tego nie zauważył**.

---

## 7. MAPA GAŁĘZI

| Gałąź | SHA | Zawartość |
|---|---|---|
| **`codex/finance-v3-wave2-fanin2`** | **`8db62fa385`** (+ docs `dadc595955`) | **candidate SHA — wszystko poniżej** |
| `codex/finance-v3-wave2-fanin` | `403d430520` | fan-in fali 1 + naprawa defektu interakcji |
| `codex/finance-v3-p0tenant` | `177eb7b515` | P0 ×2 + P1 ×3 + P2 + migracja FK |
| `codex/finance-v3-d01hash` | `eb13cd36dd` | W10-D01 + 2 bugi |
| `codex/finance-v3-tdverify` | `cc9ec8c447` | odbiór `w9-typedebt-b` (`ACCEPT`) |
| `codex/finance-v3-w10-knownanswer` | `cfd0e26c1d` | known-answer 17/18 |
| `codex/finance-v3-w2-kolejka` | `80a0e7e560` | EM-1…EM-4, EM-6, W9-B-1 |
| `codex/finance-v3-w2-falszywysukces` | `c99eec4f40` | W9-B-2 |
| `codex/finance-v3-w2-rls` | `0cad08fe4d` | RLS pilotaż + diagnoza |
| `codex/finance-v3-w2-p0verify` | `c7e22cc78f` | weryfikacja P0 (`ACCEPT_WITH_BACKLOG`) |
| `codex/finance-v3-w2-slo` | `e3503acd36` | FC-11 progi regresyjne |
| `codex/finance-v3-w2-pinsemantics` | `0547d6e75f` | semantyka `NO_CONTENT_HASH` |
| `codex/finance-v3-w2-backfill` | `fa3e75f75e` | determinizm + idempotencja |
| `codex/finance-v3-w2-selfclaim` | `51d7939f66` | NEW-3, NEW-2, +2 FK |

**Nic nie wypchnięte. Nic nie wdrożone. Zero migracji poza efemerycznymi klastrami.**

---

## 8. PUŁAPKI ŚRODOWISKOWE — dziewięć z poprzedniego handoffu nadal aktualne, plus trzy nowe

Dziewięć z `SESSION_HANDOFF_2026-08-10.md` §5 obowiązuje bez zmian. Nowe:

10. **`tsc` przy dużym zakresie pada z exit 134 (OOM) i przy zerze błędów wygląda na
    sukces.** Zawsze sprawdzaj kod wyjścia, nie tylko liczbę błędów.
    `NODE_OPTIONS=--max-old-space-size=12288`.
11. **Tymczasowy tsconfig rozszerzający `server/tsconfig.json` dziedziczy `rootDir: server`**
    → lawina `TS6059` udająca regresję. Nadpisz `rootDir: "."`.
12. **Zmiana sygnatury funkcji nie ma w tym repo żadnej automatycznej ochrony po stronie
    testów.** Po każdej takiej zmianie przejdź gerpem WSZYSTKICH wywołujących w
    `server/src` **oraz** `tests/` — `tsc` ich nie widzi.

---

## 9. REKOMENDOWANA KOLEJNOŚĆ DLA NASTĘPNEJ SESJI

0. **Decyzja właściciela o warstwie UI** — nadal największy pojedynczy odblokowany
   zakres (**16 warunków FC naraz**). Wymaga procesu z regułą #7 CLAUDE.md:
   agent renderuje i robi zrzut, właściciel akceptuje ekran po ekranie, **nigdy hurtem**.
1. **F-2** — zabezpieczyć backfill `pg_advisory_lock` i dołożyć ograniczenie unikalności
   na `finance_artifacts.natural_key`, zanim ktokolwiek podepnie go pod orkiestrator.
2. **Least-privileged rola DB** — bez niej RLS pozostaje dekoracją. Wymaga dostępu do
   infrastruktury Railway.
3. **Typecheck testów w CI** — dziś nic ich nie sprawdza, a to już raz kosztowało
   defekt interakcji w tej sesji.
4. EM-5 (pula workerów) — najpierw decyzja o kolumnie payloadu w `compute_jobs`.
5. Konsolidacja czterech inline'owych hashy silników do `canonicalPayloadHash`
   (+ rozstrzygnąć, czy „canonical" ma sortować klucze).

**Nadal nieosiągalne bez zasobów zewnętrznych:** Gate C04–C06 (shadow parity, cutover,
rollback) — prawdziwy staging · FC-12 — recenzent CFO · FC-09/FC-10 — wyrenderowane UI ·
stan demo/staging nadal niezweryfikowany (nikt nie sprawdził, czy tabela ochronna tam
istnieje i ma triggery).

---

## 10. METODA, KTÓRA SIĘ SPRAWDZIŁA — do powtórzenia

- **Jeden worktree = jeden agent**, z jawnym podziałem własności plików w briefie.
  Osiem gałęzi fali 2 scaliło się z **jednym** konfliktem, i to trywialnym
  (dwie funkcje dodane w tym samym miejscu).
- **Weryfikację zleca inny agent niż autor.** Wyłapało to NEW-3 — mutację
  międzytenantową, której pierwotny pomiar nie zauważył, bo zaufał założeniu ADR
  o puli workerów, która nie istnieje.
- **Kontrola negatywna obowiązkowa.** Wielokrotnie ujawniła obronę wielowarstwową
  (przy `writeSensitivityGrid` sam FK już bronił, więc cofnięcie serwisu nie odtwarzało
  defektu) — czyli mierzyła co innego, niż się wydawało.
- **`EVIDENCE_MISSING` pisany wprost.** Agenci sami zgłaszali luki zamiast zaokrąglać:
  próżniowe FC-05.8, niemożliwe SLO przy rozrzucie 9,3×, RLS inertne pod superuserem,
  własny błąd w komparatorze backfillu, `DEBT_TO_EBITDA` strukturalnie niepoliczalne.
- **Commit po każdym etapie.** Dwóch agentów zacięło się na oczekiwaniu i zostało
  wznowionych bez utraty pracy.
