# Dynamic SWOT Tool Spec V1

> Status: proposed  
> Scope: `Tools -> Dynamic SWOT`  
> Applies to: runtime UX, AI conversation flow, output contract, traceability  
> Related SSOT:
> - `docs/product/CONSULTING_TOOLS_V3.md`
> - `docs/product/CONSULTING_TOOLS_STANDARD_V1.md`
> - `docs/product/V3_IMPLEMENTATION_PROGRAM.md`
> - `docs/ui-standards/FROZEN_LAYOUTS.md`
> - `docs/ui-standards/03-modules/module-hub-standard.md`
> - `docs/ui-standards/01-shell-layout/artifact-shell.md`

---

## 1. Purpose

`Dynamic SWOT` is not a static 2x2 matrix editor.

It is a guided consulting tool that:

1. helps the user understand the current strategic reality,
2. turns raw observations into structured SWOT evidence,
3. identifies strategic tensions and correlations,
4. converts those tensions into recommended moves,
5. turns analysis into applied conclusions and one final source summary,
6. ends with one or more traceable outputs:
   - initiatives,
   - reports,
   - presentations,
   - ideas.

The core promise is:

> user enters a conversation, leaves with concrete strategic action.

---

## 2. Product Positioning

`Dynamic SWOT` should feel like:

- a strategic expedition,
- a conversation with an AI co-strategist,
- a structured consulting workflow,
- a launchpad for downstream outputs.

`Dynamic SWOT` should not feel like:

- a school-template matrix,
- a dead-end analysis,
- a passive note-taking form,
- a one-shot AI answer box.

---

## 3. Non-Negotiable Outcome

Success is not:

- "user filled four quadrants".

Success is:

- the user surfaced meaningful signals,
- the user understood the most important strategic tensions,
- the user received AI-supported candidate moves,
- the user created at least one traceable next-step artifact.

Final state of a good session should be:

- 1 flagship initiative or idea,
- 2-4 supporting moves,
- optional report,
- optional presentation,
- complete traceability back to the SWOT session.

---

## 4. Placement In The Tools Mental Model

`Dynamic SWOT` follows the canonical tools lifecycle:

**Library -> Session -> Outputs -> Initiatives**

For this tool, the practical flow is:

1. user opens the tool from `Tools -> Library`,
2. user starts a `Tool Session`,
3. user completes guided SWOT work,
4. user finalizes the session,
5. user creates one or more outputs from the session.

`Dynamic SWOT` is therefore:

- a tool session,
- a source artifact,
- not the final deliverable itself.

---

## 5. Core UX Principle

The default interaction model is **conversation-first, structure-backed**.

This means:

- the user should be able to work mainly by talking to AI,
- the system should continuously materialize answers into structured SWOT cards,
- AI should behave as mentor, consultant, and challenger,
- AI should suggest, never silently overwrite,
- the canvas should always show "what has already been captured".

Canonical behavior:

- user speaks or types naturally,
- AI asks short, purposeful questions,
- system classifies answers into SWOT areas,
- user reviews and accepts/rejects/refines entries,
- tool generates tensions and recommended moves,
- user creates outputs.

---

## 6. Screen Architecture

The screen must stay inside existing module standards.

### 6.1 Module shell

Breadcrumb:

- `Tools > Dynamic SWOT`

Topbar order must stay canonical:

- `Area`
- `Add`
- `Tool`
- `View`
- `Filters`

No extra toolbar rows may be added outside the canonical command row.

### 6.2 Main layout

Recommended runtime layout:

- left: session phase navigation,
- center: main work canvas,
- right: persistent AI coach.

Recommended width split:

- left navigation: narrow progress rail
- main canvas: dominant work area
- right panel: persistent support area

### 6.3 Command row

Single canonical row under the topbar.

For `Dynamic SWOT`, the row can show either:

- dynamic tabs for open sessions,
- or contextual chips for stage navigation.

Recommended stage chips:

- `Mission & Context`
- `Input & Exploration`
- `SWOT Build`
- `Synthesis & Insights`
- `Outputs & Actions`

These chips are not extra navigation bars. They live inside the one canonical command row.

---

## 7. Default Runtime Flow

The tool should preserve SWOT logic, but present it as a high-quality consulting journey.

### 7.1 Phase 1 - Mission & Context

Goal:

- define the business question before analysis starts and establish the frame of the decision.

User answers:

- what decision are we trying to make,
- what scope is in play,
- what time horizon matters,
- what would count as success,
- what constraints or assumptions must be kept in view.

UI blocks:

- `Strategic Question`
- `Scope`
- `Time Horizon`
- `Success Definition`
- `Constraints / Assumptions`

