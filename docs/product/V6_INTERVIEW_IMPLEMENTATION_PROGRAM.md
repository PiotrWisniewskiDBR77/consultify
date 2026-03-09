# V6 Interview Implementation Program (SSOT / Backlog Ledger)

Owner: CTO/PO (Piotr + AI)  
Status: living document (v6 redesign program)  
Last update: 2026-03-09

> **Cel tego pliku:** mieć jedno precyzyjne źródło prawdy dla wdrożenia V6 modułu `Interview`: zakres, taski, DoD, zależności, fale realizacji, smoke testy i gate do release.
>
> Źródłem produktu są:
> - `docs/product/INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md`
> - `docs/product/INTERVIEW_TEMPLATES_LIBRARY_V6.md`
> - `docs/product/V6_INTERVIEW_ACTION_PLAN.md`

---

## 0) Referencje (SSOT)

- `docs/product/INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md`
- `docs/product/INTERVIEW_TEMPLATES_LIBRARY_V6.md`
- `docs/product/V6_INTERVIEW_ACTION_PLAN.md`
- `docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- `docs/INTERVIEW_MODULE.md`
- `docs/INTERVIEW_TEMPLATES_AND_AI_ASSIST.md`
- `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
- `docs/product/LINK_GRAPH_V3.md`
- `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`
- `docs/ui-standards/README.md`
- `docs/ui-standards/00-foundation/visual-language.md`
- `docs/ui-standards/03-modules/module-hub-standard.md`
- `docs/ui-standards/03-modules/app-table-standard.md`

---

## 1) Kontrakt programu (V6)

### 1.1 North star

V6 ma zmienić `Interview` z "modułu formularzy" w **system zbierania wiedzy o organizacji**, który:

- buduje template'y AI-first,
- daje premium runtime do odpowiadania,
- zamienia odpowiedzi w wiedzę i linked evidence,
- produkuje uporządkowane insights konsultingowe.

### 1.2 Nienegocjowalne (MUST)

- **3 surfaces, nie 1 UI:** Templates Studio / Runtime / Insight Report
- **AI-first, not AI-only:** AI proponuje, user akceptuje
- **Voice is first-class:** recording -> transcript -> approve
- **Evidence-first:** attachments/links/notatki/audio są częścią kontraktu
- **Traceability:** insight musi mieć drogę powrotną do answer/evidence
- **Scopes:** system / organization / private
- **UI quality:** DBR77 "Tech Sexy", bez ciężkiego enterprise chrome w runtime respondenta
- **i18n PL+EN**
- **Access control:** respektowanie scope i organizacji

### 1.3 Status contracts

**Spec status:**

- `draft`
- `review`
- `locked`
- `implemented`

**Impl status:**

- `todo`
- `in_progress`
- `partial`
- `blocked`
- `done`

**QA status:**

- `not_tested`
- `smoke_passed`
- `qa_passed`

**Target release:**

- `R0` — redesign gotowy do demo / first release
- `R1` — hardening + retrieval + reviewer polish
- `R2` — advanced logic / diagnostics

---

## 2) Dashboard programu

| Workstream | Scope | Spec (locked/total) | Impl (done/total) | QA (smoke/total) | Blockers | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| WS-A Foundations | Core architecture + scopes + routing | 3/3 | 3/3 | 3/3 | — | Piotr |
| WS-B Templates Studio | Hub + builder + AI quality | 0/5 | 1/5 | 0/5 | — | Piotr (separate agent) |
| WS-C Runtime | Respondent + reviewer + voice/evidence | 5/5 | 5/5 | 5/5 | — | Piotr |
| WS-D Knowledge & Evidence | ingest + linked evidence + retrieval | 3/4 | 3/4 | 3/4 | — | Piotr |
| WS-E Insights | report + themes + issues/opportunities | 3/4 | 3/4 | 3/4 | — | Piotr |
| WS-F Library & Delivery | system templates + guidance + smoke/demo | 3/3 | 3/3 | 3/3 | — | Piotr |
| **TOTAL** | **24 tasks** | **17/24** | **18/24** | **17/24** | | |

---

## 3) Task ledger

## 3.1 WS-A Foundations

### V6-A01 — Canonical V6 data contract

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** not_tested
- **Deps:** —
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 7, 8
- **Scope:**
  - define V6 entities for templates, sections, questions, answers, transcripts, evidence, insights
  - map as-is V3 fields to V6 model
  - add migration / compatibility plan
