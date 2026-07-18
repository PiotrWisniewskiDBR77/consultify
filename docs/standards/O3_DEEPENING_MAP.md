# O3 — mapa mechanizmów pogłębiania (deepening) dla 19 zbudowanych narzędzi Discovery

Rejestr J6. Werdykt: grep pliku `deepeningLadder.ts` (15/19 ma, porter/swot/valuechain/portfolio
nie mają) **nie jest** tym samym co "brak pogłębiania". Wszystkie 19 narzędzi mają jakąś formę
laddered question bank; różni je NAZWA PLIKU i KANAŁ dostarczenia do runtime. Trzy kanały:

- **A — live chat interview**: mentor w oknie czatu pyta DOKŁADNIE te pytania z bankiem, jedno
  na raz, rozgałęziając się po `answerKey`. Wpięte przez `interviewProtocol` ternary w
  `src/hooks/discovery/useToolAI.ts` (`sendMessage`, ok. linii 246-258).
- **B — Suggestions-click deepening**: użytkownik klika "pogłęb"/"suggestions" dla bieżącej
  sekcji; prompt niesie 4-szczeblową drabinkę (surface→evidence→quantification→risk-capability)
  z `deepeningLadder.ts`. Wpięte w `src/hooks/discovery/toolAi/promptRegistry.ts` przez
  `build<Tool>DeepenPrompt` (z `conclusionPrompts.ts`, per narzędzie). Warianty B2 (a3, risk)
  DODATKOWO nakładają pełną rozgałęzioną drabinkę (jak w kanale A) na ten sam Suggestions-click.
- **D — Conclusion/Summary prompt**: skondensowane reguły banku pytań (`build<Tool>QuestionBank
  PromptRules`) wklejone w finalny prompt podsumowania (`build<Tool>ConclusionPrompt`).

| # | Narzędzie (toolType) | Kanał(y) live | Plik(i) drabinki | Wpięcie (hook) |
|---|---|---|---|---|
| 1 | dynamic-swot | **A** + C | `src/config/swot/dynamicSwotQuestionBank.ts` | `dynamicSwot.ts` → `buildDynamicSwotConversationProtocol` (useToolAI.ts:251) |
| 2 | market-forces (porter) | **A*** + C | `src/config/porter/porterQuestionBank.ts` | `marketForces.ts` → `buildMarketForcesConversationProtocol` (useToolAI.ts:255) — **domknięte w J6**, wcześniej ladder istniał w configu ale `buildMarketForcesForceLadderPrompt` był martwy (nigdzie wołany) |
| 3 | value-chain | **A** + C | `src/config/valuechain/valueChainQuestionBank.ts` | `valueChain.ts` → `buildValueChainConversationProtocol` (useToolAI.ts:253) |
| 4 | portfolio-priority | **A*** + C | `src/config/portfolio/portfolioQuestionBank.ts` | `portfolioPriority.ts` → `buildPortfolioConversationProtocol` (useToolAI.ts:257) — **domknięte w J6**, wcześniej `buildPortfolioLadderPromptBlock` był zdefiniowany, ale całkowicie nieużywany (0 callerów) |
| 5 | growth-paths (ansoff) | B + C(rules) | `deepeningLadder.ts` + `ansoffQuestionBank.ts` | `growthPaths.ts`: rungs via Suggestions; `buildAnsoffQuestionBankPromptRules` wklejone wprost w one-shot full-session prompt (nie step-gated) |
| 6 | risk-uncertainty | B2 + C | `deepeningLadder.ts` + `riskQuestionBank.ts` | `promptRegistry.ts:779-801` — pełna drabinka `buildRiskLadderPromptBlock` nałożona na Suggestions-click dla kroku `assumptions` (O3 patch, per-candidate-risk interview) |
| 7 | ambition-decomposer | B + D | `deepeningLadder.ts` + `ambitionQuestionBank.ts` | `promptRegistry.ts` (`buildAmbitionDeepenPrompt`) + `conclusionPrompts.ts` (rules) |
| 8 | focus-tradeoff | B tylko | `deepeningLadder.ts` + `focusQuestionBank.ts` | `focusTradeoff.ts:19-25` — `buildFocusOptionLadderPrompt` (kanał-A odpowiednik) **jawnie skomentowany jako jeszcze niewpięty** ("Exported for the future interview-step wiring; not yet called from promptRegistry.ts") — to jest ŚWIADOMY, udokumentowany dług, nie luka do naprawy w J6 |
| 9 | capability-mapper | B + D | `deepeningLadder.ts` (wzorzec referencyjny) + `capabilityQuestionBank.ts` | `deepeningLadder.ts` żywe przez Suggestions/conclusion; UWAGA: `buildCapabilityLadderPromptBlock` we własnym `capabilityQuestionBank.ts` jest martwy (0 callerów) — drobny dług sprzątania, bez luki funkcjonalnej (deepeningLadder.ts już pokrywa mechanikę) |
| 10 | narrative-engine | B + D | `deepeningLadder.ts` + `pyramidQuestionBank.ts` | jw.; `buildCategoryLadderPromptBlock` w `pyramidQuestionBank.ts` również martwy (0 callerów) — ten sam drobny dług co #9 |
| 11 | sop-builder | B + D | `deepeningLadder.ts` + `sopBuilderQuestionBank.ts` | `promptRegistry.ts:210-235` (`buildSopDeepenPrompt`, rung z `assessSop`) |
| 12 | a3-problem-solving | B2 + D | `deepeningLadder.ts` + `a3QuestionBank.ts` | `promptRegistry.ts:160-208` — najbogatsze wpięcie z 9: rung z `assessA3` + pełna drabinka `buildA3StepLadderPromptBlock` nałożona (O3 patch) |
| 13 | smed-planner | B + D | `deepeningLadder.ts` + `smedQuestionBank.ts` | `promptRegistry.ts:254-269` |
| 14 | dms-builder | B + D | `deepeningLadder.ts` + `dmsBuilderQuestionBank.ts` | `promptRegistry.ts:237-252` |
| 15 | inventory-autopilot | B + D | `deepeningLadder.ts` + `inventoryQuestionBank.ts` | `promptRegistry.ts:271-286` |
| 16 | rpa-scanner | B + D | `deepeningLadder.ts` + `rpaQuestionBank.ts` | `promptRegistry.ts:322-337` |
| 17 | ai-discovery | B + D | `deepeningLadder.ts` + `aiDiscoveryQuestionBank.ts` | `promptRegistry.ts:288-303` |
| 18 | pain-explorer | B + D | `deepeningLadder.ts` + `painExplorerQuestionBank.ts` | `promptRegistry.ts:305-320` |
| 19 | process-automation | B + D | `deepeningLadder.ts` + `automationQuestionBank.ts` | `promptRegistry.ts:339-361` |

`* = wpięcie dodane w tej sesji (J6, SHA patrz commit "fix(oxford-O3/J6): wire market-forces +
portfolio-priority into live chat-mentor ladder interview").`

## Werdykt "9 operacyjnych one-shot" (rejestr J6)

**Nieprawdziwe w mocnej formie.** Żadne z 9 narzędzi operacyjnych
(sop-builder/a3-problem-solving/smed-planner/dms-builder/inventory-autopilot/rpa-scanner/
ai-discovery/pain-explorer/process-automation) nie jest czystym "one-shot" — każde ma, poza
początkowym generatorem całej sesji naraz (`buildOperationalFullSessionPrompt`,
`src/hooks/discovery/toolAi/operationalTool.ts`, wspólny dla wszystkich 9), osobny,
per-sekcyjny przycisk "Suggestions" który pogłębia disciplined-by-rung (4-szczeblowa
drabinka surface→evidence→quantification→risk-capability z `deepeningLadder.ts`, wybór
najsłabszego szczebla przez `pickWeakestRung` dla a3/sop, hardkodowany rung 'evidence' dla
pozostałych 7) — to jest realny, wielokrotnie klikalny mechanizm iteracyjnego drążenia,
zweryfikowany jako żywy (nie fantom) grepem callerów w `promptRegistry.ts`.

**Czego faktycznie brakuje** (i to jest prawdziwe jądro obserwacji rejestru): 8 z 9 narzędzi
(wszystkie poza a3-problem-solving) NIE MAJĄ kanału-A — czatowego mentora, który prowadzi
rozmowę pytanie-po-pytaniu z rozgałęzieniem na odpowiedzi (to co swot/value-chain/porter/
portfolio mają wpięte w `useToolAI.ts`'s `interviewProtocol` ternary). a3-problem-solving i
risk-uncertainty dostały connected O3-patch, ale w innym kanale niż live-chat — pełna
rozgałęziona drabinka jest tam nałożona na przycisk "Suggestions" (`promptRegistry.ts`), a nie
na wolną rozmowę czatu.

**Uczciwe podsumowanie**: to nie jest "one-shot vs 19/19 zmergowane" — to jest "drążenie
click-driven (9 operacyjnych, + a3/risk mają wzmocnioną wersję click-driven) vs drążenie
live-chat (4 narzędzia rodziny reference/wave-1: swot, value-chain, porter, portfolio — po
J6 wszystkie 4 kompletne)". Rozszerzenie kanału-A na 9 narzędzi operacyjnych to osobna,
większa robota (nie w zakresie J6) — `focustradeoffs`' `buildFocusOptionLadderPrompt` pokazuje
dokładnie ten wzorzec do powielenia, gdy Piotr zdecyduje się to zrobić.

## Dług do rozważenia (nie naprawiony w J6, zakres węższy niż mandat)

- `src/config/capabilitymapper/capabilityQuestionBank.ts:355` `buildCapabilityLadderPromptBlock` — 0 callerów.
- `src/config/narrativeengine/pyramidQuestionBank.ts:716` `buildCategoryLadderPromptBlock` — 0 callerów.
- `src/config/focustradeoffs/focusQuestionBank.ts` + `focusTradeoff.ts:19-25` `buildFocusOptionLadderPrompt` — świadomie niewpięty (self-documented), kandydat do kanału-A jeśli Piotr chce parytetu z 4 tools.

Żaden z tych trzech nie blokuje działania narzędzia dla klienta (deepeningLadder.ts + Suggestions
+ conclusion-prompt mechanika działa niezależnie) — to czysto redukcja martwego kodu / przyszłe
rozszerzenie zasięgu, nie bug.