AI behavior:

- asks 3-5 concise questions,
- detects ambiguity,
- proposes sharper goal wording,
- highlights missing business context.

Output of this stage:

- a clean mission brief that anchors the whole session.

### 7.2 Phase 2 - Input & Exploration

Goal:

- gather signals before forcing them into a rigid matrix.

This phase combines three sources of raw material:

1. `Interview`
2. `Materials`
3. `External context`

UI model:

- `Interview`: AI asks adaptive questions and stores structured notes.
- `Materials`: user adds files, links, and internal references that AI summarizes into signals.
- `External context`: AI adds market, trend, and benchmark context with explicit labeling.

Canonical rule:

- everything is normalized into one shared signal model before SWOT construction.

Output of this phase:

- one signal layer that feeds the SWOT matrix.

### 7.3 Phase 3 - SWOT Build

Goal:

- construct a high-quality SWOT from the captured signals.

UI model:

- four columns:
  - `Strengths`
  - `Weaknesses`
  - `Opportunities`
  - `Threats`

Each entry should expose:

- text,
- source,
- confidence,
- evidence type where useful: `fact`, `observation`, `hypothesis`.

AI responsibilities:

- classify signals into quadrants,
- suggest missing items,
- merge duplicates,
- challenge vague wording,
- separate facts from opinion.

### 7.4 Phase 4 - Synthesis & Insights

Goal:

- turn a filled matrix into strategic value.

This is the "aha" phase of the tool.

The phase combines four layers:

1. `Strategic tensions`
2. `Interpretation`
3. `Applied conclusions`
4. `Strategic moves`

The tool should still support the four canonical tension buckets:

- `Attack` = Strength + Opportunity
- `Repair` = Weakness + Opportunity
- `Defend` = Strength + Threat
- `Protect` = Weakness + Threat

Each tension or insight card should contain:

- source pair,
- short explanation,
- why it matters now,
- confidence,
- linked discussion,
- suggested move or implication.

AI behavior:

- generate tensions,
- explain why they matter,
- challenge weak conclusions,
- propose strategic moves,
- support discussion before acceptance.

### 7.5 Phase 5 - Outputs & Actions

Goal:

- turn insight into a source-grade final summary and execution bridges.

This phase contains:

- `Final Summary`
- `Generate Report`
- `Generate Slides`
- `Generate Initiatives`
- `Generated initiatives from this session`

Recommended move categories remain:

- `Quick Win`
- `Big Bet`
- `Defensive Move`
- `Capability Build`

From this phase the user can create:

- one or more initiatives,
- one report,
- one presentation,
- one or more ideas.

This phase is mandatory in the product contract, even if the user chooses to create nothing yet.

The source artifact rule is strict:

- all generated outputs must come from one `final source summary`,
- the session remains the thinking system,
- downstream modules remain the execution and communication system.

---

## 8. SWOT Matrix Visual Language

The matrix should be visually obvious and readable at a glance.

### 8.1 Quadrant colors

Recommended canonical colors:

- `Strengths`: green
- `Weaknesses`: amber or orange
- `Opportunities`: blue or cyan
- `Threats`: red or rose

These colors may appear in:

- quadrant backgrounds,
- badges,
- pills,
- border accents,
- legend chips,
- connection lines.

### 8.2 Color meaning

- green = internal advantage
- amber = internal constraint
- blue = external upside
- red = external risk

### 8.3 Visual rule

Color should help orientation, not dominate the screen.

Use:

- low-saturation surface fills,
- stronger accents for selection,
- stronger contrast only for active or critical elements.

### 8.4 Matrix usage

The classic 2x2 matrix should exist, but not be the only view.

Recommended views:

1. `Story View` - default
2. `Matrix View` - classic SWOT overview
3. `Correlations View` - tension map
4. `Moves View` - recommended action set

Default should be `Story View`, because it is easier for most users.

---

## 9. Detailed UI Specification

### 9.1 Header content

Header should show:

- session title,
- tool type badge,
- progress state,
- saved state,
- contextual actions:
  - help,
  - export,
  - request review,
  - outputs entry.

### 9.2 Main canvas behavior

Main canvas must support:

- structured cards,
- AI suggestions inline,
- card grouping,
- item confidence and completeness,
- lightweight editing,
- drag or click-to-link for correlations,
- clear progression toward outputs.

### 9.3 Right panel content

The right panel should have three fixed zones.

#### A. Mission Pulse

Shows:

- completion score,
- confidence score,
- gaps,
- unresolved questions,
- readiness for finalization.

#### B. AI Co-Strategist

