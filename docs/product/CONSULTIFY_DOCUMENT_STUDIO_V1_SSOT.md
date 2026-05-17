# Consultify Document Studio v1 — SSOT

> Status: Canonical v1
> Owner: Product + Engineering
> Authority: Highest for Document runtime productization, document-class artifact behavior, document template registry, document narrative planning, formatting and style governance, AI document editing semantics and document QA contract.
> Position: This document is the productized name and doctrine for the **Document runtime** under `V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`. It does not replace the V8.1 substrate; it specializes the Document format runtime above it.
>
> Supersedes (for Document runtime doctrine):
> - `docs/product/REPORT_GENERATOR_V3.md` — preserved as historical reference; R1–R4 reports become a document family within Document Studio's Template Registry. Report-specific semantics (RAG logic, escalation rules, ToolSession/AssessmentReport traceability) remain valid and are inherited by this doctrine.
>
> Inherits without restatement:
> - `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md` — artifact lifecycle, library home, visibility scopes, governance.
> - `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md` — artifact substrate object model (`Artifact`, `ArtifactRun`, `ArtifactVersion`, `ArtifactSourceRef`).
> - `docs/product/AI_ARTIFACT_RUNTIME_ARCHITECTURE_V8.md` — AI artifact draft/preview/version/publish lifecycle.
> - `docs/product/SOURCE_TRACEABILITY_SPEC.md` — source object truth, ToolSession/AssessmentReport, MyWork seed rule.
> - `docs/product/REPORTING_CANONICAL_TEMPLATES.md` — R1–R4 report templates and RAG/escalation rules; lives inside Document Studio Template Registry.
> - `docs/product/REPORT_BUILDER_EXPORTS_STANDARD.md` — DOCX/PDF/PPTX export quality baseline.
> - `.cursor/rules/00-core-execution.mdc`, `10-context-loading.mdc`, `40-security-tenancy.mdc`.

---

## 1. Why this document exists

Consultify already has a strong foundation for AI-generated outputs:

- a unified artifact substrate (`v8.1` Artifact + ArtifactRun + ArtifactVersion + ArtifactSourceRef),
- a Reports & Presentations runtime (`Report Builder`, `Presentation Generator`),
- an Outputs Library and `My Work` artifact view,
- AI proposal-only doctrine, source traceability, governed publish review.

What is still missing is one canonical doctrine for the **Document runtime** as a productized engine that:

- generates and edits long-form consulting documents (raporty, memo, SOP, business case, board reports, workshop summaries, decision memos, due diligence notes, implementation plans, change management plans, internal policy documents, client final reports, etc.),
- treats the document template — including formatting (Word styles, TOC, headers/footers, page numbering, cover page, appendix) — as a first-class object, not a side artifact of content generation,
- gives AI a clear contract as **template architect**, **content generator**, and **document editor** with explicit edit scopes,
- enforces source-grounded analytical claims and fails honestly when source data is missing,
- ships a quality engine that goes beyond structural completeness to cover language, methodology, brand, risk, data and export compliance.

This is the productized name and doctrine for that runtime: **Consultify Document Studio**.

---

## 2. Executive statement

> Consultify Document Studio is the productized name of the Document runtime inside the V8.1 native artifact registry. It is the AI-native engine for consulting-grade Word/PDF documents in Consultify.

The most important rules in the whole document:

> Document Studio MUST NOT create a parallel artifact registry. It MUST persist all durable state via the V8.1 artifact substrate.

> Document Studio MUST NOT introduce a parallel approval universe. It inherits governance from the V8.1 execution and proposal spine and the V8.1 publish-review service.

> Document Studio MUST treat the document template — including formatting — as a first-class object, planned and approved before content generation in Modes 2 and 3.

---

## 3. Position in the artifact family

V8.1 defines three first-class artifact classes: `Document`, `Presentation`, `Sheet`.

Document Studio is the productized engine for the `Document` class.

| Artifact class | Productized engine | Authority |
| --- | --- | --- |
| Document | Consultify Document Studio (this doc) | Document runtime, document templates, document narrative planning, formatting, document editor, document QA |
| Presentation | Consultify Presentation Studio | `PRESENTATION_GENERATOR_V3.md` |
| Sheet | Sheet runtime (V8.1) | `V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md` §5.3 (productization deferred) |

