#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DT_DIR = ROOT / "wdrozenia" / "modules" / "tools" / "catalog" / "transformation"


@dataclass(frozen=True)
class Tool:
    name: str
    slug: str
    level: str
    typical_duration: str
    best_for: str
    not_for: str
    primary_outputs: str
    min_inputs: list[str]
    opt_inputs: list[str]
    when_to_use: list[str]
    when_not_to_use: list[str]
    good_looks_like: list[str]
    core_concepts: list[str]
    glossary: list[tuple[str, str, str]]
    steps: list[tuple[str, list[str]]]
    outputs_table: list[tuple[str, str, str]]
    ui_views: list[str]
    ui_visuals: list[str]
    worked_context: str
    worked_inputs: list[str]
    worked_analysis: list[str]
    worked_insights: list[str]
    worked_inits: list[tuple[str, str, str, str, str, str]]
    json_example: str
    step_mapping: str
    validation_rules: list[str]
    initiative_gen: list[str]
    ai_rules: list[str]
    ai_prompt_outline: list[str]
    ai_schema: str
    ai_self_checks: list[str]
    report_sections: list[str]
    video_scenes: list[str]
    kb_tldr: str
    kb_faq: list[str]
    resources: list[str]
    references: list[str]


def md_list(items: list[str]) -> str:
    return "\n".join([f"- {x}" for x in items])


def md_checklist(items: list[str]) -> str:
    return "\n".join([f"- [ ] {x}" for x in items])