- **DoD:**
  - canonical schema exists for template scope, question modalities, transcript approval, linked evidence, insight payload
  - migration path is documented
  - no ambiguity around source IDs and scope fields
- **Acceptance / smoke:**
  - create template with sections and question policies
  - save answer with transcript + file + link
  - create insight referencing evidence ids

### V6-A02 — Interview IA and surface split

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-A01`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 1, 4, 5, 6
- **Scope:**
  - define navigation and routing for Templates Studio, Runtime, Insights
  - separate respondent vs reviewer routes
  - keep ModuleHub coherence
- **DoD:**
  - route map exists
  - no ambiguous reuse of old mixed screens
  - dynamic tabs / open documents strategy is defined
- **Acceptance / smoke:**
  - open template builder from hub
  - open respondent runtime from assignment
  - open insight report from insights list

### V6-A03 — Scope, permissions and publishing model

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-A01`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 2.5, 7.5
- **Scope:**
  - implement `system / organization / private`
  - define who can read/edit/publish each scope
  - define promote private -> organization flow
- **DoD:**
  - scope behavior is deterministic
  - UI labels match backend rules
  - publish/archive logic respects scope and permissions
- **Acceptance / smoke:**
  - private template is visible only to author
  - organization template is visible inside org
  - system template is read-only seed

## 3.2 WS-B Templates Studio

### V6-B01 — Templates Hub redesign

- **Target release:** R0
- **Spec:** draft
- **Impl:** todo
- **QA:** not_tested
- **Deps:** `V6-A02`, `V6-A03`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 4.2
- **Scope:**
  - cards default, table optional
  - scope switcher, search, filters
  - publish/duplicate/preview/create actions
- **DoD:**
  - hub supports three scopes
  - card design exposes key metadata cleanly
  - table mode remains AppTable-compliant
- **Acceptance / smoke:**
  - filter templates by scope/status/audience
  - switch card <-> table
  - open template in builder

### V6-B02 — AI brief -> draft template flow

- **Target release:** R0
- **Spec:** draft
- **Impl:** todo
- **QA:** not_tested
- **Deps:** `V6-A01`, `V6-F02`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 4.4
- **Scope:**
  - prompt form for interview brief
  - AI draft sections/questions/modalities
  - duration estimate and overload warning
- **DoD:**
  - AI returns sections, ordered questions and answer types
  - output is editable before save
  - AI never auto-publishes
- **Acceptance / smoke:**
  - generate template draft from brief
  - edit generated question
  - save as private draft

### V6-B03 — Builder workspace redesign

- **Target release:** R0
- **Spec:** draft
- **Impl:** todo
- **QA:** not_tested
- **Deps:** `V6-A02`, `V6-A03`, `V6-B02`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 4.3
- **Scope:**
  - left rail for template meta + sections
  - center list for compact question rows
  - right properties panel for question editing
- **DoD:**
  - no giant accordion-first editing model
  - question row supports number/type/required/modality signals
  - section-first editing works smoothly
- **Acceptance / smoke:**
  - create section
  - add question
  - edit question properties on the right
  - reorder question inside section

### V6-B04 — Question quality evaluator

- **Target release:** R1
- **Spec:** draft
- **Impl:** todo
- **QA:** not_tested
- **Deps:** `V6-B02`, `V6-B03`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 4.5
- **Scope:**
  - lint generated and manual questions
  - show actionable warnings and rewrites
- **DoD:**
  - detects too-long, double-barreled, leading, vague questions
  - offers AI rewrite suggestions
  - warnings are non-blocking in draft, blocking only for hard policy violations if configured
- **Acceptance / smoke:**
  - create weak question
  - system flags issue
  - accept improved rewrite

### V6-B05 — Template lifecycle and reuse

- **Target release:** R0
- **Spec:** draft
- **Impl:** todo
- **QA:** not_tested
- **Deps:** `V6-A03`, `V6-B01`, `V6-B03`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 4, `INTERVIEW_TEMPLATES_LIBRARY_V6.md`
- **Scope:**
  - draft / approved / archived
  - duplicate from system to private/org
  - preview before send
- **DoD:**
  - lifecycle is explicit in UI and API
  - duplication preserves sections/questions/modalities
  - only approved templates can be assigned
- **Acceptance / smoke:**
  - duplicate system template to private
  - publish organization template
  - assign approved template

## 3.3 WS-C Runtime

### V6-C01 — Respondent runtime one-question flow

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** not_tested
- **Deps:** `V6-A02`, `V6-A01`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 2.2, 5.2
- **Scope:**
  - one question per screen
  - left mini rail
  - lightweight progress `X z Y`
  - bottom navigation row
