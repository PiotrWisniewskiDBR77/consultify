# Atelier Full Dataset - Business Rollout Map

Status: Canonical execution map
Audience: Product, Engineering, Delivery, Demo, Sales Engineering, Operations
Quality bar: Consulting-grade (executive-ready, evidence-driven, decision-safe)

---

## 1. Business Objective

Consultify must present Atelier Toys as a fully living enterprise system, not a static demo dataset.
The dataset must support:

- high-conviction enterprise demos on staging,
- controlled promotion to production,
- repeatable post-promotion operations without manual patching.

Success means every key module tells one coherent business story:

`signal -> diagnosis -> decision -> initiative -> execution -> KPI/ROI -> board narrative`

---

## 2. Target Business Outcomes

### 2.1 Demo and Staging Outcomes

- Executives see one integrated transformation story across Operations, Product, Commercial, Quality, Cyber, and Governance.
- No "empty states" in critical modules during role-based walkthroughs.
- Cross-module traceability is visible live in the product.

### 2.2 Production Outcomes

- The same dataset contract can be promoted to production with deterministic controls.
- Promotion path is release-grade (dry-run, confirmation, verification, rollback evidence).
- No runtime drift caused by conflicting seed scripts or inconsistent org identifiers.

### 2.3 Commercial Outcomes

- Demo quality is board-grade and reusable in enterprise sales cycles.
- Consultify demonstrates trust: safe data handling, controlled governance, and auditability.
- Narrative quality remains at top-tier consulting standard.

---

## 3. Canonical Dataset Contract (What "Full" Means)

Atelier Full Dataset is complete only when all six layers are materialized and linked.

### Layer A - Company and Leadership Context

- Organization profile, leadership personas, teams, role intent, ownership model.

### Layer B - Operating Portfolio

- Projects, initiatives, tasks, decisions, milestones, dependencies, statuses.

### Layer C - Results and Financial Reality

- KPI definitions, KPI time series, initiative-KPI mappings, ROI assumptions, ROI realized values, deviation cases.

### Layer D - Interview and Insight Intelligence

- Interview sessions, insight artifacts, findings, source pointers, governance handoffs.

### Layer E - Executive Artifacts

- Status reports, board narratives, report snapshots, deck-ready runtime artifacts.

### Layer F - Runtime Demo Experience

- Session-scoped org isolation, write guardrails, tool coverage metadata, scenarios, telemetry classification.

---

## 4. Internal Coherence Rules

### 4.1 Single Source Rule

- `server/src/services/demo/demoSeedService.ts` is the canonical data materialization engine for Atelier.
- `server/src/services/demo/atelierToysDemoTemplate.ts` is the canonical narrative template.
- Any non-canonical seed script is legacy/manual and must not define production truth.

### 4.2 Identifier Rule

- Canonical base org ID and promotion org IDs must be explicitly defined and never inferred ad hoc.
- No mixed runtime assumptions across `demo-org`, `atelier`, `ateliertoys-demo`, or other aliases.
- Every promotion run must log source org, target org, and evidence of effective tenant resolution.

### 4.3 Traceability Rule

Every Wave 1 strategic insight should map to:

- at least one initiative,
- at least one execution object (task/decision),
- at least one measurable KPI or ROI component,
- at least one executive artifact reference.

### 4.4 Language and Story Rule

- Executive business narrative is English-first and consistent across Insights, Program, runtime reports, and seeded summaries.
- Dataset content must preserve one digital transformation thesis end to end.

---

## 5. Coverage Matrix (Business Readiness by Module)

| Module surface | Minimum "living data" requirement | Business purpose |
|---|---|---|
| Executive overview | Portfolio, health, value, top risks, pending decisions | CEO/CFO board visibility |
| Initiatives/PMO | Initiatives with tasks, milestones, dependencies, statuses | Program control and cadence |
| Interview | Sessions, assignments, insights, evidence links | Discovery to decision logic |
| Results | KPIs, trends, deviations, ROI assumed/realized | Value proof and performance governance |
| Reports/Decks | Runtime executive artifacts linked to source data | Board communication readiness |
| My Work | Personal and team pressure loops (inbox, focus, decisions, signals) | Adoption and daily operating rhythm |

A release is not accepted if any mandatory surface is visibly underfilled.

---

## 6. Delivery Scope by Sprint

## Sprint 1 - Canonical Unification

Goal: remove seed fragmentation and establish one canonical data contract.

### File scope

- `server/src/services/demo/demoSeedService.ts` (expand to include Results + artifact runtime data)
- `server/src/services/demo/atelierToysDemoTemplate.ts` (align narrative payload with expanded runtime)
- `server/scripts/build-demo-dataset.ts` (verification mode + release metadata output)

### Explicitly non-goals

- no UI redesign,
- no new product modules,
- no broad migration rewrites outside Atelier canonical path.

### Exit criteria

- one command rebuilds full dataset coherently,
- counts and link integrity pass,
- no dependency on legacy seeds for core module completeness.

## Sprint 2 - Promotion-Grade Pipeline

Goal: production-safe promotion and verification.

### File scope

- `server/scripts/*promotion*` (new dedicated promotion path with guardrails),
- dataset verification readback script,
- release evidence output for operations.

### Exit criteria

- deterministic dry-run and write mode,
- explicit confirmation token required,
- post-promotion verification bundle generated automatically.

## Sprint 3 - Commercial Polish and Monitoring

Goal: sustained board-grade quality in live demos and production.

### Scope

- quality telemetry and coverage reporting,
- governance dashboard for dataset health,
- recurring operational checks for drift and stale nodes.

---

## 7. Promotion Path (Staging to Production)

### Stage 1 - Build and Verify on Staging

- rebuild canonical dataset,
- run completeness and linkage checks,
- produce dataset release fingerprint (`version`, `hash`, `anchor`, `counts`).

### Stage 2 - Approval Gate

- approve based on business and technical gates,
- freeze release payload and target org mapping.

### Stage 3 - Controlled Promotion

- execute with explicit confirmation and resolved DB target evidence,
- capture before/after snapshots for critical tables.

### Stage 4 - Post-Promotion Readback

- verify counts, links, and key UI endpoints,
- verify role-based walkthrough readiness.

### Stage 5 - Operational Monitoring Window

- monitor for drift and data integrity regressions,
- only then mark rollout complete.

---

## 8. Gate Model (GO / NO_GO)

### Gate A - Business Story Coherence

Pass conditions:

- one consistent digital transformation thesis across all key modules,
- no contradictory strategic signal in seeded executive artifacts.

### Gate B - Data Completeness

Pass conditions:

- all required module surfaces pass minimum coverage thresholds,
- no critical empty states for primary personas.

### Gate C - Technical Integrity

Pass conditions:

- FK-safe seeding and no unresolved reference clusters,
- deterministic rebuild behavior and idempotent reruns.

### Gate D - Production Promotion Safety

Pass conditions:

- explicit target DB evidence,
- confirmation controls in place,
- automated post-promotion readback passed.

If any gate fails: NO_GO and return to correction loop.

---

## 9. Definition of Done (Atelier Full Dataset)

Atelier Full Dataset is DONE only when:

- one canonical path builds all business-critical layers,
- staging demo is role-ready for executive walkthroughs,
- production promotion is controlled, verifiable, and repeatable,
- dataset quality meets consulting-grade narrative and evidence standards.

---

## 10. Operating Principle

The objective is not "more demo rows."
The objective is a living, internally coherent enterprise simulation that proves Consultify can run strategy, execution, and value governance in one trusted operating system.