Shows:

- current AI hypothesis,
- current AI question,
- suggested next action,
- recent chat snippets,
- shortcut: `Open chat`.

#### C. Output Candidates

Shows:

- candidate initiatives,
- candidate ideas,
- latest generated outputs,
- CTA shortcuts:
  - `Create initiative`
  - `Create report`
  - `Create presentation`
  - `Create idea`

---

## 10. AI Conversation Contract

AI is a co-strategist, not an autopilot.

### 10.1 Allowed AI behavior

AI may:

- ask focused questions,
- classify user input,
- suggest rewritten entries,
- suggest missing assumptions,
- identify correlations,
- draft recommended moves,
- draft output candidates.

AI may not:

- silently modify accepted user entries,
- auto-finalize the session,
- auto-create outputs,
- pretend certainty where evidence is weak.

### 10.2 Conversation style

Preferred AI style:

- concise,
- executive,
- grounded,
- curious,
- decision-oriented.

AI should sound like:

- an experienced strategy consultant.

AI should not sound like:

- a generic chatbot,
- a verbose lecturer,
- a motivational coach.

### 10.3 Canonical AI loop

At each stage:

1. AI asks a small number of targeted questions.
2. User answers in natural language.
3. AI proposes structured entries.
4. User accepts, edits, or rejects.
5. System updates the canvas.
6. AI suggests the next best question.

### 10.4 Explainability rule

Each strategic suggestion should answer:

- why this matters,
- what evidence supports it,
- what should happen next.

---

## 11. Data Objects Inside The Tool

The user should see the session as a chain of increasingly concrete objects:

1. `Signal`
2. `SWOT Card`
3. `Strategic Tension`
4. `Recommended Move`
5. `Output Candidate`
6. `Created Output`

### 11.1 Signal

Raw observation from:

- user answer,
- imported artifact,
- AI recommendation,
- linked evidence.

### 11.2 SWOT Card

Structured item assigned to one quadrant:

- strength,
- weakness,
- opportunity,
- threat.

### 11.3 Strategic Tension

A meaningful correlation between two or more SWOT cards.

### 11.4 Recommended Move

An actionable strategic response produced from one or more tensions.

### 11.5 Output Candidate

A draft initiative, report, presentation, or idea proposed before creation.

### 11.6 Created Output

A persisted artifact created from the session with traceability.

---

## 12. Output Contract For Dynamic SWOT

This section is specific to `Dynamic SWOT`, but the same pattern should become the default for every tool.

### 12.1 Universal rule

Every finalized tool session should support creating:

- `Initiative`
- `Report`
- `Presentation`
- `Idea`

This is the target-state output contract for the tools platform.

### 12.2 Initiative output

The user can create:

- one initiative,
- or multiple initiatives.

Typical use cases:

- flagship transformation initiative,
- supporting initiative set,
- defensive initiative,
- capability-building initiative.

Each initiative candidate should include:

- title,
- description,
- why now,
- expected impact,
- estimated effort,
- risk level,
- confidence,
- linked SWOT evidence,
- linked tensions,
- linked recommended move.

### 12.3 Report output

The user can create a report from the session.

The report generator should open with SWOT session preselected as source.

Recommended report structure:

1. Executive summary
2. Mission and scope
3. SWOT evidence by quadrant
4. Strategic tensions
5. Recommended moves
6. Initiative recommendations
7. Risks and assumptions
8. Next steps

### 12.4 Presentation output

The user can create a presentation from the session.

The presentation generator should open with SWOT session preselected as source.

Recommended deck flow:

1. Context
2. Strategic question
3. SWOT matrix
4. Key tensions
5. Strategic move options
6. Recommended initiatives
7. Decision ask / next step

### 12.5 Idea output

The user can create one or more ideas from the session.

This is useful when:

- the insight is promising but not mature enough for an initiative,
- the user wants to park opportunity space,
- the team wants to explore multiple directions before planning.

Each idea candidate should include:

- title,
- short problem/opportunity statement,
- reason it emerged from SWOT,
- linked evidence,
- linked tensions,
- suggested next exploration question.

### 12.6 Output creation rules

All outputs must:

- be created only from a valid tool session state,
- preserve traceability,
- support `Open source`,
- preserve version context,
- record source evidence if available.

---

## 13. Cross-Tool Output Standard

This section is not only for SWOT.

Target product rule:

> Every consulting tool ends in outputs, not in analysis only.

For each tool in the platform, the output layer should expose:

- `Create initiative`
- `Create report`
- `Create presentation`
- `Create idea`

The user may create:

- zero outputs,
- one output,
- many outputs.

