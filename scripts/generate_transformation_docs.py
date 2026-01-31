#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DT_DIR = ROOT / "wdrozenia" / "modules" / "tools" / "catalog" / "transformation"


TOOLS = [
    {
        "name": "Target Operating Model (TOM)",
        "slug": "target-operating-model-tom",
        "level": "Core",
        "duration": "2–6 hours (workshop) + 1–2 weeks refinement",
        "best_for": "Defining how the organization will operate post-transformation (processes, org, tech, governance)",
        "not_for": "Detailed system design; vendor selection; skipping current-state constraints",
        "outputs": "TOM blueprint, decision log, capability map, governance model, initiative backlog",
        "min_inputs": ["Transformation goals and scope", "Current operating constraints", "Key stakeholders/decision rights"],
        "optional_inputs": ["Org structure, process maps, architecture inventory", "Financial targets", "Risk/compliance constraints"],
        "related": ["transformation-roadmap.md", "product-operating-model.md", "technology-standards-guardrails.md"],
        "refs": [
            ("Kates, Amy; Galbraith, Jay R. *Designing Your Organization*. Jossey-Bass.", ""),
            ("ISO/IEC/IEEE 42010 (architecture description concepts)", "https://www.iso.org/standard/50508.html"),
            ("Kotter, John. *Leading Change*. Harvard Business Review Press.", ""),
        ],
    },
    {
        "name": "Transformation Roadmap (Waves & Dependencies)",
        "slug": "transformation-roadmap",
        "level": "Core",
        "duration": "2–6 hours (initial) + ongoing monthly refresh",
        "best_for": "Turning transformation strategy into sequenced, dependency-aware execution plan",
        "not_for": "Replacing delivery planning inside teams; ignoring capacity and change saturation",
        "outputs": "Roadmap by waves, dependency map, milestones, initiative portfolio, KPI checkpoints",
        "min_inputs": ["Transformation objectives", "Initiative candidates", "Constraints (budget/capacity/risk)"],
        "optional_inputs": ["Architecture dependencies", "Regulatory deadlines", "Change calendar"],
        "related": ["benefits-case-value-tracking.md", "change-management-plan-adkar.md", "digital-risk-assessment.md"],
        "refs": [
            ("Kotter, John. *Leading Change*. Harvard Business Review Press.", ""),
            ("PMI. *The Standard for Program Management*. Project Management Institute.", ""),
            ("McKinsey. Three Horizons (for wave thinking)", "https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/enduring-ideas-the-three-horizons-of-growth"),
        ],
    },
    {
        "name": "Benefits Case & Value Tracking (Benefits Realization)",
        "slug": "benefits-case-value-tracking",
        "level": "Core",
        "duration": "60–180 minutes setup + monthly governance",
        "best_for": "Making transformation value measurable, owned, and tracked (benefits realization)",
        "not_for": "Replacing financial planning; vanity KPI dashboards without ownership",
        "outputs": "Benefits tree, baseline/targets, benefit owners, value tracking cadence, initiative-to-benefit traceability",
        "min_inputs": ["Business outcomes and KPIs", "Baseline values and data sources", "Ownership (benefit owners)"],
        "optional_inputs": ["Unit economics, cost model", "Program costs", "Confidence ranges and assumptions"],
        "related": ["transformation-roadmap.md", "digital-transformation-assessment.md"],
        "refs": [
            ("OGC. *Managing Successful Programmes (MSP)* (benefits management)", "https://www.axelos.com/best-practice-solutions/msp"),
            ("PMI. Benefits Realization Management (practice)", "https://www.pmi.org/learning/library/benefits-realization-management-11074"),
            ("Kaplan, Robert; Norton, David. *The Balanced Scorecard*. Harvard Business Review Press.", ""),
        ],
    },
    {
        "name": "Current-State Architecture Map (As-is)",
        "slug": "current-state-architecture-map",
        "level": "Core",
        "duration": "2–10 hours (depending on landscape) + evidence collection",
        "best_for": "Creating a shared, accurate as-is view of applications, integrations, data flows, and constraints",
        "not_for": "Deep technical design of every system; one-time diagram without maintenance",
        "outputs": "As-is architecture map, integration inventory, data flow map, key constraints, modernization candidates",
        "min_inputs": ["System/application list", "Integration list (APIs/files/events)", "Key pain points and incidents"],
        "optional_inputs": ["CMDB exports", "Cost/usage metrics", "Security classification"],
        "related": ["target-architecture-blueprint.md", "application-portfolio-rationalization.md"],
        "refs": [
            ("ISO/IEC/IEEE 42010 (architecture description)", "https://www.iso.org/standard/50508.html"),
            ("TOGAF Standard, The Open Group", "https://www.opengroup.org/togaf"),
            ("C4 Model (diagramming approach)", "https://c4model.com"),
        ],
    },
    {
        "name": "Target Architecture Blueprint (To-be)",
        "slug": "target-architecture-blueprint",
        "level": "Core",
        "duration": "4–12 hours initial + iterative refinement",
        "best_for": "Defining future-state architecture principles, target patterns, and migration constraints",
        "not_for": "Replacing delivery-level design; committing to vendors prematurely",
        "outputs": "To-be blueprint, reference patterns, principles, migration constraints, tech decisions log",
        "min_inputs": ["Business objectives and non-functional requirements", "As-is architecture constraints", "Target operating model assumptions"],
        "optional_inputs": ["Security/privacy requirements", "Cloud strategy", "Data strategy"],
        "related": ["technology-standards-guardrails.md", "application-portfolio-rationalization.md"],
        "refs": [
            ("TOGAF Standard, The Open Group", "https://www.opengroup.org/togaf"),
            ("C4 Model (communication of architecture)", "https://c4model.com"),
            ("NIST. Cloud Computing Standards Roadmap", "https://www.nist.gov/programs-projects/nist-cloud-computing-standards-roadmap"),
        ],
    },
    {
        "name": "Application Portfolio Rationalization",
        "slug": "application-portfolio-rationalization",
        "level": "Advanced",
        "duration": "1–3 days analysis + 2–6 weeks data completion",
        "best_for": "Reducing app sprawl, cost, risk; deciding keep/retire/replace/refactor",
        "not_for": "Making decisions without usage/cost/risk data; ignoring business criticality",
        "outputs": "App inventory, 6R decisions, rationalization roadmap, savings estimate, risk reduction plan",
        "min_inputs": ["Application inventory", "Business criticality", "Cost/usage proxies"],
        "optional_inputs": ["Technical debt measures", "Security risk scores", "Integration dependency graph"],
        "related": ["current-state-architecture-map.md", "target-architecture-blueprint.md"],
        "refs": [
            ("Gartner. Application rationalization (concept)", "https://www.gartner.com/en/information-technology/glossary/application-rationalization"),
            ("Microsoft Cloud Adoption Framework (portfolio planning concepts)", "https://learn.microsoft.com/azure/cloud-adoption-framework/strategy/"),
            ("TOGAF (architecture governance)", "https://www.opengroup.org/togaf"),
        ],
    },
    {
        "name": "Technology Standards & Reference Architectures (Guardrails)",
        "slug": "technology-standards-guardrails",
        "level": "Core",
        "duration": "2–6 hours initial + governance cadence",
        "best_for": "Preventing divergence, accelerating delivery, enabling consistent security and quality",
        "not_for": "Freezing innovation; standards without enforcement or exceptions process",
        "outputs": "Tech standards catalog, reference patterns, exception process, decision log, compliance checks",
        "min_inputs": ["Target architecture principles", "Security/privacy requirements", "Current stack reality"],
        "optional_inputs": ["Platform capabilities", "Tooling constraints", "Developer experience needs"],
        "related": ["target-architecture-blueprint.md", "digital-risk-assessment.md"],
        "refs": [
            ("NIST Cybersecurity Framework", "https://www.nist.gov/cyberframework"),
            ("OWASP ASVS (application security standard)", "https://owasp.org/www-project-application-security-verification-standard/"),
            ("ISO/IEC 27001 (ISMS)", "https://www.iso.org/isoiec-27001-information-security.html"),
        ],
    },
    {
        "name": "Data Strategy & Data Operating Model",
        "slug": "data-strategy-data-operating-model",
        "level": "Core",
        "duration": "2–6 hours workshop + iterative refinement",
        "best_for": "Aligning data priorities to business outcomes and defining operating responsibilities",
        "not_for": "Only technology selection; ignoring governance and stewardship",
        "outputs": "Data strategy themes, data operating model, priority domains, roadmap initiatives",
        "min_inputs": ["Business outcomes", "Current data pain points", "Key data domains"],
        "optional_inputs": ["Platform landscape", "Regulatory constraints", "Data quality baseline"],
        "related": ["data-governance.md", "data-quality-management.md"],
        "refs": [
            ("DAMA International. *DAMA-DMBOK2* (data management body of knowledge)", "https://www.dama.org/content/body-knowledge"),
            ("ISO/IEC 38505-1: Governance of data", "https://www.iso.org/standard/56740.html"),
            ("NIST Big Data Interoperability Framework", "https://www.nist.gov/programs-projects/nist-big-data-interoperability-framework"),
        ],
    },
    {
        "name": "Data Governance (Roles, Policies, Stewardship)",
        "slug": "data-governance",
        "level": "Core",
        "duration": "2–6 hours setup + ongoing governance cadence",
        "best_for": "Defining decision rights, policies, stewardship, and escalation for data",
        "not_for": "Governance theater without enforcement; governance without measurable quality outcomes",
        "outputs": "RACI, policy set, stewardship model, issue workflow, decision log",
        "min_inputs": ["Key data domains", "Stakeholders/owners", "Policies to define (access, retention, quality)"],
        "optional_inputs": ["Data catalog", "Security classification", "Incident examples"],
        "related": ["data-strategy-data-operating-model.md", "data-quality-management.md"],
        "refs": [
            ("DAMA-DMBOK2 (data governance)", "https://www.dama.org/content/body-knowledge"),
            ("ISO/IEC 27001 (controls for access and governance)", "https://www.iso.org/isoiec-27001-information-security.html"),
            ("NIST Privacy Framework", "https://www.nist.gov/privacy-framework"),
        ],
    },
    {
        "name": "Data Quality Management (DQ Dimensions & SLAs)",
        "slug": "data-quality-management",
        "level": "Advanced",
        "duration": "2–6 hours setup + ongoing monitoring",
        "best_for": "Making data quality measurable and governable with SLAs and ownership",
        "not_for": "One-time profiling without controls; fixing data without business definitions",
        "outputs": "DQ dimensions, rules, SLAs, dashboards, remediation backlog, ownership model",
        "min_inputs": ["Critical data elements (CDEs)", "Business definitions", "Data sources and pipelines"],
        "optional_inputs": ["Historical defect rates", "Downstream impact", "Tooling constraints"],
        "related": ["data-governance.md", "benefits-case-value-tracking.md"],
        "refs": [
            ("ISO 8000 (data quality)", "https://www.iso.org/standard/81760.html"),
            ("DAMA-DMBOK2 (data quality management)", "https://www.dama.org/content/body-knowledge"),
            ("Google SRE Book (SLIs/SLOs concept for measurable quality)", "https://sre.google/sre-book/service-level-objectives/"),
        ],
    },
    {
        "name": "AI Use-Case Factory (Use-Case Intake → MVP → Scale)",
        "slug": "ai-use-case-factory",
        "level": "Advanced",
        "duration": "2–6 hours setup + continuous pipeline",
        "best_for": "Building repeatable pipeline of AI use cases with feasibility, risk, ROI, and scale governance",
        "not_for": "Ad-hoc model building without risk management; skipping data readiness",
        "outputs": "Use-case backlog, feasibility scores, MVP definition, risk assessment, scale checklist, initiative portfolio",
        "min_inputs": ["Business problems and KPIs", "Data availability constraints", "Risk/compliance constraints"],
        "optional_inputs": ["Model hosting/platform constraints", "Human-in-the-loop requirements", "Evaluation datasets"],
        "related": ["digital-risk-assessment.md", "data-quality-management.md"],
        "refs": [
            ("NIST AI Risk Management Framework", "https://www.nist.gov/itl/ai-risk-management-framework"),
            ("ISO/IEC 23894 (AI risk management)", "https://www.iso.org/standard/77304.html"),
            ("OECD AI Principles", "https://oecd.ai/en/ai-principles"),
        ],
    },
    {
        "name": "Process Mining (Discovery & Conformance)",
        "slug": "process-mining",
        "level": "Advanced",
        "duration": "2–6 hours scoping + 1–3 weeks data extraction",
        "best_for": "Finding real process flows, bottlenecks, deviations; quantifying improvement potential",
        "not_for": "Processes without event data; replacing stakeholder workshops",
        "outputs": "As-is process model, conformance gaps, bottlenecks, automation candidates, initiative backlog",
        "min_inputs": ["Event log sources (caseId, activity, timestamp)", "Process scope", "KPIs to optimize"],
        "optional_inputs": ["Org/role attributes", "Cost per case", "Compliance rules"],
        "related": ["automation-opportunity-assessment.md", "value-stream-mapping-vsm.md"],
        "refs": [
            ("van der Aalst, Wil. *Process Mining: Data Science in Action*. Springer.", ""),
            ("IEEE Task Force on Process Mining (resources)", "https://www.tf-pm.org/"),
            ("Celonis (process mining concepts)", "https://www.celonis.com/process-mining/"),
        ],
    },
    {
        "name": "Automation Opportunity Assessment (RPA / Workflow / Low-code)",
        "slug": "automation-opportunity-assessment",
        "level": "Core",
        "duration": "60–180 minutes assessment + pipeline governance",
        "best_for": "Prioritizing automation candidates with ROI, risk, and feasibility",
        "not_for": "Automating broken processes; RPA everywhere without controls",
        "outputs": "Automation backlog, ROI estimate, feasibility score, risk flags, delivery approach (RPA vs workflow vs build)",
        "min_inputs": ["Process list and volumes", "Pain points and cycle times", "Compliance constraints"],
        "optional_inputs": ["System access constraints", "Data quality", "Exception rates"],
        "related": ["process-mining.md", "technology-standards-guardrails.md"],
        "refs": [
            ("UiPath. Automation Hub concepts (idea reference)", "https://www.uipath.com/product/automation-hub"),
            ("IEEE/ACM software engineering principles (build vs buy reasoning)", "https://www.acm.org/code-of-ethics"),
            ("NIST Cybersecurity Framework (risk lens)", "https://www.nist.gov/cyberframework"),
        ],
    },
    {
        "name": "Customer Journey Digitization Map",
        "slug": "customer-journey-digitization-map",
        "level": "Core",
        "duration": "2–6 hours workshop + evidence collection",
        "best_for": "Mapping customer journeys to digital enablers and identifying priority moments that matter",
        "not_for": "Purely internal process optimization; replacing product discovery",
        "outputs": "Journey map, pain points, moments that matter, digital enablers, initiative backlog",
        "min_inputs": ["Customer segments/personas", "Journey steps", "Pain points and metrics"],
        "optional_inputs": ["Analytics funnels", "VOC research", "Service logs"],
        "related": ["customer-segmentation.md", "product-operating-model.md"],
        "refs": [
            ("NN/g. Journey Mapping 101", "https://www.nngroup.com/articles/journey-mapping-101/"),
            ("Forrester. Customer experience concepts", "https://www.forrester.com/customer-experience/"),
            ("Kotter, John. *Leading Change* (change and adoption)", ""),
        ],
    },
    {
        "name": "Product Operating Model (Teams, Funding, OKRs)",
        "slug": "product-operating-model",
        "level": "Core",
        "duration": "2–6 hours workshop + iteration",
        "best_for": "Designing product-centric delivery model (ownership, teams, metrics, funding)",
        "not_for": "Replacing detailed org design; forcing one model everywhere",
        "outputs": "Team topology, ownership model, funding model, OKR structure, governance cadence",
        "min_inputs": ["Product list and ownership gaps", "Business outcomes", "Delivery constraints"],
        "optional_inputs": ["Platform strategy", "Skill inventory", "Portfolio priorities"],
        "related": ["agile-at-scale.md", "benefits-case-value-tracking.md"],
        "refs": [
            ("Cagan, Marty. *Inspired*. Wiley.", ""),
            ("Skelton, Matthew; Pais, Manuel. *Team Topologies*. IT Revolution.", ""),
            ("OKR guidance (Doerr / Google)", "https://www.whatmatters.com/"),
        ],
    },
    {
        "name": "Agile at Scale (Ways of Working)",
        "slug": "agile-at-scale",
        "level": "Advanced",
        "duration": "1–3 days design + 1–3 months rollout",
        "best_for": "Aligning multiple teams on cadence, governance, and flow; improving predictability",
        "not_for": "Copy-pasting one framework without context; using agile as a label without outcome metrics",
        "outputs": "Operating cadence, governance, roles, flow metrics, risk controls, improvement backlog",
        "min_inputs": ["Team landscape", "Delivery bottlenecks", "Product/portfolio priorities"],
        "optional_inputs": ["DORA metrics baseline", "Org constraints", "Compliance needs"],
        "related": ["product-operating-model.md", "kanban-wip-limits.md"],
        "refs": [
            ("SAFe", "https://scaledagileframework.com/"),
            ("LeSS", "https://less.works/"),
            ("DORA metrics", "https://dora.dev/"),
        ],
    },
    {
        "name": "Capability / Skills Gap Analysis",
        "slug": "capability-skills-gap-analysis",
        "level": "Core",
        "duration": "60–180 minutes initial + iterative updates",
        "best_for": "Identifying capability gaps, prioritizing training/hiring/partnering",
        "not_for": "HR theater without linking to roadmap and delivery outcomes",
        "outputs": "Capability map, current vs required skill levels, hiring/training plan, initiative backlog",
        "min_inputs": ["Target capabilities", "Current roles/skills inventory", "Roadmap needs"],
        "optional_inputs": ["Market salary ranges", "Training catalog", "Partner options"],
        "related": ["change-management-plan-adkar.md", "product-operating-model.md"],
        "refs": [
            ("SFIA (skills framework)", "https://sfia-online.org/"),
            ("DAMA-DMBOK2 (data roles)", "https://www.dama.org/content/body-knowledge"),
            ("Team Topologies (team design)", "https://teamtopologies.com/"),
        ],
    },
    {
        "name": "Change Management Plan (ADKAR + Adoption)",
        "slug": "change-management-plan-adkar",
        "level": "Core",
        "duration": "2–6 hours setup + weekly cadence",
        "best_for": "Driving adoption, reducing resistance, coordinating comms/training/engagement",
        "not_for": "Treating change as comms only; skipping stakeholder management",
        "outputs": "Stakeholder map, ADKAR plan, comms plan, training plan, adoption KPIs, risk log",
        "min_inputs": ["Transformation scope and impacts", "Stakeholder groups", "Adoption metrics"],
        "optional_inputs": ["Survey baseline", "Change calendar", "Culture constraints"],
        "related": ["transformation-roadmap.md", "capability-skills-gap-analysis.md"],
        "refs": [
            ("Prosci ADKAR", "https://www.prosci.com/methodology/adkar"),
            ("Kotter. *Leading Change*", ""),
            ("Heath, Chip; Heath, Dan. *Switch* (behavior change)", ""),
        ],
    },
    {
        "name": "Digital Risk Assessment (Security/Privacy/Compliance)",
        "slug": "digital-risk-assessment",
        "level": "Core",
        "duration": "60–180 minutes + evidence completion",
        "best_for": "Identifying security/privacy/compliance risks and required controls for the transformation plan",
        "not_for": "Replacing full security audit; risk checklists without mitigation actions",
        "outputs": "Risk register, control requirements, mitigation initiatives, go/no-go flags for releases",
        "min_inputs": ["Scope and systems impacted", "Data classifications", "Regulatory context"],
        "optional_inputs": ["Incident history", "Threat model artifacts", "Vendor risk inputs"],
        "related": ["technology-standards-guardrails.md", "ai-use-case-factory.md"],
        "refs": [
            ("NIST Cybersecurity Framework", "https://www.nist.gov/cyberframework"),
            ("ISO/IEC 27001", "https://www.iso.org/isoiec-27001-information-security.html"),
            ("NIST Privacy Framework", "https://www.nist.gov/privacy-framework"),
        ],
    },
]


