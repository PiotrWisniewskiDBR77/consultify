# Final Implementation Contract — Raporty (Position 21/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: **P21-A** `approved(scope)` (scope closure); **P21-B** `delivered` (runtime + tests); P21-C not started  
Last updated: 2026-03-30 (P21-B runtime evidence-first closure)

## 1. Executive summary
- **Intent**: Gamma‑like raporty: template-first deliverable artifact with evidence pointers, governed generation, and honest degraded posture.
- **Primary users**: konsultanci/PMO tworzący raporty dla klienta/management.
- **Success metric**: raport jako trwały dokument-artefakt z template-first create, sources/citations posture, approve(run) ≠ review(artifact), reopen/continue, review/export i traceability.
- **P21-A scope**: Report artifact schema + template-first flow + sources/citations posture + degraded/no-web rules + integration with P24/P19/P18/P30/P27 + boundary with Wordy (P22) — all frozen.

## 2. Scope
### 2.1 In-scope
- Raporty jako user-facing pozycja odrębna od ogólnego `Documents` (kontrakt zachowania).
- Template-first generation wpięta w artifact family (run→artifact→library).

### 2.2 Out-of-scope / non-goals
- Pełny „reports builder” (to osobna pozycja/ambicja w rodzinie builder).

- **Parallel template store** — reports use P24 `OutputTemplate` with report-specific extensions; no `report_templates` table.
- **Parallel Outputs Library** — report artifacts land in P19; no second artifact registry.
- **Parallel provenance system** — reports carry P18 trust-state; no competing trust model.
- **Parallel "documents" product** — Reports and Wordy (P22) share Outputs Library runtime but are separate product lanes.
- **Full web-research product** — web/search is a tool in the generation plan, not an open-ended research suite.

### 2.3 P21-A — Report template-first canon + sources posture (single truth)

#### 2.3.1 Report artifact schema

A report artifact **extends** `OutputTemplate` (P24 §2.3.1) with report-specific extensions plus report-instance fields.

**Report artifact fields (beyond template):**

| Field | Type | Meaning | Stability |
| --- | --- | --- | --- |
| `artifactId` | string (UUID) | Unique artifact identity (= `ArtifactRef` in P19) | Immutable |
| `templateId` | string (UUID) | **Mandatory** — which template was used (P24) | Immutable after generation |
| `reportType` | string | Inherited from template: `R1`/`R2`/`R3`/`R4`/custom | Immutable after generation |
| `generationPlan` | object | `{ steps[]: { stepId, tool, input_summary, status, output_summary }, tools_used[], model_used, started_at, completed_at }` | System-managed; append-only during run |
| `sourcesLedger` | array | `[{ sourceId, url, title, domain, retrieved_at, confidence, snippet?, used_in_sections[] }]` | Append-only during generation |
| `degradedFlags` | object | `{ no_web?, tool_error?, rate_limited?, model_fallback?, partial_sections? }` | Set during generation; read-only after |
| `parameters` | object | User-set: `{ audience, scope, depth, language, confidentiality, custom_instructions? }` | Immutable after approve(run) |
| `runApproval` | object | `{ approvedBy, approvedAt, planVersion }` | Immutable |
| `artifactReview` | object | `{ reviewState, reviewedBy?, reviewedAt?, comments? }` (P18 vocabulary) | Mutable via review flow |
| `exportLedger` | array | `[{ exportId, format, exportedBy, exportedAt, destination? }]` | Append-only |
| `provenanceStamp` | object | P18 trust-state metadata | System-managed |

**Relationship chain:** `report artifact` -> `templateId` -> `OutputTemplate` (P24) -> Outputs Library (P19) -> provenance stamp (P18).

#### 2.3.2 Template-first flow (step by step)