The tool runtime is successful even when the user creates only an idea first, as long as the source remains traceable.

---

## 14. Traceability Contract

Every created output must keep a strong link back to the SWOT session.

Minimum metadata:

- `source_type`
- `source_id`
- `source_version`
- `created_from_tool_type`
- `created_from_step` if available

Preferred enhanced metadata:

- linked SWOT cards,
- linked tensions,
- linked recommended moves,
- linked assumptions,
- linked evidence references.

`Open source` from any created output should bring the user back to the SWOT session snapshot.

---

## 15. Completion And Review Logic

The tool should not move the user toward outputs too early.

### 15.1 Session readiness

The session is ready for final review when:

- mission brief is defined,
- each quadrant contains meaningful content,
- strategic tensions exist,
- at least one recommended move exists,
- critical gaps are resolved.

### 15.2 Missing-items model

The tool should detect and display:

- missing quadrants,
- weak evidence,
- duplicated cards,
- vague statements,
- unsupported high-impact claims,
- missing move recommendations.

### 15.3 Finalization gate

The tool may be finalized only when:

- required fields are complete,
- major gaps are addressed,
- user explicitly confirms the session is ready.

After finalization:

- session becomes source-grade,
- outputs can be created,
- source version becomes stable for downstream traceability.

---

## 16. Suggested Information Architecture For The Session

Recommended left-to-right or top-to-bottom content hierarchy:

1. Mission Brief
2. Internal Reality
3. Market Reality
4. Strategic Tensions
5. Recommended Moves
6. Outputs

Recommended user-facing labels:

- `Mission Brief`
- `What Helps Us`
- `What Holds Us Back`
- `What The Market Opens`
- `What Can Hurt Us`
- `Strategic Tensions`
- `Recommended Moves`
- `Create Outputs`

These labels are easier than strict academic SWOT terminology for many users.

---

## 17. Recommended Microcopy

### 17.1 Entry point

- "Use Dynamic SWOT when you need to turn strategy discussion into concrete next moves."

### 17.2 Mission prompt

- "What decision are we trying to make?"

### 17.3 Strength prompt

- "What already gives you an edge today?"

### 17.4 Weakness prompt

- "What repeatedly limits speed, quality, or growth?"

### 17.5 Opportunity prompt

- "What change in the market could work in your favor?"

### 17.6 Threat prompt

- "What external force could hurt this plan if ignored?"

### 17.7 Tension prompt

- "I found a strategic tension worth action. Do you want to convert it into a move?"

### 17.8 Output prompt

- "You now have enough material to create one or more initiatives, a report, a presentation, or idea drafts."

---

## 18. Example End-State

By the end of a strong session, the user should be able to see:

- 6-12 accepted SWOT cards,
- 3-6 strategic tensions,
- 2-4 recommended moves,
- 1-3 initiative candidates,
- optional idea candidates,
- shortcuts to create a report and presentation.

The experience should leave the user thinking:

> "We did not just fill a matrix. We produced a strategy-ready next step."

---

## 19. Acceptance Criteria

### 19.1 UX acceptance

- User can complete the SWOT mainly through AI conversation.
- User always sees structured canvas state alongside the conversation.
- Quadrants are color-coded and instantly scannable.
- Correlations are visible as meaningful tensions, not just raw links.
- Outputs are clearly presented as the final step.

### 19.2 Product acceptance

- Session does not end at summary only.
- User can create one or many initiatives.
- User can create a report.
- User can create a presentation.
- User can create one or many ideas.
- Every output is traceable to the SWOT session.

### 19.3 AI acceptance

- AI follows propose -> accept/reject.
- AI explains why suggestions exist.
- AI does not overwrite accepted user content.
- AI recommendations are grounded in session content.

### 19.4 Platform acceptance

- The runtime fits the Tools module shell standards.
- The command row remains canonical.
- No extra layout rows are introduced.
- The same output model can be generalized to other tools.

---

## 20. Implementation Notes For Future Work

Recommended implementation order:

1. Refine the user-facing stage model and labels.
2. Upgrade the right panel from passive context to active co-strategist panel.
3. Add tension objects as first-class runtime entities.
4. Add move-generation as explicit step before outputs.
5. Extend output contract to support `Idea` across all tools.
6. Align report/presentation generators with stronger tool-source presets.

---

## 21. Final Product Statement

`Dynamic SWOT` should be the canonical example of how every consulting tool in Consultify works:

- guided,
- conversational,
- evidence-aware,
- visually clear,
- output-oriented,
- traceable end to end.

The tool is complete only when the user can move from analysis to artifact creation without losing context.
