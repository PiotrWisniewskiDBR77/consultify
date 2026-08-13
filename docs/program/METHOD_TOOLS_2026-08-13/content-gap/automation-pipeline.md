# Content Gap Register — `automation-pipeline` (Automation Pipeline / Pipeline automatyzacji)

> Wave 3 ("Operational and Automation Tools"), `is_coming_soon=1` w live registry.
> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`.

---

## 1. Co istnieje

### 1.1 Marketing / Library copy (w repo, ale efektywnie nieosiągalna z API)

- `server/migrations/562_tools_toolsets_speed.sql:154-196` (migracja **aktywna**) — pełny 9‑polowy JSON EN+PL: `shortDescription:"A funnel for automation: identify → qualify → prioritize → deliver.", whenToUse, whatYouGet[3]=["Automation backlog","Sizing rules","Delivery checklist"], inputs[4], steps[5]=["Identify candidates","Qualify (data/feasibility)","Size impact/effort","Prioritize","Deliver and track"], outputs[3], commonMistakes[3], example:"Build a quarterly pipeline: 30 ideas → 10 qualified → 3 delivered with measurable savings.", nextSteps[2]`. [REPO_CANON]
- `server/migrations/562_tools_toolsets_speed.sql:745,973-1033` — KB `kb-art-tools-automation-pipeline`, `published`, EN+PL, pełny wariant `Purpose → Steps(5) → Outputs → Common mistakes → Next steps`.
- **Content martwy z perspektywy API** — identyczny mechanizm: `ACTIVE_KNOWN_TOOL_TYPES` (`KnownToolsService.ts:205-228`) nie zawiera `automation-pipeline`; `getKnownTool()` → `null`; `SQLITE_KNOWN_TOOLS_SEED` (483-495) `isComingSoon: true` (linia 494), skrócony `whatYouGetEn: ['Automation backlog', 'Sizing rules', 'Delivery checklist']`; `ensureToolsSeedOnce()` nadpisuje na każdym boot.
- RV-028 test potwierdza brak Open/Start.

### 1.2 Spec dokumentu produktowego

- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:564-577` (§3.16) — **cienki** wizard plan, `KB: TBD`, 2‑liniowy Wizard plan (`Work: table + kanban (classify) + prioritization matrix`).
- Uwaga na pokrewieństwo z JUŻ ZBUDOWANYM `rpa-scanner` (`src/config/rpascanner/`, `RPA_DEEPENING_LADDER`) i `process-automation` (`src/config/processautomation/`) — oba mają realny silnik dla podobnego "funnel automatyzacji" (identify → classify → prioritize). `automation-pipeline` wygląda na szerszy/bardziej ogólny wariant tego samego wzorca — warto sprawdzić z Piotrem, czy to nie jest funkcjonalny duplikat wymagający konsolidacji, a nie osobny silnik od zera.

### 1.3 Runtime / silnik

- `src/config/agentManifests/discoveryToolsRegistry.ts:131` — `PLANNED_TOOL_IDS`, `status:'planned', steps:[]`.
- `src/store/useToolStore.ts:2741` — `TOOLSET_OPERATIONAL_STEPS` (generyczne 8 kroków).
- `src/hooks/discovery/toolAi/systemPrompts.ts:198` — generyczny `OPERATIONAL_SYSTEM_PROMPT`.
- `src/components/DiscoveryTools/dedicatedToolTypes.ts:27` — w `DEDICATED_TOOL_TYPES`.
- Brak `src/config/automationpipeline/`.

### 1.4 Knowledge base

- `knowledge/tool-kb/` — zero katalogu `automation-pipeline`. [EVIDENCE_MISSING]

### 1.5 Mylący dokument

- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` §3.2 — klasyfikuje jako brakujące wyłącznie `GFX, VID`; nieaktualne wobec §1.1.

---

## 2. Czego brakuje

- **Silnik**: brak logiki kwalifikacji/scoringu (impact/effort), brak reguł sizing, brak logiki priorytetyzacji.
- **Bank pytań**: zero.
- **Rozgraniczenie od `rpa-scanner`/`process-automation`**: brak jawnej definicji różnicy funkcjonalnej — ryzyko duplikacji.
- **Board/kanban do klasyfikacji**: spec wskazuje "table + kanban" jako work surface, ale nic w kodzie tego nie implementuje.
- **Asset**: brak preview graphic i micro-wideo.

---

## 3. Czy istnieje wiarygodne źródło

**Nie ma jednego kanonicznego, nazwanego źródła zewnętrznego.** "Automation backlog / funnel" (identify → qualify → prioritize → deliver) to ogólna praktyka zarządzania portfelem inicjatyw/backlogiem, spotykana szeroko w Agile/Product Management (np. koncepcja lejka odkrywania — discovery funnel) i w konsultingu operacyjnym (RPA/automation Center of Excellence playbooks od dostawców typu UiPath/Automation Anywhere publikują podobne lejki, ale to materiały marketingowe dostawców, nie akademickie/konsultingowe źródło kanoniczne). [Rozpoznana ogólna praktyka zarządzania backlogiem — BEZ jednego kanonicznego cytowania; bliżej Consultify-specyficznej kompozycji generycznych praktyk product/portfolio management niż jednego, nazwanego frameworku]

---

## 4. Czego NIE WOLNO wygenerować

- Konkretnych progów sizing (np. "effort <2 tygodnie = quick win") bez kontekstu klienta.
- Fabrykowanych wskaźników ROI/oszczędności — istniejący `example` ("30 ideas → 10 qualified → 3 delivered") jest już ilustracyjny, nie rozszerzać o wymyślone kwoty.
- Twierdzeń o partnerstwie z konkretnym dostawcą RPA (UiPath, Automation Anywhere, Blue Prism) bez faktycznej integracji.

---

## 5. Minimalny Pack do authoringu

1. **Decyzja produktowa PRZED authoringiem**: wyjaśnić z Piotrem relację do `rpa-scanner`/`process-automation` — czy to konsolidacja, czy faktycznie osobne narzędzie z innym zakresem (portfolio-level vs. process-level).
2. **`methodology/v1`**: opis jako lejek zarządzania backlogiem automatyzacji, bez fałszywego przypisania do jednego zewnętrznego źródła.
3. **`qbank/v1`**: pytania do identyfikacji kandydatów, kwalifikacji (dane/wykonalność), sizing.
4. **`help/v1`**: rozbudowa `562:973-1033` do 4 bloków.

---

## 6. Wymagany przegląd ekspercki

**TAK.** Kryteria kwalifikacji/sizing automatyzacji (co jest "łatwe", co "wysokiego ryzyka") wymagają doświadczenia w automatyzacji procesów — błędna kwalifikacja prowadzi do nietrafionych pilotaży. [EXPERT_REVIEW_REQUIRED]

## 7. Wymagany przegląd prawny

**Niskie ryzyko** — pod warunkiem, że authoring nie będzie sugerował formalnego partnerstwa z dostawcami RPA lub nie skopiuje 1:1 materiałów marketingowych konkretnego dostawcy.

---

## 8. Provenance tags

`REPO_CANON` · `ENGINE_DERIVED` (brak) · `EDITORIAL_DRAFT` (Library+KB — ogólna praktyka, brak jednego cytowania) · `EXPERT_REVIEW_REQUIRED` · `EVIDENCE_MISSING` (stan bazy live niezweryfikowany; relacja do `rpa-scanner`/`process-automation` niezweryfikowana z Piotrem).