def render(tool: Tool) -> str:
    min_inputs = "\n".join([f"  - {x}" for x in tool.min_inputs])
    opt_inputs = "\n".join([f"  - {x}" for x in tool.opt_inputs])
    glossary_rows = "\n".join([f"| {t} | {d} | {n} |" for (t, d, n) in tool.glossary])
    steps_md = "\n\n".join([f"### Step {i+1} — {title}\n\n{md_list(lines)}" for i, (title, lines) in enumerate(tool.steps)])
    out_rows = "\n".join([f"| {d} | {desc} | {fmt} |" for (d, desc, fmt) in tool.outputs_table])
    ui_views = "\n".join([f"- {x}" for x in tool.ui_views])
    ui_visuals = "\n".join([f"- {x}" for x in tool.ui_visuals])
    worked_inputs = "\n".join([f"- {x}" for x in tool.worked_inputs])
    worked_analysis = "\n".join([f"- {x}" for x in tool.worked_analysis])
    worked_insights = "\n".join([f"{i+1}. {x}" for i, x in enumerate(tool.worked_insights)])
    init_rows = "\n".join([f"| {a} | {b} | {c} | {d} | {e} | {f} |" for (a, b, c, d, e, f) in tool.worked_inits])
    ai_rules = "\n".join([f"- {x}" for x in tool.ai_rules])
    ai_prompt = "\n".join([f"- {x}" for x in tool.ai_prompt_outline])
    ai_checks = "\n".join([f"- {x}" for x in tool.ai_self_checks])
    report_sections = "\n".join([f"- {x}" for x in tool.report_sections])
    video_scenes = "\n".join([f"{i+1}. {x}" for i, x in enumerate(tool.video_scenes)])
    faq = "\n".join([f"{i+1}. {x}" for i, x in enumerate(tool.kb_faq)])
    resources = "\n".join([f"- {x}" for x in tool.resources])
    refs = "\n".join([f"- {x}" for x in tool.references])

    return f"""# {tool.name}

## Metadata

- **Tool name**: {tool.name}
- **Slug**: `{tool.slug}`
- **Category**: Transformation
- **Level**: {tool.level}
- **Typical duration**: {tool.typical_duration}
- **Best for**: {tool.best_for}
- **Not for**: {tool.not_for}
- **Primary outputs**: {tool.primary_outputs}
- **Required inputs (minimum)**:
{min_inputs}
- **Optional inputs**:
{opt_inputs}
- **Related tools (internal)**:
  - (link) `./digital-transformation-assessment.md`
  - (link) `./transformation-roadmap.md`
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Transformation tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

{tool.good_looks_like[0] if tool.good_looks_like else "Provide decision-grade outputs and initiatives."}

### 1.2 When to use

{md_list(tool.when_to_use)}

### 1.3 When NOT to use (anti-patterns)

{md_list(tool.when_not_to_use)}

### 1.4 What “good” looks like

{md_list(tool.good_looks_like)}

---

## 2. Concept & key definitions

### 2.1 Core concepts

{md_list(tool.core_concepts)}

### 2.2 Glossary

| Term | Definition | Notes |
| --- | --- | --- |
{glossary_rows}

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input | Description | Example | Where in the app it can come from |
| --- | --- | --- | --- |
| Scope | Business unit/region/horizon | “EU, 18 months” | Project context |
| Outcomes | Measurable goals | “Lead time -30%” | KPI panel |
| Constraints | Budget/risk/tech limits | “No downtime” | Notes |

### 3.2 Optional inputs (improves quality)

| Input | Description | Example | Where in the app it can come from |
| --- | --- | --- | --- |
| Inventory | Apps/data/teams | “420 apps” | Upload |
| Evidence | Policies/metrics | “DORA dashboard” | Attachments |

### 3.3 Data quality checks

- Use consistent time buckets and definitions.
- Separate facts vs assumptions and attach evidence where possible.

---

## 4. Step-by-step method (How the user works with it)

{steps_md}

### Common mistakes & fixes

- **Mistake**: Outputs without evidence → **Fix**: require evidence register for key claims.
- **Mistake**: No trade-offs → **Fix**: every recommendation includes alternatives and risks.

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable | Description | Format in the app |
| --- | --- | --- |
{out_rows}

### 5.2 Definition of Done (DoD) checklist

{md_checklist(tool.validation_rules)}

---

## 6. UI / Graphic specification (What the user sees)

> Canonical Tools 2-column layout: **left = workspace**, **right = control panel**.

### 6.1 Screens / views

{ui_views}

### 6.2 Visualization / graphics

{ui_visuals}

### 6.3 Interactions

- Deep links: initiatives must link back to a source section (traceability).
- Comments in Review; read-only in Approved.

### 6.4 States

- Empty: starter template + example.
- Draft: editable.
- Review: comment-only.
- Approved: read-only snapshot; initiative generation and export allowed.

### 6.5 Export formats

- PDF (client-ready)

---

## 7. Worked example (End-to-end)

### 7.1 Context

{tool.worked_context}

### 7.2 Inputs (filled)

{worked_inputs}

### 7.3 Analysis (filled)

{worked_analysis}

### 7.4 Insights

{worked_insights}

### 7.5 Initiatives derived

| Initiative title | Rationale | Expected impact | Effort | Risks | First 2 steps |
| --- | --- | --- | --- | --- | --- |
{init_rows}

---

## 8. Implementation spec (How to build it in the app)

### 8.1 Data model (JSON)

```json
{tool.json_example}
```

### 8.2 Steps & sections mapping

{tool.step_mapping}

### 8.3 Validation rules (DoD)

{md_list(tool.validation_rules)}

### 8.4 Initiative generation spec

{md_list(tool.initiative_gen)}

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, request-review, approve, generate initiatives).

---

## 9. AI spec (How to behave like a world-class consultant)

### 9.1 Non-negotiable reasoning rules

{ai_rules}

### 9.2 Prompt outline

{ai_prompt}

### 9.3 Extraction schema (JSON)

```json
{tool.ai_schema}
```

### 9.4 Self-checks

{ai_checks}

---

## 10. Consultant Report Specification (What goes into the final report)

{report_sections}

---

## 11. Video storyboard (script-ready)

### 11.1 Audience & duration

- Audience: transformation leaders, product/tech leaders
- Duration: 45–60s intro

### 11.2 Scene list

{video_scenes}

### 11.3 On-screen cues

- Purpose → inputs → main visualization → initiatives → export

---

## 12. Knowledge base extraction pack

### TL;DR (5–8 sentences)

{tool.kb_tldr}

### FAQ (at least 8)

{faq}

---

## 13. Additional Resources & Learning Links

{resources}

---

## 14. References (Authoritative Sources)

{refs}
"""


def main() -> int:
    DT_DIR.mkdir(parents=True, exist_ok=True)

    # We keep digital-transformation-assessment.md as a hand-written “gold” doc.
    protected = {"digital-transformation-assessment.md"}

    for tool in TRANSFORMATION_TOOLS:
        path = DT_DIR / f"{tool.slug}.md"
        if path.name in protected:
            continue
        path.write_text(render(tool), encoding="utf-8")
    print(f"Updated {len(TRANSFORMATION_TOOLS)} transformation docs in {DT_DIR}")
    return 0


# Define tool set after functions to keep file readable.
TRANSFORMATION_TOOLS: list[Tool] = []

def add(t: Tool) -> None:
    TRANSFORMATION_TOOLS.append(t)


