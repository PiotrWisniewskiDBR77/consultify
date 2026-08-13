---
document_id: TOOLS-CANONICAL-ROSTER
module: Tools (Library → Sessions → Outputs → Reports → Initiatives)
status: GATE_T0_COMPLETE
owner: piotr
prepared_by: Opus Tools
branch: codex/method-tools-20260813
baseline_sha: f3e7df565e0da826ba110d85aad3c3c81a1087f1
evidence_date: 2026-08-13
---

# Tools — kanoniczny roster (Gate T0)

## 0. Jak ustalono roster (dowód, nie pamięć)

Roster ustalony z **żywej bazy demo** (`trolley.proxy.rlwy.net:28146`, tabela
`public.tools`, zapytanie tylko-do-odczytu), skonfrontowany z kodem:

| Źródło | Liczba | Zgodność |
|---|---|---|
| `public.tools` (żywa baza demo) | **31** | źródło prawdy |
| `ToolType` union — `src/store/useToolStore.ts:23` | **31** | 1:1 z bazą |
| `DEDICATED_TOOL_TYPES` — `src/components/DiscoveryTools/dedicatedToolTypes.ts` | **31** | 1:1 z bazą |
| `ASSESSMENT_FRAMEWORK_META` — `DiscoveryToolsHub.tsx:290` | **5** | nie moja domena |

### Rozstrzygnięcie „36 na ekranie vs 31 w dokumentach"

**Sprzeczności nigdy nie było.** Ekran Library renderuje `libraryCatalogItems`
(`DiscoveryToolsHub.tsx:2935-2975`) = `knownTools` (31 z rejestru DB)
**+** `assessmentTemplateItems` (5 frameworków: DRD, SIRI, ADMA, CMMI, LEAN).

**31 + 5 = 36.**

`automationTemplateItem` (`process-automation`) **nie** dokłada 32. pozycji —
strzeże go `if (!byToolType.has(...))`, a `process-automation` jest w rejestrze
(`sort_order=401`). Dowód: liczba wierszy w bazie = 31, nie 30.

Pięć frameworków assessment to **szablony Assessment**, nie narzędzia Tools.
Należą do domeny Opus Assessment/Core. **Nie dodaję i nie usuwam narzędzi** —
roster Tools to dokładnie 31 pozycji.

## 1. Roster (31 pozycji)

Legenda kolumny *Renderer*:
- **dedykowany** — własna gałąź w `ToolCanvas.tsx`;
- **generyczny** — brak gałęzi, fallback (`Digital/GenericDomainStep.tsx`).

Legenda *Pack*: stan Tool Pack. `config_schema` w bazie jest **NULL dla
wszystkich 31** → Tool Pack nie istnieje dla żadnego narzędzia.

### Strategy (10)

| # | Display name | toolType | Status | Renderer | Pack | Sesje |
|---|---|---|---|---|---|---|
| 1 | Dynamic SWOT | `dynamic-swot` | active | dedykowany | brak | 30 |
| 2 | Market Forces (Porter) | `market-forces` | active | dedykowany | brak | 2 |
| 3 | Growth Paths (Ansoff) | `growth-paths` | active | dedykowany | brak | 0 |
| 4 | Value Chain Analysis | `value-chain` | active | dedykowany | brak | 0 |
| 5 | Portfolio Prioritization | `portfolio-priority` | active | dedykowany | brak | 3 |
| 6 | Risk & Uncertainty | `risk-uncertainty` | active | dedykowany | brak | 2 |
| 7 | Capability Mapper | `capability-mapper` | active | dedykowany | brak | 1 |
| 8 | Ambition Decomposer | `ambition-decomposer` | active | dedykowany | brak | 2 |
| 9 | Focus & Trade-offs | `focus-tradeoff` | active | dedykowany | brak | 0 |
| 10 | Narrative & Alignment | `narrative-engine` | active | dedykowany | brak | 0 |

### Operations (10)

| # | Display name | toolType | Status | Renderer | Pack | Sesje |
|---|---|---|---|---|---|---|
| 11 | A3 Problem Solving | `a3-problem-solving` | active | dedykowany | brak | 2 |
| 12 | VSM Builder | `vsm-builder` | **coming soon** | generyczny | brak | 0 |
| 13 | SOP Builder | `sop-builder` | active | dedykowany | brak | 2 |
| 14 | Constraint Control (TOC) | `constraint-control` | **coming soon** | generyczny | brak | 0 |
| 15 | Decision Engine | `decision-engine` | **coming soon** | generyczny | brak | 0 |
| 16 | Control Tower | `control-tower` | **coming soon** | generyczny | brak | 0 |
| 17 | Automation Pipeline | `automation-pipeline` | **coming soon** | generyczny | brak | 0 |
| 18 | SMED Planner | `smed-planner` | active | dedykowany | brak | 0 |
| 19 | Daily Management System | `dms-builder` | active | dedykowany | brak | 0 |
| 20 | Inventory Autopilot | `inventory-autopilot` | active | dedykowany | brak | 0 |

### Digital / Automation (11)

