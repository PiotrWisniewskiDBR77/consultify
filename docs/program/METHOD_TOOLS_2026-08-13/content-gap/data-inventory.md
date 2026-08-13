# Content Gap Register — `data-inventory` (Data Asset & Gap Inventory / Inwentaryzacja danych i luk)

> Wave 3 ("Operational and Automation Tools"), `is_coming_soon=1` w live registry.
> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`.

---

## 1. Co istnieje

### 1.1 Marketing / Library copy (w repo, ale efektywnie nieosiągalna z API)

- `server/migrations/562_tools_toolsets_speed.sql:521-563` (migracja **aktywna**) — pełny 9‑polowy JSON EN+PL: `shortDescription:"A practical data catalog starter focused on owners and fitness for use.", whenToUse, whatYouGet[3]=["Source list","Ownership","Quality gaps and actions"], inputs[4]=["Systems list","Key entities","Access rules","Quality issues"], steps[5]=["List sources","Assign owners","Assess quality","Define access","Create backlog"], outputs[3], commonMistakes[3], example:"Customer entity: define master source, quality checks, and access policy.", nextSteps[2]`. [REPO_CANON]
- `server/migrations/562_tools_toolsets_speed.sql:753,1315-1352` — KB `kb-art-tools-data-inventory`, `published`, EN+PL, uboższy wariant (tylko `Steps(5) → Next steps`).
- Zduplikowany, **NIGDY NIE ZASTOSOWANY** wariant w `server/migrations/never-ran/618_tools_missing_12_consulting_tools.sql:435-477` — martwy duplikat.
- **Content z 562 jest DODATKOWO martwy z perspektywy API** — identyczny mechanizm: `ACTIVE_KNOWN_TOOL_TYPES` (`KnownToolsService.ts:205-228`) nie zawiera `data-inventory`; `getKnownTool()` → `null`; `SQLITE_KNOWN_TOOLS_SEED` (637-649) `isComingSoon: true` (linia 648), skrócony `whatYouGetEn: ['Decision→data map', 'Gap register', 'Data initiative backlog']`; `ensureToolsSeedOnce()` nadpisuje na każdym boot.
- RV-028 test potwierdza brak Open/Start.

### 1.2 Spec dokumentu produktowego

- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:899-928` (§3.28) — **PEŁNY wizard plan**: micro-video 60s breakdown, `Define (scope: decision areas + target reporting/AI needs)/Inputs & assumptions (decision catalog from interviews, current data sources, ownership/governance hints; attachments: data dictionaries, reports, extracts, system lists; consultant assumptions: "minimum viable data" and governance baseline)/Work surface: table-first mapping table (decision → required data → source → gap → owner → initiative suggestion)/Review (missing: owners + source mapping + at least N decisions mapped)/Finalize/Outputs (initiatives: data foundation/governance/instrumentation + report/deck)`. `KB: TBD` w dokumencie — nieaktualne wobec 1.1.
- **Uwaga na rozbieżność nazewnictwa Goal**: spec dokument (§3.28) opisuje Goal jako "map decisions to required data" (decision-centric), podczas gdy Library copy z migracji (`whatYouGetEn`) mówi o "Source list/Ownership/Quality gaps" (asset-centric, bardziej jak generyczny data catalog). To dwa różne akcenty tego samego narzędzia — do wyjaśnienia z Piotrem przed authoringiem, który wariant jest kanoniczny.

### 1.3 Runtime / silnik

- `src/config/agentManifests/discoveryToolsRegistry.ts:137` — `PLANNED_TOOL_IDS`, `status:'planned', steps:[]`.
- `src/store/useToolStore.ts:2749` — `TOOLSET_DIGITAL_STEPS` (generyczne kroki).
- `src/hooks/discovery/toolAi/systemPrompts.ts:206` — generyczny `OPERATIONAL_SYSTEM_PROMPT`.
- `src/components/DiscoveryTools/dedicatedToolTypes.ts:33` — w `DEDICATED_TOOL_TYPES`.
- Brak `src/config/datainventory/`. Zero implementacji "decision → required data → source → gap → owner" tabeli mapującej.

### 1.4 Knowledge base

