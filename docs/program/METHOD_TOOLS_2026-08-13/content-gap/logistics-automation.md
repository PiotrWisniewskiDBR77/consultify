# Content Gap Register — `logistics-automation` (Logistics Automation / Automatyzacja logistyki)

> Wave 3 ("Operational and Automation Tools"), `is_coming_soon=1` w live registry.
> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`.

---

## 1. Co istnieje

### 1.1 Marketing / Library copy (w repo, ale efektywnie nieosiągalna z API)

- `server/migrations/562_tools_toolsets_speed.sql:263-305` (migracja **aktywna**) — pełny 9‑polowy JSON EN+PL: `shortDescription:"Spot opportunities in inbound, storage, picking, packing and shipping.", whenToUse, whatYouGet[3]=["Opportunity map","Prerequisites","Initiative concepts"], inputs[4]=["Volumes and peaks","Layouts","Travel paths","Service levels and constraints"], steps[5]=["Map flows","Find hotspots","Pick solutions","Estimate impact","Define roadmap"], outputs[3], commonMistakes[3], example:"High pick travel → slotting redesign + pick-to-light + wave planning.", nextSteps[2]`. [REPO_CANON]
- `server/migrations/562_tools_toolsets_speed.sql:747,1087-1130` — KB `kb-art-tools-logistics-automation`, `published`, EN+PL, krótszy wariant (tylko `Steps(5) → Next steps`, bez Purpose/Inputs/Outputs/Common mistakes — uboższy niż KB dla `robotics-feasibility`).
- **Content martwy z perspektywy API** — identyczny mechanizm: `ACTIVE_KNOWN_TOOL_TYPES` (`KnownToolsService.ts:205-228`) nie zawiera `logistics-automation`; `getKnownTool()` → `null`; `SQLITE_KNOWN_TOOLS_SEED` (554-566) `isComingSoon: true` (linia 565), skrócony `whatYouGetEn: ['Opportunity map', 'Prerequisites', 'Roadmap']`; `ensureToolsSeedOnce()` nadpisuje na każdym boot.
- RV-028 test potwierdza brak Open/Start.

### 1.2 Spec dokumentu produktowego

- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:690-723` (§3.22) — **JEDEN Z 6 tools Wave 3 z PEŁNYM wizard planem**: micro-video 60s breakdown, `Define/Inputs & assumptions/Work surface (hybrid: table-first opportunity map + optional layout sketch)/Review (missing: volumes + constraint list + at least 3 candidate opportunities; unknowns checklist)/Finalize/Outputs (initiatives batch + deck outline)`. To jest znacznie bardziej dopracowany brief niż np. `vsm-builder` czy `control-tower` — ale nadal `KB: TBD` w tym samym dokumencie (sprzeczność z faktem, że KB istnieje w migracji — zob. §1.1; spec dokument po prostu nie został zaktualizowany po tym, jak KB zostało zaseedowane).

### 1.3 Runtime / silnik

- `src/config/agentManifests/discoveryToolsRegistry.ts:133` — `PLANNED_TOOL_IDS`, `status:'planned', steps:[]`.
- `src/store/useToolStore.ts:2743` — `TOOLSET_DIGITAL_STEPS` (generyczne kroki).
- `src/hooks/discovery/toolAi/systemPrompts.ts:200` — generyczny `OPERATIONAL_SYSTEM_PROMPT`.
- `src/components/DiscoveryTools/dedicatedToolTypes.ts:29` — w `DEDICATED_TOOL_TYPES`.
- `src/views/discovery-tools/DigitalToolsView.tsx` — generyczna lista Digital.
- Brak `src/config/logisticsautomation/`. Mimo dopracowanego briefu w spec dokumencie, ŻADEN element wizard planu (opportunity-map table, layout sketch workspace, "unknowns checklist") nie jest zaimplementowany w kodzie.

### 1.4 Knowledge base

- `knowledge/tool-kb/` — zero katalogu `logistics-automation`. [EVIDENCE_MISSING]

### 1.5 Mylący dokument

- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` §3.3 — klasyfikuje jako brakujące wyłącznie `GFX, VID`; nieaktualne wobec §1.1.

---

## 2. Czego brakuje

- **Silnik**: pomimo najlepiej opisanego wizard planu spośród 12 narzędzi (§1.2), zero rzeczywistej implementacji — brak "opportunity map" jako struktury danych, brak workspace do szkicu layoutu, brak "unknowns checklist" jako logiki review.
- **Bank pytań**: zero.
- **Reguły feasibility scoring** dla AMR/ASRS/slotting: brak jakiejkolwiek heurystyki (spec wspomina "feasibility score" w preview graphic, ale nie definiuje jak liczony).
- **Asset**: brak preview graphic i micro-wideo (choć spec ma już gotowy breakdown 60s micro-wideo — treściowo najbliżej gotowości do produkcji spośród 12 narzędzi).

---

## 3. Czy istnieje wiarygodne źródło

**Rozpoznana domena branżowa, bez jednego kanonicznego, akademickiego frameworku.** Automatyzacja intralogistyki (AMR — autonomous mobile robots, ASRS — automated storage/retrieval systems, slotting) to dojrzała domena inżynierii magazynowej z bogatą literaturą branżową (np. materiały MHI — Material Handling Industry association, publikacje Gartner/Deloitte o "warehouse automation"), ale nie ma jednego, nazwanego "frameworku" analogicznego do VSM/TOC, który dawałoby się po prostu zacytować jako metodę tego narzędzia. [Rozpoznana domena branżowa z bogatym kontekstem publicznym — BEZ jednego kanonicznego cytowania; wymagałoby researchu branżowego (np. benchmarków MHI) do nadania temu narzędziu prawdziwej wiarygodności, nie tylko ogólnej intuicji]

---

## 4. Czego NIE WOLNO wygenerować

- Konkretnych benchmarków ROI/payback dla AMR/ASRS (te dane silnie zależą od branży, wolumenu, kraju — nie wolno zmyślać).
- Fabrykowanych "typowych" wskaźników travel time / throughput bez źródła.
- Twierdzeń o partnerstwie z konkretnym dostawcą AMR/ASRS (np. Locus Robotics, AutoStore) bez faktycznej integracji.
- Rozszerzania istniejącego `example` ("High pick travel → slotting redesign...") o wymyślone liczby % poprawy.

---

## 5. Minimalny Pack do authoringu

1. **`methodology/v1`**: opis domeny (AMR/ASRS/slotting), jasne wskazanie że to synteza praktyki branżowej, nie jeden nazwany framework; ewentualne cytowanie realnych źródeł branżowych (MHI, publiczne case studies) jeśli zostaną faktycznie zebrane.
2. **`qbank/v1`**: pytania z sekcji "Inputs & assumptions" spec dokumentu (§1.2) — volumes/seasonality/SKU profile/layout — już częściowo zdefiniowane, można od razu przełożyć na pytania.
3. **`help/v1`**: rozbudowa `562:1087-1130` (obecnie najuboższy KB spośród już opisanych) do pełnych 4 bloków, korzystając z bogatszego opisu ze spec dokumentu.
4. Jawna adnotacja: brak benchmarków bez źródła.

---

## 6. Wymagany przegląd ekspercki

**TAK.** Ocena wykonalności automatyzacji magazynowej wymaga znajomości realiów operacyjnych (bezpieczeństwo, integracja z WMS, ograniczenia przestrzenne) — błędna rekomendacja może prowadzić do nietrafionych inwestycji CapEx. [EXPERT_REVIEW_REQUIRED]

## 7. Wymagany przegląd prawny

**Niskie ryzyko** — pod warunkiem braku fałszywych twierdzeń o partnerstwie z dostawcami technologii lub kopiowania materiałów marketingowych dostawców 1:1.

---

## 8. Provenance tags

`REPO_CANON` · `ENGINE_DERIVED` (brak) · `EDITORIAL_DRAFT` (Library+KB — domena branżowa, brak jednego cytowania) · `EXPERT_REVIEW_REQUIRED` · `EVIDENCE_MISSING` (stan bazy live niezweryfikowany; benchmarki branżowe niezebrane).
