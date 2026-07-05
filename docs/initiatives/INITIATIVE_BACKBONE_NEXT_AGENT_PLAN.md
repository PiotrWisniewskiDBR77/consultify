# Plan dla agenta-następcy — dokończenie kręgosłupa inicjatyw

> **STATUS 2026-06-28: R1–R7 WYKONANE.** Cały plan zrealizowany (708/708 testów,
> staging zmigrowany, demo zdeployowane). Wyniki + dowody: `WYNIKI_M13_BACKBONE_RUN2.md`.
> Zostały TYLKO: odbiór uwierzytelniony Piotra + decyzja o mapowaniach R3, oraz
> 3 świadomie odłożone pogłębienia (sekcja 6 raportu WYNIKI) — wymagają decyzji, nie kodu.
> Poniższy plan zostaje jako referencja „co i dlaczego".

> **To była Twoja robota.** Czysty, uporządkowany plan. Kontekst i historię masz w
> `INITIATIVE_BACKBONE_HANDOFF.md`; wizję+decyzje w `INITIATIVE_SYSTEM_SSOT.md`. Tu
> jest TYLKO to, co zostało, w kolejności, z dokładnością do plików/funkcji/testów.

## 0. Misja i zasada nadrzędna
Inicjatywy = **kręgosłup aplikacji** (ŹRÓDŁO→INICJATYWA→REZULTATY). Owłaszczasz TEN obszar sam; drugi agent robi chat/canvas/ideas/notes — **nie wchodź w te pliki**. Buduj warstwa-po-warstwie z testami (jak proces statusów: 92/92). **Dokumentuj każdy krok** w `INITIATIVE_BACKBONE_HANDOFF.md` (sekcja „GDZIE SKOŃCZYŁEM").

## 1. Co JUŻ działa (NIE przebudowuj — tylko dokładaj)
F0 grunt 4-źródła · F1 mózg (`initiativeGeneratorBrain.ts` generateFullInitiative+auto-heal) · F2 kandydaci (skrzynka+badge+accept→tworzy+wypełnia) · F3 silnik bloków (`cards/CardBlockRenderer`+`cardBlockSchema`+`cardSpecBuilders`, **1 karta zmigrowana: ProblemDefinitionSection**) · F4 zdrowie portfela · F5 materiał (deck/raport/tabela) · F6 handoff rezultatów · Teresa pełny-fill+lineage · proces statusów. **~600 testów zielonych.** 4 routery zamontowane PRZED `initiativesRoutes` (shadow `/:id`).

## 2. ZASADY (twarde — złam = zepsujesz shared-branch)
- **Branch `feat/deliverables-w1`** współdzielony → **commituj NATYCHMIAST** po zielonych testach. **NIGDY `git add -A`/`.`** — tylko swoje pliki.
- **Testy są gitignored** (`.gitignore:209 /tests/`) → `git add -f tests/...`, weryfikuj `git ls-files --error-unmatch`.
- **5-agentowe rundy** (Piotr: „pracuj 5 agentami"): partycjonuj na ROZŁĄCZNE pliki — każdy hotspot (InitiativesHub, InitiativeDocumentView, initiativeGenerationService, Gateway, routes/pmo) ma JEDNEGO właściciela; subagenci **bez `git`** (Ty commitujesz po integracji); FE-agenci jsdom-test + **zero deklaracji wizualnych** (Ty robisz preview-pass).
- **System testów L1/L2/L3** per zdolność. **E2E harness DZIAŁA:** backend live `:3001` + FE `:3000`; komenda: `E2E_REQUIRE_TEST_SUPPORT=true E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://127.0.0.1:3000 TEST_SUPPORT_KEY=local-test-support-key-change-me npx playwright test <spec> --project=chromium --workers=1`. Helpery `tests/e2e/m13/_m13.ts`. Gdy `DB_READONLY=1` → bootstrap pada (poczekaj aż zapisywalny).
- **PROD = centerbeam = NIGDY bez osobnej zgody Piotra.** Migracje staging-first. Deploy demo = gałąź `demo`→Railway.
- **Anchory file:line się przesuwają** (inni commitują) → ZAWSZE re-grep symbol przed edycją.
- **Weryfikuj runtime przed działaniem** — audyty/agenci zawyżają (~1 na 7). Lekcja: agent pomylił `tool_sessions` z `initiatives`; inny twierdził „brak project_id" — sprawdź sam.

## 3. ZADANIA (kolejność wg wartości × zależności)

### R1 — F3: zmigruj 5 pozostałych kart rdzenia na CardBlockRenderer  ·  ŚREDNI
**Cel:** wszystkie 6 kart rdzenia renderują się przez generyczny silnik (spójność + AI-skład układu).
- Wzór GOTOWY: `ProblemDefinitionSection.tsx` (preview `<CardBlockRenderer spec={buildProblemCardSpec(...)} />` poniżej pól, additive). `cardSpecBuilders.ts` MA już `buildTargetStateCardSpec` + `buildBusinessCaseCardSpec`.
- Zmigruj: **TargetState, BusinessCase (financialImpact), KPIs, Scope, Control/owner**. Dla każdej: dorób builder w `cardSpecBuilders.ts` (jeśli brak) + render preview w sekcji (additive, nie usuwaj edycji/AIFieldEnhancer).
- **Karty narzędziowe (Gantt/RAID) ZOSTAW bespoke** — hybryda celowa.
- **Testy:** rozszerz `cardSpecBuilders.test.ts` (każdy builder: pola→bloki, missing-field, `validateCardSpec` bez CRITICAL) + render-test per sekcja.
- **DoD:** 6 kart rdzenia z bloków; tsc czysto; preview-pass wizualny (Playwright smoke jak `m13-backbone-fe.spec.ts`).
- **Gotcha:** dane sekcji bywają w bogatym kontekście (`successCriteriaItems`, `revenueImpact`) — sekcja spłaszcza kontekst→kształt buildera, buildery zostają CZYSTE.

### R2 — Generator emituje CardSpec bezpośrednio (payoff F3)  ·  ŚREDNI  ·  zależy: R1
**Cel:** AI generuje od razu strukturę bloków, nie wolny tekst → `validateCardSpec` jako critic gate (auto-heal jak deck M17).
- W `initiativeGenerationService.generateSectionContent` (lub w `initiativeGeneratorBrain`): zmień kontrakt wyjścia sekcji na `CardSpec` JSON; `validateCardSpec()` → CRITICAL → regen raz (D12). Sekcje konsumują `spec` gdy obecny, fallback do buildera per-pole (legacy/ręczne).
- **Testy:** L1 (spec-validation gate + auto-heal) + L2 (generate-section zwraca walidny CardSpec).
- **DoD:** generacja zwraca CardSpec; gate odrzuca CRITICAL; fallback działa.

### R3 — Teresa: persystencja kart do kolumn typowanych  ·  MAŁY/ŚREDNI
**Cel:** dziś `generateFullInitiative` zapisuje karty do JSON-sink `ai_generated_sections`; dorób hydrację do realnych kolumn.
- Dorób mapper `componentKey → kolumna(y)` (rozszerz `FIELD_MAP`/`JSON_FIELDS` w `InitiativeController.ts:~920`): `problemDefinition→problem_statement`, `targetState→target_state`, `kpis→kpis`, `scope→scope_in/scope_out`, `control→owner_*`, `financialImpact→business_value/cost_*/expected_roi`.
- Karty wolno-tekstowe → kolumna skalarna wprost; strukturalne (kpis/scope/control/financial) → parser tekst→pola LUB (lepiej, po R2) generator emituje strukturę.
- **Testy:** L2 — accept/Teresa → karty trafiają do typowanych kolumn (mock-DB asercje na UPDATE).
- **DoD:** wypełnione karty widoczne w kolumnach inicjatywy, nie tylko w JSON-sink. Szczegóły = raport agenta A rundy 3 (handoff).

### R4 — Migracja `audits` na staging + from-audit strict-4xx  ·  MAŁY  ·  wymaga zgody na deploy
**Cel:** uaktywnić audyt→inicjatywa na realnej tabeli.
- Migracja `server/migrations/20260627_audits.sql` (ALTER additive: dodaje `project_id/title/summary/description/created_by`) — **uruchom staging-first** (trolley), za zgodą Piotra.
- Po migracji: w `tests/e2e/m13/m13-backbone.spec.ts` test **L3-BB-16** jest poluzowany („≥400 + schema-drift") — zaostrz do **strict 4xx** (404 dla brakującego audytu).
- **DoD:** from-audit zwraca 404 (nie 500) na realnym schemacie; E2E strict.

### R5 — Trigger auto-skanu kandydatów  ·  ŚREDNI
**Cel:** skrzynka kandydatów napełnia się PROAKTYWNIE (dziś tylko ręczny `POST /candidates/scan`).
- Po utworzeniu insight/assessment/audyt → event/hook → `initiativeCandidateService.scanForCandidates`. Albo lekki cron. Plus zamień deterministyczny stub `buildCandidateFromArtifact` (LLM-seam zaznaczony) na realne wywołanie LLM (z fail-soft + grounding F0).
- **Gotcha:** widoki/serwisy discovery (insight/assessment) bywają domeną drugiego agenta — jeśli event-hook wymaga edycji ich plików, NAJPIERW uzgodnij; bezpieczniej: cron skanujący „nowe od X" niż edycja cudzych create-paths.
- **Testy:** L1 (scoring/LLM-seam), L2 (scan przez event/cron), L3 (kandydaci pojawiają się po seedzie rozpoznania).
- **DoD:** nowe rozpoznanie → kandydat w skrzynce bez ręcznego skanu.

### R6 — propose-cards UI (tor szybki/kreator)  ·  MAŁY
**Cel:** endpoint `POST /api/initiatives/propose-cards` żyje; pokaż propozycje w UI.
- Dorób hook `useProposeCards` + komponent „proponowane karty [dodaj/odrzuć]" w torze szybkim quick-create lub w kreatorze. Owłaszcz NOWE pliki + minimalne wpięcie w jeden punkt UI (jeden właściciel pliku).
- **DoD:** tworząc inicjatywę widzisz rdzeń-6 + AI-proponowane dodatkowe karty do akceptacji.

### R7 — Preview-pass wizualny + deploy demo + odbiór Piotra  ·  domknięcie
- **Pełny preview** (nie tylko smoke): taby Kandydaci/Zdrowie-portfela, przyciski „Zrób materiał", badge'y w 3 widokach discovery — spacing/placement/dark-mode. Użyj Playwright (screeny do `docs/qa/screens/m13-backbone/`) LUB preview MCP jeśli dev-server wolny.
- **Deploy demo** (gałąź `demo`, za zgodą) → live-verify.
- **Raport końcowy** `WYNIKI_M13_BACKBONE_RUN2.md` (po R1-R6) + odbiór Piotra (→F/→UI).

## 4. Mapa plików (re-grep przed edycją!)
| Obszar | Plik |
|---|---|
| Mózg generatora | `server/src/services/initiative/initiativeGeneratorBrain.ts` (+ `*Brain.routes.ts`) |
| Generacja sekcji | `server/src/services/initiativeGenerationService.ts` (`generateSectionContent`, `buildGroundingBlock` eksport, `enrichContext` populuje 4 źródła) |
| Kandydaci | `server/src/services/initiative/initiativeCandidateService.ts` + `routes/initiativeCandidates.routes.ts` + `src/components/Initiatives/CandidatesPanel.tsx` |
| Silnik kart | `src/components/Initiatives/cards/{CardBlockRenderer.tsx,cardBlockSchema.ts,cardSpecBuilders.ts}` |
| Karta-wzór | `src/components/Initiatives/sections/ProblemDefinitionSection.tsx` |
| Portfel | `server/src/services/initiative/portfolioAnalysisService.ts` + `src/components/Initiatives/PortfolioHealthView.tsx` |
| Materiał | `server/src/services/initiative/initiativeMaterializeService.ts` + `routes/initiativeMaterialize.routes.ts` |
| Audyt/portfolio-health route | `server/src/routes/initiativeBackbone.routes.ts` |
| Teresa | `server/src/services/ai/tools/generateInitiative.ts` |
| Badge | `src/components/Initiatives/InitiativeSuggestionBadge.tsx` |
| Hub / dokument | `src/components/Initiatives/{InitiativesHub.tsx,InitiativeDocumentView.tsx}` |
| Mounty | `server/src/Gateway.ts` (kandydaci/backbone/brain PRZED initiativesRoutes; materialize PO) |
| M17 (reuse) | `server/src/services/deliverables/` |
| Spec treści kart | `docs/standards/CARD_CONTENT_FORMULA.md`, `docs/initiatives/INITIATIVE_FORMULA.md` |

## 5. Definicja ukończenia kręgosłupa (kiedy „done")
6 kart rdzenia z bloków (R1) · generator emituje CardSpec z critic gate (R2) · karty hydrowane do kolumn (R3) · audyt→inicjatywa strict (R4) · kandydaci proaktywni (R5) · propose-cards w UI (R6) · preview-pass zielony + deploy demo + odbiór Piotra (R7). Każda warstwa: L1+L2+L3 + raport WYNIKI, zero „nigdy nie wykonane".