- `knowledge/tool-kb/` — zero katalogu `data-inventory`. [EVIDENCE_MISSING]

### 1.5 Mylący dokument

- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` §3.4 — klasyfikuje jako brakujące wyłącznie `GFX, VID`; nieaktualne wobec §1.1.

---

## 2. Czego brakuje

- **Silnik**: brak logiki mapowania decyzja→dane, brak reguł oceny jakości danych, brak logiki identyfikacji luk.
- **Bank pytań**: zero.
- **Rozbieżność zakresu** (decision-centric vs. asset-centric, zob. §1.2) — wymaga rozstrzygnięcia produktowego przed jakimkolwiek authoringiem, inaczej powstanie niespójny content.
- **Asset**: brak preview graphic i micro-wideo.

---

## 3. Czy istnieje wiarygodne źródło

**Tak — istnieje uznany, publiczny standard dla całej domeny data governance.** **DAMA International's DMBOK** (Data Management Body of Knowledge) to najbardziej rozpoznawany, publicznie dostępny (książka do zakupu, ale koncepcje szeroko cytowane) framework pokrywający dokładnie ten obszar: inwentaryzację danych, ownership/stewardship, jakość danych, governance. [AUTHORITATIVE_EXTERNAL_SOURCE — DAMA-DMBOK istnieje jako uznany standard branżowy; nic z jego treści nie jest w repo zaimplementowane ani zacytowane]

Węższy, "decision-centric" akcent ze spec dokumentu (mapowanie decyzji na potrzeby danych) jest bliższy nurtowi "decision-centric data strategy" popularnemu w konsultingu data-strategy (np. koncepcje typu "decisions-first" data strategy), ale to nie jest jeden formalnie nazwany, kanoniczny framework do zacytowania — bliżej Consultify-specyficznej syntezy.

---

## 4. Czego NIE WOLNO wygenerować

- Reprodukcji definicji/klasyfikacji z DMBOK 1:1 bez wskazania źródła i sprawdzenia zakresu dozwolonego cytowania (DMBOK jest publikacją komercyjną DAMA).
- Fabrykowanych progów jakości danych (np. "kompletność <80% = problem") bez kontekstu klienta.
- Twierdzeń o certyfikacji DAMA/CDMP dla Consultify lub tego narzędzia.
- Rozszerzania istniejącego `example` ("Customer entity: define master source...") o wymyślone dane.

---

## 5. Minimalny Pack do authoringu

1. **Decyzja produktowa PRZED authoringiem**: rozstrzygnąć z Piotrem rozbieżność decision-centric vs. asset-centric (§1.2/§2).
2. **`methodology/v1`**: ugruntowanie w ogólnych zasadach data governance (inspiracja DAMA-DMBOK, bez kopiowania treści), definicja "minimum viable data" i governance baseline (spec sam wskazuje to jako wymagane "consultant assumptions" — obecnie puste).
3. **`qbank/v1`**: pytania z sekcji Inputs & assumptions spec dokumentu.
4. **`help/v1`**: rozbudowa `562:1315-1352` do 4 bloków.

---

## 6. Wymagany przegląd ekspercki

**TAK.** Data governance/ownership decisions wymagają doświadczenia w zarządzaniu danymi — błędne definicje "minimum viable data" mogą prowadzić do fałszywego poczucia gotowości danych do AI/analityki. [EXPERT_REVIEW_REQUIRED]

## 7. Wymagany przegląd prawny

**Warunkowo TAK** — jeśli authoring będzie bezpośrednio cytował/parafrazował fragmenty DMBOK, wymagany check praw autorskich DAMA International. Ogólne koncepcje data governance (ownership, quality, gaps) są niechronione.

---

## 8. Provenance tags

`REPO_CANON` · `ENGINE_DERIVED` (brak) · `AUTHORITATIVE_EXTERNAL_SOURCE` (DAMA-DMBOK — istnieje, nic w repo) · `EDITORIAL_DRAFT` (Library+KB) · `LEGAL_REVIEW_REQUIRED` (warunkowo) · `EXPERT_REVIEW_REQUIRED` · `EVIDENCE_MISSING` (stan bazy live niezweryfikowany; zakres decision-centric vs asset-centric niezweryfikowany z Piotrem).