# NOTE: This list intentionally focuses on “implementation-ready” specificity rather than essay length.
add(Tool(
    name="Target Operating Model (TOM)",
    slug="target-operating-model-tom",
    level="Core",
    typical_duration="2–6 hours workshop + 1–2 weeks refinement",
    best_for="Defining how the organization will operate post-transformation (processes, org, tech, governance).",
    not_for="Detailed system design; vendor selection; a generic slide deck without decisions.",
    primary_outputs="TOM blueprint, decision log, capability map, governance model, initiative backlog.",
    min_inputs=["Transformation scope & outcomes", "Key stakeholders and decision rights", "Current operating constraints"],
    opt_inputs=["Org structure and process maps", "Architecture inventory", "Risk/compliance constraints"],
    when_to_use=["You need a coherent operating model before scaling delivery.", "Roles/ownership and governance are unclear.", "You must align process, org, and technology decisions."],
    when_not_to_use=["You only need a small local improvement.", "You cannot get decision makers engaged.", "You intend to skip evidence and constraints."],
    good_looks_like=["A TOM that is specific (roles, decision rights, cadences) and traceable to initiatives.", "Clear trade-offs and “what we will not do.”", "Governance that can actually run weekly/monthly."],
    core_concepts=["Capabilities, processes, org structure, governance, technology enablers.", "Decision rights and operating cadence.", "Traceability: TOM → roadmap → initiatives."],
    glossary=[("Capability", "A business/tech ability needed to deliver outcomes", "Often grouped into domains"),
              ("Decision rights", "Who decides what and when", "RACI + escalation"),
              ("Operating cadence", "Recurring meetings and artifacts", "Weekly/monthly")],
    steps=[
        ("Setup", ["Confirm scope/outcomes and decision makers.", "Select TOM dimensions (org/process/tech/governance)."]),
        ("Collect facts", ["Capture current constraints and pain points.", "Collect evidence: org charts, policies, process maps."]),
        ("Structure", ["Draft TOM by dimension: roles, processes, platforms, governance.", "Define RACI and key forums."]),
        ("Analyze", ["Check for contradictions (e.g., product ownership vs funding).", "Identify gaps to reach target outcomes."]),
        ("Synthesize insights", ["Document key design choices and trade-offs.", "Define minimal viable TOM for first 90 days."]),
        ("Convert to initiatives", ["Create initiatives per gap (teams, platforms, governance).", "Tag dependencies and owners."]),
    ],
    outputs_table=[
        ("TOM blueprint", "Operating model by dimensions", "Structured document"),
        ("Decision log", "Key choices + trade-offs + owner", "Table"),
        ("Capability map", "Capabilities and maturity target", "Matrix"),
        ("Initiative backlog", "Changes required to implement TOM", "Initiatives list"),
    ],
    ui_views=["- Setup → Dimensions → TOM blueprint → Decisions → Initiatives", "- Control panel: status/DoD, export, generate initiatives"],
    ui_visuals=["- TOM canvas (multi-section)", "- RACI matrix", "- Governance cadence calendar"],
    worked_context="B2B SaaS modernizing delivery: slow releases, unclear ownership, fragmented platforms.",
    worked_inputs=["Scope: one product line, 12 months.", "Outcome: lead time -30%, availability 99.9%.", "Constraint: no major re-org in first 60 days."],
    worked_analysis=["Decision: move to product teams + platform team with clear ownership.", "Governance: weekly flow review + monthly exec steering.", "Gap: lack of platform guardrails and funding model."],
    worked_insights=["Without product ownership, delivery speed will not improve.", "Platform guardrails reduce variance and security risk.", "Cadence must be lightweight to avoid bureaucracy."],
    worked_inits=[
        ("Define product ownership + RACI", "Unblocks decision-making", "fewer delays", "Medium", "politics", "Draft RACI; approve in steering"),
        ("Create platform guardrails", "Enable consistent delivery", "faster delivery", "Medium", "over-standardization", "Define standards; exception process"),
    ],
    json_example='{"setup":{"scope":"Product Line A","horizonMonths":12},"tom":{"dimensions":["org","process","tech","governance"],"raci":[{"decision":"Release approval","ownerRole":"Product Lead"}],"cadence":[{"name":"Weekly flow review","frequency":"weekly"}]},"initiativeDrafts":[{"title":"Define product ownership + RACI","traceability":{"section":"raci"}}]}',
    step_mapping="`setup` → `tom-blueprint` → `decisions` → `initiatives`",
    validation_rules=["Scope and outcomes defined", "At least 5 TOM decisions captured with owners", "RACI and cadence defined", "Initiatives drafted with traceability"],
    initiative_gen=["Generate initiatives per TOM gap (org/process/tech/governance).", "Require owner role, timeline, and dependency tags."],
    ai_rules=["Separate facts vs assumptions.", "Always include trade-offs and what not to do.", "Ensure ownership and cadence are explicit."],
    ai_prompt_outline=["Ask for outcomes and constraints.", "Draft TOM options and trade-offs.", "Propose governance cadence and RACI.", "Generate initiative backlog."],
    ai_schema='{"tomOptions":[{"name":"string","tradeoffs":["string"]}],"raci":[{"decision":"string","ownerRole":"string"}],"cadence":[{"name":"string","frequency":"weekly|monthly"}],"initiatives":[{"title":"string","traceability":{"section":"string"}}]}',
    ai_self_checks=["Is ownership clear for each decision?", "Are trade-offs explicit?", "Do initiatives map to gaps?"],
    report_sections=["- Executive summary and outcomes", "- TOM blueprint and key decisions", "- Governance cadence and RACI", "- Roadmap/initiatives and dependencies"],
    video_scenes=["What TOM is and why it matters", "Show TOM canvas and decisions", "Generate initiatives and export"],
    kb_tldr="A Target Operating Model (TOM) defines how the organization will operate after transformation: roles, decision rights, governance cadence, processes, and technology enablers. It prevents fragmented execution by turning design choices into an initiative backlog with traceability.",
    kb_faq=[
        "What is a TOM and how is it different from org design?",
        "Which TOM dimensions are mandatory?",
        "How do we keep TOM lightweight?",
        "How do we decide decision rights?",
        "How does TOM connect to roadmap and benefits?",
        "What are common TOM failure modes?",
        "How often should TOM be updated?",
        "How do we handle exceptions and local differences?",
    ],
    resources=["- TOGAF (architecture governance): https://www.opengroup.org/togaf", "- Kotter change model: https://www.kotterinc.com/methodology/"],
    references=[
        "Kates, Amy; Galbraith, Jay R. *Designing Your Organization*. Jossey-Bass.",
        "Kotter, John. *Leading Change*. Harvard Business Review Press.",
        "The Open Group — TOGAF: https://www.opengroup.org/togaf",
    ],
))