Canonical rule:

> Each productized engine specializes the V8.1 format runtime; none of them owns artifact identity, run history, version lineage, source refs, visibility scopes, or review state. Those belong to the V8.1 substrate.

---

## 4. What Document Studio is and is not

### 4.1 What it is

- A productized Document runtime inside V8.1.
- A consulting-grade engine for long-form Word/PDF documents.
- A template-first system: Document Template Architect, Document Template Registry.
- An AI document editor with explicit edit scopes (local / section / global / methodology / source).
- A QA engine that scores documents on 10 quality categories before export.
- The canonical home for R1–R4 reports as a document family.

### 4.2 What it is not

- A new module beside Reports & Presentations. It is the productized Document runtime and reuses the existing R&P hub plus chat-first creation surfaces.
- A second artifact registry. All persistence goes through the V8.1 substrate.
- A replacement for the V8.1 functional spec, the V8.1 implementation plan, the AI artifact runtime architecture, the source traceability spec, the report exports standard, or any of the cross-cutting AI parity specs.
- A copy of Microsoft Word, Google Docs, Notion, PandaDoc, Conga, Templafy or Gamma. The point is not to mimic; the point is to match the right operating model for consulting documents.
- A document storage system. Documents must remain first-class platform artifacts with traceable source and run lineage.

---

## 5. Core product doctrine

### 5.1 Document is a process artifact, not a file

Documents in Consultify are **outputs of consulting processes**: research, interviews, audits, meetings, workshops, financial analyses, project work, roadmaps, business cases, sales processes, governance work, transformation diagnoses.

Canonical rule:

> A document in Consultify is the materialization of a consulting process. It carries source lineage, review state, version history and governance. It is not "an export".

### 5.2 Three modes

Document Studio supports three creation modes. All three end in the same V8.1 artifact lifecycle (`requested → planning → generating → validating → draft → in_review → approved → exported → archived`).

#### 5.2.1 Mode 1 — Generate without template

The user describes what they need. The system:

1. interprets type, audience, length, language, tone from the intake;
2. proposes an outline (Document Narrative Planner);
3. assembles a source pack from available context;
4. generates the document section by section into the internal Document Schema;
5. validates it through the Document QA Engine;
6. surfaces it as a V8.1 artifact in `draft` state;
7. supports DOCX/PDF export.

Mode 1 is the lowest-friction path. It is the MVP-1 of Document Studio.

#### 5.2.2 Mode 2 — Plan a document template (AI Architect)

The user asks AI to plan a new template. The system:

1. captures the purpose and audience of the future template;
2. proposes the section blueprint (mandatory and optional sections, required inputs, formatting class);
3. proposes the formatting schema (fonts, headings, table styles, TOC, headers/footers, page numbering, cover page, appendix style);
4. proposes the governance rules (who can use the template, who can edit it, who approves outputs, whether export requires approval);
5. waits for user approval;
6. registers the template into the Template Registry as `draft`;
7. promotes it to `approved` only on explicit governance approval.

Mode 2 is the durable competitive advantage versus generic AI writing tools. It is part of MVP-2.

#### 5.2.3 Mode 3 — Generate from approved template

The user picks an `approved` template. The system:

1. resolves the template;
2. assembles the source pack required by the template;
3. flags missing inputs explicitly; never hallucinates substitutes;
4. maps sources to sections;
5. generates the document under the template's formatting schema;
6. validates against the template's QA expectations;
7. produces a V8.1 artifact in `draft` state;
8. supports DOCX/PDF export under the template's export rules and approval policy.

Mode 3 is part of MVP-3.

### 5.3 AI is a document editor, not a one-shot generator

V8.1 already establishes "AI proposes, human approves". Document Studio specializes this for long-form documents with **five explicit edit scopes**:

| Scope | What the edit changes | Examples |
| --- | --- | --- |
| Local | One paragraph, table, list, callout, single subsection | "Make this paragraph more formal." |
| Section | One full chapter or grouped subsections | "Expand the risks chapter and add a mitigation table." |
| Global | The entire document | "Reduce to 10 pages and shift to executive register." |
| Methodology | Conformance to template, methodology and argument structure | "Check that this audit report meets the AI Audit standard." |
| Source | Source pack, evidence, citations | "Mark every claim that has no source as assumption." |

