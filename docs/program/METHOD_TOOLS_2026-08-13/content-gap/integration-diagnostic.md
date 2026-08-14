# Content Gap Register — `integration-diagnostic` (Integration Diagnostic / Diagnostyka integracji IT)

> Wave 3 ("Operational and Automation Tools"), `is_coming_soon=1` w live registry.
> Audyt: repo `codex/method-tools-20260813` @ `3ef119c548`.

---

## 1. Co istnieje

### 1.1 Marketing / Library copy (w repo, ale efektywnie nieosiągalna z API)

- `server/migrations/562_tools_toolsets_speed.sql:392-434` (migracja **aktywna**) — pełny 9‑polowy JSON EN+PL: `shortDescription:"Find where integrations break, why, and what to fix first.", whenToUse, whatYouGet[3]=["Dependency map","Failure hotspots","Roadmap candidates"], inputs[4]=["System list","Interfaces","Data owners","SLA and incidents"], steps[5]=["Map integrations","List failures","Assess impact","Define standards","Prioritize fixes"], outputs[3], commonMistakes[3], example:"Order-to-cash: define data contract, add monitoring, remove CSV handoffs.", nextSteps[2]`. [REPO_CANON]
- `server/migrations/562_tools_toolsets_speed.sql:750,1202-1237` — KB `kb-art-tools-integration-diagnostic`, `published`, EN+PL, **najuboższy wariant KB** ze wszystkich 12: tylko `Steps(5) → Next steps` (bez Purpose/Inputs/Outputs/Common mistakes) — ~55 słów/język.
- Ten sam plik zawiera też, w treści bliźniaczej ale osobno napisanej, `server/migrations/never-ran/618_tools_missing_12_consulting_tools.sql:307-348` — **zduplikowany, ale NIGDY NIE ZASTOSOWANY** seed (plik w `never-ran/`, klasa `6XX`; wg audytu w `server/migrations/never-ran/README_6xx.md:107-110` numeracja 6XX nigdy nie pasuje do wzorca boot-runnera `/^(7\d{2}|\d{8})_.*\.sql$/`, a nawet gdyby uruchomiono ręcznie `npm run db:migrate`, INSERT z `ON CONFLICT (id) DO NOTHING` w 562 (numer niższy, uruchamiany wcześniej w kolejności) już zająłby ten sam `id`, więc treść z 618 nigdy realnie nie trafiła do bazy). Treść w 618 różni się drobnymi sformułowaniami (np. inna ikona: `Network` w 562 vs implicit różnica) — **nie traktować 618 jako dodatkowego źródła, to martwy duplikat**.
- **Content z 562 jest DODATKOWO martwy z perspektywy API** — identyczny mechanizm jak pozostałe 11: `ACTIVE_KNOWN_TOOL_TYPES` (`KnownToolsService.ts:205-228`) nie zawiera `integration-diagnostic`; `getKnownTool()` → `null` (900-902); `SQLITE_KNOWN_TOOLS_SEED` (595-607) `isComingSoon: true` (linia 606), skrócony `whatYouGetEn: ['Integration debt map', 'Architecture roadmap', 'Priority actions']`; `ensureToolsSeedOnce()` nadpisuje na każdym boot.
- RV-028 test potwierdza brak Open/Start.

### 1.2 Spec dokumentu produktowego

- `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md:798-829` (§3.25) — **PEŁNY wizard plan** (jeden z 6 Wave-3 tools z rozbudowanym briefem): micro-video 60s breakdown, `Define (scope: business capability slice; target outcomes: latency/changeability/reliability)/Inputs & assumptions (system list, interfaces, pain points, attachments: architecture diagrams/interface inventories/logs/SLA docs; consultant assumptions: integration patterns, typical failure modes)/Work surface: hybrid — workspace-first integration map (systems+connections+critical paths) + supporting interface catalog table/Review (missing: owners + criticality tags + at least 5 key interfaces)/Finalize/Outputs (initiatives + report/deck)`. `KB: TBD` w dokumencie — nieaktualne, bo KB istnieje (choć uboga) w 562.

### 1.3 Runtime / silnik

- `src/config/agentManifests/discoveryToolsRegistry.ts:134` — `PLANNED_TOOL_IDS`, `status:'planned', steps:[]`.
- `src/store/useToolStore.ts:2746` — `TOOLSET_DIGITAL_STEPS` (generyczne kroki).
- `src/hooks/discovery/toolAi/systemPrompts.ts:203` — generyczny `OPERATIONAL_SYSTEM_PROMPT`.
- `src/components/DiscoveryTools/dedicatedToolTypes.ts:30` — w `DEDICATED_TOOL_TYPES`.
- `src/views/discovery-tools/DigitalToolsView.tsx` — generyczna lista Digital.
- Brak `src/config/integrationdiagnostic/`. Zero implementacji "integration map" (workspace) albo "interface catalog" (table) ze spec dokumentu.