- **DoD:**
  - respondent sees only essential UI
  - no preview-pane style overload
  - keyboard and save flow are defined
- **Acceptance / smoke:**
  - answer 3 questions in sequence
  - navigate back/save/next
  - left rail updates current position

### V6-C02 — Voice answer + transcript approval

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** not_tested
- **Deps:** `V6-C01`, `V6-A01`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 2.3, 5.6
- **Scope:**
  - record voice
  - transcribe
  - edit transcript
  - approve transcript as answer
- **DoD:**
  - transcript approval is required before continue
  - audio remains linked evidence
  - failure state and retry are handled
- **Acceptance / smoke:**
  - record voice answer
  - edit transcript
  - save approved transcript

### V6-C03 — Supporting evidence composer

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** not_tested
- **Deps:** `V6-C01`, `V6-A01`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 5.3, 7.2
- **Scope:**
  - attach file
  - add link
  - add context note
  - optional evidence prompt text per question
- **DoD:**
  - evidence UI is quiet and optional
  - file/link/note are stored on answer
  - question can signal evidence recommendation
- **Acceptance / smoke:**
  - attach file to answer
  - add link
  - save context note

### V6-C04 — Reviewer mode redesign

- **Target release:** R1
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-C01`, `V6-C03`, `V6-D03`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 5.7
- **Scope:**
  - separate UI for reviewer
  - evidence completeness and send-back flow
  - missing items view
- **DoD:**
  - reviewer chrome is separate from respondent chrome
  - gaps and evidence are visible without clutter
  - approve/send-back parity with backend contract
- **Acceptance / smoke:**
  - reviewer opens submitted interview
  - sends back with missing items
  - respondent sees rework reason

### V6-C05 — Runtime polish: mobile, accessibility, performance

- **Target release:** R1
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-C01`, `V6-C02`, `V6-C03`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 10
- **Scope:**
  - mobile layout
  - keyboard support
  - audio fallback states
  - performance for long templates
- **DoD:**
  - runtime is usable on laptop and mobile widths
  - no layout jank between answer types
  - accessibility labels exist
- **Acceptance / smoke:**
  - complete interview on narrow viewport
  - tab/enter/esc shortcuts behave correctly

## 3.4 WS-D Knowledge & Evidence

### V6-D01 — Evidence ingestion pipeline

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-A01`, `V6-C02`, `V6-C03`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 7.3
- **Scope:**
  - normalize transcript, attachments, links, notes
  - create evidence records with answer/form/template metadata
- **DoD:**
  - every answer asset gets canonical evidence metadata
  - duplicates can be detected by hash/ref
  - transcript and audio are linked
- **Acceptance / smoke:**
  - submit answer with transcript + file + link
  - verify evidence rows and metadata

### V6-D02 — Context knowledge base linking

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-D01`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 7.3, `TOOLS_KNOWLEDGE_BANK_V3.md`
- **Scope:**
  - ingest selected answer evidence into contextual knowledge layer
  - keep pointer back to answer/evidence id
- **DoD:**
  - attachments and links are usable as contextual knowledge
  - knowledge item retains source answer trace
  - access rules are preserved
- **Acceptance / smoke:**
  - upload file in interview
  - verify linked knowledge item exists
  - open source answer from knowledge view

### V6-D03 — Link graph and traceability for interview evidence

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-D01`, `V6-D02`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 7.4, `LINK_GRAPH_V3.md`, `SOURCE_TRACEABILITY_SPEC.md`
- **Scope:**
  - backlinks and trace links from insights to answers/evidence
  - embedded references where appropriate
- **DoD:**
  - source answer/evidence -> insight links are queryable
  - restricted objects stay restricted
  - UI can open source artefact directly
- **Acceptance / smoke:**
  - open insight
  - click source evidence
  - navigate to original answer

### V6-D04 — Retrieval over interview knowledge context

- **Target release:** R1
- **Spec:** draft
- **Impl:** todo
- **QA:** not_tested
- **Deps:** `V6-D02`, `V6-E02`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 7.3, `TOOLS_KNOWLEDGE_BANK_V3.md`
- **Scope:**
  - search and retrieval across interview-derived context
  - filter by template, project, organization, theme
- **DoD:**
  - query layer supports interview evidence reuse
  - results keep traceability to source answers
  - retrieval can feed insight generation safely
- **Acceptance / smoke:**
  - search by theme/entity
  - retrieve supporting answer transcripts and links

## 3.5 WS-E Insights

### V6-E01 — Insight report shell

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-A02`, `V6-D03`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 6.2, 6.3
- **Scope:**
  - report layout
  - executive summary
  - themes/issues/opportunities sections
  - evidence map and source answers surface