Canonical rule:

> Every AI document edit MUST detect its scope, propose a plan, surface a diff, and apply only after user acceptance. Source-level edits MUST follow the `proposal → approval → execution → audit` ladder.

### 5.4 Source pack first; honest gaps over hallucinations

Document Studio uses the V8.1 source-ref model and the source traceability spec. It adds an explicit **source pack** abstraction per document run.

Canonical rule:

> Every Document Studio run MUST build a source pack before content generation. Missing inputs MUST be surfaced as `missing_inputs` and analytical claims that cannot be grounded MUST be marked `assumption` until source coverage is added.

### 5.5 Template includes formatting

In Document Studio, a template is **content blueprint plus formatting schema plus governance rules**. The formatting schema covers Word-grade structure: fonts, heading styles, list and table styles, page numbering, headers/footers, cover page, table of contents, appendix style, captions, footnotes, citation style.

Canonical rule:

> A document template that does not specify formatting is incomplete. Mode 2 MUST plan formatting and Mode 3 MUST apply it; eligibility for `approved` status requires both content blueprint and formatting schema.

### 5.6 Document is a schema before it is a file

Documents exist as a structured `DocumentSchema` (sections, blocks, tables, callouts, sources, appendices, formatting) **before** any DOCX or PDF is produced.

Canonical rule:

> DOCX, PDF and the internal artifact preview are renderers over the same canonical Document Schema. The schema is the source of truth; renderers are derivable.

### 5.7 Governance, versioning, approval are inherited from V8.1

Document Studio does not duplicate the artifact lifecycle or review semantics. It uses the V8.1 review states, visibility scopes, audit trail, version lineage and operation contracts.

Canonical rule:

> If a behavior is already defined in the V8.1 substrate, Document Studio MUST cite it and MUST NOT redefine it.

---

## 6. Document type taxonomy

Document Studio supports a wide set of consulting-grade document types. The canonical catalog is `CONSULTIFY_DOCUMENT_STUDIO_V1_TYPE_TAXONOMY.md`. The types listed below are the v1 in-scope set. Each type maps to a Template Registry entry once a template exists; all types can also be created in Mode 1 without a template.

| Type | Audience | Default authority |
| --- | --- | --- |
| `executive_memo` | Board / sponsor | Decision-oriented memo |
| `decision_memo` | Steering committee | Single decision under a recommendation |
| `project_status_report` | PMO / Project team | R1 (Weekly Execution) — inherits report rules |
| `steering_committee_report` | Sponsors / Board | R2 — inherits report rules |
| `benefits_tracking_report` | Business owners | R3 — inherits report rules |
| `portfolio_overview` | Executives | R4 — inherits report rules |
| `ai_audit_report` | C-level | Formal audit deliverable |
| `interview_summary_report` | Internal / Sponsor | Summary across interview sessions |
| `digital_transformation_roadmap` | Sponsor / PMO | Roadmap document with initiatives |
| `business_case` | Sponsor / Board | Economic justification |
| `sales_proposal` | Client | Commercial proposal |
| `client_discovery_report` | Client / Internal | Output of client discovery |
| `workshop_summary` | Internal / Client | Workshop facilitation output |
| `risk_register_report` | PMO / Steering | Risks with owners and mitigations |
| `sop_document` | Operations | Standard Operating Procedure |
| `implementation_plan` | PMO / Owners | Wave-by-wave delivery plan |
| `change_management_plan` | Org-change leads | Change management deliverable |
| `board_report` | Board / Supervisory board | Formal board document |
| `research_report` | Internal | Output from a research session |
| `due_diligence_note` | Investment / Strategy | Diligence deliverable |
| `internal_policy_document` | All employees | Policy under governance |
| `client_final_report` | Client | End-of-project final report |

R1–R4 in the table above explicitly inherit `REPORTING_CANONICAL_TEMPLATES.md` semantics: required sections, RAG logic, escalation rules, source bindings (`ToolSession`, `AssessmentReport`).

Canonical rule:

> R1, R2, R3, R4 documents created via Document Studio are still subject to Report-class rules (RAG, escalation, traceability) defined in `REPORTING_CANONICAL_TEMPLATES.md`. Document Studio does not override those rules; it hosts them.

---

## 7. The Document Schema