### 1.4 Knowledge base

- `knowledge/tool-kb/` — zero katalogu `integration-diagnostic`. [EVIDENCE_MISSING]

### 1.5 Mylący dokument

- `docs/product/KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3.md` §3.4 — klasyfikuje jako brakujące wyłącznie `GFX, VID`; nieaktualne wobec §1.1.

---

## 2. Czego brakuje

- **Silnik**: brak logiki mapowania systemów/interfejsów, brak reguł oceny "criticality"/"debt patterns" (spec wspomina "classify criticality, identify debt patterns" ale bez definicji kryteriów).
- **Bank pytań**: zero.
- **Workspace do mapy integracji**: spec wymaga "workspace-first integration map" — nie istnieje żaden odpowiednik canvas dla systemów/połączeń.
- **KB uboższy niż u innych narzędzi**: wymaga rozbudowy najpierw do poziomu równego innym Wave-3 tools (brakuje sekcji Purpose/Inputs/Outputs/Common mistakes).
- **Asset**: brak preview graphic i micro-wideo.

---

## 3. Czy istnieje wiarygodne źródło

**Rozpoznana domena praktyki architektury korporacyjnej (Enterprise Architecture), bez jednego kanonicznego frameworku dopasowanego 1:1.** Diagnostyka integracji/dług integracyjny to temat pokrywany częściowo przez uznane frameworki architektoniczne — **TOGAF** (The Open Group Architecture Framework, ma formalne etapy Architecture Development Method, w tym analizę gap/dług architektoniczny) oraz koncepcję "technical debt" (Ward Cunningham) zastosowaną do integracji. Nie ma jednak jednego, wąsko dopasowanego "Integration Diagnostic Framework" do zacytowania. [AUTHORITATIVE_EXTERNAL_SOURCE — TOGAF istnieje jako uznany, formalny standard (The Open Group), ale nic z niego nie jest w repo zaimplementowane ani zacytowane; narzędzie w obecnej formie to Consultify-specyficzna, uproszczona kompozycja]

---

## 4. Czego NIE WOLNO wygenerować

- Konkretnych progów "criticality" (np. "SLA <99% = critical") bez danych klienta.
- Fabrykowanych statystyk (istniejący `example` — "42 point-to-point links... event bus... 3 quarters" w wersji 618, i "Order-to-cash: data contract..." w wersji 562 — oba SĄ już ilustracyjne/wymyślone, nie traktować jako realny benchmark ani rozszerzać o kolejne liczby).
- Twierdzeń o formalnej certyfikacji TOGAF lub użyciu metodyki TOGAF ADM, jeśli faktycznie nie jest zaimplementowana.
- Konkretnych wzorców integracji (np. "event bus", "API gateway") jako uniwersalnej rekomendacji bez analizy kontekstu klienta.

---

## 5. Minimalny Pack do authoringu

1. **`methodology/v1`**: jasne określenie inspiracji (ogólne praktyki EA/integration-debt, ewentualnie odniesienie do TOGAF jako kontekstu, bez fałszywego przypisania certyfikacji).
2. **`qbank/v1`**: pytania z sekcji "Inputs & assumptions" spec dokumentu (§1.2) — system list, interfaces, pain points, SLA — gotowe do przełożenia na pytania.
3. **`help/v1`**: PILNE rozbudowanie najuboższego KB (`562:1202-1237`) do poziomu innych narzędzi (dodać Purpose/Inputs/Outputs/Common mistakes).
4. Jawna adnotacja: żadnych wzorców architektonicznych jako uniwersalnej rekomendacji.

---

## 6. Wymagany przegląd ekspercki

**TAK.** Ocena "integration debt" i rekomendacje architektoniczne wymagają doświadczenia w enterprise architecture/integracjach — błędna rekomendacja (np. zbyt agresywna konsolidacja) ma realne koszty wdrożeniowe. [EXPERT_REVIEW_REQUIRED]

## 7. Wymagany przegląd prawny

**Warunkowo TAK** — jeśli authoring będzie się opierał na TOGAF (dokument The Open Group, dostępny częściowo publicznie, ale z zastrzeżeniami licencyjnymi dla pełnej treści/certyfikacji), wymagany check, czy cytowanie/parafraza mieści się w dozwolonym użytku. [LEGAL_REVIEW_REQUIRED — warunkowo]

---

## 8. Provenance tags

`REPO_CANON` · `ENGINE_DERIVED` (brak) · `AUTHORITATIVE_EXTERNAL_SOURCE` (TOGAF/EA practice — istnieje, nic w repo) · `EDITORIAL_DRAFT` (Library+KB, KB najuboższy z 12) · `LEGAL_REVIEW_REQUIRED` · `EXPERT_REVIEW_REQUIRED` · `EVIDENCE_MISSING` (stan bazy live niezweryfikowany).
