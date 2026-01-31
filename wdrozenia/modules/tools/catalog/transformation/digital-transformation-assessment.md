# Digital Transformation Assessment (Maturity Baseline)

## Metadata

- **Tool name**: Digital Transformation Assessment (Maturity Baseline)
- **Slug**: `digital-transformation-assessment`
- **Category**: Transformation
- **Level**: Core
- **Typical duration**: 60–120 minutes (single workshop) + 1–2 weeks evidence collection
- **Best for**: Establishing baseline, aligning leadership on current state, prioritizing transformation themes, creating evidence-backed narrative for roadmap
- **Not for**: Detailed solution design; vendor selection; “score for the sake of score”
- **Primary outputs**: Maturity baseline by domain, prioritized gaps, evidence register, risk flags, transformation hypotheses, initiative candidates
- **Required inputs (minimum)**:
  - Company context and scope (BU/region)
  - Target outcomes (business goals) and time horizon
  - Current pain points (top 5–10)
- **Optional inputs**:
  - KPIs (service, cost, time-to-market, quality)
  - Architecture/inventory (apps, data, integration)
  - Recent audits/incidents, org structure, budget constraints
- **Related tools (internal)**:
  - (transformation) `target-operating-model-tom.md`
  - (transformation) `transformation-roadmap.md`
  - (transformation) `digital-risk-assessment.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Transformation tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

Provide a **decision-grade baseline** of digital transformation maturity that answers:

- Where are we strong/weak **today** (by domain)?
- What is **evidence** vs assumption?
- Which gaps matter most for business outcomes?

### 1.2 When to use

- At the start of a transformation program (before TOM/roadmap).
- When leadership has conflicting narratives about “how digital we are”.
- When you need a documented baseline for value case and change plan.

### 1.3 When NOT to use (anti-patterns)

- Using maturity scores as the only output (no evidence, no actions).
- Treating the assessment as “survey only” without validation.
- Using one-size-fits-all domains without adapting scope.

### 1.4 What “good” looks like

- Domains and scoring criteria are explicit and understandable.
- Each score is backed by evidence (links, KPIs, artifacts, examples).
- Gaps translate into hypotheses and initiative candidates.
- Output is usable as the front section of the transformation report.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Maturity domain**: a capability area assessed separately (e.g., Product, Data, Architecture, Delivery, Security, Change).
- **Evidence register**: list of artifacts that justify scores.
- **Gap**: difference between current maturity and target maturity needed to achieve outcomes.
- **Hypothesis**: causal statement connecting a gap to an outcome (used to prioritize and test).

### 2.2 Glossary

| Term            | Definition                          | Notes                  |
| --------------- | ----------------------------------- | ---------------------- |
| Baseline        | Current-state maturity snapshot     | Used to track progress |
| Target maturity | Required capability level for goals | Not “max everywhere”   |
| Scoring rubric  | Definition of levels                | Prevents subjectivity  |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input       | Description            | Example                     | Where in the app it can come from |
| ----------- | ---------------------- | --------------------------- | --------------------------------- |
| Scope       | BU/region/time horizon | “EU retail, 18 months”      | Project context                   |
| Outcomes    | Business goals         | “Reduce time-to-market 30%” | Goals/KPIs                        |
| Pain points | Top issues             | “Release cycles too slow”   | Workshop notes                    |

### 3.2 Optional inputs (improves quality)

| Input                  | Description              | Example                  | Where in the app it can come from |
| ---------------------- | ------------------------ | ------------------------ | --------------------------------- |
| KPI baseline           | Quantitative performance | DORA metrics, OTIF, NPS  | KPI dashboard                     |
| Architecture inventory | Apps/data/integration    | 420 apps, 12 DBs         | Upload                            |
| Security posture       | Major risks/incidents    | “2 P1 incidents/quarter” | Risk logs                         |

### 3.3 Data quality checks

- Require at least **one evidence item** per domain score (or mark “insufficient evidence”).
- Separate **facts vs stakeholder opinions**.
- Validate scope consistency (don’t compare apples to oranges across BUs).

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Setup

- Confirm scope, horizon, and primary outcomes.
- Select maturity domains (default set, editable).

### Step 2 — Collect facts

- For each domain, collect:
  - artifacts (policies, architecture diagrams, backlogs),
  - metrics (lead time, incident rates),
  - examples (recent projects).

### Step 3 — Structure

- Use a 5-level rubric per domain (1 = ad-hoc, 5 = optimized).
- Document scoring criteria in the tool (visible to user).

### Step 4 — Analyze

- Score domains and capture:
  - rationale,
  - evidence links,
  - confidence (high/med/low).

### Step 5 — Synthesize insights

- Identify top 5 gaps by:
  - impact on outcomes,
  - risk,
  - feasibility.
- Draft transformation hypotheses (“If we improve X, then Y improves because Z”).

### Step 6 — Convert to initiatives

- For each top gap, generate 1–3 initiatives:
  - title, rationale, expected impact, effort, dependencies, success metrics.

### Common mistakes & fixes

- **Mistake**: Survey-only scoring → **Fix**: enforce evidence attachments.
- **Mistake**: Target maturity = 5 everywhere → **Fix**: target is outcome-driven, not maximal.
- **Mistake**: No conversion to action → **Fix**: require initiative drafts for top gaps.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable           | Description        | Format in the app      |
| --------------------- | ------------------ | ---------------------- |
| Maturity profile      | Scores by domain   | Radar + table          |
| Evidence register     | Linked artifacts   | Evidence list          |
| Gap list              | Current vs target  | Ranked table           |
| Hypotheses            | Causal statements  | List                   |
| Initiative candidates | Actionable backlog | Initiatives draft list |

### 5.2 Definition of Done (DoD) checklist

- [ ] Scope and outcomes defined
- [ ] Domains selected and rubric visible
- [ ] Each domain has score + rationale + evidence (or “insufficient evidence”)
- [ ] Top gaps prioritized
- [ ] At least 5 initiative drafts created with metrics

---

## 6. UI / Graphic specification

> Use the canonical 2-column layout from Tools: **left = workspace**, **right = control panel**.

### 6.1 Screens / views

**Workspace (left column, 65% width):**

- Setup and configuration
- Main analysis workspace
- Results visualization

**Control Panel (right column, 35% width, sticky):**

- Status badge (Draft/In Review/Approved)
- DoD checklist (expandable)
- Action buttons: Review, Approve, Export PDF, Generate Initiatives
- Session metadata (created date, last updated, owner)

### 6.2 Layout requirements

**Two-column layout:**

- Left workspace: scrollable, full height
- Right control panel: sticky top, max-height: 100vh, overflow-y: auto
- Responsive: on mobile/tablet, control panel becomes bottom sheet

**Visual design:**

- Clean, modern interface with consistent spacing
- Color-coded elements for different states and categories
- Clear typography hierarchy (headings, body text, labels)
- Interactive elements with hover states and feedback

### 6.3 Interactions

**General interactions:**

- Click elements to edit inline or open detail modals
- Drag-and-drop to rearrange items
- Filter and sort tables
- Auto-save: every 30 seconds or on blur
- Undo/redo: keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
- Keyboard navigation: Tab through editable fields, Enter to save

**Specific interactions:**

- Add/edit/delete items with confirmation dialogs
- Bulk actions: select multiple items for batch operations
- Context menus: right-click for additional options
- Tooltips: hover over elements for additional information

### 6.4 States

**Draft:**

- All sections editable
- No export available (except draft PDF)
- "Review" button enabled

**In Review:**

- Sections locked (read-only) except for comments/annotations
- "Approve" and "Reject" buttons enabled for reviewers
- Export available (draft PDF)

**Approved:**

- All sections locked (read-only)
- "Generate Initiatives" button enabled
- Export available (final PDF, Excel)
- Can create new version (supersedes previous)

**Visual States:**

- Loading: skeleton screens for tables/charts
- Error: inline error messages below fields, toast notifications for save failures
- Success: green checkmark animations, toast notifications for saves
- Empty: helpful prompts with examples and guidance

### 6.5 Export formats

**PDF Export:**

- Cover page: Tool name, company, date, owner
- Table of contents
- Executive Summary
- Analysis results
- Recommendations
- Action Plan (from initiatives)
- Appendices: Definitions, references

**Excel Export:**

- Multiple sheets: Data, Analysis, Results
- Formatted tables with filters
- Charts embedded as images

**Print Preview:**

- Optimized layout for A4/Letter
- Page breaks at logical sections
- Headers/footers with page numbers

---

## 7. Worked example (End-to-end)

### 7.1 Context

Mid-market retailer, EU. Goal: reduce release lead time by 30% and improve availability to 99.9% within 12 months.

### 7.2 Inputs (filled)

- Outcomes: lead time, change failure rate, uptime
- Pain points: slow approvals, fragmented tooling, manual deployments

### 7.3 Analysis (filled)

Domains scored (excerpt):

- Delivery (DevOps): 2/5 (manual releases, low automation; evidence: pipeline screenshots)
- Architecture: 2/5 (tight coupling, unclear integration; evidence: dependency map)
- Security: 3/5 (basic controls but slow approvals; evidence: policy docs)

### 7.4 Insights

1. Delivery automation is the highest leverage for lead time and reliability.
2. Architecture coupling is a hidden constraint on speed.
3. Security gates need “shift-left” controls to reduce approval delay.

### 7.5 Initiatives derived

| Initiative title                      | Rationale                 | Expected impact      | Effort | Risks          | First 2 steps                         |
| ------------------------------------- | ------------------------- | -------------------- | ------ | -------------- | ------------------------------------- |
| CI/CD standardization + automation    | Fix delivery maturity gap | lead time −30%       | High   | change fatigue | baseline DORA; pilot 1 product        |
| API gateway and integration standards | Reduce coupling           | faster releases      | Medium | platform scope | define standards; migrate 2 APIs      |
| Shift-left security controls          | Reduce approval delays    | +speed +risk control | Medium | tooling        | define SAST/DAST; integrate pipelines |

---

## 8. Implementation spec (How to build it in the app)

### 8.1 Data model (JSON)

```json
{
  "setup": {
    "scope": "EU retail",
    "horizonMonths": 12,
    "outcomes": ["lead_time", "availability", "change_failure_rate"],
    "domains": ["delivery", "architecture", "data", "security", "change", "product_model"]
  },
  "rubric": {
    "levels": 5,
    "definitions": ["ad-hoc", "managed", "defined", "measured", "optimized"]
  },
  "scores": [
    {
      "domain": "delivery",
      "score": 2,
      "rationale": "Manual deployments and inconsistent pipelines",
      "evidence": [{ "type": "link", "url": "file://...", "label": "Pipeline screenshot" }],
      "confidence": "medium"
    }
  ],
  "gaps": [
    { "domain": "delivery", "current": 2, "target": 4, "impact": 5, "effort": 4, "risk": 3 }
  ],
  "hypotheses": [
    {
      "text": "If CI/CD becomes standardized and automated, lead time will drop because manual steps and approvals are removed."
    }
  ],
  "initiativeDrafts": [
    { "title": "CI/CD standardization + automation", "traceability": { "domain": "delivery" } }
  ]
}
```

### 8.2 Steps & sections mapping

- `setup` → `domain-scores` → `evidence` → `gaps` → `hypotheses` → `initiatives`

### 8.3 Validation rules (DoD)

- Must have scope + outcomes + domain list.
- Must have at least 6 domains scored (or user marks “not applicable”).
- Each scored domain must have rationale and ≥1 evidence item OR “insufficient evidence” flag.

### 8.4 Initiative generation spec

- Default batch size 5, max 12.
- Each initiative requires traceability back to `domain` and optionally `gapId`.

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, request-review, approve, generate initiatives).

---

## 9. AI spec (How to behave like a world-class consultant)

### 9.1 Non-negotiable reasoning rules

- Separate facts vs opinions; require evidence for strong claims.
- Avoid “maturity theater”: always link scores to outcomes and actions.
- Highlight constraints and dependencies (architecture, governance).

### 9.2 Prompt outline

- Ask for outcomes and scope.
- Propose domains and rubric.
- For each domain: propose evidence to collect and a tentative score with confidence.
- Generate prioritized gaps and initiatives tied to outcomes.

### 9.3 Extraction schema (JSON)

```json
{
  "domainScores": [
    { "domain": "string", "score": 1, "rationale": "string", "confidence": "low|medium|high" }
  ],
  "evidenceRequests": [{ "domain": "string", "request": "string" }],
  "topGaps": [{ "domain": "string", "current": 2, "target": 4, "impact": 5 }]
}
```

### 9.4 Self-checks

- Do scores have evidence or are they clearly marked uncertain?
- Are initiatives traceable to gaps and outcomes?
- Is the target maturity justified by outcomes?

---

## 10. Consultant Report Specification (What goes into the final report)

- Executive summary (outcomes, headline maturity, top gaps)
- Domain-by-domain maturity table with evidence
- Gap prioritization and hypotheses
- Initiative portfolio and recommended sequencing
- Assumptions and risks

---

## 11. Video storyboard

### 11.1 Audience & duration

- **Audience**: Transformation leaders, IT executives, change managers, digital strategists
- **Duration**: 45–60 seconds intro
- **Style**: Professional, instructional, clear visuals

### 11.2 Scene list

**Scene 1: Hook & Problem (0–10s)**

- **Visual**: Split screen showing conflicting narratives ("we're digital" vs "we're not digital"), question marks
- **VO (PL)**: "Czy Twoi liderzy mają sprzeczne opinie o poziomie dojrzałości cyfrowej?"
- **VO (EN)**: "Do your leaders have conflicting opinions about digital maturity?"
- **On-screen text (PL)**: "Sprzeczne opinie = Brak baseline"
- **On-screen text (EN)**: "Conflicting opinions = No baseline"

**Scene 2: Solution Intro (10–18s)**

- **Visual**: Tool logo/name appears, transition to maturity domains overview (Delivery, Architecture, Data, Security, Change, Product)
- **VO (PL)**: "Digital Transformation Assessment tworzy baseline dojrzałości oparty na dowodach."
- **VO (EN)**: "Digital Transformation Assessment creates an evidence-based maturity baseline."
- **On-screen text (PL)**: "Baseline = Oparty na dowodach"
- **On-screen text (EN)**: "Baseline = Evidence-based"

**Scene 3: Assess Domains (18–26s)**

- **Visual**: Domain cards with maturity scores (1-5), evidence register showing artifacts
- **VO (PL)**: "Oceń dojrzałość w kluczowych domenach z rejestrem dowodów."
- **VO (EN)**: "Assess maturity in key domains with an evidence register."
- **On-screen text (PL)**: "Ocena domen = Z dowodami"
- **On-screen text (EN)**: "Domain assessment = With evidence"

**Scene 4: Gap Analysis (26–34s)**

- **Visual**: Radar chart showing current vs target maturity, gap heatmap
- **VO (PL)**: "Zidentyfikuj luki między obecną a docelową dojrzałością."
- **VO (EN)**: "Identify gaps between current and target maturity."
- **On-screen text (PL)**: "Luki = Obecna vs Docelowa"
- **On-screen text (EN)**: "Gaps = Current vs Target"

**Scene 5: Hypotheses & Initiatives (34–42s)**

- **Visual**: Hypotheses linking gaps to outcomes, initiative candidates table
- **VO (PL)**: "Przekształć luki w hipotezy i kandydatów inicjatyw."
- **VO (EN)**: "Convert gaps into hypotheses and initiative candidates."
- **On-screen text (PL)**: "Hipotezy + Inicjatywy = Działanie"
- **On-screen text (EN)**: "Hypotheses + Initiatives = Action"

**Scene 6: Roadmap (42–50s)**

- **Visual**: Transformation roadmap timeline with prioritized initiatives, expected impact
- **VO (PL)**: "Zbuduj roadmapę transformacji z priorytetyzowanymi inicjatywami."
- **VO (EN)**: "Build a transformation roadmap with prioritized initiatives."
- **On-screen text (PL)**: "Roadmapa = Priorytetyzowane inicjatywy"
- **On-screen text (EN)**: "Roadmap = Prioritized initiatives"

**Scene 7: Export & CTA (50–60s)**

- **Visual**: PDF export preview, "Generate Initiatives" button highlighted
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Digital Transformation Assessment (Maturity Baseline) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Digital Transformation Assessment (Maturity Baseline) today."
- **On-screen text (PL)**: "Eksportuj i generuj inicjatywy"
- **On-screen text (EN)**: "Export and generate initiatives"

### 11.3 Shot list

1. **Shot 1 (0–10s)**: Wide shot of split screen (conflicting narratives), zoom to question marks
2. **Shot 2 (10–18s)**: Fade to tool logo, pan to maturity domains overview
3. **Shot 3 (18–26s)**: Close-up of domain cards, click to show evidence register
4. **Shot 4 (26–34s)**: Zoom to radar chart, highlight gaps
5. **Shot 5 (34–42s)**: Focus on hypotheses table, link to initiative candidates
6. **Shot 6 (42–50s)**: Pan across transformation roadmap timeline
7. **Shot 7 (50–60s)**: PDF preview overlay, fade to CTA button

### 11.4 Implementation notes

- **Screen recording**: Use actual tool interface (or high-fidelity mockup)
- **Transitions**: Smooth fades between scenes (0.5s)
- **Highlighting**: Use subtle glow/outline for interactive elements
- **Text overlays**: Bottom third of screen, semi-transparent background, readable font
- **VO**: Professional voiceover, clear pronunciation, moderate pace
- **Music**: Subtle background music (optional), non-distracting
- **Call-to-action**: End with tool name and "Get Started" button

## 12. Knowledge base extraction pack

1. **What is the main purpose of Digital Transformation Assessment (Maturity Baseline)?**
   A: Digital Transformation Assessment (Maturity Baseline) helps Provide a **decision-grade baseline** of digital transformation maturity that answers:

- Where are ....

2. **When should I use Digital Transformation Assessment (Maturity Baseline)?**
   A: Use it - At the start of a transformation program (before TOM/roadmap).

- When leadership has conflicting narratives about “how digital we are”.
- When you n....

3. **What are the key outputs?**
   A: Key outputs include Maturity baseline by domain, prioritized gaps, evidence register, risk flags, transformation hypotheses, initiative candidates.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Digital Transformation Assessment (Maturity Baseline)?**
   A: Digital Transformation Assessment (Maturity Baseline) helps Provide a **decision-grade baseline** of digital transformation maturity that answers:

- Where are ....

2. **When should I use Digital Transformation Assessment (Maturity Baseline)?**
   A: Use it At the start of a transformation program (before TOM/roadmap).
   When leadership has conflicting narratives about “how digital we are”.
   When you need a ....

3. **What are the key outputs?**
   A: Key outputs include Maturity baseline by domain, prioritized gaps, evidence register, risk flags, transformation hypotheses, initiative candidates.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Digital Transformation Assessment (Maturity Baseline) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Digital Transformation Assessment (Maturity Baseline) analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

**DoD Checklist (Definition of Done):**

- [ ] All required inputs provided
- [ ] Analysis completed according to method
- [ ] Key insights documented
- [ ] Recommendations generated
- [ ] Report exportable

**Common Mistakes Checklist:**

- [ ] Incomplete inputs → Fix: Ensure all required inputs are provided before starting
- [ ] Skipping validation → Fix: Validate results and check for consistency
- [ ] Unclear objectives → Fix: Define clear objectives and success criteria upfront

### Glossary (short)

| Term            | Definition                                     | Example                                   |
| --------------- | ---------------------------------------------- | ----------------------------------------- |
| Analysis        | Systematic examination of data and information | Conducting analysis to identify patterns  |
| Insights        | Key findings and conclusions from analysis     | Deriving insights from data patterns      |
| Recommendations | Actionable suggestions based on analysis       | Providing recommendations for improvement |

---

## 13. Additional Resources & Learning Links

- DORA (DevOps metrics and research): `https://dora.dev`
- NIST AI Risk Management Framework (for AI-related maturity): `https://www.nist.gov/itl/ai-risk-management-framework`

---

## 14. References (Authoritative Sources)

- Forsgren, Nicole; Humble, Jez; Kim, Gene. _Accelerate_. IT Revolution.
- DORA — research and metrics: `https://dora.dev`
- NIST AI Risk Management Framework: `https://www.nist.gov/itl/ai-risk-management-framework`