| Step | Actor | Action | System behavior | Gate |
| --- | --- | --- | --- | --- |
| 1. **Select template** | User | Browse/search P24 template library (report family) | Show preview: blueprint, audience defaults, source expectations | — |
| 2. **Set parameters** | User | Set audience, scope, depth, language, confidentiality | Validate against template `sourceExpectations` and `qualityRules` | Validation gate |
| 3. **Generate plan** | System | Build `generationPlan`: ordered steps (data retrieval, web search, section generation, quality check) | Show plan with tools, estimated time, data sources | — |
| 4. **Approve(run)** | User | Review plan and approve execution | Record `runApproval`. **This is NOT artifact review.** | **approve(run)** |
| 5. **Execute generation** | System | Run plan: fetch data, search web, generate sections, apply brand (P30), quality checks | Populate `sourcesLedger`, `degradedFlags`. If web unavailable -> degraded path (§2.3.4) | — |
| 6. **Land in Outputs** | System | Create artifact in P19 with `templateId`, `provenanceStamp`, full metadata | Visible in library; trust badges from P18 | — |
| 7. **Reopen/continue** | User | Open, edit sections, add context, refine | Changes tracked; version incremented; `sourcesLedger` preserved | — |
| 8. **Review(artifact)** | Reviewer | Review quality, sources, completeness | Record `artifactReview` using P18 vocabulary. **This is NOT approve(run).** | **review(artifact)** |
| 9. **Export** | User | Export to PDF/DOCX/etc. | Record in `exportLedger`; apply brand from P30 | — |

**Invariant: approve(run) ≠ review(artifact)** — per P18 §2.5. UI, API, and tests must never conflate these axes.

#### 2.3.3 Sources / citations posture

| Rule | Description |
| --- | --- |
| **Evidence pointers mandatory** | If generation uses web/search: every factual claim from external sources **must** have `sourcesLedger` entry with `url`, `title`, `retrieved_at` |
| **Confidence levels** | `verified` — cross-referenced with 2+ sources; `unverified` — found but not cross-checked; `no_source` — model knowledge only |
| **No overclaim** | If `confidence < verified`, section **must** include limitation text (e.g. "Based on unverified sources") |
| **Sources ledger = auditable** | Part of artifact metadata; reviewers/auditors can inspect full evidence chain |
| **Section-level attribution** | Each entry includes `used_in_sections[]` |
| **Stale source warning** | If `retrieved_at` > configurable threshold (default 30 days), show "Source may be outdated" |

**Confidence resolution:** Tool returns source with URL -> `verified` if cross-referenced, `unverified` otherwise. No source -> `no_source` + limitation text. Web unavailable -> all web claims `no_source` + `degradedFlags.no_web`.

#### 2.3.4 Degraded / no-web posture

| Scenario | `degradedFlags` | User-visible behavior | Artifact state |
| --- | --- | --- | --- |
| **Web unavailable** | `{ no_web: true }` | Banner: "Generated without web sources. Claims based on available data only." | Safe draft; clearly labeled |
| **Tool error** | `{ tool_error: ['tool_name'] }` | Banner: "Some steps failed. Affected sections may be incomplete." + failed steps list | Partial; sections marked |
| **Rate limited** | `{ rate_limited: true }` | Queue with ETA or fallback to cached sources + degraded label | Queued or partial |
| **Model unavailable** | `{ model_fallback: 'name' }` or fail | Fallback model + label, or clear error "Generation temporarily unavailable" | Fallback or no artifact |

**Rule:** No degraded report may overclaim. Missing sources or failed tools -> artifact must be honest. Silent success with fabricated sources is a contract violation.

#### 2.3.5 Integration with foundation

| Foundation | Integration rule |
| --- | --- |
| **P24 (Templates)** | Report uses `OutputTemplate` + report extensions; `templateId` mandatory; template defines blueprint, quality rules, brand defaults |
| **P19 (Outputs Library)** | Report lands in library; follows queue semantics; `artifactId` = `ArtifactRef`; no parallel store |
| **P18 (Provenance)** | `provenanceStamp` + `sourcesLedger` feed provenance; `approve(run) ≠ review(artifact)` enforced; trust badges from P18 only |
| **P30 (Organization)** | Brand from `ResolvedOrganizationContext.profile` at generation + export; no local cache |
| **P27 (Tools)** | Generation tools follow Tools canon; `generationPlan.tools_used` references P27 tool IDs |

