# Interview Module — Ecosystem Integration & Competitive Benchmark Audit

**Date:** 2026-06-05
**Branch:** `feat/wave1-foundations`
**Scope:** The *seams* between the Interview module and the rest of Consultify (data flowing OUT), plus the competitive frame vs. category-leading research/interview tools. **NOT** in scope: deep internals of interview/discovery/enterprise capability (separate agents).
**Method:** Code-verified trace of every outbound flow + market benchmark using public product docs (June 2026).

---

## Scores

| Dimension | Score | One-line justification |
|---|---|---|
| **Ecosystem integration** | **54 / 100** | Three of the six outbound flows are real (report-builder read, org-context bidirectional, report-pack export). Two flagship "handoffs" (→tools, →assessment) are **write-only at the AI layer** — the consumer prompt-builders read snapshot keys the exporter never writes. The →initiatives bridge can *link* but cannot *create*, and there is no →decision/→task bridge. Parallel data models (P10 findings vs. legacy `summary_*`) mean the report-builder path silently bypasses the flagship evidence layer. |
| **Benchmark vs. market** | **61 / 100** | On *governance, evidence-discipline, and enterprise workflow* Consultify is ahead of Dovetail/Marvin/Condens. On *raw capture-to-synthesis ergonomics* (transcription, auto-tagging, affinity mapping, highlight reels, repository search) it is materially behind. The product is positioned as a *governed consulting evidence system*, not a *research repository* — which is the right wedge for B2B consulting, but the parity gaps will be felt the moment a buyer trials it next to Dovetail. |

> **Headline:** The interview module's *internal* P10 evidence model is genuinely differentiated, but the **ecosystem wiring leaks it**. The two most-marketed handoffs (insight→Tools, insight→Assessment) create downstream rows whose `context_snapshot` payloads are structurally **never read by the AI generators that consume them** — the exact "written-but-never-read" failure class. This is the #1 thing to fix.

---

## Ecosystem Matrix

