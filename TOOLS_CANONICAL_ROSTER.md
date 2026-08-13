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

## 3a. Głębokość merytoryki (harvest T1, zweryfikowany osobiście)

Renderer i TREŚĆ to dwie różne osie. Realna merytoryka nie leży w
`docs/product/*` (tam w większości `TBD`), tylko w **`src/config/<narzędzie>/`**
— wzorzec „OXFORD O3": drabinka pogłębiania + bank pytań + deterministyczny
silnik syntezy + prompty konkluzji.

**Dowód zweryfikowany osobiście:** `src/config/` zawiera dokładnie **19**
katalogów metodycznych (swot, porter, ansoff, valuechain, portfolio,
capabilitymapper, ambitiondecomposer, focustradeoffs, riskuncertainty,
narrativeengine, sopbuilder, a3problemsolving, smedplanner, dmsbuilder,
inventoryautopilot, rpascanner, aidiscovery, painexplorer, processautomation).

| Stan treści | Liczba | Narzędzia |
|---|---|---|
| **RICH** (silnik + bank pytań) | **19** | 16 z rendererem + rpa-scanner, ai-discovery, pain-explorer |
| **EVIDENCE_MISSING** | **12** | dokładnie te oznaczone „coming soon" |

**Ważne potwierdzenie:** zbiór 12 `EVIDENCE_MISSING` pokrywa się **co do
jednego** z 12 oznaczonymi `is_coming_soon=1`. Flaga „coming soon" jest więc
uczciwa i zgodna ze stanem merytoryki — to nie jest dług, tylko poprawna
deklaracja.

**Uściślenie L4:** rpa-scanner, ai-discovery i pain-explorer mają **pełne
silniki metodyczne**, brakuje im wyłącznie gałęzi w `ToolCanvas.tsx`. To nie
jest brak merytoryki, tylko **niedokończone podłączenie UI** — wzorzec „kod
jest, podłączeń nie ma".

## 3b. L8 — KRYTYCZNA sprzeczność: Output ≠ Report/Presentation

`src/config/consultingToolsStandard.ts:35`:

```ts
export const CONSULTING_TOOL_STANDARD_OUTPUTS = ['initiative'] as const;
```