#### 2.3.6 Boundary with Wordy (P22)

| Aspect | Reports (P21) | Wordy (P22) |
| --- | --- | --- |
| **Creation** | Template-first (mandatory `templateId`) | KIMI-style freeform / net-new |
| **Structure** | Blueprint-driven sections from template | User-defined or AI-suggested |
| **Sources** | `sourcesLedger` mandatory if web used; confidence; no overclaim | TBD in P22-A |
| **Governance** | approve(run) + review(artifact) + provenance | TBD in P22-A |
| **Shared** | Both in Outputs Library (P19); both carry P18 trust-state | Same |
| **Rule** | Separate product lanes, separate contracts, shared infrastructure | Same |

#### 2.3.7 Anti-duplicate gate

| Area | Canon | Rule |
| --- | --- | --- |
| Templates | P24 `OutputTemplate` + report extensions | **No** parallel `report_templates` |
| Outputs | P19 artifact registry | **No** `report_artifacts` parallel store |
| Provenance | P18 trust-state | **No** `report_trust_v2` |
| Branding | P30 resolved context | **No** `report_branding` cache |
| Report types | `REPORTING_CANONICAL_TEMPLATES.md` (R1-R4) | **No** parallel registry |
| Documents runtime | Shared with Wordy (P22) | **No** merging into single product that erases lane boundaries |
| Tools | P27 | **No** parallel "report tools" |
| Wave2 SSOT | `WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md` | §2.3 of this contract wins for report truth |

### 2.4 Degraded / error posture

- **Template not found**: HTTP **404** + guidance + `migrationHint` from P24 if deprecated.
- **Generation plan rejected** (user declines): No artifact; plan discarded; no side effects.
- **Parameter validation failed**: HTTP **422** + field-level errors + fix hints.
- **Sources unavailable**: Generate safe draft with `degradedFlags` + banner (§2.3.4). **Never** fabricate sources.
- **Export failed**: HTTP **500** + retry guidance + audit entry. Artifact unaffected.
- **Provenance unavailable** (P18 down): **Block** review(artifact) (fail closed); generation proceeds but promotion blocked until recovery.
- **Rate limited / model unavailable**: Per §2.3.4.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Shared source plan: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md`
- Related: `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_FULL_REPORTS_PRESENTATIONS_BUILDER_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Raporty są kontraktem “template-first report artifact” opartym o wspólną rodzinę `Documents` + artifact family (`WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md` + `WAVE2_FINAL_IMPLEMENTATION_PLAN_OUTPUTS_LIBRARY_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **KIMI (deep research → long-form report deliverable)**:
  - `Softs/KIMI/Docs/www.kimi.com/en/deep-research.html` (deep research: “breaks down… searches extensively… delivers professional long-form reports”).
  - `Softs/KIMI/Docs/www.kimi.com/en/docs.html` (Docs agent posture: praca na dokumencie jako deliverable).
- **Perplexity (web search + tools + model fallback for availability)**:
  - `Softs/0 Prompty/Preplexyty .zip :: Preplexyty /docs.perplexity.ai/docs/search/quickstart.html` (Search API: ranked results, domain filtering, content extraction).
  - `Softs/0 Prompty/Preplexyty .zip :: Preplexyty /docs.perplexity.ai/docs/agent-api/tools.html` (tools: web search / URL fetch / function calling posture).
  - `Softs/0 Prompty/Preplexyty .zip :: Preplexyty /docs.perplexity.ai/docs/agent-api/model-fallback.html` (model fallback chain: availability + failover posture).
- **Gamma (template-driven generation as a bounded API posture)**:
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/reference/create-from-template.html` (Create from template: template-first generation).
- **PromptingGuide (structure/prompt discipline as an input contract)**:
  - `Softs/0 Prompty/Promptguide.zip :: Promptguide/www.promptingguide.ai/prompts.en.html` (prompt patterns; structured prompting posture).
  - `Softs/0 Prompty/Promptguide.zip :: Promptguide/www.promptingguide.ai/research/rag.en.html` (RAG posture: retrieval + faithfulness risks).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “report as a governed deliverable artifact”, nie “pełny report-builder suite”.**

- **Template-first creation (Gamma + contract intent)**:
  - Raport startuje z template (app template / user template) i ma przewidywalny rezultat.
- **Research + sourced claims posture (KIMI deep research + Perplexity search)**:
  - Jeśli raport zawiera twierdzenia “z internetu”: musi mieć evidence pointers (źródła, linki) i jawne granice (co nie jest zweryfikowane).
  - Web/search jest narzędziem w run planie, nie “magicznie w tle”.
- **Durable identity + reopen/continue (Documents family)**:
  - Raport po wygenerowaniu jest trwałym artefaktem: reopen/continue, wersje, review/export truth.
- **Availability/degraded modes (model fallback posture)**:
  - Przy braku narzędzi/limitach: raport nie “udaje”, tylko pokazuje degraded state i daje fallback (draft bez web).
- **No silent scope merge (Raporty ≠ Wordy)**:
  - Raporty pozostają osobną pozycją produktową (template-driven report lane), nawet jeśli runtime jest współdzielony z `Documents`.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md` + `WAVE2_FINAL_IMPLEMENTATION_PLAN_FULL_REPORTS_PRESENTATIONS_BUILDER_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per contract) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Template-first UX | template → generate | (wymagane w intencie) | Dopiąć template selection + parameters jako jawny krok przed run | P0 |