| Outbound flow | Wired? | Lossless? | Consumed downstream? | Notes |
|---|---|---|---|---|
| **Interview → Report Builder** | ✅ Yes | ⚠️ Partial | ✅ Yes (UI + template) | `report-builder.routes.ts:490-585` reads `interview_sessions.summary_facts/gaps/constraints/pain_points` + full Q&A (confidence, tags) + notes. Real & reasonably lossless **on the legacy summary model**. But it reads NONE of the P10 findings / evidence pointers — the flagship layer is bypassed (parallel data models). `INTERVIEW` is the canonical template (Canvas + Upload-bundle fall back to it). |
| **Insight → Tools** (`export?target=tools`) | ✅ Row created | ⚠️ Snapshot complete | ❌ **Not at AI layer** | `routes/v8/interview.routes.ts:1310-1359` writes a `tool_sessions` row with `context_snapshot = { source, boundedInsightPayload, organizationContext }`. The Tools AI generator (`ToolInitiativeService.ts:152-161`) reads `context?.org` — a key the exporter **never writes**. Findings reach the prompt ONLY if `includeChatContext=true`, and then only as an undifferentiated `JSON.stringify(context)` dump (`ToolInitiativeService.ts:87`). Snapshot IS returned to the UI on GET (`ToolController.ts:950`). |
| **Insight → Assessment** (`export?target=assessment`) | ✅ Row created | ⚠️ Snapshot complete | ❌ **Write-only at AI layer** | `routes/v8/interview.routes.ts:1387-1452` writes an `assessments` row with the same snapshot shape. The assessment initiative generator (`assessmentInitiativeService.ts:345-372`) reads `contextSnapshot.org`, `.report`, `.chat`, `.existingInitiatives` — **none of which the interview exporter writes** (`boundedInsightPayload`/`source`/`organizationContext` are silently dropped). The DRD assessment is created empty and the interview evidence never reaches generation. |
| **Report Pack → client export** | ✅ Yes | ⚠️ Lossy on flagship worksheet | ✅ Yes (markdown + manifest) | `interviewInsightReportPackService.ts:1045-1132`. Strong governance: publish-gating, readiness blockers/warnings, completeness %, manifest hash, degraded-reason surfacing, immutable revisions. BUT (a) the **`findings_p10` worksheet is stubbed empty** ("must be attached in the next phase", `:653-660`) — the headline differentiator is absent from the client report; (b) `respondent_profile` and `person_topic_matrix` are also stubbed; (c) worksheet rows render as **raw ```json blocks** (`:371`) — the same "degenerate rows" anti-pattern the Canvas export bar just raised. |
| **Interview → Initiatives** | ⚠️ Link-only | n/a | ⚠️ Partial | `routes/v8/interview-insights.routes.ts:641-768`. Can LINK a finding to an *existing* initiative (validates row exists, `:694-705`); with no target it mints an orphan `handoff_req_<uuid>` placeholder (`:707`) that **no consumer ever materializes into a real `initiatives` row**. There is NO create-initiative path (contrast Canvas `canvasMaterialize.ts`). The one real win: the finding propagates into org-context as a `signals.interviewFindings` claim (`:736-754`) — genuinely bidirectional. |
| **Interview → Decisions / Tasks** | ❌ No | — | — | No bridge exists. Canvas promotes to decisions; interview findings cannot. |
| **Organization Context → Interview AI** (in-bound, but a seam) | ✅ Yes | ✅ Yes | ✅ Yes | `interviewInferenceService.ts:106-122` calls `buildResolvedContext` and injects it into the structured prompt via `llmService.call` (`:153-162`). Controller wires it at 8+ points (`InterviewController.ts:4656, 6086, 6299, 6997`). **Bidirectional**: interview answers/evidence feed BACK into context (`recordInterviewAnswer:5196`, `recordInterviewEvidence:5755`, `recordInterviewContext:6225` → claim paths `operations.interviewAnswers`, `evidence.documentExtraction`). Doc upload→ingest→chunk→queue→claim pipeline is real (`ContextDocumentService.ts`). This is the strongest seam in the module. |

---

## P0 Ecosystem Breaks (file:line)

### P0-1 — Insight→Assessment handoff is write-only at the AI layer
**`routes/v8/interview.routes.ts:1408-1421`** writes `context_snapshot = { source, boundedInsightPayload, organizationContext }`.
**`server/src/services/assessmentInitiativeService.ts:345-372`** — the prompt builder reads:
```ts
if (contextSnapshot.org)               { prompt += ... }   // never written by interview export
if (contextSnapshot.report)            { prompt += ... }   // never written
contextSnapshot.chat / chatContext     // never written
contextSnapshot.existingInitiatives    // never written
```
The interview keys (`boundedInsightPayload`, `source`, `organizationContext`) are **not read anywhere**. Result: a consultant clicks "export to Assessment," a DRD assessment is created, and the AI that generates its initiatives sees **zero interview evidence**. The handoff is a UI illusion at the generation layer.
**Severity:** P0 — silently lossy, marketed feature, no error surfaced.

### P0-2 — Insight→Tools handoff: key-name mismatch + unstructured dump
**`routes/v8/interview.routes.ts:1330-1343`** writes `organizationContext` + `boundedInsightPayload`.
**`server/src/services/ToolInitiativeService.ts:160`**:
```ts
context: includeChatContext ? context : { org: context?.org || {} }
```
When `includeChatContext=false` (a plausible default), only `context.org` survives — which the interview export never writes → **empty context**. When `true`, the entire snapshot is `JSON.stringify`'d raw into the prompt (`:87`) with no field mapping, no evidence-pointer structure, no confidence framing. The P10 evidence discipline is lost in translation.
**Severity:** P0 (conditional) — at minimum lossy, at worst empty.

### P0-3 — `findings_p10` worksheet stubbed empty in the client report pack
**`server/src/services/interviewInsightReportPackService.ts:653-660`**:
```ts
case 'findings_p10':
  return worksheet({ key, title, warnings: ['P10 findings are governed separately and must be attached in the next phase.'] });
```
The single most differentiated artifact in the whole module — evidence-bounded, readback-confirmed findings — is **absent from the client-facing report pack**. The pack ships opportunities (as `hypothesis`) and evidence map, but not the governed findings. Buyers see the scaffolding, not the payload.
**Severity:** P0 — guts the value of the export.

### P0-4 — Report-pack markdown renders rows as raw JSON
**`interviewInsightReportPackService.ts:368-373`** dumps `JSON.stringify(row, null, 2)` inside ```json fences for every worksheet row. This is the *exact* degenerate-row pattern the Canvas export quality bar was just raised to eliminate. A "client-ready" markdown export that contains raw JSON objects is not client-ready.
**Severity:** P0 — fails the export quality bar already set for Canvas.