# Keep the rest concise but tool-specific; we will reuse patterns.
def quick_tool(
    name: str,
    slug: str,
    best_for: str,
    not_for: str,
    outputs: str,
    core_concepts: list[str],
    visuals: list[str],
    refs: list[str],
    example_context: str,
) -> Tool:
    return Tool(
        name=name,
        slug=slug,
        level="Core" if "Assessment" in name or "Roadmap" in name or "Operating Model" in name else "Advanced",
        typical_duration="60–180 minutes",
        best_for=best_for,
        not_for=not_for,
        primary_outputs=outputs,
        min_inputs=["Scope and outcomes", "Evidence and constraints", "Stakeholder ownership"],
        opt_inputs=["KPI baselines", "Architecture/process inventories", "Risk constraints"],
        when_to_use=["You need a repeatable, documented way to make decisions.", "You must convert analysis into initiatives with traceability."],
        when_not_to_use=["You cannot collect evidence and define scope.", "You want a one-off slide deck without follow-up."],
        good_looks_like=["Outputs are specific, evidence-backed, and produce an initiative backlog.", "Trade-offs are explicit and owners are assigned."],
        core_concepts=core_concepts,
        glossary=[("Scope", "What is included in the tool session", "Prevents creep"),
                  ("Evidence", "Artifacts backing claims", "Links required"),
                  ("Traceability", "Link initiatives back to sources", "Audit-ready")],
        steps=[
            ("Setup", ["Define scope, horizon, and outcomes."]),
            ("Collect facts", ["Collect minimum evidence and baseline metrics."]),
            ("Structure", ["Populate the tool artifact with consistent templates."]),
            ("Analyze", ["Identify gaps, dependencies, and risks."]),
            ("Synthesize insights", ["Write recommendations with trade-offs."]),
            ("Convert to initiatives", ["Generate initiatives with owners, metrics, and traceability."]),
        ],
        outputs_table=[("Primary artifact", "Core transformation artifact", "Structured view"),
                       ("Decision log", "Trade-offs and approvals", "Table"),
                       ("Initiative backlog", "Actionable execution items", "Initiatives list")],
        ui_views=["- Setup → Artifact → Decisions → Initiatives", "- Control panel: status/DoD, export, initiatives"],
        ui_visuals=[f"- {v}" for v in visuals],
        worked_context=example_context,
        worked_inputs=["Scope: one business unit, 12 months.", "Outcome: reduce lead time, improve reliability."],
        worked_analysis=["Baseline captured; gaps prioritized; recommended actions sequenced."],
        worked_insights=["Focus on the few highest-leverage constraints first.", "Make ownership explicit to avoid “everyone owns it”."],
        worked_inits=[
            ("Establish governance cadence", "Ensure decisions happen", "less delay", "Low", "fatigue", "Define calendar; assign owners"),
            ("Create initial initiative backlog", "Move from plan to action", "execution started", "Medium", "overload", "Pick top 10; define KPIs"),
        ],
        json_example=f'{{"setup":{{"scope":"string","horizonMonths":12}},"artifact":{{"type":"{slug}"}},"decisions":[{{"text":"string","ownerRole":"string"}}],"initiativeDrafts":[{{"title":"string","traceability":{{"source":"artifact"}}}}]}}',
        step_mapping="`setup` → `artifact` → `decisions` → `initiatives`",
        validation_rules=["Scope and outcomes defined", "Evidence attached for key claims", "At least 3 decisions with owners", "Initiatives drafted with traceability"],
        initiative_gen=["Generate 3–12 initiatives based on gaps and decisions.", "Require owner, metric, and traceability for each initiative."],
        ai_rules=["Separate facts vs assumptions.", "Always include trade-offs.", "Do not propose initiatives without metrics."],
        ai_prompt_outline=["Confirm scope/outcomes.", "Request missing evidence.", "Generate structured artifact and decisions.", "Generate initiatives with traceability."],
        ai_schema='{"decisions":[{"text":"string","ownerRole":"string","tradeoffs":["string"]}],"initiatives":[{"title":"string","metrics":["string"],"traceability":{"source":"string"}}]}',
        ai_self_checks=["Are decisions owned?", "Are claims evidence-backed?", "Are initiatives measurable?"],
        report_sections=["- Executive summary", "- Method and scope", "- Artifact outputs and decisions", "- Initiative portfolio and next steps"],
        video_scenes=["Context and goal", "Show artifact and key visualization", "Initiatives + export"],
        kb_tldr=f"{name} is a transformation tool that creates a structured, evidence-backed artifact and converts gaps into initiatives with traceability for the roadmap.",
        kb_faq=[
            f"What is {name} used for?",
            "What inputs are required?",
            "How do we validate outputs with evidence?",
            "How do we handle missing data?",
            "How do we convert outputs to initiatives?",
            "Who owns the decisions?",
            "How often should this be updated?",
            "What are common anti-patterns?",
        ],
        resources=[f"- See references: {refs[0] if refs else 'N/A'}"],
        references=refs[:3] if len(refs) >= 3 else (refs + ["https://dora.dev/", "https://www.nist.gov/cyberframework"])[:3],
    )