| Sourced evidence | sources/citations | (nieudowodnione jako domknięte) | Raport ma evidence pointers i jawne confidence/limits dla części “research” | P0 |
| Continuation & review | reopen/continue + review | shared via Documents | Ujednolicić review/export grammar specyficzną dla raportów (bez builder parity) | P1 |
| Degraded states | failover posture | (niezdefiniowane) | Zdefiniować fallback: no-web / rate-limited / missing sources → bezpieczny draft | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Template-first flow działa; raport jest reopenable; review/export mają ślady; raport jest w Outputs Library.
- Jeśli raport używa web/search: ma sources/evidence pointers (albo jawne ograniczenie).
- Raport nie miesza approval(run) z review(artifact).

### 5.2 Tests
- Integracyjne: template select → plan → approve(run) → report artifact → library → reopen/continue → export → audit.
- Regression: no-web / tool error → raport pokazuje degraded state i daje bezpieczny fallback.
- Contract tests: report artifact payload zawiera template id + sources ledger + export ledger (w deklarowanym zakresie).

### 5.3 Staging proof checklist
- Demo: 2 template’y raportu → wygeneruj → reopen/continue → export; oba w library.
- Demo: report z web sources + report bez web (fallback) → różnice są jawne i nie overclaim.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Wave2 SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P21-A — Report template-first canon + sources posture (scope approval)
- **Goal**: raport jako template-first deliverable z evidence pointers (bounded), bez “doc suite parity”.
- **Inputs required**: template selection + parameters; sources/citations posture; degraded rules (no-web).
- **Acceptance**: scope zatwierdzony; non-goals jawne; approve(run) ≠ review(artifact) spisane.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze template-first flow (select→params→plan→approve) and required template metadata.
  - Freeze sources/citations posture and no-web degraded rules (no overclaim).
  - Freeze convergence with Outputs Library (19) + trust-state (18).
- **DoD**:
  - Approved(scope): template-first + sources posture are explicit and testable.

