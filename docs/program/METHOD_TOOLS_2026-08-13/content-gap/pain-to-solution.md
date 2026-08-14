# Content Gap Register — `pain-to-solution` (Pain-to-Solution / Problem→Rozwiązanie)

> Wave 3 ("Operational and Automation Tools"), `is_coming_soon=1` w live registry.
> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`.

---

## 1. Co istnieje

### 1.1 Marketing / Library copy (w repo, ale efektywnie nieosiągalna z API)

- `server/migrations/562_tools_toolsets_speed.sql:564-606` (migracja **aktywna**) — pełny 9‑polowy JSON EN+PL: `shortDescription:"A bridge from pain points to implementable solution options.", whenToUse, whatYouGet[3]=["Solution options","Prerequisites and risks","Initiative concepts"], inputs[4]=["Pain points","Constraints","Stakeholders","Current systems"], steps[5]=["Clarify pains","Define desired outcomes","Propose options","Check feasibility","Sequence"], outputs[3], commonMistakes[3], example:"Pain: late order confirmations → solution: integration + automated confirmations + monitoring.", nextSteps[2]`. [REPO_CANON]
- `server/migrations/562_tools_toolsets_speed.sql:754,1353-1390` — KB `kb-art-tools-pain-to-solution`, `published`, EN+PL, uboższy wariant (tylko `Steps(5) → Next steps`).
- Zduplikowany, **NIGDY NIE ZASTOSOWANY** wariant w `server/migrations/never-ran/618_tools_missing_12_consulting_tools.sql:478-520` — inny display name w tym pliku ("Pain-to-Solution Mapper" vs "Pain → Solution" w 562), martwy duplikat.
- **Content z 562 jest DODATKOWO martwy z perspektywy API** — identyczny mechanizm: `ACTIVE_KNOWN_TOOL_TYPES` (`KnownToolsService.ts:205-228`) nie zawiera `pain-to-solution`; `getKnownTool()` → `null`; `SQLITE_KNOWN_TOOLS_SEED` (651-664) `isComingSoon: true` (linia 663), skrócony `whatYouGetEn: ['Pain→archetype map', 'Solution backlog', 'Feasibility notes']` — **UWAGA: ten skrócony tekst różni się merytorycznie od pełnego opisu w 562** ("Pain→archetype map" vs. "Solution options" — sugeruje inny model danych: archetypy rozwiązań vs. luźne opcje); `ensureToolsSeedOnce()` nadpisuje na każdym boot.
- RV-028 test potwierdza brak Open/Start.

### 1.2 Spec dokumentu produktowego

- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:931-961` (§3.29) — **PEŁNY wizard plan**: micro-video 60s breakdown, `Define (scope: domain + target outcomes)/Inputs & assumptions (structured pains ideally from Pain Explorer tool/interviews; constraints: integration/security/process change readiness; consultant assumptions: solution archetypes and selection heuristics)/Work surface: hybrid — table-first mapping (pain → solution class → technology archetype → prerequisites) + optional cards view for "solution archetypes"/Review (missing: pain statement quality + constraints + at least 3 mappings)/Finalize/Outputs (initiatives: solution pilots + deck/report)`. Explicite wspomina zależność od `pain-explorer` (narzędzie JUŻ ZBUDOWANE, `src/config/painexplorer/`, `PAIN_DEEPENING_LADDER`) jako naturalnego wejścia — sensowna kolejność budowy: `pain-to-solution` mogłoby konsumować wyjście z `pain-explorer`. `KB: TBD` w dokumencie — nieaktualne wobec §1.1.

### 1.3 Runtime / silnik

- `src/config/agentManifests/discoveryToolsRegistry.ts:138` — `PLANNED_TOOL_IDS`, `status:'planned', steps:[]`.
- `src/store/useToolStore.ts:2750` — `TOOLSET_DIGITAL_STEPS` (generyczne kroki).
- `src/hooks/discovery/toolAi/systemPrompts.ts:207` — generyczny `OPERATIONAL_SYSTEM_PROMPT`.
- `src/components/DiscoveryTools/dedicatedToolTypes.ts:34` — w `DEDICATED_TOOL_TYPES`.
- Brak `src/config/paintosolution/`. Zero implementacji "pain → solution class → technology archetype" mapping table ani "solution archetypes" cards view. Brak jakiegokolwiek połączenia z `pain-explorer` na poziomie kodu (mimo że spec dokument sugeruje tę zależność).

### 1.4 Knowledge base

- `knowledge/tool-kb/` — zero katalogu `pain-to-solution`. [EVIDENCE_MISSING]

### 1.5 Mylący dokument

- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` §3.4 — klasyfikuje jako brakujące wyłącznie `GFX, VID`; nieaktualne wobec §1.1.

---

## 2. Czego brakuje

- **Silnik**: brak logiki mapowania pain→solution class→archetype, brak katalogu "solution archetypes" (spec wprost wymaga tego jako "consultant assumptions: solution archetypes and selection heuristics" — nic takiego nie istnieje w repo).
- **Bank pytań**: zero.
- **Integracja z `pain-explorer`**: spec sugeruje zależność, kod jej nie realizuje — do zaprojektowania jako pierwsza decyzja architektoniczna.
- **Niespójność między pełnym opisem (562) a skróconym seedem (`KnownToolsService.ts`)** — "solution options" vs. "pain→archetype map" (§1.1) — do ujednolicenia przed authoringiem.
- **Asset**: brak preview graphic i micro-wideo.

---

## 3. Czy istnieje wiarygodne źródło

**Nie — najsłabiej ugruntowane z 12 narzędzi.** "Pain-to-Solution" mapping (pain → solution class → technology archetype) nie odpowiada żadnemu jednemu, publicznie znanemu, nazwanemu frameworkowi konsultingowemu. Jest to najbliższe ogólnej praktyce **problem-solution fit** znanej z Lean Startup / Design Thinking (np. "Value Proposition Design" Osterwaldera — tam też mapuje się "pains" na "pain relievers"), ale operacjonalizacja w postaci "solution archetype cards" i "technology archetype" jest Consultify-specyficzną kompozycją, nie bezpośrednim zastosowaniem jednej metody. [Brak jednego autorytatywnego źródła zewnętrznego — najbliższa analogia to Value Proposition Canvas (Osterwalder, "Value Proposition Design", 2014), luźno powiązana koncepcyjnie ("pains"→"relievers"), ale narzędzie NIE jest wdrożeniem tej metody]

---

## 4. Czego NIE WOLNO wygenerować

- Katalogu "solution archetypes" z konkretnymi nazwami technologii/dostawców jako uniwersalnej rekomendacji bez kontekstu klienta.
- Twierdzeń, że to wdrożenie Value Proposition Canvas Osterwaldera (nie jest, tylko luźno inspirowane) — nie podpisywać się pod cudzą markę metody.
- Fabrykowanych "selection heuristics" (reguł wyboru archetypu) bez podstawy w realnej praktyce — spec sam mówi, że te heurystyki są "consultant assumptions", czyli mają pochodzić od praktyka, nie być zmyślone przez AI.
- Rozszerzania istniejącego `example` ("Pain: late order confirmations...") o wymyślone dodatkowe scenariusze prezentowane jako uniwersalne wzorce.

---

## 5. Minimalny Pack do authoringu

1. **Decyzja produktowa PRZED authoringiem**: (a) ujednolicić opis z §1.1 (solution options vs. pain→archetype), (b) rozstrzygnąć z Piotrem, czy `pain-to-solution` ma faktycznie konsumować output z `pain-explorer` (silnik już istnieje) czy działać niezależnie.
2. **`methodology/v1`**: jasne stwierdzenie, że to Consultify-specyficzna heurystyka inspirowana ogólną praktyką problem-solution fit (nie nazwany framework zewnętrzny), z jawnym rozgraniczeniem od Value Proposition Canvas.
3. **Katalog "solution archetypes"**: TO jest kluczowy brakujący element — bez niego narzędzie nie ma żadnej realnej treści do prowadzenia użytkownika. Wymaga zebrania od praktyka (Piotra lub eksperta domenowego), nie generowania przez AI.
4. **`qbank/v1`**: pytania do klaryfikacji pain (kto odczuwa, jak często, jaki koszt) + pytania do sprawdzenia feasibility opcji.
5. **`help/v1`**: rozbudowa `562:1353-1390` do 4 bloków.

---

## 6. Wymagany przegląd ekspercki

**TAK, wysoki priorytet.** To narzędzie, ze wszystkich 12, ma najsłabszą podstawę metodologiczną — bez solidnego katalogu "solution archetypes" i reguł wyboru od praktyka, ryzyko wygenerowania płytkiej/losowej treści jest największe. [EXPERT_REVIEW_REQUIRED — wysoki priorytet]

## 7. Wymagany przegląd prawny

**Niskie ryzyko formalnie**, ALE wymagana czujność, by nie przypisywać narzędzia do Value Proposition Canvas / Osterwaldera bez faktycznego wdrożenia tej metody (ryzyko wprowadzającego w błąd marketingu, nie praw autorskich sensu stricto).

---

## 8. Provenance tags

`REPO_CANON` · `ENGINE_DERIVED` (brak) · `EDITORIAL_DRAFT` (Library+KB, wewnętrznie niespójne między źródłami) · `EXPERT_REVIEW_REQUIRED` (wysoki priorytet) · `EVIDENCE_MISSING` (stan bazy live niezweryfikowany; katalog solution archetypes nie istnieje nigdzie w repo; zależność od `pain-explorer` niezweryfikowana z Piotrem).