add(quick_tool(
    name="Transformation Roadmap (Waves & Dependencies)",
    slug="transformation-roadmap",
    best_for="Sequencing initiatives with dependencies, capacity, and change saturation.",
    not_for="Detailed sprint planning; ignoring constraints.",
    outputs="Roadmap by waves, dependency map, milestones, initiative portfolio, KPI checkpoints.",
    core_concepts=["Wave-based planning (0–90 / 90–180 / 180+).", "Dependencies and critical path.", "Change saturation and capacity constraints."],
    visuals=["Roadmap timeline", "Dependency graph", "Milestone/KPI checkpoint list"],
    refs=["PMI Program Management: https://www.pmi.org/", "Kotter change model: https://www.kotterinc.com/methodology/", "MSP (AXELOS): https://www.axelos.com/best-practice-solutions/msp"],
    example_context="Retailer planning a 12-month platform and operating model transformation.",
))

add(quick_tool(
    name="Benefits Case & Value Tracking (Benefits Realization)",
    slug="benefits-case-value-tracking",
    best_for="Making value measurable and owned; benefits realization governance.",
    not_for="Vanity metrics without baseline and ownership.",
    outputs="Benefits tree, baseline/targets, benefit owners, initiative-to-benefit traceability.",
    core_concepts=["Benefits tree (value drivers).", "Baseline vs target and ownership.", "Confidence and assumptions register."],
    visuals=["Benefits tree", "KPI cards with owners", "Initiative-to-benefit traceability table"],
    refs=["MSP (AXELOS): https://www.axelos.com/best-practice-solutions/msp", "PMI (benefits): https://www.pmi.org/", "Balanced Scorecard: https://hbr.org/"],
    example_context="Program wants to prove value: lead time down, incident cost down, NPS up.",
))