Runtime dowozi **wyłącznie `initiative`**. Tymczasem
`docs/product/UNIVERSAL_TOOL_OUTPUTS_STANDARD_V1.md` deklaruje cztery typy:
`initiative | report | presentation | idea`. Zawężenie jest świadome (komentarz
RB-025: pozostałe trzy „nie miały implementacji generowania, tworzenia, retry,
reopen ani lineage"), a stała jest realnie konsumowana w `ToolDocumentView`,
`outputsScaffolding`, `discoveryToolManifestMapper`, `defaultToolConfigs` i
promptach AI — to żywy kontrakt, nie martwy kod.

**KOREKTA (2026-08-13, weryfikacja backendu).** Pierwotnie zapisałem tu, że
Reports „nie mają żadnej implementacji — budowa od zera". **To było za mocne
i jest nieprawdziwe wobec backendu.** Sprawdzenie realnego kodu serwera:

- `ToolController.promoteToOutput` (linia 2072) przyjmuje **cztery** typy:
  `initiative | report | presentation | idea`;
- ma izolację organizacji, bramkę statusu (`APPROVED/GENERATED/FINALIZED`),
  blokery promocji oraz **idempotencję** przez `tool_initiative_links.batch_id`
  (istniejąca promocja jest zwracana zamiast tworzyć duplikat);
- `ReportBuilderService.ts` to realna usługa o rozmiarze ~114 KB, obsługująca
  `source_type = 'TOOL'` przy zbieraniu referencji.

**Rzeczywisty zakres luki jest węższy, niż napisałem:** zawężenie do
`['initiative']` dotyczy **stałej frontendowej** sterującej CTA w
`ToolDocumentView`, a nie możliwości serwera. Praca to **podłączenie i
weryfikacja end-to-end**, nie budowa od zera. Nadal brakuje jednak
pierwszorzędnej trwałości Outputu jako niezmiennego snapshotu (L3) —
to zostaje w mocy.

## 3c. L9 — Kontrakt konkluzji W2 jest wiążący

`docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2 nakłada na **output
narzędzia** formułę K1–K4 z twardymi limitami (K1 ≤ 60 słów, K2 ≤ 80,
K3 = 3–5 punktów po ≤ 25 słów, K4 ≤ 50) i regułą nadrzędną:
**K1 pochodzi z silnika, NIGDY z LLM.** Każdy Tool Pack musi nieść ten kontrakt
(pole `conclusion` w `src/toolPacks/contract.ts`), inaczej Output łamie FROZEN
standard.

## 3d. L10 — Licencje: EVIDENCE_MISSING w całości

W `docs/` ani `src/` nie ma żadnej noty licencyjnej, atrybucji ani copyright
dla metod bazowych (Porter, Ansoff, BCG, SMED, 5-Why/A3, Minto/SCQA). Nazwy
metod występują jako zwykłe etykiety. Baza deklaruje `is_licensed=0` /
`license='free'` dla wszystkich 31 — ale to flaga produktowa, **nie oświadczenie
prawne**. Zgodnie z decyzją właściciela: `EVIDENCE_MISSING`, bez zgadywania.

## 3e. L11 — KRYTYCZNE: serwis kasuje bogatą treść Library przy każdym starcie

Odkryte w fali Content Gap, **zweryfikowane osobiście w kodzie**.

Repo ma DWIE warstwy treści Library, nie jedną cienką:

1. **Migracje `559_tools_known_tools_library.sql` i `562_tools_toolsets_speed.sql`**
   (obie **aktywne**, nie w `never-ran/`) wypełniają
   `library_content_translations` **ośmioma** polami: `whenToUse`, `inputs`,
   `steps`, `outputs`, `commonMistakes`, `example`, `nextSteps`, `whatYouGet`.
2. **`server/src/services/KnownToolsService.ts:707` `ensureToolsSeedOnce()`**
   buduje ten sam obiekt **wyłącznie z `whatYouGet`** (linie 723-726)
   i nadpisuje kolumnę bezwarunkowo:
   `library_content_translations = EXCLUDED.library_content_translations`
   (linia 740).

**Skutek:** raz na proces serwer kasuje 7 z 8 pól treści Library dla
wszystkich 31 narzędzi. To wyjaśnia obserwację z Gate T0 — żywa baza demo
zwracała wyłącznie `whatYouGet` z czterema punktami, mimo że migracje niosą
pełny opis. Komentarz w kodzie tłumaczy intencję (propagacja poprawek flag),
ale efekt uboczny niszczy treść.

**To bezpośrednio blokuje wymaganie właścicielskie**, by Library było arkuszem
informacyjno-edukacyjno-sprzedażowym (kiedy użyć, proces, dane wejściowe,
rezultat, typowe błędy, przykład, następne kroki) — ta treść **istnieje
w repo** i jest niszczona przed dotarciem do ekranu.

**Drugie ustalenie:** `ACTIVE_KNOWN_TOOL_TYPES` (linia 205) to zaszyta lista
19 pozycji, a `isActive` liczy się jako `rowIsActive && allowlist.has(toolType)`
(linia 775). `getKnownTool()` zwraca `null` dla 12 spoza listy, więc ich
szczegół nigdy nie wróci z API — niezależnie od zawartości bazy.

## 4. Granice zakresu

**Moje (Tools):** 31 narzędzi powyżej, ich Tool Packi, renderery, mechanika
sesji, Outputs, Reports, Initiative Proposals.

**Nie moje:** 5 frameworków Assessment (DRD/SIRI/ADMA/CMMI/LEAN) — widoczne w
Library, ale należą do Opus Assessment/Core; domena Audits; wspólny kernel.

**Stan kontraktu wspólnego na 2026-08-13:** gałąź
`codex/method-assessment-core-20260813` jest **identyczna z `origin/demo`**
(0 commitów różnicy). `SHARED_CONTRACT_MANIFEST` nie istnieje. Zgodnie z
poleceniem buduję za lokalną, wymienialną granicą adaptera.
