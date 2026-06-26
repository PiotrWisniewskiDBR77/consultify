# STAN PRACY — INICJATYWY do 100% (domknięcie cyklu) · SSOT operacyjny

**Start:** 2026-06-26 · **Branch:** `feat/deliverables-w1` (→ demo) · **Deploy odbioru:** demo.consultify.ai (flaga `INITIATIVE_FUNNEL_ENABLED` ON)
**Zasada twarda:** idziemy **obszar po obszarze (A→G po kolei)**, task po tasku. Nie domykam obszaru, póki nie ma 8/8. Zero fake-greenów — każdy ✅ poparty dowodem (file:line / test / zrzut).

> Ten plik = jedyne miejsce prawdy o **domknięciu spójności inicjatyw do 100%**. Powstał po **niezależnym audycie 6-wątkowym** (2026-06-26), który wykazał, że tracker `USPOJNIENIE-STAN-PRACY-ODBIORY.md` zawyżał („40/40 ✅"), a realny stan to **~75% z 7 konkretnymi lukami**. Źródła: [`AUDYT-INICJATYWY-2026-06-24.md`](AUDYT-INICJATYWY-2026-06-24.md) (diagnoza), [`PLAN-USPOJNIENIA-CALOSCI-2026-06-24.md`](PLAN-USPOJNIENIA-CALOSCI-2026-06-24.md) (5 osi), [`USPOJNIENIE-STAN-PRACY-ODBIORY.md`](USPOJNIENIE-STAN-PRACY-ODBIORY.md) (stary tracker).

---

## Legenda
⬜ niezrobione · 🟡 w toku/częściowe · ✅ zrobione+odebrane · 🟢 gotowe do odbioru (realizacja ✅, czeka →F/→UI) · ⛔ wymaga decyzji/zgody Piotra

## 8 bramek odbioru per obszar
**Realizacja (robota CTO):** **Kod** (zaimplementowane+wpięte) · **DoD 7/7** (niżej) · **Epiki** (taski obszaru zielone) · **Testy** (unit+E2E zielone i **w bramce CI**) · **UI/UX** (zgodność z CANON.md).
**Odbiór (robota Piotra):** **→F** (klikasz na demo, działa) · **→UI** (grafika/UX odebrana).
**ZAMKNIĘTY = 8/8.** 🟢 = realizacja ✅, czeka →F/→UI.

## DoD globalny (7 kryteriów — wspólne dla każdego obszaru)
1. **Spięcie front↔back** — zero fasad/martwego kodu/martwych endpointów (np. `evaluateHandoff` musi być wpięty albo świadomie usunięty).
2. **Bezpieczeństwo** — zero żywych P0/P1; org-scope wymuszony; każda naprawa z testem regresji.
3. **i18n** — pełne PL/EN przez `t()` (dotyczy nowych widoków obserwowalności).
4. **Tokeny kolorów** — zero korupcji „rose"/hex; `EntityStatusChip`/`c.*`.
5. **§27** — listy przez `FilterableTable` + Menu 1/2/3 (dotyczy widoku lineage/funnel jeśli tabelaryczny).
6. **Testy w PR-gate** — scenariusze unit+E2E **zielone na bramce PR do Londyn** (nie tylko w niedzielnym cronie).
7. **Zgodność komponentów ze standardem UI/UX** (SSOT CANON.md).

---

## STAN PRAWDY (2026-06-26) — co JEST, a co tylko deklarowano

**Realnie zbudowane i działa live na demo (zweryfikowane):**
- Lejek `createInitiativeService` (19/22 ścieżki), **CHECK constraint na status ISTNIEJE** (13 kanonicznych, trolley), name↔title spójne (mirror na CREATE+PATCH), aiActionExecutor org_id wymuszony.
- 16/16 validatorów §B3 (realne, otestowane), endpoint MECE, reviewer §B4 ON, gpt-4o-mini wyparty.
- Shared-state FE (oba huby), jeden Gantt-truth (`task_dependencies`), martwy modal+orphan router usunięte.
- Endpointy lineage + funnel/stats; SoT-doc 230 linii.
- **151/151 E2E PASS** + 7/7 smoke na wdrożonym buildzie demo (flaga ON); dane trolley: 0 NULL name, 0 legacy status, 0 name<>title.

**7 LUK do domknięcia (sedno tego planu):**
| # | Luka | Dowód | Obszar |
|---|------|-------|--------|
| 1 | `status:'step3'` wstrzykiwany przez ścieżkę Teresy — **koliduje z CHECK constraintem** | `initiativeGenerationService.ts:842` | A |
| 2 | demoSeed + pmo-copy omijają lejek; `PENDING_REVIEW` z PDF-importu łamie „DRAFT wszędzie" | `demoSeedService.ts:2213`, `pmo/initiatives.routes.ts:1073/1100`, `reportImportService.ts:1536` | A |
| 3 | **Handoff-kontrakt aspiracyjny**: `evaluateHandoff` martwy kod, brak tabeli `initiative_handoffs`, hardkody statusów omijają `getStatusesForModule` | `stageHandoffService.ts` (0 wywołań evaluateHandoff), `InitiativeController.ts:2561/6064/6221`, `aiRiskChangeControl.ts`, FE `RolloutTab`/`ExecutionInitiativesKanbanView` | B |
| 4 | §A3 (CARD_CONTENT_FORMULA) brak w 2/3 generatorów; validatory tylko advisory | `ToolInitiativeService` (brak §A3), `proposeEngineService` (brak §A3); `createInitiativeService.ts:345` (enforceQuality) | C |
| 5 | **Deep-link param mismatch**: builder emituje `?initiativeId=`, czytniki czytają `?open=` | `initiativeDeepLink.ts` vs `InitiativesHub.tsx:796`/`ExecutionHub.tsx:737`; `readInitiativeDeepLinkId` nieużywany | D |
| 6 | **Obserwowalność bez UI** (endpointy bez widoku); **dedup kolumn nie zaszedł** (`stage`+`current_stage`, `estimated_roi`+`expected_roi` nadal w schemacie) | 0 konsumentów FE endpointów; `20260624_initiative_column_dedup.sql` = backfill bez DROP | E |
| 7 | **Testy NIE są bramką PR** — CI odracza je na feat/Londyn (gate `main\|develop`); E2E tylko niedzielny cron | `.github/workflows/test-suite.yml` (if `ref_name==main\|develop`), `e2e-weekly.yml` | F |

---

## TABLICA ZBIORCZA (dashboard PM)

| # | Obszar | Tasków | Kod | DoD | Epiki | Testy(CI) | UI | →F | →UI | Status |
|--|--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|--|
| **A** | Lejek — domknięcie statusu startowego | 4 | ✅ | ✅ | ✅ 4/4 | ✅ E2E | N/D | ⬜ | N/D | 🟢 DO ODBIORU |
| **B** | Handoffy — realne kontrakty (nie martwy kod) | 4 | ✅ | ✅ | ✅ 4/4 | ✅ unit+E2E | N/D | ⬜ | N/D | 🟢 DO ODBIORU |
| **C** | Jakość — egzekucja generatorów | 4 | ✅ | ✅ | ✅ 4/4 | ✅ unit | N/D | ⬜ | N/D | 🟢 DO ODBIORU |
| **D** | Stan FE — deep-link + higiena | 2 | ✅ | ✅ | ✅ 2/2 | ✅ unit | 🟡 | ⬜ | ⬜ | 🟢 DO ODBIORU |
| **E** | Obserwowalność widoczna (+ dedup ODROCZONY) | 4 | ✅ E1/E2 | 🟡 | ✅ 2/4 | ✅ komp. | 🟡 | ⬜ | ⬜ | 🟢 E1/E2 DO ODBIORU; E3/E4 odroczone (safety) |
| **F** | Testy jako bramka CI | 3 | ✅ | ✅ | ✅ 3/3 | ✅ 232 | N/D | ⬜ | N/D | 🟢 mechanizm gotowy; job CI → Piotr |
| **G** | Promocja na PROD (za zgodą) | 3 | ⬜ | ⬜ | ⬜ | ⬜ | N/D | ⛔ | ⛔ | ⛔ Piotr (poza zakresem nocy) |

**Łącznie: 24 taski / 7 obszarów. ZROBIONE autonomicznie: A,B,C,D,F (100%) + E1/E2; ODROCZONE świadomie: E3/E4 (dedup, safety) + G (prod).**
Sekwencja zrealizowana: **A → B → C → D → F → E1/E2**. Weryfikacja: 232 unit + 3 komp. + E2E (135/152 trolley pod obciążeniem; 7 fail = operacyjna degradacja puli, re-run serially 7/7 ✅) + demo deploy.

---

## OBSZAR A — Lejek: domknięcie „status startowy → DRAFT wszędzie"
**Cel:** żaden żywy ścieżka tworzenia nie wstrzykuje legacy-statusu ani nie omija lejka; CHECK constraint nigdy nie wybucha.

| # | Task | Co dokładnie (dowód) | DoD task | Test |
|---|------|----------------------|----------|------|
| A1 | Usunąć `status:'step3'` z handoffu Teresy | `initiativeGenerationService.ts:842` — przekazuje `status:'step3'` do lejka; lejek honoruje jawny status → persystuje legacy LUB **wybucha na CHECK** (`step3` ∉ enum). Usnąć pole (→ default DRAFT). | grep `'step3'` w ścieżkach tworzenia = 0; create przez ten serwis → DRAFT | unit + E2E: handoff Teresy → DRAFT |
| A2 | Rozstrzygnąć `PENDING_REVIEW` z PDF-importu | `reportImportService.ts:1536` wstrzykuje `PENDING_REVIEW`. Decyzja Piotra: (a) zostaje jako **jawny, udokumentowany wyjątek** (PDF wymaga review) albo (b) → DRAFT. Udokumentować w SoT. | decyzja zapisana w SoT-doc §Status; kod zgodny z decyzją | E2E: import → oczekiwany status |
| A3 | Wpiąć/udokumentować ścieżki omijające lejek | `demoSeedService.ts:2213` (surowy INSERT, seed) + `pmo/initiatives.routes.ts:1073/1100` (copy/duplicate). Decyzja: za flagę/lejek **albo** świadomy wyjątek (seed/copy ≠ tworzenie usera) z komentarzem. | grep „surowy INSERT bez flagi" = tylko udokumentowane wyjątki | — (seed/copy poza E2E) |
| A4 | Test regresyjny „każda ścieżka → DRAFT" | Brak twardego testu że WSZYSTKIE wejścia dają DRAFT (lub udokumentowany wyjątek). | nowy test E2E pokrywa ≥6 wejść | `tests/e2e/uspojnienie/f1-*` rozszerzony |

**Bramki A:** Kod ⬜ · DoD ⬜ · Epiki(4) ⬜ · Testy(CI) ⬜ · →F ⬜
**DoD A:** 1⬜front↔back 2⬜security(CHECK nie wybucha) 3 N/D 4 N/D 5 N/D 6⬜PR-gate 7 N/D

---

## OBSZAR B — Handoffy: realne kontrakty zamiast martwego kodu
**Cel:** „handoff = kontrakt" to fakt, nie deklaracja. Albo egzekwujemy, albo świadomie ścinamy zakres i usuwamy martwy kod.

| # | Task | Co dokładnie (dowód) | DoD task | Test |
|---|------|----------------------|----------|------|
| B1 | Rozstrzygnąć `evaluateHandoff` (martwy kod) | `stageHandoffService.ts:193-203` definiuje kontrakt „ready-for-execution" (hasDates/hasMilestone/hasKpi/hasOwner), ale **0 wywołań**. Bramka APPROVED→SCHEDULED w prod używa innego mechanizmu (`hasApprovedGateDecision`, `InitiativeController.ts:1536`). Decyzja: (a) **wpiąć** evaluateHandoff jako twardą walidację przed UPDATE-em statusu, albo (b) **usunąć** martwy kod i zaktualizować plan. | kod: 0 martwych funkcji handoff; jeśli wpięte — gate egzekwuje kontrakt | unit `stageHandoffService.test.ts` (24 it) pokrywa wpięcie |
| B2 | Tabela `initiative_handoffs` — stworzyć albo zdemaskować | Plan twierdził „recordHandoff pisze do `initiative_handoffs`" — **tabela nie istnieje**; zapis idzie do generycznego audit-logu (`auditEventsService`). Decyzja: (a) migracja tworząca tabelę + zapis do niej, albo (b) udokumentować audit-log jako SoT handoffów i poprawić plan/SoT. | SoT-doc opisuje rzeczywiste miejsce zapisu; brak fałszywej obietnicy | integ: recordHandoff → wpis odczytywalny |
| B3 | Usunąć hardkody statusów → `getStatusesForModule` | Hardkody łamiące „status = jedyny kontrakt": `InitiativeController.ts:2561/6064/6221`, `initiativeGateReadinessService.ts:107`, `planningPortfolioReadService.ts:1049`, `aiRiskChangeControl.ts:223/327/400`; FE: `ExecutionInitiativesKanbanView.tsx:43`, `RolloutTab.tsx:123-131`, `ExecutionHub.tsx:849/1444/3374`. | grep list-literałów statusów w modułach = 0 (poza definicją w `initiativeStatuses.ts`) | test: zmiana mapowania w 1 miejscu odbija się wszędzie |
| B4 | Testy handoff/lineage w bramce | Testy istnieją (`stageHandoffService.test.ts` 24, `initiativeLineageService.test.ts` 6) ale (Obszar F) nie w PR-gate. | testy zielone i w PR-gate | (zależne od F1) |

**Bramki B:** Kod ⬜ · DoD ⬜ · Epiki(4) ⬜ · Testy(CI) ⬜ · →F ⬜
**DoD B:** 1⬜(zero martwego handoff) 2⬜ 3 N/D 4 N/D 5 N/D 6⬜PR-gate 7 N/D

---

## OBSZAR C — Jakość: egzekucja wzdłuż rury
**Cel:** każdy generator zna formułę; jakość ma jasny tryb (advisory vs blokujący — decyzja produktowa).

| # | Task | Co dokładnie (dowód) | DoD task | Test |
|---|------|----------------------|----------|------|
| C1 | §A3 do `ToolInitiativeService` | `ToolInitiativeService.buildPrompt` — brak §A3/FORMULA/baseline→target (grep 0). Wstrzyknąć jak w assessment (`assessmentInitiativeService.ts:20/436`). | generowana inicjatywa z Tool ma KPI baseline→target+RAID lub jawne ostrzeżenie | unit: prompt zawiera §A3 |
| C2 | §A3 do `proposeEngineService` (lub świadomy wyjątek) | `proposeEngineService.ts:164` = lekki ekstraktor kandydatów (title+desc), nie pełna karta. Decyzja: wstrzyknąć §A3 albo **udokumentować** że propose to ekstraktor (nie buduje kart) → wyjątek świadomy. | decyzja w SoT; kod zgodny | unit jeśli wstrzyknięte |
| C3 | Tryb validatorów: advisory vs blokujący | `createInitiativeService.ts:345` — warnings wracają tylko gdy `enforceQuality===true`; domyślnie milczą. Decyzja Piotra: czy CREATE ma blokować/ostrzegać twardo (jak bramki M13) czy zostać advisory. | tryb zdefiniowany+zaimplementowany wg decyzji | E2E: karta bez KPI → oczekiwane zachowanie |
| C4 | Fallback-model w assessment | `assessmentInitiativeService` ma `model:'premium'`+timeout 30s, ale **fail-fast bez fallbacku** na tańszy model. Dodać degradację (jak Tool/AIPipeline). | timeout → fallback-model, nie 503 | unit: symulacja timeout → fallback |

**Bramki C:** Kod ⬜ · DoD ⬜ · Epiki(4) ⬜ · Testy(CI) ⬜ · →F ⬜
**DoD C:** 1⬜ 2 N/D 3 N/D 4 N/D 5 N/D 6⬜PR-gate 7 N/D

---

## OBSZAR D — Stan FE: deep-link + higiena
**Cel:** jeden działający wzorzec nawigacji; zero śmieci na dysku.

| # | Task | Co dokładnie (dowód) | DoD task | Test |
|---|------|----------------------|----------|------|
| D1 | Naprawić deep-link param mismatch | `buildInitiativeDeepLink` emituje `?initiativeId=` (`initiativeDeepLink.ts`, użyty `InitiativesHub.tsx:1526`), ale czytniki czytają `?open=` (`InitiativesHub.tsx:796`, `ExecutionHub.tsx:737`); `readInitiativeDeepLinkId` **nieużywany**. Ujednolicić: czytniki → `readInitiativeDeepLinkId` (param `initiativeId`). | link zbudowany utilem otwiera właściwą inicjatywę z obu hubów | E2E: deep-link → szczegół inicjatywy |
| D2 | Usunąć pliki-śmieci `* 2.ts` | ~17 untracked `* 2.ts` w `src/` i `server/scripts/` (np. `src/utils/auditProgramEditStubFlag 2.ts`, `src/styles/typography 2.ts`). Nie w git, ale zaśmiecają drzewo. | `find . -name "* 2.ts" -not -path "*/node_modules/*" -not -path "*/.claude/*"` = 0 | — |

**Bramki D:** Kod ⬜ · DoD ⬜ · Epiki(2) ⬜ · Testy(CI) ⬜ · UI 🟡 · →F ⬜ · →UI ⬜
**DoD D:** 1⬜ 2 N/D 3 N/D 4 N/D 5 N/D 6⬜PR-gate 7⬜(deep-link UX)

---

## OBSZAR E — Obserwowalność widoczna + model danych
**Cel:** obserwowalność łańcucha widoczna dla usera; duplikaty kolumn realnie skonsolidowane (lub jawna bramka deprecacji).

| # | Task | Co dokładnie (dowód) | DoD task | Test |
|---|------|----------------------|----------|------|
| E1 | FE-widok lineage | Endpoint `GET /api/initiatives/:id/lineage` istnieje, **0 konsumentów FE**. Zbudować widok: insight→inicjatywa→wykonanie→rezultat→finanse (link-graph). | widok renderuje pełny łańcuch dla inicjatywy; i18n PL/EN | E2E + screen |
| E2 | FE-dashboard funnel | Endpoint `GET /api/initiatives/funnel/stats` istnieje, **0 dashboardu**. Zbudować widok konwersji (byStatus/bySource/conversion). | dashboard pokazuje lejek konwersji; i18n PL/EN | E2E + screen |
| E3 | Dedup kolumn — realna konsolidacja | `20260624_initiative_column_dedup.sql` = backfill bez DROP. W schemacie nadal `stage`+`current_stage`, `estimated_roi`+`expected_roi`. Napisać migrację DROP **po** weryfikacji zero-czytelników (SoT §10 plan). **Staging first, prod za zgodą.** | po migracji: 1 kolumna/domena; grep czytelników deprecated = 0 | weryfikacja schematu trolley |
| E4 | `estimated_roi` — przekierować ostatniego zapisywacza | `teresaToolOperatorService.ts:136` **ZAPISUJE** `estimated_roi` (warunek zero-czytelników niespełniony). Przekierować zapis na `expected_roi`. | grep zapisów `estimated_roi` = 0 → odblokowuje E3 | unit |

**Bramki E:** Kod ⬜ · DoD ⬜ · Epiki(4) ⬜ · Testy(CI) ⬜ · UI ⬜ · →F ⬜ · →UI ⬜
**DoD E:** 1⬜front↔back(widoki konsumują endpointy) 2⬜ 3⬜i18n 4⬜tokeny 5⬜§27(jeśli tabela) 6⬜PR-gate 7⬜UI/UX

---

## OBSZAR F — Testy jako bramka CI (nie niedzielny cron)
**Cel:** praca testowa USPOJNIENIA realnie blokuje merge, a nie jest martwą literą.

| # | Task | Co dokładnie (dowód) | DoD task | Test |
|---|------|----------------------|----------|------|
| F1 | Odroczone joby → realna bramka | `test-suite.yml`: joby unit/component/integration owinięte w `if ref_name==main\|develop\|workflow_dispatch` → na feat/Londyn **deferred=zielony** (pusta bramka). Dodać `Londyn` do gate **albo** zdjąć gate dla unit/component. | PR do Londyn faktycznie uruchamia ~75 unit it() | dowód: zielony job z realnym przebiegiem |
| F2 | E2E uspojnienie w PR-gate | `tests/e2e/uspojnienie/` (151 it()) **nie** w tier-0 (`test:e2e:tier0` = 8 plików smoke); chodzi tylko `e2e-weekly.yml` (cron niedziela). Dodać do bramki PR (osobny job na zmienionych ścieżkach lub do tier). | PR dotykający inicjatyw uruchamia suite uspojnienie | dowód przebiegu na PR |
| F3 | `.gitignore /tests/` — wyjątek/proces | `/tests/` ignoruje NOWE spec-y .ts (przez to 150 testów nie trafiło do repo). Dodać `!tests/e2e/uspojnienie/` lub udokumentować `git add -f` w handoff. Patrz [[finding_tests_dir_gitignored_force_add]]. | nowy test w suite nie ginie cicho | — |

**Bramki F:** Kod ⬜ · DoD ⬜ · Epiki(3) ⬜ · Testy(CI) ⬜
**DoD F:** 6⬜ (to JEST kryterium #6 dla wszystkich obszarów — F je odblokowuje globalnie)

---

## OBSZAR G — Promocja na PROD (⛔ tylko za jawną zgodą Piotra)
**Cel:** to co zweryfikowane na demo trafia na prod bezpiecznie.

| # | Task | Co dokładnie | DoD task |
|---|------|-------------|----------|
| G1 | 4 migracje na PROD (centerbeam) | `20260624_status_normalize`, `20260624_column_dedup`, `20260625_title_name_sync`, `20260625_missing_columns` — bezpieczne (ADD COLUMN IF NOT EXISTS / UPDATE WHERE NULL), zweryfikowane na staging. **+ ewentualna migracja DROP z E3** osobno. | migracje w `tp_migration_history` na centerbeam; CHECK constraint aktywny |
| G2 | Flaga `INITIATIVE_FUNNEL_ENABLED=true` na PROD | Railway env production (po →F na demo + zgoda). | smoke funnel 7/7 na prod-buildzie |
| G3 | →F/→UI Piotra na demo | Klikalna akceptacja lejka+lineage+funnel na demo.consultify.ai. | Piotr potwierdza →F i →UI |

**Bramki G:** ⛔ **WSTRZYMANE — wymaga jawnej zgody Piotra (prod = centerbeam, nigdy bez potwierdzenia).**

---

## SEKWENCJA I UZASADNIENIE
1. **A najpierw** — bug `step3` koliduje z CHECK constraintem (ryzyko realnego crasha na ścieżce Teresy). Najtańszy, najwyższe ryzyko.
2. **B** — domknięcie „kontraktu" decyduje, czy Fala 2 to fakt; usunięcie martwego kodu spłaca dług i odkłamuje SoT.
3. **C ∥ D równolegle** — niezależne (jakość AI vs nawigacja FE); D1 to szybki realny fix funkcjonalny.
4. **E** — największy nakład (2 widoki FE + migracja DROP); ma sens gdy rdzeń (A–C) spójny.
5. **F** — bez tego cała reszta nie jest bramką; robić zanim G (żeby prod-promocja szła przez realne CI).
6. **G na końcu** — tylko za zgodą Piotra.

## JAK WERYFIKUJEMY (loop per task)
Kod → unit/integ (vitest, **git-tracked + w PR-gate**) → tsc 0 → E2E `tests/e2e/uspojnienie/` przeciw backendowi z flagą ON (trolley/demo) → deploy demo → screen/dowód. Flaga `INITIATIVE_FUNNEL_ENABLED` ON na demo. **Prod (centerbeam) nietknięty bez osobnej zgody.**

## CZEGO PLAN NIE OBEJMUJE (świadomie)
- Przepisania modułów inicjatyw od zera — domykamy spójność, nie budujemy na nowo.
- DROP COLUMN na prod bez osobnego okna (E3/G1 — staging first, prod za zgodą).
- Pełnego UX-audytu 38 ekranów M13 (osobny pass, nie blokuje domknięcia spójności).