### P1-5 — Interview→Initiatives produces orphan placeholders
**`routes/v8/interview-insights.routes.ts:707`** mints `handoff_req_<uuid>` with no downstream materialization. Compared to Canvas (`canvasMaterialize.ts` promotes to canonical entities), interview findings cannot become real initiatives. Only the *link-to-existing* path is real.
**Severity:** P1 — degraded, not broken (link path works; context claim is recorded).

### P1-6 — Parallel data models: report-builder bypasses P10 layer
**`report-builder.routes.ts:564-576`** reads `summary_facts/gaps/constraints/pain_points` + raw Q&A. The newer P10 findings/evidence-pointer model (`interviewInsightFindingsService.ts`) is a *separate* artifact the report-builder source-read never touches. Two evidence representations, neither aware of the other in the report path.
**Severity:** P1 — architectural debt that compounds P0-3.

### Note — divergent LLM path in the handoff *targets* (not the interview module itself)
The interview module is clean: every AI call routes through `llmService.call` with structured output + schema (`interviewInferenceService.ts:153`, `teresaCopilotService.ts:845`), org context injected, no ad-hoc OpenAI/Anthropic clients, bounded `maxTokens`, input passed to constrained classifiers (low injection risk). **However**, the *consumers* of its handoffs diverge: `assessmentInitiativeService.ts:397` uses `generateChatResponse` + hardcoded `gpt-4o-mini`; `ToolInitiativeService` uses a separate `aiPipeline`. So the moment evidence crosses the seam it leaves the governed path. Worth flagging for the system-unification program.

---

## Part B — Benchmark vs. Category Leaders

The benchmark set splits into two camps with different jobs-to-be-done:

- **Research repositories** (Dovetail, Marvin/Hey Marvin, Condens): the gold standard for *qualitative capture → tagging → themes → insights → evidence-linked highlight reels*.
- **Capture/transcription** (Otter.ai, Fireflies): real-time/async meeting capture + AI summary + speaker diarization.
- **Structured research** (Maze, UserTesting): templated study design + automated synthesis.
- **Consulting practice** (McKinsey/Bain interview guides): structured guide → evidence → hypothesis → recommendation chains, with explicit confidence/disconfirmation discipline.

Consultify sits in a *fourth* space: a **governed evidence system for B2B consulting** — which is genuinely under-served by all four camps. That's the strategic opening. But the parity gaps below are what a buyer notices in the first 20 minutes of a side-by-side trial.

### Top-5 Parity Gaps (what we're missing)

| # | Gap | Who does it | Consultify state | Impact |
|---|---|---|---|---|
| **1** | **Transcript capture + auto-transcription** | Dovetail Magic, Marvin, Otter, Fireflies all ingest audio/video → speaker-diarized transcript automatically. | Consultify is **answer-text-centric** (`interview_questions.answer_text`); no audio/transcript ingest in the interview path (Fireflies/transcript services exist as MCP connectors, not wired into the module). | A consultant recording a live stakeholder call has to manually transcribe/paste. This is table-stakes for the category and the single biggest ergonomic gap. |
| **2** | **Auto-tagging / theme auto-clustering / affinity mapping** | Condens auto-clusters insights; Dovetail Magic auto-classifies highlights against your existing tag taxonomy; Marvin AI tags. | Consultify has themes/issues/signals as *AI-generated insight output* (`interviewInferenceService`), but no **interactive tagging workspace** — no human-in-the-loop highlight→tag→theme affinity board. Synthesis is one-shot AI, not iterative curation. | Researchers expect to *drive* synthesis, not just receive it. The P10 model is rigorous but the *curation UX* is missing. |
| **3** | **Evidence-linked highlight reels** | Dovetail/Condens: pull tagged moments into shareable reels ("5 users hit the same wall"); every tag links to source + timestamp + participant. | Consultify has evidence *pointers* (P10) — structurally superior for audit — but no **media-anchored, shareable highlight clip** artifact. Pointers reference answer IDs, not timestamps in a recording. | Stakeholder persuasion: watching users struggle beats reading quotes. We can't produce that artifact. |
| **4** | **Cross-study repository search (semantic)** | Condens & Dovetail: natural-language search across all published findings/insights across all studies. | Org-context retrieval exists (`ContextRetrievalService`, doc chunking), but there's no **interview-specific semantic repository search** across sessions/findings ("show me every finding about pricing across all 12 interviews"). | As an org accumulates interviews, findings become un-discoverable. Repository tools win on longitudinal value. |
| **5** | **Real-time collaborative synthesis** | Dovetail/Marvin: multiple researchers tag the same transcript live, comment, react. | Consultify has assignment/RBAC workflow (strong) but synthesis itself is not a live collaborative canvas. | Team research feels sequential, not collaborative. |

