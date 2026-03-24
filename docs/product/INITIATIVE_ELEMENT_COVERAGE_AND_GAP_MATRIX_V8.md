# Initiative Element Coverage And Gap Matrix v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: complete audit of initiative element coverage across docs, runtime sections and PM expectations

---

## 1. Why this document exists

An initiative is only as strong as the set of elements it contains.

If core initiative domains are missing, weak or under-specified, the initiative may look complete in UI while remaining incomplete as a real delivery object.

This document checks whether the initiative package covers all necessary domains.

---

## 2. Current strong element coverage

The current package already strongly covers:

- initiative definition
- problem and target state
- scope
- KPI and financial framing
- team and RACI
- resources
- dependencies
- RAID and risks
- milestones and timeline
- tasks and decisions
- gates and governance
- comments, attachments and activity history

It also now covers:

- analysis cockpit
- technology advisory
- skill-gap and capability planning
- role resolution and team permissions
- quality, acceptance and handover
- communication, stakeholder and adoption runtime
- vendor, procurement and external delivery runtime
- assumptions and constraints register

### 2.1 Cross-initiative dependency model

> V8 Decision W3-6 applied — 2026-03-23

Dependency modeling is formally extended for cross-initiative links. `InitiativeDependency` supports explicit `source_initiative_id` and `target_initiative_id` references. Initiative-level cross-link is in scope now; optional lower-level task/milestone references may follow.

---

## 3. Current element gaps or weakly described areas

### 3.1 Technical specification as first-class runtime section

The initiative canon names `Technical Specification`, but runtime section coverage is still weaker than other initiative domains.

This should become a clearly governed initiative surface, not only an implied technology note.

### 3.2 Quality and acceptance management

This area is now covered by:

- `INITIATIVE_QUALITY_ACCEPTANCE_AND_HANDOVER_RUNTIME_V8.md`

Main remaining risk:

- the package now has doctrine, but still needs later runtime parity and section-level implementation discipline

### 3.3 Communications and engagement plan

This area is now covered by:

- `INITIATIVE_COMMUNICATION_STAKEHOLDER_AND_ADOPTION_RUNTIME_V8.md`

Main remaining risk:

- initiative communication must later be made operationally visible, not left as documentation-only doctrine

### 3.4 Procurement, vendor and external delivery readiness

This area is now covered by:

- `INITIATIVE_VENDOR_PROCUREMENT_AND_EXTERNAL_DELIVERY_RUNTIME_V8.md`

### 3.5 Benefits lifecycle beyond KPI rows

KPIs exist, but benefits realization still risks being narrower than a full business-adoption and benefits-management layer.

### 3.6 Assumptions and constraints as governed object

This area is now covered by:

- `INITIATIVE_ASSUMPTIONS_AND_CONSTRAINTS_REGISTER_RUNTIME_V8.md`

### 3.7 Closure and handover pack

This area is now substantially hardened by:

- `INITIATIVE_QUALITY_ACCEPTANCE_AND_HANDOVER_RUNTIME_V8.md`
- `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md`

---

## 4. Structural drift risks

Main current risks:

- initiative docs and runtime sections are not always one-to-one
- section registry, DB seed and completeness logic may drift
- some strong fields exist in types, but do not exist as explicit first-class sections
- some initiative expectations are spread across flow docs, UI docs and type models instead of one section-level doctrine

---

## 5. Target doctrine

`Initiative v8` should treat an initiative as a complete managed object with explicit coverage of:

- strategy and scope
- economics and benefits
- people, roles and capabilities
- technology and architecture
- quality, acceptance and handover
- work decomposition and dependencies
- timeline, capacity and risks
- communication and governance

---

## 6. Related canonical docs

- `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md`
- `INITIATIVE_QUALITY_ACCEPTANCE_AND_HANDOVER_RUNTIME_V8.md`
- `INITIATIVE_COMMUNICATION_STAKEHOLDER_AND_ADOPTION_RUNTIME_V8.md`
- `INITIATIVE_VENDOR_PROCUREMENT_AND_EXTERNAL_DELIVERY_RUNTIME_V8.md`
- `INITIATIVE_ASSUMPTIONS_AND_CONSTRAINTS_REGISTER_RUNTIME_V8.md`
- `INITIATIVE_TECHNOLOGY_ADVISORY_AND_ARCHITECTURE_RUNTIME_V8.md`
- `INITIATIVE_SKILL_GAP_AND_CAPABILITY_DEVELOPMENT_V8.md`
- `INITIATIVE_ANALYSIS_QUALITY_LOGIC_AND_CAPACITY_RUNTIME_V8.md`
- `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