#### P21-B — Template→plan→approve→artifact→library→continue closure
- **Goal**: E2E flow + reopen/continue + export audit.
- **Acceptance**: no-web fallback jest uczciwy; sources są jawne (albo ograniczenie).
- **Evidence**: integracyjne testy + staging demo 2 template’ów.
- **Tasks**:
  - Implement E2E flow for 2 templates: generate→library→reopen/continue→export (bounded).
  - Implement no-web fallback path with explicit degraded state.
  - Add integration/regression tests (5.2) and run staging demos (5.3).
- **Staging proof script (click-by-click)**:
  1. Pick template #1, set parameters, generate report via plan→approve(run); confirm artifact lands in Outputs Library with template id.
  2. Reopen/continue the report and verify changes persist (bounded).
  3. Export the report and confirm export ledger/audit is recorded.
  4. Pick template #2 and repeat end-to-end.
  5. Run a “no-web” or tool-error scenario and verify explicit degraded state + safe fallback draft (no overclaim).
- **DoD**:
  - Templates produce durable artifacts; sources are visible or explicitly absent; exports audited.

#### P21-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P21-A/B/C.
  - Validate rollback: disable web/search; preserve safe draft generation.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw template-first, potem rozszerzenia sources/degraded (P1) i polish.

### 8.3 Rollback plan
- Wyłącz web/search; zachowaj draft generation; bez destrukcji danych.

### 8.4 P21-A — Acceptance checklist (testable)

1. [ ] Report artifact schema (§2.3.1) defines all fields: `artifactId`, `templateId`, `reportType`, `generationPlan`, `sourcesLedger`, `degradedFlags`, `parameters`, `runApproval`, `artifactReview`, `exportLedger`, `provenanceStamp`.
2. [ ] `templateId` is **mandatory** on every report artifact — no template-less reports.
3. [ ] Template-first flow (§2.3.2) has 9 explicit steps: select → params → plan → approve(run) → generate → land → reopen → review(artifact) → export.
4. [ ] **approve(run) ≠ review(artifact)** invariant is explicit and enforced in schema, UI copy, and API naming.
5. [ ] Sources posture (§2.3.3) defines 3 confidence levels: `verified`, `unverified`, `no_source`.
6. [ ] No-overclaim rule: if `confidence < verified`, limitation text is mandatory in the report section.
7. [ ] Degraded posture (§2.3.4) covers 4 scenarios: no-web, tool error, rate limited, model unavailable — each with explicit `degradedFlags` and user-visible behavior.
8. [ ] Anti-duplicate gate (§2.3.7) confirms 8 areas: no parallel template store, outputs, provenance, branding, report types, documents runtime, tools, Wave2 SSOT.
9. [ ] Integration table (§2.3.5) references P24, P19, P18, P30, P27 with explicit rules.
10. [ ] Boundary with Wordy (§2.3.6) is explicit: separate lanes, separate contracts, shared infrastructure.
11. [ ] Error posture (§2.4) covers 8 scenarios with HTTP codes and guidance.
12. [ ] `sourcesLedger` is auditable and includes `used_in_sections[]` for section-level attribution.

## 9. Risks / open questions / decisions
- Ryzyko: raport overclaim bez źródeł.
- Ryzyko: no-web/tool errors bez jawnego degraded.
- Decyzje: minimalny zakres exportów i ich audyt.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P21-A | `approved(scope)` | `fdcba833f7` | Scope approval — no runtime tests | N/A (scope phase) | Report template-first canon + sources posture frozen; approve(run) ≠ review(artifact) invariant explicit |
| P21-B | `delivered` | (commit) | `npx vitest run tests/integration/routes/p21b-reports-template-artifactrun-e2e.sqlite.integration.test.ts` ✅ | Planned: `docs/product/work-packets/cursor-work/final_master/evidence/P21_B_REPORTS_RUNTIME_E2E_TESTS_AND_STAGING_PROOF_PLAN_2026-03-30.md` | Bounded: 2 templates via governed ArtifactRun → Outputs Library; originSummary carries `sourcesLedger` + `degradedFlags.no_web`; export audit trace recorded via Outputs ledger |
| P21-C |  |  |  |  |  |