### Top-5 Differentiators (the moat — what we have that they DON'T)

| # | Differentiator | Why it matters for B2B consulting | Evidence in code |
|---|---|---|---|
| **1** | **P10 evidence-bounded findings model** — every finding carries confidence level, explicit `limits`, `nextAction`, evidence pointers, and a **client-readback-confirmation gate** before it can be handed off or reported. | This is the McKinsey/Bain evidence→hypothesis→recommendation discipline *enforced in software*. No research repository forces "you cannot publish this finding until the client confirms the readback." This is the consulting-grade trust layer none of Dovetail/Marvin/Condens have. | `interviewInsightFindingsService.ts:1118-1153` (`canPublishFinding`, `readback_status !== 'confirmed_by_client'` blocks handoff); per-confidence guards. |
| **2** | **Assignment + RBAC interview workflow** | Consultants run *engagements* with delegated interviewers, approval gates, and manager scope. Research tools assume a flat researcher team. Consultify gates export on `assignment.status ∈ {approved, completed}` (`interview.routes.ts:1236-1253`). | `InterviewAssignmentService.ts`, `interviewManagerScope.ts`, permission `INTERVIEW_INSIGHTS_HANDOFF`. |
| **3** | **Bidirectional organization-context injection** | The interview AI is grounded in the client org's resolved context (industry, prior answers, uploaded docs), AND interview answers feed *back* into that context as confidence-weighted claims. No research tool has a persistent, claim-graph org memory that interviews both read from and write to. | `interviewInferenceService.ts:106-122`; `recordInterviewAnswer/Evidence/Context`; claim paths `operations.interviewAnswers`, `evidence.documentExtraction`, `signals.interviewFindings`. |
| **4** | **Governed handoff-to-execution surface** | The *intent* to route a finding → Tools (SWOT/strategy), → Assessment (DRD), → Initiatives is unique: research repositories end at "insight," Consultify aims to continue into transformation execution. (The wiring is broken per P0-1/P0-2, but the *architecture* — bounded payloads, audit log, export ledger — is a real moat once fixed.) | `interview.routes.ts:1257-1452` (export ledger `interview_insight_exports`); `recordHandoff` + `interview_insight_handoffs` audit. |
| **5** | **Material-quality + degraded-state governance on the deliverable** | The report pack computes answer-quality posture, coverage posture, recommendation posture, confidence-downgrade-required flags, and refuses to let thin evidence masquerade as decision-ready. Research tools will happily export a confident-looking insight from one interview. | `interviewInsightReportPackService.ts:455-488` (`materialQualityWarnings`), publish-gating + readiness blockers. |

**Net competitive read:** Consultify is **not** trying to out-Dovetail Dovetail on capture ergonomics, and shouldn't. Its moat is *governance + evidence discipline + handoff-to-execution* — exactly what a Big-4/boutique consultancy needs and exactly what no research repository provides. The risk is that the moat features (P10 findings, handoffs) are the ones currently **leaking at the seams**, while the parity gaps (transcription, tagging UX) are the ones a buyer feels first.

---

## Strategic Recommendation — make Interview world-class for B2B consulting

**Thesis:** Do not chase Dovetail on capture. *Seal the evidence pipeline end-to-end* so the P10 model — the actual moat — survives every hop from interview → finding → report → execution. Then add the minimum capture ergonomics to clear the trial bar.

### Ranked roadmap (S / M / L)

**S — Seal the leaks (do first; these are correctness bugs, not features)**
1. **[S] Fix P0-1 & P0-2 key-mismatch handoffs.** Either (a) map the interview snapshot into the keys the consumers read (`contextSnapshot.org` ← `organizationContext`; add an `interviewEvidence` block the generators actually read), or (b) make `assessmentInitiativeService`/`ToolInitiativeService` read `boundedInsightPayload`. Add an integration test that asserts a finding statement appears in the generated prompt. *Highest ROI in the whole audit — restores two marketed features.*
2. **[S] Attach P10 findings to the report pack (P0-3).** Wire `listFindings`/`buildSourcePack` into the `findings_p10` worksheet. The data already exists; the worksheet just has a TODO.
3. **[S] Render report-pack rows as prose/tables, not raw JSON (P0-4).** Reuse whatever renderer the Canvas export-quality fix introduced. One shared markdown serializer for both.
4. **[S] Surface a clear error when a handoff would be lossy** instead of silently creating an empty downstream row.

