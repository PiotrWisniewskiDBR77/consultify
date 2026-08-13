# Content Gap Register — `control-tower` (Shopfloor Control Tower / Wieża kontroli)

> Wave 3 ("Operational and Automation Tools"), `is_coming_soon=1` w live registry.
> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`.

> **Pułapka homonimu**: repo zawiera DRUGI, całkowicie NIEZWIĄZANY byt o nazwie "control tower" —
> `server/src/routes/v8/execution-control.routes.ts`, `src/services/api/v8/execution-control.ts`,
> `evidence/85-v8-execution-control-tower-summary-proof.md`, `Harvard/wdrozenie-100/M14-*` —
> to jest **moduł Realizacja/Execution V8** ("Wieża kontroli" jako widok dashboardu wykonania
> inicjatyw), NIE ma nic wspólnego z Discovery Tool `control-tower` (toolType) z tego rejestru.
> Nie mylić przy dalszej pracy — 76 trafień grep na frazę "control-tower" w repo, większość to ten
> inny moduł.

---

## 1. Co istnieje

### 1.1 Marketing / Library copy (w repo, ale efektywnie nieosiągalna z API)

- `server/migrations/562_tools_toolsets_speed.sql:111-153` (migracja **aktywna**) — pełny 9‑polowy JSON EN+PL: `shortDescription:"A practical blueprint for daily/weekly operational control.", whenToUse, whatYouGet[3]=["KPI set","Thresholds and alerts","Operating cadence"], inputs[4], steps[5]=["Define outcomes","Pick KPIs","Set thresholds","Assign owners","Set meeting cadence"], outputs[3], commonMistakes[3], example:"OTIF control tower: daily board + threshold-based escalation + root-cause routine.", nextSteps[2]`. [REPO_CANON]
- `server/migrations/562_tools_toolsets_speed.sql:744,911-971` — KB `kb-art-tools-control-tower`, `published`, EN+PL, pełny wariant `Purpose → Steps(5) → Outputs → Common mistakes → Next steps`.
- **Content martwy z perspektywy API** — identyczny mechanizm co poprzednie: `ACTIVE_KNOWN_TOOL_TYPES` (`KnownToolsService.ts:205-228`) nie zawiera `control-tower`; `getKnownTool()` → `null` (900-902); `SQLITE_KNOWN_TOOLS_SEED` (469-481) `isComingSoon: true` (linia 480), skrócony `whatYouGetEn: ['KPI set', 'Thresholds', 'Operating cadence']`; `ensureToolsSeedOnce()` nadpisuje na każdym boot.
- RV-028 test potwierdza brak Open/Start.

### 1.2 Spec dokumentu produktowego

- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:612-625` (§3.19) — **cienki** wizard plan, `KB: TBD`, 2‑liniowy Wizard plan (`Work: hybrid (board of metrics + protocol checklist)`). Zwraca uwagę bliskie pokrewieństwo z `dms-builder` (Daily Management System — narzędzie JUŻ zbudowane, `src/config/dmsbuilder/`) — DMS Builder ma pełną specyfikację (§3.15, `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:524-560`) z "Avoid: jeśli tylko potrzebujesz definicji KPI (użyj Control Tower); DMS to cadence + governance" — czyli spec sam wskazuje `control-tower` jako węższe, siostrzane narzędzie do DMS. Warto authoring robić w koordynacji z istniejącym `DMS_DEEPENING_LADDER` (`src/config/dmsbuilder/deepeningLadder.ts`) zamiast od zera.

### 1.3 Runtime / silnik

- `src/config/agentManifests/discoveryToolsRegistry.ts:130` — `PLANNED_TOOL_IDS`, `status:'planned', steps:[]`.
- `src/store/useToolStore.ts:2740` — `TOOLSET_OPERATIONAL_STEPS` (generyczne 8 kroków).
- `src/hooks/discovery/toolAi/systemPrompts.ts:197` — generyczny `OPERATIONAL_SYSTEM_PROMPT`.
- `src/components/DiscoveryTools/dedicatedToolTypes.ts:26` — w `DEDICATED_TOOL_TYPES`.
- Brak `src/config/controltower/`. Uwaga: `src/services/api/v8/execution-control.ts` istnieje, ale to inny moduł (zob. ostrzeżenie u góry) — nie mylić z toolType.

