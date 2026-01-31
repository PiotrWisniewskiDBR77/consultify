# Value Stream Mapping (VSM)

## Metadata

- **Tool name**: Value Stream Mapping (VSM)
- **Slug**: `value-stream-mapping-vsm`
- **Category**: Operations
- **Level**: Core
- **Typical duration**: 60–120 minutes (single value stream); 1 day workshop (complex / multi-product)
- **Best for**: End-to-end flow diagnosis, lead-time reduction, identifying waste, designing a “future state” operating model
- **Not for**: Purely strategic portfolio choices; highly creative ideation without process data; teams unwilling to change operating rules
- **Primary outputs**: Current-state VSM, future-state VSM, quantified waste (VA/NVA), improvement backlog, implementation waves
- **Required inputs (minimum)**:
  - Process scope (start/end), product/service family, demand rate
  - Current process steps and handoffs
  - Basic timing: cycle time (CT), changeover (C/O), uptime, inventory/queues, lead time
- **Optional inputs**:
  - Defect/rework rates, WIP limits, staffing by step, batch sizes, transport distances, cost per hour
  - System constraints (ERP rules, compliance), service-level targets
- **Related tools (internal)**:
  - (ops) `sipoc.md`
  - (ops) `kanban-wip-limits.md`
  - (ops) `bottleneck-analysis-toc.md`
  - (ops) `root-cause-5whys-fishbone.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Operations tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

Value Stream Mapping helps a team answer: **“Where does time really go from request to delivery, and what must change to improve flow?”** It creates a single, shared picture of material/information flow to reveal waste, queues, and constraints.

### 1.2 When to use

- You have long lead times, poor delivery performance, or unpredictable throughput.
- Different departments optimize locally but the customer experience is slow.
- You need an actionable improvement backlog anchored in quantified delays.

### 1.3 When NOT to use (anti-patterns)

- You cannot define a product/service family and scope (start/end).
- You want a “perfect process map” before taking any action (analysis paralysis).
- You need root-cause depth on a single defect first (use RCA/Fishbone).

### 1.4 What “good” looks like

- Current state includes **real measured times** (not “typical”) and explicit queues.
- VA vs NVA time is quantified; biggest delays are obvious.
- Future state has clear design rules (pull, WIP limits, flow unit, takt, pacemaker).
- Backlog is prioritized by impact and feasibility, with ownership and timeline.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- **Value stream**: End-to-end steps that deliver value to a customer for a defined product/service family.
- **Current state**: How the flow works today (facts).
- **Future state**: Designed target flow with explicit operating rules.
- **Lead time**: Total elapsed time from request to delivery (includes waiting).
- **Cycle time (CT)**: Time to complete one unit at a step.
- **Takt time**: Available time / demand (pace required to meet demand).
- **VA vs NVA**: Value-added vs non-value-added time (from customer perspective).
- **Pacemaker process**: Step that sets the production/service rhythm in future state.

### 2.2 Glossary

| Term      | Definition                 | Notes                         |
| --------- | -------------------------- | ----------------------------- |
| WIP       | Work-in-Progress inventory | Physical or digital queue     |
| C/O       | Changeover time            | Setup time between variants   |
| FPY       | First-pass yield           | % without rework              |
| FIFO lane | First-in-first-out queue   | Controls waiting and fairness |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input  | Description                      | Example                      | Where in the app it can come from |
| ------ | -------------------------------- | ---------------------------- | --------------------------------- |
| Scope  | Start/end points, product family | “Order received → Delivered” | Tool setup step                   |
| Demand | Average demand rate              | 200 orders/week              | KPI panel / manual                |
| Steps  | List of process steps + owners   | Sales → Ops → Warehouse      | SIPOC import / manual             |
| Timing | CT + queue/wait time per step    | CT=6 min; wait=2 days        | Manual / CSV                      |

### 3.2 Optional inputs (improves quality)

| Input           | Description                | Example                | Where in the app it can come from |
| --------------- | -------------------------- | ---------------------- | --------------------------------- |
| WIP by step     | Units waiting              | 1,200 items queued     | Ops export / manual               |
| Quality         | Defects, rework rate       | 7% rework at QA        | QA system / manual                |
| Availability    | Uptime / downtime          | 85% uptime             | Maintenance logs                  |
| Batch/transport | Batch size, transport time | Batch 50; transport 2h | Manual                            |

### 3.3 Data quality checks

- Define the observation window (e.g., last 4 weeks) and ensure comparability.
- Use medians + ranges for CT and queue times where variability is high.
- Ensure the scope start/end match customer experience (avoid internal-only scope).

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Select the product/service family and scope

- Choose one “flow unit” (e.g., one order, one claim, one pallet).
- Set start/end points that reflect the customer journey.

### Step 2 — Map the current state (facts first)

- List steps and handoffs in sequence.
- For each step capture: CT, wait/queue time, WIP, C/O, uptime, FPY.
- Add information flow (systems, approvals) that create waiting.

### Step 3 — Quantify lead time and identify the biggest delays

- Compute total lead time: sum of waits + processing.
- Compute VA time: sum of processing that is value-add.
- Identify top 3 delay drivers (usually queues/approvals/batches).

### Step 4 — Diagnose root causes at “hot spots”

- For top delays, capture hypotheses: “Why is the queue large?”
- Use quick RCA (5 Whys) for each hot spot.

### Step 5 — Design the future state with explicit rules

Choose and document future-state rules:

- Pull vs push
- WIP limits and FIFO lanes
- Pacemaker step
- Leveling / heijunka (if relevant)
- Standard work & visual management

### Step 6 — Build an implementation backlog and waves

- Convert future-state gaps into initiatives:
  - “Implement WIP limit = 30 in step X”
  - “Remove approval Y; replace with rule-based auto-approval”
- Prioritize by (Impact × Effort × Risk).
- Plan waves: 0–30 days, 30–90 days, 90–180 days.

### Common mistakes & fixes

- **Mistake**: Mapping “ideal” process → **Fix**: map observed reality (gemba / data).
- **Mistake**: Too broad scope → **Fix**: pick one family, one start/end.
- **Mistake**: No numbers → **Fix**: minimal timing per step + queue size.
- **Mistake**: Future state = wish list → **Fix**: define operating rules (WIP, pull, pacemaker).

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable         | Description                      | Format in the app      |
| ------------------- | -------------------------------- | ---------------------- |
| Current-state VSM   | Steps + timing + WIP + info flow | Diagram + table        |
| VA/NVA summary      | VA time, NVA time, lead time     | KPI cards              |
| Future-state VSM    | Target flow with rules           | Diagram + rules panel  |
| Improvement backlog | Prioritized initiatives          | Initiatives draft list |
| Implementation plan | Waves, owners, dates             | Timeline table         |

### 5.2 Definition of Done (DoD) checklist

- [ ] Scope and flow unit defined (start/end)
- [ ] Current state mapped with CT + wait time for each step (at least estimates + ranges)
- [ ] Lead time and VA/NVA quantified
- [ ] Top 3 delay drivers identified with hypotheses
- [ ] Future state rules defined (pull/WIP/pacemaker)
- [ ] At least 5 initiatives created with owners and waves

---

## 6. UI / Graphic specification (What the user sees)

> Use the canonical 2-column layout from Tools: **left = workspace**, **right = control panel**.

### 6.1 Screens / views

- **Tool Hub card**: “Value Stream Mapping (VSM)” + “Find waste, design future state, cut lead time”
- **Tool Workspace (left)**:
  1. Setup (scope, family, demand, flow unit)
  2. Current state map (diagram + step table)
  3. Quantification (lead time, VA/NVA, bottlenecks)
  4. Future state design (rules + diagram)
  5. Backlog & waves (initiatives)
- **Control panel (right)**:
  - Status (Draft → Review → Approved)
  - DoD checklist
  - Review/approve + comments
  - Export PDF (current + future + backlog)
  - Generate initiatives (batch)

### 6.2 Visualization & graphics (VSM diagram)

**Diagram requirements**

- **Swimlane layout**:
  - Top: information flow (systems, approvals)
  - Middle: process steps (boxes)
  - Bottom: timeline (VA time vs wait time)
- **Step box content** (consistent template):
  - Step name
  - CT (median + range)
  - Wait/queue time
  - WIP (units)
  - FPY (optional)
- **Icons**: queue/triangle for inventory, cloud for system, bolt for constraint, red badge for “hot spot”

**Best practices**

- Keep map readable: max ~10–12 steps; group sub-steps.
- Emphasize the biggest waits visually (heat scale on wait time).
- Provide “zoom to section” and “collapse sub-process”.
- Provide export as PDF + PNG (slide-ready) and optionally SVG.

### 6.3 Interactions

- Add/reorder steps; collapse groups; inline edit CT/WIP.
- Clicking a step opens a detail drawer with evidence, RCA notes, and initiative links.
- Clicking a hot spot filters backlog to initiatives related to that step.

### 6.4 States

- Empty: “Add first step” + example template.
- Loading: skeleton for diagram + table.
- Error: highlight invalid numbers (negative, missing units).
- Approved: read-only; initiative generation still allowed; exports use snapshot.

---

## 7. Worked example (End-to-end)

### 7.1 Context

B2B spare parts distributor. Customer complaints about late deliveries. Goal: reduce lead time from order to delivery from 12 days to 5 days within 90 days.

### 7.2 Inputs (filled)

- Demand: 250 orders/week; available work time 37.5h/week → takt \(\approx\) 9 minutes/order (for the constrained packing team).
- Steps (CT / wait / WIP):
  1. Order entry: CT 5 min; wait 0.5 day; WIP 120
  2. Credit approval: CT 2 min; wait 2.0 days; WIP 430
  3. Picking: CT 12 min; wait 3.0 days; WIP 900
  4. Packing: CT 10 min; wait 2.5 days; WIP 700
  5. Dispatch: CT 8 min; wait 1.0 day; WIP 260

### 7.3 Analysis (filled)

- Total processing (VA-ish): ~37 min
- Total waiting: ~9.0 days
- Lead time ~12 days, VA < 1 hour (<< 1% of total time)
- Hot spots: Picking queue + Credit approvals + Packing WIP

### 7.4 Insights

1. The majority of lead time is waiting caused by batch processing and approvals.
2. Credit approval is a policy bottleneck with low processing time but high queue time.
3. Packing is the practical pacemaker; WIP is uncontrolled and spikes daily.

### 7.5 Initiatives derived

| Initiative title                   | Rationale                       | Expected impact         | Effort | Risks             | First 2 steps                       |
| ---------------------------------- | ------------------------------- | ----------------------- | ------ | ----------------- | ----------------------------------- |
| Auto-approve low-risk customers    | Remove approval queue           | −1.5–2.0 days lead time | Medium | Credit risk       | Define risk rules; pilot 2 segments |
| WIP limit + FIFO lanes for packing | Create pull at pacemaker        | −1.0–1.5 days           | Low    | Resistance        | Set WIP=300; daily visual board     |
| Pick-path optimization + slotting  | Reduce picking CT + variability | +15–25% throughput      | Medium | Data quality      | ABC slotting; test in one aisle     |
| Daily wave release (heijunka-lite) | Smooth peaks, reduce queues     | −0.5–1.0 day            | Low    | Planning overhead | Create release schedule; train ops  |

---

## 8. Implementation spec (How to build it in the app)

### 8.1 Data model (JSON)

Store as `answers_json` in the tool session:

```json
{
  "setup": {
    "flowUnit": "order",
    "scopeStart": "order_received",
    "scopeEnd": "delivered",
    "productFamily": "spare_parts",
    "demand": { "value": 250, "unit": "orders_per_week" },
    "taktTimeMinutes": 9
  },
  "currentState": {
    "steps": [
      {
        "id": "s1",
        "name": "Credit approval",
        "cycleTime": { "value": 2, "unit": "min" },
        "waitTime": { "value": 2, "unit": "days" },
        "wip": { "value": 430, "unit": "orders" },
        "fpy": 0.99,
        "notes": "Manual approval for all new customers"
      }
    ],
    "informationFlow": [{ "from": "ERP", "to": "CreditTeam", "type": "approval" }]
  },
  "analysis": {
    "leadTimeDays": 12,
    "valueAddMinutes": 37,
    "topDelays": [{ "stepId": "s1", "reason": "Approval policy queue" }]
  },
  "futureState": {
    "rules": [
      { "id": "r1", "type": "wip_limit", "stepId": "packing", "limit": 300 },
      { "id": "r2", "type": "pull", "pacemakerStepId": "packing" }
    ]
  },
  "initiativeDrafts": [{ "title": "Auto-approve low-risk customers", "sourceStepId": "s1" }]
}
```

### 8.2 Steps & section mapping

- `setup` → `current-map` → `quantify` → `future-design` → `backlog`

### 8.3 Validation rules (DoD)

- Setup complete: scope start/end + flow unit + demand.
- Current state: ≥3 steps with CT + wait time.
- Quantification: lead time computed (or user provides) and top delays listed.
- Future state: at least 2 explicit rules (e.g., WIP limit + pacemaker/pull).

### 8.4 Initiative generation spec

- Initiatives must reference: `source_type='tool'`, `tool_session_id`, and either `sourceStepId` or `sourceHotSpotId`.
- Default batch size: 5; max: 12.
- Initiative fields required: title, rationale, expectedImpact (time/quality/cost), effort, risks, firstSteps, metrics.

### 8.5 API surface (high-level)

- `POST /api/tools` create session
- `PUT /api/tools/:id` autosave
- `POST /api/tools/:id/request-review`
- `POST /api/tools/:id/approve`
- `POST /api/tools/:id/generate-initiatives`

---

## 9. AI spec (How to behave like a world-class consultant)

### 9.1 Non-negotiable reasoning rules

- Separate facts vs assumptions; ask for missing measurements.
- Identify waste types (waiting, rework, transport, overprocessing, motion, inventory, overproduction).
- Prioritize improvements by impact on lead time and variability, not local efficiency.
- Propose future-state rules that are operationally enforceable (WIP limit, pull trigger, cadence).

### 9.2 Prompt outline

- Setup: confirm scope + flow unit + demand; compute takt if possible.
- Current state: request CT/wait/WIP per step; flag outliers.
- Analysis: compute VA/NVA, highlight hot spots and hypothesize causes.
- Future state: propose rules (pull, WIP, pacemaker) + expected gains.
- Backlog: generate initiative candidates with metrics and first steps.

### 9.3 Extraction schema (JSON)

```json
{
  "hotSpots": [{ "stepName": "string", "why": "string", "impactType": "lead_time|quality|cost" }],
  "futureStateRules": [
    { "type": "wip_limit|pull|fifo|cadence", "stepName": "string", "value": "string" }
  ],
  "initiativeCandidates": [
    {
      "title": "string",
      "rationale": "string",
      "expectedImpact": { "metric": "lead_time_days", "range": [0.5, 2.0] },
      "effort": "Low|Medium|High",
      "risks": ["string"],
      "firstSteps": ["string", "string"]
    }
  ]
}
```

### 9.4 Self-checks

- Does the scope match customer lead time (not internal-only)?
- Do proposed rules reduce queues and variability (not just speed up one step)?
- Are initiatives traceable to specific hot spots and metrics?

---

## 10. Consultant Report Specification (What goes into the final report)

### 10.1 Report structure

1. **Executive summary**: lead time baseline vs target; top 3 delays; expected improvements
2. **Scope & method**: family, start/end, demand/takt, observation window
3. **Current-state map**: diagram + step table (CT, wait, WIP)
4. **Quantification**: VA/NVA, lead time decomposition, variability notes
5. **Future-state design**: target map + operating rules
6. **Backlog & roadmap**: prioritized initiatives by wave (0–30/30–90/90–180)
7. **KPIs & governance**: cadence, owner model, measures, risks/assumptions

### 10.2 Required visuals

- Current-state VSM (diagram)
- Lead-time timeline (VA vs wait)
- Future-state VSM (diagram)
- Roadmap table (waves)

### 10.3 Quality checklist

- [ ] Numbers are present and consistent (units)
- [ ] Top delays are explicitly linked to initiatives
- [ ] Future state includes enforceable rules (WIP/pull/cadence)
- [ ] KPIs and ownership defined

---

## 11. Video storyboard

### 11.1 Audience & duration

- **Audience**: Operations leaders, process owners, lean practitioners, consultants
- **Duration**: 45–60 seconds intro
- **Style**: Professional, instructional, clear visuals

### 11.2 Scene list

**Scene 1: Hook & Problem (0–10s)**

- **Visual**: Split screen showing long lead time (12 days) vs short processing time (37 min), timer overlay
- **VO (PL)**: "Czy większość czasu realizacji to oczekiwanie, a nie przetwarzanie?"
- **VO (EN)**: "Is most of your lead time waiting, not processing?"
- **On-screen text (PL)**: "Długi czas realizacji = Głównie oczekiwanie"
- **On-screen text (EN)**: "Long lead time = Mostly waiting"

**Scene 2: Solution Intro (10–18s)**

- **Visual**: Tool logo/name appears, transition to VSM diagram showing current state with queues
- **VO (PL)**: "Value Stream Mapping pokazuje gdzie traci się czas w przepływie end-to-end."
- **VO (EN)**: "Value Stream Mapping shows where time is lost in end-to-end flow."
- **On-screen text (PL)**: "Mapa przepływu = Wizualizacja czasu"
- **On-screen text (EN)**: "Flow map = Time visualization"

**Scene 3: Current State Map (18–26s)**

- **Visual**: VSM diagram with process steps, cycle times, wait times, queues highlighted in red
- **VO (PL)**: "Zmapuj obecny stan: czasy cyklu, kolejki, miejsca wąskie."
- **VO (EN)**: "Map current state: cycle times, queues, bottlenecks."
- **On-screen text (PL)**: "Obecny stan = Fakty i liczby"
- **On-screen text (EN)**: "Current state = Facts and numbers"

**Scene 4: VA vs NVA Analysis (26–34s)**

- **Visual**: Timeline bar showing VA time (37 min) vs NVA/wait time (9 days), percentage breakdown
- **VO (PL)**: "Zidentyfikuj czas wartościowy vs czas oczekiwania."
- **VO (EN)**: "Identify value-added time vs wait time."
- **On-screen text (PL)**: "VA vs NVA = Gdzie traci się czas"
- **On-screen text (EN)**: "VA vs NVA = Where time is lost"

**Scene 5: Future State Design (34–42s)**

- **Visual**: Future state VSM with WIP limits, pull signals, pacemaker step highlighted
- **VO (PL)**: "Zaprojektuj przyszły stan z limitami WIP i sygnałami pull."
- **VO (EN)**: "Design future state with WIP limits and pull signals."
- **On-screen text (PL)**: "Przyszły stan = Zasady operacyjne"
- **On-screen text (EN)**: "Future state = Operating rules"

**Scene 6: Improvement Backlog (42–50s)**

- **Visual**: Backlog table showing initiatives linked to hot spots, expected impact (lead time reduction)
- **VO (PL)**: "Generuj inicjatywy poprawy powiązane z miejscami wąskimi."
- **VO (EN)**: "Generate improvement initiatives linked to bottlenecks."
- **On-screen text (PL)**: "Backlog = Inicjatywy poprawy"
- **On-screen text (EN)**: "Backlog = Improvement initiatives"

**Scene 7: Export & CTA (50–60s)**

- **Visual**: PDF export preview, "Generate Initiatives" button highlighted
- **VO (PL)**: "Eksportuj raport i generuj inicjatywy. Rozpocznij Value Stream Mapping (VSM) już dziś."
- **VO (EN)**: "Export the report and generate initiatives. Start Value Stream Mapping (VSM) today."
- **On-screen text (PL)**: "Eksportuj i generuj inicjatywy"
- **On-screen text (EN)**: "Export and generate initiatives"

### 11.3 Shot list

1. **Shot 1 (0–10s)**: Wide shot of split screen (lead time vs processing time), timer overlay
2. **Shot 2 (10–18s)**: Fade to tool logo, pan to VSM diagram overview
3. **Shot 3 (18–26s)**: Close-up of current state VSM, highlight queues in red
4. **Shot 4 (26–34s)**: Zoom to timeline bar (VA vs NVA breakdown)
5. **Shot 5 (34–42s)**: Focus on future state VSM, highlight WIP limits and pull signals
6. **Shot 6 (42–50s)**: Pan across backlog table, highlight initiatives linked to hot spots
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

1. **What is the main purpose of Value Stream Mapping (VSM)?**
   A: Value Stream Mapping (VSM) helps Value Stream Mapping helps a team answer: \*\*“Where does time really go from request to delivery, and....

2. **When should I use Value Stream Mapping (VSM)?**
   A: Use it - You have long lead times, poor delivery performance, or unpredictable throughput.

- Different departments optimize locally but the customer experien....

3. **What are the key outputs?**
   A: Key outputs include Current-state VSM, future-state VSM, quantified waste (VA/NVA), improvement backlog, implementation waves.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done

### FAQ (at least 8)

1. **What is the main purpose of Value Stream Mapping (VSM)?**
   A: Value Stream Mapping (VSM) helps Value Stream Mapping helps a team answer: \*\*“Where does time really go from request to delivery, and....

2. **When should I use Value Stream Mapping (VSM)?**
   A: Use it You have long lead times, poor delivery performance, or unpredictable throughput.
   Different departments optimize locally but the customer experience i....

3. **What are the key outputs?**
   A: Key outputs include Current-state VSM, future-state VSM, quantified waste (VA/NVA), improvement backlog, implementation waves.

4. **What inputs are required?**
   A: Required inputs include scope, objectives, and relevant data. Check the Inputs section for specific requirements.

5. **How do I ensure quality results?**
   A: Ensure all required inputs are provided, follow the method systematically, validate results, and check the Definition of Done checklist.

6. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

7. **How long does it typically take?**
   A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

8. **What makes a good Value Stream Mapping (VSM) analysis?**
   A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.
   checklist.

9. **What are common mistakes?**
   A: Common mistakes include incomplete data, skipping validation steps, unclear objectives, and not following the systematic method.

10. **How long does it typically take?**
    A: Duration varies by tool complexity. Check the metadata section for typical duration estimates.

11. **What makes a good Value Stream Mapping (VSM) analysis?**
    A: A good analysis has clear objectives, complete data, systematic execution, validated results, and actionable insights.

### Checklists

- DoD checklist (from section 5)
- Common mistakes checklist (from section 4)

### Glossary (short)

- Value stream, lead time, cycle time, takt, WIP, pacemaker, pull, FIFO

---

## 13. Additional Resources & Learning Links

- **Lean Enterprise Institute (VSM resources)**: `https://www.lean.org`
- **Rother & Shook (Learning to See)**: classic VSM workbook (book)
- **Toyota Production System concepts (pull, takt, flow)**: multiple reputable summaries (use internal KB)

---

## 14. References (Authoritative Sources)

- Rother, Mike; Shook, John. _Learning to See: Value Stream Mapping to Add Value and Eliminate MUDA_. Lean Enterprise Institute.
- Womack, James P.; Jones, Daniel T. _Lean Thinking: Banish Waste and Create Wealth in Your Corporation_. Simon & Schuster.
- Lean Enterprise Institute — Value Stream Mapping materials and articles: `https://www.lean.org`