**M — Close the architecture gaps**
5. **[M] Real Interview→Initiative *create* path (P1-5).** Materialize `handoff_request` placeholders into actual `initiatives` rows via the same canonical service Canvas uses (`canvasMaterialize.ts`). Add Interview→Decision and Interview→Task while you're in there — findings with `nextAction` are natural tasks.
6. **[M] Unify the two evidence models (P1-6).** Make the report-builder INTERVIEW source-read consume P10 findings, or migrate `summary_*` to be a projection of findings. Stop maintaining two parallel truths.
7. **[M] Route handoff-target generators through `llmService`** so evidence stays on the governed path (kill the `gpt-4o-mini`/`generateChatResponse` divergence in `assessmentInitiativeService`).
8. **[M] Interview repository semantic search** across sessions/findings — reuse `ContextRetrievalService` chunking, scoped to interview artifacts. Closes parity gap #4, leverages infra you already have.

**L — Capture ergonomics to clear the trial bar (only after the pipeline is sealed)**
9. **[L] Wire transcript/audio ingest** (the Fireflies MCP connector exists; bridge it into a session → auto-transcribe → answer extraction flow). Closes the #1 parity gap.
10. **[L] Interactive tagging + affinity workspace** with human-in-the-loop theme curation, anchored on evidence pointers (which already exist) — turn one-shot AI synthesis into iterative, defensible synthesis. Closes parity gaps #2 & #3; timestamps would also unlock highlight reels once audio is ingested.
11. **[L] Collaborative live synthesis canvas** (parity gap #5) — lower priority; the assignment/RBAC model already covers the *governance* half of team research.

### The one sentence
> Consultify's interview module has a better *evidence model* than Dovetail and a better *workflow model* than Otter, but it currently spills that advantage at every handoff seam; spend the next sprint making the P10 finding survive end-to-end before adding a single new capability.

---

## Appendix — Files traced

- `server/src/services/v8/interviewInsightFindingsService.ts` (P10 model, `buildHandoffPayload`, `buildSourcePack`, `recordHandoff`)
- `server/src/routes/v8/interview.routes.ts:1178-1460` (insight export → tools/assessment)
- `server/src/routes/v8/interview-insights.routes.ts:641-768` (finding → initiative handoff)
- `server/src/services/assessmentInitiativeService.ts:300-419` (assessment generator — key mismatch)
- `server/src/services/ToolInitiativeService.ts:64-198` (tool generator — key mismatch)
- `server/src/controllers/AssessmentController.ts:1696-1715` (assessment context_snapshot consumption)
- `server/src/controllers/ToolController.ts:614-975` (tool_sessions snapshot read)
- `server/src/services/interviewInsightReportPackService.ts:354-1132` (report pack draft + export)
- `server/src/routes/report-builder.routes.ts:490-591` (Interview→Report source read)
- `server/src/services/reportBuilderService.ts:505-563` (INTERVIEW template resolution)
- `server/src/services/interviewInferenceService.ts:95-164` (org-context → interview AI)
- `server/src/services/organizationContext/OrganizationContextService.ts` (`buildResolvedContext`, claim paths)
- `server/src/services/organizationContext/ContextDocumentService.ts` (doc ingest pipeline)
- `server/src/services/v8/teresaCopilotService.ts:828-888` (Teresa LLM path, intent classifier)
- `server/src/services/canvasMaterialize.ts` (Canvas promote — comparison bar)

**Benchmark sources:**
- [Dovetail AI / Magic (docs)](https://docs.dovetail.com/help/dovetail-ai), [Dovetail review 2025 (Nerdisa)](https://nerdisa.com/dovetail/), [Dovetail/Condens transcript→highlights→themes workflow](https://gotranscript.com/en/blog/dovetail-condens-style-workflow-transcript-highlights-themes)
- [Marvin vs Condens (heymarvin)](https://heymarvin.com/resources/research-repository-tools), [Condens Marvin alternative](https://condens.io/marvin-alternative/), [Best UX research repository tools 2026 (Koji)](https://www.koji.so/blog/best-ux-research-repository-tools-2026)
