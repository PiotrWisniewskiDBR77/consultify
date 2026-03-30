# Final Implementation Contract — Templaty (Position 24/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `approved(scope)` for **P24-A** (template runtime canon + ownership/permissions frozen); P24-B / P24-C not started  
Last updated: 2026-03-30 (P24-A scope closure)

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
- **Parallel template store** outside Outputs Library (P19) — templates are Outputs artifacts.
- **Redefining org branding** — brand defaults come from P30 `ResolvedOrganizationContext.profile`; templates inherit, don't redefine.
- **Parallel trust-state** — published templates carry P18 provenance stamp; no competing trust model.
- **Separate "report_templates" vs "deck_templates" stores** — one runtime, two format families.
- **Full recommendation engine** in P24-A — recommendation is P1 (P24-B bounded).

### 2.3 P24-A — Template runtime canon + ownership/permissions (single truth)

#### 2.3.1 Template payload schema (stable contract)

Templates are **runtime contracts**, not gallery items. The shared `OutputTemplate` schema is the single vocabulary for all template consumers (P21 Raporty, P20 Prezentacje, P17 ArtifactRun).

**Shared fields (all templates):**

| Field | Type | Meaning | Stability |
| --- | --- | --- | --- |
| `templateId` | string (UUID) | Unique identity | Immutable after creation |
| `scope` | enum: `user` / `org` / `app` | Ownership scope (see §2.3.2) | Set at creation; promotion changes scope |
| `format_family` | enum: `report` / `deck` | Which format runtime applies | Immutable after creation |
| `name` | string | Human-readable template name | Mutable by owner |
| `description` | string | Purpose / audience / when to use | Mutable by owner |
| `outputType` | string | Specific output type (e.g. `steering_report`, `diagnostic_deck`) | Stable; aligns with canonical report types R1–R4 and deck types |
| `structureBlueprint` | object | Section/slide structure contract (format-family-specific; see §2.3.5) | Core of the template contract; mutable by owner |
| `qualityRules` | object | Quality expectations: required sections, min/max lengths, RAG hints, citation requirements | Mutable by owner; enforced at generation |
| `brandDefaults` | object | `{ source: 'org' \| 'custom', brandColor?, accentColor?, logoUrl?, fontFamily? }` | `source: 'org'` reads from P30 at generation time; `custom` overrides are template-local |
| `audienceDefaults` | object | Default audience, goal, communication register, confidentiality | Mutable by owner |
| `sourceExpectations` | object | What source data the template expects (modules, artifact types, data shapes) | Mutable by owner |
| `generationHints` | object | AI generation guidance: tone, depth, emphasis areas | Mutable by owner |
| `sampleContentPolicy` | enum: `strip` / `anonymize` / `preserve` | How one-off content is handled in save-as-template | Set at save-as-template time |
| `metadata` | object | `{ createdBy, createdAt, updatedBy, updatedAt, version, provenanceStamp?, clonedFromTemplateId?, pairedFamilyId?, status }` | System-managed |
| `status` | enum: `draft` / `published` / `deprecated` | Lifecycle state | Governed transitions (see §2.3.3) |

**Report-specific extensions** (when `format_family = report`):

| Field | Type | Meaning |
| --- | --- | --- |
| `reportType` | string | Canonical type: `R1` / `R2` / `R3` / `R4` / custom (per `REPORTING_CANONICAL_TEMPLATES.md`) |
| `sectionBlueprint` | object | Ordered sections with requiredness, data source hints, RAG logic hints |
| `sectionRequiredness` | object | Which sections are mandatory vs optional |
| `ragLogicHints` | object | Default RAG thresholds per section (inherits from canonical R1–R4 where applicable) |
| `defaultExportModes` | string[] | Supported export formats (pdf, docx, etc.) |
| `refreshPolicy` | object | Auto-refresh cadence hints (weekly, monthly, on-demand) |

**Deck-specific extensions** (when `format_family = deck`):

| Field | Type | Meaning |
| --- | --- | --- |
| `deckType` | string | Deck type identifier (steering, diagnostic, custom) |
| `outlineBlueprint` | object | Ordered slides with intent, content hints, visual hints |
| `mustHaveIntents` | string[] | Slide intents that must appear (e.g. `executive_summary`, `key_findings`) |
| `visualHints` | object | Layout preferences, chart types, density |
| `slideCountRange` | `{ min: number, max: number }` | Acceptable slide count range |
| `speakerNotesPolicy` | enum: `required` / `optional` / `none` | Whether speaker notes are expected |

**Paired-output family** (optional grouping):

| Field | Type | Meaning |
| --- | --- | --- |
| `familyId` | string (UUID) | Groups a report template + deck template |
| `familyName` | string | e.g. "Executive Steering Pack" |
| `reportTemplateId` | string | Reference to report template |
| `presentationTemplateId` | string | Reference to deck template |
| `sharedSourceExpectations` | object | Common source data contract |
| `sharedAudienceIntent` | object | Common audience/goal |
| `promotionHints` | object | How report-to-deck or deck-to-report promotion works |