The Document Schema is the canonical structured representation of a document in Document Studio. It is used by all renderers (preview, DOCX, PDF) and by the AI Document Editor.

```
DocumentSchema {
  document_id: UUID                       # mirrors V8.1 Artifact.id
  artifact_version_id: UUID               # mirrors V8.1 ArtifactVersion.id
  title: string
  document_type: DocumentTypeKey          # see taxonomy
  language: "pl" | "en" | ...
  audience: string[]                      # CEO, CFO, PMO, client, etc.
  goal: "inform" | "decide" | "approve" | "recommend" | "align"
  communication_register: "executive" | "professional" | "technical" | "narrative"
  density: "concise" | "standard" | "detailed" | "comprehensive"
  language_style: "formal" | "consulting" | "legal" | "narrative"
  template_id?: UUID                       # null in Mode 1
  source_pack_id: UUID
  formatting_schema: FormattingSchema
  cover_page?: CoverPageSchema
  toc?: TocSchema
  sections: DocumentSection[]
  appendices?: Appendix[]
  source_refs: SourceRef[]                 # V8.1 source refs
  status: "draft" | "in_review" | "approved" | "exported" | "archived"
  confidentiality: "internal" | "client_confidential" | "restricted" | "public"
  created_at: timestamp
  updated_at: timestamp
}
```

```
DocumentSection {
  section_id: UUID
  order_index: number
  level: 1 | 2 | 3
  title: string
  purpose?: string
  blocks: DocumentBlock[]
  source_refs: SourceRef[]
  rag?: "green" | "amber" | "red"          # only for report-class sections
}
```

```
DocumentBlock {
  block_id: UUID
  type: "heading" | "paragraph" | "bullet_list" | "numbered_list" | "table" | "callout" | "quote" | "kpi_strip" | "risk_table" | "image" | "footnote" | "citation"
  content: JSON
  source_ref?: SourceRef
  is_assumption?: boolean
  is_refreshable?: boolean
}
```

```
FormattingSchema {
  fonts: { body: string; heading: string; mono?: string }
  heading_styles: { h1: string; h2: string; h3: string }
  table_styles: { default: string; risk_table?: string; kpi_strip?: string }
  list_styles: { bullet: string; numbered: string }
  page: { size: "A4" | "Letter"; margins_cm: { top: number; bottom: number; left: number; right: number } }
  headers: { enabled: boolean; content_template?: string }
  footers: { enabled: boolean; page_numbering: boolean; confidentiality_label: boolean }
  toc: boolean
  cover_page: boolean
  appendix_style: "lettered" | "numbered" | "none"
  citation_style: "inline_marker" | "footnote" | "endnote"
}
```

Canonical rules:

> A document MUST always have a `formatting_schema`. In Mode 1 the system applies the **default consulting schema**; in Modes 2 and 3 the schema comes from the template.

> `FormattingSchema` field choices are constrained to the values listed above; new options are added by amending this document and `CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md`.

---

## 8. The Document Template

A Document Template is the durable object that defines a reusable document plan: content blueprint, formatting schema, governance rules and required inputs.

```
DocumentTemplate {
  template_id: UUID
  name: string
  document_type: DocumentTypeKey
  scope: "system" | "organization"
  organization_id?: UUID
  status: "draft" | "approved" | "deprecated"
  version: string
  owner_user_id: UUID
  audience: string[]
  language: string
  language_style: "formal" | "consulting" | "legal" | "narrative"
  required_inputs: string[]                # source pack contract
  optional_inputs: string[]
  section_blueprint: SectionBlueprint[]
  formatting_schema: FormattingSchema
  export_rules: {
    docx: boolean
    pdf: boolean
    approval_required: boolean
  }
  permissions: {
    can_use_role: string[]
    can_edit_role: string[]
    can_approve_role: string[]
  }
  created_at: timestamp
  updated_at: timestamp
}
```

```
SectionBlueprint {
  section_number: number
  section_name: string
  purpose: string
  required: boolean
  required_data: string[]
  optional_data?: string[]
  formatting_style: string                 # references heading style + density rule
  length_guideline?: string                # e.g. "1-2 pages"
  approval_required?: boolean              # for sensitive sections
}
```

Canonical rules:

> A `DocumentTemplate` is `approved` only when it has a complete `section_blueprint` and a complete `formatting_schema`.