add(quick_tool(
    name="Current-State Architecture Map (As-is)",
    slug="current-state-architecture-map",
    best_for="Creating a shared as-is map of systems, integrations, and constraints.",
    not_for="Deep design of each component; diagrams without maintenance.",
    outputs="As-is architecture map, integration inventory, constraints, modernization candidates.",
    core_concepts=["System boundaries and dependencies.", "Integration inventory (API/file/event).", "Risk and constraint identification."],
    visuals=["C4-style architecture map", "Integration inventory table", "Constraint heatmap"],
    refs=["ISO/IEC/IEEE 42010: https://www.iso.org/standard/50508.html", "C4 Model: https://c4model.com", "TOGAF: https://www.opengroup.org/togaf"],
    example_context="Enterprise with app sprawl and brittle integrations needs an accurate as-is baseline.",
))

add(quick_tool(
    name="Target Architecture Blueprint (To-be)",
    slug="target-architecture-blueprint",
    best_for="Defining target patterns, principles, and migration constraints.",
    not_for="Replacing delivery-level design; picking vendors too early.",
    outputs="To-be blueprint, reference patterns, principles, migration constraints, decision log.",
    core_concepts=["Architecture principles.", "Reference patterns (integration, data, platform).", "Migration constraints and staged adoption."],
    visuals=["Target blueprint diagram", "Principles and decisions list", "Pattern catalog"],
    refs=["TOGAF: https://www.opengroup.org/togaf", "C4 Model: https://c4model.com", "NIST Cloud: https://www.nist.gov/programs-projects/nist-cloud-computing-standards-roadmap"],
    example_context="Company moving to cloud-native platform with security and compliance constraints.",
))

add(quick_tool(
    name="Application Portfolio Rationalization",
    slug="application-portfolio-rationalization",
    best_for="Reducing app sprawl via keep/retire/replace/refactor decisions.",
    not_for="Decisions without usage/cost/risk data.",
    outputs="App inventory, 6R decisions, rationalization roadmap, savings estimate.",
    core_concepts=["Application inventory.", "6R classification.", "Dependency-aware sequencing."],
    visuals=["Portfolio 6R matrix", "Dependency graph", "Savings/risk dashboard"],
    refs=["Gartner glossary: https://www.gartner.com/en/information-technology/glossary/application-rationalization", "Microsoft CAF strategy: https://learn.microsoft.com/azure/cloud-adoption-framework/strategy/", "TOGAF: https://www.opengroup.org/togaf"],
    example_context="Org has 400+ apps with high cost and duplicated capabilities.",
))

add(quick_tool(
    name="Technology Standards & Reference Architectures (Guardrails)",
    slug="technology-standards-guardrails",
    best_for="Creating enforceable standards and exception process for consistent delivery.",
    not_for="Freezing innovation; standards without enforcement.",
    outputs="Standards catalog, reference patterns, exception process, decision log.",
    core_concepts=["Guardrails and patterns.", "Exception process.", "Compliance checks and automation."],
    visuals=["Standards catalog", "Reference pattern cards", "Exception workflow"],
    refs=["NIST CSF: https://www.nist.gov/cyberframework", "OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/", "ISO/IEC 27001: https://www.iso.org/isoiec-27001-information-security.html"],
    example_context="Multiple teams diverge on stack; quality and security vary widely.",
))

add(quick_tool(
    name="Data Strategy & Data Operating Model",
    slug="data-strategy-data-operating-model",
    best_for="Aligning data priorities to outcomes and defining roles and operating cadence.",
    not_for="Tool selection only without governance.",
    outputs="Data strategy themes, operating model, domain priorities, roadmap initiatives.",
    core_concepts=["Data domains and products.", "Ownership (data owner/steward).", "Operating cadence for decisions."],
    visuals=["Data domain map", "Operating model canvas", "Roadmap by data domain"],
    refs=["DAMA: https://www.dama.org/content/body-knowledge", "ISO 38505-1: https://www.iso.org/standard/56740.html", "NIST Big Data: https://www.nist.gov/programs-projects/nist-big-data-interoperability-framework"],
    example_context="Company wants reliable analytics; data ownership and definitions are inconsistent.",
))

