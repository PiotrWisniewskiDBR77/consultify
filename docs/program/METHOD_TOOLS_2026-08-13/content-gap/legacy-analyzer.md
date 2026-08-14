# Content Gap Register — `legacy-analyzer` (Legacy Drag Analyzer / Analizator oporu legacy)

> Wave 3 ("Operational and Automation Tools"), `is_coming_soon=1` w live registry.
> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`.

---

## 1. Co istnieje

### 1.1 Marketing / Library copy (w repo, ale efektywnie nieosiągalna z API)

- `server/migrations/562_tools_toolsets_speed.sql:478-520` (migracja **aktywna**) — pełny 9‑polowy JSON EN+PL: `shortDescription:"A pragmatic way to decide what to modernize, when, and how.", whenToUse, whatYouGet[3]=["Constraint list","Modernization options","Roadmap candidates"], inputs[4]=["System landscape","Incidents","Change lead time","Dependency map"], steps[5]=["Map constraints","Assess risk","Pick options","Sequence","Define initiatives"], outputs[3], commonMistakes[3], example:"Strangler pattern + API facade to reduce coupling and improve delivery speed.", nextSteps[2]`. [REPO_CANON]
- `server/migrations/562_tools_toolsets_speed.sql:752,1277-1314` — KB `kb-art-tools-legacy-analyzer`, `published`, EN+PL, uboższy wariant (tylko `Steps(5) → Next steps`).
- Zduplikowany, **NIGDY NIE ZASTOSOWANY** wariant w `server/migrations/never-ran/618_tools_missing_12_consulting_tools.sql:392-434` — inny `example` ("ERP module scores 9/10 drag on speed → strangler-fig migration over 4 quarters"), martwy duplikat (562 uruchamiane pierwsze, `ON CONFLICT DO NOTHING` blokuje 618).
- **Content z 562 jest DODATKOWO martwy z perspektywy API** — identyczny mechanizm: `ACTIVE_KNOWN_TOOL_TYPES` (`KnownToolsService.ts:205-228`) nie zawiera `legacy-analyzer`; `getKnownTool()` → `null`; `SQLITE_KNOWN_TOOLS_SEED` (623-635) `isComingSoon: true` (linia 634), skrócony `whatYouGetEn: ['Legacy drag scorecard', 'Risk heatmap', 'Modernization backlog']`; `ensureToolsSeedOnce()` nadpisuje na każdym boot.
- RV-028 test potwierdza brak Open/Start.

### 1.2 Spec dokumentu produktowego

- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:866-896` (§3.27) — **PEŁNY wizard plan**: micro-video 60s breakdown, `Define (scope: which systems/business impact)/Inputs & assumptions (evidence prompts: change lead time, incident patterns, manual workarounds, integration friction; attachments: incident reports, release logs, architecture snapshots; consultant assumptions: "drag metrics" interpretation and caveats)/Work surface: table-first (scorecard: latency/change cost/operational risk + migration alternatives list)/Review (missing: evidence for each score dimension + target outcome definition)/Finalize/Outputs (initiatives: stabilize/decouple/modernize + report/deck)`. `KB: TBD` w dokumencie — nieaktualne wobec 1.1.

### 1.3 Runtime / silnik

- `src/config/agentManifests/discoveryToolsRegistry.ts:136` — `PLANNED_TOOL_IDS`, `status:'planned', steps:[]`.
- `src/store/useToolStore.ts:2748` — `TOOLSET_DIGITAL_STEPS` (generyczne kroki).
- `src/hooks/discovery/toolAi/systemPrompts.ts:205` — generyczny `OPERATIONAL_SYSTEM_PROMPT`.
- `src/components/DiscoveryTools/dedicatedToolTypes.ts:32` — w `DEDICATED_TOOL_TYPES`.
- Brak `src/config/legacyanalyzer/`. Zero implementacji "scorecard" (latency/change cost/operational risk) lub "migration alternatives list".

### 1.4 Knowledge base

- `knowledge/tool-kb/` — zero katalogu `legacy-analyzer`. [EVIDENCE_MISSING]

### 1.5 Mylący dokument

- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` §3.4 — klasyfikuje jako brakujące wyłącznie `GFX, VID`; nieaktualne wobec §1.1.

---

## 2. Czego brakuje

- **Silnik**: brak logiki scoringu 3 wymiarów "drag" (latency/change cost/operational risk) — spec sam mówi "consultant assumptions: 'drag metrics' interpretation and caveats" co sugeruje, że nawet autorzy spec dokumentu wiedzieli, że definicja metryk wymaga jeszcze decyzji.
- **Bank pytań**: zero.
- **Katalog opcji modernizacji**: `example` wspomina "strangler pattern", "API facade" — to realne, nazwane wzorce inżynieryjne (patrz §3), ale nie ma w repo żadnej ustrukturyzowanej listy opcji z kryteriami wyboru.
- **Asset**: brak preview graphic i micro-wideo.

---

## 3. Czy istnieje wiarygodne źródło

**Tak, częściowo — dwa rozpoznawalne źródła zewnętrzne dla różnych fragmentów.**

1. **Klasyfikacja portfela aplikacji / decyzje modernizacyjne**: **Gartner TIME model** (Tolerate / Invest / Migrate / Eliminate) to publikowany, cytowalny framework do oceny portfela aplikacji legacy — dobrze pasuje do "modernization options" z tego narzędzia. [AUTHORITATIVE_EXTERNAL_SOURCE — istnieje (Gartner), ale to płatny, chroniony prawnie materiał analityka (Gartner research); nic z niego nie jest w repo]
2. **Wzorce migracji** ("strangler pattern"/"strangler fig" — Martin Fowler, "API facade") to dobrze udokumentowane, publiczne wzorce inżynierii oprogramowania (branża tech, nie jeden formalny "framework konsultingowy", ale powszechnie cytowane, np. martinfowler.com). [AUTHORITATIVE_EXTERNAL_SOURCE — istnieje publicznie i jest swobodnie cytowalne (Fowler publikuje otwarcie), ale nic z tej treści nie jest w repo]
3. **Koncepcja "technical debt"** ogólnie (Ward Cunningham) — powszechnie znana, niechroniona.

---

## 4. Czego NIE WOLNO wygenerować

- Konkretnych progów scoringu "drag" (np. "9/10 = pilne") bez danych klienta — istniejący `example` w wersji 618 ("ERP module scores 9/10 drag") jest już wymyślony, nie traktować jako wzorzec liczbowy.
- Reprodukcji treści raportów Gartnera (płatne, chronione prawami autora) — można wspomnieć nazwę modelu TIME jako inspirację/kontekst, ale nie kopiować definicji ani grafik Gartnera.
- Twierdzeń o licencji/partnerstwie z Gartner.
- Fabrykowanych "typowych" kosztów migracji bez źródła.

---

## 5. Minimalny Pack do authoringu

1. **`methodology/v1`**: jasne rozdzielenie — klasyfikacja portfela inspirowana (nie kopiowana) modelem Gartner TIME, wzorce migracji cytowane z otwartych źródeł (Fowler), definicja 3 wymiarów "drag" wymaga decyzji eksperckiej (nie jest dana z góry).
2. **`qbank/v1`**: pytania z sekcji "Inputs & assumptions" spec dokumentu — change lead time, incident patterns, manual workarounds, integration friction.
3. **`help/v1`**: rozbudowa `562:1277-1314` do 4 bloków.
4. Jawna adnotacja: żadnego kopiowania treści Gartner, żadnych progów bez danych klienta.

---

## 6. Wymagany przegląd ekspercki

**TAK.** Ocena legacy drag i rekomendacje modernizacyjne (strangler vs. facade vs. replace) wymagają doświadczenia architektonicznego — błędna rekomendacja ma wysoki koszt wdrożeniowy. [EXPERT_REVIEW_REQUIRED]

## 7. Wymagany przegląd prawny

**TAK.** Jeśli authoring odwołuje się do modelu Gartner TIME (nawet tylko nazwą/koncepcją), wymagany check czy to dozwolone bez licencji Gartnera (samo wspomnienie nazwy publicznie znanego modelu analitycznego jest zazwyczaj OK, ale nie wolno reprodukować definicji/matrycy 1:1 z ich publikacji). [LEGAL_REVIEW_REQUIRED]

---

## 8. Provenance tags

`REPO_CANON` · `ENGINE_DERIVED` (brak) · `AUTHORITATIVE_EXTERNAL_SOURCE` (Gartner TIME model dla klasyfikacji; Fowler/strangler pattern dla wzorców migracji — oba istnieją, nic w repo) · `EDITORIAL_DRAFT` (Library+KB) · `LEGAL_REVIEW_REQUIRED` · `EXPERT_REVIEW_REQUIRED` · `EVIDENCE_MISSING` (stan bazy live niezweryfikowany).