### 1.4 Knowledge base

- `knowledge/tool-kb/` — zero katalogu `control-tower`. [EVIDENCE_MISSING]

### 1.5 Mylący dokument

- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` §3.2 — klasyfikuje jako brakujące wyłącznie `GFX, VID`; nieaktualne wobec §1.1.

---

## 2. Czego brakuje

- **Silnik**: brak logiki definiowania progów KPI, reguł eskalacji, cadence — `steps[5]` to lista nazw, nie działający wizard.
- **Bank pytań**: zero.
- **Rozgraniczenie od `dms-builder`**: brak jasnej granicy w kodzie (spec dokumentu ją sugeruje słownie, ale nic nie wymusza tego programowo) — ryzyko duplikacji pracy/zamieszania przy authoringu.
- **Reguły eskalacji**: brak jakiejkolwiek reprezentacji "if threshold breached → who/when/what action" jako struktury danych.
- **Asset**: brak preview graphic i micro-wideo.

---

## 3. Czy istnieje wiarygodne źródło

**Nie ma jednego kanonicznego, nazwanego źródła zewnętrznego** (w przeciwieństwie do VSM/TOC). "Operational/shopfloor control tower" to rozpoznawalny **wzorzec branżowy** stosowany szeroko w consultingu operacyjnym i supply chain (np. w literaturze o "manufacturing control towers", "logistics control towers" — termin używany przez firmy doradcze i dostawców oprogramowania SCM), zbudowany na starszych, dobrze udokumentowanych praktykach: tiered daily management / gemba walks / KPI cascade (te praktyki mają korzenie w Lean Management, podobnie jak DMS). Nie ma jednak jednej książki/autora, którego można by zacytować tak jak Goldratta dla TOC. [Rozpoznany wzorzec branżowy, BEZ jednego kanonicznego cytowania — bliżej Consultify-specyficznej syntezy ogólnych praktyk zarządzania operacyjnego niż jednego, formalnego frameworku]

---

## 4. Czego NIE WOLNO wygenerować

- Konkretnych wartości progowych KPI (np. "OTIF <95% = alert") bez danych klienta — istniejący `example` ("OTIF control tower...") jest już ilustracyjny, nie wolno go rozszerzać o wymyślone liczby.
- Fabrykowanej listy "typowych KPI dla branży X" bez źródła.
- Twierdzeń o formalnej metodyce/certyfikacji "Control Tower" — nie istnieje jeden uznany standard do zacytowania.

---

## 5. Minimalny Pack do authoringu

1. **Decyzja produktowa PRZED authoringiem**: ustalić z Piotrem faktyczne rozgraniczenie `control-tower` vs `dms-builder` (czy to jeden silnik z dwoma wejściami, czy dwa osobne) — inaczej ryzyko zdublowanej pracy.
2. **`methodology/v1`**: opis jako wzorzec operacyjny (cadence + KPI + eskalacja), bez fałszywego przypisania do jednego zewnętrznego źródła; jawne odróżnienie od DMS.
3. **`qbank/v1`**: pytania do definiowania outcomes, KPI, progów, ownerów, reguł eskalacji.
4. **`help/v1`**: rozbudowa `562:911-971` do 4 bloków.

---

## 6. Wymagany przegląd ekspercki

**TAK.** Dobór KPI/progów/cadence dla realnego klienta wymaga doświadczenia operacyjnego — błędny dobór (np. zbyt wiele KPI, brak jasnych escalation rules) jest jawnie wymieniony jako "Common mistake" w istniejącym Library copy, co samo w sobie sugeruje, że to nietrywialne. [EXPERT_REVIEW_REQUIRED]

## 7. Wymagany przegląd prawny

**Niskie ryzyko.** Brak jednego chronionego źródła do naruszenia — ryzyko tylko przy fałszywym przypisaniu do konkretnej metodyki/certyfikacji, której narzędzie faktycznie nie implementuje.

---

## 8. Provenance tags

`REPO_CANON` · `ENGINE_DERIVED` (brak) · `EDITORIAL_DRAFT` (Library+KB — wzorzec branżowy bez jednego cytowania) · `EXPERT_REVIEW_REQUIRED` · `EVIDENCE_MISSING` (stan bazy live niezweryfikowany; granica z `dms-builder` niezweryfikowana z Piotrem).