| # | Display name | toolType | Status | Renderer | Pack | Sesje |
|---|---|---|---|---|---|---|
| 21 | Robotics Feasibility | `robotics-feasibility` | **coming soon** | generyczny | brak | 0 |
| 22 | Logistics Automation | `logistics-automation` | **coming soon** | generyczny | brak | 0 |
| 23 | RPA Scanner | `rpa-scanner` | active | **generyczny ⚠** | brak | 1 |
| 24 | AI Discovery | `ai-discovery` | active | **generyczny ⚠** | brak | 0 |
| 25 | Integration Diagnostic | `integration-diagnostic` | **coming soon** | generyczny | brak | 0 |
| 26 | Digital Value Pool | `digital-value-pool` | **coming soon** | generyczny | brak | 0 |
| 27 | Legacy Analyzer | `legacy-analyzer` | **coming soon** | generyczny | brak | 0 |
| 28 | Data Inventory | `data-inventory` | **coming soon** | generyczny | brak | 0 |
| 29 | Pain-to-Solution Mapper | `pain-to-solution` | **coming soon** | generyczny | brak | 0 |
| 30 | Pain Explorer | `pain-explorer` | active | **generyczny ⚠** | brak | 1 |
| 31 | Process Automation | `process-automation` | active | dedykowany | brak | 0 |

Wszystkie 31: `is_active=1`, `is_licensed=0`, licencja = `free`.
Rejestr: `public.tools`; route API: `GET /api/known-tools` (+ `/:toolType`);
UI: `DiscoveryToolsHub.tsx`; kontroler: `KnownToolsController.ts`.

## 2. Podsumowanie pokrycia

| Wymiar | Stan |
|---|---|
| Narzędzia w rosterze | 31 |
| Treść Library (opis, tłumaczenia PL/EN) | **31/31 kompletna** |
| Tool Pack (`config_schema`) | **0/31** |
| Renderer dedykowany | **16/31** |
| Renderer generyczny | 15/31 |
| Oznaczone „coming soon" | 12/31 |
| Sesje ukończone (`status='completed'`) | **0 / 125** |

## 3. Luki krytyczne (dowody z żywego runtime)

**L1 — Zero Tool Packów.** `config_schema IS NULL` dla wszystkich 31 wierszy.
Nie istnieje ani jeden Pack, ani walidator. To jest główna praca programu.

**L2 — Żadna sesja nigdy nie została ukończona.** `tool_sessions` ma 125
wierszy i **0** o `status='completed'` — dla każdego bez wyjątku typu narzędzia.
Ścieżka Session → Output nie została nigdy przejechana do końca na demo.

**L3 — Output nie ma pierwszorzędnej trwałości.** Tabela `tool_outputs` **nie
istnieje**. Output żyje jako kolumna `output_json` na `tool_sessions` → brak
niezmiennego snapshotu, brak wersjonowania, brak śladu zatwierdzeń wymaganego
przez `TOOL_ARTIFACT_TYPE_CONTRACT.md` §1 (*Tool Output — immutable snapshot*).

**L4 — Trzy narzędzia obiecują więcej, niż dowożą.** `rpa-scanner`,
`ai-discovery`, `pain-explorer` mają `is_coming_soon=0` (Library prezentuje je
jako w pełni dostępne), ale nie mają gałęzi w `ToolCanvas.tsx` — lecą na
generycznym `GenericDomainStep`. Pozostałe 12 bez renderera są uczciwie
oznaczone „coming soon".

**L5 — Dane sesji skażone.** `tool_sessions.tool_type` zawiera wartości spoza
rosteru: `MYWORK` (73 wiersze — 58% tabeli), `operations`, `executive`,
`growth`, `ai`, `strategic`. Kolumna nie ma FK do `tools.tool_type`.

**L6 — ODRZUCONE (hipoteza obalona probem).** Podejrzenie, że Library pokazuje
slugi, bo `tools.name = tool_type` dla wszystkich 31 wierszy. **Nieprawda.**
`KnownToolsService.ts:863` i `:912` mapują `name: row.display_name` w odpowiedzi
API, a sortowanie idzie po `display_name` (`:845`). Kolumna `name` pełni rolę
wewnętrznego klucza unikalnego (`ON CONFLICT (name)`, `:734`). UI dostaje
poprawne nazwy prezentacyjne. **Defektu nie ma.**

**L7 — FANTOM: katalog metodyk strategii jest pusty.**
`src/toolCatalog/strategy/catalog.ts` (25 linii) deklaruje
`const STRATEGY_TOOL_DOCS: Record<string, string> = {};` — **zero wpisów**.
Skutki w realnym runtime:
- `GenericToolDocumentView.tsx:62` — `if (!toolSlug || !hasStrategyToolDoc(...))`
  zawsze robi wczesny return → widok dokumentu metodyki dla narzędzi na
  rendererze generycznym **nigdy nie ładuje treści**;
- `DiscoveryToolsHub.tsx:4835` — gałąź `strategyCatalogSlugs.length > 0`
  nigdy nie odpala → kategoria „strategia" w menu Dodaj jest martwa.

To pogłębia L4: 15 narzędzi na rendererze generycznym nie ma ani sygnaturowej
geometrii, ani dokumentacji metodyki.

## 4. Granice zakresu

**Moje (Tools):** 31 narzędzi powyżej, ich Tool Packi, renderery, mechanika
sesji, Outputs, Reports, Initiative Proposals.

**Nie moje:** 5 frameworków Assessment (DRD/SIRI/ADMA/CMMI/LEAN) — widoczne w
Library, ale należą do Opus Assessment/Core; domena Audits; wspólny kernel.

**Stan kontraktu wspólnego na 2026-08-13:** gałąź
`codex/method-assessment-core-20260813` jest **identyczna z `origin/demo`**
(0 commitów różnicy). `SHARED_CONTRACT_MANIFEST` nie istnieje. Zgodnie z
poleceniem buduję za lokalną, wymienialną granicą adaptera.
