# Final Implementation Contract — Templaty (Position 24/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (shared-sourced contract; dedicated template contract may be extracted)

## 1. Executive summary
- **Intent**: Templates dla raportów i prezentacji; przeniesienie pełnej funkcji z admin do Outputs: zakładka Templaty + generator + user templates + app templates.
- **Primary users**: użytkownicy tworzący raporty/prezentacje; operatorzy utrzymujący app templates.
- **Success metric**: template = kontrakt (struktura + intent + rules), a nie tylko „ładny wybór”; templates żyją w Outputs i działają w generatorze.

## 2. Scope
### 2.1 In-scope
- Template library: user + app templates.
- Template-driven generation dla raportów i prezentacji.
- Migracja/relokacja funkcji z admin do Outputs (bez łamania governance).

### 2.2 Out-of-scope / non-goals
- Budowa pełnego buildera office suite przed stabilizacją artifact family.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Shared source plan: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_FULL_REPORTS_PRESENTATIONS_BUILDER_2026-03-29.md`
- Related format runtimes:
  - `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PRESENTATIONS_2026-03-29.md`
  - `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md`
  - `docs/product/PREZENTACJE_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Template runtime SSOT (reports + presentations jako jedna warstwa “output OS”):
  - `docs/product/REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md`
  - `docs/product/REPORTING_CANONICAL_TEMPLATES.md`

### 4.2 Local Softs evidence (concrete artifacts)
- **Gamma (template/theme/folder jako first-class API surfaces)**:
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/reference/create-from-template.html` (create-from-template).
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/docs/create-from-template-parameters-explained.html` (parametry create-from-template).
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/reference/list-themes.html` + `.../reference/list-folders.html` (themes/folders jako obiekty biblioteki).
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/docs/list-themes-and-list-folders-apis-explained.html` (listing/pagination posture).
- **Pitch (templates + styles jako workflow i admin/posture)**:
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/4056913-find-and-use-templates.html` (find/use templates).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/3752837-create-a-template.html` (create template).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/3853803-move-a-template-to-another-workspace.html` (ownership/workspace move).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/4059534-create-your-own-slide-style.html` (styles jako część brand discipline).
- **Beautiful.ai (team templates + theming/branding discipline)**:
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/4405716068365-Team-Template-Overview.html` (team templates posture).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/360048192991-Team-Theme-Overview.html` (team theme / branding posture).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “template = kontrakt outputu + governed reuse”, nie “ładna galeria bez semantyki”.**

- **Template as a first-class object (Gamma/Pitch)**:
  - Templates mają identity, preview, folder/collections, i wspierają create-from-template (nie tylko “clone deck”).
- **Scopes/ownership (Pitch move workspace + SSOT)**:
  - System/app templates ≠ org templates ≠ personal drafts (brak masquerading).
  - Ownership i permissions są jawne (kto może publikować/edytować).
- **Template quality discipline (Beautiful.ai + SSOT)**:
  - Template zawiera structure blueprint + brand defaults + quality rules (nie tylko theme).
- **Save-as-template doctrine (SSOT)**:
  - “Zapisz jako template” to governed flow: stripping one-off content, zachowanie struktury i reguł.
- **Source-aware recommendation (SSOT)**:
  - Generator rekomenduje template na podstawie source/audience, ale user jest decider.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current contract + SSOT)
Źródło prawdy: `REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md` (sekcje “MISSING”, P0/P1).

| Capability cluster (parity target) | What Softs implies | Current truth (contract) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Shared template runtime | one vocabulary | “migracja z admin do Outputs” | Domknąć jedną runtime warstwę dla report+deck templates | P0 |
| Save-as-template | governed extraction | (nieudowodnione) | Zbudować save-as-template z review payload (no silent publish) | P0 |
| Recommendation | context-aware | (nieudowodnione) | Dodać source/audience-based rekomendacje + user accept | P1 |
| Trust/QA | template quality gated | (niezdefiniowane) | Template QA + trust metadata jako first-class | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Templates są widoczne w `Outputs` i działają jako “contract” (structure + defaults + rules), nie tylko galeria.
- User templates i app templates mają jasne ownership + permissions (publish/edit).
- Generator używa template jako kontraktu: template-first + source-first recommendation (bounded).

### 5.2 Tests
- Integracyjne: browse templates → choose template → inspect fit → generate report/deck → reopen/continue → save-as-template (bounded) → reuse.
- Regression: org/personal scope confusion → UI/permissions nie pozwalają na “masquerading”.
- Contract tests: template payload schema (id, scope, blueprint, quality rules, brand defaults) stabilny.

### 5.3 Staging proof checklist
- Demo: template-first generation dla 1 report + 1 deck (ten sam template family, jeśli zadeklarowane).
- Demo: save output as template → review payload → publish to org scope → reuse przez innego usera.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (template runtime SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P24-A — Template runtime canon + ownership/permissions (scope approval)
- **Goal**: templates jako runtime kontrakt (structure+defaults+rules) z jasnym ownership (user/org/app).
- **Inputs required**: permissions model + publish/review posture; rodzina report+deck templates.
- **Acceptance**: scope zatwierdzony; non-goals jawne; “no silent publish” zasada spisana.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze template payload schema (id/scope/blueprint/quality rules/brand defaults).
  - Freeze ownership+permissions model (user/org/app) + publish/review gate (no silent publish).
  - Freeze family convergence rules for report+deck templates (bounded).
- **DoD**:
  - Approved(scope): templates are runtime contracts (not gallery) and publish is governed.

#### P24-B — Template-first generation + save-as-template closure
- **Goal**: choose template→generate→reopen/continue→save-as-template→review→publish→reuse.
- **Acceptance**: org/personal scopes nie mieszają się; generator respektuje template kontrakt.
- **Evidence**: integracyjne testy + staging demo publish+reuse.
- **Tasks**:
  - Implement choose→generate→reopen/continue flow for 1 report + 1 deck (bounded).
  - Implement save-as-template with review payload and publish to org; enforce scopes.
  - Add integration/regression tests and run publish+reuse staging demo (5.3).
- **Staging proof script (click-by-click)**:
  1. Browse templates, select one, inspect fit, and generate a report (template-first).
  2. Reopen/continue the output; verify template id and structure persist.
  3. Save output as template; review payload; publish to org scope (no silent publish).
  4. Switch user (or simulate another member) and reuse the published template; verify permissions/scope enforcement.
- **DoD**:
  - Templates are reusable across users (org scope) with governed publish; scopes are enforced.

#### P24-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P24-A/B/C.
  - Validate rollback: disable publish; preserve browse+generate.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw browse+select+generate, potem save-as-template/publish (P0) i rekomendacje (P1).

### 8.3 Rollback plan
- Wyłącz publish; zachowaj browse+generate; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: templates jako galeria (bez runtime kontraktu).
- Ryzyko: scope confusion (org vs personal) → incydenty.
- Decyzje: minimalny zestaw quality rules i trust metadata.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P24-A |  |  |  |  |  |
| P24-B |  |  |  |  |  |
| P24-C |  |  |  |  |  |