add(quick_tool(
    name="Data Governance (Roles, Policies, Stewardship)",
    slug="data-governance",
    best_for="Defining decision rights and policies for data access, retention, and quality.",
    not_for="Governance theater without enforcement.",
    outputs="RACI, policy set, stewardship model, issue workflow, decision log.",
    core_concepts=["Decision rights for data.", "Policies (access, retention, classification).", "Issue workflow and escalation."],
    visuals=["RACI matrix", "Policy catalog", "Issue workflow"],
    refs=["DAMA: https://www.dama.org/content/body-knowledge", "NIST Privacy Framework: https://www.nist.gov/privacy-framework", "ISO/IEC 27001: https://www.iso.org/isoiec-27001-information-security.html"],
    example_context="Data access requests are slow and inconsistent; quality issues are unmanaged.",
))

add(quick_tool(
    name="Data Quality Management (DQ Dimensions & SLAs)",
    slug="data-quality-management",
    best_for="Defining DQ dimensions, rules, SLAs and remediation ownership for critical data.",
    not_for="One-time profiling without controls.",
    outputs="DQ rules, SLAs, dashboards, remediation backlog, ownership model.",
    core_concepts=["Critical data elements (CDE).", "DQ dimensions (accuracy, completeness, timeliness).", "DQ SLAs and monitoring."],
    visuals=["DQ scorecards", "Rule catalog", "Incident/remediation workflow"],
    refs=["ISO 8000: https://www.iso.org/standard/81760.html", "DAMA: https://www.dama.org/content/body-knowledge", "SRE SLOs: https://sre.google/sre-book/service-level-objectives/"],
    example_context="Analytics outputs are unreliable; teams argue about whose data is correct.",
))

add(quick_tool(
    name="AI Use-Case Factory (Use-Case Intake → MVP → Scale)",
    slug="ai-use-case-factory",
    best_for="Building a repeatable pipeline of AI use cases with feasibility, ROI, and risk management.",
    not_for="Ad-hoc AI projects without governance.",
    outputs="Use-case backlog, feasibility scoring, MVP definition, scale checklist, risk flags.",
    core_concepts=["Use-case intake and scoring.", "Data readiness and evaluation.", "Risk management and human oversight."],
    visuals=["Use-case funnel", "Feasibility scorecards", "Scale readiness checklist"],
    refs=["NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework", "OECD AI principles: https://oecd.ai/en/ai-principles", "ISO/IEC 23894: https://www.iso.org/standard/77304.html"],
    example_context="Enterprise wants AI ROI but needs governance to avoid scattered pilots.",
))

add(quick_tool(
    name="Process Mining (Discovery & Conformance)",
    slug="process-mining",
    best_for="Discovering real process flows from event logs and identifying deviations/bottlenecks.",
    not_for="Processes without event data; replacing stakeholder workshops.",
    outputs="As-is model, conformance gaps, bottlenecks, improvement/automation candidates.",
    core_concepts=["Event logs (caseId/activity/timestamp).", "Discovery and conformance checking.", "Bottlenecks and variants."],
    visuals=["Process model view", "Variant frequency chart", "Conformance deviations list"],
    refs=["Process Mining book: https://link.springer.com/book/10.1007/978-3-662-49851-4", "TF-PM: https://www.tf-pm.org/", "Celonis overview: https://www.celonis.com/process-mining/"],
    example_context="Order-to-cash has long lead times; stakeholders disagree about root causes.",
))

add(quick_tool(
    name="Automation Opportunity Assessment (RPA / Workflow / Low-code)",
    slug="automation-opportunity-assessment",
    best_for="Prioritizing automation candidates by ROI, feasibility, and risk.",
    not_for="Automating broken processes; ignoring exception rates.",
    outputs="Automation backlog, ROI estimate, feasibility score, delivery approach recommendation.",
    core_concepts=["Candidate identification and scoring.", "Exception handling and controls.", "Build vs buy vs workflow."],
    visuals=["Opportunity scoring table", "ROI vs feasibility matrix", "Backlog by wave"],
    refs=["UiPath Automation Hub: https://www.uipath.com/product/automation-hub", "NIST CSF: https://www.nist.gov/cyberframework", "Microsoft Power Platform (low-code concepts): https://learn.microsoft.com/power-platform/"],
    example_context="Shared services has high manual volumes and approval bottlenecks.",
))

add(quick_tool(
    name="Customer Journey Digitization Map",
    slug="customer-journey-digitization-map",
    best_for="Connecting journey pain points to digital enablers and prioritizing moments that matter.",
    not_for="Internal-only optimization; replacing product discovery.",
    outputs="Journey map, moments that matter, pain points, digital enablers, initiative backlog.",
    core_concepts=["Journey steps and moments.", "Pain points and metrics.", "Digital enablers and prioritization."],
    visuals=["Journey map", "Pain point heatmap", "Moments-that-matter prioritization"],
    refs=["NN/g journey mapping: https://www.nngroup.com/articles/journey-mapping-101/", "Forrester CX: https://www.forrester.com/customer-experience/", "Kotter: https://www.kotterinc.com/methodology/"],
    example_context="Customer onboarding is slow and fragmented across channels.",
))