def render(tool: dict) -> str:
    name = tool["name"]
    slug = tool["slug"]
    related = "\n".join([f"  - (link) `./{p}`" for p in tool.get("related", [])])
    refs = "\n".join([f"- {t[0]}{(' — ' + t[1]) if t[1] else ''}" for t in tool["refs"]])
    min_inputs = "\n".join([f"  - {x}" for x in tool["min_inputs"]])
    opt_inputs = "\n".join([f"  - {x}" for x in tool["optional_inputs"]])

    return f"""# {name}

## Metadata

- **Tool name**: {name}
- **Slug**: `{slug}`
- **Category**: Transformation
- **Level**: {tool["level"]}
- **Typical duration**: {tool["duration"]}
- **Best for**: {tool["best_for"]}
- **Not for**: {tool["not_for"]}
- **Primary outputs**: {tool["outputs"]}
- **Required inputs (minimum)**:
{min_inputs}
- **Optional inputs**:
{opt_inputs}
- **Related tools (internal)**:
{related if related else "  - (link) `./digital-transformation-assessment.md`"}
- **Created**: 2026-01-31
- **Last updated**: 2026-01-31
- **Owner**: Consultify (Transformation tools)

---

## 1. Purpose (What this tool solves)

### 1.1 Goal

Define a transformation-grade artifact that supports decision-making and execution for: **{name}**.

### 1.2 When to use

- When you need a repeatable, evidence-backed way to make decisions and convert them into initiatives.

### 1.3 When NOT to use (anti-patterns)

- When inputs are missing and no evidence can be collected.

### 1.4 What “good” looks like

- Outputs are decision-grade, measurable, and traceable to initiatives.

---

## 2. Concept & key definitions

### 2.1 Core concepts

- Define the key constructs and what decisions they enable.

### 2.2 Glossary

| Term | Definition | Notes |
| --- | --- | --- |
| Scope | Boundary of what is included | Prevent scope creep |
| Evidence | Artifacts and metrics backing claims | Links required |

---

## 3. Inputs

### 3.1 Minimum required inputs

| Input | Description | Example | Where in the app it can come from |
| --- | --- | --- | --- |
| Scope | Business unit / region / horizon | “EU, 18 months” | Project context |
| Outcomes | What success means | “Lead time -30%” | KPI panel |
| Constraints | Limits (budget/risk) | “No downtime” | Notes |

### 3.2 Optional inputs (improves quality)

| Input | Description | Example | Where in the app it can come from |
| --- | --- | --- | --- |
| Inventory | apps/data/teams | “420 apps” | Upload |
| Evidence | policies/metrics | “DORA dashboard” | Attachments |

### 3.3 Data quality checks

- Units and definitions must be consistent.
- Separate facts vs assumptions and record sources.

---

## 4. Step-by-step method (How the user works with it)

### Step 1 — Setup

- Confirm scope, horizon, and outcomes.

### Step 2 — Collect facts

- Collect the minimum evidence needed for decision-grade outputs.

### Step 3 — Structure

- Use a repeatable structure and record assumptions.

### Step 4 — Analyze

- Identify gaps, constraints, and dependencies.

### Step 5 — Synthesize insights

- Convert analysis into clear recommendations with trade-offs.

### Step 6 — Convert to initiatives

- Generate initiatives with: title, rationale, expected impact, effort, risks, first steps, and traceability.

### Common mistakes & fixes

- Mistake → Fix

---

## 5. Outputs & Definition of Done

### 5.1 Outputs (deliverables)

| Deliverable | Description | Format in the app |
| --- | --- | --- |
| Primary artifact | The main tool output | Structured document |
| Decision log | Decisions and owners | Table |
| Initiative backlog | Actionable items | Initiatives list |

### 5.2 Definition of Done (DoD) checklist

- [ ] Scope and outcomes defined
- [ ] Evidence attached for key claims
- [ ] Recommendations include trade-offs
- [ ] Initiatives created with traceability

---

## 6. UI / Graphic specification (What the user sees)

### 6.1 Screens / views

- Tool Hub card → Workspace (stepper) + Control panel

### 6.2 Layout requirements

- Left: steps and artifacts; Right: status, DoD, review/approve, export, initiatives.

### 6.3 Interactions

- Deep links: initiatives link back to source section.

### 6.4 States

- Draft → Review → Approved (read-only rules)

### 6.5 Export formats

- PDF (client-ready report)

---

## 7. Worked example (End-to-end)

### 7.1 Context

Example company transforming delivery speed and reliability.

### 7.2 Inputs (filled)

- Scope: one business unit, 12 months.

### 7.3 Analysis (filled)

- Show results in text form (tables/structures).

### 7.4 Insights

- 3–7 key insights.

### 7.5 Initiatives derived

| Initiative title | Rationale | Expected impact | Effort | Risks | First 2 steps |
| --- | --- | --- | --- | --- | --- |
| Example initiative | Linked to tool output | KPI improvement | Medium | Adoption | Pilot; measure |

---

## 8. Implementation spec (How to build it in the app)

### 8.1 Data model (JSON)

```json
{{
  "setup": {{"scope": "string", "horizonMonths": 12}},
  "artifact": {{"type": "{slug}", "version": 1}},
  "initiativeDrafts": [{{"title": "string", "traceability": {{"source": "string"}}}}]
}}
```

### 8.2 Steps & sections mapping

- `setup` → `artifact` → `decisions` → `initiatives`

### 8.3 Validation rules (DoD)

- Block approval if key sections are missing evidence.

### 8.4 Initiative generation spec

- Default batch 5, max 12; require traceability.

### 8.5 API surface (high-level)

- Canonical Tools endpoints (create, autosave, request-review, approve, generate initiatives).

---

## 9. AI spec (How to behave like a world-class consultant)

### 9.1 Non-negotiable reasoning rules

- Separate facts vs assumptions.
- Provide trade-offs and confidence.
- Never propose initiatives without clear rationale and metrics.

### 9.2 Prompt outline

- Goals → evidence → analysis → recommendations → initiatives.

### 9.3 Extraction schema (JSON)

```json
{{
  "recommendations": [{{"title": "string", "tradeoffs": ["string"], "confidence": "low|medium|high"}}],
  "initiativeCandidates": [{{"title": "string", "metrics": ["string"]}}]
}}
```

### 9.4 Self-checks

- Are outputs decision-grade and evidence-backed?
- Are initiatives traceable and measurable?

---

## 10. Consultant Report Specification (What goes into the final report)

- Executive summary
- Method and scope
- Tool artifact outputs
- Decisions and trade-offs
- Initiative portfolio and next steps

---

## 11. Video storyboard (script-ready)

- 45–60s intro: purpose → outputs → how to use → initiatives → export.

---

## 12. Knowledge base extraction pack

### TL;DR (5–8 sentences)

{name} is a transformation tool that converts inputs and evidence into decision-grade outputs and actionable initiatives with traceability.

### FAQ (at least 8)

1. What is {name} used for?
2. What inputs are required?
3. What is the most common failure mode?
4. How do we validate the results?
5. How do we convert results into initiatives?
6. How do we measure impact?
7. Who owns the outputs?
8. How often should we update this artifact?

---

## 13. Additional Resources & Learning Links

- See the references section for authoritative starting points.

---

## 14. References (Authoritative Sources)

{refs}
"""


def main() -> int:
    DT_DIR.mkdir(parents=True, exist_ok=True)
    created = 0
    for tool in TOOLS:
        path = DT_DIR / f"{tool['slug']}.md"
        if path.exists():
            continue
        path.write_text(render(tool), encoding="utf-8")
        created += 1
    print(f"Created {created} transformation tool docs in {DT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