- **DoD:**
  - report is readable as consulting brief
  - not a dashboard of random widgets
  - source layer is always accessible
- **Acceptance / smoke:**
  - create insight from approved interview
  - open report
  - inspect source answer links

### V6-E02 — AI synthesis engine for themes/issues/opportunities

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-D01`, `V6-D02`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 6.2, 6.5
- **Scope:**
  - theme extraction
  - issue and opportunity clustering
  - signal detection "between the lines"
- **DoD:**
  - synthesis respects three-layer truth model
  - no automatic action plans are created
  - missing evidence is surfaced, not hidden
- **Acceptance / smoke:**
  - run synthesis on sample set
  - verify themes + issues + opportunities appear
  - verify no recommendations payload is produced

### V6-E03 — Evidence map and source drilldown

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-D03`, `V6-E01`, `V6-E02`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 6.4
- **Scope:**
  - evidence strength markers
  - direct drilldown from insight to answer/evidence/transcript
  - contradiction / missing-data markers
- **DoD:**
  - every major insight card can show evidence links
  - drilldown is one click away
  - unsupported claims are clearly marked
- **Acceptance / smoke:**
  - open theme card
  - inspect evidence list
  - jump to source transcript and attachment

### V6-E04 — Multi-session aggregation

- **Target release:** R1
- **Spec:** draft
- **Impl:** todo
- **QA:** not_tested
- **Deps:** `V6-E02`, `V6-D04`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 9.5
- **Scope:**
  - combine several interviews and insights
  - surface recurring themes and contradictions across sessions
- **DoD:**
  - one insight can read from multiple forms
  - system distinguishes single-session fact from cross-session pattern
  - org/project scoping remains safe
- **Acceptance / smoke:**
  - aggregate 3 interview runs
  - surface recurring issue across respondents

## 3.6 WS-F Library & Delivery

### V6-F01 — Seed system template library

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-B01`, `V6-B05`
- **SSOT:** `INTERVIEW_TEMPLATES_LIBRARY_V6.md` 5
- **Scope:**
  - seed 18 system templates
  - assign format: Pulse / Standard / Deep Dive
  - package metadata and descriptions
- **DoD:**
  - all 18 templates exist in seed library
  - each has sections, modalities, estimated time, audience
  - preview data is production-quality
- **Acceptance / smoke:**
  - browse all seeded templates
  - duplicate one to private
  - send one as assignment

### V6-F02 — Canonical answer modality guidance and AI generation rules

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-A01`
- **SSOT:** `INTERVIEW_TEMPLATES_LIBRARY_V6.md` 4, 6, 7
- **Scope:**
  - define answer schemas and modality rules
  - feed AI builder with survey-quality heuristics
- **DoD:**
  - AI generation prompt pack exists
  - modality mapping exists for core question families
  - quality rules are enforceable in builder
- **Acceptance / smoke:**
  - generate template with correct modality suggestions
  - verify evidence-heavy question gets attachment/link prompt

### V6-F03 — Smoke pack, demo script and release gate

- **Target release:** R0
- **Spec:** locked
- **Impl:** done
- **QA:** smoke_passed
- **Deps:** `V6-B05`, `V6-C03`, `V6-D03`, `V6-E03`, `V6-F01`
- **SSOT:** `INTERVIEW_KNOWLEDGE_COLLECTION_SYSTEM_V6.md` 11
- **Scope:**
  - end-to-end smoke scripts
  - demo story
  - release checklist
- **DoD:**
  - one canonical smoke script exists
  - demo can show builder -> send -> answer -> insight
  - gate criteria are explicit
- **Acceptance / smoke:**
  - run V6 demo script successfully end-to-end

---

## 4) Execution order

### Wave 1 — Foundations

- `V6-A01`
- `V6-A02`
- `V6-A03`
- `V6-F02`

### Wave 2 — Core user-facing redesign

- `V6-B01`
- `V6-B02`
- `V6-B03`
- `V6-B05`
- `V6-C01`
- `V6-C02`
- `V6-C03`

### Wave 3 — Knowledge and insights

- `V6-D01`
- `V6-D02`
- `V6-D03`
- `V6-E01`
- `V6-E02`
- `V6-E03`
- `V6-F01`
- `V6-F03`

