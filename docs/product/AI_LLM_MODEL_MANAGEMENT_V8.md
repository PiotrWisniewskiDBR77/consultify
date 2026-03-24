# AI LLM Model Management v8

> **Status:** Canonical analysis and build-direction document  
> **Cel:** okreslic, jak `consultify` powinno zarzadzac wieloma modelami LLM tak, aby system dobieral modele do zadan inteligentnie, przewidywalnie, kosztowo swiadomie i zgodnie z politykami organizacji.  
> **Zakres:** routing, profiles, purpose fit, reasoning effort, context classes, cost controls, deprecations, observability i governance dla warstwy `multi-LLM`.

---

## 0) Powiazane dokumenty (MUST)

- `docs/product/modules/ai/AI_LLM_OPERATING_SYSTEM_V3.md`
- `docs/product/MODEL_REGISTRY_V3.md`
- `docs/product/modules/ai/AI_MODEL_PURPOSES_AND_REQUIREMENTS_V3.md`
- `docs/product/modules/ai/AI_AGENT_ORCHESTRATION_V3.md`
- `docs/product/AGENT_MULTI_AGENT_WORK_MANAGEMENT_V8.md`
- `docs/product/CHAT_V8_MODES_AND_SCOPE_MODEL.md`

---

## 0.1 Cross-cutting parity architecture

`AI_LLM_MODEL_MANAGEMENT_V8.md` pozostaje kanonicznym dokumentem dla multi-LLM selection and execution-profile direction.

Przekrojowe warstwy delegowane do parity package:

- `docs/product/AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`
- `docs/product/AI_WORKLOAD_CLASSES_AND_SLA_ARCHITECTURE_V8.md`
- `docs/product/AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`

This document still owns:

- model profile direction,
- execution profile resolution,
- task-shape routing,
- effort policy,
- lifecycle direction for model management.

---

## 0.2 What still needs hardening for leader-grade quality

The parity package now gives `LLM Management v8` stronger neighboring architecture, but it does not close the most important model-management gaps by itself.

This document still must remain the canonical owner for:

- `Model Profile Registry`,
- `Task Shape Classifier`,
- `ExecutionProfileResolver`,
- `reasoning effort` policy,
- cost-aware routing modifiers,
- model lifecycle and migration logic.

The parity package should be treated as support architecture around this document:

- `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` for canary and rollback discipline,
- `AI_WORKLOAD_CLASSES_AND_SLA_ARCHITECTURE_V8.md` for workload classes and execution expectations,
- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md` for routing explainability and support-visible trust traces.

So the hardening rule is:

`do not move core model-selection intelligence out of this document; instead make parity architecture consume and operationalize it consistently`

---

## 1) Reference systems analyzed from Softs

Ta analiza jest oparta bezposrednio na materialach z `Softs/Agenci  !`:

- `Longchain dev.zip`
  - `docs.langchain.com/oss/python/langchain/models.html`
  - `docs.langchain.com/oss/python/deepagents/models.html`
  - `docs.langchain.com/oss/python/langchain/context-engineering.html`
- `crewai.zip`
  - `docs.crewai.com/en/concepts/reasoning.html`
- `OpenAI.zip`
  - `developers.openai.com/codex/guides/subagents.html`
  - `developers.openai.com/cookbook/examples/agents_sdk/parallel_agents/`
- `OpenAi model selection.zip`
  - `platform.claude.com/llms.txt`
  - `platform.claude.com/llms-full.txt`
  - pakiet tematow: `choosing a model`, `pricing`, `model deprecations`, `context windows`, `fast mode`, `effort`, `usage cost api`, `token counting`, `prompt caching`, `batch processing`
- `Replit.zip`
  - `docs.replit.com/replit-workspace/workflows.html`

### 1.1 Najwazniejsze imported rules

1. `LangChain` uczy, ze model selection musi byc oparty o `task fit`, bo modele roznia sie zdolnosciami, kosztem i rozmiarem kontekstu.
2. `LangChain Deep Agents` pokazuje, ze agent runtime powinien przyjmowac provider-agnostic model selector, a nie byc przyspawany do jednego vendora.
3. `LangChain context engineering` wzmacnia zasade, ze dobor modelu jest elementem context engineering, nie tylko ustawieniem administracyjnym.
4. `CrewAI reasoning` pokazuje, ze `reasoning effort` i `planning intensity` powinny byc oddzielnym sterowaniem od samego wyboru modelu.
5. `OpenAI subagents` pokazuje, ze rozne subtaski potrzebuja roznych modeli i roznego poziomu reasoning, a system moze dobierac balance `intelligence / speed / price`.
6. `OpenAI parallel agents` pokazuje, ze wybor architektury wykonania zmienia optymalny wybor modelu, bo planner overhead i dlugosc kontekstu same w sobie generuja koszt i latency.
7. `Claude model docs` pokazuja, ze dojrzaly model management obejmuje nie tylko model table, ale tez `context windows`, `pricing modifiers`, `deprecations`, `regional endpoint tradeoffs`, `usage cost APIs`, `prompt caching`, `batch discounts` i `effort`.
8. `Replit workflows` wnosi slabszy, ale nadal wazny sygnal: rozne klasy workflow maja rozne SLA i execution modes, wiec nie powinny dziedziczyc jednego default modelu.

---

## 2) Co juz mamy mocne w consultify

Na tle referencji `consultify` ma juz solidny fundament:

1. Mamy `purpose-based routing` jako kierunek kanoniczny.
2. Mamy `tier routing` i fallback chains.
3. Mamy `health gating`, provider guards, circuit breaker i rate/concurrency limits.
4. Mamy `model registry`, `purpose assignments`, org-level enable/disable i polityki danych.
5. Mamy `FinOps` z cost telemetry, budget view, vendor scorecards i breakdown per purpose.
6. Mamy `recommended preset`, ktory seeduje purposes i assignments.

To znaczy, ze problemem nie jest brak podstaw. Problemem jest to, ze warstwa wyboru modelu nadal jest zbyt statyczna i zbyt malo oparta o runtime evidence.

---

## 2.1 Core function coverage matrix

Drugi przebieg analizy pokazal, ze `consultify` ma wiecej core funkcji niz wynika z samej warstwy chat UX. Problem polega glownie na tym, ze te funkcje sa nierownomiernie rozlozone miedzy backend, SuperAdmin i runtime.

Legenda:

- `FULL` = funkcja istnieje jako realny capability
- `PARTIAL` = istnieje mocna baza, ale nie jest jeszcze domknieta jako pelny system
- `MISSING` = brak realnej implementacji jako first-class capability

| Core function | Status | Co mamy dzisiaj | Najwazniejsza luka |
| --- | --- | --- | --- |
| Provider and model registry | `FULL` | `llm_providers`, `model_registry`, CRUD, health, regions, data classes, UI registry | profil modelu nadal zbyt plytki |
| Purpose-based assignments | `FULL` | `ai_purposes`, `ai_purpose_assignments`, global + org overrides, UI assignments | brak inteligentniejszego runtime score |
| Capability / requirements matching | `FULL` | `modelMeetsRequirements`, `capabilities_json`, `contextWindow`, `jsonMode`, `tools`, `vision` | brak richer quality profile |
| Multi-provider abstraction | `FULL` | `llmService`, `modelRouter`, `recommended preset`, direct + aggregator support | brak jednego execution profile layer |
| Org policy / residency / data-class gating | `FULL` | `organization_ai_policy`, region/provider/data class filters, policy enforcement in router | coverage diff po zmianie policy |
| Health monitoring and health-gated routing | `FULL` | `providerSentinel`, `llm_health_events`, `health_status`, `LLMHealthPanel`, router gating | brak pelnej korelacji health z quality score |
| Cost telemetry and FinOps | `FULL` | `ai_usage_logs`, `price_snapshot_id`, `estimated_cost_usd`, `llmFinOpsService`, dashboards | router nadal za slabo cost-active |
| Price snapshots | `FULL` | `ai_price_snapshots`, historyczne ceny, pricing UI | brak cost modifiers w samym resolverze |
| Market inbox / vendor catalog updates | `FULL` | `ai_market_inbox`, sync/apply flow, `MarketInboxTab` | brak pelnego lifecycle automation |
| Purpose coverage / control plane | `PARTIAL` | `AIUseCaseControlPlane`, `coveragePct`, `releaseCoveragePct`, readiness | brak jednego canonical coverage engine dla wszystkich routing constraints |
| Eval harness | `PARTIAL` | datasety, eval runs, regression gates, release bundles, compare endpoints | nie jest jeszcze centralnym driverem model selection |
| Release bundles | `PARTIAL` | `ai_eval_release_bundles`, publish flow, prompt/model/policy versions | brak canary rollout i rollback orchestration |
| Prompt caching | `PARTIAL` | cache w `llmService`, cache stats/analytics, `platformServices` | brak routing decisions opartych o cache opportunity |
| Batch execution economics | `PARTIAL` | sa kolejki i async capabilities, sa reference docs i cost snapshots | brak first-class batch-aware LLM routing per purpose |
| Preflight cost estimate | `PARTIAL` | `preflightCostService`, intent -> tier/model estimate, alternatives | nadal tier-centric, nie execution-profile-centric |
| Context-window-aware routing | `PARTIAL` | `requirements.contextWindow`, trimming, working memory patterns | brak jawnych `context classes` i long-context policy |
| Routing explanation / why this model | `PARTIAL` | backend `routingTrace`, candidates, skipped reasons, prompt/policy versions | brak pelnego support/admin UI dla trace |
| Task-shape-aware routing | `PARTIAL` | intent classification i purpose registry istnieja | brak first-class `task shape classifier` |
| Reasoning effort control | `MISSING` | brak osobnej polityki `LOW/MEDIUM/HIGH` dla model execution | `tier` nadal robi za zbyt wiele rzeczy |
| Model deprecation management | `PARTIAL` | market inbox i release bundles daja baze | brak canonical `replacement mapping + org impact + migration program` |
| Canary rollout / rollback | `MISSING` | sa bundle foundations | brak realnego rollout controllera |

### 2.2 Korekta po drugim przebiegu

Najwazniejsza korekta wzgledem pierwszej syntezy:

1. `consultify` ma juz realny `enterprise AI control plane`, nie tylko surowy routing backendu.
2. `eval harness`, `release bundles`, `pricing snapshots`, `market inbox`, `prompt caching` i `coverage/readiness` nie sa juz "pomyslem", tylko istnieja jako capabilities.
3. Nadal jednak nie skladaja sie one jeszcze w jeden spojny komponent `multi-LLM execution management`.
4. Najwieksze realne braki to nadal: `reasoning effort`, `task shape routing`, `execution profile resolver`, `context classes`, `canary rollout`, `deprecation/migration automation`.

---

## 3) Co Softs maja przemyslane, a my jeszcze nie dosc mocno

## 3.1 Model profile musi byc bogatszy niz `tier`

Dzisiaj nasz model selection jest nadal zbyt mocno oparty o:

- `tier`
- proste `requirements`
- heurystyczne fallbacki

Brakuje first-class `model profile`, czyli tabeli cech, ktora dla kazdego modelu zapisuje:

- quality class per task family
- latency class
- context window class
- structured output reliability
- tool-calling maturity
- vision support
- long-context surcharge behavior
- prompt caching support
- batch support
- reasoning-effort support
- residency / regional endpoint variants
- deprecation state

Bez tego routing jest poprawny architektonicznie, ale nie jest jeszcze naprawde inteligentny.

## 3.2 Brakuje runtime selection po charakterystyce zadania

`Softs` wyraznie pokazuja, ze sam `purpose` nie wystarcza. Potrzebna jest druga warstwa:

- rozmiar wejscia
- czy odpowiedz ma byc `JSON strict`
- czy task wymaga tools
- czy to jest long conversation / long context
- czy to jest planner / reviewer / writer / extractor
- czy SLA jest `interactive`, `background`, czy `batch`
- czy budzet jest w trybie normalnym czy degraded

W `consultify` to jest jeszcze za slabo modelowane.

## 3.3 Brakuje oddzielenia `model choice` od `reasoning effort`

`CrewAI`, `OpenAI` i `Claude` pokazuja, ze trzeba umiec powiedziec:

- ten sam model, ale `low effort`
- ten sam model, ale `high effort`
- szybszy worker model bez glebokiego planowania
- drozszy planner/reviewer tylko tam, gdzie to potrzebne

Dzisiaj u nas `tier = prawie wszystko`. To jest za malo precyzyjne.

## 3.4 Brakuje cost modifiers jako elementu routingu

Referencje `Claude` sa tu bardzo mocne: dojrzaly system liczy nie tylko bazowa cene modelu, ale tez:

- prompt caching multipliers
- batch discounts
- long-context premium
- regional endpoint premium
- tool-use add-ons

U nas FinOps jest dobry, ale router nie wyglada jeszcze na taki, ktory aktywnie podejmuje decyzje z uwzglednieniem tych modifiers.

## 3.5 Brakuje lifecycle management modeli

Referencje rynkowe traktuja jako normalna czesc platformy:

- model deprecations
- migration path
- release bundles
- coverage check po zmianie modelu
- diff: co sie stanie z purpose coverage po zmianie polityki albo po wylaczeniu modelu

W `consultify` mamy czesci fundamentow, ale brakuje jednego dojrzalego `model lifecycle manager`.

## 3.6 Brakuje eval-driven scorecards per purpose

`LangChain` i nowoczesne vendor docs sugeruja eksperymentowanie i porownywanie modeli. To oznacza, ze dla kazdego waznego `purpose` powinnismy miec:

- quality score
- structured output validity
- citation / evidence quality
- latency percentile
- avg cost
- failure / retry rate

Bez tego wybieramy modele glownie na bazie konfiguracji i intuicji, a nie na bazie wynikow dla realnych zadan w naszej aplikacji.

## 3.7 Brakuje jawnego `why this model`

Mamy `routingTrace`, ale dojrzaly produkt powinien umiec pokazac:

- jaki model zostal wybrany
- dlaczego
- jakie alternatywy odpadly
- czy zadzialal fallback
- czy zadzialal degraded mode

To jest wazne nie tylko dla debugowania, ale tez dla zaufania admina i supportu.

---

## 4) Co warto dodac lub zmienic w aplikacji

## 4.1 Dodac kanoniczny `Model Profile Registry`

Nowa warstwa nad `llm_providers` powinna opisac zdolnosci i trade-offy modelu w sposob operacyjny.

Minimalne pola:

- `interaction_class`: `interactive|background|batch`
- `reasoning_class`: `light|medium|heavy`
- `latency_class`: `low|medium|high`
- `context_class`: `short|long|extended`
- `json_reliability_score`
- `tool_use_score`
- `vision_score`
- `cost_class`
- `supports_prompt_caching`
- `supports_batch`
- `supports_effort_control`
- `supports_parallel_tool_calls`
- `deprecation_status`
- `replacement_model_id`

## 4.2 Rozszerzyc `resolveModel()` do `resolveExecutionProfile()`

Zamiast zwracac tylko model, router powinien zwracac caly profil wykonania:

- `model`
- `effort`
- `context_strategy`
- `execution_mode`
- `budget_policy`
- `fallback_chain`
- `reason_for_selection`

To jest najwazniejsza zmiana architektoniczna.

## 4.3 Dodac `Task Shape Classifier`

Przed routingiem glownym system powinien sklasyfikowac task:

- `interactive_qna`
- `planner`
- `reviewer`
- `extractor`
- `writer`
- `strict_json`
- `long_context_synthesis`
- `background_batch`
- `parallel_worker`

Dopiero ta klasa powinna mapowac sie na model + effort + context policy.

## 4.4 Dodac `Reasoning Effort Policy`

Potrzebujemy osobnej polityki:

- `LOW`
- `MEDIUM`
- `HIGH`

Zasady:

- lekkie taski i subagenty read-heavy startuja z `LOW`
- planner, contradiction resolver, reviewer, final synthesis dostaja `MEDIUM` albo `HIGH`
- effort moze byc obnizany przy soft cap budzetowym

## 4.5 Dodac `Context Class Routing`

Referencje wyraznie lacza wybor modelu z dlugoscia kontekstu.

Potrzebujemy jawnych klas:

- `SHORT_CONTEXT`
- `LONG_CONTEXT`
- `COMPACTED_CONTEXT`
- `EXTENDED_CONTEXT`

I jawnej reguly:

- gdy kontekst przekracza prog, system nie tylko tnie historie, ale moze wybrac inny model lub inna cene wykonania

## 4.6 Dodac `Cost-Aware Execution Policies`

Router powinien liczyc:

- base token price
- long-context premium
- caching opportunity
- batch opportunity
- regional premium
- expected tool overhead

Decyzje powinny zmieniac nie tylko model, ale tez tryb wykonania:

- realtime
- async batch
- cached reuse
- cheaper worker fan-out

## 4.7 Dodac `Model Lifecycle Manager`

Potrzebne capabilities:

- incoming deprecation watch
- suggested replacement mapping
- coverage diff per purpose
- org impact report
- canary rollout
- rollback bundle

To powinno byc traktowane jako core platform feature, a nie manualna operacja SuperAdmina.

## 4.8 Dodac `Model Eval Scorecards`

Dla kazdego krytycznego `purpose` system powinien miec leaderboard modeli.

Minimum:

- success rate
- JSON validity rate
- latency p50/p95
- cost per successful output
- human acceptance rate
- unsupported-claim rate dla research/reporting

Wtedy assignments nie sa juz tylko konfiguracja, ale wynikiem stalej walidacji.

## 4.9 Dodac support-ready `Routing Explanation`

SuperAdmin i observability powinny widziec:

- selected model
- selected effort
- candidate list
- skip reasons
- policy filters
- health filters
- cost downgrade reasons

To powinno byc normalnym panelem, nie tylko debug logiem.

---

## 5) Priorytety wdrozenia

## P0

1. `Model Profile Registry`
2. `resolveExecutionProfile()` zamiast samego `resolveModel()`
3. `Task Shape Classifier`
4. `Reasoning Effort Policy`
5. `Routing Explanation` w observability

## P1

1. `Cost-Aware Execution Policies`
2. `Context Class Routing`
3. `Model Lifecycle Manager`
4. `coverage diff` po zmianach org policy / deprecations

## P2

1. `Model Eval Scorecards`
2. automatyczne rekomendacje assignments na bazie evals
3. canary i controlled rollout per org / purpose

---

## 6) Najwazniejszy wniosek

Najwieksza rzecz do zmiany w `consultify` nie polega na dodaniu kolejnych modeli. Ona polega na przejsciu:

- z `model registry + tier routing`
- do `execution profile management`

Czyli system ma wybierac nie tylko `jaki model`, ale:

- `jaki model`
- `z jakim effort`
- `w jakim trybie wykonania`
- `z jaka strategia kontekstu`
- `z jakim SLA i budzetem`

To jest dokladnie ten poziom dojrzalosci, ktory wynika z analizowanych `Softs`.

---

## 7) Final recommendation for consultify

Jesli mamy wykonac tylko jedna zmiane architektoniczna, to powinna nia byc budowa:

`ExecutionProfileResolver = task shape + org policy + model profiles + effort policy + cost policy + context policy`

To powinno stac sie nowym sercem calego `multi-LLM management` w aplikacji.