> `system` scope templates ship with the platform (R1–R4 and seeded consulting types). `organization` scope templates are owned by a tenant.

> Generating a document from a `deprecated` template MUST fail closed with a clear error and a pointer to the successor template.

---

## 9. Subsystems

### 9.1 Document Request Intake

Captures intent, audience, type, length, language, tone, and source hints. Available from:

- chat (primary entry per V8.1 doctrine),
- the Reports & Presentations hub (Menu-3 right-side AI action),
- module-level AI kickoff flows (Initiative, Interview, Workshop, Audit, Research session, Notebook).

Intake fields (Mode 1 minimum set):

- `title` (optional; AI proposes if missing)
- `description` (free-form)
- `document_type` (optional; AI infers if missing)
- `audience`
- `language`
- `language_style`
- `density`
- `goal`
- `confidentiality` (defaults to `internal`)
- `source_hints` (object IDs from initiatives, interviews, tools, notebooks, etc.)

### 9.2 Source Pack Builder

Assembles a `source_pack` from explicit hints and inferred context. Anchors sources to V8.1 source-ref types: `ToolSession`, `AssessmentReport`, `Interview`, `Initiative`, `Note`, `Decision`, `BenefitsRecord`, `EconomicAnalysis`, `KPI`, etc., per `SOURCE_TRACEABILITY_SPEC.md`.

Canonical rule:

> If the document type requires a canonical source class (per Source Traceability Spec) and the source pack does not contain it, the run MUST surface `missing_required_source` and refuse to materialize until resolved.

### 9.3 Document Narrative Planner

Plans the document structure before content generation:

- main thesis,
- chapter order,
- argumentation logic,
- executive summary placement,
- recommendations and decisions placement,
- balance between text, tables, callouts and figures,
- expected length per section.

Canonical rule:

> Content generation MUST NOT begin until the narrative plan is accepted (in Mode 1) or matches the template blueprint (in Modes 2 and 3).

### 9.4 AI Document Template Architect (Mode 2)

The AI Architect plans a new `DocumentTemplate`. It MUST produce both a `section_blueprint` and a `formatting_schema`, plus governance rules and required inputs. The user reviews, edits, and approves before the template enters the Registry.

### 9.5 Template Registry

Holds `DocumentTemplate` records. Capabilities:

- list templates by `document_type`, `scope`, `status`,
- promote `draft → approved`,
- deprecate `approved → deprecated` with a successor pointer,
- enforce permissions and export rules.

Visibility follows V8.1 visibility scopes (`private`, `project`, `organization`, `review_shared`, `demo`).

### 9.6 Document Schema Engine

Owns the `DocumentSchema`. Provides:

- create/update operations on sections, blocks, callouts, tables,
- AI-assisted block-level operations (insert, rewrite, regenerate, restructure),
- diff and patch primitives used by the Document Editor and the V8.1 publish-review service.

### 9.7 Formatting & Style Engine

Renders the `DocumentSchema + FormattingSchema` into format-specific outputs:

- internal artifact preview (HTML/React),
- DOCX with real Word styles,
- PDF with stable layout, page numbers, TOC and headers/footers.

Canonical rules:

> The DOCX output MUST use real Word styles. It MUST NOT be markdown-into-DOCX. It MUST preserve heading hierarchy, lists, tables, captions, TOC, page numbers, headers and footers across reopens and edits.

> The PDF output is a render of the same schema. It MUST be stable across regenerations within the same artifact version unless the schema changed.

### 9.8 AI Document Editor

The runtime that processes user edit requests. Responsibilities:

- detect the edit scope (local / section / global / methodology / source),
- propose a plan (especially for global, methodology and source scopes),
- compute a structured diff,
- apply only after acceptance (or auto-apply for local rewrites with low blast radius, configurable per template).

### 9.9 Document QA Engine

Runs on the `DocumentSchema` before export and before review submission. Categories:

| Category | What it checks |
| --- | --- |
| Completeness | All required sections are present and non-empty |
| Source | Analytical claims have source refs or `is_assumption=true` |
| Methodology | Document conforms to its template (R1–R4 specifics, audit standards, etc.) |
| Executive | The document leads to a decision or clear next step (for memos and steering reports) |
| Language | Tone, register, language consistency, banned phrases per Brand Voice |
| Format | Heading hierarchy, numbering, list/table styles, TOC stability |
| Brand | Compliance with Brand Voice profile |
| Risk | Risks are listed with owner and mitigation where required |
| Data | Numeric coherence: sums, units, periods |
| Export | DOCX/PDF render passes the export quality gate |

