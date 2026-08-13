# Content Gap Register — `digital-value-pool` (Digital Value Pool / Pule wartości cyfrowej)

> Wave 3 ("Operational and Automation Tools"), `is_coming_soon=1` w live registry.
> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`.

---

## 1. Co istnieje

### 1.1 Marketing / Library copy (w repo, ale efektywnie nieosiągalna z API)

- `server/migrations/562_tools_toolsets_speed.sql:435-477` (migracja **aktywna**) — pełny 9‑polowy JSON EN+PL: `shortDescription:"Translate opportunities into a quantified value pool and sequencing.", whenToUse, whatYouGet[3]=["Value pool","Sequenced roadmap","Initiative concepts"], inputs[4]=["Opportunity list","Impact hypothesis","Dependencies","Constraints/capacity"], steps[5]=["Normalize list","Estimate impact","Group themes","Sequence by dependency","Define initiatives"], outputs[3], commonMistakes[3], example:"Roadmap: data foundation → integration reliability → AI use-cases.", nextSteps[2]`. Ikona `Coins`. [REPO_CANON]
- `server/migrations/562_tools_toolsets_speed.sql:751,1239-1276` — KB `kb-art-tools-digital-value-pool`, `published`, EN+PL, uboższy wariant (tylko `Steps(5) → Next steps`).
- Zduplikowany, **NIGDY NIE ZASTOSOWANY** wariant w `server/migrations/never-ran/618_tools_missing_12_consulting_tools.sql:349-391` — inna ikona (`DollarSign`), inne sformułowanie `shortDescription`/`example` ("Digital self-service shifts 30% of support volume → €2M/yr savings"). Ten wariant nie trafił do bazy (562 uruchamiane jako pierwsze, `ON CONFLICT (id) DO NOTHING` blokuje 618) — traktować jako martwy duplikat, NIE jako dodatkowe źródło.
- **Content z 562 jest DODATKOWO martwy z perspektywy API** — identyczny mechanizm: `ACTIVE_KNOWN_TOOL_TYPES` (`KnownToolsService.ts:205-228`) nie zawiera `digital-value-pool`; `getKnownTool()` → `null`; `SQLITE_KNOWN_TOOLS_SEED` (609-621) `isComingSoon: true` (linia 620), skrócony `whatYouGetEn: ['Value pool map', 'Economic levers', 'Initiative shortlist']`; `ensureToolsSeedOnce()` nadpisuje na każdym boot.
- RV-028 test potwierdza brak Open/Start.

### 1.2 Spec dokumentu produktowego

- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:832-863` (§3.26) — **PEŁNY wizard plan**: micro-video 60s breakdown, `Define (value lens: cost/revenue/capital/quality/decision speed; scope: product line/plant/function)/Inputs & assumptions (baseline economics signals; attachments: P&L extracts, KPI boards, process metrics; consultant assumptions: benchmark levers and value ranges)/Work surface: table-first (rows=value pools, columns=lever/hypothesis/prerequisites/rough ROI range/initiative candidates)/Review (missing: baseline driver evidence + at least 3 pools + assumptions noted)/Finalize/Outputs (initiatives + deck)`. `KB: TBD` w dokumencie — nieaktualne wobec 1.1.

### 1.3 Runtime / silnik

- `src/config/agentManifests/discoveryToolsRegistry.ts:135` — `PLANNED_TOOL_IDS`, `status:'planned', steps:[]`.
- `src/store/useToolStore.ts:2747` — `TOOLSET_DIGITAL_STEPS` (generyczne kroki).
- `src/hooks/discovery/toolAi/systemPrompts.ts:204` — generyczny `OPERATIONAL_SYSTEM_PROMPT`.
- `src/components/DiscoveryTools/dedicatedToolTypes.ts:31` — w `DEDICATED_TOOL_TYPES`.
- Brak `src/config/digitalvaluepool/`. Zero implementacji tabeli "value pools" z kolumnami lever/hypothesis/prerequisites/ROI range.

### 1.4 Knowledge base

- `knowledge/tool-kb/` — zero katalogu `digital-value-pool`. [EVIDENCE_MISSING]

### 1.5 Mylący dokument

- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` §3.4 — klasyfikuje jako brakujące wyłącznie `GFX, VID`; nieaktualne wobec §1.1.

---

## 2. Czego brakuje

- **Silnik**: brak logiki grupowania w "value pools", brak metody szacowania "impact hypothesis" (baseline→target), brak logiki sekwencjonowania wg zależności.
- **Bank pytań**: zero.
- **Benchmark levers**: spec wprost wskazuje "consultant assumptions: benchmark levers and value ranges" jako wymagane wejście — nic takiego nie istnieje w repo (żadnej biblioteki typowych dźwigni cyfrowych z zakresami wartości).
- **Asset**: brak preview graphic i micro-wideo.

---

## 3. Czy istnieje wiarygodne źródło

**Tak, w ograniczonym zakresie — rozpoznana koncepcja strategy-consultingowa, ale nie ściśle skodyfikowana metoda krok-po-kroku.** "Value pool" / "digital value pool" to termin szeroko używany w literaturze strategy-consultingowej (m.in. McKinsey — koncepcja "value pools" w analizie łańcucha wartości branży i "digital value at stake" w kontekście transformacji cyfrowej; podobne podejścia publikuje BCG). To realny, cytowalny nurt myślenia strategicznego, ale bez jednej, ustandaryzowanej metody kroków (w przeciwieństwie do VSM/TOC) — różne firmy doradcze operacjonalizują go różnie. [AUTHORITATIVE_EXTERNAL_SOURCE — koncepcja "value pools" istnieje w publicznej literaturze strategy consultingowej (np. artykuły McKinsey Quarterly), ale nic z konkretnej treści/metodyki tych źródeł nie jest w repo; obecny 5-krokowy proces w Library copy to Consultify-specyficzna operacjonalizacja ogólnej idei]

---

## 4. Czego NIE WOLNO wygenerować

- Konkretnych "benchmark levers and value ranges" (np. "digital self-service = 20-30% redukcji kosztu obsługi") bez faktycznego źródła/badania — spec dokument WPROST wymaga takich danych jako wejścia, co jest szczególnie ryzykowne miejsce na fabrykację.
- Fabrykowanych kwot ROI — istniejący `example` w wersji 618 ("€2M/yr savings") jest już wymyślony/ilustracyjny, nie wolno go dalej rozszerzać ani cytować jako realny benchmark.
- Twierdzeń o pochodzeniu metody wprost od McKinsey/BCG (Consultify nie ma licencji na ich materiały) — można wspomnieć nurt myślenia jako inspirację ogólną, nie jako źródło z atrybucją firmy.

---

## 5. Minimalny Pack do authoringu

1. **`methodology/v1`**: opis koncepcji "value pool" jako uznanego nurtu strategy-consultingowego (bez przypisania konkretnej firmie), definicja 5 kroków, jasne rozgraniczenie: żadnych konkretnych "benchmark levers" bez realnych danych.
2. **`benchmarks/v1`** (opcjonalnie, jeśli Piotr dostarczy realne dane): biblioteka typowych dźwigni cyfrowych z zakresami — TYLKO jeśli oparta na realnym, przywoływalnym źródle.
3. **`qbank/v1`**: pytania do identyfikacji baseline economics, oszacowania impact hypothesis.
4. **`help/v1`**: rozbudowa `562:1239-1276` do 4 bloków.

---

## 6. Wymagany przegląd ekspercki

**TAK.** Szacowanie "value pools" i ROI wymaga doświadczenia w strategii/finansach — błędne oszacowanie prowadzi do fałszywego business case'u. [EXPERT_REVIEW_REQUIRED]

## 7. Wymagany przegląd prawny

**Warunkowo TAK** — jeśli authoring zacznie cytować konkretne dane/wykresy z publikacji McKinsey/BCG (nawet publicznie dostępnych), wymagany check cytowania/atrybucji. Sama idea "value pool" jest niechroniona.

---

## 8. Provenance tags

`REPO_CANON` · `ENGINE_DERIVED` (brak) · `AUTHORITATIVE_EXTERNAL_SOURCE` (koncepcja value pools w strategy consultingu — istnieje, nic w repo) · `EDITORIAL_DRAFT` (Library+KB) · `LEGAL_REVIEW_REQUIRED` (warunkowo, przy cytowaniu konkretnych firm) · `EXPERT_REVIEW_REQUIRED` · `EVIDENCE_MISSING` (stan bazy live niezweryfikowany; benchmark levers niezebrane).
