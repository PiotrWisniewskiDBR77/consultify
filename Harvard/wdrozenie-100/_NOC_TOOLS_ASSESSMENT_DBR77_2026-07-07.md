# NOC 07-07/08: Tools + Assessment — metodyka DBR77 (handoff dla Piotra)

**Gałąź:** `feat/tools-assessment-dbr77` (baza `origin/Londyn` f3a45b0c90). **Zero push, zero demo-deploy, zero zapisu do bazy demo.** Wszystko do przeglądu rano.

## 0. NAJWAŻNIEJSZE: audyt z feat/tp-forms-polish KŁAMAŁ
Pierwszy audyt (ze starej gałęzi roboczej) raportował „21/22 frameworków puste", „DRD/CMMI/LEAN wydmuszki". **Na origin/Londyn silniki są ZBUDOWANE.** Weryfikacja z kanonu (origin/Londyn), nie z gałęzi roboczej — złota reguła. Szczegóły: pamięć `finding_tools_assessment_engines_built_on_londyn`.

## 1. TOOLS — realny stan (30 ToolType, nie 22)
- **10 strategicznych PEŁNY** (dedykowany handler `toolAi/` + promptRegistry + config q-bank/conclusion/silnik): dynamic-swot, market-forces, growth-paths, value-chain, portfolio-priority, risk-uncertainty, capability-mapper, ambition-decomposer, focus-tradeoff, narrative-engine.
- **9 operacyjnych PEŁNY** (wspólny `operationalTool.ts` + realny config/silnik per narzędzie): sop-builder, a3-problem-solving, smed-planner, dms-builder, inventory-autopilot, ai-discovery, pain-explorer, rpa-scanner, process-automation. Mają `generateFullSession`+`rethinkCard` (OPERATIONAL_AI_TOOLS).
- **11 SZKIELET** (brak config/silnika, tylko generyczny prompt): vsm-builder, constraint-control, decision-engine, control-tower, automation-pipeline, robotics-feasibility, logistics-automation, integration-diagnostic, digital-value-pool, legacy-analyzer, data-inventory, pain-to-solution.

**Luki KRYTYCZNE (do decyzji Piotra):**
1. 11 szkieletów — czy dokańczamy, czy chowamy z pickera („coming soon")?
2. **Teresa nie tworzy sesji Tools z czatu** (brak function-tool `create_tool_session`; `generate_deliverable` obejmuje 8 narzędzi My Work, nie frameworki). To realna luka „AI-native".
3. Faza correlations/synthesis tylko dla 10 strategicznych.
**Kosmetyka:** KnownToolsService fallback (tylko SWOT), toolAssetsRegistry (placeholdery miniatur).

**Runtime:** `src/hooks/discovery/useToolAI.ts` → promptRegistry → `/ai/chat/stream` (ten sam endpoint co Teresa) → store; inicjatywy manualnie (`GenerateInitiativesModal`); `tool_session`→Presentation Studio jako source pack.

## 2. ASSESSMENT — realny stan
- SIRI/ADMA ~95% end-to-end. Mapy CMPractice(CMMI)/DBR77Lean też istnieją na Londyn.
- **DRD = jedyna realna luka outputu** → budowana tej nocy (patrz §4).

## 3. DBR77 → mapping frameworków do dogfoodingu (6× PEŁNY)
1. **Market Forces (Porter)** — atrakcyjność segmentu „diagnostyka przemysłowa SME PL/DACH" vs Siemens/GE; gdzie bariera (dane+playbooki), gdzie buyer power integratorów.
2. **Growth Paths (Ansoff)** — ścieżka PL→DACH: market development (DE) vs product development (PL) przy ograniczonym kapitale/talencie.
3. **Portfolio Priority** — priorytetyzacja 6 filarów (Kapitał/Talent/Produkt+Moat/Delivery/Popyt PL/Popyt DE): kto pierwszy dostaje budżet.
4. **Value Chain** — gdzie w łańcuchu diagnoza→dane→playbook→delivery realna przewaga marżowa; silnik ma `positioningVerdict` (cost/differentiation/stuck-in-the-middle).
5. **Capability Mapper** — luka talentowa (build/buy/partner), gap current→target (sprzedaż DACH, data science, delivery ops).
6. **Ambition Decomposer** — rozkład „10M PLN / 30-36 mies." na 4-7 mierzalnych wątków per filar (krok przed Portfolio Priority).

## 4. CO ROBIĘ TEJ NOCY (bezpiecznie, na gałęzi)
- [W TOKU] **DRD output build** — buildDRDAssessmentData + drdConclusion.ts + DRDAssessmentMap.tsx (radar 7-osiowy) + wpięcie w Hub + DRDReportTemplate. Wzór: SIRI. Walidacja esbuild per plik.
- [PLAN] **Seed dataset DBR77** (pliki JSON, nie baza): realistyczne odpowiedzi dla 6 frameworków + zestaw odpowiedzi DRD dla DBR77 — inputy do żywego dogfoodingu rano.
- [PLAN] **Panel 4 sceptyków BCG** na tym zestawie — pre-walidacja jakości (znaleźć słabe tezy zanim trafią do produktu), wynik /100 jak przy v1→v2.
- [RANO — wymaga Ciebie] Żywy dogfood (zapis do bazy demo) + promocja na demo — TYLKO nadzorca. Ja zostawiam gotowe inputy + kod.