QA produces a structured `qualityState` mapped to V8.1 `qualityState` field on `Artifact`.

### 9.10 Export Engine

DOCX (primary), PDF, share link (V8.1 publish), optional appendix package and source package. Reuses `REPORT_BUILDER_EXPORTS_STANDARD.md` baseline; extensions live in MVP-4 ("Advanced DOCX export").

### 9.11 Governance & Versioning

Inherited from V8.1. Document-specific additions:

- `confidentiality` label propagated from intake to artifact metadata,
- export approval rule resolved from template `export_rules.approval_required`.

---

## 10. Lifecycle

Document Studio uses the V8.1 lifecycle without modification:

`requested → planning → generating → validating → draft → in_review → approved → exported → archived`

Mode-specific notes:

- Mode 1 enters `planning` after intake; outline acceptance moves the run to `generating`.
- Mode 2 produces a `DocumentTemplate` artifact; the lifecycle applies to the template object, with an explicit `approved` gate before it can be used in Mode 3.
- Mode 3 enters `generating` directly once the template is resolved and the source pack passes preflight.

Canonical rule:

> Validation gates MUST run between `generating` and `draft`. A run that fails validation MUST surface to the user with a structured failure package (V8.1 `ArtifactRunFailurePackage`) and not produce a `draft` artifact.

---

## 11. Source-of-truth integration

| Concern | Owner | Document Studio behavior |
| --- | --- | --- |
| Artifact identity, lifecycle, versions | V8.1 substrate | Plug-in only |
| Visibility scopes (`private`, `project`, `organization`, `review_shared`, `demo`) | V8.1 substrate | Inherits |
| Source refs and ToolSession/AssessmentReport rules | `SOURCE_TRACEABILITY_SPEC.md` | Inherits; documents from MyWork seed `MYWORK ToolSession` |
| Report classes R1–R4 | `REPORTING_CANONICAL_TEMPLATES.md` | Hosted as document family with full report rules |
| DOCX/PDF/PPTX export quality | `REPORT_BUILDER_EXPORTS_STANDARD.md` | Inherits baseline; MVP-4 extends DOCX |
| Brand Voice profile | `REPORT_GENERATOR_V3.md` (now hosted here) | Document Studio is the new canonical home |
| Governance gates and proposal/approval | V8 execution and proposal spine | Inherits |
| Tenant/ACL | `40-security-tenancy.mdc` | Deny-by-default; visibility scope enforced via V8.1 substrate |

---

## 12. AI governance (specialization of V8.1)

- AI proposes; human approves.
- AI may scaffold, refresh, rewrite, validate.
- No fake citations; every citation MUST resolve to a registered source ref.
- No silent source loss in any edit scope.
- No hidden status mutation on the artifact.
- No export without trace; the export log lives on the V8.1 artifact.
- Source-level edits and methodology-level edits MUST follow `proposal → approval → execution → audit`.

---

## 13. Security and tenancy

- All Document Studio reads and writes resolve through the existing tenant-aware auth middleware and the V8.1 artifact substrate.
- `confidentiality = "client_confidential"` MUST be honored end to end: surfaced in UI, embedded in exports, recorded in audit.
- Document Studio MUST NOT introduce a new credential surface, a new MCP tool, or any remote mutation path that bypasses the V8 tool governance model.
- Deny-by-default applies to template usage (Modes 2, 3) and to share-link generation.

---

## 14. UI/UX placement

Per UI/UX governance and the AI-actions-Menu-3 placement rule:

- Primary creation surface: chat-first ("prepare a board memo", "create an AI Audit report for client X").
- Secondary creation surface: a single AI action button "New document" placed in the Menu-3 right-side command row of the existing `Reports & Presentations` hub.
- Outputs land in the V8.1 Outputs Library and surface in `My Work` per existing rules.
- The artifact workspace surface is shared with the V8.1 artifact workspace; Document Studio renders the document-specific preview and editor inside it.

Canonical rule:

> Document Studio MUST NOT introduce a new sidebar module, a new top-level toolbar, or a parallel hub. UI growth happens only inside existing surfaces and within the Menu-3 contract.

---

## 15. MVP roadmap

| MVP | Scope |
| --- | --- |
| MVP-1 | Mode 1 end-to-end: intake → narrative plan → section generation → V8.1 artifact `draft` → preview → DOCX/PDF export reusing existing report-builder exporters. No template, no AI editor with multi-scope, only structural QA. Chat-first entry plus a single Menu-3 button in R&P hub. |
| MVP-2 | Mode 2: AI Document Template Architect; Template Registry with `draft/approved/deprecated`; basic governance rules; first wave of seeded templates (executive memo, decision memo, AI audit report, workshop summary, R1–R4 hosting). |
| MVP-3 | Mode 3: Generate from approved template; full source-pack preflight; required-input enforcement; export approval rule; full type taxonomy active. |
| MVP-4 | Advanced DOCX export: real Word styles, stable TOC, headers/footers with page numbering, cover page, lettered/numbered appendices, captions, footnotes, citation styles. PDF parity. |
| MVP-5 | Enterprise governance: workflow approval, reusable content blocks, legal/compliance templates, cross-tenant brand governance, source provenance UI, deeper integrations, multi-user collaboration on the same document schema. |

Canonical rule:

> Each MVP wave ships behind a feature flag and follows the V8 release discipline (`AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`). Earlier waves MUST remain stable when later waves are introduced.

---

## 16. Acceptance criteria for MVP-1

Document Studio MVP-1 is functionally complete when all of the following hold:

- Users can submit a Mode-1 intake from chat or the Menu-3 button.
- The system produces an outline; user acceptance triggers content generation.
- The result is a V8.1 artifact of `artifactType = document`, in `draft` state, owned by the requesting user under their `organizationId`, with the correct visibility scope.
- The artifact carries `source_refs`, the source pack, and clearly marks unsourced analytical claims as `is_assumption=true`.
- The artifact renders in the V8.1 artifact workspace.
- DOCX and PDF export return non-empty files using the existing report-builder export pipeline (DOCX quality bar = current baseline, no regression).
- Tenant guard, auth and visibility scope are enforced by reusing existing middleware and the V8.1 substrate; no new auth surface is added.
- No file outside the approved scope is modified.
- No parallel artifact registry, no parallel approval universe.

---

## 17. Non-goals for v1

- Mode 2 and Mode 3 (deferred to MVP-2 and MVP-3).
- AI Document Editor with all five edit scopes (deferred; MVP-1 ships only basic local rewrite).
- Full QA Engine with all 10 categories (MVP-1 ships only Completeness + Source).
- Brand Voice profile productization beyond what already exists in `reportGenerationService`.
- Real Word styles beyond what report-builder currently exports (MVP-4).
- Collaborative real-time editing (MVP-5).
- New module beside Reports & Presentations.
- Replacement of any existing canonical document.

---

## 18. Open follow-ups

- Catalog the seeded `system`-scope templates per type (`CONSULTIFY_DOCUMENT_STUDIO_V1_TYPE_TAXONOMY.md`).
- Define the structured failure packages for each QA category (MVP-2).
- Specify the diff format used by the AI Document Editor (MVP-2).
- Define the "default consulting schema" formatting object as a published constant.

---

## 19. Related canonical documents

- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_FUNCTIONAL_SPEC.md`
- `docs/product/V8_1_NATIVE_ARTIFACT_RUNTIME_AND_OUTPUTS_IMPLEMENTATION_PLAN.md`
- `docs/product/AI_ARTIFACT_RUNTIME_ARCHITECTURE_V8.md`
- `docs/product/REPORTING_CANONICAL_TEMPLATES.md`
- `docs/product/REPORT_GENERATOR_V3.md` (superseded for Document doctrine; preserved as historical reference)
- `docs/product/PRESENTATION_GENERATOR_V3.md`
- `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `docs/REPORT_BUILDER_EXPORTS_STANDARD.md`
- `docs/product/AI_HUMAN_IN_THE_LOOP_GOVERNANCE_ARCHITECTURE_V8.md`
- `docs/product/AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
- `docs/product/AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`
- `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_TYPE_TAXONOMY.md`
- `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_MATRIX.md`
- `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md`