add(quick_tool(
    name="Product Operating Model (Teams, Funding, OKRs)",
    slug="product-operating-model",
    best_for="Designing product-centric delivery model with clear ownership and outcome metrics.",
    not_for="Forcing one model across all contexts; ignoring platform needs.",
    outputs="Team topology, ownership model, funding model, OKR structure, governance cadence.",
    core_concepts=["Product ownership and accountability.", "Team boundaries (platform vs stream-aligned).", "Outcome metrics (OKRs)."],
    visuals=["Team topology map", "Ownership/RACI view", "OKR tree"],
    refs=["Team Topologies: https://teamtopologies.com/", "What Matters (OKRs): https://www.whatmatters.com/", "Inspired (Cagan) reference: https://svpg.com/books/"],
    example_context="Multiple teams deliver slowly because ownership is unclear and priorities conflict.",
))

add(quick_tool(
    name="Agile at Scale (Ways of Working)",
    slug="agile-at-scale",
    best_for="Aligning many teams on cadence/governance/flow and improving predictability.",
    not_for="Copy-pasting frameworks without outcomes.",
    outputs="Ways of working, cadence, governance, flow metrics, improvement backlog.",
    core_concepts=["Cadence and planning horizons.", "Flow metrics (lead time/throughput).", "Governance and guardrails."],
    visuals=["Cadence calendar", "Flow metrics dashboard", "Portfolio alignment view"],
    refs=["SAFe: https://scaledagileframework.com/", "LeSS: https://less.works/", "DORA: https://dora.dev/"],
    example_context="15 teams with conflicting priorities; delivery predictability is low.",
))

add(quick_tool(
    name="Capability / Skills Gap Analysis",
    slug="capability-skills-gap-analysis",
    best_for="Identifying skill gaps for the roadmap and creating hiring/training plan.",
    not_for="HR theater without linking to execution outcomes.",
    outputs="Capability map, current vs required skill levels, hiring/training plan, initiatives.",
    core_concepts=["Role-to-capability mapping.", "Gap scoring and prioritization.", "Build/buy/partner decisions."],
    visuals=["Capability heatmap", "Skill gap table", "Training roadmap"],
    refs=["SFIA: https://sfia-online.org/", "Team Topologies: https://teamtopologies.com/", "Prosci (change adoption): https://www.prosci.com/"],
    example_context="Roadmap requires new platform and data skills not present in-house.",
))

add(quick_tool(
    name="Change Management Plan (ADKAR + Adoption)",
    slug="change-management-plan-adkar",
    best_for="Driving adoption with stakeholder mapping, comms/training plan, and ADKAR tracking.",
    not_for="Comms-only change plans without measurement.",
    outputs="Stakeholder map, ADKAR plan, comms plan, training plan, adoption KPIs, risk log.",
    core_concepts=["ADKAR stages and interventions.", "Stakeholder segmentation.", "Adoption metrics and feedback loops."],
    visuals=["Stakeholder map", "ADKAR plan board", "Adoption KPI dashboard"],
    refs=["Prosci ADKAR: https://www.prosci.com/methodology/adkar", "Kotter: https://www.kotterinc.com/methodology/", "Switch (Heath) reference: https://heathbrothers.com/books/switch/"],
    example_context="New ways of working face resistance; adoption must be planned and measured.",
))

add(quick_tool(
    name="Digital Risk Assessment (Security/Privacy/Compliance)",
    slug="digital-risk-assessment",
    best_for="Identifying risks and required controls for transformation initiatives and releases.",
    not_for="Checklist-only risk review without mitigations.",
    outputs="Risk register, control requirements, mitigation initiatives, go/no-go flags.",
    core_concepts=["Threat/risk categories.", "Control mapping and mitigations.", "Release gating criteria."],
    visuals=["Risk register table", "Control mapping matrix", "Mitigation roadmap"],
    refs=["NIST CSF: https://www.nist.gov/cyberframework", "ISO/IEC 27001: https://www.iso.org/isoiec-27001-information-security.html", "NIST Privacy Framework: https://www.nist.gov/privacy-framework"],
    example_context="Transformation introduces new data flows and vendors; risks must be managed proactively.",
))


if __name__ == "__main__":
    raise SystemExit(main())