Canonical paired families (per V8 Decision W6-3): **Executive Steering Pack**, **Transformation Status Pack**, **Diagnostic / Assessment Pack**.

#### 2.3.2 Ownership + permissions model

| Scope | Who creates | Who owns | Who can edit | Who can publish | Who can deprecate | Who can delete |
| --- | --- | --- | --- | --- | --- | --- |
| **user** (personal) | Any user | The creator | The creator | N/A (personal scope = auto-published to self) | The creator | The creator |
| **org** | Admin / Owner / authorized domain lead | The organization | Admin / Owner / authorized domain lead | Admin / Owner via **review gate** (§2.3.3) | Admin / Owner | Admin / Owner (soft-delete; hard-delete = Superadmin P33) |
| **app** (system) | Platform / Superadmin (P33) | Platform | Superadmin (P33) | Superadmin via **review gate** | Superadmin (deprecate + migration hint) | Superadmin only (with audit) |

**Scope promotion rules:**
- `user` → `org`: user submits template for org review; admin/owner approves via review gate; scope changes to `org` + provenance stamp.
- `org` → `app`: only Superadmin (P33) can promote; requires review + provenance stamp.
- **No demotion**: `app` → `org` or `org` → `user` is forbidden (clone instead).

**"No silent publish" rule:** Every transition to `org` or `app` scope (or `status: published` within those scopes) **must** go through the review gate (§2.3.3). Direct writes that skip the review payload are a contract violation.

#### 2.3.3 Publish / review gate (governed flow)

**Save-as-template flow:**
1. User selects an existing output and chooses "Save as template".
2. System generates a **review payload**: extracted `structureBlueprint` + stripped content (per `sampleContentPolicy`) + `qualityRules` + `brandDefaults` + `sourceExpectations`.
3. For **user scope**: saved directly as `status: draft` (personal, no review needed).
4. For **org scope**: enters `status: draft` → reviewer (admin/owner) receives review payload → approves or requests changes → on approval: `status: published` + provenance stamp (P18).
5. For **app scope**: same as org but reviewer is Superadmin (P33).

**Provenance stamp** (P18 integration): Published templates carry trust-state metadata:
- `provenanceStamp.source`: who created / promoted
- `provenanceStamp.reviewedBy`: who approved
- `provenanceStamp.reviewedAt`: timestamp
- `provenanceStamp.publishState`: maps to P18 `publishState` vocabulary
- `provenanceStamp.validationState`: maps to P18 `validationState`

**Deprecation flow:**
1. Owner marks template `status: deprecated` with `deprecationReason` and optional `migrationHint` (pointer to replacement).
2. Deprecated templates remain visible (read-only) but excluded from selection/recommendation by default.
3. Existing outputs from deprecated templates are **not** affected.
4. Hard deletion requires Superadmin (P33) and is audit-logged.

#### 2.3.4 Integration with foundation

| Foundation | Integration rule |
| --- | --- |
| **P19 (Outputs Library)** | Templates are Outputs artifacts — live in the library, appear in Templates tab, follow queue/promotion. No parallel store. `templateId` is an `ArtifactRef`. |
| **P18 (Provenance)** | Published templates carry trust-state. Review uses P18 `publishState` / `validationState`. `approve(run) ≠ review(artifact)` applies. |
| **P30 (Organization)** | Org branding defaults from `ResolvedOrganizationContext.profile`. Templates with `brandDefaults.source: 'org'` resolve at generation time (always fresh). |
| **P27 (Tools)** | Template-driven generation is a tool surface — follows Tools canon. |
| **P31 (Settings)** | `default_export_format` applies to template-generated outputs. Template settings extend P31 registry. |

#### 2.3.5 Family convergence (report + deck)

**Rule:** One template runtime, two format families. No parallel stores.

| Aspect | Shared | Report-specific | Deck-specific |
| --- | --- | --- | --- |
| Payload schema | `OutputTemplate` shared fields | `reportType`, `sectionBlueprint`, `sectionRequiredness`, `ragLogicHints`, `defaultExportModes`, `refreshPolicy` | `deckType`, `outlineBlueprint`, `mustHaveIntents`, `visualHints`, `slideCountRange`, `speakerNotesPolicy` |
| Ownership model | Same (§2.3.2) | Same | Same |
| Publish gate | Same (§2.3.3) | Same | Same |
| Quality rules | Shared `qualityRules` field | RAG-specific thresholds | Visual density / slide count constraints |
| Brand defaults | Same `brandDefaults` field | Same | Same |
| Paired families | `PairedOutputTemplateFamily` links report + deck | Participates as `reportTemplateId` | Participates as `presentationTemplateId` |

**Convergence rule:** New capabilities for both families go in shared schema first. Format-specific extensions in respective blocks only.

#### 2.3.6 Anti-duplicate gate (extend — no parallel template truth)

| Area | Canon (path / entity) | Rule |
| --- | --- | --- |
| Template storage | Outputs Library (P19) artifact registry | Templates are Outputs artifacts; **no** parallel `template_store` or `admin_templates` table. |
| Org branding | P30 `ResolvedOrganizationContext.profile` | Templates read brand at generation time; **no** `template_branding` table. |
| Trust / provenance | P18 trust-state canon | Templates consume P18 vocabulary; **no** parallel `template_trust_v2`. |
| Report types | `docs/product/REPORTING_CANONICAL_TEMPLATES.md` (R1–R4) | Report templates reference canonical types; **no** parallel registry. |
| Template runtime SSOT | `docs/product/REPORTS_AND_PRESENTATIONS_TEMPLATE_GENERATOR_AND_LIBRARY_RUNTIME_V8.md` | §2.3 of **this** contract wins for schema/ownership/gate truth. |
| Paired families | `PairedOutputTemplateFamily` in shared schema | One family object; **no** separate stores. |
| Settings | P31 Settings registry | Template settings extend P31; **no** `template_config` table. |
| Tools | P27 Tools canon | Template selection uses Tools vocabulary; **no** parallel "template tool". |

### 2.4 Degraded / error posture

- **Template not found** (deleted or invalid `templateId`): HTTP **404** + guidance "This template is no longer available" + link to template library. If deprecated, show `migrationHint`.
- **Publish denied** (insufficient role): HTTP **403** + guidance "Only admins can publish organization templates" / "Only platform operators can publish system templates".
- **Review payload validation failed** (blueprint incomplete, rules malformed): HTTP **422** + field-level errors + fix hints (e.g. "Section 'Executive Summary' is required for R2 templates").
- **Org branding unavailable** (P30 resolver down): Generate with **system defaults** + `degraded: true` label. Template itself unaffected.
- **Provenance stamp unavailable** (P18 service down): **Block** publish for org/app scope (fail closed); user scope proceeds without stamp. Surface retry guidance.
- **Paired family incomplete** (partner missing): Allow individual template; family shows `incomplete` status with guidance.
- **Deprecated template used in generation**: Allow generation but show **info** banner with `migrationHint` link.

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

##### P24-A — Acceptance checklist (testable)

1. **Single schema**: `OutputTemplate` shared fields (§2.3.1) are defined with types and stability rules; downstream consumers (P21/P20/P17) can import this schema without ambiguity.
2. **Two families, one runtime**: Both `report` and `deck` templates use the shared `OutputTemplate` + format-specific extensions; no parallel `report_templates` / `deck_templates` stores.
3. **Three scopes defined**: `user`, `org`, `app` scopes have explicit create/edit/publish/deprecate/delete permissions in §2.3.2 table.
4. **No silent publish**: Every `org` or `app` scope publish goes through review gate (§2.3.3); contract explicitly forbids direct writes that skip review payload.
5. **Provenance stamp**: Published templates carry P18 trust-state metadata (`publishState`, `validationState`, `reviewedBy`, `reviewedAt`); no competing trust model.
6. **Brand defaults from P30**: Templates with `brandDefaults.source: 'org'` resolve brand from `ResolvedOrganizationContext.profile` at generation time; no `template_branding` cache table.
7. **Templates in Outputs**: Templates are Outputs artifacts (P19); `templateId` is an `ArtifactRef`; no parallel store outside Outputs registry.
8. **Deprecation flow**: Deprecated templates are read-only + excluded from selection; existing outputs unaffected; hard delete = Superadmin only + audit.
9. **Paired families**: Three canonical paired families defined (Executive Steering, Transformation Status, Diagnostic/Assessment); `PairedOutputTemplateFamily` is a single grouping object.
10. **Canonical report types**: Report templates reference R1–R4 from `REPORTING_CANONICAL_TEMPLATES.md`; no parallel report type registry.
11. **Anti-duplicate gate complete**: §2.3.6 covers all entity areas (storage, branding, trust, report types, runtime SSOT, families, settings, tools) with explicit "no parallel" rules.
12. **Error taxonomy complete**: §2.4 covers: not found, publish denied, validation failed, branding unavailable, provenance unavailable, family incomplete, deprecated template — each with HTTP code + guidance.

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
| P24-A | approved(scope) | `8787580d34` | N/A — scope packet | N/A — scope packet | Schema §2.3.1; ownership §2.3.2; gate §2.3.3; foundation §2.3.4; convergence §2.3.5; anti-dup §2.3.6; errors §2.4; checklist §8.1 |
| P24-B |  |  |  |  |  |
| P24-C |  |  |  |  |  |