### Wave 4 — Hardening

- `V6-B04`
- `V6-C04`
- `V6-C05`
- `V6-D04`
- `V6-E04`

---

## 5) R0 cutline

**R0 MUST:**

- `V6-A01`
- `V6-A02`
- `V6-A03`
- `V6-B01`
- `V6-B02`
- `V6-B03`
- `V6-B05`
- `V6-C01`
- `V6-C02`
- `V6-C03`
- `V6-D01`
- `V6-D02`
- `V6-D03`
- `V6-E01`
- `V6-E02`
- `V6-E03`
- `V6-F01`
- `V6-F02`
- `V6-F03`

---

## 6) Canonical smoke script (R0)

### A) Template creation

- Open `Templates Studio`
- Select `Create with AI`
- Enter discovery brief
- Generate template draft
- Refine one question
- Save as private
- Publish or duplicate to organization

### B) Assignment

- Create assignment from approved template
- Assign to respondent

### C) Respondent runtime

- Open assignment
- Answer one question by text
- Answer one question by voice -> transcript -> approve
- Add file + link + context note
- Submit

### D) Reviewer flow

- Reviewer opens submission
- Sees answers and evidence
- Approves

### E) Knowledge pipeline

- Verify linked evidence exists in contextual knowledge layer
- Verify source answer trace remains intact

### F) Insight report

- Generate insight from approved interview
- Open report
- See summary, themes, issues, opportunities
- Drill into evidence and source answers

---

## 7) Release gate

V6 R0 jest gotowe dopiero, gdy:

- builder AI-first działa end-to-end,
- respondent runtime nie jest przeładowany,
- voice + transcript approval działa,
- attachments i links są linked evidence,
- insight ma evidence drilldown,
- seeded system library istnieje,
- smoke script przechodzi bez ręcznych obejść.

---

## 8) Progress log

| Date | Done | Notes / link |
| --- | --- | --- |
| 2026-03-08 | V6-A01 data contract | Migrations 665-668: template foundation, runtime answers, answer_design_guide, helper fields |
| 2026-03-09 | V6-C01 runtime one-question flow | Left mini rail, all answer types (multi_choice, date, dropdown), keyboard shortcuts, review screen |
| 2026-03-09 | V6-C02 voice + transcript approval | Voice recording, STT, transcript approval gate (must approve before continue) |
| 2026-03-09 | V6-C03 evidence composer | File upload, link, context note, evidence prompt display per question |
| 2026-03-09 | V6-A02 surface split | Hub tabs already route to 3 surfaces (TemplateBuilder, InterviewWorkspace, InsightViewer) |
| 2026-03-09 | V6-A03 scope + permissions | canAccessTemplate with system/organization/private logic already implemented |
| 2026-03-09 | V6-D01 evidence ingestion | normalizeAnswerEvidence helper: auto-creates evidence records for answer_text, voice_transcript, context_note |
| 2026-03-09 | V6-D02 knowledge linking | Evidence ingested into knowledge_docs, knowledge_document_id linked back to evidence + question |
| 2026-03-09 | V6-D03 link graph traceability | link_graph_edges: evidence→question (ref), insight→session (created_from), insight→evidence (ref) |
| 2026-03-09 | V6-E01 insight report shell | 6 new V6 sections in InsightViewer: themes, issues, opportunities, signals, evidence-map, missing-data |
| 2026-03-09 | V6-E02 AI synthesis engine | Three-layer truth model prompt: source answers → AI synthesis → consulting interpretation. Migration 670 |
| 2026-03-09 | V6-E03 evidence drilldown | Clickable evidence refs with inline expansion showing source question + answer + linked themes |
| 2026-03-09 | V6-F01 seed library | 18 system templates (T01-T18), 100 questions. Migration 669 |
| 2026-03-09 | V6-F02 modality guidance | interviewModalityGuide.ts: ANSWER_MODALITY_RULES, QUESTION_FAMILY_MODALITY_MAP, buildAIGenerationPromptPack |
| 2026-03-09 | V6-C04 reviewer mode | Separate reviewer chrome: read-only answers, evidence completeness, send-back form, approve button |
| 2026-03-09 | V6-C05 runtime polish | Mobile category switcher, aria-labels, aria-current, useMemo for renderInput |
| 2026-03-09 | V6-F03 smoke pack | smoke-v6-interview.ts: 30/30 checks passed |

## 9) Current blockers

| Date | Blocker | Blocks tasks | Owner | Status | Next step |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — |
